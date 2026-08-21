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

export function fmtNum(value: number, digits = 0): string {
  return value.toFixed(digits);
}

export function fmtQuarterDate(year: number, quarter: number): string {
  return `${quarter} кв. ${year}`;
}

export function metricColor(
  value: number,
  thresholds: { good: number; warn: number },
  invert = false,
): string {
  const better = invert ? value <= thresholds.good : value >= thresholds.good;
  const warn = invert ? value <= thresholds.warn : value >= thresholds.warn;
  if (better) return "text-emerald-400";
  if (warn) return "text-amber-400";
  return "text-rose-400";
}
