// Экранный реестр заглушек — короткая копия `docs/stubs.md` для интерфейса.
// Смысл: зритель и команда должны видеть, что именно на экране приходит
// из файла, а не из бэкенда, не открывая консоль и репозиторий.
//
// Формулировка выбрана осторожно: «заглушка» здесь — способ доставки данных,
// а не их источник. Значения в `seed-data.ts` настоящие (бюллетени
// Казгидромета, ТЗ §5, с настоящими sha256, страницами и выдержками),
// поэтому назвать содержимое экрана выдуманным было бы такой же неправдой,
// как выдать файл за ответ API.
//
// Полный реестр (включая `GET /api/investigations/:id/evidence`, который UI
// пока не потребляет) остаётся в `docs/stubs.md`: здесь только то, что видно
// на экране.

export type StubDataSource = {
  id: string
  /** Что этот эндпоинт наполняет на экране. */
  screenArea: string
  endpoint: string
  /** Поднят ли эндпоинт у бэкенда на 05.08.2026 (docs/stubs.md). */
  backendReady: boolean
}

export const STUB_DATA_SOURCES: readonly StubDataSource[] = [
  {
    id: "incidents",
    screenArea: "Лента событий, схема реки, правая панель, досье",
    endpoint: "GET /api/incidents, GET /api/incidents/:id",
    backendReady: false,
  },
  {
    id: "replay",
    screenArea: "Сценарий реплея",
    endpoint: "POST /api/replays/:id/start",
    backendReady: true,
  },
  {
    id: "export",
    screenArea: "Досье в JSON",
    endpoint: "GET /api/investigations/:id/export",
    backendReady: true,
  },
  {
    id: "live-status",
    screenArea: "Состояние источников (этот список)",
    endpoint: "GET /api/live/status",
    backendReady: false,
  },
]

/** Метка в шапке: короткое слово, которое видно без открытия поповера. */
export const STUB_BADGE_LABEL = "заглушки"

export const DATA_MODE_TITLE = "Режим данных"

export const DATA_MODE_SEED_SUMMARY =
  "Данные читаются из проверенного файла в сборке, а не из API: бэкенд ещё не подключён."

export const DATA_MODE_SEED_EXPLANATION =
  "Числа при этом не выдуманы: значения, страницы и SHA-256 — из бюллетеней Казгидромета. " +
  "Заглушка это способ доставки, а не источник данных."

export const DATA_MODE_API_SUMMARY =
  "Данные читаются из API. Ответ каждого эндпоинта проверяется схемой контракта на границе сети."

export const STUB_ENDPOINT_READY = "эндпоинт поднят"

export const STUB_ENDPOINT_MISSING = "эндпоинта ещё нет"
