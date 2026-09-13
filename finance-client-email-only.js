(() => {
  const token = localStorage.getItem('inv_token');
  const select = document.getElementById('income-client');
  if (!token || !select) return;

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  fetch('/api/data', {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(data => {
      const rows = (Array.isArray(data.subAccounts) ? data.subAccounts : [])
        .map(account => ({
          id: String(account.id ?? ''),
          email: String(account.email || '').trim(),
        }))
        .filter(row => row.id && row.email)
        .sort((a, b) => a.email.localeCompare(b.email, 'en', { sensitivity: 'base' }));

      const applyOnce = () => {
        const selected = select.value;
        select.innerHTML = rows.length
          ? rows.map(row => `<option value="${escapeHtml(row.id)}">${escapeHtml(row.email)}</option>`).join('')
          : '<option value="">Нет аккаунтов с email</option>';
        if (rows.some(row => row.id === selected)) select.value = selected;
      };

      // finance.js loads its own data asynchronously and fills the same select.
      // Give it a moment, then normalize exactly once. No MutationObserver loop.
      setTimeout(applyOnce, 350);
    })
    .catch(error => console.warn('[finance] failed to normalize client emails', error));
})();
