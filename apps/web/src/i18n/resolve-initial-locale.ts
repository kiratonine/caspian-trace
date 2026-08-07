import { DEFAULT_LOCALE, isLocale, type Locale } from "./config"

export const LOCALE_STORAGE_KEY = "caspian-trace:locale"

export const LOCALE_SEARCH_PARAM = "lang"

type LocaleEnvironment = {
  search: string
  stored: string | null
  navigatorLanguages: readonly string[]
}

/**
 * Приводит языковой тег к виду, сравнимому с LOCALES: нижний регистр, без
 * региона ('kk-KZ' → 'kk', 'KK' → 'kk'). Общая для всех источников —
 * ?lang=, localStorage, navigator.languages, i18n.language (см. use-locale.ts) —
 * чтобы один и тот же тег не трактовался по-разному в зависимости от того,
 * откуда он пришёл: ссылку с языком вбивают вручную и могут написать
 * заглавными буквами, а регион у нас не хранится нигде.
 */
export function normalizeLanguageTag(tag: string | null): string | null {
  if (!tag) return null
  return tag.split("-")[0]?.toLowerCase() ?? null
}

/**
 * Приоритет: ?lang= → localStorage → язык браузера → русский.
 *
 * Параметр URL уважается при чтении, но в адрес не дописывается: ссылку
 * с заранее выставленным языком можно отправить судье, а обычные ссылки
 * на события не обрастают вторым параметром рядом с ?incident=.
 */
export function resolveInitialLocale(env: LocaleEnvironment): Locale {
  const fromUrl = normalizeLanguageTag(
    new URLSearchParams(env.search).get(LOCALE_SEARCH_PARAM)
  )
  if (isLocale(fromUrl)) return fromUrl

  const fromStorage = normalizeLanguageTag(env.stored)
  if (isLocale(fromStorage)) return fromStorage

  for (const language of env.navigatorLanguages) {
    const base = normalizeLanguageTag(language)
    if (isLocale(base)) return base
  }

  return DEFAULT_LOCALE
}
