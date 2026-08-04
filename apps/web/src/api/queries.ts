import { queryOptions } from '@tanstack/react-query';

import { fetchIncidentDetail, fetchIncidents } from './incidents';

// Ключи и опции запросов в одном месте: все три колонки главного экрана читают
// одно и то же выбранное событие, TanStack Query дедуплицирует их по ключу.

export const incidentsQueryOptions = queryOptions({
  queryKey: ['incidents'],
  queryFn: () => fetchIncidents(),
});

export function incidentDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['incidents', id],
    queryFn: () => fetchIncidentDetail(id),
  });
}
