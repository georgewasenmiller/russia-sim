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
   * Статический сид-показатель качества инфраструктуры, 15-95, выведенный
   * один раз из стартового gdpIndex региона (см. src/regions/data.ts) и
   * неизменный до конца партии — влияет на скорость/стоимость стройки
   * (src/engine/industries.ts), но сам по себе не строится/не обновляется
   * на этом этапе.
   */
  infrastructureLevel: number;
}

/** Живое, симулируемое по ходам экономическое состояние одного региона. */
export interface RegionEconomy {
  gdpIndex: number;
  unemploymentRate: number;
  corruptionIndex: number;
  /**
   * Накопленная часть gdpIndex, происходящая именно от построенных в
   * регионе предприятий (растёт параллельно gdpIndex той же формулой —
   * см. advanceRegionEconomies). "Базовая экономика" региона выводится
   * как gdpIndex - industryGdpIndex, отдельно не хранится.
   */
  industryGdpIndex: number;
}
