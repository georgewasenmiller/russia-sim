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
import { DAYS_PER_QUARTER, DAYS_PER_YEAR } from "./time";
import type { GameState, Quarter, TurnSnapshot } from "./types";

const GAME_OVER_UNREST_THRESHOLD = 95;
const GAME_OVER_APPROVAL_THRESHOLD = 5;

/** Внутренний тик экономики — фиксированно 1 игровые сутки (см. план
 * "Непрерывный игровой календарь..."). Скорость меняет только реальный
 * интервал между вызовами advanceOneDay, не размер самого шага. */
const DAYS = 1;

/**
 * Продвигает игру на DAYS игровых суток. Экономика (ВВП/бюджет/инфляция/
 * недовольство/одобрение/регионы) тикает КАЖДЫЙ вызов — квартальные
 * формулы пересчитаны на суточный тик (см. formulas.ts/regionEconomy.ts/
 * regionLinks.ts и src/engine/time.ts). События/реформы/история/turn-
 * year-quarter — по-прежнему квартальной каденции, но триггер теперь
 * "пересечена граница условного 90-дневного квартала", а не "нажали
 * кнопку" (сами reforms.ts/events.ts не меняются).
 */
export function advanceOneDay(prev: GameState): GameState {
  if (prev.gameOver || prev.activeEvent) return prev;

  const logEntries: string[] = [];
  const gameTimeDays = prev.gameTimeDays + DAYS;

  // 1. Цена нефти
  const oilPrice = nextOilPrice(prev, DAYS);
  const oilPriceDelta = oilPrice - prev.oilPrice;

  // 2. Стройки — абсолютная метка завершения, не декремент (см. план).
  const construction = advanceConstruction(prev.industries, gameTimeDays);
  logEntries.push(...construction.logEntries);

  const stateWithConstruction: GameState = {
    ...prev,
    industries: construction.industries,
  };

  // 3-5. Бюджет и финансирование за DAYS суток
  const budget = computeBudget(stateWithConstruction, oilPrice, DAYS);
  const financing = computeFinancing(stateWithConstruction, budget, DAYS);

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

  // 6. Инфляция — не трогается по порядку: те же входы (gdpIndex/
  // inflationRateAnnual/unemploymentRate из stateWithConstruction, т.е. на
  // начало тика), до регионального роста ниже.
  const inflationRateAnnual = nextInflation(
    stateWithConstruction,
    financing,
    oilPriceDelta,
    DAYS,
  );

  // 7. Рост/безработица/коррупция — снизу вверх: каждый регион отдельно,
  // затем агрегация в нацпоказатели (не тронуто этим этапом).
  const regionEconomies = advanceRegionEconomies(
    stateWithConstruction,
    oilPrice,
    construction.newlyCompletedInfrastructureByRegion,
    DAYS,
  );
  const gdpIndex = aggregateGdpIndex(regionEconomies);
  const unemploymentRate = aggregateWeightedUnemployment(regionEconomies);
  const corruption = aggregateWeightedCorruption(regionEconomies);
  // Аннуализация суточного изменения: было ×400 (4 квартала×100) для
  // квартального шага, теперь ×(365/DAYS)×100 для суточного.
  const gdpGrowthRateAnnual =
    (gdpIndex / stateWithConstruction.gdpIndex - 1) * (DAYS_PER_YEAR / DAYS) * 100;

  // 9. Недовольство — по-прежнему на stateWithConstruction (старые
  // unemploymentRate/corruption/inflationRateAnnual, до пересчёта выше).
  const socialUnrest = nextUnrest(stateWithConstruction, DAYS);

  // 11. Одобрение
  const approval = nextApproval(
    stateWithConstruction,
    gdpGrowthRateAnnual,
    stateWithConstruction.unemploymentRate,
    unemploymentRate,
    DAYS,
  );

  // Ставка по долгу на следующий тик — свежий срез, не зависит от DAYS.
  const effectiveInterestRate = nextInterestRate({
    ...stateWithConstruction,
    publicDebt,
    reserves,
  });

  // 12. Политические очки
  const pgGain = politicalPointsGain(stateWithConstruction, DAYS);

  let next: GameState = {
    ...prev,
    gameTimeDays,
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
    log: [...prev.log, ...logEntries].slice(-200),
  };

  // Граница условного 90-дневного квартала — здесь и только здесь
  // срабатывают события/реформы/история/деривативы turn-year-quarter,
  // той же частоты и с тем же смыслом, что и раньше (см. план п.3/5).
  const prevQuarterIndex = Math.floor(prev.gameTimeDays / DAYS_PER_QUARTER);
  const nextQuarterIndex = Math.floor(gameTimeDays / DAYS_PER_QUARTER);
  if (nextQuarterIndex !== prevQuarterIndex) {
    const turn = next.turn + 1;
    const quarter = (((turn - 1) % 4) + 1) as Quarter;
    const year = 2000 + Math.floor((turn - 1) / 4);

    next = {
      ...next,
      turn,
      year,
      quarter,
      eventCooldowns: Object.fromEntries(
        Object.entries(next.eventCooldowns).map(([id, t]) => [id, Math.max(t - 1, 0)]),
      ),
    };
    next = tickModifiers(next);

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
  }

  // Условие завершения игры (кризис легитимности власти) — проверяется
  // КАЖДЫЕ сутки, не только на границе квартала: более отзывчиво, чем
  // раньше, ничего специально делать для этого не нужно.
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

  return next;
}
