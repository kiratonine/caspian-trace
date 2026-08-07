import { useTranslation } from "react-i18next"

import type { SourceHealthItem } from "@/api/contracts"
import { SOURCE_HEALTH_META } from "@/constants/live-status"
import { useLocale } from "@/i18n/use-locale"
import { groupSourcesBySeverity, sourceDetailLine } from "./live-status-model"
import { SourceHealthMarkIcon } from "./SourceHealthMark"

// Список источников: состояние, время последнего успешного опроса и наличие
// кэша — три вещи, по которым видно, чем именно наполнен экран. Компонент
// презентационный: данные приходят пропом, дев-превью показывает им же
// состояния, которых нет в фикстуре.
//
// Источники сгруппированы по состоянию: подпись статуса, расшифровка и строка
// последнего опроса печатаются один раз на группу. В сиде все четыре источника
// в одном состоянии, и построчная печать давала восемь одинаковых строк.

type SourceStatusListProps = {
  sources: readonly SourceHealthItem[]
}

export function SourceStatusList({ sources }: SourceStatusListProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()

  if (sources.length === 0) {
    return <p className="text-muted-foreground">{t("liveStatus.empty")}</p>
  }

  return (
    <ul className="flex flex-col gap-3">
      {groupSourcesBySeverity(sources, locale, t).map((group) => {
        const meta = SOURCE_HEALTH_META[group.status]
        const label = t(`liveStatus.sourceHealth.${group.status}.label`)
        const description = t(
          `liveStatus.sourceHealth.${group.status}.description`
        )

        return (
          <li key={group.status} className="flex gap-2">
            <SourceHealthMarkIcon mark={meta.mark} className="mt-1.5" />
            <div className="min-w-0 flex-1">
              <p className="text-pretty text-muted-foreground">
                <span className="text-foreground">{label}.</span>{" "}
                {description}
              </p>
              <ul className="mt-0.5 flex flex-col">
                {group.sources.map((source) => (
                  <li key={source.id} className="text-pretty">
                    <span className="font-medium">{source.name}</span>
                    {group.sharedDetail === null && (
                      <span className="text-muted-foreground">
                        {" — "}
                        {sourceDetailLine(source, locale, t)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {group.sharedDetail !== null && (
                <p className="text-muted-foreground">{group.sharedDetail}</p>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
