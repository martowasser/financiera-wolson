import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.fill('#email', 'e2e-admin@test.com');
  await page.fill('#password', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
});

test.describe('Settlement Flow', () => {
  test('navigates to settlements page', async ({ page }) => {
    await page.goto('/settlements');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Liquidacion de Socios')).toBeVisible({ timeout: 10000 });
  });

  test('shows settlements page content', async ({ page }) => {
    await page.goto('/settlements');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: 'Nueva Liquidacion' })).toBeVisible({ timeout: 10000 });
  });
});
