import { useMemo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
} from "react-simple-maps";
import geoData from "./geo/russia-all.geo.json";
import { REGIONS } from "./data";
import { gdpColor, gdpDomain } from "./colorScale";
import { useGame } from "../state/GameContext";

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
//
// scale — не подобран на глаз, а рассчитан один раз через
// d3.geoMercator().rotate([-105.32,0,0]).fitExtent([[25,25],[1275,775]], geoData)
// на полном датасете (WIDTH×HEIGHT − отступ 25 с каждой стороны), результат
// захардкожен здесь. Компонент по-прежнему ничего не пересчитывает в рантайме.
const PROJECTION_CONFIG = {
  rotate: [-105.32, 0, 0] as [number, number, number],
  center: [0, 69.62] as [number, number],
  scale: 404.88,
};

export function RegionsMap({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { state } = useGame();

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

  const [min, max] = gdpDomain(
    REGIONS.map((r) => state.regionEconomies[r.id].gdpIndex),
  );

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
              const fill = region
                ? gdpColor(state.regionEconomies[region.id].gdpIndex, min, max)
                : "#232838";
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  onClick={() => region && onSelect(region.id)}
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
      </ComposableMap>
    </div>
  );
}
