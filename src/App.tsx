import { useState } from "react";
import { GameProvider, useGame } from "./state/GameContext";
import { TopBar } from "./components/TopBar";
import { KpiCards } from "./components/Dashboard/KpiCards";
import { HistoryCharts } from "./components/Charts/HistoryCharts";
import { PolicyPanel } from "./components/Sliders/PolicyPanel";
import { IndustryPanel } from "./components/Industries/IndustryPanel";
import { ReformsPanel } from "./components/Reforms/ReformsPanel";
import { EventModal } from "./components/Events/EventModal";
import { NewGameScreen } from "./components/NewGameScreen";
import { GameOverScreen } from "./components/GameOverScreen";
import { RegionsView } from "./regions/RegionsView";

type Tab = "economy" | "regions";

function GameShell() {
  const { resetWarning, dismissResetWarning, started } = useGame();

  if (!started) return <NewGameScreen />;

  return (
    <div className="bg-slate-950">
      {resetWarning && (
        <div className="flex items-center justify-between gap-3 bg-amber-900/60 px-4 py-2 text-sm text-amber-200">
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

      <TopBar />

      <main className="mx-auto flex max-w-7xl flex-col gap-4 p-4">
        <KpiCards />
        <HistoryCharts />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <PolicyPanel />
          <IndustryPanel />
          <ReformsPanel />
        </div>
      </main>

      <EventModal />
      <GameOverScreen />
    </div>
  );
}

function TabNav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "economy", label: "Экономика" },
    { id: "regions", label: "Регионы" },
  ];
  return (
    <div className="flex gap-1 border-b border-slate-800 bg-slate-950 px-4 pt-2">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`rounded-t-md px-4 py-2 text-sm font-medium transition ${
            tab === t.id
              ? "bg-slate-900 text-slate-100"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function AppShell() {
  const [tab, setTab] = useState<Tab>("economy");

  return (
    <div className="min-h-svh bg-slate-950">
      <TabNav tab={tab} onChange={setTab} />
      {tab === "economy" ? <GameShell /> : <RegionsView />}
    </div>
  );
}

export default function App() {
  return (
    <GameProvider>
      <AppShell />
    </GameProvider>
  );
}
