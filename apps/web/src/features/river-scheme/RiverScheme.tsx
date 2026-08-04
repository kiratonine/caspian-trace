import { useMemo } from 'react';

import type { IncidentDetail } from '@/api/contracts';
import { InsufficientData } from '@/components/common';
import { Skeleton } from '@/components/ui/skeleton';
import {
  SCHEME_UNCONFIRMED_ORDER_HINT,
  SCHEME_UPSTREAM_HINT,
} from '@/constants/scheme';
import { DATA_LOAD_ERROR } from '@/constants/strings';
import { useSelectedIncidentDetail } from '@/hooks/use-selected-incident-detail';
import { formatSampledAt } from '@/lib/format';
import { OrderedStations } from './OrderedStations';
import { UnorderedStations } from './UnorderedStations';
import { buildSchemeModel } from './scheme-model';

/** Колонка схемы: рисует выбранное событие (общий хук выбора). */
export function RiverScheme() {
  const { detail, isError } = useSelectedIncidentDetail();

  return (
    <section aria-label="Линейная схема реки" className="flex min-h-0 flex-col">
      {detail ? (
        <RiverSchemeContent detail={detail} />
      ) : (
        <>
          <SchemeHeader subtitle={null} />
          <div className="flex min-h-0 flex-1 items-center justify-center p-8">
            {isError ? (
              <p className="text-sm text-muted-foreground">{DATA_LOAD_ERROR}</p>
            ) : (
              <SchemeSkeleton />
            )}
          </div>
        </>
      )}
    </section>
  );
}

type RiverSchemeContentProps = {
  detail: IncidentDetail;
};

/** Презентационная часть схемы — контейнер и дев-превью отдают ей готовые данные. */
export function RiverSchemeContent({ detail }: RiverSchemeContentProps) {
  const model = useMemo(() => buildSchemeModel(detail), [detail]);
  const hasStations = detail.stations.length > 0;
  const hasUnordered = model.unordered.length > 0;
  const waterBody = detail.stations[0]?.waterBody ?? null;
  // Пока хоть одна станция без подтверждённого порядка — «вверху — выше по
  // течению» обещать нельзя.
  const orderHint = hasStations
    ? hasUnordered
      ? SCHEME_UNCONFIRMED_ORDER_HINT
      : SCHEME_UPSTREAM_HINT
    : null;
  const subtitle = [waterBody, orderHint].filter(Boolean).join(' · ') || null;
  const firstMeasurement = detail.measurements[0] ?? null;

  return (
    <>
      <SchemeHeader subtitle={subtitle} />
      {hasStations ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
            <p className="text-xs text-muted-foreground">
              {detail.investigation.indicator}
              {firstMeasurement &&
                ` · ${formatSampledAt(firstMeasurement.sampledAt)}`}
            </p>
            {model.ordered.length > 0 && (
              <OrderedStations
                entries={model.ordered}
                corridor={model.corridor}
              />
            )}
            {hasUnordered && (
              <UnorderedStations
                entries={model.unordered}
                corridor={model.corridor}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-6">
          <InsufficientData
            reasons={detail.investigation.unknowns}
            className="max-w-md"
          />
        </div>
      )}
    </>
  );
}

function SchemeHeader({ subtitle }: { subtitle: string | null }) {
  return (
    <header className="flex items-baseline justify-between gap-3 border-b px-4 py-3">
      <h2 className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
        Линейная схема реки
      </h2>
      {subtitle && (
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      )}
    </header>
  );
}

const SKELETON_NODES = 4;

function SchemeSkeleton() {
  return (
    <div aria-hidden className="relative flex flex-col gap-10">
      <div className="absolute inset-y-1 left-1.25 w-px border-l border-dashed" />
      {Array.from({ length: SKELETON_NODES }, (_, index) => (
        <div key={index} className="relative flex items-center gap-4">
          <Skeleton className="size-2.5 shrink-0 rounded-full" />
          <Skeleton className="h-3 w-44" />
          <Skeleton className="h-3 w-14" />
        </div>
      ))}
    </div>
  );
}
