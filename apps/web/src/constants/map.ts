// Карта — MapLibre GL (решение владельца продукта 06.08.2026).
//
// ВНИМАНИЕ. Подтверждённых координат в данных нет: у всех створов и объектов
// `location: null`, в `data/verified/**` координат не передавали вовсе.
// Поэтому позиции ниже — ДЕМОНСТРАЦИОННЫЕ, поставлены для показа и ничего
// не утверждают о реальном положении точек на местности. На экране это
// сказано плашкой MAP_PLACEHOLDER_WARNING, которую нельзя закрыть.
//
// Когда бэк отдаст `Station.location` / `CandidateObject.location`, удаляется
// ровно эта таблица: остальной код уже читает координаты из модели.

/** Демонстрационные координаты створов, [lon, lat]. НЕ проверенные данные. */
export const MAP_PLACEHOLDER_STATION_COORDS: Record<string, [number, number]> =
  {
    "st-zhaiyk-1km-above-atyrau": [51.9236, 47.148],
    "st-asa-0-5km-above": [51.9138, 47.1279],
    "st-asa-0-5km-below": [51.9074, 47.1146],
    "st-zhaiyk-1km-below-atyrau": [51.8993, 47.0958],
  }

/**
 * Насколько продлить участок вверх по течению, когда верхней границы нет
 * (`upstreamStationId: null`), в градусах широты. Линия уходит за верхний
 * створ и растворяется — у интервала действительно нет верхней границы.
 */
export const MAP_OPEN_CORRIDOR_EXTENSION_DEG = 0.035

// Подложка — растровые тайлы OpenStreetMap (решение владельца продукта
// 06.08.2026: «давай онлайн-тайлы»). ЭТО ОСОЗНАННОЕ ОТСТУПЛЕНИЕ от критерия
// приёмки «демо работает без интернета»: без сети подложка не загрузится.
// Остальной экран, включая наши слои и маркеры, офлайн продолжает работать —
// тайлы просто не появятся, карта останется на пустом фоне.
export const MAP_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"

/** Условие использования тайлов OSM — атрибуция обязательна. */
export const MAP_TILE_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'

/** Стартовый центр до первого `fitBounds`, [lon, lat]. */
export const MAP_INITIAL_CENTER: [number, number] = [51.9138, 47.1279]

export const MAP_INITIAL_ZOOM = 11.5

export const MAP_FIT_PADDING = 96

/**
 * Кадры пунктира для анимации сноса вниз по течению. Смысл кадра — не
 * украшение: перенос идёт сверху вниз, поэтому источник ищут ВЫШЕ участка,
 * и это единственное, что анимация сообщает.
 */
export const MAP_FLOW_DASH_FRAMES: readonly number[][] = [
  [0, 4, 3],
  [0.5, 4, 2.5],
  [1, 4, 2],
  [1.5, 4, 1.5],
  [2, 4, 1],
  [2.5, 4, 0.5],
  [3, 4, 0],
  [0, 0.5, 4, 2.5],
  [0, 1, 4, 2],
  [0, 1.5, 4, 1.5],
  [0, 2, 4, 1],
  [0, 2.5, 4, 0.5],
]

export const MAP_FLOW_FRAME_MS = 60

/** Короткая метка на карте; полная формулировка — в её тултипе. */
export const MAP_PLACEHOLDER_CHIP = "демо-координаты"

export const MAP_PLACEHOLDER_WARNING =
  "Координаты на карте демонстрационные: подтверждённых координат створов в данных нет. Порядок створов вниз по течению подтверждён документами, положение точек на местности — нет."

export const MAP_UNPLACED_CHIP = "положение не подтверждено"

export const MAP_CORRIDOR_OPEN_UPSTREAM_LABEL =
  "участок открыт вверх по течению"

export const MAP_UNPLACED_NOTE =
  "Для этих створов и объектов место в цепочке течения не подтверждено документами, поэтому на карте они не размещены."

/** ТЗ §4: имя объекта допустимо только с этой подписью и документами-основаниями. */
export const MAP_CANDIDATE_LABEL = "объект для проверки"

export const MAP_VERDICT_CORRIDOR_PREFIX = "Участок:"

export const MAP_VERDICT_OPEN_UPSTREAM_PREFIX = "выше створа"

export const MAP_VERDICT_BETWEEN_PREFIX = "между створами"

export const MAP_VERDICT_EXCLUDED_PREFIX = "Исключено фактами:"

export const MAP_VERDICT_EVIDENCE_LINK = "Разбор и доказательства"

export const MAP_VERDICT_DOSSIER_LINK = "Досье"

export const MAP_OBJECT_OUTSIDE_CORRIDOR = "вне участка"

export const MAP_OBJECT_INSIDE_CORRIDOR = "в границах участка"

/**
 * Основание, по которому объект размещается между створами. Координат у
 * объектов нет, но подписи створов бюллетеня называют сброс по имени — и это
 * проверенные данные со страницы 22. Положение выводится из них, и это
 * печатается пользователю в подписи маркера, а не умалчивается.
 *
 * Удаляется вместе с таблицей координат, когда бэк отдаст `location`
 * объекта либо `candidateObjects[].stationId` в контракте.
 */
export const MAP_OBJECT_PLACEMENT: Record<
  string,
  { betweenStationIds: readonly [string, string]; basis: string }
> = {
  "obj-atyrau-su-arnasy": {
    betweenStationIds: ["st-asa-0-5km-above", "st-asa-0-5km-below"],
    basis:
      "Положение выведено из подписей створов бюллетеня Казгидромета («0,5 км выше сброса» и «0,5 км ниже сброса», стр. 22), а не из координат: координаты объекта не переданы.",
  },
}
