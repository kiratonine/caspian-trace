import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { EVIDENCE_LEVEL_META, type EvidenceTone } from '@/constants/evidence';
import { cn } from '@/lib/utils';
import type { EvidenceLevel } from '@/types';

// Палитра ТЗ §6 (серый/синий/янтарный/зелёный) живёт только здесь — см.
// комментарий в constants/evidence.ts. Это цвета уровней доказательности,
// а не шкала «опасности» (запрет 4).
const TONE_CLASSES: Record<EvidenceTone, string> = {
  gray: 'bg-muted text-muted-foreground',
  blue: 'bg-blue-500/15 text-blue-700 dark:bg-blue-400/20 dark:text-blue-300',
  amber:
    'bg-amber-500/15 text-amber-700 dark:bg-amber-400/20 dark:text-amber-300',
  green:
    'bg-green-600/15 text-green-700 dark:bg-green-400/20 dark:text-green-300',
};

type EvidenceLevelBadgeProps = {
  level: EvidenceLevel;
  /** Только код L0–L3 — для ленты и схемы; полная подпись остаётся в тултипе. */
  compact?: boolean;
  className?: string;
};

export function EvidenceLevelBadge({
  level,
  compact = false,
  className,
}: EvidenceLevelBadgeProps) {
  const meta = EVIDENCE_LEVEL_META[level];

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            variant="secondary"
            className={cn(TONE_CLASSES[meta.tone], className)}
          >
            <span className="font-semibold">{meta.code}</span>
            {!compact && <span className="truncate">{meta.label}</span>}
          </Badge>
        }
      />
      <TooltipContent>
        <p className="max-w-64 text-pretty">
          <span className="font-semibold">
            {meta.code} — {meta.label}.
          </span>{' '}
          {meta.description}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
