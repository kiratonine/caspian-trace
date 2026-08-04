import { createBrowserRouter } from 'react-router-dom';

import App from '@/App';

// Deep-link — часть плана (решение сессии 1): выбранное расследование и месяц
// будут жить в search-параметрах «/», маршрут /dossier/:id добавится
// в сессии печатного досье.
export const router = createBrowserRouter([{ path: '/', element: <App /> }]);
