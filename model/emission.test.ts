/**
 * Emission-base regression tests.
 *
 * These exist because a factor-of-six error was suspected in the block cadence, and if it had
 * been real every FLOP figure the tool prints would have been six times wrong. It was not real —
 * see VALUATION.md §1 — but the audit is only worth doing once if its conclusion is pinned.
 *
 * Each assertion recomputes a total the specification states in its own prose from the Appendix A
 * rows the model actually reads. If anyone changes blocks_per_year, halving_interval_blocks,
 * the reward schedule or the subsidy schedule, at least one of these breaks.
 */
import { describe, expect, it } from "vitest";
import { param } from "./params.generated";
import { num } from "./types";
import { blockReward, subsidyPerBlock, BLOCKS_PER_YEAR } from "./emission";

const H = num(param("halving_interval_blocks"));
const MAX_HALVINGS = num(param("max_halvings"));

/** Sum of `perBlock(era) * H` over a range of eras — the shape every stated total takes. */
function totalOver(eras: number[], perBlock: (era: number) => number): number {
  return eras.reduce((a, e) => a + perBlock(e) * H, 0);
}

const HALVING_ERAS = Array.from({ length: MAX_HALVINGS }, (_, i) => i); // 0..4
const THROUGH_FLOOR = Array.from({ length: MAX_HALVINGS + 1 }, (_, i) => i); // 0..5

describe("emission base — the cadence audit, pinned", () => {
  it("reproduces the subsidy total the spec states in R9.3", () => {
    // R9.3: "total minted = 63,072,000 x (16 + 8 + 4 + 2 + 1) = 1,955,232,000 FLOP"
    expect(totalOver(HALVING_ERAS, (e) => subsidyPerBlock(e).value)).toBe(1_955_232_000);
  });

  it("reproduces the cumulative emission through era 5 the spec states in R9.2", () => {
    // R9.2: "Cumulative emission through the halving phase (end of era 5, ~year 12) is
    // 11,920,608,000 FLOP"
    expect(totalOver(THROUGH_FLOOR, (e) => blockReward(e).value)).toBe(11_920_608_000);
  });

  it("reproduces 2*R0*H = 12,109,824,000 (R9.2)", () => {
    expect(2 * blockReward(0).value * H).toBe(12_109_824_000);
  });

  it("reproduces floor_annual_emission from the floor reward and blocks_per_year", () => {
    // Appendix A: "perpetual floor tail: 3 FLOP/block x 31,536,000 blocks/yr"
    expect(num(param("floor_reward")) * BLOCKS_PER_YEAR).toBe(94_608_000);
  });

  it("the halving interval is exactly two years at this cadence (~730 days at 1s/block)", () => {
    expect(H / BLOCKS_PER_YEAR).toBe(2);
    expect(BLOCKS_PER_YEAR).toBe(365 * 86_400);
  });

  it("era-0 issuance matches the 9.6768M FLOP/day FLOP's own calculator states", () => {
    // Independent downstream corroboration: (96 reward + 16 subsidy) x 86,400 blocks/day.
    const perDay = (blockReward(0).value + subsidyPerBlock(0).value) * (BLOCKS_PER_YEAR / 365);
    expect(perDay).toBe(9_676_800);
  });

  /**
   * The suspected error's actual origin, pinned so nobody re-derives it.
   *
   * The block reward is exactly 6x the combined Labs+Foundation subsidy in every era, by
   * construction (96/16, 48/8, 24/4, 12/2, 6/1). So ANY total computed from rewards is exactly
   * six times the same total computed from subsidy. The "suspiciously clean 6.0" was that ratio,
   * not a six-second block time.
   */
  it("the reward is exactly 6x the combined subsidy in every halving era", () => {
    for (const e of HALVING_ERAS) {
      expect(blockReward(e).value / subsidyPerBlock(e).value, `era ${e}`).toBe(6);
    }
  });

  it("11,731,392,000 is the five-era reward total, not a subsidy total at a wrong cadence", () => {
    // 63,072,000 x (96+48+24+12+6) = 63,072,000 x 186. Excludes the perpetual-floor era.
    expect(totalOver(HALVING_ERAS, (e) => blockReward(e).value)).toBe(11_731_392_000);
    // And its ratio to the subsidy total is the per-era 6x above.
    expect(
      totalOver(HALVING_ERAS, (e) => blockReward(e).value) /
        totalOver(HALVING_ERAS, (e) => subsidyPerBlock(e).value),
    ).toBe(6);
  });

  it("blocks_per_year is recorded as derived, with its derivation, not inferred", () => {
    const p = param("blocks_per_year");
    expect(p.bucket).toBe("DEFINED");
    expect(p.derived).toBe(true);
    expect(p.derivation).toMatch(/floor_annual_emission/);
    expect(p.cite).toMatch(/Appendix A/);
  });

  it("carries the caveat that one-second blocks are a target, not a measurement", () => {
    expect(param("block_time_seconds").note).toMatch(/TARGETS|E\.46/);
  });
});
