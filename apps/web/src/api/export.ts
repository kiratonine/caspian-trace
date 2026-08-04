import { DossierSchema } from "@caspian-trace/contracts"

import { LEGAL_DISCLAIMER } from "@/constants/strings"
import { apiGet, IS_SEED_MODE, parseSeed, warnStubOnce } from "./client"
import type { Dossier, IncidentDetail } from "./contracts"
import { incidentDetails } from "./seed-data"

// GET /api/investigations/:id/export?format=json — машиночитаемое досье,
// отдаёт full-stack 2. Печатный маршрут /dossier/:id от него не зависит:
// страница рисуется из тех же данных, что экран (решение сессии 1),
// а JSON нужен для машинной проверки.
//
// Форма ответа — `Dossier` из пакета контрактов; наш прежний
// `{ generatedAt, disclaimer, incident }` отменён (вопрос 5 закрыт).
// STUB: ветка seed остаётся аварийным офлайн-режимом и после интеграции.
export async function fetchDossierJson(
  id: string,
  signal?: AbortSignal
): Promise<Dossier> {
  if (IS_SEED_MODE) {
    warnStubOnce(
      "GET /api/investigations/:id/export?format=json — данные из ТЗ §5"
    )
    const detail = incidentDetails[id]
    if (!detail) throw new Error(`Расследование «${id}» не найдено`)
    return parseSeed(
      DossierSchema,
      buildDossierFromDetail(detail),
      `GET /api/investigations/${id}/export?format=json`
    )
  }

  return apiGet(
    `/investigations/${encodeURIComponent(id)}/export`,
    DossierSchema,
    { params: { format: "json" }, signal }
  )
}

// Код пробела в данных присваивает расчётное ядро; в сиде его нет, а выдумывать
// таксономию кодов нельзя — текст пробела уезжает целиком, код помечен как
// непереданный.
const UNSPECIFIED_UNKNOWN_CODE = "UNSPECIFIED"

function buildDossierFromDetail(detail: IncidentDetail): Dossier {
  const { investigation } = detail
  return {
    title: investigation.title,
    // Дата выгрузки файла, а не дата вывода: `investigation.updatedAt`
    // означает совсем другое.
    generatedAt: new Date().toISOString(),
    disclaimer: LEGAL_DISCLAIMER,
    conclusion: investigation.conclusion,
    evidenceLevel: investigation.evidenceLevel,
    signals: detail.signals,
    measurements: detail.measurements,
    supportedFacts: investigation.supportedFacts,
    contradictedHypotheses: investigation.contradictedHypotheses,
    unknowns: investigation.unknowns.map((text) => ({
      code: UNSPECIFIED_UNKNOWN_CODE,
      text,
    })),
    candidateObjects: detail.candidateObjects,
    sources: detail.sourceDocuments,
    // Считает расчётное ядро; сид собран вручную (verified_seed), приписывать
    // ему версию правил и хэш входа было бы выдумкой (запрет 1 CLAUDE.md).
    inputHash: null,
    rulesetVersion: null,
  }
}
