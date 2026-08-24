/**
 * Игровой календарь и пересчёт квартальных формул на суточный тик — см.
 * план "Непрерывный игровой календарь...". Внутренний тик экономики
 * фиксирован (1 игровые сутки), но хелперы принимают явный `days` для
 * тестируемости и для регрессионных проверок при days=90 (совпадение со
 * старой квартальной моделью).
 */

/**
 * Стилизованный квартал для ЭКОНОМИКИ и каденции реформ/событий/истории —
 * НЕ равен реальному календарному кварталу (90-92 дня), расхождение ~2%
 * несущественно. Отображаемая дата (см. gameDateFromDays) использует
 * реальные длины месяцев независимо от этой константы.
 */
export const DAYS_PER_QUARTER = 90;
/** Без високосных — намеренное упрощение, не влияет на игровой баланс. */
export const DAYS_PER_YEAR = 365;

/**
 * Линейное масштабирование потокового члена ("константа × текущее
 * условие", добавляемого целиком за период — реформенные модификаторы,
 * дрейф ренты, миграционный поток, торговый бонус) с квартальной величины
 * на `days` игровых суток.
 */
export function flowScale(quarterlyRate: number, days: number): number {
  return quarterlyRate * (days / DAYS_PER_QUARTER);
}

/**
 * Масштабирование стандартного отклонения случайного шума по правилу
 * корня (сумма дисперсий независимых шагов) — так суммарная волатильность
 * за квартал (90 независимых суточных шагов) статистически совпадает со
 * старой однократной квартальной, в отличие от линейного деления.
 */
export function noiseScale(quarterlyStdDev: number, days: number): number {
  return quarterlyStdDev * Math.sqrt(days / DAYS_PER_QUARTER);
}

/**
 * Точная экспоненциальная конверсия "скорости закрытия разрыва"
 * (член вида `rate*(target-current)`, где rate — доля разрыва,
 * закрываемая за квартал) на суточную ставку. 90-кратное применение
 * суточной ставки даёт РОВНО ту же трансформацию, что один квартальный
 * шаг — не приближение, а геометрическая композиция без накопленного
 * смещения за сотни тиков.
 */
export function convergenceRate(quarterlySpeed: number, days: number): number {
  return 1 - Math.pow(1 - quarterlySpeed, days / DAYS_PER_QUARTER);
}

/**
 * То же самое, но для коэффициентов, выраженных как "доля СОХРАНЕНИЯ"
 * (persistence/inertia), а не "доля закрытия разрыва" — математически
 * эквивалентно `1 - convergenceRate(1-x, days)`, просто без лишнего `1-`
 * в местах вызова, где исходный коэффициент так и назван.
 */
export function retentionRate(quarterlyRetention: number, days: number): number {
  return Math.pow(quarterlyRetention, days / DAYS_PER_QUARTER);
}

export type GameSpeedLevel = 1 | 2 | 3 | 4 | 5;

export interface GameSpeedDef {
  level: GameSpeedLevel;
  label: string;
  /** Сколько реальных миллисекунд соответствуют одним игровым суткам на этой скорости. */
  msPerDay: number;
}

export const GAME_SPEEDS: GameSpeedDef[] = [
  { level: 1, label: "Медленно", msPerDay: 2000 },
  { level: 2, label: "Обычно", msPerDay: 1000 },
  { level: 3, label: "Быстро", msPerDay: 400 },
  { level: 4, label: "Очень быстро", msPerDay: 150 },
  { level: 5, label: "Максимум", msPerDay: 50 },
];

export function msPerDayForSpeed(level: GameSpeedLevel): number {
  return GAME_SPEEDS.find((s) => s.level === level)?.msPerDay ?? 1000;
}

export interface GameDate {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
}

const EPOCH_YEAR = 2000;
const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // без високосных
const MONTH_NAMES_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

/**
 * Отображаемая календарная дата от эпохи 1 января 2000 — по реальным
 * длинам месяцев (без високосных), НАМЕРЕННО отвязана от стилизованного
 * 90-дневного квартала (см. DAYS_PER_QUARTER), которым по-прежнему меряют
 * реформы/события/историю. Оба представления выводятся из одного и того
 * же gameTimeDays, не дублируют состояние.
 */
export function gameDateFromDays(totalDays: number): GameDate {
  const wholeDays = Math.max(0, Math.floor(totalDays));
  const hour = Math.floor((totalDays - Math.floor(totalDays)) * 24);

  let remaining = wholeDays;
  let year = EPOCH_YEAR;
  while (remaining >= DAYS_PER_YEAR) {
    remaining -= DAYS_PER_YEAR;
    year += 1;
  }

  let month = 0;
  while (remaining >= MONTH_LENGTHS[month]) {
    remaining -= MONTH_LENGTHS[month];
    month += 1;
  }

  return { year, month: month + 1, day: remaining + 1, hour };
}

/** "14 марта 2000, 09:00" */
export function fmtGameDate(date: GameDate): string {
  const hh = String(date.hour).padStart(2, "0");
  return `${date.day} ${MONTH_NAMES_GENITIVE[date.month - 1]} ${date.year}, ${hh}:00`;
}
