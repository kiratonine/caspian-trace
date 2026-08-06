import { useSearchParams } from "react-router-dom"

import { TAB_SEARCH_PARAM } from "@/constants/routing"
import { APP_TABS, DEFAULT_TAB_ID, type AppTabId } from "@/constants/tabs"

function isAppTabId(value: string | null): value is AppTabId {
  return APP_TABS.some((tab) => tab.id === value)
}

/**
 * Выбранная вкладка — из URL, как и выбранное событие (решение сессии 1).
 * Незнакомое значение параметра молча падает на вкладку по умолчанию:
 * чужая ссылка не должна показывать пустой экран.
 */
export function useSelectedTab() {
  const [searchParams, setSearchParams] = useSearchParams()
  const raw = searchParams.get(TAB_SEARCH_PARAM)
  const tabId = isAppTabId(raw) ? raw : DEFAULT_TAB_ID

  const selectTab = (id: AppTabId) => {
    setSearchParams(
      (params) => {
        params.set(TAB_SEARCH_PARAM, id)
        return params
      },
      // Переключение вкладки — смена ракурса, а не выбор содержания: копить
      // его в истории «назад» не нужно, в отличие от выбора события (сессия 7).
      { replace: true }
    )
  }

  return { tabId, selectTab }
}
