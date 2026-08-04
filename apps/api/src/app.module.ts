import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { validatePlatformEnvironment } from './config/environment'
import { HealthModule } from './health/health.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validatePlatformEnvironment,
    }),
    HealthModule,
  ],
})
export class AppModule {}
