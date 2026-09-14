(() => {
  const TYPE_VALUE = 'setup_subscription';
  const TYPE_LABEL = 'Setup + Subscription';
  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? '').trim();

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

  function ensureComboOption() {
    const select = byId('income-type');
    if (!select || select.querySelector(`option[value="${TYPE_VALUE}"]`)) return;
    const option = document.createElement('option');
    option.value = TYPE_VALUE;
    option.textContent = TYPE_LABEL;
    const other = select.querySelector('option[value="other"]');
    select.insertBefore(option, other || null);
  }

  function pdfBaseChar(char) { return LATVIAN_GLYPHS[char]?.[0] || char; }
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
    const x = 20, y = 25;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.setTextColor(6, 21, 53);
    doc.text('Hey', x, y);
    let cursor = x + doc.getTextWidth('Hey') - 0.3;
    const letters = [
      ['S', [13,153,255]], ['m', [23,118,255]], ['a', [52,82,255]],
      ['r', [91,48,255]], ['t', [151,0,255]],
    ];
    for (const [letter, color] of letters) {
      doc.setTextColor(...color);
      doc.text(letter, cursor, y);
      cursor += doc.getTextWidth(letter) - 0.12;
    }
    doc.setTextColor(0, 0, 0);
  }
  function formatLatvianDate(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}.${match[2]}.${match[1]}` : String(value || '');
  }
  function customerLines(email) {
    const first = esc(byId('invoice-customer-first-name')?.value);
    const last = esc(byId('invoice-customer-last-name')?.value);
    const code = esc(byId('invoice-customer-personal-code')?.value);
    return [[first, last].filter(Boolean).join(' '), code ? `Personas kods: ${code}` : '', email].filter(Boolean);
  }

  function generateComboPdf(event) {
    if (byId('income-type')?.value !== TYPE_VALUE) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      const sellerName = esc(byId('invoice-seller-name')?.value);
      const sellerRegNo = esc(byId('invoice-seller-regno')?.value);
      const sellerAddress = esc(byId('invoice-seller-address')?.value);
      const sellerIban = esc(byId('invoice-seller-iban')?.value);
      const sellerBic = esc(byId('invoice-seller-bic')?.value);
      const sellerEmail = esc(byId('invoice-seller-email')?.value);
      if (!sellerName || !sellerIban) return toast('Сначала заполни имя и IBAN в реквизитах', true);
      if (!window.jspdf?.jsPDF) return toast('PDF-модуль ещё не загрузился', true);

      const clientSelect = byId('income-client');
      const customer = clientSelect?.options?.[clientSelect.selectedIndex]?.text?.trim() || '';
      if (!customer || customer === '-') return toast('Выбери аккаунт клиента', true);

      const amount = Number(byId('income-amount')?.value);
      if (!(amount > 0)) return toast('Укажи сумму', true);
      const invoiceInput = byId('income-invoice');
      const invoiceNo = esc(invoiceInput?.value) || esc(invoiceInput?.placeholder);
      if (!invoiceNo) return toast('Не удалось получить номер счёта', true);
      if (invoiceInput) invoiceInput.value = invoiceNo;

      const date = byId('income-date')?.value || new Date().toISOString().slice(0, 10);
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      drawHeySmartLogo(doc);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(19); textLv(doc, 'RĒĶINS', 190, 20, { align: 'right' });
      doc.setFontSize(11); textLv(doc, invoiceNo, 190, 27, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9); textLv(doc, `Datums: ${formatLatvianDate(date)}`, 190, 34, { align: 'right' });

      let y = 49;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); textLv(doc, 'Pakalpojuma sniedzējs', 20, y);
      doc.setFont('helvetica', 'normal'); y += 6;
      [sellerName, sellerRegNo ? `Reģ. Nr.: ${sellerRegNo}` : '', sellerAddress, sellerEmail].filter(Boolean).forEach(line => { textLv(doc, line, 20, y); y += 5; });

      y += 5; doc.setFont('helvetica', 'bold'); textLv(doc, 'Klients', 20, y);
      doc.setFont('helvetica', 'normal'); y += 6;
      customerLines(customer).forEach(line => { textLv(doc, line, 20, y); y += 5; });

      y += 11;
      doc.setFillColor(245,247,250); doc.rect(20, y - 7, 170, 10, 'F');
      doc.setFont('helvetica', 'bold'); textLv(doc, 'Apraksts', 22, y); textLv(doc, 'Summa', 165, y);
      doc.setFont('helvetica', 'normal');
      y += 12; textLv(doc, 'Abonēšanas pakalpojums', 22, y);
      y += 7; textLv(doc, 'Viedierīces uzstādīšana un konfigurēšana', 22, y);

      y += 12; doc.setDrawColor(180,188,200); doc.line(120, y, 190, y);
      y += 8; doc.setFont('helvetica', 'bold'); textLv(doc, 'Kopā', 140, y); textLv(doc, `${amount.toFixed(2)} EUR`, 165, y);

      y += 18; doc.setFont('helvetica', 'bold'); textLv(doc, 'Maksājuma rekvizīti', 20, y);
      doc.setFont('helvetica', 'normal'); y += 6; textLv(doc, `IBAN: ${sellerIban}`, 20, y);
      if (sellerBic) { y += 5; textLv(doc, `BIC/SWIFT: ${sellerBic}`, 20, y); }
      y += 5; textLv(doc, `Maksājuma mērķis: ${invoiceNo}`, 20, y);
      y += 14; doc.setFontSize(8); doc.setTextColor(90,100,115); textLv(doc, 'PVN netiek piemērots.', 20, y);
      doc.save(`${invoiceNo}.pdf`);
      toast(`PDF ${invoiceNo} создан`);
    } catch (error) {
      console.error('[finance] combined PDF generation failed', error);
      toast(`Ошибка PDF: ${error.message || error}`, true);
    }
  }

  function prettifyLedger() {
    document.querySelectorAll('#ledger-tbody td').forEach(td => {
      if (td.textContent.trim() === TYPE_VALUE) td.textContent = TYPE_LABEL;
    });
  }

  window.addEventListener('DOMContentLoaded', () => {
    ensureComboOption();
    byId('invoice-pdf-btn')?.addEventListener('click', generateComboPdf, true);
    const ledger = byId('ledger-tbody');
    if (ledger) new MutationObserver(prettifyLedger).observe(ledger, { childList: true, subtree: true });
  });
})();
