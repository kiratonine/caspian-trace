import { useTranslation } from "react-i18next"

import { LiveStatusIndicator } from "@/features/live-status/LiveStatusIndicator"
import { LanguageSwitcher } from "./LanguageSwitcher"

export function AppHeader() {
  const { t } = useTranslation()
  return (
    <header className="flex items-center gap-x-3 border-b px-4 py-1.5">
      {/* py-1.5, а не py-2: высоту строки задаёт h1 (text-lg → line-height
          28px), переключатель языка тут ни при чём — его -my-1 на высоту
          строки не влияет, потому что h1 всё равно выше. С py-2 шапка была
          45 px против 41 px у трёх колонок (Task 4, самопроверка при
          добавлении переключателя); четыре лишних пикселя нашлись в паддинге
          самой шапки, а не в триггере. */}
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
      <div className="ml-auto">
        <LanguageSwitcher />
      </div>
    </header>
  )
}
