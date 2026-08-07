import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher"
import { buttonVariants } from "@/components/ui/button"
import { LANDING_ROUTE } from "@/constants/routing"

export function LandingHeader() {
  const { t } = useTranslation()

  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-6 lg:px-8">
        <Link
          to={LANDING_ROUTE}
          className="text-base font-semibold tracking-wider text-foreground uppercase hover:opacity-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {t("app.name")}
        </Link>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <Link
            to="/"
            className={buttonVariants({ variant: "default", size: "sm" })}
          >
            {t("landing.cta")}
          </Link>
        </div>
      </div>
    </header>
  )
}
