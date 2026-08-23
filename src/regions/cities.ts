/**
 * Крупные города-ориентиры на карте — чисто декоративные подписи (точка +
 * название), без своей логики/состояния. Столицы регионов с наибольшим
 * ВВП из REGIONS плюс несколько явно значимых городов (Новосибирск,
 * Екатеринбург, Владивосток). Координаты — общеизвестные [lon, lat].
 */
export interface MajorCity {
  name: string;
  coordinates: [number, number];
}

export const MAJOR_CITIES: MajorCity[] = [
  { name: "Москва", coordinates: [37.6173, 55.7558] },
  { name: "Санкт-Петербург", coordinates: [30.3351, 59.9343] },
  { name: "Новосибирск", coordinates: [82.9346, 55.0084] },
  { name: "Екатеринбург", coordinates: [60.6122, 56.8389] },
  { name: "Владивосток", coordinates: [131.8869, 43.1155] },
  { name: "Казань", coordinates: [49.1221, 55.7887] },
  { name: "Нижний Новгород", coordinates: [44.0059, 56.2965] },
  { name: "Челябинск", coordinates: [61.4291, 55.1644] },
  { name: "Самара", coordinates: [50.15, 53.2001] },
  { name: "Омск", coordinates: [73.3645, 54.9885] },
  { name: "Ростов-на-Дону", coordinates: [39.7015, 47.2357] },
  { name: "Уфа", coordinates: [55.9721, 54.7388] },
  { name: "Красноярск", coordinates: [92.8672, 56.0184] },
  { name: "Воронеж", coordinates: [39.2003, 51.672] },
  { name: "Пермь", coordinates: [56.2502, 58.0105] },
  { name: "Волгоград", coordinates: [44.5133, 48.708] },
  { name: "Краснодар", coordinates: [38.9769, 45.0355] },
  { name: "Тюмень", coordinates: [65.5343, 57.1522] },
];
