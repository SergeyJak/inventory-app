/* Contact intent handling shared by the HeySmart assistant. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HeySmartAssistantHandoff = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const patterns = [
    /(?:оператор|менеджер|консультант|сотрудник|поддержк)/i,
    /(?:реальн\w*|жив\w*)\s+человек/i,
    /поговорить\s+(?:с\s+)?(?:человеком|менеджером|оператором)/i,
    /(?:номер\s+)?телефон(?:а|у|ом)?|позвонить|связаться|контакт(?:ы|ный)?/i,
    /whats\s?app|telegram|ватсап|телеграм/i,
    /\b(?:human|operator|agent|representative|phone|contact|call|support|whatsapp|telegram)\b/i,
    /(?:cilvēk|operator|konsultant|tālrun|telefon|sazināties|kontakti|piezvanīt)/i
  ];
  function isHandoffRequest(input) {
    return typeof input === 'string' && patterns.some(pattern => pattern.test(input));
  }
  function handoffText(locale, contactLabels) {
    const language = ['ru', 'en', 'lv'].includes(locale) ? locale : 'en';
    const messages = {
      ru: 'Конечно! Свяжитесь с нами напрямую',
      en: 'Of course! Contact us directly',
      lv: 'Protams! Sazinieties ar mums tieši'
    };
    const labels = Array.isArray(contactLabels) ? contactLabels.filter(Boolean) : [];
    return messages[language] + (labels.length ? ': ' + labels.join(', ') : '.') + (labels.length ? '.' : '');
  }
  return { isHandoffRequest, handoffText };
});
