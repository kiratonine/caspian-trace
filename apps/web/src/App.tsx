import { AppHeader } from "@/components/layout/AppHeader"
import { ConclusionPanel } from "@/features/conclusion/ConclusionPanel"
import { SignalFeed } from "@/features/feed/SignalFeed"
import { MapTab } from "@/features/map/MapTab"
import { ReplayTimeline } from "@/features/replay/ReplayTimeline"
import { RiverScheme } from "@/features/river-scheme/RiverScheme"
import { AgentTabPlaceholder } from "@/features/tabs/AgentTabPlaceholder"
import { TabBar } from "@/features/tabs/TabBar"
import { useSelectedTab } from "@/features/tabs/use-selected-tab"

// Экран разведён по вкладкам (сессия 19, просьба владельца продукта: «судьи
// не любят читать»). Карта открывается первой, доказательный экран ТЗ §13
// переезжает в третью вкладку без единой правки разметки.
export function App() {
  const { tabId, selectTab } = useSelectedTab()

  return (
    <div className="grid h-svh grid-rows-[auto_auto_minmax(0,1fr)]">
      <AppHeader />
      <TabBar tabId={tabId} onSelect={selectTab} />
      {tabId === "agent" && <AgentTabPlaceholder />}
      {tabId === "map" && <MapTab />}
      {tabId === "evidence" && <EvidenceTab />}
    </div>
  )
}

// Главный экран по ТЗ §13: слева лента, в центре схема реки, справа вывод,
// внизу шкала реплея. На узких экранах колонки складываются в столбец —
// мобильная вёрстка по остаточному принципу (план, блок 45–52 ч).
//
// Шкала реплея живёт только здесь: реплей — механика разбора доказательств,
// на карте у него своего слоя нет.
function EvidenceTab() {
  return (
    <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto]">
      <main className="grid min-h-0 divide-y overflow-y-auto lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)_minmax(340px,400px)] lg:divide-x lg:divide-y-0 lg:overflow-y-hidden">
        <SignalFeed />
        <RiverScheme />
        <ConclusionPanel />
      </main>
      <ReplayTimeline />
    </div>
  )
}

export default App
