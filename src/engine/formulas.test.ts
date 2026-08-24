import { describe, expect, it } from "vitest";
import {
  GDP_INDEX_SCALE,
  TUNING,
  aggregateGdpIndex,
  aggregateWeightedCorruption,
  aggregateWeightedUnemployment,
  createInitialState,
} from "./constants";
import {
  computeBudget,
  computeFinancing,
  nextInflation,
  nextInterestRate,
  nextOilPrice,
  nextUnrest,
  politicalPointsGain,
} from "./formulas";
import {
  advanceRegionEconomies,
  nextRegionCorruption,
  regionMacroMultiplier,
  targetRegionUnemployment,
} from "./regionEconomy";
import { processTurn } from "./turnEngine";
import { REGIONS } from "../regions/data";

describe("formulas: boundary safety", () => {
  it("nextOilPrice stays within clamp bounds across many samples", () => {
    const state = createInitialState();
    for (let i = 0; i < 500; i++) {
      const price = nextOilPrice({ ...state, oilPrice: state.oilPrice });
      expect(Number.isFinite(price)).toBe(true);
      expect(price).toBeGreaterThanOrEqual(5);
      expect(price).toBeLessThanOrEqual(220);
    }
  });

  it("computeBudget never returns NaN at zero reserves / extreme sliders", () => {
    const state = createInitialState();
    state.reserves = 0;
    state.sliders.taxBurden = 0;
    state.sliders.govSpendingShare = 100;
    const budget = computeBudget(state, state.oilPrice);
    expect(Number.isFinite(budget.balance)).toBe(true);
    expect(Number.isFinite(budget.balancePctGdp)).toBe(true);
  });

  it("computeFinancing handles a large deficit without going negative reserves logic", () => {
    const state = createInitialState();
    const budget = computeBudget(state, state.oilPrice);
    const forcedDeficitBudget = { ...budget, balance: -1000, balancePctGdp: -50 };
    const financing = computeFinancing(state, forcedDeficitBudget);
    expect(Number.isFinite(financing.monetizedAmount)).toBe(true);
    expect(Number.isFinite(financing.newDebtAmount)).toBe(true);
    expect(financing.newDebtAmount).toBeGreaterThanOrEqual(0);
  });

  it("nextInflation stays within clamp bounds", () => {
    const state = createInitialState();
    const budget = computeBudget(state, state.oilPrice);
    const financing = computeFinancing(state, budget);
    const inflation = nextInflation(state, financing, 10);
    expect(inflation).toBeGreaterThanOrEqual(-10);
    expect(inflation).toBeLessThanOrEqual(200);
  });

  it("nextUnrest stays within 0-100 at extreme inputs", () => {
    const state = createInitialState();
    state.inflationRateAnnual = 150;
    state.unemploymentRate = 40;
    state.corruption = 100;
    state.approval = 0;
    const unrest = nextUnrest(state);
    expect(unrest).toBeGreaterThanOrEqual(0);
    expect(unrest).toBeLessThanOrEqual(100);
  });

  it("nextInterestRate stays within sane bounds even at very high debt", () => {
    const state = createInitialState();
    state.publicDebt = 250;
    state.reserves = 0;
    const rate = nextInterestRate(state);
    expect(rate).toBeGreaterThanOrEqual(3);
    expect(rate).toBeLessThanOrEqual(40);
  });

  it("politicalPointsGain never goes negative", () => {
    const state = createInitialState();
    state.approval = 0;
    state.socialUnrest = 100;
    const gain = politicalPointsGain(state);
    expect(gain).toBeGreaterThanOrEqual(0.5);
  });
});

describe("regionEconomy: boundary safety and specialization effects", () => {
  it("regionMacroMultiplier/targetRegionUnemployment/nextRegionCorruption stay within clamp bounds at extremes", () => {
    const state = createInitialState();
    state.socialUnrest = 100;
    state.sliders.taxBurden = 60;
    state.inflationRateAnnual = 150;
    state.oilPrice = 200;
    for (const region of REGIONS) {
      const economy = state.regionEconomies[region.id];
      const multiplier = regionMacroMultiplier(region, economy, state, state.oilPrice);
      expect(multiplier).toBeGreaterThanOrEqual(TUNING.regionMacro.floor);
      expect(multiplier).toBeLessThanOrEqual(TUNING.regionMacro.ceiling);

      const unemployment = targetRegionUnemployment(region, []);
      expect(unemployment).toBeGreaterThanOrEqual(2);
      expect(unemployment).toBeLessThanOrEqual(40);

      const corruption = nextRegionCorruption(region, economy, state, state.oilPrice);
      expect(corruption).toBeGreaterThanOrEqual(0);
      expect(corruption).toBeLessThanOrEqual(100);
    }
  });

  it("oil/gas regions are more sensitive to oil price swings than a non-specialized region", () => {
    const state = createInitialState();
    const oilRegion = REGIONS.find((r) => r.specializations.includes("oil"))!;
    const plainRegion = REGIONS.find(
      (r) =>
        !r.specializations.includes("oil") && !r.specializations.includes("gas"),
    )!;
    const highOilPrice = state.oilPriceMeanTarget + 50;

    const oilMultiplierAtTarget = regionMacroMultiplier(
      oilRegion,
      state.regionEconomies[oilRegion.id],
      state,
      state.oilPriceMeanTarget,
    );
    const oilMultiplierHigh = regionMacroMultiplier(
      oilRegion,
      state.regionEconomies[oilRegion.id],
      state,
      highOilPrice,
    );
    const plainMultiplierAtTarget = regionMacroMultiplier(
      plainRegion,
      state.regionEconomies[plainRegion.id],
      state,
      state.oilPriceMeanTarget,
    );
    const plainMultiplierHigh = regionMacroMultiplier(
      plainRegion,
      state.regionEconomies[plainRegion.id],
      state,
      highOilPrice,
    );

    const oilDelta = Math.abs(oilMultiplierHigh - oilMultiplierAtTarget);
    const plainDelta = Math.abs(plainMultiplierHigh - plainMultiplierAtTarget);
    expect(oilDelta).toBeGreaterThan(plainDelta);
  });

  it("unemployment moves gradually toward the target when a region's jobs suddenly change, not instantly", () => {
    const state = createInitialState();
    const region = [...REGIONS].sort((a, b) => b.population - a.population)[0];
    const before = state.regionEconomies[region.id].unemploymentRate;

    // Резкая потеря всех предприятий региона — цель безработицы подскакивает,
    // но фактическое значение должно сдвинуться лишь частично за один ход.
    const stripped = {
      ...state,
      industries: state.industries.filter((i) => i.regionId !== region.id),
    };
    const next = advanceRegionEconomies(stripped, stripped.oilPrice, {});
    const target = targetRegionUnemployment(region, []);
    const after = next[region.id].unemploymentRate;

    expect(after).toBeGreaterThanOrEqual(2);
    expect(after).toBeLessThanOrEqual(40);
    if (Math.abs(target - before) > 1) {
      expect(Math.abs(after - before)).toBeLessThan(Math.abs(target - before));
    }
  });

  it("aggregateGdpIndex/WeightedUnemployment/WeightedCorruption match manual weighted calculation", () => {
    const state = createInitialState();
    const manualGdpSum = REGIONS.reduce(
      (sum, r) => sum + state.regionEconomies[r.id].gdpIndex,
      0,
    );
    const totalPopulation = REGIONS.reduce((sum, r) => sum + r.population, 0);
    const manualUnemployment =
      REGIONS.reduce(
        (sum, r) =>
          sum + state.regionEconomies[r.id].unemploymentRate * r.population,
        0,
      ) / totalPopulation;
    const manualCorruption =
      REGIONS.reduce(
        (sum, r) =>
          sum + state.regionEconomies[r.id].corruptionIndex * r.population,
        0,
      ) / totalPopulation;

    expect(aggregateGdpIndex(state.regionEconomies)).toBeCloseTo(
      manualGdpSum * GDP_INDEX_SCALE,
      6,
    );
    expect(aggregateWeightedUnemployment(state.regionEconomies)).toBeCloseTo(
      manualUnemployment,
      6,
    );
    expect(aggregateWeightedCorruption(state.regionEconomies)).toBeCloseTo(
      manualCorruption,
      6,
    );
    // Стартовое состояние должно быть согласовано само с собой: агрегат
    // регионов при старте игры равен нацполям в createInitialState.
    expect(aggregateGdpIndex(state.regionEconomies)).toBeCloseTo(state.gdpIndex, 6);
    expect(aggregateWeightedUnemployment(state.regionEconomies)).toBeCloseTo(
      state.unemploymentRate,
      6,
    );
    expect(aggregateWeightedCorruption(state.regionEconomies)).toBeCloseTo(
      state.corruption,
      6,
    );
  });
});

describe("turnEngine: processTurn integration", () => {
  it("advances the date and turn counter by one quarter", () => {
    const state = createInitialState();
    const next = processTurn(state);
    expect(next.turn).toBe(2);
    expect(next.quarter).toBe(2);
    expect(next.year).toBe(2000);
  });

  it("rolls over to the next year after Q4", () => {
    let state = createInitialState();
    state = { ...state, quarter: 4 };
    const next = processTurn(state);
    expect(next.quarter).toBe(1);
    expect(next.year).toBe(2001);
  });

  it("does not advance when the game is over", () => {
    const state = createInitialState();
    state.gameOver = { reason: "test" };
    const next = processTurn(state);
    expect(next.turn).toBe(state.turn);
  });

  it("does not advance while an event awaits a choice", () => {
    const state = createInitialState();
    state.activeEvent = {
      id: "x",
      title: "t",
      description: "d",
      choices: [],
    };
    const next = processTurn(state);
    expect(next.turn).toBe(state.turn);
  });

  it("survives 200 consecutive turns without producing NaN state", () => {
    let state = createInitialState();
    for (let i = 0; i < 200; i++) {
      if (state.activeEvent) {
        const choice = state.activeEvent.choices[0];
        state = choice.requires && !choice.requires(state)
          ? { ...state, activeEvent: null }
          : choice.apply(state);
        state = { ...state, activeEvent: null };
        continue;
      }
      if (state.gameOver) break;
      state = processTurn(state);
    }
    expect(Number.isFinite(state.gdpIndex)).toBe(true);
    expect(Number.isFinite(state.reserves)).toBe(true);
    expect(Number.isFinite(state.publicDebt)).toBe(true);
    expect(Number.isFinite(state.approval)).toBe(true);

    for (const region of REGIONS) {
      const economy = state.regionEconomies[region.id];
      expect(Number.isFinite(economy.gdpIndex)).toBe(true);
      expect(Number.isFinite(economy.unemploymentRate)).toBe(true);
      expect(economy.unemploymentRate).toBeGreaterThanOrEqual(2);
      expect(economy.unemploymentRate).toBeLessThanOrEqual(40);
      expect(Number.isFinite(economy.corruptionIndex)).toBe(true);
      expect(economy.corruptionIndex).toBeGreaterThanOrEqual(0);
      expect(economy.corruptionIndex).toBeLessThanOrEqual(100);
      expect(Number.isFinite(economy.infrastructureLevel)).toBe(true);
      expect(economy.infrastructureLevel).toBeGreaterThanOrEqual(0);
      expect(economy.infrastructureLevel).toBeLessThanOrEqual(100);
    }
  });
});
