import { Page, expect, Locator } from '@playwright/test';

/**
 * View IDs matching the app's navigation store
 */
export type ViewId =
  | 'dashboard'
  | 'portfolio'
  | 'exchanges'
  | 'wallets'
  | 'defi'
  | 'nft'
  | 'rebalance'
  | 'history'
  | 'risk'
  | 'alerts'
  | 'tax'
  | 'settings';

/**
 * Setup page to skip onboarding - call this BEFORE page.goto()
 */
export async function setupPage(page: Page): Promise<void> {
  // Add init script to set localStorage before any page JS runs
  await page.addInitScript(() => {
    localStorage.setItem('arkfolio_onboarding_complete', 'true');
  });
}

/**
 * Wait for the app to be fully initialized - call this AFTER page.goto()
 */
export async function waitForAppReady(page: Page): Promise<void> {
  // Wait for any loading spinner to disappear (app initialization)
  const initSpinner = page.locator('.animate-spin').first();
  await initSpinner.waitFor({ state: 'hidden', timeout: 60000 }).catch(() => {
    // Spinner might not exist or already hidden
  });

  // Wait for "Initializing" text to disappear
  const initText = page.getByText('Initializing ArkFolio');
  await initText.waitFor({ state: 'hidden', timeout: 60000 }).catch(() => {
    // Text might already be hidden
  });

  // Ensure onboarding overlay is gone
  const onboardingOverlay = page.locator('div.fixed.inset-0.z-50');
  await onboardingOverlay.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {
    // Overlay might not exist
  });

  // Wait for main content area to be visible and interactive
  await page.locator('#main-content').waitFor({ state: 'visible', timeout: 30000 });
}

/**
 * Navigate to a specific view using sidebar navigation
 */
export async function navigateTo(page: Page, viewId: ViewId): Promise<void> {
  // Map view IDs to their labels
  const viewLabels: Record<ViewId, string> = {
    dashboard: 'Dashboard',
    portfolio: 'Portfolio',
    exchanges: 'Exchanges',
    wallets: 'Wallets',
    defi: 'DeFi',
    nft: 'NFTs',
    rebalance: 'Rebalance',
    history: 'History',
    risk: 'Risk',
    alerts: 'Alerts',
    tax: 'Tax Report',
    settings: 'Settings',
  };

  const label = viewLabels[viewId];

  // Find and click the navigation button in sidebar - Playwright auto-waits
  const navButton = page.locator(`nav button:has-text("${label}")`).first();
  await navButton.click();

  // Wait for the navigation to reflect active state
  await expect(navButton).toHaveAttribute('aria-current', 'page', { timeout: 5000 });
}

/**
 * Open a modal by clicking a button with the given text
 */
export async function openModal(page: Page, buttonText: string): Promise<Locator> {
  const button = page.locator(`button:has-text("${buttonText}")`).first();
  await button.click();

  // Wait for modal to appear
  const modal = page.locator('[role="dialog"]');
  await expect(modal).toBeVisible({ timeout: 5000 });

  return modal;
}

/**
 * Close the currently open modal
 */
export async function closeModal(page: Page): Promise<void> {
  // Try close button first
  const closeButton = page.locator('[role="dialog"] button[aria-label="Close modal"]');

  if (await closeButton.count() > 0) {
    await closeButton.click();
  } else {
    // Fallback: press Escape
    await page.keyboard.press('Escape');
  }

  // Verify modal is closed
  await expect(page.locator('[role="dialog"]')).toHaveCount(0, { timeout: 3000 });
}

/**
 * Expect a toast notification with the given message
 */
export async function expectToast(
  page: Page,
  messageContains: string
): Promise<void> {
  // Wait for toast container and message
  const toast = page.locator('[role="region"][aria-label="Notifications"]')
    .locator('[role="status"], [role="alert"]')
    .filter({ hasText: messageContains });

  await expect(toast).toBeVisible({ timeout: 5000 });
}

/**
 * Fill an input field by label
 */
export async function fillInput(
  page: Page,
  label: string,
  value: string
): Promise<void> {
  // Try label association first
  const labelElement = page.locator(`label:has-text("${label}")`);

  if (await labelElement.count() > 0) {
    const input = labelElement.locator('+ input, input').first();
    await input.fill(value);
    return;
  }

  // Fallback to placeholder
  const inputByPlaceholder = page.locator(`input[placeholder*="${label}" i]`).first();
  await inputByPlaceholder.fill(value);
}

/**
 * Select an option from a dropdown by label
 */
export async function selectOption(
  page: Page,
  label: string,
  optionValue: string
): Promise<void> {
  const labelElement = page.locator(`label:has-text("${label}")`);
  const select = labelElement.locator('+ select, ~ select').first();
  await select.selectOption(optionValue);
}

/**
 * Click a button with the given text
 */
export async function clickButton(page: Page, text: string): Promise<void> {
  await page.getByRole('button', { name: text }).first().click();
}

/**
 * Wait for page loading indicators to disappear
 */
export async function waitForLoading(page: Page): Promise<void> {
  // Wait for any loading spinners to disappear
  const loadingIndicators = page.locator('.animate-spin');
  const count = await loadingIndicators.count();

  if (count > 0) {
    // Wait for all spinners to be hidden
    for (let i = 0; i < count; i++) {
      await loadingIndicators.nth(i).waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {
        // Spinner may have already disappeared
      });
    }
  }
}

/**
 * Get the current active view from the navigation
 */
export async function getCurrentView(page: Page): Promise<string> {
  const activeNav = page.locator('nav button[aria-current="page"]');
  return (await activeNav.textContent()) || '';
}

/**
 * Check if the app is showing offline indicator
 */
export async function isOffline(page: Page): Promise<boolean> {
  const offlineIndicator = page.locator('text=Offline');
  return (await offlineIndicator.count()) > 0;
}

/**
 * Get button by role and name - more reliable than text selector
 */
export function getButton(page: Page, name: string): Locator {
  return page.getByRole('button', { name });
}

/**
 * Get element by text content
 */
export function getByText(page: Page, text: string): Locator {
  return page.getByText(text);
}

/**
 * Wait for element to be stable (no more attribute changes)
 */
export async function waitForStable(locator: Locator, timeout = 5000): Promise<void> {
  await locator.waitFor({ state: 'visible', timeout });
}
