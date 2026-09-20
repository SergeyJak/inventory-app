(() => {
  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? '').trim();
  const SETTINGS_KEY = 'heysmart_finance_invoice_settings_v1';
  const token = localStorage.getItem('inv_token');
  let hostSubscriptions = [];
  let settings = {};

  const LATVIAN_GLYPHS = {
    'Ā': ['A', 'macron'], 'ā': ['a', 'macron'],
    'Ē': ['E', 'macron'], 'ē': ['e', 'macron'],
    'Ī': ['I', 'macron'], 'ī': ['i', 'macron'],
    'Ū': ['U', 'macron'], 'ū': ['u', 'macron'],
    'Č': ['C', 'caron'], 'č': ['c', 'caron'],
    'Š': ['S', 'caron'], 'š': ['s', 'caron'],
    'Ž': ['Z', 'caron'], 'ž': ['z', 'caron'],
    'Ģ': ['G', 'comma'], 'ģ': ['g', 'comma'],
    'Ķ': ['K', 'comma'], 'ķ': ['k', 'comma'],
    'Ļ': ['L', 'comma'], 'ļ': ['l', 'comma'],
    'Ņ': ['N', 'comma'], 'ņ': ['n', 'comma'],
  };

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

  function pdfBaseChar(char) {
    return LATVIAN_GLYPHS[char]?.[0] || char;
  }

  function lvTextWidth(doc, value) {
    let width = 0;
    for (const char of String(value ?? '')) width += doc.getTextWidth(pdfBaseChar(char));
    return width;
  }

  function drawLatvianMark(doc, mark, x, y, charWidth) {
    const fontSize = Number(doc.internal?.getFontSize?.() || 10);
    const em = fontSize * 0.3528;
    const center = x + charWidth / 2;
    const topY = y - em * 0.82;

    doc.setLineWidth?.(Math.max(0.12, em * 0.045));
    if (mark === 'macron') {
      const half = Math.max(0.8, charWidth * 0.28);
      doc.line(center - half, topY, center + half, topY);
    } else if (mark === 'caron') {
      const half = Math.max(0.55, charWidth * 0.18);
      const depth = Math.max(0.45, em * 0.12);
      doc.line(center - half, topY - depth, center, topY);
      doc.line(center, topY, center + half, topY - depth);
    } else if (mark === 'comma') {
      const baseY = y + em * 0.17;
      const dx = Math.max(0.32, em * 0.09);
      const dy = Math.max(0.42, em * 0.12);
      doc.line(center, baseY, center - dx, baseY + dy);
    }
  }

  function textLv(doc, value, x, y, options = {}) {
    const text = String(value ?? '');
    const totalWidth = lvTextWidth(doc, text);
    let cursor = x;
    if (options.align === 'right') cursor -= totalWidth;
    if (options.align === 'center') cursor -= totalWidth / 2;

    for (const char of text) {
      const glyph = LATVIAN_GLYPHS[char];
      const base = glyph?.[0] || char;
      const width = doc.getTextWidth(base);
      doc.text(base, cursor, y);
      if (glyph) drawLatvianMark(doc, glyph[1], cursor, y, width);
      cursor += width;
    }
    return totalWidth;
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
      const selectedClient = clientSelect?.options?.[clientSelect.selectedIndex];
      const customerEmail = selectedClient?.dataset?.email?.trim()
        || selectedClient?.text?.trim()
        || '';
      if (!customerEmail || customerEmail === '-') {
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

      drawHeySmartLogo(doc);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(19);
      textLv(doc, 'RĒĶINS', 190, 20, { align: 'right' });
      doc.setFontSize(11);
      textLv(doc, invoiceNo, 190, 27, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      textLv(doc, `Datums: ${formatLatvianDate(date)}`, 190, 34, { align: 'right' });

      let y = 49;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      textLv(doc, 'Pakalpojuma sniedzējs', 20, y);
      doc.setFont('helvetica', 'normal');
      y += 6;

      const sellerLines = [
        settings.sellerName,
        settings.sellerRegNo ? `Reģ. Nr.: ${settings.sellerRegNo}` : '',
        settings.sellerAddress,
        settings.sellerEmail,
      ].filter(Boolean);
      sellerLines.forEach(line => {
        textLv(doc, String(line), 20, y);
        y += 5;
      });

      y += 5;
      doc.setFont('helvetica', 'bold');
      textLv(doc, 'Klients', 20, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      customerLines(customerEmail).forEach(line => {
        textLv(doc, String(line), 20, y);
        y += 5;
      });

      y += 11;
      doc.setFillColor(245, 247, 250);
      doc.rect(20, y - 7, 170, 10, 'F');
      doc.setFont('helvetica', 'bold');
      textLv(doc, 'Apraksts', 22, y);
      textLv(doc, 'Summa', 165, y);

      y += 12;
      doc.setFont('helvetica', 'normal');
      textLv(doc, invoiceDescription(), 22, y);
      textLv(doc, `${amount.toFixed(2)} EUR`, 165, y);

      y += 14;
      doc.setDrawColor(180, 188, 200);
      doc.line(120, y, 190, y);
      y += 8;
      doc.setFont('helvetica', 'bold');
      textLv(doc, 'Kopā', 140, y);
      textLv(doc, `${amount.toFixed(2)} EUR`, 165, y);

      y += 18;
      doc.setFont('helvetica', 'bold');
      textLv(doc, 'Maksājuma rekvizīti', 20, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      textLv(doc, `IBAN: ${settings.sellerIban}`, 20, y);
      if (settings.sellerBic) {
        y += 5;
        textLv(doc, `BIC/SWIFT: ${settings.sellerBic}`, 20, y);
      }
      y += 5;
      textLv(doc, `Maksājuma mērķis: ${invoiceNo}`, 20, y);

      y += 14;
      doc.setFontSize(8);
      doc.setTextColor(90, 100, 115);
      textLv(doc, 'PVN netiek piemērots.', 20, y);

      const footerY = 272;
      doc.setDrawColor(215, 220, 228);
      doc.line(20, footerY - 7, 190, footerY - 7);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(105, 115, 130);
      textLv(doc, 'Dokuments sagatavots elektroniski un ir derīgs bez paraksta.', 20, footerY);
      textLv(doc, `Apmaksājot rēķinu, maksājuma mērķī norādiet rēķina numuru: ${invoiceNo}.`, 20, footerY + 5);
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
