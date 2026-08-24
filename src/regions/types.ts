export type Specialization =
  | "oil"
  | "gas"
  | "coal"
  | "metals"
  | "agriculture"
  | "industry"
  | "finance"
  | "tech"
  | "ports";

export interface Region {
  id: string;
  name: string;
  /** Точная строка properties.name в src/regions/geo/russia-regions.geo.json */
  geoName: string;
  specializations: Specialization[];
  /**
   * Исходное (сид) значение индекса ВВП при старте новой игры, Москва = 100.
   * Живое значение по ходу игры хранится в state.regionEconomies[id].gdpIndex —
   * это поле не обновляется, читать его напрямую для отображения нельзя.
   */
  gdpIndex: number;
  /** Население, млн человек. Не меняется по ходу игры (миграция — отдельный этап). */
  population: number;
  /**
   * Исходное (сид) значение безработицы при старте игры, %. Живое значение —
   * state.regionEconomies[id].unemploymentRate.
   */
  unemploymentRate: number;
  /**
   * Исходное (сид) значение коррупции при старте игры, 0-100 (выше = хуже).
   * Также служит структурным "якорем", к которому дрейфует живое значение
   * между реформами. Живое значение — state.regionEconomies[id].corruptionIndex.
   */
  corruptionIndex: number;
  /** Реальные соседи, но только внутри текущего набора регионов (см. план). */
  neighbors: string[];
  /**
   * Стартовая точка (не константа на всю игру) качества инфраструктуры,
   * 15-95, выведенная один раз из стартового gdpIndex региона (см.
   * src/regions/data.ts). Живое, растущее по ходу игры значение —
   * state.regionEconomies[id].infrastructureLevel — сеется отсюда при
   * createInitialState и дальше обновляется независимо (инфраструктура
   * теперь строимый объект, см. src/engine/industries.ts).
   */
  infrastructureSeed: number;
}

/** Живое, симулируемое по ходам экономическое состояние одного региона. */
export interface RegionEconomy {
  gdpIndex: number;
  unemploymentRate: number;
  corruptionIndex: number;
  /**
   * Живой, строимый уровень инфраструктуры, 0-100. Растёт при завершении
   * строек сектора "infrastructure" (см. advanceRegionEconomies) и влияет
   * на скорость/стоимость любой стройки в этом регионе, а также на число
   * доступных производственных слотов (см. src/engine/industries.ts).
   */
  infrastructureLevel: number;
}
