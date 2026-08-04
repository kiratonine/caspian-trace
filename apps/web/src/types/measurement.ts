// ТЗ §8, таблица `measurements`.
export type Measurement = {
  id: string;
  stationId: string;
  sampledAt: string;
  indicator: string;
  value: number;
  unit: 'mg/dm3' | 'mg/kg' | 'percent';
  matrix: 'water' | 'sediment';
  qualityClass: number | null;
  sourceDocumentId: string;
  sourcePage: number;
  sourceExcerpt: string;
  verified: boolean;
};
