export function fmtPct(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

export function fmtSignedPct(value: number, digits = 1): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

export function fmtUsdBn(value: number, digits = 1): string {
  return `$${value.toFixed(digits)} млрд`;
}

/** Автомасштабирование млрд/трлн для крупных сумм (ВВП страны/региона). */
export function fmtUsdAuto(valueBn: number, digits = 2): string {
  if (Math.abs(valueBn) >= 1000) {
    return `$${(valueBn / 1000).toFixed(digits)} трлн`;
  }
  return `$${valueBn.toFixed(1)} млрд`;
}

/** ВВП на душу и другие абсолютные суммы в $ с разделителем тысяч. */
export function fmtUsdPerCapita(value: number): string {
  return `$${Math.round(value).toLocaleString("ru-RU")}`;
}

export function fmtNum(value: number, digits = 0): string {
  return value.toFixed(digits);
}

export function fmtQuarterDate(year: number, quarter: number): string {
  return `${quarter} кв. ${year}`;
}

export type MetricSeverity = "ok" | "warn" | "critical";

export function metricSeverity(
  value: number,
  thresholds: { good: number; warn: number },
  invert = false,
): MetricSeverity {
  const better = invert ? value <= thresholds.good : value >= thresholds.good;
  const warn = invert ? value <= thresholds.warn : value >= thresholds.warn;
  if (better) return "ok";
  if (warn) return "warn";
  return "critical";
}

export function metricColor(
  value: number,
  thresholds: { good: number; warn: number },
  invert = false,
): string {
  const severity = metricSeverity(value, thresholds, invert);
  if (severity === "ok") return "text-emerald-400";
  if (severity === "warn") return "text-amber-400";
  return "text-rose-400";
}
