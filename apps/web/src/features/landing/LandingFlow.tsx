import { useTranslation } from "react-i18next"

export function LandingFlow() {
  const { t } = useTranslation()

  const steps = [
    {
      number: "01",
      title: t("landing.flow.step1Title"),
      desc: t("landing.flow.step1Desc"),
    },
    {
      number: "02",
      title: t("landing.flow.step2Title"),
      desc: t("landing.flow.step2Desc"),
    },
    {
      number: "03",
      title: t("landing.flow.step3Title"),
      desc: t("landing.flow.step3Desc"),
    },
    {
      number: "04",
      title: t("landing.flow.step4Title"),
      desc: t("landing.flow.step4Desc"),
    },
  ]

  return (
    <div className="w-full">
      <ol className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
        {steps.map((step, idx) => (
          <li key={step.number} className="flex flex-1 flex-col">
            <div className="flex flex-1 flex-col rounded-lg border border-border bg-background p-4 shadow-xs">
              <span className="font-mono text-xs font-medium text-muted-foreground">
                {step.number}
              </span>
              <h3 className="mt-1 text-sm font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {step.desc}
              </p>
            </div>
            {idx < steps.length - 1 && (
              <div
                aria-hidden="true"
                className="py-1 text-center text-xs text-muted-foreground lg:hidden"
              >
                ↓
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
