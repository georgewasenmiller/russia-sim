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
  /** Индекс относительного ВВП, Москва = 100. Игробалансное приближение. */
  gdpIndex: number;
  /** Население, млн человек. */
  population: number;
  /** % */
  unemploymentRate: number;
  /** 0-100, выше = хуже. */
  corruptionIndex: number;
  /** Реальные соседи, но только внутри текущего набора регионов (см. план). */
  neighbors: string[];
}
