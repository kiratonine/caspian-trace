import type { LiveStatus } from "./contracts"
import { warnStubOnce } from "./client"
import { liveStatusSeed } from "./seed-data"

// STUB: заменить на GET /api/live/status (apiGet из ./client), отдаёт full-stack 1.
export async function fetchLiveStatus(): Promise<LiveStatus> {
  warnStubOnce(
    "GET /api/live/status — фиксированный статус: сеть недоступна, кэш бюллетеней есть"
  )
  return liveStatusSeed
}
