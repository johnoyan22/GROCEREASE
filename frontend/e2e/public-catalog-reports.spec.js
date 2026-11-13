import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fixtures, noOverflow } from './support/adviser-fixtures';
import { installGoogleMapsStub } from './support/google-maps-stub';
test.describe.configure({ mode: 'parallel' });

for (const width of [320, 375, 390, 430, 768, 1024, 1366, 1440]) {
  test('Public discovery, pin selection and catalog at ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); const issues = await fixtures(page, 'guest'); await installGoogleMapsStub(page);
    await page.goto('/e2e/fixtures/public-map.html');
    await page.getByRole('button', { name: 'Choose a map pin', exact: true }).click();
    await page.getByRole('button', { name: 'Choose test map location', exact: true }).click();
    await page.getByRole('button', { name: 'Drag chosen map pin', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm selected area', exact: true }).click();
    await expect(page.getByText('1 registered store within 10 km', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Map marker QA Store', exact: true }).click();
    await expect(page.locator('[data-store-id="1"] button[aria-pressed]')).toHaveAttribute('aria-pressed', 'true');
    const preview = page.locator('#public-catalog'); await expect(preview.getByRole('heading', { name: 'QA Rice', exact: true })).toBeVisible();
    await expect(preview.getByAltText('QA Rice')).toBeVisible(); await expect(preview.getByRole('button', { name: /Add to cart/i })).toHaveCount(0);
    await expect(preview.getByRole('link', { name: 'Login to Start Shopping', exact: true })).toHaveAttribute('href','/login?store=1');
    await preview.getByRole('searchbox', { name: 'Search products', exact: true }).fill('missing product'); await preview.getByRole('button', { name: 'Search', exact: true }).click(); await expect(preview.getByText(/No available products/)).toBeVisible();
    await preview.getByRole('searchbox', { name: 'Search products', exact: true }).fill('rice'); await preview.getByRole('button', { name: 'Search', exact: true }).click(); await preview.getByRole('combobox', { name: 'Category', exact: true }).selectOption('Staples'); await expect(preview.getByRole('heading', { name: 'QA Rice', exact: true })).toBeVisible();
    await noOverflow(page, 'Public catalog with photos and filters');
    if ([375, 1440].includes(width)) await page.screenshot({ path: '../tmp/browser-results/public-catalog-' + width + '.png', fullPage: true });
    await page.getByRole('combobox', { name: 'Search within', exact: true }).selectOption('50');
    await page.getByRole('button', { name: 'Select store Second QA Store', exact: true }).click();
    await expect(page.locator('#public-catalog').getByText('₱123,456.78', { exact: true })).toBeVisible();
    const selected = await page.evaluate(() => window.qaMapMarkers.filter(marker => marker.map && marker.title === 'Second QA Store').at(-1)?.zIndex); expect(selected).toBe(10);
    await noOverflow(page, 'Other store, long name and price'); expect(issues).toEqual([]);
  });
}

test('Missing Maps config, denied location, manual verified area and no-store fallback', async ({ page }) => {
  const issues = await fixtures(page, 'guest');
  await page.addInitScript(() => { Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(success, failure){failure({code:1});}}}); });
  await page.goto('/'); await expect(page.getByText(/interactive map is not available yet/)).toBeVisible();
  await page.getByRole('button', { name: 'Use my location', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('Choose a verified pickup area');
  await page.getByRole('combobox', { name: 'Choose a verified pickup area', exact: true }).selectOption('1'); await page.getByRole('button', { name: 'Confirm selected area', exact: true }).click();
  await page.getByRole('button', { name: 'View Available Products at QA Store', exact: true }).click(); await expect(page.locator('#public-catalog').getByRole('heading',{name:'QA Rice',exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Login to Start Shopping',exact:true}).click(); await expect(page).toHaveURL(/\/login\?store=1$/); await expect(page.getByRole('button',{name:'Login',exact:true})).toBeVisible();
  await page.route('**/api/public/store-locations', route => route.fulfill({status:200,headers:{'Access-Control-Allow-Origin':'http://localhost:5187','Access-Control-Allow-Credentials':'true'},contentType:'application/json',body:JSON.stringify({available:true,stores:[]})}));
  await page.goto('/'); await expect(page.getByText('No verified stores are available for public browsing yet.', {exact:true})).toBeVisible(); expect(issues).toEqual([]);
});

test('Shopper store intent preserves the existing cart until an explicit store-switch confirmation', async ({ page }) => {
  await fixtures(page, 'shopper');
  await page.addInitScript(() => sessionStorage.setItem('grocerease-cart-5',JSON.stringify({store_id:2,items:[{store_inventory_id:88,quantity:1}]})));
  await page.goto('/shopper/dashboard?store=1'); await expect(page.getByRole('button',{name:'Use previewed store',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('grocerease-cart-5')).store_id)).toBe(2);
  await page.getByRole('button',{name:'Use previewed store',exact:true}).click(); await expect(page.getByText('Switching stores clears your current cart. Continue?',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Keep current store',exact:true}).click(); expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('grocerease-cart-5')).store_id)).toBe(2);
  await page.getByRole('button',{name:'Use previewed store',exact:true}).click(); await page.getByRole('button',{name:'Clear cart and switch',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'Shop at',exact:true})).toHaveValue('1'); expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('grocerease-cart-5')).items)).toEqual([]);
});

for (const [role, path, kind] of [['inventory_worker','/inventory/reports','stock'],['supervisor','/supervisor/reports','orders'],['admin','/admin/reports','stock']]) {
  test(role + ' dedicated Reports applies filters and downloads a real PDF fixture', async ({ page }) => {
    const issues=await fixtures(page,role); await page.goto(path); await page.getByRole('combobox',{name:'Report type',exact:true}).selectOption(kind);
    await expect(page.getByRole('button',{name:'Export PDF',exact:true})).toBeEnabled();
    await page.getByRole('searchbox',{name:'Search report',exact:true}).fill('Rice'); await expect(page.getByRole('button',{name:'Export PDF',exact:true})).toBeDisabled();
    if(role==='admin') await page.getByRole('region',{name:'Current stock report',exact:true}).getByRole('combobox',{name:'Supermarket',exact:true}).selectOption('1');
    await page.getByRole('button',{name:'Apply filters',exact:true}).click(); await expect(page.getByRole('button',{name:'Export PDF',exact:true})).toBeEnabled();
    const request = page.waitForRequest(req=>req.url().includes('/reports/'+kind+'.pdf'));
    const downloadPromise=page.waitForEvent('download'); await page.getByRole('button',{name:'Export PDF',exact:true}).click();
    const url=new URL((await request).url());expect(url.searchParams.get('search')).toBe('Rice');if(role==='admin')expect(url.searchParams.get('store_id')).toBe('1');else expect(url.searchParams.has('store_id')).toBe(false);
    const download=await downloadPromise;const bytes=await readFile(await download.path());expect(bytes.subarray(0,5).toString()).toBe('%PDF-');
    await noOverflow(page,'Dedicated report'); expect(issues).toEqual([]);
  });
}
