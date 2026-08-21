import { useMemo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
} from "react-simple-maps";
import geoData from "./geo/russia-all.geo.json";
import { REGIONS } from "./data";
import { gdpColor, gdpDomain } from "./colorScale";

const WIDTH = 900;
const HEIGHT = 620;

// Географический центр проекции задаётся через rotate (не через
// projectionConfig.center напрямую) — конические проекции интерпретируют
// center как подстройку ПОСЛЕ rotate, и при большом смещении по долготе
// без rotate дают заметные искажения. Долгота центра ~100° в.д. переносится
// в rotate, а center используется только для смещения по широте (~65° с.ш.).
const PROJECTION_CONFIG = {
  rotate: [-95, 0, 0] as [number, number, number],
  center: [0, 65] as [number, number],
  parallels: [50, 70] as [number, number],
  scale: 650,
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
    <div className="w-full">
      <ComposableMap
        projection="geoConicEqualArea"
        projectionConfig={PROJECTION_CONFIG}
        width={WIDTH}
        height={HEIGHT}
        className="h-auto w-full"
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
