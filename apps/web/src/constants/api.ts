// Фолбэк обязателен: сборка и демо работают без .env (критерий приёмки — полный офлайн).
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '/api';

// ТЗ §12: параметр limit у GET /api/incidents, максимум 100.
export const MAX_INCIDENTS_LIMIT = 100;
