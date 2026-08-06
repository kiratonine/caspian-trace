import { Injectable } from '@nestjs/common'

import { PrismaService } from '../prisma/prisma.service'
import type { LiveHealthRow } from './live.types'

@Injectable()
export class LiveRepository {
  constructor(private readonly prisma: PrismaService) {}

  findHealth(sourceIds: string[]): Promise<LiveHealthRow[]> {
    return this.prisma.sourceHealth.findMany({
      where: { sourceId: { in: sourceIds } },
      select: { sourceId: true, status: true, lastSuccessAt: true, cacheAvailable: true },
    })
  }
}
