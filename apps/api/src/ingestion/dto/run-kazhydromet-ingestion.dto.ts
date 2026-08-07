import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator'

import {
  KAZHYDROMET_REGIONS,
  type KazhydrometRegion,
} from '../ingestion.types'

export class RunKazhydrometIngestionDto {
  @ApiProperty({ example: '2025-05', pattern: '^\\d{4}-(0[1-9]|1[0-2])$' })
  @Matches(/^\d{4}-(?:0[1-9]|1[0-2])$/)
  from!: string

  @ApiProperty({ example: '2025-09', pattern: '^\\d{4}-(0[1-9]|1[0-2])$' })
  @Matches(/^\d{4}-(?:0[1-9]|1[0-2])$/)
  to!: string

  @ApiProperty({ enum: KAZHYDROMET_REGIONS, isArray: true, example: ['atyrau'] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(KAZHYDROMET_REGIONS, { each: true })
  regions!: KazhydrometRegion[]

  @ApiPropertyOptional({ minimum: 1, maximum: 10, example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxDocuments?: number
}
