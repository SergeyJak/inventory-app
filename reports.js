if (location.pathname === '/analytics') {
  const token = localStorage.getItem('inv_token');
  const role = localStorage.getItem('inv_role');
  const username = localStorage.getItem('inv_username');

  if (!token) location.href = '/login.html';
  if (role && role !== 'admin') location.href = '/';

  document.title = 'HeySmart Visitors';
  document.body.classList.add('visitors-mode');
  document.body.innerHTML = `
    <header class="visitor-header">
      <div>
        <a class="back-link" href="/">Inventory</a>
        <h1>Посетители HeySmart</h1>
        <p>Реальная активность посетителей heysmart.lv из visitor analytics.</p>
      </div>
      <div class="header-actions">
        <span id="visitor-user"></span>
        <a href="/reports" class="header-link">Sales Analytics</a>
        <button type="button" id="visitor-logout">Logout</button>
      </div>
    </header>

    <main class="visitor-shell">
      <section class="visitor-toolbar panel">
        <div class="range-buttons" id="range-buttons" aria-label="Период">
          <button type="button" data-days="7">7 дней</button>
          <button type="button" data-days="14">14 дней</button>
          <button type="button" data-days="30" class="active">30 дней</button>
        </div>
        <div class="visitor-range-label" id="visitor-range-label">Последние 30 дней</div>
        <button type="button" class="refresh-analytics" id="visitor-refresh">Обновить</button>
      </section>

      <section class="visitor-summary" id="visitor-summary"></section>

      <section class="visitor-grid visitor-grid-main">
        <article class="panel visitor-trend-panel">
          <div class="panel-head">
            <div>
              <h2>Посещения</h2>
              <p>Новые посетители и последняя активность по дням.</p>
            </div>
            <span class="data-status" id="visitor-status">Загрузка…</span>
          </div>
          <div class="visitor-chart-wrap"><canvas id="visitor-trend-chart"></canvas></div>
        </article>

        <article class="panel visitor-breakdown-panel">
          <div class="panel-head"><div><h2>Страны</h2><p>По последней известной геолокации посетителя.</p></div></div>
          <div class="breakdown-chart"><canvas id="visitor-country-chart"></canvas></div>
          <div class="rank-list" id="visitor-countries"></div>
        </article>
      </section>

      <section class="visitor-grid visitor-grid-three">
        <article class="panel">
          <div class="panel-head"><div><h2>Города</h2><p>Топ локаций.</p></div></div>
          <div class="rank-list" id="visitor-cities"></div>
        </article>
        <article class="panel">
          <div class="panel-head"><div><h2>Устройства</h2><p>Последнее устройство посетителя.</p></div></div>
          <div class="breakdown-chart compact"><canvas id="visitor-device-chart"></canvas></div>
          <div class="rank-list" id="visitor-devices"></div>
        </article>
        <article class="panel">
          <div class="panel-head"><div><h2>Язык и модели</h2><p>Язык сайта и интерес к моделям.</p></div></div>
          <div class="mini-section"><h3>Язык</h3><div class="rank-list" id="visitor-locales"></div></div>
          <div class="mini-section"><h3>Модели</h3><div class="rank-list" id="visitor-models"></div></div>
        </article>
      </section>

      <section class="panel visitor-table-panel">
        <div class="panel-head visitor-table-head">
          <div>
            <h2>Последние посетители</h2>
            <p id="visitor-table-subtitle">Загрузка…</p>
          </div>
          <div class="visitor-search-wrap">
            <input id="visitor-search" type="search" placeholder="IP, город, страна, провайдер, модель…" autocomplete="off" />
          </div>
        </div>
        <div class="table-wrap">
          <table class="visitor-table">
            <thead>
              <tr>
                <th>Последний визит</th>
                <th>Где</th>
                <th>Устройство</th>
                <th>Визиты</th>
                <th>Модели</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody id="visitor-tbody"></tbody>
          </table>
        </div>
        <div class="visitor-pagination" id="visitor-pagination"></div>
      </section>
    </main>

    <div class="visitor-drawer-backdrop" id="visitor-drawer-backdrop" hidden></div>
    <aside class="visitor-drawer" id="visitor-drawer" aria-hidden="true">
      <div class="drawer-head">
        <div><span class="drawer-kicker">Посетитель</span><h2 id="drawer-title">История</h2></div>
        <button type="button" id="drawer-close" aria-label="Закрыть">×</button>
      </div>
      <div class="drawer-content" id="drawer-content"></div>
    </aside>
  `;

  const charts = { trend: null, country: null, device: null };
  const state = {
    days: 30,
    dateFrom: '',
    dateTo: '',
    summary: null,
    rows: [],
    filteredRows: [],
    daily: [],
    page: 1,
    pageSize: 20,
    search: '',
  };

  document.getElementById('visitor-user').textContent = username ? `${username} · ${role || 'admin'}` : 'admin';

  function authHeaders() {
    return { Authorization: `Bearer ${token}` };
  }

  function isoDay(date) {
    return date.toISOString().slice(0, 10);
  }

  function setRange(days) {
    state.days = days;
    const now = new Date();
    const from = new Date(now);
    from.setUTCDate(from.getUTCDate() - days + 1);
    state.dateFrom = isoDay(from);
    state.dateTo = isoDay(now);
    document.getElementById('visitor-range-label').textContent = `${formatShortDate(state.dateFrom)} – ${formatShortDate(state.dateTo)}`;
    document.querySelectorAll('#range-buttons button').forEach(button => button.classList.toggle('active', Number(button.dataset.days) === days));
  }

  function formatShortDate(value) {
    const date = new Date(`${value}T00:00:00`);
    return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short' }).format(date);
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function flag(code) {
    const clean = String(code || '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(clean)) return '🌐';
    return String.fromCodePoint(...[...clean].map(char => 127397 + char.charCodeAt(0)));
  }

  function maskIp(ip) {
    const value = String(ip || '');
    if (!value) return '—';
    if (value.includes(':')) {
      const parts = value.split(':').filter(Boolean);
      return parts.length ? `${parts.slice(0, 2).join(':')}:…` : 'IPv6';
    }
    const parts = value.split('.');
    return parts.length === 4 ? `${parts[0]}.${parts[1]}.***.***` : value;
  }

  async function api(path) {
    const res = await fetch(path, { headers: authHeaders() });
    if (res.status === 401) {
      localStorage.removeItem('inv_token');
      location.href = '/login.html';
      throw new Error('Unauthorized');
    }
    if (res.status === 403) {
      location.href = '/';
      throw new Error('Admin only');
    }
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
    return body;
  }

  function analyticsParams(extra = {}) {
    return new URLSearchParams({ dateFrom: state.dateFrom, dateTo: state.dateTo, ...extra });
  }

  async function loadAllRows() {
    const first = await api(`/api/admin/analytics/visitors?${analyticsParams({ page: 1, limit: 100 })}`);
    const rows = [...(first.items || [])];
    const pages = Math.min(100, Math.ceil((first.total || rows.length) / 100));
    if (pages > 1) {
      const requests = [];
      for (let page = 2; page <= pages; page++) {
        requests.push(api(`/api/admin/analytics/visitors?${analyticsParams({ page, limit: 100 })}`));
      }
      const results = await Promise.all(requests);
      results.forEach(result => rows.push(...(result.items || [])));
    }
    state.summary = first.summary || {};
    state.rows = rows;
  }

  function buildDailyTrend() {
    const byDay = new Map();
    for (let index = 0; index < state.days; index++) {
      const date = new Date(`${state.dateFrom}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() + index);
      const day = isoDay(date);
      byDay.set(day, { day, firstSeen: 0, lastSeen: 0 });
    }
    state.rows.forEach(row => {
      const firstDay = String(row.firstSeen || '').slice(0, 10);
      const lastDay = String(row.lastSeen || '').slice(0, 10);
      if (byDay.has(firstDay)) byDay.get(firstDay).firstSeen += 1;
      if (byDay.has(lastDay)) byDay.get(lastDay).lastSeen += 1;
    });
    state.daily = [...byDay.values()];
  }

  function renderSummary() {
    const s = state.summary || {};
    const cards = [
      ['Уникальные', s.uniqueVisitors || 0, 'посетителей'],
      ['Возвращались', s.returningVisitors || 0, 'повторные визиты'],
      ['Сессии', s.sessions || 0, 'сеансов'],
      ['Просмотры', s.pageViews || 0, 'страниц'],
      ['Ассистент', s.assistantUsers || 0, 'пользователей'],
      ['Контакты', s.contactClicks || 0, 'кликов'],
    ];
    document.getElementById('visitor-summary').innerHTML = cards.map(([label, value, note]) => `
      <article class="visitor-summary-card">
        <span>${escapeHtml(label)}</span>
        <strong>${Number(value).toLocaleString('ru-RU')}</strong>
        <small>${escapeHtml(note)}</small>
      </article>
    `).join('');
  }

  function countBy(values) {
    const map = new Map();
    values.filter(Boolean).forEach(value => map.set(value, (map.get(value) || 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
  }

  function renderRankList(containerId, entries, total, formatter = value => value, limit = 7) {
    const container = document.getElementById(containerId);
    const visible = entries.slice(0, limit);
    container.innerHTML = visible.length ? visible.map(([value, count], index) => {
      const pct = total ? Math.round(count / total * 100) : 0;
      return `
        <div class="rank-row">
          <span class="rank-index">${index + 1}</span>
          <span class="rank-name">${formatter(value)}</span>
          <span class="rank-bar"><i style="width:${Math.max(4, pct)}%"></i></span>
          <strong>${count}</strong>
          <small>${pct}%</small>
        </div>
      `;
    }).join('') : '<div class="visitor-empty">Пока нет данных.</div>';
  }

  function renderBreakdowns() {
    const rows = state.rows;
    const total = rows.length || 1;
    const countries = countBy(rows.map(row => row.geo?.country || 'Unknown'));
    const cities = countBy(rows.map(row => row.geo?.city || (row.geo?.country === 'Unknown' ? 'Unknown' : '')).filter(Boolean));
    const devices = countBy(rows.map(row => row.device || 'unknown'));
    const locales = countBy(rows.map(row => (row.locale || 'unknown').toUpperCase()));
    const models = countBy(rows.flatMap(row => row.modelsViewed || []));

    renderRankList('visitor-countries', countries, total, value => {
      const row = rows.find(item => (item.geo?.country || 'Unknown') === value);
      return `${flag(row?.geo?.countryCode)} ${escapeHtml(value === 'Unknown' ? 'Не определено' : value)}`;
    }, 6);
    renderRankList('visitor-cities', cities, total, value => escapeHtml(value === 'Unknown' ? 'Не определено' : value), 8);
    renderRankList('visitor-devices', devices, total, value => escapeHtml(value === 'mobile' ? 'Mobile' : value === 'desktop' ? 'Desktop' : value), 5);
    renderRankList('visitor-locales', locales, total, value => escapeHtml(value), 5);
    renderRankList('visitor-models', models, total, value => escapeHtml(modelLabel(value)), 6);

    const countryLabels = countries.slice(0, 6).map(([name]) => name === 'Unknown' ? 'Не определено' : name);
    const countryData = countries.slice(0, 6).map(([, count]) => count);
    renderDoughnut('country', 'visitor-country-chart', countryLabels, countryData);

    renderDoughnut('device', 'visitor-device-chart', devices.map(([name]) => name), devices.map(([, count]) => count));
  }

  function modelLabel(value) {
    return ({ light2: 'Light 2', mini3: 'Mini 3', miniPro: 'Mini 3 Pro', midi: 'Midi', street: 'Street' })[value] || value;
  }

  function renderDoughnut(key, canvasId, labels, data) {
    if (charts[key]) charts[key].destroy();
    charts[key] = new Chart(document.getElementById(canvasId), {
      type: 'doughnut',
      data: { labels, datasets: [{ data, borderWidth: 0 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.raw}` } } },
      },
    });
  }

  function renderTrend() {
    if (charts.trend) charts.trend.destroy();
    charts.trend = new Chart(document.getElementById('visitor-trend-chart'), {
      type: 'line',
      data: {
        labels: state.daily.map(item => formatShortDate(item.day)),
        datasets: [
          {
            label: 'Новые посетители',
            data: state.daily.map(item => item.firstSeen || 0),
            borderWidth: 2,
            tension: 0.3,
            fill: false,
          },
          {
            label: 'Последняя активность',
            data: state.daily.map(item => item.lastSeen || 0),
            borderWidth: 2,
            tension: 0.3,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 10 } } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: 'rgba(148, 163, 184, .2)' } },
          x: { grid: { display: false } },
        },
      },
    });
  }

  function actionBadges(row) {
    const badges = [];
    if (row.assistantQuestionCount) badges.push(`<span class="action-badge assistant">Ассистент ${row.assistantQuestionCount}</span>`);
    if (row.contactClickCount) badges.push(`<span class="action-badge contact">Контакт ${row.contactClickCount}</span>`);
    if (!badges.length) badges.push('<span class="action-badge muted">Просмотр</span>');
    return badges.join(' ');
  }

  function filterRows() {
    const q = state.search.trim().toLowerCase();
    state.filteredRows = !q ? [...state.rows] : state.rows.filter(row => {
      const haystack = [
        row.visitorId,
        ...(row.ips || []),
        row.geo?.country,
        row.geo?.city,
        row.geo?.isp,
        row.locale,
        row.device,
        ...(row.modelsViewed || []),
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });
    state.page = 1;
    renderTable();
  }

  function renderTable() {
    const rows = state.filteredRows.length || state.search ? state.filteredRows : state.rows;
    const totalPages = Math.max(1, Math.ceil(rows.length / state.pageSize));
    state.page = Math.min(state.page, totalPages);
    const start = (state.page - 1) * state.pageSize;
    const visible = rows.slice(start, start + state.pageSize);
    document.getElementById('visitor-table-subtitle').textContent = `${rows.length} посетителей · период ${state.days} дней`;
    document.getElementById('visitor-tbody').innerHTML = visible.length ? visible.map(row => {
      const country = row.geo?.country && row.geo.country !== 'Unknown' ? row.geo.country : 'Не определено';
      const place = [row.geo?.city, country].filter(Boolean).join(', ');
      const latestIp = row.latestIp || row.ips?.[0] || '';
      const models = (row.modelsViewed || []).map(modelLabel).join(', ') || '—';
      return `
        <tr class="visitor-row" data-visitor-id="${escapeHtml(row.visitorId)}" tabindex="0">
          <td><strong>${formatDateTime(row.lastSeen)}</strong><small class="cell-sub">${maskIp(latestIp)}</small></td>
          <td><span>${flag(row.geo?.countryCode)} ${escapeHtml(place)}</span><small class="cell-sub">${escapeHtml(row.geo?.isp || '')}</small></td>
          <td><span class="device-pill">${escapeHtml(row.device || 'unknown')}</span><small class="cell-sub">${escapeHtml((row.locale || '').toUpperCase())}</small></td>
          <td><strong>${row.visitCount || 0}</strong><small class="cell-sub">${row.sessionCount || 0} сесс.</small></td>
          <td class="models-cell">${escapeHtml(models)}</td>
          <td>${actionBadges(row)}</td>
        </tr>
      `;
    }).join('') : '<tr><td colspan="6"><div class="visitor-empty">Ничего не найдено.</div></td></tr>';

    document.querySelectorAll('.visitor-row').forEach(row => {
      const open = () => openVisitor(row.dataset.visitorId);
      row.addEventListener('click', open);
      row.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') open(); });
    });

    renderPagination(totalPages);
  }

  function renderPagination(totalPages) {
    const container = document.getElementById('visitor-pagination');
    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }
    const pages = [];
    for (let page = 1; page <= totalPages; page++) {
      if (page === 1 || page === totalPages || Math.abs(page - state.page) <= 2) pages.push(page);
    }
    const unique = [...new Set(pages)];
    container.innerHTML = unique.map((page, index) => {
      const previous = unique[index - 1];
      const gap = previous && page - previous > 1 ? '<span>…</span>' : '';
      return `${gap}<button type="button" data-page="${page}" class="${page === state.page ? 'active' : ''}">${page}</button>`;
    }).join('');
    container.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
      state.page = Number(button.dataset.page);
      renderTable();
      document.querySelector('.visitor-table-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }

  async function openVisitor(visitorId) {
    const drawer = document.getElementById('visitor-drawer');
    const backdrop = document.getElementById('visitor-drawer-backdrop');
    document.getElementById('drawer-title').textContent = visitorId.slice(0, 22);
    document.getElementById('drawer-content').innerHTML = '<div class="drawer-loading">Загрузка истории…</div>';
    backdrop.hidden = false;
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    try {
      const detail = await api(`/api/admin/analytics/visitors/${encodeURIComponent(visitorId)}?${analyticsParams({ limit: 500 })}`);
      const sessions = detail.sessions || [];
      document.getElementById('drawer-content').innerHTML = `
        <div class="drawer-profile">
          <div><span>Первый визит</span><strong>${formatDateTime(detail.firstSeen)}</strong></div>
          <div><span>Последний визит</span><strong>${formatDateTime(detail.lastSeen)}</strong></div>
          <div><span>Сессии</span><strong>${detail.sessionCount || 0}</strong></div>
          <div><span>События</span><strong>${detail.eventCount || 0}</strong></div>
        </div>
        <div class="drawer-location">${flag(detail.geo?.countryCode)} ${escapeHtml([detail.geo?.city, detail.geo?.country === 'Unknown' ? 'Не определено' : detail.geo?.country].filter(Boolean).join(', '))}${detail.geo?.isp ? ` · ${escapeHtml(detail.geo.isp)}` : ''}</div>
        <div class="drawer-ip-list"><strong>IP:</strong> ${(detail.ips || []).map(ip => `<code>${escapeHtml(ip)}</code>`).join(' ') || '—'}</div>
        <div class="timeline">
          ${sessions.slice().reverse().map(session => `
            <section class="timeline-session">
              <h3>Сессия · ${escapeHtml(session.sessionId.slice(-10))}</h3>
              ${(session.events || []).slice().reverse().map(event => `
                <div class="timeline-event">
                  <time>${formatDateTime(event.timestamp)}</time>
                  <div><strong>${escapeHtml(event.label || event.eventType)}</strong>${event.page ? `<small>${escapeHtml(event.page)}</small>` : ''}${event.modelId ? `<span class="timeline-tag">${escapeHtml(modelLabel(event.modelId))}${event.color ? ` · ${escapeHtml(event.color)}` : ''}</span>` : ''}</div>
                </div>
              `).join('')}
            </section>
          `).join('')}
        </div>
      `;
    } catch (err) {
      document.getElementById('drawer-content').innerHTML = `<div class="error">Не удалось загрузить историю: ${escapeHtml(err.message)}</div>`;
    }
  }

  function closeDrawer() {
    const drawer = document.getElementById('visitor-drawer');
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    document.getElementById('visitor-drawer-backdrop').hidden = true;
  }

  async function loadAnalytics() {
    const status = document.getElementById('visitor-status');
    status.textContent = 'Загрузка…';
    document.getElementById('visitor-refresh').disabled = true;
    try {
      await loadAllRows();
      buildDailyTrend();
      state.filteredRows = [...state.rows];
      renderSummary();
      renderTrend();
      renderBreakdowns();
      renderTable();
      const unknown = state.rows.filter(row => !row.geo?.country || row.geo.country === 'Unknown').length;
      status.textContent = unknown && state.rows.length ? `Обновлено · гео не определено у ${unknown}` : 'Обновлено';
    } catch (err) {
      status.textContent = 'Ошибка';
      document.querySelector('.visitor-shell').insertAdjacentHTML('afterbegin', `<div class="error visitor-load-error">Не удалось загрузить аналитику: ${escapeHtml(err.message)}</div>`);
    } finally {
      document.getElementById('visitor-refresh').disabled = false;
    }
  }

  document.querySelectorAll('#range-buttons button').forEach(button => button.addEventListener('click', () => {
    setRange(Number(button.dataset.days));
    loadAnalytics();
  }));
  document.getElementById('visitor-refresh').addEventListener('click', loadAnalytics);
  document.getElementById('visitor-search').addEventListener('input', event => {
    state.search = event.target.value;
    filterRows();
  });
  document.getElementById('drawer-close').addEventListener('click', closeDrawer);
  document.getElementById('visitor-drawer-backdrop').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeDrawer(); });
  document.getElementById('visitor-logout').addEventListener('click', () => {
    localStorage.removeItem('inv_token');
    localStorage.removeItem('inv_role');
    localStorage.removeItem('inv_username');
    location.href = '/login.html';
  });

  setRange(30);
  loadAnalytics();
} else {
const METRICS = {
  revenue: { label: 'Revenue', color: '#2563eb', money: true },
  profit: { label: 'Profit', color: '#16a34a', money: true },
  cost: { label: 'Cost', color: '#f59e0b', money: true },
  qty: { label: 'Sold pcs', color: '#7c3aed', money: false },
  marginPct: { label: 'Margin %', color: '#db2777', money: false, percent: true },
};
const PERIODS = {
  month: 'Month',
  quarter: 'Quarter',
  year: 'Year',
};
const fmtMoney = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'EUR' });
const fmtNumber = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });

let selectedMetric = 'revenue';
let groupBy = 'month';
let selectedYears = [];
let availableYears = [];
let report = null;
let chart = null;

const token = localStorage.getItem('inv_token');
const role = localStorage.getItem('inv_role');
const username = localStorage.getItem('inv_username');

if (!token) location.href = '/login.html';
document.getElementById('report-user').textContent = username ? `${username} · ${role || 'user'}` : role || '';

function authHeaders() {
  return { Authorization: `Bearer ${token}` };
}

function formatMetric(value, key = selectedMetric) {
  const metric = METRICS[key];
  if (metric?.money) return fmtMoney.format(Number(value) || 0);
  if (metric?.percent) return `${fmtNumber.format(Number(value) || 0)} %`;
  return fmtNumber.format(Number(value) || 0);
}

function renderButtons(containerId, items, active, handler) {
  const container = document.getElementById(containerId);
  container.innerHTML = Object.entries(items).map(([key, value]) => `
    <button class="filter-btn ${key === active ? 'active' : ''}" type="button" data-key="${key}">
      ${value.label || value}
    </button>
  `).join('');
  container.querySelectorAll('button').forEach(button => {
    button.addEventListener('click', () => handler(button.dataset.key));
  });
}

function renderMetricFilter() {
  renderButtons('metric-filter', METRICS, selectedMetric, key => {
    selectedMetric = key;
    renderAll();
  });
}

function renderPeriodFilter() {
  renderButtons('period-filter', PERIODS, groupBy, key => {
    groupBy = key;
    loadReport();
  });
}

function renderYearFilter() {
  const container = document.getElementById('year-filter');
  container.innerHTML = availableYears.map(year => `
    <button class="year-btn ${selectedYears.includes(year) ? 'active' : ''}" type="button" data-year="${year}">
      ${year}
    </button>
  `).join('');
  container.querySelectorAll('button').forEach(button => {
    button.addEventListener('click', () => {
      const year = Number(button.dataset.year);
      selectedYears = selectedYears.includes(year)
        ? selectedYears.filter(value => value !== year)
        : [...selectedYears, year].sort((a, b) => a - b);
      if (!selectedYears.length) selectedYears = [year];
      loadReport();
    });
  });
}

async function loadReport() {
  setSubtitle('Loading report...');
  try {
    const params = new URLSearchParams({ groupBy });
    if (selectedYears.length) params.set('years', selectedYears.join(','));
    const res = await fetch(`/api/reports/sales?${params}`, { headers: authHeaders() });
    if (res.status === 401) {
      localStorage.removeItem('inv_token');
      location.href = '/login.html';
      return;
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    report = data;
    availableYears = data.availableYears?.length ? data.availableYears : data.years;
    selectedYears = data.years;
    renderAll();
  } catch (err) {
    document.querySelector('.reports-shell').innerHTML = `<div class="error">Could not load report: ${escapeHtml(err.message)}</div>`;
  }
}

function renderAll() {
  renderMetricFilter();
  renderPeriodFilter();
  renderYearFilter();
  renderSummary();
  renderChart();
  renderTable();
  setSubtitle(`${PERIODS[groupBy]} view · ${selectedYears.join(', ') || 'No year selected'}`);
}

function renderSummary() {
  const totals = report?.totals || {};
  const cards = [
    ['Revenue', formatMetric(totals.revenue, 'revenue'), 'Paid by clients'],
    ['Profit', formatMetric(totals.profit, 'profit'), 'After FIFO cost'],
    ['Sold', formatMetric(totals.qty, 'qty'), 'Total pieces'],
    ['Avg margin', formatMetric(totals.marginPct, 'marginPct'), 'Profit / revenue'],
  ];
  document.getElementById('summary-grid').innerHTML = cards.map(([label, value, note]) => `
    <article class="summary-card">
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${note}</small>
    </article>
  `).join('');
}

function rowsByYear(year) {
  return (report?.rows || []).filter(row => Number(row.year) === Number(year));
}

function renderChart() {
  const ctx = document.getElementById('sales-chart');
  const empty = document.getElementById('empty-state');
  const labels = report?.periods?.map(period => period.label) || [];
  const hasData = (report?.rows || []).some(row => Number(row.revenue) || Number(row.profit) || Number(row.cost) || Number(row.qty));
  empty.hidden = hasData;

  const palette = ['#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#db2777', '#0891b2'];
  const datasets = selectedYears.map((year, index) => ({
    label: `${year} · ${METRICS[selectedMetric].label}`,
    data: rowsByYear(year).map(row => Number(row[selectedMetric]) || 0),
    borderColor: palette[index % palette.length],
    backgroundColor: palette[index % palette.length] + '33',
    borderWidth: 2,
    tension: 0.32,
    fill: groupBy === 'year' ? true : false,
  }));

  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: selectedMetric === 'marginPct' ? 'line' : 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } },
        tooltip: {
          callbacks: {
            afterBody(items) {
              const item = items[0];
              const year = selectedYears[item.datasetIndex];
              const row = rowsByYear(year)[item.dataIndex];
              if (!row) return [];
              return [
                `Revenue: ${formatMetric(row.revenue, 'revenue')}`,
                `Profit: ${formatMetric(row.profit, 'profit')}`,
                `Cost: ${formatMetric(row.cost, 'cost')}`,
                `Sold: ${formatMetric(row.qty, 'qty')}`,
                `Margin: ${formatMetric(row.marginPct, 'marginPct')}`,
              ];
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: value => formatMetric(value) },
          grid: { color: 'rgba(148, 163, 184, .22)' },
        },
        x: { grid: { display: false } },
      },
    },
  });
}

function renderTable() {
  const rows = [...(report?.rows || [])].sort((a, b) => b.year - a.year || String(a.period).localeCompare(String(b.period)));
  document.getElementById('report-tbody').innerHTML = rows.length
    ? rows.map(row => `
      <tr>
        <td><strong>${row.year}</strong></td>
        <td>${row.label}</td>
        <td>${formatMetric(row.revenue, 'revenue')}</td>
        <td>${formatMetric(row.profit, 'profit')}</td>
        <td>${formatMetric(row.cost, 'cost')}</td>
        <td>${formatMetric(row.qty, 'qty')}</td>
        <td>${formatMetric(row.marginPct, 'marginPct')}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="7">No report rows.</td></tr>';
}

function setSubtitle(value) {
  document.getElementById('report-subtitle').textContent = value;
}

function escapeHtml(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

document.getElementById('refresh-btn').addEventListener('click', loadReport);
document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('inv_token');
  localStorage.removeItem('inv_role');
  localStorage.removeItem('inv_username');
  location.href = '/login.html';
});

renderMetricFilter();
renderPeriodFilter();
loadReport();
}
