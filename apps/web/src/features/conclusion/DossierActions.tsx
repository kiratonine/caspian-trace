import { useState } from "react"
import { Download } from "lucide-react"

import {
  downloadInvestigationDossier,
  type DossierFormat,
} from "@/api/exports"
import { Button } from "@/components/ui/button"

type DossierActionsProps = {
  investigationId: string
}

export function DossierActions({ investigationId }: DossierActionsProps) {
  const [activeFormat, setActiveFormat] = useState<DossierFormat | null>(null)
  const [failed, setFailed] = useState(false)

  const download = async (format: DossierFormat) => {
    setActiveFormat(format)
    setFailed(false)
    try {
      await downloadInvestigationDossier(investigationId, format)
    } catch {
      setFailed(true)
    } finally {
      setActiveFormat(null)
    }
  }

  return (
    <div className="flex items-center gap-1" aria-label="Скачать досье">
      {(["json", "html"] as const).map((format) => (
        <Button
          key={format}
          type="button"
          variant="outline"
          size="xs"
          disabled={activeFormat !== null}
          aria-label={`Скачать досье в формате ${format.toUpperCase()}`}
          onClick={() => void download(format)}
        >
          <Download aria-hidden />
          {activeFormat === format ? "…" : format.toUpperCase()}
        </Button>
      ))}
      {failed && (
        <span role="status" className="text-xs text-destructive">
          Ошибка
        </span>
      )}
    </div>
  )
}
