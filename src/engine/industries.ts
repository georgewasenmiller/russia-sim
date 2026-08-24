import {
  INDUSTRY_DEFS,
  TUNING,
  computeJobsAndOutput,
  maxProductionSlots,
} from "./constants";
import type { GameState, Industry, IndustrySector } from "./types";
import { REGIONS_BY_ID } from "../regions/data";

let industryCounter = 0;

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/**
 * Модификатор стройки от инфраструктуры региона (0-100): лучше
 * инфраструктура — дешевле и быстрее, хуже — дороже и дольше. Применяется
 * один раз при старте стройки (см. startBuildingIndustry), тиканье таймера
 * в advanceConstruction не меняется.
 */
function infrastructureMultipliers(infrastructureLevel: number): {
  cost: number;
  turns: number;
} {
  const t = infrastructureLevel / 100;
  return {
    cost: lerp(
      TUNING.infrastructure.costMultiplierAtZero,
      TUNING.infrastructure.costMultiplierAtMax,
      t,
    ),
    turns: lerp(
      TUNING.infrastructure.turnsMultiplierAtZero,
      TUNING.infrastructure.turnsMultiplierAtMax,
      t,
    ),
  };
}

/** Общестрановой множитель скорости стройки (не стоимости) — см. план п.4:
 * чем больше в стране уже действующих промышленных/аграрных/технологичных
 * предприятий (инфраструктура намеренно не считается — у неё свой,
 * локальный эффект, см. infrastructureMultipliers), тем быстрее строится
 * ЛЮБОЕ здание в ЛЮБОМ регионе. */
export function nationalIndustrialMultiplier(state: GameState): number {
  const count = state.industries.filter(
    (i) => i.status === "operational" && i.sector !== "infrastructure",
  ).length;
  const t = Math.min(1, count / TUNING.nationalIndustrialBase.saturationCount);
  return lerp(
    TUNING.nationalIndustrialBase.multiplierAtZero,
    TUNING.nationalIndustrialBase.multiplierAtSaturation,
    t,
  );
}

export function effectiveBuildCost(
  state: GameState,
  sector: IndustrySector,
  regionId: string,
): number {
  const def = INDUSTRY_DEFS[sector];
  const infra = state.regionEconomies[regionId]?.infrastructureLevel ?? 50;
  return def.buildCost * infrastructureMultipliers(infra).cost;
}

export function effectiveBuildTurns(
  state: GameState,
  sector: IndustrySector,
  regionId: string,
): number {
  const def = INDUSTRY_DEFS[sector];
  const infra = state.regionEconomies[regionId]?.infrastructureLevel ?? 50;
  const local = infrastructureMultipliers(infra).turns;
  const national = nationalIndustrialMultiplier(state);
  return Math.max(1, Math.round(def.buildTurns * local * national));
}

export function canAffordIndustry(
  state: GameState,
  sector: IndustrySector,
  regionId: string,
): boolean {
  return state.reserves >= effectiveBuildCost(state, sector, regionId);
}

export function usedProductionSlots(state: GameState, regionId: string): number {
  return state.industries.filter(
    (i) => i.regionId === regionId && i.sector !== "infrastructure",
  ).length;
}

export function hasFreeProductionSlot(state: GameState, regionId: string): boolean {
  const region = REGIONS_BY_ID.get(regionId);
  const economy = state.regionEconomies[regionId];
  if (!region || !economy) return false;
  return usedProductionSlots(state, regionId) < maxProductionSlots(region, economy);
}

/**
 * Инфраструктура НЕ расходует производственные слоты — у неё отдельный,
 * самозатухающий лимит: строить можно, пока прогнозируемый уровень (текущий
 * + прирост от уже строящихся проектов) не достигнет 100. Это архитектурно
 * исключает дедлок "все слоты заняты не-инфраструктурными зданиями — новую
 * инфраструктуру, которая единственная открывает слоты, построить негде".
 */
export function hasFreeInfrastructureSlot(state: GameState, regionId: string): boolean {
  const economy = state.regionEconomies[regionId];
  if (!economy) return false;
  const pendingGain =
    state.industries.filter(
      (i) => i.regionId === regionId && i.sector === "infrastructure" && i.status === "building",
    ).length * TUNING.infrastructureBuild.levelGainPerProject;
  return economy.infrastructureLevel + pendingGain < 100;
}

export function canBuildInRegion(
  state: GameState,
  sector: IndustrySector,
  regionId: string,
): boolean {
  return sector === "infrastructure"
    ? hasFreeInfrastructureSlot(state, regionId)
    : hasFreeProductionSlot(state, regionId);
}

export function startBuildingIndustry(
  state: GameState,
  sector: IndustrySector,
  regionId: string,
): GameState {
  const def = INDUSTRY_DEFS[sector];
  const region = REGIONS_BY_ID.get(regionId);
  const economy = state.regionEconomies[regionId];
  if (!region || !economy) return state;
  if (!canAffordIndustry(state, sector, regionId)) return state;
  if (!canBuildInRegion(state, sector, regionId)) return state;

  const buildCost = effectiveBuildCost(state, sector, regionId);
  const buildTurns = effectiveBuildTurns(state, sector, regionId);
  const { jobs, outputContribution } = computeJobsAndOutput(sector, region, economy);

  industryCounter += 1;
  const industry: Industry = {
    id: `ind-${state.turn}-${industryCounter}`,
    regionId,
    sector: def.sector,
    label: def.label,
    status: "building",
    turnsRemaining: buildTurns,
    jobs,
    outputContribution,
    maintenanceCost: def.maintenanceCost,
    exportVolumeContribution: def.exportVolumeContribution,
    origin: "built",
  };

  return {
    ...state,
    reserves: state.reserves - buildCost,
    industries: [...state.industries, industry],
    log: [...state.log, `Начато строительство: ${def.label}.`],
  };
}

export interface ConstructionResult {
  industries: Industry[];
  /** Число завершённых в этом ходу проектов сектора infrastructure — по
   * региону; каждый поднимает RegionEconomy.infrastructureLevel на
   * TUNING.infrastructureBuild.levelGainPerProject (см. regionEconomy.ts). */
  newlyCompletedInfrastructureByRegion: Record<string, number>;
  logEntries: string[];
}

/** Продвигает стройки на один ход; вводит в строй завершённые. */
export function advanceConstruction(
  industries: Industry[],
): ConstructionResult {
  const newlyCompletedInfrastructureByRegion: Record<string, number> = {};
  const logEntries: string[] = [];

  const next = industries.map((industry) => {
    if (industry.status === "operational") return industry;
    const turnsRemaining = industry.turnsRemaining - 1;
    if (turnsRemaining <= 0) {
      if (industry.sector === "infrastructure") {
        newlyCompletedInfrastructureByRegion[industry.regionId] =
          (newlyCompletedInfrastructureByRegion[industry.regionId] ?? 0) + 1;
      }
      logEntries.push(`Завершено строительство: ${industry.label}.`);
      return { ...industry, status: "operational" as const, turnsRemaining: 0 };
    }
    return { ...industry, turnsRemaining };
  });

  return { industries: next, newlyCompletedInfrastructureByRegion, logEntries };
}

export function totalOperationalOutput(industries: Industry[]): number {
  return industries
    .filter((i) => i.status === "operational")
    .reduce((acc, i) => acc + i.outputContribution, 0);
}

export function totalOperationalJobs(industries: Industry[]): number {
  return industries
    .filter((i) => i.status === "operational")
    .reduce((acc, i) => acc + i.jobs, 0);
}

export interface IndustryGrouping {
  operational: Partial<Record<IndustrySector, number>>;
  building: { sector: IndustrySector; turnsRemaining: number }[];
}

/**
 * Группирует предприятия (уже отфильтрованные под один регион) по
 * секторам — для отображения на карте (режим "Застройка"): счётчик по
 * секторам вместо одной иконки на завод, отдельно список строящихся с
 * оставшимся временем.
 */
export function groupIndustriesBySector(industries: Industry[]): IndustryGrouping {
  const operational: Partial<Record<IndustrySector, number>> = {};
  const building: { sector: IndustrySector; turnsRemaining: number }[] = [];

  for (const industry of industries) {
    if (industry.status === "operational") {
      operational[industry.sector] = (operational[industry.sector] ?? 0) + 1;
    } else {
      building.push({ sector: industry.sector, turnsRemaining: industry.turnsRemaining });
    }
  }

  return { operational, building };
}
