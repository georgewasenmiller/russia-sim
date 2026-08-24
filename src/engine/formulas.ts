import { CLAMP, GDP_INDEX_SCALE, TUNING, clamp } from "./constants";
import {
  DAYS_PER_QUARTER,
  DAYS_PER_YEAR,
  convergenceRate,
  flowScale,
  noiseScale,
  retentionRate,
} from "./time";
import type { GameState, IndustrySector, MetricKey, SanctionState } from "./types";

const INDUSTRY_SECTORS: IndustrySector[] = [
  "oil_gas",
  "manufacturing",
  "agriculture",
  "tech",
  "infrastructure",
];

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

/**
 * 1. Обновление цены нефти: mean-reverting random walk. `days` — сколько
 * игровых суток покрывает этот вызов; reversionSpeed/noiseStdDev
 * откалиброваны за квартал (90 суток) и переводятся точной
 * экспоненциальной/корневой формулой (см. src/engine/time.ts) — при
 * days=90 совпадает с прежним поведением тождественно.
 */
export function nextOilPrice(state: GameState, days: number): number {
  const { reversionSpeed, noiseStdDev } = TUNING.oil;
  const delta =
    convergenceRate(reversionSpeed, days) * (state.oilPriceMeanTarget - state.oilPrice) +
    gaussianNoise(noiseScale(noiseStdDev, days));
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
  sectorTaxRevenue: Partial<Record<IndustrySector, number>>;
  baseTaxRevenue: number;
  /** true, если защитный пол max(...,0) реально отсёк отрицательное значение. */
  baseTaxRevenueClamped: boolean;
  hydrocarbonRevenue: number;
  otherRevenue: number;
  totalRevenue: number;
  govSpending: number;
  industryMaintenance: number;
  debtService: number;
  totalExpenditure: number;
  balance: number; // $ млрд за этот период (days игровых суток)
  balancePctGdp: number;
}

const GDP_TO_USD_BN = 6.5; // условный масштаб: 1 индексный пункт ВВП ~= $6.5 млрд/квартал

/**
 * 2-4. Расчёт доходов/расходов бюджета за `days` игровых суток. Все $-
 * потоковые поля пропорциональны `days` (через gdpUsdPeriod/flowScale);
 * доли/проценты (balancePctGdp, доля сектора в ВВП, эффективность сбора
 * налогов) — не масштабируются, они не зависят от размера периода. При
 * days=DAYS_PER_QUARTER числа тождественно совпадают со старой квартальной
 * моделью.
 */
export function computeBudget(
  state: GameState,
  oilPrice: number,
  days: number,
): BudgetResult {
  const periodFraction = days / DAYS_PER_QUARTER;
  const gdpUsdPeriod = state.gdpIndex * GDP_TO_USD_BN * periodFraction;
  const taxRevenue =
    gdpUsdPeriod * (state.sliders.taxBurden / 100) * taxCollectionEfficiency(state);

  // Разбивка taxRevenue по секторам, пропорционально доле каждого сектора
  // в текущем ВВП за этот же период (сумма outputContribution его
  // действующих предприятий по всем регионам, приведённая к той же
  // $-шкале через GDP_INDEX_SCALE — той же шкале, что и state.gdpIndex,
  // так как ВВП региона теперь буквально складывается из этой же суммы,
  // см. regionEconomy.ts). Остаток — налог с не завязанной на конкретные
  // постройки части экономики (baseTaxRevenue: множитель продуктивности,
  // нефтегазовая рента — см. план "Причинность экономики...").
  const sectorTaxRevenue: Partial<Record<IndustrySector, number>> = {};
  let attributedTaxRevenue = 0;
  for (const sector of INDUSTRY_SECTORS) {
    const sectorOutput = state.industries
      .filter((i) => i.sector === sector && i.status === "operational")
      .reduce((acc, i) => acc + i.outputContribution, 0);
    const sectorOutputUsdPeriod = sectorOutput * GDP_INDEX_SCALE * GDP_TO_USD_BN * periodFraction;
    const sectorShare = gdpUsdPeriod > 0 ? sectorOutputUsdPeriod / gdpUsdPeriod : 0;
    const revenue = taxRevenue * sectorShare;
    sectorTaxRevenue[sector] = revenue;
    attributedTaxRevenue += revenue;
  }
  const baseTaxRevenueRaw = taxRevenue - attributedTaxRevenue;
  const baseTaxRevenue = Math.max(baseTaxRevenueRaw, 0);
  const baseTaxRevenueClamped = baseTaxRevenueRaw < 0;

  const exportVolume = hydrocarbonExportVolume(state);
  const oilDiscount = sanctionsOilDiscount(state.sanctions);
  const effectiveOilPrice = oilPrice * (1 - oilDiscount);
  const hydrocarbonRevenue = flowScale(
    exportVolume * effectiveOilPrice * TUNING.budget.royaltyShare,
    days,
  );

  const otherRevenue = gdpUsdPeriod * TUNING.budget.otherRevenueShareOfGdp;
  const totalRevenue = taxRevenue + hydrocarbonRevenue + otherRevenue;

  const govSpending = gdpUsdPeriod * (state.sliders.govSpendingShare / 100);
  const industryMaintenance = flowScale(
    state.industries
      .filter((i) => i.status === "operational")
      .reduce((acc, i) => acc + i.maintenanceCost, 0),
    days,
  );
  const debtService =
    ((state.publicDebt / 100) * gdpUsdPeriod * (state.effectiveInterestRate / 100)) /
    4;
  const totalExpenditure = govSpending + industryMaintenance + debtService;

  const balance = totalRevenue - totalExpenditure;
  const balancePctGdp = gdpUsdPeriod > 0 ? (balance / gdpUsdPeriod) * 100 : 0;

  return {
    taxRevenue,
    sectorTaxRevenue,
    baseTaxRevenue,
    baseTaxRevenueClamped,
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

/** 5. Финансирование дефицита/распределение профицита за `days` суток. */
export function computeFinancing(
  state: GameState,
  budget: BudgetResult,
  days: number,
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

  // reserveDrawMaxShare — "не больше X% резервов ЗА КВАРТАЛ" — реальный
  // поточный кламп, масштабируется линейно на размер периода.
  const maxReserveDraw = state.reserves * flowScale(TUNING.budget.reserveDrawMaxShare, days);
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

/**
 * 6. Инфляция за `days` суток. Персистентность — точная экспоненциальная
 * конверсия (см. time.ts); монетизация/безработица-гэп/нефть-члены —
 * поточные добавки, масштабируются линейно; шум — по правилу корня.
 * Член от изменения цены нефти (oilPriceDelta) НЕ масштабируется отдельно
 * — сам oilPriceDelta уже является дельтой между двумя ПРАВИЛЬНО суточно
 * отмасштабированными ценами (см. nextOilPrice), повторное масштабирование
 * коэффициента было бы двойным затуханием.
 */
export function nextInflation(
  state: GameState,
  financing: FinancingResult,
  oilPriceDelta: number,
  days: number,
): number {
  const gdpUsdPeriod = state.gdpIndex * GDP_TO_USD_BN * (days / DAYS_PER_QUARTER);
  const monetizationShareOfGdp =
    gdpUsdPeriod > 0 ? financing.monetizedAmount / gdpUsdPeriod : 0;
  const unemploymentGap = Math.max(
    0,
    TUNING.unemployment.naturalRate - state.unemploymentRate,
  );

  const persistence = retentionRate(TUNING.inflation.persistence, days);
  const next =
    persistence * state.inflationRateAnnual +
    (1 - persistence) * 4 + // якорь долгосрочных ожиданий
    flowScale(TUNING.inflation.monetizationCoefficient * monetizationShareOfGdp * 100, days) +
    flowScale(TUNING.inflation.unemploymentGapCoefficient * unemploymentGap, days) -
    TUNING.inflation.oilStrengthDisinflation * Math.max(oilPriceDelta, 0) +
    gaussianNoise(noiseScale(TUNING.inflation.noiseStdDev, days));

  return clamp(next, CLAMP.inflation);
}

/**
 * 7. Потенциальный рост ВВП — та же линейно затухающая к полу кривая, что
 * и раньше, но с непрерывным входом (gameTimeDays/90 вместо целочисленного
 * state.turn) — без "ступенек" раз в квартал.
 */
export function potentialGrowth(state: GameState): number {
  const decayed =
    TUNING.growth.initialPotential -
    TUNING.growth.potentialDecayPerTurn * (state.gameTimeDays / DAYS_PER_QUARTER);
  return Math.max(decayed, TUNING.growth.potentialFloor);
}

/** 10. Социальное недовольство за `days` суток. */
export function nextUnrest(state: GameState, days: number): number {
  const target =
    TUNING.unrest.inflationCoefficient * Math.max(state.inflationRateAnnual - 6, 0) +
    TUNING.unrest.unemploymentCoefficient *
      Math.max(state.unemploymentRate - 6, 0) +
    TUNING.unrest.corruptionCoefficient * state.corruption -
    TUNING.unrest.approvalRelief * state.approval;

  const reformModifier = flowScale(sumModifier(state, "socialUnrest"), days);
  const inertia = retentionRate(TUNING.unrest.inertia, days);
  const blended =
    inertia * state.socialUnrest +
    (1 - inertia) * Math.max(target, 0) +
    reformModifier;

  return clamp(blended, CLAMP.percent);
}

/**
 * 11. Одобрение за `days` суток. `delta` в отличие от nextUnrest не
 * блендится, а явно СКЛАДЫВАЕТСЯ с approval — все её члены поэтому поток,
 * не свежий срез. growth/inflation-члены изначально калибровались как
 * "годовая ставка / 4" (перевод в квартальный вклад) — теперь это
 * "годовая ставка × доля года" (days/365), а не flowScale (которая мерит
 * квартал, а не год). corruption/unrest-члены изначально были без
 * дополнительного годового пересчёта (уже квартальные по своей природе) —
 * flowScale как обычно. unemploymentDeltaCoefficient умножается на дельту
 * УЖЕ суточно-масштабированной безработицы — сам коэффициент не трогаем
 * (иначе двойное затухание).
 */
export function nextApproval(
  state: GameState,
  growth: number,
  prevUnemployment: number,
  nextUnemploymentRate: number,
  days: number,
): number {
  const honeymoonTarget =
    TUNING.approval.honeymoonBaseline -
    TUNING.approval.honeymoonDecayPerTurn * (state.gameTimeDays / DAYS_PER_QUARTER);

  const yearFraction = days / DAYS_PER_YEAR;
  const delta =
    TUNING.approval.growthCoefficient * (growth - potentialGrowth(state)) * yearFraction -
    TUNING.approval.inflationCoefficient *
      Math.max(state.inflationRateAnnual - 8, 0) * yearFraction -
    TUNING.approval.unemploymentDeltaCoefficient *
      (nextUnemploymentRate - prevUnemployment) -
    flowScale(TUNING.approval.corruptionCoefficient * (state.corruption / 100), days) -
    flowScale(TUNING.approval.unrestCoefficient * (state.socialUnrest / 100), days);

  const reversion =
    convergenceRate(TUNING.approval.meanReversion, days) * (honeymoonTarget - state.approval);

  const reformModifier = flowScale(sumModifier(state, "approval"), days);

  const next = state.approval + delta + reversion + reformModifier;
  return clamp(next, CLAMP.percent);
}

/**
 * 12. Прирост политических очков за `days` суток — все члены однородно
 * поточные, масштабируется весь результат целиком (включая пол 0.5/квартал).
 */
export function politicalPointsGain(state: GameState, days: number): number {
  const base = TUNING.politicalPoints.base;
  const fromApproval =
    TUNING.politicalPoints.approvalCoefficient * Math.max(state.approval - 50, 0);
  const unrestPenalty =
    TUNING.politicalPoints.unrestPenaltyCoefficient * Math.max(state.socialUnrest - 30, 0);
  const reformModifier = sumModifier(state, "politicalPointsPerTurn");
  const quarterlyGain = Math.max(base + fromApproval - unrestPenalty + reformModifier, 0.5);
  return flowScale(quarterlyGain, days);
}

/**
 * Эффективная ставка по новому долгу от риск-премии (долг/ВВП, резервы,
 * санкции) — свежий срез от текущих уровней долга/резервов, не зависит от
 * размера тика, менять нечего.
 */
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
