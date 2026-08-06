import { DEFAULT_LOCALE, isLocale, type Locale } from "./config"

export const LOCALE_STORAGE_KEY = "caspian-trace:locale"

export const LOCALE_SEARCH_PARAM = "lang"

type LocaleEnvironment = {
  search: string
  stored: string | null
  navigatorLanguages: readonly string[]
}

/**
 * Приоритет: ?lang= → localStorage → язык браузера → русский.
 *
 * Параметр URL уважается при чтении, но в адрес не дописывается: ссылку
 * с заранее выставленным языком можно отправить судье, а обычные ссылки
 * на события не обрастают вторым параметром рядом с ?incident=.
 */
export function resolveInitialLocale(env: LocaleEnvironment): Locale {
  const fromUrl = new URLSearchParams(env.search).get(LOCALE_SEARCH_PARAM)
  if (isLocale(fromUrl)) return fromUrl

  if (isLocale(env.stored)) return env.stored

  for (const language of env.navigatorLanguages) {
    // 'kk-KZ' → 'kk'. Регион игнорируем: локаль у нас одна на язык.
    const base = language.split("-")[0]?.toLowerCase()
    if (isLocale(base)) return base
  }

  return DEFAULT_LOCALE
}
