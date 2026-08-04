// ТЗ §12, ответ POST /api/replays/:id/start.
// payload остаётся unknown до примера JSON от команды (вопрос 3 плана);
// провизорная типизация payload — в src/api/contracts.ts, не здесь.
export type ReplayStepType =
  | 'signal'
  | 'corroboration'
  | 'measurement'
  | 'inference'
  | 'conclusion';

export type ReplayStep = {
  id: string;
  offsetMs: number;
  type: ReplayStepType;
  payload: unknown;
};
