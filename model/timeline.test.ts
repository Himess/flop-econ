/**
 * Timeline and lock-modelling invariants.
 *
 * The claim this section makes is that the tool's old payback figure was wrong — that it reported
 * a month at which nothing had actually been recovered. These tests pin the corrected behaviour
 * and the size of the correction, so the claim survives future edits.
 */
import { describe, expect, it } from "vitest";
import {
  bothScenarios,
  liquiditySummary,
  payback,
  timeline,
  UNBOND_MONTHS,
  type TimelineInputs,
} from "./timeline";
import { param } from "./params.generated";
import { isBlocked, num } from "./types";
import { blockReward, BLOCKS_PER_YEAR } from "./emission";
import { blockRewardIncome, type ValidatorInputs } from "./validator";

const MIN_STAKE = num(param("validator_min_stake"));
const WIRED = num(param("validator_active_set_wired"));

const VAL: ValidatorInputs = {
  stake: MIN_STAKE * 1.2,
  networkStake: MIN_STAKE * WIRED,
  activeSetSize: WIRED,
  era: 0,
  auditVerdictsPerYear: 5_000,
};

const INP: TimelineInputs = {
  validator: VAL,
  months: 36,
  priceUsd: 0.05,
  hardwareUsd: 30_000,
  monthlyCostUsd: 1_500,
};

describe("timeline shape", () => {
  it("produces one row per month over the horizon", () => {
    expect(timeline(INP, "liquid")).toHaveLength(36);
    expect(timeline({ ...INP, months: 60 }, "liquid")).toHaveLength(60);
  });

  it("lands the halving in the right month — one crossing at 36, two at 60", () => {
    const at36 = timeline(INP, "liquid").filter((r) => r.eraBoundary);
    const at60 = timeline({ ...INP, months: 60 }, "liquid").filter((r) => r.eraBoundary);
    expect(at36).toHaveLength(1);
    expect(at60).toHaveLength(2);
    // 730 days is a shade over 24 months, so the boundary falls at month 25.
    expect(at36[0]!.month).toBe(25);
    expect(at36[0]!.era).toBe(1);
  });

  it("halves the monthly reward across the boundary", () => {
    const rows = timeline(INP, "liquid");
    const before = rows.find((r) => r.month === 24)!;
    const after = rows.find((r) => r.month === 26)!;
    // Audit income is flat, so the ratio is not exactly 2 — the block-reward leg is.
    expect(blockReward(after.era).value / blockReward(before.era).value).toBe(0.5);
    expect(after.earnedFlop).toBeLessThan(before.earnedFlop);
  });

  it("charges hardware once, in month one, and monthly costs every month", () => {
    const rows = timeline(INP, "liquid");
    expect(rows[0]!.costUsd).toBe(30_000 + 1_500);
    expect(rows[1]!.costUsd).toBe(1_500);
    expect(rows[35]!.cumulativeCostUsd).toBe(30_000 + 1_500 * 36);
  });

  it("cumulative earned is monotonic and matches the sum of monthly earnings", () => {
    const rows = timeline(INP, "liquid");
    let running = 0;
    for (const r of rows) {
      running += r.earnedFlop;
      expect(r.cumulativeEarnedFlop).toBeCloseTo(running, 6);
    }
  });
});

describe("the earned / locked / liquid split", () => {
  it("under 0% lock, everything earned is liquid immediately", () => {
    const rows = timeline(INP, "liquid");
    for (const r of rows) {
      expect(r.lockedFlop).toBe(0);
      expect(r.cumulativeLiquidFlop).toBeCloseTo(r.cumulativeEarnedFlop, 6);
    }
  });

  it("under auto-compound, the block-reward leg is locked and only audit income is liquid", () => {
    const rows = timeline(INP, "locked_autocompound");
    const first = rows[0]!;
    expect(first.lockedFlop).toBeGreaterThan(0);
    expect(first.cumulativeLiquidFlop).toBeLessThan(first.cumulativeEarnedFlop);
    // Audit fees are claimed, not swept into stake, so they stay spendable.
    const audit = 5_000 / 12;
    expect(first.cumulativeLiquidFlop).toBeCloseTo(audit, 4);
  });

  it("locked FLOP is never lost — earned equals liquid plus still-locked, every month", () => {
    for (const sc of ["locked_autocompound", "liquid"] as const) {
      for (const r of timeline(INP, sc)) {
        expect(r.cumulativeLiquidFlop + r.outstandingLockedFlop, `${sc} m${r.month}`).toBeCloseTo(
          r.cumulativeEarnedFlop,
          4,
        );
      }
    }
  });

  it("auto-compounded reward raises the stake month over month", () => {
    const rows = timeline(INP, "locked_autocompound");
    expect(rows[0]!.stakeFlop).toBeGreaterThan(VAL.stake);
    expect(rows[35]!.stakeFlop).toBeGreaterThan(rows[0]!.stakeFlop);
    // and does not, under 0% lock
    expect(timeline(INP, "liquid")[35]!.stakeFlop).toBe(VAL.stake);
  });

  it("compounded reward is NOT withdrawable while you keep validating", () => {
    // The correction that matters: it becomes stake, not a maturing tranche. With no exit
    // modelled, nothing from the block-reward leg is ever released inside the horizon.
    const rows = timeline(INP, "locked_autocompound");
    expect(rows.every((r) => r.unlockedFlop === 0)).toBe(true);
    const last = rows[rows.length - 1]!;
    expect(last.outstandingLockedFlop).toBeGreaterThan(0);
    // Everything that ever became liquid is audit income alone.
    expect(last.cumulativeLiquidFlop).toBeCloseTo(5_000 * (36 / 12), 2);
  });

  it("an exit releases the compounded stake after unbonding, and not before", () => {
    const rows = timeline({ ...INP, exitAtMonth: 12 }, "locked_autocompound");
    const firstRelease = rows.find((r) => r.unlockedFlop > 0)!;
    expect(firstRelease.month).toBe(13); // month 12 + 21 days, rounded up
    expect(rows.slice(0, 12).every((r) => r.unlockedFlop === 0)).toBe(true);
  });

  it("a bond lock defers the release past the exit when it is longer", () => {
    const rows = timeline({ ...INP, exitAtMonth: 6, bondLockMonths: 24 }, "locked_autocompound");
    const firstRelease = rows.find((r) => r.unlockedFlop > 0)!;
    expect(firstRelease.month).toBeGreaterThanOrEqual(24);
  });

  it("unbonding is 21 days, which is under a month", () => {
    expect(UNBOND_MONTHS).toBeCloseTo(21 / (365 / 12), 6);
    expect(UNBOND_MONTHS).toBeLessThan(1);
  });
});

describe("the compounding feedback loop", () => {
  /**
   * The loop is real but nets to zero at the set average. The validator pool is fixed by emission,
   * not by total stake, so if everyone compounds at the same rate the pro-rata share is unchanged —
   * exactly parallel to the 1.1x committee premium cancelling at the average seat rate.
   */
  it("holds pool share constant when the network compounds in step", () => {
    const rows = timeline({ ...INP, networkCompoundsInStep: true }, "locked_autocompound");
    const shareAt = (r: (typeof rows)[number]) =>
      blockRewardIncome({ ...VAL, stake: r.stakeFlop, networkStake: VAL.networkStake, era: r.era })
        .value;
    // Month 1 and month 12 are in the same era, so any change is the compounding loop alone.
    const m1 = rows[0]!;
    const m12 = rows[11]!;
    expect(m12.era).toBe(m1.era);
    // Earned per month is flat within an era when the network keeps pace.
    expect(m12.earnedFlop).toBeCloseTo(m1.earnedFlop, 4);
    expect(shareAt(m12)).toBeGreaterThan(shareAt(m1)); // absolute stake did grow
  });

  it("grows the share when the network does NOT keep pace", () => {
    const rows = timeline({ ...INP, networkCompoundsInStep: false }, "locked_autocompound");
    expect(rows[11]!.earnedFlop).toBeGreaterThan(rows[0]!.earnedFlop);
  });
});

describe("payback — the correction", () => {
  it("accounting payback is when cumulative EARNED covers cost", () => {
    const rows = timeline(INP, "liquid");
    const p = payback(rows, INP, "liquid");
    if (isBlocked(p.accountingMonths)) throw new Error("unexpected block");
    const m = p.accountingMonths.value;
    expect(rows[m - 1]!.cumulativeEarnedUsd).toBeGreaterThanOrEqual(rows[m - 1]!.cumulativeCostUsd);
    if (m > 1) {
      expect(rows[m - 2]!.cumulativeEarnedUsd).toBeLessThan(rows[m - 2]!.cumulativeCostUsd);
    }
  });

  it("under 0% lock the two paybacks coincide — nothing is withheld", () => {
    const rows = timeline(INP, "liquid");
    const p = payback(rows, INP, "liquid");
    if (isBlocked(p.gapMonths)) throw new Error("unexpected block");
    expect(p.gapMonths.value).toBe(0);
  });

  it("under auto-compound the cash payback is strictly later, or never arrives", () => {
    const rows = timeline(INP, "locked_autocompound");
    const p = payback(rows, INP, "locked_autocompound");
    if (isBlocked(p.accountingMonths)) throw new Error("accounting payback should resolve");
    // Cash payback either lands later than accounting, or does not land at all in the horizon.
    if (isBlocked(p.cashMonths)) {
      expect(p.cashMonths.message + p.cashMonths.detail).toMatch(/longer horizon/);
    } else {
      expect(p.cashMonths.value).toBeGreaterThan(p.accountingMonths.value);
    }
  });

  it("blocks rather than guessing when price or hardware cost is missing", () => {
    const rows = timeline(INP, "liquid");
    for (const bad of [{ ...INP, priceUsd: undefined }, { ...INP, hardwareUsd: undefined }]) {
      expect(isBlocked(payback(rows, bad, "liquid").accountingMonths)).toBe(true);
    }
  });

  it("names the horizon rather than reporting a false month when payback never lands", () => {
    const p = payback(
      timeline({ ...INP, months: 6, hardwareUsd: 5_000_000 }, "liquid"),
      { ...INP, months: 6, hardwareUsd: 5_000_000 },
      "liquid",
    );
    expect(isBlocked(p.accountingMonths)).toBe(true);
    if (isBlocked(p.accountingMonths)) expect(p.accountingMonths.message).toMatch(/longer horizon/);
  });
});

describe("liquidity summary", () => {
  it("reports profitability and first-withdrawal separately", () => {
    const s = liquiditySummary(timeline(INP, "locked_autocompound"), "locked_autocompound");
    expect(s.scenario).toBe("locked_autocompound");
    expect(isBlocked(s.firstLiquidMonth)).toBe(false);
    expect(s.stillLockedAtHorizon.value).toBeGreaterThan(0);
    expect(s.stillLockedAtHorizon.bucket).toBe("PLANNED"); // E.39 is unresolved
  });

  it("leaves nothing locked at the horizon under 0% lock", () => {
    const s = liquiditySummary(timeline(INP, "liquid"), "liquid");
    expect(s.stillLockedAtHorizon.value).toBe(0);
  });

  it("computes both E.39 scenarios together", () => {
    const both = bothScenarios(INP);
    expect(both.locked_autocompound).toHaveLength(36);
    expect(both.liquid).toHaveLength(36);
    expect(both.liquid[35]!.cumulativeLiquidFlop).toBeGreaterThan(
      both.locked_autocompound[35]!.cumulativeLiquidFlop,
    );
  });
});
