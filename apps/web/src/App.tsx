import { AppHeader } from "@/components/layout/AppHeader"
import { ConclusionPanel } from "@/features/conclusion/ConclusionPanel"
import { SignalFeed } from "@/features/feed/SignalFeed"
import { MapColumn } from "@/features/map/MapColumn"
import { ReplayTimeline } from "@/features/replay/ReplayTimeline"

// Главный экран по ТЗ §13: слева лента, справа вывод, внизу шкала реплея.
// В центре с сессии 19 стоит карта участка вместо линейной схемы — числа
// с экрана не исчезли, весь список замеров открывается поповером с карты.
// На узких экранах колонки складываются в столбец — мобильная вёрстка
// по остаточному принципу (план, блок 45–52 ч).
//
// Вкладок нет: агент реального времени отложен владельцем продукта, а с
// одной оставшейся вкладкой таб-бар читался бы как сломанный элемент.
export function App() {
  return (
    <div className="grid h-svh grid-rows-[auto_minmax(0,1fr)_auto]">
      <AppHeader />
      <main className="grid min-h-0 divide-y overflow-y-auto lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)_minmax(340px,400px)] lg:divide-x lg:divide-y-0 lg:overflow-y-hidden">
        <SignalFeed />
        <MapColumn />
        <ConclusionPanel />
      </main>
      <ReplayTimeline />
    </div>
  )
}

export default App
