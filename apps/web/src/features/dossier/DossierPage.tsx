import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { ArrowLeft, Download, Printer } from "lucide-react"
import { Link, useParams } from "react-router-dom"

import { fetchDossierJson } from "@/api/export"
import {
  incidentDetailQueryOptions,
  incidentsQueryOptions,
} from "@/api/queries"
import { Button, buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DOSSIER_BACK_ACTION,
  DOSSIER_JSON_ACTION,
  DOSSIER_JSON_ERROR,
  DOSSIER_KICKER,
  DOSSIER_PRINT_ACTION,
} from "@/constants/dossier"
import { DOSSIER_ID_PARAM, incidentPath } from "@/constants/routing"
import { DATA_LOAD_ERROR } from "@/constants/strings"
import { downloadJson } from "@/lib/download"
import { DossierDocument } from "./DossierDocument"

/**
 * Печатное досье (роадмап §21.3): маршрут `/dossier/:id`, системная печать
 * браузера и выгрузка JSON. Страница рисуется из тех же данных, что экран
 * (решение сессии 1), поэтому работает офлайн и не ждёт серверный экспорт.
 */
export function DossierPage() {
  const params = useParams()
  const incidentId = params[DOSSIER_ID_PARAM] ?? ""
  const detailQuery = useQuery(incidentDetailQueryOptions(incidentId))
  // Период события живёт в списковом ответе (провизорное поле контракта):
  // список уже в кэше после главного экрана, при прямом открытии досье
  // по ссылке подгрузится один раз.
  const incidentsQuery = useQuery(incidentsQueryOptions)
  const period =
    incidentsQuery.data?.find((incident) => incident.id === incidentId)
      ?.period ?? null
  // Момент открытия страницы: пересчёт на каждый рендер менял бы дату
  // в шапке при любом клике.
  const [generatedAt] = useState(() => new Date().toISOString())

  const download = useMutation({
    mutationFn: () => fetchDossierJson(incidentId),
    onSuccess: (data) => downloadJson(`dossier-${incidentId}.json`, data),
  })

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8 print:max-w-none print:gap-4 print:px-0 print:py-0">
      <nav className="flex flex-wrap items-center gap-2 print:hidden">
        {/* Возврат — ссылка: у Base UI Button на <a> появляется role="button",
            и «открыть в новой вкладке» перестаёт читаться. */}
        <Link
          to={incidentPath(incidentId)}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <ArrowLeft />
          {DOSSIER_BACK_ACTION}
        </Link>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer />
            {DOSSIER_PRINT_ACTION}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={download.isPending}
            onClick={() => download.mutate()}
          >
            <Download />
            {DOSSIER_JSON_ACTION}
          </Button>
        </div>
      </nav>
      {download.isError && (
        <p role="alert" className="text-sm text-destructive print:hidden">
          {DOSSIER_JSON_ERROR}
        </p>
      )}
      {detailQuery.data ? (
        <>
          {/* React 19 поднимает title в head: во врезке печати браузер
              подписывает лист именно им. */}
          <title>{`${DOSSIER_KICKER} — ${detailQuery.data.investigation.title}`}</title>
          <DossierDocument
            detail={detailQuery.data}
            period={period}
            generatedAt={generatedAt}
          />
        </>
      ) : detailQuery.isError ? (
        <p className="text-sm text-muted-foreground">{DATA_LOAD_ERROR}</p>
      ) : (
        <DossierSkeleton />
      )}
    </div>
  )
}

function DossierSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-16 w-full" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  )
}
