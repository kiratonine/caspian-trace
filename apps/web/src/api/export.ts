import { LEGAL_DISCLAIMER } from "@/constants/strings"
import { warnStubOnce } from "./client"
import type { DossierExport } from "./contracts"
import { incidentDetails } from "./seed-data"

// STUB: заменить на GET /api/investigations/:id/export?format=json (apiGet
// из ./client), отдаёт full-stack 2 — эндпоинт ещё не заведён (роадмап §9.6).
// Печатный маршрут /dossier/:id от него не зависит: страница рисуется из тех же
// данных, что экран (решение сессии 1), а JSON нужен для машинной проверки.
export async function fetchDossierJson(id: string): Promise<DossierExport> {
  warnStubOnce(
    "GET /api/investigations/:id/export?format=json — данные из ТЗ §5"
  )
  const detail = incidentDetails[id]
  if (!detail) throw new Error(`Расследование «${id}» не найдено`)
  return {
    // Дата выгрузки файла, а не дата вывода: `investigation.updatedAt`
    // остаётся внутри `incident` и означает совсем другое.
    generatedAt: new Date().toISOString(),
    disclaimer: LEGAL_DISCLAIMER,
    incident: detail,
  }
}
