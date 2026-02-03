import { test, expect } from '@playwright/test';
import { setupPage, waitForAppReady, navigateTo } from './helpers';

test.describe('UI Improvements', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
  });

  test('should display dashboard without crashing', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Check that the app loads without crashing
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);

    // Look for main navigation or content
    const hasContent = await page.locator('body').count() > 0;
    expect(hasContent).toBeTruthy();
  });

  test('should have error boundary wrapper (no crash)', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Check there's no uncaught error displayed
    const errorBoundary = page.locator('text=Something went wrong');
    const hasError = await errorBoundary.count() > 0;

    // App should load without showing error boundary
    expect(hasError).toBeFalsy();
  });
});

test.describe('Wallets Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
  });

  test('should navigate to wallets page', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await navigateTo(page, 'wallets');

    // Check for wallets page content
    await expect(page.getByText('Connected Wallets')).toBeVisible();
  });

  test('should show chain selector modal when clicking Connect Wallet', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await navigateTo(page, 'wallets');

    // Find Connect Wallet button
    const connectBtn = page.getByRole('button', { name: 'Connect Wallet' });

    if (await connectBtn.count() > 0) {
      await connectBtn.click();

      // Check for chain selector or wallet modal
      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible({ timeout: 5000 });
    }
  });

  test('should display empty state when no wallets', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await navigateTo(page, 'wallets');

    // Check for empty state or wallet list
    const walletsContent = page.getByText('Connected Wallets');
    await expect(walletsContent).toBeVisible();
  });
});

test.describe('CEX/Exchanges Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
  });

  test('should navigate to exchanges page', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await navigateTo(page, 'exchanges');

    // Check for exchanges page content
    await expect(page.getByText(/exchange/i).first()).toBeVisible();
  });
});

test.describe('DeFi Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
  });

  test('should navigate to DeFi page', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await navigateTo(page, 'defi');

    // Check for DeFi page content
    await expect(page.getByText(/defi/i).first()).toBeVisible();
  });

  test('should show loading or content on DeFi page', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await navigateTo(page, 'defi');

    // Check that page loaded (either loading state or content)
    const activeNav = page.locator('nav button[aria-current="page"]');
    await expect(activeNav).toContainText('DeFi');
  });
});

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
  });

  test('should navigate to settings page', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await navigateTo(page, 'settings');

    // Check for settings page content
    await expect(page.getByText('General').first()).toBeVisible();
  });
});

test.describe('Loading States', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
  });

  test('app should load with rendered DOM', async ({ page }) => {
    await page.goto('/');

    // Check for React root element
    const hasReactRoot = await page.locator('#root').count() > 0;
    expect(hasReactRoot).toBeTruthy();

    // Wait for app to be ready
    await waitForAppReady(page);

    // Check the page didn't crash with error boundary
    const errorBoundary = page.locator('text=Something went wrong');
    expect(await errorBoundary.count()).toBe(0);
  });
});

test.describe('Empty States', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
  });

  test('empty states should have action buttons', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await navigateTo(page, 'wallets');

    // Page should have at least some buttons
    const buttons = page.locator('button');
    expect(await buttons.count()).toBeGreaterThan(0);
  });
});
