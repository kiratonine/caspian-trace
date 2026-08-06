import { Module } from '@nestjs/common'

import { DisabledLlmProvider } from './disabled-llm.provider'
import { LLM_PROVIDER } from './llm-provider'
import { LlmService } from './llm.service'

@Module({
  providers: [
    DisabledLlmProvider,
    {
      provide: LLM_PROVIDER,
      useExisting: DisabledLlmProvider,
    },
    LlmService,
  ],
  exports: [LlmService],
})
export class LlmModule {}
