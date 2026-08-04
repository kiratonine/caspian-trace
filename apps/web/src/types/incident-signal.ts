// ТЗ §8, таблица `incident_signals`.
export type Phenomenon =
  | 'oil_film'
  | 'color_change'
  | 'odor'
  | 'fish_kill'
  | 'wastewater'
  | 'other';

export type IncidentSignal = {
  id: string;
  title: string;
  observedAt: string | null;
  reportedAt: string;
  location: { lat: number; lon: number } | null;
  locationText: string;
  phenomenon: Phenomenon;
  excerpt: string;
  sourceDocumentId: string;
  extractionMode: 'llm' | 'rule' | 'verified_seed';
  verificationStatus: 'unverified' | 'corroborated' | 'official';
};
