import { CLAMP, TUNING, clamp } from "./constants";
import { nationalGdpUsdAnnual } from "./economyMetrics";
import type { GameState } from "./types";
import { fmtUsdBn } from "../utils/format";

export type TaxDirection = "up" | "down";

function nextTaxBurden(state: GameState, direction: TaxDirection): number {
  const delta = direction === "up" ? TUNING.taxPolicy.step : -TUNING.taxPolicy.step;
  return clamp(state.sliders.taxBurden + delta, [
    TUNING.taxPolicy.min,
    TUNING.taxPolicy.max,
  ]);
}

export function canChangeTaxBurden(
  state: GameState,
  direction: TaxDirection,
): boolean {
  if (state.politicalPoints < TUNING.taxPolicy.ppCost) return false;
  return nextTaxBurden(state, direction) !== state.sliders.taxBurden;
}

/**
 * Меняет налоговую ставку на фиксированный шаг ценой очков власти — в
 * отличие от govSpendingShare/deficitMonetizationShare, которые остаются
 * свободными непрерывными ползунками.
 */
export function changeTaxBurden(
  state: GameState,
  direction: TaxDirection,
): GameState {
  if (!canChangeTaxBurden(state, direction)) return state;

  const taxBurden = nextTaxBurden(state, direction);
  const label = direction === "up" ? "повышена" : "понижена";

  return {
    ...state,
    politicalPoints: state.politicalPoints - TUNING.taxPolicy.ppCost,
    sliders: { ...state.sliders, taxBurden },
    log: [...state.log, `Налоговая ставка ${label} до ${taxBurden.toFixed(0)}%.`],
  };
}

export function canRepayDebt(state: GameState, amountBn: number): boolean {
  return amountBn > 0 && state.reserves >= amountBn && state.publicDebt > 0;
}

/**
 * Погашение госдолга из резервов (карточка "Долг" в TopBar). state.publicDebt
 * хранится как отношение долг/ВВП в % (см. этап "TopBar бюджет/долг"), не
 * сумма в $ — переводится через nationalGdpUsdAnnual, тем же способом
 * (в обратную сторону), что и nationalDebtUsd. Списывает не больше, чем
 * реально нужно для погашения остатка долга — "сдача" не сгорает, если
 * запрошенная сумма перекрывает весь остаток.
 */
export function repayDebt(state: GameState, amountBn: number): GameState {
  if (!canRepayDebt(state, amountBn)) return state;
  const gdpAnnual = nationalGdpUsdAnnual(state);
  const debtUsd = (state.publicDebt / 100) * gdpAnnual;
  const actualAmountBn = Math.min(amountBn, debtUsd);
  const pctReduction = (actualAmountBn / gdpAnnual) * 100;
  return {
    ...state,
    reserves: state.reserves - actualAmountBn,
    publicDebt: clamp(state.publicDebt - pctReduction, CLAMP.debt),
    log: [...state.log, `Погашение госдолга: -${fmtUsdBn(actualAmountBn)} из резервов.`],
  };
}
