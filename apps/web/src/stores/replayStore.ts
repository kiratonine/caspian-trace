import { create } from 'zustand';

import type { ReplayScenario } from '@/api/contracts';

// Состояние реплея (единственная зона Zustand по плану). Сценарий приходит
// с бэка неизменяемым массивом шагов (ТЗ §12) и проигрывается локальными
// таймерами — стор хранит только позицию воспроизведения.
//
// Позиция кодируется парой якорей, а не тикающим числом: anchorPositionMs —
// позиция, зафиксированная последним play/pause/seek, anchorTimeMs —
// performance.now() момента старта воспроизведения (null — стоим). Текущая
// позиция всегда вычисляется от performance.now() (getReplayPositionMs),
// поэтому пауза и перемотка не накапливают дрейф цепочки setTimeout
// («подводные камни» плана).

export type ReplayStatus = 'paused' | 'playing' | 'finished';

type ReplayState = {
  /** null — реплей не запущен, колонки показывают текущее состояние события. */
  scenario: ReplayScenario | null;
  /** Индекс текущего шага — последнего, чей offsetMs уже наступил. */
  stepIndex: number;
  status: ReplayStatus;
  /** Позиция плейхеда, зафиксированная последним play/pause/seek. */
  anchorPositionMs: number;
  /** performance.now() момента последнего play; null — воспроизведение стоит. */
  anchorTimeMs: number | null;
  start: (
    scenario: ReplayScenario,
    options?: { stepIndex?: number; autoplay?: boolean },
  ) => void;
  play: () => void;
  pause: () => void;
  /** Перемотка на шаг: позиция встаёт ровно на offsetMs шага. */
  seekToStep: (index: number) => void;
  /** Продвижение от таймера useReplayPlayback — только во время playing. */
  advanceToStep: (index: number) => void;
  exit: () => void;
};

/** Текущая позиция плейхеда, вычисленная от performance.now(). */
export function getReplayPositionMs(
  state: Pick<ReplayState, 'anchorPositionMs' | 'anchorTimeMs'>,
): number {
  return state.anchorTimeMs === null
    ? state.anchorPositionMs
    : state.anchorPositionMs + performance.now() - state.anchorTimeMs;
}

const IDLE_STATE = {
  scenario: null,
  stepIndex: 0,
  status: 'paused' as ReplayStatus,
  anchorPositionMs: 0,
  anchorTimeMs: null,
};

export const useReplayStore = create<ReplayState>()((set, get) => ({
  ...IDLE_STATE,

  start: (scenario, { stepIndex = 0, autoplay = true } = {}) => {
    const step = scenario.steps[stepIndex];
    if (!step) return;
    const lastIndex = scenario.steps.length - 1;
    set({
      scenario,
      stepIndex,
      status: autoplay
        ? 'playing'
        : stepIndex === lastIndex
          ? 'finished'
          : 'paused',
      anchorPositionMs: step.offsetMs,
      anchorTimeMs: autoplay ? performance.now() : null,
    });
  },

  play: () => {
    const state = get();
    if (!state.scenario || state.status === 'playing') return;
    if (state.status === 'finished') {
      // Play на дошедшем до конца реплее — повтор с начала: удобнее для демо,
      // чем мёртвая кнопка.
      const first = state.scenario.steps[0];
      if (!first) return;
      set({
        stepIndex: 0,
        status: 'playing',
        anchorPositionMs: first.offsetMs,
        anchorTimeMs: performance.now(),
      });
      return;
    }
    set({ status: 'playing', anchorTimeMs: performance.now() });
  },

  pause: () => {
    const state = get();
    if (state.status !== 'playing') return;
    set({
      status: 'paused',
      anchorPositionMs: getReplayPositionMs(state),
      anchorTimeMs: null,
    });
  },

  seekToStep: (index) => {
    const state = get();
    if (!state.scenario) return;
    const lastIndex = state.scenario.steps.length - 1;
    const clamped = Math.min(Math.max(index, 0), lastIndex);
    const step = state.scenario.steps[clamped];
    if (!step) return;
    if (clamped === lastIndex) {
      set({
        stepIndex: clamped,
        status: 'finished',
        anchorPositionMs: step.offsetMs,
        anchorTimeMs: null,
      });
      return;
    }
    const keepPlaying = state.status === 'playing';
    set({
      stepIndex: clamped,
      status: keepPlaying ? 'playing' : 'paused',
      anchorPositionMs: step.offsetMs,
      anchorTimeMs: keepPlaying ? performance.now() : null,
    });
  },

  advanceToStep: (index) => {
    const state = get();
    if (!state.scenario || state.status !== 'playing') return;
    const lastIndex = state.scenario.steps.length - 1;
    if (index >= lastIndex) {
      const last = state.scenario.steps[lastIndex];
      set({
        stepIndex: lastIndex,
        status: 'finished',
        anchorPositionMs: last?.offsetMs ?? 0,
        anchorTimeMs: null,
      });
      return;
    }
    // Якоря не трогаются: позиция продолжает идти от того же performance.now().
    set({ stepIndex: index });
  },

  exit: () => set(IDLE_STATE),
}));
