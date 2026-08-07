import { Injectable } from '@nestjs/common'

import type { ReplayScenario } from '@caspian-trace/contracts'

@Injectable()
export class ReplaysRepository {
  private readonly scenarios = new Map<
    string,
    { fingerprint: string; scenario: ReplayScenario }
  >()

  find(id: string, fingerprint: string): ReplayScenario | null {
    const record = this.scenarios.get(id)
    return record === undefined || record.fingerprint !== fingerprint
      ? null
      : structuredClone(record.scenario)
  }

  save(fingerprint: string, scenario: ReplayScenario): ReplayScenario {
    const snapshot = structuredClone(scenario)
    this.scenarios.set(scenario.id, { fingerprint, scenario: snapshot })
    return structuredClone(snapshot)
  }
}
