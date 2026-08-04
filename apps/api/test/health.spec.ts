import { ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'

import { HealthService } from '../src/health/health.service'
import { PrismaService } from '../src/prisma/prisma.service'

describe('HealthService', () => {
  const checkReadiness = jest.fn()

  async function createService(timeoutMs = 250): Promise<HealthService> {
    const module = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: { checkReadiness } },
        {
          provide: ConfigService,
          useValue: { get: (): number => timeoutMs },
        },
      ],
    }).compile()
    return module.get(HealthService)
  }

  beforeEach(() => checkReadiness.mockReset())

  it('returns ready only after a successful database query', async () => {
    checkReadiness.mockResolvedValue(undefined)
    await expect((await createService()).ready()).resolves.toEqual({
      status: 'ok',
      service: 'caspian-trace-api',
      database: 'ready',
    })
    expect(checkReadiness).toHaveBeenCalledWith(250)
  })

  it('normalizes database failures without leaking details', async () => {
    checkReadiness.mockRejectedValue(new Error('postgresql://user:secret@db'))
    await expect((await createService()).ready()).rejects.toEqual(
      new ServiceUnavailableException({
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database is unavailable',
      }),
    )
  })

  it('times out an unresolved database query', async () => {
    checkReadiness.mockReturnValue(new Promise(() => undefined))
    await expect((await createService(250)).ready()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    )
  })
})
