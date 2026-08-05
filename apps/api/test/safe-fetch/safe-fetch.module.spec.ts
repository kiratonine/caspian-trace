import { ConfigModule, ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'

import { SafeFetchModule } from '../../src/common/http/safe-fetch.module'
import { SafeFetchService } from '../../src/common/http/safe-fetch/safe-fetch.service'
import { createSafeFetchConfig } from './test-environment'

describe('SafeFetchModule', () => {
  it('exports one default-scoped SafeFetchService without network at startup', async () => {
    const config = createSafeFetchConfig()
    const module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), SafeFetchModule],
    })
      .overrideProvider(ConfigService)
      .useValue(config)
      .compile()

    expect(module.get(SafeFetchService)).toBe(module.get(SafeFetchService))
    await module.close()
  })
})
