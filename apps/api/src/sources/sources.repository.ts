import { Injectable } from '@nestjs/common'

import { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import {
  sourceCachePathConflict,
  sourceDocumentNotFound,
  sourceSnapshotHashConflict,
} from './sources.errors'
import type { SourceForCache, SourceForOpen } from './sources.types'

const sourceForCacheSelect = {
  id: true,
  sourceType: true,
  mediaType: true,
  publishedPeriod: true,
  fetchedAt: true,
  sha256: true,
  cachePath: true,
  httpStatus: true,
  status: true,
} as const satisfies Prisma.SourceDocumentSelect

const sourceForOpenSelect = {
  id: true,
  mediaType: true,
  sha256: true,
  cachePath: true,
  status: true,
} as const satisfies Prisma.SourceDocumentSelect

export interface AttachSnapshotInput {
  sourceDocumentId: string
  sha256: string
  cachePath: string
  fetchedAt: Date
  httpStatus: number
}

export interface AttachSnapshotResult {
  document: SourceForCache
  attached: boolean
}

@Injectable()
export class SourcesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findForCache(id: string): Promise<SourceForCache | null> {
    return this.prisma.sourceDocument.findUnique({
      where: { id },
      select: sourceForCacheSelect,
    })
  }

  findForOpen(id: string): Promise<SourceForOpen | null> {
    return this.prisma.sourceDocument.findUnique({
      where: { id },
      select: sourceForOpenSelect,
    })
  }

  attachSnapshot(input: AttachSnapshotInput): Promise<AttachSnapshotResult> {
    return this.prisma.$transaction(
      async (transaction) => {
        const current = await transaction.sourceDocument.findUnique({
          where: { id: input.sourceDocumentId },
          select: sourceForCacheSelect,
        })
        if (!current) throw sourceDocumentNotFound()
        assertImmutableSnapshot(current, input)

        if (
          current.sha256 === input.sha256 &&
          current.cachePath === input.cachePath
        ) {
          return { document: current, attached: false }
        }

        const updated = await transaction.sourceDocument.updateMany({
          where: {
            id: input.sourceDocumentId,
            sha256: current.sha256,
            cachePath: current.cachePath,
          },
          data: {
            sha256: input.sha256,
            cachePath: input.cachePath,
            fetchedAt: input.fetchedAt,
            httpStatus: input.httpStatus,
          },
        })
        if (updated.count !== 1) {
          const raced = await transaction.sourceDocument.findUnique({
            where: { id: input.sourceDocumentId },
            select: sourceForCacheSelect,
          })
          if (!raced) throw sourceDocumentNotFound()
          assertImmutableSnapshot(raced, input)
          if (
            raced.sha256 === input.sha256 &&
            raced.cachePath === input.cachePath
          ) {
            return { document: raced, attached: false }
          }
          throw sourceCachePathConflict()
        }

        const document = await transaction.sourceDocument.findUnique({
          where: { id: input.sourceDocumentId },
          select: sourceForCacheSelect,
        })
        if (!document) throw sourceDocumentNotFound()
        return { document, attached: true }
      },
      {
        maxWait: 5_000,
        timeout: 10_000,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    )
  }
}

function assertImmutableSnapshot(
  current: Pick<SourceForCache, 'sha256' | 'cachePath'>,
  expected: Pick<AttachSnapshotInput, 'sha256' | 'cachePath'>,
): void {
  if (current.sha256 !== null && current.sha256 !== expected.sha256) {
    throw sourceSnapshotHashConflict()
  }
  if (current.cachePath !== null && current.cachePath !== expected.cachePath) {
    throw sourceCachePathConflict()
  }
}

