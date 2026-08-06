import { useMemo, useState, type ReactNode } from "react"
import { ChevronRight, FileText } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import type { IncidentDetail } from "@/api/contracts"
import { EvidenceLevelBadge } from "@/components/common"
import { buttonVariants } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { CONCLUSION_SECTIONS, type ConclusionSectionId } from "@/constants/panel"
import { dossierPath } from "@/constants/routing"
import { VerdictChange } from "@/features/comparison/VerdictChange"
import {
  projectDetailForReplay,
  useReplayFrame,
  type ReplayFrame,
} from "@/features/replay/replay-frame"
import { useSelectedIncidentDetail } from "@/hooks/use-selected-incident-detail"
import { useVerdictChange } from "@/hooks/use-verdict-change"
import { cn } from "@/lib/utils"
import type { Investigation } from "@/types"
import { SourcesList } from "./SourcesList"
import { StatementList } from "./StatementList"
import { buildPanelModel, type PanelModel } from "./panel-model"

// Порядок и нумерация секций приходят из CONCLUSION_SECTIONS (ТЗ §13, 1–6).
export function ConclusionPanel() {
  const { t } = useTranslation()
  const { selectedIncidentId, detail, isError } = useSelectedIncidentDetail()
  // Во время реплея панель показывает состояние текущего шага — селектор
  // поверх загруженных данных, без рефетча (план сессии 9).
  const frame = useReplayFrame(selectedIncidentId)
  const shownDetail = useMemo(
    () => (detail && frame ? projectDetailForReplay(detail, frame) : detail),
    [detail, frame]
  )
  // Переход между периодами одного участка (ТЗ §5, §14). Во время реплея
  // не показываем: там своя хронология, и вывод ещё не наступил.
  const verdictChange = useVerdictChange(selectedIncidentId)

  return (
    <section
      aria-label={t("a11y.panelRegion")}
      className="flex min-h-0 flex-col"
    >
      {/* py-3 и -my-1 у ссылки: линия под шапкой обязана совпасть с соседними
          колонками, а кнопка выше строки заголовка её бы опустила. */}
      <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="text-xs font-medium text-muted-foreground">
          Вывод и доказательства
        </h2>
        {/* Печатное досье — бумажная версия этой самой панели, поэтому кнопка
            стоит в её шапке (роадмап §21.3). */}
        {selectedIncidentId !== null && (
          // Это ссылка, а не кнопка: компонент Button из Base UI навесил бы
          // role="button" на <a> и сломал бы семантику (и «открыть в новой
          // вкладке»), поэтому берём только его классы.
          <Link
            to={dossierPath(selectedIncidentId)}
            title={t("dossier.openAction")}
            className={buttonVariants({
              variant: "outline",
              size: "xs",
              className: "-my-1",
            })}
          >
            <FileText />
            {t("dossier.linkLabel")}
          </Link>
        )}
      </header>
      {verdictChange && !frame && (
        <VerdictChange
          before={verdictChange.before}
          after={verdictChange.after}
          onDismiss={verdictChange.dismiss}
        />
      )}
      <ScrollArea className="min-h-0 flex-1">
        {shownDetail ? (
          <ConclusionPanelContent detail={shownDetail} replayFrame={frame} />
        ) : isError ? (
          <p className="p-4 text-sm text-muted-foreground">
            {t("app.dataLoadError")}
          </p>
        ) : (
          <PanelSkeleton />
        )}
      </ScrollArea>
    </section>
  )
}

type ConclusionPanelContentProps = {
  detail: IncidentDetail
  /** Кадр активного реплея: блоки, до которых хронология не дошла, ждут шага. */
  replayFrame?: ReplayFrame | null
}

/** Презентационная часть панели — контейнер и дев-превью отдают ей готовые данные. */
export function ConclusionPanelContent({
  detail,
  replayFrame = null,
}: ConclusionPanelContentProps) {
  const { t } = useTranslation()
  const model = useMemo(() => buildPanelModel(detail), [detail])
  // Что зритель открыл руками. `undefined` = решает автоматика, поэтому
  // раскрытый блок остаётся раскрытым и при смене события.
  const [manualOpen, setManualOpen] = useState<
    Partial<Record<ConclusionSectionId, boolean>>
  >({})

  return (
    <ol className="flex flex-col p-4">
      {CONCLUSION_SECTIONS.map((section, index) => {
        const title = t(`panel.section.${section.id}.title`)
        const body = (
          <SectionBody
            sectionId={section.id}
            investigation={detail.investigation}
            model={model}
            replayFrame={replayFrame}
          />
        )

        // Блоки 1–2 (вывод и уровень) открыты всегда: это и есть заявление
        // панели. Блоки 3–6 — обоснование, оно раскрывается по требованию.
        if (!COLLAPSIBLE_SECTIONS.has(section.id)) {
          return (
            <SectionItem key={section.id} index={index} title={title}>
              {body}
            </SectionItem>
          )
        }

        const count = sectionCount(
          section.id,
          detail.investigation,
          model,
          replayFrame
        )

        return (
          <CollapsibleSectionItem
            key={section.id}
            index={index}
            title={title}
            count={count}
            // Во время реплея блок раскрывается сам, как только в нём
            // появляется содержимое: иначе главный эффект демо — «факт
            // возник на шаге» — остался бы за закрытой строкой.
            open={
              manualOpen[section.id] ??
              (replayFrame !== null && count !== null && count > 0)
            }
            onOpenChange={(open) =>
              setManualOpen((current) => ({ ...current, [section.id]: open }))
            }
          >
            {body}
          </CollapsibleSectionItem>
        )
      })}
    </ol>
  )
}

// Свёрнутыми могут быть только блоки-обоснования; порядок и состав 1–6
// (CONCLUSION_SECTIONS) при этом не меняются — заголовки видны все.
const COLLAPSIBLE_SECTIONS = new Set<ConclusionSectionId>([
  "supportedFacts",
  "contradictedHypotheses",
  "unknowns",
  "sources",
])

/**
 * Число в заголовке свёрнутого блока: сколько внутри утверждений, пробелов
 * или документов. Во время реплея, пока правило не применено, вместо нуля
 * стоит прочерк — «ещё не наступило» и «пусто» это разные вещи.
 */
function sectionCount(
  sectionId: ConclusionSectionId,
  investigation: Investigation,
  model: PanelModel,
  replayFrame: ReplayFrame | null
): number | null {
  if (replayFrame && !replayFrame.inferenceReached && sectionId !== "sources") {
    return null
  }
  switch (sectionId) {
    case "supportedFacts":
      return model.supportedFacts.length
    case "contradictedHypotheses":
      return model.contradictedHypotheses.length
    case "unknowns":
      return investigation.unknowns.length
    case "sources":
      return model.sources.length
    default:
      return 0
  }
}

type SectionBodyProps = {
  sectionId: ConclusionSectionId
  investigation: Investigation
  model: PanelModel
  replayFrame: ReplayFrame | null
}

function SectionBody({
  sectionId,
  investigation,
  model,
  replayFrame,
}: SectionBodyProps) {
  const { t } = useTranslation()
  switch (sectionId) {
    case "conclusion": {
      if (replayFrame && !replayFrame.conclusionReached) {
        return <ReplayPendingNote />
      }
      // Во время реплея вывод — дословный текст payload шага conclusion.
      // Единственный текст панели крупнее базового: у экрана должно быть одно
      // главное, и это оно.
      return (
        <p className="text-base leading-snug text-pretty">
          {replayFrame?.conclusionText ?? investigation.conclusion}
        </p>
      )
    }
    case "evidenceLevel": {
      // Уровень на текущем шаге реплея приходит в payload шага (запрет 6:
      // фронт уровни не вычисляет — ни финальные, ни промежуточные).
      // Расшифровка §13 остаётся видимой — её несёт сам бейдж («L2 Источник
      // локализован до участка»); абзац-определение печатается в его тултипе,
      // третьей копией одного факта он на экране не нужен.
      const level = replayFrame?.evidenceLevel ?? investigation.evidenceLevel
      return <EvidenceLevelBadge level={level} />
    }
    case "supportedFacts":
      if (replayFrame && !replayFrame.inferenceReached) {
        return <ReplayPendingNote />
      }
      return (
        <StatementList
          entries={model.supportedFacts}
          emptyText={t("panel.noFacts")}
        />
      )
    case "contradictedHypotheses":
      if (replayFrame && !replayFrame.inferenceReached) {
        return <ReplayPendingNote />
      }
      return (
        <StatementList
          entries={model.contradictedHypotheses}
          emptyText={t("panel.noRejected")}
        />
      )
    case "unknowns":
      // Пробелы — часть применённого правила (§14: «L2, но не L3» объясняется
      // именно пробелом), до шага inference их показывать рано.
      if (replayFrame && !replayFrame.inferenceReached) {
        return <ReplayPendingNote />
      }
      return investigation.unknowns.length > 0 ? (
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
          {investigation.unknowns.map((unknown) => (
            <li key={unknown} className="text-pretty">
              {unknown}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t("panel.noUnknowns")}</p>
      )
    case "sources":
      return <SourcesList entries={model.sources} />
  }
}

function ReplayPendingNote() {
  const { t } = useTranslation()
  return <p className="text-sm text-muted-foreground">{t("replay.pending")}</p>
}

type SectionItemProps = {
  index: number
  title: string
  children: ReactNode
}

function SectionItem({ index, title, children }: SectionItemProps) {
  return (
    <li className="mt-4 flex flex-col gap-2 border-t pt-4 first:mt-0 first:border-t-0 first:pt-0">
      <h3 className="flex items-baseline gap-2 text-sm font-medium">
        <SectionNumber index={index} />
        {title}
      </h3>
      {children}
    </li>
  )
}

function SectionNumber({ index }: { index: number }) {
  return (
    <span className="text-xs text-muted-foreground tabular-nums">
      {index + 1}
    </span>
  )
}

type CollapsibleSectionItemProps = SectionItemProps & {
  /** Сколько единиц внутри; null — реплей до шага применения правила. */
  count: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Блок-обоснование: заголовок с номером и количеством виден всегда, содержимое
 * раскрывается по требованию. Свернуть — не то же самое, что скрыть: состав
 * панели (ТЗ §13, порядок 1–6) читается по заголовкам, а «Что не подтверждается
 * · 2» говорит зрителю не меньше, чем два абзаца, — но не занимает экран.
 */
function CollapsibleSectionItem({
  index,
  title,
  count,
  open,
  onOpenChange,
  children,
}: CollapsibleSectionItemProps) {
  return (
    <li className="mt-4 border-t pt-4">
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <CollapsibleTrigger className="flex w-full items-baseline gap-2 text-left text-sm font-medium hover:text-muted-foreground">
          <SectionNumber index={index} />
          <span className="flex-1">{title}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {count ?? "—"}
          </span>
          <ChevronRight
            aria-hidden
            className={cn(
              "size-3.5 shrink-0 self-center text-muted-foreground transition-transform",
              open && "rotate-90"
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">{children}</CollapsibleContent>
      </Collapsible>
    </li>
  )
}

function PanelSkeleton() {
  const { t } = useTranslation()
  return (
    <ol className="flex flex-col p-4">
      {CONCLUSION_SECTIONS.map((section, index) => (
        <SectionItem
          key={section.id}
          index={index}
          title={t(`panel.section.${section.id}.title`)}
        >
          <div aria-hidden className="flex flex-col gap-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </SectionItem>
      ))}
    </ol>
  )
}
