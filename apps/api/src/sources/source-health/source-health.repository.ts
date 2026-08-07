import { Injectable } from '@nestjs/common'

import { Prisma } from '../../generated/prisma/client'
import { SourceHealthStatus } from '../../generated/prisma/enums'
import { PrismaService } from '../../prisma/prisma.service'
import type { SourceHealthId } from './source-health.constants'
import type {
    SourceHealthRow,
    SourceHealthTransitionInput,
} from './source-health.types'

const sourceHealthSelect = {
    sourceId: true,
    status: true,
    lastSuccessAt: true,
    cacheAvailable: true,
} as const satisfies Prisma.SourceHealthSelect

@Injectable()
export class SourceHealthRepository {
    constructor(
        private readonly prisma: PrismaService,
    ) { }

    async startAttempt(input: {
        sourceId: SourceHealthId
        displayName: string
        at: Date
    }): Promise<void> {
        await this.prisma.sourceHealth.upsert({
            where: {
                sourceId: input.sourceId,
            },
            create: {
                sourceId: input.sourceId,
                displayName: input.displayName,
                status: SourceHealthStatus.NEVER_RUN,
                lastAttemptAt: input.at,
            },
            update: {
                displayName: input.displayName,
                lastAttemptAt: input.at,
            },
            select: {
                sourceId: true,
            },
        })
    }

    async transition(
        input: SourceHealthTransitionInput,
    ): Promise<void> {
        await this.prisma.$transaction(
            async (transaction) => {
                const current =
                    await transaction.sourceHealth.findUnique({
                        where: {
                            sourceId: input.sourceId,
                        },
                        select: {
                            metadata: true,
                            consecutiveErrors: true,
                        },
                    })

                const metadata = {
                    ...jsonObject(current?.metadata),
                    ...input.metadata,
                }

                let consecutiveErrors =
                    current?.consecutiveErrors ?? 0

                if (input.actualError) {
                    consecutiveErrors += 1
                } else if (input.success) {
                    consecutiveErrors = 0
                }

                await transaction.sourceHealth.upsert({
                    where: {
                        sourceId: input.sourceId,
                    },
                    create: {
                        sourceId: input.sourceId,
                        displayName: input.displayName,
                        status: input.status,
                        lastAttemptAt: input.at,
                        lastSuccessAt: input.success
                            ? input.at
                            : null,
                        lastHttpStatus: input.lastHttpStatus,
                        cacheAvailable: input.cacheAvailable,
                        consecutiveErrors,
                        detail: input.detail,
                        metadata,
                    },
                    update: {
                        displayName: input.displayName,
                        status: input.status,
                        lastAttemptAt: input.at,
                        ...(input.success
                            ? {
                                lastSuccessAt: input.at,
                            }
                            : {}),
                        lastHttpStatus: input.lastHttpStatus,
                        cacheAvailable: input.cacheAvailable,
                        consecutiveErrors,
                        detail: input.detail,
                        metadata,
                    },
                    select: {
                        sourceId: true,
                    },
                })
            },
        )
    }

    findAll(
        sourceIds: readonly SourceHealthId[],
    ): Promise<SourceHealthRow[]> {
        return this.prisma.sourceHealth.findMany({
            where: {
                sourceId: {
                    in: [...sourceIds],
                },
            },
            select: sourceHealthSelect,
        })
    }
}

function jsonObject(
    value: Prisma.JsonValue | undefined,
): Prisma.InputJsonObject {
    if (
        typeof value !== 'object' ||
        value === null ||
        Array.isArray(value)
    ) {
        return {}
    }

    const result: Record<
        string,
        Prisma.InputJsonValue
    > = {}

    for (const [key, item] of Object.entries(value)) {
        if (item !== null && item !== undefined) {
            result[key] = item
        }
    }

    return result
}