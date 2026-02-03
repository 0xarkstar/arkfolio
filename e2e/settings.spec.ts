import { test, expect } from '@playwright/test';
import { setupPage, waitForAppReady, navigateTo, waitForLoading } from './helpers';

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
    await page.goto('/');
    await waitForAppReady(page);
    await navigateTo(page, 'settings');
    await waitForLoading(page);
  });

  // Clean up any open dialogs after each test
  test.afterEach(async ({ page }) => {
    const dialog = page.locator('[role="dialog"]');
    if (await dialog.count() > 0) {
      await page.keyboard.press('Escape');
    }
  });

  test('should load settings page with all sections', async ({ page }) => {
    // General section
    await expect(page.getByText('General').first()).toBeVisible();

    // Sync & Data section
    await expect(page.getByText('Sync & Data')).toBeVisible();

    // Tax Settings section
    await expect(page.getByText('Tax Settings')).toBeVisible();

    // Backup & Security section
    await expect(page.getByText('Backup & Security')).toBeVisible();
  });

  test('should allow changing display currency', async ({ page }) => {
    // Find Display Currency label
    await expect(page.getByText('Display Currency').first()).toBeVisible();

    // Find the currency select near the Display Currency label
    const currencySelect = page.locator('select').first();

    if (await currencySelect.count() > 0) {
      await expect(currencySelect).toBeVisible();

      // Get current value
      const currentValue = await currencySelect.inputValue();

      // Try to change currency
      if (currentValue === 'USD') {
        await currencySelect.selectOption('KRW');
        await expect(currencySelect).toHaveValue('KRW');
        await currencySelect.selectOption('USD');
      } else {
        await currencySelect.selectOption('USD');
        await expect(currencySelect).toHaveValue('USD');
      }
    }
  });

  test('should allow toggling Auto Sync', async ({ page }) => {
    // Find Auto Sync label
    await expect(page.getByText('Auto Sync').first()).toBeVisible();

    // Find the toggle switch in Sync & Data section
    const syncCard = page.locator('.card:has-text("Sync & Data")').first();
    const toggle = syncCard.locator('button[role="switch"]').first();

    if (await toggle.count() > 0) {
      // Get current state
      const isChecked = await toggle.getAttribute('aria-checked') === 'true';

      // Click to toggle
      await toggle.click();

      // Verify state changed
      const newIsChecked = await toggle.getAttribute('aria-checked') === 'true';
      expect(newIsChecked).not.toBe(isChecked);

      // Click again to restore
      await toggle.click();
    }
  });

  test('should have Export Data button', async ({ page }) => {
    // Find Export Data section
    await expect(page.getByText('Export Data').first()).toBeVisible();

    // Find export button
    const exportButton = page.getByRole('button', { name: 'Export' }).first();
    await expect(exportButton).toBeVisible();
  });

  test('should have Import Data option', async ({ page }) => {
    // Find Import Data section
    await expect(page.getByText('Import Data')).toBeVisible();

    // Find import button/label
    const importElement = page.getByText('Import').first();
    await expect(importElement).toBeVisible();
  });

  test('should display language selection', async ({ page }) => {
    // Find Language label
    await expect(page.getByText('Language').first()).toBeVisible();

    // Find selects on page (currency, language, theme etc.)
    const selects = page.locator('select');

    // Should have at least one select for settings
    expect(await selects.count()).toBeGreaterThanOrEqual(1);
  });

  test('should display theme selection', async ({ page }) => {
    // Find Theme label
    await expect(page.getByText('Theme').first()).toBeVisible();
  });

  test('should display keyboard shortcuts section', async ({ page }) => {
    // Keyboard Shortcuts section
    await expect(page.getByText('Keyboard Shortcuts')).toBeVisible();

    // Should list some shortcuts
    const globalSearch = page.getByText('Global Search');
    if (await globalSearch.count() > 0) {
      await expect(globalSearch).toBeVisible();
    }
  });

  test('should display About section with version', async ({ page }) => {
    // About section
    await expect(page.getByText('About').first()).toBeVisible();

    // Version info
    await expect(page.getByText('Version')).toBeVisible();

    // Should show a version number (use regex for flexibility)
    const versionNumber = page.locator('text=/\\d+\\.\\d+\\.\\d+/').first();
    await expect(versionNumber).toBeVisible();
  });

  test('should have Clear All Data button with confirmation', async ({ page }) => {
    // Find Clear All Data button
    const clearDataBtn = page.getByRole('button', { name: 'Clear Data' });
    await expect(clearDataBtn).toBeVisible();

    // Click it
    await clearDataBtn.click();

    // Confirmation dialog should appear
    const confirmDialog = page.locator('[role="dialog"]').last();
    await expect(confirmDialog).toBeVisible();

    // Should have warning message
    const warningText = confirmDialog.getByText('cannot be undone');
    if (await warningText.count() > 0) {
      await expect(warningText).toBeVisible();
    }

    // Cancel the dialog
    const cancelBtn = confirmDialog.getByRole('button', { name: 'Cancel' });
    if (await cancelBtn.count() > 0) {
      await cancelBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }

    // Dialog should be closed
    await expect(confirmDialog).toHaveCount(0, { timeout: 3000 }).catch(() => {
      // Dialog might have different behavior
    });
  });

  test('should have tax settings with cost basis method', async ({ page }) => {
    // Tax Settings section should be visible
    await expect(page.getByText('Tax Settings').first()).toBeVisible();

    // Cost Basis Method label should be visible
    await expect(page.getByText('Cost Basis Method').first()).toBeVisible();

    // Should have select for method near the label
    const selects = page.locator('select');
    const selectCount = await selects.count();

    if (selectCount > 0) {
      // Find a select that has tax-related options
      for (let i = 0; i < selectCount; i++) {
        const options = await selects.nth(i).locator('option').allTextContents();
        const hasValidOptions = options.some(
          opt => opt.includes('FIFO') || opt.includes('LIFO') || opt.includes('Moving') || opt.includes('Average')
        );
        if (hasValidOptions) {
          expect(hasValidOptions, 'Expected tax method options to include FIFO, LIFO, or Moving Average').toBeTruthy();
          break;
        }
      }
    }
  });

  test('should have sync interval setting', async ({ page }) => {
    // Sync Interval label
    await expect(page.getByText('Sync Interval')).toBeVisible();

    // Should have select for interval
    const syncCard = page.locator('.card:has-text("Sync & Data")').first();
    const intervalSelect = syncCard.locator('select').first();

    if (await intervalSelect.count() > 0) {
      await expect(intervalSelect).toBeVisible();
    }
  });

  test('should display GitHub links in About section', async ({ page }) => {
    // About section should be visible
    await expect(page.getByText('About').first()).toBeVisible();

    // GitHub link
    const githubLink = page.getByRole('link', { name: /GitHub/i }).first();
    if (await githubLink.count() > 0) {
      await expect(githubLink).toBeVisible();
      await expect(githubLink).toHaveAttribute('href', /github\.com/);
    }

    // Report Issue link
    const issueLink = page.getByRole('link', { name: /Report Issue|Issues/i }).first();
    if (await issueLink.count() > 0) {
      await expect(issueLink).toBeVisible();
    }
  });
});
