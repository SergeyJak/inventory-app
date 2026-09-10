(() => {
  const loadScript = (src, onload) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = onload || null;
    script.onerror = () => console.error(`Failed to load ${src}`);
    document.body.appendChild(script);
  };

  loadScript('/catalog-core.js?v=20260910-yandex-plus', () => {
    loadScript('/yandex-plus-offer.js?v=20260910-yandex-plus');
  });
})();
