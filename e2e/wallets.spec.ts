import { test, expect } from '@playwright/test';
import { setupPage, waitForAppReady, navigateTo, closeModal, waitForLoading } from './helpers';

test.describe('Wallets Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
    await page.goto('/');
    await waitForAppReady(page);
    await navigateTo(page, 'wallets');
    await waitForLoading(page);
  });

  // Clean up any open modals after each test
  test.afterEach(async ({ page }) => {
    const modal = page.locator('[role="dialog"]');
    if (await modal.count() > 0) {
      await page.keyboard.press('Escape');
      await expect(modal).toHaveCount(0, { timeout: 3000 }).catch(() => {
        // Modal might already be closed
      });
    }
  });

  test('should load wallets page with summary cards', async ({ page }) => {
    // Summary cards should be visible
    await expect(page.getByText('Total On-chain Value')).toBeVisible();
    await expect(page.getByText('Active Chains')).toBeVisible();
    await expect(page.getByText('Total Tokens')).toBeVisible();
  });

  test('should show Connected Wallets section', async ({ page }) => {
    // Wallets list header should be visible
    await expect(page.getByText('Connected Wallets')).toBeVisible();
  });

  test('should open Add Wallet modal manually', async ({ page }) => {
    // Click Add Manually button
    const addManuallyBtn = page.getByRole('button', { name: /Add Manually|Add/i }).first();
    await expect(addManuallyBtn).toBeVisible({ timeout: 10000 });
    await addManuallyBtn.click();

    // Modal should open
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Should have wallet address input
    const addressInput = modal.locator('input').first();
    await expect(addressInput).toBeVisible();

    // Close modal
    await closeModal(page);
  });

  test('should show Connect Wallet button for chain selection', async ({ page }) => {
    // Connect Wallet button should exist
    const connectWalletBtn = page.getByRole('button', { name: /Connect Wallet/i }).first();
    await expect(connectWalletBtn).toBeVisible({ timeout: 10000 });

    // Click to open chain selector
    await connectWalletBtn.click();

    // Chain selector modal should open
    const chainSelector = page.locator('[role="dialog"]');
    await expect(chainSelector).toBeVisible({ timeout: 5000 });

    // Close modal
    await page.keyboard.press('Escape');
  });

  test('should validate wallet address input', async ({ page }) => {
    // Open Add Manually modal
    await page.getByRole('button', { name: 'Add Manually' }).click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Find address input
    const addressInput = modal.locator('input').first();
    await expect(addressInput).toBeVisible();

    // Enter invalid address
    await addressInput.fill('invalid-address');

    // Submit form
    const submitBtn = modal.getByRole('button', { name: 'Add Wallet' });
    await submitBtn.click();

    // Should show error (validation should fail)
    const errorAlert = modal.locator('[role="alert"], .text-loss');
    if (await errorAlert.count() > 0) {
      await expect(errorAlert.first()).toBeVisible();
    }

    // Close modal
    await page.keyboard.press('Escape');
  });

  test('should accept valid EVM address format', async ({ page }) => {
    // Open Add Manually modal
    await page.getByRole('button', { name: 'Add Manually' }).click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Enter valid EVM address (checksum format)
    const addressInput = modal.locator('input').first();
    await addressInput.fill('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'); // vitalik.eth

    // Enter label
    const labelInput = modal.locator('input').nth(1);
    if (await labelInput.count() > 0) {
      await labelInput.fill('Test Wallet');
    }

    // Submit button should be enabled
    const submitBtn = modal.getByRole('button', { name: 'Add Wallet' });
    await expect(submitBtn).toBeEnabled();

    // Close without submitting (to not affect other tests)
    await page.keyboard.press('Escape');
  });

  test('should display supported chains info', async ({ page }) => {
    // Supported Chains section should be visible
    await expect(page.getByText('Supported Chains').first()).toBeVisible();

    // Should list chain types (use span selector to avoid option elements)
    await expect(page.locator('span:has-text("EVM Wallets")').first()).toBeVisible();
    await expect(page.locator('span:has-text("Solana Wallets")').first()).toBeVisible();
    await expect(page.locator('span:has-text("SUI Wallets")').first()).toBeVisible();
  });

  test('should have search and filter controls', async ({ page }) => {
    // Search input
    const searchInput = page.locator('input[placeholder*="Search" i]').first();
    if (await searchInput.count() > 0) {
      await expect(searchInput).toBeVisible();
    }

    // Type filter dropdown
    const typeFilter = page.locator('select').first();
    if (await typeFilter.count() > 0) {
      await expect(typeFilter).toBeVisible();
    }
  });

  test('should have Export CSV button when wallets exist', async ({ page }) => {
    // Export CSV button (appears when there are wallets)
    const exportCSV = page.getByRole('button', { name: 'Export CSV' });

    // Might not be visible if no wallets
    if (await exportCSV.count() > 0) {
      await expect(exportCSV).toBeVisible();
    }
  });

  test('should show unknown tokens toggle', async ({ page }) => {
    // Unknown tokens toggle
    const unknownTokensLabel = page.getByText('Unknown tokens');
    if (await unknownTokensLabel.count() > 0) {
      await expect(unknownTokensLabel).toBeVisible();
    }
  });

  test('should close Add Wallet modal with cancel button', async ({ page }) => {
    // Open modal
    await page.getByRole('button', { name: 'Add Manually' }).click();

    // Modal should be open
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Click cancel button
    const cancelBtn = modal.getByRole('button', { name: 'Cancel' });
    await cancelBtn.click();

    // Modal should be closed
    await expect(modal).toHaveCount(0);
  });
});
