import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import type { SourceHealthItem } from "@/api/contracts"
import { IS_SEED_MODE } from "@/api/client"
import { Badge } from "@/components/ui/badge"
import { useSelectedIncidentDetail } from "@/hooks/use-selected-incident-detail"
import { buildAgentWorkflowModel } from "./agent-workflow-model"

type AgentWorkflowSectionProps = {
  sources: readonly SourceHealthItem[] | undefined
}

export function AgentWorkflowSection({
  sources,
}: AgentWorkflowSectionProps) {
  const { t } = useTranslation()
  const { detail } = useSelectedIncidentDetail()
  const model = useMemo(
    () => buildAgentWorkflowModel(detail, sources),
    [detail, sources]
  )
  const searchStatus = model.sourceGap
    ? t("agentFlow.step.search.statusGap")
    : model.sourceStateKnown
      ? t("agentFlow.step.search.statusAvailable")
      : t("agentFlow.step.search.statusUnknown")

  const steps = [
    {
      id: "search",
      description: t("agentFlow.step.search.description"),
      detail: searchStatus,
    },
    {
      id: "provenance",
      description: t("agentFlow.step.provenance.description"),
      detail: t("agentFlow.step.provenance.summary", {
        total: model.documentsTotal,
        sha: model.documentsWithSha,
        snapshots: model.documentsWithSnapshot,
      }),
    },
    {
      id: "candidate",
      description: t("agentFlow.step.candidate.description"),
      detail: null,
    },
    {
      id: "official",
      description: t("agentFlow.step.official.description"),
      detail: t("agentFlow.step.official.summary", {
        measurements: model.verifiedMeasurements,
        documents: model.officialDocuments,
        pages: model.knownSourcePages,
      }),
    },
    {
      id: "analysis",
      description: t("agentFlow.step.analysis.description"),
      detail: null,
    },
  ] as const

  return (
    <section className="flex flex-col gap-2 border-t pt-2.5">
      <h3 className="font-medium">{t("agentFlow.title")}</h3>
      {IS_SEED_MODE && (
        <p className="text-pretty text-muted-foreground">
          {t("agentFlow.seedNotice")}
        </p>
      )}
      <ol className="flex flex-col gap-2">
        {steps.map((step, index) => (
          <li key={step.id} className="flex gap-2">
            <span className="mt-0.5 text-xs text-muted-foreground tabular-nums">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {t(`agentFlow.step.${step.id}.title`)}
              </p>
              <p className="text-pretty text-muted-foreground">
                {step.description}
              </p>
              {step.detail && (
                <p className="text-pretty text-muted-foreground">
                  {step.detail}
                </p>
              )}
              {step.id === "candidate" && (
                <Badge variant="outline" className="mt-1 font-normal">
                  {t("agentFlow.step.candidate.badge")}
                </Badge>
              )}
            </div>
          </li>
        ))}
      </ol>
      <p className="border-t pt-2 text-pretty text-muted-foreground">
        {t("agentFlow.footer")}
      </p>
    </section>
  )
}
