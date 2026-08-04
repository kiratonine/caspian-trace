import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module'
import { configureApplication } from './config/application.setup'

export async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  })
  configureApplication(app)
  app.enableShutdownHooks()

  const config = app.get(ConfigService)
  await app.listen(config.getOrThrow<number>('PORT'))
}

if (require.main === module) {
  void bootstrap().catch(() => {
    new Logger('Bootstrap').error('API bootstrap failed')
    process.exitCode = 1
  })
}
