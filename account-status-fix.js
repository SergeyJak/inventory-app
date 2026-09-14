(() => {
  const originalIsCancelledSub = window.isCancelledSub;

  window.isCancelledSub = function isCancelledSubWithInactive(sub) {
    const status = String(sub?.status || '').trim().toLowerCase();
    if (status === 'not active' || status === 'inactive') return true;
    return typeof originalIsCancelledSub === 'function' ? originalIsCancelledSub(sub) : false;
  };

  window.subFitsAccountsView = function subFitsAccountsViewWithInactive(sub) {
    const cancelled = window.isCancelledSub(sub);
    const isNew = typeof window.isNewUnassignedSub === 'function'
      ? window.isNewUnassignedSub(sub)
      : !cancelled && !String(sub?.tel || '').trim() && !String(sub?.startDate || '').trim();

    if (window.accountsView === 'cancelled') return cancelled;
    if (window.accountsView === 'new') return isNew;
    return !cancelled && !isNew;
  };
})();
