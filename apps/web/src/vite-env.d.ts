/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  /** 'api' — читать NestJS, 'seed' (по умолчанию) — офлайн-данные seed-data.ts. */
  readonly VITE_DATA_MODE?: "api" | "seed"
}
