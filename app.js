// ========== AUTH ==========
function getToken()     { return localStorage.getItem('inv_token'); }
function getRole()      { return localStorage.getItem('inv_role'); }
function authHeaders()  {
  return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() };
}
function logout() {
  localStorage.removeItem('inv_token');
  localStorage.removeItem('inv_role');
  localStorage.removeItem('inv_username');
  location.href = '/login.html';
}

// ========== STORAGE (server-backed) ==========
const _cache = { products: [], transactions: [], andreyReturns: [], subAccounts: [], hostSubscriptions: [] };
const BACKUP_SECTIONS = [
  { id: 'products', label: 'products', hint: 'товары и остатки', restorable: true },
  { id: 'sales', label: 'sales', hint: 'только продажи', restorable: true },
  { id: 'settings', label: 'settings', hint: 'аккаунты и хосты', restorable: true },
  { id: 'faq', label: 'faq', hint: 'faq.json', restorable: true },
  { id: 'categories', label: 'categories', hint: 'вычисляется из товаров', restorable: false },
  { id: 'translations', label: 'translations', hint: 'i18n.js', restorable: true },
  { id: 'users', label: 'users', hint: 'только метаданные', restorable: false },
];
let inspectedBackupBase64 = '';
let inspectedBackupInfo = null;

function loadProducts()        { return _cache.products; }
function loadTransactions()    { return _cache.transactions; }
function loadAndreyReturns()   { return _cache.andreyReturns; }
function loadSubAccounts()     { return _cache.subAccounts; }
function loadHostSubscriptions() { return _cache.hostSubscriptions; }

function saveProducts(data) {
  _cache.products = data;
  _persist('products', data);
}
function saveTransactions(data) {
  _cache.transactions = data;
  _persist('transactions', data);
}
function saveAndreyReturns(data) {
  _cache.andreyReturns = data;
  _persist('andreyReturns', data);
}
function saveSubAccounts(data) {
  _cache.subAccounts = data;
  _persist('subAccounts', data);
}
function saveHostSubscriptions(data) {
  _cache.hostSubscriptions = data;
  _persist('hostSubscriptions', data);
}

function _persist(key, data) {
  fetch('/api/save', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ key, data }),
  }).catch(err => console.error('Save error:', err));
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function pLabel(p) { return `${p.productType} / ${p.color}`; }

// ========== FIFO LOT HELPERS ==========
function migrateToLots() {
  const products = loadProducts();
  let changed = false;
  products.forEach(p => {
    if (!p.lots) {
      p.lots = (p.stock > 0)
        ? [{ qty: p.stock, buyPrice: p.buyPrice || 0, date: p.arrivalDate || '' }]
        : [];
      changed = true;
    }
  });
  if (changed) saveProducts(products);
}

function getStock(p)      { return (p.lots || []).reduce((s, l) => s + l.qty, 0); }
function getStockValue(p) { return (p.lots || []).reduce((s, l) => s + l.qty * l.buyPrice, 0); }
function getNextLotPrice(p) {
  const lots = (p.lots || []).filter(l => l.qty > 0);
  return lots.length ? lots[0].buyPrice : 0;
}

function consumeFIFO(p, qty) {
  let remaining = qty;
  let costTotal = 0;
  const newLots = [];
  for (const lot of (p.lots || [])) {
    if (remaining <= 0) { newLots.push(lot); continue; }
    if (lot.qty <= remaining) {
      costTotal += lot.qty * lot.buyPrice;
      remaining -= lot.qty;
    } else {
      costTotal += remaining * lot.buyPrice;
      newLots.push({ ...lot, qty: lot.qty - remaining });
      remaining = 0;
    }
  }
  p.lots = newLots;
  return costTotal;
}

function previewFIFOCost(p, qty) {
  let remaining = qty;
  let cost = 0;
  for (const lot of (p.lots || [])) {
    if (remaining <= 0) break;
    const take = Math.min(lot.qty, remaining);
    cost += take * lot.buyPrice;
    remaining -= take;
  }
  return cost;
}

function typeClass(type) {
  const map = {
    'Лайт 2':    'trow-lite2',
    'Мини 3':    'trow-mini3',
    'Мини Про':  'trow-minipro',
    'Миди':      'trow-midi',
    'Max':       'trow-max',
    'Street':    'trow-street',
    'Прочее':    'trow-prochee',
  };
  return map[type] || '';
}

function renderProductRows(p, colCount) {
  const lots     = (p.lots || []).filter(l => l.qty > 0);
  const stock    = getStock(p);
  const stockVal = getStockValue(p);
  const arrival  = p.arrivalDate
    ? new Date(p.arrivalDate + 'T12:00:00').toLocaleDateString('ru-RU')
    : '—';

  function sClass(qty) { return qty <= 3 ? 'tag-low-stock' : ''; }
  function sTxt(qty) {
    return qty + (qty > 0 && qty <= 3 ? ' ⚠️' : '') + (qty === 0 ? ' ❌ нет' : '');
  }

  if (lots.length <= 1) {
    const buy     = lots.length === 1 ? lots[0].buyPrice : (p.refBuyPrice || null);
    const buyCell = buy !== null ? fmt(buy) : '<span style="color:#94a3b8">—</span>';
    const margin  = buy !== null
      ? marginBadge(buy, p.sellPrice)
      : '<span class="margin-badge">— &nbsp;<span class="margin-eur">' + fmt(p.sellPrice) + '</span></span>';
    if (colCount === 7) {
      return '<tr class="' + typeClass(p.productType) + '">'
        + '<td><strong>' + esc(p.productType) + '</strong></td>'
        + '<td>' + esc(p.color) + '</td>'
        + '<td>' + buyCell + '</td>'
        + '<td>' + fmt(p.sellPrice) + '</td>'
        + '<td class="' + sClass(stock) + '">' + sTxt(stock) + '</td>'
        + '<td>' + fmt(stockVal) + '</td>'
        + '<td>' + margin + '</td>'
        + '</tr>';
    } else {
      return '<tr class="' + typeClass(p.productType) + '">'
        + '<td><strong>' + esc(p.productType) + '</strong></td>'
        + '<td>' + esc(p.color) + '</td>'
        + '<td>' + buyCell + '</td>'
        + '<td>' + fmt(p.sellPrice) + '</td>'
        + '<td class="' + sClass(stock) + '">' + sTxt(stock) + '</td>'
        + '<td>' + arrival + '</td>'
        + '<td>' + margin + '</td>'
        + '<td>' + (getRole() !== 'viewer'
          ? '<button class="btn-edit" onclick="editProduct(\'' + p.id + '\')">✏️ Изм.</button>'
            + ' <button class="btn-delete" onclick="deleteProduct(\'' + p.id + '\')">🗑️ Удал.</button>'
          : '') + '</td>'
        + '</tr>';
    }
  }

  const span = lots.length;
  return lots.map(function(l, i) {
    const isFirst = i === 0;
    const lVal    = l.qty * l.buyPrice;
    const tCells  = isFirst
      ? '<td rowspan="' + span + '"><strong>' + esc(p.productType) + '</strong></td>'
        + '<td rowspan="' + span + '">' + esc(p.color) + '</td>'
      : '';
    if (colCount === 7) {
      return '<tr class="lot-sub-row ' + typeClass(p.productType) + '">'
        + tCells
        + '<td><span class="lot-tag">П' + (i + 1) + '</span> ' + fmt(l.buyPrice) + '</td>'
        + '<td>' + fmt(p.sellPrice) + '</td>'
        + '<td class="' + sClass(l.qty) + '">' + sTxt(l.qty) + '</td>'
        + '<td>' + fmt(lVal) + '</td>'
        + '<td>' + marginBadge(l.buyPrice, p.sellPrice) + '</td>'
        + '</tr>';
    } else {
      const lotDate = l.date ? new Date(l.date + 'T12:00:00').toLocaleDateString('ru-RU') : '—';
      const productBtns = isFirst && getRole() !== 'viewer'
        ? '<button class="btn-edit" onclick="editProduct(\'' + p.id + '\')">✏️ Товар</button> '
          + '<button class="btn-delete" onclick="deleteProduct(\'' + p.id + '\')">🗑️ Товар</button><br>'
        : '';
      const lotBtns = getRole() !== 'viewer'
        ? '<button class="btn-lot-edit" onclick="editLot(\'' + p.id + '\',' + i + ')">✏️ Партию</button> '
          + '<button class="btn-lot-delete" onclick="deleteLot(\'' + p.id + '\',' + i + ')">&#x2716; Лот</button>'
        : '';
      return '<tr class="lot-sub-row ' + typeClass(p.productType) + '">'
        + tCells
        + '<td><span class="lot-tag">П' + (i + 1) + '</span> ' + fmt(l.buyPrice) + '</td>'
        + '<td>' + fmt(p.sellPrice) + '</td>'
        + '<td class="' + sClass(l.qty) + '">' + sTxt(l.qty) + '</td>'
        + '<td>' + lotDate + '</td>'
        + '<td>' + marginBadge(l.buyPrice, p.sellPrice) + '</td>'
        + '<td>' + productBtns + lotBtns + '</td>'
        + '</tr>';
    }
  }).join('');
}

// ========== TABS ==========
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'dashboard') renderDashboard();
    if (btn.dataset.tab === 'products')  renderProducts();
    if (btn.dataset.tab === 'accounts')  renderAccounts();
    if (btn.dataset.tab === 'mail-accounts') renderMailAccounts();
    if (btn.dataset.tab === 'backups')   renderBackups();
    if (btn.dataset.tab === 'sales')     populateProductSelect('sale-product');
    if (btn.dataset.tab === 'restock')   populateProductSelect('restock-product');
    if (btn.dataset.tab === 'history')   renderHistory('all');
    if (btn.dataset.tab === 'annual')    renderAnnual();
  });
});

document.querySelectorAll('.dash-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.dash-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const isAndrey = btn.dataset.dash === 'andrey';
    document.getElementById('dash-main').style.display   = isAndrey ? 'none' : 'block';
    document.getElementById('dash-andrey').style.display = isAndrey ? 'block' : 'none';
    if (isAndrey) renderAndrey();
    else renderDashboard();
  });
});

// ========== TOAST ==========
let toastTimer = null;
function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'show ' + type;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ''; }, 3000);
}

// ========== FORMAT ==========
function fmt(n)    { return Number(n).toLocaleString('ru-RU', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' €'; }
function fmtRaw(n) { return Number(n).toLocaleString('ru-RU', {minimumFractionDigits:2, maximumFractionDigits:2}); }
function marginPct(buy, sell) {
  if (!buy || Number(buy) === 0) return '—';
  return ((Number(sell) - Number(buy)) / Number(buy) * 100).toFixed(1) + '%';
}
function marginBadge(buy, sell) {
  const eur = Number(sell) - Number(buy);
  const pct = marginPct(buy, sell);
  return `<span class="margin-badge">${pct} &nbsp;<span class="margin-eur">${fmt(eur)}</span></span>`;
}

// ========== DASHBOARD ==========
function renderDashboard() {
  const products = loadProducts();
  const txs  = loadTransactions();
  const sales = txs.filter(t => t.type === 'sale');
  const totalRevenue  = sales.reduce((s, t) => s + t.total, 0);
  const totalCostSold = sales.reduce((s, t) => s + t.costTotal, 0);
  const totalProfit   = sales.reduce((s, t) => s + t.profit, 0);
  const soldQty       = sales.reduce((s, t) => s + t.qty, 0);
  const stockValue    = products.reduce((s, p) => s + getStockValue(p), 0);

  document.getElementById('stat-products').textContent    = products.length;
  document.getElementById('stat-profit').textContent      = fmt(totalProfit);
  document.getElementById('stat-profit-pct').textContent  = totalRevenue > 0
    ? ((totalProfit / totalRevenue) * 100).toFixed(1) + '% от выручки' : '';
  document.getElementById('stat-revenue').textContent     = fmt(totalRevenue);
  document.getElementById('stat-cost').textContent        = fmt(totalCostSold);
  document.getElementById('stat-stock-value').textContent = fmt(stockValue);
  document.getElementById('stat-sold-qty').textContent    = soldQty;

  const tbody = document.getElementById('stock-tbody');
  if (!products.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7">Товаров пока нет. Добавьте их во вкладке «Товары».</td></tr>';
    return;
  }
  const sorted = [...products].sort((a, b) => a.productType.localeCompare(b.productType) || a.color.localeCompare(b.color));
  tbody.innerHTML = sorted.map(p => {
    const stock    = getStock(p);
    const stockVal = getStockValue(p);
    const avgBuy   = stock > 0 ? stockVal / stock : (p.refBuyPrice || 0);
    const buyCell  = avgBuy > 0 ? fmt(avgBuy) : '<span style="color:#94a3b8">—</span>';
    const margin   = avgBuy > 0
      ? marginBadge(avgBuy, p.sellPrice)
      : `<span class="margin-badge">— &nbsp;<span class="margin-eur">${fmt(p.sellPrice)}</span></span>`;
    return `<tr class="${typeClass(p.productType)}">
      <td><strong>${esc(p.productType)}</strong></td>
      <td>${esc(p.color)}</td>
      <td>${buyCell}</td>
      <td>${fmt(p.sellPrice)}</td>
      <td class="${stock <= 3 ? 'tag-low-stock' : ''}">${stock}${stock > 0 && stock <= 3 ? ' ⚠️' : ''}${stock === 0 ? ' ❌ нет' : ''}</td>
      <td>${fmt(stockVal)}</td>
      <td>${margin}</td>
    </tr>`;
  }).join('');
}

// ========== ANDREY VIEW ==========
let andreyReturnsDateSort = 'desc';

function renderAndrey() {
  const products = loadProducts();
  const sales    = loadTransactions().filter(t => t.type === 'sale');

  const inStock = products.filter(p => getStock(p) > 0);
  const sorted  = [...inStock].sort((a, b) => a.productType.localeCompare(b.productType) || a.color.localeCompare(b.color));
  let stockTotal = 0;
  const stockRows = [];
  sorted.forEach(p => {
    const lots = (p.lots || []).filter(l => l.qty > 0);
    const span = lots.length;
    lots.forEach((l, i) => {
      const margin   = p.sellPrice - l.buyPrice;
      const retPrice = l.buyPrice + margin / 2;
      const rowTotal = l.qty * retPrice;
      stockTotal += rowTotal;
      const tCells = i === 0
        ? `<td rowspan="${span}"><strong>${esc(p.productType)}</strong></td><td rowspan="${span}">${esc(p.color)}</td>`
        : '';
      stockRows.push(`<tr class="lot-sub-row">
        ${tCells}
        <td><span class="lot-tag">П${i + 1}</span></td>
        <td>${fmt(l.buyPrice)}</td>
        <td>${fmt(p.sellPrice)}</td>
        <td class="andrey-min-price">${fmt(retPrice)} <span style="color:#94a3b8;font-size:0.78rem">(+${fmt(margin / 2)})</span></td>
        <td>${l.qty} шт.</td>
        <td><strong>${fmt(rowTotal)}</strong></td>
      </tr>`);
    });
  });
  if (!stockRows.length) {
    stockRows.push('<tr class="empty-row"><td colspan="8">Нет остатков.</td></tr>');
  } else {
    stockRows.push(`<tr class="andrey-total-row"><td colspan="7" style="text-align:right;font-weight:700;padding-right:12px">Общая сумма:</td><td><strong>${fmt(stockTotal)}</strong></td></tr>`);
  }
  document.getElementById('andrey-tbody').innerHTML = stockRows.join('');

  const soldMap = {};
  sales.forEach(tx => {
    if (!soldMap[tx.productLabel]) soldMap[tx.productLabel] = { label: tx.productLabel, qty: 0, costTotal: 0, profit: 0 };
    soldMap[tx.productLabel].qty       += tx.qty;
    soldMap[tx.productLabel].costTotal += tx.costTotal;
    soldMap[tx.productLabel].profit    += tx.profit;
  });
  let soldTotal = 0;
  const soldRows = Object.keys(soldMap).sort().map(k => {
    const s         = soldMap[k];
    const retAmount = s.costTotal + s.profit / 2;
    soldTotal += retAmount;
    return `<tr><td>${esc(s.label)}</td><td>${s.qty} шт.</td><td>${fmt(s.costTotal)}</td><td>${fmt(s.profit)}</td><td class="andrey-min-price"><strong>${fmt(retAmount)}</strong></td></tr>`;
  });
  if (!soldRows.length) {
    soldRows.push('<tr class="empty-row"><td colspan="5">Продаж пока нет.</td></tr>');
  } else {
    soldRows.push(`<tr class="andrey-total-row"><td colspan="4" style="text-align:right;font-weight:700;padding-right:12px">Итого из продаж:</td><td><strong>${fmt(soldTotal)}</strong></td></tr>`);
  }
  document.getElementById('andrey-sold-tbody').innerHTML = soldRows.join('');

  const returns = loadAndreyReturns();
  const alreadyPaid = returns.reduce((s, r) => s + r.amount, 0);
  const sortedReturns = [...returns].sort((a, b) => {
    const diff = startDateTime(a.date) - startDateTime(b.date);
    if (diff !== 0) return andreyReturnsDateSort === 'desc' ? -diff : diff;
    return String(b.id || '').localeCompare(String(a.id || ''));
  });
  const returnsRows = sortedReturns.map((r) => {
    const d = new Date(r.date + 'T12:00:00').toLocaleDateString('ru-RU');
    return `<tr><td>${d}</td><td style="font-weight:700;color:#16a34a">${fmt(r.amount)}</td><td>${esc(r.note || '-')}</td><td>${getRole() !== 'viewer' ? `<span class="accounts-actions"><button class="btn-delete" onclick="deleteAndreyReturn('${esc(r.id)}')">x</button></span>` : ''}</td></tr>`;
  });
  if (!returnsRows.length) {
    returnsRows.push('<tr class="empty-row"><td colspan="4">Возвратов пока не зафиксировано.</td></tr>');
  } else {
    returnsRows.push(`<tr class="andrey-total-row"><td colspan="1" style="font-weight:700">Итого возвращено:</td><td colspan="3" style="font-weight:700;color:#16a34a">${fmt(alreadyPaid)}</td></tr>`);
  }
  document.getElementById('andrey-returns-tbody').innerHTML = returnsRows.join('');

  const grandTotal = stockTotal + soldTotal;
  const remaining  = grandTotal - alreadyPaid;
  document.getElementById('andrey-total').textContent       = fmt(grandTotal);
  document.getElementById('andrey-paid').textContent        = fmt(alreadyPaid);
  document.getElementById('andrey-remaining').textContent   = fmt(Math.max(remaining, 0));
  document.getElementById('andrey-stock-total').textContent = fmt(stockTotal);
  document.getElementById('andrey-sold-total').textContent  = fmt(soldTotal);
}

function recordAndreyReturn() {
  const amount = parseFloat(document.getElementById('andrey-ret-amount').value);
  const date   = document.getElementById('andrey-ret-date').value;
  const note   = document.getElementById('andrey-ret-note').value.trim();
  if (!amount || amount <= 0 || !date) return;
  const returns = loadAndreyReturns();
  returns.unshift({ id: genId(), amount, date, note });
  saveAndreyReturns(returns);
  document.getElementById('andrey-ret-amount').value = '';
  document.getElementById('andrey-ret-date').value   = '';
  document.getElementById('andrey-ret-note').value   = '';
  document.getElementById('andrey-ret-btn').disabled = true;
  showToast(`Возврат ${fmt(amount)} зафиксирован`);
  renderAndrey();
}

function toggleAndreyReturnsDateSort() {
  andreyReturnsDateSort = andreyReturnsDateSort === 'desc' ? 'asc' : 'desc';
  document.querySelectorAll('.andrey-return-sort-mark').forEach(mark => {
    mark.textContent = andreyReturnsDateSort === 'desc' ? 'v' : '^';
  });
  renderAndrey();
}

function deleteAndreyReturn(id) {
  const returns = loadAndreyReturns();
  const item = returns.find(r => r.id === id);
  if (!item || !confirm(`Delete return ${fmt(item.amount)}?`)) return;
  saveAndreyReturns(returns.filter(r => r.id !== id));
  renderAndrey();
}
// ========== PRODUCTS ==========
function renderProducts() {
  const products = loadProducts();
  const tbody = document.getElementById('products-tbody');
  if (!products.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="8">Список пуст. Добавьте первый товар.</td></tr>';
    return;
  }
  const sorted = [...products].sort((a, b) => a.productType.localeCompare(b.productType) || a.color.localeCompare(b.color));
  tbody.innerHTML = sorted.map(p => renderProductRows(p, 8)).join('');
}

function saveProduct() {
  const id          = document.getElementById('edit-product-id').value;
  const productType = document.getElementById('p-type').value;
  const color       = document.getElementById('p-color').value;
  const buy         = parseFloat(document.getElementById('p-buy').value);
  const sell        = parseFloat(document.getElementById('p-sell').value);
  const stock       = parseInt(document.getElementById('p-stock').value);
  const dateVal     = document.getElementById('p-date').value;

  if (isNaN(sell) || sell < 0) return showToast('Укажите корректную цену продажи', 'error');

  const products = loadProducts();
  const label = `${productType} / ${color}`;

  if (id) {
    const idx = products.findIndex(p => p.id === id);
    if (idx >= 0) {
      products[idx].productType = productType;
      products[idx].color       = color;
      products[idx].sellPrice   = sell;
      if (dateVal) products[idx].arrivalDate = dateVal;
      if (!isNaN(buy) && buy > 0) {
        const lots = products[idx].lots || [];
        if (lots.length === 0)      products[idx].refBuyPrice = buy;
        else if (lots.length === 1) lots[0].buyPrice = buy;
      }
    }
    showToast(`«${label}» обновлён`);
  } else {
    if (isNaN(buy) || buy < 0) return showToast('Укажите корректную цену закупки', 'error');
    if (!dateVal)              return showToast('Укажите дату поступления', 'error');
    if (products.some(p => p.productType === productType && p.color.toLowerCase() === color.toLowerCase())) {
      return showToast(`«${label}» уже есть в каталоге`, 'error');
    }
    const initialStock = (!isNaN(stock) && stock > 0) ? stock : 0;
    const initialLots  = initialStock > 0 ? [{ qty: initialStock, buyPrice: buy, date: dateVal }] : [];
    products.push({ id: genId(), productType, color, sellPrice: sell, arrivalDate: dateVal, lots: initialLots });
    showToast(`«${label}» добавлен`);
  }
  saveProducts(products);
  clearProductForm();
  renderProducts();
}

function editProduct(id) {
  const p = loadProducts().find(p => p.id === id);
  if (!p) return;
  const lots = (p.lots || []).filter(l => l.qty > 0);
  document.getElementById('edit-product-id').value = p.id;
  document.getElementById('p-type').value   = p.productType;
  document.getElementById('p-color').value  = p.color;
  document.getElementById('p-buy').value    = lots.length === 1 ? lots[0].buyPrice : (p.refBuyPrice || getNextLotPrice(p));
  document.getElementById('p-sell').value   = p.sellPrice;
  document.getElementById('p-stock').value  = getStock(p);
  document.getElementById('p-date').value   = p.arrivalDate || '';
  document.getElementById('product-form-title').textContent = 'Редактировать товар';
  document.getElementById('cancel-product-btn').style.display = 'inline-block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  checkProductForm();
}

function cancelProductEdit() { clearProductForm(); }

function clearProductForm() {
  document.getElementById('edit-product-id').value = '';
  document.getElementById('p-type').selectedIndex  = 0;
  document.getElementById('p-color').selectedIndex = 0;
  document.getElementById('p-buy').value    = '';
  document.getElementById('p-sell').value   = '';
  document.getElementById('p-stock').value  = '';
  document.getElementById('p-date').value   = '';
  document.getElementById('product-form-title').textContent = 'Добавить товар';
  document.getElementById('cancel-product-btn').style.display = 'none';
  checkProductForm();
}

function editLot(productId, lotIdx) {
  const products = loadProducts();
  const p = products.find(x => x.id === productId);
  if (!p || !p.lots[lotIdx]) return;
  const lot = p.lots[lotIdx];
  const newPrice = parseFloat(prompt(`Партия ${lotIdx + 1} — новая цена закупки (текущая: ${lot.buyPrice}):`));
  if (isNaN(newPrice) || newPrice <= 0) return;
  p.lots[lotIdx].buyPrice = newPrice;
  saveProducts(products);
  renderProducts();
  renderDashboard();
  showToast(`Цена П${lotIdx + 1} обновлена: ${fmt(newPrice)}`);
}

function deleteLot(productId, lotIdx) {
  const products = loadProducts();
  const p = products.find(x => x.id === productId);
  if (!p || !p.lots[lotIdx]) return;
  const lot = p.lots[lotIdx];
  if (!confirm(`Удалить П${lotIdx + 1}: ${lot.qty} шт. по ${fmt(lot.buyPrice)}?`)) return;
  p.lots.splice(lotIdx, 1);
  saveProducts(products);
  renderProducts();
  renderDashboard();
  showToast(`П${lotIdx + 1} удалён`, 'info');
}

function deleteProduct(id) {
  const products = loadProducts();
  const p = products.find(x => x.id === id);
  if (!p) return;
  if (!confirm(`Удалить «${pLabel(p)}»?`)) return;
  saveProducts(products.filter(x => x.id !== id));
  showToast(`«${pLabel(p)}» удалён`, 'info');
  renderProducts();
}

// ========== ACCOUNTS ==========
let accountsView = 'subs';
let subAccountsStartSort = 'desc';

function getAccountHostKey(host) {
  return (host.hostMail || host.id || '').toLowerCase();
}

function subMatchesHost(sub, host) {
  const hostKey = getAccountHostKey(host);
  const linked = (host.linkedAccounts || []).map(x => String(x).toLowerCase());
  return linked.includes(String(sub.id).toLowerCase())
    || linked.includes(String(sub.email || '').toLowerCase())
    || String(sub.hostProvider || '').toLowerCase() === hostKey;
}

function formatAccountDate(value) {
  if (!value) return '<span style="color:#94a3b8">-</span>';
  const d = new Date(String(value).slice(0, 10) + 'T12:00:00');
  if (!isNaN(d.getTime())) return d.toLocaleDateString('ru-RU');
  const dotted = String(value).trim().match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (dotted) {
    const parsed = new Date(Number(dotted[3]), Number(dotted[2]) - 1, Number(dotted[1]));
    return isNaN(parsed.getTime()) ? esc(value) : parsed.toLocaleDateString('ru-RU');
  }
  return esc(value);
}

function renewalClass(value) {
  if (!value) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const renewal = new Date(String(value).slice(0, 10) + 'T00:00:00');
  if (isNaN(renewal.getTime())) return '';
  const days = Math.ceil((renewal - today) / 86400000);
  if (days < 0) return 'account-renewal-overdue';
  if (days <= 14) return 'account-renewal-soon';
  if (days <= 30) return 'account-renewal-watch';
  return '';
}

function subPaymentClass(sub) {
  const due = getSubPaymentDue(sub);
  if (!due) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.ceil((due - today) / 86400000);
  if (days < 0) return 'account-payment-overdue';
  if (days <= 14) return 'account-payment-soon';
  return '';
}

function getSubPaymentDue(sub) {
  const base = startDateTime(sub.startDate);
  if (!base) return null;
  const due = new Date(base);
  due.setFullYear(due.getFullYear() + 1);
  due.setHours(0, 0, 0, 0);
  return due;
}

function isCancelledSub(sub) {
  return ['cancelled', 'canceled', 'annulled', 'off'].includes(String(sub.status || '').toLowerCase());
}

function isNewUnassignedSub(sub) {
  return !isCancelledSub(sub) && !String(sub.tel || '').trim() && !String(sub.startDate || '').trim();
}

function subFitsAccountsView(sub) {
  if (accountsView === 'cancelled') return isCancelledSub(sub);
  if (accountsView === 'new') return isNewUnassignedSub(sub);
  return !isCancelledSub(sub) && !isNewUnassignedSub(sub);
}

function accountSearchBlob(host, subs) {
  return [
    host.hostMail, host.password, host.status, host.renewalDate,
    ...subs.flatMap(s => [s.num, s.email, s.startDate, s.tel, s.name, s.hostProvider, s.status])
  ].join(' ').toLowerCase();
}

function subAccountSearchBlob(sub) {
  return [sub.num, sub.email, sub.startDate, sub.tel, sub.name, sub.hostProvider, sub.status].join(' ').toLowerCase();
}

function populateSubHostSelect(selected) {
  const sel = document.getElementById('sub-host');
  if (!sel) return;
  const hosts = [...loadHostSubscriptions()].sort((a, b) => String(a.hostMail || '').localeCompare(String(b.hostMail || '')));
  sel.innerHTML = hosts.length
    ? hosts.map(h => `<option value="${esc(h.hostMail || h.id)}">${esc(h.hostMail || h.id)}</option>`).join('')
    : '<option value="">No hosts</option>';
  if (selected) sel.value = selected;
}

function setAccountsView(view) {
  accountsView = ['subs', 'cancelled', 'new', 'hosts'].includes(view) ? view : 'subs';
  document.querySelectorAll('.accounts-view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.accountView === accountsView);
  });
  document.getElementById('sub-accounts-table').style.display = accountsView === 'hosts' ? 'none' : '';
  document.getElementById('accounts-table').style.display = accountsView === 'hosts' ? '' : 'none';
  renderAccounts();
}

function startDateTime(value) {
  const raw = String(value || '').trim();
  if (!raw) return 0;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])).getTime();
  const dotted = raw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (dotted) return new Date(Number(dotted[3]), Number(dotted[2]) - 1, Number(dotted[1])).getTime();
  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function toDateInputValue(value) {
  const time = startDateTime(value);
  if (!time) return '';
  const d = new Date(time);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function normalizeStartDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const time = startDateTime(raw);
  if (!time) return '';
  const d = new Date(time);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${d.getFullYear()}`;
}

function sortSubsByStart(a, b) {
  const diff = startDateTime(a.startDate) - startDateTime(b.startDate);
  if (diff !== 0) return subAccountsStartSort === 'desc' ? -diff : diff;
  return String(a.num || '').localeCompare(String(b.num || ''), undefined, { numeric: true })
    || String(a.email || '').localeCompare(String(b.email || ''));
}

function toggleSubAccountsStartSort() {
  subAccountsStartSort = subAccountsStartSort === 'desc' ? 'asc' : 'desc';
  document.querySelectorAll('.sub-start-sort-mark').forEach(mark => {
    mark.textContent = subAccountsStartSort === 'desc' ? '↓' : '↑';
  });
  renderAccounts();
}

function renderAccounts() {
  const hosts = loadHostSubscriptions();
  const subs = loadSubAccounts();
  const q = (document.getElementById('accounts-search')?.value || '').trim().toLowerCase();
  const tbody = document.getElementById('accounts-tbody');
  if (!tbody) return;
  populateSubHostSelect();
  document.getElementById('accounts-summary').textContent = `${hosts.length} hosts / ${subs.length} accounts`;
  renderSubAccountsTable(q);
  if (accountsView !== 'hosts') return;
  const rows = [];
  [...hosts]
    .sort((a, b) => String(a.renewalDate || '').localeCompare(String(b.renewalDate || '')) || String(a.hostMail || '').localeCompare(String(b.hostMail || '')))
    .forEach(host => {
      const linkedSubs = subs.filter(sub => subMatchesHost(sub, host));
      if (q && !accountSearchBlob(host, linkedSubs).includes(q)) return;
      const hostId = esc(host.id);
      const renewal = renewalClass(host.renewalDate);
      rows.push(`<tr class="account-host-row ${renewal}">
        <td><button class="account-toggle" onclick="toggleAccountHost('${hostId}')" title="Toggle linked accounts">+</button></td>
        <td><strong>${esc(host.hostMail || '-')}</strong></td>
        <td><span class="account-status">${esc(host.status || '-')}</span></td>
        <td>${formatAccountDate(host.renewalDate)}</td>
        <td>${linkedSubs.length}</td>
        <td><code>${esc(host.password || '')}</code></td>
        <td><span class="accounts-actions"><button class="btn-edit" onclick="editHostSubscription('${hostId}')">Edit</button><button class="btn-delete" onclick="deleteHostSubscription('${hostId}')">Delete</button></span></td>
      </tr>`);
      rows.push(`<tr id="account-linked-${hostId}" class="account-linked-row" style="display:none"><td colspan="7">${renderLinkedSubAccounts(linkedSubs)}</td></tr>`);
    });
  tbody.innerHTML = rows.length ? rows.join('') : '<tr class="empty-row"><td colspan="7">No accounts found.</td></tr>';
}

function renderSubAccountsTable(q) {
  const tbody = document.getElementById('sub-accounts-tbody');
  if (!tbody) return;
  const rows = [...loadSubAccounts()]
    .filter(sub => !q || subAccountSearchBlob(sub).includes(q))
    .filter(subFitsAccountsView)
    .sort(sortSubsByStart)
    .map(sub => {
      const id = esc(sub.id);
      return `<tr class="${subPaymentClass(sub)}">
        <td>${esc(sub.num || '')}</td>
        <td><strong>${esc(sub.email || '')}</strong></td>
        <td>${esc(sub.tel || '')}</td>
        <td>${esc(sub.name || '')}</td>
        <td class="editable-start-date" data-sub-id="${id}" title="Double-click to edit">${formatAccountDate(sub.startDate)} <button class="date-edit-btn" onclick="editSubStartDate('${id}', this.closest('td'))" title="Edit date">Edit</button></td>
        <td>${esc(sub.hostProvider || '')}</td>
        <td><span class="account-status">${esc(sub.status || '')}</span></td>
        <td>${subActionButtons(sub)}</td>
      </tr>`;
    });
  tbody.innerHTML = rows.length ? rows.join('') : '<tr class="empty-row"><td colspan="8">No sub-accounts found.</td></tr>';
}

function renderLinkedSubAccounts(subs) {
  if (!subs.length) return '<div class="account-empty-linked">No linked sub-accounts.</div>';
  return `<table class="accounts-sub-table"><thead><tr><th>Num</th><th>Email</th><th>Phone</th><th>Name</th><th><button class="table-sort-btn" onclick="toggleSubAccountsStartSort()">Start <span class="sub-start-sort-mark">${subAccountsStartSort === 'desc' ? '↓' : '↑'}</span></button></th><th>Status</th><th>Actions</th></tr></thead><tbody>${[...subs].sort(sortSubsByStart).map(sub => {
    const id = esc(sub.id);
    return `<tr class="${subPaymentClass(sub)}">
      <td>${esc(sub.num || '')}</td><td>${esc(sub.email || '')}</td><td>${esc(sub.tel || '')}</td><td>${esc(sub.name || '')}</td>
      <td class="editable-start-date" data-sub-id="${id}" title="Double-click to edit">${formatAccountDate(sub.startDate)} <button class="date-edit-btn" onclick="editSubStartDate('${id}', this.closest('td'))" title="Edit date">Edit</button></td><td>${esc(sub.status || '')}</td>
      <td>${subActionButtons(sub)}</td>
    </tr>`;
  }).join('')}</tbody></table>`;
}

function subActionButtons(sub) {
  const id = esc(sub.id);
  return `<span class="accounts-actions"><button class="btn-edit" onclick="editSubAccount('${id}')">Edit</button><button class="btn-delete" onclick="deleteSubAccount('${id}')">Delete</button></span>`;
}

function toggleAccountHost(id) {
  const row = document.getElementById('account-linked-' + id);
  if (!row) return;
  row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
}

function editSubStartDate(id, cell) {
  if (cell.querySelector('input')) return;
  const sub = loadSubAccounts().find(s => s.id === id);
  if (!sub) return;
  const oldValue = sub.startDate || '';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'inline-date-input';
  input.placeholder = 'dd.mm.yyyy';
  input.value = normalizeStartDate(oldValue) || oldValue;
  cell.innerHTML = '';
  cell.appendChild(input);
  input.select();
  input.focus();

  let done = false;
  function finish(save) {
    if (done) return;
    done = true;
    if (save) {
      const normalized = normalizeStartDate(input.value);
      if (!normalized) {
        showToast('Use date format dd.mm.yyyy', 'error');
        done = false;
        input.focus();
        return;
      }
      sub.startDate = normalized;
      saveSubAccounts(loadSubAccounts());
      showToast('Start date updated');
    }
    renderAccounts();
  }

  input.addEventListener('blur', () => finish(true));
  input.addEventListener('change', () => finish(true));
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') finish(true);
    if (e.key === 'Escape') finish(false);
  });
}

function saveHostSubscription() {
  const id = document.getElementById('edit-host-id').value || genId();
  const hosts = loadHostSubscriptions();
  const host = {
    id,
    hostMail: document.getElementById('host-mail').value.trim(),
    password: document.getElementById('host-password').value.trim(),
    status: document.getElementById('host-status').value.trim(),
    renewalDate: document.getElementById('host-renewal-date').value,
    linkedAccounts: (hosts.find(h => h.id === id)?.linkedAccounts || [])
  };
  if (!host.hostMail) return showToast('Host email is required', 'error');
  const idx = hosts.findIndex(h => h.id === id);
  if (idx >= 0) hosts[idx] = host; else hosts.push(host);
  saveHostSubscriptions(hosts);
  clearHostForm();
  renderAccounts();
  showToast('Host subscription saved');
}

function editHostSubscription(id) {
  const host = loadHostSubscriptions().find(h => h.id === id);
  if (!host) return;
  document.getElementById('edit-host-id').value = host.id;
  document.getElementById('host-mail').value = host.hostMail || '';
  document.getElementById('host-password').value = host.password || '';
  document.getElementById('host-status').value = host.status || '';
  document.getElementById('host-renewal-date').value = String(host.renewalDate || '').slice(0, 10);
  document.getElementById('host-form-title').textContent = 'Edit host subscription';
  document.getElementById('cancel-host-btn').style.display = 'inline-block';
}

function clearHostForm() {
  ['edit-host-id','host-mail','host-password','host-status','host-renewal-date'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('host-form-title').textContent = 'Add host subscription';
  document.getElementById('cancel-host-btn').style.display = 'none';
}
function cancelHostEdit() { clearHostForm(); }

function deleteHostSubscription(id) {
  const host = loadHostSubscriptions().find(h => h.id === id);
  if (!host || !confirm(`Delete host ${host.hostMail || id}?`)) return;
  saveHostSubscriptions(loadHostSubscriptions().filter(h => h.id !== id));
  renderAccounts();
}

function saveSubAccount() {
  const id = document.getElementById('edit-sub-id').value || genId();
  const hostProvider = document.getElementById('sub-host').value;
  const subs = loadSubAccounts();
  const sub = {
    id,
    num: document.getElementById('sub-num').value.trim(),
    email: document.getElementById('sub-email').value.trim(),
    startDate: document.getElementById('sub-start-date').value,
    tel: document.getElementById('sub-tel').value.trim(),
    name: document.getElementById('sub-name').value.trim(),
    hostProvider,
    status: document.getElementById('sub-status').value.trim()
  };
  if (!sub.email) return showToast('Sub-account email is required', 'error');
  const idx = subs.findIndex(s => s.id === id);
  if (idx >= 0) subs[idx] = sub; else subs.push(sub);
  saveSubAccounts(subs);
  syncSubAccountLink(sub);
  clearSubForm();
  renderAccounts();
  showToast('Sub-account saved');
}

function syncSubAccountLink(sub) {
  const hosts = loadHostSubscriptions();
  hosts.forEach(host => {
    host.linkedAccounts = (host.linkedAccounts || []).filter(x => x !== sub.id && x !== sub.email);
    if (String(host.hostMail || host.id) === String(sub.hostProvider)) host.linkedAccounts.push(sub.id);
  });
  saveHostSubscriptions(hosts);
}

function editSubAccount(id) {
  const sub = loadSubAccounts().find(s => s.id === id);
  if (!sub) return;
  populateSubHostSelect(sub.hostProvider);
  document.getElementById('edit-sub-id').value = sub.id;
  document.getElementById('sub-num').value = sub.num || '';
  document.getElementById('sub-email').value = sub.email || '';
  document.getElementById('sub-start-date').value = String(sub.startDate || '').slice(0, 10);
  document.getElementById('sub-tel').value = sub.tel || '';
  document.getElementById('sub-name').value = sub.name || '';
  document.getElementById('sub-status').value = sub.status || '';
  document.getElementById('sub-form-title').textContent = 'Edit sub-account';
  document.getElementById('cancel-sub-btn').style.display = 'inline-block';
}

function clearSubForm() {
  ['edit-sub-id','sub-num','sub-email','sub-start-date','sub-tel','sub-name','sub-status'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('sub-form-title').textContent = 'Add sub-account';
  document.getElementById('cancel-sub-btn').style.display = 'none';
  populateSubHostSelect();
}
function cancelSubEdit() { clearSubForm(); }

function deleteSubAccount(id) {
  const sub = loadSubAccounts().find(s => s.id === id);
  if (!sub || !confirm(`Delete sub-account ${sub.email || id}?`)) return;
  saveSubAccounts(loadSubAccounts().filter(s => s.id !== id));
  const hosts = loadHostSubscriptions();
  hosts.forEach(host => { host.linkedAccounts = (host.linkedAccounts || []).filter(x => x !== id && x !== sub.email); });
  saveHostSubscriptions(hosts);
  renderAccounts();
}

// ========== HEYSMART MAIL ADMIN ==========
let mailAccountsCache = [];

function formatMailDate(value) {
  if (!value) return '<span style="color:#94a3b8">-</span>';
  const date = new Date(value);
  return isNaN(date.getTime()) ? esc(value) : date.toLocaleString('ru-RU');
}

async function loadMailAccounts() {
  const res = await fetch('/api/admin/mail/accounts', { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
  mailAccountsCache = data.accounts || [];
  return mailAccountsCache;
}

function renderMailCredentials(result) {
  const box = document.getElementById('mail-credentials');
  if (!box) return;
  const text = `Email: ${result.account.email}\nPassword: ${result.password}\nLink: ${result.link}`;
  box.hidden = false;
  box.innerHTML = `
    <strong>Client credentials</strong>
    <pre>${esc(text)}</pre>
    <button class="btn-secondary" onclick="copyMailCredentials()">Copy credentials</button>`;
  box.dataset.copy = text;
}

function copyMailCredentials() {
  const box = document.getElementById('mail-credentials');
  const text = box?.dataset.copy || '';
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => showToast('Mail credentials copied'));
}

function generateMailPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let value = '';
  for (let i = 0; i < 12; i++) {
    value += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  document.getElementById('mail-password').value = value;
  document.getElementById('mail-confirm-password').value = value;
}

async function renderMailAccounts() {
  const tbody = document.getElementById('mail-accounts-tbody');
  if (!tbody) return;
  try {
    await loadMailAccounts();
    const q = (document.getElementById('mail-accounts-search')?.value || '').trim().toLowerCase();
    const rows = mailAccountsCache
      .filter(account => !q || String(account.email || '').toLowerCase().includes(q))
      .map(account => {
        const id = esc(account._id);
        return `<tr>
          <td><strong>${esc(account.email)}</strong></td>
          <td><span class="account-status">${account.active ? 'active' : 'disabled'}</span></td>
          <td>${formatMailDate(account.createdAt)}</td>
          <td>${formatMailDate(account.lastLoginAt)}</td>
          <td><span class="accounts-actions">
            <button class="btn-edit" onclick="openMailAccount('${id}')">Open</button>
            <button class="btn-edit" onclick="resetMailPassword('${id}')">Reset</button>
            <button class="btn-delete" onclick="deactivateMailAccount('${id}')" ${account.active ? '' : 'disabled'}>Deactivate</button>
          </span></td>
        </tr>`;
      });
    tbody.innerHTML = rows.length ? rows.join('') : '<tr class="empty-row"><td colspan="5">No mail accounts yet.</td></tr>';
    document.getElementById('mail-accounts-summary').textContent = `${mailAccountsCache.length} mail accounts`;
  } catch (e) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="5">Could not load mail accounts: ${esc(e.message)}</td></tr>`;
  }
}

async function createMailAccount() {
  const username = document.getElementById('mail-username').value.trim();
  const password = document.getElementById('mail-password').value;
  const confirmPassword = document.getElementById('mail-confirm-password').value;
  if (!username) return showToast('Username is required', 'error');
  if (!password || password.length < 8) return showToast('Password must be at least 8 characters', 'error');
  if (password !== confirmPassword) return showToast('Passwords do not match', 'error');
  const btn = document.getElementById('mail-create-btn');
  btn.disabled = true;
  try {
    const res = await fetch('/api/admin/mail/accounts', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ username, password, confirmPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    document.getElementById('mail-username').value = '';
    document.getElementById('mail-password').value = '';
    document.getElementById('mail-confirm-password').value = '';
    renderMailCredentials(data);
    await renderMailAccounts();
    showToast('Mail account created');
  } catch (e) {
    showToast('Mail account error: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function resetMailPassword(id) {
  if (!confirm('Reset password for this mailbox?')) return;
  try {
    const res = await fetch(`/api/admin/mail/accounts/${encodeURIComponent(id)}/reset-password`, {
      method: 'POST',
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    renderMailCredentials(data);
    await renderMailAccounts();
    showToast('Mail password reset');
  } catch (e) {
    showToast('Reset error: ' + e.message, 'error');
  }
}

async function deactivateMailAccount(id) {
  if (!confirm('Deactivate this mailbox?')) return;
  try {
    const res = await fetch(`/api/admin/mail/accounts/${encodeURIComponent(id)}/deactivate`, {
      method: 'POST',
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    await renderMailAccounts();
    showToast('Mail account deactivated');
  } catch (e) {
    showToast('Deactivate error: ' + e.message, 'error');
  }
}

async function openMailAccount(id) {
  const selected = mailAccountsCache.find(account => account._id === id);
  document.getElementById('mail-admin-selected').textContent = selected ? selected.email : 'Selected mailbox';
  const box = document.getElementById('mail-admin-messages');
  box.innerHTML = '<div class="backup-muted">Loading messages...</div>';
  try {
    const res = await fetch(`/api/admin/mail/accounts/${encodeURIComponent(id)}/messages`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    box.innerHTML = (data.messages || []).length
      ? data.messages.map(message => `<article class="mail-admin-message">
          <strong>${esc(message.subject || '(no subject)')}</strong>
          <span>${esc(message.from || '')}</span>
          <small>${formatMailDate(message.receivedAt)}</small>
        </article>`).join('')
      : '<div class="backup-muted">No messages saved for this mailbox yet.</div>';
  } catch (e) {
    box.innerHTML = `<div class="backup-muted">Could not load messages: ${esc(e.message)}</div>`;
  }
}

async function testMailImap() {
  const btn = document.getElementById('mail-imap-test-btn');
  const status = document.getElementById('mail-imap-status');
  btn.disabled = true;
  status.textContent = 'Testing Gmail IMAP...';
  try {
    const res = await fetch('/api/admin/mail/imap-test', { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      status.textContent = data.reason || data.error || 'IMAP test failed';
      showToast('IMAP test failed', 'error');
      return;
    }
    status.textContent = `IMAP OK. Messages: ${data.messages}, unseen: ${data.unseen}, newest: ${data.newest?.subject || '-'}`;
    showToast('IMAP connection OK');
  } catch (e) {
    status.textContent = 'IMAP test error: ' + e.message;
    showToast('IMAP test error', 'error');
  } finally {
    btn.disabled = false;
  }
}

// ========== SALES ==========
function populateProductSelect(selectId) {
  const products = loadProducts();
  const sorted = [...products].sort((a, b) => a.productType.localeCompare(b.productType) || a.color.localeCompare(b.color));
  const sel = document.getElementById(selectId);
  sel.innerHTML = sorted.length
    ? sorted.map(p => `<option value="${p.id}">${esc(pLabel(p))} — остаток: ${getStock(p)} шт.</option>`).join('')
    : '<option value="">— нет товаров —</option>';
  if (selectId === 'sale-product') {
    sel.onchange = () => { autoFillSalePrice(); updateSalePreview(); };
    document.getElementById('sale-qty').oninput   = updateSalePreview;
    document.getElementById('sale-price').oninput = updateSalePreview;
    autoFillSalePrice();
  }
  if (selectId === 'restock-product') {
    sel.onchange = () => {
      const rp = loadProducts().find(x => x.id === sel.value);
      if (rp && rp.refBuyPrice) {
        const priceEl = document.getElementById('restock-price');
        if (!priceEl.value) priceEl.value = rp.refBuyPrice;
      }
    };
  }
}

function autoFillSalePrice() {
  const sel = document.getElementById('sale-product');
  if (!sel.value) return;
  const p = loadProducts().find(x => x.id === sel.value);
  if (p) document.getElementById('sale-price').value = p.sellPrice;
  updateSalePreview();
}

function updateSalePreview() {
  const preview = document.getElementById('sale-preview');
  const sel     = document.getElementById('sale-product');
  const qty     = parseInt(document.getElementById('sale-qty').value);
  const price   = parseFloat(document.getElementById('sale-price').value);
  if (!sel.value || isNaN(qty) || qty <= 0 || isNaN(price)) { preview.style.display = 'none'; return; }
  const p = loadProducts().find(x => x.id === sel.value);
  if (!p) { preview.style.display = 'none'; return; }
  const total  = qty * price;
  const cost   = previewFIFOCost(p, qty);
  const profit = total - cost;
  preview.style.display = 'block';
  preview.innerHTML = `Выручка: <b>${fmt(total)}</b> &nbsp;|&nbsp; Себестоимость (FIFO): <b>${fmt(cost)}</b> &nbsp;|&nbsp; Прибыль: <b>${fmt(profit)}</b>`;
}

function recordSale() {
  const sel     = document.getElementById('sale-product');
  const qty     = parseInt(document.getElementById('sale-qty').value);
  const price   = parseFloat(document.getElementById('sale-price').value);
  const dateVal = document.getElementById('sale-date').value;
  if (!sel.value)                return showToast('Выберите товар', 'error');
  if (isNaN(qty)   || qty < 1)   return showToast('Укажите количество (мин. 1)', 'error');
  if (isNaN(price) || price < 0) return showToast('Укажите цену продажи', 'error');
  if (!dateVal)                  return showToast('Укажите дату продажи', 'error');
  const products = loadProducts();
  const p = products.find(x => x.id === sel.value);
  if (!p) return showToast('Товар не найден', 'error');
  if (getStock(p) < qty) return showToast(`Недостаточно товара. Остаток: ${getStock(p)} шт.`, 'error');
  const total     = qty * price;
  const costTotal = consumeFIFO(p, qty);
  const profit    = total - costTotal;
  saveProducts(products);
  const txs = loadTransactions();
  txs.unshift({ id: genId(), type: 'sale', productId: p.id, productLabel: pLabel(p), qty, price, total, costTotal, profit, date: dateVal + 'T12:00:00' });
  saveTransactions(txs);
  document.getElementById('sale-qty').value   = '';
  document.getElementById('sale-price').value = '';
  document.getElementById('sale-date').value  = '';
  document.getElementById('sale-preview').style.display = 'none';
  populateProductSelect('sale-product');
  checkSaleForm();
  showToast(`Продано ${qty} шт. «${pLabel(p)}» — прибыль ${fmt(profit)}`);
}

// ========== RESTOCK ==========
function recordRestock() {
  const sel     = document.getElementById('restock-product');
  const qty     = parseInt(document.getElementById('restock-qty').value);
  const price   = parseFloat(document.getElementById('restock-price').value);
  const dateVal = document.getElementById('restock-date').value;
  if (!sel.value)                 return showToast('Выберите товар', 'error');
  if (isNaN(qty)   || qty < 1)    return showToast('Укажите количество', 'error');
  if (isNaN(price) || price <= 0) return showToast('Укажите цену закупки', 'error');
  if (!dateVal)                   return showToast('Укажите дату поступления', 'error');
  const products = loadProducts();
  const p = products.find(x => x.id === sel.value);
  if (!p) return showToast('Товар не найден', 'error');
  p.lots = p.lots || [];
  p.lots.push({ qty, buyPrice: price, date: dateVal });
  delete p.refBuyPrice;
  saveProducts(products);
  const total = qty * price;
  const txs = loadTransactions();
  txs.unshift({ id: genId(), type: 'restock', productId: p.id, productLabel: pLabel(p), qty, price, total, costTotal: 0, profit: 0, date: dateVal + 'T12:00:00' });
  saveTransactions(txs);
  document.getElementById('restock-qty').value   = '';
  document.getElementById('restock-price').value = '';
  document.getElementById('restock-date').value  = '';
  populateProductSelect('restock-product');
  checkRestockForm();
  showToast(`Принято партия ${p.lots.length}: ${qty} шт. «${pLabel(p)}» по ${fmt(price)}`);
}

// ========== HISTORY ==========
let historyDateSort = 'desc';

function renderHistory(filter) {
  let txs = loadTransactions();
  if (filter !== 'all') txs = txs.filter(t => t.type === filter);
  txs = [...txs].sort((a, b) => {
    const diff = new Date(a.date) - new Date(b.date);
    if (diff !== 0) return historyDateSort === 'desc' ? -diff : diff;
    return String(b.id || '').localeCompare(String(a.id || ''));
  });
  const tbody = document.getElementById('history-tbody');
  if (!txs.length) { tbody.innerHTML = '<tr class="empty-row"><td colspan="8">No operations yet.</td></tr>'; return; }
  tbody.innerHTML = txs.map(t => {
    const d = new Date(t.date);
    const dateStr = d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'});
    const tag = t.type === 'sale' ? '<span class="tag-sale">Sale</span>' : '<span class="tag-restock">Restock</span>';
    const actions = t.type === 'sale' && getRole() !== 'viewer'
      ? `<span class="accounts-actions"><button class="btn-return" onclick="returnOneSaleItem('${esc(t.id)}')">Return 1</button></span>`
      : '';
    return `<tr><td>${dateStr}</td><td>${tag}</td><td>${esc(t.productLabel || t.productName || '-')}</td><td>${t.qty}</td><td>${fmt(t.price)}</td><td>${fmt(t.total)}</td><td>${t.type === 'sale' ? fmt(t.profit) : '-'}</td><td>${actions}</td></tr>`;
  }).join('');
}

function returnOneSaleItem(txId) {
  const txs = loadTransactions();
  const tx = txs.find(t => t.id === txId);
  if (!tx || tx.type !== 'sale') return;
  const qty = Number(tx.qty) || 0;
  if (qty <= 0) return;
  if (!confirm(`Return 1 item from sale "${tx.productLabel || tx.productName || txId}" to stock?`)) return;

  const products = loadProducts();
  let product = products.find(p => p.id === tx.productId);
  if (!product) {
    const label = tx.productLabel || tx.productName || 'Returned item';
    const parts = label.split(' / ');
    product = {
      id: tx.productId || genId(),
      productType: parts[0] || label,
      color: parts.slice(1).join(' / ') || '',
      sellPrice: tx.price || 0,
      arrivalDate: String(tx.date || '').slice(0, 10),
      lots: []
    };
    products.push(product);
  }

  const returnedCost = qty > 0 ? (Number(tx.costTotal) || 0) / qty : 0;
  product.lots = product.lots || [];
  product.lots.push({ qty: 1, buyPrice: returnedCost, date: new Date().toISOString().slice(0, 10) });

  if (qty <= 1) {
    saveTransactions(txs.filter(t => t.id !== txId));
  } else {
    tx.qty = qty - 1;
    tx.total = (Number(tx.total) || 0) - (Number(tx.price) || 0);
    tx.costTotal = (Number(tx.costTotal) || 0) - returnedCost;
    tx.profit = (Number(tx.total) || 0) - (Number(tx.costTotal) || 0);
    saveTransactions(txs);
  }

  saveProducts(products);
  renderHistory(document.getElementById('history-filter').value);
  renderDashboard();
  showToast('Returned 1 item to stock');
}
function toggleHistoryDateSort() {
  historyDateSort = historyDateSort === 'desc' ? 'asc' : 'desc';
  document.querySelectorAll('.history-date-sort-mark').forEach(mark => {
    mark.textContent = historyDateSort === 'desc' ? 'v' : '^';
  });
  renderHistory(document.getElementById('history-filter').value);
}

document.getElementById('history-filter').addEventListener('change', e => { renderHistory(e.target.value); });
document.getElementById('accounts-search')?.addEventListener('input', renderAccounts);
document.getElementById('mail-accounts-search')?.addEventListener('input', renderMailAccounts);
document.addEventListener('dblclick', e => {
  const cell = e.target.closest('.editable-start-date');
  if (!cell) return;
  editSubStartDate(cell.dataset.subId, cell);
});

function clearHistory() {
  if (!confirm('Очистить всю историю операций?')) return;
  saveTransactions([]);
  renderHistory('all');
  showToast('История очищена', 'info');
}

// ========== ANNUAL REPORT ==========
const MONTH_NAMES = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];

function annualPct(revenue, profit) {
  if (!revenue) return '<span style="color:#94a3b8">—</span>';
  const pct   = (profit / revenue * 100).toFixed(1);
  const color = profit >= 0 ? '#16a34a' : '#dc2626';
  return `<span style="font-weight:700;color:${color}">${pct} %</span>`;
}

function renderAnnual() {
  const sales = loadTransactions().filter(t => t.type === 'sale');
  const byYear = {};
  sales.forEach(tx => {
    const d = new Date(tx.date);
    const year = d.getFullYear();
    const month = d.getMonth();
    if (!byYear[year]) byYear[year] = { qty: 0, revenue: 0, cost: 0, profit: 0, months: {} };
    const y = byYear[year];
    y.qty += tx.qty || 0; y.revenue += tx.total || 0; y.cost += tx.costTotal || 0; y.profit += tx.profit || 0;
    if (!y.months[month]) y.months[month] = { qty: 0, revenue: 0, cost: 0, profit: 0 };
    const m = y.months[month];
    m.qty += tx.qty || 0; m.revenue += tx.total || 0; m.cost += tx.costTotal || 0; m.profit += tx.profit || 0;
  });
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);
  const totProfit  = sales.reduce((s, t) => s + (t.profit   || 0), 0);
  const totRevenue = sales.reduce((s, t) => s + (t.total    || 0), 0);
  const totQty     = sales.reduce((s, t) => s + (t.qty      || 0), 0);
  document.getElementById('annual-stats').innerHTML = `
    <div class="stat-card"><span class="stat-label">Лет в статистике</span><span class="stat-value">${years.length}</span></div>
    <div class="stat-card profit"><span class="stat-label">💰 Прибыль (всего)</span><span class="stat-value">${fmt(totProfit)}</span></div>
    <div class="stat-card"><span class="stat-label">💳 Выручка (всего)</span><span class="stat-value">${fmt(totRevenue)}</span></div>
    <div class="stat-card"><span class="stat-label">📦 Продано (всего)</span><span class="stat-value">${totQty} шт.</span></div>
    <div class="stat-card"><span class="stat-label">📈 Средняя маржа</span><span class="stat-value">${annualPct(totRevenue, totProfit)}</span></div>`;
  if (!years.length) { document.getElementById('annual-tbody').innerHTML = '<tr class="empty-row"><td colspan="7">Продаж пока нет.</td></tr>'; return; }
  const rows = [];
  years.forEach(year => {
    const y = byYear[year];
    const monthNums = Object.keys(y.months).map(Number).sort((a, b) => a - b);
    const mRows = monthNums.map(mn => {
      const m = y.months[mn];
      return `<tr class="annual-month-row"><td></td><td>${MONTH_NAMES[mn]}</td><td>${m.qty} шт.</td><td>${fmt(m.revenue)}</td><td>${fmt(m.cost)}</td><td style="color:#16a34a;font-weight:600">${fmt(m.profit)}</td><td>${annualPct(m.revenue, m.profit)}</td></tr>`;
    }).join('');
    rows.push(`
      <tr class="annual-year-row" onclick="toggleAnnualMonths(${year})">
        <td><span id="annual-arrow-${year}" class="annual-arrow">▶</span></td>
        <td><strong>${year}</strong></td>
        <td>${y.qty} шт.</td>
        <td>${fmt(y.revenue)}</td>
        <td>${fmt(y.cost)}</td>
        <td style="color:#16a34a;font-weight:700">${fmt(y.profit)}</td>
        <td>${annualPct(y.revenue, y.profit)}</td>
      </tr>
      <tr id="annual-months-${year}" style="display:none">
        <td colspan="7" style="padding:0">
          <table class="annual-sub-table">
            <thead><tr><th></th><th>Месяц</th><th>Продано</th><th>Выручка</th><th>Себестоимость</th><th>Прибыль</th><th>Маржа %</th></tr></thead>
            <tbody>${mRows}</tbody>
          </table>
        </td>
      </tr>`);
  });
  document.getElementById('annual-tbody').innerHTML = rows.join('');
}

function toggleAnnualMonths(year) {
  const row   = document.getElementById('annual-months-' + year);
  const arrow = document.getElementById('annual-arrow-' + year);
  if (!row) return;
  const isOpen = row.style.display !== 'none';
  row.style.display    = isOpen ? 'none' : 'table-row';
  arrow.style.transform = isOpen ? '' : 'rotate(90deg)';
}

// ========== BACKUPS ==========
function renderBackupSectionChecks(containerId, sections, inputName, checkedRestorableOnly) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = sections.map(section => {
    const checked = checkedRestorableOnly ? section.restorable : true;
    const disabled = inputName === 'backup-restore-section' && !section.restorable;
    return `<label class="backup-check">
      <input type="checkbox" name="${inputName}" value="${esc(section.id)}" ${checked && !disabled ? 'checked' : ''} ${disabled ? 'disabled' : ''} />
      <span>${esc(section.label)}<small>${esc(section.hint)}${section.restorable ? '' : ' · только экспорт'}</small></span>
    </label>`;
  }).join('');
}

function selectedBackupSections(inputName) {
  return [...document.querySelectorAll(`input[name="${inputName}"]:checked`)].map(input => input.value);
}

function renderBackups() {
  renderBackupSectionChecks('backup-export-sections', BACKUP_SECTIONS, 'backup-export-section', false);
}

async function exportBackup() {
  const sections = selectedBackupSections('backup-export-section');
  if (!sections.length) return showToast('Выберите хотя бы одну секцию', 'error');
  const btn = document.getElementById('backup-export-btn');
  if (btn) btn.disabled = true;
  try {
    const res = await fetch('/api/backups/export', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ sections }),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'inventory-backup-' + new Date().toISOString().slice(0, 10) + '.zip';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast('Резервная копия скачана');
  } catch (e) {
    showToast('Ошибка экспорта: ' + e.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

async function inspectBackup() {
  const fileInput = document.getElementById('backup-file');
  const file = fileInput?.files?.[0];
  if (!file) return showToast('Выберите ZIP-файл', 'error');
  const buffer = await file.arrayBuffer();
  const btn = document.getElementById('backup-inspect-btn');
  if (btn) btn.disabled = true;
  try {
    const res = await fetch('/api/backups/import/inspect', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + getToken(), 'Content-Type': 'application/zip' },
      body: buffer,
    });
    const info = await res.json();
    if (!res.ok) throw new Error(info.error || ('HTTP ' + res.status));
    inspectedBackupBase64 = arrayBufferToBase64(buffer);
    inspectedBackupInfo = info;
    renderBackupInspect(info);
    showToast('Архив проверен');
  } catch (e) {
    inspectedBackupBase64 = '';
    inspectedBackupInfo = null;
    const result = document.getElementById('backup-inspect-result');
    if (result) {
      result.className = 'backup-inspect show';
      result.innerHTML = `<div class="backup-manifest" style="color:#dc2626">Ошибка проверки: ${esc(e.message)}</div>`;
    }
    showToast('Ошибка проверки архива', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function renderBackupInspect(info) {
  const result = document.getElementById('backup-inspect-result');
  if (!result) return;
  const restorable = new Set(info.restorableCollections || []);
  const sections = BACKUP_SECTIONS
    .filter(section => (info.collections || []).includes(section.id))
    .map(section => ({ ...section, restorable: restorable.has(section.id) }));
  result.className = 'backup-inspect show';
  result.innerHTML = `
    <div class="backup-manifest">
      <strong>Manifest:</strong> version ${esc(info.manifest?.version || '-')}, ${esc(info.manifest?.createdAt || '-')}<br>
      <strong>Секции:</strong> ${esc((info.collections || []).join(', ') || '-')}<br>
      <strong>Только экспорт:</strong> ${esc((info.exportOnlyCollections || []).join(', ') || '-')}
    </div>
    <div class="backup-checks" id="backup-restore-sections"></div>
    <div class="backup-restore-actions">
      <label class="backup-confirm">
        <input type="checkbox" id="backup-confirm-check" />
        <span>Я понимаю, что выбранные секции будут заменены данными из архива.</span>
      </label>
      <button onclick="restoreBackup()" class="btn-danger" id="backup-restore-btn">Восстановить выбранное</button>
    </div>`;
  renderBackupSectionChecks('backup-restore-sections', sections, 'backup-restore-section', true);
}

async function restoreBackup() {
  if (!inspectedBackupBase64 || !inspectedBackupInfo) return showToast('Сначала проверьте ZIP-архив', 'error');
  const sections = selectedBackupSections('backup-restore-section');
  if (!sections.length) return showToast('Выберите секции для восстановления', 'error');
  if (!document.getElementById('backup-confirm-check')?.checked) {
    return showToast('Подтвердите восстановление чекбоксом', 'error');
  }
  if (!confirm('Восстановить выбранные секции из резервной копии?')) return;
  const btn = document.getElementById('backup-restore-btn');
  if (btn) btn.disabled = true;
  try {
    const res = await fetch('/api/backups/import', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ backupBase64: inspectedBackupBase64, sections, confirm: true }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    const reload = await fetch('/api/data', { headers: { 'Authorization': 'Bearer ' + getToken() } });
    const fresh = await reload.json();
    _cache.products = fresh.products || [];
    _cache.transactions = fresh.transactions || [];
    _cache.andreyReturns = fresh.andreyReturns || [];
    _cache.subAccounts = fresh.subAccounts || [];
    _cache.hostSubscriptions = fresh.hostSubscriptions || [];
    renderDashboard();
    showToast('Восстановлено: ' + (data.restored || []).join(', '));
  } catch (e) {
    showToast('Ошибка восстановления: ' + e.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ========== UTILS ==========
function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ========== FORM VALIDATION ==========
function checkProductForm() {
  const buy  = parseFloat(document.getElementById('p-buy').value);
  const sell = parseFloat(document.getElementById('p-sell').value);
  const date = document.getElementById('p-date').value;
  document.getElementById('save-product-btn').disabled = !(buy > 0 && sell > 0 && !!date);
}
function checkSaleForm() {
  const prod  = document.getElementById('sale-product').value;
  const qty   = parseFloat(document.getElementById('sale-qty').value);
  const price = parseFloat(document.getElementById('sale-price').value);
  const date  = document.getElementById('sale-date').value;
  document.getElementById('record-sale-btn').disabled = !(!!prod && qty > 0 && price > 0 && !!date);
}
function checkRestockForm() {
  const prod  = document.getElementById('restock-product').value;
  const qty   = parseFloat(document.getElementById('restock-qty').value);
  const price = parseFloat(document.getElementById('restock-price').value);
  const date  = document.getElementById('restock-date').value;
  document.getElementById('record-restock-btn').disabled = !(!!prod && qty > 0 && price > 0 && !!date);
}
['p-buy','p-sell','p-date','p-type','p-color'].forEach(id => {
  const el = document.getElementById(id);
  el.addEventListener('input', checkProductForm); el.addEventListener('change', checkProductForm);
});
['sale-product','sale-qty','sale-price','sale-date'].forEach(id => {
  const el = document.getElementById(id);
  el.addEventListener('input', checkSaleForm); el.addEventListener('change', checkSaleForm);
});
['restock-product','restock-qty','restock-price','restock-date'].forEach(id => {
  const el = document.getElementById(id);
  el.addEventListener('input', checkRestockForm); el.addEventListener('change', checkRestockForm);
});
function checkAndreyRetForm() {
  const amount = parseFloat(document.getElementById('andrey-ret-amount').value);
  const date   = document.getElementById('andrey-ret-date').value;
  document.getElementById('andrey-ret-btn').disabled = !(amount > 0 && !!date);
}
['andrey-ret-amount','andrey-ret-date'].forEach(id => {
  const el = document.getElementById(id);
  el.addEventListener('input', checkAndreyRetForm); el.addEventListener('change', checkAndreyRetForm);
});

// ========== IMPORT FROM LOCALSTORAGE ==========
function copyCmd() {
  const cmd = document.getElementById('copy-cmd').textContent;
  navigator.clipboard.writeText(cmd).then(() => showToast('Команда скопирована'));
}
async function migrateFromLocalStorage() {
  document.getElementById('import-modal').style.display = 'flex';
}
async function doImport() {
  const raw = document.getElementById('import-json').value.trim();
  if (!raw) return showToast('Вставь JSON из консоли', 'error');
  let parsed;
  try { parsed = JSON.parse(raw); } catch (e) { return showToast('Неверный JSON: ' + e.message, 'error'); }
  const products = parsed.p || [], transactions = parsed.t || [], andreyReturns = parsed.a || [];
  try {
    await Promise.all([
      fetch('/api/save', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ key:'products',      data: products      }) }),
      fetch('/api/save', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ key:'transactions',  data: transactions  }) }),
      fetch('/api/save', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ key:'andreyReturns', data: andreyReturns }) }),
    ]);
    _cache.products = products; _cache.transactions = transactions; _cache.andreyReturns = andreyReturns;
    document.getElementById('import-modal').style.display = 'none';
    document.getElementById('migrate-banner').style.display = 'none';
    migrateToLots(); renderDashboard();
    showToast(`Импортировано: ${products.length} товаров, ${transactions.length} операций`);
  } catch (e) { showToast('Ошибка сохранения: ' + e.message, 'error'); }
}

// ========== INIT ==========
(async function init() {
  if (!getToken()) { location.href = '/login.html'; return; }
  try {
    const res = await fetch('/api/data', { headers: { 'Authorization': 'Bearer ' + getToken() } });
    if (res.status === 401) { localStorage.removeItem('inv_token'); location.href = '/login.html'; return; }
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const d = await res.json();
    _cache.products      = d.products      || [];
    _cache.transactions  = d.transactions  || [];
    _cache.andreyReturns = d.andreyReturns || [];
    _cache.subAccounts = d.subAccounts || [];
    _cache.hostSubscriptions = d.hostSubscriptions || [];
  } catch (e) {
    console.error('Could not load data from server:', e);
    document.body.insertAdjacentHTML('afterbegin',
      '<div style="background:#fef2f2;color:#dc2626;padding:12px 24px;font-weight:600;border-bottom:2px solid #fca5a5">'
      + '⚠️ Сервер не запущен. Запусти: <code style="background:#fee2e2;padding:2px 6px;border-radius:4px">npm start</code>'
      + '</div>');
  }
  if (getRole() === 'viewer') document.body.classList.add('viewer-mode');
  const uname = localStorage.getItem('inv_username');
  const headerUser = document.getElementById('header-user');
  if (headerUser) headerUser.textContent = uname || '';
  migrateToLots();
  renderDashboard();
})();
