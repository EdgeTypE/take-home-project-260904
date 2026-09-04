import { describe, expect, it } from "vitest";
import { calculateEarningsCents } from "../src/server/services/payout";

describe("calculateEarningsCents", () => {
  it("pays nothing below the first full thousand views", () => {
    expect(calculateEarningsCents(0, 500)).toBe(0);
    expect(calculateEarningsCents(999, 500)).toBe(0);
  });

  it("pays the per-1k rate at exactly 1000 views", () => {
    expect(calculateEarningsCents(1000, 500)).toBe(500);
  });

  it("floors partial thousands down, never up", () => {
    expect(calculateEarningsCents(1999, 500)).toBe(500);
    expect(calculateEarningsCents(2000, 500)).toBe(1000);
    expect(calculateEarningsCents(2500, 500)).toBe(1000);
  });

  it("scales linearly with the payout rate", () => {
    expect(calculateEarningsCents(10_000, 1)).toBe(10);
    expect(calculateEarningsCents(10_000, 10_000)).toBe(100_000);
  });

  it("never returns negative earnings", () => {
    expect(calculateEarningsCents(-500, 500)).toBe(0);
    expect(calculateEarningsCents(1000, -50)).toBe(0);
  });
});
