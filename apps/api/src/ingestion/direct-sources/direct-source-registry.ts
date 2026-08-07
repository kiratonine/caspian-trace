import type { KazhydrometRegion } from '../ingestion.types'

export type DirectSourceTier = 1 | 2
export type SourceCoverageTag =
  | 'atyrau'
  | 'lower_ural'
  | 'north_caspian'
  | 'mangystau'
  | 'east_caspian'
  | 'upstream_ural'
  | 'upstream_ilek'
  | 'national'

export interface DirectSourceRegistryEntry {
  canonicalHost: string
  aliases: string[]
  publisher: string
  tier: DirectSourceTier
  coverage: SourceCoverageTag[]
  requestRegions: KazhydrometRegion[]
}

export const DIRECT_SOURCE_REGISTRY: readonly DirectSourceRegistryEntry[] = [
  entry('kazhydromet.kz', 'РГП «Казгидромет»', 1, ['national'], ['atyrau', 'mangystau']),
  entry('inform.kz', 'Казинформ', 1, ['national'], ['atyrau', 'mangystau']),
  entry('gov.kz', 'Официальный портал государственных органов Республики Казахстан', 1, ['national'], ['atyrau', 'mangystau']),
  entry('azh.kz', 'Ак Жайык', 1, ['atyrau', 'lower_ural', 'north_caspian'], ['atyrau']),
  entry('atpress.kz', 'АтырауПресс', 1, ['atyrau'], ['atyrau']),
  entry('lada.kz', 'Lada.kz', 1, ['mangystau', 'east_caspian'], ['mangystau']),
  entry('inaktau.kz', 'InAktau.kz', 1, ['mangystau', 'east_caspian'], ['mangystau']),
  entry('tumba.kz', 'Тумба', 1, ['mangystau', 'east_caspian'], ['mangystau']),
  entry('mangystaumedia.kz', 'Mangystau Media', 2, ['mangystau'], ['mangystau']),
  entry('uralskweek.kz', 'Уральская неделя', 2, ['upstream_ural'], ['atyrau']),
  entry('mgorod.kz', 'Мой город', 2, ['upstream_ural'], ['atyrau']),
  entry('diapazon.kz', 'Диапазон', 2, ['upstream_ilek'], ['atyrau']),
  entry('zakon.kz', 'Zakon.kz', 2, ['national'], ['atyrau', 'mangystau']),
]

const registryByHost = new Map<string, DirectSourceRegistryEntry>()
for (const source of DIRECT_SOURCE_REGISTRY) {
  for (const host of source.aliases) registryByHost.set(host, source)
}

export function findDirectSource(hostname: string): DirectSourceRegistryEntry | null {
  return registryByHost.get(hostname.toLowerCase()) ?? null
}

export function directSourceRegistryHosts(): string[] {
  return [...registryByHost.keys()]
}

function entry(
  canonicalHost: string,
  publisher: string,
  tier: DirectSourceTier,
  coverage: SourceCoverageTag[],
  requestRegions: KazhydrometRegion[],
): DirectSourceRegistryEntry {
  return {
    canonicalHost,
    aliases: [canonicalHost, `www.${canonicalHost}`],
    publisher,
    tier,
    coverage,
    requestRegions,
  }
}
