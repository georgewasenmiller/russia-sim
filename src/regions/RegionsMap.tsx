import { useMemo } from "react";
import { geoConicEqualArea, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import geoData from "./geo/russia-regions.geo.json";
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
  const { path, featuresById, missingRegionNames } = useMemo(() => {
    const projection = geoConicEqualArea()
      .rotate([-100, 0])
      .parallels([50, 70])
      .fitSize([WIDTH, HEIGHT], featureCollection);
    const pathGen = geoPath(projection);

    const byGeoName = new Map<string, Feature<Geometry, RegionProperties>>();
    for (const feature of featureCollection.features) {
      byGeoName.set(feature.properties.name, feature);
    }

    const byId = new Map<string, Feature<Geometry, RegionProperties>>();
    const missing: string[] = [];
    for (const region of REGIONS) {
      const feature = byGeoName.get(region.geoName);
      if (feature) {
        byId.set(region.id, feature);
        byGeoName.delete(region.geoName);
      } else {
        missing.push(`${region.name} (geoName: "${region.geoName}")`);
      }
    }
    // Оставшиеся в byGeoName — фичи geojson без соответствующего Region
    const unmatchedFeatures = [...byGeoName.keys()];

    return {
      path: pathGen,
      featuresById: byId,
      missingRegionNames: { missing, unmatchedFeatures },
    };
  }, []);

  if (missingRegionNames.missing.length > 0) {
    console.warn(
      "[RegionsMap] Регионы без геометрии (не найден geoName в geojson):",
      missingRegionNames.missing,
    );
  }
  if (missingRegionNames.unmatchedFeatures.length > 0) {
    console.warn(
      "[RegionsMap] Фичи geojson без соответствующего Region:",
      missingRegionNames.unmatchedFeatures,
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
      {REGIONS.map((region) => {
        const feature = featuresById.get(region.id);
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
