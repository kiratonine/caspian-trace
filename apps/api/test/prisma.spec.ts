import { ConfigService } from '@nestjs/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { Test } from '@nestjs/testing'

import { PrismaModule } from '../src/prisma/prisma.module'
import { normalizePgConnectionString } from '../src/prisma/prisma-connection'
import { PRISMA_ADAPTER_FACTORY } from '../src/prisma/prisma.constants'
import { PrismaService } from '../src/prisma/prisma.service'

describe('Prisma foundation', () => {
  const databaseUrl = 'postgresql://api:secret@127.0.0.1:5432/caspian'

  it('constructs one global service with the runtime DATABASE_URL', async () => {
    const getOrThrow = jest.fn((key: string): string | number =>
      key === 'DATABASE_URL' ? databaseUrl : 250,
    )
    const adapterFactory = jest.fn(
      (url: string, connectionTimeoutMillis: number): PrismaPg =>
        new PrismaPg({ connectionString: url, connectionTimeoutMillis }),
    )
    const module = await Test.createTestingModule({ imports: [PrismaModule] })
      .overrideProvider(ConfigService)
      .useValue({ getOrThrow })
      .overrideProvider(PRISMA_ADAPTER_FACTORY)
      .useValue(adapterFactory)
      .compile()

    const first = module.get(PrismaService)
    const second = module.get(PrismaService)

    expect(first).toBe(second)
    expect(getOrThrow).toHaveBeenCalledWith('DATABASE_URL')
    expect(getOrThrow).toHaveBeenCalledWith('DB_READINESS_TIMEOUT_MS')
    expect(adapterFactory).toHaveBeenCalledWith(databaseUrl, 250)
    await module.close()
  })

  it('does not eagerly connect and disconnects through the shutdown hook', async () => {
    const service = new PrismaService(
      new ConfigService({
        DATABASE_URL: databaseUrl,
        DB_READINESS_TIMEOUT_MS: 250,
      }),
      (url, connectionTimeoutMillis) =>
        new PrismaPg({ connectionString: url, connectionTimeoutMillis }),
    )
    const connect = jest.spyOn(service, '$connect').mockResolvedValue()
    const disconnect = jest.spyOn(service, '$disconnect').mockResolvedValue()

    await service.onModuleDestroy()

    expect(connect).not.toHaveBeenCalled()
    expect(disconnect).toHaveBeenCalledTimes(1)
  })

  it('does not create an adapter when DATABASE_URL is missing', async () => {
    const adapterFactory = jest.fn(
      (url: string, connectionTimeoutMillis: number): PrismaPg =>
        new PrismaPg({ connectionString: url, connectionTimeoutMillis }),
    )
    await expect(
      Test.createTestingModule({ imports: [PrismaModule] })
        .overrideProvider(ConfigService)
        .useValue({
          getOrThrow: (): never => {
            throw new Error('DATABASE_URL is missing')
          },
        })
        .overrideProvider(PRISMA_ADAPTER_FACTORY)
        .useValue(adapterFactory)
        .compile(),
    ).rejects.toThrow('DATABASE_URL is missing')
    expect(adapterFactory).not.toHaveBeenCalled()
  })

  it('uses libpq semantics only for sslmode=require', () => {
    const required = normalizePgConnectionString(
      'postgresql://api:secret@localhost:5432/caspian?sslmode=require',
    )
    const verified = normalizePgConnectionString(
      'postgresql://api:secret@localhost:5432/caspian?sslmode=verify-full',
    )

    expect(new URL(required).searchParams.get('uselibpqcompat')).toBe('true')
    expect(new URL(verified).searchParams.has('uselibpqcompat')).toBe(false)
  })
})
