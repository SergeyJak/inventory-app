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

  test('catalog root keeps Russian SEO locale even with saved English preference', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('catalogLanguage', 'en'));
    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(page).toHaveTitle('Умные колонки с Алисой в Риге и Латвии | HeySmart');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    await expect(page.locator('#language-switcher a[hreflang="en"]')).toBeVisible();
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
    await expect(page.locator('#hero-image')).toHaveAttribute('src', /\/images\/catalog\/light-2\/pink\//);
  });

  test('assistant routes observed contact requests to human handoff in the real storefront runtime', async ({ page }) => {
    await page.locator('#assistant-fab').click();
    const input = page.locator('#faq-input');
    const form = page.locator('#faq-form');

    for (const question of ['Хочу поговорить с человеком', 'Дайте номер']) {
      await input.fill(question);
      await form.evaluate(formElement => formElement.requestSubmit());
      const answer = page.locator('#faq-messages .faq-message').last();
      await expect(answer).not.toContainText('Я пока не нашёл точный ответ');
      await expect(answer).toContainText(/Свяжитесь|WhatsApp|Telegram/);
    }
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

  test('selected model details stay directly below the showroom', async ({ page }) => {
    const order = await page.evaluate(() => {
      const showroom = document.querySelector('#showroom');
      const details = document.querySelector('#model-details');
      const offer = document.querySelector('#yandex-plus-offer');
      const quickChoose = document.querySelector('.quick-choose');
      const extras = document.querySelector('#model-extras');
      if (!showroom || !details || !offer || !quickChoose || !extras) return null;
      const before = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      return {
        showroomBeforeDetails: before(showroom, details),
        detailsBeforeOffer: before(details, offer),
        offerBeforeQuickChoose: before(offer, quickChoose),
        quickChooseBeforeExtras: before(quickChoose, extras),
      };
    });

    expect(order).toEqual({
      showroomBeforeDetails: true,
      detailsBeforeOffer: true,
      offerBeforeQuickChoose: true,
      quickChooseBeforeExtras: true,
    });
  });

  test('promo image is the expected decoded asset', async ({ page }) => {
    const image = page.locator('#yandex-plus-offer .yp-media img');
    await image.scrollIntoViewIfNeeded();
    await expect(image).toBeVisible();

    await expect.poll(async () => image.evaluate(img => ({
      complete: img.complete,
      width: img.naturalWidth,
      height: img.naturalHeight,
    }))).toEqual({ complete: true, width: 700, height: 828 });
  });
});
