import { Skeleton } from '@/components/ui/skeleton';

// Каркас (сессия 3): SVG-схема по riverOrder строится в сессии схемы.
// До подтверждения порядка створов (вопрос 1 плана) — только заготовка узлов.
const SCHEME_PLACEHOLDER_NODES = 4;

export function RiverScheme() {
  return (
    <section aria-label="Линейная схема реки" className="flex min-h-0 flex-col">
      <header className="flex items-baseline justify-between gap-3 border-b px-4 py-3">
        <h2 className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          Линейная схема реки
        </h2>
        <p className="truncate text-xs text-muted-foreground">
          Жайык · вверху — выше по течению
        </p>
      </header>
      <div className="flex min-h-0 flex-1 items-center justify-center p-8">
        <div aria-hidden className="relative flex flex-col gap-10">
          <div className="absolute inset-y-1 left-[5px] w-px border-l border-dashed" />
          {Array.from({ length: SCHEME_PLACEHOLDER_NODES }, (_, index) => (
            <div key={index} className="relative flex items-center gap-4">
              <Skeleton className="size-2.5 shrink-0 rounded-full" />
              <Skeleton className="h-3 w-44" />
              <Skeleton className="h-3 w-14" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
