const SUPPORTED_LOCALES = ['ru', 'lv', 'en'];
const DEFAULT_LOCALE = 'ru';
const SITE_NAME = 'HeySmart';

const CATEGORY_LABELS = {
  ru: {
    'getting-started': 'Начало работы',
    'buying-guide': 'Гид покупателя',
    comparisons: 'Сравнения',
    subscription: 'Подписка',
  },
  lv: {
    'getting-started': 'Sākums',
    'buying-guide': 'Pircēja gids',
    comparisons: 'Salīdzinājumi',
    subscription: 'Abonements',
  },
  en: {
    'getting-started': 'Getting Started',
    'buying-guide': 'Buying Guide',
    comparisons: 'Comparisons',
    subscription: 'Subscription',
  },
};

const CATEGORY_DESCRIPTIONS = {
  ru: {
    'getting-started': 'Базовые ответы про Алису, настройку и работу Яндекс Станций в Латвии и Европе.',
    'buying-guide': 'Помощь с выбором Яндекс Станции под дом, ребёнка, музыку и повседневные сценарии.',
    comparisons: 'Практичные сравнения моделей без лишних обещаний.',
    subscription: 'Что важно знать о Яндекс Плюс и возможностях колонок.',
  },
  lv: {
    'getting-started': 'Pamata atbildes par Alisi, iestatīšanu un Yandex Station lietošanu Latvijā un Eiropā.',
    'buying-guide': 'Palīdzība izvēlēties piemērotu Yandex Station mājai, bērnam, mūzikai un ikdienai.',
    comparisons: 'Praktiski modeļu salīdzinājumi.',
    subscription: 'Svarīgākais par Yandex Plus un skaļruņu iespējām.',
  },
  en: {
    'getting-started': 'Basic answers about Alice, setup, and using Yandex Stations in Latvia and Europe.',
    'buying-guide': 'Help choosing a Yandex Station for home, children, music, and daily use.',
    comparisons: 'Practical model comparisons.',
    subscription: 'What to know about Yandex Plus and speaker features.',
  },
};

const CATEGORIES = [
  { id: 'getting-started', slugs: { ru: 'nachalo-raboty', lv: 'sakums', en: 'getting-started' } },
  { id: 'buying-guide', slugs: { ru: 'gid-pokupatelya', lv: 'pirceja-gids', en: 'buying-guide' } },
  { id: 'comparisons', slugs: { ru: 'sravneniya', lv: 'salidzinajumi', en: 'comparisons' } },
  { id: 'subscription', slugs: { ru: 'podpiska', lv: 'abonements', en: 'subscription' } },
];

const ARTICLES = [
  {
    id: 'ru-alice-latvia',
    translationGroupId: 'alice-latvia',
    locale: 'ru',
    slug: 'rabotaet-li-alisa-v-latvii',
    categoryId: 'getting-started',
    status: 'published',
    contentType: 'guide',
    previousSlugs: ['alisa-v-latvii'],
    title: 'Работает ли Алиса в Латвии?',
    excerpt: 'Что реально работает у Алисы в Латвии, что зависит от подписки и как выбрать Яндекс Станцию без лишнего риска.',
    summary: 'Да, Алиса работает в Латвии для обычных домашних задач: голосовые команды, вопросы, таймеры, будильники, Bluetooth и часть сценариев умного дома.',
    content: [],
    contentMarkdown: `Да, Алиса работает в Латвии для обычных домашних задач: голосовые команды, вопросы, таймеры, будильники, Bluetooth и часть сценариев умного дома. Покупать Яндекс Станцию имеет смысл, если вам нужен русскоязычный помощник для кухни, спальни, детской или гостиной.

Главное ограничение: музыка, Яндекс Плюс, приложение, аккаунт и некоторые сервисы могут зависеть от региона и условий конкретного аккаунта. Поэтому перед покупкой лучше решить, зачем вам колонка: для музыки, ребёнка, умного дома, Bluetooth или повседневных команд.

[Посмотреть доступные Яндекс Станции](/)
[Подобрать модель с ассистентом HeySmart](/#assistant)

## Короткий ответ

Для большинства бытовых сценариев - да. Алиса может отвечать на вопросы, ставить таймеры и будильники, работать как Bluetooth-колонка и участвовать в умном доме при совместимых устройствах.

Но не стоит покупать Станцию с ожиданием, что все сервисы Яндекса будут работать одинаково у всех пользователей. Самые частые нюансы связаны с музыкой, [Яндекс Плюс](/ru/help/nuzhna-li-podpiska-yandex-plus), приложением для настройки, аккаунтом и региональными функциями.

Для первой колонки чаще смотрят компактные модели. Для музыки и комнаты побольше - Mini 3 или Midi.

## Что обычно работает в Латвии

Быстрая карта рисков:

| Функция | Вероятность для Латвии | Что нужно | Риск | Решение перед покупкой |
| --- | --- | --- | --- | --- |
| Голосовые команды и вопросы | Обычно работает | Wi-Fi, аккаунт, настройка | Отдельные ответы и сервисы могут отличаться | Покупать, если нужен русский помощник |
| Таймеры, будильники, напоминания | Обычно работает | Wi-Fi и настроенная колонка | Зависимость от аккаунта для части синхронизации | Хороший сценарий для кухни и спальни |
| Музыка | Зависит от условий | Аккаунт, сервис, подписка | Может понадобиться Яндекс Плюс | Сначала понять музыкальный сценарий |
| Bluetooth | Обычно работает | Телефон или другое Bluetooth-устройство | Это не полноценная замена умных функций | Полезный запасной вариант |
| Умный дом | Зависит от устройств | Совместимые лампы, розетки, датчики | Не все устройства поддерживаются | Проверить конкретные модели |
| Видео и региональные сервисы | Зависит от модели и сервиса | Подходящее устройство и аккаунт | Функция может быть неактуальна в Латвии | Не покупать ради неподтверждённой функции |

### Голосовые команды и вопросы

Алиса хороша как русскоязычный помощник: спросить погоду, поставить таймер, попросить напоминание, включить простой сценарий. Для русскоязычных покупателей в Латвии это главный аргумент. Отдельные сервисные ответы и функции могут зависеть от аккаунта.

### Будильники, таймеры и напоминания

Это самый спокойный сценарий для первой покупки. Таймер на кухне, будильник в спальне или короткий вопрос к Алисе обычно не требуют дорогой модели. Для выбора под комнату есть гид [Какую Яндекс Станцию выбрать для дома?](/ru/help/kakuyu-yandex-stanciyu-vybrat-dlya-doma).

### Bluetooth-колонка

Bluetooth снижает риск покупки: если музыка через сервис не подходит, колонку можно использовать как динамик с телефона. Но Bluetooth не заменяет голосовой запуск музыки и умные функции.

### Умный дом

Алиса может управлять умным домом, если устройства совместимы. Частая ошибка - думать, что любая лампа или розетка подойдёт автоматически. Проверяйте конкретные устройства.

Для повседневных задач обычно достаточно Yandex Station Mini 3 или Lite 2. Для музыки и комнаты побольше чаще смотрят на Yandex Station Midi.

## Что может зависеть от аккаунта, подписки и региона

Слово "работает" не означает "все функции доступны без условий". Основные зоны риска:

| Сценарий | От чего зависит | Что может пойти не так | Как снизить риск | Полезная ссылка |
| --- | --- | --- | --- | --- |
| Музыка | Яндекс Плюс, аккаунт, сервис | Контент не запускается так, как ожидалось | До покупки решить: Плюс или Bluetooth | [Нужна ли подписка Яндекс Плюс?](/ru/help/nuzhna-li-podpiska-yandex-plus) |
| Настройка | Приложение, телефон, Wi-Fi, аккаунт | Колонку сложно подключить без подготовки | Проверить телефон, приложение и сеть | [Спросить ассистента](/#assistant) |
| Умный дом | Совместимость устройств | Лампа или розетка не добавляется | Проверить модель устройства | Уточнить совместимость |
| Детский сценарий | Контент, подписка, настройки | Сказки или музыка зависят от сервиса | Проверить нужный контент заранее | [Станция для ребёнка](/ru/help/kakaya-yandex-stanciya-luchshe-dlya-rebenka) |
| Региональные функции | Сервис и аккаунт | Часть функций не нужна или недоступна | Покупать под реальные задачи | Читать FAQ ниже |

### Музыка и Яндекс Плюс

Если колонка нужна для музыки, начните с подписки. Музыкальный сценарий часто связан с Яндекс Плюс и доступностью сервиса. Без подписки Bluetooth может выручить, но это не то же самое, что голосом запускать плейлист.

### Приложение и настройка

Для настройки нужен телефон, приложение, аккаунт и Wi-Fi. Не планируйте покупку вокруг случайных форумных обходных инструкций. Надёжнее проверить приложение, сценарий и модель под комнату.

### Видео, сервисы и региональные функции

Некоторые функции Яндекса привязаны к устройству, сервису или региону. Если покупаете Станцию ради одной конкретной функции, сначала проверьте именно её.

## Что проверить перед покупкой

Перед покупкой ответьте на вопросы ниже. Это полезнее, чем сравнивать только названия моделей.

### Чеклист перед покупкой

- В комнате есть стабильный Wi-Fi.
- Понятен главный сценарий: музыка, кухня, спальня, ребёнок, умный дом или подарок.
- Вы понимаете, нужен ли [Яндекс Плюс](/ru/help/nuzhna-li-podpiska-yandex-plus).
- Bluetooth подходит как запасной вариант.
- На телефоне можно использовать приложение для настройки.
- Вы понимаете, какие функции могут зависеть от аккаунта и региона.
- Модель выбрана под комнату, а не только по цене.
- Для умного дома проверены конкретные устройства.

Если непонятно, с чего начать, откройте [гид по выбору Станции для дома](/ru/help/kakuyu-yandex-stanciyu-vybrat-dlya-doma). Для детской есть отдельный материал: [Какая Яндекс Станция лучше для ребёнка?](/ru/help/kakaya-yandex-stanciya-luchshe-dlya-rebenka).

[Описать комнату и сценарий ассистенту HeySmart](/#assistant)

### Wi-Fi и место установки

Слабый Wi-Fi портит впечатление даже от хорошей колонки. Проверьте сигнал там, где Станция будет стоять. Для небольшого места чаще удобнее Mini 3.

### Сценарий использования

Не бывает "лучшей Станции для всех". Кухня - таймеры и компактность, гостиная - звук, детская - размещение и простые команды, умный дом - совместимость.

### Подписка

Если музыка, сказки и подборки - главная причина покупки, подписку проверяют до выбора модели. Для Bluetooth и простых команд требования мягче.

### Нужная модель

Для первой покупки и небольших комнат чаще подходят компактные модели. Для музыки и гостиной сравните Mini 3 и Midi: [Мини 3 или Миди: что выбрать?](/ru/help/mini-3-ili-midi-chto-vybrat).

## Какую Яндекс Станцию выбрать для Латвии

Страна важна для проверки сервисов. Модель выбирают по комнате и задаче.

| Сценарий | Модели | Почему | Проверьте | Следующий шаг |
| --- | --- | --- | --- | --- |
| Первая покупка | Lite 2, Mini 3 | Компактно, понятно, достаточно для базовых задач | Нужна ли музыка голосом | [Смотреть каталог](/) |
| Кухня или спальня | Mini 3 | Удобно поставить рядом, подходит для таймеров и вопросов | Wi-Fi в этой комнате | [Гид по дому](/ru/help/kakuyu-yandex-stanciyu-vybrat-dlya-doma) |
| Музыка и гостиная | Midi | Логичнее для комнаты побольше и музыкального сценария | Подписку и сервис | [Mini 3 или Midi](/ru/help/mini-3-ili-midi-chto-vybrat) |
| Детская | Lite 2, Mini 3 | Компактность и простые команды | Контент, настройки, место установки | [Станция для ребёнка](/ru/help/kakaya-yandex-stanciya-luchshe-dlya-rebenka) |
| Умный дом | Зависит от устройств | Решает совместимость, не название колонки | Модели ламп, розеток, датчиков | [Спросить ассистента](/#assistant) |

### Для первой покупки

Lite 2 или Mini 3 проще поставить и понять в быту. Это хороший старт без сложного умного дома и требования "главная колонка для гостиной".

### Для музыки

Если музыка важнее всего, смотрите на Midi и заранее разберитесь с Яндекс Плюс. Ошибка - выбрать колонку "для звука", но не проверить запуск музыки.

### Для ребёнка

Для детской важнее компактность, спокойное место и понятные команды. Контент, сказки и музыка могут зависеть от аккаунта и подписки.

### Для умного дома

Сначала список устройств, потом выбор колонки. Если умный дом только планируется, опишите ассистенту HeySmart, что хотите подключить.

### Чеклист выбора модели

- Маленькая комната или первая покупка: компактная модель.
- Детская: компактность, место установки, понятные команды.
- Музыка и гостиная: смотреть модель крупнее.
- Умный дом: сначала совместимость устройств.
- Несколько сценариев: выбрать по самому частому ежедневному использованию.

[Перейти к моделям в каталоге](/)

## Если Алиса не подключается или работает не так, как ожидалось

Не каждая проблема означает, что "Алиса не работает в Латвии". Часто причина проще: Wi-Fi, приложение, аккаунт, подписка или сервис.

| Симптом | Частая причина | Что проверить первым | Когда спросить HeySmart |
| --- | --- | --- | --- |
| Не подключается | Wi-Fi, питание, приложение | Сеть, телефон, режим настройки | Если неясно ещё до покупки |
| Не запускается музыка | Подписка или сервис | Яндекс Плюс, аккаунт, Bluetooth | Если музыка - главный сценарий |
| Приложение не видит колонку | Сеть или режим подключения | Wi-Fi, телефон, приложение | Если шаг настройки непонятен |
| Умный дом не работает | Несовместимое устройство | Модель устройства и интеграцию | Если есть список устройств |
| Работает только Bluetooth | Ограничение сервиса или аккаунта | Подписку, регион, приложение | Если нужен голосовой запуск |

### Чеклист, если возникли проблемы

- Проверить питание и Wi-Fi.
- Проверить приложение и аккаунт.
- Проверить, видит ли телефон колонку.
- Проверить подписку, если проблема с музыкой или контентом.
- Отдельно проверить Bluetooth.
- Проверить, не зависит ли функция от сервиса или региона.
- Если сомнение возникло до покупки, спросить HeySmart.

Не стройте покупку на DNS или router workaround из форумов. Покупателю нужен надёжный план: приложение, аккаунт, Wi-Fi, подписка, Bluetooth и совместимость.

[Разобрать проблему с ассистентом HeySmart](/#assistant)

## Итог: кому подойдёт Алиса в Латвии

Алиса в Латвии подходит тем, кому нужен русский помощник для дома: таймеры, будильники, вопросы, семейные сценарии, Bluetooth и, при совместимых устройствах, умный дом. Для первой покупки чаще достаточно компактной модели. Для музыки и гостиной смотрите Midi и заранее проверяйте подписку.

Не стоит покупать Яндекс Станцию ради неподтверждённой региональной функции. Покупайте под реальную задачу: кухня, спальня, ребёнок, музыка, умный дом или подарок.

[Выбрать модель в каталоге](/)
[Спросить ассистента HeySmart](/#assistant)`,
    faq: [
      { question: 'Можно ли пользоваться Алисой в Латвии?', answer: 'Да. Для бытовых задач Алиса в Латвии полезна: команды, вопросы, таймеры, будильники, Bluetooth и часть сценариев умного дома. Сервисы и контент могут зависеть от аккаунта, подписки и региона.' },
      { question: 'Работает ли Яндекс Станция в Риге?', answer: 'Да. Нужен Wi-Fi, приложение, аккаунт и понимание, какие функции зависят от сервисов.' },
      { question: 'Какие функции обычно работают?', answer: 'Чаще всего: вопросы, таймеры, будильники, напоминания, Bluetooth и базовые голосовые команды. Музыка, контент и умный дом требуют проверки.' },
      { question: 'Какие функции могут быть ограничены?', answer: 'Музыка, контент, отдельные функции приложения, региональные сервисы и умный дом. Если функция важна, проверьте её до покупки.' },
      { question: 'Нужен ли Яндекс Плюс?', answer: 'Для музыки и части контента Яндекс Плюс может быть важен. Для Bluetooth, таймеров и простых команд сценарий другой.' },
      { question: 'Можно ли использовать Станцию без подписки?', answer: 'Да, для некоторых задач. Но для музыки, сказок или подборок подписку лучше проверить заранее.' },
      { question: 'Работает ли Станция как Bluetooth-колонка?', answer: 'Да, как запасной вариант для звука с телефона. Но это не заменяет голосовой запуск сервисов.' },
      { question: 'Нужно ли приложение "Дом с Алисой"?', answer: 'Для настройки обычно нужны приложение, аккаунт и телефон. Убедитесь, что сможете пройти настройку на своём устройстве.' },
      { question: 'Нужен ли российский аккаунт?', answer: 'Условия зависят от сервиса и текущих правил Яндекса. Универсального обещания для всех аккаунтов нет.' },
      { question: 'Можно ли слушать музыку на Алисе в Латвии?', answer: 'Можно, если аккаунт, подписка и сервисный сценарий это позволяют. Если музыка - главная задача, начните с Яндекс Плюс.' },
      { question: 'Может ли Алиса управлять умным домом?', answer: 'Да, если устройства совместимы и добавляются в приложение. Проверяйте конкретные лампы, розетки и датчики.' },
      { question: 'Подходит ли Алиса для ребёнка?', answer: 'Может подойти: вопросы, будильники, музыка, сказки и простые команды. Контент и настройки аккаунта проверьте заранее.' },
      { question: 'Какая Станция лучше для первой покупки?', answer: 'Обычно Lite 2 или Mini 3. Если важны музыка и комната побольше, смотрите Midi.' },
      { question: 'Что выбрать: Mini 3 или Midi?', answer: 'Mini 3 - кухня, спальня, рабочий стол. Midi - звук и комната побольше.' },
      { question: 'Что проверить перед покупкой?', answer: 'Wi-Fi, приложение, аккаунт, подписку, главный сценарий, место установки, модель и совместимость умного дома.' },
      { question: 'Что делать, если Алиса не подключается к Wi-Fi?', answer: 'Проверьте питание, сеть, приложение, аккаунт и режим подключения. Если проблема с музыкой - подписку и сервис.' },
      { question: 'Можно ли использовать Алису в других странах Европы?', answer: 'Во многих странах Европы пользователи используют Яндекс Станции, но условия зависят от аккаунта, сервиса, региона и настройки. Важные функции проверяйте заранее.' },
      { question: 'Может ли HeySmart помочь выбрать модель?', answer: 'Да. Опишите комнату, задачи и ожидания от музыки или умного дома - ассистент подскажет, с какой модели начать.' },
    ],
    tags: ['alice', 'latvia', 'setup', 'compatibility'],
    seoTitle: 'Работает ли Алиса в Латвии? Что проверить перед покупкой',
    seoDescription: 'Хотите купить Яндекс Станцию в Латвии? Узнайте, какие функции Алисы работают, что зависит от подписки и что проверить перед покупкой.',
    canonicalUrl: '',
    robots: 'index,follow',
    focusKeyword: 'работает ли алиса в латвии',
    searchIntent: 'informational',
    relatedProducts: ['light2', 'mini3', 'miniPro', 'midi'],
    relatedArticles: ['yandex-plus-subscription', 'choose-station-home'],
    sourceQuestions: ['does-alice-work-in-latvia'],
    author: 'HeySmart',
    reviewer: 'HeySmart',
    contentOwner: 'HeySmart',
    reviewStatus: 'approved',
    lastReviewedAt: '2026-08-09',
    createdAt: '2026-08-09',
    updatedAt: '2026-08-09',
    publishedAt: '2026-08-09',
    lastUpdated: '2026-08-09',
    changeSummary: 'Initial Knowledge Base seed article.',
    ideaSource: 'manual',
    measurementGoal: 'Answer Latvia compatibility searches and reduce repeated assistant questions.',
    sourceQuality: 'internal',
  },
  {
    id: 'ru-yandex-plus',
    translationGroupId: 'yandex-plus-subscription',
    locale: 'ru',
    slug: 'nuzhna-li-podpiska-yandex-plus',
    categoryId: 'subscription',
    status: 'published',
    contentType: 'faq',
    previousSlugs: ['yandex-plus-nuzhen-li'],
    title: 'Нужна ли подписка Яндекс Плюс?',
    excerpt: 'Что меняется с подпиской Яндекс Плюс и что стоит проверить до покупки.',
    summary: 'Для многих музыкальных и развлекательных сценариев Яндекс Плюс важен. Без подписки часть возможностей может быть недоступна или ограничена.',
    content: [
      'Яндекс Плюс чаще всего нужен для полноценного музыкального сценария и части сервисных возможностей. Если колонка нужна в основном как Bluetooth-динамик, будильник или голосовой помощник, сценарии могут отличаться.',
      'Перед покупкой стоит решить, как именно будет использоваться колонка: музыка каждый день, детская комната, умный дом, подарочный сценарий или простое Bluetooth-подключение.',
      'HeySmart не обещает работу конкретных сторонних сервисов в каждом аккаунте или регионе. Лучше заранее уточнить нужный сценарий.',
    ],
    faq: [
      { question: 'Можно ли использовать колонку без Яндекс Плюс?', answer: 'Некоторые функции могут работать, но музыка и развлекательные возможности обычно сильнее завязаны на подписку.' },
      { question: 'Подписка входит в комплект?', answer: 'Комплектация и условия зависят от конкретного товара и предложения. Это нужно проверять отдельно.' },
    ],
    tags: ['yandex-plus', 'subscription', 'music'],
    seoTitle: 'Нужна ли подписка Яндекс Плюс для Алисы и Яндекс Станции?',
    seoDescription: 'Кратко объясняем, зачем нужна подписка Яндекс Плюс, какие функции могут зависеть от неё и что проверить перед покупкой.',
    canonicalUrl: '',
    robots: 'index,follow',
    focusKeyword: 'нужна ли подписка яндекс плюс',
    searchIntent: 'subscription',
    relatedProducts: ['mini3', 'midi'],
    relatedArticles: ['alice-latvia', 'choose-station-home'],
    sourceQuestions: ['yandex-plus-subscription'],
    author: 'HeySmart',
    reviewer: 'HeySmart',
    contentOwner: 'HeySmart',
    reviewStatus: 'approved',
    lastReviewedAt: '2026-08-09',
    createdAt: '2026-08-09',
    updatedAt: '2026-08-09',
    publishedAt: '2026-08-09',
    lastUpdated: '2026-08-09',
    changeSummary: 'Initial Knowledge Base seed article.',
    ideaSource: 'manual',
    measurementGoal: 'Answer subscription questions before purchase.',
    sourceQuality: 'internal',
  },
  {
    id: 'ru-choose-home',
    translationGroupId: 'choose-station-home',
    locale: 'ru',
    slug: 'kakuyu-yandex-stanciyu-vybrat-dlya-doma',
    categoryId: 'buying-guide',
    status: 'published',
    contentType: 'guide',
    previousSlugs: ['stanciya-dlya-doma'],
    title: 'Какую Яндекс Станцию выбрать для дома?',
    excerpt: 'Простой способ выбрать модель под комнату, звук и повседневные задачи.',
    summary: 'Для большинства домашних сценариев важны размер комнаты, ожидания по звуку, умный дом и бюджет.',
    content: [
      'Для небольшой комнаты или первой колонки обычно смотрят на компактные модели. Они занимают мало места и подходят для простых повседневных задач.',
      'Если важнее музыка и более насыщенный звук, стоит рассматривать более крупную модель. Для умного дома полезно заранее проверить поддержку нужных устройств и сценариев.',
      'Лучший выбор зависит не от названия модели, а от сценария: спальня, кухня, детская, гостиная, музыка или управление домом.',
    ],
    faq: [
      { question: 'Какая модель универсальнее для дома?', answer: 'Чаще всего выбирают компактную модель для повседневных задач или более крупную модель, если важен звук.' },
    ],
    tags: ['buying-guide', 'home', 'station'],
    seoTitle: 'Какую Яндекс Станцию выбрать для дома?',
    seoDescription: 'Помогаем выбрать Яндекс Станцию для дома: маленькая комната, музыка, гостиная, детская и умный дом.',
    canonicalUrl: '',
    robots: 'index,follow',
    focusKeyword: 'какую яндекс станцию выбрать для дома',
    searchIntent: 'buying',
    relatedProducts: ['light2', 'mini3', 'miniPro', 'midi'],
    relatedArticles: ['station-for-child', 'mini-3-vs-midi', 'yandex-plus-subscription'],
    sourceQuestions: ['which-station-for-home'],
    author: 'HeySmart',
    reviewer: 'HeySmart',
    contentOwner: 'HeySmart',
    reviewStatus: 'approved',
    lastReviewedAt: '2026-08-09',
    createdAt: '2026-08-09',
    updatedAt: '2026-08-09',
    publishedAt: '2026-08-09',
    lastUpdated: '2026-08-09',
    changeSummary: 'Initial Knowledge Base seed article.',
    ideaSource: 'manual',
    measurementGoal: 'Support home buying guide searches.',
    sourceQuality: 'internal',
  },
  {
    id: 'ru-child',
    translationGroupId: 'station-for-child',
    locale: 'ru',
    slug: 'kakaya-yandex-stanciya-luchshe-dlya-rebenka',
    categoryId: 'buying-guide',
    status: 'published',
    contentType: 'guide',
    previousSlugs: ['yandex-stanciya-dlya-detej'],
    title: 'Какая Яндекс Станция лучше для ребёнка?',
    excerpt: 'На что смотреть при выборе колонки для детской комнаты.',
    summary: 'Для ребёнка обычно важны компактность, простое управление, понятные сценарии и спокойное размещение в комнате.',
    content: [
      'Для детской комнаты чаще выбирают компактную колонку: её проще поставить на полку, тумбу или рабочий стол.',
      'Важно заранее понять сценарии: сказки, музыка, будильники, вопросы к Алисе или простые голосовые команды. Также стоит учитывать настройки аккаунта и родительский контроль там, где он доступен.',
      'Не стоит выбирать модель только по мощности. Для детской часто важнее размер, простота и понятный ежедневный сценарий.',
    ],
    faq: [
      { question: 'Нужна ли самая мощная колонка для ребёнка?', answer: 'Обычно нет. Для детской чаще важнее компактность и простота использования.' },
    ],
    tags: ['children', 'buying-guide', 'lite2'],
    seoTitle: 'Какая Яндекс Станция лучше для ребёнка?',
    seoDescription: 'Краткий гид по выбору Яндекс Станции для детской комнаты: размер, сценарии, музыка, сказки и простое управление.',
    canonicalUrl: '',
    robots: 'index,follow',
    focusKeyword: 'яндекс станция для ребенка',
    searchIntent: 'buying',
    relatedProducts: ['light2', 'mini3'],
    relatedArticles: ['choose-station-home', 'yandex-plus-subscription'],
    sourceQuestions: ['station-for-child'],
    author: 'HeySmart',
    reviewer: 'HeySmart',
    contentOwner: 'HeySmart',
    reviewStatus: 'approved',
    lastReviewedAt: '2026-08-09',
    createdAt: '2026-08-09',
    updatedAt: '2026-08-09',
    publishedAt: '2026-08-09',
    lastUpdated: '2026-08-09',
    changeSummary: 'Initial Knowledge Base seed article.',
    ideaSource: 'manual',
    measurementGoal: 'Support child-room buying searches.',
    sourceQuality: 'internal',
  },
  {
    id: 'ru-mini-midi',
    translationGroupId: 'mini-3-vs-midi',
    locale: 'ru',
    slug: 'mini-3-ili-midi-chto-vybrat',
    categoryId: 'comparisons',
    status: 'published',
    contentType: 'comparison',
    previousSlugs: ['mini-vs-midi'],
    title: 'Мини 3 или Миди: что выбрать?',
    excerpt: 'Короткое сравнение компактной Mini 3 и более крупной Midi.',
    summary: 'Mini 3 обычно выбирают за компактность, Midi - когда важнее более заметный звук и большая комната.',
    content: [
      'Mini 3 лучше подходит, если нужна аккуратная колонка для кухни, спальни, рабочего стола или первой покупки.',
      'Midi стоит рассматривать, если колонка нужна для более просторной комнаты, музыки и более заметного звучания.',
      'Если сомневаетесь, начните со сценария: компактность и каждый день - Mini 3; звук и комната побольше - Midi.',
    ],
    faq: [
      { question: 'Что лучше для музыки?', answer: 'Если важнее звук и помещение не самое маленькое, обычно логичнее смотреть в сторону Midi.' },
      { question: 'Что компактнее?', answer: 'Mini 3 компактнее и проще вписывается в небольшие места.' },
    ],
    tags: ['mini3', 'midi', 'comparison'],
    seoTitle: 'Мини 3 или Миди: что выбрать?',
    seoDescription: 'Сравнение Яндекс Станции Mini 3 и Midi: компактность, звук, сценарии дома и выбор для музыки.',
    canonicalUrl: '',
    robots: 'index,follow',
    focusKeyword: 'mini 3 или midi',
    searchIntent: 'comparison',
    relatedProducts: ['mini3', 'midi'],
    relatedArticles: ['choose-station-home', 'station-for-child'],
    sourceQuestions: ['mini-vs-midi'],
    author: 'HeySmart',
    reviewer: 'HeySmart',
    contentOwner: 'HeySmart',
    reviewStatus: 'approved',
    lastReviewedAt: '2026-08-09',
    createdAt: '2026-08-09',
    updatedAt: '2026-08-09',
    publishedAt: '2026-08-09',
    lastUpdated: '2026-08-09',
    changeSummary: 'Initial Knowledge Base seed article.',
    ideaSource: 'manual',
    measurementGoal: 'Support comparison searches.',
    sourceQuality: 'internal',
  },
  {
    id: 'ru-unpublished-test',
    translationGroupId: 'unpublished-test',
    locale: 'ru',
    slug: 'unpublished-kb-test',
    categoryId: 'getting-started',
    status: 'draft',
    contentType: 'guide',
    previousSlugs: ['old-unpublished-kb-test'],
    title: 'Unpublished KB Test',
    excerpt: 'Hidden draft for regression tests.',
    summary: 'Hidden draft.',
    content: ['This draft must never render publicly or appear in sitemap.'],
    faq: [],
    tags: [],
    seoTitle: 'Unpublished KB Test',
    seoDescription: 'Hidden draft.',
    canonicalUrl: '',
    robots: 'noindex,follow',
    focusKeyword: 'unpublished kb test',
    searchIntent: 'informational',
    relatedProducts: [],
    relatedArticles: [],
    sourceQuestions: [],
    author: 'HeySmart',
    reviewer: 'HeySmart',
    contentOwner: 'HeySmart',
    reviewStatus: 'not-reviewed',
    lastReviewedAt: '',
    createdAt: '2026-08-09',
    updatedAt: '2026-08-09',
    publishedAt: '',
    lastUpdated: '2026-08-09',
    changeSummary: 'Draft used to guard public exclusion.',
    ideaSource: 'manual',
    measurementGoal: 'Regression guard.',
    sourceQuality: 'internal',
  },
];

const PRODUCT_LABELS = {
  light2: 'Yandex Station Lite 2',
  mini3: 'Yandex Station Mini 3',
  miniPro: 'Yandex Station Mini 3 Pro',
  midi: 'Yandex Station Midi',
};

const PRODUCT_URLS = {
  light2: '/ru/yandex-station-lite-2',
  mini3: '/ru/yandex-station-mini-3',
  miniPro: '/ru/yandex-station-mini-3-pro',
  midi: '/ru',
};

const UI_LABELS = {
  ru: {
    brand: 'HeySmart',
    help: 'База знаний',
    pageTitle: 'База знаний HeySmart',
    navLabel: 'Навигация базы знаний',
    catalog: 'Каталог',
    askAssistant: 'Спросить ассистента',
    intro: 'Короткие ответы и практичные гиды по Яндекс Станциям, Алисе, подписке и выбору модели.',
    categories: 'Категории',
    featured: 'Полезные статьи',
    allArticles: 'Все статьи',
    relatedArticles: 'Связанные статьи',
    relatedProducts: 'Связанные товары',
    faq: 'FAQ',
    updated: 'Обновлено',
    articlesCount: 'статей',
    noArticlesLocale: 'Пока нет опубликованных статей на этом языке.',
    noArticlesCategory: 'Пока нет опубликованных статей в этой категории.',
    backToCatalog: 'Вернуться в каталог',
    readArticle: 'Читать статью',
    productHint: 'Посмотрите модели в каталоге HeySmart.',
    articleActions: 'Действия со статьёй',
    home: 'Помощь',
  },
  lv: {
    brand: 'HeySmart',
    help: 'Zināšanu bāze',
    pageTitle: 'HeySmart zināšanu bāze',
    navLabel: 'Zināšanu bāzes navigācija',
    catalog: 'Katalogs',
    askAssistant: 'Jautāt asistentam',
    intro: 'Īsas atbildes un praktiski ceļveži par Yandex Station, Alisi, abonementu un modeļa izvēli.',
    categories: 'Kategorijas',
    featured: 'Noderīgi raksti',
    allArticles: 'Visi raksti',
    relatedArticles: 'Saistītie raksti',
    relatedProducts: 'Saistītie produkti',
    faq: 'BUJ',
    updated: 'Atjaunināts',
    articlesCount: 'raksti',
    noArticlesLocale: 'Šajā valodā pagaidām nav publicētu rakstu.',
    noArticlesCategory: 'Šajā kategorijā pagaidām nav publicētu rakstu.',
    backToCatalog: 'Atpakaļ uz katalogu',
    readArticle: 'Lasīt rakstu',
    productHint: 'Apskatiet modeļus HeySmart katalogā.',
    articleActions: 'Raksta darbības',
    home: 'Palīdzība',
  },
  en: {
    brand: 'HeySmart',
    help: 'Knowledge Base',
    pageTitle: 'HeySmart Knowledge Base',
    navLabel: 'Knowledge Base navigation',
    catalog: 'Catalog',
    askAssistant: 'Ask assistant',
    intro: 'Short answers and practical guides about Yandex Stations, Alice, subscriptions, and choosing a model.',
    categories: 'Categories',
    featured: 'Helpful articles',
    allArticles: 'All articles',
    relatedArticles: 'Related articles',
    relatedProducts: 'Related products',
    faq: 'FAQ',
    updated: 'Updated',
    articlesCount: 'articles',
    noArticlesLocale: 'There are no published articles in this language yet.',
    noArticlesCategory: 'There are no published articles in this category yet.',
    backToCatalog: 'Back to catalog',
    readArticle: 'Read article',
    productHint: 'View models in the HeySmart catalog.',
    articleActions: 'Article actions',
    home: 'Help',
  },
};

function isSupportedLocale(locale) {
  return SUPPORTED_LOCALES.includes(locale);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeJsonForHtml(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function originFromRequest(req) {
  const host = req.get('x-forwarded-host') || req.get('host') || 'heysmart.lv';
  const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
  return `${proto}://${host}`;
}

function helpPath(locale) {
  return `/${locale}/help`;
}

function articlePath(article) {
  return `/${article.locale}/help/${article.slug}`;
}

function categorySlug(categoryId, locale) {
  const category = CATEGORIES.find(item => item.id === categoryId);
  return category?.slugs[locale] || category?.slugs[DEFAULT_LOCALE] || categoryId;
}

function categoryPath(category, locale) {
  return `/${locale}/help/category/${category.slugs[locale] || category.id}`;
}

function publishedArticles(locale) {
  return ARTICLES
    .filter(article => article.status === 'published' && article.locale === locale)
    .sort((a, b) => a.title.localeCompare(b.title, locale));
}

function findArticle(locale, slug, includeDrafts = false) {
  return ARTICLES.find(article =>
    article.locale === locale
    && article.slug === slug
    && (includeDrafts || article.status === 'published')
  ) || null;
}

function findPreviousSlugRedirect(locale, slug) {
  const article = ARTICLES.find(item =>
    item.locale === locale
    && item.status === 'published'
    && Array.isArray(item.previousSlugs)
    && item.previousSlugs.includes(slug)
  );
  return article ? articlePath(article) : null;
}

function categoryBySlug(locale, slug) {
  return CATEGORIES.find(category => category.slugs[locale] === slug) || null;
}

function categoryById(id) {
  return CATEGORIES.find(category => category.id === id) || null;
}

function categoryLabel(categoryId, locale) {
  return CATEGORY_LABELS[locale]?.[categoryId] || CATEGORY_LABELS[DEFAULT_LOCALE]?.[categoryId] || categoryId;
}

function categoryDescription(categoryId, locale) {
  return CATEGORY_DESCRIPTIONS[locale]?.[categoryId] || CATEGORY_DESCRIPTIONS[DEFAULT_LOCALE]?.[categoryId] || '';
}

function translationsFor(article) {
  return ARTICLES.filter(item => item.translationGroupId === article.translationGroupId && item.status === 'published');
}

function articleByTranslationGroup(groupId, locale) {
  return ARTICLES.find(article => article.translationGroupId === groupId && article.locale === locale && article.status === 'published')
    || ARTICLES.find(article => article.translationGroupId === groupId && article.status === 'published')
    || null;
}

function defaultArticleForGroup(groupId) {
  return ARTICLES.find(article => article.translationGroupId === groupId && article.locale === DEFAULT_LOCALE && article.status === 'published')
    || ARTICLES.find(article => article.translationGroupId === groupId && article.status === 'published')
    || null;
}

function absoluteUrl(req, pathname) {
  return `${originFromRequest(req)}${pathname}`;
}

function ui(locale) {
  return UI_LABELS[locale] || UI_LABELS[DEFAULT_LOCALE];
}

function catalogPath(locale) {
  return locale === 'ru' ? '/ru' : '/';
}

function pageShell({ locale = DEFAULT_LOCALE, title, description, canonical, hreflang = [], robots = 'index,follow', structuredData = [], body }) {
  const labels = ui(locale);
  const catalogUrl = catalogPath(locale);
  const hreflangTags = hreflang.map(link =>
    `<link rel="alternate" hreflang="${escapeAttr(link.hreflang)}" href="${escapeAttr(link.href)}">`
  ).join('\n');
  const jsonLd = structuredData.map(data =>
    `<script type="application/ld+json">${escapeJsonForHtml(data)}</script>`
  ).join('\n');
  return `<!DOCTYPE html>
<html lang="${escapeAttr(locale)}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeAttr(description)}">
  <meta name="robots" content="${escapeAttr(robots)}">
  <link rel="canonical" href="${escapeAttr(canonical)}">
  ${hreflangTags}
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body { margin: 0; color: #111114; background: #fff; font-family: Inter, "Segoe UI", Arial, sans-serif; line-height: 1.55; overflow-x: hidden; }
    a { color: inherit; text-decoration: none; }
    a:focus-visible, button:focus-visible, input:focus-visible { outline: 3px solid rgba(17,17,20,.18); outline-offset: 4px; }
    .kb-shell { min-height: 100svh; background: linear-gradient(135deg, #fbfbfc 0%, #fff 56%, #eef6f4 100%); }
    .kb-header { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px clamp(18px, 5vw, 72px); background: rgba(255,255,255,.84); border-bottom: 1px solid rgba(17,17,20,.08); backdrop-filter: blur(18px); }
    .kb-brand { font-size: 1rem; font-weight: 900; letter-spacing: 0; }
    .kb-nav { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
    .kb-nav a, .kb-button { min-height: 38px; display: inline-flex; align-items: center; justify-content: center; padding: 0 14px; border-radius: 999px; background: rgba(255,255,255,.72); box-shadow: inset 0 0 0 1px rgba(17,17,20,.08); color: rgba(17,17,20,.72); font-weight: 800; font-size: .9rem; }
    .kb-nav a[aria-current="page"], .kb-button.primary { color: #fff; background: #111114; box-shadow: 0 12px 28px rgba(17,17,20,.13); }
    main { width: min(1120px, 100%); margin: 0 auto; padding: clamp(20px, 4vw, 42px) clamp(16px, 5vw, 34px) 56px; }
    .kb-article-wrap { width: min(820px, 100%); }
    .kb-hero { display: grid; gap: 10px; margin-bottom: 20px; }
    .kb-eyebrow { color: #74767d; font-size: .82rem; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; }
    h1 { max-width: 850px; margin: 0; font-size: clamp(1.9rem, 5vw, 3.1rem); line-height: 1.02; letter-spacing: 0; }
    .kb-article-wrap h1 { font-size: clamp(1.85rem, 5vw, 2.85rem); }
    h2 { margin: 28px 0 12px; font-size: clamp(1.18rem, 3vw, 1.55rem); line-height: 1.1; }
    h3 { margin: 0 0 8px; font-size: 1rem; }
    p { margin: 0 0 14px; }
    .kb-intro, .summary { max-width: 680px; color: #4c4e57; font-size: clamp(.98rem, 2.4vw, 1.12rem); }
    .summary { padding: 16px; border-radius: 12px; background: rgba(255,255,255,.7); box-shadow: inset 0 0 0 1px rgba(17,17,20,.08); }
    .breadcrumbs { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; color: #74767d; font-size: .9rem; font-weight: 720; margin-bottom: 16px; }
    .breadcrumbs a { color: #111114; }
    .breadcrumbs span { color: rgba(17,17,20,.32); }
    .kb-section-head { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-top: 24px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 12px; }
    .card { display: grid; gap: 8px; min-width: 0; min-height: 0; padding: 16px; border-radius: 12px; background: rgba(255,255,255,.78); box-shadow: inset 0 0 0 1px rgba(17,17,20,.08), 0 14px 36px rgba(10,18,28,.06); transition: transform .18s ease, box-shadow .18s ease; }
    .card:hover { transform: translateY(-2px); box-shadow: inset 0 0 0 1px rgba(17,17,20,.12), 0 18px 42px rgba(10,18,28,.1); }
    .card strong { font-size: 1rem; line-height: 1.2; }
    .category-grid { grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); }
    .category-card { padding: 13px 14px; gap: 5px; background: rgba(255,255,255,.62); box-shadow: inset 0 0 0 1px rgba(17,17,20,.08); }
    .category-card:hover { box-shadow: inset 0 0 0 1px rgba(17,17,20,.14), 0 10px 24px rgba(10,18,28,.07); }
    .featured-grid { grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); }
    .featured-card { padding: 18px; background: linear-gradient(135deg, rgba(255,255,255,.96), rgba(240,248,246,.88)); box-shadow: inset 0 0 0 1px rgba(17,17,20,.1), 0 18px 42px rgba(10,18,28,.1); }
    .featured-card strong { font-size: 1.06rem; }
    .article-card { padding: 14px; box-shadow: inset 0 0 0 1px rgba(17,17,20,.08), 0 10px 26px rgba(10,18,28,.05); }
    .muted, .meta { color: #74767d; }
    .meta { font-size: .88rem; font-weight: 760; }
    article { display: grid; gap: 18px; }
    .kb-content { padding: 24px; border-radius: 14px; background: rgba(255,255,255,.78); box-shadow: inset 0 0 0 1px rgba(17,17,20,.08), 0 14px 36px rgba(10,18,28,.06); }
    .kb-content p { color: #30323a; font-size: 1.04rem; }
    .kb-content a { color: #0f766e; font-weight: 820; text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 3px; }
    .kb-content h2 { margin-top: 30px; }
    .kb-content h2:first-child { margin-top: 0; }
    .kb-content h3 { margin: 22px 0 8px; font-size: 1.08rem; }
    .kb-content ul { margin: 0 0 18px; padding-left: 20px; color: #30323a; }
    .kb-content li { margin: 7px 0; }
    .table-wrap { width: 100%; overflow-x: auto; margin: 14px 0 22px; border-radius: 12px; box-shadow: inset 0 0 0 1px rgba(17,17,20,.08); }
    table { width: 100%; min-width: 680px; border-collapse: collapse; background: #fff; }
    th, td { padding: 12px 14px; border-bottom: 1px solid rgba(17,17,20,.08); text-align: left; vertical-align: top; }
    th { color: #111114; background: rgba(238,246,244,.74); font-size: .86rem; }
    td { color: #30323a; font-size: .92rem; }
    tr:last-child td { border-bottom: 0; }
    .content-cta { display: flex; gap: 10px; flex-wrap: wrap; margin: 12px 0 22px; }
    .faq-card { padding: 16px; border-radius: 12px; background: #fff; box-shadow: inset 0 0 0 1px rgba(17,17,20,.08); }
    .pill { display: inline-flex; align-items: center; min-height: 34px; padding: 0 12px; margin: 4px; border-radius: 999px; background: #fff; color: #111114; box-shadow: inset 0 0 0 1px rgba(17,17,20,.1); font-size: .9rem; font-weight: 820; transition: transform .16s ease, box-shadow .16s ease; }
    a.pill:hover { transform: translateY(-1px); box-shadow: inset 0 0 0 1px rgba(17,17,20,.16), 0 10px 22px rgba(10,18,28,.08); }
    .kb-cta { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 26px; }
    .empty-state { padding: 18px; border-radius: 12px; background: rgba(255,255,255,.72); color: #74767d; box-shadow: inset 0 0 0 1px rgba(17,17,20,.08); }
    @media (max-width: 700px) {
      .kb-header { position: static; align-items: flex-start; flex-direction: column; padding: 14px; }
      .kb-nav { width: 100%; gap: 6px; justify-content: flex-start; }
      .kb-nav a, .kb-button { min-height: 34px; padding: 0 11px; font-size: .82rem; }
      main { padding: 20px 14px 42px; }
      .kb-hero { gap: 8px; margin-bottom: 16px; }
      .grid { grid-template-columns: 1fr; gap: 10px; }
      .card, .kb-content, .summary { padding: 13px; border-radius: 10px; }
      th, td { padding: 10px 12px; }
      .featured-card { padding: 15px; }
      .kb-section-head { display: block; }
    }
  </style>
  ${jsonLd}
</head>
<body>
  <div class="kb-shell">
    <header class="kb-header">
      <a class="kb-brand" href="${catalogUrl}">${escapeHtml(labels.brand)}</a>
      <nav class="kb-nav" aria-label="${escapeAttr(labels.navLabel)}">
        <a href="${catalogUrl}" >${escapeHtml(labels.catalog)}</a>
        <a href="/${escapeAttr(locale)}/help" aria-current="page">${escapeHtml(labels.help)}</a>
        <a href="${catalogUrl}#assistant">${escapeHtml(labels.askAssistant)}</a>
      </nav>
    </header>
    <main>${body}</main>
  </div>
</body>
</html>`;
}

function hreflangForArticle(req, article) {
  const links = translationsFor(article).map(item => ({
    hreflang: item.locale,
    href: absoluteUrl(req, articlePath(item)),
  }));
  const fallback = defaultArticleForGroup(article.translationGroupId) || article;
  links.push({ hreflang: 'x-default', href: absoluteUrl(req, articlePath(fallback)) });
  return links;
}

function breadcrumbsHtml(items) {
  return `<nav class="breadcrumbs" aria-label="Breadcrumbs">${items.map((item, index) => {
    const label = escapeHtml(item.name);
    const crumb = item.href && index < items.length - 1 ? `<a href="${escapeAttr(item.href)}">${label}</a>` : label;
    return index < items.length - 1 ? `${crumb}<span>/</span>` : crumb;
  }).join('')}</nav>`;
}

function breadcrumbSchema(req, items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(req, item.href || req.path),
    })),
  };
}

function articleSchema(req, article) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.seoDescription,
    author: { '@type': 'Organization', name: article.author || SITE_NAME },
    datePublished: article.publishedAt,
    dateModified: article.lastUpdated || article.updatedAt,
    mainEntityOfPage: absoluteUrl(req, articlePath(article)),
    inLanguage: article.locale,
  };
}

function faqSchema(article) {
  if (!article.faq?.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: article.faq.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

function renderRelatedArticles(locale, article) {
  const labels = ui(locale);
  const related = article.relatedArticles
    .map(groupId => articleByTranslationGroup(groupId, locale))
    .filter(Boolean)
    .filter(item => item.id !== article.id);
  if (!related.length) return '';
  return `<section><div class="kb-section-head"><h2>${escapeHtml(labels.relatedArticles)}</h2></div><div class="grid">${related.map(item => `
    <a class="card" href="${escapeAttr(articlePath(item))}">
      <strong>${escapeHtml(item.title)}</strong>
      <p class="muted">${escapeHtml(item.excerpt)}</p>
      <span class="meta">${escapeHtml(labels.readArticle)}</span>
    </a>
  `).join('')}</div></section>`;
}

function renderRelatedProducts(locale, article) {
  const labels = ui(locale);
  const products = (article.relatedProducts || [])
    .map(id => ({ label: PRODUCT_LABELS[id], url: PRODUCT_URLS[id] }))
    .filter(product => product.label && product.url);
  if (!products.length) return '';
  return `<section><div class="kb-section-head"><h2>${escapeHtml(labels.relatedProducts)}</h2><p class="meta">${escapeHtml(labels.productHint)}</p></div>${products.map(product => `<a class="pill" href="${escapeAttr(product.url)}">${escapeHtml(product.label)}</a>`).join('')}</section>`;
}

function renderInlineMarkdown(value) {
  return escapeHtml(value).replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, href) => {
    const safeHref = String(href || '').trim();
    if (!safeHref || /^(javascript|data):/i.test(safeHref)) return text;
    return `<a href="${escapeAttr(safeHref)}">${text}</a>`;
  });
}

function splitMarkdownTableRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
}

function renderMarkdownTable(lines, startIndex) {
  const headers = splitMarkdownTableRow(lines[startIndex]);
  const rows = [];
  let index = startIndex + 2;
  while (index < lines.length && /^\|.+\|$/.test(lines[index].trim())) {
    rows.push(splitMarkdownTableRow(lines[index]));
    index += 1;
  }
  const head = `<thead><tr>${headers.map(header => `<th>${renderInlineMarkdown(header)}</th>`).join('')}</tr></thead>`;
  const body = `<tbody>${rows.map(row => `<tr>${headers.map((_, cellIndex) => `<td>${renderInlineMarkdown(row[cellIndex] || '')}</td>`).join('')}</tr>`).join('')}</tbody>`;
  return { html: `<div class="table-wrap"><table>${head}${body}</table></div>`, nextIndex: index };
}

function renderContentMarkdown(markdown = '') {
  const lines = String(markdown).replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let paragraph = [];
  let list = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${renderInlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!list.length) return;
    html.push(`<ul>${list.map(item => `<li>${renderInlineMarkdown(item)}</li>`).join('')}</ul>`);
    list = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
    if (/^\|.+\|$/.test(line) && index + 1 < lines.length && /^\|\s*-/.test(lines[index + 1].trim())) {
      flushParagraph();
      flushList();
      const table = renderMarkdownTable(lines, index);
      html.push(table.html);
      index = table.nextIndex - 1;
      continue;
    }
    if (line.startsWith('### ')) {
      flushParagraph();
      flushList();
      html.push(`<h3>${renderInlineMarkdown(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith('## ')) {
      flushParagraph();
      flushList();
      html.push(`<h2>${renderInlineMarkdown(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith('- ')) {
      flushParagraph();
      list.push(line.slice(2));
      continue;
    }
    if (/^\[[^\]]+\]\([^)]+\)$/.test(line)) {
      flushParagraph();
      flushList();
      html.push(`<div class="content-cta"><span class="kb-button">${renderInlineMarkdown(line)}</span></div>`.replace(/<span class="kb-button"><a /g, '<a class="kb-button" ').replace(/<\/a><\/span>/g, '</a>'));
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return html.join('');
}

function renderArticleContent(article) {
  if (article.contentMarkdown) return renderContentMarkdown(article.contentMarkdown);
  return (article.content || []).map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join('');
}

function renderArticlePage(req, article) {
  const labels = ui(article.locale);
  const category = categoryById(article.categoryId);
  const breadcrumbs = [
    { name: labels.home, href: helpPath(article.locale) },
    { name: categoryLabel(article.categoryId, article.locale), href: category ? categoryPath(category, article.locale) : helpPath(article.locale) },
    { name: article.title, href: articlePath(article) },
  ];
  const structuredData = [articleSchema(req, article), breadcrumbSchema(req, breadcrumbs)];
  const faq = faqSchema(article);
  if (faq) structuredData.push(faq);
  const body = `
    <div class="kb-article-wrap">
    ${breadcrumbsHtml(breadcrumbs)}
    <article>
      <div class="kb-hero">
        <div class="kb-eyebrow">${escapeHtml(categoryLabel(article.categoryId, article.locale))}</div>
        <h1>${escapeHtml(article.title)}</h1>
        <p class="meta">${escapeHtml(labels.updated)}: ${escapeHtml(article.lastUpdated)}</p>
        <p class="summary">${escapeHtml(article.summary)}</p>
      </div>
      <section class="kb-content" aria-label="${escapeAttr(article.title)}">
        ${renderArticleContent(article)}
      </section>
      ${article.faq?.length ? `<section><div class="kb-section-head"><h2>${escapeHtml(labels.faq)}</h2></div>${article.faq.map(item => `
        <div class="faq-card"><h3>${escapeHtml(item.question)}</h3><p>${escapeHtml(item.answer)}</p></div>
      `).join('')}</section>` : ''}
      ${renderRelatedProducts(article.locale, article)}
      ${renderRelatedArticles(article.locale, article)}
      <div class="kb-cta" aria-label="${escapeAttr(labels.articleActions)}">
        <a class="kb-button primary" href="${catalogPath(article.locale)}">${escapeHtml(labels.backToCatalog)}</a>
        <a class="kb-button" href="${catalogPath(article.locale)}#assistant">${escapeHtml(labels.askAssistant)}</a>
      </div>
    </article>
    </div>`;
  return pageShell({
    title: article.seoTitle,
    locale: article.locale,
    description: article.seoDescription,
    canonical: absoluteUrl(req, articlePath(article)),
    hreflang: hreflangForArticle(req, article),
    robots: article.robots,
    structuredData,
    body,
  });
}

function renderHelpIndex(req, locale) {
  const labels = ui(locale);
  const articles = publishedArticles(locale);
  const canonical = absoluteUrl(req, helpPath(locale));
  const featured = articles.slice(0, 3);
  const categories = CATEGORIES.map(category => {
    const count = articles.filter(article => article.categoryId === category.id).length;
    return { category, count };
  });
  const body = `
    <section class="kb-hero">
      <div class="kb-eyebrow">${escapeHtml(labels.help)}</div>
      <h1>${escapeHtml(labels.pageTitle)}</h1>
      <p class="kb-intro">${escapeHtml(labels.intro)}</p>
    </section>
    <section><div class="kb-section-head"><h2>${escapeHtml(labels.categories)}</h2></div><div class="grid category-grid">${categories.map(({ category, count }) => `
      <a class="card category-card" href="${escapeAttr(categoryPath(category, locale))}">
        <strong>${escapeHtml(categoryLabel(category.id, locale))}</strong>
        <p class="muted">${escapeHtml(categoryDescription(category.id, locale))}</p>
        <span class="meta">${count} ${escapeHtml(labels.articlesCount)}</span>
      </a>
    `).join('')}</div></section>
    ${featured.length ? `<section><div class="kb-section-head"><h2>${escapeHtml(labels.featured)}</h2></div><div class="grid featured-grid">${featured.map(article => `
      <a class="card featured-card" href="${escapeAttr(articlePath(article))}">
        <strong>${escapeHtml(article.title)}</strong>
        <p class="muted">${escapeHtml(article.excerpt)}</p>
        <span class="meta">${escapeHtml(labels.readArticle)}</span>
      </a>
    `).join('')}</div></section>` : ''}
    <section><div class="kb-section-head"><h2>${escapeHtml(labels.allArticles)}</h2></div><div class="grid">${articles.map(article => `
      <a class="card article-card" href="${escapeAttr(articlePath(article))}">
        <strong>${escapeHtml(article.title)}</strong>
        <p class="muted">${escapeHtml(article.excerpt)}</p>
        <span class="meta">${escapeHtml(labels.readArticle)}</span>
      </a>
    `).join('') || `<p class="empty-state">${escapeHtml(labels.noArticlesLocale)}</p>`}</div></section>`;
  return pageShell({
    title: labels.pageTitle,
    locale,
    description: labels.intro,
    canonical,
    hreflang: [{ hreflang: locale, href: canonical }, { hreflang: 'x-default', href: absoluteUrl(req, helpPath(DEFAULT_LOCALE)) }],
    robots: articles.length ? 'index,follow' : 'noindex,follow',
    body,
  });
}

function renderCategoryPage(req, locale, category) {
  const labels = ui(locale);
  const articles = publishedArticles(locale).filter(article => article.categoryId === category.id);
  const canonical = absoluteUrl(req, categoryPath(category, locale));
  const breadcrumbs = [
    { name: labels.home, href: helpPath(locale) },
    { name: categoryLabel(category.id, locale), href: categoryPath(category, locale) },
  ];
  const body = `
    ${breadcrumbsHtml(breadcrumbs)}
    <section class="kb-hero">
      <div class="kb-eyebrow">${escapeHtml(labels.help)}</div>
      <h1>${escapeHtml(categoryLabel(category.id, locale))}</h1>
      <p class="kb-intro">${escapeHtml(categoryDescription(category.id, locale))}</p>
    </section>
    <div class="grid">${articles.map(article => `
      <a class="card article-card" href="${escapeAttr(articlePath(article))}">
        <strong>${escapeHtml(article.title)}</strong>
        <p class="muted">${escapeHtml(article.excerpt)}</p>
        <span class="meta">${escapeHtml(labels.readArticle)}</span>
      </a>
    `).join('') || `<p class="empty-state">${escapeHtml(labels.noArticlesCategory)}</p>`}</div>`;
  return pageShell({
    title: `${categoryLabel(category.id, locale)} | ${labels.pageTitle}`,
    locale,
    description: categoryDescription(category.id, locale),
    canonical,
    hreflang: [{ hreflang: locale, href: canonical }, { hreflang: 'x-default', href: absoluteUrl(req, categoryPath(category, DEFAULT_LOCALE)) }],
    robots: articles.length ? 'index,follow' : 'noindex,follow',
    structuredData: [breadcrumbSchema(req, breadcrumbs)],
    body,
  });
}

function sitemapUrls(origin = 'https://heysmart.lv') {
  const localesWithArticles = SUPPORTED_LOCALES.filter(locale => publishedArticles(locale).length);
  const categoryUrls = CATEGORIES.flatMap(category => localesWithArticles
    .filter(locale => publishedArticles(locale).some(article => article.categoryId === category.id))
    .map(locale => ({
      loc: `${origin}${categoryPath(category, locale)}`,
      lastmod: '2026-08-09',
    })));
  const urls = [
    { loc: `${origin}/`, lastmod: '2026-06-23' },
    { loc: `${origin}/ru`, lastmod: '2026-09-02' },
    { loc: `${origin}/en`, lastmod: '2026-09-02' },
    ...localesWithArticles.map(locale => ({ loc: `${origin}${helpPath(locale)}`, lastmod: '2026-08-09' })),
    ...categoryUrls,
    ...ARTICLES
      .filter(article => article.status === 'published' && article.robots === 'index,follow')
      .map(article => ({
        loc: `${origin}${articlePath(article)}`,
        lastmod: article.lastUpdated || article.updatedAt || article.publishedAt,
      })),
  ];
  return urls;
}

function renderSitemapXml(origin) {
  const urls = sitemapUrls(origin);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url>
    <loc>${escapeXml(url.loc)}</loc>
    <lastmod>${escapeXml(url.lastmod)}</lastmod>
  </url>`).join('\n')}
</urlset>
`;
}

module.exports = {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  CATEGORIES,
  ARTICLES,
  isSupportedLocale,
  findArticle,
  findPreviousSlugRedirect,
  categoryBySlug,
  renderArticlePage,
  renderHelpIndex,
  renderCategoryPage,
  renderSitemapXml,
  sitemapUrls,
};
