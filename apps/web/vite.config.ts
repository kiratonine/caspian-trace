import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// Порт и префикс — из apps/api/.env.example (PORT=3000, API_PREFIX=api).
// Прокси избавляет от CORS в разработке; в проде фронт и API стоят за одним
// адресом, поэтому базовый путь остаётся относительным '/api'.
const API_DEV_TARGET = "http://localhost:3000"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  optimizeDeps: {
    // `@caspian-trace/contracts` собирается в CommonJS (tsconfig пакета, зона
    // Full-stack 1). Линкованный workspace-пакет Vite по умолчанию не
    // предбандливает и отдаёт как есть — в dev именованные импорты из CJS
    // тогда не резолвятся («does not provide an export named ...»).
    // Прод-сборка справляется сама, поэтому расхождение вылезает только в dev.
    include: ["@caspian-trace/contracts"],
    // MapLibre парсит GeoJSON в Web Worker и до его ответа держит источник
    // незагруженным: слои не рисуются вовсе, хотя DOM-маркеры видны и ошибок
    // в консоли нет. Оптимизатор зависимостей Vite не переносит его воркер
    // (`maplibre-gl-worker.mjs` не оказывается в .vite/deps), поэтому пакет
    // отдаётся как есть — это же предлагает и само сообщение Vite.
    exclude: ["maplibre-gl"],
  },
  // Воркер MapLibre — ES-модуль; формат воркеров у Vite по умолчанию 'iife'.
  worker: {
    format: "es",
  },
  server: {
    proxy: {
      "/api": { target: API_DEV_TARGET, changeOrigin: true },
    },
  },
})
