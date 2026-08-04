import { apiDownload } from "./client"

export type DossierFormat = "json" | "html"

export async function downloadInvestigationDossier(
  id: string,
  format: DossierFormat
): Promise<void> {
  const { blob, filename } = await apiDownload(
    `/investigations/${encodeURIComponent(id)}/export`,
    { format }
  )
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = objectUrl
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
}
