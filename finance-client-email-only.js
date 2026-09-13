(() => {
  const token = localStorage.getItem('inv_token');
  const select = document.getElementById('income-client');
  if (!token || !select) return;

  let emailById = new Map();
  let applying = false;

  function applyEmailOnlyOptions() {
    if (applying || emailById.size === 0) return;
    applying = true;
    try {
      const selected = select.value;
      const rows = [...emailById.entries()]
        .map(([id, email]) => ({ id, email: String(email || '').trim() }))
        .filter(row => row.email)
        .sort((a, b) => a.email.localeCompare(b.email, 'en', { sensitivity: 'base' }));

      select.innerHTML = rows.length
        ? rows.map(row => `<option value="${escapeHtml(row.id)}">${escapeHtml(row.email)}</option>`).join('')
        : '<option value="">Нет аккаунтов с email</option>';

      if (rows.some(row => String(row.id) === String(selected))) {
        select.value = selected;
      }
    } finally {
      applying = false;
    }
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const observer = new MutationObserver(() => applyEmailOnlyOptions());
  observer.observe(select, { childList: true });

  fetch('/api/data', {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(data => {
      emailById = new Map(
        (Array.isArray(data.subAccounts) ? data.subAccounts : [])
          .filter(account => String(account.email || '').trim())
          .map(account => [String(account.id), String(account.email).trim()])
      );
      applyEmailOnlyOptions();
    })
    .catch(error => console.warn('[finance] failed to normalize client emails', error));
})();
