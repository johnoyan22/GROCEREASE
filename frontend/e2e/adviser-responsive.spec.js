import { test, expect } from '@playwright/test';
import { fixtures, noOverflow, shopperTab, tomorrow } from './support/adviser-fixtures';
test.describe.configure({ mode: 'parallel' });

for (const width of [320, 375, 390, 430, 768, 1024, 1366, 1440]) {
  test('Shopper workflows at ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: width >= 768 ? 900 : 844 }); const issues = await fixtures(page);
    await page.goto('/shopper/dashboard'); await expect(page.getByRole('heading', { name: 'Welcome, Shopper!' })).toBeVisible(); await noOverflow(page, 'Dashboard');
    await shopperTab(page, 'Browse Products'); await page.getByRole('combobox', { name: 'Shop at' }).selectOption('1'); await expect(page.getByRole('heading', { name: 'QA Rice', exact: true })).toBeVisible(); await noOverflow(page, 'Browse');
    await page.getByRole('button', { name: 'Add to cart', exact: true }).click(); await page.getByRole('button', { name: 'View Cart', exact: true }).click(); await expect(page.getByRole('heading', { name: 'My Cart', exact: true })).toBeVisible(); await noOverflow(page, 'Cart');
    await page.getByRole('button', { name: 'Increase QA Rice quantity' }).click(); await expect(page.getByRole('spinbutton', { name: 'Cart quantity for QA Rice' })).toHaveValue('2');
    if ([375, 390, 1440].includes(width)) await page.screenshot({ path: '../tmp/browser-results/shopper-cart-' + width + '.png', fullPage: true });
    await page.getByRole('button', { name: 'Proceed to Checkout', exact: true }).click(); const dialog = page.getByRole('dialog', { name: 'Checkout', exact: true }); await expect(dialog).toBeVisible();
    await dialog.getByLabel('Pickup date').fill(tomorrow); await dialog.getByLabel('From (Philippine time)', { exact: true }).fill('10:00'); await dialog.getByLabel('Until (Philippine time)', { exact: true }).fill('11:00');
    await dialog.getByRole('button', { name: 'Review current prices and pickup schedule' }).click(); await expect(dialog.getByRole('button', { name: 'Confirm / Place Order' })).toBeEnabled(); await noOverflow(page, 'Checkout');
    if ([375,390].includes(width)) await page.screenshot({ path: '../tmp/browser-results/shopper-checkout-' + width + '.png' });
    await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible();
    await shopperTab(page, 'My Orders'); await expect(page.getByRole('heading', { name: /Order #9/ })).toBeVisible(); await page.getByRole('button', { name: 'Show QR / pickup PIN' }).click(); await expect(page.getByAltText('Pickup QR code for order 9')).toBeVisible(); await noOverflow(page, 'Orders and pickup QR');
    for (const name of ['Pick up Information','Notifications','My Profile','Account & Security',/^AI Recommendations/]) {
      await shopperTab(page, name); await noOverflow(page, name);
    }
    await shopperTab(page, 'My Profile'); await page.getByRole('button', { name: 'Edit Profile' }).click(); await noOverflow(page, 'Profile edit'); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(issues).toEqual([]);
  });
  test('Public and authentication at ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); const issues = await fixtures(page, 'guest');
    await page.goto('/'); await expect(page.getByRole('heading', { name: /Smart Grocery/ })).toBeVisible(); await expect(page.getByRole('heading', { name: 'Shop Near You.' })).toBeVisible(); await expect(page.locator('#categories img')).toHaveCount(5);
    await page.context().grantPermissions(['geolocation']); await page.context().setGeolocation({ latitude: 10.301, longitude: 123.901 });
    await page.getByRole('button', { name: 'Use my location', exact: true }).click(); await page.getByRole('button', { name: 'Confirm selected area', exact: true }).click(); await expect(page.getByText('Nearest registered store', { exact: true })).toBeVisible(); await expect(page.getByRole('link', { name: /Get directions/ })).toHaveAttribute('href', /www.google.com\/maps\/dir/); await noOverflow(page, 'Landing and nearest-store results');
    await expect(page.getByRole('link', { name: 'Start Shopping' })).toHaveAttribute('href', '/login');
    await page.locator('#categories img').evaluateAll(images => images.forEach(image => { image.loading = 'eager'; }));
    await expect.poll(() => page.locator('#categories img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0))).toBe(true);
    for (const image of await page.locator('#categories img').all()) { await image.scrollIntoViewIfNeeded(); await image.evaluate(element => element.decode()); }
    await page.evaluate(() => window.scrollTo(0, 0));
    if ([375,1440].includes(width)) await page.screenshot({ path: '../tmp/browser-results/landing-' + width + '.png', fullPage: true });
    await page.getByRole('link', { name: 'Start Shopping' }).click(); await expect(page.getByRole('button', { name: 'Login', exact: true })).toBeVisible(); await noOverflow(page, 'Login');
    await page.getByRole('link', { name: 'Register', exact: true }).click(); await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible(); await noOverflow(page, 'Register');
    expect(issues).toEqual([]);
  });
}
const viewports = [{ width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }, { width: 768, height: 1024 }, { width: 390, height: 844 }];
for (const role of ['inventory_worker', 'supervisor', 'admin']) for (const viewport of viewports) {
  test(role + ' workspaces at ' + viewport.width, async ({ page }) => {
    await page.setViewportSize(viewport); const issues = await fixtures(page, role);
    const paths = role === 'inventory_worker' ? ['/inventory/dashboard','/inventory/products','/inventory/stock','/inventory/notifications','/inventory/profile','/inventory/reports'] : role === 'supervisor' ? ['/supervisor/dashboard','/supervisor/inventory','/supervisor/stock-approvals','/supervisor/system-configuration','/supervisor/profile','/supervisor/notifications','/supervisor/orders','/supervisor/digital-payments','/supervisor/reports'] : ['/admin/dashboard','/admin/reports','/admin/roles','/admin/settings','/admin/stores','/admin/transactions'];
    for (const path of paths) {
      await page.goto(path); await expect(page.locator('main h1').first()).toBeVisible(); await page.waitForTimeout(180); await noOverflow(page, path);
      if (!path.includes('reports')) await expect(page.getByRole('button', { name: 'Export PDF', exact: true })).toHaveCount(0);
      if (path.includes('reports')) await expect(page.getByRole('button', { name: 'Export PDF', exact: true })).toBeEnabled();
      if (path === '/inventory/products') { await expect(page.getByText('QA Rice', { exact: true })).toBeVisible(); await page.getByRole('button', { name: '+ Add New Product' }).click(); const dialog = page.getByRole('dialog', { name: 'Add New Product' }); await expect(dialog).toBeVisible(); await expect(dialog.getByRole('textbox', { name: 'SKU', exact: true })).toHaveAttribute('readonly', ''); await noOverflow(page, 'Product dialog'); await page.keyboard.press('Escape'); }
      if (path.endsWith('/profile') && role !== 'admin') await expect(page.getByRole('img', { name: 'Maria Santos avatar' }).first()).toBeVisible();
      if (path === '/admin/stores') { await page.getByRole('button', { name: 'Map location', exact: true }).click(); await expect(page.getByRole('dialog', { name: 'Store map location', exact: true })).toBeVisible(); await noOverflow(page, 'Store map location dialog'); await page.keyboard.press('Escape'); }
      if (path.includes('dashboard') && viewport.width === 1366) await page.screenshot({ path: '../tmp/browser-results/' + role + '-desktop.png', fullPage: true });
    }
    expect(issues).toEqual([]);
  });
}
