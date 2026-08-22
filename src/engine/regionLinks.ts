import { AVG_REGION_POPULATION, TUNING, clamp } from "./constants";
import { REGIONS, REGIONS_BY_ID } from "../regions/data";
import type { Region, RegionEconomy, Specialization } from "../regions/types";

const RESOURCE_TYPES: Specialization[] = ["oil", "gas", "coal", "metals"];

/**
 * Бонус к росту региона от торговли излишками сырья с соседями. Для
 * каждого типа сырья, которого у самого региона нет, берётся ЛУЧШИЙ (по
 * gdpIndex) сосед с этой специализацией — не сумма по всем подходящим
 * соседям, иначе несколько соседей одного типа удваивали бы эффект.
 * Разные типы сырья от разных соседей, наоборот, складываются, но итог
 * жёстко клампится сверху.
 */
export function tradeGrowthBonus(
  region: Region,
  regionEconomies: Record<string, RegionEconomy>,
): number {
  let bonus = 0;

  for (const resourceType of RESOURCE_TYPES) {
    if (region.specializations.includes(resourceType)) continue;

    let bestNeighborGdp = 0;
    for (const neighborId of region.neighbors) {
      const neighbor = REGIONS_BY_ID.get(neighborId);
      if (!neighbor || !neighbor.specializations.includes(resourceType)) continue;
      const neighborGdp = regionEconomies[neighborId]?.gdpIndex ?? 0;
      if (neighborGdp > bestNeighborGdp) bestNeighborGdp = neighborGdp;
    }

    if (bestNeighborGdp > 0) {
      bonus += TUNING.trade.perResourceCoefficient * bestNeighborGdp;
    }
  }

  return Math.min(bonus, TUNING.trade.maxTotalBonus);
}

/**
 * Миграция рабочей силы между соседями от снимка на начало хода. Каждая
 * пара соседей обрабатывается ровно один раз: переток запускает только
 * регион с более высокой безработицей (у второй стороны gap будет
 * отрицательным, и её собственный проход по этому соседу — не сработает).
 * Все дельты копятся в один Record и возвращаются разом — применять их
 * нужно после того, как весь проход завершён, а не по ходу дела.
 */
export function computeMigrationDeltas(
  regionEconomies: Record<string, RegionEconomy>,
): Record<string, number> {
  const deltas: Record<string, number> = {};
  for (const region of REGIONS) deltas[region.id] = 0;

  for (const region of REGIONS) {
    const myUnemployment = regionEconomies[region.id].unemploymentRate;
    const myPopulationRatio = clamp(
      region.population / AVG_REGION_POPULATION,
      TUNING.regionUnemployment.populationRatioClamp,
    );

    for (const neighborId of region.neighbors) {
      const neighbor = REGIONS_BY_ID.get(neighborId);
      if (!neighbor) continue;
      const neighborEconomy = regionEconomies[neighborId];

      const gap = myUnemployment - neighborEconomy.unemploymentRate;
      if (gap <= TUNING.migration.gapThreshold) continue;

      const rawFlow = TUNING.migration.rate * (gap - TUNING.migration.gapThreshold);
      const donorFlow =
        clamp(rawFlow, [0, TUNING.migration.maxPerNeighborDelta]) / myPopulationRatio;

      deltas[region.id] -= donorFlow;

      const neighborPopulationRatio = clamp(
        neighbor.population / AVG_REGION_POPULATION,
        TUNING.regionUnemployment.populationRatioClamp,
      );
      const recipientEffect = donorFlow / neighborPopulationRatio;

      if (neighborEconomy.unemploymentRate < TUNING.unemployment.naturalRate) {
        deltas[neighborId] -= recipientEffect * TUNING.migration.shortageAbsorptionFactor;
      } else {
        deltas[neighborId] += recipientEffect * TUNING.migration.dilutionFactor;
      }
    }
  }

  for (const id of Object.keys(deltas)) {
    deltas[id] = clamp(deltas[id], [
      -TUNING.migration.maxTotalDeltaPerTurn,
      TUNING.migration.maxTotalDeltaPerTurn,
    ]);
  }

  return deltas;
}
