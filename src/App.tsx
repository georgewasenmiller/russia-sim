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

function GameShell() {
  const { resetWarning, dismissResetWarning, started } = useGame();

  if (!started) return <NewGameScreen />;

  return (
    <div className="min-h-svh bg-slate-950">
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

export default function App() {
  return (
    <GameProvider>
      <GameShell />
    </GameProvider>
  );
}
