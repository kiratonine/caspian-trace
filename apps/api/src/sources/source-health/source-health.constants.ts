export const SOURCE_HEALTH_REGISTRY = [
    {
        dbId: 'kazhydromet',
        apiId: 'kazhydromet-bulletins',
        displayName:
            'Казгидромет: ежемесячные бюллетени',
    },
    {
        dbId: 'gdelt',
        apiId: 'gdelt',
        displayName: 'GDELT DOC 2.0',
    },
    {
        dbId: 'direct-sources',
        apiId: 'direct-sources',
        displayName:
            'Прямые публичные источники',
    },
] as const

export type SourceHealthDefinition =
    (typeof SOURCE_HEALTH_REGISTRY)[number]

export type SourceHealthId =
    SourceHealthDefinition['dbId']

export function getSourceHealthDefinition(
    sourceId: SourceHealthId,
): SourceHealthDefinition {
    const source = SOURCE_HEALTH_REGISTRY.find(
        (candidate) => candidate.dbId === sourceId,
    )

    if (source === undefined) {
        throw new Error(
            `Unsupported source health ID: ${sourceId}`,
        )
    }

    return source
}