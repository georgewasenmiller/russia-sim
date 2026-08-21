const LOW_COLOR: [number, number, number] = [22, 78, 99]; // cyan-900 #164e63
const HIGH_COLOR: [number, number, number] = [251, 191, 36]; // amber-400 #fbbf24

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function toHex(rgb: [number, number, number]): string {
  return (
    "#" +
    rgb
      .map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, "0"))
      .join("")
  );
}

/**
 * ВВП-индекс сильно скошен Москвой (100 против 11-42 у остальных), поэтому
 * нормализация идёт через sqrt — иначе все регионы кроме Москвы визуально
 * сливаются в один тусклый цвет при линейной шкале.
 */
export function normalizeGdp(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  const linear = Math.min(1, Math.max(0, (value - min) / (max - min)));
  return Math.sqrt(linear);
}

export function gdpColor(value: number, min: number, max: number): string {
  const t = normalizeGdp(value, min, max);
  const rgb: [number, number, number] = [
    lerp(LOW_COLOR[0], HIGH_COLOR[0], t),
    lerp(LOW_COLOR[1], HIGH_COLOR[1], t),
    lerp(LOW_COLOR[2], HIGH_COLOR[2], t),
  ];
  return toHex(rgb);
}

export function gdpDomain(values: number[]): [number, number] {
  return [Math.min(...values), Math.max(...values)];
}

/** Стопы для градиентной легенды (0%, 25%, ..., 100% по sqrt-шкале). */
export function legendStops(min: number, max: number, steps = 5): { t: number; color: string; value: number }[] {
  return Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1);
    // инвертируем sqrt, чтобы стопы легенды были равномерны по t (визуально),
    // а подписанное значение соответствовало этой точке шкалы
    const linear = t * t;
    const value = min + linear * (max - min);
    return { t, color: gdpColor(value, min, max), value };
  });
}
