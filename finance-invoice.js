(() => {
  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? '').trim();
  const SETTINGS_KEY = 'heysmart_finance_invoice_settings_v1';

  function toast(message, error = false) {
    const box = byId('finance-toast');
    if (!box) return;
    box.textContent = message;
    box.className = `toast${error ? ' error' : ''}`;
    box.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { box.hidden = true; }, 2600);
  }

  function loadSettings() {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); }
    catch { return {}; }
  }

  function saveSettings(event) {
    event.preventDefault();
    const settings = {
      sellerName: esc(byId('invoice-seller-name')?.value),
      sellerRegNo: esc(byId('invoice-seller-regno')?.value),
      sellerAddress: esc(byId('invoice-seller-address')?.value),
      sellerIban: esc(byId('invoice-seller-iban')?.value),
      sellerBic: esc(byId('invoice-seller-bic')?.value),
      sellerEmail: esc(byId('invoice-seller-email')?.value),
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    toast('Реквизиты счёта сохранены');
  }

  function fillSettings() {
    const settings = loadSettings();
    const map = {
      'invoice-seller-name': 'sellerName',
      'invoice-seller-regno': 'sellerRegNo',
      'invoice-seller-address': 'sellerAddress',
      'invoice-seller-iban': 'sellerIban',
      'invoice-seller-bic': 'sellerBic',
      'invoice-seller-email': 'sellerEmail',
    };
    for (const [id, key] of Object.entries(map)) {
      const el = byId(id);
      if (el) el.value = settings[key] || '';
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
    if (type === 'subscription') return 'Subscription service';
    if (type === 'setup') return 'Smart device setup and configuration';
    return 'Service';
  }

  function generatePdf() {
    const settings = loadSettings();
    if (!settings.sellerName || !settings.sellerIban) {
      const panel = byId('invoice-settings-panel');
      if (panel) panel.open = true;
      toast('Сначала заполни имя и IBAN в реквизитах', true);
      return;
    }
    if (!window.jspdf?.jsPDF) {
      toast('PDF-модуль ещё не загрузился', true);
      return;
    }

    const clientSelect = byId('income-client');
    const customer = clientSelect?.options?.[clientSelect.selectedIndex]?.text?.trim() || '';
    if (!customer || customer === '-') {
      toast('Выбери аккаунт клиента', true);
      return;
    }

    const amount = Number(byId('income-amount')?.value);
    if (!(amount > 0)) {
      toast('Укажи сумму', true);
      return;
    }

    const invoiceNo = reserveInvoiceNumber();
    if (!invoiceNo) {
      toast('Не удалось получить номер счёта', true);
      return;
    }

    const date = byId('income-date')?.value || new Date().toISOString().slice(0, 10);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('INVOICE', 20, 24);
    doc.setFontSize(12);
    doc.text(invoiceNo, 20, 32);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Date: ${date}`, 150, 24);

    let y = 48;
    doc.setFont('helvetica', 'bold');
    doc.text('Seller', 20, y);
    doc.setFont('helvetica', 'normal');
    y += 6;
    const sellerLines = [
      settings.sellerName,
      settings.sellerRegNo ? `Reg. no.: ${settings.sellerRegNo}` : '',
      settings.sellerAddress,
      settings.sellerEmail,
    ].filter(Boolean);
    sellerLines.forEach(line => { doc.text(String(line), 20, y); y += 5; });

    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.text('Customer', 20, y);
    doc.setFont('helvetica', 'normal');
    y += 6;
    doc.text(customer, 20, y);

    y += 16;
    doc.setFillColor(245, 245, 245);
    doc.rect(20, y - 7, 170, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('Description', 22, y);
    doc.text('Amount', 165, y);

    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.text(invoiceDescription(), 22, y);
    doc.text(`${amount.toFixed(2)} EUR`, 165, y);

    y += 14;
    doc.line(120, y, 190, y);
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Total', 140, y);
    doc.text(`${amount.toFixed(2)} EUR`, 165, y);

    y += 18;
    doc.setFont('helvetica', 'bold');
    doc.text('Payment details', 20, y);
    doc.setFont('helvetica', 'normal');
    y += 6;
    doc.text(`IBAN: ${settings.sellerIban}`, 20, y);
    if (settings.sellerBic) {
      y += 5;
      doc.text(`BIC/SWIFT: ${settings.sellerBic}`, 20, y);
    }
    y += 5;
    doc.text(`Payment reference: ${invoiceNo}`, 20, y);

    y += 14;
    doc.setFontSize(8);
    doc.text('VAT is not charged.', 20, y);

    doc.save(`${invoiceNo}.pdf`);
    toast(`PDF ${invoiceNo} создан`);
  }

  window.addEventListener('DOMContentLoaded', () => {
    fillSettings();
    byId('invoice-number-btn')?.addEventListener('click', reserveInvoiceNumber);
    byId('invoice-pdf-btn')?.addEventListener('click', generatePdf);
    byId('invoice-settings-form')?.addEventListener('submit', saveSettings);
  });
})();
