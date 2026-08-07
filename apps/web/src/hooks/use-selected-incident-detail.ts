import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"

import {
  incidentDetailQueryOptions,
  incidentsQueryOptions,
} from "@/api/queries"
import { INCIDENT_SEARCH_PARAM } from "@/constants/routing"

// Выбранное событие — общее для всех колонок главного экрана: `?incident=`
// из URL (deep-link решения сессии 1), фолбэк — первое событие списка.
// Хук зовут несколько колонок, но запросы дедуплицируются по ключу.
//
// Граф доказательств (`GET /api/investigations/:id/evidence`) здесь НЕ
// подмешивается: он несёт только измерения и документы, на которых стоят
// утверждения, а не полный состав события — подмена ими detail стирает со схемы
// створы без утверждений и вычищает из блока «Источники» публикации §7.4.
// Соединение двух источников — задача F3/F5, когда у бэка появится
// `GET /api/incidents/:id`.
export function useSelectedIncidentDetail() {
  const incidentsQuery = useQuery(incidentsQueryOptions)
  const [searchParams] = useSearchParams()
  const selectedIncidentId =
    searchParams.get(INCIDENT_SEARCH_PARAM) ??
    incidentsQuery.data?.[0]?.id ??
    null
  const detailQuery = useQuery({
    ...incidentDetailQueryOptions(selectedIncidentId ?? ""),
    enabled: selectedIncidentId !== null,
  })

  return {
    // Ленте нужен и сам id: подсветка карточки должна идти из того же
    // источника истины, что и данные схемы/панели.
    selectedIncidentId,
    detail: detailQuery.data ?? null,
    isError: incidentsQuery.isError || detailQuery.isError,
  }
}
