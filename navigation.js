// ========== ROLE-AWARE NAVIGATION ==========
const NAVIGATION_GROUPS = [
  {
    id: 'overview',
    label: 'Обзор',
    items: [
      { id: 'dashboard', label: 'Дашборд', icon: '⌂', tab: 'dashboard' },
    ],
  },
  {
    id: 'commerce',
    label: 'Торговля',
    items: [
      { id: 'products', label: 'Товары', icon: '▦', tab: 'products' },
      { id: 'sales', label: 'Продажи', icon: '€', tab: 'sales' },
      { id: 'restock', label: 'Поступления', icon: '↓', tab: 'restock' },
      { id: 'history', label: 'История', icon: '↺', tab: 'history' },
    ],
  },
  {
    id: 'analytics',
    label: 'Аналитика',
    items: [
      { id: 'annual', label: 'Годовая отчётность', icon: '▥', tab: 'annual' },
      { id: 'reports', label: 'Analytics', icon: '⌁', href: '/reports' },
    ],
  },
  {
    id: 'finance',
    label: 'Финансы',
    items: [
      { id: 'andrey', label: 'Вернуть Андрею', icon: '↗', dashboardView: 'andrey' },
    ],
  },
  {
    id: 'subscriptions',
    label: 'Подписки',
    roles: ['admin'],
    items: [
      { id: 'accounts', label: 'Аккаунты', icon: '◎', tab: 'accounts', roles: ['admin'] },
    ],
  },
  {
    id: 'heysmart',
    label: 'HeySmart',
    roles: ['admin'],
    items: [
      { id: 'assistant-questions', label: 'Ассистент', icon: '✦', tab: 'assistant-questions', roles: ['admin'] },
      { id: 'visitor-activity', label: 'Посетители', icon: '◉', tab: 'visitor-activity', roles: ['admin'] },
      { id: 'mail-accounts', label: 'Почта', icon: '✉', tab: 'mail-accounts', roles: ['admin'] },
    ],
  },
  {
    id: 'system',
    label: 'Система',
    roles: ['admin'],
    items: [
      { id: 'backups', label: 'Резервные копии', icon: '▣', tab: 'backups', roles: ['admin'] },
    ],
  },
];

const MOBILE_PRIMARY_IDS = ['dashboard', 'products', 'sales'];

function roleAllows(entry, role) {
  return !entry.roles || entry.roles.includes(role);
}

function navigationForRole(role) {
  return NAVIGATION_GROUPS
    .filter(group => roleAllows(group, role))
    .map(group => ({
      ...group,
      items: group.items.filter(item => roleAllows(item, role)),
    }))
    .filter(group => group.items.length > 0);
}

function navigationItemMarkup(item, extraClass = '') {
  const attrs = item.href
    ? 'href="' + item.href + '"'
    : 'href="#" data-nav-id="' + item.id + '"';
  return '<a class="app-nav-item ' + extraClass + '" ' + attrs + '>'
    + '<span class="app-nav-icon" aria-hidden="true">' + item.icon + '</span>'
    + '<span>' + item.label + '</span>'
    + '</a>';
}

function renderRoleNavigation(role) {
  const groups = navigationForRole(role);
  const desktop = document.getElementById('desktop-navigation');
  const drawer = document.getElementById('mobile-navigation-drawer');
  const mobilePrimary = document.getElementById('mobile-primary-navigation');

  const groupedMarkup = groups.map(group =>
    '<section class="app-nav-group" data-nav-group="' + group.id + '">'
      + '<div class="app-nav-group-label">' + group.label + '</div>'
      + group.items.map(item => navigationItemMarkup(item)).join('')
      + '</section>'
  ).join('');

  if (desktop) desktop.innerHTML = groupedMarkup;
  if (drawer) drawer.innerHTML = groupedMarkup;

  const allItems = groups.flatMap(group => group.items);
  if (mobilePrimary) {
    const primary = MOBILE_PRIMARY_IDS
      .map(id => allItems.find(item => item.id === id))
      .filter(Boolean);

    mobilePrimary.innerHTML = primary.map(item => navigationItemMarkup(item, 'mobile-primary-item')).join('')
      + '<button class="app-nav-item mobile-primary-item mobile-more-button" type="button" id="mobile-more-button" aria-expanded="false" aria-controls="mobile-nav-panel">'
      + '<span class="app-nav-icon" aria-hidden="true">☰</span><span>Ещё</span></button>';
  }
}

window.InventoryNavigation = {
  groups: NAVIGATION_GROUPS,
  forRole: navigationForRole,
  render: renderRoleNavigation,
};
