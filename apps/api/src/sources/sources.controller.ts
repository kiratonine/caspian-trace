import {
  Controller,
  Get,
  HttpStatus,
  Param,
  Query,
  Res,
} from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger'
import type { Response } from 'express'

import { OpenSourceParamsDto, OpenSourceQueryDto } from './dto/open-source.dto'
import { SourcesService } from './sources.service'

@ApiTags('source-documents')
@Controller('source-documents')
export class SourcesController {
  constructor(private readonly sourcesService: SourcesService) {}

  @Get(':id/open')
  @ApiOperation({ summary: 'Open an immutable cached source snapshot' })
  @ApiParam({ name: 'id', description: 'SourceDocument.id' })
  @ApiQuery({ name: 'page', required: false, type: Number, minimum: 1 })
  @ApiResponse({
    status: HttpStatus.FOUND,
    description: 'Redirect to a short-lived private signed URL',
  })
  @ApiBadRequestResponse({ description: 'Invalid page or unsupported page target' })
  @ApiNotFoundResponse({ description: 'Document or cached snapshot not found' })
  @ApiInternalServerErrorResponse({ description: 'Stored source data is invalid' })
  @ApiServiceUnavailableResponse({ description: 'Source storage unavailable' })
  async open(
    @Param() params: OpenSourceParamsDto,
    @Query() query: OpenSourceQueryDto,
    @Res() response: Response,
  ): Promise<void> {
    const result = await this.sourcesService.openSource(params.id, query.page)
    response.setHeader('Cache-Control', 'private, no-store')
    response.setHeader('Referrer-Policy', 'no-referrer')
    response.redirect(HttpStatus.FOUND, result.location)
  }
}

