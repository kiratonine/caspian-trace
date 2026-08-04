import type { ReactNode } from 'react';

import { incidentDetails } from '@/api/seed-data';
import {
  EvidenceLevelBadge,
  InsufficientData,
  MeasurementValue,
  SourceLink,
} from '@/components/common';
import { EVIDENCE_LEVEL_META } from '@/constants/evidence';
import type { EvidenceLevel } from '@/types';

// Дев-галерея common-примитивов: смотровая площадка для ручной проверки
// светлой/тёмной темы. Доступна только в dev-сборке (см. router.tsx),
// данные — те же заглушки ТЗ §5, ничего выдуманного.

const LEVELS = Object.keys(EVIDENCE_LEVEL_META) as EvidenceLevel[];

const september = incidentDetails['inv-atyrau-2025-09'];
const may = incidentDetails['inv-atyrau-2025-05'];
const aktau = incidentDetails['inv-aktau-insufficient'];

function documentById(detail: typeof september, id: string) {
  const doc = detail.sourceDocuments.find((d) => d.id === id);
  if (!doc) throw new Error(`Галерея: нет документа ${id} в заглушке`);
  return doc;
}

function stationName(detail: typeof september, stationId: string) {
  return detail.stations.find((s) => s.id === stationId)?.name ?? stationId;
}

function GallerySection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border-t pt-4">
      <h2 className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function PrimitivesGallery() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <header>
        <h1 className="text-sm font-semibold tracking-[0.14em] uppercase">
          Дев-галерея примитивов
        </h1>
        <p className="text-xs text-muted-foreground">
          Только dev-сборка. Клавиша D переключает тему.
        </p>
      </header>

      <GallerySection title="EvidenceLevelBadge">
        <div className="flex flex-wrap items-center gap-2">
          {LEVELS.map((level) => (
            <EvidenceLevelBadge key={level} level={level} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {LEVELS.map((level) => (
            <EvidenceLevelBadge key={level} level={level} compact />
          ))}
        </div>
      </GallerySection>

      <GallerySection title="MeasurementValue — сентябрь 2025 (стр. 22 PDF)">
        <ul className="flex flex-col gap-1.5 text-sm">
          {september.measurements.map((m) => (
            <li key={m.id} className="flex items-baseline justify-between gap-4">
              <span className="truncate text-muted-foreground">
                {stationName(september, m.stationId)}
              </span>
              <MeasurementValue
                measurement={m}
                sourceDocument={documentById(september, m.sourceDocumentId)}
              />
            </li>
          ))}
        </ul>
      </GallerySection>

      <GallerySection title="MeasurementValue — май 2025 (страница не подтверждена)">
        <ul className="flex flex-col gap-1.5 text-sm">
          {may.measurements.map((m) => (
            <li key={m.id} className="flex items-baseline justify-between gap-4">
              <span className="truncate text-muted-foreground">
                {stationName(may, m.stationId)}
              </span>
              <MeasurementValue
                measurement={m}
                sourceDocument={documentById(may, m.sourceDocumentId)}
              />
            </li>
          ))}
        </ul>
      </GallerySection>

      <GallerySection title="SourceLink">
        <ul className="flex flex-col gap-3">
          {september.sourceDocuments.map((doc) => {
            // Страница берётся из измерения, ссылающегося на документ, — не зашивается.
            const fromMeasurement = september.measurements.find(
              (m) => m.sourceDocumentId === doc.id,
            );
            return (
              <li key={doc.id}>
                <SourceLink
                  sourceDocument={doc}
                  page={fromMeasurement?.sourcePage}
                />
              </li>
            );
          })}
        </ul>
      </GallerySection>

      <GallerySection title="InsufficientData — кейс Актау">
        <InsufficientData reasons={aktau.investigation.unknowns} />
      </GallerySection>
    </main>
  );
}
