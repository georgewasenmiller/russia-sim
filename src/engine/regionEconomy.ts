import { CLAMP, TUNING, clamp, regionLaborForce } from "./constants";
import {
  gaussianNoise,
  potentialGrowth,
  sanctionsGrowthDrag,
  sumModifier,
} from "./formulas";
import { totalOperationalJobs, totalOperationalOutput } from "./industries";
import { computeMigrationDeltas, tradeGrowthBonus } from "./regionLinks";
import { convergenceRate, flowScale, noiseScale } from "./time";
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
 * обратить в отрицательное ВВП региона за один ход. Свежий срез — не
 * зависит от размера тика (`days`) вообще, кроме шума (см. noiseScale):
 * при любом days для тех же входов даёт тот же результат.
 */
export function regionMacroMultiplier(
  region: Region,
  economy: RegionEconomy,
  state: GameState,
  oilPrice: number,
  days: number,
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
  const tradeBonus = tradeGrowthBonus(region, state.regionEconomies, days) / divisor;

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
    gaussianNoise(noiseScale(noiseStdDev, days));

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
 * реформа задевает все регионы разом. Не входит в объём этого этапа по
 * причинности (не зависит ни от построек, ни от роста/безработицы) — но
 * тикает на `days` суток, как и всё остальное: oilRentDrift/reformModifier
 * — поточные добавки (линейно), decay — алгебраически форма "закрытие
 * разрыва" (`current + rate*(seed-current)`), несмотря на запись через
 * `+`, поэтому rate переводится точной экспоненциальной формулой, не
 * линейно; noise — по правилу корня.
 */
export function nextRegionCorruption(
  region: Region,
  economy: RegionEconomy,
  state: GameState,
  oilPrice: number,
  days: number,
): number {
  const driftMultiplier = isOilOrGas(region)
    ? TUNING.regionCorruption.oilRentDriftMultiplier
    : TUNING.regionCorruption.ambientDriftMultiplier;
  const oilRentDrift = flowScale(
    TUNING.corruption.oilRentDriftCoefficient * driftMultiplier * Math.max(oilPrice - 40, 0),
    days,
  );

  const decay =
    convergenceRate(TUNING.corruption.decayRate, days) *
    (region.corruptionIndex - economy.corruptionIndex);

  const reformModifier = flowScale(sumModifier(state, "corruption"), days);
  const noise = gaussianNoise(noiseScale(TUNING.regionCorruption.noiseStdDev, days));

  const next = economy.corruptionIndex + oilRentDrift + decay + reformModifier + noise;
  return clamp(next, CLAMP.percent);
}

/** Продвигает экономику всех регионов на `days` игровых суток. */
export function advanceRegionEconomies(
  state: GameState,
  oilPrice: number,
  newlyCompletedInfrastructureByRegion: Record<string, number>,
  days: number,
): Record<string, RegionEconomy> {
  const next: Record<string, RegionEconomy> = {};

  // Миграция считается один раз от снимка на начало тика — та же логика,
  // что и торговый бонус: не зависит от порядка обработки регионов ниже.
  const migrationDeltas = computeMigrationDeltas(state.regionEconomies, days);

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
    const macroMultiplier = regionMacroMultiplier(region, economy, state, oilPrice, days);
    const oilGasRent = isOilOrGas(region)
      ? TUNING.oilGasRent.coefficient *
        Math.max(oilPrice - TUNING.oilGasRent.referencePrice, 0)
      : 0;
    const gdpIndex = buildingsOutput * macroMultiplier + oilGasRent;

    // Безработица — целевое значение считается строго по дефициту рабочих
    // мест; фактическое движется к цели за несколько дней (не
    // телепортируется в тот же тик, что здание достроилось), плюс
    // независимая миграционная дельта поверх — тот же принцип
    // "постепенно", что и в regionLinks.ts. adjustmentSpeed — форма
    // "закрытие разрыва", точная экспоненциальная конверсия.
    const target = targetRegionUnemployment(region, regionIndustries);
    const unemploymentRate = clamp(
      economy.unemploymentRate +
        convergenceRate(TUNING.regionUnemployment.adjustmentSpeed, days) *
          (target - economy.unemploymentRate) +
        migrationDeltas[region.id],
      CLAMP.unemployment,
    );

    const corruptionIndex = nextRegionCorruption(region, economy, state, oilPrice, days);

    next[region.id] = { gdpIndex, unemploymentRate, corruptionIndex, infrastructureLevel };
  }

  return next;
}
