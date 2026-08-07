import { useTranslation } from "react-i18next"

export function LandingFooter() {
  const { t } = useTranslation()

  return (
    <footer className="border-t border-border bg-background py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-5 sm:flex-row sm:px-6 lg:px-8">
        <p className="text-xs font-semibold text-foreground tracking-wider uppercase">
          {t("app.name")}
        </p>
        <p className="text-xs text-muted-foreground text-center sm:text-right">
          {t("landing.footer.tagline")}
        </p>
      </div>
    </footer>
  )
}
