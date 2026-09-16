/* HeySmart assistant loader: keeps the v2.1 engine intact and applies audited regression fixes synchronously. */
(function () {
  'use strict';
  if (typeof document === 'undefined' || !document.write) return;
  document.write('<script src="/assistant-handoff.js?v=20260916-audit"><\/script>');
  document.write('<script src="/assistant-engine-core.js?v=20260624-v21"><\/script>');
  document.write('<script src="/assistant-audit-fixes.js?v=20260916-audit"><\/script>');
})();
