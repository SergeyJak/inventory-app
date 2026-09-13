(() => {
  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? '').trim();
  const SETTINGS_KEY = 'heysmart_finance_invoice_settings_v1';
  const token = localStorage.getItem('inv_token');
  let hostSubscriptions = [];
  let settings = {};

  const LOGO_JPEG = 'data:image/jpeg;base64,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';

  function toast(message, error = false) {
    const box = byId('finance-toast');
    if (!box) return;
    box.textContent = message;
    box.className = `toast${error ? ' error' : ''}`;
    box.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { box.hidden = true; }, 3000);
  }

  function ensureCustomerFields() {
    const client = byId('income-client');
    if (!client || byId('invoice-customer-first-name')) return;
    const label = client.closest('label');
    if (!label) return;
    label.insertAdjacentHTML('afterend', `
      <label>Имя клиента, опционально<input id="invoice-customer-first-name" type="text" maxlength="80" /></label>
      <label>Фамилия клиента, опционально<input id="invoice-customer-last-name" type="text" maxlength="80" /></label>
      <label>Personas kods, опционально<input id="invoice-customer-personal-code" type="text" maxlength="30" placeholder="000000-00000" /></label>
    `);
  }

  function localSettings() {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch { return {}; }
  }

  function hasSettings(v) {
    return !!(v && (v.sellerName || v.sellerIban || v.sellerBic || v.sellerAddress || v.sellerEmail || v.sellerRegNo));
  }

  function settingsFromForm() {
    return {
      sellerName: esc(byId('invoice-seller-name')?.value),
      sellerRegNo: esc(byId('invoice-seller-regno')?.value),
      sellerAddress: esc(byId('invoice-seller-address')?.value),
      sellerIban: esc(byId('invoice-seller-iban')?.value),
      sellerBic: esc(byId('invoice-seller-bic')?.value),
      sellerEmail: esc(byId('invoice-seller-email')?.value),
    };
  }

  function fillSettings(v = settings) {
    const map = {
      'invoice-seller-name': 'sellerName', 'invoice-seller-regno': 'sellerRegNo',
      'invoice-seller-address': 'sellerAddress', 'invoice-seller-iban': 'sellerIban',
      'invoice-seller-bic': 'sellerBic', 'invoice-seller-email': 'sellerEmail'
    };
    Object.entries(map).forEach(([id,key]) => { const el = byId(id); if (el) el.value = v[key] || ''; });
  }

  async function api(path, options = {}) {
    const r = await fetch(path, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type':'application/json', ...(options.headers || {}) } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    return data;
  }

  async function persistSettings(v, show = true) {
    if (!hostSubscriptions.length) throw new Error('Не найден Host для хранения настроек Finance');
    settings = { ...v };
    hostSubscriptions[0].financeInvoiceSettings = settings;
    await api('/api/save', { method:'POST', body: JSON.stringify({ key:'hostSubscriptions', data:hostSubscriptions }) });
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    if (show) toast('Реквизиты счёта сохранены');
  }

  async function loadPersistentSettings() {
    if (!token) return;
    try {
      const data = await api('/api/data');
      hostSubscriptions = Array.isArray(data.hostSubscriptions) ? data.hostSubscriptions : [];
      const db = hostSubscriptions[0]?.financeInvoiceSettings || {};
      const local = localSettings();
      if (hasSettings(db)) settings = db;
      else if (hasSettings(local) && hostSubscriptions.length) { settings = local; await persistSettings(settings, false); }
      else settings = local;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      fillSettings(settings);
    } catch (e) {
      settings = localSettings();
      fillSettings(settings);
    }
  }

  function reserveInvoiceNumber() {
    const input = byId('income-invoice');
    if (!input) return '';
    const value = esc(input.value) || esc(input.placeholder);
    input.value = value;
    return value;
  }

  function invoiceDescription() {
    const type = byId('income-type')?.value;
    return type === 'subscription' ? 'Subscription service' : type === 'setup' ? 'Smart device setup and configuration' : 'Service';
  }

  function customerLines(email) {
    const fullName = [esc(byId('invoice-customer-first-name')?.value), esc(byId('invoice-customer-last-name')?.value)].filter(Boolean).join(' ');
    const code = esc(byId('invoice-customer-personal-code')?.value);
    return [fullName, code ? `Personas kods: ${code}` : '', email].filter(Boolean);
  }

  async function generatePdf() {
    try {
      if (!hasSettings(settings)) await loadPersistentSettings();
      if (!settings.sellerName || !settings.sellerIban) { byId('invoice-settings-panel').open = true; toast('Сначала заполни имя и IBAN в реквизитах', true); return; }
      if (!window.jspdf?.jsPDF) { toast('PDF-модуль ещё не загрузился', true); return; }

      const select = byId('income-client');
      const customer = select?.options?.[select.selectedIndex]?.text?.trim() || '';
      if (!customer || customer === '-') { toast('Выбери аккаунт клиента', true); return; }
      const amount = Number(byId('income-amount')?.value);
      if (!(amount > 0)) { toast('Укажи сумму', true); return; }
      const invoiceNo = reserveInvoiceNumber();
      if (!invoiceNo) { toast('Не удалось получить номер счёта', true); return; }
      const date = byId('income-date')?.value || new Date().toISOString().slice(0,10);
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit:'mm', format:'a4' });

      doc.addImage(LOGO_JPEG, 'JPEG', 20, 12, 58, 12.4);
      doc.setFont('helvetica','bold'); doc.setFontSize(19); doc.text('INVOICE',190,20,{align:'right'});
      doc.setFontSize(11); doc.text(invoiceNo,190,27,{align:'right'});
      doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.text(`Date: ${date}`,190,34,{align:'right'});

      let y = 49;
      doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.text('Seller',20,y); doc.setFont('helvetica','normal'); y += 6;
      [settings.sellerName, settings.sellerRegNo ? `Reg. no.: ${settings.sellerRegNo}` : '', settings.sellerAddress, settings.sellerEmail].filter(Boolean).forEach(line => { doc.text(String(line),20,y); y += 5; });
      y += 5; doc.setFont('helvetica','bold'); doc.text('Customer',20,y); doc.setFont('helvetica','normal'); y += 6;
      customerLines(customer).forEach(line => { doc.text(String(line),20,y); y += 5; });

      y += 11; doc.setFillColor(245,247,250); doc.rect(20,y-7,170,10,'F');
      doc.setFont('helvetica','bold'); doc.text('Description',22,y); doc.text('Amount',165,y);
      y += 12; doc.setFont('helvetica','normal'); doc.text(invoiceDescription(),22,y); doc.text(`${amount.toFixed(2)} EUR`,165,y);
      y += 14; doc.setDrawColor(180,188,200); doc.line(120,y,190,y); y += 8;
      doc.setFont('helvetica','bold'); doc.text('Total',140,y); doc.text(`${amount.toFixed(2)} EUR`,165,y);

      y += 18; doc.setFont('helvetica','bold'); doc.text('Payment details',20,y); doc.setFont('helvetica','normal'); y += 6;
      doc.text(`IBAN: ${settings.sellerIban}`,20,y);
      if (settings.sellerBic) { y += 5; doc.text(`BIC/SWIFT: ${settings.sellerBic}`,20,y); }
      y += 5; doc.text(`Payment reference: ${invoiceNo}`,20,y);
      y += 14; doc.setFontSize(8); doc.setTextColor(90,100,115); doc.text('VAT is not charged.',20,y); doc.setTextColor(0,0,0);

      doc.save(`${invoiceNo}.pdf`);
      toast(`PDF ${invoiceNo} создан`);
    } catch (e) {
      console.error('[finance] PDF generation failed', e);
      toast(`Ошибка PDF: ${e.message || e}`, true);
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    ensureCustomerFields();
    loadPersistentSettings();
    byId('invoice-number-btn')?.addEventListener('click', reserveInvoiceNumber);
    byId('invoice-pdf-btn')?.addEventListener('click', generatePdf);
    byId('invoice-settings-form')?.addEventListener('submit', async e => { e.preventDefault(); try { await persistSettings(settingsFromForm()); } catch (err) { toast(`Не удалось сохранить реквизиты: ${err.message}`, true); } });
  });
})();