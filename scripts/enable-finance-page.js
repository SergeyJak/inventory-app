const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function patchFile(fileName, transform) {
  const filePath = path.join(ROOT, fileName);
  const current = fs.readFileSync(filePath, 'utf8');
  const next = transform(current);
  if (next !== current) {
    fs.writeFileSync(filePath, next, 'utf8');
    console.log(`[finance] patched ${fileName}`);
  }
}

patchFile('server.js', source => {
  if (source.includes("['/finance', 'finance.html']")) return source;
  const anchor = "  ['/reports', 'reports.html'],";
  if (!source.includes(anchor)) throw new Error('Finance bootstrap: server public-file anchor not found');
  return source.replace(anchor, `${anchor}\n  ['/finance', 'finance.html'],\n  ['/finance.html', 'finance.html'],\n  ['/finance.css', 'finance.css'],\n  ['/finance.js', 'finance.js'],`);
});

patchFile('index.html', source => {
  let next = source;
  if (!next.includes('href="/finance"')) {
    const anchor = '      <button class="tab-btn admin-only" type="button" data-tab="accounts" role="menuitem">Аккаунты</button>';
    if (!next.includes(anchor)) throw new Error('Finance bootstrap: admin navigation anchor not found');
    next = next.replace(anchor, `${anchor}\n      <a class="tab-btn admin-only" href="/finance" role="menuitem">Финансы</a>`);
  }
  if (!next.includes('href="/finance?view=services&focus=income"')) {
    const headerAnchor = '    <a href="/reports" class="btn-secondary" style="padding:5px 14px;font-size:0.83rem;text-decoration:none">Analytics</a>';
    if (next.includes(headerAnchor)) {
      next = next.replace(headerAnchor, `${headerAnchor}\n    <a href="/finance?view=services&focus=income" class="btn-primary admin-only" style="padding:6px 12px;font-size:0.83rem;text-decoration:none;white-space:nowrap">+ Приход / счёт</a>`);
    }
  }
  return next;
});

patchFile('finance.html', source => {
  let next = source;
  if (!next.includes('jspdf.umd.min.js')) {
    next = next.replace('<script src="/finance.js" defer></script>', '<script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js" defer></script>\n  <script src="/finance.js" defer></script>');
  }

  if (!next.includes('id="expense-product-price"')) {
    const oldForm = `          <form id="expense-form">\n            <label>Host<select id="expense-host"></select></label>\n            <label>Тип<select id="expense-type"><option value="subscription_purchase">Subscription purchase</option><option value="other">Other</option></select></label>\n            <label>Дата<input id="expense-date" type="date" required /></label>\n            <label>Сумма, €<input id="expense-amount" type="number" min="0.01" step="0.01" value="35" required /></label>\n            <label>Документ<input id="expense-document" type="text" maxlength="80" placeholder="Receipt / order" /></label>\n            <label class="wide">Комментарий<input id="expense-note" type="text" maxlength="160" /></label>\n            <button type="submit" class="btn-primary wide">Добавить расход</button>\n          </form>`;
    const newForm = `          <form id="expense-form">\n            <label>Host<select id="expense-host"></select></label>\n            <label>Тип<select id="expense-type"><option value="subscription_purchase">Subscription purchase</option><option value="other">Other</option></select></label>\n            <label>Дата<input id="expense-date" type="date" required /></label>\n            <label>Продавец<input id="expense-seller" type="text" maxlength="100" placeholder="GGSEL / BestCode" /></label>\n            <label>Цена подписки, €<input id="expense-product-price" type="number" min="0" step="0.01" placeholder="28.76" required /></label>\n            <label>Комиссия, €<input id="expense-fee" type="number" min="0" step="0.01" value="0.00" /></label>\n            <label>Итого, €<input id="expense-amount" type="number" min="0.01" step="0.01" readonly /></label>\n            <label>Документ / заказ<input id="expense-document" type="text" maxlength="120" placeholder="Order / receipt / payment reference" /></label>\n            <label class="wide">Комментарий<input id="expense-note" type="text" maxlength="160" placeholder="Без кодов активации и паролей" /></label>\n            <button type="submit" class="btn-primary wide">Добавить расход</button>\n          </form>`;
    if (!next.includes(oldForm)) throw new Error('Finance bootstrap: expense form anchor not found');
    next = next.replace(oldForm, newForm);
  }

  if (!next.includes('id="invoice-number-btn"')) {
    const invoiceAnchor = '            <label>№ счёта<input id="income-invoice" type="text" placeholder="HS-2026-001" /></label>';
    const invoiceControls = `            <label>№ счёта<input id="income-invoice" type="text" placeholder="HS-2026-001" /></label>\n            <div class="invoice-actions"><button type="button" class="btn-secondary" id="invoice-number-btn">Получить №</button><button type="button" class="btn-secondary" id="invoice-pdf-btn">PDF-счёт</button></div>`;
    if (!next.includes(invoiceAnchor)) throw new Error('Finance bootstrap: invoice field anchor not found');
    next = next.replace(invoiceAnchor, invoiceControls);
  }

  if (!next.includes('id="invoice-settings-form"')) {
    const summaryAnchor = '      <div class="summary-grid" id="services-summary"></div>';
    const settings = `${summaryAnchor}\n\n      <details class="panel invoice-settings" id="invoice-settings-panel">\n        <summary><strong>Реквизиты PDF-счёта</strong> <span>заполняются один раз</span></summary>\n        <form id="invoice-settings-form" class="invoice-settings-grid">\n          <label>Имя / наименование<input id="invoice-seller-name" type="text" maxlength="120" required /></label>\n          <label>Рег. № / personas kods<input id="invoice-seller-regno" type="text" maxlength="40" /></label>\n          <label class="wide">Адрес<input id="invoice-seller-address" type="text" maxlength="180" /></label>\n          <label>IBAN<input id="invoice-seller-iban" type="text" maxlength="40" required /></label>\n          <label>BIC / SWIFT<input id="invoice-seller-bic" type="text" maxlength="20" /></label>\n          <label>Email<input id="invoice-seller-email" type="email" maxlength="120" /></label>\n          <button type="submit" class="btn-secondary">Сохранить реквизиты</button>\n        </form>\n      </details>`;
    if (!next.includes(summaryAnchor)) throw new Error('Finance bootstrap: service summary anchor not found');
    next = next.replace(summaryAnchor, settings);
  }

  if (!next.includes('data-view="mileage"')) {
    const tabAnchor = '      <button type="button" class="finance-tab" data-view="services">Subscriptions & Setup</button>';
    next = next.replace(tabAnchor, `${tabAnchor}\n      <button type="button" class="finance-tab" data-view="mileage">Поездки / топливо</button>`);

    const closing = '    </section>\n  </main>';
    const idx = next.lastIndexOf(closing);
    if (idx < 0) throw new Error('Finance bootstrap: main closing anchor not found');
    const mileage = `    </section>\n\n    <section id="finance-mileage" class="finance-view">\n      <div class="section-head"><div><h2>Поездки / топливо</h2><p>Журнал рабочих поездок для подтверждения связи расходов с деятельностью.</p></div></div>\n      <div class="summary-grid" id="mileage-summary"></div>\n      <section class="panel form-panel">\n        <div class="panel-head"><div><h3>Добавить поездку</h3><p>Записывай маршрут и цель сразу после поездки.</p></div></div>\n        <form id="mileage-form">\n          <label>Дата<input id="mileage-date" type="date" required /></label>\n          <label>Км<input id="mileage-km" type="number" min="0.1" step="0.1" required /></label>\n          <label>Откуда<input id="mileage-from" type="text" maxlength="120" required /></label>\n          <label>Куда<input id="mileage-to" type="text" maxlength="120" required /></label>\n          <label class="wide">Цель поездки<input id="mileage-purpose" type="text" maxlength="180" placeholder="Настройка устройства у клиента" required /></label>\n          <label>Топливо / чек, €<input id="mileage-fuel" type="number" min="0" step="0.01" value="0.00" /></label>\n          <label>№ чека / документ<input id="mileage-document" type="text" maxlength="100" /></label>\n          <button type="submit" class="btn-primary wide">Добавить поездку</button>\n        </form>\n      </section>\n      <section class="panel">\n        <div class="panel-head"><div><h3>Журнал поездок</h3><p>Это журнал подтверждений. Топливо не уменьшает налоговую прибыль автоматически.</p></div></div>\n        <div class="table-wrap"><table><thead><tr><th>Дата</th><th>Маршрут</th><th>Цель</th><th>Км</th><th>Топливо</th><th>Документ</th><th></th></tr></thead><tbody id="mileage-tbody"></tbody></table></div>\n      </section>\n${closing}`;
    next = next.slice(0, idx) + mileage + next.slice(idx + closing.length);
  }

  return next;
});

patchFile('finance.js', source => {
  const oldLabel = "  function clientLabel(sub) {\n    return sub.name || sub.email || sub.tel || sub.id || 'Client';\n  }";
  const newLabel = "  function clientLabel(sub) {\n    return sub.email || sub.id || 'Client';\n  }";
  const oldOptions = "    const clients = [...state.subAccounts].sort((a,b) => clientLabel(a).localeCompare(clientLabel(b), 'ru'));\n    byId('income-client').innerHTML = clients.length\n      ? clients.map(sub => `<option value=\"${esc(sub.id)}\">${esc(clientLabel(sub))}${isCancelled(sub) ? ' [cancelled]' : ''}</option>`).join('')\n      : '<option value=\"\">Нет клиентов</option>';";
  const newOptions = "    const clients = [...state.subAccounts]\n      .filter(sub => String(sub.email || '').trim())\n      .sort((a,b) => String(a.email || '').localeCompare(String(b.email || ''), 'en'));\n    byId('income-client').innerHTML = clients.length\n      ? clients.map(sub => `<option value=\"${esc(sub.id)}\">${esc(String(sub.email || '').trim())}</option>`).join('')\n      : '<option value=\"\">Нет аккаунтов с email</option>';";

  let next = source;
  if (next.includes(oldLabel)) next = next.replace(oldLabel, newLabel);
  if (next.includes(oldOptions)) next = next.replace(oldOptions, newOptions);

  if (!next.includes('function updateExpenseTotal()')) {
    const anchor = "  async function addExpense(event) {";
    if (!next.includes(anchor)) throw new Error('Finance bootstrap: addExpense anchor not found');
    next = next.replace(anchor, `  function updateExpenseTotal() {\n    const productPrice = Math.max(0, Number(byId('expense-product-price')?.value) || 0);\n    const fee = Math.max(0, Number(byId('expense-fee')?.value) || 0);\n    const amount = productPrice + fee;\n    if (byId('expense-amount')) byId('expense-amount').value = amount ? amount.toFixed(2) : '';\n    return { productPrice, fee, amount };\n  }\n\n${anchor}`);
  }

  const oldExpenseStart = `    const amount = Number(byId('expense-amount').value);\n    const date = byId('expense-date').value;\n    if (!(amount > 0) || !validDate(date)) return toast('Проверь сумму и дату', true);\n    const expense = {\n      id: uid(),\n      type: byId('expense-type').value === 'other' ? 'other_expense' : 'subscription_purchase',\n      date,\n      amount,\n      documentNo: byId('expense-document').value.trim(),\n      note: byId('expense-note').value.trim(),\n      createdAt: new Date().toISOString(),\n    };`;
  const newExpenseStart = `    const { productPrice, fee, amount } = updateExpenseTotal();\n    const date = byId('expense-date').value;\n    if (!(amount > 0) || !validDate(date)) return toast('Проверь цену, комиссию и дату', true);\n    const expense = {\n      id: uid(),\n      type: byId('expense-type').value === 'other' ? 'other_expense' : 'subscription_purchase',\n      date,\n      productPrice,\n      fee,\n      amount,\n      seller: byId('expense-seller').value.trim(),\n      documentNo: byId('expense-document').value.trim(),\n      note: byId('expense-note').value.trim(),\n      createdAt: new Date().toISOString(),\n    };`;
  if (next.includes(oldExpenseStart)) next = next.replace(oldExpenseStart, newExpenseStart);

  const oldExpenseReset = `      byId('expense-document').value = '';\n      byId('expense-note').value = '';`;
  const newExpenseReset = `      byId('expense-seller').value = '';\n      byId('expense-product-price').value = '';\n      byId('expense-fee').value = '0.00';\n      byId('expense-amount').value = '';\n      byId('expense-document').value = '';\n      byId('expense-note').value = '';`;
  if (next.includes(oldExpenseReset)) next = next.replace(oldExpenseReset, newExpenseReset);

  const oldSearch = "    return [row.date,row.invoiceNo,row.documentNo,row.type,row.ownerLabel,row.note].join(' ').toLowerCase();";
  const newSearch = "    return [row.date,row.invoiceNo,row.documentNo,row.type,row.ownerLabel,row.seller,row.note].join(' ').toLowerCase();";
  if (next.includes(oldSearch)) next = next.replace(oldSearch, newSearch);

  const oldTypeCell = "        <td>${esc(TYPE_LABELS[row.type] || row.type || '—')}</td>";
  const newTypeCell = "        <td>${esc(TYPE_LABELS[row.type] || row.type || '—')}${row.kind === 'expense' && row.seller ? `<br><small>${esc(row.seller)}</small>` : ''}</td>";
  if (next.includes(oldTypeCell)) next = next.replace(oldTypeCell, newTypeCell);

  const oldExpenseCell = "        <td class=\"money-out\">${row.kind === 'expense' ? money(row.amount) : ''}</td>";
  const newExpenseCell = "        <td class=\"money-out\">${row.kind === 'expense' ? `${money(row.amount)}${Number.isFinite(Number(row.productPrice)) ? `<br><small>${money(row.productPrice)} + ${money(row.fee || 0)} fee</small>` : ''}` : ''}</td>";
  if (next.includes(oldExpenseCell)) next = next.replace(oldExpenseCell, newExpenseCell);

  const oldCsvHeader = "    const lines = [['Date','Number','Kind','Type','Client/Host','Income','Expense','Note'].map(csvCell).join(',')];";
  const newCsvHeader = "    const lines = [['Date','Number','Kind','Type','Client/Host','Seller','Product price','Fee','Income','Expense','Note'].map(csvCell).join(',')];";
  if (next.includes(oldCsvHeader)) next = next.replace(oldCsvHeader, newCsvHeader);

  const oldCsvRow = `      row.ownerLabel,\n      row.kind === 'income' ? Number(row.amount).toFixed(2) : '',\n      row.kind === 'expense' ? Number(row.amount).toFixed(2) : '',\n      row.note || '',`;
  const newCsvRow = `      row.ownerLabel,\n      row.seller || '',\n      row.kind === 'expense' && Number.isFinite(Number(row.productPrice)) ? Number(row.productPrice).toFixed(2) : '',\n      row.kind === 'expense' && Number.isFinite(Number(row.fee)) ? Number(row.fee).toFixed(2) : '',\n      row.kind === 'income' ? Number(row.amount).toFixed(2) : '',\n      row.kind === 'expense' ? Number(row.amount).toFixed(2) : '',\n      row.note || '',`;
  if (next.includes(oldCsvRow)) next = next.replace(oldCsvRow, newCsvRow);

  if (!next.includes('function financeStorageHost()')) {
    const anchor = '  function nextInvoiceNumber(year) {';
    const helpers = `  function financeStorageHost() {\n    return state.hostSubscriptions[0] || null;\n  }\n\n  function financeSettings() {\n    const host = financeStorageHost();\n    if (!host) return {};\n    host.financeSettings = host.financeSettings || {};\n    return host.financeSettings;\n  }\n\n  function financeTrips() {\n    const host = financeStorageHost();\n    if (!host) return [];\n    host.financeTrips = Array.isArray(host.financeTrips) ? host.financeTrips : [];\n    return host.financeTrips;\n  }\n\n  async function saveFinanceStorage() {\n    if (!financeStorageHost()) throw new Error('Нужен хотя бы один Host в Accounts');\n    await saveKey('hostSubscriptions', state.hostSubscriptions);\n  }\n\n`;
    if (!next.includes(anchor)) throw new Error('Finance bootstrap: invoice helper anchor not found');
    next = next.replace(anchor, helpers + anchor);
  }

  if (!next.includes('function reserveInvoiceNumber()')) {
    const anchor = '  function refreshSuggestedInvoice() {';
    const invoiceFns = `  function reserveInvoiceNumber() {\n    const date = byId('income-date').value || today();\n    const value = byId('income-invoice').value.trim() || nextInvoiceNumber(dateYear(date));\n    byId('income-invoice').value = value;\n    return value;\n  }\n\n  function invoiceDescription() {\n    const type = byId('income-type').value;\n    if (type === 'subscription') return 'Subscription service';\n    if (type === 'setup') return 'Smart device setup and configuration';\n    return 'Service';\n  }\n\n  function loadInvoiceSettings() {\n    const s = financeSettings();\n    const map = {\n      'invoice-seller-name': 'sellerName',\n      'invoice-seller-regno': 'sellerRegNo',\n      'invoice-seller-address': 'sellerAddress',\n      'invoice-seller-iban': 'sellerIban',\n      'invoice-seller-bic': 'sellerBic',\n      'invoice-seller-email': 'sellerEmail',\n    };\n    Object.entries(map).forEach(([id, key]) => { if (byId(id)) byId(id).value = s[key] || ''; });\n  }\n\n  async function saveInvoiceSettings(event) {\n    event.preventDefault();\n    const host = financeStorageHost();\n    if (!host) return toast('Сначала нужен хотя бы один Host в Accounts', true);\n    host.financeSettings = {\n      sellerName: byId('invoice-seller-name').value.trim(),\n      sellerRegNo: byId('invoice-seller-regno').value.trim(),\n      sellerAddress: byId('invoice-seller-address').value.trim(),\n      sellerIban: byId('invoice-seller-iban').value.trim(),\n      sellerBic: byId('invoice-seller-bic').value.trim(),\n      sellerEmail: byId('invoice-seller-email').value.trim(),\n    };\n    try { await saveFinanceStorage(); toast('Реквизиты сохранены'); }\n    catch (error) { toast(error.message, true); }\n  }\n\n  function generateInvoicePdf() {\n    const settings = financeSettings();\n    if (!settings.sellerName || !settings.sellerIban) {\n      byId('invoice-settings-panel').open = true;\n      return toast('Сначала заполни имя и IBAN в реквизитах PDF-счёта', true);\n    }\n    if (!window.jspdf?.jsPDF) return toast('PDF-модуль ещё не загрузился', true);\n    const clientId = byId('income-client').value;\n    const client = state.subAccounts.find(item => String(item.id) === String(clientId));\n    if (!client?.email) return toast('Выбери аккаунт клиента', true);\n    const amount = Number(byId('income-amount').value);\n    if (!(amount > 0)) return toast('Укажи сумму', true);\n    const invoiceNo = reserveInvoiceNumber();\n    const date = byId('income-date').value || today();\n    const { jsPDF } = window.jspdf;\n    const doc = new jsPDF({ unit: 'mm', format: 'a4' });\n    doc.setFont('helvetica', 'bold'); doc.setFontSize(19); doc.text('INVOICE', 20, 24);\n    doc.setFontSize(12); doc.text(invoiceNo, 20, 32);\n    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);\n    doc.text(`Date: ${date}`, 150, 24);\n    let y = 48;\n    doc.setFont('helvetica', 'bold'); doc.text('Seller', 20, y);\n    doc.setFont('helvetica', 'normal'); y += 6;\n    [settings.sellerName, settings.sellerRegNo ? `Reg. no.: ${settings.sellerRegNo}` : '', settings.sellerAddress, settings.sellerEmail].filter(Boolean).forEach(line => { doc.text(String(line), 20, y); y += 5; });\n    y += 5; doc.setFont('helvetica', 'bold'); doc.text('Customer', 20, y); doc.setFont('helvetica', 'normal'); y += 6; doc.text(String(client.email), 20, y);\n    y += 16;\n    doc.setFillColor(245,245,245); doc.rect(20, y - 7, 170, 10, 'F');\n    doc.setFont('helvetica', 'bold'); doc.text('Description', 22, y); doc.text('Amount', 165, y);\n    doc.setFont('helvetica', 'normal'); y += 12; doc.text(invoiceDescription(), 22, y); doc.text(`${amount.toFixed(2)} EUR`, 165, y);\n    y += 14; doc.line(120, y, 190, y); y += 8; doc.setFont('helvetica', 'bold'); doc.text('Total', 140, y); doc.text(`${amount.toFixed(2)} EUR`, 165, y);\n    y += 18; doc.setFont('helvetica', 'bold'); doc.text('Payment details', 20, y); doc.setFont('helvetica', 'normal'); y += 6; doc.text(`IBAN: ${settings.sellerIban}`, 20, y);\n    if (settings.sellerBic) { y += 5; doc.text(`BIC/SWIFT: ${settings.sellerBic}`, 20, y); }\n    y += 5; doc.text(`Payment reference: ${invoiceNo}`, 20, y);\n    y += 14; doc.setFontSize(8); doc.text('VAT is not charged unless otherwise required by the seller tax status.', 20, y);\n    doc.save(`${invoiceNo}.pdf`);\n    toast(`PDF ${invoiceNo} создан`);\n  }\n\n`;
    if (!next.includes(anchor)) throw new Error('Finance bootstrap: refresh invoice anchor not found');
    next = next.replace(anchor, invoiceFns + anchor);
  }

  if (!next.includes('function renderMileage()')) {
    const anchor = '  function bind() {';
    const mileageFns = `  function renderMileage() {\n    if (!byId('mileage-tbody')) return;\n    const trips = [...financeTrips()].sort((a,b) => String(b.date).localeCompare(String(a.date)));\n    const totalKm = trips.reduce((sum, trip) => sum + (Number(trip.km) || 0), 0);\n    const totalFuel = trips.reduce((sum, trip) => sum + (Number(trip.fuel) || 0), 0);\n    byId('mileage-summary').innerHTML = [\n      summaryCard('Рабочие поездки', String(trips.length)),\n      summaryCard('Рабочий пробег', `${totalKm.toFixed(1)} км`),\n      summaryCard('Чеки топлива', money(totalFuel), 'не списываются автоматически'),\n    ].join('');\n    byId('mileage-tbody').innerHTML = trips.length ? trips.map(trip => `<tr><td>${esc(trip.date)}</td><td>${esc(trip.from)} → ${esc(trip.to)}</td><td>${esc(trip.purpose)}</td><td>${Number(trip.km).toFixed(1)}</td><td>${money(trip.fuel || 0)}</td><td>${esc(trip.documentNo || '')}</td><td><button type=\"button\" class=\"row-delete\" data-trip-delete=\"${esc(trip.id)}\">Удалить</button></td></tr>`).join('') : '<tr class="empty-row"><td colspan="7">Поездок пока нет.</td></tr>';\n  }\n\n  async function addMileage(event) {\n    event.preventDefault();\n    const host = financeStorageHost();\n    if (!host) return toast('Сначала нужен хотя бы один Host в Accounts', true);\n    const trip = {\n      id: uid(),\n      date: byId('mileage-date').value,\n      from: byId('mileage-from').value.trim(),\n      to: byId('mileage-to').value.trim(),\n      purpose: byId('mileage-purpose').value.trim(),\n      km: Number(byId('mileage-km').value),\n      fuel: Number(byId('mileage-fuel').value) || 0,\n      documentNo: byId('mileage-document').value.trim(),\n      createdAt: new Date().toISOString(),\n    };\n    if (!trip.date || !trip.from || !trip.to || !trip.purpose || !(trip.km > 0)) return toast('Заполни дату, маршрут, цель и км', true);\n    financeTrips().push(trip);\n    try {\n      await saveFinanceStorage();\n      byId('mileage-from').value = ''; byId('mileage-to').value = ''; byId('mileage-purpose').value = ''; byId('mileage-km').value = ''; byId('mileage-fuel').value = '0.00'; byId('mileage-document').value = '';\n      renderMileage(); toast('Поездка добавлена');\n    } catch (error) { host.financeTrips = financeTrips().filter(item => item.id !== trip.id); toast(error.message, true); }\n  }\n\n  async function deleteMileage(id) {\n    const host = financeStorageHost();\n    if (!host || !confirm('Удалить поездку?')) return;\n    host.financeTrips = financeTrips().filter(item => item.id !== id);\n    try { await saveFinanceStorage(); renderMileage(); toast('Поездка удалена'); }\n    catch (error) { toast(error.message, true); await loadData(); }\n  }\n\n`;
    if (!next.includes(anchor)) throw new Error('Finance bootstrap: bind anchor not found');
    next = next.replace(anchor, mileageFns + anchor);
  }

  if (!next.includes("byId('expense-product-price').addEventListener('input', updateExpenseTotal);")) {
    const bindAnchor = "    byId('expense-form').addEventListener('submit', addExpense);";
    if (!next.includes(bindAnchor)) throw new Error('Finance bootstrap: expense bind anchor not found');
    next = next.replace(bindAnchor, `${bindAnchor}\n    byId('expense-product-price').addEventListener('input', updateExpenseTotal);\n    byId('expense-fee').addEventListener('input', updateExpenseTotal);`);
  }

  if (!next.includes("byId('invoice-number-btn').addEventListener('click', reserveInvoiceNumber);")) {
    const bindAnchor = "    byId('export-csv').addEventListener('click', exportCsv);";
    const bindings = `${bindAnchor}\n    byId('invoice-number-btn').addEventListener('click', reserveInvoiceNumber);\n    byId('invoice-pdf-btn').addEventListener('click', generateInvoicePdf);\n    byId('invoice-settings-form').addEventListener('submit', saveInvoiceSettings);\n    byId('mileage-form').addEventListener('submit', addMileage);\n    byId('mileage-tbody').addEventListener('click', event => { const button = event.target.closest('[data-trip-delete]'); if (button) deleteMileage(button.dataset.tripDelete); });`;
    if (!next.includes(bindAnchor)) throw new Error('Finance bootstrap: export bind anchor not found');
    next = next.replace(bindAnchor, bindings);
  }

  if (!next.includes("const params = new URLSearchParams(location.search);")) {
    const bindEnd = "    byId('export-csv').addEventListener('click', exportCsv);";
    const queryLogic = `\n    const params = new URLSearchParams(location.search);\n    const view = params.get('view');\n    if (view && ['hardware','services','mileage'].includes(view)) {\n      const target = document.querySelector('.finance-tab[data-view="' + view + '"]');\n      target?.click();\n    }\n    if (params.get('focus') === 'income') setTimeout(() => byId('income-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);`;
    const firstIdx = next.indexOf(bindEnd);
    if (firstIdx >= 0) next = next.slice(0, firstIdx + bindEnd.length) + queryLogic + next.slice(firstIdx + bindEnd.length);
  }

  const loadAnchor = `      renderServices();\n      refreshSuggestedInvoice();`;
  if (next.includes(loadAnchor) && !next.includes(`      loadInvoiceSettings();\n      renderMileage();\n      refreshSuggestedInvoice();`)) {
    next = next.replace(loadAnchor, `      renderServices();\n      loadInvoiceSettings();\n      renderMileage();\n      refreshSuggestedInvoice();`);
  }

  const todayAnchor = `  byId('income-date').value = today();\n  byId('expense-date').value = today();`;
  if (next.includes(todayAnchor) && !next.includes("byId('mileage-date').value = today();")) {
    next = next.replace(todayAnchor, `${todayAnchor}\n  byId('mileage-date').value = today();`);
  }

  return next;
});

patchFile('finance.css', source => {
  if (source.includes('.invoice-settings-grid')) return source;
  return source + `\n.invoice-actions{display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap}.invoice-actions button{min-height:42px}.invoice-settings summary{cursor:pointer;color:#0f172a}.invoice-settings summary span{color:#94a3b8;font-size:.82rem;font-weight:500;margin-left:6px}.invoice-settings-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px}.invoice-settings-grid label{display:flex;flex-direction:column;gap:6px;color:#475569;font-size:.82rem;font-weight:800}.invoice-settings-grid input{min-height:42px;border:1px solid #cbd5e1;border-radius:10px;padding:9px 10px}.invoice-settings-grid .wide{grid-column:1/-1}@media(max-width:560px){.invoice-settings-grid{grid-template-columns:1fr}.invoice-settings-grid .wide{grid-column:auto}.invoice-actions{grid-column:1/-1}}\n`;
});
