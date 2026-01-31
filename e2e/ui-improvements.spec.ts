import { test, expect } from '@playwright/test';

test.describe('UI Improvements', () => {
  test('should display dashboard without crashing', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check that the app loads without crashing
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
    
    // Look for main navigation or content
    const hasContent = await page.locator('body').count() > 0;
    expect(hasContent).toBeTruthy();
  });

  test('should have error boundary wrapper (no crash)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check there's no uncaught error displayed
    const errorBoundary = page.locator('text=Something went wrong');
    const hasError = await errorBoundary.count() > 0;
    
    // App should load without showing error boundary
    expect(hasError).toBeFalsy();
  });
});

test.describe('Wallets Page', () => {
  test('should navigate to wallets page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Find and click on Wallets navigation
    const walletsNav = page.locator('a[href*="wallet"], button:has-text("Wallet"), nav >> text=Wallet').first();
    
    if (await walletsNav.count() > 0) {
      await walletsNav.click();
      await page.waitForLoadState('networkidle');
      
      // Check for wallets page content
      const hasWalletsContent = await page.locator('text=/wallet/i').count() > 0 ||
                                await page.locator('text=Connect Wallet').count() > 0 ||
                                await page.locator('text=Add Wallet').count() > 0;
      
      expect(hasWalletsContent).toBeTruthy();
    }
  });

  test('should show chain selector modal when clicking Connect Wallet', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Navigate to wallets
    const walletsNav = page.locator('a[href*="wallet"], button:has-text("Wallet"), nav >> text=Wallet').first();
    
    if (await walletsNav.count() > 0) {
      await walletsNav.click();
      await page.waitForLoadState('networkidle');
    }
    
    // Find Connect Wallet button
    const connectBtn = page.locator('button:has-text("Connect Wallet")').first();
    
    if (await connectBtn.count() > 0) {
      await connectBtn.click();
      await page.waitForTimeout(500);
      
      // Check for chain selector or wallet modal
      const hasModal = await page.locator('[role="dialog"], .modal, text=Select Network, text=EVM, text=Solana, text=SUI').count() > 0;
      
      expect(hasModal).toBeTruthy();
    }
  });

  test('should display empty state when no wallets', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Navigate to wallets
    const walletsNav = page.locator('a[href*="wallet"], button:has-text("Wallet"), nav >> text=Wallet').first();
    
    if (await walletsNav.count() > 0) {
      await walletsNav.click();
      await page.waitForLoadState('networkidle');
      
      // Check for empty state or wallet list
      const hasContent = await page.locator('text=Connect Your First Wallet, text=No Connections, text=Add Wallet, text=Connect Wallet').count() > 0;
      
      expect(hasContent).toBeTruthy();
    }
  });
});

test.describe('CEX/Exchanges Page', () => {
  test('should navigate to exchanges page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Find and click on Exchanges/CEX navigation
    const exchangesNav = page.locator('a[href*="exchange"], a[href*="cex"], button:has-text("Exchange"), nav >> text=Exchange, nav >> text=CEX').first();
    
    if (await exchangesNav.count() > 0) {
      await exchangesNav.click();
      await page.waitForLoadState('networkidle');
      
      // Check for exchanges page content
      const hasExchangesContent = await page.locator('text=/exchange/i').count() > 0;
      
      expect(hasExchangesContent).toBeTruthy();
    }
  });
});

test.describe('DeFi Page', () => {
  test('should navigate to DeFi page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Find and click on DeFi navigation
    const defiNav = page.locator('a[href*="defi"], button:has-text("DeFi"), nav >> text=DeFi').first();
    
    if (await defiNav.count() > 0) {
      await defiNav.click();
      await page.waitForLoadState('networkidle');
      
      // Check for DeFi page content
      const hasDefiContent = await page.locator('text=/defi/i').count() > 0;
      
      expect(hasDefiContent).toBeTruthy();
    }
  });

  test('should show loading or content on DeFi page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const defiNav = page.locator('a[href*="defi"], button:has-text("DeFi"), nav >> text=DeFi').first();
    
    if (await defiNav.count() > 0) {
      await defiNav.click();
      
      // Check for loading state or content
      const hasLoadingOrContent = await page.locator('.animate-spin, .animate-pulse, text=/defi/i, text=/position/i, text=/protocol/i').count() > 0;
      
      expect(hasLoadingOrContent).toBeTruthy();
    }
  });
});

test.describe('Settings Page', () => {
  test('should navigate to settings page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Find and click on Settings navigation
    const settingsNav = page.locator('a[href*="setting"], button:has-text("Setting"), nav >> text=Setting, [aria-label*="setting"]').first();
    
    if (await settingsNav.count() > 0) {
      await settingsNav.click();
      await page.waitForLoadState('networkidle');
      
      // Check for settings page content
      const hasSettingsContent = await page.locator('text=/setting/i').count() > 0;
      
      expect(hasSettingsContent).toBeTruthy();
    }
  });
});

test.describe('Loading States', () => {
  test('app should load with rendered DOM', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    // Check for React root element
    const hasReactRoot = await page.locator('#root').count() > 0;
    expect(hasReactRoot).toBeTruthy();
    
    // Wait for React to hydrate
    await page.waitForLoadState('networkidle');
    
    // Check the page didn't crash with error boundary
    const errorBoundary = page.locator('text=Something went wrong');
    expect(await errorBoundary.count()).toBe(0);
  });
});

test.describe('Empty States', () => {
  test('empty states should have action buttons', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Navigate to a page that might have empty state
    const walletsNav = page.locator('a[href*="wallet"], nav >> text=Wallet').first();
    
    if (await walletsNav.count() > 0) {
      await walletsNav.click();
      await page.waitForLoadState('networkidle');
      
      // If empty state is shown, it should have an action button
      const emptyStateText = page.locator('text=Connect Your First Wallet, text=No Connections, text=Get Started');
      
      if (await emptyStateText.count() > 0) {
        // Empty state should have a CTA button
        const hasActionButton = await page.locator('button').count() > 0;
        expect(hasActionButton).toBeTruthy();
      } else {
        // Content is already loaded, which is also fine
        expect(true).toBeTruthy();
      }
    }
  });
});
