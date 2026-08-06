import { useTranslation } from "react-i18next"

// Справочники unit/matrix/phenomenon переводят известные значения контракта;
// unit, matrix и phenomenon — свободные строки на границе API (роадмап §7,
// ТЗ §8), поэтому незнакомое значение показывается как есть — `undefined`
// на экране хуже сырого кода.

export function useUnitLabel(): (unit: string) => string {
  const { t } = useTranslation()
  return (unit) => t(`units.${unit}`, { defaultValue: unit })
}

export function useMatrixLabel(): (matrix: string) => string {
  const { t } = useTranslation()
  return (matrix) => t(`matrix.${matrix}`, { defaultValue: matrix })
}

export function usePhenomenonLabel(): (phenomenon: string) => string {
  const { t } = useTranslation()
  return (phenomenon) => t(`phenomena.${phenomenon}`, { defaultValue: phenomenon })
}
