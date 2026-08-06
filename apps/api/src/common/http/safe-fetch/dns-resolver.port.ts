import type { PinnedAddress } from './safe-fetch.types'

export interface DnsResolverPort {
  resolveAll(hostname: string): Promise<readonly PinnedAddress[]>
}
