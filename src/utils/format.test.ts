import { describe, expect, it } from "vitest";
import { metricColor, metricSeverity } from "./format";

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
