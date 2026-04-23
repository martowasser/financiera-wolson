import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../build-app.js';
import { createTestUser, getAuthToken, authHeader } from '../../test-helpers.js';
import prisma from '../../lib/prisma.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
});

describe('Auth Routes', () => {
  // ─── POST /api/auth/login ─────────────────────────────────────────────
  describe('POST /api/auth/login', () => {
    it('returns user + accessToken + sets httpOnly refresh cookie', async () => {
      await createTestUser({ username: 'login-user', password: 'password123' });

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'login-user', password: 'password123' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.user.username).toBe('login-user');
      expect(body.accessToken).toBeDefined();
      expect(body.user.password).toBeUndefined();

      // Check httpOnly refresh cookie
      const cookies = res.cookies as Array<{ name: string; httpOnly?: boolean; path?: string }>;
      const refreshCookie = cookies.find(c => c.name === 'refresh_token');
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie!.httpOnly).toBe(true);
      expect(refreshCookie!.path).toBe('/api/auth');
    });

    it('rejects too-short username', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'ab', password: 'password123' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('rejects wrong password', async () => {
      await createTestUser({ username: 'wrong-pw-user', password: 'password123' });

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'wrong-pw-user', password: 'wrong-password' },
      });

      expect(res.statusCode).toBe(401);
    });

    it('rejects inactive user', async () => {
      await createTestUser({ username: 'inactive-user', password: 'password123', isActive: false });

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'inactive-user', password: 'password123' },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // ─── POST /api/auth/register ──────────────────────────────────────────
  describe('POST /api/auth/register', () => {
    it('creates user with ADMIN token', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: authHeader(token),
        payload: {
          username: 'new-user',
          password: 'securepass123',
          name: 'New User',
          role: 'OPERATOR',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.username).toBe('new-user');
      expect(body.role).toBe('OPERATOR');
      expect(body.password).toBeUndefined();
    });

    it('rejects without auth', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          username: 'no-auth-user',
          password: 'securepass123',
          name: 'No Auth',
          role: 'OPERATOR',
        },
      });

      expect(res.statusCode).toBe(401);
    });

    it('rejects with OPERATOR role (insufficient permissions)', async () => {
      const operator = await createTestUser({ role: 'OPERATOR' });
      const token = getAuthToken(operator);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: authHeader(token),
        payload: {
          username: 'from-operator-user',
          password: 'securepass123',
          name: 'From Operator',
          role: 'VIEWER',
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it('rejects duplicate username', async () => {
      const admin = await createTestUser({ username: 'admin-dup', role: 'ADMIN' });
      const token = getAuthToken(admin);

      // Try to register with the same username
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: authHeader(token),
        payload: {
          username: 'admin-dup',
          password: 'securepass123',
          name: 'Dup User',
          role: 'OPERATOR',
        },
      });

      expect(res.statusCode).toBe(409);
    });

    it('validates minimum password length', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: authHeader(token),
        payload: {
          username: 'short-pw-user',
          password: 'short',
          name: 'Short PW',
          role: 'OPERATOR',
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ─── POST /api/auth/refresh ───────────────────────────────────────────
  describe('POST /api/auth/refresh', () => {
    it('returns new accessToken + user + rotates refresh cookie', async () => {
      const user = await createTestUser({ username: 'refresh-user', password: 'password123' });

      // Login first to get a refresh token
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'refresh-user', password: 'password123' },
      });

      const cookies = loginRes.cookies as Array<{ name: string; value: string }>;
      const refreshCookie = cookies.find(c => c.name === 'refresh_token')!;

      // Use the refresh token
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        cookies: { refresh_token: refreshCookie.value },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.accessToken).toBeDefined();
      expect(body.user.username).toBe('refresh-user');

      // New refresh cookie should be set (rotated)
      const newCookies = res.cookies as Array<{ name: string; value: string }>;
      const newRefreshCookie = newCookies.find(c => c.name === 'refresh_token')!;
      expect(newRefreshCookie).toBeDefined();
      expect(newRefreshCookie.value).not.toBe(refreshCookie.value);
    });

    it('rejects without refresh cookie', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
      });

      expect(res.statusCode).toBe(401);
    });

    it('rejects with expired refresh token', async () => {
      const user = await createTestUser({ username: 'expired-user', password: 'password123' });

      // Create an already-expired refresh token
      const expiredToken = await prisma.refreshToken.create({
        data: {
          token: 'expired-token-string',
          userId: user.id,
          expiresAt: new Date(Date.now() - 1000), // already expired
        },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        cookies: { refresh_token: expiredToken.token },
      });

      expect(res.statusCode).toBe(401);
    });

    it('rejects reuse of rotated token (token rotation)', async () => {
      await createTestUser({ username: 'rotation-user', password: 'password123' });

      // Login
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'rotation-user', password: 'password123' },
      });

      const cookies = loginRes.cookies as Array<{ name: string; value: string }>;
      const oldRefreshToken = cookies.find(c => c.name === 'refresh_token')!.value;

      // Refresh once (rotates the token)
      await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        cookies: { refresh_token: oldRefreshToken },
      });

      // Try to reuse the old token — should fail
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        cookies: { refresh_token: oldRefreshToken },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // ─── POST /api/auth/logout ────────────────────────────────────────────
  describe('POST /api/auth/logout', () => {
    it('clears refresh cookie + deletes token from DB', async () => {
      await createTestUser({ username: 'logout-user', password: 'password123' });

      // Login
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'logout-user', password: 'password123' },
      });

      const cookies = loginRes.cookies as Array<{ name: string; value: string }>;
      const refreshToken = cookies.find(c => c.name === 'refresh_token')!.value;

      // Logout
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        cookies: { refresh_token: refreshToken },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().message).toBe('Logged out successfully');

      // Verify token deleted from DB
      const dbToken = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
      expect(dbToken).toBeNull();
    });

    it('succeeds even without cookie (idempotent)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
      });

      expect(res.statusCode).toBe(200);
    });
  });
});
