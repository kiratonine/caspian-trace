import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { CONCLUSION_SECTIONS } from '@/constants/panel';

// Каркас (сессия 3): наполнение блоков подключается в сессии правой панели.
// Порядок и нумерация секций приходят из CONCLUSION_SECTIONS (ТЗ §13, пункты 1–6).
export function ConclusionPanel() {
  return (
    <section aria-label="Вывод и доказательства" className="flex min-h-0 flex-col">
      <header className="border-b px-4 py-3">
        <h2 className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          Вывод и доказательства
        </h2>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <ol className="flex flex-col p-4">
          {CONCLUSION_SECTIONS.map((section, index) => (
            <li
              key={section.id}
              className="mt-4 flex flex-col gap-2 border-t pt-4 first:mt-0 first:border-t-0 first:pt-0"
            >
              <h3 className="flex items-baseline gap-2 text-sm font-medium">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {index + 1}
                </span>
                {section.title}
              </h3>
              <div aria-hidden className="flex flex-col gap-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </li>
          ))}
        </ol>
      </ScrollArea>
    </section>
  );
}
