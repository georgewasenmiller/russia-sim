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
import { applyReform } from "./reforms";
import {
  advanceRegionEconomies,
  nextRegionCorruption,
  regionMacroMultiplier,
  targetRegionUnemployment,
} from "./regionEconomy";
import { advanceOneDay } from "./turnEngine";
import { REGIONS } from "../regions/data";

const DAY = 1;

describe("formulas: boundary safety", () => {
  it("nextOilPrice stays within clamp bounds across many samples", () => {
    const state = createInitialState();
    for (let i = 0; i < 500; i++) {
      const price = nextOilPrice({ ...state, oilPrice: state.oilPrice }, DAY);
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
    const budget = computeBudget(state, state.oilPrice, DAY);
    expect(Number.isFinite(budget.balance)).toBe(true);
    expect(Number.isFinite(budget.balancePctGdp)).toBe(true);
  });

  it("computeFinancing handles a large deficit without going negative reserves logic", () => {
    const state = createInitialState();
    const budget = computeBudget(state, state.oilPrice, DAY);
    const forcedDeficitBudget = { ...budget, balance: -1000, balancePctGdp: -50 };
    const financing = computeFinancing(state, forcedDeficitBudget, DAY);
    expect(Number.isFinite(financing.monetizedAmount)).toBe(true);
    expect(Number.isFinite(financing.newDebtAmount)).toBe(true);
    expect(financing.newDebtAmount).toBeGreaterThanOrEqual(0);
  });

  it("nextInflation stays within clamp bounds", () => {
    const state = createInitialState();
    const budget = computeBudget(state, state.oilPrice, DAY);
    const financing = computeFinancing(state, budget, DAY);
    const inflation = nextInflation(state, financing, 10, DAY);
    expect(inflation).toBeGreaterThanOrEqual(-10);
    expect(inflation).toBeLessThanOrEqual(200);
  });

  it("nextUnrest stays within 0-100 at extreme inputs", () => {
    const state = createInitialState();
    state.inflationRateAnnual = 150;
    state.unemploymentRate = 40;
    state.corruption = 100;
    state.approval = 0;
    const unrest = nextUnrest(state, DAY);
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
    const gain = politicalPointsGain(state, DAY);
    expect(gain).toBeGreaterThan(0);
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
      const multiplier = regionMacroMultiplier(region, economy, state, state.oilPrice, DAY);
      expect(multiplier).toBeGreaterThanOrEqual(TUNING.regionMacro.floor);
      expect(multiplier).toBeLessThanOrEqual(TUNING.regionMacro.ceiling);

      const unemployment = targetRegionUnemployment(region, []);
      expect(unemployment).toBeGreaterThanOrEqual(2);
      expect(unemployment).toBeLessThanOrEqual(40);

      const corruption = nextRegionCorruption(region, economy, state, state.oilPrice, DAY);
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
      DAY,
    );
    const oilMultiplierHigh = regionMacroMultiplier(
      oilRegion,
      state.regionEconomies[oilRegion.id],
      state,
      highOilPrice,
      DAY,
    );
    const plainMultiplierAtTarget = regionMacroMultiplier(
      plainRegion,
      state.regionEconomies[plainRegion.id],
      state,
      state.oilPriceMeanTarget,
      DAY,
    );
    const plainMultiplierHigh = regionMacroMultiplier(
      plainRegion,
      state.regionEconomies[plainRegion.id],
      state,
      highOilPrice,
      DAY,
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
    // но фактическое значение должно сдвинуться лишь частично за один суточный тик.
    const stripped = {
      ...state,
      industries: state.industries.filter((i) => i.regionId !== region.id),
    };
    const next = advanceRegionEconomies(stripped, stripped.oilPrice, {}, DAY);
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

describe("turnEngine: advanceOneDay integration", () => {
  it("advances gameTimeDays by exactly one day per call", () => {
    const state = createInitialState();
    const next = advanceOneDay(state);
    expect(next.gameTimeDays).toBe(state.gameTimeDays + 1);
  });

  it("increments turn/quarter/year only once a full 90-day quarter has elapsed, not every day", () => {
    let state = createInitialState();
    for (let i = 0; i < 89; i++) {
      state = advanceOneDay(state);
    }
    expect(state.turn).toBe(1); // ещё не пересекли границу квартала
    state = advanceOneDay(state); // 90-й день — граница квартала пересечена
    expect(state.turn).toBe(2);
    expect(state.quarter).toBe(2);
    expect(state.year).toBe(2000);
  });

  it("rolls over to the next year after Q4", () => {
    let state = createInitialState();
    for (let i = 0; i < 90 * 4; i++) {
      state = advanceOneDay(state);
    }
    expect(state.quarter).toBe(1);
    expect(state.year).toBe(2001);
  });

  it("does not advance when the game is over", () => {
    const state = createInitialState();
    state.gameOver = { reason: "test" };
    const next = advanceOneDay(state);
    expect(next.gameTimeDays).toBe(state.gameTimeDays);
  });

  it("does not advance while an event awaits a choice", () => {
    const state = createInitialState();
    state.activeEvent = {
      id: "x",
      title: "t",
      description: "d",
      choices: [],
    };
    const next = advanceOneDay(state);
    expect(next.gameTimeDays).toBe(state.gameTimeDays);
  });

  it("reforms/history tick only at quarter boundaries (every 90 days), not every day", () => {
    let state = createInitialState();
    state = { ...state, politicalPoints: 20 };
    state = applyReform(state, "anti_corruption_agency"); // duration: 12 ходов
    const initialTurnsRemaining = state.activeReforms[0]!.turnsRemaining;

    function stepSkippingEvents(s: typeof state, days: number) {
      for (let i = 0; i < days; i++) {
        if (s.activeEvent) s = { ...s, activeEvent: null };
        s = advanceOneDay(s);
      }
      return s;
    }

    state = stepSkippingEvents(state, 45); // меньше 90 дней — квартал не пересечён
    expect(state.activeReforms[0]!.turnsRemaining).toBe(initialTurnsRemaining);
    expect(state.history.length).toBe(0);

    state = stepSkippingEvents(state, 45); // итого 90 — граница пересечена ровно один раз
    expect(state.activeReforms[0]!.turnsRemaining).toBe(initialTurnsRemaining! - 1);
    expect(state.history.length).toBe(1);
  });

  it("survives 2000 consecutive days without producing NaN state", () => {
    let state = createInitialState();
    for (let i = 0; i < 2000; i++) {
      if (state.activeEvent) {
        const choice = state.activeEvent.choices[0];
        state = choice.requires && !choice.requires(state)
          ? { ...state, activeEvent: null }
          : choice.apply(state);
        state = { ...state, activeEvent: null };
        continue;
      }
      if (state.gameOver) break;
      state = advanceOneDay(state);
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
