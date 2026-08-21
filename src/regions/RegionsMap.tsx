import { useMemo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
} from "react-simple-maps";
import geoData from "./geo/russia-all.geo.json";
import { REGIONS } from "./data";
import { gdpColor, gdpDomain } from "./colorScale";

const WIDTH = 1300;
const HEIGHT = 800;

// Меркатор вместо конической проекции — плоский "атласный" вид без
// глобусного эффекта по краям (в духе HOI4). Компромисс: площади ближе к
// полюсу визуально растянуты (Ямало-Ненецкий АО, Чукотка, Ненецкий АО
// будут крупнее их истинной доли площади) — как на большинстве игровых
// карт мира, осознанный выбор.
//
// rotate используется только для долготного центрирования (не тот же
// "конус + parallels" — Меркатору parallels не нужна вовсе). Простой
// projectionConfig.center по долготе тут не работает: d3 режет карту по
// сырой долготе ±180°, и без rotate Чукотка (реально ~169° з.д.) заворачивается
// на тот же край карты, что и Калининград, вместо противоположного —
// см. план. center используется только для широтного смещения.
const PROJECTION_CONFIG = {
  rotate: [-105.32, 0, 0] as [number, number, number],
  center: [0, 69.62] as [number, number],
  scale: 405,
};

export function RegionsMap({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
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

  const [min, max] = gdpDomain(REGIONS.map((r) => r.gdpIndex));

  return (
    <div className="h-full w-full">
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
        <Geographies geography={geoData}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const region = geoNameToRegion.get(geo.properties.name);
              const isSelected = region ? region.id === selectedId : false;
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  onClick={() => region && onSelect(region.id)}
                  style={{
                    default: {
                      fill: region
                        ? gdpColor(region.gdpIndex, min, max)
                        : "#232838",
                      stroke: isSelected ? "#f8fafc" : "#0b0e14",
                      strokeWidth: isSelected ? 2 : 0.75,
                      outline: "none",
                      cursor: region ? "pointer" : "default",
                    },
                    hover: {
                      fill: region
                        ? gdpColor(region.gdpIndex, min, max)
                        : "#232838",
                      opacity: region ? 0.8 : 1,
                      stroke: isSelected ? "#f8fafc" : "#0b0e14",
                      strokeWidth: isSelected ? 2 : 0.75,
                      outline: "none",
                      cursor: region ? "pointer" : "default",
                    },
                    pressed: {
                      fill: region
                        ? gdpColor(region.gdpIndex, min, max)
                        : "#232838",
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
      </ComposableMap>
    </div>
  );
}
