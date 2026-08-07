import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'

import { SOURCE_STORAGE } from '../../src/sources/storage/storage.constants'
import { SupabaseStorageService } from '../../src/sources/storage/supabase-storage.service'

describe('source Storage provider lifecycle', () => {
  it('binds the port token to one singleton SDK adapter instance', async () => {
    const module = await Test.createTestingModule({
      providers: [
        SupabaseStorageService,
        { provide: SOURCE_STORAGE, useExisting: SupabaseStorageService },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              if (key === 'SUPABASE_URL') return 'https://project.supabase.co'
              if (key === 'SUPABASE_SERVICE_ROLE_KEY') return 'test-server-key'
              return 'source-documents'
            }),
          },
        },
      ],
    }).compile()

    const concrete = module.get(SupabaseStorageService)
    expect(module.get(SOURCE_STORAGE)).toBe(concrete)
    expect(module.get(SupabaseStorageService)).toBe(concrete)
    await module.close()
  })
})

