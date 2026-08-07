# Откат: убрать карту

Файл заведён 06.08.2026 по просьбе владельца продукта: «если вдруг не
понравится им — сохрани промпт, чтобы убрать агента и карту».

**Вкладок и вкладки агента в итоге не осталось** — их сняли в ходе той же
сессии (см. `d79a90b`), поэтому откатывать нужно только карту: она стоит
центральной колонкой вместо линейной схемы реки.

## Что было добавлено

- `apps/web/src/features/map/**` — карта MapLibre, модель позиций, маркеры.
- `apps/web/src/constants/map.ts` — координаты, тайлы, строки, кадры анимации.
- Зависимость `maplibre-gl` в `apps/web/package.json` и `package-lock.json`.
- `apps/web/vite.config.ts` — `optimizeDeps.exclude: ['maplibre-gl']`
  и `worker.format: 'es'` (без них воркер MapLibre не поднимается).
- Оговорка про демо-координаты в `apps/web/src/constants/stubs.ts`
  (`MAP_COORDS_DISCLAIMER*`) и её вывод в
  `apps/web/src/features/live-status/DataModeNotice.tsx`.
- В `apps/web/src/App.tsx` центральная колонка — `MapColumn` вместо
  `RiverScheme`.

Линейная схема реки (`features/river-scheme/**`) **не удалялась**: она цела,
покрыта дев-превью `/dev/river-scheme` и возвращается одной строкой в `App.tsx`.

## Способ 1 — git

Работа сессии 19 — коммиты от `c4deb13` до `d79a90b` включительно
(`e0f7389` — не про карту, это хвост форматирования сессии 18, его не трогать).

```bash
git log --oneline c4deb13^..d79a90b
git revert --no-commit c4deb13^..d79a90b
git commit -m "revert: убрать карту по решению владельца продукта"
npm install
npm run typecheck -w web && npm run lint -w web && npm run build -w web
```

## Способ 2 — промпт

Скопировать целиком в новую сессию:

> Убери из фронтенда «Каспийского следа» карту, добавленную в сессии 19
> (06.08.2026). Читай `docs/rollback-map-tabs.md` и
> `docs/superpowers/specs/2026-08-06-map-tabs-design.md`.
>
> Что сделать:
> 1. В `apps/web/src/App.tsx` вернуть в центральную колонку `RiverScheme`
>    вместо `MapColumn` (компонент схемы цел, ничего восстанавливать не надо).
> 2. Удалить папку `apps/web/src/features/map/` и `apps/web/src/constants/map.ts`.
> 3. Убрать из `apps/web/src/constants/stubs.ts` константы
>    `MAP_COORDS_DISCLAIMER_TITLE` и `MAP_COORDS_DISCLAIMER`, а из
>    `apps/web/src/features/live-status/DataModeNotice.tsx` — блок, который
>    их печатает.
> 4. Удалить зависимость `maplibre-gl` из `apps/web/package.json`, выполнить
>    `npm install` из корня, чтобы обновился lockfile.
> 5. Убрать из `apps/web/vite.config.ts` `optimizeDeps.exclude` с
>    `maplibre-gl` и блок `worker` — они нужны только карте.
> 6. Проверить, что нигде не осталось импортов удалённых модулей.
>
> Чего НЕ делать: не трогать ленту, правую панель, реплей, печатное досье,
> `src/api/**`, `apps/api/**`, `packages/**`. Не трогать коммит `e0f7389` —
> он про форматирование, а не про карту.
>
> Проверить: `npm run typecheck -w web`, `npm run lint -w web`,
> `npx prettier --check "apps/web/src/**/*.{ts,tsx,css}"`,
> `npm run build -w web` — зелёные; на главном экране в центре снова
> линейная схема; `?incident=` и `/dossier/:id` работают; бандл вернулся
> примерно к 944 kB.
>
> В конце обновить `docs/frontend-plan.md` и `docs/decisions.md`: записать,
> что карта снята по решению владельца продукта, и удалить этот файл.

## Если надо убрать только подложку OSM, оставив карту

В `apps/web/src/features/map/MapLibreMap.tsx` убрать из `BASE_STYLE` источник
`osm` и одноимённый слой, оставив только `background`. Демо снова станет
полностью офлайновым, карта останется с нашими слоями на пустом фоне.
