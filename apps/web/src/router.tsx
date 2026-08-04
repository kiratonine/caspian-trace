import { lazy } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router-dom';

import App from '@/App';

// Deep-link — часть плана (решение сессии 1): выбранное расследование и месяц
// будут жить в search-параметрах «/», маршрут /dossier/:id добавится
// в сессии печатного досье.
const routes: RouteObject[] = [{ path: '/', element: <App /> }];

// Дев-галереи. import.meta.env.DEV статически заменяется при сборке,
// поэтому в прод-бандл ни маршруты, ни чанки галерей не попадают.
if (import.meta.env.DEV) {
  const PrimitivesGallery = lazy(() => import('@/dev/PrimitivesGallery'));
  const RiverSchemeGallery = lazy(() => import('@/dev/RiverSchemeGallery'));
  const ConclusionGallery = lazy(() => import('@/dev/ConclusionGallery'));
  const FeedGallery = lazy(() => import('@/dev/FeedGallery'));
  routes.push({ path: '/dev/primitives', element: <PrimitivesGallery /> });
  routes.push({ path: '/dev/river-scheme', element: <RiverSchemeGallery /> });
  routes.push({ path: '/dev/conclusion', element: <ConclusionGallery /> });
  routes.push({ path: '/dev/feed', element: <FeedGallery /> });
}

export const router = createBrowserRouter(routes);
