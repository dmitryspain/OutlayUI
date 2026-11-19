# Outlay UI

Особиста аналітика витрат за карткою Monobank. Angular 17 (standalone-компоненти, сигнали, новий control flow).

```bash
npm install
npm start          # http://localhost:4200
npm test           # юніт-тести (Karma); без вікна: npx ng test --watch=false --browsers=ChromeHeadless
npm run build      # production-збірка
```

Адреса бекенду (`OutlayApp`) залежить від збірки. Код бере її лише через `API_BASE_URL` у `src/app/core/config.ts`.

| Збірка | Файл | Адреса API |
|---|---|---|
| `npm start` (development) | `src/environments/environment.ts` | `https://localhost:7016/api` |
| `npm run build` (production, Cloudflare Pages) | `src/environments/environment.production.ts` | `https://outlay-api.onrender.com/api` |
| `npm run build:mobile` (iOS) | `src/environments/environment.mobile.ts` | `https://outlay-api.onrender.com/api` |

**Деплой.** Cloudflare Pages: команда збірки `npm run build`, тека виходу `dist/outlay-ui` (builder `browser`, тож
підтеки `browser/` немає), версія Node з `.node-version`. `404.html` у збірці немає, тому Pages роздає сайт як SPA.
Бекенд пускає лише origin `https://outlay.pages.dev` (README бекенду, розділ «Deployment»).

**Демо-режим** (Налаштування → Дані) підставляє згенеровані дані замість запитів до бекенду. Зручно для розробки та показу; токен і вибрана картка не змінюються.

## iOS

Застосунок для iPhone — це той самий Angular-код у нативній оболонці Capacitor 8: Xcode-проєкт лежить в `ios/` (залежності через Swift Package Manager, CocoaPods не потрібен), налаштування — у `capacitor.config.ts` (Bundle ID `io.github.dmitryspain.outlay`). Будь-яка зміна в `src/` діє і у вебі, і в iOS. Мінімальна версія iOS — 17.

Потрібні Xcode 27 з iOS-симулятором і Node ≥ 22.

```bash
npm run ios:sync   # збірка `mobile` (адреса API: src/environments/environment.mobile.ts) + npx cap sync ios
npm run ios:open   # відкрити проєкт у Xcode
npm run ios:run    # зібрати й запустити; ціль: npm run ios:run -- --target <UDID> (список: npx cap run ios --list)
```

`npm run ios:sync` потрібен після кожної зміни в `src/`: застосунок бере веб-збірку з `ios/App/App/public`. Цю теку й `ios/App/App/capacitor.config.json` генерує `cap sync`, тож їх не редагуємо й не комітимо.

**Запуск у симуляторі:** `npm run ios:sync` → `npm run ios:open` → у Xcode вибрати iPhone-симулятор → Run (⌘R).
`npm run ios:run` з Xcode 27 збирає й встановлює застосунок, але завершується помилкою «There was an error opening simulator»: `native-run` з Capacitor CLI шукає Simulator.app за шляхом, якого в Xcode 27 немає. Застосунок на той момент уже встановлено, тож запустіть його вручну: `xcrun simctl launch <UDID> io.github.dmitryspain.outlay`.

**Без бекенду:** Налаштування → Дані → Демо, і застосунок показує згенеровані дані. Налаштування → «Про застосунок» показує адресу API і збірку `(mobile)`. Збірка `mobile` ходить на задеплоєний API. Щоб перевірити застосунок проти бекенду на Маку, тимчасово впишіть у `environment.mobile.ts` адресу `https://localhost:7016/api`: симулятор її бачить, якщо довіряє dev-сертифікату (README бекенду, розділ «Доступ з телефона (iOS)»).

**Підпис:** для симулятора не потрібен. На свій iPhone застосунок ставиться з Xcode через безкоштовну Personal Team (Xcode → Settings → Accounts → Apple ID; таргет App → Signing & Capabilities → Team). Профіль діє 7 днів, тож щотижня знову Product → Run. Застосунок перед цим не видаляйте, бо разом із ним зникнуть його дані.

## Структура

```
src/
  styles/            дизайн-система: tokens → themes → base → components
  app/
    core/            дані та стан: api, feed (єдине джерело для всіх екранів), sync, prefs, period, demo…
    shared/          UI-цеглинки: графіки (SVG), картка, аватар, сегментований перемикач, іконки…
    layout/          оболонка: навігація (сайдбар → рейка → нижня панель), палітра ⌘K, перемикач картки
    pages/           Огляд, Транзакції, Тижні, Отримувач, Картки, Налаштування
    store/           NgRx (токен і картка; зберігається в localStorage, як і раніше)
```

**Один потік даних.** `FeedService` завантажує транзакції картки за вибраний період (і за попередній, для порівнянь).
Усі суми, графіки й рейтинги на всіх екранах рахуються з нього чистими функціями (`core/aggregate.ts`), тому цифри завжди збігаються.
Витрати й надходження — це сума від'ємних і додатних операцій, як раніше давав ендпоінт `grouped`.

## Теми

Тема — це набір змінних CSS на `[data-theme="…"]` (`src/styles/themes.css`); компоненти читають лише змінні.
Є п'ять тем (Aurora, Daylight, Ledger, Brutal, Terminal) і «Авто». Акцент задається кутом відтінку в OKLCH, тому контраст лишається передбачуваним у будь-якого кольору.

Щоб додати тему:
1. блок `[data-theme="my"]` у `themes.css` (скопіюйте найближчу тему й змініть значення);
2. палітра графіків `--viz-*` — у групу для світлих або темних тем, і прогін `validate_palette.js`;
3. запис у `THEMES` та `DEFAULT_HUES` (`src/app/core/themes.ts`), тип `ThemeId`;
4. за потреби структурні дрібниці (рамки, шрифт, фон) — поруч у `themes.css` / `components.css`.

Превʼю в «Налаштуваннях» малюються справжніми змінними теми, тому окремого макета не потрібно.

## Мови

Інтерфейс українською та англійською; вибір — у Налаштуваннях (зберігається й виставляє `<html lang>`, заголовок вкладки теж перекладається).

- Тексти: `src/app/i18n/messages/uk.ts` (джерело ключів) і `en.ts`. Англійський словник типізований під ті самі ключі, тож пропущений переклад не скомпілюється.
- У шаблонах: `{{ 'nav.overview' | t }}`, множина `{{ n | tp: 'plural.ops' }}`; у TS: `translate('…')`, `translatePlural('…', n)`.
- Числа, дати, відносний час: `core/format.ts` (локаль береться з мови). Назви категорій банку приходять українською; англійські переклади (усі 270 категорій) у `i18n/categories.ts`, для відображення — pipe `cat`.
- Нова мова: словник у `i18n/messages/`, запис у `LANGS` (`i18n/lang.ts`), переклади категорій. Тест `i18n.spec.ts` перевіряє, що ключі й `{плейсхолдери}` збігаються у всіх словниках.

## Іконки транзакцій

Порядок: `icon` з бекенду (якщо реально завантажується) → векторна іконка за категорією (для переказів між людьми — ініціали).
URL перевіряється один раз (`shared/icon-cache.service.ts`), тож мертве посилання не дає ні «битої» картинки, ні лавини 404 — просто показує векторну іконку.
Локальний `assets/<категорія>.png`-фолбек навмисно прибрано (був неактуальний для частини категорій); файли в `src/assets` лишились на диску, просто більше не використовуються.

## Про бекенд

- `DbContext` зареєстрований як `Singleton` (`OutlayApp.Infrastructure/Database/DependencyInjection.cs`), а EF Core не підтримує паралельне використання: одночасні запити повертають 500/503.
  Клієнт це обходить (`core/api-queue.interceptor.ts`: черга по одному запиту + повтор читань), але правильно виправити реєстрацію на бекенді.
- `by-period` у `dateTo` без часу відсікає сьогоднішні операції, тому клієнт надсилає кінець дня.
- Токен більше не зашитий у коді: фонове оновлення балансу використовує токен підключеного користувача.
