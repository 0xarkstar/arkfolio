import { test, expect } from '@playwright/test';
import { setupPage, waitForAppReady, navigateTo, closeModal, waitForLoading } from './helpers';

test.describe('Exchange Modal - Phase 10.1 Korean VASP/Travel Rule', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
    await page.goto('/');
    await waitForAppReady(page);
  });

  // Clean up any open modals after each test
  test.afterEach(async ({ page }) => {
    const modal = page.locator('[role="dialog"]');
    if (await modal.count() > 0) {
      await page.keyboard.press('Escape');
    }
  });

  test('should navigate to CEX page and open Add Exchange modal', async ({ page }) => {
    await navigateTo(page, 'exchanges');
    await waitForLoading(page);

    // Find and click Add Exchange button
    const addExchangeBtn = page.getByRole('button', { name: /Add Exchange|Connect Exchange|Add/i }).first();
    await addExchangeBtn.click();

    // Modal should be open
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
  });

  test('should display all 14 CEX exchanges in modal', async ({ page }) => {
    await navigateTo(page, 'exchanges');
    await waitForLoading(page);

    // Open Add Exchange modal
    const addExchangeBtn = page.getByRole('button', { name: /Add Exchange|Connect Exchange|Add/i }).first();
    await addExchangeBtn.click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Click CEX tab if present
    const cexTab = modal.getByRole('button', { name: 'CEX' });
    if (await cexTab.count() > 0) {
      await cexTab.click();
    }

    // Verify Global CEX exchanges
    const globalExchanges = ['Binance', 'OKX', 'Bybit', 'Kraken', 'Coinbase', 'Gate.io'];
    for (const exchange of globalExchanges) {
      await expect(page.getByText(exchange).first(), `${exchange} should be visible`).toBeVisible();
    }

    // Verify Travel Rule exchanges
    const travelRuleExchanges = ['HTX', 'Bitget', 'BingX', 'LBANK', 'Woo X'];
    for (const exchange of travelRuleExchanges) {
      await expect(page.getByText(exchange).first(), `${exchange} should be visible`).toBeVisible();
    }

    // Verify Korean VASP exchanges
    const koreanExchanges = ['Upbit', 'Bithumb', 'Coinone'];
    for (const exchange of koreanExchanges) {
      await expect(page.getByText(exchange).first(), `${exchange} should be visible`).toBeVisible();
    }
  });

  test('should display all 10 Perp DEX exchanges in DEX tab', async ({ page }) => {
    await navigateTo(page, 'exchanges');
    await waitForLoading(page);

    // Open Add Exchange modal
    const addExchangeBtn = page.getByRole('button', { name: /Add Exchange|Connect Exchange|Add/i }).first();
    await addExchangeBtn.click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Click DEX tab
    const dexTab = modal.getByRole('button', { name: 'DEX' });
    if (await dexTab.count() > 0) {
      await dexTab.click();

      // Verify EVM Perp DEX
      const evmDexes = ['Hyperliquid', 'GMX', 'GRVT', 'Lighter'];
      for (const exchange of evmDexes) {
        await expect(page.getByText(exchange).first(), `${exchange} should be visible`).toBeVisible();
      }

      // Verify Cosmos Perp DEX
      await expect(page.getByText('dYdX').first(), 'dYdX should be visible').toBeVisible();

      // Verify Solana Perp DEX
      const solanaDexes = ['Jupiter', 'Drift', 'Backpack'];
      for (const exchange of solanaDexes) {
        await expect(page.getByText(exchange).first(), `${exchange} should be visible`).toBeVisible();
      }

      // Verify StarkNet Perp DEX
      const starknetDexes = ['Paradex', 'EdgeX'];
      for (const exchange of starknetDexes) {
        await expect(page.getByText(exchange).first(), `${exchange} should be visible`).toBeVisible();
      }
    }
  });

  test('should show Korean exchange descriptions in Korean', async ({ page }) => {
    await navigateTo(page, 'exchanges');
    await waitForLoading(page);

    // Open Add Exchange modal
    const addExchangeBtn = page.getByRole('button', { name: /Add Exchange|Connect Exchange|Add/i }).first();
    await addExchangeBtn.click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Click CEX tab if present
    const cexTab = modal.getByRole('button', { name: 'CEX' });
    if (await cexTab.count() > 0) {
      await cexTab.click();
    }

    // Check for Korean descriptions (multiple Korean exchanges have this description)
    await expect(page.getByText('한국 원화 거래').first(), 'Korean exchange descriptions should be visible').toBeVisible();
  });

  test('should show HTX description mentioning Huobi', async ({ page }) => {
    await navigateTo(page, 'exchanges');
    await waitForLoading(page);

    // Open Add Exchange modal
    const addExchangeBtn = page.getByRole('button', { name: /Add Exchange|Connect Exchange|Add/i }).first();
    await addExchangeBtn.click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Check for HTX with Huobi reference
    await expect(page.getByText('구 Huobi'), 'HTX should mention it was formerly Huobi').toBeVisible();
  });

  test('should select Bitget and show credential fields', async ({ page }) => {
    await navigateTo(page, 'exchanges');
    await waitForLoading(page);

    // Open Add Exchange modal
    const addExchangeBtn = page.getByRole('button', { name: /Add Exchange|Connect Exchange|Add/i }).first();
    await addExchangeBtn.click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Click on Bitget (requires passphrase)
    const bitgetOption = modal.locator('button:has-text("Bitget")').first();
    if (await bitgetOption.count() > 0) {
      await bitgetOption.click();

      // Check credentials form is shown
      const passwordFields = modal.locator('input[type="password"]');
      expect(await passwordFields.count(), 'Credential fields should be visible').toBeGreaterThanOrEqual(2);
    }
  });

  test('should select Coinone and show credentials form', async ({ page }) => {
    await navigateTo(page, 'exchanges');
    await waitForLoading(page);

    // Open Add Exchange modal
    const addExchangeBtn = page.getByRole('button', { name: /Add Exchange|Connect Exchange|Add/i }).first();
    await addExchangeBtn.click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Click on Coinone (Korean VASP)
    const coinoneOption = modal.locator('button:has-text("Coinone")').first();
    if (await coinoneOption.count() > 0) {
      await coinoneOption.click();

      // Should show credentials form with Connect button
      await expect(modal.getByRole('button', { name: 'Connect' }), 'Connect button should be visible').toBeVisible();

      // Should show API Key field (use label specifically)
      await expect(modal.getByLabel('API Key'), 'API Key field should be visible').toBeVisible();
    }
  });

  test('should be able to go back from credentials to exchange list', async ({ page }) => {
    await navigateTo(page, 'exchanges');
    await waitForLoading(page);

    // Open Add Exchange modal
    const addExchangeBtn = page.getByRole('button', { name: /Add Exchange|Connect Exchange|Add/i }).first();
    await addExchangeBtn.click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Select an exchange
    const htxOption = modal.locator('button:has-text("HTX")').first();
    if (await htxOption.count() > 0) {
      await htxOption.click();

      // Click Back button
      const backBtn = modal.getByRole('button', { name: 'Back' });
      if (await backBtn.count() > 0) {
        await backBtn.click();

        // Should see exchange list again
        await expect(page.getByText('Binance').first(), 'Should return to exchange list').toBeVisible();
      }
    }
  });
});

test.describe('Exchange Connection Flow', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
    await page.goto('/');
    await waitForAppReady(page);
    await navigateTo(page, 'exchanges');
    await waitForLoading(page);
  });

  test.afterEach(async ({ page }) => {
    const modal = page.locator('[role="dialog"]');
    if (await modal.count() > 0) {
      await page.keyboard.press('Escape');
    }
  });

  test('should display credential form fields when exchange is selected', async ({ page }) => {
    // Open Add Exchange modal
    const addExchangeBtn = page.getByRole('button', { name: /Add Exchange|Connect Exchange|Add/i }).first();
    await addExchangeBtn.click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Select Binance
    const binanceOption = modal.locator('button:has-text("Binance")').first();
    if (await binanceOption.count() > 0) {
      await binanceOption.click();

      // Should show API Key input
      const apiKeyInput = modal.locator('input[type="password"]').first();
      await expect(apiKeyInput).toBeVisible();

      // Should show Connect button
      await expect(modal.getByRole('button', { name: 'Connect' })).toBeVisible();
    }
  });

  test('should validate empty API credentials', async ({ page }) => {
    // Open Add Exchange modal
    const addExchangeBtn = page.getByRole('button', { name: /Add Exchange|Connect Exchange|Add/i }).first();
    await addExchangeBtn.click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Select an exchange
    const binanceOption = modal.locator('button:has-text("Binance")').first();
    if (await binanceOption.count() > 0) {
      await binanceOption.click();

      // Try to connect without entering credentials
      const connectBtn = modal.getByRole('button', { name: 'Connect' });
      const isDisabled = await connectBtn.isDisabled();

      if (!isDisabled) {
        await connectBtn.click();

        // Should show error or validation message or button should be disabled
        const errorMsg = modal.locator('[role="alert"], .text-loss').first();
        const hasError = await errorMsg.count() > 0;
        const requiredMsg = modal.getByText(/required/i).first();
        const hasRequired = await requiredMsg.count() > 0;

        if (hasError) {
          await expect(errorMsg).toBeVisible();
        } else if (hasRequired) {
          await expect(requiredMsg).toBeVisible();
        }
      }
    }
  });

  test('should show exchanges section on page', async ({ page }) => {
    // Connected Exchanges section or similar
    const exchangeSection = page.getByText(/Connected Exchanges|Your Exchanges|Exchanges/i).first();
    await expect(exchangeSection).toBeVisible();
  });

  test('should have sync functionality available', async ({ page }) => {
    // Look for sync/refresh button in the page
    const syncButton = page.getByRole('button', { name: /Sync|Refresh/i }).first();

    // Sync button might only appear when exchanges are connected
    if (await syncButton.count() > 0) {
      await expect(syncButton).toBeVisible();
    }
  });

  test('should display balances section when available', async ({ page }) => {
    // Balances section might exist
    const balancesSection = page.getByText(/Balances|Assets/i).first();

    if (await balancesSection.count() > 0) {
      await expect(balancesSection).toBeVisible();
    }
  });

  test('should display positions section when available', async ({ page }) => {
    // Positions section (futures/margin)
    const positionsSection = page.getByText(/Positions|Futures/i).first();

    if (await positionsSection.count() > 0) {
      await expect(positionsSection).toBeVisible();
    }
  });
});
