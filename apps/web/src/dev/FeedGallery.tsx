import { useState } from 'react';

import { incidentDetails, incidentSummaries } from '@/api/seed-data';
import { SignalFeedContent } from '@/features/feed/SignalFeed';

// Дев-превью ленты (только dev-сборка, см. router.tsx) в ширине реальной
// колонки (260–320px). Клики по карточкам работают, но пишут локальный
// useState, а не ?incident= — превью не трогает URL. Данные — seed ТЗ §5/§10.

type FeedFrameProps = {
  title: string;
  initialSelectedId: string;
};

function FeedFrame({ title, initialSelectedId }: FeedFrameProps) {
  const [selectedId, setSelectedId] = useState(initialSelectedId);

  return (
    <section className="flex shrink-0 flex-col gap-2">
      <h2 className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
        {title}
      </h2>
      <div className="w-80 overflow-hidden border">
        <SignalFeedContent
          incidents={incidentSummaries}
          selectedIncidentId={selectedId}
          selectedDetail={incidentDetails[selectedId] ?? null}
          onSelect={setSelectedId}
        />
      </div>
    </section>
  );
}

export default function FeedGallery() {
  return (
    <main className="flex flex-col gap-6 p-8">
      <header>
        <h1 className="text-sm font-semibold tracking-[0.14em] uppercase">
          Дев-превью: лента сигналов и расследований
        </h1>
        <p className="text-xs text-muted-foreground">
          Только dev-сборка. Клавиша D переключает тему.
        </p>
      </header>
      <div className="flex flex-wrap items-start gap-6">
        <FeedFrame
          title="Сентябрь выбран — сигнал с источником"
          initialSelectedId="inv-atyrau-2025-09"
        />
        <FeedFrame
          title="Май выбран — сигналов нет"
          initialSelectedId="inv-atyrau-2025-05"
        />
        <FeedFrame
          title="Актау выбран — L0"
          initialSelectedId="inv-aktau-insufficient"
        />
      </div>
    </main>
  );
}
