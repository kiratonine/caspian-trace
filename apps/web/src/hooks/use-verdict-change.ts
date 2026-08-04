import { useState } from "react"
import { useQuery } from "@tanstack/react-query"

import {
  incidentDetailQueryOptions,
  incidentsQueryOptions,
} from "@/api/queries"
import { areComparable } from "@/features/comparison/comparison-model"
import type { VerdictSide } from "@/features/comparison/VerdictChange"

export type VerdictChangeState = {
  before: VerdictSide
  after: VerdictSide
  dismiss: () => void
}

/**
 * Отслеживает переход между сопоставимыми периодами одного участка и отдаёт
 * пару «было → стало». Предыдущий выбор запоминается сравнением с прошлым
 * рендером (штатный приём React вместо эффекта с setState), а его данные
 * берутся из кэша TanStack Query — событие только что показывали, запроса
 * не будет.
 */
export function useVerdictChange(
  selectedIncidentId: string | null
): VerdictChangeState | null {
  const incidentsQuery = useQuery(incidentsQueryOptions)
  const summaries = incidentsQuery.data ?? []

  const [renderedId, setRenderedId] = useState(selectedIncidentId)
  const [previousId, setPreviousId] = useState<string | null>(null)
  const [dismissedTransition, setDismissedTransition] = useState<string | null>(
    null
  )

  if (selectedIncidentId !== renderedId) {
    setPreviousId(renderedId)
    setRenderedId(selectedIncidentId)
  }

  const before = summaries.find((s) => s.id === previousId)
  const after = summaries.find((s) => s.id === selectedIncidentId)
  const comparable = areComparable(before, after)

  // Хуки нельзя звать условно: запрос всегда объявлен, но включается только
  // для сопоставимой пары. Данные уже в кэше — это чтение, а не загрузка.
  const beforeDetailQuery = useQuery({
    ...incidentDetailQueryOptions(before?.id ?? ""),
    enabled: comparable,
  })
  const afterDetailQuery = useQuery({
    ...incidentDetailQueryOptions(after?.id ?? ""),
    enabled: comparable,
  })

  if (!comparable || !before || !after) return null

  const transitionKey = `${before.id}->${after.id}`
  if (dismissedTransition === transitionKey) return null

  const beforeConclusion = beforeDetailQuery.data?.investigation.conclusion
  const afterConclusion = afterDetailQuery.data?.investigation.conclusion
  // Без обоих выводов сравнивать нечего: пустую плашку не показываем.
  if (!beforeConclusion || !afterConclusion) return null

  return {
    before: {
      period: before.period,
      evidenceLevel: before.evidenceLevel,
      conclusion: beforeConclusion,
    },
    after: {
      period: after.period,
      evidenceLevel: after.evidenceLevel,
      conclusion: afterConclusion,
    },
    dismiss: () => setDismissedTransition(transitionKey),
  }
}
