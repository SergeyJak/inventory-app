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
let showAllStockRows = false;

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
const adminNav = document.getElementById('admin-nav');
const navToggle = document.querySelector('.nav-toggle');
const navGroups = Array.from(document.querySelectorAll('.nav-group'));

function closeNavGroups(exceptGroup) {
  navGroups.forEach(group => {
    if (group === exceptGroup) return;
    group.classList.remove('open');
    group.querySelector('.nav-group-toggle')?.setAttribute('aria-expanded', 'false');
  });
}

function setNavGroupOpen(group, isOpen) {
  closeNavGroups(isOpen ? group : null);
  group.classList.toggle('open', isOpen);
  group.querySelector('.nav-group-toggle')?.setAttribute('aria-expanded', String(isOpen));
}

function closeMobileNav() {
  adminNav?.classList.remove('open');
  navToggle?.setAttribute('aria-expanded', 'false');
}

function setActiveNavButton(btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const groupToggle = btn.closest('.nav-group')?.querySelector('.nav-group-toggle');
  if (groupToggle) groupToggle.classList.add('active');
}

function getTopLevelNavItems() {
  return Array.from(adminNav?.children || [])
    .map(item => item.classList?.contains('nav-group') ? item.querySelector('.nav-group-toggle') : item)
    .filter(item => item?.matches?.('.tab-btn:not([disabled])') && item.offsetParent !== null);
}

function showTab(tab) {
  document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  if (tab === 'dashboard') renderDashboard();
  if (tab === 'products')  renderProducts();
  if (tab === 'accounts')  renderAccounts();
  if (tab === 'mail-accounts') renderMailAccounts();
  if (tab === 'visitor-activity') renderVisitorAnalytics();
  if (tab === 'assistant-questions') { renderAssistantQuestions(); loadAssistantReportHistory(); }
  if (tab === 'backups')   renderBackups();
  if (tab === 'sales')     populateProductSelect('sale-product');
  if (tab === 'restock')   populateProductSelect('restock-product');
  if (tab === 'history')   renderHistory('all');
  if (tab === 'annual')    renderAnnual();
}

navToggle?.addEventListener('click', () => {
  const isOpen = !adminNav.classList.contains('open');
  adminNav.classList.toggle('open', isOpen);
  navToggle.setAttribute('aria-expanded', String(isOpen));
});

document.querySelectorAll('.nav-group-toggle').forEach(toggle => {
  toggle.addEventListener('click', () => {
    const group = toggle.closest('.nav-group');
    setNavGroupOpen(group, !group.classList.contains('open'));
  });
});

document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => {
    setActiveNavButton(btn);
    showTab(btn.dataset.tab);
    closeNavGroups();
    closeMobileNav();
  });
});

document.addEventListener('click', event => {
  if (!event.target.closest('.admin-nav') && !event.target.closest('.nav-toggle')) {
    closeNavGroups();
    closeMobileNav();
  }
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    closeNavGroups();
    closeMobileNav();
    return;
  }

  const topLevelItems = getTopLevelNavItems();
  const topLevelIndex = topLevelItems.indexOf(document.activeElement);
  if ((event.key === 'ArrowRight' || event.key === 'ArrowLeft') && topLevelIndex !== -1) {
    event.preventDefault();
    closeNavGroups();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (topLevelIndex + direction + topLevelItems.length) % topLevelItems.length;
    topLevelItems[nextIndex]?.focus();
    return;
  }

  const activeGroup = event.target.closest('.nav-group');
  if (!activeGroup) return;

  const items = Array.from(activeGroup.querySelectorAll('.nav-dropdown .tab-btn:not([disabled])'));
  const currentIndex = items.indexOf(document.activeElement);
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    setNavGroupOpen(activeGroup, true);
    items[currentIndex + 1]?.focus() || items[0]?.focus();
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    setNavGroupOpen(activeGroup, true);
    items[currentIndex - 1]?.focus() || items[items.length - 1]?.focus();
  }
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
  const stockQty      = products.reduce((s, p) => s + getStock(p), 0);
  const stockValue    = products.reduce((s, p) => s + getStockValue(p), 0);

  document.getElementById('stat-products').textContent    = stockQty;
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
  const stockToggle = document.getElementById('stock-show-all');
  if (stockToggle) stockToggle.checked = showAllStockRows;
  const sorted = [...products]
    .filter(p => showAllStockRows || getStock(p) > 0)
    .sort((a, b) => a.productType.localeCompare(b.productType) || a.color.localeCompare(b.color));
  if (!sorted.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7">Нет товаров с остатком. Включите весь список, чтобы увидеть позиции без остатка.</td></tr>';
    return;
  }
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
let subAccountsStartSort = 'asc';

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

function isNotActiveSub(sub) {
  return String(sub.status || '').toLowerCase() === 'not active';
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
    ...subs.flatMap(s => [s.email, s.startDate, s.tel, s.name, s.hostProvider, s.status])
  ].join(' ').toLowerCase();
}

function subAccountSearchBlob(sub) {
  return [sub.email, sub.startDate, sub.tel, sub.name, sub.hostProvider, sub.status].join(' ').toLowerCase();
}

function populateSubHostSelect(selected) {
  populateHostSelect('sub-host', selected);
}

function populateHostSelect(selectId, selected, options = {}) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const subs = loadSubAccounts();
  const hosts = [...loadHostSubscriptions()]
    .filter(host => {
      if (!options.maxSubAccounts) return true;
      const hostValue = String(host.hostMail || host.id || '');
      if (selected && hostValue === selected) return true;
      return subs.filter(sub => subMatchesHost(sub, host)).length < options.maxSubAccounts;
    })
    .sort((a, b) => String(a.hostMail || '').localeCompare(String(b.hostMail || '')));
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
  return String(a.email || '').localeCompare(String(b.email || ''))
    || String(a.name || '').localeCompare(String(b.name || ''));
}

function toggleSubAccountsStartSort() {
  subAccountsStartSort = subAccountsStartSort === 'desc' ? 'asc' : 'desc';
  document.querySelectorAll('.sub-start-sort-mark').forEach(mark => {
    mark.textContent = subAccountsStartSort === 'desc' ? '↓' : '↑';
  });
  renderAccounts();
}

function renderSubStartDateCell(sub) {
  if (isNotActiveSub(sub)) return '<td></td>';
  const id = esc(sub.id);
  return `<td class="editable-start-date" data-sub-id="${id}" title="Double-click to edit">${formatAccountDate(sub.startDate)} <button class="date-edit-btn" onclick="editSubStartDate('${id}', this.closest('td'))" title="Edit date">Edit</button></td>`;
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
    .map((sub, index) => {
      const id = esc(sub.id);
      return `<tr class="${subPaymentClass(sub)}">
        <td>${index + 1}</td>
        <td><strong>${esc(sub.email || '')}</strong></td>
        <td>${esc(sub.tel || '')}</td>
        <td>${esc(sub.name || '')}</td>
        ${renderSubStartDateCell(sub)}
        <td>${esc(sub.hostProvider || '')}</td>
        <td><span class="account-status">${esc(sub.status || '')}</span></td>
        <td>${subActionButtons(sub)}</td>
      </tr>`;
    });
  tbody.innerHTML = rows.length ? rows.join('') : '<tr class="empty-row"><td colspan="8">No sub-accounts found.</td></tr>';
}

function renderLinkedSubAccounts(subs) {
  if (!subs.length) return '<div class="account-empty-linked">No linked sub-accounts.</div>';
  return `<table class="accounts-sub-table"><thead><tr><th>Num</th><th>Email</th><th>Phone</th><th>Name</th><th><button class="table-sort-btn" onclick="toggleSubAccountsStartSort()">Start <span class="sub-start-sort-mark">${subAccountsStartSort === 'desc' ? '↓' : '↑'}</span></button></th><th>Status</th><th>Actions</th></tr></thead><tbody>${[...subs].sort(sortSubsByStart).map((sub, index) => {
    const id = esc(sub.id);
    return `<tr class="${subPaymentClass(sub)}">
      <td>${index + 1}</td><td>${esc(sub.email || '')}</td><td>${esc(sub.tel || '')}</td><td>${esc(sub.name || '')}</td>
      ${renderSubStartDateCell(sub)}<td>${esc(sub.status || '')}</td>
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
  document.getElementById('host-status').value = 'active';
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
    email: document.getElementById('sub-email').value.trim(),
    tel: document.getElementById('sub-tel').value.trim(),
    name: document.getElementById('sub-name').value.trim(),
    hostProvider,
    status: document.getElementById('sub-status').value.trim()
  };
  sub.startDate = isNotActiveSub(sub) ? '' : document.getElementById('sub-start-date').value;
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
  document.getElementById('sub-email').value = sub.email || '';
  document.getElementById('sub-start-date').value = String(sub.startDate || '').slice(0, 10);
  document.getElementById('sub-tel').value = sub.tel || '';
  document.getElementById('sub-name').value = sub.name || '';
  document.getElementById('sub-status').value = sub.status || '';
  document.getElementById('sub-form-title').textContent = 'Edit sub-account';
  document.getElementById('cancel-sub-btn').style.display = 'inline-block';
}

function clearSubForm() {
  ['edit-sub-id','sub-email','sub-start-date','sub-tel','sub-name','sub-status'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('sub-status').value = 'active';
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

// ========== ASSISTANT QUESTIONS ADMIN ==========
let assistantQuestionsPage = 1;
let assistantQuestionsTotal = 0;
let assistantQuestionsLimit = 25;
let assistantQuestionsPreset = '';
let assistantCurrentReport = null;

function assistantQueryParams() {
  const params = new URLSearchParams({ page: String(assistantQuestionsPage), limit: String(assistantQuestionsLimit), sort: 'newest' });
  const focus = document.getElementById('assistant-filter-focus')?.value || '';
  const locale = document.getElementById('assistant-filter-locale')?.value || '';
  const reviewed = document.getElementById('assistant-filter-reviewed')?.value || '';
  const search = document.getElementById('assistant-search')?.value || '';
  const from = document.getElementById('assistant-filter-from')?.value || '';
  const to = document.getElementById('assistant-filter-to')?.value || '';
  if (assistantQuestionsPreset === 'needs_improvement') params.set('preset', 'needs_improvement');
  if (assistantQuestionsPreset === 'needs_improvement_reviewed') {
    params.set('preset', 'needs_improvement');
    params.set('reviewed', 'true');
  }
  if (focus === 'unmatched') params.set('matched', 'false');
  if (focus === 'low') params.set('maxConfidence', '0.59');
  if (focus === 'negative') params.set('feedback', 'not_helpful');
  if (locale) params.set('locale', locale);
  if (reviewed && assistantQuestionsPreset !== 'needs_improvement_reviewed') params.set('reviewed', reviewed);
  if (search.trim()) params.set('search', search.trim());
  if (from) params.set('from', `${from}T00:00:00`);
  if (to) params.set('to', `${to}T23:59:59`);
  return params;
}

function setAssistantPreset(preset) {
  assistantQuestionsPreset = preset;
  assistantQuestionsPage = 1;
  document.querySelectorAll('[data-assistant-preset]').forEach(btn => btn.classList.toggle('active', btn.dataset.assistantPreset === preset));
  renderAssistantQuestions();
}

function formatAssistantDate(value) {
  if (!value) return '<span style="color:#94a3b8">-</span>';
  const date = new Date(value);
  return isNaN(date.getTime()) ? esc(value) : date.toLocaleString('ru-RU');
}

function renderAssistantAdminSummary(summary = {}) {
  const box = document.getElementById('assistant-admin-summary');
  if (!box) return;
  const repeated = (summary.repeatedQuestions || []).map(item => `<span>${esc(item.text)} (${item.count})</span>`).join('') || '<span>-</span>';
  const faqs = (summary.matchedFaqs || []).map(item => `<span>${esc(item.id)} (${item.count})</span>`).join('') || '<span>-</span>';
  const improvement = summary.improvement || {};
  const threshold = summary.lowConfidenceThreshold;
  box.innerHTML = `
    <div class="stat-card"><span class="stat-label">Total</span><span class="stat-value">${Number(summary.total) || 0}</span></div>
    <div class="stat-card"><span class="stat-label">Unmatched</span><span class="stat-value">${Number(summary.unmatched) || 0}</span></div>
    <div class="stat-card"><span class="stat-label">Low conf.</span><span class="stat-value">${Number(summary.lowConfidence) || 0}</span></div>
    <div class="stat-card"><span class="stat-label">Negative</span><span class="stat-value">${Number(summary.negativeFeedback) || 0}</span></div>
    <div class="stat-card assistant-queue-card"><span class="stat-label">Needs work</span><span class="stat-value">${Number(improvement.total) || 0}</span><span class="stat-sub">${threshold == null ? '' : `threshold < ${Number(threshold)}`}</span></div>
    <div class="stat-card assistant-queue-card"><span class="stat-label">Feedback</span><span class="stat-value">${Number(improvement.negativeFeedback) || 0}</span></div>
    <div class="stat-card assistant-queue-card"><span class="stat-label">No match</span><span class="stat-value">${Number(improvement.unmatched) || 0}</span></div>
    <div class="stat-card assistant-queue-card"><span class="stat-label">Low conf.</span><span class="stat-value">${Number(improvement.lowConfidence) || 0}</span></div>
    <div class="assistant-admin-toplist"><strong>Repeated questions</strong>${repeated}</div>
    <div class="assistant-admin-toplist"><strong>Matched FAQ</strong>${faqs}</div>
  `;
}

function assistantReportDates() {
  const preset = document.getElementById('assistant-report-preset')?.value || '30';
  const to = new Date();
  let from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (preset === '7') from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (preset === 'custom') {
    const customFrom = document.getElementById('assistant-report-from')?.value;
    const customTo = document.getElementById('assistant-report-to')?.value;
    return { dateFrom: customFrom || '', dateTo: customTo || '' };
  }
  return { dateFrom: from.toISOString().slice(0, 10), dateTo: to.toISOString().slice(0, 10) };
}

function assistantReportPayload() {
  const dates = assistantReportDates();
  const locale = document.getElementById('assistant-report-locale')?.value || '';
  return { ...dates, locale };
}

function assistantReportQuery(extra = {}) {
  const params = new URLSearchParams();
  Object.entries({ ...assistantReportPayload(), ...extra }).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, value);
  });
  return params.toString();
}

function setAssistantReportState(state, text) {
  const box = document.getElementById('assistant-report-state');
  if (!box) return;
  box.textContent = text;
  box.dataset.state = state;
}

function renderAssistantImprovementReport(report) {
  assistantCurrentReport = report;
  const box = document.getElementById('assistant-report-output');
  if (!box) return;
  if (!report) {
    box.innerHTML = '';
    return;
  }
  const data = report.dataSnapshot || {};
  const actions = report.recommendedActions || [];
  const list = (items, render) => items?.length ? items.map(render).join('') : '<li>-</li>';
  box.innerHTML = `
    <section><h4>Overview</h4><div class="assistant-report-grid">
      <div><strong>${Number(data.totalQuestions) || 0}</strong><span>Total questions</span></div>
      <div><strong>${Number(data.uniqueSessions) || 0}</strong><span>Unique sessions</span></div>
      <div><strong>${Number(data.unmatchedCount) || 0}</strong><span>Unmatched</span></div>
      <div><strong>${Number(data.negativeFeedbackCount) || 0}</strong><span>Negative feedback</span></div>
      <div><strong>${data.averageConfidence == null ? '-' : Math.round(data.averageConfidence * 100) + '%'}</strong><span>Avg confidence</span></div>
      <div><strong>${Number(data.needsImprovementCount) || 0}</strong><span>Needs improvement</span></div>
    </div>${report.aiSummary ? `<p class="assistant-report-summary">${esc(report.aiSummary)}</p>` : ''}${report.error ? `<p class="assistant-bad-status">${esc(report.error)}</p>` : ''}</section>
    <section><h4>Top question topics</h4><ul>${list(data.repeatedQuestions || [], item => `<li><strong>${esc(item.normalizedQuestion)}</strong> (${item.count})<br><small>${esc((item.exampleQuestions || []).join(' | '))}</small></li>`)}</ul></section>
    <section><h4>Missing FAQ topics</h4><ul>${list(data.missingFaqCandidates || [], item => `<li><strong>${esc(item.title)}</strong> score ${item.priorityScore}<br><small>${esc(item.reason)} · ${esc((item.exampleQuestions || []).join(' | '))}</small></li>`)}</ul></section>
    <section><h4>Weak FAQ answers</h4><ul>${list(data.weakFaqStats || [], item => `<li><strong>${esc(item.faqId)}</strong> (${item.usageCount})<br><small>${esc((item.weakReasons || []).join(', '))}</small></li>`)}</ul></section>
    <section><h4>Trends</h4><p>Total change: ${esc(data.comparisonWithPreviousPeriod?.totalQuestionChange ?? 0)} · Unmatched change: ${esc(data.comparisonWithPreviousPeriod?.unmatchedChange ?? 0)} · Negative feedback change: ${esc(data.comparisonWithPreviousPeriod?.negativeFeedbackChange ?? 0)}</p><ul>${list(data.comparisonWithPreviousPeriod?.topRisingNormalizedQuestions || [], item => `<li>${esc(item.normalizedQuestion)} +${item.change}</li>`)}</ul></section>
    <section><h4>Recommended actions</h4><div class="assistant-report-actions">${actions.length ? actions.map((action, index) => `
      <article class="assistant-report-action">
        <div><strong>${esc(action.title)}</strong><span>${esc(action.priority)} · ${esc(action.type)} · ${esc(action.status || 'open')}</span></div>
        <p>${esc(action.reason)}</p>
        <small>${esc((action.evidence?.exampleQuestions || []).join(' | '))}</small>
        ${action.suggestedQuestion ? `<p><b>Suggested question:</b> ${esc(action.suggestedQuestion)}</p>` : ''}
        ${action.suggestedAnswer ? `<p><b>Suggested answer:</b> ${esc(action.suggestedAnswer)}</p>` : ''}
        <div class="accounts-actions">
          <select data-report-action-status="${index}">
            ${['open','accepted','rejected','completed'].map(status => `<option value="${status}" ${status === (action.status || 'open') ? 'selected' : ''}>${status}</option>`).join('')}
          </select>
          <input type="text" data-report-action-note="${index}" value="${esc(action.adminNote || '')}" placeholder="Admin note" />
          <button class="btn-edit" onclick="updateAssistantReportAction(${index})">Save</button>
        </div>
      </article>`).join('') : '<div class="backup-muted">No AI recommendations stored for this report.</div>'}</div></section>
  `;
}

async function loadAssistantReportHistory() {
  const box = document.getElementById('assistant-report-history');
  if (!box) return;
  try {
    const res = await fetch('/api/admin/assistant-improvement-reports', { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    const reports = data.reports || [];
    box.innerHTML = reports.length ? reports.map(report => `
      <button class="assistant-report-history-item" type="button" onclick="openAssistantReport('${esc(report.id)}')">
        <strong>${formatAssistantDate(report.generatedAt)}</strong>
        <span>${esc(report.dateFrom?.slice(0, 10) || '')} - ${esc(report.dateTo?.slice(0, 10) || '')} · ${esc(report.locale || 'all')} · ${esc(report.status || '')}</span>
      </button>
    `).join('') : '<div class="backup-muted">No reports generated yet.</div>';
  } catch (e) {
    box.innerHTML = `<div class="backup-muted">Could not load report history: ${esc(e.message)}</div>`;
  }
}

async function openAssistantReport(id) {
  setAssistantReportState('generating', 'Loading report...');
  try {
    const res = await fetch(`/api/admin/assistant-improvement-reports/${encodeURIComponent(id)}`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    renderAssistantImprovementReport(data.report);
    setAssistantReportState('generated', 'Report loaded.');
  } catch (e) {
    setAssistantReportState('failed', 'Failed to load report: ' + e.message);
  }
}

async function generateAssistantImprovementReport() {
  const btn = document.getElementById('assistant-report-generate');
  btn.disabled = true;
  setAssistantReportState('generating', 'Generating report...');
  try {
    const res = await fetch('/api/admin/assistant-improvement-report/generate', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(assistantReportPayload()),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    renderAssistantImprovementReport(data.report);
    setAssistantReportState(data.report.status === 'failed' ? 'failed' : 'generated', data.report.status === 'no_ai' ? 'Generated deterministic report. AI is not configured.' : 'Report generated.');
    await loadAssistantReportHistory();
  } catch (e) {
    setAssistantReportState('failed', 'Failed to generate report: ' + e.message);
  } finally {
    btn.disabled = false;
  }
}

async function exportAssistantAiReport() {
  const btn = document.getElementById('assistant-report-export');
  if (btn) btn.disabled = true;
  setAssistantReportState('generating', 'Preparing AI export...');
  try {
    const query = assistantReportQuery({ includeConversations: 'true' });
    const res = await fetch(`/api/admin/assistant-improvement-report/export?${query}`, { headers: authHeaders() });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('Export endpoint did not return JSON');
    }
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const from = (data.parameters?.dateFrom || '').slice(0, 10) || 'from';
    const to = (data.parameters?.dateTo || '').slice(0, 10) || 'to';
    const locale = data.parameters?.locale || 'all';
    const a = document.createElement('a');
    a.href = url;
    a.download = `assistant-ai-report-${from}-${to}-${locale}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setAssistantReportState('generated', 'AI export downloaded.');
  } catch (e) {
    setAssistantReportState('failed', 'Failed to export AI report: ' + e.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

window.exportAssistantAiReport = exportAssistantAiReport;

async function updateAssistantReportAction(index) {
  if (!assistantCurrentReport?.id) return;
  const status = document.querySelector(`[data-report-action-status="${index}"]`)?.value || 'open';
  const adminNote = document.querySelector(`[data-report-action-note="${index}"]`)?.value || '';
  const res = await fetch(`/api/admin/assistant-improvement-reports/${encodeURIComponent(assistantCurrentReport.id)}/actions/${index}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ status, adminNote }),
  });
  if (!res.ok) return showToast('Could not update action', 'error');
  showToast('Report action updated');
  await openAssistantReport(assistantCurrentReport.id);
}

function renderAssistantRows(items) {
  const tbody = document.getElementById('assistant-questions-tbody');
  if (!tbody) return;
  if (!items.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="11">No assistant questions found.</td></tr>';
    return;
  }
  let lastSession = '';
  tbody.innerHTML = items.map(item => {
    const session = item.sessionId || '-';
    const sessionLabel = session && session === lastSession ? 'same session' : session;
    lastSession = session;
    const status = item.matched ? '<span class="account-status">matched</span>' : '<span class="assistant-bad-status">unmatched</span>';
    const reasons = (item.improvementReasons || []).map(reason => `<span class="assistant-reason">${esc(reason)}</span>`).join('');
    const reviewed = item.reviewed ? 'checked' : '';
    return `<tr>
      <td>${formatAssistantDate(item.createdAt)}</td>
      <td><code>${esc(sessionLabel)}</code></td>
      <td><strong>${esc(item.question)}</strong><p class="assistant-answer-preview">${esc(item.answer || '-')}</p><small>${esc(item.pageUrl || '')}</small></td>
      <td>${esc(item.locale || '-')}</td>
      <td>${esc(item.matchedFaqId || '-')}</td>
      <td>${Math.round((Number(item.confidence) || 0) * 100)}%</td>
      <td>${status}<div class="assistant-reasons">${reasons}</div></td>
      <td>${esc(item.feedback || '-')}</td>
      <td><label class="backup-confirm"><input type="checkbox" ${reviewed} onchange="updateAssistantQuestion('${esc(item.id)}', { reviewed: this.checked }, this)" /> reviewed</label></td>
      <td><textarea class="assistant-note" data-assistant-note="${esc(item.id)}" maxlength="500">${esc(item.adminNote || '')}</textarea></td>
      <td><span class="accounts-actions">
        <button class="btn-edit" onclick="saveAssistantNote('${esc(item.id)}')">Save note</button>
        <button class="btn-edit" onclick="copyAssistantQuestion('${esc(item.id)}')">Copy</button>
      </span></td>
    </tr>`;
  }).join('');
}

async function renderAssistantQuestions() {
  const tbody = document.getElementById('assistant-questions-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr class="empty-row"><td colspan="11">Loading assistant questions...</td></tr>';
  try {
    const res = await fetch(`/api/admin/assistant-questions?${assistantQueryParams()}`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    assistantQuestionsTotal = Number(data.total) || 0;
    assistantQuestionsLimit = Number(data.limit) || assistantQuestionsLimit;
    const summary = data.summary || {};
    summary.lowConfidenceThreshold = data.meta?.lowConfidenceThreshold;
    renderAssistantAdminSummary(summary);
    document.getElementById('assistant-needs-badge').textContent = Number(summary.improvement?.total) || 0;
    renderAssistantRows(data.items || []);
    document.getElementById('assistant-questions-summary').textContent = `${assistantQuestionsTotal} records`;
    document.getElementById('assistant-page-label').textContent = `Page ${data.page || assistantQuestionsPage} / ${Math.max(1, Math.ceil(assistantQuestionsTotal / assistantQuestionsLimit))}`;
  } catch (e) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="11">Could not load assistant questions: ${esc(e.message)}</td></tr>`;
  }
}

function changeAssistantPage(delta) {
  const pages = Math.max(1, Math.ceil(assistantQuestionsTotal / assistantQuestionsLimit));
  assistantQuestionsPage = Math.max(1, Math.min(pages, assistantQuestionsPage + delta));
  renderAssistantQuestions();
}

async function updateAssistantQuestion(id, patch, control) {
  const res = await fetch(`/api/admin/assistant-questions/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    showToast('Could not update assistant question', 'error');
    return;
  }
  if (assistantQuestionsPreset === 'needs_improvement' && patch.reviewed === true) {
    control?.closest('tr')?.remove();
    assistantQuestionsTotal = Math.max(0, assistantQuestionsTotal - 1);
    document.getElementById('assistant-questions-summary').textContent = `${assistantQuestionsTotal} records`;
    const badge = document.getElementById('assistant-needs-badge');
    if (badge) badge.textContent = Math.max(0, Number(badge.textContent) - 1);
  }
}

function saveAssistantNote(id) {
  const note = document.querySelector(`[data-assistant-note="${CSS.escape(id)}"]`)?.value || '';
  updateAssistantQuestion(id, { adminNote: note }).then(() => showToast('Assistant note saved'));
}

function copyAssistantQuestion(id) {
  const row = document.querySelector(`[data-assistant-note="${CSS.escape(id)}"]`)?.closest('tr');
  const question = row?.querySelector('td:nth-child(3) strong')?.textContent || '';
  navigator.clipboard?.writeText(question).then(() => showToast('Question copied'));
}

// ========== VISITOR ANALYTICS ADMIN ==========
let visitorAnalyticsPage = 1;
let visitorAnalyticsLimit = 25;
let visitorAnalyticsTotal = 0;

function visitorAnalyticsParams(extra = {}) {
  const params = new URLSearchParams();
  const search = document.getElementById('visitor-analytics-search')?.value.trim();
  const from = document.getElementById('visitor-analytics-from')?.value;
  const to = document.getElementById('visitor-analytics-to')?.value;
  const includeBots = document.getElementById('visitor-analytics-bots')?.checked;
  if (search) params.set('search', search);
  if (from) params.set('dateFrom', from);
  if (to) params.set('dateTo', to);
  if (includeBots) params.set('includeBots', 'true');
  params.set('page', extra.page || visitorAnalyticsPage);
  params.set('limit', extra.limit || visitorAnalyticsLimit);
  return params;
}

function renderVisitorSummary(summary = {}) {
  const box = document.getElementById('visitor-analytics-summary');
  if (!box) return;
  box.innerHTML = `
    <div class="stat-card"><span class="stat-label">Visitors</span><span class="stat-value">${Number(summary.uniqueVisitors) || 0}</span></div>
    <div class="stat-card"><span class="stat-label">Sessions</span><span class="stat-value">${Number(summary.sessions) || 0}</span></div>
    <div class="stat-card"><span class="stat-label">Views</span><span class="stat-value">${Number(summary.pageViews) || 0}</span></div>
    <div class="stat-card"><span class="stat-label">Returning</span><span class="stat-value">${Number(summary.returningVisitors) || 0}</span></div>
    <div class="stat-card"><span class="stat-label">Assistant</span><span class="stat-value">${Number(summary.assistantUsers) || 0}</span></div>
    <div class="stat-card"><span class="stat-label">Contacts</span><span class="stat-value">${Number(summary.contactClicks) || 0}</span></div>
  `;
}

function shortVisitorId(value) {
  const text = String(value || '');
  return text.length > 16 ? `${text.slice(0, 8)}...${text.slice(-6)}` : text;
}

async function renderVisitorAnalytics() {
  const tbody = document.getElementById('visitor-analytics-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr class="empty-row"><td colspan="11">Loading visitor activity...</td></tr>';
  try {
    const res = await fetch(`/api/admin/analytics/visitors?${visitorAnalyticsParams()}`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    visitorAnalyticsTotal = Number(data.total) || 0;
    visitorAnalyticsLimit = Number(data.limit) || visitorAnalyticsLimit;
    renderVisitorSummary(data.summary || {});
    const rows = data.items || [];
    tbody.innerHTML = rows.length ? rows.map(row => `
      <tr>
        <td><input type="checkbox" class="visitor-analytics-select" value="${esc(row.visitorId)}"></td>
        <td><code title="${esc(row.visitorId)}">${esc(shortVisitorId(row.visitorId))}</code></td>
        <td>${esc(row.latestIp || '-')}</td>
        <td>${Number(row.visitCount) || 0}</td>
        <td>${Number(row.sessionCount) || 0}</td>
        <td>${formatAssistantDate(row.firstSeen)}</td>
        <td>${formatAssistantDate(row.lastSeen)}</td>
        <td>${esc(row.device || '-')}</td>
        <td>${esc(row.locale || '-')}</td>
        <td>${Number(row.eventCount) || 0}<br><button class="btn-edit" onclick="openVisitorAnalyticsDetail('${esc(row.visitorId)}')">Details</button></td>
        <td><button class="btn-delete" onclick="deleteVisitorAnalytics('${esc(row.visitorId)}')">Delete</button></td>
      </tr>
    `).join('') : '<tr class="empty-row"><td colspan="11">No visitor activity found.</td></tr>';
    const selectAll = document.getElementById('visitor-analytics-select-all');
    if (selectAll) selectAll.checked = false;
    document.getElementById('visitor-analytics-count').textContent = `${visitorAnalyticsTotal} visitors`;
    document.getElementById('visitor-analytics-page').textContent = `Page ${data.page || visitorAnalyticsPage} / ${Math.max(1, Math.ceil(visitorAnalyticsTotal / visitorAnalyticsLimit))}`;
  } catch (e) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="11">Could not load visitor activity: ${esc(e.message)}</td></tr>`;
  }
}

function selectedVisitorAnalyticsIds() {
  return [...document.querySelectorAll('.visitor-analytics-select:checked')].map(input => input.value).filter(Boolean);
}

function toggleVisitorAnalyticsSelection(checked) {
  document.querySelectorAll('.visitor-analytics-select').forEach(input => { input.checked = checked; });
}

async function deleteVisitorAnalytics(visitorId) {
  if (!visitorId) return;
  if (!confirm(`Delete visitor analytics logs for ${visitorId}?`)) return;
  try {
    const res = await fetch(`/api/admin/analytics/visitors/${encodeURIComponent(visitorId)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    document.getElementById('visitor-analytics-detail').hidden = true;
    showToast(`Deleted ${Number(data.deleted) || 0} analytics events`);
    renderVisitorAnalytics();
  } catch (e) {
    showToast('Could not delete visitor analytics: ' + e.message, 'error');
  }
}

async function deleteSelectedVisitorAnalytics() {
  const visitorIds = selectedVisitorAnalyticsIds();
  if (!visitorIds.length) return showToast('Select visitor logs to delete', 'info');
  if (!confirm(`Delete analytics logs for ${visitorIds.length} selected visitor(s)?`)) return;
  try {
    const res = await fetch('/api/admin/analytics/visitors', {
      method: 'DELETE',
      headers: authHeaders(),
      body: JSON.stringify({ visitorIds }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    document.getElementById('visitor-analytics-detail').hidden = true;
    showToast(`Deleted ${Number(data.deleted) || 0} analytics events`);
    renderVisitorAnalytics();
  } catch (e) {
    showToast('Could not delete selected visitor analytics: ' + e.message, 'error');
  }
}

function changeVisitorAnalyticsPage(delta) {
  const maxPage = Math.max(1, Math.ceil(visitorAnalyticsTotal / visitorAnalyticsLimit));
  visitorAnalyticsPage = Math.min(maxPage, Math.max(1, visitorAnalyticsPage + delta));
  renderVisitorAnalytics();
}

async function openVisitorAnalyticsDetail(visitorId) {
  const box = document.getElementById('visitor-analytics-detail');
  box.hidden = false;
  box.innerHTML = '<div class="backup-muted">Loading visitor timeline...</div>';
  try {
    const res = await fetch(`/api/admin/analytics/visitors/${encodeURIComponent(visitorId)}?${visitorAnalyticsParams({ page: 1, limit: 200 })}`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    const sessions = (data.sessions || []).map(session => `
      <section class="visitor-session">
        <h4>Session ${esc(shortVisitorId(session.sessionId))}</h4>
        <ul>${(session.events || []).map(event => `<li><span>${formatAssistantDate(event.timestamp)}</span>${esc(event.label || event.eventType)}</li>`).join('')}</ul>
      </section>
    `).join('');
    box.innerHTML = `
      <h3>Visitor ${esc(shortVisitorId(data.visitorId))}</h3>
      <div class="assistant-report-grid">
        <div><strong>${esc((data.ips || []).join(', ') || '-')}</strong><span>IP history</span></div>
        <div><strong>${formatAssistantDate(data.firstSeen)}</strong><span>First seen</span></div>
        <div><strong>${formatAssistantDate(data.lastSeen)}</strong><span>Last seen</span></div>
        <div><strong>${Number(data.sessionCount) || 0}</strong><span>Sessions</span></div>
        <div><strong>${Number(data.eventCount) || 0}</strong><span>Total actions</span></div>
      </div>
      <div class="visitor-timeline">${sessions || '<div class="backup-muted">No events.</div>'}</div>
    `;
  } catch (e) {
    box.innerHTML = `<div class="backup-muted">Could not load visitor detail: ${esc(e.message)}</div>`;
  }
}

// ========== HEYSMART MAIL ADMIN ==========
let mailAccountsCache = [];
let mailAdminMessagesCache = [];
let mailAdminSelectedAccount = null;
let mailAccountsNameSort = 'asc';

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

function buildMailUsername(value) {
  const clean = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/@heysmart\.lv$/i, '')
    .replace(/^alstrix/i, '');
  return clean ? `alstrix${clean}` : '';
}

async function renderMailAccounts() {
  const tbody = document.getElementById('mail-accounts-tbody');
  if (!tbody) return;
  try {
    await loadMailAccounts();
    const q = (document.getElementById('mail-accounts-search')?.value || '').trim().toLowerCase();
    const subs = loadSubAccounts();
    const rows = mailAccountsCache
      .filter(account => !q || String(account.email || '').toLowerCase().includes(q))
      .map(account => ({
        account,
        connectedSub: subs.find(sub => String(sub.email || '').toLowerCase() === String(account.email || '').toLowerCase())
      }))
      .sort((a, b) => {
        const aName = String(a.connectedSub?.name || a.account.email || '').toLowerCase();
        const bName = String(b.connectedSub?.name || b.account.email || '').toLowerCase();
        const diff = aName.localeCompare(bName, undefined, { numeric: true });
        return mailAccountsNameSort === 'desc' ? -diff : diff;
      })
      .map(account => {
        const connectedSub = account.connectedSub;
        account = account.account;
        const id = esc(account._id);
        const connectedHostSub = connectedSub && String(connectedSub.hostProvider || '').trim() ? connectedSub : null;
        const hostMark = connectedHostSub
          ? `<span class="mail-connected-check" title="Connected to ${esc(connectedHostSub.hostProvider)}">✓</span>`
          : '<span style="color:#94a3b8">-</span>';
        return `<tr>
          <td><strong>${esc(account.email)}</strong></td>
          <td>${esc(connectedSub?.name || '')}</td>
          <td><span class="account-status">${account.active ? 'active' : 'disabled'}</span></td>
          <td>${hostMark}</td>
          <td>${formatMailDate(account.createdAt)}</td>
          <td>${formatMailDate(account.lastLoginAt)}</td>
          <td><button class="btn-edit" onclick="openMailAccount('${id}')">Open</button></td>
          <td><button class="btn-edit" onclick="connectMailAccount('${id}')">Connect</button></td>
          <td><span class="accounts-actions">
            <button class="btn-edit" onclick="changeMailPassword('${id}')">Change pass</button>
            ${account.active
              ? `<button class="btn-delete" onclick="deactivateMailAccount('${id}')">Deactivate</button>`
              : `<button class="btn-edit" onclick="activateMailAccount('${id}')">Activate</button>`}
            <button class="btn-delete" onclick="deleteMailAccount('${id}')">Delete</button>
          </span></td>
        </tr>`;
      });
    tbody.innerHTML = rows.length ? rows.join('') : '<tr class="empty-row"><td colspan="9">No mail accounts yet.</td></tr>';
    document.getElementById('mail-accounts-summary').textContent = `${mailAccountsCache.length} mail accounts`;
  } catch (e) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="9">Could not load mail accounts: ${esc(e.message)}</td></tr>`;
  }
}

function toggleMailAccountsNameSort() {
  mailAccountsNameSort = mailAccountsNameSort === 'asc' ? 'desc' : 'asc';
  document.querySelectorAll('.mail-name-sort-mark').forEach(mark => {
    mark.textContent = mailAccountsNameSort === 'asc' ? '↑' : '↓';
  });
  renderMailAccounts();
}

async function createMailAccount() {
  const username = buildMailUsername(document.getElementById('mail-username').value);
  const password = document.getElementById('mail-password').value;
  const confirmPassword = document.getElementById('mail-confirm-password').value;
  if (!username) return showToast('Username suffix is required', 'error');
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

function connectMailAccount(id) {
  const account = mailAccountsCache.find(item => item._id === id);
  if (!account) return showToast('Mail account not found', 'error');
  const existing = loadSubAccounts().find(sub => String(sub.email || '').toLowerCase() === String(account.email || '').toLowerCase());
  document.getElementById('mail-connect-id').value = id;
  document.getElementById('mail-connect-sub-id').value = existing?.id || '';
  document.getElementById('mail-connect-email').value = account.email || '';
  document.getElementById('mail-connect-start-date').value = toDateInputValue(existing?.startDate) || new Date().toISOString().slice(0, 10);
  document.getElementById('mail-connect-tel').value = existing?.tel || '';
  document.getElementById('mail-connect-name').value = existing?.name || '';
  document.getElementById('mail-connect-status').value = ['active', 'not active'].includes(existing?.status) ? existing.status : 'active';
  populateHostSelect('mail-connect-host', existing?.hostProvider, { maxSubAccounts: 3 });
  document.getElementById('mail-connect-title').textContent = existing ? 'Edit mail connection' : 'Connect mail account';
  document.getElementById('mail-connect-modal').style.display = 'flex';
}

function closeMailConnectModal() {
  document.getElementById('mail-connect-modal').style.display = 'none';
}

function saveMailAccountConnection() {
  const email = document.getElementById('mail-connect-email').value.trim();
  const hostProvider = document.getElementById('mail-connect-host').value;
  if (!email) return showToast('Mail account email is required', 'error');
  if (!hostProvider) return showToast('Choose host account', 'error');

  const subs = loadSubAccounts();
  const id = document.getElementById('mail-connect-sub-id').value || genId();
  const existing = subs.find(sub => sub.id === id) || {};
  const sub = {
    ...existing,
    id,
    email,
    tel: document.getElementById('mail-connect-tel').value.trim(),
    name: document.getElementById('mail-connect-name').value.trim(),
    hostProvider,
    status: document.getElementById('mail-connect-status').value || 'active'
  };
  sub.startDate = isNotActiveSub(sub) ? '' : document.getElementById('mail-connect-start-date').value;
  const idx = subs.findIndex(item => item.id === id);
  if (idx >= 0) subs[idx] = sub; else subs.push(sub);
  saveSubAccounts(subs);
  syncSubAccountLink(sub);
  closeMailConnectModal();
  renderAccounts();
  showToast('Mail account connected');
}

async function changeMailPassword(id) {
  const selected = mailAccountsCache.find(account => account._id === id);
  const password = prompt(`New password for ${selected?.email || 'this mailbox'}:`);
  if (password === null) return;
  if (!password || password.length < 8) return showToast('Password must be at least 8 characters', 'error');
  const confirmPassword = prompt('Confirm new password:');
  if (confirmPassword === null) return;
  if (password !== confirmPassword) return showToast('Passwords do not match', 'error');
  try {
    const res = await fetch(`/api/admin/mail/accounts/${encodeURIComponent(id)}/reset-password`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ password, confirmPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    renderMailCredentials(data);
    await renderMailAccounts();
    showToast('Mail password changed');
  } catch (e) {
    showToast('Password change error: ' + e.message, 'error');
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

async function activateMailAccount(id) {
  try {
    const res = await fetch(`/api/admin/mail/accounts/${encodeURIComponent(id)}/activate`, {
      method: 'POST',
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    await renderMailAccounts();
    showToast('Mail account activated');
  } catch (e) {
    showToast('Activate error: ' + e.message, 'error');
  }
}

async function deleteMailAccount(id) {
  const selected = mailAccountsCache.find(account => account._id === id);
  const label = selected?.email || 'this mailbox';
  if (!confirm(`Delete ${label} and all saved messages? This cannot be undone.`)) return;
  try {
    const res = await fetch(`/api/admin/mail/accounts/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    if (mailAdminSelectedAccount?._id === id) {
      mailAdminSelectedAccount = null;
      mailAdminMessagesCache = [];
      document.getElementById('mail-admin-selected').textContent = 'Selected inbox';
      document.getElementById('mail-admin-messages').innerHTML = '<div class="backup-muted">Select an account to preview messages.</div>';
    }
    await renderMailAccounts();
    showToast('Mail account deleted');
  } catch (e) {
    showToast('Delete error: ' + e.message, 'error');
  }
}

async function openMailAccount(id) {
  const selected = mailAccountsCache.find(account => account._id === id);
  mailAdminSelectedAccount = selected || null;
  document.getElementById('mail-admin-selected').textContent = selected ? selected.email : 'Selected mailbox';
  const box = document.getElementById('mail-admin-messages');
  box.innerHTML = '<div class="backup-muted">Loading messages...</div>';
  try {
    const res = await fetch(`/api/admin/mail/accounts/${encodeURIComponent(id)}/messages`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    mailAdminMessagesCache = data.messages || [];
    renderMailAdminMessages();
  } catch (e) {
    box.innerHTML = `<div class="backup-muted">Could not load messages: ${esc(e.message)}</div>`;
  }
}

function renderMailAdminMessages(activeId = '') {
  const box = document.getElementById('mail-admin-messages');
  if (!box) return;
  if (!mailAdminMessagesCache.length) {
    box.innerHTML = '<div class="backup-muted">No messages saved for this mailbox yet.</div>';
    return;
  }
  const list = mailAdminMessagesCache.map(message => `
    <button class="mail-admin-message ${message._id === activeId ? 'active' : ''}" type="button" onclick="openMailAdminMessage('${esc(message._id)}')">
      <strong>${esc(message.subject || '(no subject)')}</strong>
      <span>${esc(message.from || '')}</span>
      <small>${formatMailDate(message.receivedAt)}</small>
    </button>
  `).join('');
  const selected = activeId ? mailAdminMessagesCache.find(message => message._id === activeId) : null;
  box.innerHTML = `<div class="mail-admin-message-layout">
    <div class="mail-admin-message-list">${list}</div>
    <div class="mail-admin-message-detail">${selected ? renderMailAdminMessageDetail(selected) : '<div class="backup-muted">Open a message to read it here.</div>'}</div>
  </div>`;
}

function openMailAdminMessage(id) {
  renderMailAdminMessages(id);
}

function renderMailAdminMessageDetail(message) {
  const body = message.html || `<pre>${esc(message.text || '')}</pre>`;
  const code = message.verificationCode ? `<div class="mail-admin-code"><span>Code</span><strong>${esc(message.verificationCode)}</strong></div>` : '';
  return `${code}
    <article class="mail-admin-message-open">
      <h4>${esc(message.subject || '(no subject)')}</h4>
      <p><strong>From:</strong> ${esc(message.from || '')}</p>
      <p><strong>To:</strong> ${esc(message.to || '')}</p>
      <p>${formatMailDate(message.receivedAt)}</p>
      <div class="mail-admin-body">${body}</div>
    </article>`;
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
document.getElementById('stock-show-all')?.addEventListener('change', e => {
  showAllStockRows = e.target.checked;
  renderDashboard();
});
document.getElementById('accounts-search')?.addEventListener('input', renderAccounts);
document.getElementById('mail-accounts-search')?.addEventListener('input', renderMailAccounts);
document.getElementById('visitor-analytics-search')?.addEventListener('input', () => { visitorAnalyticsPage = 1; renderVisitorAnalytics(); });
['visitor-analytics-from','visitor-analytics-to','visitor-analytics-bots'].forEach(id => {
  document.getElementById(id)?.addEventListener('change', () => { visitorAnalyticsPage = 1; renderVisitorAnalytics(); });
});
['assistant-search','assistant-filter-focus','assistant-filter-locale','assistant-filter-reviewed','assistant-filter-from','assistant-filter-to'].forEach(id => {
  document.getElementById(id)?.addEventListener('change', () => { assistantQuestionsPage = 1; renderAssistantQuestions(); });
});
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
    <div class="stat-card"><span class="stat-label">Лет</span><span class="stat-value">${years.length}</span></div>
    <div class="stat-card profit"><span class="stat-label">Прибыль</span><span class="stat-value">${fmt(totProfit)}</span></div>
    <div class="stat-card"><span class="stat-label">Выручка</span><span class="stat-value">${fmt(totRevenue)}</span></div>
    <div class="stat-card"><span class="stat-label">Продано</span><span class="stat-value">${totQty} шт.</span></div>
    <div class="stat-card"><span class="stat-label">Маржа</span><span class="stat-value">${annualPct(totRevenue, totProfit)}</span></div>`;
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
