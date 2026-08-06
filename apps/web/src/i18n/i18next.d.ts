import type { ru } from "./resources/ru"

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation"
    resources: { translation: typeof ru }
  }
}
