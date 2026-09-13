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
