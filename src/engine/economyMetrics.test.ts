import { describe, expect, it } from "vitest";
import { createInitialState } from "./constants";
import {
  industryObjectFlowUsd,
  nationalGdpPerCapitaUsd,
  nationalGdpUsdAnnual,
  regionGdpPerCapitaUsd,
  regionGdpUsdAnnual,
} from "./economyMetrics";
import { computeBudget } from "./formulas";
import {
  canAffordIndustry,
  effectiveBuildCost,
  effectiveBuildDays,
  startBuildingIndustry,
} from "./industries";
import { canChangeTaxBurden, changeTaxBurden } from "./policy";
import { DAYS_PER_QUARTER } from "./time";
import { advanceOneDay } from "./turnEngine";
import { REGIONS, REGIONS_BY_ID } from "../regions/data";

describe("economyMetrics: $ scale consistency", () => {
  it("sum of regional $ GDP equals national $ GDP", () => {
    const state = createInitialState();
    const sumRegional = REGIONS.reduce(
      (sum, r) => sum + regionGdpUsdAnnual(state.regionEconomies[r.id]),
      0,
    );
    expect(sumRegional).toBeCloseTo(nationalGdpUsdAnnual(state), 4);
  });

  it("national per-capita GDP is a positive, sane number derived from the same $ figure", () => {
    const state = createInitialState();
    const perCapita = nationalGdpPerCapitaUsd(state);
    expect(perCapita).toBeGreaterThan(0);
    expect(Number.isFinite(perCapita)).toBe(true);
  });

  it("region per-capita GDP scales with regionGdpUsdAnnual and population", () => {
    const state = createInitialState();
    const region = REGIONS_BY_ID.get("moscow")!;
    const economy = state.regionEconomies[region.id];
    const perCapita = regionGdpPerCapitaUsd(economy, region);
    expect(perCapita).toBeCloseTo(
      (regionGdpUsdAnnual(economy) / region.population) * 1000,
      6,
    );
  });

  it("region GDP at game start equals the sum of its legacy industries' individual $ contributions", () => {
    const state = createInitialState();
    const region = REGIONS_BY_ID.get("khanty_mansi")!;
    const economy = state.regionEconomies[region.id];
    const regionIndustries = state.industries.filter((i) => i.regionId === region.id);
    const sumIndustries = regionIndustries.reduce(
      (sum, i) => sum + industryObjectFlowUsd(i),
      0,
    );
    expect(regionIndustries.length).toBeGreaterThan(0); // легаси-предприятия уже посеяны
    expect(sumIndustries).toBeCloseTo(regionGdpUsdAnnual(economy), 6);
  });
});

describe("computeBudget: sector revenue breakdown", () => {
  it("sector revenues plus base tax revenue sum to taxRevenue, base is never negative", () => {
    const state = createInitialState();
    const budget = computeBudget(state, state.oilPrice, DAYS_PER_QUARTER);
    const sectorSum = Object.values(budget.sectorTaxRevenue).reduce(
      (a, b) => a + (b ?? 0),
      0,
    );
    expect(budget.baseTaxRevenue).toBeGreaterThanOrEqual(0);
    if (!budget.baseTaxRevenueClamped) {
      expect(sectorSum + budget.baseTaxRevenue).toBeCloseTo(budget.taxRevenue, 6);
    }
  });

  it("baseTaxRevenue is negligible at game start (all GDP is attributable to legacy buildings)", () => {
    // Все ВВП на старте буквально приходит от легаси-предприятий (см. план
    // "Причинность экономики..."), так что сумма по секторам должна
    // совпадать с taxRevenue с точностью до погрешности плавающей точки —
    // соответственно baseTaxRevenue близко к нулю (может быть отсечено
    // защитным полом ровно на границе из-за той же погрешности, это не баг).
    const state = createInitialState();
    const budget = computeBudget(state, state.oilPrice, DAYS_PER_QUARTER);
    expect(budget.baseTaxRevenue).toBeCloseTo(0, 6);
  });
});

describe("infrastructure affects construction cost/turns", () => {
  it("a higher-infrastructure region builds the same sector cheaper and no slower than a lower-infrastructure one", () => {
    const state = createInitialState();
    const sorted = [...REGIONS].sort(
      (a, b) =>
        state.regionEconomies[a.id].infrastructureLevel -
        state.regionEconomies[b.id].infrastructureLevel,
    );
    const lowInfra = sorted[0];
    const highInfra = sorted[sorted.length - 1];
    expect(state.regionEconomies[highInfra.id].infrastructureLevel).toBeGreaterThan(
      state.regionEconomies[lowInfra.id].infrastructureLevel,
    );

    const costLow = effectiveBuildCost(state, "manufacturing", lowInfra.id);
    const costHigh = effectiveBuildCost(state, "manufacturing", highInfra.id);
    const daysLow = effectiveBuildDays(state, "manufacturing", lowInfra.id);
    const daysHigh = effectiveBuildDays(state, "manufacturing", highInfra.id);

    expect(costHigh).toBeLessThan(costLow);
    expect(daysHigh).toBeLessThanOrEqual(daysLow);
  });

  it("effective build days are always positive", () => {
    const state = createInitialState();
    for (const region of REGIONS) {
      for (const sector of ["oil_gas", "manufacturing", "agriculture", "tech", "infrastructure"] as const) {
        expect(effectiveBuildDays(state, sector, region.id)).toBeGreaterThan(0);
      }
    }
  });

  it("canAffordIndustry/startBuildingIndustry use the region-adjusted cost, not the flat def cost", () => {
    let state = createInitialState();
    const region = REGIONS_BY_ID.get("moscow")!;
    state = { ...state, reserves: effectiveBuildCost(state, "tech", region.id) };
    expect(canAffordIndustry(state, "tech", region.id)).toBe(true);
    state = startBuildingIndustry(state, "tech", region.id);
    expect(state.reserves).toBeCloseTo(0, 6);
  });
});

describe("policy: changeTaxBurden costs political points", () => {
  it("moves taxBurden by one step and deducts PP when affordable", () => {
    let state = createInitialState();
    state = { ...state, politicalPoints: 10 };
    const before = state.sliders.taxBurden;
    expect(canChangeTaxBurden(state, "up")).toBe(true);
    state = changeTaxBurden(state, "up");
    expect(state.sliders.taxBurden).toBe(before + 5);
    expect(state.politicalPoints).toBe(4);
  });

  it("refuses to change tax burden without enough political points", () => {
    let state = createInitialState();
    state = { ...state, politicalPoints: 1 };
    expect(canChangeTaxBurden(state, "up")).toBe(false);
    const next = changeTaxBurden(state, "up");
    expect(next.sliders.taxBurden).toBe(state.sliders.taxBurden);
    expect(next.politicalPoints).toBe(1);
  });

  it("refuses to go beyond the configured bounds even with enough PP", () => {
    let state = createInitialState();
    state = { ...state, politicalPoints: 1000, sliders: { ...state.sliders, taxBurden: 60 } };
    expect(canChangeTaxBurden(state, "up")).toBe(false);
    state = { ...state, sliders: { ...state.sliders, taxBurden: 10 } };
    expect(canChangeTaxBurden(state, "down")).toBe(false);
  });

  it("govSpendingShare and deficitMonetizationShare stay free (SET_SLIDER unaffected)", () => {
    // Регрессия: убеждаемся, что политика для налога не затронула остальные
    // поля Sliders — они по-прежнему обычные числа без PP-логики.
    const state = createInitialState();
    expect(typeof state.sliders.govSpendingShare).toBe("number");
    expect(typeof state.sliders.deficitMonetizationShare).toBe("number");
  });
});

describe("multi-turn: buildings-driven GDP stays consistent", () => {
  it("region GDP stays positive and finite over many days of active industrialization", () => {
    let state = createInitialState();
    const region = REGIONS_BY_ID.get("sverdlovsk")!;
    state = startBuildingIndustry(state, "manufacturing", region.id);
    state = startBuildingIndustry(state, "tech", region.id);

    for (let i = 0; i < 1000; i++) {
      if (state.gameOver) break;
      if (state.activeEvent) {
        const choice = state.activeEvent.choices[0];
        state = choice.requires && !choice.requires(state)
          ? { ...state, activeEvent: null }
          : choice.apply(state);
        state = { ...state, activeEvent: null };
        continue;
      }
      state = advanceOneDay(state);
    }

    const economy = state.regionEconomies[region.id];
    expect(Number.isFinite(economy.gdpIndex)).toBe(true);
    expect(economy.gdpIndex).toBeGreaterThan(0);
    expect(regionGdpUsdAnnual(economy)).toBeGreaterThan(0);
  });
});
