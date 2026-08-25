import { useState } from "react";
import { GameProvider, useGame } from "./state/GameContext";
import { TopBar } from "./components/TopBar";
import { KpiCards } from "./components/Dashboard/KpiCards";
import { HistoryCharts } from "./components/Charts/HistoryCharts";
import { PolicyPanel } from "./components/Sliders/PolicyPanel";
import { EventModal } from "./components/Events/EventModal";
import { NewGameScreen } from "./components/NewGameScreen";
import { GameOverScreen } from "./components/GameOverScreen";
import { BudgetPanel } from "./components/Budget/BudgetPanel";
import { MapLegend } from "./components/Dashboard/MapLegend";
import { RegionsMap, type MapMode } from "./regions/RegionsMap";
import { RegionPanel } from "./regions/RegionPanel";

type SidePanel =
  | { type: "region"; id: string }
  | { type: "policy" }
  | { type: "charts" }
  | { type: "budget" }
  | null;

function MainScreen() {
  const { resetWarning, dismissResetWarning, started } = useGame();
  const [sidePanel, setSidePanel] = useState<SidePanel>(null);
  const [mapMode, setMapMode] = useState<MapMode>("economy");

  if (!started) return <NewGameScreen />;

  const closeSidePanel = () => setSidePanel(null);

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-slate-950">
      {resetWarning && (
        <div className="flex shrink-0 items-center justify-between gap-3 bg-amber-900/60 px-4 py-2 text-sm text-amber-200">
          <span>
            Старое сохранение несовместимо с текущей версией игры и было
            сброшено. Начата новая игра.
          </span>
          <button
            type="button"
            onClick={dismissResetWarning}
            className="rounded bg-amber-800/60 px-2 py-1 text-xs hover:bg-amber-800"
          >
            Закрыть
          </button>
        </div>
      )}

      <div className="shrink-0">
        <TopBar
          onOpenPolicy={() => setSidePanel({ type: "policy" })}
          onOpenCharts={() => setSidePanel({ type: "charts" })}
          onOpenBudget={() => setSidePanel({ type: "budget" })}
        />
      </div>

      <div className="shrink-0 p-4 pb-0">
        <KpiCards />
      </div>

      <div className="flex min-h-0 flex-1 gap-4 p-4">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <div className="min-h-0 flex-1">
            <RegionsMap
              selectedId={sidePanel?.type === "region" ? sidePanel.id : null}
              onSelect={(id) => setSidePanel({ type: "region", id })}
              mapMode={mapMode}
            />
          </div>
          <MapLegend mode={mapMode} onModeChange={setMapMode} />
        </div>

        {sidePanel && (
          <aside className="w-80 shrink-0 overflow-hidden rounded-lg border border-slate-800 bg-slate-900/95">
            {sidePanel.type === "region" && (
              <RegionPanel selectedId={sidePanel.id} onClose={closeSidePanel} />
            )}
            {sidePanel.type === "policy" && (
              <div className="flex h-full flex-col gap-2 overflow-y-auto p-4">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={closeSidePanel}
                    className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                  >
                    ✕
                  </button>
                </div>
                <PolicyPanel />
              </div>
            )}
            {sidePanel.type === "charts" && (
              <div className="flex h-full flex-col gap-2 overflow-y-auto p-4">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={closeSidePanel}
                    className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                  >
                    ✕
                  </button>
                </div>
                <HistoryCharts />
              </div>
            )}
            {sidePanel.type === "budget" && (
              <BudgetPanel onClose={closeSidePanel} />
            )}
          </aside>
        )}
      </div>

      <EventModal />
      <GameOverScreen />
    </div>
  );
}

export default function App() {
  return (
    <GameProvider>
      <MainScreen />
    </GameProvider>
  );
}
