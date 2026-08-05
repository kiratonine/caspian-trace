import { Type } from 'class-transformer'
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator'
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger'
import type { EvidenceLevel, Region } from '@caspian-trace/contracts'

import type { IncidentFilters } from '../incidents.types'

const ISO_DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/

export class ListIncidentsDto {
  @ApiPropertyOptional({ enum: ['L0', 'L1', 'L2', 'L3'] })
  @IsOptional()
  @IsIn(['L0', 'L1', 'L2', 'L3'])
  status?: EvidenceLevel

  @ApiPropertyOptional({ enum: ['atyrau', 'mangystau'] })
  @IsOptional()
  @IsIn(['atyrau', 'mangystau'])
  region?: Region

  @ApiPropertyOptional({ example: '2025-01-01', format: 'date' })
  @IsOptional()
  @Matches(ISO_DATE_PATTERN)
  @IsIsoCalendarDate()
  from?: string

  @ApiPropertyOptional({ example: '2025-12-31', format: 'date' })
  @IsOptional()
  @Matches(ISO_DATE_PATTERN)
  @IsIsoCalendarDate()
  @IsOnOrAfter('from')
  to?: string

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50
}

export class InvestigationIdDto {
  @ApiProperty({ description: 'Current Investigation.id' })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  @Matches(/^\S(?:.*\S)?$/)
  id!: string
}

export function toIncidentFilters(query: ListIncidentsDto): IncidentFilters {
  return {
    status: query.status,
    region: query.region,
    generatedFrom: query.from ? startOfUtcDate(query.from) : undefined,
    generatedBefore: query.to ? nextUtcDate(query.to) : undefined,
    limit: query.limit,
  }
}

function startOfUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

function nextUtcDate(value: string): Date {
  const date = startOfUtcDate(value)
  date.setUTCDate(date.getUTCDate() + 1)
  return date
}

function IsIsoCalendarDate(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'isIsoCalendarDate',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) {
            return false
          }
          return startOfUtcDate(value).toISOString().slice(0, 10) === value
        },
      },
    })
  }
}

function IsOnOrAfter(
  relatedPropertyName: string,
  validationOptions?: ValidationOptions,
) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'isOnOrAfter',
      target: object.constructor,
      propertyName,
      constraints: [relatedPropertyName],
      options: validationOptions,
      validator: {
        validate(value: unknown, arguments_: ValidationArguments): boolean {
          if (typeof value !== 'string') return true
          const related = (arguments_.object as Record<string, unknown>)[
            relatedPropertyName
          ]
          return typeof related !== 'string' || value >= related
        },
      },
    })
  }
}
