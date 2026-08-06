import { AGENT_TAB_BODY, AGENT_TAB_TITLE } from "@/constants/tabs"

/**
 * Вкладка агента отложена владельцем продукта. Показываем состояние словами,
 * а не выдуманной активностью: имитация поиска была бы выдуманными данными
 * (запрет 1 CLAUDE.md), а на вопрос жюри «что он сейчас нашёл?» ответить
 * было бы нечем.
 */
export function AgentTabPlaceholder() {
  return (
    <div className="flex min-h-0 items-center justify-center p-8">
      <div className="max-w-md space-y-2 text-center">
        <h2 className="text-sm font-medium">{AGENT_TAB_TITLE}</h2>
        <p className="text-sm text-muted-foreground">{AGENT_TAB_BODY}</p>
      </div>
    </div>
  )
}
