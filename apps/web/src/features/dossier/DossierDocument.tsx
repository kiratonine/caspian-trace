import { useMemo, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import type { TFunction } from "i18next"

import type { IncidentDetail } from "@/api/contracts"
import { EvidenceLevelBadge } from "@/components/common"
import { DOSSIER_SECTIONS, type DossierSectionId } from "@/constants/dossier"
import { StatementList } from "@/features/conclusion/StatementList"
import { useFormat } from "@/i18n/use-format"
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
  const { t } = useTranslation()
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
              {t(`dossier.section.${section.id}`)}
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
  const { formatDateTime, formatMonth } = useFormat()
  const { investigation } = detail

  switch (sectionId) {
    case "header":
      return (
        <header className="flex flex-col gap-2">
          <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            {t("dossier.kicker")}
          </p>
          <h1 className="text-xl font-semibold text-pretty">
            {investigation.title}
          </h1>
          <dl className="flex flex-col gap-0.5 text-xs text-muted-foreground">
            <MetaRow label={t("dossier.regionLabel")}>
              {t(`regions.${detail.region}`)}
            </MetaRow>
            {/* Периода может не быть вовсе (кейс «недостаточно данных») —
                тогда строки в шапке просто нет. */}
            {period !== null && (
              <MetaRow label={t("dossier.periodLabel")}>
                {formatMonth(period)}
              </MetaRow>
            )}
            <MetaRow label={t("dossier.updatedAtLabel")}>
              {formatDateTime(investigation.updatedAt)}
            </MetaRow>
            <MetaRow label={t("dossier.generatedAtLabel")}>
              {formatDateTime(generatedAt)}
            </MetaRow>
          </dl>
        </header>
      )
    case "disclaimer":
      return (
        <aside className="flex flex-col gap-1 border p-3">
          <h2 className="text-xs font-medium tracking-widest uppercase">
            {t("dossier.legalTitle")}
          </h2>
          <p className="text-xs text-pretty">{t("app.legalDisclaimer")}</p>
        </aside>
      )
    case "conclusion":
      return (
        <div className="flex flex-col gap-2">
          {/* Вывод печатается дословно с бэка — ни сокращений, ни пересказа. */}
          <p className="text-pretty">{investigation.conclusion}</p>
          <CorridorLine corridor={model.corridor} t={t} />
        </div>
      )
    case "evidenceLevel":
      return (
        <div className="flex flex-col items-start gap-1.5">
          <EvidenceLevelBadge level={investigation.evidenceLevel} />
          <p className="text-xs text-pretty text-muted-foreground">
            {t(`evidence.${investigation.evidenceLevel}.description`)}
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
          emptyText={t("panel.noFacts")}
        />
      )
    case "contradictedHypotheses":
      return (
        <StatementList
          entries={model.contradictedHypotheses}
          emptyText={t("panel.noRejected")}
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
        <p className="text-muted-foreground">{t("panel.noUnknowns")}</p>
      )
    case "candidateObjects":
      return <CandidateObjectList entries={model.objects} />
    case "sources":
      return <DossierSources entries={model.sources} />
    case "provenance":
      return (
        <div className="flex flex-col gap-2">
          <dl className="flex flex-col gap-0.5 text-xs">
            <MetaRow label={t("dossier.rulesetLabel")}>
              {model.provenance.rulesetVersion ?? (
                <span className="text-muted-foreground">
                  {t("dossier.rulesetMissing")}
                </span>
              )}
            </MetaRow>
            <MetaRow label={t("dossier.inputHashLabel")}>
              {model.provenance.inputHash ? (
                <span className="font-mono break-all">
                  {model.provenance.inputHash}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  {t("dossier.inputHashMissing")}
                </span>
              )}
            </MetaRow>
          </dl>
          <p className="text-xs text-pretty text-muted-foreground">
            {t("dossier.provenanceNote")}
          </p>
        </div>
      )
  }
}

function CorridorLine({
  corridor,
  t,
}: {
  corridor: DossierCorridor
  t: TFunction
}) {
  if (corridor === null) {
    return (
      <p className="text-xs text-muted-foreground">
        {t("dossier.corridorNone")}
      </p>
    )
  }

  // Имена створов не берутся в кавычки: в них уже есть свои («Атырау су
  // арнасы»), и вложенные ёлочки в печати читаются как опечатка.
  const bounds =
    corridor.kind === "openUpstream"
      ? `${t("dossier.corridorOpenUpPrefix")} ${corridor.downstream.name}`
      : `${t("dossier.corridorBetweenPrefix")} ${corridor.upstream.name} и ${corridor.downstream.name}`

  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-pretty">
        <span className="font-medium">{t("dossier.corridorLabel")}:</span>{" "}
        {bounds}
      </p>
      <p className="text-xs text-muted-foreground">
        {t("dossier.noMapNote")}
      </p>
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
