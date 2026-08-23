import { gdpDomain, infrastructureLegendStops, legendStops, numericDomain } from "../../regions/colorScale";
import { REGIONS } from "../../regions/data";
import { useGame } from "../../state/GameContext";
import type { MapMode } from "../../regions/RegionsMap";

export function MapLegend({
  mode,
  onModeChange,
}: {
  mode: MapMode;
  onModeChange: (mode: MapMode) => void;
}) {
  const { state } = useGame();

  const [min, max] =
    mode === "economy"
      ? gdpDomain(REGIONS.map((r) => state.regionEconomies[r.id].gdpIndex))
      : numericDomain(REGIONS.map((r) => r.infrastructureLevel));
  const stops = mode === "economy" ? legendStops(min, max) : infrastructureLegendStops(min, max);

  return (
    <div className="mt-3 flex shrink-0 items-center gap-3 text-xs text-slate-500">
      <div className="flex overflow-hidden rounded border border-slate-700">
        <button
          type="button"
          onClick={() => onModeChange("economy")}
          className={`px-2 py-1 font-medium transition ${
            mode === "economy"
              ? "bg-violet-600 text-white"
              : "bg-slate-900 text-slate-400 hover:text-slate-200"
          }`}
        >
          Экономика
        </button>
        <button
          type="button"
          onClick={() => onModeChange("infrastructure")}
          className={`px-2 py-1 font-medium transition ${
            mode === "infrastructure"
              ? "bg-violet-600 text-white"
              : "bg-slate-900 text-slate-400 hover:text-slate-200"
          }`}
        >
          Застройка
        </button>
      </div>

      <span>{mode === "economy" ? "ВВП-индекс:" : "Инфраструктура:"}</span>
      <div className="flex h-3 flex-1 overflow-hidden rounded">
        {stops.map((stop, i) => (
          <div key={i} className="flex-1" style={{ background: stop.color }} />
        ))}
      </div>
      <span>{min.toFixed(0)}</span>
      <span>—</span>
      <span>{max.toFixed(0)}</span>
    </div>
  );
}
