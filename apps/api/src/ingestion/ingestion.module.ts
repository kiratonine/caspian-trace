import { Module } from '@nestjs/common'

import { SafeFetchModule } from '../common/http/safe-fetch.module'
import { SourcesModule } from '../sources/sources.module'
import { IngestionController } from './ingestion.controller'
import { IngestionRepository } from './ingestion.repository'
import { IngestionTokenGuard } from './ingestion-token.guard'
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
    PdfTextService,
    { provide: PDFJS_LOADER, useValue: loadPdfJs },
  ],
  exports: [KazhydrometIngestionService],
})
export class IngestionModule {}
