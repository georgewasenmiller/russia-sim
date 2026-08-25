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

/** Абсолютная сумма госдолга в $ млрд — state.publicDebt хранится как
 * отношение долг/ВВП в процентах (см. turnEngine.ts), а не как сумма, так
 * что сумма получается умножением на текущий (пересчитываемый каждые
 * игровые сутки) годовой ВВП — автоматически согласована с самим
 * отношением день в день. */
export function nationalDebtUsd(state: GameState): number {
  return (state.publicDebt / 100) * nationalGdpUsdAnnual(state);
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

/**
 * Годовой вклад одного действующего предприятия в ВВП его региона, в $ —
 * буквальная, самая мелкая единица разбивки "откуда взялся ВВП региона":
 * ВВП региона теперь и есть сумма таких вкладов (плюс множитель
 * продуктивности и небольшая нефтегазовая рента, см. regionEconomy.ts), не
 * абстрактная "базовая экономика" поверх.
 */
export function industryObjectFlowUsd(industry: Industry): number {
  return industry.outputContribution * GDP_INDEX_SCALE * GDP_TO_USD_BN * 4;
}
