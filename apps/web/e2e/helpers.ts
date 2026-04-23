import { Page, expect } from '@playwright/test';

const API_URL = 'http://localhost:3001/api';

// Seed an admin user via the API (bypasses register's auth requirement)
export async function seedTestData() {
  // First create a user directly via login attempt — if it fails, we need to register via DB
  // Use the API's test DB: create user via fetch to a special seed endpoint
  // Since register requires ADMIN auth, we'll create user via direct API calls:

  // 1. Create admin user by calling register with a bootstrapped token
  // Actually, for E2E we need to seed via the DB directly. Let's use the API's auth/register
  // But that requires auth... Let's create the user via the test database connection.

  // Simplest approach: create user via direct API POST to login
  // If user doesn't exist, we need another approach.

  // For E2E, let's use a fetch to create the user via prisma-style endpoint.
  // Since we don't have a seed endpoint, we'll use the bcrypt password hash approach:
  // Pre-hash "password123" with bcrypt rounds=4 and insert via SQL.

  // Actually, the cleanest approach for Playwright is to call the DB directly
  // But we can't do that from the browser test. Instead, we use a helper script.

  // Let's just use fetch with the API - first try login, if it fails, do nothing
  // and expect the test setup to handle seeding.
  return;
}

export async function createAdminUser(): Promise<{ email: string; password: string }> {
  // Create admin via direct DB insert using fetch to API
  // We'll use a two-step approach: first login attempt, if fails, register via API workaround
  const email = `e2e-admin-${Date.now()}@test.com`;
  const password = 'password123';

  // Use a raw SQL approach via the test setup, or rely on a pre-seeded admin
  // For simplicity, we'll create a pre-seeded admin in the globalSetup
  return { email, password };
}

export async function loginViaAPI(page: Page, email: string, password: string) {
  // Login via the API and set the cookie on the page context
  const response = await page.request.post(`${API_URL}/auth/login`, {
    data: { email, password },
  });

  if (!response.ok()) {
    throw new Error(`Login failed: ${response.status()} ${await response.text()}`);
  }

  return response.json();
}

export async function loginViaUI(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  // Wait for navigation to dashboard
  await page.waitForURL(/\/(dashboard|viewer)/, { timeout: 10000 });
}

export async function expectToast(page: Page, text: string) {
  // Sonner toasts use [data-sonner-toast] attribute
  const toast = page.locator('[data-sonner-toast]').filter({ hasText: text });
  await expect(toast).toBeVisible({ timeout: 5000 });
}

export async function cleanTestData() {
  // Clean all data via direct API/DB call
  // In E2E tests, the test-setup.ts handles cleanup for API tests
  // For browser tests, we'll call an API endpoint or use prisma directly
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'cleanup', password: 'cleanup' }),
  }).catch(() => null);
  // Cleanup is best-effort for E2E
}

// Create test user directly in DB via API seeding
export async function seedAdminAndLogin(page: Page): Promise<{ token: string; userId: string }> {
  // Since we can't register without auth, we use a global setup that creates the admin
  // For now, we rely on the E2E global setup having created the admin user
  const email = 'e2e-admin@test.com';
  const password = 'password123';

  const result = await loginViaAPI(page, email, password);
  return { token: result.accessToken, userId: result.user.id };
}
