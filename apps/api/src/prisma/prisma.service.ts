import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaPg } from '@prisma/adapter-pg'

import type { PlatformEnvironment } from '../config/environment'
import { PrismaClient } from '../generated/prisma/client'
import { PRISMA_ADAPTER_FACTORY } from './prisma.constants'

export type PrismaAdapterFactory = (
  databaseUrl: string,
  connectionTimeoutMillis: number,
) => PrismaPg

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(
    config: ConfigService<PlatformEnvironment, true>,
    @Inject(PRISMA_ADAPTER_FACTORY) adapterFactory: PrismaAdapterFactory,
  ) {
    super({
      adapter: adapterFactory(
        config.getOrThrow('DATABASE_URL'),
        config.getOrThrow('DB_READINESS_TIMEOUT_MS'),
      ),
    })
  }

  async checkReadiness(timeoutMs: number): Promise<void> {
    await this.$transaction(
      async (transaction) => {
        await transaction.$queryRaw`
          SELECT set_config('statement_timeout', ${`${timeoutMs}ms`}, true)
        `
        await transaction.$queryRaw`SELECT 1`
      },
      { maxWait: timeoutMs, timeout: timeoutMs },
    )
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect()
  }
}
