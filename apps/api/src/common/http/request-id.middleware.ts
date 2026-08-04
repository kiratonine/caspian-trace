import { randomUUID } from 'node:crypto'

import type { NextFunction, Response } from 'express'

import type { RequestWithId } from './request-with-id'

const VALID_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

export function isValidRequestId(value: string): boolean {
  return VALID_REQUEST_ID.test(value)
}

export function requestIdMiddleware(
  request: RequestWithId,
  response: Response,
  next: NextFunction,
): void {
  const forwarded = request.get('x-request-id')?.trim()
  const requestId =
    forwarded !== undefined && isValidRequestId(forwarded)
      ? forwarded
      : randomUUID()

  request.requestId = requestId
  response.setHeader('x-request-id', requestId)
  next()
}
