import { useState } from "react";
import { REGIONS } from "./data";
import { gdpDomain, legendStops } from "./colorScale";
import { RegionsMap } from "./RegionsMap";
import { RegionPanel } from "./RegionPanel";

export function RegionsView() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [min, max] = gdpDomain(REGIONS.map((r) => r.gdpIndex));
  const stops = legendStops(min, max);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">
          Регионы России
        </h2>
        <p className="text-sm text-slate-500">
          Фундамент для будущей торговли и миграции между регионами — пока
          только просмотр. {REGIONS.length} крупнейших регионов, окраска по
          относительному ВВП.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <RegionsMap selectedId={selectedId} onSelect={setSelectedId} />
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <span>ВВП-индекс:</span>
            <div className="flex h-3 flex-1 overflow-hidden rounded">
              {stops.map((stop, i) => (
                <div key={i} className="flex-1" style={{ background: stop.color }} />
              ))}
            </div>
            <span>{min.toFixed(0)}</span>
            <span>—</span>
            <span>{max.toFixed(0)}</span>
          </div>
        </div>

        <RegionPanel selectedId={selectedId} />
      </div>
    </div>
  );
}
