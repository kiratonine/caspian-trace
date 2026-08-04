import { LiveStatusSchema } from "@caspian-trace/contracts"

import { apiGet, IS_SEED_MODE, parseSeed, warnStubOnce } from "./client"
import type { LiveStatus } from "./contracts"
import { liveStatusSeed } from "./seed-data"

// GET /api/live/status — состояние источников, отдаёт full-stack 1.
// Отдельно от остальных: сбой внешнего источника приходит сюда как 200
// с `degraded`/`failed`, а не как ошибка запроса («источник недоступен»
// ≠ «событий нет»).
// STUB: ветка seed остаётся аварийным офлайн-режимом и после интеграции.
export async function fetchLiveStatus(
  signal?: AbortSignal
): Promise<LiveStatus> {
  if (IS_SEED_MODE) {
    warnStubOnce(
      "GET /api/live/status — фиксированный статус: источники ни разу не опрашивались"
    )
    return parseSeed(LiveStatusSchema, liveStatusSeed, "GET /api/live/status")
  }

  return apiGet("/live/status", LiveStatusSchema, { signal })
}
