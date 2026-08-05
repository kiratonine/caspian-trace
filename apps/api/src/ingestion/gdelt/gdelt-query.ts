import type { KazhydrometRegion } from '../ingestion.types'

export const ATYRAU_REGION_MARKERS = [
  'Атырау', 'Atyrau', 'Жайық', 'Жайык', 'Урал', 'Ural River',
] as const
export const MANGYSTAU_REGION_MARKERS = [
  'Актау', 'Aktau', 'Мангистау', 'Маңғыстау', 'Mangystau',
] as const
const SHARED_GEOGRAPHY_TERMS = ['Каспий', 'Caspian'] as const
export const ATYRAU_GEOGRAPHY_TERMS = [
  ...ATYRAU_REGION_MARKERS, ...SHARED_GEOGRAPHY_TERMS,
] as const
export const MANGYSTAU_GEOGRAPHY_TERMS = [
  ...MANGYSTAU_REGION_MARKERS, ...SHARED_GEOGRAPHY_TERMS,
] as const
export const POLLUTION_TERMS = [
  'загрязнение', 'нефтепродукты', 'нефтяная пленка', 'нефтяная плёнка',
  'зеленая вода', 'зелёная вода', 'сточные воды', 'гибель рыбы', 'разлив нефти',
  'ластану', 'мұнай', 'ағынды су', 'pollution', 'oil spill', 'oil products',
  'wastewater', 'fish kill',
] as const

export function buildGdeltQuery(input: {
  endpoint: string
  from: Date
  to: Date
  regions: readonly KazhydrometRegion[]
  maxRecords: number
}): URL {
  const geography = new Set<string>()
  for (const region of input.regions) {
    const terms = region === 'atyrau' ? ATYRAU_GEOGRAPHY_TERMS : MANGYSTAU_GEOGRAPHY_TERMS
    for (const term of terms) geography.add(term)
  }
  const url = new URL(input.endpoint)
  url.search = new URLSearchParams({
    query: `(${[...geography].join(' OR ')}) AND (${POLLUTION_TERMS.join(' OR ')})`,
    mode: 'artlist',
    format: 'json',
    maxrecords: String(Math.min(25, input.maxRecords)),
    sort: 'datedesc',
    startdatetime: gdeltUtc(input.from),
    enddatetime: gdeltUtc(input.to),
  }).toString()
  return url
}

function gdeltUtc(value: Date): string {
  return value.toISOString().replace(/[-:T]/g, '').slice(0, 14)
}
