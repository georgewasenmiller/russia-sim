import { INDUSTRY_DEFS, TUNING } from "./constants";
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

export function effectiveBuildCost(sector: IndustrySector, regionId: string): number {
  const def = INDUSTRY_DEFS[sector];
  const infra = REGIONS_BY_ID.get(regionId)?.infrastructureLevel ?? 50;
  return def.buildCost * infrastructureMultipliers(infra).cost;
}

export function effectiveBuildTurns(sector: IndustrySector, regionId: string): number {
  const def = INDUSTRY_DEFS[sector];
  const infra = REGIONS_BY_ID.get(regionId)?.infrastructureLevel ?? 50;
  return Math.max(1, Math.round(def.buildTurns * infrastructureMultipliers(infra).turns));
}

export function canAffordIndustry(
  state: GameState,
  sector: IndustrySector,
  regionId: string,
): boolean {
  return state.reserves >= effectiveBuildCost(sector, regionId);
}

export function startBuildingIndustry(
  state: GameState,
  sector: IndustrySector,
  regionId: string,
): GameState {
  const def = INDUSTRY_DEFS[sector];
  if (!canAffordIndustry(state, sector, regionId)) return state;

  const buildCost = effectiveBuildCost(sector, regionId);
  const buildTurns = effectiveBuildTurns(sector, regionId);

  industryCounter += 1;
  const industry: Industry = {
    id: `ind-${state.turn}-${industryCounter}`,
    regionId,
    sector: def.sector,
    label: def.label,
    status: "building",
    turnsRemaining: buildTurns,
    jobs: def.jobs,
    outputContribution: def.outputContribution,
    maintenanceCost: def.maintenanceCost,
    exportVolumeContribution: def.exportVolumeContribution,
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
  newlyCompletedJobs: number;
  newlyCompletedJobsByRegion: Record<string, number>;
  logEntries: string[];
}

/** Продвигает стройки на один ход; вводит в строй завершённые. */
export function advanceConstruction(
  industries: Industry[],
): ConstructionResult {
  let newlyCompletedJobs = 0;
  const newlyCompletedJobsByRegion: Record<string, number> = {};
  const logEntries: string[] = [];

  const next = industries.map((industry) => {
    if (industry.status === "operational") return industry;
    const turnsRemaining = industry.turnsRemaining - 1;
    if (turnsRemaining <= 0) {
      newlyCompletedJobs += industry.jobs;
      newlyCompletedJobsByRegion[industry.regionId] =
        (newlyCompletedJobsByRegion[industry.regionId] ?? 0) + industry.jobs;
      logEntries.push(`Завершено строительство: ${industry.label}.`);
      return { ...industry, status: "operational" as const, turnsRemaining: 0 };
    }
    return { ...industry, turnsRemaining };
  });

  return { industries: next, newlyCompletedJobs, newlyCompletedJobsByRegion, logEntries };
}

export function totalOperationalOutput(industries: Industry[]): number {
  return industries
    .filter((i) => i.status === "operational")
    .reduce((acc, i) => acc + i.outputContribution, 0);
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
