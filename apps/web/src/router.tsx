import { lazy } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router-dom';

import App from '@/App';

// Deep-link — часть плана (решение сессии 1): выбранное расследование и месяц
// будут жить в search-параметрах «/», маршрут /dossier/:id добавится
// в сессии печатного досье.
const routes: RouteObject[] = [{ path: '/', element: <App /> }];

// Дев-галерея common-примитивов. import.meta.env.DEV статически заменяется
// при сборке, поэтому в прод-бандл ни маршрут, ни чанк галереи не попадают.
if (import.meta.env.DEV) {
  const PrimitivesGallery = lazy(() => import('@/dev/PrimitivesGallery'));
  routes.push({ path: '/dev/primitives', element: <PrimitivesGallery /> });
}

export const router = createBrowserRouter(routes);
