import { Play } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  REPLAY_STEP_OFFSETS_MS,
  REPLAY_STEP_TYPE_LABELS,
  REPLAY_STEP_TYPE_ORDER,
} from '@/constants/replay';

// Каркас (сессия 3): плеер (replayStore + таймеры от performance.now())
// подключается в сессии реплея, до неё управление отключено.
// Маркеры стоят на реальных offsetMs демо-сценария (ТЗ §12), а не равномерно:
// шкала — хронология доказательств, а не прогресс-бар.
const TIMELINE_TOTAL_MS =
  REPLAY_STEP_OFFSETS_MS[REPLAY_STEP_OFFSETS_MS.length - 1];

// Крайние подписи прижаты к краям шкалы, промежуточные центрированы над маркером.
function labelAlignment(index: number) {
  if (index === 0) {
    return '';
  }
  if (index === REPLAY_STEP_TYPE_ORDER.length - 1) {
    return '-translate-x-full text-right';
  }
  return '-translate-x-1/2 text-center';
}

export function ReplayTimeline() {
  return (
    <footer
      aria-label="Шкала реплея"
      className="flex items-center gap-4 border-t px-4 py-3"
    >
      <Button variant="outline" size="icon" disabled aria-label="Запустить реплей">
        <Play />
      </Button>
      <div className="relative h-9 min-w-0 flex-1">
        <div className="absolute inset-x-0 top-[9px] h-px bg-border" />
        {REPLAY_STEP_TYPE_ORDER.map((type, index) => (
          <div
            key={type}
            className="absolute top-0 h-full"
            style={{ left: `${(REPLAY_STEP_OFFSETS_MS[index] / TIMELINE_TOTAL_MS) * 100}%` }}
          >
            <span className="absolute top-[5px] size-2 -translate-x-1/2 rounded-full bg-muted-foreground/50" />
            <span
              className={`absolute top-5 block w-max text-[10px] leading-tight text-muted-foreground ${labelAlignment(index)}`}
            >
              {REPLAY_STEP_TYPE_LABELS[type]}
            </span>
          </div>
        ))}
      </div>
    </footer>
  );
}
