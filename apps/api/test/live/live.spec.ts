import {
  LiveStatusSchema,
} from '@caspian-trace/contracts'

import { mapLiveHealth } from '../../src/live/live.mapper'
import { LiveService } from '../../src/live/live.service'

describe('live source status', () => {
  it('maps missing rows to never_run in stable three-source order', () => {
    const result = {
      sources: mapLiveHealth([]),
    }

    expect(
      LiveStatusSchema.parse(result).sources.map(
        (source) => source.id,
      ),
    ).toEqual([
      'kazhydromet-bulletins',
      'gdelt',
      'direct-sources',
    ])

    expect(
      result.sources.every(
        (source) =>
          source.status === 'never_run' &&
          !source.cacheAvailable,
      ),
    ).toBe(true)
  })

  it('maps internal enums explicitly without exposing internal fields', () => {
    const sources = mapLiveHealth([
      {
        sourceId: 'gdelt',
        status: 'RATE_LIMITED',
        lastSuccessAt: new Date(
          '2025-09-01T00:00:00Z',
        ),
        cacheAvailable: true,
      },
      {
        sourceId: 'direct-sources',
        status: 'DEGRADED',
        lastSuccessAt: null,
        cacheAvailable: true,
      },
    ])

    expect(sources[1]).toEqual({
      id: 'gdelt',
      name: 'GDELT DOC 2.0',
      lastSuccessAt:
        '2025-09-01T00:00:00.000Z',
      cacheAvailable: true,
      status: 'rate_limited',
    })

    expect(
      JSON.stringify(sources),
    ).not.toContain('detail')

    expect(
      sources[2]?.status,
    ).toBe('degraded')
  })

  it('uses one source-health read and validates the final contract', async () => {
    const getAll = jest
      .fn()
      .mockResolvedValue([])

    const service = new LiveService({
      getAll,
    } as never)

    await expect(
      service.getStatus(),
    ).resolves.toEqual({
      sources: mapLiveHealth([]),
    })

    expect(getAll).toHaveBeenCalledTimes(1)
    expect(getAll).toHaveBeenCalledWith()
  })
})