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
    key: "taxBurden",
    label: "Налоговая нагрузка",
    hint: "Выше — больше доходов бюджета, но тормозит рост ВВП",
    min: 10,
    max: 60,
  },
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
