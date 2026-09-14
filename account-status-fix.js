(() => {
  const originalIsCancelledSub = window.isCancelledSub;

  window.isCancelledSub = function isCancelledSubWithInactive(sub) {
    const status = String(sub?.status || '').trim().toLowerCase();
    if (status === 'not active' || status === 'inactive') return true;
    return typeof originalIsCancelledSub === 'function' ? originalIsCancelledSub(sub) : false;
  };
})();
