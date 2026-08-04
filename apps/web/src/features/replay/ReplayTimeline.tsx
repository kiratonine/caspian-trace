import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pause, Play, Square } from 'lucide-react';

import { replayScenarioQueryOptions } from '@/api/queries';
import { EvidenceLevelBadge } from '@/components/common';
import { Button } from '@/components/ui/button';
import {
  REPLAY_EXIT_LABEL,
  REPLAY_KEYBOARD_HINT,
  REPLAY_PAUSE_LABEL,
  REPLAY_PLAY_LABEL,
  REPLAY_RESTART_LABEL,
  REPLAY_RESUME_LABEL,
  REPLAY_STEP_OFFSETS_MS,
  REPLAY_STEP_TYPE_LABELS,
  REPLAY_STEP_TYPE_ORDER,
  REPLAY_UNAVAILABLE,
  replayStepAriaLabel,
} from '@/constants/replay';
import { useSelectedIncidentDetail } from '@/hooks/use-selected-incident-detail';
import { cn } from '@/lib/utils';
import { useReplayStore } from '@/stores/replayStore';
import { describeReplayStep, useReplayFrame } from './replay-frame';
import { useReplayPlayback, useReplayPositionMs } from './useReplayPlayback';

// Шкала-плеер реплея (сессия 9). Маркеры стоят на реальных offsetMs сценария
// (шкала — хронология доказательств, а не прогресс-бар); до загрузки сценария
// разметка берётся из формы демо-сценария §12.
const PLACEHOLDER_STEPS = REPLAY_STEP_TYPE_ORDER.map((type, index) => ({
  id: type,
  type,
  offsetMs: REPLAY_STEP_OFFSETS_MS[index],
}));

// Крайние подписи прижаты к краям шкалы, промежуточные центрированы над маркером.
function labelAlignment(index: number, count: number) {
  if (index === 0) {
    return '';
  }
  if (index === count - 1) {
    return '-translate-x-full text-right';
  }
  return '-translate-x-1/2 text-center';
}

export function ReplayTimeline() {
  const { selectedIncidentId } = useSelectedIncidentDetail();
  const scenarioQuery = useQuery({
    ...replayScenarioQueryOptions(selectedIncidentId ?? ''),
    enabled: selectedIncidentId !== null,
  });
  const availableScenario = scenarioQuery.data ?? null;

  const activeScenario = useReplayStore((state) => state.scenario);
  const status = useReplayStore((state) => state.status);
  const start = useReplayStore((state) => state.start);
  const play = useReplayStore((state) => state.play);
  const pause = useReplayStore((state) => state.pause);
  const seekToStep = useReplayStore((state) => state.seekToStep);
  const exit = useReplayStore((state) => state.exit);

  useReplayPlayback();
  const positionMs = useReplayPositionMs();
  const frame = useReplayFrame(selectedIncidentId);

  // Реплей не переживает смену выбранного события: сценарий другого события
  // на экране нового — рассинхрон всех трёх колонок.
  useEffect(() => {
    if (activeScenario && activeScenario.incidentId !== selectedIncidentId) {
      exit();
    }
  }, [activeScenario, selectedIncidentId, exit]);

  // Клавиатура (ТЗ: вести демо мышью на проекторе неудобно). Живое состояние
  // берётся из getState() — обработчик не пересоздаётся на каждый шаг.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (
        target &&
        (target.isContentEditable || target.closest('input, textarea, select'))
      ) {
        return;
      }
      const store = useReplayStore.getState();

      if (event.code === 'Space') {
        // Фокус на кнопке или ссылке — пробел принадлежит нативной активации.
        if (target?.closest('button, a')) return;
        event.preventDefault();
        if (event.repeat) return;
        if (!store.scenario) {
          if (availableScenario) store.start(availableScenario);
        } else if (store.status === 'playing') {
          store.pause();
        } else {
          store.play();
        }
        return;
      }

      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        const delta = event.key === 'ArrowRight' ? 1 : -1;
        if (!store.scenario) {
          // «→» без запущенного реплея — ручной проход по шагам с начала.
          if (delta === 1 && availableScenario) {
            event.preventDefault();
            store.start(availableScenario, { autoplay: false });
          }
          return;
        }
        event.preventDefault();
        store.seekToStep(store.stepIndex + delta);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [availableScenario]);

  const isPlaying = frame !== null && status === 'playing';
  const canReplay = availableScenario !== null || activeScenario !== null;
  const playLabel = !activeScenario
    ? REPLAY_PLAY_LABEL
    : status === 'playing'
      ? REPLAY_PAUSE_LABEL
      : status === 'finished'
        ? REPLAY_RESTART_LABEL
        : REPLAY_RESUME_LABEL;

  const steps = (activeScenario ?? availableScenario)?.steps ?? PLACEHOLDER_STEPS;
  const totalMs = steps[steps.length - 1]?.offsetMs || 1;
  const progress =
    positionMs === null ? null : Math.min(positionMs / totalMs, 1);
  const stepSummary = frame ? describeReplayStep(frame.step) : null;

  const togglePlayback = () => {
    if (!activeScenario) {
      if (availableScenario) start(availableScenario);
      return;
    }
    if (status === 'playing') {
      pause();
    } else {
      play();
    }
  };

  const handleMarkerClick = (index: number) => {
    if (activeScenario) {
      seekToStep(index);
    } else if (availableScenario) {
      // Клик по маркеру без запущенного реплея — старт на этом шаге без
      // воспроизведения: ручной режим для демо.
      start(availableScenario, { stepIndex: index, autoplay: false });
    }
  };

  return (
    <footer
      aria-label="Шкала реплея"
      // min-w-0: как строка грида футер иначе получает минимальную ширину по
      // содержимому, и длинный текст шага растягивает весь экран вбок.
      className="flex min-w-0 items-center gap-4 border-t px-4 py-2.5"
    >
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="icon"
          disabled={!canReplay}
          onClick={togglePlayback}
          aria-label={playLabel}
          title={playLabel}
        >
          {isPlaying ? <Pause /> : <Play />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={!activeScenario}
          onClick={exit}
          aria-label={REPLAY_EXIT_LABEL}
          title={REPLAY_EXIT_LABEL}
        >
          <Square />
        </Button>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {/* Строка шага — блок с truncate, а не flex: у flex-контейнера
            минимальная ширина считается по содержимому, и длинный текст
            вывода распирал бы всю сетку экрана. */}
        <p
          className="h-5 truncate text-xs leading-5 text-muted-foreground"
          title={stepSummary ?? undefined}
        >
          {frame ? (
            <>
              <span className="font-medium text-foreground">
                {REPLAY_STEP_TYPE_LABELS[frame.step.type]}
              </span>
              <EvidenceLevelBadge
                level={frame.evidenceLevel}
                compact
                className="mx-2 align-middle"
              />
              {stepSummary}
            </>
          ) : scenarioQuery.isError ? (
            REPLAY_UNAVAILABLE
          ) : (
            REPLAY_KEYBOARD_HINT
          )}
        </p>
        <div className="relative h-9 min-w-0">
          <div className="absolute inset-x-0 top-2.25 h-px bg-border" />
          {progress !== null && (
            <>
              <div
                className="absolute left-0 top-2.25 h-px bg-foreground"
                style={{ width: `${progress * 100}%` }}
              />
              <div
                aria-hidden
                className="absolute top-1 h-2.5 w-px -translate-x-1/2 bg-foreground"
                style={{ left: `${progress * 100}%` }}
              />
            </>
          )}
          {steps.map((step, index) => {
            const reached = frame !== null && index <= frame.stepIndex;
            const isCurrent = frame !== null && index === frame.stepIndex;
            const label = REPLAY_STEP_TYPE_LABELS[step.type];
            return (
              <div
                key={step.id}
                className="absolute top-0 h-full"
                style={{ left: `${(step.offsetMs / totalMs) * 100}%` }}
              >
                <button
                  type="button"
                  disabled={!canReplay}
                  onClick={() => handleMarkerClick(index)}
                  aria-label={replayStepAriaLabel(label)}
                  aria-current={isCurrent ? 'step' : undefined}
                  className="absolute top-2.25 -translate-x-1/2 -translate-y-1/2 rounded-full p-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-default"
                >
                  <span
                    className={cn(
                      'block size-2 rounded-full bg-muted-foreground/50 transition-colors',
                      reached && 'bg-foreground',
                      isCurrent && 'ring-4 ring-foreground/15',
                    )}
                  />
                </button>
                <span
                  className={cn(
                    'absolute top-5 block w-max text-[10px] leading-tight text-muted-foreground',
                    labelAlignment(index, steps.length),
                    isCurrent && 'font-medium text-foreground',
                  )}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </footer>
  );
}
