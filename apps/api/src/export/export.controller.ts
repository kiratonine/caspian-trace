import type { Response } from 'express'

import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Res,
} from '@nestjs/common'
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'

import { ExportService } from './export.service'

@ApiTags('investigation export')
@Controller('investigations')
export class ExportController {
  constructor(private readonly exporter: ExportService) {}

  @Get(':id/export')
  @ApiOperation({ summary: 'Download a reproducible investigation dossier' })
  @ApiQuery({ name: 'format', enum: ['json', 'html'] })
  async export(
    @Param('id') id: string,
    @Query('format') format: string,
    @Res() response: Response,
  ): Promise<void> {
    if (format !== 'json' && format !== 'html') {
      throw new BadRequestException({
        code: 'EXPORT_FORMAT_INVALID',
        message: 'format must be json or html',
      })
    }
    const model = await this.exporter.buildDossierModel(id)
    const body = format === 'json'
      ? this.exporter.renderJson(model)
      : this.exporter.renderHtml(model)
    response.setHeader(
      'Content-Type',
      format === 'json'
        ? 'application/json; charset=utf-8'
        : 'text/html; charset=utf-8',
    )
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeFilename(id)}.${format}"`,
    )
    if (format === 'html') {
      response.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      )
      response.setHeader('X-Content-Type-Options', 'nosniff')
    }
    response.send(body)
  }
}

function safeFilename(id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80)
  return safe.length === 0 ? 'investigation' : safe
}
