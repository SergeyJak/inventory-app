const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const htmlPath = path.join(root, 'finance.html');
const jsPath = path.join(root, 'finance.js');

let html = fs.readFileSync(htmlPath, 'utf8');
const duplicateClosing = '    </section>\n    </section>\n  </main>';
if (html.includes(duplicateClosing)) {
  html = html.replace(duplicateClosing, '    </section>\n  </main>');
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log('[finance] fixed duplicate section closing');
}

const requiredHtml = [
  'id="income-form"',
  'id="invoice-number-btn"',
  'id="invoice-pdf-btn"',
  'id="invoice-settings-form"',
  'id="mileage-form"',
  'id="mileage-tbody"',
];
for (const marker of requiredHtml) {
  if (!html.includes(marker)) throw new Error(`Finance validation failed: missing ${marker}`);
}

const js = fs.readFileSync(jsPath, 'utf8');
try {
  // Compile only. The browser globals are intentionally not executed here.
  new Function(js);
} catch (error) {
  throw new Error(`Finance JS syntax error: ${error.message}`);
}

const requiredJs = [
  'function generateInvoicePdf()',
  'function renderMileage()',
  'function saveInvoiceSettings(event)',
  "byId('invoice-number-btn').addEventListener",
];
for (const marker of requiredJs) {
  if (!js.includes(marker)) throw new Error(`Finance validation failed: missing JS marker ${marker}`);
}

console.log('[finance] validation OK');
