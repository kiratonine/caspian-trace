import { ApiProperty } from '@nestjs/swagger'

export class HealthReadyDto {
  @ApiProperty({ example: 'ok', enum: ['ok'] })
  status!: 'ok'

  @ApiProperty({ example: 'caspian-trace-api' })
  service!: 'caspian-trace-api'

  @ApiProperty({ example: 'ready', enum: ['ready'] })
  database!: 'ready'
}
