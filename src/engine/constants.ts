import { REGIONS } from "../regions/data";
import type { RegionEconomy } from "../regions/types";
import type { GameState, IndustryDef, IndustrySector } from "./types";

export const SAVE_VERSION = 3;
export const SAVE_KEY = "russia-sim-save-v1";

export const CLAMP = {
  percent: [0, 100] as [number, number],
  unemployment: [2, 40] as [number, number],
  inflation: [-10, 200] as [number, number],
  gdpGrowth: [-25, 25] as [number, number],
  debt: [0, 250] as [number, number],
  oilPrice: [5, 220] as [number, number],
};

export function clamp(value: number, [min, max]: [number, number]): number {
  return Math.min(max, Math.max(min, value));
}

// --- Тюнинг-константы формул ---
export const TUNING = {
  // Нефть: mean-reverting random walk
  oil: {
    reversionSpeed: 0.12,
    noiseStdDev: 3.5,
    initialMeanTarget: 27,
  },
  // Бюджет
  budget: {
    royaltyShare: 0.55, // доля нефтегазовой выручки, идущая в бюджет
    baseHydrocarbonExportVolume: 4.3, // у.е. объёма экспорта до индустриализации
    otherRevenueShareOfGdp: 0.03,
    baselineSocialSpendShareOfGdp: 0.06,
    reserveSaveRatio: 0.35, // доля профицита, уходящая в резервы
    reserveDrawMaxShare: 0.5, // макс. доля резервов, которую можно потратить на покрытие дефицита за ход
  },
  // Инфляция
  inflation: {
    persistence: 0.55,
    monetizationCoefficient: 1.9,
    oilStrengthDisinflation: 0.06,
    unemploymentGapCoefficient: 0.18,
    noiseStdDev: 1.1,
  },
  // Рост ВВП
  growth: {
    initialPotential: 8.5,
    potentialDecayPerTurn: 0.045,
    potentialFloor: 2.2,
    taxDragCoefficient: 0.055,
    inflationDragThreshold: 12,
    inflationDragCoefficient: 0.05,
    unrestDragCoefficient: 0.035,
    industryGrowthContribution: 0.4,
    oilPriceGrowthCoefficient: 0.02,
    sanctionsDragDefault: 0,
    noiseStdDev: 1.0,
  },
  // Безработица (закон Оукена, упрощённо)
  unemployment: {
    okunCoefficient: 0.32,
    jobsToRateDivisor: 700, // тыс. рабочих мест / этот делитель = п.п. безработицы
    meanReversion: 0.05,
    naturalRate: 6,
  },
  // Коррупция
  corruption: {
    oilRentDriftCoefficient: 0.01,
    decayToward: 45,
    decayRate: 0.02,
  },
  // Недовольство
  unrest: {
    inflationCoefficient: 0.22,
    unemploymentCoefficient: 0.9,
    corruptionCoefficient: 0.12,
    approvalRelief: 0.08,
    inertia: 0.7,
  },
  // Одобрение
  approval: {
    growthCoefficient: 1.6,
    inflationCoefficient: 0.55,
    unemploymentDeltaCoefficient: 1.8,
    corruptionCoefficient: 0.1,
    unrestCoefficient: 0.25,
    honeymoonDecayPerTurn: 0.15,
    honeymoonBaseline: 55,
    meanReversion: 0.03,
  },
  // Долг/ставка
  debt: {
    baseInterestRate: 7,
    debtRiskCoefficient: 0.055,
    reservesRiskRelief: 0.12,
  },
  // Политические очки
  politicalPoints: {
    base: 3,
    approvalCoefficient: 0.03,
    unrestPenaltyCoefficient: 0.03,
  },
  // Рост региона (та же логика, что growth, в масштабе одного региона)
  regionGrowth: {
    corruptionDragCoefficient: 3, // штраф к росту при коррупции региона = 100
    oilSensitivityCoefficient: 0.06, // усиленная версия growth.oilPriceGrowthCoefficient для oil/gas
    industryBoostCoefficient: 0.5,
    industryBoostCap: 4,
    agricultureReformDamping: 0.5, // множитель нацреформ для аграрных регионов
    agricultureStabilityFactor: 0.4, // множитель к noiseStdDev для аграрных регионов
    noiseStdDev: 1.3,
  },
  // Безработица региона
  regionUnemployment: {
    populationRatioClamp: [0.2, 5] as [number, number],
  },
  // Коррупция региона
  regionCorruption: {
    oilRentDriftMultiplier: 3, // усиление рентного дрейфа для oil/gas-специализации
    ambientDriftMultiplier: 0.3, // фоновый дрейф для остальных регионов
    noiseStdDev: 0.4, // независимый локальный дрейф между реформами
  },
  // Торговля излишками сырья между соседними регионами
  trade: {
    perResourceCoefficient: 0.015, // п.п. роста на единицу gdpIndex лучшего соседа-поставщика
    maxTotalBonus: 2.5, // жёсткий потолок суммарного бонуса по всем типам сырья сразу
  },
  // Миграция рабочей силы между соседями
  migration: {
    gapThreshold: 2, // п.п. разницы безработицы, ниже которого перетока нет
    rate: 0.06, // доля превышения порога, перетекающая за один ход
    maxPerNeighborDelta: 0.5, // кламп потока с одним соседом за ход, п.п.
    maxTotalDeltaPerTurn: 1.2, // кламп суммарного эффекта на регион за ход, п.п.
    shortageAbsorptionFactor: 0.5, // приток снижает безработицу реципиента при дефиците кадров
    dilutionFactor: 0.4, // приток слегка повышает безработицу реципиента без дефицита
  },
};

/**
 * Масштаб приведения суммы сид-значений region.gdpIndex (Москва = 100,
 * остальные — по своей доле) к нацшкале, на которой откалиброван весь
 * бюджетный движок (state.gdpIndex стартует в районе 100, GDP_TO_USD_BN
 * в formulas.ts подобран под эту величину). Считается один раз из
 * статических сид-данных, не пересчитывается по ходу игры.
 */
export const GDP_INDEX_SCALE =
  100 / REGIONS.reduce((sum, r) => sum + r.gdpIndex, 0);

const TOTAL_POPULATION = REGIONS.reduce((sum, r) => sum + r.population, 0);
export const AVG_REGION_POPULATION = TOTAL_POPULATION / REGIONS.length;

export function aggregateGdpIndex(
  economies: Record<string, RegionEconomy>,
): number {
  const raw = REGIONS.reduce(
    (sum, r) => sum + economies[r.id].gdpIndex,
    0,
  );
  return raw * GDP_INDEX_SCALE;
}

export function aggregateWeightedUnemployment(
  economies: Record<string, RegionEconomy>,
): number {
  const weighted = REGIONS.reduce(
    (sum, r) => sum + economies[r.id].unemploymentRate * r.population,
    0,
  );
  return weighted / TOTAL_POPULATION;
}

export function aggregateWeightedCorruption(
  economies: Record<string, RegionEconomy>,
): number {
  const weighted = REGIONS.reduce(
    (sum, r) => sum + economies[r.id].corruptionIndex * r.population,
    0,
  );
  return weighted / TOTAL_POPULATION;
}

export const INDUSTRY_DEFS: Record<IndustrySector, IndustryDef> = {
  oil_gas: {
    sector: "oil_gas",
    label: "Нефтегазовый комплекс",
    description:
      "Добыча и экспорт углеводородов. Увеличивает объём экспорта — доходы бюджета от цены нефти растут вместе с этим сектором.",
    buildCost: 14,
    buildTurns: 6,
    jobs: 25,
    outputContribution: 0.35,
    maintenanceCost: 0.6,
    exportVolumeContribution: 0.8,
  },
  manufacturing: {
    sector: "manufacturing",
    label: "Обрабатывающая промышленность",
    description: "Заводы и производство. Стабильный вклад в ВВП и занятость.",
    buildCost: 9,
    buildTurns: 5,
    jobs: 40,
    outputContribution: 0.3,
    maintenanceCost: 0.45,
    exportVolumeContribution: 0,
  },
  agriculture: {
    sector: "agriculture",
    label: "Сельское хозяйство",
    description: "АПК: дешевле и быстрее строить, меньше вклад в ВВП.",
    buildCost: 5,
    buildTurns: 3,
    jobs: 30,
    outputContribution: 0.15,
    maintenanceCost: 0.2,
    exportVolumeContribution: 0,
  },
  tech: {
    sector: "tech",
    label: "Технологии и IT",
    description:
      "Долгая и дорогая стройка, но большой вклад в ВВП и наименьшее содержание на единицу выпуска.",
    buildCost: 16,
    buildTurns: 7,
    jobs: 18,
    outputContribution: 0.4,
    maintenanceCost: 0.35,
    exportVolumeContribution: 0,
  },
  infrastructure: {
    sector: "infrastructure",
    label: "Инфраструктура",
    description:
      "Дороги, энергосети, порты. Прямого выпуска не даёт, но снижает издержки остальной экономики.",
    buildCost: 11,
    buildTurns: 4,
    jobs: 22,
    outputContribution: 0.2,
    maintenanceCost: 0.3,
    exportVolumeContribution: 0,
  },
};

export function createInitialState(): GameState {
  const regionEconomies: Record<string, RegionEconomy> = Object.fromEntries(
    REGIONS.map((r) => [
      r.id,
      {
        gdpIndex: r.gdpIndex,
        unemploymentRate: r.unemploymentRate,
        corruptionIndex: r.corruptionIndex,
      },
    ]),
  );

  return {
    saveVersion: SAVE_VERSION,
    turn: 1,
    year: 2000,
    quarter: 1,
    gameOver: null,

    gdpIndex: aggregateGdpIndex(regionEconomies),
    gdpGrowthRateAnnual: 10,
    inflationRateAnnual: 20,
    unemploymentRate: aggregateWeightedUnemployment(regionEconomies),
    approval: 68,
    corruption: aggregateWeightedCorruption(regionEconomies),
    socialUnrest: 30,

    budgetBalance: 0.4,
    reserves: 12,
    publicDebt: 90,
    effectiveInterestRate: 11,

    oilPrice: 25,
    oilPriceMeanTarget: TUNING.oil.initialMeanTarget,

    politicalPoints: 5,
    sliders: {
      taxBurden: 35,
      govSpendingShare: 34,
      deficitMonetizationShare: 40,
    },

    industries: [],
    activeReforms: [],
    appliedReformIds: [],
    sanctions: [],
    regionEconomies,

    activeEvent: null,
    eventCooldowns: {},

    history: [],
    log: ["Начало игры: 2000, I квартал."],
  };
}
