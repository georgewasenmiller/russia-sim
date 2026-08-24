import { Maximize } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from "react-simple-maps";
import geoData from "./geo/russia-all.geo.json";
import { REGIONS } from "./data";
import { gdpColor, gdpDomain, infrastructureColor, numericDomain } from "./colorScale";
import {
  PROJECTION_CONFIG,
  WIDTH,
  HEIGHT,
  buildRegionViewLookup,
  homeView,
  type RegionView,
} from "./geoMath";
import { MAJOR_CITIES } from "./cities";
import { SECTOR_ICON } from "./sectorIcons";
import { groupIndustriesBySector } from "../engine/industries";
import type { Industry, IndustrySector } from "../engine/types";
import { useGame } from "../state/GameContext";

export type MapMode = "economy" | "infrastructure";

const CITY_LABEL_FADE_START = 2;
const CITY_LABEL_FADE_END = 3.5;

const SECTOR_LABEL: Record<IndustrySector, string> = {
  oil_gas: "Нефть/газ",
  manufacturing: "Промышленность",
  agriculture: "Сельское хоз-во",
  tech: "Технологии",
  infrastructure: "Инфраструктура",
};

interface Tooltip {
  regionId: string;
  x: number;
  y: number;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const FLY_DURATION_MS = 650;

export function RegionsMap({
  selectedId,
  onSelect,
  mapMode,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
  mapMode: MapMode;
}) {
  const { state } = useGame();
  const containerRef = useRef<HTMLDivElement>(null);
  const prevSelectedId = useRef<string | null>(null);

  const home = useMemo(() => homeView(), []);
  const [view, setView] = useState(home);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  // react-simple-maps не анимирует смену center/zoom само — проверено:
  // CSS-transition на SVG-атрибуте transform в этом окружении не
  // подхватывается (значение прыгает мгновенно на первом же кадре), так
  // что перелёт тут — собственный requestAnimationFrame-твин поверх тех
  // же самых controlled center/zoom пропсов ZoomableGroup (см. план,
  // запасной вариант). currentViewRef — источник истины "где камера
  // сейчас на самом деле" (в т.ч. посреди анимации или после ручного
  // panning пользователем через onMoveEnd ниже), от него стартует
  // интерполяция следующего перелёта.
  const currentViewRef = useRef<RegionView>(home);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  function flyTo(target: RegionView) {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    const start = currentViewRef.current;
    const startTime = performance.now();

    function step(now: number) {
      const t = Math.min(1, (now - startTime) / FLY_DURATION_MS);
      const eased = easeInOutCubic(t);
      const next: RegionView = {
        center: [
          start.center[0] + (target.center[0] - start.center[0]) * eased,
          start.center[1] + (target.center[1] - start.center[1]) * eased,
        ],
        zoom: start.zoom + (target.zoom - start.zoom) * eased,
      };
      currentViewRef.current = next;
      setView(next);
      if (t < 1) {
        animationFrameRef.current = requestAnimationFrame(step);
      } else {
        animationFrameRef.current = null;
      }
    }
    animationFrameRef.current = requestAnimationFrame(step);
  }

  const { geoNameToRegion, missing } = useMemo(() => {
    const byGeoName = new Map(REGIONS.map((r) => [r.geoName, r]));
    const missingRegions = REGIONS.filter(
      (r) => !geoData.features.some((f) => f.properties.name === r.geoName),
    ).map((r) => `${r.name} (geoName: "${r.geoName}")`);
    return { geoNameToRegion: byGeoName, missing: missingRegions };
  }, []);

  if (missing.length > 0) {
    console.warn(
      "[RegionsMap] Регионы без геометрии (не найден geoName в geojson):",
      missing,
    );
  }

  const regionViewLookup = useMemo(
    () => buildRegionViewLookup(geoData as any),
    [],
  );

  // Перелёт камеры запускается только сменой selectedId на НОВЫЙ регион —
  // закрытие панели (selectedId -> null) камеру не трогает (см. план).
  useEffect(() => {
    if (selectedId && selectedId !== prevSelectedId.current) {
      const target = regionViewLookup.get(selectedId);
      if (target) flyTo(target);
    }
    prevSelectedId.current = selectedId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, regionViewLookup]);

  const [gdpMin, gdpMax] = gdpDomain(
    REGIONS.map((r) => state.regionEconomies[r.id].gdpIndex),
  );
  const [infraMin, infraMax] = numericDomain(
    REGIONS.map((r) => state.regionEconomies[r.id].infrastructureLevel),
  );

  const industriesByRegion = useMemo(() => {
    const map = new Map<string, Industry[]>();
    for (const industry of state.industries) {
      const list = map.get(industry.regionId) ?? [];
      list.push(industry);
      map.set(industry.regionId, list);
    }
    return map;
  }, [state.industries]);

  // Регионы, где стройка завершается СЛЕДУЮЩИЙ ход — переходящий сигнал,
  // не завязан на mapMode (виден в обоих режимах).
  const completingSoon = useMemo(() => {
    const set = new Set<string>();
    for (const industry of state.industries) {
      if (industry.status === "building" && industry.turnsRemaining === 1) {
        set.add(industry.regionId);
      }
    }
    return set;
  }, [state.industries]);

  function fillFor(regionId: string): string {
    if (mapMode === "infrastructure") {
      const economy = state.regionEconomies[regionId];
      return economy
        ? infrastructureColor(economy.infrastructureLevel, infraMin, infraMax)
        : "#232838";
    }
    return gdpColor(state.regionEconomies[regionId].gdpIndex, gdpMin, gdpMax);
  }

  function handleMouseMove(regionId: string, e: React.MouseEvent) {
    if (mapMode !== "infrastructure" || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTooltip({ regionId, x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  const tooltipRegion = tooltip ? REGIONS.find((r) => r.id === tooltip.regionId) : null;
  const tooltipGrouping =
    tooltip && tooltipRegion
      ? groupIndustriesBySector(industriesByRegion.get(tooltipRegion.id) ?? [])
      : null;

  // Кламп позиции тултипа по границам контейнера карты, а не окна целиком
  // — иначе у самого края (Калининград слева, Чукотка справа) тултип
  // уезжал бы за пределы видимой области.
  const TOOLTIP_W = 230;
  const TOOLTIP_MAX_H = 190;
  let tooltipLeft = 0;
  let tooltipTop = 0;
  if (tooltip && containerRef.current) {
    const rect = containerRef.current.getBoundingClientRect();
    tooltipLeft =
      tooltip.x + 14 + TOOLTIP_W > rect.width
        ? Math.max(4, tooltip.x - TOOLTIP_W - 14)
        : tooltip.x + 14;
    tooltipTop =
      tooltip.y + 14 + TOOLTIP_MAX_H > rect.height
        ? Math.max(4, tooltip.y - TOOLTIP_MAX_H - 14)
        : tooltip.y + 14;
  }

  const labelOpacity = Math.min(
    1,
    Math.max(0, (view.zoom - CITY_LABEL_FADE_START) / (CITY_LABEL_FADE_END - CITY_LABEL_FADE_START)),
  );
  const labelFontSize = 8 + labelOpacity * 3;

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <button
        type="button"
        onClick={() => flyTo(home)}
        className="absolute left-2 top-2 z-10 flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900/90 px-2.5 py-1.5 text-xs font-medium text-slate-200 shadow transition hover:border-violet-500 hover:text-white"
      >
        <Maximize size={14} />
        Показать всю страну
      </button>

      <ComposableMap
        projection="geoMercator"
        projectionConfig={PROJECTION_CONFIG}
        width={WIDTH}
        height={HEIGHT}
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Карта регионов России"
      >
        <ZoomableGroup
          center={view.center}
          zoom={view.zoom}
          minZoom={1}
          maxZoom={10}
          onMoveEnd={(position) => {
            // Ручной pan/zoom пользователя (колесо/drag) обходит flyTo —
            // синхронизируем "источник истины", чтобы следующий перелёт
            // стартовал от реального текущего вида, а не от устаревшего.
            if (animationFrameRef.current !== null) return;
            const next = { center: position.coordinates, zoom: position.zoom };
            currentViewRef.current = next;
            setView(next);
          }}
        >
          <Geographies geography={geoData}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const region = geoNameToRegion.get(geo.properties.name);
                const isSelected = region ? region.id === selectedId : false;
                const fill = region ? fillFor(region.id) : "#232838";
                const pulsing = region ? completingSoon.has(region.id) : false;
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    className={pulsing ? "region-pulse" : undefined}
                    onClick={() => region && onSelect(region.id)}
                    onMouseMove={(e) => region && handleMouseMove(region.id, e)}
                    onMouseLeave={() => setTooltip(null)}
                    style={{
                      default: {
                        fill,
                        stroke: isSelected ? "#f8fafc" : "#0b0e14",
                        strokeWidth: isSelected ? 2 : 0.75,
                        outline: "none",
                        cursor: region ? "pointer" : "default",
                      },
                      hover: {
                        fill,
                        opacity: region ? 0.8 : 1,
                        stroke: isSelected ? "#f8fafc" : "#0b0e14",
                        strokeWidth: isSelected ? 2 : 0.75,
                        outline: "none",
                        cursor: region ? "pointer" : "default",
                      },
                      pressed: {
                        fill,
                        outline: "none",
                      },
                    }}
                  >
                    <title>{region ? region.name : geo.properties.name}</title>
                  </Geography>
                );
              })
            }
          </Geographies>

          {mapMode === "infrastructure" &&
            REGIONS.map((region) => {
              const grouping = groupIndustriesBySector(
                industriesByRegion.get(region.id) ?? [],
              );
              const entries = Object.entries(grouping.operational) as [
                IndustrySector,
                number,
              ][];
              if (entries.length === 0) return null;
              const view2 = regionViewLookup.get(region.id);
              if (!view2) return null;
              const cellWidth = 15;
              const totalWidth = entries.length * cellWidth;
              return (
                <Marker key={region.id} coordinates={view2.center}>
                  <g transform={`translate(${-totalWidth / 2}, -6)`}>
                    {entries.map(([sector, count], i) => {
                      const Icon = SECTOR_ICON[sector];
                      return (
                        <g key={sector} transform={`translate(${i * cellWidth}, 0)`}>
                          <rect
                            width={13}
                            height={13}
                            rx={2.5}
                            fill="#0f172a"
                            fillOpacity={0.88}
                            stroke="#334155"
                            strokeWidth={0.5}
                          />
                          <Icon
                            x={1.5}
                            y={1.5}
                            width={10}
                            height={10}
                            color="#a78bfa"
                            strokeWidth={2.5}
                          />
                          {count > 1 && (
                            <text
                              x={13}
                              y={11}
                              fontSize={7}
                              fill="#e2e5eb"
                              style={{ pointerEvents: "none" }}
                            >
                              {count}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </g>
                </Marker>
              );
            })}

          {MAJOR_CITIES.map((city) => (
            <Marker key={city.name} coordinates={city.coordinates}>
              <circle r={2} fill="#f8fafc" stroke="#0b0e14" strokeWidth={0.6} />
              <text
                textAnchor="middle"
                y={-5}
                fontSize={labelFontSize}
                fill="#f8fafc"
                style={{
                  opacity: labelOpacity,
                  transition: "opacity 200ms linear",
                  pointerEvents: "none",
                  paintOrder: "stroke",
                  stroke: "#0b0e14",
                  strokeWidth: 2,
                }}
              >
                {city.name}
              </text>
            </Marker>
          ))}
        </ZoomableGroup>
      </ComposableMap>

      {tooltip && tooltipRegion && tooltipGrouping && (
        <div
          className="absolute z-20 w-[230px] max-h-[190px] overflow-y-auto rounded-md border border-slate-700 bg-slate-900/95 p-2.5 text-xs shadow-lg"
          style={{ left: tooltipLeft, top: tooltipTop, pointerEvents: "none" }}
        >
          <div className="mb-1 font-semibold text-slate-100">{tooltipRegion.name}</div>
          <div className="mb-1.5 text-slate-400">
            Инфраструктура: {state.regionEconomies[tooltipRegion.id].infrastructureLevel.toFixed(0)}/100
          </div>
          {Object.keys(tooltipGrouping.operational).length > 0 && (
            <div className="mb-1">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">
                Действует
              </div>
              {(Object.entries(tooltipGrouping.operational) as [IndustrySector, number][]).map(
                ([sector, count]) => (
                  <div key={sector} className="text-slate-300">
                    {SECTOR_LABEL[sector]} × {count}
                  </div>
                ),
              )}
            </div>
          )}
          {tooltipGrouping.building.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500">
                Строится
              </div>
              {tooltipGrouping.building.map((b, i) => (
                <div key={i} className="text-amber-400">
                  {SECTOR_LABEL[b.sector]} — ещё {b.turnsRemaining} ход(а/ов)
                </div>
              ))}
            </div>
          )}
          {Object.keys(tooltipGrouping.operational).length === 0 &&
            tooltipGrouping.building.length === 0 && (
              <div className="text-slate-500">Пока ничего не построено</div>
            )}
        </div>
      )}
    </div>
  );
}
