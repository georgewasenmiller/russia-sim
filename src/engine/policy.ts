import { TUNING, clamp } from "./constants";
import type { GameState } from "./types";

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
