import { describe, expect, it } from "vitest";
import {
  debtRatioColorClass,
  fmtInfraLevel,
  fmtUsdMnPerDay,
  isDebtRatioCritical,
  metricColor,
  metricSeverity,
} from "./format";

describe("metricSeverity / metricColor", () => {
  it("classifies non-inverted metrics (higher is better)", () => {
    const thresholds = { good: 3, warn: 0 };
    expect(metricSeverity(5, thresholds)).toBe("ok");
    expect(metricSeverity(3, thresholds)).toBe("ok");
    expect(metricSeverity(1, thresholds)).toBe("warn");
    expect(metricSeverity(0, thresholds)).toBe("warn");
    expect(metricSeverity(-1, thresholds)).toBe("critical");
  });

  it("classifies inverted metrics (lower is better)", () => {
    const thresholds = { good: 8, warn: 15 };
    expect(metricSeverity(5, thresholds, true)).toBe("ok");
    expect(metricSeverity(8, thresholds, true)).toBe("ok");
    expect(metricSeverity(12, thresholds, true)).toBe("warn");
    expect(metricSeverity(20, thresholds, true)).toBe("critical");
  });

  it("metricColor stays consistent with metricSeverity (regression after refactor)", () => {
    const thresholds = { good: 55, warn: 35 };
    expect(metricColor(70, thresholds)).toBe("text-emerald-400");
    expect(metricColor(40, thresholds)).toBe("text-amber-400");
    expect(metricColor(10, thresholds)).toBe("text-rose-400");
  });
});

describe("fmtUsdMnPerDay", () => {
  it("formats positive/negative/zero flows with sign and $ млн/день", () => {
    expect(fmtUsdMnPerDay(0.028)).toBe("+$28 млн/день");
    expect(fmtUsdMnPerDay(-0.045)).toBe("−$45 млн/день");
    expect(fmtUsdMnPerDay(0)).toBe("$0 млн/день");
  });
});

describe("debtRatioColorClass / isDebtRatioCritical: 4-tier debt/GDP thresholds", () => {
  it("classifies both sides of all three boundaries (50/75/100)", () => {
    expect(debtRatioColorClass(49)).toBe("text-emerald-400");
    expect(debtRatioColorClass(50)).toBe("text-amber-400");
    expect(debtRatioColorClass(74)).toBe("text-amber-400");
    expect(debtRatioColorClass(75)).toBe("text-orange-400");
    expect(debtRatioColorClass(99)).toBe("text-orange-400");
    expect(debtRatioColorClass(100)).toBe("text-rose-400");
  });

  it("only the >=100% tier is flagged critical", () => {
    expect(isDebtRatioCritical(99.9)).toBe(false);
    expect(isDebtRatioCritical(100)).toBe(true);
    expect(isDebtRatioCritical(150)).toBe(true);
  });
});

describe("fmtInfraLevel", () => {
  it("rounds the raw 0-100 level to the nearest 'X из 10' band", () => {
    expect(fmtInfraLevel(0)).toBe("0 из 10");
    expect(fmtInfraLevel(45)).toBe("5 из 10");
    expect(fmtInfraLevel(44)).toBe("4 из 10");
    expect(fmtInfraLevel(100)).toBe("10 из 10");
  });
});
