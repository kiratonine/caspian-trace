export const INGESTION_CLOCK = Symbol('INGESTION_CLOCK')

export interface IngestionClock {
  now(): Date
}

export const systemIngestionClock: IngestionClock = { now: () => new Date() }
