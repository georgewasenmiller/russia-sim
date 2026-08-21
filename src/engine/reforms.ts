import type { GameState, ReformDef } from "./types";

export const REFORM_DEFS: ReformDef[] = [
  {
    id: "flat_tax_reform",
    category: "fiscal",
    label: "Плоская шкала налогообложения",
    description:
      "Упрощает налоговую систему, повышает собираемость за счёт снижения теневого сектора.",
    cost: 6,
    modifier: {
      label: "Плоская шкала налогообложения",
      effects: { taxCollectionEfficiency: 0.08 },
      duration: null,
    },
  },
  {
    id: "central_bank_independence",
    category: "institutional",
    label: "Независимость Центробанка",
    description:
      "Формально ограничивает эмиссионное финансирование дефицита, снижая инфляционные ожидания.",
    cost: 8,
    modifier: {
      label: "Независимость ЦБ",
      effects: { effectiveInterestRate: -1.2 },
      duration: null,
    },
  },
  {
    id: "anti_corruption_agency",
    category: "institutional",
    label: "Антикоррупционное агентство",
    description: "Создаёт независимый орган контроля госзакупок.",
    cost: 9,
    oneTimeEffects: { approval: -3 },
    modifier: {
      label: "Антикоррупционное агентство",
      effects: { corruption: -0.9 },
      duration: 12,
    },
  },
  {
    id: "social_support_program",
    category: "social",
    label: "Программа социальной поддержки",
    description:
      "Адресные выплаты уязвимым группам населения снижают недовольство ценой части резервов.",
    cost: 5,
    oneTimeEffects: { reserves: -3, socialUnrest: -6, approval: 4 },
  },
  {
    id: "pension_reform",
    category: "social",
    label: "Пенсионная реформа",
    description:
      "Снижает долгосрочную нагрузку на бюджет, но краткосрочно бьёт по одобрению и недовольству.",
    cost: 7,
    oneTimeEffects: { approval: -8, socialUnrest: 5 },
    modifier: {
      label: "Пенсионная реформа",
      effects: { gdpGrowthRateAnnual: 0.3 },
      duration: null,
    },
  },
  {
    id: "wto_accession_push",
    category: "foreign",
    label: "Курс на вступление в ВТО",
    description: "Открывает экономику для внешней торговли и инвестиций.",
    cost: 8,
    modifier: {
      label: "Интеграция в ВТО",
      effects: { gdpGrowthRateAnnual: 0.4, politicalPointsPerTurn: -0.3 },
      duration: 20,
    },
  },
  {
    id: "sovereign_wealth_fund",
    category: "fiscal",
    label: "Создание Фонда национального благосостояния",
    description:
      "Институционализирует сбережение нефтяных доходов, снижая волатильность бюджета.",
    cost: 7,
    requires: (state: GameState) => state.reserves > 15,
    modifier: {
      label: "ФНБ",
      effects: { effectiveInterestRate: -0.5 },
      duration: null,
    },
  },
  {
    id: "deregulation_push",
    category: "fiscal",
    label: "Дерегулирование малого бизнеса",
    description: "Снижает административные барьеры для предпринимательства.",
    cost: 5,
    modifier: {
      label: "Дерегулирование",
      effects: { gdpGrowthRateAnnual: 0.25, socialUnrest: -0.2 },
      duration: 16,
    },
  },
];

export function canApplyReform(state: GameState, reform: ReformDef): boolean {
  if (state.appliedReformIds.includes(reform.id)) return false;
  if (state.politicalPoints < reform.cost) return false;
  if (reform.requires && !reform.requires(state)) return false;
  return true;
}

export function applyReform(state: GameState, reformId: string): GameState {
  const reform = REFORM_DEFS.find((r) => r.id === reformId);
  if (!reform || !canApplyReform(state, reform)) return state;

  let next: GameState = {
    ...state,
    politicalPoints: state.politicalPoints - reform.cost,
    appliedReformIds: [...state.appliedReformIds, reform.id],
    log: [...state.log, `Проведена реформа: ${reform.label}.`],
  };

  if (reform.oneTimeEffects) {
    const e = reform.oneTimeEffects;
    next = {
      ...next,
      reserves: next.reserves + (e.reserves ?? 0),
      publicDebt: next.publicDebt + (e.publicDebt ?? 0),
      approval: Math.min(100, Math.max(0, next.approval + (e.approval ?? 0))),
      corruption: Math.min(
        100,
        Math.max(0, next.corruption + (e.corruption ?? 0)),
      ),
      socialUnrest: Math.min(
        100,
        Math.max(0, next.socialUnrest + (e.socialUnrest ?? 0)),
      ),
    };
  }

  if (reform.modifier) {
    next = {
      ...next,
      activeReforms: [
        ...next.activeReforms,
        {
          id: `mod-${reform.id}`,
          sourceId: reform.id,
          label: reform.modifier.label,
          effects: reform.modifier.effects,
          turnsRemaining: reform.modifier.duration,
        },
      ],
    };
  }

  return next;
}

export function tickModifiers(state: GameState): GameState {
  const activeReforms = state.activeReforms
    .map((m) =>
      m.turnsRemaining === null
        ? m
        : { ...m, turnsRemaining: m.turnsRemaining - 1 },
    )
    .filter((m) => m.turnsRemaining === null || m.turnsRemaining > 0);
  return { ...state, activeReforms };
}
