import { Minus, Plus } from "lucide-react";
import { TUNING } from "../../engine/constants";
import { canChangeTaxBurden } from "../../engine/policy";
import { useGame } from "../../state/GameContext";
import type { Sliders } from "../../engine/types";

const SLIDER_META: {
  key: keyof Sliders;
  label: string;
  hint: string;
  min: number;
  max: number;
}[] = [
  {
    key: "govSpendingShare",
    label: "Госрасходы (% ВВП)",
    hint: "Выше — поддержка одобрения и роста, но давит на дефицит",
    min: 15,
    max: 55,
  },
  {
    key: "deficitMonetizationShare",
    label: "Финансирование дефицита эмиссией",
    hint: "Выше — меньше долга, но выше инфляция",
    min: 0,
    max: 100,
  },
];

export function PolicyPanel() {
  const { state, dispatch } = useGame();

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <h3 className="mb-3 text-sm font-medium text-slate-300">
        Экономическая политика
      </h3>
      <div className="flex flex-col gap-4">
        <div>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-slate-200">Налоговая нагрузка</span>
            <span className="font-mono text-slate-400">
              {state.sliders.taxBurden.toFixed(0)}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!canChangeTaxBurden(state, "down")}
              onClick={() =>
                dispatch({ type: "CHANGE_TAX_BURDEN", direction: "down" })
              }
              className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/60 px-2 py-1 text-xs text-slate-200 transition hover:border-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Minus size={12} /> {TUNING.taxPolicy.step}%
            </button>
            <button
              type="button"
              disabled={!canChangeTaxBurden(state, "up")}
              onClick={() =>
                dispatch({ type: "CHANGE_TAX_BURDEN", direction: "up" })
              }
              className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/60 px-2 py-1 text-xs text-slate-200 transition hover:border-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus size={12} /> {TUNING.taxPolicy.step}%
            </button>
            <span className="text-xs text-violet-400">
              {TUNING.taxPolicy.ppCost} очк. власти за шаг
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Изменение ставки — политическое решение, требует очков власти, а
            не свободное перетаскивание.
          </p>
        </div>

        {SLIDER_META.map((meta) => (
          <div key={meta.key}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-slate-200">{meta.label}</span>
              <span className="font-mono text-slate-400">
                {state.sliders[meta.key].toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min={meta.min}
              max={meta.max}
              value={state.sliders[meta.key]}
              onChange={(e) =>
                dispatch({
                  type: "SET_SLIDER",
                  slider: meta.key,
                  value: Number(e.target.value),
                })
              }
              className="w-full accent-violet-500"
            />
            <p className="mt-1 text-xs text-slate-500">{meta.hint}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
