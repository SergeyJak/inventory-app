const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function patch(fileName, transform) {
  const filePath = path.join(ROOT, fileName);
  const current = fs.readFileSync(filePath, 'utf8');
  const next = transform(current);
  if (next !== current) {
    fs.writeFileSync(filePath, next, 'utf8');
    console.log(`[finance] patched ${fileName}`);
  }
}

patch('server.js', source => {
  if (source.includes("['/finance', 'finance.html']")) return source;
  const anchor = "  ['/reports', 'reports.html'],";
  if (!source.includes(anchor)) throw new Error('Finance route anchor not found');
  return source.replace(
    anchor,
    [
      anchor,
      "  ['/finance', 'finance.html'],",
      "  ['/finance.html', 'finance.html'],",
      "  ['/finance.css', 'finance.css'],",
      "  ['/finance.js', 'finance.js'],",
    ].join('\n')
  );
});

patch('index.html', source => {
  let next = source;
  if (!next.includes('href="/finance"')) {
    const anchor = '      <button class="tab-btn admin-only" type="button" data-tab="accounts" role="menuitem">Аккаунты</button>';
    if (!next.includes(anchor)) throw new Error('Finance nav anchor not found');
    next = next.replace(anchor, anchor + '\n      <a class="tab-btn admin-only" href="/finance" role="menuitem">Финансы</a>');
  }

  if (!next.includes('href="/finance?view=services&focus=income"')) {
    const headerAnchor = '    <a href="/reports" class="btn-secondary" style="padding:5px 14px;font-size:0.83rem;text-decoration:none">Analytics</a>';
    if (next.includes(headerAnchor)) {
      next = next.replace(
        headerAnchor,
        headerAnchor + '\n    <a href="/finance?view=services&focus=income" class="btn-primary admin-only" style="padding:6px 12px;font-size:0.83rem;text-decoration:none;white-space:nowrap">+ Приход / счёт</a>'
      );
    }
  }
  return next;
});

console.log('[finance] route bootstrap OK');
