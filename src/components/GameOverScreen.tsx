import { ShieldAlert } from "lucide-react";
import { fmtGameDate, gameDateFromDays } from "../engine/time";
import { useGame } from "../state/GameContext";

export function GameOverScreen() {
  const { state, dispatch } = useGame();
  if (!state.gameOver) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-slate-950/95 px-4 text-center">
      <ShieldAlert size={48} className="text-rose-400" />
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">
          Правительство пало
        </h1>
        <p className="mt-2 max-w-lg text-slate-400">{state.gameOver.reason}</p>
        <p className="mt-2 text-sm text-slate-500">
          Продержались до {fmtGameDate(gameDateFromDays(state.gameTimeDays))}.
        </p>
      </div>
      <button
        type="button"
        onClick={() => dispatch({ type: "NEW_GAME" })}
        className="rounded-md bg-violet-600 px-6 py-3 font-medium text-white shadow transition hover:bg-violet-500"
      >
        Начать заново
      </button>
    </div>
  );
}
