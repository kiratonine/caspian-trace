// Печатное досье (роадмап §21.1, состав экспорта). Документ уходит на бумагу
// и живёт дольше экрана, поэтому формулировки здесь ещё осторожнее, чем
// в интерфейсе: ни одна строка не должна читаться как утверждение о виновности
// (ТЗ §4, §17).

export const DOSSIER_KICKER = "Досье расследования"

// Ссылка с главного экрана: в узкой колонке панели — короткая подпись,
// полная формулировка §21.3 остаётся доступной ассистивным технологиям.
export const DOSSIER_LINK_LABEL = "Досье"

export const DOSSIER_OPEN_ACTION = "Открыть досье"

// Порядок разделов = состав досье из роадмапа §21.1, пункты 1–12 сверху вниз.
// Как и CONCLUSION_SECTIONS, массив и есть контракт: страница рендерит его
// как есть, и полноту состава видно в одном месте.
// `lead` — пункты 1–2: титул документа и оговорка. Они открывают лист
// и не получают заголовка раздела, но остаются в списке, чтобы состав §21.1
// не пришлось искать по компонентам.
export const DOSSIER_SECTIONS = [
  { id: "header", title: "Заголовок и дата генерации", lead: true },
  { id: "disclaimer", title: "Правовая оговорка", lead: true },
  { id: "conclusion", title: "Итоговая формулировка", lead: false },
  { id: "evidenceLevel", title: "Уровень доказательности", lead: false },
  { id: "signals", title: "Хронология сигналов", lead: false },
  { id: "measurements", title: "Измерения", lead: false },
  { id: "supportedFacts", title: "Что установлено", lead: false },
  {
    id: "contradictedHypotheses",
    title: "Версии, которые не объясняют событие",
    lead: false,
  },
  { id: "unknowns", title: "Что неизвестно", lead: false },
  { id: "candidateObjects", title: "Объекты для проверки", lead: false },
  { id: "sources", title: "Источники", lead: false },
  {
    id: "provenance",
    title: "Версия правил и хэш входных данных",
    lead: false,
  },
] as const

export type DossierSectionId = (typeof DOSSIER_SECTIONS)[number]["id"]

// --- Действия (роадмап §21.3) ------------------------------------------------

export const DOSSIER_PRINT_ACTION = "Печать / сохранить PDF"

export const DOSSIER_JSON_ACTION = "Скачать JSON"

export const DOSSIER_JSON_ERROR = "Не удалось подготовить JSON."

export const DOSSIER_BACK_ACTION = "К экрану расследования"

// --- Шапка документа ---------------------------------------------------------

export const DOSSIER_REGION_LABEL = "Область"

export const DOSSIER_PERIOD_LABEL = "Период наблюдений"

export const DOSSIER_UPDATED_AT_LABEL = "Вывод обновлён"

export const DOSSIER_GENERATED_AT_LABEL = "Досье сформировано"

export const DOSSIER_LEGAL_TITLE = "Правовая оговорка"

// --- Участок (часть итоговой формулировки, отдельного пункта в §21.1 нет) ----

export const DOSSIER_CORRIDOR_LABEL = "Участок"

// «Участок» вместо «карты коридора»: координаты створов не подтверждены
// (ТЗ §17), поэтому границы называются именами створов, а не рисуются на карте.
export const DOSSIER_CORRIDOR_OPEN_UP_PREFIX =
  "Открыт вверх по течению от створа"

export const DOSSIER_CORRIDOR_BETWEEN_PREFIX = "Между створами"

export const DOSSIER_CORRIDOR_NONE = "Границы участка не определены."

export const DOSSIER_NO_MAP_NOTE =
  "Координаты створов не подтверждены, поэтому карта в досье не приводится: " +
  "участок задан названиями граничных створов."

// --- Пустые состояния разделов ----------------------------------------------
// Формулировки описывают состояние данных, а не значимость события.

export const DOSSIER_NO_SIGNALS =
  "К событию не привязано ни одного публичного сигнала."

export const DOSSIER_NO_MEASUREMENTS =
  "К событию не приложено ни одного измерения."

export const DOSSIER_NO_OBJECTS =
  "Объекты для проверки в пределах участка не перечислены."

// --- Хронология сигналов -----------------------------------------------------

export const DOSSIER_TIMELINE_OBSERVED = "Наблюдалось"

export const DOSSIER_TIMELINE_REPORTED = "Сообщено"

// --- Таблица измерений -------------------------------------------------------

export const DOSSIER_MEASUREMENT_COLUMNS = {
  station: "Створ",
  indicator: "Показатель",
  matrix: "Среда",
  sampledAt: "Дата отбора",
  value: "Значение",
  source: "Источник",
} as const

// Дата отбора может быть неизвестна целиком — в таблице это отдельная ячейка,
// и пустое место в ней читалось бы как потерянные данные.
export const DOSSIER_NO_DATE = "дата не указана"

// --- Объекты для проверки ----------------------------------------------------

// ТЗ §4: объект в досье всегда «объект для проверки». Подпись полноты данных
// описывает документы, а не поведение объекта.
export const DOSSIER_COMPLETENESS_LABELS = {
  confirmed: "упомянут в источниках напрямую",
  partial: "сведения в источниках неполны",
} as const

export const DOSSIER_OBJECT_BASIS_LABEL = "Основания"

export const DOSSIER_OBJECT_NO_BASIS =
  "Документы-основания не приложены."

// --- Источники ---------------------------------------------------------------

export const DOSSIER_SOURCE_PAGE_PREFIX = "стр."

// Роадмап §21.1 требует SHA-256 в экспорте. Пустой хэш не замалчиваем:
// читатель должен видеть, что сверить целостность файла пока нечем.
export const DOSSIER_SHA_LABEL = "SHA-256"

export const DOSSIER_SHA_NOT_COMPUTED = "не вычислен"

// --- Воспроизводимость (пункт 12) --------------------------------------------

export const DOSSIER_RULESET_LABEL = "Версия правил"

export const DOSSIER_INPUT_HASH_LABEL = "Хэш входных данных"

// Согласование с родом существительного: «версия не передана», «хэш не передан».
export const DOSSIER_RULESET_MISSING = "не передана расчётным ядром"

export const DOSSIER_INPUT_HASH_MISSING = "не передан расчётным ядром"

export const DOSSIER_PROVENANCE_NOTE =
  "Версия правил и хэш входных данных позволяют повторить расчёт и получить " +
  "тот же вывод. Их вычисляет расчётное ядро; пока оно не передало значения, " +
  "досье сообщает об этом прямо, а не подставляет правдоподобные."
