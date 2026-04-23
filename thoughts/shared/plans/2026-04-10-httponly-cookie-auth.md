# httpOnly Cookie Auth Migration

## Overview
Migrate from client-side token management (access token in JS memory, refresh token in regular `document.cookie`) to the OWASP-recommended hybrid approach: **refresh token in httpOnly cookie** (set by server), **access token in JS memory** (unchanged). This fixes the "logged out on hard refresh" bug and hardens security for this financial system.

## Interview Summary
- **Approach**: OWASP hybrid — refresh token as httpOnly cookie, access token in memory
- **Domain**: Same domain in production (no BFF proxy needed)
- **CSRF**: SameSite=Strict only (sufficient for same-domain)
- **User data**: Keep `{ user }` in login/refresh response body (no /auth/me endpoint)

## Current State
- **Access token**: JWT (15min), stored in JS variable (`api.ts:4`), sent as `Authorization: Bearer` header
- **Refresh token**: Random hex (7 days), stored in regular cookie via `document.cookie`, sent in request body
- **Problem**: On hard refresh (Cmd+Shift+R), access token lost. Client reads refresh token from `document.cookie` and calls `/auth/refresh` with it in the body. If API is down or call fails, user is logged out. Also, refresh token cookie is **not** httpOnly — vulnerable to XSS.

## Desired End State
- **Access token**: JWT (15min), stored in JS memory (unchanged), sent as `Authorization: Bearer` header (unchanged)
- **Refresh token**: Random hex (7 days), set by **server** as httpOnly/Secure/SameSite=Strict cookie, **never** accessible to client JS
- **On hard refresh**: Client calls `POST /auth/refresh` with `credentials: 'include'`. Browser auto-sends the httpOnly cookie. Server reads it from cookie, validates, sets a new httpOnly cookie, returns `{ user, accessToken }` in body. Client stores access token in memory, user stays logged in.
- **Client code**: No more `document.cookie` parsing, no more `setRefreshToken()`. All token management for refresh tokens happens server-side.

## What We're NOT Doing
- Not adding CSRF tokens (SameSite=Strict is sufficient)
- Not adding a /auth/me endpoint
- Not changing access token storage (stays in JS memory)
- Not changing the database schema
- Not changing the auth service logic (token generation, rotation, DB storage)

## Implementation Approach
Minimal changes. The auth service (`service.ts`) stays untouched — it already returns `{ accessToken, refreshToken }`. We intercept at the **route layer** to move the refresh token from the response body into a cookie, and read it from the cookie instead of the request body.

---

## Phase 1: API — Cookie Infrastructure

### Overview
Install `@fastify/cookie`, register it, update CORS for credentials.

### Changes Required

**File**: `apps/api/package.json`
**Changes**: Add `@fastify/cookie` dependency

**File**: `apps/api/src/index.ts`
**Changes**:
1. Import and register `@fastify/cookie`
2. Update CORS config to add `credentials: true`

```ts
// Add import
import cookie from '@fastify/cookie';

// Register cookie plugin (before routes)
await server.register(cookie);

// Update CORS
await server.register(cors, {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
});
```

### Success Criteria
#### Automated:
- [ ] TypeScript compiles
- [ ] Server starts without errors

---

## Phase 2: API — Auth Routes Set/Read Cookies

### Overview
Modify login, refresh, and logout routes to set/read/clear the refresh token httpOnly cookie. The auth service returns stay unchanged — routes handle the cookie layer.

### Changes Required

**File**: `apps/api/src/modules/auth/routes.ts`
**Changes**:

1. **Add cookie helper** at top of file:
```ts
const REFRESH_COOKIE = 'refresh_token';
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/auth',  // Only sent to auth endpoints
  maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
};
```

2. **POST /login** — set cookie, remove refreshToken from response body:
```ts
async (request, reply) => {
  const body = loginSchema.parse(request.body);
  const result = await authService.login(body.email, body.password);

  reply.setCookie(REFRESH_COOKIE, result.refreshToken, REFRESH_COOKIE_OPTIONS);

  return { user: result.user, accessToken: result.accessToken };
};
```

3. **POST /refresh** — read from cookie instead of body, set new cookie:
```ts
async (request, reply) => {
  const refreshToken = request.cookies[REFRESH_COOKIE];
  if (!refreshToken) {
    throw unauthorized('Missing refresh token');
  }

  const result = await authService.refresh(refreshToken);

  reply.setCookie(REFRESH_COOKIE, result.refreshToken, REFRESH_COOKIE_OPTIONS);

  return {
    user: result.user,
    accessToken: result.accessToken,
  };
};
```

4. **POST /logout** — read from cookie, clear cookie:
```ts
async (request, reply) => {
  const refreshToken = request.cookies[REFRESH_COOKIE];
  if (refreshToken) {
    await authService.logout(refreshToken);
  }

  reply.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });

  return { message: 'Logged out successfully' };
};
```

5. **Remove `refreshSchema` and `logoutSchema`** — no longer reading from body.

**File**: `apps/api/src/modules/auth/service.ts`
**Changes**:
- Modify `refresh()` to also return the user data (currently only returns tokens). This avoids needing a separate /auth/me call.

```ts
// Change return of refresh() to include user:
return {
  user: excludePassword(storedToken.user),
  accessToken,
  refreshToken: newRefreshTokenStr,
};
```

- Update return type accordingly.

### Success Criteria
#### Automated:
- [ ] TypeScript compiles
- [ ] Login sets `Set-Cookie` header with httpOnly flag
- [ ] Refresh reads cookie, returns new tokens + user
- [ ] Logout clears cookie

#### Manual:
- [ ] Cookie visible in browser DevTools under Application > Cookies (shown as httpOnly)
- [ ] Cookie NOT accessible via `document.cookie` in console

---

## Phase 3: Web — Remove Client-Side Token Management

### Overview
Strip all refresh token handling from the client. Access token stays in memory. All fetches use `credentials: 'include'`.

### Changes Required

**File**: `apps/web/src/lib/api.ts`
**Changes**:
1. **Remove**: `setRefreshToken()`, `getRefreshToken()` functions
2. **Keep**: `accessToken` variable, `setAccessToken()`, `getAccessToken()`
3. **Add `credentials: 'include'`** to all `fetch()` calls (so browser sends httpOnly cookie)
4. **Update 401 retry logic**: Call `/auth/refresh` with just `credentials: 'include'` (no body), read `accessToken` from response JSON

```ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',  // browser sends httpOnly cookie
    });
    if (!res.ok) return null;
    const data = await res.json();
    setAccessToken(data.accessToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

// In apiFetch: add credentials: 'include' to every fetch call
```

**File**: `apps/web/src/lib/auth-context.tsx`
**Changes**:
1. **Remove** all `document.cookie` parsing
2. **Remove** `setRefreshToken` import/calls
3. **On mount**: Just call `apiFetch('/auth/refresh', { method: 'POST' })` — the browser sends the httpOnly cookie automatically. If it succeeds, set user + access token in state.
4. **Login**: Call login endpoint, set user + access token from response (no refresh token handling)
5. **Logout**: Call logout endpoint with just `credentials: 'include'`, clear user + access token

```ts
// Simplified mount effect:
useEffect(() => {
  apiFetch<{ user: User; accessToken: string }>('/auth/refresh', { method: 'POST' })
    .then((data) => {
      setAccessToken(data.accessToken);
      setUser(data.user);
    })
    .catch(() => {
      setAccessToken(null);
    })
    .finally(() => setIsLoading(false));
}, []);

// Simplified login:
const login = useCallback(async (email: string, password: string): Promise<User> => {
  const data = await apiFetch<{ user: User; accessToken: string }>(
    '/auth/login',
    { method: 'POST', body: { email, password } },
  );
  setAccessToken(data.accessToken);
  setUser(data.user);
  return data.user;
}, []);

// Simplified logout:
const logout = useCallback(() => {
  apiFetch('/auth/logout', { method: 'POST' }).catch(() => {});
  setAccessToken(null);
  setUser(null);
}, []);
```

### Success Criteria
#### Automated:
- [ ] TypeScript compiles (web)
- [ ] No references to `document.cookie` for tokens
- [ ] No references to `setRefreshToken` or `getRefreshToken`

#### Manual:
- [ ] Login works, user sees dashboard
- [ ] Hard refresh (Cmd+Shift+R) keeps user logged in
- [ ] Logout works, user redirected to login
- [ ] After logout, hard refresh stays on login (cookie cleared)
- [ ] `document.cookie` in console does NOT show refresh_token

---

## Edge Cases Addressed
- **API down on refresh**: `apiFetch('/auth/refresh')` fails in catch → user shown login page (same as now, but intentional)
- **Expired refresh token**: Server deletes it, returns 401 → client clears state → login page
- **Multiple tabs**: Each tab does its own `/auth/refresh` on mount — token rotation means only one succeeds. The others get 401 and redirect to login. This is acceptable for now; if multi-tab is needed later, use BroadcastChannel.
- **Cookie path scoping**: Cookie set with `path: '/api/auth'` so it's only sent to auth endpoints, not every API call (reduces overhead)

## Testing Strategy
- **Manual**: Login → hard refresh → verify still logged in → logout → hard refresh → verify on login page
- **DevTools**: Application > Cookies — verify httpOnly flag is set, cookie not in `document.cookie`

## References
- [OWASP Token Storage](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [Curity OAuth Cookie Best Practices](https://curity.io/resources/learn/oauth-cookie-best-practices/)
- [@fastify/cookie docs](https://github.com/fastify/fastify-cookie)
