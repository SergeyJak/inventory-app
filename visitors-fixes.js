(() => {
  if (location.pathname !== '/analytics') return;

  const token = localStorage.getItem('inv_token');
  if (!token) return;

  const INFRA_PATTERNS = [
    /datacamp/i,
    /hetzner/i,
    /amazon|aws/i,
    /google cloud|google llc/i,
    /microsoft|azure/i,
    /digitalocean/i,
    /ovh/i,
    /cloudflare/i,
    /facebook|meta platforms/i,
    /linode|akamai/i,
    /oracle cloud/i,
  ];

  const MODEL_LABELS = {
    light2: 'Light 2',
    mini3: 'Mini 3',
    miniPro: 'Mini 3 Pro',
    midi: 'Midi',
    street: 'Street',
  };

  let currentDays = 30;
  let runId = 0;

  function authHeaders() {
    return { Authorization: `Bearer ${token}` };
  }

  function isoDay(date) {
    return date.toISOString().slice(0, 10);
  }

  function rangeForDays(days) {
    const to = new Date();
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - days + 1);
    return { dateFrom: isoDay(from), dateTo: isoDay(to) };
  }

  async function api(path) {
    const res = await fetch(path, { headers: authHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function loadRows(days) {
    const range = rangeForDays(days);
    const params = new URLSearchParams({ ...range, page: '1', limit: '100' });
    const first = await api(`/api/admin/analytics/visitors?${params}`);
    const rows = [...(first.items || [])];
    const pages = Math.ceil((first.total || rows.length) / 100);
    for (let page = 2; page <= pages; page += 1) {
      const pageParams = new URLSearchParams({ ...range, page: String(page), limit: '100' });
      const next = await api(`/api/admin/analytics/visitors?${pageParams}`);
      rows.push(...(next.items || []));
    }
    return { rows, range };
  }

  function isInfrastructure(row) {
    const text = `${row?.geo?.isp || ''} ${row?.geo?.asn || ''}`;
    return INFRA_PATTERNS.some(pattern => pattern.test(text));
  }

  function ensureControls() {
    const tableHeader = [...document.querySelectorAll('.visitor-table th')].find(th => th.textContent.trim() === 'Визиты');
    if (tableHeader) tableHeader.textContent = 'Дней активности';

    const countriesPanel = document.getElementById('visitor-countries')?.closest('.panel');
    if (countriesPanel && !document.getElementById('network-filter')) {
      const head = countriesPanel.querySelector('.panel-head');
      const controls = document.createElement('div');
      controls.id = 'network-filter';
      controls.className = 'network-filter';
      controls.innerHTML = `
        <button type="button" data-network-mode="all" class="active">Все</button>
        <button type="button" data-network-mode="normal">Обычные сети</button>
      `;
      head?.appendChild(controls);
      controls.addEventListener('click', event => {
        const button = event.target.closest('[data-network-mode]');
        if (!button) return;
        controls.querySelectorAll('button').forEach(item => item.classList.toggle('active', item === button));
        document.body.dataset.networkMode = button.dataset.networkMode;
        applyInfrastructureVisibility();
      });
    }
  }

  function applyInfrastructureVisibility() {
    const normalOnly = document.body.dataset.networkMode === 'normal';
    document.querySelectorAll('.visitor-table tbody tr[data-infrastructure]').forEach(row => {
      row.hidden = normalOnly && row.dataset.infrastructure === 'true';
    });
  }

  function annotateRows(rows) {
    const byMaskedIp = new Map();
    rows.forEach(row => {
      const ip = String(row.latestIp || row.ips?.[row.ips.length - 1] || '');
      if (!ip) return;
      const key = ip.includes(':')
        ? `${ip.split(':').filter(Boolean).slice(0, 2).join(':')}:…`
        : ip.split('.').length === 4
          ? `${ip.split('.')[0]}.${ip.split('.')[1]}.***.***`
          : ip;
      byMaskedIp.set(key, row);
    });

    document.querySelectorAll('.visitor-table tbody tr').forEach(tr => {
      const text = tr.textContent || '';
      const match = [...byMaskedIp.keys()].find(masked => text.includes(masked));
      const row = match ? byMaskedIp.get(match) : null;
      if (!row) return;
      const infra = isInfrastructure(row);
      tr.dataset.infrastructure = infra ? 'true' : 'false';
      if (infra && !tr.querySelector('.infra-badge')) {
        const whereCell = tr.children[1];
        if (whereCell) {
          const badge = document.createElement('span');
          badge.className = 'infra-badge';
          badge.textContent = 'Инфраструктура?';
          badge.title = 'Провайдер похож на дата-центр, облако или social infrastructure. Это эвристика, а не точное определение.';
          whereCell.appendChild(document.createElement('br'));
          whereCell.appendChild(badge);
        }
      }
    });
    applyInfrastructureVisibility();
  }

  function meaningfulModels(detail) {
    const models = new Set();
    for (const session of detail.sessions || []) {
      const events = [...(session.events || [])].sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
      const firstPage = events.find(event => event.eventType === 'page_view');
      const firstPageTime = firstPage ? new Date(firstPage.timestamp).getTime() : NaN;

      for (const event of events) {
        if (!event.modelId) continue;
        if (event.eventType === 'model_view') {
          const eventTime = new Date(event.timestamp).getTime();
          const looksAutomatic = firstPage
            && event.modelId === firstPage.modelId
            && Number.isFinite(eventTime)
            && Number.isFinite(firstPageTime)
            && Math.abs(eventTime - firstPageTime) <= 2000;
          if (!looksAutomatic) models.add(event.modelId);
          continue;
        }
        if (['color_change', 'details_open', 'assistant_recommendation', 'contact_click', 'whatsapp_click', 'telegram_click'].includes(event.eventType)) {
          models.add(event.modelId);
        }
      }
    }
    return [...models];
  }

  async function mapLimit(items, limit, worker) {
    const results = new Array(items.length);
    let cursor = 0;
    async function next() {
      while (cursor < items.length) {
        const index = cursor++;
        try { results[index] = await worker(items[index], index); }
        catch { results[index] = null; }
      }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, next));
    return results;
  }

  function renderModelInterest(modelLists) {
    const container = document.getElementById('visitor-models');
    if (!container) return;
    const counts = new Map();
    modelLists.filter(Boolean).forEach(models => {
      [...new Set(models)].forEach(model => counts.set(model, (counts.get(model) || 0) + 1));
    });
    const entries = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const max = Math.max(1, ...entries.map(([, count]) => count));
    container.innerHTML = entries.length ? entries.slice(0, 6).map(([model, count], index) => `
      <div class="rank-row">
        <span class="rank-index">${index + 1}</span>
        <span class="rank-name">${MODEL_LABELS[model] || model}</span>
        <span class="rank-bar"><i style="width:${Math.max(4, Math.round(count / max * 100))}%"></i></span>
        <strong>${count}</strong>
        <small></small>
      </div>
    `).join('') : '<div class="visitor-empty">Пока нет осознанных взаимодействий с моделями.</div>';
  }

  async function refreshFixes(days = currentDays) {
    currentDays = days;
    const ownRun = ++runId;
    ensureControls();
    try {
      const { rows, range } = await loadRows(days);
      if (ownRun !== runId) return;
      annotateRows(rows);

      const status = document.getElementById('visitor-status');
      if (status) status.textContent = 'Модели…';
      const details = await mapLimit(rows, 8, row => {
        const params = new URLSearchParams({ ...range, limit: '500' });
        return api(`/api/admin/analytics/visitors/${encodeURIComponent(row.visitorId)}?${params}`);
      });
      if (ownRun !== runId) return;
      renderModelInterest(details.map(detail => detail ? meaningfulModels(detail) : []));
      if (status) status.textContent = 'Обновлено';
    } catch {
      const status = document.getElementById('visitor-status');
      if (status) status.textContent = 'Частичные данные';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    ensureControls();
    document.querySelectorAll('#range-buttons button').forEach(button => {
      button.addEventListener('click', () => {
        const days = Number(button.dataset.days) || 30;
        setTimeout(() => refreshFixes(days), 50);
      });
    });
    document.getElementById('visitor-refresh')?.addEventListener('click', () => setTimeout(() => refreshFixes(currentDays), 50));

    const observer = new MutationObserver(() => {
      ensureControls();
      loadRows(currentDays).then(({ rows }) => annotateRows(rows)).catch(() => {});
    });
    const tbody = document.getElementById('visitor-tbody');
    if (tbody) observer.observe(tbody, { childList: true });

    setTimeout(() => refreshFixes(30), 100);
  });
})();
