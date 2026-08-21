import { Factory, Landmark, ShieldAlert, Users } from "lucide-react";
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

export function RegionPanel({ selectedId }: { selectedId: string | null }) {
  const region = REGIONS.find((r) => r.id === selectedId);

  if (!region) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-500">
        Выберите регион на карте, чтобы увидеть подробности.
      </div>
    );
  }

  const neighborNames = region.neighbors
    .map((id) => REGIONS.find((r) => r.id === id)?.name)
    .filter((name): name is string => Boolean(name));

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <div>
        <h3 className="text-lg font-semibold text-slate-100">{region.name}</h3>
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
