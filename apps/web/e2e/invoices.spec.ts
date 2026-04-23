import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.fill('#email', 'e2e-admin@test.com');
  await page.fill('#password', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
});

test.describe('Invoice Flow', () => {
  test('navigates to invoices page', async ({ page }) => {
    await page.goto('/invoices');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Cobro de Alquileres')).toBeVisible({ timeout: 10000 });
  });

  test('shows invoice page content', async ({ page }) => {
    await page.goto('/invoices');
    await page.waitForLoadState('networkidle');

    // Should see the create button
    await expect(page.getByRole('button', { name: 'Nueva Factura' })).toBeVisible({ timeout: 10000 });
  });
});
