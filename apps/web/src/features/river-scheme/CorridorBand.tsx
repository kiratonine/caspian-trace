import { ArrowUp } from 'lucide-react';
import type { ReactNode } from 'react';

import {
  SCHEME_CORRIDOR_LABEL,
  SCHEME_CORRIDOR_OPEN_UP_NOTE,
} from '@/constants/scheme';
import { cn } from '@/lib/utils';

type CorridorBandProps = {
  /** Верхней границы нет (upstreamStationId = null): срезаем верхний край ленты. */
  openUp: boolean;
  children: ReactNode;
};

/**
 * Лента вероятного коридора вокруг участка линии между створами-границами.
 * Коридор — данные бэка (corridorBounds), фронт его не вычисляет (запрет 6);
 * монохромная заливка — это не «зона опасности» (запрет 4).
 */
export function CorridorBand({ openUp, children }: CorridorBandProps) {
  return (
    <div
      className={cn(
        '-mx-3 border border-dashed border-foreground/25 bg-foreground/[0.04] px-3 pb-1',
        openUp && 'border-t-0',
      )}
    >
      <p className="flex items-center justify-end gap-1 pt-1.5 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
        {openUp && <ArrowUp aria-hidden className="size-3 shrink-0" />}
        {SCHEME_CORRIDOR_LABEL}
        {openUp && (
          <span className="normal-case">· {SCHEME_CORRIDOR_OPEN_UP_NOTE}</span>
        )}
      </p>
      {children}
    </div>
  );
}
