import { useEffect } from "react"
import { useTranslation } from "react-i18next"

export function useLandingMeta() {
  const { t } = useTranslation()

  useEffect(() => {
    const originalTitle = document.title
    let metaDescription = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    let createdMeta = false

    if (!metaDescription) {
      metaDescription = document.createElement("meta")
      metaDescription.name = "description"
      document.head.appendChild(metaDescription)
      createdMeta = true
    }

    const originalDescription = metaDescription.getAttribute("content") ?? ""

    const newTitle = t("landing.metaTitle")
    const newDescription = t("landing.metaDescription")

    document.title = newTitle
    metaDescription.setAttribute("content", newDescription)

    return () => {
      document.title = originalTitle
      if (createdMeta && metaDescription.parentNode) {
        metaDescription.parentNode.removeChild(metaDescription)
      } else {
        metaDescription.setAttribute("content", originalDescription)
      }
    }
  }, [t])
}
