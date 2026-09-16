/* HeySmart catalog loader: apply assistant audit fixes before the catalog initializes. */
(function () {
  'use strict';
  if (typeof document === 'undefined' || !document.write) return;
  document.write('<script src="/assistant-handoff.js?v=20260916-audit"><\/script>');
  document.write('<script src="/assistant-audit-fixes.js?v=20260916-audit"><\/script>');
  document.write('<script src="/catalog-core.js?v=20260906-product-catalog"><\/script>');
})();
