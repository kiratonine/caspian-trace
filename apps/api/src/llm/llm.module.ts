import { Module } from '@nestjs/common'

import { DisabledLlmProvider } from './disabled-llm.provider'
import { GeminiLlmProvider } from './gemini-llm.provider'
import { LLM_PROVIDER } from './llm-provider'
import { LlmService } from './llm.service'

@Module({
  providers: [
    DisabledLlmProvider,
    GeminiLlmProvider,
    {
      provide: LLM_PROVIDER,
      inject: [DisabledLlmProvider, GeminiLlmProvider],
      useFactory: (
        disabled: DisabledLlmProvider,
        gemini: GeminiLlmProvider,
      ): DisabledLlmProvider | GeminiLlmProvider =>
        process.env.LLM_PROVIDER === 'gemini' ? gemini : disabled,
    },
    LlmService,
  ],
  exports: [LlmService],
})
export class LlmModule {}
