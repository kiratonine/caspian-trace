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
// на экране. screenArea — текст, читается по id из i18n-ресурса
// (stubs.source.<id>.screenArea); id/endpoint/backendReady остаются данными.

export type StubDataSourceId = "incidents" | "replay" | "export" | "live-status"

export type StubDataSource = {
  id: StubDataSourceId
  endpoint: string
  /** Поднят ли эндпоинт у бэкенда на 05.08.2026 (docs/stubs.md). */
  backendReady: boolean
}

export const STUB_DATA_SOURCES: readonly StubDataSource[] = [
  {
    id: "incidents",
    endpoint: "GET /api/incidents, GET /api/incidents/:id",
    backendReady: false,
  },
  {
    id: "replay",
    endpoint: "POST /api/replays/:id/start",
    backendReady: true,
  },
  {
    id: "export",
    endpoint: "GET /api/investigations/:id/export",
    backendReady: true,
  },
  {
    id: "live-status",
    endpoint: "GET /api/live/status",
    backendReady: false,
  },
]
