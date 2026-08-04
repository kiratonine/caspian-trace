// Ключи — значения полей API, поэтому написание как в API, а не camelCase.
// В контракте (роадмап §7) `unit` и `matrix` — свободные строки: справочник
// переводит известные значения, всё остальное показываем как есть.
// Пустой справочник вернул бы `undefined` на экран — это хуже сырой строки.

export const UNIT_LABELS: Record<string, string> = {
  "mg/dm3": "мг/дм³",
  "mg/kg": "мг/кг",
  percent: "%",
}

export const MATRIX_LABELS: Record<string, string> = {
  water: "вода",
  // Значение по умолчанию в схеме БД бэка (роадмап §6.3) — то же, что «вода»,
  // но написание другое; оба ведут к одной подписи.
  surface_water: "поверхностная вода",
  sediment: "донные отложения",
}

export function unitLabel(unit: string): string {
  return UNIT_LABELS[unit] ?? unit
}

export function matrixLabel(matrix: string): string {
  return MATRIX_LABELS[matrix] ?? matrix
}
