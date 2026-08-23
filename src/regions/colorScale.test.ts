import { describe, expect, it } from "vitest";
import {
  gdpColor,
  gdpDomain,
  infrastructureColor,
  infrastructureLegendStops,
  legendStops,
  normalizeGdp,
  numericDomain,
} from "./colorScale";
import { REGIONS } from "./data";

describe("colorScale", () => {
  it("normalizeGdp stays within [0,1] and handles min==max", () => {
    expect(normalizeGdp(50, 0, 100)).toBeCloseTo(Math.sqrt(0.5));
    expect(normalizeGdp(0, 0, 100)).toBe(0);
    expect(normalizeGdp(100, 0, 100)).toBe(1);
    expect(normalizeGdp(50, 50, 50)).toBe(0);
  });

  it("gdpColor returns a valid hex color at the domain boundaries", () => {
    const [min, max] = [11, 100];
    expect(gdpColor(min, min, max)).toMatch(/^#[0-9a-f]{6}$/);
    expect(gdpColor(max, min, max)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("sqrt scale visibly separates non-Moscow regions instead of clumping them", () => {
    const [min, max] = gdpDomain(REGIONS.map((r) => r.gdpIndex));
    const spb = REGIONS.find((r) => r.id === "spb")!;
    const khantyMansi = REGIONS.find((r) => r.id === "khanty_mansi")!;
    const lowest = REGIONS.reduce((a, b) => (a.gdpIndex <= b.gdpIndex ? a : b));

    const spbT = normalizeGdp(spb.gdpIndex, min, max);
    const lowestT = normalizeGdp(lowest.gdpIndex, min, max);
    const khmT = normalizeGdp(khantyMansi.gdpIndex, min, max);

    // На линейной шкале spb (42) относительно Москвы (100) и минимального
    // региона дал бы t~0.35 — на sqrt-шкале разрыв между разными регионами
    // должен быть заметно больше нуля и не совпадать друг с другом.
    expect(spbT).toBeGreaterThan(0.3);
    expect(lowestT).toBeCloseTo(0, 5);
    expect(Math.abs(spbT - khmT)).toBeGreaterThan(0.05);
    expect(gdpColor(spb.gdpIndex, min, max)).not.toBe(
      gdpColor(lowest.gdpIndex, min, max),
    );
  });

  it("legendStops produces monotonically increasing values with valid colors", () => {
    const stops = legendStops(11, 100, 5);
    expect(stops).toHaveLength(5);
    for (let i = 1; i < stops.length; i++) {
      expect(stops[i].value).toBeGreaterThan(stops[i - 1].value);
      expect(stops[i].color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("every region's geoName is unique (no duplicate join keys)", () => {
    const geoNames = REGIONS.map((r) => r.geoName);
    expect(new Set(geoNames).size).toBe(geoNames.length);
  });

  it("neighbor ids all reference regions that actually exist in the dataset", () => {
    const ids = new Set(REGIONS.map((r) => r.id));
    for (const region of REGIONS) {
      for (const neighborId of region.neighbors) {
        expect(ids.has(neighborId)).toBe(true);
      }
    }
  });
});

describe("infrastructureColor (режим карты «Застройка»)", () => {
  it("returns a valid hex color at the domain boundaries", () => {
    const [min, max] = numericDomain(REGIONS.map((r) => r.infrastructureLevel));
    expect(infrastructureColor(min, min, max)).toMatch(/^#[0-9a-f]{6}$/);
    expect(infrastructureColor(max, min, max)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("uses a visibly different palette from gdpColor at the same relative position", () => {
    const [gMin, gMax] = gdpDomain(REGIONS.map((r) => r.gdpIndex));
    const [iMin, iMax] = numericDomain(REGIONS.map((r) => r.infrastructureLevel));
    const midGdp = gdpColor((gMin + gMax) / 2, gMin, gMax);
    const midInfra = infrastructureColor((iMin + iMax) / 2, iMin, iMax);
    expect(midInfra).not.toBe(midGdp);
  });

  it("infrastructureLegendStops are monotonically increasing with valid colors", () => {
    const stops = infrastructureLegendStops(15, 95, 5);
    expect(stops).toHaveLength(5);
    for (let i = 1; i < stops.length; i++) {
      expect(stops[i].value).toBeGreaterThan(stops[i - 1].value);
      expect(stops[i].color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
