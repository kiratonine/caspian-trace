import { Injectable } from '@nestjs/common'

import {
  LiveStatusSchema,
  type LiveStatus,
} from '@caspian-trace/contracts'

import { SourceHealthService } from '../sources/source-health/source-health.service'
import { mapLiveHealth } from './live.mapper'

@Injectable()
export class LiveService {
  constructor(
    private readonly sourceHealth:
      SourceHealthService,
  ) { }

  async getStatus(): Promise<LiveStatus> {
    const rows =
      await this.sourceHealth.getAll()

    return LiveStatusSchema.parse({
      sources: mapLiveHealth(rows),
    })
  }
}