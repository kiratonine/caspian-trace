import { useMemo, type ReactNode } from 'react';

import type { IncidentDetail } from '@/api/contracts';
import { EvidenceLevelBadge } from '@/components/common';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { EVIDENCE_LEVEL_META } from '@/constants/evidence';
import {
  CONCLUSION_SECTIONS,
  PANEL_NO_FACTS,
  PANEL_NO_REJECTED,
  PANEL_NO_UNKNOWNS,
  type ConclusionSectionId,
} from '@/constants/panel';
import { DATA_LOAD_ERROR } from '@/constants/strings';
import { useSelectedIncidentDetail } from '@/hooks/use-selected-incident-detail';
import type { Investigation } from '@/types';
import { SourcesList } from './SourcesList';
import { StatementList } from './StatementList';
import { buildPanelModel, type PanelModel } from './panel-model';

// Порядок и нумерация секций приходят из CONCLUSION_SECTIONS (ТЗ §13, 1–6).
export function ConclusionPanel() {
  const { detail, isError } = useSelectedIncidentDetail();

  return (
    <section
      aria-label="Вывод и доказательства"
      className="flex min-h-0 flex-col"
    >
      <header className="border-b px-4 py-3">
        <h2 className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          Вывод и доказательства
        </h2>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        {detail ? (
          <ConclusionPanelContent detail={detail} />
        ) : isError ? (
          <p className="p-4 text-sm text-muted-foreground">{DATA_LOAD_ERROR}</p>
        ) : (
          <PanelSkeleton />
        )}
      </ScrollArea>
    </section>
  );
}

type ConclusionPanelContentProps = {
  detail: IncidentDetail;
};

/** Презентационная часть панели — контейнер и дев-превью отдают ей готовые данные. */
export function ConclusionPanelContent({ detail }: ConclusionPanelContentProps) {
  const model = useMemo(() => buildPanelModel(detail), [detail]);

  return (
    <ol className="flex flex-col p-4">
      {CONCLUSION_SECTIONS.map((section, index) => (
        <SectionItem key={section.id} index={index} title={section.title}>
          <SectionBody
            sectionId={section.id}
            investigation={detail.investigation}
            model={model}
          />
        </SectionItem>
      ))}
    </ol>
  );
}

type SectionBodyProps = {
  sectionId: ConclusionSectionId;
  investigation: Investigation;
  model: PanelModel;
};

function SectionBody({ sectionId, investigation, model }: SectionBodyProps) {
  switch (sectionId) {
    case 'conclusion':
      return (
        <p className="text-sm leading-relaxed text-pretty">
          {investigation.conclusion}
        </p>
      );
    case 'evidenceLevel':
      return (
        <div className="flex flex-col items-start gap-1.5">
          <EvidenceLevelBadge level={investigation.evidenceLevel} />
          <p className="text-xs text-pretty text-muted-foreground">
            {EVIDENCE_LEVEL_META[investigation.evidenceLevel].description}
          </p>
        </div>
      );
    case 'supportedFacts':
      return (
        <StatementList
          entries={model.supportedFacts}
          emptyText={PANEL_NO_FACTS}
        />
      );
    case 'contradictedHypotheses':
      return (
        <StatementList
          entries={model.contradictedHypotheses}
          emptyText={PANEL_NO_REJECTED}
        />
      );
    case 'unknowns':
      return investigation.unknowns.length > 0 ? (
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
          {investigation.unknowns.map((unknown) => (
            <li key={unknown} className="text-pretty">
              {unknown}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{PANEL_NO_UNKNOWNS}</p>
      );
    case 'sources':
      return <SourcesList entries={model.sources} />;
  }
}

type SectionItemProps = {
  index: number;
  title: string;
  children: ReactNode;
};

function SectionItem({ index, title, children }: SectionItemProps) {
  return (
    <li className="mt-4 flex flex-col gap-2 border-t pt-4 first:mt-0 first:border-t-0 first:pt-0">
      <h3 className="flex items-baseline gap-2 text-sm font-medium">
        <span className="text-xs text-muted-foreground tabular-nums">
          {index + 1}
        </span>
        {title}
      </h3>
      {children}
    </li>
  );
}

function PanelSkeleton() {
  return (
    <ol className="flex flex-col p-4">
      {CONCLUSION_SECTIONS.map((section, index) => (
        <SectionItem key={section.id} index={index} title={section.title}>
          <div aria-hidden className="flex flex-col gap-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </SectionItem>
      ))}
    </ol>
  );
}
