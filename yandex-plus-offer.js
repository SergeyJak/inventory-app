(() => {
  const OFFER_ID = 'yandex-plus-12m';
  if (document.getElementById('yandex-plus-offer')) return;

  const lang = ['ru', 'lv', 'en'].includes(window.catalogPageLocale)
    ? window.catalogPageLocale
    : (localStorage.getItem('catalogLanguage') || 'ru');

  const copy = {
    ru: {
      kicker: 'Дополнительное предложение',
      title: 'Яндекс Плюс на 12 месяцев',
      text: 'Промокод на подписку на 12 месяцев. Получение кода после оплаты.',
      note: 'Перед покупкой уточним совместимость промокода с вашим аккаунтом.',
      cta: 'Купить промокод',
      message: 'Здравствуйте! Интересует промокод Яндекс Плюс на 12 месяцев за 45 €.'
    },
    lv: {
      kicker: 'Papildu piedāvājums',
      title: 'Yandex Plus uz 12 mēnešiem',
      text: 'Abonementa promo kods 12 mēnešiem. Kodu saņemsiet pēc apmaksas.',
      note: 'Pirms pirkuma precizēsim promo koda saderību ar jūsu kontu.',
      cta: 'Pirkt promo kodu',
      message: 'Labdien! Mani interesē Yandex Plus promo kods uz 12 mēnešiem par 45 €.'
    },
    en: {
      kicker: 'Additional offer',
      title: 'Yandex Plus for 12 months',
      text: 'A 12-month subscription promo code. The code is provided after payment.',
      note: 'Before purchase, we will confirm that the promo code is compatible with your account.',
      cta: 'Buy promo code',
      message: 'Hello! I am interested in the Yandex Plus 12-month promo code for €45.'
    }
  };

  const t = copy[lang] || copy.ru;
  const style = document.createElement('style');
  style.id = 'yandex-plus-offer-style';
  style.textContent = `
    .promo-offer{max-width:1180px;margin:28px auto 0;padding:0 24px 10px}
    .promo-offer-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:28px;align-items:center;padding:30px 34px;border:1px solid rgba(20,24,35,.09);border-radius:28px;background:linear-gradient(135deg,#fff 0%,#faf7ff 48%,#f5f7ff 100%);box-shadow:0 14px 45px rgba(30,35,70,.07)}
    .promo-offer-kicker{margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6d5bd0}
    .promo-offer h2{margin:0;font-size:clamp(26px,4vw,42px);line-height:1.05}
    .promo-offer-text{max-width:720px;margin:12px 0 0;color:#5d6270;line-height:1.55}
    .promo-offer-note{margin:10px 0 0;font-size:13px;color:#858a96}
    .promo-offer-buy{display:flex;align-items:center;gap:16px;flex-wrap:wrap;justify-content:flex-end}
    .promo-offer-price{font-size:38px;font-weight:800;white-space:nowrap}
    .promo-offer-cta{display:inline-flex;align-items:center;justify-content:center;min-height:52px;padding:0 22px;border-radius:999px;background:#17181c;color:#fff;text-decoration:none;font-weight:700;transition:transform .18s ease,opacity .18s ease}
    .promo-offer-cta:hover{transform:translateY(-1px);opacity:.92}
    .promo-plus-mark{display:inline-grid;place-items:center;width:34px;height:34px;margin-right:10px;border-radius:10px;background:#17181c;color:#fff;font-size:25px;line-height:1}
    @media(max-width:760px){.promo-offer{padding:0 16px 8px}.promo-offer-card{grid-template-columns:1fr;padding:24px 22px;gap:22px}.promo-offer-buy{justify-content:space-between}.promo-offer-price{font-size:34px}.promo-offer-cta{flex:1;min-width:180px}}
  `;
  document.head.appendChild(style);

  const section = document.createElement('section');
  section.className = 'promo-offer';
  section.id = 'yandex-plus-offer';
  section.setAttribute('aria-labelledby', 'yandex-plus-title');
  section.innerHTML = `
    <article class="promo-offer-card">
      <div>
        <p class="promo-offer-kicker">${t.kicker}</p>
        <h2 id="yandex-plus-title"><span class="promo-plus-mark" aria-hidden="true">+</span>${t.title}</h2>
        <p class="promo-offer-text">${t.text}</p>
        <p class="promo-offer-note">${t.note}</p>
      </div>
      <div class="promo-offer-buy">
        <div class="promo-offer-price">45 €</div>
        <a class="promo-offer-cta" href="https://wa.me/37126198525?text=${encodeURIComponent(t.message)}" target="_blank" rel="noopener noreferrer">${t.cta}</a>
      </div>
    </article>
  `;

  const anchor = document.querySelector('.local-info');
  if (anchor?.parentNode) anchor.parentNode.insertBefore(section, anchor);
  else document.querySelector('main')?.appendChild(section);

  section.querySelector('.promo-offer-cta')?.addEventListener('click', () => {
    if (typeof trackVisitorEvent === 'function') {
      trackVisitorEvent('promo_offer_contact', { offerId: OFFER_ID, price: 45 });
    }
  });
})();
