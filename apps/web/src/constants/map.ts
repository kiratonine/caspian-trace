// Карта — MapLibre GL (решение владельца продукта 06.08.2026).
//
// ВНИМАНИЕ. Подтверждённых координат в данных нет: у всех створов и объектов
// `location: null`, в `data/verified/**` координат не передавали вовсе.
// Поэтому позиции ниже — ДЕМОНСТРАЦИОННЫЕ, поставлены для показа и ничего
// не утверждают о реальном положении точек на местности. Оговорка об этом —
// в i18n-ресурсе (map.coordinateMode.schematicDisclaimer).
//
// Когда бэк отдаст `Station.location` / `CandidateObject.location`, удаляется
// ровно эта таблица: остальной код уже читает координаты из модели.

/** Демонстрационные координаты створов, [lon, lat]. НЕ проверенные данные. */
export const MAP_SCHEMATIC_STATION_COORDS: Record<string, [number, number]> =
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

/** Потолок ширины подписи створа: за ним имя усекается, число — никогда. */
export const MAP_LABEL_MAX_WIDTH = "13rem"

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

/**
 * Основание, по которому объект размещается между створами. Координат у
 * объектов нет, но подписи створов бюллетеня называют сброс по имени — и это
 * проверенные данные со страницы 22. Положение выводится из них, и это
 * печатается пользователю в подписи маркера, а не умалчивается (текст
 * основания — в i18n-ресурсе, map.objectPlacementBasis, тем же ключом id).
 *
 * Удаляется вместе с таблицей координат, когда бэк отдаст `location`
 * объекта либо `candidateObjects[].stationId` в контракте.
 */
export const MAP_OBJECT_PLACEMENT: Record<
  string,
  { betweenStationIds: readonly [string, string] }
> = {
  "obj-atyrau-su-arnasy": {
    betweenStationIds: ["st-asa-0-5km-above", "st-asa-0-5km-below"],
  },
}
