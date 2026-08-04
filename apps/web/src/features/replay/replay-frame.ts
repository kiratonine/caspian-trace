import { useMemo } from 'react';

import type {
  IncidentDetail,
  ReplayScenario,
  TypedReplayStep,
} from '@/api/contracts';
import { replayMeasurementSummary } from '@/constants/replay';
import { useReplayStore } from '@/stores/replayStore';
import type { EvidenceLevel } from '@/types';

// «Кадр» реплея — что уже показано к текущему шагу. Панели читают его
// селектором поверх загруженных данных, без рефетча на шаг (план сессии 9):
// кадр ничего не сочиняет, он только решает, какие из УЖЕ загруженных данных
// события ещё «не наступили» в хронологии.

export type ReplayFrame = {
  scenario: ReplayScenario;
  stepIndex: number;
  step: TypedReplayStep;
  /** Уровень на текущем шаге — приходит в payload каждого шага с бэка. */
  evidenceLevel: EvidenceLevel;
  /** Измерения, «загруженные» шагами measurement к текущему моменту. */
  visibleMeasurementIds: ReadonlySet<string>;
  /** Документы, на которые уже сослались наступившие шаги. */
  visibleSourceDocumentIds: ReadonlySet<string>;
  /** Достигнут шаг «применение правила» — появляются факты, версии и пробелы. */
  inferenceReached: boolean;
  /** Достигнут шаг «вывод» — блок 1 панели показывает текст вывода. */
  conclusionReached: boolean;
  /** Дословный текст вывода из payload шага conclusion. */
  conclusionText: string | null;
};

export function buildReplayFrame(
  scenario: ReplayScenario,
  stepIndex: number,
): ReplayFrame {
  const step = scenario.steps[stepIndex];
  if (!step) throw new Error(`В сценарии «${scenario.id}» нет шага ${stepIndex}`);

  const visibleMeasurementIds = new Set<string>();
  const visibleSourceDocumentIds = new Set<string>();
  let inferenceReached = false;
  let conclusionText: string | null = null;
  for (const reached of scenario.steps.slice(0, stepIndex + 1)) {
    switch (reached.type) {
      case 'signal':
        visibleSourceDocumentIds.add(reached.payload.signal.sourceDocumentId);
        break;
      case 'corroboration':
        visibleSourceDocumentIds.add(reached.payload.sourceDocumentId);
        break;
      case 'measurement':
        for (const measurement of reached.payload.measurements) {
          visibleMeasurementIds.add(measurement.id);
          visibleSourceDocumentIds.add(measurement.sourceDocumentId);
        }
        break;
      case 'inference':
        inferenceReached = true;
        break;
      case 'conclusion':
        conclusionText = reached.payload.text;
        break;
    }
  }

  return {
    scenario,
    stepIndex,
    step,
    evidenceLevel: step.payload.evidenceLevel,
    visibleMeasurementIds,
    visibleSourceDocumentIds,
    inferenceReached,
    conclusionReached: conclusionText !== null,
    conclusionText,
  };
}

/**
 * Кадр активного реплея для события `incidentId`; null — реплей не запущен
 * или запущен для другого события (защита от рассинхрона при смене выбора).
 */
export function useReplayFrame(incidentId: string | null): ReplayFrame | null {
  const scenario = useReplayStore((state) => state.scenario);
  const stepIndex = useReplayStore((state) => state.stepIndex);

  return useMemo(() => {
    if (!scenario || scenario.incidentId !== incidentId) return null;
    if (!scenario.steps[stepIndex]) return null;
    return buildReplayFrame(scenario, stepIndex);
  }, [scenario, stepIndex, incidentId]);
}

/**
 * Проекция события на кадр реплея: скрывает ещё «не наступившие» измерения,
 * документы и коридор (он — результат шага inference). Станции остаются:
 * сеть наблюдений — справочная основа, а не накапливаемое доказательство,
 * и её исчезновение ломало бы схему на первых шагах.
 */
export function projectDetailForReplay(
  detail: IncidentDetail,
  frame: ReplayFrame,
): IncidentDetail {
  return {
    ...detail,
    measurements: detail.measurements.filter((measurement) =>
      frame.visibleMeasurementIds.has(measurement.id),
    ),
    sourceDocuments: detail.sourceDocuments.filter((document) =>
      frame.visibleSourceDocumentIds.has(document.id),
    ),
    corridorBounds: frame.inferenceReached ? detail.corridorBounds : null,
  };
}

/** Строка текущего шага для шкалы: дословные тексты payload, без пересказа. */
export function describeReplayStep(step: TypedReplayStep): string {
  switch (step.type) {
    case 'signal':
      return `«${step.payload.signal.excerpt}»`;
    case 'corroboration':
    case 'inference':
    case 'conclusion':
      return step.payload.text;
    case 'measurement':
      return replayMeasurementSummary(step.payload.measurements.length);
  }
}
