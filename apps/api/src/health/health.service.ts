import { Injectable, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { HealthReady } from '@caspian-trace/contracts'

import type { PlatformEnvironment } from '../config/environment'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<PlatformEnvironment, true>,
  ) {}

  async ready(): Promise<HealthReady> {
    const configuredTimeout: unknown = this.config.get<unknown>(
      'DB_READINESS_TIMEOUT_MS',
    )
    const timeoutMs =
      typeof configuredTimeout === 'number' ? configuredTimeout : 3_000
    let timeout: NodeJS.Timeout | undefined

    try {
      await Promise.race([
        this.prisma.checkReadiness(timeoutMs),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error('Database readiness timeout')),
            timeoutMs,
          )
        }),
      ])
    } catch {
      throw new ServiceUnavailableException({
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database is unavailable',
      })
    } finally {
      if (timeout !== undefined) clearTimeout(timeout)
    }

    return {
      status: 'ok',
      service: 'caspian-trace-api',
      database: 'ready',
    }
  }
}
