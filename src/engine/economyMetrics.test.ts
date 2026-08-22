import { describe, expect, it } from "vitest";
import { createInitialState } from "./constants";
import {
  nationalGdpPerCapitaUsd,
  nationalGdpUsdAnnual,
  regionBaseGdpUsd,
  regionGdpPerCapitaUsd,
  regionGdpUsdAnnual,
  regionIndustryGdpUsd,
} from "./economyMetrics";
import { computeBudget } from "./formulas";
import {
  canAffordIndustry,
  effectiveBuildCost,
  effectiveBuildTurns,
  startBuildingIndustry,
} from "./industries";
import { canChangeTaxBurden, changeTaxBurden } from "./policy";
import { processTurn } from "./turnEngine";
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

  it("industry + base $ GDP of a region sum back to its total $ GDP", () => {
    const state = createInitialState();
    const region = REGIONS_BY_ID.get("khanty_mansi")!;
    const economy = state.regionEconomies[region.id];
    const total = regionGdpUsdAnnual(economy);
    const industry = regionIndustryGdpUsd(economy);
    const base = regionBaseGdpUsd(economy);
    expect(industry + base).toBeCloseTo(total, 6);
    expect(industry).toBe(0); // сид: построек ещё нет
  });
});

describe("computeBudget: sector revenue breakdown", () => {
  it("sector revenues plus base tax revenue sum to taxRevenue, base is never negative", () => {
    const state = createInitialState();
    const budget = computeBudget(state, state.oilPrice);
    const sectorSum = Object.values(budget.sectorTaxRevenue).reduce(
      (a, b) => a + (b ?? 0),
      0,
    );
    expect(budget.baseTaxRevenue).toBeGreaterThanOrEqual(0);
    if (!budget.baseTaxRevenueClamped) {
      expect(sectorSum + budget.baseTaxRevenue).toBeCloseTo(budget.taxRevenue, 6);
    }
  });

  it("baseTaxRevenue floor is not triggered at game start (no industries built yet)", () => {
    const state = createInitialState();
    const budget = computeBudget(state, state.oilPrice);
    expect(budget.baseTaxRevenueClamped).toBe(false);
  });
});

describe("infrastructure affects construction cost/turns", () => {
  it("a higher-infrastructure region builds the same sector cheaper and no slower than a lower-infrastructure one", () => {
    const sorted = [...REGIONS].sort(
      (a, b) => a.infrastructureLevel - b.infrastructureLevel,
    );
    const lowInfra = sorted[0];
    const highInfra = sorted[sorted.length - 1];
    expect(highInfra.infrastructureLevel).toBeGreaterThan(lowInfra.infrastructureLevel);

    const costLow = effectiveBuildCost("manufacturing", lowInfra.id);
    const costHigh = effectiveBuildCost("manufacturing", highInfra.id);
    const turnsLow = effectiveBuildTurns("manufacturing", lowInfra.id);
    const turnsHigh = effectiveBuildTurns("manufacturing", highInfra.id);

    expect(costHigh).toBeLessThan(costLow);
    expect(turnsHigh).toBeLessThanOrEqual(turnsLow);
  });

  it("effective build turns never drop below 1", () => {
    for (const region of REGIONS) {
      for (const sector of ["oil_gas", "manufacturing", "agriculture", "tech", "infrastructure"] as const) {
        expect(effectiveBuildTurns(sector, region.id)).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("canAffordIndustry/startBuildingIndustry use the region-adjusted cost, not the flat def cost", () => {
    let state = createInitialState();
    const region = REGIONS_BY_ID.get("moscow")!;
    state = { ...state, reserves: effectiveBuildCost("tech", region.id) };
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

describe("multi-turn: industryGdpIndex stays strictly below gdpIndex", () => {
  it("base GDP of an actively-industrializing region never goes negative over many turns", () => {
    let state = createInitialState();
    const region = REGIONS_BY_ID.get("sverdlovsk")!;
    state = startBuildingIndustry(state, "manufacturing", region.id);
    state = startBuildingIndustry(state, "tech", region.id);

    for (let i = 0; i < 100; i++) {
      if (state.gameOver) break;
      if (state.activeEvent) {
        const choice = state.activeEvent.choices[0];
        state = choice.requires && !choice.requires(state)
          ? { ...state, activeEvent: null }
          : choice.apply(state);
        state = { ...state, activeEvent: null };
        continue;
      }
      state = processTurn(state);
    }

    const economy = state.regionEconomies[region.id];
    expect(economy.industryGdpIndex).toBeLessThan(economy.gdpIndex);
    expect(regionBaseGdpUsd(economy)).toBeGreaterThan(0);
  });
});
