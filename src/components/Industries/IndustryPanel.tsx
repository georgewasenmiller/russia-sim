import { Factory, Hammer } from "lucide-react";
import { INDUSTRY_DEFS } from "../../engine/constants";
import { canAffordIndustry } from "../../engine/industries";
import { useGame } from "../../state/GameContext";
import type { IndustrySector } from "../../engine/types";
import { fmtUsdBn } from "../../utils/format";

export function IndustryPanel() {
  const { state, dispatch } = useGame();

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-300">
        <Factory size={16} /> Отрасли и производство
      </h3>

      {state.industries.length > 0 && (
        <ul className="mb-4 flex flex-col gap-2">
          {state.industries.map((ind) => (
            <li
              key={ind.id}
              className="flex items-center justify-between rounded-md bg-slate-800/60 px-3 py-2 text-sm"
            >
              <span className="text-slate-200">{ind.label}</span>
              {ind.status === "building" ? (
                <span className="flex items-center gap-1 text-amber-400">
                  <Hammer size={14} /> {ind.turnsRemaining} ход(а/ов)
                </span>
              ) : (
                <span className="text-emerald-400">
                  работает · +{ind.jobs}тыс. раб. мест
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {(Object.keys(INDUSTRY_DEFS) as IndustrySector[]).map((sector) => {
          const def = INDUSTRY_DEFS[sector];
          const affordable = canAffordIndustry(state, sector);
          return (
            <button
              key={sector}
              type="button"
              disabled={!affordable}
              title={def.description}
              onClick={() => dispatch({ type: "BUILD_INDUSTRY", sector })}
              className="flex flex-col items-start gap-0.5 rounded-md border border-slate-700 bg-slate-800/40 px-3 py-2 text-left text-xs transition hover:border-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="text-sm font-medium text-slate-100">
                {def.label}
              </span>
              <span className="text-slate-400">
                {fmtUsdBn(def.buildCost)} · {def.buildTurns} хода
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
