import {
  ArgumentsHost,
  Catch,
  HttpException,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common'
import type { Response } from 'express'

import type { RequestWithId } from './request-with-id'

type ErrorBody = {
  code?: unknown
  error?: unknown
  message?: unknown
}

type HttpErrorLike = {
  status?: unknown
  statusCode?: unknown
  type?: unknown
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp()
    const request = context.getRequest<RequestWithId>()
    const response = context.getResponse<Response>()
    const status = this.getStatus(exception)

    const body =
      exception instanceof HttpException ? exception.getResponse() : undefined
    const normalized = this.normalize(status, body, exception)

    if (status >= 500) {
      this.logger.error(
        `Request failed: ${request.method} ${request.path} (${status})`,
      )
    }

    response.status(status).json({
      ...normalized,
      requestId: request.requestId ?? 'request-id-unavailable',
    })
  }

  private normalize(
    status: number,
    body: string | object | undefined,
    exception: unknown,
  ): { code: string; message: string } {
    const errorBody: ErrorBody =
      typeof body === 'object' && body !== null ? body : {}
    const customError = this.getCustomError(errorBody)
    if (customError !== null) return customError

    if (this.hasErrorType(exception, 'entity.parse.failed')) {
      return { code: 'MALFORMED_JSON', message: 'Malformed JSON body' }
    }

    if (this.hasErrorType(exception, 'entity.too.large') || status === 413) {
      return { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' }
    }

    if (
      status === 404 &&
      errorBody.error === 'Not Found' &&
      typeof errorBody.message === 'string' &&
      /^Cannot [A-Z]+ \/\S*/.test(errorBody.message)
    ) {
      return { code: 'ROUTE_NOT_FOUND', message: 'Route not found' }
    }

    if (status >= 500) {
      return { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' }
    }

    const message =
      typeof errorBody.message === 'string'
        ? errorBody.message
        : typeof body === 'string'
          ? body
          : 'Request failed'

    return { code: `HTTP_${status}`, message }
  }

  private getCustomError(
    body: ErrorBody,
  ): { code: string; message: string } | null {
    if (
      typeof body.code !== 'string' ||
      !/^[A-Z][A-Z0-9_]*$/.test(body.code) ||
      typeof body.message !== 'string' ||
      body.message.trim().length === 0
    ) {
      return null
    }

    return { code: body.code, message: body.message }
  }

  private getStatus(exception: unknown): number {
    if (exception instanceof HttpException) return exception.getStatus()
    if (typeof exception !== 'object' || exception === null) return 500

    const candidate = exception as HttpErrorLike
    for (const value of [candidate.status, candidate.statusCode]) {
      if (typeof value === 'number' && Number.isInteger(value)) {
        if (value >= 400 && value <= 599) return value
      }
    }
    return 500
  }

  private hasErrorType(exception: unknown, expected: string): boolean {
    return (
      typeof exception === 'object' &&
      exception !== null &&
      (exception as HttpErrorLike).type === expected
    )
  }
}
