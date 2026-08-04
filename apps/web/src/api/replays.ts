import type { ReplayScenario } from './contracts';
import { warnStubOnce } from './client';
import { replayScenarios } from './seed-data';

// STUB: заменить на POST /api/replays/:id/start (apiPost из ./client),
// сценарий отдаёт full-stack 2. Пока есть только сентябрьский сценарий ТЗ §14.
export async function startReplay(incidentId: string): Promise<ReplayScenario> {
  warnStubOnce('POST /api/replays/:id/start — сентябрьский сценарий из ТЗ §14');
  const scenario = replayScenarios[incidentId];
  if (!scenario) throw new Error(`Для события «${incidentId}» нет сценария реплея`);
  return scenario;
}
