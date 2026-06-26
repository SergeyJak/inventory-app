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
