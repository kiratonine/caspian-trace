import { Injectable } from '@nestjs/common'

import { LiveStatusSchema, type LiveStatus } from '@caspian-trace/contracts'

import { LIVE_SOURCE_REGISTRY, mapLiveHealth } from './live.mapper'
import { LiveRepository } from './live.repository'

@Injectable()
export class LiveService {
  constructor(private readonly repository: LiveRepository) {}

  async getStatus(): Promise<LiveStatus> {
    const rows = await this.repository.findHealth(LIVE_SOURCE_REGISTRY.map((source) => source.dbId))
    return LiveStatusSchema.parse({ sources: mapLiveHealth(rows) })
  }
}
