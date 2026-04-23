import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.fill('#email', 'e2e-admin@test.com');
  await page.fill('#password', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
});

test.describe('Reconciliation Flow', () => {
  test('navigates to reconciliation page', async ({ page }) => {
    await page.goto('/reconciliation');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Conciliacion Bancaria')).toBeVisible({ timeout: 10000 });
  });

  test('shows reconciliation page content', async ({ page }) => {
    await page.goto('/reconciliation');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: 'Nueva Conciliacion' })).toBeVisible({ timeout: 10000 });
  });
});
