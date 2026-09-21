(() => {
  const TYPE_VALUE = 'setup_subscription';
  const TYPE_LABEL = 'Setup + Subscription';
  const byId = id => document.getElementById(id);

  function ensureComboOption() {
    const select = byId('income-type');
    if (!select || select.querySelector(`option[value="${TYPE_VALUE}"]`)) return;
    const option = document.createElement('option');
    option.value = TYPE_VALUE;
    option.textContent = TYPE_LABEL;
    const other = select.querySelector('option[value="other"]');
    select.insertBefore(option, other || null);
  }

  window.addEventListener('DOMContentLoaded', ensureComboOption);
})();
