import type { GameState, IndustryDef, IndustrySector } from "./types";

export const SAVE_VERSION = 1;
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
};

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
  return {
    saveVersion: SAVE_VERSION,
    turn: 1,
    year: 2000,
    quarter: 1,
    gameOver: null,

    gdpIndex: 100,
    gdpGrowthRateAnnual: 10,
    inflationRateAnnual: 20,
    unemploymentRate: 12,
    approval: 68,
    corruption: 60,
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

    activeEvent: null,
    eventCooldowns: {},

    history: [],
    log: ["Начало игры: 2000, I квартал."],
  };
}
