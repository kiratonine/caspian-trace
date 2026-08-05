import { timingSafeEqual } from 'node:crypto'

import type { Request } from 'express'

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class IngestionTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('INGESTION_TOKEN')
    if (expected === undefined) {
      throw new ServiceUnavailableException({
        code: 'INGESTION_NOT_CONFIGURED',
        message: 'Ingestion token is not configured',
      })
    }
    const request = context.switchToHttp().getRequest<Request>()
    if (!tokensMatch(request.header('x-ingestion-token'), expected)) {
      throw new UnauthorizedException({
        code: 'INGESTION_TOKEN_INVALID',
        message: 'A valid ingestion token is required',
      })
    }
    return true
  }
}

function tokensMatch(actual: string | undefined, expected: string): boolean {
  if (actual === undefined) return false
  const actualBytes = Buffer.from(actual)
  const expectedBytes = Buffer.from(expected)
  return (
    actualBytes.length === expectedBytes.length &&
    timingSafeEqual(actualBytes, expectedBytes)
  )
}
