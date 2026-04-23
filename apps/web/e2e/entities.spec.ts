import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.fill('#email', 'e2e-admin@test.com');
  await page.fill('#password', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
});

test.describe('Entity Management', () => {
  test('lists entities on the entities page', async ({ page }) => {
    await page.goto('/entities');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('E2E Test Entity')).toBeVisible({ timeout: 5000 });
  });

  test('creates a new entity via form', async ({ page }) => {
    await page.goto('/entities');
    await page.waitForLoadState('networkidle');

    // Click create button
    await page.getByRole('button', { name: 'Nueva Entidad' }).click();

    // Wait for dialog to open and fill the name input (first input in the dialog)
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    const nameInput = dialog.locator('input').first();
    await nameInput.fill('E2E Created Entity');

    // Submit
    await dialog.getByRole('button', { name: 'Guardar' }).click();

    // Wait for dialog to close and verify entity appears
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText('E2E Created Entity')).toBeVisible({ timeout: 5000 });
  });

  test('searches entities', async ({ page }) => {
    await page.goto('/entities');
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByPlaceholder('Buscar entidad...');
    await searchInput.fill('E2E Test');
    await page.waitForTimeout(500);

    await expect(page.getByText('E2E Test Entity')).toBeVisible();
  });
});
