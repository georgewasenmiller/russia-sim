import { describe, expect, it } from "vitest";
import {
  DAYS_PER_QUARTER,
  convergenceRate,
  fmtGameDate,
  flowScale,
  gameDateFromDays,
  msPerDayForSpeed,
  noiseScale,
  retentionRate,
} from "./time";

describe("time.ts rescaling helpers", () => {
  it("all four helpers are the identity at days=DAYS_PER_QUARTER — days=90 reproduces the old quarterly model exactly", () => {
    const cases = [0.02, 0.12, 0.4, 0.55, 0.7, 0.9];
    for (const x of cases) {
      expect(flowScale(x, DAYS_PER_QUARTER)).toBeCloseTo(x, 10);
      expect(noiseScale(x, DAYS_PER_QUARTER)).toBeCloseTo(x, 10);
      expect(convergenceRate(x, DAYS_PER_QUARTER)).toBeCloseTo(x, 10);
      expect(retentionRate(x, DAYS_PER_QUARTER)).toBeCloseTo(x, 10);
    }
  });

  it("flowScale is linear: N days of accumulated flow equal one call with N days", () => {
    const quarterlyRate = 0.06;
    let accumulated = 0;
    for (let i = 0; i < DAYS_PER_QUARTER; i++) {
      accumulated += flowScale(quarterlyRate, 1);
    }
    expect(accumulated).toBeCloseTo(flowScale(quarterlyRate, DAYS_PER_QUARTER), 6);
  });

  it("convergenceRate composes exactly: 90 daily convergence steps reproduce one quarterly step (no drift)", () => {
    const quarterlySpeed = 0.4;
    const target = 100;
    let daily = 50;
    for (let i = 0; i < DAYS_PER_QUARTER; i++) {
      daily += convergenceRate(quarterlySpeed, 1) * (target - daily);
    }
    let quarterly = 50;
    quarterly += convergenceRate(quarterlySpeed, DAYS_PER_QUARTER) * (target - quarterly);
    expect(daily).toBeCloseTo(quarterly, 6);
  });

  it("retentionRate composes exactly: 90 daily retention steps reproduce one quarterly blend (no drift)", () => {
    const quarterlyRetention = 0.55;
    const anchor = 4;
    let daily = 20;
    for (let i = 0; i < DAYS_PER_QUARTER; i++) {
      const r = retentionRate(quarterlyRetention, 1);
      daily = r * daily + (1 - r) * anchor;
    }
    let quarterly = 20;
    const rQ = retentionRate(quarterlyRetention, DAYS_PER_QUARTER);
    quarterly = rQ * quarterly + (1 - rQ) * anchor;
    expect(daily).toBeCloseTo(quarterly, 6);
  });

  it("noiseScale grows with sqrt(days), not linearly — 4 days is double the stddev of 1 day", () => {
    expect(noiseScale(10, 4)).toBeCloseTo(noiseScale(10, 1) * 2, 10);
  });
});

describe("gameDateFromDays / fmtGameDate", () => {
  it("day 0 is the game epoch, 1 January 2000, midnight", () => {
    const date = gameDateFromDays(0);
    expect(date).toEqual({ year: 2000, month: 1, day: 1, hour: 0 });
  });

  it("advances the calendar with real (non-leap) month lengths", () => {
    // 31 (Jan) + 14 = 15 февраля
    const date = gameDateFromDays(31 + 14);
    expect(date.month).toBe(2);
    expect(date.day).toBe(15);
  });

  it("rolls over to the next year after 365 days", () => {
    const date = gameDateFromDays(365);
    expect(date.year).toBe(2001);
    expect(date.month).toBe(1);
    expect(date.day).toBe(1);
  });

  it("derives the hour from the fractional part of the day", () => {
    const date = gameDateFromDays(10.5);
    expect(date.hour).toBe(12);
  });

  it("formats a full Russian date string", () => {
    expect(fmtGameDate({ year: 2000, month: 3, day: 14, hour: 9 })).toBe(
      "14 марта 2000, 09:00",
    );
  });
});

describe("msPerDayForSpeed", () => {
  it("is monotonically decreasing — higher speed levels tick faster", () => {
    for (let level = 1; level < 5; level++) {
      expect(msPerDayForSpeed(level as 1 | 2 | 3 | 4 | 5)).toBeGreaterThan(
        msPerDayForSpeed((level + 1) as 1 | 2 | 3 | 4 | 5),
      );
    }
  });
});
