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
import { REPLAY_PENDING } from '@/constants/replay';
import { DATA_LOAD_ERROR } from '@/constants/strings';
import {
  projectDetailForReplay,
  useReplayFrame,
  type ReplayFrame,
} from '@/features/replay/replay-frame';
import { useSelectedIncidentDetail } from '@/hooks/use-selected-incident-detail';
import type { Investigation } from '@/types';
import { SourcesList } from './SourcesList';
import { StatementList } from './StatementList';
import { buildPanelModel, type PanelModel } from './panel-model';

// Порядок и нумерация секций приходят из CONCLUSION_SECTIONS (ТЗ §13, 1–6).
export function ConclusionPanel() {
  const { selectedIncidentId, detail, isError } = useSelectedIncidentDetail();
  // Во время реплея панель показывает состояние текущего шага — селектор
  // поверх загруженных данных, без рефетча (план сессии 9).
  const frame = useReplayFrame(selectedIncidentId);
  const shownDetail = useMemo(
    () => (detail && frame ? projectDetailForReplay(detail, frame) : detail),
    [detail, frame],
  );

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
        {shownDetail ? (
          <ConclusionPanelContent detail={shownDetail} replayFrame={frame} />
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
  /** Кадр активного реплея: блоки, до которых хронология не дошла, ждут шага. */
  replayFrame?: ReplayFrame | null;
};

/** Презентационная часть панели — контейнер и дев-превью отдают ей готовые данные. */
export function ConclusionPanelContent({
  detail,
  replayFrame = null,
}: ConclusionPanelContentProps) {
  const model = useMemo(() => buildPanelModel(detail), [detail]);

  return (
    <ol className="flex flex-col p-4">
      {CONCLUSION_SECTIONS.map((section, index) => (
        <SectionItem key={section.id} index={index} title={section.title}>
          <SectionBody
            sectionId={section.id}
            investigation={detail.investigation}
            model={model}
            replayFrame={replayFrame}
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
  replayFrame: ReplayFrame | null;
};

function SectionBody({
  sectionId,
  investigation,
  model,
  replayFrame,
}: SectionBodyProps) {
  switch (sectionId) {
    case 'conclusion': {
      if (replayFrame && !replayFrame.conclusionReached) {
        return <ReplayPendingNote />;
      }
      // Во время реплея вывод — дословный текст payload шага conclusion.
      return (
        <p className="text-sm leading-relaxed text-pretty">
          {replayFrame?.conclusionText ?? investigation.conclusion}
        </p>
      );
    }
    case 'evidenceLevel': {
      // Уровень на текущем шаге реплея приходит в payload шага (запрет 6:
      // фронт уровни не вычисляет — ни финальные, ни промежуточные).
      const level = replayFrame?.evidenceLevel ?? investigation.evidenceLevel;
      return (
        <div className="flex flex-col items-start gap-1.5">
          <EvidenceLevelBadge level={level} />
          <p className="text-xs text-pretty text-muted-foreground">
            {EVIDENCE_LEVEL_META[level].description}
          </p>
        </div>
      );
    }
    case 'supportedFacts':
      if (replayFrame && !replayFrame.inferenceReached) {
        return <ReplayPendingNote />;
      }
      return (
        <StatementList
          entries={model.supportedFacts}
          emptyText={PANEL_NO_FACTS}
        />
      );
    case 'contradictedHypotheses':
      if (replayFrame && !replayFrame.inferenceReached) {
        return <ReplayPendingNote />;
      }
      return (
        <StatementList
          entries={model.contradictedHypotheses}
          emptyText={PANEL_NO_REJECTED}
        />
      );
    case 'unknowns':
      // Пробелы — часть применённого правила (§14: «L2, но не L3» объясняется
      // именно пробелом), до шага inference их показывать рано.
      if (replayFrame && !replayFrame.inferenceReached) {
        return <ReplayPendingNote />;
      }
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

function ReplayPendingNote() {
  return <p className="text-sm text-muted-foreground">{REPLAY_PENDING}</p>;
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
