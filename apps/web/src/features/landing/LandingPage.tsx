import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { buttonVariants } from "@/components/ui/button"
import { LandingFlow } from "./LandingFlow"
import { LandingFooter } from "./LandingFooter"
import { LandingHeader } from "./LandingHeader"
import { useLandingMeta } from "./landing-meta"

export function LandingPage() {
  const { t } = useTranslation()
  useLandingMeta()

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <LandingHeader />

      <main className="flex-1">
        {/* Section 2: Hero */}
        <section className="border-b border-border py-12 sm:py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-center">
              <div className="max-w-2xl lg:col-span-7">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t("landing.eyebrow")}
                </span>
                <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl leading-[1.15]">
                  {t("landing.title")}
                </h1>
                <p className="mt-4 text-base text-muted-foreground leading-relaxed">
                  {t("landing.description")}
                </p>
                <div className="mt-8 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4">
                  <Link
                    to="/"
                    className={buttonVariants({ variant: "default", size: "lg" })}
                  >
                    {t("landing.cta")}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {t("landing.ctaHint")}
                  </span>
                </div>
              </div>
              <div className="lg:col-span-5">
                <LandingFlow />
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Problem */}
        <section className="border-b border-border py-12 sm:py-16">
          <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {t("landing.problem.title")}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("landing.problem.description")}
              </p>
            </div>
            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="border-t border-border pt-4">
                <span className="font-mono text-xs font-medium text-muted-foreground">01</span>
                <h3 className="mt-1 text-sm font-semibold text-foreground">
                  {t("landing.problem.item1Title")}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {t("landing.problem.item1Desc")}
                </p>
              </div>
              <div className="border-t border-border pt-4">
                <span className="font-mono text-xs font-medium text-muted-foreground">02</span>
                <h3 className="mt-1 text-sm font-semibold text-foreground">
                  {t("landing.problem.item2Title")}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {t("landing.problem.item2Desc")}
                </p>
              </div>
              <div className="border-t border-border pt-4">
                <span className="font-mono text-xs font-medium text-muted-foreground">03</span>
                <h3 className="mt-1 text-sm font-semibold text-foreground">
                  {t("landing.problem.item3Title")}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {t("landing.problem.item3Desc")}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Solution */}
        <section className="border-b border-border py-12 sm:py-16">
          <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {t("landing.solution.title")}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("landing.solution.description")}
              </p>
            </div>
            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="border-t border-border pt-4">
                <h3 className="text-sm font-semibold text-foreground">
                  {t("landing.solution.step1Title")}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {t("landing.solution.step1Desc")}
                </p>
              </div>
              <div className="border-t border-border pt-4">
                <h3 className="text-sm font-semibold text-foreground">
                  {t("landing.solution.step2Title")}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {t("landing.solution.step2Desc")}
                </p>
              </div>
              <div className="border-t border-border pt-4">
                <h3 className="text-sm font-semibold text-foreground">
                  {t("landing.solution.step3Title")}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {t("landing.solution.step3Desc")}
                </p>
              </div>
            </div>

            <div className="mt-8 rounded-none border-l-2 border-primary bg-background py-3 pl-4 pr-2">
              <p className="text-xs sm:text-sm text-foreground">
                {t("landing.solution.disclaimer")}
              </p>
            </div>
          </div>
        </section>

        {/* Section 5: Final CTA */}
        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {t("landing.finalCta.title")}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("landing.finalCta.description")}
              </p>
              <div className="mt-6 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4">
                <Link
                  to="/"
                  className={buttonVariants({ variant: "default", size: "lg" })}
                >
                  {t("landing.cta")}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {t("landing.finalCta.caption")}
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  )
}
