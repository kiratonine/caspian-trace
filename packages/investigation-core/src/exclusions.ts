import { buildStationGraph, isUpstreamOf } from './station-graph'
import { findEventMaximum } from './intervals'
import type {
  EvidenceStatement,
  InvestigationInput,
  IntervalEvaluation,
} from './types'

export function buildSupportedFacts(
  input: InvestigationInput,
  intervals: readonly IntervalEvaluation[],
): EvidenceStatement[] {
  return intervals
    .filter(({ direction }) => direction === 'increase')
    .map((interval, index) => ({
      id: intervalEvidenceId('local-increase', interval),
      code: 'LOCAL_INCREASE_IN_PAIR' as const,
      kind: 'supports' as const,
      text:
        `В сопоставимом парном интервале зарегистрирован рост ${formatSigned(interval.delta)} мг/дм³; ` +
        'интервал требует проверки, но причина роста не установлена.',
      measurementIds: [interval.upstreamMeasurementId, interval.downstreamMeasurementId],
      sourceDocumentIds: interval.sourceDocumentIds,
      generatedBy: 'rule_engine' as const,
      sortOrder: index,
    }))
}

export function excludeDownstreamExplanations(
  input: InvestigationInput,
  intervals: readonly IntervalEvaluation[],
): EvidenceStatement[] {
  const statements: EvidenceStatement[] = intervals
    .filter(({ direction }) => direction === 'no_increase')
    .map((interval, index) => ({
      id: intervalEvidenceId('no-increase', interval),
      code: 'NO_LOCAL_INCREASE_IN_PAIR' as const,
      kind: 'contradicts' as const,
      text:
        `В сопоставимой паре изменение составляет ${formatSigned(interval.delta)} мг/дм³; ` +
        'эта пара не подтверждает дополнительное поступление внутри интервала в данном временном срезе.',
      measurementIds: [interval.upstreamMeasurementId, interval.downstreamMeasurementId],
      sourceDocumentIds: interval.sourceDocumentIds,
      generatedBy: 'rule_engine' as const,
      sortOrder: index,
    }))

  const maximum = findEventMaximum(input)
  if (maximum === null) return statements
  const graph = buildStationGraph(input.stationRelations, input.sourceDocuments)
  for (const candidate of [...input.candidateObjects].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    if (candidate.stationId === null) continue
    if (isUpstreamOf(maximum.stationId, candidate.stationId, graph) !== true) continue
    const sourceDocumentIds = [
      maximum.sourceDocumentId,
      ...candidate.evidenceDocumentIds,
    ]
      .filter((value, index, values) => values.indexOf(value) === index)
      .sort()
    statements.push({
      id: `evidence-maximum-upstream-${candidate.id}`,
      code: 'MAXIMUM_UPSTREAM_OF_OBJECT',
      kind: 'contradicts',
      text: `Объект для проверки «${candidate.name}» расположен ниже максимального вышележащего измерения и не объясняет этот максимум обычным переносом вниз по течению. Это не оценивает другие события или участки ниже объекта.`,
      measurementIds: [maximum.id],
      sourceDocumentIds,
      generatedBy: 'rule_engine',
      sortOrder: statements.length,
    })
  }
  return statements
}

function intervalEvidenceId(
  prefix: 'local-increase' | 'no-increase',
  interval: IntervalEvaluation,
): string {
  return [
    'evidence',
    prefix,
    interval.relationId,
    interval.upstreamMeasurementId,
    interval.downstreamMeasurementId,
  ].join('-')
}

function formatSigned(value: string): string {
  return value.startsWith('-') || value === '0' ? value.replace('.', ',') : `+${value.replace('.', ',')}`
}
