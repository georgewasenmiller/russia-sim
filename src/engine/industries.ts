import { INDUSTRY_DEFS } from "./constants";
import type { GameState, Industry, IndustrySector } from "./types";

let industryCounter = 0;

export function canAffordIndustry(
  state: GameState,
  sector: IndustrySector,
): boolean {
  const def = INDUSTRY_DEFS[sector];
  return state.reserves >= def.buildCost;
}

export function startBuildingIndustry(
  state: GameState,
  sector: IndustrySector,
  regionId: string,
): GameState {
  const def = INDUSTRY_DEFS[sector];
  if (!canAffordIndustry(state, sector)) return state;

  industryCounter += 1;
  const industry: Industry = {
    id: `ind-${state.turn}-${industryCounter}`,
    regionId,
    sector: def.sector,
    label: def.label,
    status: "building",
    turnsRemaining: def.buildTurns,
    jobs: def.jobs,
    outputContribution: def.outputContribution,
    maintenanceCost: def.maintenanceCost,
    exportVolumeContribution: def.exportVolumeContribution,
  };

  return {
    ...state,
    reserves: state.reserves - def.buildCost,
    industries: [...state.industries, industry],
    log: [...state.log, `Начато строительство: ${def.label}.`],
  };
}

export interface ConstructionResult {
  industries: Industry[];
  newlyCompletedJobs: number;
  logEntries: string[];
}

/** Продвигает стройки на один ход; вводит в строй завершённые. */
export function advanceConstruction(
  industries: Industry[],
): ConstructionResult {
  let newlyCompletedJobs = 0;
  const logEntries: string[] = [];

  const next = industries.map((industry) => {
    if (industry.status === "operational") return industry;
    const turnsRemaining = industry.turnsRemaining - 1;
    if (turnsRemaining <= 0) {
      newlyCompletedJobs += industry.jobs;
      logEntries.push(`Завершено строительство: ${industry.label}.`);
      return { ...industry, status: "operational" as const, turnsRemaining: 0 };
    }
    return { ...industry, turnsRemaining };
  });

  return { industries: next, newlyCompletedJobs, logEntries };
}

export function totalOperationalOutput(industries: Industry[]): number {
  return industries
    .filter((i) => i.status === "operational")
    .reduce((acc, i) => acc + i.outputContribution, 0);
}
