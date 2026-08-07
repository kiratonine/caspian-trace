import type {
  IncidentDetail,
  SourceHealthItem,
} from "@/api/contracts"
import type { SourceDocument } from "@/types"

export type AgentWorkflowModel = {
  sourceGap: boolean
  sourceStateKnown: boolean
  documentsTotal: number
  documentsWithSha: number
  documentsWithSnapshot: number
  verifiedMeasurements: number
  officialDocuments: number
  knownSourcePages: number
}

export type SelectedTraceModel = {
  signal: IncidentDetail["signals"][number] | null
  signalDocument: SourceDocument | null
  officialDocument: SourceDocument | null
  officialPage: number | null
  measurementCount: number
  verifiedMeasurementCount: number
  sampledPeriods: string[]
  sourcePagesKnown: number
  sourcePagesUnknown: number
  units: string[]
  corridorState: "none" | "open_upstream" | "between"
}

export function buildAgentWorkflowModel(
  detail: IncidentDetail | null,
  sources: readonly SourceHealthItem[] | undefined
): AgentWorkflowModel {
  const verifiedMeasurements =
    detail?.measurements.filter(({ verified }) => verified) ?? []
  const officialDocumentIds = new Set(
    verifiedMeasurements.map(({ sourceDocumentId }) => sourceDocumentId)
  )

  return {
    sourceGap:
      sources?.some(
        ({ status }) => status === "failed" || status === "rate_limited"
      ) ?? false,
    sourceStateKnown: sources !== undefined && sources.length > 0,
    documentsTotal: detail?.sourceDocuments.length ?? 0,
    documentsWithSha:
      detail?.sourceDocuments.filter(({ sha256 }) => sha256 !== null).length ??
      0,
    documentsWithSnapshot:
      detail?.sourceDocuments.filter(({ cachePath }) => cachePath !== null)
        .length ?? 0,
    verifiedMeasurements: verifiedMeasurements.length,
    officialDocuments: officialDocumentIds.size,
    knownSourcePages: verifiedMeasurements.filter(
      ({ sourcePage }) => sourcePage !== null
    ).length,
  }
}

export function buildSelectedTraceModel(
  detail: IncidentDetail
): SelectedTraceModel {
  const signal = detail.signals[0] ?? null
  const signalDocument = signal
    ? (detail.sourceDocuments.find(
        ({ id }) => id === signal.sourceDocumentId
      ) ?? null)
    : null
  const verifiedMeasurements = detail.measurements.filter(
    ({ verified }) => verified
  )
  const officialMeasurement = verifiedMeasurements[0] ?? null
  const officialDocument = officialMeasurement
    ? (detail.sourceDocuments.find(
        ({ id }) => id === officialMeasurement.sourceDocumentId
      ) ?? null)
    : null

  return {
    signal,
    signalDocument,
    officialDocument,
    officialPage: officialMeasurement?.sourcePage ?? null,
    measurementCount: detail.measurements.length,
    verifiedMeasurementCount: verifiedMeasurements.length,
    sampledPeriods: [
      ...new Set(
        detail.measurements.flatMap(({ sampledAt, sampledPeriod }) =>
          sampledAt ? [sampledAt] : sampledPeriod ? [sampledPeriod] : []
        )
      ),
    ].sort(),
    sourcePagesKnown: detail.measurements.filter(
      ({ sourcePage }) => sourcePage !== null
    ).length,
    sourcePagesUnknown: detail.measurements.filter(
      ({ sourcePage }) => sourcePage === null
    ).length,
    units: [...new Set(detail.measurements.map(({ unit }) => unit))].sort(),
    corridorState: !detail.corridorBounds
      ? "none"
      : detail.corridorBounds.upstreamStationId === null
        ? "open_upstream"
        : "between",
  }
}
