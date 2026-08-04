import { MeasurementValue } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  SCHEME_CORRIDOR_BOUND_LABEL,
  SCHEME_CORRIDOR_LOWER_BOUND_TOOLTIP,
  SCHEME_CORRIDOR_OPEN_UP_TOOLTIP,
  SCHEME_CORRIDOR_UPPER_BOUND_TOOLTIP,
  SCHEME_NO_VALUE_LABEL,
} from '@/constants/scheme';
import type { StationSchemeEntry } from './scheme-model';

type StationNodeProps = {
  entry: StationSchemeEntry;
  /**
   * Бейдж границы коридора — для группы без подтверждённого порядка, где
   * ленту коридора нарисовать нельзя; на линии границы показывает CorridorBand.
   */
  corridorBound?: 'upstream' | 'downstream' | null;
  /** Интервал открыт вверх по течению (upstreamStationId = null). */
  corridorOpenUp?: boolean;
};

function boundTooltip(
  bound: 'upstream' | 'downstream',
  openUp: boolean,
): string {
  if (bound === 'upstream') return SCHEME_CORRIDOR_UPPER_BOUND_TOOLTIP;
  return openUp
    ? SCHEME_CORRIDOR_OPEN_UP_TOOLTIP
    : SCHEME_CORRIDOR_LOWER_BOUND_TOOLTIP;
}

export function StationNode({
  entry,
  corridorBound = null,
  corridorOpenUp = false,
}: StationNodeProps) {
  const { station, measurement, sourceDocument, valueShare } = entry;

  return (
    <div className="relative flex items-center gap-3 py-2.5">
      <span
        aria-hidden
        className="size-2.5 shrink-0 rounded-full border-2 border-muted-foreground bg-background"
      />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
        {/* Длинные подписи створов усечены, полное имя — в тултипе. */}
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="max-w-full truncate text-sm">
                {station.name}
              </span>
            }
          />
          <TooltipContent>
            <p className="max-w-64 text-pretty">{station.name}</p>
          </TooltipContent>
        </Tooltip>
        {corridorBound && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Badge
                  variant="outline"
                  className="h-4 border-dashed px-1.5 text-[10px] text-muted-foreground"
                >
                  {SCHEME_CORRIDOR_BOUND_LABEL}
                </Badge>
              }
            />
            <TooltipContent>
              <p className="max-w-64 text-pretty">
                {boundTooltip(corridorBound, corridorOpenUp)}
              </p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      {/* Длина, а не цвет: относительное положение значения внутри выбранного
          события (ТЗ §13). Цветовая формула — открытый вопрос 10, а шкалу
          «опасности» вводить запрещено (запрет 4). */}
      {valueShare !== null && (
        <span
          aria-hidden
          className="h-1 w-20 shrink-0 overflow-hidden bg-foreground/10"
        >
          <span
            className="block h-full bg-foreground/40"
            style={{ width: `${Math.round(valueShare * 100)}%` }}
          />
        </span>
      )}
      {measurement && sourceDocument ? (
        <MeasurementValue
          measurement={measurement}
          sourceDocument={sourceDocument}
          className="text-sm"
        />
      ) : (
        <span className="text-sm whitespace-nowrap text-muted-foreground">
          {SCHEME_NO_VALUE_LABEL}
        </span>
      )}
    </div>
  );
}
