// Account table routing is status-only.
// active -> Subscribers, not active -> New, cancelled -> Cancelled.

function isNewUnassignedSub(sub) {
  return String(sub?.status || '').trim().toLowerCase() === 'not active';
}

function subFitsAccountsView(sub) {
  const status = String(sub?.status || '').trim().toLowerCase();

  if (accountsView === 'cancelled') return isCancelledSub(sub);
  if (accountsView === 'new') return status === 'not active';
  if (accountsView === 'subs') return status === 'active';
  return false;
}
