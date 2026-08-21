import { Factory, Hammer, Landmark, ShieldAlert, Users } from "lucide-react";
import { INDUSTRY_DEFS } from "../engine/constants";
import { canAffordIndustry } from "../engine/industries";
import { useGame } from "../state/GameContext";
import type { IndustrySector } from "../engine/types";
import { fmtUsdBn } from "../utils/format";
import { REGIONS } from "./data";
import type { Specialization } from "./types";

const SPECIALIZATION_LABEL: Record<Specialization, string> = {
  oil: "Нефть",
  gas: "Газ",
  coal: "Уголь",
  metals: "Металлы",
  agriculture: "Сельское хозяйство",
  industry: "Промышленность",
  finance: "Финансы",
  tech: "Технологии",
  ports: "Порты",
};

export function RegionPanel({
  selectedId,
  onClose,
}: {
  selectedId: string | null;
  onClose: () => void;
}) {
  const { state, dispatch } = useGame();
  const region = REGIONS.find((r) => r.id === selectedId);

  if (!region) return null;

  const neighborNames = region.neighbors
    .map((id) => REGIONS.find((r) => r.id === id)?.name)
    .filter((name): name is string => Boolean(name));

  const regionIndustries = state.industries.filter(
    (ind) => ind.regionId === region.id,
  );

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">
            {region.name}
          </h3>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {region.specializations.map((s) => (
              <span
                key={s}
                className="rounded bg-violet-900/40 px-1.5 py-0.5 text-[11px] text-violet-300"
              >
                {SPECIALIZATION_LABEL[s]}
              </span>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-800 hover:text-slate-300"
        >
          ✕
        </button>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <Stat icon={<Landmark size={14} />} label="ВВП-индекс" value={region.gdpIndex.toFixed(0)} />
        <Stat icon={<Users size={14} />} label="Население" value={`${region.population.toFixed(1)} млн`} />
        <Stat icon={<Factory size={14} />} label="Безработица" value={`${region.unemploymentRate}%`} />
        <Stat icon={<ShieldAlert size={14} />} label="Коррупция" value={`${region.corruptionIndex}/100`} />
      </dl>

      <div>
        <h4 className="mb-1 text-xs uppercase tracking-wide text-slate-500">
          Соседние регионы
        </h4>
        {neighborNames.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {neighborNames.map((name) => (
              <li
                key={name}
                className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-300"
              >
                {name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-600">
            Нет соседей в текущем наборе регионов.
          </p>
        )}
      </div>

      <div>
        <h4 className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wide text-slate-500">
          <Factory size={13} /> Отрасли региона
        </h4>

        {regionIndustries.length > 0 && (
          <ul className="mb-3 flex flex-col gap-2">
            {regionIndustries.map((ind) => (
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
                onClick={() =>
                  dispatch({
                    type: "BUILD_INDUSTRY",
                    sector,
                    regionId: region.id,
                  })
                }
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
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="flex items-center gap-1 text-[11px] text-slate-500">
        {icon}
        {label}
      </dt>
      <dd className="font-semibold text-slate-100">{value}</dd>
    </div>
  );
}
