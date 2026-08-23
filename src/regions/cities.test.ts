import { describe, expect, it } from "vitest";
import { MAJOR_CITIES } from "./cities";

describe("MAJOR_CITIES", () => {
  it("has a reasonable count of cities (15-20 per plan)", () => {
    expect(MAJOR_CITIES.length).toBeGreaterThanOrEqual(15);
    expect(MAJOR_CITIES.length).toBeLessThanOrEqual(20);
  });

  it("has unique names and finite coordinates within Russia's rough bounds", () => {
    const names = MAJOR_CITIES.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);

    for (const city of MAJOR_CITIES) {
      const [lon, lat] = city.coordinates;
      expect(Number.isFinite(lon)).toBe(true);
      expect(Number.isFinite(lat)).toBe(true);
      expect(lon).toBeGreaterThan(19);
      expect(lon).toBeLessThan(180);
      expect(lat).toBeGreaterThan(41);
      expect(lat).toBeLessThan(78);
    }
  });

  it("includes the cities explicitly named by the user", () => {
    const names = new Set(MAJOR_CITIES.map((c) => c.name));
    expect(names.has("Новосибирск")).toBe(true);
    expect(names.has("Екатеринбург")).toBe(true);
    expect(names.has("Владивосток")).toBe(true);
  });
});
