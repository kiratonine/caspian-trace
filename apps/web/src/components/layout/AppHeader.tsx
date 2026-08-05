import { LiveStatusIndicator } from "@/features/live-status/LiveStatusIndicator"
import { APP_NAME } from "@/constants/strings"

export function AppHeader() {
  return (
    <header className="flex items-center gap-x-3 border-b px-4 py-2">
      {/* Логотип крупнее и плотнее названий колонок: в одном кегле с ними он
          читался как четвёртый заголовок раздела. Подписи-слогана рядом нет —
          что делает продукт, объясняют сами колонки, а на 1280×720 строка
          отнимала место у шапки. Формулировка сохранена в APP_TAGLINE
          (constants/strings.ts) для досье и метаданных. */}
      <h1 className="text-lg font-semibold tracking-[0.08em] uppercase">
        {APP_NAME}
      </h1>
      {/* Состояние источников и режим данных — свойство всего экрана,
          поэтому живут в шапке, а не в колонке (этап F6). */}
      <LiveStatusIndicator />
    </header>
  )
}
