import {
  BarChart3,
  Coins,
  Droplet,
  Landmark,
  Pause,
  Receipt,
  ScrollText,
  Sliders,
} from "lucide-react";
import { GAME_SPEEDS, fmtGameDate, gameDateFromDays } from "../engine/time";
import { useGame } from "../state/GameContext";
import { fmtUsdBn } from "../utils/format";

export function TopBar({
  onOpenReforms,
  onOpenPolicy,
  onOpenCharts,
  onOpenBudget,
}: {
  onOpenReforms: () => void;
  onOpenPolicy: () => void;
  onOpenCharts: () => void;
  onOpenBudget: () => void;
}) {
  const { state, dispatch } = useGame();

  const canAdvance = !state.gameOver && !state.activeEvent;
  const gameDate = gameDateFromDays(state.gameTimeDays);

  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold tracking-tight text-slate-100">
          Россия: экономика и власть
        </h1>
        <span className="rounded bg-slate-800 px-2 py-1 text-sm text-slate-300">
          {fmtGameDate(gameDate)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <Stat
          icon={<ScrollText size={16} className="text-violet-400" />}
          label="Очки власти"
          value={state.politicalPoints.toFixed(1)}
        />
        <Stat
          icon={<Landmark size={16} className="text-sky-400" />}
          label="Резервы"
          value={fmtUsdBn(state.reserves)}
        />
        <Stat
          icon={<Coins size={16} className="text-amber-400" />}
          label="Баланс бюджета"
          value={`${state.budgetBalance >= 0 ? "+" : ""}${state.budgetBalance.toFixed(1)}% ВВП`}
          tone={state.budgetBalance >= 0 ? "good" : "bad"}
        />
        <Stat
          icon={<Droplet size={16} className="text-orange-400" />}
          label="Нефть"
          value={`$${state.oilPrice.toFixed(1)}/барр.`}
        />

        <button
          type="button"
          onClick={onOpenPolicy}
          title="Политика"
          aria-label="Политика"
          className="rounded-md border border-slate-700 bg-slate-900 p-2 text-slate-300 transition hover:border-violet-500 hover:text-white"
        >
          <Sliders size={18} />
        </button>

        <button
          type="button"
          onClick={onOpenCharts}
          title="Графики"
          aria-label="Графики"
          className="rounded-md border border-slate-700 bg-slate-900 p-2 text-slate-300 transition hover:border-violet-500 hover:text-white"
        >
          <BarChart3 size={18} />
        </button>

        <button
          type="button"
          onClick={onOpenBudget}
          title="Бюджет"
          aria-label="Бюджет"
          className="rounded-md border border-slate-700 bg-slate-900 p-2 text-slate-300 transition hover:border-violet-500 hover:text-white"
        >
          <Receipt size={18} />
        </button>

        <button
          type="button"
          onClick={onOpenReforms}
          className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-violet-500 hover:text-white"
        >
          <ScrollText size={16} className="text-violet-400" />
          Реформы
        </button>

        <div className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 p-1">
          <button
            type="button"
            disabled={!canAdvance}
            onClick={() => dispatch({ type: "SET_PAUSED", paused: !state.isPaused })}
            title={state.isPaused ? "Продолжить" : "Пауза"}
            aria-label={state.isPaused ? "Продолжить" : "Пауза"}
            className={`rounded px-2 py-1.5 transition ${
              state.isPaused
                ? "bg-violet-600 text-white"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            } disabled:cursor-not-allowed disabled:opacity-40`}
          >
            <Pause size={16} />
          </button>
          {GAME_SPEEDS.map((speed) => (
            <button
              key={speed.level}
              type="button"
              disabled={!canAdvance}
              onClick={() => {
                dispatch({ type: "SET_SPEED", level: speed.level });
                if (state.isPaused) dispatch({ type: "SET_PAUSED", paused: false });
              }}
              title={speed.label}
              className={`rounded px-2 py-1.5 text-xs font-medium transition ${
                !state.isPaused && state.gameSpeedLevel === speed.level
                  ? "bg-violet-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {"▶".repeat(speed.level)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-400"
      : tone === "bad"
        ? "text-rose-400"
        : "text-slate-100";
  return (
    <div
      className={`flex items-center gap-2 rounded-md px-3 py-1.5 transition ${
        tone === "bad"
          ? "bg-slate-900 ring-2 ring-rose-500/60 shadow-[0_0_14px_rgba(244,63,94,0.35)]"
          : "bg-slate-900"
      }`}
    >
      {icon}
      <div className="flex flex-col leading-tight">
        <span className="text-[10px] uppercase tracking-wide text-slate-500">
          {label}
        </span>
        <span className={`font-semibold ${toneClass}`}>{value}</span>
      </div>
    </div>
  );
}
