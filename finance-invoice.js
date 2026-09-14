(() => {
  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? '').trim();
  const SETTINGS_KEY = 'heysmart_finance_invoice_settings_v1';
  const token = localStorage.getItem('inv_token');
  const PDF_FONT_REGULAR_URL = 'https://cdn.jsdelivr.net/npm/opensans-font@1.0.0/OpenSans-Regular.ttf';
  const PDF_FONT_BOLD_URL = 'https://cdn.jsdelivr.net/npm/opensans-font@1.0.0/OpenSans-Bold.ttf';
  let hostSubscriptions = [];
  let settings = {};
  let pdfFontPromise = null;

  function toast(message, error = false) {
    const box = byId('finance-toast');
    if (!box) return;
    box.textContent = message;
    box.className = `toast${error ? ' error' : ''}`;
    box.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { box.hidden = true; }, 2600);
  }

  function ensureCustomerFields() {
    const form = byId('income-form');
    const client = byId('income-client');
    if (!form || !client || byId('invoice-customer-first-name')) return;
    const clientLabel = client.closest('label');
    if (!clientLabel) return;
    clientLabel.insertAdjacentHTML('afterend', `
      <label>Имя клиента, опционально<input id="invoice-customer-first-name" type="text" maxlength="80" autocomplete="off" /></label>
      <label>Фамилия клиента, опционально<input id="invoice-customer-last-name" type="text" maxlength="80" autocomplete="off" /></label>
      <label>Personas kods, опционально<input id="invoice-customer-personal-code" type="text" maxlength="30" autocomplete="off" placeholder="000000-00000" /></label>
    `);
  }

  function localSettings() {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); }
    catch { return {}; }
  }

  function hasSettings(value) {
    return !!(value && (
      value.sellerName || value.sellerIban || value.sellerBic ||
      value.sellerAddress || value.sellerEmail || value.sellerRegNo
    ));
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

  function fillSettings(value = settings) {
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
      if (el) el.value = value[key] || '';
    }
  }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  }

  async function persistSettings(value, showToast = true) {
    if (!hostSubscriptions.length) throw new Error('Не найден Host для хранения настроек Finance');
    settings = { ...value };
    hostSubscriptions[0].financeInvoiceSettings = settings;
    await api('/api/save', {
      method: 'POST',
      body: JSON.stringify({ key: 'hostSubscriptions', data: hostSubscriptions }),
    });
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    if (showToast) toast('Реквизиты счёта сохранены');
  }

  async function saveSettings(event) {
    event.preventDefault();
    try {
      await persistSettings(settingsFromForm());
    } catch (error) {
      toast(`Не удалось сохранить реквизиты: ${error.message}`, true);
    }
  }

  async function loadPersistentSettings() {
    if (!token) return;
    try {
      const data = await api('/api/data');
      hostSubscriptions = Array.isArray(data.hostSubscriptions) ? data.hostSubscriptions : [];
      const dbSettings = hostSubscriptions[0]?.financeInvoiceSettings || {};
      const oldLocalSettings = localSettings();

      if (hasSettings(dbSettings)) {
        settings = dbSettings;
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      } else if (hasSettings(oldLocalSettings) && hostSubscriptions.length) {
        settings = oldLocalSettings;
        await persistSettings(settings, false);
      } else {
        settings = oldLocalSettings;
      }
      fillSettings(settings);
    } catch (error) {
      settings = localSettings();
      fillSettings(settings);
      console.warn('[finance] failed to load invoice settings from database', error);
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
    if (type === 'subscription') return 'Abonēšanas pakalpojums';
    if (type === 'setup') return 'Viedierīces uzstādīšana un konfigurēšana';
    return 'Pakalpojums';
  }

  function formatLatvianDate(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}.${match[2]}.${match[1]}` : String(value || '');
  }

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  async function ensureLatvianPdfFont(doc) {
    if (typeof doc.addFileToVFS !== 'function' || typeof doc.addFont !== 'function') {
      throw new Error('PDF-модуль не поддерживает Unicode-шрифты');
    }

    if (!pdfFontPromise) {
      pdfFontPromise = Promise.all([
        fetch(PDF_FONT_REGULAR_URL).then(response => {
          if (!response.ok) throw new Error(`Regular font HTTP ${response.status}`);
          return response.arrayBuffer();
        }),
        fetch(PDF_FONT_BOLD_URL).then(response => {
          if (!response.ok) throw new Error(`Bold font HTTP ${response.status}`);
          return response.arrayBuffer();
        }),
      ]).then(([regular, bold]) => ({
        regular: arrayBufferToBase64(regular),
        bold: arrayBufferToBase64(bold),
      }));
    }

    try {
      const fonts = await pdfFontPromise;
      doc.addFileToVFS('OpenSans-Regular.ttf', fonts.regular);
      doc.addFont('OpenSans-Regular.ttf', 'OpenSans', 'normal');
      doc.addFileToVFS('OpenSans-Bold.ttf', fonts.bold);
      doc.addFont('OpenSans-Bold.ttf', 'OpenSans', 'bold');
      return 'OpenSans';
    } catch (error) {
      pdfFontPromise = null;
      throw new Error(`Не удалось загрузить Unicode-шрифт для латышского счёта: ${error.message}`);
    }
  }

  function drawHeySmartLogo(doc) {
    const x = 20;
    const y = 25;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);

    doc.setTextColor(6, 21, 53);
    doc.text('Hey', x, y);

    let cursor = x + doc.getTextWidth('Hey') - 0.3;
    const letters = [
      ['S', [13, 153, 255]],
      ['m', [23, 118, 255]],
      ['a', [52, 82, 255]],
      ['r', [91, 48, 255]],
      ['t', [151, 0, 255]],
    ];

    for (const [letter, color] of letters) {
      doc.setTextColor(...color);
      doc.text(letter, cursor, y);
      cursor += doc.getTextWidth(letter) - 0.12;
    }

    doc.setTextColor(0, 0, 0);
  }

  function customerLines(customerEmail) {
    const firstName = esc(byId('invoice-customer-first-name')?.value);
    const lastName = esc(byId('invoice-customer-last-name')?.value);
    const personalCode = esc(byId('invoice-customer-personal-code')?.value);
    const fullName = [firstName, lastName].filter(Boolean).join(' ');
    return [
      fullName,
      personalCode ? `Personas kods: ${personalCode}` : '',
      customerEmail,
    ].filter(Boolean);
  }

  async function generatePdf() {
    try {
      if (!hasSettings(settings)) await loadPersistentSettings();
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
      const pdfFont = await ensureLatvianPdfFont(doc);

      drawHeySmartLogo(doc);

      doc.setFont(pdfFont, 'bold');
      doc.setFontSize(19);
      doc.text('RĒĶINS', 190, 20, { align: 'right' });
      doc.setFontSize(11);
      doc.text(invoiceNo, 190, 27, { align: 'right' });
      doc.setFont(pdfFont, 'normal');
      doc.setFontSize(9);
      doc.text(`Datums: ${formatLatvianDate(date)}`, 190, 34, { align: 'right' });

      let y = 49;
      doc.setFont(pdfFont, 'bold');
      doc.setFontSize(10);
      doc.text('Pakalpojuma sniedzējs', 20, y);
      doc.setFont(pdfFont, 'normal');
      y += 6;

      const sellerLines = [
        settings.sellerName,
        settings.sellerRegNo ? `Reģ. Nr.: ${settings.sellerRegNo}` : '',
        settings.sellerAddress,
        settings.sellerEmail,
      ].filter(Boolean);
      sellerLines.forEach(line => {
        doc.text(String(line), 20, y);
        y += 5;
      });

      y += 5;
      doc.setFont(pdfFont, 'bold');
      doc.text('Klients', 20, y);
      doc.setFont(pdfFont, 'normal');
      y += 6;
      customerLines(customer).forEach(line => {
        doc.text(String(line), 20, y);
        y += 5;
      });

      y += 11;
      doc.setFillColor(245, 247, 250);
      doc.rect(20, y - 7, 170, 10, 'F');
      doc.setFont(pdfFont, 'bold');
      doc.text('Apraksts', 22, y);
      doc.text('Summa', 165, y);

      y += 12;
      doc.setFont(pdfFont, 'normal');
      doc.text(invoiceDescription(), 22, y);
      doc.text(`${amount.toFixed(2)} EUR`, 165, y);

      y += 14;
      doc.setDrawColor(180, 188, 200);
      doc.line(120, y, 190, y);
      y += 8;
      doc.setFont(pdfFont, 'bold');
      doc.text('Kopā', 140, y);
      doc.text(`${amount.toFixed(2)} EUR`, 165, y);

      y += 18;
      doc.setFont(pdfFont, 'bold');
      doc.text('Maksājuma rekvizīti', 20, y);
      doc.setFont(pdfFont, 'normal');
      y += 6;
      doc.text(`IBAN: ${settings.sellerIban}`, 20, y);
      if (settings.sellerBic) {
        y += 5;
        doc.text(`BIC/SWIFT: ${settings.sellerBic}`, 20, y);
      }
      y += 5;
      doc.text(`Maksājuma mērķis: ${invoiceNo}`, 20, y);

      y += 14;
      doc.setFontSize(8);
      doc.setTextColor(90, 100, 115);
      doc.text('PVN netiek piemērots.', 20, y);
      doc.setTextColor(0, 0, 0);

      doc.save(`${invoiceNo}.pdf`);
      toast(`PDF ${invoiceNo} создан`);
    } catch (error) {
      console.error('[finance] PDF generation failed', error);
      toast(`Ошибка PDF: ${error.message || error}`, true);
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    ensureCustomerFields();
    loadPersistentSettings();
    byId('invoice-number-btn')?.addEventListener('click', reserveInvoiceNumber);
    byId('invoice-pdf-btn')?.addEventListener('click', generatePdf);
    byId('invoice-settings-form')?.addEventListener('submit', saveSettings);
  });
})();
