import { describe, expect, it } from "vitest";
import { TUNING, createInitialState, maxProductionSlots } from "./constants";
import {
  advanceConstruction,
  canBuildInRegion,
  effectiveBuildDays,
  hasFreeInfrastructureSlot,
  hasFreeProductionSlot,
  isSectorAlreadyBuilding,
  startBuildingIndustry,
  usedProductionSlots,
} from "./industries";
import { advanceRegionEconomies } from "./regionEconomy";
import { REGIONS_BY_ID } from "../regions/data";

function withUnlimitedReserves(state: ReturnType<typeof createInitialState>) {
  return { ...state, reserves: 1_000_000 };
}

describe("production slots", () => {
  it("refuses to start another non-infrastructure industry once production slots are full, even with money", () => {
    let state = withUnlimitedReserves(createInitialState());
    const region = REGIONS_BY_ID.get("nenets")!; // маленький регион — мало слотов, быстро упрёмся в лимит

    // Дозастраиваем производственные слоты до предела.
    let guard = 0;
    while (hasFreeProductionSlot(state, region.id) && guard < 100) {
      state = startBuildingIndustry(state, "manufacturing", region.id);
      guard += 1;
    }
    expect(hasFreeProductionSlot(state, region.id)).toBe(false);
    const countBefore = state.industries.filter((i) => i.regionId === region.id).length;

    const next = startBuildingIndustry(state, "manufacturing", region.id);
    const countAfter = next.industries.filter((i) => i.regionId === region.id).length;
    expect(countAfter).toBe(countBefore); // отклонено, ничего не добавилось
    expect(canBuildInRegion(state, "manufacturing", region.id)).toBe(false);
  });

  it("infrastructure is never blocked by full production slots — it has its own independent limit", () => {
    let state = withUnlimitedReserves(createInitialState());
    const region = REGIONS_BY_ID.get("nenets")!;

    let guard = 0;
    while (hasFreeProductionSlot(state, region.id) && guard < 100) {
      state = startBuildingIndustry(state, "manufacturing", region.id);
      guard += 1;
    }
    expect(hasFreeProductionSlot(state, region.id)).toBe(false);
    // Инфраструктура всё ещё доступна — не расходует тот же пул слотов.
    expect(hasFreeInfrastructureSlot(state, region.id)).toBe(true);
    expect(canBuildInRegion(state, "infrastructure", region.id)).toBe(true);

    const before = state.industries.length;
    const next = startBuildingIndustry(state, "infrastructure", region.id);
    expect(next.industries.length).toBe(before + 1);
  });

  it("infrastructure becomes unavailable once the projected level reaches 100", () => {
    let state = withUnlimitedReserves(createInitialState());
    const region = REGIONS_BY_ID.get("nenets")!;
    state = {
      ...state,
      regionEconomies: {
        ...state.regionEconomies,
        [region.id]: { ...state.regionEconomies[region.id], infrastructureLevel: 95 },
      },
    };
    // 95 + один проект (levelGainPerProject=10) уже >= 100.
    expect(hasFreeInfrastructureSlot(state, region.id)).toBe(true);
    state = startBuildingIndustry(state, "infrastructure", region.id);
    expect(hasFreeInfrastructureSlot(state, region.id)).toBe(false);
  });
});

describe("construction queue: at most one in-progress build per sector per region", () => {
  it("refuses a second simultaneous build of the same sector, but allows a different sector in parallel", () => {
    let state = withUnlimitedReserves(createInitialState());
    const region = REGIONS_BY_ID.get("moscow")!;

    state = startBuildingIndustry(state, "manufacturing", region.id);
    expect(isSectorAlreadyBuilding(state, "manufacturing", region.id)).toBe(true);
    expect(canBuildInRegion(state, "manufacturing", region.id)).toBe(false);

    const countBefore = state.industries.filter(
      (i) => i.regionId === region.id && i.sector === "manufacturing",
    ).length;
    const rejected = startBuildingIndustry(state, "manufacturing", region.id);
    expect(
      rejected.industries.filter((i) => i.regionId === region.id && i.sector === "manufacturing")
        .length,
    ).toBe(countBefore);

    // Другой сектор в том же регионе — по-прежнему не блокируется.
    expect(canBuildInRegion(state, "tech", region.id)).toBe(true);
    const withTech = startBuildingIndustry(state, "tech", region.id);
    expect(
      withTech.industries.some(
        (i) => i.regionId === region.id && i.sector === "tech" && i.status === "building",
      ),
    ).toBe(true);
  });

  it("allows queuing another build of the same sector once the first one completes", () => {
    let state = withUnlimitedReserves(createInitialState());
    const region = REGIONS_BY_ID.get("moscow")!;

    state = startBuildingIndustry(state, "manufacturing", region.id);
    const first = state.industries.find(
      (i) => i.regionId === region.id && i.sector === "manufacturing" && i.status === "building",
    )!;
    const completionDay = Math.ceil(first.completesAtGameDay);
    const result = advanceConstruction(state.industries, completionDay);
    state = { ...state, industries: result.industries };

    expect(isSectorAlreadyBuilding(state, "manufacturing", region.id)).toBe(false);
    expect(canBuildInRegion(state, "manufacturing", region.id)).toBe(true);
    const next = startBuildingIndustry(state, "manufacturing", region.id);
    expect(
      next.industries.some(
        (i) => i.regionId === region.id && i.sector === "manufacturing" && i.status === "building",
      ),
    ).toBe(true);
  });
});

describe("national industrial base speeds up construction everywhere", () => {
  it("a country with many operational industries builds the same sector faster than one with none", () => {
    const withIndustries = createInitialState(); // легаси-предприятия уже есть с самого начала
    const withoutIndustries = { ...withIndustries, industries: [] };
    const region = REGIONS_BY_ID.get("sverdlovsk")!;

    const daysWith = effectiveBuildDays(withIndustries, "manufacturing", region.id);
    const daysWithout = effectiveBuildDays(withoutIndustries, "manufacturing", region.id);
    expect(daysWith).toBeLessThanOrEqual(daysWithout);
  });
});

describe("infrastructure is buildable and raises production slot capacity", () => {
  it("maxProductionSlots grows monotonically with a region's live infrastructureLevel", () => {
    const region = REGIONS_BY_ID.get("sverdlovsk")!;
    const state = createInitialState();
    const economy = state.regionEconomies[region.id];
    const slotsBefore = maxProductionSlots(region, economy);
    const slotsAfter = maxProductionSlots(region, {
      ...economy,
      infrastructureLevel: Math.min(100, economy.infrastructureLevel + TUNING.buildingSlots.infrastructureDivisor),
    });
    expect(slotsAfter).toBeGreaterThan(slotsBefore);
  });

  it("completing an infrastructure project raises the region's live infrastructureLevel by the configured step", () => {
    let state = withUnlimitedReserves(createInitialState());
    const region = REGIONS_BY_ID.get("sverdlovsk")!;
    const levelBefore = state.regionEconomies[region.id].infrastructureLevel;

    state = startBuildingIndustry(state, "infrastructure", region.id);
    const built = state.industries.find(
      (i) => i.regionId === region.id && i.sector === "infrastructure" && i.status === "building",
    )!;

    // Абсолютная метка завершения — сравнение, не декремент (см. план
    // "Непрерывный игровой календарь..."): продвигаем по одним суткам до
    // ровно дня завершения, стройка не должна проскочить мимо него.
    let industries = state.industries;
    const completionDay = Math.ceil(built.completesAtGameDay);
    let lastResult = { industries, newlyCompletedInfrastructureByRegion: {} as Record<string, number>, logEntries: [] as string[] };
    for (let day = state.gameTimeDays + 1; day <= completionDay; day++) {
      lastResult = advanceConstruction(industries, day);
      industries = lastResult.industries;
    }

    expect(industries.find((i) => i.id === built.id)!.status).toBe("operational");
    const economies = advanceRegionEconomies(
      { ...state, industries },
      state.oilPrice,
      lastResult.newlyCompletedInfrastructureByRegion,
      1,
    );
    const levelAfter = economies[region.id].infrastructureLevel;
    expect(levelAfter).toBeCloseTo(
      Math.min(100, levelBefore + TUNING.infrastructureBuild.levelGainPerProject),
      6,
    );
  });
});

describe("strict unemployment: production slots stay finite and used slots never exceed the max", () => {
  it("usedProductionSlots never exceeds maxProductionSlots after repeated build attempts", () => {
    let state = withUnlimitedReserves(createInitialState());
    for (const region of [REGIONS_BY_ID.get("nenets")!, REGIONS_BY_ID.get("moscow")!]) {
      for (let i = 0; i < 50; i++) {
        state = startBuildingIndustry(state, "manufacturing", region.id);
      }
      const economy = state.regionEconomies[region.id];
      expect(usedProductionSlots(state, region.id)).toBeLessThanOrEqual(
        maxProductionSlots(region, economy),
      );
    }
  });
});
