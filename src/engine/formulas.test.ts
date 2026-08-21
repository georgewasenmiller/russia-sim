import { describe, expect, it } from "vitest";
import { createInitialState } from "./constants";
import {
  computeBudget,
  computeFinancing,
  nextCorruption,
  nextGrowth,
  nextInflation,
  nextInterestRate,
  nextOilPrice,
  nextUnemployment,
  nextUnrest,
  politicalPointsGain,
} from "./formulas";
import { processTurn } from "./turnEngine";

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

  it("nextGrowth stays within clamp bounds at extreme unrest/tax", () => {
    const state = createInitialState();
    state.socialUnrest = 100;
    state.sliders.taxBurden = 60;
    state.inflationRateAnnual = 150;
    const growth = nextGrowth(state, state.oilPrice);
    expect(growth).toBeGreaterThanOrEqual(-25);
    expect(growth).toBeLessThanOrEqual(25);
  });

  it("nextUnemployment stays within clamp bounds", () => {
    const state = createInitialState();
    const rate = nextUnemployment(state, -20, 0);
    expect(rate).toBeGreaterThanOrEqual(2);
    expect(rate).toBeLessThanOrEqual(40);
  });

  it("nextCorruption and nextUnrest stay within 0-100", () => {
    const state = createInitialState();
    state.oilPrice = 200;
    const corruption = nextCorruption(state);
    expect(corruption).toBeGreaterThanOrEqual(0);
    expect(corruption).toBeLessThanOrEqual(100);

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
  });
});
