import { useEffect, useMemo, useRef, useState } from "react";
import { geoConicEqualArea, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import geoData from "./geo/russia-all.geo.json";
import { REGIONS } from "./data";
import { gdpColor, gdpDomain } from "./colorScale";

// Соотношение сторон карты (высота/ширина), сохраняется при пересчёте под
// текущий размер контейнера.
const ASPECT_RATIO = 520 / 720;
const DEFAULT_WIDTH = 720;

// Географический центр проекции: ~62° в.д., 60° с.ш.
const CENTER_LON = 62;
const CENTER_LAT = 60;

interface RegionProperties {
  name: string;
  name_latin: string;
}

const featureCollection = geoData as FeatureCollection<Geometry, RegionProperties>;

function useContainerSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({
    width: DEFAULT_WIDTH,
    height: DEFAULT_WIDTH * ASPECT_RATIO,
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = (width: number) => {
      if (width > 0) setSize({ width, height: width * ASPECT_RATIO });
    };
    update(el.clientWidth);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        update(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

export function RegionsMap({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width, height } = useContainerSize(containerRef);

  const { featuresById, missing } = useMemo(() => {
    const byGeoName = new Map<string, Feature<Geometry, RegionProperties>>();
    for (const feature of featureCollection.features) {
      byGeoName.set(feature.properties.name, feature);
    }

    const byId = new Map<string, Feature<Geometry, RegionProperties>>();
    const missingRegions: string[] = [];
    for (const region of REGIONS) {
      const feature = byGeoName.get(region.geoName);
      if (feature) {
        byId.set(region.id, feature);
      } else {
        missingRegions.push(`${region.name} (geoName: "${region.geoName}")`);
      }
    }
    return { featuresById: byId, missing: missingRegions };
  }, []);

  // Пересчитывается при каждом изменении размера контейнера (ResizeObserver
  // выше), а не залипает на размере первого рендера — иначе при ресайзе окна
  // масштаб/центр карты остаются старыми и она визуально "уезжает".
  const path = useMemo(() => {
    const projection = geoConicEqualArea()
      .rotate([-CENTER_LON, 0])
      .center([0, CENTER_LAT])
      .parallels([50, 70])
      .fitSize([width, height], featureCollection);
    return geoPath(projection);
  }, [width, height]);

  if (missing.length > 0) {
    console.warn(
      "[RegionsMap] Регионы без геометрии (не найден geoName в geojson):",
      missing,
    );
  }

  const [min, max] = gdpDomain(REGIONS.map((r) => r.gdpIndex));

  return (
    <div ref={containerRef} className="w-full">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
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
    </div>
  );
}
