import { setTimeout as delay } from 'node:timers/promises'

import { Injectable } from '@nestjs/common'

import type { SafeFetchRuntime } from './safe-fetch.types'

@Injectable()
export class SystemSafeFetchRuntime implements SafeFetchRuntime {
  now(): number {
    return Date.now()
  }

  random(): number {
    return Math.random()
  }

  async sleep(milliseconds: number): Promise<void> {
    await delay(milliseconds)
  }
}
