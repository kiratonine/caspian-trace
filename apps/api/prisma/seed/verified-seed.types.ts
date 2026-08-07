import type {
  MeasurementFixture,
  StationRelationFixture,
  VerifiedManifest,
  VerifiedMeasurement,
  VerifiedStationRelation,
} from './verified-data.schemas'

export interface LoadedDocument {
  id: string
  url: string
  sha256: string
  sourcePage: number | null
  period: string
}

export interface LoadedStation {
  id: string
  label: string
}

export interface HumanReviewSummary {
  required: number
  completed: number
  complete: boolean
}

export interface LoadedVerifiedData {
  manifest: VerifiedManifest
  measurementFixtures: MeasurementFixture[]
  relationFixtures: StationRelationFixture[]
  documents: LoadedDocument[]
  stations: LoadedStation[]
  measurements: Array<VerifiedMeasurement & { documentId: string }>
  relations: Array<VerifiedStationRelation & { documentId: string }>
  humanReview: HumanReviewSummary
}

export interface SeedEntitySummary {
  created: number
  unchanged: number
  promoted: number
}

export interface VerifiedSeedSummary {
  documents: SeedEntitySummary
  stations: Omit<SeedEntitySummary, 'promoted'> & { updated: number }
  relations: SeedEntitySummary & {
    evidenceCreated: number
    evidenceUnchanged: number
    evidencePromoted: number
    evidenceReviewUpdated: number
    verifiedEvidence: number
    pendingEvidence: number
    omitted: 0
  }
  measurements: SeedEntitySummary & { reviewUpdated: number }
  humanReviewers: number
}
