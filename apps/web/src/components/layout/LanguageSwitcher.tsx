import { Languages } from "lucide-react"
import { useTranslation } from "react-i18next"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LOCALES, LOCALE_ENDONYMS, isLocale } from "@/i18n/config"
import { useLocale } from "@/i18n/use-locale"

export function LanguageSwitcher() {
  const { t } = useTranslation()
  const { locale, setLocale } = useLocale()

  return (
    <Select
      value={locale}
      onValueChange={(value) => {
        if (isLocale(value)) setLocale(value)
      }}
    >
      {/* -my-1: кнопка выше строки заголовка, и без отрицательного отступа
          шапка перестала бы держать 41 px, а линия border-b разъехалась бы
          с колонками (решение сессии 12). */}
      <SelectTrigger
        aria-label={t("language.label")}
        className="-my-1 h-auto gap-x-1.5 border-none px-2 py-1 shadow-none"
      >
        <Languages className="size-4" aria-hidden />
        {/* SelectValue не читает JSX-детей SelectItem для подписи триггера:
            labelsRef, который они заполняют, в Base UI Select обслуживает
            только клавиатурный тайпэхед. Показ выбранного значения строится
            из проп items/itemToStringLabel на Select — их тут нет, значит
            нужен render-prop на SelectValue, иначе триггер показал бы код
            локали ("ru"), а не эндоним. */}
        <SelectValue>
          {(value: unknown) => (isLocale(value) ? LOCALE_ENDONYMS[value] : String(value))}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {LOCALES.map((item) => (
          // Эндоним, а не перевод названия языка: носитель ищет свой язык
          // написанным по-своему. lang на пункте — чтобы браузер подобрал
          // шрифт для арабского письма ещё в закрытом списке.
          <SelectItem key={item} value={item} lang={item}>
            {LOCALE_ENDONYMS[item]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
