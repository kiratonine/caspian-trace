import { createHash, timingSafeEqual } from 'node:crypto'

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request } from 'express'

import type { PlatformEnvironment } from '../config/environment'

@Injectable()
export class IngestionTokenGuard implements CanActivate {
  private readonly expectedDigest: Buffer

  constructor(config: ConfigService<PlatformEnvironment, true>) {
    this.expectedDigest = digest(config.getOrThrow('INGESTION_TOKEN'))
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>()
    const value = request.headers['x-ingestion-token']
    const supplied = typeof value === 'string' ? value : ''
    const accepted = timingSafeEqual(this.expectedDigest, digest(supplied))
    if (!accepted || typeof value !== 'string') {
      throw new UnauthorizedException({
        code: 'INGESTION_UNAUTHORIZED',
        message: 'Invalid ingestion credentials',
      })
    }
    return true
  }
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest()
}
