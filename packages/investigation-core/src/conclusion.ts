import type { InvestigationInput, InvestigationResult } from './types'

const FORBIDDEN_PATTERNS = [
  /\bвинов(?:ен|на|ны|ато)\b/iu,
  /\bнарушител/iu,
  /(?<!не\s)источник установлен/iu,
  /доказано,? что предприятие/iu,
  /объект не причастен/iu,
] as const

export function buildConclusion(
  input: InvestigationInput,
  result: Omit<InvestigationResult, 'conclusion' | 'inputHash' | 'rulesetVersion'>,
): string {
  let conclusion: string
  if (result.evidenceLevel === 'L3') {
    conclusion =
      'Источник не установлен. В сопоставимом парном интервале зарегистрирован рост; интервал требует проверки как возможная зона дополнительного поступления.'
  } else if (result.evidenceLevel === 'L2' && result.corridorBounds?.upstreamStationId === null) {
    const station = input.stations.find(({ id }) => id === result.corridorBounds?.downstreamStationId)
    conclusion = `Источник не установлен. Доступные факты не поддерживают локальную версию ниже максимума; поиск следует продолжать выше створа «${station?.name ?? result.corridorBounds.downstreamStationId}».`
  } else if (result.evidenceLevel === 'L1') {
    conclusion =
      'Событие подтверждено источниками, но имеющихся пространственных данных недостаточно для локализации источника.'
  } else {
    conclusion = 'Источник не локализован: имеющихся данных недостаточно для пространственного вывода.'
  }
  assertConclusionIsAllowed(conclusion)
  return conclusion
}

export function assertConclusionIsAllowed(conclusion: string): void {
  const forbidden = FORBIDDEN_PATTERNS.find((pattern) => pattern.test(conclusion))
  if (forbidden !== undefined) throw new Error(`Forbidden conclusion wording: ${forbidden.source}`)
}
