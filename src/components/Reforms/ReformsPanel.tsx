import { ScrollText } from "lucide-react";
import { canApplyReform, REFORM_DEFS } from "../../engine/reforms";
import { useGame } from "../../state/GameContext";

const CATEGORY_LABEL: Record<string, string> = {
  fiscal: "Фискальные",
  social: "Социальные",
  institutional: "Институциональные",
  foreign: "Внешнеполитические",
};

export function ReformsPanel({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useGame();

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <ScrollText size={18} /> Реформы
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-800 hover:text-slate-300"
        >
          ✕
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {REFORM_DEFS.map((reform) => {
          const applied = state.appliedReformIds.includes(reform.id);
          const canApply = !applied && canApplyReform(state, reform);
          return (
            <div
              key={reform.id}
              className={`rounded-md border px-3 py-2 text-sm ${
                applied
                  ? "border-slate-800 bg-slate-800/20 opacity-60"
                  : "border-slate-700 bg-slate-800/40"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-slate-100">
                  {reform.label}
                </span>
                <span className="shrink-0 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] uppercase text-slate-500">
                  {CATEGORY_LABEL[reform.category]}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">{reform.description}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-violet-400">
                  {reform.cost} очк. власти
                </span>
                <button
                  type="button"
                  disabled={applied || !canApply}
                  onClick={() =>
                    dispatch({ type: "APPLY_REFORM", reformId: reform.id })
                  }
                  className="rounded bg-violet-600 px-2 py-1 text-xs font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
                >
                  {applied ? "Принято" : "Провести"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
