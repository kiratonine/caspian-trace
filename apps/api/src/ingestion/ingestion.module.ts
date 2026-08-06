import { Module } from '@nestjs/common'

import { SafeFetchModule } from '../common/http/safe-fetch.module'
import { SourcesModule } from '../sources/sources.module'
import { IngestionController } from './ingestion.controller'
import { IngestionRepository } from './ingestion.repository'
import { IngestionTokenGuard } from './ingestion-token.guard'
import { INGESTION_CLOCK, systemIngestionClock } from './ingestion.constants'
import { ArticleIngestionService } from './article/article-ingestion.service'
import { ArticleTextService } from './article/article-text.service'
import { DirectSourceAdapter } from './direct-sources/direct-source.adapter'
import { DirectSourceService } from './direct-sources/direct-source.service'
import { GdeltAdapter } from './gdelt/gdelt.adapter'
import { GdeltIngestionService } from './gdelt/gdelt-ingestion.service'
import { KazhydrometAdapter } from './kazhydromet/kazhydromet.adapter'
import { KazhydrometIngestionService } from './kazhydromet/kazhydromet-ingestion.service'
import { PDFJS_LOADER, PdfTextService, loadPdfJs } from './kazhydromet/pdf-text.service'

@Module({
  imports: [SafeFetchModule, SourcesModule],
  controllers: [IngestionController],
  providers: [
    IngestionTokenGuard,
    IngestionRepository,
    KazhydrometAdapter,
    KazhydrometIngestionService,
    ArticleTextService,
    ArticleIngestionService,
    DirectSourceAdapter,
    DirectSourceService,
    GdeltAdapter,
    GdeltIngestionService,
    { provide: INGESTION_CLOCK, useValue: systemIngestionClock },
    PdfTextService,
    { provide: PDFJS_LOADER, useValue: loadPdfJs },
  ],
  exports: [
    IngestionTokenGuard,
    KazhydrometIngestionService,
    GdeltIngestionService,
  ],
})
export class IngestionModule {}
