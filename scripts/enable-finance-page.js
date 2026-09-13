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
  if (source.includes('href="/finance"')) return source;
  const anchor = '      <button class="tab-btn admin-only" type="button" data-tab="accounts" role="menuitem">Аккаунты</button>';
  if (!source.includes(anchor)) throw new Error('Finance bootstrap: admin navigation anchor not found');
  return source.replace(anchor, `${anchor}\n      <a class="tab-btn admin-only" href="/finance" role="menuitem">Финансы</a>`);
});

patchFile('finance.html', source => {
  if (source.includes('id="expense-product-price"')) return source;
  const oldForm = `          <form id="expense-form">\n            <label>Host<select id="expense-host"></select></label>\n            <label>Тип<select id="expense-type"><option value="subscription_purchase">Subscription purchase</option><option value="other">Other</option></select></label>\n            <label>Дата<input id="expense-date" type="date" required /></label>\n            <label>Сумма, €<input id="expense-amount" type="number" min="0.01" step="0.01" value="35" required /></label>\n            <label>Документ<input id="expense-document" type="text" maxlength="80" placeholder="Receipt / order" /></label>\n            <label class="wide">Комментарий<input id="expense-note" type="text" maxlength="160" /></label>\n            <button type="submit" class="btn-primary wide">Добавить расход</button>\n          </form>`;
  const newForm = `          <form id="expense-form">\n            <label>Host<select id="expense-host"></select></label>\n            <label>Тип<select id="expense-type"><option value="subscription_purchase">Subscription purchase</option><option value="other">Other</option></select></label>\n            <label>Дата<input id="expense-date" type="date" required /></label>\n            <label>Продавец<input id="expense-seller" type="text" maxlength="100" placeholder="GGSEL / BestCode" /></label>\n            <label>Цена подписки, €<input id="expense-product-price" type="number" min="0" step="0.01" placeholder="28.76" required /></label>\n            <label>Комиссия, €<input id="expense-fee" type="number" min="0" step="0.01" value="0.00" /></label>\n            <label>Итого, €<input id="expense-amount" type="number" min="0.01" step="0.01" readonly /></label>\n            <label>Документ / заказ<input id="expense-document" type="text" maxlength="120" placeholder="Order / receipt / payment reference" /></label>\n            <label class="wide">Комментарий<input id="expense-note" type="text" maxlength="160" placeholder="Без кодов активации и паролей" /></label>\n            <button type="submit" class="btn-primary wide">Добавить расход</button>\n          </form>`;
  if (!source.includes(oldForm)) throw new Error('Finance bootstrap: expense form anchor not found');
  return source.replace(oldForm, newForm);
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

  if (!next.includes("byId('expense-product-price').addEventListener('input', updateExpenseTotal);")) {
    const bindAnchor = "    byId('expense-form').addEventListener('submit', addExpense);";
    if (!next.includes(bindAnchor)) throw new Error('Finance bootstrap: expense bind anchor not found');
    next = next.replace(bindAnchor, `${bindAnchor}\n    byId('expense-product-price').addEventListener('input', updateExpenseTotal);\n    byId('expense-fee').addEventListener('input', updateExpenseTotal);`);
  }

  return next;
});
