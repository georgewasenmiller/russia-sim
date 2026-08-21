import { useState } from "react";
import { GameProvider, useGame } from "./state/GameContext";
import { TopBar } from "./components/TopBar";
import { KpiCards } from "./components/Dashboard/KpiCards";
import { HistoryCharts } from "./components/Charts/HistoryCharts";
import { PolicyPanel } from "./components/Sliders/PolicyPanel";
import { ReformsPanel } from "./components/Reforms/ReformsPanel";
import { EventModal } from "./components/Events/EventModal";
import { NewGameScreen } from "./components/NewGameScreen";
import { GameOverScreen } from "./components/GameOverScreen";
import { BottomDrawer } from "./components/BottomDrawer";
import { RegionsMap } from "./regions/RegionsMap";
import { RegionPanel } from "./regions/RegionPanel";
import { REGIONS } from "./regions/data";
import { gdpDomain, legendStops } from "./regions/colorScale";

type SidePanel = { type: "region"; id: string } | { type: "reforms" } | null;

function MainScreen() {
  const { resetWarning, dismissResetWarning, started } = useGame();
  const [sidePanel, setSidePanel] = useState<SidePanel>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (!started) return <NewGameScreen />;

  const [min, max] = gdpDomain(REGIONS.map((r) => r.gdpIndex));
  const stops = legendStops(min, max);

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
        <TopBar onOpenReforms={() => setSidePanel({ type: "reforms" })} />
      </div>

      <div className="shrink-0 p-4 pb-0">
        <KpiCards />
      </div>

      <div className="flex min-h-0 flex-1 gap-4 p-4">
        <div className="min-w-0 flex-1 overflow-y-auto">
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
            <RegionsMap
              selectedId={sidePanel?.type === "region" ? sidePanel.id : null}
              onSelect={(id) => setSidePanel({ type: "region", id })}
            />
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <span>ВВП-индекс:</span>
              <div className="flex h-3 flex-1 overflow-hidden rounded">
                {stops.map((stop, i) => (
                  <div key={i} className="flex-1" style={{ background: stop.color }} />
                ))}
              </div>
              <span>{min.toFixed(0)}</span>
              <span>—</span>
              <span>{max.toFixed(0)}</span>
            </div>
          </div>
        </div>

        {sidePanel && (
          <aside className="w-80 shrink-0 overflow-hidden rounded-lg border border-slate-800 bg-slate-900/95">
            {sidePanel.type === "region" ? (
              <RegionPanel
                selectedId={sidePanel.id}
                onClose={() => setSidePanel(null)}
              />
            ) : (
              <ReformsPanel onClose={() => setSidePanel(null)} />
            )}
          </aside>
        )}
      </div>

      <div className="h-10 shrink-0" aria-hidden="true" />

      <BottomDrawer open={drawerOpen} onToggle={() => setDrawerOpen((o) => !o)}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <PolicyPanel />
          <HistoryCharts />
        </div>
      </BottomDrawer>

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
