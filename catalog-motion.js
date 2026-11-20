(function initLivingCatalog(root) {
  'use strict';

  const section = document.getElementById('living-scenes');
  if (!section) return;

  const stage = section.querySelector('.living-stage');
  const image = section.querySelector('#living-scene-image');
  const label = section.querySelector('#living-scene-label');
  const title = section.querySelector('#living-scene-title');
  const description = section.querySelector('#living-scene-description');
  const command = section.querySelector('#living-scene-command');
  const caveat = section.querySelector('#living-scene-note');
  const link = section.querySelector('#living-scene-link');
  const buttons = [...section.querySelectorAll('[data-living-scene]')];
  const pause = section.querySelector('#living-pause');
  const accessibleStatus = section.querySelector('#living-status');
  const reduceMotion = root.matchMedia('(prefers-reduced-motion: reduce)');
  const scenes = [
    { id: 'morning', model: 'light2', image: '/images/catalog/light-2/blue/01.webp',
      slug: 'lite-2' },
    { id: 'music', model: 'mini3', image: '/images/catalog/mini-3/gray/01.webp',
      slug: 'mini-3' },
    { id: 'home', model: 'miniPro', image: '/images/catalog/mini-pro/green/01.webp',
      slug: 'mini-3-pro' },
    { id: 'travel', model: 'street', image: '/images/catalog/street/black/01.webp',
      slug: 'street' },
  ];
  const DURATION = 7800;
  let active = 0;
  let visible = false;
  let manualPaused = false;
  let pausedByHover = false;
  let pausedByFocus = false;
  let timer = null;
  let imageRequest = 0;
  let imageTransitionTimer = null;

  const locale = () => {
    const lang = document.documentElement.lang;
    return ['ru', 'lv', 'en'].includes(lang) ? lang : 'ru';
  };
  const t = () => root.catalogTranslations?.[locale()]?.sections?.living
    || root.catalogTranslations?.ru?.sections?.living || null;
  // Keep the server-rendered scene and finder link if a cached dictionary predates this feature.
  if (!t()) return;
  const controls = section.querySelector('#living-controls');
  controls.hidden = false;

  function stockStatus(modelId) {
    if (root.heysmartLiveProductsVerified !== true) return 'unknown';
    const offer = document.querySelector('[data-quick-model="' + modelId + '"] .quick-offer');
    return offer?.dataset.status === 'available' ? 'available' : 'unavailable';
  }
  function sceneLink(scene, translation) {
    if (!translation) return;
    const available = stockStatus(scene.model) === 'available';
    link.href = available
      ? '/' + (locale() === 'en' ? 'en' : 'ru') + '/yandex-station-' + scene.slug
      : '#smart-finder';
    link.textContent = available ? translation.open : translation.findStock;
    link.dataset.stockStatus = available ? 'available' : 'other';
  }
  function paintImage(scene, animate) {
    const request = ++imageRequest;
    if (imageTransitionTimer !== null) {
      clearTimeout(imageTransitionTimer);
      imageTransitionTimer = null;
    }
    if (image.getAttribute('src') === scene.image) {
      image.classList.remove('is-changing');
      return;
    }
    if (!animate || reduceMotion.matches) {
      image.classList.remove('is-changing');
      image.src = scene.image;
      return;
    }
    const next = new Image();
    next.decoding = 'async';
    next.onload = () => {
      if (request !== imageRequest) return;
      image.classList.add('is-changing');
      imageTransitionTimer = root.setTimeout(() => {
        image.src = scene.image;
        image.classList.remove('is-changing');
        imageTransitionTimer = null;
      }, 140);
    };
    next.onerror = () => {
      if (request !== imageRequest) return;
      image.classList.remove('is-changing');
      image.src = scene.image;
    };
    next.src = scene.image;
  }
  function updateScene(index, { userInitiated = false, animate = true } = {}) {
    const translation = t();
    if (!translation) return;
    controls.setAttribute('aria-label', translation.controls);
    active = (index + scenes.length) % scenes.length;
    const scene = scenes[active];
    const words = translation.scenes[scene.id];
    stage.dataset.scene = scene.id;
    label.textContent = words.label;
    title.textContent = words.title;
    description.textContent = words.description;
    command.textContent = words.command;
    caveat.textContent = words.note;
    image.alt = words.imageAlt;
    paintImage(scene, animate);
    buttons.forEach((button, buttonIndex) => {
      const selected = buttonIndex === active;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('active', selected);
      button.querySelector('.living-option-name').textContent = translation.scenes[scenes[buttonIndex].id].short;
    });
    sceneLink(scene, translation);
    if (userInitiated) {
      accessibleStatus.textContent = words.title;
      try { root.gtag?.('event', 'living_scene_select', { scenario: scene.id, locale: locale() }); } catch {}
    }
    syncTimer();
  }
  function canPlay() {
    return !manualPaused && !reduceMotion.matches && visible && !document.hidden && !pausedByHover && !pausedByFocus;
  }
  function syncTimer() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    const playing = canPlay();
    section.classList.toggle('living-playing', playing);
    pause.hidden = reduceMotion.matches;
    pause.textContent = manualPaused ? (t()?.resume || 'Play') : (t()?.pause || 'Pause');
    pause.setAttribute('aria-pressed', String(manualPaused));
    if (playing) timer = root.setTimeout(() => updateScene(active + 1), DURATION);
  }

  buttons.forEach((button, index) => button.addEventListener('click', () => {
    updateScene(index, { userInitiated: true });
  }));
  pause.addEventListener('click', () => {
    manualPaused = !manualPaused;
    if (!manualPaused) {
      // Resume immediately. A later pointer entry or focus change can pause again.
      pausedByHover = false;
      pausedByFocus = false;
    }
    syncTimer();
  });
  section.addEventListener('pointerenter', () => { pausedByHover = true; syncTimer(); });
  section.addEventListener('pointerleave', () => { pausedByHover = false; syncTimer(); });
  section.addEventListener('focusin', () => { pausedByFocus = true; syncTimer(); });
  section.addEventListener('focusout', event => {
    if (!section.contains(event.relatedTarget)) { pausedByFocus = false; syncTimer(); }
  });
  root.addEventListener('heysmart:catalog-products', () => sceneLink(scenes[active], t()));
  root.addEventListener('heysmart:catalog-products-error', () => sceneLink(scenes[active], t()));
  document.addEventListener('visibilitychange', syncTimer);
  reduceMotion.addEventListener?.('change', syncTimer);
  new MutationObserver(changes => {
    if (changes.some(change => change.attributeName === 'lang')) {
      updateScene(active, { animate: false });
    }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  if ('IntersectionObserver' in root) {
    const sceneObserver = new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting || false;
      syncTimer();
    }, { threshold: 0.25 });
    sceneObserver.observe(section);
  } else {
    visible = true;
  }

  // Progressive enhancement: text and imagery are visible even with JavaScript disabled.
  // Only animate non-critical sections; never hide content when reduced motion is requested.
  if ('IntersectionObserver' in root && !reduceMotion.matches) {
    const candidates = document.querySelectorAll('.quick-card, .local-info-grid article, .purchase-faq-list article, .smart-finder-inner');
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('motion-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -35px 0px', threshold: 0.06 });
    candidates.forEach(node => {
      // Keep above-the-fold / already visible nodes visible without a one-frame flash.
      if (node.getBoundingClientRect().top < root.innerHeight * 0.95) return;
      node.classList.add('motion-reveal');
      revealObserver.observe(node);
    });
    document.documentElement.classList.add('motion-enhanced');
  }
  updateScene(0, { animate: false });
})(typeof window !== 'undefined' ? window : globalThis);
