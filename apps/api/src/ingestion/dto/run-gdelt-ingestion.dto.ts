import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsISO8601,
  IsOptional, Max, Min,
  Matches,
} from 'class-validator'

import { KAZHYDROMET_REGIONS, type KazhydrometRegion } from '../ingestion.types'

export class RunGdeltIngestionDto {
  @ApiProperty({ example: '2025-09-01T00:00:00Z' })
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/)
  from!: string

  @ApiProperty({ example: '2025-09-30T23:59:59Z' })
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/)
  to!: string

  @ApiProperty({ enum: KAZHYDROMET_REGIONS, isArray: true, example: ['atyrau'] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(KAZHYDROMET_REGIONS, { each: true })
  regions!: KazhydrometRegion[]

  @ApiPropertyOptional({ minimum: 1, maximum: 25, default: 25 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(25)
  maxRecords?: number

  @ApiPropertyOptional({ minimum: 1, maximum: 10, default: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxArticles?: number

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  includeDirectFallback?: boolean
}
