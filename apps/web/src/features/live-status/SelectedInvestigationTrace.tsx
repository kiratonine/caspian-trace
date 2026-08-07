import { useMemo, useState, type ReactNode } from "react"
import { ChevronRight } from "lucide-react"
import { useTranslation } from "react-i18next"

import { EvidenceLevelBadge, SourceLink } from "@/components/common"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useSelectedIncidentDetail } from "@/hooks/use-selected-incident-detail"
import { useFormat } from "@/i18n/use-format"
import { usePhenomenonLabel, useUnitLabel } from "@/i18n/use-labels"
import { cn } from "@/lib/utils"
import { buildSelectedTraceModel } from "./agent-workflow-model"

export function SelectedInvestigationTrace() {
  const { t } = useTranslation()
  const { formatDateTime } = useFormat()
  const phenomenonLabel = usePhenomenonLabel()
  const unitLabel = useUnitLabel()
  const { detail, isError } = useSelectedIncidentDetail()
  const [open, setOpen] = useState(false)
  const model = useMemo(
    () => (detail ? buildSelectedTraceModel(detail) : null),
    [detail]
  )

  return (
    <section className="border-t pt-2.5">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex w-full items-center gap-2 text-left font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/60">
          <span className="flex-1">{t("investigationTrace.title")}</span>
          <ChevronRight
            aria-hidden
            className={cn(
              "size-3.5 text-muted-foreground transition-transform",
              open && "rotate-90"
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          {!model || !detail ? (
            <p className="text-muted-foreground">
              {isError
                ? t("investigationTrace.error")
                : t("investigationTrace.loading")}
            </p>
          ) : (
            <ol className="flex flex-col gap-3">
              <TraceStage title={t("investigationTrace.stage.signal")}>
                {model.signal ? (
                  <div className="flex flex-col gap-1">
                    <p className="font-medium">{model.signal.title}</p>
                    <p className="text-muted-foreground">
                      {t("investigationTrace.reportedAt", {
                        value: formatDateTime(model.signal.reportedAt),
                      })}
                    </p>
                    <p className="text-muted-foreground">
                      {t("investigationTrace.location", {
                        value: model.signal.locationText,
                      })}
                    </p>
                    <p className="text-muted-foreground">
                      {t("investigationTrace.phenomenon", {
                        value: phenomenonLabel(model.signal.phenomenon),
                      })}
                    </p>
                    <p className="text-muted-foreground">
                      {t("investigationTrace.extractionModeLabel")}: {" "}
                      {t(
                        `investigationTrace.extractionMode.${model.signal.extractionMode}`
                      )}
                    </p>
                    <p className="text-muted-foreground">
                      {t("investigationTrace.verificationLabel")}: {" "}
                      {t(
                        `phenomena.verificationStatus.${model.signal.verificationStatus}`
                      )}
                    </p>
                    {model.signalDocument && (
                      <SourceLink sourceDocument={model.signalDocument} />
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    {t("investigationTrace.noSignal")}
                  </p>
                )}
              </TraceStage>
              <TraceStage title={t("investigationTrace.stage.official")}>
                {model.officialDocument ? (
                  <div className="flex flex-col gap-1">
                    <SourceLink
                      sourceDocument={model.officialDocument}
                      page={model.officialPage}
                    />
                    <p className="text-muted-foreground">
                      {model.officialPage === null
                        ? t("investigationTrace.pageUnknown")
                        : t("investigationTrace.pageKnown", {
                            page: model.officialPage,
                          })}
                    </p>
                    <p className="text-muted-foreground">
                      {t("investigationTrace.sourceStatusLabel")}: {" "}
                      {t(
                        `investigationTrace.sourceStatus.${model.officialDocument.status}`
                      )}
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    {t("investigationTrace.noOfficialDocument")}
                  </p>
                )}
              </TraceStage>
              <TraceStage title={t("investigationTrace.stage.measurements")}>
                <p>
                  {t("investigationTrace.measurementSummary", {
                    total: model.measurementCount,
                    verified: model.verifiedMeasurementCount,
                  })}
                </p>
                <p className="text-muted-foreground">
                  {t("investigationTrace.sampledPeriods", {
                    value:
                      model.sampledPeriods.join(", ") ||
                      t("investigationTrace.unknownValue"),
                  })}
                </p>
                <p className="text-muted-foreground">
                  {t("investigationTrace.sourcePages", {
                    known: model.sourcePagesKnown,
                    unknown: model.sourcePagesUnknown,
                  })}
                </p>
                <p className="text-muted-foreground">
                  {t("investigationTrace.units", {
                    value:
                      model.units.map(unitLabel).join(", ") ||
                      t("investigationTrace.unknownValue"),
                  })}
                </p>
              </TraceStage>
              <TraceStage title={t("investigationTrace.stage.conclusion")}>
                <EvidenceLevelBadge
                  level={detail.investigation.evidenceLevel}
                  compact
                />
                <p className="text-pretty">{detail.investigation.conclusion}</p>
                <p className="text-muted-foreground">
                  {t(
                    `investigationTrace.corridor.${model.corridorState}`
                  )}
                </p>
                <p className="text-muted-foreground">
                  {t("investigationTrace.unknowns", {
                    count: detail.investigation.unknowns.length,
                  })}
                </p>
                <p className="text-pretty text-muted-foreground">
                  {t("investigationTrace.conclusionDisclaimer")}
                </p>
              </TraceStage>
            </ol>
          )}
        </CollapsibleContent>
      </Collapsible>
    </section>
  )
}

function TraceStage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="border-l pl-2.5">
      <h4 className="mb-1 font-medium">{title}</h4>
      {children}
    </li>
  )
}
