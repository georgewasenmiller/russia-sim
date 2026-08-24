import { CLAMP, TUNING, clamp, regionLaborForce } from "./constants";
import {
  gaussianNoise,
  potentialGrowth,
  sanctionsGrowthDrag,
  sumModifier,
} from "./formulas";
import { totalOperationalJobs, totalOperationalOutput } from "./industries";
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
 * Множитель отдачи построек региона: здания (buildingsOutput, см.
 * advanceRegionEconomies) остаются единственным источником выпуска, этот
 * множитель лишь модулирует, насколько продуктивно он конвертируется в
 * ВВП — налоги/инфляция/недовольство/коррупция/санкции тянут вниз, реформы/
 * торговля с соседями/цена нефти для oil-gas региона/общий тренд
 * производительности — вверх. Жёстко клампится (TUNING.regionMacro.floor/
 * ceiling), чтобы даже одновременный удар всех штрафов не мог обнулить или
 * обратить в отрицательное ВВП региона за один ход.
 */
export function regionMacroMultiplier(
  region: Region,
  economy: RegionEconomy,
  state: GameState,
  oilPrice: number,
): number {
  // potentialGrowth()/tradeGrowthBonus()/сумма реформенных модификаторов
  // gdpGrowthRateAnnual откалиброваны для старой модели (доли годового
  // темпа роста, диапазон ±25) — делим на эту константу, чтобы получить
  // разумные по масштабу доли множителя выпуска (~0.35-1.5).
  const divisor = TUNING.regionMacro.legacyPointsToFractionDivisor;
  const productivityTrend = potentialGrowth(state) / divisor;

  const taxDrag =
    TUNING.regionMacro.taxDragCoefficient * Math.max(state.sliders.taxBurden - 25, 0);

  const inflationExcess = Math.max(
    state.inflationRateAnnual - TUNING.regionMacro.inflationDragThreshold,
    0,
  );
  const inflationDrag = TUNING.regionMacro.inflationDragCoefficient * inflationExcess;

  const unrestDrag = TUNING.regionMacro.unrestDragCoefficient * state.socialUnrest;
  const sanctionsDrag = sanctionsGrowthDrag(state.sanctions) / divisor;

  const corruptionDrag =
    TUNING.regionMacro.corruptionDragCoefficient * (economy.corruptionIndex / 100);

  const oilSensitivity = isOilOrGas(region)
    ? TUNING.regionMacro.oilSensitivityCoefficient * (oilPrice - state.oilPriceMeanTarget)
    : 0;

  // Торговля излишками сырья: соседи считаются по снимку на начало хода
  // (state.regionEconomies ещё не тронут этим ходом), так что бонус не
  // зависит от порядка обработки регионов в advanceRegionEconomies.
  const tradeBonus = tradeGrowthBonus(region, state.regionEconomies) / divisor;

  const reformModifier =
    (sumModifier(state, "gdpGrowthRateAnnual") / divisor) *
    (isAgriculture(region) ? TUNING.regionMacro.agricultureReformDamping : 1);

  const noiseStdDev =
    TUNING.regionMacro.noiseStdDev *
    (isAgriculture(region) ? TUNING.regionMacro.agricultureStabilityFactor : 1);

  const raw =
    1 +
    productivityTrend -
    taxDrag -
    inflationDrag -
    unrestDrag -
    sanctionsDrag -
    corruptionDrag +
    oilSensitivity +
    tradeBonus +
    reformModifier +
    gaussianNoise(noiseStdDev);

  return clamp(raw, [TUNING.regionMacro.floor, TUNING.regionMacro.ceiling]);
}

/**
 * Целевая безработица региона — строго от дефицита рабочих мест:
 * трудоспособное население минус сумма рабочих мест на всех действующих
 * предприятиях региона (включая инфраструктурные, если уже эксплуатируются
 * — см. план п.5). Не абстрактная формула роста, прямое соотношение.
 */
export function targetRegionUnemployment(
  region: Region,
  regionIndustries: Industry[],
): number {
  const laborForce = regionLaborForce(region);
  const jobs = totalOperationalJobs(regionIndustries);
  return clamp(((laborForce - jobs) / laborForce) * 100, CLAMP.unemployment);
}

/**
 * Коррупция региона: дрейфует к собственному сид-значению региона (не к
 * общему нацбазису), плюс тот же национальный реформенный модификатор, что
 * и раньше действовал только на state.corruption — так антикоррупционная
 * реформа задевает все регионы разом. Не входит в объём этого этапа — не
 * зависит ни от построек, ни от роста/безработицы, не меняется.
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
  newlyCompletedInfrastructureByRegion: Record<string, number>,
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

    // Инфраструктура — строимый объект: завершённые в этом ходу проекты
    // сектора infrastructure поднимают живой уровень (кламп 0-100).
    const infrastructureLevel = clamp(
      economy.infrastructureLevel +
        (newlyCompletedInfrastructureByRegion[region.id] ?? 0) *
          TUNING.infrastructureBuild.levelGainPerProject,
      CLAMP.percent,
    );

    // ВВП региона — только от зданий (buildingsOutput), плюс два узких
    // исключения: множитель продуктивности (не источник, а модулятор — см.
    // regionMacroMultiplier) и небольшая нефтегазовая рента для регионов с
    // соответствующей специализацией.
    const buildingsOutput = totalOperationalOutput(regionIndustries);
    const macroMultiplier = regionMacroMultiplier(region, economy, state, oilPrice);
    const oilGasRent = isOilOrGas(region)
      ? TUNING.oilGasRent.coefficient *
        Math.max(oilPrice - TUNING.oilGasRent.referencePrice, 0)
      : 0;
    const gdpIndex = buildingsOutput * macroMultiplier + oilGasRent;

    // Безработица — целевое значение считается строго по дефициту рабочих
    // мест; фактическое движется к цели за 2-3 хода (не телепортируется в
    // тот же ход, что здание достроилось), плюс независимая миграционная
    // дельта поверх — тот же принцип "постепенно", что и в regionLinks.ts.
    const target = targetRegionUnemployment(region, regionIndustries);
    const unemploymentRate = clamp(
      economy.unemploymentRate +
        TUNING.regionUnemployment.adjustmentSpeed * (target - economy.unemploymentRate) +
        migrationDeltas[region.id],
      CLAMP.unemployment,
    );

    const corruptionIndex = nextRegionCorruption(region, economy, state, oilPrice);

    next[region.id] = { gdpIndex, unemploymentRate, corruptionIndex, infrastructureLevel };
  }

  return next;
}
