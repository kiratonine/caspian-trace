import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

import { Injectable } from '@nestjs/common'

import { safeFetchError } from './safe-fetch.errors'
import type { DnsResolverPort } from './dns-resolver.port'
import type { PinnedAddress } from './safe-fetch.types'

@Injectable()
export class NodeDnsResolverService implements DnsResolverPort {
  async resolveAll(hostname: string): Promise<readonly PinnedAddress[]> {
    let records
    try {
      records = await lookup(hostname, { all: true, verbatim: true })
    } catch {
      throw safeFetchError(
        'SAFE_FETCH_DNS_RESOLUTION_FAILED',
        'Source hostname could not be resolved',
      )
    }

    if (records.length === 0) {
      throw safeFetchError(
        'SAFE_FETCH_DNS_RESOLUTION_FAILED',
        'Source hostname could not be resolved',
      )
    }

    return records.map((record): PinnedAddress => {
      const family = isIP(record.address)
      if ((family !== 4 && family !== 6) || family !== record.family) {
        throw safeFetchError(
          'SAFE_FETCH_DNS_RESOLUTION_FAILED',
          'Source hostname returned an invalid address',
        )
      }
      return { address: record.address, family }
    })
  }
}
