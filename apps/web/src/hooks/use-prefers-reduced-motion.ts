import { useSyncExternalStore } from "react"

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"

function subscribe(onStoreChange: () => void) {
  const media = window.matchMedia(REDUCED_MOTION_QUERY)
  media.addEventListener("change", onStoreChange)
  return () => media.removeEventListener("change", onStoreChange)
}

function getSnapshot() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches
}

/**
 * Системная настройка «меньше движения». Читается подпиской, а не разовой
 * проверкой: на демо тему и настройки доступности могут переключить прямо во
 * время показа, и экран обязан ответить сразу.
 *
 * Сам реплей этой настройкой не отключается — это содержание доказательства,
 * а не украшение. Гасится только непрерывное движение: плейхед перестаёт
 * ползти и переставляется по шагам (`useReplayPositionMs`), декоративные
 * переходы и анимации — в `@media (prefers-reduced-motion: reduce)` index.css.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
