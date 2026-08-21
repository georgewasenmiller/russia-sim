import { clamp } from "./constants";
import type { EventDef, GameState, SanctionState } from "./types";

function bump(
  state: GameState,
  patch: Partial<
    Pick<
      GameState,
      | "approval"
      | "corruption"
      | "socialUnrest"
      | "reserves"
      | "publicDebt"
      | "politicalPoints"
      | "oilPriceMeanTarget"
    >
  >,
): GameState {
  const next = { ...state, ...patch };
  next.approval = clamp(next.approval, [0, 100]);
  next.corruption = clamp(next.corruption, [0, 100]);
  next.socialUnrest = clamp(next.socialUnrest, [0, 100]);
  return next;
}

function addSanction(state: GameState, sanction: SanctionState): GameState {
  return { ...state, sanctions: [...state.sanctions, sanction] };
}

function clearSanction(state: GameState, id: string): GameState {
  return { ...state, sanctions: state.sanctions.filter((s) => s.id !== id) };
}

export const EVENT_DEFS: EventDef[] = [
  {
    id: "oil_supercycle",
    category: "commodity",
    cooldownTurns: 10,
    weight: (s) => (s.turn > 2 ? 0.05 : 0),
    build: () => ({
      id: "oil_supercycle",
      title: "Сырьевой суперцикл",
      description:
        "Мировой спрос на энергоносители резко вырос. Аналитики ожидают устойчивый рост цен на нефть.",
      choices: [
        {
          id: "accept",
          label: "Принять к сведению",
          description: "Долгосрочный ориентир цены нефти повышается.",
          apply: (s) =>
            bump(s, { oilPriceMeanTarget: s.oilPriceMeanTarget + 15 }),
        },
      ],
    }),
  },
  {
    id: "oil_price_collapse",
    category: "commodity",
    cooldownTurns: 10,
    weight: (s) => (s.turn > 2 ? 0.05 : 0),
    build: () => ({
      id: "oil_price_collapse",
      title: "Обвал цен на нефть",
      description:
        "Избыток предложения на мировом рынке обрушил цены на нефть и газ.",
      choices: [
        {
          id: "accept",
          label: "Принять к сведению",
          description: "Долгосрочный ориентир цены нефти снижается.",
          apply: (s) =>
            bump(s, {
              oilPriceMeanTarget: Math.max(s.oilPriceMeanTarget - 15, 12),
            }),
        },
      ],
    }),
  },
  {
    id: "corruption_scandal",
    category: "corruption",
    cooldownTurns: 6,
    weight: (s) => 0.03 + s.corruption / 800,
    build: () => ({
      id: "corruption_scandal",
      title: "Коррупционный скандал",
      description:
        "Журналисты опубликовали расследование о хищениях в крупном госконтракте.",
      choices: [
        {
          id: "investigate",
          label: "Начать официальное расследование",
          description: "Тратит политические очки, но снижает коррупцию и поднимает одобрение.",
          pgCost: 3,
          requires: (s) => s.politicalPoints >= 3,
          apply: (s) =>
            bump(
              { ...s, politicalPoints: s.politicalPoints - 3 },
              { corruption: s.corruption - 8, approval: s.approval + 4 },
            ),
        },
        {
          id: "cover_up",
          label: "Замять дело",
          description: "Коррупция и риск недовольства растут, но не тратит очков.",
          apply: (s) =>
            bump(s, {
              corruption: s.corruption + 6,
              socialUnrest: s.socialUnrest + 4,
            }),
        },
      ],
    }),
  },
  {
    id: "regional_protest",
    category: "regional",
    cooldownTurns: 6,
    weight: (s) => Math.max(0, (s.socialUnrest - 40) / 300),
    build: () => ({
      id: "regional_protest",
      title: "Региональные протесты",
      description:
        "В нескольких регионах прошли массовые акции протеста против роста цен.",
      choices: [
        {
          id: "concessions",
          label: "Пойти на уступки",
          description: "Снижает недовольство ценой резервов.",
          apply: (s) =>
            bump(s, {
              socialUnrest: s.socialUnrest - 10,
              reserves: s.reserves - 2,
            }),
        },
        {
          id: "crackdown",
          label: "Жёстко подавить",
          description: "Недовольство временно спадает, но одобрение падает.",
          apply: (s) =>
            bump(s, {
              socialUnrest: s.socialUnrest - 4,
              approval: s.approval - 6,
            }),
        },
      ],
    }),
  },
  {
    id: "sanctions_imposed",
    category: "international",
    cooldownTurns: 14,
    weight: (s) =>
      s.sanctions.length === 0 && s.turn > 6 ? 0.02 + s.corruption / 1000 : 0,
    build: () => ({
      id: "sanctions_imposed",
      title: "Международные санкции",
      description:
        "Группа стран вводит торговые и финансовые санкции в отношении России.",
      choices: [
        {
          id: "accept",
          label: "Принять к сведению",
          description: "Санкции начинают действовать.",
          apply: (s) =>
            addSanction(s, {
              id: "sanctions_1",
              label: "Международные санкции",
              oilExportDiscountPct: 12,
              interestRatePremium: 2.5,
              growthDragPct: 0.8,
              turnsRemaining: null,
            }),
        },
      ],
    }),
  },
  {
    id: "sanctions_lifted",
    category: "international",
    cooldownTurns: 14,
    weight: (s) =>
      s.sanctions.some((sc) => sc.id === "sanctions_1") && s.approval > 55
        ? 0.04
        : 0,
    build: () => ({
      id: "sanctions_lifted",
      title: "Санкции сняты",
      description: "Дипломатические усилия привели к снятию части ограничений.",
      choices: [
        {
          id: "accept",
          label: "Принять к сведению",
          description: "Санкционный режим смягчается.",
          apply: (s) => clearSanction(s, "sanctions_1"),
        },
      ],
    }),
  },
  {
    id: "currency_crisis",
    category: "financial",
    cooldownTurns: 12,
    weight: (s) =>
      s.reserves < 6 && s.publicDebt > 110 ? 0.15 : 0,
    build: () => ({
      id: "currency_crisis",
      title: "Валютный кризис",
      description:
        "Низкие резервы и высокий долг спровоцировали атаку на курс национальной валюты.",
      choices: [
        {
          id: "defend",
          label: "Защищать курс резервами",
          description: "Тратит резервы, сдерживает инфляционный скачок.",
          requires: (s) => s.reserves > 2,
          apply: (s) =>
            bump(s, { reserves: Math.max(s.reserves - 4, 0), approval: s.approval - 3 }),
        },
        {
          id: "float",
          label: "Отпустить курс",
          description: "Резервы сохраняются, но недовольство и коррупционные риски растут.",
          apply: (s) =>
            bump(s, {
              socialUnrest: s.socialUnrest + 10,
              approval: s.approval - 8,
            }),
        },
      ],
    }),
  },
];

export function rollForEvent(state: GameState): { def: EventDef } | null {
  const eligible = EVENT_DEFS.filter(
    (def) => (state.eventCooldowns[def.id] ?? 0) <= 0,
  );
  for (const def of eligible) {
    const w = def.weight(state);
    if (w > 0 && Math.random() < w) {
      return { def };
    }
  }
  return null;
}

export function resolveEventChoice(
  state: GameState,
  choiceId: string,
): GameState {
  if (!state.activeEvent) return state;
  const choice = state.activeEvent.choices.find((c) => c.id === choiceId);
  if (!choice) return state;
  if (choice.requires && !choice.requires(state)) return state;

  const applied = choice.apply(state);
  return {
    ...applied,
    activeEvent: null,
    log: [...applied.log, `Событие "${state.activeEvent.title}": ${choice.label}.`],
  };
}
