// Search-параметры маршрута «/» (решение сессии 1: выбранное расследование
// живёт в URL — deep-link для защиты, устойчивость к F5). Читает параметр
// хук use-selected-incident-detail (фолбэк — первое событие списка),
// пишет — лента (клик по карточке); переключатель май/сентябрь добавится
// в своей сессии.
export const INCIDENT_SEARCH_PARAM = "incident"

// Вкладка живёт в URL рядом с `?incident=` (сессия 19): F5 на демо не должен
// сбрасывать показ, а «открой сразу карту» обязано быть ссылкой.
export const TAB_SEARCH_PARAM = "tab"

// Печатное досье (роадмап §21.3). Шаблон и построение пути живут рядом:
// маршрутизатор и ссылки не должны расходиться в написании.
export const DOSSIER_ROUTE = "/dossier/:id"

export const DOSSIER_ID_PARAM = "id"

export function dossierPath(incidentId: string): string {
  return `/dossier/${encodeURIComponent(incidentId)}`
}

/** Главный экран с уже выбранным событием — возврат из досье. */
export function incidentPath(incidentId: string): string {
  return `/?${INCIDENT_SEARCH_PARAM}=${encodeURIComponent(incidentId)}`
}
