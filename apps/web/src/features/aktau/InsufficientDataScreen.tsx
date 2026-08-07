import type { IncidentDetail } from "@/api/contracts"
import { InsufficientData } from "@/components/common"

// Экран «недостаточно данных» (ТЗ §13 «Экран Актау», §7.6) — полноценное
// состояние центральной колонки, когда у события нет ни одного створа:
// отказ от вывода показывается так же охотно, как схема показывает вывод.
//
// Заголовок события, бейдж уровня и дословный вывод отсюда убраны: все три
// печатает правая панель (выбранная карточка ленты, блоки 2 и 1), и на экране
// Актау центральная колонка дословно повторяла её целиком. За центром остался
// его собственный слой — почему схемы нет и чего для неё не хватает.
// Причины по-прежнему приходят с бэка (unknowns), экран ничего не сочиняет.

type InsufficientDataScreenProps = {
  detail: IncidentDetail
}

export function InsufficientDataScreen({
  detail,
}: InsufficientDataScreenProps) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-6">
        <InsufficientData
          reasons={detail.investigation.unknowns}
          className="w-full max-w-xl"
        />
      </div>
    </div>
  )
}
