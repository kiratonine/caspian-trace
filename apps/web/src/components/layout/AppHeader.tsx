import { useTranslation } from "react-i18next"

import { LiveStatusIndicator } from "@/features/live-status/LiveStatusIndicator"

export function AppHeader() {
  const { t } = useTranslation()
  return (
    <header className="flex items-center gap-x-3 border-b px-4 py-2">
      {/* Логотип крупнее и плотнее названий колонок: в одном кегле с ними он
          читался как четвёртый заголовок раздела. Подписи-слогана рядом нет —
          что делает продукт, объясняют сами колонки, а на 1280×720 строка
          отнимала место у шапки. Формулировка сохранена в app.tagline
          (i18n/resources/ru.ts) для досье и метаданных. */}
      <h1 className="text-lg font-semibold tracking-[0.08em] uppercase">
        {t("app.name")}
      </h1>
      {/* Состояние источников и режим данных — свойство всего экрана,
          поэтому живут в шапке, а не в колонке (этап F6). */}
      <LiveStatusIndicator />
    </header>
  )
}
