import {
  DIRECT_SOURCE_REGISTRY,
  directSourceRegistryHosts,
  findDirectSource,
} from '../../../src/ingestion/direct-sources/direct-source-registry'

describe('direct source registry', () => {
  it('contains every configured Tier 1/2 exact host and alias', () => {
    expect(DIRECT_SOURCE_REGISTRY.map((source) => source.canonicalHost)).toEqual([
      'kazhydromet.kz', 'inform.kz', 'gov.kz', 'azh.kz', 'atpress.kz', 'lada.kz',
      'inaktau.kz', 'tumba.kz', 'mangystaumedia.kz', 'uralskweek.kz', 'mgorod.kz',
      'diapazon.kz', 'zakon.kz',
    ])
    expect(directSourceRegistryHosts()).toContain('www.mangystaumedia.kz')
  })

  it('uses exact lookup and rejects suffix lookalikes', () => {
    expect(findDirectSource('www.azh.kz')?.canonicalHost).toBe('azh.kz')
    expect(findDirectSource('azh.kz.evil.example')).toBeNull()
    expect(findDirectSource('news.azh.kz')).toBeNull()
  })

  it('keeps local and upstream coverage region-safe', () => {
    expect(findDirectSource('lada.kz')?.requestRegions).toEqual(['mangystau'])
    expect(findDirectSource('azh.kz')?.requestRegions).toEqual(['atyrau'])
    expect(findDirectSource('uralskweek.kz')?.requestRegions).toEqual(['atyrau'])
    expect(findDirectSource('diapazon.kz')?.coverage).toEqual(['upstream_ilek'])
  })
})
