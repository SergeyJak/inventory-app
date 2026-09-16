# Assistant audit regression scenarios

Issue: #8. This document specifies required behavior; it is not an implementation or evidence of passing tests.

## P0: human handoff
- RU: `Можно поговорить с реальным человеком?`, `Какой номер телефона?`, `Дайте WhatsApp контакт` must resolve to `human_handoff` with Russian text and actionable contact buttons.
- EN: `Can I speak to a real person?`, `What is your phone number?` must resolve to handoff with English text.
- LV: `Vai varu runāt ar cilvēku?`, `Kāds ir tālruņa numurs?` must resolve to handoff with Latvian text.
- Contact phone number must come from current contact configuration, not a duplicated hard-coded value.

## P0: catalog-grounded recommendations
- `Для музыки`: chosen model name, reason, price and stock must all refer to the same current catalog item.
- Unavailable products must not be recommended; if no suitable model exists, ask a clarifying question or offer human assistance.

## P1: color matching and analytics
- `Есть ли голубая?`: ask for model if missing, otherwise check model/color stock. Do not log `matchedFaqId=russian_language` unless that FAQ actually generated the answer.
- `Alisa knows uzbek language?`: respond with verified support details only; otherwise state that support is unconfirmed and offer a check.
- Persist a single consistent event schema: `role`, `sessionId`, `timestamp`, `intent`, `responseType`, `matchedFaqId`, `confidence`, `feedback`; record contact clicks as distinct events.
- Separate legacy records from customer-question and conversion denominators.

## Report generation
- Show report status and generation errors in the admin UI without exposing `OPENAI_API_KEY` or other secrets.
- The report from 2026-08-17 returned `status=no_ai` due to missing API key; verify the current deployment before treating this as an ongoing outage.

## Publication gate
- Verify product claims, live prices, language support and warranty/legal wording before deployment.
- Run tests and review a PR before merging to `master`.
