import { ApiProperty } from '@nestjs/swagger'

export class HealthLiveDto {
  @ApiProperty({ example: 'ok', enum: ['ok'] })
  status!: 'ok'

  @ApiProperty({ example: 'caspian-trace-api' })
  service!: 'caspian-trace-api'
}
