import { useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { Pause, Play, Square } from "lucide-react"
import { useTranslation } from "react-i18next"

import { replayScenarioQueryOptions } from "@/api/queries"
import { EvidenceLevelBadge } from "@/components/common"
import { Button } from "@/components/ui/button"
import {
  REPLAY_STEP_OFFSETS_MS,
  REPLAY_STEP_TYPE_ORDER,
  replayStepAriaLabel,
} from "@/constants/replay"
import { useSelectedIncidentDetail } from "@/hooks/use-selected-incident-detail"
import { cn } from "@/lib/utils"
import { useReplayStore } from "@/stores/replayStore"
import { describeReplayStep, useReplayFrame } from "./replay-frame"
import { useReplayPlayback, useReplayPositionMs } from "./useReplayPlayback"

// Шкала-плеер реплея (сессия 9). Маркеры стоят на реальных offsetMs сценария
// (шкала — хронология доказательств, а не прогресс-бар); до загрузки сценария
// разметка берётся из формы демо-сценария §12.
const PLACEHOLDER_STEPS = REPLAY_STEP_TYPE_ORDER.map((type, index) => ({
  id: type,
  type,
  offsetMs: REPLAY_STEP_OFFSETS_MS[index],
}))

// Крайние подписи прижаты к краям шкалы, промежуточные центрированы над маркером.
function labelAlignment(index: number, count: number) {
  if (index === 0) {
    return ""
  }
  if (index === count - 1) {
    return "-translate-x-full text-right"
  }
  return "-translate-x-1/2 text-center"
}

type DragState = {
  pointerId: number
  /** Реплей играл до захвата — после отпускания продолжаем с нового шага. */
  resume: boolean
  /** Последний применённый жестом шаг: кадр перерисуется позже, чем придёт move. */
  lastIndex: number
  /** Шаг менялся перетаскиванием: следующий click — хвост того же жеста. */
  moved: boolean
}

export function ReplayTimeline() {
  const { t } = useTranslation()
  const { selectedIncidentId } = useSelectedIncidentDetail()
  const scenarioQuery = useQuery({
    ...replayScenarioQueryOptions(selectedIncidentId ?? ""),
    enabled: selectedIncidentId !== null,
  })
  const availableScenario = scenarioQuery.data ?? null

  const activeScenario = useReplayStore((state) => state.scenario)
  const status = useReplayStore((state) => state.status)
  const start = useReplayStore((state) => state.start)
  const play = useReplayStore((state) => state.play)
  const pause = useReplayStore((state) => state.pause)
  const seekToStep = useReplayStore((state) => state.seekToStep)
  const exit = useReplayStore((state) => state.exit)

  useReplayPlayback()
  const positionMs = useReplayPositionMs()
  const frame = useReplayFrame(selectedIncidentId)

  const trackRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const suppressMarkerClickRef = useRef(false)

  // Реплей не переживает смену выбранного события: сценарий другого события
  // на экране нового — рассинхрон всех трёх колонок.
  useEffect(() => {
    if (activeScenario && activeScenario.incidentId !== selectedIncidentId) {
      exit()
    }
  }, [activeScenario, selectedIncidentId, exit])

  // Клавиатура (ТЗ: вести демо мышью на проекторе неудобно). Живое состояние
  // берётся из getState() — обработчик не пересоздаётся на каждый шаг.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return
      const target = event.target instanceof HTMLElement ? event.target : null
      if (
        target &&
        (target.isContentEditable || target.closest("input, textarea, select"))
      ) {
        return
      }
      const store = useReplayStore.getState()

      if (event.code === "Space") {
        // Фокус на кнопке или ссылке — пробел принадлежит нативной активации.
        if (target?.closest("button, a")) return
        event.preventDefault()
        if (event.repeat) return
        if (!store.scenario) {
          if (availableScenario) store.start(availableScenario)
        } else if (store.status === "playing") {
          store.pause()
        } else {
          store.play()
        }
        return
      }

      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        const delta = event.key === "ArrowRight" ? 1 : -1
        if (!store.scenario) {
          // «→» без запущенного реплея — ручной проход по шагам с начала.
          if (delta === 1 && availableScenario) {
            event.preventDefault()
            store.start(availableScenario, { autoplay: false })
          }
          return
        }
        event.preventDefault()
        store.seekToStep(store.stepIndex + delta)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [availableScenario])

  const isPlaying = frame !== null && status === "playing"
  const canReplay = availableScenario !== null || activeScenario !== null
  const playLabel = !activeScenario
    ? t("replay.playLabel")
    : status === "playing"
      ? t("replay.pauseLabel")
      : status === "finished"
        ? t("replay.restartLabel")
        : t("replay.resumeLabel")

  const steps =
    (activeScenario ?? availableScenario)?.steps ?? PLACEHOLDER_STEPS
  const totalMs = steps[steps.length - 1]?.offsetMs || 1
  const progress =
    positionMs === null ? null : Math.min(positionMs / totalMs, 1)
  const stepSummary = frame ? describeReplayStep(frame.step, t) : null

  const togglePlayback = () => {
    if (!activeScenario) {
      if (availableScenario) start(availableScenario)
      return
    }
    if (status === "playing") {
      pause()
    } else {
      play()
    }
  }

  const goToStep = (index: number) => {
    if (activeScenario) {
      seekToStep(index)
    } else if (availableScenario) {
      // Шаг выбран без запущенного реплея — старт на нём без воспроизведения:
      // ручной режим для демо.
      start(availableScenario, { stepIndex: index, autoplay: false })
    }
  }

  const handleMarkerClick = (index: number) => {
    // Клик, завершающий перетаскивание, шаг уже не меняет: иначе отпускание
    // над чужим маркером отбрасывало бы реплей назад.
    if (suppressMarkerClickRef.current) {
      suppressMarkerClickRef.current = false
      return
    }
    goToStep(index)
  }

  // Плейхед тянется по шкале с прилипанием к ближайшему шагу: между шагами
  // показывать нечего — шкала это хронология доказательств, а не прогресс-бар.
  const stepIndexFromClientX = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return null
    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)
    const positionMs = ratio * totalMs
    let nearestIndex = 0
    let nearestDistance = Number.POSITIVE_INFINITY
    steps.forEach((step, index) => {
      const distance = Math.abs(step.offsetMs - positionMs)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = index
      }
    })
    return nearestIndex
  }

  const handleTrackPointerDown = (
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    if (!canReplay || event.button !== 0) return
    const index = stepIndexFromClientX(event.clientX)
    if (index === null) return
    dragRef.current = {
      pointerId: event.pointerId,
      resume: status === "playing",
      lastIndex: index,
      moved: false,
    }
    suppressMarkerClickRef.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
    // На время жеста часы стоят: иначе таймер шага продолжал бы двигать
    // реплей под курсором и спорить с рукой.
    if (status === "playing") pause()
    goToStep(index)
  }

  const handleTrackPointerMove = (
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const index = stepIndexFromClientX(event.clientX)
    if (index === null || index === drag.lastIndex) return
    drag.lastIndex = index
    drag.moved = true
    goToStep(index)
  }

  const handleTrackPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    suppressMarkerClickRef.current = drag.moved
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    // Реплей, дотянутый до последнего шага, повтором с начала не отвечает:
    // play() на finished — это «запустить заново», а руку просили о другом.
    if (drag.resume && useReplayStore.getState().status !== "finished") {
      play()
    }
  }

  return (
    <footer
      aria-label="Шкала реплея"
      // min-w-0: как строка грида футер иначе получает минимальную ширину по
      // содержимому, и длинный текст шага растягивает весь экран вбок.
      className="flex min-w-0 items-center gap-4 border-t px-4 py-2.5"
    >
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="icon"
          disabled={!canReplay}
          onClick={togglePlayback}
          aria-label={playLabel}
          title={`${playLabel} · ${t("replay.keyboardHint")}`}
        >
          {isPlaying ? <Pause /> : <Play />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={!activeScenario}
          onClick={exit}
          aria-label={t("replay.exitLabel")}
          title={t("replay.exitLabel")}
        >
          <Square />
        </Button>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {/* Строка шага — блок с truncate, а не flex: у flex-контейнера
            минимальная ширина считается по содержимому, и длинный текст
            вывода распирал бы всю сетку экрана. */}
        <p
          className="h-5 truncate text-xs leading-5 text-muted-foreground"
          title={stepSummary ?? undefined}
        >
          {frame ? (
            <>
              <span className="font-medium text-foreground">
                {t(`replay.stepType.${frame.step.type}`)}
              </span>
              <EvidenceLevelBadge
                level={frame.evidenceLevel}
                compact
                className="mx-2 align-middle"
              />
              {stepSummary}
            </>
          ) : scenarioQuery.isError ? (
            t("replay.unavailable")
          ) : (
            t("replay.playLabel")
          )}
        </p>
        {/* touch-none: на планшете вертикальный свайп по шкале иначе уводит
            страницу, а не ведёт плейхед. */}
        <div
          ref={trackRef}
          onPointerDown={handleTrackPointerDown}
          onPointerMove={handleTrackPointerMove}
          onPointerUp={handleTrackPointerEnd}
          onPointerCancel={handleTrackPointerEnd}
          className={cn(
            "relative h-9 min-w-0 touch-none",
            canReplay && "cursor-pointer"
          )}
        >
          <div className="absolute inset-x-0 top-2.25 h-px bg-border" />
          {progress !== null && (
            <>
              <div
                className="absolute top-2.25 left-0 h-px bg-foreground"
                style={{ width: `${progress * 100}%` }}
              />
              <div
                aria-hidden
                className="absolute top-1 h-2.5 w-px -translate-x-1/2 bg-foreground"
                style={{ left: `${progress * 100}%` }}
              />
            </>
          )}
          {steps.map((step, index) => {
            const reached = frame !== null && index <= frame.stepIndex
            const isCurrent = frame !== null && index === frame.stepIndex
            const label = t(`replay.stepType.${step.type}`)
            return (
              <div
                key={step.id}
                className="absolute top-0 h-full"
                style={{ left: `${(step.offsetMs / totalMs) * 100}%` }}
              >
                <button
                  type="button"
                  disabled={!canReplay}
                  onClick={() => handleMarkerClick(index)}
                  aria-label={replayStepAriaLabel(label, t)}
                  aria-current={isCurrent ? "step" : undefined}
                  title={label}
                  className="absolute top-2.25 -translate-x-1/2 -translate-y-1/2 rounded-full p-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-default"
                >
                  <span
                    className={cn(
                      "block size-2 rounded-full bg-muted-foreground/50 transition-colors",
                      reached && "bg-foreground",
                      isCurrent && "ring-4 ring-foreground/15"
                    )}
                  />
                </button>
                {/* Подпись только у текущего шага: шесть подписей сразу давали
                    два одинаковых «Применение правила» подряд (в сценарии по
                    шагу inference на каждое правило). Названия остальных
                    доступны по наведению и скринридеру. */}
                {isCurrent && (
                  <span
                    className={cn(
                      "absolute top-5 block w-max text-[10px] leading-tight font-medium text-foreground",
                      labelAlignment(index, steps.length)
                    )}
                  >
                    {label}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </footer>
  )
}
