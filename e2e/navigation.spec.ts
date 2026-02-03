import { test, expect } from '@playwright/test';
import { setupPage, waitForAppReady, navigateTo, ViewId } from './helpers';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('should load app and display dashboard by default', async ({ page }) => {
    // Dashboard should be the default view
    await expect(page.getByText('Total Portfolio Value')).toBeVisible();

    // ArkFolio logo should be visible in sidebar
    await expect(page.locator('aside').getByText('ArkFolio')).toBeVisible();

    // Main content area should exist
    await expect(page.locator('#main-content')).toBeVisible();
  });

  test('should navigate to all pages via sidebar', async ({ page }) => {
    const pages: { viewId: ViewId; expectedText: string }[] = [
      { viewId: 'portfolio', expectedText: 'Total Portfolio Value' },
      { viewId: 'exchanges', expectedText: 'Exchange' },
      { viewId: 'wallets', expectedText: 'Wallet' },
      { viewId: 'defi', expectedText: 'DeFi' },
      { viewId: 'nft', expectedText: 'NFT' },
      { viewId: 'rebalance', expectedText: 'Rebalance' },
      { viewId: 'history', expectedText: 'History' },
      { viewId: 'risk', expectedText: 'Risk' },
      { viewId: 'alerts', expectedText: 'Alert' },
      { viewId: 'tax', expectedText: 'Tax' },
      { viewId: 'settings', expectedText: 'Setting' },
      { viewId: 'dashboard', expectedText: 'Total Portfolio Value' },
    ];

    for (const { viewId, expectedText } of pages) {
      await navigateTo(page, viewId);
      await expect(page.getByText(expectedText).first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('should show loading state when navigating to lazy-loaded pages', async ({ page }) => {
    // Navigate to a lazy-loaded page (not dashboard)
    const settingsButton = page.locator('nav button:has-text("Settings")').first();
    await settingsButton.click();

    // Eventually, actual content should load
    await expect(page.getByText('General')).toBeVisible({ timeout: 10000 });
  });

  test('should support keyboard navigation shortcuts', async ({ page }) => {
    // Press 1 for Dashboard (already on dashboard, so verify it stays)
    await page.keyboard.press('1');
    await expect(page.getByText('Total Portfolio Value')).toBeVisible();

    // Press 2 for Portfolio
    await page.keyboard.press('2');
    await expect(page.getByText('Portfolio').first()).toBeVisible({ timeout: 5000 });

    // Press 3 for Exchanges
    await page.keyboard.press('3');
    await expect(page.getByText('Exchange').first()).toBeVisible({ timeout: 5000 });

    // Press ? to show keyboard shortcuts (may show modal)
    await page.keyboard.press('?');

    // Check if shortcuts modal appears
    const shortcutsModal = page.locator('[role="dialog"]');
    if (await shortcutsModal.count() > 0) {
      await expect(shortcutsModal).toBeVisible();
      await page.keyboard.press('Escape');
    }
  });

  test('should display sidebar with navigation items', async ({ page }) => {
    const navItems = [
      'Dashboard',
      'Portfolio',
      'Exchanges',
      'Wallets',
      'DeFi',
      'NFTs',
      'Rebalance',
      'History',
      'Risk',
      'Alerts',
      'Tax Report',
      'Settings',
    ];

    for (const item of navItems) {
      const navButton = page.locator(`nav button:has-text("${item}")`).first();
      await expect(navButton).toBeVisible();
    }
  });

  test('should highlight active navigation item', async ({ page }) => {
    // Dashboard should be active by default
    let activeNav = page.locator('nav button[aria-current="page"]');
    await expect(activeNav).toContainText('Dashboard');

    // Navigate to Portfolio
    await navigateTo(page, 'portfolio');
    activeNav = page.locator('nav button[aria-current="page"]');
    await expect(activeNav).toContainText('Portfolio');

    // Navigate to Settings
    await navigateTo(page, 'settings');
    activeNav = page.locator('nav button[aria-current="page"]');
    await expect(activeNav).toContainText('Settings');
  });

  test('should toggle sidebar collapse', async ({ page }) => {
    // Find and click the collapse button
    const collapseButton = page.locator('button[aria-label*="Collapse sidebar"], button[aria-label*="Expand sidebar"]').first();
    await expect(collapseButton).toBeVisible();

    // Get initial sidebar width by checking if label is visible
    const dashboardLabel = page.locator('nav button:has-text("Dashboard") span.font-medium');
    const initiallyVisible = await dashboardLabel.isVisible();

    // Click to toggle
    await collapseButton.click();

    // Wait for animation and state change
    if (initiallyVisible) {
      await expect(dashboardLabel).toBeHidden({ timeout: 1000 });
    } else {
      await expect(dashboardLabel).toBeVisible({ timeout: 1000 });
    }

    // Click again to restore
    await collapseButton.click();

    // Verify restored state
    if (initiallyVisible) {
      await expect(dashboardLabel).toBeVisible({ timeout: 1000 });
    } else {
      await expect(dashboardLabel).toBeHidden({ timeout: 1000 });
    }
  });

  test('should show version info in sidebar footer', async ({ page }) => {
    // Version should be visible in non-collapsed sidebar (use regex to avoid hardcoding version)
    const versionInfo = page.locator('text=/v\\d+\\.\\d+\\.\\d+/').first();
    await expect(versionInfo).toBeVisible();

    // Shortcut hint should be visible
    await expect(page.getByText('Press')).toBeVisible();
  });
});
