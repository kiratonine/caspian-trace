import {
  BadRequestException,
  PayloadTooLargeException,
  ValidationPipe,
  type INestApplication,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger'
import { json, type NextFunction, type Request, type Response } from 'express'

import { HttpExceptionFilter } from '../common/http/http-exception.filter'
import { requestIdMiddleware } from '../common/http/request-id.middleware'

export function configureApplication(app: INestApplication): OpenAPIObject {
  const config = app.get(ConfigService)
  const apiPrefix = config.getOrThrow<string>('API_PREFIX')
  const webOrigin = config.getOrThrow<string>('WEB_ORIGIN')
  const bodyLimit = config.getOrThrow<string>('HTTP_BODY_LIMIT')

  const jsonParser = json({ limit: bodyLimit })
  app.use(requestIdMiddleware)
  app.use((request: Request, response: Response, next: NextFunction): void => {
    jsonParser(request, response, (error?: unknown): void => {
      if (hasBodyParserType(error, 'entity.parse.failed')) {
        next(
          new BadRequestException({
            code: 'MALFORMED_JSON',
            message: 'Malformed JSON body',
          }),
        )
        return
      }
      if (hasBodyParserType(error, 'entity.too.large')) {
        next(
          new PayloadTooLargeException({
            code: 'PAYLOAD_TOO_LARGE',
            message: 'Request body is too large',
          }),
        )
        return
      }
      next(error)
    })
  })
  app.setGlobalPrefix(apiPrefix)
  app.enableCors({
    origin: webOrigin,
    methods: ['GET', 'POST', 'OPTIONS'],
    exposedHeaders: ['Content-Disposition', 'X-Request-Id'],
  })
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (): BadRequestException =>
        new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
        }),
    }),
  )
  app.useGlobalFilters(new HttpExceptionFilter())

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Caspian Trace API')
    .setVersion('1.0')
    .build()
  const document = SwaggerModule.createDocument(app, swaggerConfig)
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document)

  return document
}

function hasBodyParserType(error: unknown, expected: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === expected
  )
}
