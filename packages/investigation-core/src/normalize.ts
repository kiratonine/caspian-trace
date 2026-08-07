const UNIT_ALIASES: Readonly<Record<string, string>> = {
  'mg/dm3': 'mg/dm3',
  'mg/dm^3': 'mg/dm3',
  'мг/дм3': 'mg/dm3',
  'мг/дм³': 'mg/dm3',
  'mg/kg': 'mg/kg',
  'мг/кг': 'mg/kg',
  percent: 'percent',
  '%': 'percent',
}

export function normalizeIndicatorName(value: string): string {
  return value.trim().toLocaleLowerCase('ru-RU').replaceAll('ё', 'е').replace(/\s+/g, ' ')
}

export function normalizeUnit(value: string): string {
  const normalized = value.trim().toLocaleLowerCase('ru-RU').replace(/\s+/g, '')
  return UNIT_ALIASES[normalized] ?? normalized
}

export function normalizeMatrix(value: string): string {
  const normalized = value.trim().toLocaleLowerCase('ru-RU').replace(/\s+/g, '_')
  if (normalized === 'surface_water') return 'water'
  return normalized
}
