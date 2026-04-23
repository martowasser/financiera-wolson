import { test, expect } from '@playwright/test';

test.describe('Auth Flow', () => {
  test('logs in with valid credentials and sees dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'e2e-admin@test.com');
    await page.fill('#password', 'password123');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'e2e-admin@test.com');
    await page.fill('#password', 'wrong-password');
    await page.click('button[type="submit"]');

    // Should stay on login page and show error
    await expect(page.locator('text=incorrectos')).toBeVisible({ timeout: 5000 });
  });

  test('survives hard refresh (httpOnly cookie)', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('#email', 'e2e-admin@test.com');
    await page.fill('#password', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Hard refresh
    await page.reload();

    // Should still be on dashboard (cookie preserved auth)
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('logs out and redirects to login', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('#email', 'e2e-admin@test.com');
    await page.fill('#password', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Find and click logout button
    const logoutButton = page.locator('button:has-text("Cerrar"), button:has-text("Salir"), [aria-label="Logout"]');
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
    } else {
      // Try menu-based logout
      const userMenu = page.locator('[data-testid="user-menu"], button:has(svg.lucide-log-out)');
      if (await userMenu.isVisible()) {
        await userMenu.click();
      }
    }

    // After logout, should redirect to login
    await page.waitForURL('**/login', { timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });
});
