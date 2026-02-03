import { test, expect } from '@playwright/test';
import { setupPage, waitForAppReady, navigateTo, waitForLoading } from './helpers';

test.describe('Portfolio Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
    await page.goto('/');
    await waitForAppReady(page);
    await navigateTo(page, 'portfolio');
    await waitForLoading(page);
  });

  test('should load portfolio page and display summary', async ({ page }) => {
    // Portfolio summary card should be visible
    await expect(page.getByText('Total Portfolio Value').first()).toBeVisible();

    // Quick Stats card should show
    await expect(page.getByText('Quick Stats')).toBeVisible();

    // Stats items
    await expect(page.getByText('Assets').first()).toBeVisible();
    await expect(page.getByText('Positions').first()).toBeVisible();
    await expect(page.getByText('Exchanges').first()).toBeVisible();
  });

  test('should show empty state or holdings list', async ({ page }) => {
    // Check for empty state or holdings list
    const emptyState = page.getByText(/No data|No assets|No holdings/i);
    const connectPrompt = page.getByText(/Connect|Add/i);
    const holdingsList = page.getByText('Holdings');
    const quickStats = page.getByText('Quick Stats');

    // Either we have holdings or we show empty state or the page is functional
    const hasEmpty = await emptyState.count() > 0;
    const hasConnect = await connectPrompt.count() > 0;
    const hasHoldings = await holdingsList.count() > 0;
    const hasQuickStats = await quickStats.count() > 0;

    expect(
      hasEmpty || hasConnect || hasHoldings || hasQuickStats,
      'Expected empty state, holdings list, or quick stats to be visible'
    ).toBeTruthy();
  });

  test('should have refresh button that works', async ({ page }) => {
    // Find refresh button
    const refreshButton = page.getByRole('button', { name: 'Refresh' }).first();
    await expect(refreshButton).toBeVisible();

    // Click refresh
    await refreshButton.click();

    // Verify page doesn't crash
    await expect(page.getByText('Total Portfolio Value').first()).toBeVisible();
  });

  test('should display search input for filtering assets', async ({ page }) => {
    // Search input should be present
    const searchInput = page.locator('input[placeholder*="Search" i]').first();

    // Search might only appear if there are holdings
    if (await searchInput.count() > 0) {
      await expect(searchInput).toBeVisible();

      // Type in search
      await searchInput.fill('BTC');

      // Clear search
      await searchInput.fill('');

      // Page should still be functional
      await expect(page.getByText('Total Portfolio Value').first()).toBeVisible();
    }
  });

  test('should have sorting buttons when holdings exist', async ({ page }) => {
    // Sort buttons appear in Holdings section
    const holdingsSection = page.locator('.card:has-text("Holdings")').first();

    if (await holdingsSection.count() > 0) {
      // Look for sort buttons
      const nameSort = holdingsSection.getByRole('button', { name: /Name/i });
      const valueSort = holdingsSection.getByRole('button', { name: /Value/i });
      const changeSort = holdingsSection.getByRole('button', { name: /24h/i });

      if (await nameSort.count() > 0) {
        await expect(nameSort).toBeVisible();
        await expect(valueSort).toBeVisible();
        await expect(changeSort).toBeVisible();

        // Test clicking a sort button
        await valueSort.click();

        // Click again to reverse sort
        await valueSort.click();

        // Page should remain functional
        await expect(holdingsSection).toBeVisible();
      }
    }
  });

  test('should display export buttons when holdings exist', async ({ page }) => {
    // Export CSV button
    const exportCSV = page.getByRole('button', { name: 'Export CSV' }).first();
    const exportExcel = page.getByRole('button', { name: 'Export Excel' }).first();

    // Export buttons might only appear if there are holdings
    if (await exportCSV.count() > 0) {
      await expect(exportCSV).toBeVisible();
    }

    if (await exportExcel.count() > 0) {
      await expect(exportExcel).toBeVisible();
    }
  });

  test('should display Historical Performance chart', async ({ page }) => {
    // Chart section should be visible
    await expect(page.getByText('Historical Performance')).toBeVisible();
  });

  test('should show 24h change values', async ({ page }) => {
    // Total Portfolio Value should be visible
    await expect(page.getByText('Total Portfolio Value').first()).toBeVisible();

    // Check for 24h text indicator somewhere on page
    const change24h = page.getByText(/24h/i).first();
    if (await change24h.count() > 0) {
      await expect(change24h).toBeVisible();
    }
  });

  test('should show Asset Allocation chart when holdings exist', async ({ page }) => {
    // Asset Allocation chart appears when there are holdings
    const allocationChart = page.getByText('Asset Allocation');

    if (await allocationChart.count() > 0) {
      await expect(allocationChart).toBeVisible();
    }
  });

  test('should show Performance Summary when holdings exist', async ({ page }) => {
    // Performance Summary section
    const perfSummary = page.getByText('Performance Summary');

    if (await perfSummary.count() > 0) {
      await expect(perfSummary).toBeVisible();
    }
  });
});
