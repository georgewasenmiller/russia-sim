import { AVG_REGION_POPULATION, TUNING, clamp } from "./constants";
import { flowScale } from "./time";
import { REGIONS, REGIONS_BY_ID } from "../regions/data";
import type { Region, RegionEconomy, Specialization } from "../regions/types";

const RESOURCE_TYPES: Specialization[] = ["oil", "gas", "coal", "metals"];

/**
 * Бонус к росту региона от торговли излишками сырья с соседями за `days`
 * игровых суток. Для каждого типа сырья, которого у самого региона нет,
 * берётся ЛУЧШИЙ (по gdpIndex) сосед с этой специализацией — не сумма по
 * всем подходящим соседям, иначе несколько соседей одного типа удваивали
 * бы эффект. Разные типы сырья от разных соседей, наоборот, складываются,
 * но итог жёстко клампится сверху. perResourceCoefficient/maxTotalBonus —
 * поточные "за квартал" величины, масштабируются линейно.
 */
export function tradeGrowthBonus(
  region: Region,
  regionEconomies: Record<string, RegionEconomy>,
  days: number,
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
      bonus += flowScale(TUNING.trade.perResourceCoefficient, days) * bestNeighborGdp;
    }
  }

  return Math.min(bonus, flowScale(TUNING.trade.maxTotalBonus, days));
}

/**
 * Миграция рабочей силы между соседями за `days` игровых суток, от снимка
 * на начало тика. Каждая пара соседей обрабатывается ровно один раз:
 * переток запускает только регион с более высокой безработицей (у второй
 * стороны gap будет отрицательным, и её собственный проход по этому
 * соседу — не сработает). Все дельты копятся в один Record и возвращаются
 * разом — применять их нужно после того, как весь проход завершён, а не
 * по ходу дела. `rate`/`maxPerNeighborDelta`/`maxTotalDeltaPerTurn` —
 * поточные "за квартал" величины, масштабируются линейно;
 * `shortageAbsorptionFactor`/`dilutionFactor` — доли уже отмасштабированного
 * потока, не масштабируются повторно.
 */
export function computeMigrationDeltas(
  regionEconomies: Record<string, RegionEconomy>,
  days: number,
): Record<string, number> {
  const deltas: Record<string, number> = {};
  for (const region of REGIONS) deltas[region.id] = 0;

  const dailyRate = flowScale(TUNING.migration.rate, days);
  const maxPerNeighborDelta = flowScale(TUNING.migration.maxPerNeighborDelta, days);
  const maxTotalDeltaPerTurn = flowScale(TUNING.migration.maxTotalDeltaPerTurn, days);

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

      const rawFlow = dailyRate * (gap - TUNING.migration.gapThreshold);
      const donorFlow = clamp(rawFlow, [0, maxPerNeighborDelta]) / myPopulationRatio;

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
    deltas[id] = clamp(deltas[id], [-maxTotalDeltaPerTurn, maxTotalDeltaPerTurn]);
  }

  return deltas;
}
