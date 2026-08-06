import { APP_TABS, type AppTabId } from "@/constants/tabs"
import { cn } from "@/lib/utils"

type TabBarProps = {
  tabId: AppTabId
  onSelect: (id: AppTabId) => void
}

/**
 * Кнопки, а не ссылки: переключение меняет один search-параметр и делает это
 * replace-навигацией, то есть переходом по документу не является.
 */
export function TabBar({ tabId, onSelect }: TabBarProps) {
  return (
    <nav aria-label="Разделы" className="flex gap-1 border-b px-4">
      {APP_TABS.map((tab) => {
        const isActive = tab.id === tabId
        return (
          <button
            key={tab.id}
            type="button"
            aria-current={isActive ? "page" : undefined}
            onClick={() => onSelect(tab.id)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-xs font-medium transition-colors",
              isActive
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </nav>
  )
}
