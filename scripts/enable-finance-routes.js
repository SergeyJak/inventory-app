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
  let next = source;
  const anchor = "  ['/reports', 'reports.html'],";
  if (!next.includes(anchor)) throw new Error('Finance route anchor not found');

  const routes = [
    ["['/finance', 'finance.html']", "  ['/finance', 'finance.html'],"],
    ["['/finance.html', 'finance.html']", "  ['/finance.html', 'finance.html'],"],
    ["['/finance.css', 'finance.css']", "  ['/finance.css', 'finance.css'],"],
    ["['/finance.js', 'finance.js']", "  ['/finance.js', 'finance.js'],"],
    ["['/finance-client-email-only.js', 'finance-client-email-only.js']", "  ['/finance-client-email-only.js', 'finance-client-email-only.js'],"],
    ["['/finance-invoice.js', 'finance-invoice.js']", "  ['/finance-invoice.js', 'finance-invoice.js'],"],
    ["['/finance-combo.js', 'finance-combo.js']", "  ['/finance-combo.js', 'finance-combo.js'],"],
    ["['/account-view-routing.js', 'account-view-routing.js']", "  ['/account-view-routing.js', 'account-view-routing.js'],"],
  ];

  const missing = routes.filter(([marker]) => !next.includes(marker)).map(([, line]) => line);
  if (missing.length) next = next.replace(anchor, [anchor, ...missing].join('\n'));
  return next;
});

patch('index.html', source => {
  let next = source;
  if (!next.includes('href="/finance"')) {
    const anchor = '      <button class="tab-btn admin-only" type="button" data-tab="accounts" role="menuitem">Аккаунты</button>';
    const navigationPath = path.join(ROOT, 'navigation.js');
    const navigationHasFinance = fs.existsSync(navigationPath)
      && fs.readFileSync(navigationPath, 'utf8').includes("href: '/finance'");

    if (next.includes(anchor)) {
      next = next.replace(anchor, anchor + '\n      <a class="tab-btn admin-only" href="/finance" role="menuitem">Финансы</a>');
    } else if (!navigationHasFinance) {
      throw new Error('Finance navigation entry not found');
    }
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

  if (!next.includes('/account-view-routing.js')) {
    const appAnchorMatch = next.match(/<script src="\/?app\.js(?:\?[^"]*)?"><\/script>/);
    if (!appAnchorMatch) throw new Error('Account routing script anchor not found');
    const appAnchor = appAnchorMatch[0];
    next = next.replace(appAnchor, appAnchor + '\n<script src="/account-view-routing.js?v=20260914-1"></script>');
  }
  return next;
});

patch('finance.html', source => {
  let next = source;
  if (!next.includes('/finance-combo.js')) {
    const anchorMatch = next.match(/<script src="\/finance-invoice\.js\?v=[^"]+" defer><\/script>/);
    if (!anchorMatch) throw new Error('Finance combo script anchor not found');
    const anchor = anchorMatch[0];
    next = next.replace(anchor, anchor + '\n  <script src="/finance-combo.js?v=20260914-1" defer></script>');
  }
  return next;
});

console.log('[finance] route bootstrap OK');
