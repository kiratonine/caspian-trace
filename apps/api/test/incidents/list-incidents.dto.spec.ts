import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'

import {
  ListIncidentsDto,
  toIncidentFilters,
} from '../../src/incidents/dto/list-incidents.dto'

async function errors(input: Record<string, unknown>): Promise<number> {
  return (
    await validate(plainToInstance(ListIncidentsDto, input), {
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  ).length
}

describe('ListIncidentsDto', () => {
  it('uses the default limit and inclusive UTC date range', async () => {
    const dto = plainToInstance(ListIncidentsDto, {
      from: '2025-01-01',
      to: '2025-12-31',
    })
    await expect(validate(dto)).resolves.toHaveLength(0)
    expect(toIncidentFilters(dto)).toEqual({
      status: undefined,
      region: undefined,
      generatedFrom: new Date('2025-01-01T00:00:00.000Z'),
      generatedBefore: new Date('2026-01-01T00:00:00.000Z'),
      limit: 50,
    })
  })

  it.each([1, 100])('accepts boundary limit %s', async (limit) => {
    await expect(errors({ limit })).resolves.toBe(0)
  })

  it.each([0, 101])('rejects out-of-range limit %s', async (limit) => {
    await expect(errors({ limit })).resolves.toBeGreaterThan(0)
  })

  it.each([
    { status: 'L4' },
    { region: 'west' },
    { from: '2025-02-30' },
    { from: '2025-09-02', to: '2025-09-01' },
  ])('rejects invalid query %#', async (query) => {
    await expect(errors(query)).resolves.toBeGreaterThan(0)
  })
})
