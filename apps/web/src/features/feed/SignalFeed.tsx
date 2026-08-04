import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

// Каркас (сессия 3): данные из fetchIncidents подключаются в сессии ленты.
const FEED_PLACEHOLDER_CARDS = 4;

export function SignalFeed() {
  return (
    <section
      aria-label="Сигналы и расследования"
      className="flex min-h-0 flex-col"
    >
      <header className="border-b px-4 py-3">
        <h2 className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          Сигналы и расследования
        </h2>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <div aria-hidden className="flex flex-col gap-3 p-4">
          {Array.from({ length: FEED_PLACEHOLDER_CARDS }, (_, index) => (
            <div key={index} className="flex flex-col gap-2 border p-3">
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-3/5" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </ScrollArea>
    </section>
  );
}
