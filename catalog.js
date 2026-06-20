const grid = document.getElementById('product-grid');
const state = document.getElementById('catalog-state');

const money = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setState(message) {
  state.textContent = message;
}

function productCard(product) {
  const title = product.productType || product.label || 'Колонка';
  const color = product.color || 'Цвет уточняется';

  return `
    <article class="product-card">
      <div class="product-art">
        <div class="product-speaker" aria-hidden="true"></div>
      </div>
      <div class="product-info">
        <div class="product-kicker">В наличии</div>
        <div class="product-title">
          <h3>${escapeHtml(title)}</h3>
          <div class="product-meta">${escapeHtml(color)}</div>
        </div>
        <div class="price">${money.format(product.sellPrice || 0)}</div>
        <a class="product-cta" href="#" aria-label="Уточнить ${escapeHtml(product.label || title)}">Уточнить</a>
      </div>
    </article>
  `;
}

async function loadCatalog() {
  try {
    setState('Загружаем модели...');
    const res = await fetch('/api/public/products');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const products = Array.isArray(data.products) ? data.products : [];

    if (!products.length) {
      grid.innerHTML = '';
      setState('Сейчас нет доступных моделей.');
      return;
    }

    grid.innerHTML = products.map(productCard).join('');
    setState('');
  } catch (err) {
    console.error('Catalog load error:', err);
    grid.innerHTML = '';
    setState('Не удалось загрузить модели. Попробуйте обновить страницу.');
  }
}

loadCatalog();
