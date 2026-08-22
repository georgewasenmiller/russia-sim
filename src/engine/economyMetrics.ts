import { GDP_INDEX_SCALE, TOTAL_POPULATION } from "./constants";
import { GDP_TO_USD_BN } from "./formulas";
import type { GameState, Industry } from "./types";
import type { Region, RegionEconomy } from "../regions/types";

/**
 * Реальные $ и ВВП на душу — везде переиспользуют GDP_TO_USD_BN
 * (formulas.ts) как единственную шкалу перевода индекса в доллары, и
 * GDP_INDEX_SCALE (constants.ts) для приведения "сырой" региональной шкалы
 * gdpIndex к той же шкале, на которой откалиброван нацагрегат — без этого
 * цифры региона и страны не складывались бы друг в друга.
 */

export function nationalGdpUsdAnnual(state: GameState): number {
  return state.gdpIndex * GDP_TO_USD_BN * 4;
}

export function nationalGdpPerCapitaUsd(state: GameState): number {
  return (nationalGdpUsdAnnual(state) / TOTAL_POPULATION) * 1000;
}

export function regionGdpUsdAnnual(economy: RegionEconomy): number {
  return economy.gdpIndex * GDP_INDEX_SCALE * GDP_TO_USD_BN * 4;
}

export function regionGdpPerCapitaUsd(
  economy: RegionEconomy,
  region: Region,
): number {
  return (regionGdpUsdAnnual(economy) / region.population) * 1000;
}

/** Накопленный вклад построек региона в его ВВП, в $ (сток, не темп прироста). */
export function regionIndustryGdpUsd(economy: RegionEconomy): number {
  return economy.industryGdpIndex * GDP_INDEX_SCALE * GDP_TO_USD_BN * 4;
}

/** "Базовая" (не завязанная на конкретные постройки) часть ВВП региона, в $. */
export function regionBaseGdpUsd(economy: RegionEconomy): number {
  return regionGdpUsdAnnual(economy) - regionIndustryGdpUsd(economy);
}

/** Текущий годовой темп прироста ВВП от одного действующего предприятия, в $. */
export function industryObjectFlowUsd(industry: Industry): number {
  return industry.outputContribution * 0.25 * GDP_INDEX_SCALE * GDP_TO_USD_BN * 4;
}
