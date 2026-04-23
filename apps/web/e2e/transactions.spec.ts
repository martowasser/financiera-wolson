import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.fill('#email', 'e2e-admin@test.com');
  await page.fill('#password', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
});

test.describe('Transaction Flow', () => {
  test('navigates to transactions page', async ({ page }) => {
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Transacciones' })).toBeVisible({ timeout: 10000 });
  });

  test('shows new transaction button', async ({ page }) => {
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Nueva Transaccion')).toBeVisible({ timeout: 10000 });
  });

  test('shows filter controls', async ({ page }) => {
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');

    // Should have search and filter controls
    const searchInput = page.getByPlaceholder('Buscar...');
    await expect(searchInput).toBeVisible({ timeout: 10000 });
  });
});
