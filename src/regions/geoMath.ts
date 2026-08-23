import { geoCentroid, geoMercator, geoPath } from "d3-geo";
import type { Feature, FeatureCollection } from "geojson";
import { clamp } from "../engine/constants";
import { REGIONS } from "./data";

export const WIDTH = 1300;
export const HEIGHT = 800;

// Меркатор вместо конической проекции — плоский "атласный" вид без
// глобусного эффекта по краям (в духе HOI4). Компромисс: площади ближе к
// полюсу визуально растянуты (Ямало-Ненецкий АО, Чукотка, Ненецкий АО
// крупнее их истинной доли площади) — как на большинстве игровых карт
// мира, осознанный выбор.
//
// rotate используется только для долготного центрирования (не тот же
// "конус + parallels" — Меркатору parallels не нужна вовсе). Простой
// center по долготе тут не работает: d3 режет карту по сырой долготе
// ±180°, и без rotate Чукотка (реально ~169° з.д.) заворачивается на тот
// же край карты, что и Калининград, вместо противоположного. center
// используется только для широтного смещения.
//
// scale рассчитан один раз через
// d3.geoMercator().rotate([-105.32,0,0]).fitExtent([[25,25],[1275,775]], geoData)
// на полном датасете (WIDTH×HEIGHT − отступ 25 с каждой стороны) и
// захардкожен здесь как единственный источник истины — RegionsMap.tsx
// использует ровно эти же числа, а не пересчитывает их заново, чтобы
// перелёт к региону (этот файл) и сама отрисовка карты гарантированно не
// разъезжались.
export const PROJECTION_CONFIG = {
  rotate: [-105.32, 0, 0] as [number, number, number],
  center: [0, 69.62] as [number, number],
  scale: 404.88,
};

const projection = geoMercator()
  .rotate(PROJECTION_CONFIG.rotate)
  .center(PROJECTION_CONFIG.center)
  .scale(PROJECTION_CONFIG.scale)
  .translate([WIDTH / 2, HEIGHT / 2]);

const path = geoPath(projection);

export interface RegionView {
  center: [number, number];
  zoom: number;
}

const ZOOM_FIT_PADDING = 0.85;
const ZOOM_FIT_MIN = 1.5;
const ZOOM_FIT_MAX = 10;

function regionView(feature: Feature): RegionView {
  const center = geoCentroid(feature) as [number, number];
  const bounds = path.bounds(feature);
  const [[x0, y0], [x1, y1]] = bounds;
  const bboxWidth = Math.max(x1 - x0, 1e-6);
  const bboxHeight = Math.max(y1 - y0, 1e-6);
  const fit = ZOOM_FIT_PADDING * Math.min(WIDTH / bboxWidth, HEIGHT / bboxHeight);
  const zoom = clamp(fit, [ZOOM_FIT_MIN, ZOOM_FIT_MAX]);
  return { center, zoom };
}

/**
 * Считает center/zoom "полёта к региону" для каждого региона один раз —
 * ключ Map это region.id (не geoName), чтобы вызывающий код в
 * RegionsMap.tsx мог обращаться по тому же id, что и everywhere else.
 */
export function buildRegionViewLookup(
  geoData: FeatureCollection,
): Map<string, RegionView> {
  const byGeoName = new Map(REGIONS.map((r) => [r.geoName, r.id]));
  const lookup = new Map<string, RegionView>();

  for (const feature of geoData.features) {
    const name = (feature.properties as { name?: string } | null)?.name;
    const regionId = name ? byGeoName.get(name) : undefined;
    if (!regionId) continue;
    lookup.set(regionId, regionView(feature));
  }

  return lookup;
}

/** "Домашний" вид — та географическая точка, что при zoom=1 проецируется
 * ровно в центр канваса (WIDTH×HEIGHT), то есть in identity transform уже
 * показывает всю страну — ровно так, как PROJECTION_CONFIG откалиброван. */
export function homeView(): RegionView {
  const center = projection.invert!([WIDTH / 2, HEIGHT / 2]) as [number, number];
  return { center, zoom: 1 };
}
