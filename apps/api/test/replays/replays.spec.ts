import { ReplayScenarioSchema } from '@caspian-trace/contracts'

import { FileInvestigationRepository } from '../../src/investigations/file-investigation.repository'
import { InvestigationsService } from '../../src/investigations/investigations.service'
import { ReplaysRepository } from '../../src/replays/replays.repository'
import { ReplaysService } from '../../src/replays/replays.service'

describe('ReplaysService', () => {
  it('returns the same contract-valid immutable scenario', async () => {
    const inputs = new FileInvestigationRepository()
    const investigations = new InvestigationsService(inputs, inputs)
    const replays = new ReplaysService(investigations, new ReplaysRepository())

    const first = ReplayScenarioSchema.parse(
      await replays.start('inv-atyrau-2025-09'),
    )
    const originalId = first.steps[0]?.id
    if (first.steps[0] !== undefined) first.steps[0].id = 'mutated-client-copy'
    const second = await replays.start('inv-atyrau-2025-09')

    expect(second.steps[0]?.id).toBe(originalId)
    expect(second.steps.map(({ offsetMs }) => offsetMs)).toEqual(
      [...second.steps].map(({ offsetMs }) => offsetMs).sort((a, b) => a - b),
    )
    expect(second.steps.at(-1)?.type).toBe('conclusion')
    expect(second.steps.at(-1)?.offsetMs).toBeGreaterThanOrEqual(25_000)
    expect(second.steps.at(-1)?.offsetMs).toBeLessThanOrEqual(30_000)
    expect(
      second.steps.slice(0, 3).map(({ payload }) => payload.evidenceLevel),
    ).toEqual(['L0', 'L1', 'L1'])
    expect(
      second.steps
        .filter(({ type }) => type === 'inference')
        .every(({ payload }) => payload.evidenceLevel === 'L2'),
    ).toBe(true)
  })
})
