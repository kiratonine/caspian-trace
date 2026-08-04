import { SourceLink } from '@/components/common';
import { PANEL_NO_SOURCES } from '@/constants/panel';
import type { SourceEntry } from './panel-model';

type SourcesListProps = {
  entries: SourceEntry[];
};

/** Блок 6 §13: кликабельные документы; страница — из ссылающегося измерения. */
export function SourcesList({ entries }: SourcesListProps) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">{PANEL_NO_SOURCES}</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {entries.map(({ document, page }) => (
        <li key={document.id}>
          <SourceLink sourceDocument={document} page={page} />
        </li>
      ))}
    </ul>
  );
}
