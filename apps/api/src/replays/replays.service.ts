import { Injectable } from '@nestjs/common'

import type { ReplayScenario } from '@caspian-trace/contracts'

import { InvestigationsService } from '../investigations/investigations.service'
import { toReplayScenario } from './replay.mapper'
import { ReplaysRepository } from './replays.repository'

@Injectable()
export class ReplaysService {
  constructor(
    private readonly investigations: InvestigationsService,
    private readonly repository: ReplaysRepository,
  ) {}

  async start(id: string): Promise<ReplayScenario> {
    const stored = await this.investigations.getStored(id)
    const fingerprint = `${stored.result.rulesetVersion}:${stored.result.inputHash}`
    const existing = this.repository.find(id, fingerprint)
    if (existing !== null) return existing
    return this.repository.save(
      fingerprint,
      toReplayScenario(stored),
    )
  }
}
