import {
  CLAMP,
  aggregateGdpIndex,
  aggregateWeightedCorruption,
  aggregateWeightedUnemployment,
  clamp,
} from "./constants";
import {
  computeBudget,
  computeFinancing,
  GDP_TO_USD_BN,
  nextApproval,
  nextInflation,
  nextInterestRate,
  nextOilPrice,
  nextUnrest,
  politicalPointsGain,
} from "./formulas";
import { advanceConstruction } from "./industries";
import { advanceRegionEconomies } from "./regionEconomy";
import { rollForEvent } from "./events";
import { tickModifiers } from "./reforms";
import type { GameState, Quarter, TurnSnapshot } from "./types";

const GAME_OVER_UNREST_THRESHOLD = 95;
const GAME_OVER_APPROVAL_THRESHOLD = 5;

function nextDate(year: number, quarter: Quarter): { year: number; quarter: Quarter } {
  if (quarter === 4) return { year: year + 1, quarter: 1 };
  return { year, quarter: (quarter + 1) as Quarter };
}

export function processTurn(prev: GameState): GameState {
  if (prev.gameOver || prev.activeEvent) return prev;

  const logEntries: string[] = [];

  // 1. Цена нефти
  const oilPrice = nextOilPrice(prev);
  const oilPriceDelta = oilPrice - prev.oilPrice;

  // 2. Стройки
  const construction = advanceConstruction(prev.industries);
  logEntries.push(...construction.logEntries);

  const stateWithConstruction: GameState = {
    ...prev,
    industries: construction.industries,
  };

  // 3-5. Бюджет и финансирование
  const budget = computeBudget(stateWithConstruction, oilPrice);
  const financing = computeFinancing(stateWithConstruction, budget);

  const reserves = clamp(
    stateWithConstruction.reserves +
      financing.reserveSaveAmount -
      financing.reserveDrawAmount,
    [0, 500],
  );
  const publicDebtDelta =
    (financing.newDebtAmount / (stateWithConstruction.gdpIndex * GDP_TO_USD_BN)) *
    100;
  const publicDebt = clamp(
    stateWithConstruction.publicDebt + publicDebtDelta,
    CLAMP.debt,
  );

  // 6. Инфляция — не трогается: те же входы (gdpIndex/inflationRateAnnual/
  // unemploymentRate из stateWithConstruction, т.е. на начало хода),
  // на своём прежнем месте в пайплайне, до регионального роста ниже.
  const inflationRateAnnual = nextInflation(
    stateWithConstruction,
    financing,
    oilPriceDelta,
  );

  // 7. Рост/безработица/коррупция — теперь снизу вверх: считаем каждый
  // регион отдельно (та же логика, что раньше была нацформулой, но в
  // масштабе региона), затем агрегируем в нацпоказатели.
  const regionEconomies = advanceRegionEconomies(
    stateWithConstruction,
    oilPrice,
    construction.newlyCompletedInfrastructureByRegion,
  );
  const gdpIndex = aggregateGdpIndex(regionEconomies);
  const unemploymentRate = aggregateWeightedUnemployment(regionEconomies);
  const corruption = aggregateWeightedCorruption(regionEconomies);
  const gdpGrowthRateAnnual =
    (gdpIndex / stateWithConstruction.gdpIndex - 1) * 400;

  // 9. Недовольство — по-прежнему на stateWithConstruction (старые
  // unemploymentRate/corruption/inflationRateAnnual, до пересчёта выше).
  const socialUnrest = nextUnrest(stateWithConstruction);

  // 11. Одобрение
  const approval = nextApproval(
    stateWithConstruction,
    gdpGrowthRateAnnual,
    stateWithConstruction.unemploymentRate,
    unemploymentRate,
  );

  // Ставка по долгу на следующий ход
  const effectiveInterestRate = nextInterestRate({
    ...stateWithConstruction,
    publicDebt,
    reserves,
  });

  // 12. Политические очки
  const pgGain = politicalPointsGain(stateWithConstruction);

  const { year, quarter } = nextDate(prev.year, prev.quarter);
  const turn = prev.turn + 1;

  let next: GameState = {
    ...prev,
    turn,
    year,
    quarter,
    gdpIndex,
    gdpGrowthRateAnnual,
    inflationRateAnnual,
    unemploymentRate,
    approval,
    corruption,
    socialUnrest,
    budgetBalance: budget.balancePctGdp,
    reserves,
    publicDebt,
    effectiveInterestRate,
    oilPrice,
    politicalPoints: prev.politicalPoints + pgGain,
    industries: construction.industries,
    regionEconomies,
    eventCooldowns: Object.fromEntries(
      Object.entries(prev.eventCooldowns).map(([id, t]) => [id, Math.max(t - 1, 0)]),
    ),
    log: [...prev.log, ...logEntries].slice(-200),
  };

  next = tickModifiers(next);

  // 13. Случайное событие
  const rolled = rollForEvent(next);
  if (rolled) {
    next = {
      ...next,
      activeEvent: rolled.def.build(next),
      eventCooldowns: {
        ...next.eventCooldowns,
        [rolled.def.id]: rolled.def.cooldownTurns,
      },
    };
  }

  // Условие завершения игры (кризис легитимности власти)
  if (
    (next.socialUnrest >= GAME_OVER_UNREST_THRESHOLD &&
      next.approval <= GAME_OVER_APPROVAL_THRESHOLD) ||
    next.approval <= 0
  ) {
    next = {
      ...next,
      gameOver: {
        reason:
          "Массовые протесты и обвал доверия привели к отставке правительства.",
      },
    };
  }

  // 14. Снимок хода
  const snapshot: TurnSnapshot = {
    turn: next.turn,
    year: next.year,
    quarter: next.quarter,
    gdpIndex: next.gdpIndex,
    gdpGrowthRateAnnual: next.gdpGrowthRateAnnual,
    inflationRateAnnual: next.inflationRateAnnual,
    unemploymentRate: next.unemploymentRate,
    approval: next.approval,
    corruption: next.corruption,
    socialUnrest: next.socialUnrest,
    budgetBalance: next.budgetBalance,
    reserves: next.reserves,
    publicDebt: next.publicDebt,
    oilPrice: next.oilPrice,
    politicalPoints: next.politicalPoints,
  };
  next = { ...next, history: [...next.history, snapshot].slice(-400) };

  return next;
}
