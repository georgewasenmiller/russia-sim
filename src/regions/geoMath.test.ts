import { describe, expect, it } from "vitest";
import { buildRegionViewLookup, homeView } from "./geoMath";
import { REGIONS } from "./data";
import geoData from "./geo/russia-all.geo.json";

describe("geoMath: region view lookup", () => {
  it("computes a finite, sane center/zoom for every region", () => {
    const lookup = buildRegionViewLookup(geoData as any);
    expect(lookup.size).toBe(REGIONS.length);

    for (const region of REGIONS) {
      const view = lookup.get(region.id);
      expect(view, `missing view for ${region.id}`).toBeDefined();
      const [lon, lat] = view!.center;
      expect(Number.isFinite(lon)).toBe(true);
      expect(Number.isFinite(lat)).toBe(true);
      // Россия целиком (с учётом уже решённого антимеридианного разворота
      // Чукотки на исходных данных) укладывается примерно в эти границы.
      expect(lon).toBeGreaterThan(-20);
      expect(lon).toBeLessThan(200);
      expect(lat).toBeGreaterThan(40);
      expect(lat).toBeLessThan(82);

      expect(Number.isFinite(view!.zoom)).toBe(true);
      expect(view!.zoom).toBeGreaterThanOrEqual(1.5);
      expect(view!.zoom).toBeLessThanOrEqual(10);
    }
  });

  it("gives a small region a tighter zoom than a huge one", () => {
    const lookup = buildRegionViewLookup(geoData as any);
    const nenets = lookup.get("nenets")!;
    const sakha = lookup.get("sakha")!;
    expect(nenets.zoom).toBeGreaterThan(sakha.zoom);
  });

  it("homeView projects back to the canvas center at zoom 1", () => {
    const home = homeView();
    expect(home.zoom).toBe(1);
    expect(Number.isFinite(home.center[0])).toBe(true);
    expect(Number.isFinite(home.center[1])).toBe(true);
  });
});
