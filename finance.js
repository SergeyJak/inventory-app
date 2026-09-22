(() => {
  const token = localStorage.getItem('inv_token');
  const role = localStorage.getItem('inv_role');
  const username = localStorage.getItem('inv_username');
  const PAGE_SIZE = 25;
  const initialParams = new URLSearchParams(location.search);
  const initialHistoryView = initialParams.get('history') === 'ledger' ? 'ledger' : 'invoices';

  if (!token) {
    location.href = '/login.html';
    return;
  }
  if (role !== 'admin') {
    location.href = '/';
    return;
  }

  const state = {
    products: [],
    transactions: [],
    subAccounts: [],
    hostSubscriptions: [],
    financeIncome: [],
    financeExpenses: [],
    financeInvoices: [],
    hardwareYear: new Date().getFullYear(),
    servicesYear: new Date().getFullYear(),
    invoicePage: 1,
    ledgerPage: 1,
    historyView: initialHistoryView,
  };

  const MONTHS = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
  const TYPE_LABELS = {
    subscription: 'Subscription',
    setup: 'Setup',
    setup_subscription: 'Setup + Subscription',
    other: 'Other income',
    subscription_purchase: 'Subscription purchase',
    other_expense: 'Other expense',
  };

  const byId = id => document.getElementById(id);
  const money = value => `${(Number(value) || 0).toFixed(2)} €`;
  const today = () => new Date().toISOString().slice(0, 10);
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const esc = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  function authHeaders() {
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }

  function toast(message, error = false) {
    const box = byId('finance-toast');
    box.textContent = message;
    box.className = `toast${error ? ' error' : ''}`;
    box.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { box.hidden = true; }, 2600);
  }

  async function api(path, options = {}) {
    const res = await fetch(path, { ...options, headers: { ...authHeaders(), ...(options.headers || {}) } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  async function saveKey(key, data) {
    await api('/api/save', { method: 'POST', body: JSON.stringify({ key, data }) });
  }

  function validDate(value) {
    const date = new Date(`${String(value || '').slice(0,10)}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function dateYear(value) {
    return validDate(value)?.getFullYear() || 0;
  }

  function dateMonth(value) {
    return validDate(value)?.getMonth() ?? -1;
  }

  function clientLabel(sub) {
    return sub.name || sub.email || sub.tel || sub.id || 'Client';
  }

  function invoiceClientLabel(sub) {
    return sub.email || sub.name || sub.tel || sub.id || 'Client';
  }

  function hostLabel(host) {
    return host.hostMail || host.email || host.id || 'Host';
  }

  function isCancelled(sub) {
    return ['cancelled','canceled','annulled','off'].includes(String(sub.status || '').toLowerCase());
  }

  function allIncomeRows() {
    return state.financeIncome.map(payment => {
      const sub = state.subAccounts.find(item => String(item.id) === String(payment.ownerId));
      return {
        ...payment,
        kind: 'income',
        ownerLabel: sub ? clientLabel(sub) : (payment.ownerNameSnapshot || payment.ownerEmailSnapshot || payment.ownerId || 'Client'),
      };
    });
  }

  function allExpenseRows() {
    return state.financeExpenses.map(expense => {
      const host = state.hostSubscriptions.find(item => String(item.id) === String(expense.ownerId));
      return {
        ...expense,
        kind: 'expense',
        ownerLabel: host ? hostLabel(host) : (expense.ownerNameSnapshot || expense.ownerEmailSnapshot || expense.ownerId || 'Host'),
      };
    });
  }

  function serviceRows(year = state.servicesYear) {
    return [...allIncomeRows(), ...allExpenseRows()]
      .filter(row => year == null || dateYear(row.date) === Number(year))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }

  function availableYears() {
    const years = new Set([new Date().getFullYear()]);
    state.transactions.forEach(tx => { const y = dateYear(tx.date); if (y) years.add(y); });
    [...allIncomeRows(), ...allExpenseRows()].forEach(row => { const y = dateYear(row.date); if (y) years.add(y); });
    return [...years].sort((a,b) => b-a);
  }

  function renderYearSelects() {
    const years = availableYears();
    for (const [id, selected] of [['hardware-year', state.hardwareYear], ['services-year', state.servicesYear]]) {
      const select = byId(id);
      select.innerHTML = years.map(year => `<option value="${year}">${year}</option>`).join('');
      select.value = String(years.includes(Number(selected)) ? selected : years[0]);
    }
  }

  function summaryCard(label, value, note = '', cls = '') {
    return `<article class="summary-card ${cls}"><span>${esc(label)}</span><strong>${esc(value)}</strong>${note ? `<small>${esc(note)}</small>` : ''}</article>`;
  }

  function renderHardware() {
    const year = Number(state.hardwareYear);
    const sales = state.transactions.filter(tx => tx.type === 'sale' && dateYear(tx.date) === year);
    const totals = sales.reduce((sum, tx) => {
      sum.qty += Number(tx.qty) || 0;
      sum.revenue += Number(tx.total) || 0;
      sum.cost += Number(tx.costTotal) || 0;
      sum.profit += Number(tx.profit) || 0;
      return sum;
    }, { qty: 0, revenue: 0, cost: 0, profit: 0 });
    const margin = totals.revenue ? totals.profit / totals.revenue * 100 : 0;
    byId('hardware-summary').innerHTML = [
      summaryCard('Выручка', money(totals.revenue)),
      summaryCard('Себестоимость', money(totals.cost)),
      summaryCard('Прибыль', money(totals.profit), `${margin.toFixed(1)}% margin`, totals.profit >= 0 ? 'positive' : 'negative'),
      summaryCard('Продано', String(totals.qty), 'шт.'),
      summaryCard('Бухгалтерия', 'Колонки', 'Отдельно от services'),
    ].join('');

    const months = Array.from({ length: 12 }, () => ({ qty: 0, revenue: 0, cost: 0, profit: 0 }));
    sales.forEach(tx => {
      const month = dateMonth(tx.date);
      if (month < 0) return;
      months[month].qty += Number(tx.qty) || 0;
      months[month].revenue += Number(tx.total) || 0;
      months[month].cost += Number(tx.costTotal) || 0;
      months[month].profit += Number(tx.profit) || 0;
    });
    byId('hardware-tbody').innerHTML = months.map((m, index) => `<tr><td>${MONTHS[index]}</td><td>${m.qty}</td><td>${money(m.revenue)}</td><td>${money(m.cost)}</td><td class="${m.profit >= 0 ? 'money-in' : 'money-out'}">${money(m.profit)}</td></tr>`).join('');
  }

  function serviceTotals(year) {
    const rows = serviceRows(year);
    const incomes = rows.filter(row => row.kind === 'income');
    const expenses = rows.filter(row => row.kind === 'expense');
    const subscription = incomes.filter(row => row.type === 'subscription').reduce((s,row) => s + (Number(row.amount) || 0), 0);
    const setup = incomes.filter(row => row.type === 'setup').reduce((s,row) => s + (Number(row.amount) || 0), 0);
    const otherIncome = incomes.filter(row => !['subscription','setup'].includes(row.type)).reduce((s,row) => s + (Number(row.amount) || 0), 0);
    const revenue = subscription + setup + otherIncome;
    const expense = expenses.reduce((s,row) => s + (Number(row.amount) || 0), 0);
    const profit = revenue - expense;
    const monthlyProfit = Array.from({ length: 12 }, (_, month) => {
      const monthRows = rows.filter(row => dateMonth(row.date) === month);
      return monthRows.reduce((sum, row) => sum + (row.kind === 'income' ? Number(row.amount) || 0 : -(Number(row.amount) || 0)), 0);
    });
    const underThreshold = monthlyProfit.every(value => value < 780);
    const pensionEstimate = underThreshold ? monthlyProfit.reduce((sum, value) => sum + Math.max(0, value) * 0.10, 0) : null;
    return { rows, incomes, expenses, subscription, setup, revenue, expense, profit, pensionEstimate, underThreshold };
  }

  function renderServices() {
    const totals = serviceTotals(state.servicesYear);
    const activeClients = state.subAccounts.filter(sub => !isCancelled(sub)).length;
    byId('services-summary').innerHTML = [
      summaryCard('Subscription income', money(totals.subscription), `${totals.incomes.filter(r => r.type === 'subscription').length} оплат`),
      summaryCard('Setup income', money(totals.setup), `${totals.incomes.filter(r => r.type === 'setup').length} настроек`),
      summaryCard('Расходы', money(totals.expense), `${totals.expenses.length} операций`, 'negative'),
      summaryCard('Прибыль', money(totals.profit), `${activeClients} клиентов в Accounts`, totals.profit >= 0 ? 'positive' : 'negative'),
      totals.underThreshold
        ? summaryCard('VSAOI 10% estimate', money(totals.pensionEstimate), 'если каждый месяц прибыль < 780 €')
        : summaryCard('VSAOI', 'Нужен расчёт', 'есть месяц с прибылью ≥ 780 €'),
    ].join('');
    renderLedger();
  }

  function renderClientOptions() {
    const clients = [...state.subAccounts].sort((a,b) => invoiceClientLabel(a).localeCompare(invoiceClientLabel(b), 'ru'));
    byId('income-client').innerHTML = clients.length
      ? clients.map(sub => `<option value="${esc(sub.id)}" data-email="${esc(sub.email || '')}">${esc(invoiceClientLabel(sub))}${isCancelled(sub) ? ' [cancelled]' : ''}</option>`).join('')
      : '<option value="">Нет клиентов</option>';
    const hosts = [...state.hostSubscriptions].sort((a,b) => hostLabel(a).localeCompare(hostLabel(b), 'ru'));
    byId('expense-host').innerHTML = '<option value="">Без привязки</option>' + hosts.map(host => `<option value="${esc(host.id)}">${esc(hostLabel(host))}</option>`).join('');
  }

  function invoiceStatusLabel(status) {
    if (status === 'CONFIRMED') return 'CONFIRMED';
    if (status === 'VOID') return 'VOID';
    return 'DRAFT';
  }

  function invoiceCustomerLabel(invoice) {
    const fullName = [invoice.customerFirstName, invoice.customerLastName].filter(Boolean).join(' ');
    return fullName || invoice.customerEmailSnapshot || invoice.customerAccountNameSnapshot || invoice.ownerId || 'Client';
  }

  function invoiceRows(year = null) {
    const from = byId('invoice-date-from')?.value || '';
    const to = byId('invoice-date-to')?.value || '';
    const number = (byId('invoice-number-filter')?.value || '').trim().toLowerCase();
    const statusFilter = byId('invoice-status-filter')?.value || 'all';
    return state.financeInvoices
      .filter(invoice => year == null || dateYear(invoice.date) === Number(year))
      .filter(invoice => !from || String(invoice.date || '') >= from)
      .filter(invoice => !to || String(invoice.date || '') <= to)
      .filter(invoice => !number || String(invoice.invoiceNo || '').toLowerCase().includes(number))
      .filter(invoice => statusFilter === 'all' || invoiceStatusLabel(invoice.status) === statusFilter)
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }

  function renderInvoices() {
    const rows = invoiceRows();
    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    state.invoicePage = Math.min(Math.max(1, state.invoicePage), totalPages);
    const start = (state.invoicePage - 1) * PAGE_SIZE;
    const visibleRows = rows.slice(start, start + PAGE_SIZE);
    const caption = byId('invoice-list-caption');
    if (caption) caption.textContent = `${rows.length} счетов. DRAFT не входит в бухгалтерию до Confirm.`;
    const info = byId('invoice-page-info');
    if (info) info.textContent = `Страница ${state.invoicePage} из ${totalPages} · по ${PAGE_SIZE}`;
    const prev = byId('invoice-prev');
    const next = byId('invoice-next');
    if (prev) prev.disabled = state.invoicePage <= 1;
    if (next) next.disabled = state.invoicePage >= totalPages;

    const tbody = byId('invoice-tbody');
    if (!tbody) return;
    tbody.innerHTML = visibleRows.length ? visibleRows.map(invoice => {
      const status = invoiceStatusLabel(invoice.status);
      const draftActions = status === 'DRAFT'
        ? `<button type="button" class="invoice-action confirm" data-invoice-action="confirm" data-invoice-id="${esc(invoice.id)}">Confirm</button>
           <button type="button" class="invoice-action decline" data-invoice-action="decline" data-invoice-id="${esc(invoice.id)}">Decline</button>`
        : '';
      return `<tr>
        <td>${esc(invoice.date || '')}</td>
        <td>${esc(invoice.invoiceNo || '')}</td>
        <td>${esc(invoiceCustomerLabel(invoice))}</td>
        <td class="money-in">${money(invoice.amount)}</td>
        <td><span class="invoice-status ${status.toLowerCase()}">${status}</span></td>
        <td class="invoice-actions">
          ${draftActions}
          <button type="button" class="invoice-action pdf" data-invoice-action="pdf" data-invoice-id="${esc(invoice.id)}">PDF</button>
        </td>
      </tr>`;
    }).join('') : '<tr class="empty-row"><td colspan="6">По фильтрам счетов нет.</td></tr>';
  }

  async function issueInvoice(event) {
    event.preventDefault();
    const clientId = byId('income-client').value;
    const sub = state.subAccounts.find(item => String(item.id) === String(clientId));
    if (!sub) return toast('Выбери клиента', true);
    const amount = Number(byId('income-amount').value);
    const date = byId('income-date').value;
    if (!(amount > 0) || !validDate(date)) return toast('Проверь сумму и дату', true);

    try {
      const result = await api('/api/finance/invoices/draft', {
        method: 'POST',
        body: JSON.stringify({
          ownerId: sub.id,
          type: byId('income-type').value,
          date,
          amount,
          note: byId('income-note').value.trim(),
          customerFirstName: byId('invoice-customer-first-name')?.value?.trim() || '',
          customerLastName: byId('invoice-customer-last-name')?.value?.trim() || '',
          customerPersonalCode: byId('invoice-customer-personal-code')?.value?.trim() || '',
        }),
      });
      byId('income-note').value = '';
      await loadData();
      toast(`Счёт ${result.invoice.invoiceNo} создан как DRAFT`);
      if (typeof window.generateFinanceInvoicePdf === 'function') {
        await window.generateFinanceInvoicePdf(result.invoice);
      }
    } catch (error) {
      toast(error.message, true);
      await loadData();
    }
  }

  async function invoiceAction(button) {
    const id = button.dataset.invoiceId;
    const action = button.dataset.invoiceAction;
    const invoice = state.financeInvoices.find(item => String(item.id) === String(id));
    if (!invoice) return;

    if (action === 'pdf') {
      if (typeof window.generateFinanceInvoicePdf !== 'function') return toast('PDF-модуль не готов', true);
      await window.generateFinanceInvoicePdf(invoice);
      return;
    }

    if (action === 'confirm') {
      if (!confirm(`Подтвердить оплату по ${invoice.invoiceNo} и добавить ${money(invoice.amount)} в бухгалтерию?`)) return;
      try {
        await api(`/api/finance/invoices/${encodeURIComponent(id)}/confirm`, { method: 'POST' });
        await loadData();
        toast(`${invoice.invoiceNo} подтверждён и добавлен в бухгалтерию`);
      } catch (error) {
        toast(error.message, true);
        await loadData();
      }
      return;
    }

    if (action === 'decline') {
      if (!confirm(`Аннулировать ${invoice.invoiceNo}? Номер останется занятым.`)) return;
      try {
        await api(`/api/finance/invoices/${encodeURIComponent(id)}/decline`, { method: 'POST' });
        await loadData();
        toast(`${invoice.invoiceNo} аннулирован`);
      } catch (error) {
        toast(error.message, true);
        await loadData();
      }
    }
  }

  async function addExpense(event) {
    event.preventDefault();
    const hostId = byId('expense-host').value;
    let host = state.hostSubscriptions.find(item => String(item.id) === String(hostId));
    if (!host) {
      host = state.hostSubscriptions[0];
      if (!host) return toast('Сначала нужен хотя бы один Host в Accounts', true);
    }
    const amount = Number(byId('expense-amount').value);
    const date = byId('expense-date').value;
    if (!(amount > 0) || !validDate(date)) return toast('Проверь сумму и дату', true);
    const expense = {
      id: uid(),
      type: byId('expense-type').value === 'other' ? 'other_expense' : 'subscription_purchase',
      date,
      amount,
      documentNo: byId('expense-document').value.trim(),
      note: byId('expense-note').value.trim(),
      createdAt: new Date().toISOString(),
    };
    try {
      await api('/api/finance/expense', {
        method: 'POST',
        body: JSON.stringify({ ownerId: host.id, expense }),
      });
      byId('expense-document').value = '';
      byId('expense-note').value = '';
      await loadData();
      toast(`Расход ${money(amount)} добавлен`);
    } catch (error) {
      toast(error.message, true);
      await loadData();
    }
  }

  function filteredLedgerRows() {
    const kind = byId('ledger-kind')?.value || 'all';
    const from = byId('ledger-date-from')?.value || '';
    const to = byId('ledger-date-to')?.value || '';
    const number = (byId('ledger-number-filter')?.value || '').trim().toLowerCase();
    return serviceRows(null)
      .filter(row => kind === 'all' || row.kind === kind)
      .filter(row => !from || String(row.date || '') >= from)
      .filter(row => !to || String(row.date || '') <= to)
      .filter(row => {
        if (!number) return true;
        const value = row.kind === 'income' ? row.invoiceNo : row.documentNo;
        return String(value || '').toLowerCase().includes(number);
      });
  }

  function renderLedger() {
    const rows = filteredLedgerRows();
    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    state.ledgerPage = Math.min(Math.max(1, state.ledgerPage), totalPages);
    const start = (state.ledgerPage - 1) * PAGE_SIZE;
    const visibleRows = rows.slice(start, start + PAGE_SIZE);
    const caption = byId('ledger-caption');
    if (caption) caption.textContent = `${rows.length} операций`;
    const info = byId('ledger-page-info');
    if (info) info.textContent = `Страница ${state.ledgerPage} из ${totalPages} · по ${PAGE_SIZE}`;
    const prev = byId('ledger-prev');
    const next = byId('ledger-next');
    if (prev) prev.disabled = state.ledgerPage <= 1;
    if (next) next.disabled = state.ledgerPage >= totalPages;

    const tbody = byId('ledger-tbody');
    if (!tbody) return;
    tbody.innerHTML = visibleRows.length ? visibleRows.map(row => {
      const number = row.kind === 'income' ? row.invoiceNo : row.documentNo;
      return `<tr>
        <td>${esc(row.date || '')}</td>
        <td>${esc(number || '—')}</td>
        <td>${esc(TYPE_LABELS[row.type] || row.type || '—')}</td>
        <td>${esc(row.ownerLabel)}</td>
        <td class="money-in">${row.kind === 'income' ? money(row.amount) : ''}</td>
        <td class="money-out">${row.kind === 'expense' ? money(row.amount) : ''}</td>
        <td>${esc(row.note || '')}</td>
        <td><button type="button" class="row-delete" data-delete-id="${esc(row.id)}" data-delete-kind="${row.kind}" data-owner-id="${esc(row.ownerId)}">Удалить</button></td>
      </tr>`;
    }).join('') : '<tr class="empty-row"><td colspan="8">По фильтрам операций нет.</td></tr>';
  }

  async function deleteRow(button) {
    const { deleteId: id, deleteKind: kind, ownerId } = button.dataset;
    if (!confirm('Удалить эту финансовую операцию?')) return;
    try {
      const path = kind === 'income'
        ? `/api/finance/income/${encodeURIComponent(ownerId)}/${encodeURIComponent(id)}`
        : `/api/finance/expense/${encodeURIComponent(ownerId)}/${encodeURIComponent(id)}`;
      await api(path, { method: 'DELETE' });
      await loadData();
      toast('Операция удалена');
    } catch (error) {
      toast(error.message, true);
      await loadData();
    }
  }

  function csvCell(value) {
    return `"${String(value ?? '').replace(/"/g,'""')}"`;
  }

  function exportCsv(filtered = false) {
    const rows = filtered ? filteredLedgerRows() : serviceRows();
    const lines = [['Date','Number','Kind','Type','Client/Host','Income','Expense','Note'].map(csvCell).join(',')];
    rows.forEach(row => lines.push([
      row.date,
      row.invoiceNo || row.documentNo || '',
      row.kind,
      TYPE_LABELS[row.type] || row.type || '',
      row.ownerLabel,
      row.kind === 'income' ? Number(row.amount).toFixed(2) : '',
      row.kind === 'expense' ? Number(row.amount).toFixed(2) : '',
      row.note || '',
    ].map(csvCell).join(',')));
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `heysmart-services-${state.servicesYear}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function bind() {
    byId('finance-user').textContent = username ? `${username} · admin` : 'admin';
    byId('finance-logout').addEventListener('click', () => {
      localStorage.removeItem('inv_token');
      localStorage.removeItem('inv_role');
      localStorage.removeItem('inv_username');
      location.href = '/login.html';
    });
    document.querySelectorAll('.finance-tab').forEach(button => button.addEventListener('click', () => {
      document.querySelectorAll('.finance-tab').forEach(item => item.classList.toggle('active', item === button));
      document.querySelectorAll('.finance-view').forEach(view => view.classList.toggle('active', view.id === `finance-${button.dataset.view}`));
      const params = new URLSearchParams(location.search);
      if (button.dataset.view === 'services') params.set('view', 'services');
      else params.delete('view');
      history.replaceState(null, '', `${location.pathname}${params.toString() ? `?${params}` : ''}`);
    }));
    document.querySelectorAll('.history-tab').forEach(button => button.addEventListener('click', () => {
      setHistoryView(button.dataset.history, true);
    }));
    byId('hardware-year').addEventListener('change', event => { state.hardwareYear = Number(event.target.value); renderHardware(); });
    byId('services-year').addEventListener('change', event => { state.servicesYear = Number(event.target.value); renderServices(); });
    byId('income-type').addEventListener('change', event => {
      if (event.target.value === 'subscription') byId('income-amount').value = '35';
      if (event.target.value === 'setup') byId('income-amount').value = '25';
    });
    byId('income-form').addEventListener('submit', issueInvoice);
    byId('expense-form').addEventListener('submit', addExpense);
    const resetInvoicePage = () => { state.invoicePage = 1; renderInvoices(); };
    const resetLedgerPage = () => { state.ledgerPage = 1; renderLedger(); };
    ['invoice-date-from','invoice-date-to','invoice-number-filter','invoice-status-filter'].forEach(id => {
      byId(id)?.addEventListener(id.includes('number') ? 'input' : 'change', resetInvoicePage);
    });
    byId('invoice-filter-reset')?.addEventListener('click', () => {
      ['invoice-date-from','invoice-date-to','invoice-number-filter'].forEach(id => { if (byId(id)) byId(id).value = ''; });
      if (byId('invoice-status-filter')) byId('invoice-status-filter').value = 'all';
      resetInvoicePage();
    });
    byId('invoice-prev')?.addEventListener('click', () => { if (state.invoicePage > 1) { state.invoicePage -= 1; renderInvoices(); } });
    byId('invoice-next')?.addEventListener('click', () => { state.invoicePage += 1; renderInvoices(); });

    ['ledger-date-from','ledger-date-to','ledger-number-filter','ledger-kind'].forEach(id => {
      byId(id)?.addEventListener(id.includes('number') ? 'input' : 'change', resetLedgerPage);
    });
    byId('ledger-filter-reset')?.addEventListener('click', () => {
      ['ledger-date-from','ledger-date-to','ledger-number-filter'].forEach(id => { if (byId(id)) byId(id).value = ''; });
      if (byId('ledger-kind')) byId('ledger-kind').value = 'all';
      resetLedgerPage();
    });
    byId('ledger-prev')?.addEventListener('click', () => { if (state.ledgerPage > 1) { state.ledgerPage -= 1; renderLedger(); } });
    byId('ledger-next')?.addEventListener('click', () => { state.ledgerPage += 1; renderLedger(); });

    byId('ledger-tbody')?.addEventListener('click', event => {
      const button = event.target.closest('[data-delete-id]');
      if (button) deleteRow(button);
    });
    byId('invoice-tbody')?.addEventListener('click', event => {
      const button = event.target.closest('[data-invoice-action]');
      if (button) invoiceAction(button);
    });
    byId('export-csv')?.addEventListener('click', () => exportCsv(false));
    byId('export-csv-history')?.addEventListener('click', () => exportCsv(true));
  }

  function setHistoryView(view, updateUrl = false) {
    const next = view === 'ledger' ? 'ledger' : 'invoices';
    state.historyView = next;
    document.querySelectorAll('.history-tab').forEach(button => {
      button.classList.toggle('active', button.dataset.history === next);
    });
    document.querySelectorAll('.history-view').forEach(section => {
      section.classList.toggle('active', section.id === `history-${next}`);
    });
    if (updateUrl) {
      const params = new URLSearchParams(location.search);
      params.set('view', 'services');
      params.set('history', next);
      history.replaceState(null, '', `${location.pathname}?${params}`);
    }
  }

  function applyInitialView() {
    const params = new URLSearchParams(location.search);
    const servicesActive = params.get('view') === 'services' || params.has('history');
    if (servicesActive) {
      document.querySelectorAll('.finance-tab').forEach(button => {
        button.classList.toggle('active', button.dataset.view === 'services');
      });
      document.querySelectorAll('.finance-view').forEach(view => {
        view.classList.toggle('active', view.id === 'finance-services');
      });
    }
    setHistoryView(state.historyView, false);
  }

  async function loadData() {
    try {
      const [data, ledger] = await Promise.all([
        api('/api/data'),
        api('/api/finance/ledger'),
      ]);
      state.products = data.products || [];
      state.transactions = data.transactions || [];
      state.subAccounts = data.subAccounts || [];
      state.hostSubscriptions = data.hostSubscriptions || [];
      state.financeIncome = ledger.income || [];
      state.financeExpenses = ledger.expenses || [];
      state.financeInvoices = ledger.invoices || [];
      renderClientOptions();
      renderYearSelects();
      state.hardwareYear = Number(byId('hardware-year').value);
      state.servicesYear = Number(byId('services-year').value);
      renderHardware();
      renderServices();
      renderInvoices();
      applyInitialView();
    } catch (error) {
      toast(`Не удалось загрузить Finance: ${error.message}`, true);
    }
  }

  byId('income-date').value = today();
  byId('expense-date').value = today();
  bind();
  applyInitialView();
  loadData();
})();
