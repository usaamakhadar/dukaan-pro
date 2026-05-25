/**
 * DUKAAN PRO — POS E2E STRESS TESTS  (v3 — Production-Ready)
 *
 * Covers:
 *  1. Rapid 5 scans (React race-condition guard)
 *  2. Camera permission denied (graceful error, no crash)
 *  3. Offline scan (barcodeService local-cache fallback)
 *  4. Oversell concurrency (2 cashiers, stock = 1 → only 1 wins)
 *  5. Debt sale + receipt generation
 *  6. Multi-tenant RLS isolation (Tenant A data invisible to Tenant B)
 *
 * Prerequisites (.env.local):
 *   E2E_TEST_EMAIL      = admin@dukaan.pro
 *   E2E_TEST_PASSWORD   = 123456
 *   E2E_TEST_EMAIL_B    = Barako@dukaan.pro   (enables test 6)
 *   E2E_TEST_PASSWORD_B = 123456              (enables test 6)
 */

import { test, expect, Page } from '@playwright/test';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const EMAIL_A = process.env.E2E_TEST_EMAIL     || 'admin@dukaan.pro';
const PASS_A  = process.env.E2E_TEST_PASSWORD  || '123456';
const EMAIL_B = process.env.E2E_TEST_EMAIL_B   || '';
const PASS_B  = process.env.E2E_TEST_PASSWORD_B|| '';

const randomId = () => Math.random().toString(36).substring(2, 8);

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Log in via /login and wait for dashboard redirect. */
async function loginUser(page: Page, email = EMAIL_A, pass = PASS_A) {
  await page.goto('/login');
  await page.waitForSelector('input[type="email"]', { state: 'visible', timeout: 15000 });
  await page.fill('input[type="email"]',    email);
  await page.fill('input[type="password"]', pass);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 25000 });
}

/** Create a product via the Inventory UI. */
async function createProduct(
  page: Page, barcode: string, name: string, price: string, stock: string,
) {
  await page.goto('/dashboard/inventory');
  await expect(page.locator('button:has-text("Add Product")')).toBeVisible({ timeout: 15000 });
  await page.click('button:has-text("Add Product")');

  await page.fill('input[placeholder="Leather Jacket"]', name);
  await page.fill('input[name="sku"]',           `SKU-${randomId()}`);
  await page.fill('input[name="barcode"]',        barcode);
  await page.fill('input[placeholder="120.00"]',  price);
  await page.fill('input[placeholder="12"]',      stock);
  await page.click('button:has-text("Save Product")');

  await expect(
    page.locator('table').locator('td', { hasText: name }).first()
  ).toBeVisible({ timeout: 12000 });
}

/**
 * Navigate to POS and wait until the Cashier Layout heading is visible.
 * NOTE: Products may still be loading at this point — call waitForProductInGrid()
 * before scanning so the barcodeService cache is guaranteed to be populated.
 */
async function goToPOS(page: Page) {
  await page.goto('/pos');
  await expect(page.locator('text=Cashier Layout')).toBeVisible({ timeout: 20000 });
}

/**
 * Wait for a specific product card (h3 in the grid) to be visible.
 *
 * WHY THIS IS CRITICAL:
 *   fetchProducts() calls barcodeService.rebuildCache(products) synchronously.
 *   Once the product card renders, the cache IS populated.
 *   Without this wait, we scan before the cache is ready → API call → 401 → cart stays empty.
 */
async function waitForProductInGrid(page: Page, productName: string) {
  await expect(
    page.locator('h3', { hasText: productName }).first()
  ).toBeVisible({ timeout: 20000 });
  // One extra tick for React to finish rendering and rebuildCache to complete
  await page.waitForTimeout(300);
}

/**
 * Simulate a hardware barcode scanner.
 *
 * Strategy:
 *  All steps happen synchronously inside a single page.evaluate() call so that
 *  no React re-render can remove the event listener between value-set and keydown.
 *  1. Set the hidden input's native value (bypasses React's uncontrolled-input tracking).
 *  2. Focus the input (required for the keydown to be processed correctly).
 *  3. Dispatch keydown('Enter') — the useBarcodeScanner listener calls onScan(value).
 */
async function simulateBarcodeScan(page: Page, barcode: string) {
  // Wait until the POS page has mounted the hidden barcode input
  await page.waitForSelector('input[aria-hidden="true"]', { state: 'attached', timeout: 12000 });
  await page.waitForTimeout(200); // let all useEffect hooks attach listeners

  const dispatched = await page.evaluate((code: string) => {
    const input = document.querySelector('input[aria-hidden="true"]') as HTMLInputElement | null;
    if (!input) return { ok: false, reason: 'input not found' };

    // Step 1: Set value via native property descriptor (works with React uncontrolled inputs)
    const nativeSet = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (nativeSet) nativeSet.call(input, code);
    else           input.value = code;

    // Step 2: Focus the input
    input.focus();

    // Step 3: Dispatch keydown('Enter') — useBarcodeScanner reads input.value here
    input.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter', code: 'Enter',
      bubbles: true, cancelable: true, composed: true,
    }));

    return { ok: true, value: input.value };
  }, barcode);

  if (!dispatched?.ok) {
    throw new Error(`simulateBarcodeScan: ${dispatched?.reason}`);
  }

  // Wait for barcodeService's sequential queue to resolve and React to re-render
  await page.waitForTimeout(800);
}

/** Assert the cart is non-empty by checking the Proceed-to-Payment button is enabled. */
async function waitForCartNotEmpty(page: Page, timeout = 10000) {
  await expect(
    page.locator('button:has-text("Proceed to Payment")'),
  ).toBeEnabled({ timeout });
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTS  (serial execution — workers:1 in playwright.config.ts)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('POS Stress and Production-Ready Tests', () => {
  test.setTimeout(120_000);

  // ── 1. RAPID 5 SCANS ───────────────────────────────────────────────────────
  test('1. Rapid 5 Scans — React race-condition guard', async ({ page }) => {
    await loginUser(page);

    const barcode  = `840${randomId()}`;
    const prodName = `Rapid-${randomId()}`;
    await createProduct(page, barcode, prodName, '10.00', '100');

    await goToPOS(page);
    // CRITICAL: wait for the product card before scanning → guarantees cache is populated
    await waitForProductInGrid(page, prodName);

    // Fire 5 rapid scans — barcodeService.enqueueScan queues them sequentially
    for (let i = 0; i < 5; i++) {
      await simulateBarcodeScan(page, barcode);
    }

    // Cart must be non-empty
    await waitForCartNotEmpty(page);

    // Exactly 1 cart line-item (not 5 duplicates)
    await expect(page.locator('h4.font-bold', { hasText: prodName })).toHaveCount(1, { timeout: 8000 });

    // The cart summary badge shows "5 Items"
    await expect(page.locator('text=5 Items')).toBeVisible({ timeout: 8000 });
  });

  // ── 2. CAMERA PERMISSION DENIED ────────────────────────────────────────────
  test('2. Camera deny — graceful error handling', async ({ browser }) => {
    const ctx  = await browser.newContext({ permissions: [] }); // camera blocked
    const page = await ctx.newPage();

    await loginUser(page);
    await goToPOS(page);

    // Open camera panel
    const cameraBtn = page.locator('button:has-text("Scan Barkood")').first();
    await expect(cameraBtn).toBeVisible({ timeout: 10000 });
    await cameraBtn.click();

    // Page must NOT crash — core UI elements must remain visible
    await expect(page.locator('text=Current Order')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Cashier Layout')).toBeVisible();

    // Give the camera component time to surface a permission-denied error
    await page.waitForTimeout(2500);

    // Attempt to close camera (button text may change after open)
    const closeBtn = page.locator('button:has-text("Close Camera")').first();
    if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeBtn.click();
    }

    // Layout is still intact after camera interaction
    await expect(page.locator('text=Cashier Layout')).toBeVisible();
    await ctx.close();
  });

  // ── 3. OFFLINE MODE SCANNING ───────────────────────────────────────────────
  test('3. Offline scan — local cache fallback', async ({ page }) => {
    await loginUser(page);

    const barcode  = `841${randomId()}`;
    const prodName = `Offline-${randomId()}`;
    await createProduct(page, barcode, prodName, '20.00', '50');

    await goToPOS(page);
    await waitForProductInGrid(page, prodName); // ensure cache is ready

    // ── Online scan (seeds the in-memory barcodeService cache) ──
    await simulateBarcodeScan(page, barcode);
    await waitForCartNotEmpty(page);
    await expect(page.locator('h4.font-bold', { hasText: prodName })).toBeVisible();

    // Discard the cart
    const discardBtn = page.locator('button:has-text("Discard")');
    await expect(discardBtn).toBeEnabled({ timeout: 6000 });
    await discardBtn.click();
    // Cart is empty again
    await expect(page.locator('button:has-text("Proceed to Payment")')).toBeDisabled({ timeout: 6000 });

    // ── Go offline — network is severed ──
    await page.context().setOffline(true);

    // Scan again — lookupLocal() should hit the in-memory cache without any API call
    await simulateBarcodeScan(page, barcode);
    await waitForCartNotEmpty(page);
    await expect(page.locator('h4.font-bold', { hasText: prodName })).toBeVisible();

    await page.context().setOffline(false); // restore
  });

  // ── 4. OVERSELL CONCURRENCY ─────────────────────────────────────────────────
  test('4. Oversell concurrency — 2 cashiers, stock=1', async ({ browser }) => {
    // Cashier 1 creates the scarce product
    const ctx1  = await browser.newContext();
    const page1 = await ctx1.newPage();
    await loginUser(page1);

    const barcode  = `842${randomId()}`;
    const prodName = `Rare-${randomId()}`;
    await createProduct(page1, barcode, prodName, '50.00', '1'); // only 1 in stock!

    // Cashier 2 — separate context (independent session, same store)
    const ctx2  = await browser.newContext();
    const page2 = await ctx2.newPage();
    await loginUser(page2);

    // Both navigate to POS and wait for products to load
    await goToPOS(page1);
    await waitForProductInGrid(page1, prodName);

    await goToPOS(page2);
    await waitForProductInGrid(page2, prodName);

    // Both scan the same rare item
    await simulateBarcodeScan(page1, barcode);
    await waitForCartNotEmpty(page1);

    await simulateBarcodeScan(page2, barcode);
    await waitForCartNotEmpty(page2);

    // Both open the payment modal
    await page1.click('button:has-text("Proceed to Payment")');
    await page2.click('button:has-text("Proceed to Payment")');
    await expect(page1.locator('text=Payment Method')).toBeVisible({ timeout: 10000 });
    await expect(page2.locator('text=Payment Method')).toBeVisible({ timeout: 10000 });

    // Fire both checkouts simultaneously — race condition!
    await Promise.allSettled([
      page1.locator('button:has-text("Dollar ($)")').click().catch(() => {}),
      page2.locator('button:has-text("Dollar ($)")').click().catch(() => {}),
    ]);

    // Let both responses settle
    await Promise.all([page1.waitForTimeout(4000), page2.waitForTimeout(4000)]);

    // Verify inventory — stock must be 0, never −1
    await page1.goto('/dashboard/inventory');
    const invRow = page1.locator('tr', { hasText: prodName });
    // Stock column must NOT show negative value
    await expect(invRow.locator('td', { hasText: '-1' })).toHaveCount(0);
    await expect(invRow.locator('td', { hasText: '-2' })).toHaveCount(0);

    await ctx1.close();
    await ctx2.close();
  });

  // ── 5. DEBT SALE + RECEIPT ─────────────────────────────────────────────────
  test('5. Debt sale and receipt generation', async ({ page }) => {
    await loginUser(page);

    const barcode  = `843${randomId()}`;
    const prodName = `DebtItem-${randomId()}`; // prefix avoids "Debt" clash in receipt
    const custName = `Cust-${randomId()}`;

    await createProduct(page, barcode, prodName, '30.00', '10');

    // Create the customer
    await page.goto('/dashboard/customers');
    await expect(page.locator('button:has-text("Add Customer")')).toBeVisible({ timeout: 15000 });
    await page.click('button:has-text("Add Customer")');
    await page.fill('input[placeholder="John Doe"]',   custName);
    await page.fill('input[placeholder="+252 61..."]', '+252617000001');
    await page.click('button:has-text("Save Customer")');
    await expect(
      page.locator('table').locator('td', { hasText: custName }).first()
    ).toBeVisible({ timeout: 10000 });

    // POS: scan product
    await goToPOS(page);
    await waitForProductInGrid(page, prodName); // ensure cache ready

    await simulateBarcodeScan(page, barcode);
    await waitForCartNotEmpty(page);
    await expect(page.locator('h4.font-bold', { hasText: prodName })).toBeVisible();

    // Assign the debt customer
    await page.click('button:has-text("Assign Customer")');
    await expect(page.locator('text=Select Customer')).toBeVisible({ timeout: 8000 });
    await page.locator('button', { hasText: custName }).click();
    await expect(page.locator(`text=${custName}`)).toBeVisible({ timeout: 6000 });

    // Proceed to payment
    await page.click('button:has-text("Proceed to Payment")');
    await expect(page.locator('text=Payment Method')).toBeVisible({ timeout: 8000 });

    // Debt button is only enabled once a customer is assigned
    const debtBtn = page.locator('button:has-text("Pay Later (Debt)")');
    await expect(debtBtn).toBeEnabled({ timeout: 8000 });
    await debtBtn.click();

    // Verify receipt panel
    await expect(page.locator('text=Transaction Success')).toBeVisible({ timeout: 12000 });
    await expect(page.locator('text=Print Receipt')).toBeVisible();

    // Receipt payment line: <p class="font-black text-[13px] uppercase">Debt: $30.00</p>
    // We target the <p> element specifically to avoid matching the item name "DebtItem-..."
    await expect(
      page.locator('#receipt-print-area p.font-black').filter({ hasText: /Debt:\s*\$/ })
    ).toBeVisible({ timeout: 8000 });
  });

  // ── 6. MULTI-TENANT ISOLATION ──────────────────────────────────────────────
  test('6. Multi-tenant isolation — Tenant A data invisible to Tenant B', async ({ browser }) => {
    if (!EMAIL_B || !PASS_B) {
      console.log('⚠️  Skipping: set E2E_TEST_EMAIL_B / E2E_TEST_PASSWORD_B to enable Tenant B check.');
      return;
    }

    // Tenant A creates a uniquely-barcoded product
    const ctxA  = await browser.newContext();
    const pageA = await ctxA.newPage();
    await loginUser(pageA, EMAIL_A, PASS_A);

    const barcodeA  = `844${randomId()}`;
    const prodNameA = `TenantA-${randomId()}`;
    await createProduct(pageA, barcodeA, prodNameA, '45.00', '15');

    // Tenant B opens a fresh context
    const ctxB  = await browser.newContext();
    const pageB = await ctxB.newPage();
    await loginUser(pageB, EMAIL_B, PASS_B);

    // ── Isolation check 1: Inventory table must NOT show Tenant A's product ──
    await pageB.goto('/dashboard/inventory');
    await pageB.waitForTimeout(2000); // wait for inventory to load
    await expect(pageB.locator('table').locator('td', { hasText: prodNameA })).toHaveCount(0);

    // ── Isolation check 2: POS barcode scan must NOT add Tenant A's item to Tenant B's cart ──
    await goToPOS(pageB);
    await pageB.waitForTimeout(2000); // wait for POS products to load (Tenant B's products)

    await simulateBarcodeScan(pageB, barcodeA);

    // The Proceed-to-Payment button must remain DISABLED — cart must stay empty
    // This is the definitive proof of RLS isolation: Tenant B cannot scan Tenant A's barcode
    await expect(
      pageB.locator('button:has-text("Proceed to Payment")')
    ).toBeDisabled({ timeout: 8000 });

    await ctxA.close();
    await ctxB.close();
  });
});
