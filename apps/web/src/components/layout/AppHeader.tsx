import { APP_NAME, APP_TAGLINE } from '@/constants/strings';

export function AppHeader() {
  return (
    <header className="flex items-baseline gap-x-3 border-b px-4 py-2.5">
      <h1 className="text-sm font-semibold tracking-[0.14em] uppercase">
        {APP_NAME}
      </h1>
      <p className="hidden truncate text-xs text-muted-foreground sm:block">
        {APP_TAGLINE}
      </p>
    </header>
  );
}
