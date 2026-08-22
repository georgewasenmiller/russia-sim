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
  jobs: number; // тыс. рабочих мест при вводе в строй
  outputContribution: number; // вклад в индекс ВВП за ход при эксплуатации
  maintenanceCost: number; // $ млрд за ход
  exportVolumeContribution: number; // только для oil_gas: у.е. объёма экспорта
}

export interface Industry {
  id: string;
  regionId: string;
  sector: IndustrySector;
  label: string;
  status: "building" | "operational";
  turnsRemaining: number;
  jobs: number;
  outputContribution: number;
  maintenanceCost: number;
  exportVolumeContribution: number;
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
