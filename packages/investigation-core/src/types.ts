export type EvidenceLevel = 'L0' | 'L1' | 'L2' | 'L3'

export type Region = 'atyrau' | 'mangystau'

export type VerificationStatus =
  | 'unverified'
  | 'corroborated'
  | 'official'
  | 'conflicting'

export type SourceDocumentFact = {
  id: string
  title: string
  publisher: string
  url: string
  official: boolean
  verified: boolean
  publishedAt: string | null
  fetchedAt: string | null
  contentType: 'html' | 'pdf' | 'json'
  sha256: string | null
  cachePath: string | null
  status: 'verified' | 'unverified' | 'unavailable'
}

export type IncidentFact = {
  id: string
  title: string
  region: Region
  indicator: string
  unknowns?: InvestigationUnknown[]
}

export type IncidentSignalFact = {
  id: string
  title: string
  observedAt: string | null
  observedPeriod: string | null
  reportedAt: string
  locationText: string
  phenomenon: 'oil_film' | 'color_change' | 'odor' | 'fish_kill' | 'wastewater' | 'other'
  excerpt: string
  sourceDocumentId: string
  extractionMode: 'llm_verified' | 'rule' | 'verified_seed'
  verificationStatus: VerificationStatus
}

export type StationFact = {
  id: string
  name: string
  waterBody: string
}

export type StationRelationFact = {
  id: string
  upstreamStationId: string
  downstreamStationId: string
  sourceDocumentId: string
  basis: string
  verified: boolean
  comparisonPair: boolean
}

export type MeasurementFact = {
  id: string
  stationId: string
  indicator: string
  matrix: string
  value: string
  rawValueText: string
  unit: string
  sampledAt: string | null
  sampledPeriod: string | null
  sourceDocumentId: string
  sourcePage: number | null
  sourceExcerpt: string | null
  verified: boolean
}

export type CandidateObjectFact = {
  id: string
  name: string
  category: string
  stationId: string | null
  waterBody: string | null
  evidenceDocumentIds: string[]
  completeness: 'confirmed' | 'partial'
}

export type InvestigationInput = {
  incident: IncidentFact
  signals: IncidentSignalFact[]
  stations: StationFact[]
  stationRelations: StationRelationFact[]
  measurements: MeasurementFact[]
  candidateObjects: CandidateObjectFact[]
  sourceDocuments: SourceDocumentFact[]
}

export type ComparisonReason =
  | 'INDICATOR_MISMATCH'
  | 'MATRIX_MISMATCH'
  | 'UNIT_MISMATCH'
  | 'TIME_MISMATCH'
  | 'RELATION_UNVERIFIED'
  | 'SOURCE_NOT_OFFICIAL'

export type ComparisonResult =
  | { comparable: true }
  | { comparable: false; reasons: ComparisonReason[] }

export type IntervalEvaluation = {
  relationId: string
  upstreamMeasurementId: string
  downstreamMeasurementId: string
  upstreamStationId: string
  downstreamStationId: string
  delta: string
  direction: 'increase' | 'no_increase'
  sourceDocumentIds: string[]
}

export type EvidenceStatement = {
  id: string
  code: 'MAXIMUM_UPSTREAM_OF_OBJECT' | 'NO_LOCAL_INCREASE_IN_PAIR' | 'LOCAL_INCREASE_IN_PAIR'
  kind: 'supports' | 'contradicts'
  text: string
  measurementIds: string[]
  sourceDocumentIds: string[]
  generatedBy: 'rule_engine'
  sortOrder: number
}

export type InvestigationUnknown = {
  code:
    | 'STATION_ORDER_UNVERIFIED'
    | 'STATION_GRAPH_CYCLE'
    | 'UPSTREAM_BOUNDARY_UNMEASURED'
    | 'SYNCHRONOUS_MEASUREMENTS_UNAVAILABLE'
    | 'CURRENT_FIELD_UNAVAILABLE'
  text: string
}

export type CorridorBounds = {
  upstreamStationId: string | null
  downstreamStationId: string
}

export type ObjectDisposition = {
  objectId: string
  disposition: 'in_corridor' | 'does_not_explain_event' | 'unknown'
  evidenceStatementIds: string[]
}

export type InvestigationResult = {
  evidenceLevel: EvidenceLevel
  corridorBounds: CorridorBounds | null
  supportedFacts: EvidenceStatement[]
  contradictedHypotheses: EvidenceStatement[]
  objectDispositions: ObjectDisposition[]
  unknowns: InvestigationUnknown[]
  conclusion: string
  inputHash: string
  rulesetVersion: string
}

export type StationGraph = {
  nodes: ReadonlySet<string>
  outgoing: ReadonlyMap<string, ReadonlySet<string>>
  incoming: ReadonlyMap<string, ReadonlySet<string>>
}
