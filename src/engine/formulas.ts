import { CLAMP, TUNING, clamp } from "./constants";
import type { GameState, MetricKey, SanctionState } from "./types";

export function gaussianNoise(stdDev: number): number {
  // Box-Muller
  const u1 = Math.max(Math.random(), 1e-9);
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return z * stdDev;
}

export function sumModifier(state: GameState, key: MetricKey): number {
  return state.activeReforms.reduce(
    (acc, mod) => acc + (mod.effects[key] ?? 0),
    0,
  );
}

export function sanctionsGrowthDrag(sanctions: SanctionState[]): number {
  return sanctions.reduce((acc, s) => acc + s.growthDragPct, 0);
}

export function sanctionsInterestPremium(sanctions: SanctionState[]): number {
  return sanctions.reduce((acc, s) => acc + s.interestRatePremium, 0);
}

export function sanctionsOilDiscount(sanctions: SanctionState[]): number {
  const totalPct = sanctions.reduce(
    (acc, s) => acc + s.oilExportDiscountPct,
    0,
  );
  return clamp(totalPct, [0, 90]) / 100;
}

/** 1. Обновление цены нефти: mean-reverting random walk. */
export function nextOilPrice(state: GameState): number {
  const { reversionSpeed, noiseStdDev } = TUNING.oil;
  const delta =
    reversionSpeed * (state.oilPriceMeanTarget - state.oilPrice) +
    gaussianNoise(noiseStdDev);
  return clamp(state.oilPrice + delta, CLAMP.oilPrice);
}

/** Объём экспорта углеводородов, растущий с индустриализацией нефтегазового сектора. */
export function hydrocarbonExportVolume(state: GameState): number {
  const fromIndustries = state.industries
    .filter((i) => i.sector === "oil_gas" && i.status === "operational")
    .reduce((acc, i) => acc + i.exportVolumeContribution, 0);
  return TUNING.budget.baseHydrocarbonExportVolume + fromIndustries;
}

export function taxCollectionEfficiency(state: GameState): number {
  const base = 1 - state.corruption / 200;
  const mod = sumModifier(state, "taxCollectionEfficiency");
  return clamp(base + mod, [0.35, 1]);
}

export interface BudgetResult {
  taxRevenue: number;
  hydrocarbonRevenue: number;
  otherRevenue: number;
  totalRevenue: number;
  govSpending: number;
  industryMaintenance: number;
  debtService: number;
  totalExpenditure: number;
  balance: number; // $ млрд за ход (квартал)
  balancePctGdp: number;
}

const GDP_TO_USD_BN = 6.5; // условный масштаб: 1 индексный пункт ВВП ~= $6.5 млрд/квартал

/** 2-4. Расчёт доходов/расходов бюджета за ход. */
export function computeBudget(
  state: GameState,
  oilPrice: number,
): BudgetResult {
  const gdpUsdQuarter = state.gdpIndex * GDP_TO_USD_BN;
  const taxRevenue =
    gdpUsdQuarter * (state.sliders.taxBurden / 100) * taxCollectionEfficiency(state);

  const exportVolume = hydrocarbonExportVolume(state);
  const oilDiscount = sanctionsOilDiscount(state.sanctions);
  const effectiveOilPrice = oilPrice * (1 - oilDiscount);
  const hydrocarbonRevenue =
    exportVolume * effectiveOilPrice * TUNING.budget.royaltyShare;

  const otherRevenue = gdpUsdQuarter * TUNING.budget.otherRevenueShareOfGdp;
  const totalRevenue = taxRevenue + hydrocarbonRevenue + otherRevenue;

  const govSpending = gdpUsdQuarter * (state.sliders.govSpendingShare / 100);
  const industryMaintenance = state.industries
    .filter((i) => i.status === "operational")
    .reduce((acc, i) => acc + i.maintenanceCost, 0);
  const debtService =
    ((state.publicDebt / 100) * gdpUsdQuarter * (state.effectiveInterestRate / 100)) /
    4;
  const totalExpenditure = govSpending + industryMaintenance + debtService;

  const balance = totalRevenue - totalExpenditure;
  const balancePctGdp = (balance / gdpUsdQuarter) * 100;

  return {
    taxRevenue,
    hydrocarbonRevenue,
    otherRevenue,
    totalRevenue,
    govSpending,
    industryMaintenance,
    debtService,
    totalExpenditure,
    balance,
    balancePctGdp,
  };
}

export interface FinancingResult {
  monetizedAmount: number;
  newDebtAmount: number;
  reserveDrawAmount: number;
  reserveSaveAmount: number;
}

/** 5. Финансирование дефицита/распределение профицита. */
export function computeFinancing(
  state: GameState,
  budget: BudgetResult,
): FinancingResult {
  if (budget.balance >= 0) {
    return {
      monetizedAmount: 0,
      newDebtAmount: 0,
      reserveDrawAmount: 0,
      reserveSaveAmount: budget.balance * TUNING.budget.reserveSaveRatio,
    };
  }
  const deficit = -budget.balance;
  const monetizedAmount = deficit * (state.sliders.deficitMonetizationShare / 100);
  let remainder = deficit - monetizedAmount;

  const maxReserveDraw = state.reserves * TUNING.budget.reserveDrawMaxShare;
  const reserveDrawAmount = Math.min(remainder * 0.3, maxReserveDraw);
  remainder -= reserveDrawAmount;

  const newDebtAmount = Math.max(remainder, 0);

  return {
    monetizedAmount,
    newDebtAmount,
    reserveDrawAmount,
    reserveSaveAmount: 0,
  };
}

export { GDP_TO_USD_BN };

/** 6. Инфляция. */
export function nextInflation(
  state: GameState,
  financing: FinancingResult,
  oilPriceDelta: number,
): number {
  const gdpUsdQuarter = state.gdpIndex * GDP_TO_USD_BN;
  const monetizationShareOfGdp = financing.monetizedAmount / gdpUsdQuarter;
  const unemploymentGap = Math.max(
    0,
    TUNING.unemployment.naturalRate - state.unemploymentRate,
  );

  const next =
    TUNING.inflation.persistence * state.inflationRateAnnual +
    (1 - TUNING.inflation.persistence) * 4 + // якорь долгосрочных ожиданий
    TUNING.inflation.monetizationCoefficient * monetizationShareOfGdp * 100 +
    TUNING.inflation.unemploymentGapCoefficient * unemploymentGap -
    TUNING.inflation.oilStrengthDisinflation * Math.max(oilPriceDelta, 0) +
    gaussianNoise(TUNING.inflation.noiseStdDev);

  return clamp(next, CLAMP.inflation);
}

/** 7. Потенциальный и фактический рост ВВП. */
export function potentialGrowth(state: GameState): number {
  const decayed =
    TUNING.growth.initialPotential -
    TUNING.growth.potentialDecayPerTurn * state.turn;
  return Math.max(decayed, TUNING.growth.potentialFloor);
}

export function nextGrowth(state: GameState, oilPrice: number): number {
  const potential = potentialGrowth(state);

  const taxDrag =
    TUNING.growth.taxDragCoefficient *
    Math.max(state.sliders.taxBurden - 25, 0);

  const inflationExcess = Math.max(
    state.inflationRateAnnual - TUNING.growth.inflationDragThreshold,
    0,
  );
  const inflationDrag = TUNING.growth.inflationDragCoefficient * inflationExcess;

  const unrestDrag = TUNING.growth.unrestDragCoefficient * state.socialUnrest;

  const newlyOperational = state.industries.filter(
    (i) => i.status === "operational",
  ).length;
  const industryBoost =
    TUNING.growth.industryGrowthContribution * Math.min(newlyOperational, 6);

  const oilBoost =
    TUNING.growth.oilPriceGrowthCoefficient * (oilPrice - state.oilPriceMeanTarget);

  const sanctionsDrag = sanctionsGrowthDrag(state.sanctions);

  const reformModifier = sumModifier(state, "gdpGrowthRateAnnual");

  const next =
    potential -
    taxDrag -
    inflationDrag -
    unrestDrag -
    sanctionsDrag +
    industryBoost +
    oilBoost +
    reformModifier +
    gaussianNoise(TUNING.growth.noiseStdDev);

  return clamp(next, CLAMP.gdpGrowth);
}

/** 8. Безработица (упрощённый закон Оукена + прямые рабочие места новых заводов). */
export function nextUnemployment(
  state: GameState,
  growth: number,
  newlyCompletedJobs: number,
): number {
  const potential = potentialGrowth(state);
  const growthGap = growth - potential;
  const fromOkun = -TUNING.unemployment.okunCoefficient * (growthGap / 4);
  const fromJobs = -newlyCompletedJobs / TUNING.unemployment.jobsToRateDivisor;
  const reversion =
    TUNING.unemployment.meanReversion *
    (TUNING.unemployment.naturalRate - state.unemploymentRate);

  const next = state.unemploymentRate + fromOkun + fromJobs + reversion;
  return clamp(next, CLAMP.unemployment);
}

/** 9. Коррупция. */
export function nextCorruption(state: GameState): number {
  const oilRentDrift =
    TUNING.corruption.oilRentDriftCoefficient * Math.max(state.oilPrice - 40, 0);
  const decay =
    TUNING.corruption.decayRate *
    (TUNING.corruption.decayToward - state.corruption);
  const reformModifier = sumModifier(state, "corruption");

  const next = state.corruption + oilRentDrift + decay + reformModifier;
  return clamp(next, CLAMP.percent);
}

/** 10. Социальное недовольство. */
export function nextUnrest(state: GameState): number {
  const target =
    TUNING.unrest.inflationCoefficient * Math.max(state.inflationRateAnnual - 6, 0) +
    TUNING.unrest.unemploymentCoefficient *
      Math.max(state.unemploymentRate - 6, 0) +
    TUNING.unrest.corruptionCoefficient * state.corruption -
    TUNING.unrest.approvalRelief * state.approval;

  const reformModifier = sumModifier(state, "socialUnrest");
  const blended =
    TUNING.unrest.inertia * state.socialUnrest +
    (1 - TUNING.unrest.inertia) * Math.max(target, 0) +
    reformModifier;

  return clamp(blended, CLAMP.percent);
}

/** 11. Одобрение. */
export function nextApproval(
  state: GameState,
  growth: number,
  prevUnemployment: number,
  nextUnemploymentRate: number,
): number {
  const honeymoonTarget =
    TUNING.approval.honeymoonBaseline -
    TUNING.approval.honeymoonDecayPerTurn * state.turn;

  const delta =
    TUNING.approval.growthCoefficient * (growth - potentialGrowth(state)) / 4 -
    TUNING.approval.inflationCoefficient *
      Math.max(state.inflationRateAnnual - 8, 0) / 4 -
    TUNING.approval.unemploymentDeltaCoefficient *
      (nextUnemploymentRate - prevUnemployment) -
    TUNING.approval.corruptionCoefficient * (state.corruption / 100) -
    TUNING.approval.unrestCoefficient * (state.socialUnrest / 100);

  const reversion =
    TUNING.approval.meanReversion * (honeymoonTarget - state.approval);

  const reformModifier = sumModifier(state, "approval");

  const next = state.approval + delta + reversion + reformModifier;
  return clamp(next, CLAMP.percent);
}

/** 12. Прирост политических очков за ход. */
export function politicalPointsGain(state: GameState): number {
  const base = TUNING.politicalPoints.base;
  const fromApproval =
    TUNING.politicalPoints.approvalCoefficient * Math.max(state.approval - 50, 0);
  const unrestPenalty =
    TUNING.politicalPoints.unrestPenaltyCoefficient * Math.max(state.socialUnrest - 30, 0);
  const reformModifier = sumModifier(state, "politicalPointsPerTurn");
  return Math.max(base + fromApproval - unrestPenalty + reformModifier, 0.5);
}

/** Эффективная ставка по новому долгу от риск-премии (долг/ВВП, резервы, санкции). */
export function nextInterestRate(state: GameState): number {
  const debtRisk =
    TUNING.debt.debtRiskCoefficient * Math.max(state.publicDebt - 40, 0);
  const reservesRelief =
    TUNING.debt.reservesRiskRelief * Math.min(state.reserves / 20, 3);
  const sanctionsPremium = sanctionsInterestPremium(state.sanctions);
  const reformModifier = sumModifier(state, "effectiveInterestRate");

  const next =
    TUNING.debt.baseInterestRate +
    debtRisk -
    reservesRelief +
    sanctionsPremium +
    reformModifier;

  return clamp(next, [3, 40]);
}
