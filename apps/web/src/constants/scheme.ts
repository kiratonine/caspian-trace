// Подписи линейной схемы реки (ТЗ §13; §17 — до подтверждения координат
// только линейная схема). Формулировки осторожные: схема не ранжирует створы,
// пока порядок не подтверждён вручную (вопрос 1 плана), и не называет коридор
// «источником».

export const SCHEME_UPSTREAM_HINT = 'вверху — выше по течению';

export const SCHEME_UNCONFIRMED_ORDER_HINT = 'порядок створов не подтверждён';

// Показ группой без линии — честное состояние, а не упрощение: любая
// вертикальная последовательность читается как «по течению», поэтому
// оговорка проговаривается явно.
export const SCHEME_UNORDERED_NOTE =
  'Порядок створов по течению не подтверждён вручную, поэтому схема не ранжирует точки: последовательность строк не отражает течение реки.';

export const SCHEME_CORRIDOR_LABEL = 'вероятный коридор';

export const SCHEME_CORRIDOR_OPEN_UP_NOTE = 'открыт вверх по течению';

export const SCHEME_CORRIDOR_BOUND_LABEL = 'граница коридора';

export const SCHEME_CORRIDOR_UPPER_BOUND_TOOLTIP =
  'Верхняя граница вероятного коридора.';

export const SCHEME_CORRIDOR_LOWER_BOUND_TOOLTIP =
  'Нижняя граница вероятного коридора.';

export const SCHEME_CORRIDOR_OPEN_UP_TOOLTIP =
  'Вероятный коридор открыт вверх по течению: источник следует искать выше этого створа.';

export const SCHEME_NO_VALUE_LABEL = 'нет значения';

export const SCHEME_LOAD_ERROR = 'Не удалось загрузить данные события.';
