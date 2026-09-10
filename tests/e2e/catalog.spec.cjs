const { test, expect } = require('@playwright/test');

test.describe('HeySmart storefront safety net', () => {
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#model-switcher .model-btn').first()).toBeVisible();
  });

  test.afterEach(async () => {
    expect(pageErrors, `Unexpected browser errors:\n${pageErrors.join('\n')}`).toEqual([]);
  });

  test('catalog still renders known speaker models', async ({ page }) => {
    const modelButtons = page.locator('#model-switcher .model-btn');
    await expect(modelButtons).toHaveCount(3);
    await expect(page.locator('#showroom')).toBeVisible();
    await expect(page.locator('#hero-image')).toBeVisible();

    const switcherText = (await page.locator('#model-switcher').innerText()).toLowerCase();
    expect(switcherText).not.toContain('yandex plus');
    expect(switcherText).not.toContain('яндекс плюс');
  });

  test('colors remain selectable and update the active product image', async ({ page }) => {
    const colors = page.locator('#color-gallery .thumb');
    await expect(colors).toHaveCount(2);

    await colors.nth(1).click();
    await expect(colors.nth(1)).toHaveClass(/active/);

    const src = await page.locator('#hero-image').getAttribute('src');
    expect(src || '').toContain('/images/catalog/light-2/pink/');
  });

  test('Yandex Plus renders as a separate API-driven offer', async ({ page }) => {
    const offer = page.locator('#yandex-plus-offer');
    await expect(offer).toBeVisible();
    await expect(offer).toContainText('45 €');
    await expect(offer.locator('.yp-cta')).toBeVisible();

    const href = await offer.locator('.yp-cta').getAttribute('href');
    expect(href || '').toContain('wa.me/37126198525');
    expect(decodeURIComponent(href || '')).toContain('45 €');
  });

  test('Yandex Plus offer stays between showroom and quick choice', async ({ page }) => {
    const order = await page.evaluate(() => {
      const showroom = document.querySelector('#showroom');
      const offer = document.querySelector('#yandex-plus-offer');
      const quickChoose = document.querySelector('.quick-choose');
      if (!showroom || !offer || !quickChoose) return null;
      return {
        showroomBeforeOffer: Boolean(showroom.compareDocumentPosition(offer) & Node.DOCUMENT_POSITION_FOLLOWING),
        offerBeforeQuickChoose: Boolean(offer.compareDocumentPosition(quickChoose) & Node.DOCUMENT_POSITION_FOLLOWING),
      };
    });

    expect(order).toEqual({ showroomBeforeOffer: true, offerBeforeQuickChoose: true });
  });

  test('promo image is a real decoded image, not alt text or a broken asset', async ({ page }) => {
    const image = page.locator('#yandex-plus-offer .yp-media img');
    await expect(image).toBeVisible();

    await expect.poll(async () => image.evaluate(img => ({
      complete: img.complete,
      width: img.naturalWidth,
      height: img.naturalHeight,
    }))).toEqual({ complete: true, width: 700, height: 828 });
  });
});
