// ========== SHARED INTERNAL NAVIGATION SHELL ==========
(function () {
  const role = localStorage.getItem('inv_role') || 'viewer';
  const username = localStorage.getItem('inv_username') || '';
  const token = localStorage.getItem('inv_token');

  if (!token) {
    location.href = '/login.html';
    return;
  }

  if (!window.InventoryNavigation) {
    console.error('InventoryNavigation is not loaded');
    return;
  }

  const groups = window.InventoryNavigation.forRole(role);

  function destination(item) {
    if (item.href) return item.href;
    return '/#/' + encodeURIComponent(item.id);
  }

  function itemMarkup(item) {
    const href = destination(item);
    const currentPath = location.pathname;
    const currentId = document.body.dataset.navId || '';
    const active = item.id === currentId
      || (item.id === 'reports' && currentPath === '/reports')
      || (item.id === 'finance' && currentPath === '/finance');

    return '<a class="global-nav-item' + (active ? ' active' : '') + '" href="' + href + '">'
      + '<span class="global-nav-icon" aria-hidden="true">' + item.icon + '</span>'
      + '<span>' + item.label + '</span>'
      + '</a>';
  }

  const groupedMarkup = groups.map(group =>
    '<section class="global-nav-group">'
      + '<div class="global-nav-label">' + group.label + '</div>'
      + group.items.map(itemMarkup).join('')
      + '</section>'
  ).join('');

  const existingHeader = document.querySelector('body > header');
  if (existingHeader) existingHeader.classList.add('legacy-page-header');

  const shell = document.createElement('div');
  shell.className = 'global-shell';
  shell.innerHTML =
    '<header class="global-header">'
      + '<button class="global-menu-button" id="global-menu-button" type="button" aria-label="Открыть меню" aria-expanded="false">☰</button>'
      + '<a class="global-brand" href="/#/dashboard">📦 Inventory</a>'
      + '<div class="global-header-actions">'
        + '<span class="global-user">' + username + '</span>'
        + '<button class="global-logout" id="global-logout" type="button">→ Выйти</button>'
      + '</div>'
    + '</header>'
    + '<aside class="global-sidebar" aria-label="Основная навигация">'
      + '<div class="global-sidebar-brand">Inventory</div>'
      + '<nav class="global-navigation">' + groupedMarkup + '</nav>'
    + '</aside>'
    + '<div class="global-backdrop" id="global-backdrop" hidden></div>'
    + '<aside class="global-drawer" id="global-drawer" aria-label="Мобильная навигация" aria-hidden="true">'
      + '<div class="global-drawer-head"><strong>Навигация</strong><button id="global-drawer-close" type="button" aria-label="Закрыть меню">×</button></div>'
      + '<nav class="global-navigation">' + groupedMarkup + '</nav>'
    + '</aside>';

  document.body.prepend(shell);
  document.body.classList.add('with-global-navigation');

  const drawer = document.getElementById('global-drawer');
  const backdrop = document.getElementById('global-backdrop');
  const menuButton = document.getElementById('global-menu-button');

  function closeDrawer() {
    drawer?.classList.remove('open');
    drawer?.setAttribute('aria-hidden', 'true');
    backdrop?.classList.remove('open');
    if (backdrop) backdrop.hidden = true;
    menuButton?.setAttribute('aria-expanded', 'false');
  }

  function openDrawer() {
    if (backdrop) {
      backdrop.hidden = false;
      backdrop.classList.add('open');
    }
    drawer?.classList.add('open');
    drawer?.setAttribute('aria-hidden', 'false');
    menuButton?.setAttribute('aria-expanded', 'true');
  }

  menuButton?.addEventListener('click', openDrawer);
  document.getElementById('global-drawer-close')?.addEventListener('click', closeDrawer);
  backdrop?.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeDrawer();
  });

  document.getElementById('global-logout')?.addEventListener('click', () => {
    localStorage.removeItem('inv_token');
    localStorage.removeItem('inv_role');
    localStorage.removeItem('inv_username');
    location.href = '/login.html';
  });
})();
