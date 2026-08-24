import { describe, expect, it } from "vitest";
import { TUNING, createInitialState } from "./constants";
import { computeMigrationDeltas, tradeGrowthBonus } from "./regionLinks";
import { processTurn } from "./turnEngine";
import { REGIONS, REGIONS_BY_ID } from "../regions/data";

describe("tradeGrowthBonus", () => {
  it("gives a resource-less region a bonus from a resource-specialized neighbor", () => {
    const state = createInitialState();
    const sverdlovsk = REGIONS_BY_ID.get("sverdlovsk")!; // metals+industry, neighbours khanty_mansi (oil)
    expect(sverdlovsk.specializations).not.toContain("oil");
    const bonus = tradeGrowthBonus(sverdlovsk, state.regionEconomies);
    expect(bonus).toBeGreaterThan(0);
  });

  it("gives zero bonus to a region with no resource-specialized neighbors", () => {
    const state = createInitialState();
    const moscow = REGIONS_BY_ID.get("moscow")!; // единственный сосед — moscow_oblast (industry+tech)
    expect(moscow.neighbors).toEqual(["moscow_oblast"]);
    const bonus = tradeGrowthBonus(moscow, state.regionEconomies);
    expect(bonus).toBe(0);
  });

  it("does not grant a bonus for a resource type the region already has itself", () => {
    const state = createInitialState();
    const tatarstan = REGIONS_BY_ID.get("tatarstan")!; // oil+industry
    expect(tatarstan.specializations).toContain("oil");
    // Найти соседа-нефтяника Татарстана, если такой есть, и убедиться, что
    // сам факт соседства с нефтью не добавляет бонус по типу oil.
    const hasOilNeighbor = tatarstan.neighbors.some(
      (id) => REGIONS_BY_ID.get(id)?.specializations.includes("oil"),
    );
    if (hasOilNeighbor) {
      // Бонус может быть > 0 только за счёт ДРУГИХ типов сырья, которых у
      // Татарстана нет (gas/coal/metals) — не за счёт oil.
      const bonus = tradeGrowthBonus(tatarstan, state.regionEconomies);
      const otherTypesOnly = tatarstan.neighbors.some((id) => {
        const n = REGIONS_BY_ID.get(id);
        return (
          n &&
          (n.specializations.includes("gas") ||
            n.specializations.includes("coal") ||
            n.specializations.includes("metals"))
        );
      });
      if (!otherTypesOnly) expect(bonus).toBe(0);
    }
  });

  it("dedups multiple same-type neighbors by taking the strongest, not summing", () => {
    const state = createInitialState();
    const sverdlovsk = REGIONS_BY_ID.get("sverdlovsk")!;
    // Свердловская область граничит и с Ханты-Мансийским АО (oil, gdp 55),
    // и с Тюменской областью (oil, gdp 14) — оба нефтяные соседи.
    expect(sverdlovsk.neighbors).toContain("khanty_mansi");
    expect(sverdlovsk.neighbors).toContain("tyumen_south");

    const bonusWithBoth = tradeGrowthBonus(sverdlovsk, state.regionEconomies);

    // Убираем более слабого нефтяного соседа из расчёта, оставляя только
    // сильного — бонус не должен уменьшиться (сумма не участвует).
    const economiesWithoutWeakNeighbor = {
      ...state.regionEconomies,
      tyumen_south: { ...state.regionEconomies.tyumen_south, gdpIndex: 0 },
    };
    const bonusWithoutWeak = tradeGrowthBonus(
      sverdlovsk,
      economiesWithoutWeakNeighbor,
    );

    expect(bonusWithBoth).toBeCloseTo(bonusWithoutWeak, 6);
  });

  it("caps the total bonus even with several distinct resource-type neighbors", () => {
    const state = createInitialState();
    // Искусственно завышаем gdpIndex всех соседей всех регионов, чтобы
    // спровоцировать бонус выше потолка, и убеждаемся, что клампится.
    const inflated = Object.fromEntries(
      Object.entries(state.regionEconomies).map(([id, e]) => [
        id,
        { ...e, gdpIndex: e.gdpIndex * 50 },
      ]),
    );
    for (const region of REGIONS) {
      const bonus = tradeGrowthBonus(region, inflated);
      expect(bonus).toBeLessThanOrEqual(TUNING.trade.maxTotalBonus + 1e-9);
    }
  });
});

describe("computeMigrationDeltas", () => {
  it("moves labor from a high-unemployment region toward a low-unemployment neighbor", () => {
    const state = createInitialState();
    const sverdlovsk = REGIONS_BY_ID.get("sverdlovsk")!;
    const neighborId = sverdlovsk.neighbors[0];

    const economies = {
      ...state.regionEconomies,
      [sverdlovsk.id]: { ...state.regionEconomies[sverdlovsk.id], unemploymentRate: 20 },
      [neighborId]: { ...state.regionEconomies[neighborId], unemploymentRate: 4 },
    };

    const deltas = computeMigrationDeltas(economies);
    expect(deltas[sverdlovsk.id]).toBeLessThan(0);
    // Реципиент ниже естественного уровня (naturalRate=6) — приток снижает
    // его безработицу ещё сильнее (ветка дефицита кадров).
    expect(deltas[neighborId]).toBeLessThanOrEqual(0);
  });

  it("does nothing for neighbor pairs within the gap threshold", () => {
    const state = createInitialState();
    // Уравниваем безработицу ВСЕХ регионов, чтобы гарантированно не было
    // посторонних пар с разрывом — тест целиком про сам порог, а не про
    // конкретных соседей.
    const economies = Object.fromEntries(
      REGIONS.map((r) => [r.id, { ...state.regionEconomies[r.id], unemploymentRate: 8 }]),
    );

    const deltas = computeMigrationDeltas(economies);
    for (const region of REGIONS) {
      expect(deltas[region.id]).toBe(0);
    }

    // Разница ровно на пороге (gapThreshold) тоже не должна запускать переток.
    const sverdlovsk = REGIONS_BY_ID.get("sverdlovsk")!;
    const neighborId = sverdlovsk.neighbors[0];
    const atThreshold = { ...economies };
    atThreshold[sverdlovsk.id] = {
      ...atThreshold[sverdlovsk.id],
      unemploymentRate: 8 + TUNING.migration.gapThreshold,
    };
    const deltasAtThreshold = computeMigrationDeltas(atThreshold);
    expect(deltasAtThreshold[sverdlovsk.id]).toBe(0);
    expect(deltasAtThreshold[neighborId]).toBe(0);
  });

  it("raises a recipient's unemployment slightly (not sharply) when it has no labor shortage", () => {
    const state = createInitialState();
    const sverdlovsk = REGIONS_BY_ID.get("sverdlovsk")!;
    const neighborId = sverdlovsk.neighbors[0];

    const economies = {
      ...state.regionEconomies,
      [sverdlovsk.id]: { ...state.regionEconomies[sverdlovsk.id], unemploymentRate: 20 },
      [neighborId]: { ...state.regionEconomies[neighborId], unemploymentRate: 12 }, // выше natural rate
    };

    const deltas = computeMigrationDeltas(economies);
    expect(deltas[neighborId]).toBeGreaterThan(0);
    expect(deltas[neighborId]).toBeLessThan(Math.abs(deltas[sverdlovsk.id]));
  });

  it("caps the total per-region delta even with multiple high-gap neighbors", () => {
    const state = createInitialState();
    const hub = REGIONS.find((r) => r.neighbors.length >= 5)!;
    const economies = { ...state.regionEconomies };
    economies[hub.id] = { ...economies[hub.id], unemploymentRate: 2 };
    for (const neighborId of hub.neighbors) {
      economies[neighborId] = { ...economies[neighborId], unemploymentRate: 39 };
    }

    const deltas = computeMigrationDeltas(economies);
    expect(Math.abs(deltas[hub.id])).toBeLessThanOrEqual(
      TUNING.migration.maxTotalDeltaPerTurn + 1e-9,
    );
  });
});

describe("trade/migration integration: gradualness over several turns", () => {
  it("narrows an artificial unemployment gap between real neighbors gradually, not instantly", () => {
    let state = createInitialState();
    const sverdlovsk = REGIONS_BY_ID.get("sverdlovsk")!;
    const neighborId = sverdlovsk.neighbors[0];

    state = {
      ...state,
      regionEconomies: {
        ...state.regionEconomies,
        [sverdlovsk.id]: { ...state.regionEconomies[sverdlovsk.id], unemploymentRate: 25 },
        [neighborId]: { ...state.regionEconomies[neighborId], unemploymentRate: 4 },
      },
    };

    const initialGap =
      state.regionEconomies[sverdlovsk.id].unemploymentRate -
      state.regionEconomies[neighborId].unemploymentRate;

    // Один ход не должен закрыть разрыв полностью — ни сходимость к целевой
    // безработице (adjustmentSpeed), ни миграция сами по себе не
    // телепортируют значение мгновенно.
    let next = processTurn(state);
    while (next.activeEvent) {
      next = { ...next, activeEvent: null };
      next = processTurn(next);
    }
    const gapAfterOneTurn =
      next.regionEconomies[sverdlovsk.id].unemploymentRate -
      next.regionEconomies[neighborId].unemploymentRate;
    expect(gapAfterOneTurn).toBeGreaterThan(0);
    expect(gapAfterOneTurn).toBeLessThan(initialGap);
  });
});
