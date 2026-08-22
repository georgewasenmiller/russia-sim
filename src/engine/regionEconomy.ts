import { AVG_REGION_POPULATION, CLAMP, TUNING, clamp } from "./constants";
import {
  gaussianNoise,
  potentialGrowth,
  sanctionsGrowthDrag,
  sumModifier,
} from "./formulas";
import { totalOperationalOutput } from "./industries";
import { computeMigrationDeltas, tradeGrowthBonus } from "./regionLinks";
import type { GameState, Industry } from "./types";
import { REGIONS } from "../regions/data";
import type { Region, RegionEconomy } from "../regions/types";

function isOilOrGas(region: Region): boolean {
  return (
    region.specializations.includes("oil") ||
    region.specializations.includes("gas")
  );
}

function isAgriculture(region: Region): boolean {
  return region.specializations.includes("agriculture");
}

/**
 * Рост региона: тот же общий фон, что и в nextGrowth (общестрановые
 * налог/инфляция/недовольство/санкции — одинаковы для всех регионов), плюс
 * собственные факторы региона (выпуск его заводов, его коррупция, его
 * специализация).
 */
export function nextRegionGrowth(
  region: Region,
  economy: RegionEconomy,
  regionIndustries: Industry[],
  state: GameState,
  oilPrice: number,
): number {
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
  const sanctionsDrag = sanctionsGrowthDrag(state.sanctions);

  const operationalCount = regionIndustries.filter(
    (i) => i.status === "operational",
  ).length;
  const industryBoost =
    TUNING.regionGrowth.industryBoostCoefficient *
    Math.min(operationalCount, TUNING.regionGrowth.industryBoostCap);

  const corruptionDrag =
    TUNING.regionGrowth.corruptionDragCoefficient *
    (economy.corruptionIndex / 100);

  const oilSensitivity = isOilOrGas(region)
    ? TUNING.regionGrowth.oilSensitivityCoefficient *
      (oilPrice - state.oilPriceMeanTarget)
    : 0;

  // Торговля излишками сырья: соседи считаются по снимку на начало хода
  // (state.regionEconomies ещё не тронут этим ходом), так что бонус не
  // зависит от порядка обработки регионов в advanceRegionEconomies.
  const tradeBonus = tradeGrowthBonus(region, state.regionEconomies);

  const reformModifier =
    sumModifier(state, "gdpGrowthRateAnnual") *
    (isAgriculture(region) ? TUNING.regionGrowth.agricultureReformDamping : 1);

  const noiseStdDev =
    TUNING.regionGrowth.noiseStdDev *
    (isAgriculture(region) ? TUNING.regionGrowth.agricultureStabilityFactor : 1);

  const next =
    potential -
    taxDrag -
    inflationDrag -
    unrestDrag -
    sanctionsDrag -
    corruptionDrag +
    industryBoost +
    oilSensitivity +
    tradeBonus +
    reformModifier +
    gaussianNoise(noiseStdDev);

  return clamp(next, CLAMP.gdpGrowth);
}

/** Безработица региона: закон Оукена + прямой эффект рабочих мест его заводов. */
export function nextRegionUnemployment(
  region: Region,
  economy: RegionEconomy,
  regionGrowth: number,
  newlyCompletedRegionJobs: number,
  state: GameState,
): number {
  const potential = potentialGrowth(state);
  const growthGap = regionGrowth - potential;
  const fromOkun = -TUNING.unemployment.okunCoefficient * (growthGap / 4);

  const populationRatio = clamp(
    region.population / AVG_REGION_POPULATION,
    TUNING.regionUnemployment.populationRatioClamp,
  );
  const fromJobs =
    -newlyCompletedRegionJobs /
    (TUNING.unemployment.jobsToRateDivisor * populationRatio);

  const reversion =
    TUNING.unemployment.meanReversion *
    (TUNING.unemployment.naturalRate - economy.unemploymentRate);

  const next = economy.unemploymentRate + fromOkun + fromJobs + reversion;
  return clamp(next, CLAMP.unemployment);
}

/**
 * Коррупция региона: дрейфует к собственному сид-значению региона (не к
 * общему нацбазису), плюс тот же национальный реформенный модификатор, что
 * и раньше действовал только на state.corruption — так антикоррупционная
 * реформа задевает все регионы разом.
 */
export function nextRegionCorruption(
  region: Region,
  economy: RegionEconomy,
  state: GameState,
  oilPrice: number,
): number {
  const driftMultiplier = isOilOrGas(region)
    ? TUNING.regionCorruption.oilRentDriftMultiplier
    : TUNING.regionCorruption.ambientDriftMultiplier;
  const oilRentDrift =
    TUNING.corruption.oilRentDriftCoefficient *
    driftMultiplier *
    Math.max(oilPrice - 40, 0);

  const decay =
    TUNING.corruption.decayRate * (region.corruptionIndex - economy.corruptionIndex);

  const reformModifier = sumModifier(state, "corruption");
  const noise = gaussianNoise(TUNING.regionCorruption.noiseStdDev);

  const next = economy.corruptionIndex + oilRentDrift + decay + reformModifier + noise;
  return clamp(next, CLAMP.percent);
}

/** Продвигает экономику всех регионов на один ход. */
export function advanceRegionEconomies(
  state: GameState,
  oilPrice: number,
  newlyCompletedJobsByRegion: Record<string, number>,
): Record<string, RegionEconomy> {
  const next: Record<string, RegionEconomy> = {};

  // Миграция считается один раз от снимка на начало хода — та же логика,
  // что и торговый бонус: не зависит от порядка обработки регионов ниже.
  const migrationDeltas = computeMigrationDeltas(state.regionEconomies);

  for (const region of REGIONS) {
    const economy = state.regionEconomies[region.id];
    const regionIndustries = state.industries.filter(
      (i) => i.regionId === region.id,
    );

    const growth = nextRegionGrowth(region, economy, regionIndustries, state, oilPrice);
    const industryFlow = totalOperationalOutput(regionIndustries) * 0.25;
    const gdpIndex = economy.gdpIndex * (1 + growth / 400) + industryFlow;
    // Параллельный трекинг доли gdpIndex, происходящей от построек — той
    // же формулой, что и gdpIndex целиком (см. план). baseGdpIndex
    // (gdpIndex - industryGdpIndex) выводится в economyMetrics.ts, не
    // хранится.
    const industryGdpIndex = economy.industryGdpIndex * (1 + growth / 400) + industryFlow;

    const unemploymentRate = clamp(
      nextRegionUnemployment(
        region,
        economy,
        growth,
        newlyCompletedJobsByRegion[region.id] ?? 0,
        state,
      ) + migrationDeltas[region.id],
      CLAMP.unemployment,
    );

    const corruptionIndex = nextRegionCorruption(region, economy, state, oilPrice);

    next[region.id] = { gdpIndex, unemploymentRate, corruptionIndex, industryGdpIndex };
  }

  return next;
}
