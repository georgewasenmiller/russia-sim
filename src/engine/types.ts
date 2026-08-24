import type { RegionEconomy } from "../regions/types";

export type Quarter = 1 | 2 | 3 | 4;

export type IndustrySector =
  | "oil_gas"
  | "manufacturing"
  | "agriculture"
  | "tech"
  | "infrastructure";

export interface IndustryDef {
  sector: IndustrySector;
  label: string;
  description: string;
  buildCost: number; // $ млрд
  buildTurns: number;
  /**
   * Доля трудоспособного населения региона, которую занимает ОДНО такое
   * предприятие (не флэт-число — см. computeJobsAndOutput в industries.ts).
   * Один и тот же сектор даёт разное число рабочих мест в разных регионах,
   * пропорционально их размеру.
   */
  baseJobsShare: number;
  /** Вклад в индекс ВВП за ход на 1 тыс. занятых при эксплуатации. */
  productivityPerWorker: number;
  maintenanceCost: number; // $ млрд за ход
  exportVolumeContribution: number; // только для oil_gas: у.е. объёма экспорта
}

export interface Industry {
  id: string;
  regionId: string;
  sector: IndustrySector;
  label: string;
  status: "building" | "operational";
  /** Игровые сутки от начала партии, на которых стартовала стройка. */
  startedAtGameDay: number;
  /**
   * Игровые сутки от начала партии, на которых стройка завершится —
   * зафиксировано один раз при старте (не пересчитывается, даже если
   * позже изменятся инфраструктура региона/промбаза страны). Для legacy-
   * предприятий (уже готовых на старте партии) равно startedAtGameDay.
   */
  completesAtGameDay: number;
  /** Локальный множитель инфраструктуры региона, зафиксированный на старте — для тултипа. */
  localInfraMultiplier: number;
  /** Общестрановой множитель промбазы, зафиксированный на старте — для тултипа. */
  nationalMultiplier: number;
  /** тыс. рабочих мест — вычислено по региону в момент начала стройки. */
  jobs: number;
  /** вклад в индекс ВВП за ход — вычислен по региону в момент начала стройки. */
  outputContribution: number;
  maintenanceCost: number;
  exportVolumeContribution: number;
  /** "legacy" — унаследовано при старте партии, "built" — построено игроком. */
  origin: "legacy" | "built";
}

export type MetricKey =
  | "gdpGrowthRateAnnual"
  | "inflationRateAnnual"
  | "unemploymentRate"
  | "approval"
  | "corruption"
  | "socialUnrest"
  | "politicalPointsPerTurn"
  | "taxCollectionEfficiency"
  | "effectiveInterestRate";

export interface ActiveModifier {
  id: string;
  sourceId: string;
  label: string;
  effects: Partial<Record<MetricKey, number>>;
  turnsRemaining: number | null; // null = бессрочно
}

export interface ReformDef {
  id: string;
  category: "fiscal" | "social" | "institutional" | "foreign";
  label: string;
  description: string;
  cost: number; // Puntos de Gobierno
  oneTimeEffects?: Partial<
    Record<
      | "reserves"
      | "publicDebt"
      | "approval"
      | "corruption"
      | "socialUnrest",
      number
    >
  >;
  modifier?: {
    label: string;
    effects: Partial<Record<MetricKey, number>>;
    duration: number | null; // ходов, null = бессрочно
  };
  requires?: (state: GameState) => boolean;
}

export interface SanctionState {
  id: string;
  label: string;
  oilExportDiscountPct: number; // 0-100, дисконт к цене экспортируемой нефти
  interestRatePremium: number; // п.п. к ставке по новому долгу
  growthDragPct: number; // п.п. к росту ВВП
  turnsRemaining: number | null;
}

export interface EventChoice {
  id: string;
  label: string;
  description: string;
  pgCost?: number;
  requires?: (state: GameState) => boolean;
  apply: (state: GameState) => GameState;
}

export interface GameEvent {
  id: string;
  title: string;
  description: string;
  choices: EventChoice[];
}

export interface EventDef {
  id: string;
  category:
    | "commodity"
    | "regional"
    | "international"
    | "corruption"
    | "financial";
  weight: (state: GameState) => number; // 0 = невозможно в этот ход
  cooldownTurns: number;
  build: (state: GameState) => GameEvent;
}

export interface TurnSnapshot {
  turn: number;
  year: number;
  quarter: Quarter;
  gdpIndex: number;
  gdpGrowthRateAnnual: number;
  inflationRateAnnual: number;
  unemploymentRate: number;
  approval: number;
  corruption: number;
  socialUnrest: number;
  budgetBalance: number;
  reserves: number;
  publicDebt: number;
  oilPrice: number;
  politicalPoints: number;
}

export interface Sliders {
  taxBurden: number; // 0-100
  govSpendingShare: number; // 0-100
  deficitMonetizationShare: number; // 0-100
}

export interface GameState {
  saveVersion: number;
  /**
   * Непрерывный игровой календарь — первичные часы игры (см.
   * src/engine/time.ts). turn/year/quarter ниже — ДЕРИВАТИВ от этого поля,
   * инкрементируются только при пересечении границы условного 90-дневного
   * квартала (см. advanceOneDay в turnEngine.ts), сохранены ради реформ/
   * событий/истории, которые по-прежнему меряют время в "ходах"/кварталах.
   */
  gameTimeDays: number;
  gameSpeedLevel: 1 | 2 | 3 | 4 | 5;
  isPaused: boolean;
  turn: number;
  year: number;
  quarter: Quarter;
  gameOver: { reason: string } | null;

  gdpIndex: number;
  gdpGrowthRateAnnual: number;
  inflationRateAnnual: number;
  unemploymentRate: number;
  approval: number;
  corruption: number;
  socialUnrest: number;

  budgetBalance: number;
  reserves: number;
  publicDebt: number;
  effectiveInterestRate: number;

  oilPrice: number;
  oilPriceMeanTarget: number;

  politicalPoints: number;
  sliders: Sliders;

  industries: Industry[];
  activeReforms: ActiveModifier[];
  appliedReformIds: string[];
  sanctions: SanctionState[];
  regionEconomies: Record<string, RegionEconomy>;

  activeEvent: GameEvent | null;
  eventCooldowns: Record<string, number>;

  history: TurnSnapshot[];
  log: string[];
}
