import { useMemo, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import type { IncidentDetail } from "@/api/contracts"
import { EvidenceLevelBadge } from "@/components/common"
import {
  DOSSIER_CORRIDOR_BETWEEN_PREFIX,
  DOSSIER_CORRIDOR_LABEL,
  DOSSIER_CORRIDOR_NONE,
  DOSSIER_CORRIDOR_OPEN_UP_PREFIX,
  DOSSIER_GENERATED_AT_LABEL,
  DOSSIER_INPUT_HASH_LABEL,
  DOSSIER_INPUT_HASH_MISSING,
  DOSSIER_KICKER,
  DOSSIER_LEGAL_TITLE,
  DOSSIER_NO_MAP_NOTE,
  DOSSIER_PERIOD_LABEL,
  DOSSIER_PROVENANCE_NOTE,
  DOSSIER_REGION_LABEL,
  DOSSIER_RULESET_LABEL,
  DOSSIER_RULESET_MISSING,
  DOSSIER_SECTIONS,
  DOSSIER_UPDATED_AT_LABEL,
  type DossierSectionId,
} from "@/constants/dossier"
import { EVIDENCE_LEVEL_META } from "@/constants/evidence"
import {
  PANEL_NO_FACTS,
  PANEL_NO_REJECTED,
  PANEL_NO_UNKNOWNS,
} from "@/constants/panel"
import { REGION_LABELS } from "@/constants/regions"
import { StatementList } from "@/features/conclusion/StatementList"
import { formatDateTime, formatMonth } from "@/lib/format"
import { CandidateObjectList } from "./CandidateObjectList"
import { DossierSources } from "./DossierSources"
import { MeasurementTable } from "./MeasurementTable"
import { SignalTimeline } from "./SignalTimeline"
import {
  buildDossierModel,
  type DossierCorridor,
  type DossierModel,
} from "./dossier-model"

type DossierDocumentProps = {
  detail: IncidentDetail
  /** Период события из списка (провизорное поле контракта); null — не определён. */
  period: string | null
  /** Момент формирования досье — фиксируется один раз при открытии страницы. */
  generatedAt: string
}

/**
 * Тело печатного досье: разделы 1–12 роадмапа §21.1 в порядке
 * `DOSSIER_SECTIONS`. Презентационный компонент — данные приходят готовыми,
 * ни один вывод здесь не вычисляется (запрет 6).
 */
export function DossierDocument({
  detail,
  period,
  generatedAt,
}: DossierDocumentProps) {
  const model = useMemo(() => buildDossierModel(detail), [detail])

  return (
    <article className="flex flex-col gap-6 text-sm leading-relaxed">
      {DOSSIER_SECTIONS.map((section) => {
        const body = (
          <SectionBody
            sectionId={section.id}
            detail={detail}
            model={model}
            period={period}
            generatedAt={generatedAt}
          />
        )
        // Пункты 1–2 §21.1 открывают лист: у титула и оговорки нет заголовка
        // раздела — они и есть шапка документа.
        return section.lead ? (
          <div key={section.id} className="break-inside-avoid">
            {body}
          </div>
        ) : (
          <section key={section.id} className="flex flex-col gap-2">
            <h2 className="break-after-avoid border-b pb-1 text-xs font-medium tracking-widest text-muted-foreground uppercase">
              {section.title}
            </h2>
            {body}
          </section>
        )
      })}
    </article>
  )
}

type SectionBodyProps = {
  sectionId: DossierSectionId
  detail: IncidentDetail
  model: DossierModel
  period: string | null
  generatedAt: string
}

function SectionBody({
  sectionId,
  detail,
  model,
  period,
  generatedAt,
}: SectionBodyProps) {
  const { t } = useTranslation()
  const { investigation } = detail

  switch (sectionId) {
    case "header":
      return (
        <header className="flex flex-col gap-2">
          <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            {DOSSIER_KICKER}
          </p>
          <h1 className="text-xl font-semibold text-pretty">
            {investigation.title}
          </h1>
          <dl className="flex flex-col gap-0.5 text-xs text-muted-foreground">
            <MetaRow label={DOSSIER_REGION_LABEL}>
              {REGION_LABELS[detail.region]}
            </MetaRow>
            {/* Периода может не быть вовсе (кейс «недостаточно данных») —
                тогда строки в шапке просто нет. */}
            {period !== null && (
              <MetaRow label={DOSSIER_PERIOD_LABEL}>
                {formatMonth(period)}
              </MetaRow>
            )}
            <MetaRow label={DOSSIER_UPDATED_AT_LABEL}>
              {formatDateTime(investigation.updatedAt)}
            </MetaRow>
            <MetaRow label={DOSSIER_GENERATED_AT_LABEL}>
              {formatDateTime(generatedAt)}
            </MetaRow>
          </dl>
        </header>
      )
    case "disclaimer":
      return (
        <aside className="flex flex-col gap-1 border p-3">
          <h2 className="text-xs font-medium tracking-widest uppercase">
            {DOSSIER_LEGAL_TITLE}
          </h2>
          <p className="text-xs text-pretty">{t("app.legalDisclaimer")}</p>
        </aside>
      )
    case "conclusion":
      return (
        <div className="flex flex-col gap-2">
          {/* Вывод печатается дословно с бэка — ни сокращений, ни пересказа. */}
          <p className="text-pretty">{investigation.conclusion}</p>
          <CorridorLine corridor={model.corridor} />
        </div>
      )
    case "evidenceLevel":
      return (
        <div className="flex flex-col items-start gap-1.5">
          <EvidenceLevelBadge level={investigation.evidenceLevel} />
          <p className="text-xs text-pretty text-muted-foreground">
            {EVIDENCE_LEVEL_META[investigation.evidenceLevel].description}
          </p>
        </div>
      )
    case "signals":
      return <SignalTimeline entries={model.signals} />
    case "measurements":
      return <MeasurementTable rows={model.measurements} />
    case "supportedFacts":
      return (
        <StatementList
          entries={model.supportedFacts}
          emptyText={PANEL_NO_FACTS}
        />
      )
    case "contradictedHypotheses":
      return (
        <StatementList
          entries={model.contradictedHypotheses}
          emptyText={PANEL_NO_REJECTED}
        />
      )
    case "unknowns":
      return investigation.unknowns.length > 0 ? (
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          {investigation.unknowns.map((unknown) => (
            <li key={unknown} className="break-inside-avoid text-pretty">
              {unknown}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">{PANEL_NO_UNKNOWNS}</p>
      )
    case "candidateObjects":
      return <CandidateObjectList entries={model.objects} />
    case "sources":
      return <DossierSources entries={model.sources} />
    case "provenance":
      return (
        <div className="flex flex-col gap-2">
          <dl className="flex flex-col gap-0.5 text-xs">
            <MetaRow label={DOSSIER_RULESET_LABEL}>
              {model.provenance.rulesetVersion ?? (
                <span className="text-muted-foreground">
                  {DOSSIER_RULESET_MISSING}
                </span>
              )}
            </MetaRow>
            <MetaRow label={DOSSIER_INPUT_HASH_LABEL}>
              {model.provenance.inputHash ? (
                <span className="font-mono break-all">
                  {model.provenance.inputHash}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  {DOSSIER_INPUT_HASH_MISSING}
                </span>
              )}
            </MetaRow>
          </dl>
          <p className="text-xs text-pretty text-muted-foreground">
            {DOSSIER_PROVENANCE_NOTE}
          </p>
        </div>
      )
  }
}

function CorridorLine({ corridor }: { corridor: DossierCorridor }) {
  if (corridor === null) {
    return (
      <p className="text-xs text-muted-foreground">{DOSSIER_CORRIDOR_NONE}</p>
    )
  }

  // Имена створов не берутся в кавычки: в них уже есть свои («Атырау су
  // арнасы»), и вложенные ёлочки в печати читаются как опечатка.
  const bounds =
    corridor.kind === "openUpstream"
      ? `${DOSSIER_CORRIDOR_OPEN_UP_PREFIX} ${corridor.downstream.name}`
      : `${DOSSIER_CORRIDOR_BETWEEN_PREFIX} ${corridor.upstream.name} и ${corridor.downstream.name}`

  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-pretty">
        <span className="font-medium">{DOSSIER_CORRIDOR_LABEL}:</span> {bounds}
      </p>
      <p className="text-xs text-muted-foreground">{DOSSIER_NO_MAP_NOTE}</p>
    </div>
  )
}

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="after:content-[':']">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
