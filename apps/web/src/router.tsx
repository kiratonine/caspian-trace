import { lazy } from "react"
import { createBrowserRouter, type RouteObject } from "react-router-dom"

import App from "@/App"
import { DOSSIER_ROUTE } from "@/constants/routing"
import { DossierPage } from "@/features/dossier/DossierPage"

// Deep-link — часть плана (решение сессии 1): выбранное расследование живёт
// в search-параметрах «/», печатное досье — отдельным маршрутом.
// Досье грузится вместе с приложением, а не lazy: на демо страница должна
// открываться мгновенно, без ожидания чанка.
const routes: RouteObject[] = [
  { path: "/", element: <App /> },
  { path: DOSSIER_ROUTE, element: <DossierPage /> },
]

// Дев-галереи. import.meta.env.DEV статически заменяется при сборке,
// поэтому в прод-бандл ни маршруты, ни чанки галерей не попадают.
if (import.meta.env.DEV) {
  const PrimitivesGallery = lazy(() => import("@/dev/PrimitivesGallery"))
  const RiverSchemeGallery = lazy(() => import("@/dev/RiverSchemeGallery"))
  const ConclusionGallery = lazy(() => import("@/dev/ConclusionGallery"))
  const FeedGallery = lazy(() => import("@/dev/FeedGallery"))
  const ComparisonGallery = lazy(() => import("@/dev/ComparisonGallery"))
  routes.push({ path: "/dev/primitives", element: <PrimitivesGallery /> })
  routes.push({ path: "/dev/river-scheme", element: <RiverSchemeGallery /> })
  routes.push({ path: "/dev/conclusion", element: <ConclusionGallery /> })
  routes.push({ path: "/dev/feed", element: <FeedGallery /> })
  routes.push({ path: "/dev/comparison", element: <ComparisonGallery /> })
}

export const router = createBrowserRouter(routes)
