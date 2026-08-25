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

/** Суточный денежный поток бюджета: значение в $ млрд (как всё остальное
 * в движке) переводится в $ млн — суточные величины на порядки меньше
 * квартальных/годовых сумм, которыми оперирует fmtUsdBn, и теряли бы
 * точность при округлении до 0.1 млрд. */
export function fmtUsdMnPerDay(valueBn: number): string {
  const sign = valueBn > 0 ? "+" : valueBn < 0 ? "−" : "";
  return `${sign}$${Math.abs(valueBn * 1000).toFixed(0)} млн/день`;
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

/** "осталось 12 дн. 6 ч." / "осталось 6 ч." — для прогресса строек. */
export function fmtRemainingDuration(days: number): string {
  const clamped = Math.max(days, 0);
  const wholeDays = Math.floor(clamped);
  const hours = Math.round((clamped - wholeDays) * 24);
  return wholeDays > 0 ? `осталось ${wholeDays} дн. ${hours} ч.` : `осталось ${hours} ч.`;
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

/** Госдолг/ВВП% — отдельная 4-тиерная шкала (не 3-тиерный metricSeverity):
 * до ~50% — нейтрально, 50-75% — жёлтый, 75-100% — оранжевый, 100%+ —
 * красный (тревога). */
export function debtRatioColorClass(pctOfGdp: number): string {
  if (pctOfGdp < 50) return "text-emerald-400";
  if (pctOfGdp < 75) return "text-amber-400";
  if (pctOfGdp < 100) return "text-orange-400";
  return "text-rose-400";
}

export function isDebtRatioCritical(pctOfGdp: number): boolean {
  return pctOfGdp >= 100;
}

/** Инфраструктура региона как понятная шкала "X из 10" вместо сырых 0-100. */
export function fmtInfraLevel(level: number): string {
  return `${Math.round(level / 10)} из 10`;
}
