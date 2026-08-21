import { useMemo } from "react";
import { geoConicEqualArea, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import geoData from "./geo/russia-all.geo.json";
import { REGIONS } from "./data";
import { gdpColor, gdpDomain } from "./colorScale";

const WIDTH = 720;
const HEIGHT = 520;

interface RegionProperties {
  name: string;
  name_latin: string;
}

const featureCollection = geoData as FeatureCollection<Geometry, RegionProperties>;

export function RegionsMap({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { path, gameFeatures, backgroundFeatures, missing } = useMemo(() => {
      // fitSize по bbox ВСЕХ ~83 субъектов (не только игровых 24) — иначе
      // масштаб/положение зависят от того, какое подмножество выбрано, и
      // силуэт страны на карте искажается.
      const projection = geoConicEqualArea()
        .rotate([-100, 0])
        .parallels([50, 70])
        .fitSize([WIDTH, HEIGHT], featureCollection);
      const pathGen = geoPath(projection);

      const byGeoName = new Map<string, Feature<Geometry, RegionProperties>>();
      for (const feature of featureCollection.features) {
        byGeoName.set(feature.properties.name, feature);
      }

      const gameById = new Map<string, Feature<Geometry, RegionProperties>>();
      const missingRegions: string[] = [];
      for (const region of REGIONS) {
        const feature = byGeoName.get(region.geoName);
        if (feature) {
          gameById.set(region.id, feature);
          byGeoName.delete(region.geoName);
        } else {
          missingRegions.push(`${region.name} (geoName: "${region.geoName}")`);
        }
      }
      // Оставшееся в byGeoName — субъекты РФ вне нашего игрового списка:
      // фон силуэта страны, без интерактивности.
      const background = [...byGeoName.values()];

      return {
        path: pathGen,
        gameFeatures: gameById,
        backgroundFeatures: background,
        missing: missingRegions,
      };
    }, []);

  if (missing.length > 0) {
    console.warn(
      "[RegionsMap] Регионы без геометрии (не найден geoName в geojson):",
      missing,
    );
  }

  const [min, max] = gdpDomain(REGIONS.map((r) => r.gdpIndex));

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-auto w-full"
      role="img"
      aria-label="Карта регионов России"
    >
      <g aria-hidden="true">
        {backgroundFeatures.map((feature) => {
          const d = path(feature);
          if (!d) return null;
          return (
            <path
              key={feature.properties.name}
              d={d}
              fill="#232838"
              stroke="#0b0e14"
              strokeWidth={0.5}
              className="pointer-events-none"
            />
          );
        })}
      </g>

      {REGIONS.map((region) => {
        const feature = gameFeatures.get(region.id);
        if (!feature) return null;
        const d = path(feature);
        if (!d) return null;
        const isSelected = region.id === selectedId;
        return (
          <path
            key={region.id}
            d={d}
            fill={gdpColor(region.gdpIndex, min, max)}
            stroke={isSelected ? "#f8fafc" : "#0b0e14"}
            strokeWidth={isSelected ? 2 : 0.75}
            className="cursor-pointer transition-opacity hover:opacity-80"
            onClick={() => onSelect(region.id)}
          >
            <title>{region.name}</title>
          </path>
        );
      })}
    </svg>
  );
}
