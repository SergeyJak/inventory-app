const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const serverPath = path.join(root, 'server.js');
const catalogPath = path.join(root, 'catalog.html');

// Expose Yandex Plus through the public products API even with zero stock.
{
  const source = fs.readFileSync(serverPath, 'utf8');
  const marker = '    inStock: stock > 0,';
  const replacement = "    inStock: stock > 0 || productType === 'Yandex Plus',";
  if (!source.includes(replacement)) {
    if (!source.includes(marker)) throw new Error('[yandex-plus] server.js inStock marker not found');
    fs.writeFileSync(serverPath, source.replace(marker, replacement), 'utf8');
    console.log('[yandex-plus] public API support enabled');
  }
}

// Add a standalone storefront card directly below the main catalog/showroom.
{
  const source = fs.readFileSync(catalogPath, 'utf8');
  const id = 'yandex-plus-storefront-v2';
  if (!source.includes(id)) {
    const marker = '  <script src="/catalog.js?v=20260906-product-catalog"></script>';
    if (!source.includes(marker)) throw new Error('[yandex-plus] catalog script marker not found');

    const inline = `${marker}\n  <script id="${id}">\n  (() => {\n    const texts = {\n      ru: { kicker: 'Дополнительное предложение', title: 'Яндекс Плюс на 12 месяцев', text: 'Промокод на подписку на 12 месяцев. Код получите после оплаты.', note: 'Перед покупкой уточним совместимость промокода с вашим аккаунтом.', cta: 'Купить промокод', msg: 'Здравствуйте! Интересует промокод Яндекс Плюс на 12 месяцев за {price}.' },\n      lv: { kicker: 'Papildu piedāvājums', title: 'Yandex Plus uz 12 mēnešiem', text: 'Abonementa promo kods 12 mēnešiem. Kodu saņemsiet pēc apmaksas.', note: 'Pirms pirkuma precizēsim promo koda saderību ar jūsu kontu.', cta: 'Pirkt promo kodu', msg: 'Labdien! Mani interesē Yandex Plus promo kods uz 12 mēnešiem par {price}.' },\n      en: { kicker: 'Additional offer', title: 'Yandex Plus for 12 months', text: 'A 12-month subscription promo code. The code is provided after payment.', note: 'Before purchase, we will confirm that the promo code is compatible with your account.', cta: 'Buy promo code', msg: 'Hello! I am interested in the Yandex Plus 12-month promo code for {price}.' }\n    };\n\n    function lang() {\n      const value = String(document.documentElement.lang || window.catalogPageLocale || 'ru').slice(0, 2).toLowerCase();\n      return texts[value] ? value : 'ru';\n    }\n\n    function money(value) {\n      const locale = lang() === 'en' ? 'en-US' : lang();\n      return Number(value || 0).toLocaleString(locale, { maximumFractionDigits: 2 }) + ' €';\n    }\n\n    function render(product) {\n      if (!product || document.getElementById('yandex-plus-offer')) return;\n      const t = texts[lang()];\n      const price = money(product.sellPrice);\n      const section = document.createElement('section');\n      section.id = 'yandex-plus-offer';\n      section.setAttribute('aria-label', t.title);\n      section.innerHTML = '<div class="yp-card"><div class="yp-media"><img src="https://avatars.mds.yandex.net/get-mpic/16460090/2a000001987ac3e6c0cb5cb4c95c02a34e97/orig" alt="Yandex Plus 12 месяцев" loading="lazy" decoding="async"></div><div class="yp-copy"><p class="eyebrow">' + t.kicker + '</p><h2>' + t.title + '</h2><p class="yp-text">' + t.text + '</p><p class="yp-note">' + t.note + '</p><div class="yp-buy"><strong>' + price + '</strong><a class="yp-cta" target="_blank" rel="noopener">' + t.cta + '</a></div></div></div>';\n      const style = document.createElement('style');\n      style.textContent = '#yandex-plus-offer{padding:24px 20px 10px}.yp-card{max-width:1180px;margin:0 auto;border:1px solid rgba(17,24,39,.1);border-radius:30px;background:linear-gradient(135deg,#fff 0%,#f6f3ff 100%);display:grid;grid-template-columns:minmax(260px,38%) 1fr;overflow:hidden;box-shadow:0 12px 40px rgba(31,41,55,.06)}.yp-media{background:#28233f;display:flex;align-items:center;justify-content:center;min-height:340px}.yp-media img{display:block;width:100%;height:100%;max-height:430px;object-fit:contain}.yp-copy{padding:34px 36px;display:flex;flex-direction:column;justify-content:center}.yp-card h2{margin:6px 0 12px;font-size:clamp(30px,4vw,48px);line-height:1.05}.yp-text{margin:0 0 10px;font-size:18px;line-height:1.5}.yp-note{margin:0;color:#667085;font-size:14px;line-height:1.45}.yp-buy{margin-top:26px;display:flex;align-items:center;gap:20px}.yp-buy strong{font-size:42px;white-space:nowrap}.yp-cta{display:inline-flex;align-items:center;justify-content:center;min-height:54px;padding:0 24px;border-radius:999px;background:#111;color:#fff!important;text-decoration:none;font-weight:800;white-space:nowrap}@media(max-width:720px){#yandex-plus-offer{padding:18px 16px 8px}.yp-card{display:block;border-radius:24px}.yp-media{min-height:0}.yp-media img{width:100%;height:auto;max-height:none}.yp-copy{padding:24px 20px 26px}.yp-card h2{font-size:32px}.yp-text{font-size:17px}.yp-buy{margin-top:22px;justify-content:space-between;gap:14px}.yp-buy strong{font-size:36px}.yp-cta{min-height:50px;padding:0 18px}}';\n      document.head.appendChild(style);\n      const msg = t.msg.replace('{price}', price);\n      section.querySelector('.yp-cta').href = 'https://wa.me/37126198525?text=' + encodeURIComponent(msg);\n      section.querySelector('.yp-cta').addEventListener('click', () => {\n        try { window.gtag?.('event', 'promo_offer_contact', { offer_id: 'yandex-plus-12m', price: Number(product.sellPrice) || 0 }); } catch {}\n      });\n      const quickChoose = document.querySelector('.quick-choose');\n      if (quickChoose) quickChoose.before(section);\n      else {\n        const showroom = document.querySelector('.showroom');\n        if (showroom) showroom.after(section);\n      }\n    }\n\n    fetch('/api/public/products', { cache: 'no-store' })\n      .then(r => r.ok ? r.json() : Promise.reject(new Error('products request failed')))\n      .then(data => {\n        const product = (data.products || []).find(p => String(p.productType || '').trim().toLowerCase() === 'yandex plus');\n        if (product) render(product);\n      })\n      .catch(() => {});\n  })();\n  </script>`;

    fs.writeFileSync(catalogPath, source.replace(marker, inline), 'utf8');
    console.log('[yandex-plus] storefront card enabled');
  }
}
