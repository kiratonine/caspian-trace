// ТЗ §8, таблица `stations`.
export type Station = {
  id: string;
  name: string;
  waterBody: string;
  location: { lat: number; lon: number } | null;
  riverOrder: number | null; // меньше = выше по течению; null = порядок не подтверждён вручную
  relationType: 'upstream' | 'downstream' | 'neutral';
  relatedObjectId: string | null;
  locationSourceDocumentId: string;
};
