import { Type } from 'class-transformer'
import { IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator'

export class OpenSourceParamsDto {
  @IsString()
  @MaxLength(256)
  @Matches(/^\S(?:.*\S)?$/)
  id!: string
}

export class OpenSourceQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number
}

