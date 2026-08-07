/**
 * Сохраняет данные JSON-файлом через blob: URL — без сети и без сервера,
 * поэтому «Скачать JSON» работает в офлайн-демо (критерий приёмки проекта).
 */
export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  // Загрузка стартует синхронно на click, поэтому ссылку можно освобождать
  // сразу: иначе blob висит в памяти до перезагрузки страницы.
  URL.revokeObjectURL(url)
}
