/**
 * Model invariants. A bad edit must fail here, loudly.
 *
 * The brief names five; this file asserts those plus the provenance rules that are the tool's
 * only real differentiator.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

import { PARAMS, PARAMS_SHA256, param, type Param } from "./params.generated";
import { blockReward, eraAtBlock, rolePoolPerYear, splitSumPpt, subsidyPerBlock, BLOCKS_PER_YEAR } from "./emission";
import { isBlocked, num } from "./types";
import {
  auditPoolSolvency,
  blockRewardIncome,
  breakEven,
  maxDelegated,
  minimumStake,
  operatingCost,
  queueCost,
  committeePremiumValue,
  seatRateFromStake,
  slashingLadder,
  specImpliedCost,
  type ValidatorInputs,
} from "./validator";
import {
  closePaths,
  conservationResidual,
  tariffUnits,
  disputeCost,
  escrowForSlots,
  overReservation,
  reservationSlots,
  tariff,
  tierComparison,
  topUp,
} from "./agent";

// --------------------------------------------------------------------- params integrity

describe("params.yaml <-> params.generated.ts", () => {
  it("generated file is in sync with the YAML", () => {
    const raw = readFileSync(join(__dirname, "..", "params.yaml"), "utf8");
    const hash = createHash("sha256").update(raw).digest("hex").slice(0, 16);
    expect(hash, "run `npm run gen:params` — params.yaml changed since the last generation").toBe(
      PARAMS_SHA256,
    );
  });

  it("every parameter carries a bucket and a citation", () => {
    for (const p of PARAMS) {
      expect(["DEFINED", "PLANNED", "ABSENT"], p.key).toContain(p.bucket);
      expect(p.cite, `${p.key} has no citation`).toBeTruthy();
    }
  });

  it("ABSENT parameters carry no value — the rule the whole tool rests on", () => {
    const offenders = PARAMS.filter((p: Param) => p.bucket === "ABSENT" && p.value !== undefined);
    expect(offenders.map((p) => p.key)).toEqual([]);
  });

  it("DEFINED parameters carry a value", () => {
    const offenders = PARAMS.filter((p: Param) => p.bucket === "DEFINED" && p.value === undefined);
    expect(offenders.map((p) => p.key)).toEqual([]);
  });

  it("reading an ABSENT parameter throws rather than returning a number", () => {
    expect(() => num(param("escrow_sizing_formula"))).toThrow(/ABSENT/);
    expect(() => num(param("session_price"))).toThrow(/ABSENT/);
    expect(() => num(param("channel_unit_to_flop"))).toThrow(/ABSENT/);
  });

  it("covers every ABSENT item the research passes identified", () => {
    const cites = PARAMS.map((p) => p.cite).join(" ");
    for (const e of ["E.8", "E.22", "E.23", "E.30", "E.33", "E.38", "E.39", "E.40", "E.41", "E.44", "E.47"]) {
      expect(cites, `${e} is not represented in params.yaml`).toContain(e);
    }
  });
});

// --------------------------------------------------------------------- emission

describe("emission (R9.2, R9.5, R9.12)", () => {
  it("halves five times then floors at 3 FLOP forever", () => {
    expect(blockReward(0).value).toBe(96);
    expect(blockReward(1).value).toBe(48);
    expect(blockReward(2).value).toBe(24);
    expect(blockReward(3).value).toBe(12);
    expect(blockReward(4).value).toBe(6);
    expect(blockReward(5).value).toBe(3);
    // Perpetual: era 6, 20, 100 all still 3.
    for (const era of [6, 20, 100]) expect(blockReward(era).value).toBe(3);
  });

  it("role splits sum to 1000 ppt", () => {
    expect(splitSumPpt()).toBe(1000);
  });

  it("era-0 per-block role rewards match the spec's worked example (72 / 9.6 / 9.6 / 4.8)", () => {
    const perBlock = (role: Parameters<typeof rolePoolPerYear>[0]) =>
      rolePoolPerYear(role, 0).value / BLOCKS_PER_YEAR;
    expect(perBlock("miner")).toBeCloseTo(72, 10);
    expect(perBlock("validator")).toBeCloseTo(9.6, 10);
    expect(perBlock("agent")).toBeCloseTo(9.6, 10);
    expect(perBlock("staker")).toBeCloseTo(4.8, 10);
  });

  it("first halving falls at block 63,072,001 (Day 730)", () => {
    expect(eraAtBlock(63_072_000 - 1)).toBe(0);
    expect(eraAtBlock(63_072_000)).toBe(1);
  });

  it("subsidy halves with the reward and is exactly 0 from era 5 (R9.3)", () => {
    expect(subsidyPerBlock(0).value).toBe(16);
    expect(subsidyPerBlock(1).value).toBe(8);
    expect(subsidyPerBlock(4).value).toBe(1);
    expect(subsidyPerBlock(5).value).toBe(0);
    expect(subsidyPerBlock(9).value).toBe(0);
  });

  it("total minted subsidy reproduces the spec's 1,955,232,000 FLOP figure", () => {
    // R9.3: 63,072,000 x (16 + 8 + 4 + 2 + 1)
    let total = 0;
    for (let era = 0; era < 5; era++) total += subsidyPerBlock(era).value * 63_072_000;
    expect(total).toBe(1_955_232_000);
  });
});

// --------------------------------------------------------------------- validator

const VAL: ValidatorInputs = {
  stake: 305_505,
  networkStake: 305_505 * 200,
  activeSetSize: 200,
  era: 0,
};

describe("validator", () => {
  it("reproduces the 42,236 FLOP/yr anchor from BOTH disclosed committee-cap points", () => {
    // §2.2: ~112 validators at the 1.5 FLOP floor, ~224 at 3 FLOP.
    const share = num(param("validator_share_ppt")) / 1000;
    const at15 = (1.5 * share * BLOCKS_PER_YEAR) / 112;
    const at30 = (3.0 * share * BLOCKS_PER_YEAR) / 224;
    expect(at15).toBeCloseTo(at30, 6);
    expect(at15).toBeCloseTo(42_235.71, 1);
    // And the params.yaml entry matches what the disclosure implies.
    expect(specImpliedCost().value).toBe(42_236);
    expect(Math.round(at15)).toBe(specImpliedCost().value);
  });

  it("the spec anchor is labelled DEFINED and carries its derivation", () => {
    const a = specImpliedCost();
    expect(a.bucket).toBe("DEFINED");
    expect(a.derivation).toMatch(/committee cap of 100 is/);
  });

  it("pool share sums to the whole pool across a uniform set", () => {
    const n = 200;
    const per = blockRewardIncome({ ...VAL, activeSetSize: n, networkStake: 305_505 * n });
    const pool = rolePoolPerYear("validator", 0).value;
    expect(per.value * n).toBeCloseTo(pool, 4);
  });

  it("the committee premium is worth 1.1x between the never- and always-seated bounds", () => {
    const never = blockRewardIncome({ ...VAL, committeeSeatProbability: 0 });
    const always = blockRewardIncome({ ...VAL, committeeSeatProbability: 1 });
    expect(always.value / never.value).toBeCloseTo(1.1, 10);
  });

  it("the premium cancels exactly for a validator seated at the set average", () => {
    // The finding a snapshot model would hide: 1.1x is a redistribution, not free income.
    const avg = blockRewardIncome(VAL);
    const pool = rolePoolPerYear("validator", 0).value;
    expect(avg.value).toBeCloseTo(pool * (VAL.stake / VAL.networkStake), 4);
    expect(avg.derivation).toMatch(/cancels at/);
  });

  it("the wired 200-validator cap pays 5x the ratified 1,000 cap", () => {
    const wired = blockRewardIncome({ ...VAL, activeSetSize: 200, networkStake: 305_505 * 200 });
    const ratified = blockRewardIncome({ ...VAL, activeSetSize: 1000, networkStake: 305_505 * 1000 });
    expect(wired.value / ratified.value).toBeCloseTo(5, 6);
  });

  it("minimum stake compounds at exactly +9%/yr from 305,505", () => {
    expect(minimumStake(0).value).toBe(305_505);
    expect(minimumStake(1).value).toBeCloseTo(305_505 * 1.09, 6);
    expect(minimumStake(10).value).toBeCloseTo(305_505 * 1.09 ** 10, 6);
  });

  it("MinSelfStakeRatio caps delegation at 4x self-stake (self >= 20% of the total)", () => {
    const d = maxDelegated(100_000);
    expect(d.value).toBeCloseTo(400_000, 6);
    // self / (self + delegated) = 100k / 500k = 20%
    expect(100_000 / (100_000 + d.value)).toBeCloseTo(0.2, 10);
  });

  it("genesis_validator_airdrop is exactly validator_min_stake x the ratified cap", () => {
    expect(num(param("genesis_validator_airdrop"))).toBe(
      num(param("validator_min_stake")) * num(param("validator_active_set_cap")),
    );
  });

  describe("refusal to compute", () => {
    it("operating cost blocks when BOTH heavy legs are missing, naming both", () => {
      const c = operatingCost(VAL);
      expect(isBlocked(c)).toBe(true);
      if (!isBlocked(c)) return;
      expect(c.missing).toContain("validator_da_volume_bytes");
      expect(c.missing).toContain("validator_gpu_backend_cost");
      expect(c.cites.join(" ")).toContain("E.47");
    });

    it("blocks when only the GPU leg is missing — the one models usually omit", () => {
      const c = operatingCost({ ...VAL, daCostPerYear: 10_000 });
      expect(isBlocked(c)).toBe(true);
      if (!isBlocked(c)) return;
      expect(c.missing).toEqual(["validator_gpu_backend_cost"]);
    });

    it("computes once both are supplied, and marks the result ABSENT-bucketed", () => {
      const c = operatingCost({ ...VAL, daCostPerYear: 10_000, gpuBackendCostPerYear: 30_000 });
      expect(isBlocked(c)).toBe(false);
      if (isBlocked(c)) return;
      expect(c.value).toBe(40_000);
      expect(c.bucket).toBe("ABSENT"); // user assumptions drag it down — the UI must say so
      expect(c.assumptions).toHaveLength(2);
    });

    it("net is blocked whenever cost is blocked, but the spec-anchor comparison still works", () => {
      const be = breakEven(VAL);
      expect(isBlocked(be.net)).toBe(true);
      expect(isBlocked(be.netAgainstSpecAnchor)).toBe(false);
      expect(be.revenue.bucket).toBe("DEFINED");
    });
  });

  describe("audit pool solvency", () => {
    it("break-even is ~5 FLOP per audited turn", () => {
      expect(auditPoolSolvency().breakEvenPerTurn.value).toBeCloseTo(5, 10);
    });

    it("derives from the three enforced parameters, not a hardcoded 5", () => {
      const split = num(param("audit_fee_split_ppm")) / 1e6;
      const fee = num(param("audit_fee_per_turn"));
      const alpha = num(param("sampled_audit_alpha_ppm")) / 1e6;
      expect(auditPoolSolvency().breakEvenPerTurn.value).toBeCloseTo((alpha * fee) / split, 12);
    });

    it("flags solvency against a supplied per-turn settlement", () => {
      expect(auditPoolSolvency(4.99).solvent).toBe(false);
      expect(auditPoolSolvency(5).solvent).toBe(true);
      expect(auditPoolSolvency(12).solvent).toBe(true);
    });

    it("carries the alpha caveat in its derivation", () => {
      expect(auditPoolSolvency().breakEvenPerTurn.derivation).toMatch(/audit_quantum_gn/);
    });
  });

  describe("slashing ladder", () => {
    const funded: ValidatorInputs = {
      ...VAL,
      daCostPerYear: 10_000,
      gpuBackendCostPerYear: 20_000,
    };

    it("covers all five rungs including the DA path outside the §11.3 table", () => {
      const rungs = slashingLadder(funded).map((r) => r.rung);
      expect(rungs).toEqual([
        "da_serve_or_slash",
        "liveness",
        "extended_downtime",
        "equivocation_lone",
        "fraud",
      ]);
    });

    it("loss fractions match the parameter set", () => {
      const l = slashingLadder(funded);
      const by = (r: string) => l.find((x) => x.rung === r)!;
      expect(by("da_serve_or_slash").lossPermanent.value).toBeCloseTo(VAL.stake * 0.01, 6);
      expect(by("liveness").lossPermanent.value).toBeCloseTo(VAL.stake * 0.01, 6);
      expect(by("extended_downtime").lossPermanent.value).toBeCloseTo(VAL.stake * 0.05, 6);
      expect(by("fraud").lossPermanent.value).toBeCloseTo(VAL.stake * 1.0, 6);
    });

    it("lone equivocation burns nothing permanently — 50% is withheld and returned", () => {
      const eq = slashingLadder(funded).find((r) => r.rung === "equivocation_lone")!;
      expect(eq.lossPermanent.value).toBe(0);
      expect(eq.lossReturned.value).toBeCloseTo(VAL.stake * 0.5, 6);
      expect(eq.lossReturned.derivation).toMatch(/180 days/);
    });

    it("the fraud rung has no recovery path at all", () => {
      const fraud = slashingLadder(funded).find((r) => r.rung === "fraud")!;
      expect(fraud.terminal).toBe(true);
      expect(isBlocked(fraud.recoveryDays)).toBe(true);
      if (isBlocked(fraud.recoveryDays)) expect(fraud.recoveryDays.message + fraud.recoveryDays.detail).toMatch(/blacklist/);
    });

    it("recovery blocks when net earnings are non-positive", () => {
      const underwater = slashingLadder({ ...funded, gpuBackendCostPerYear: 10_000_000 });
      const liveness = underwater.find((r) => r.rung === "liveness")!;
      expect(isBlocked(liveness.recoveryDays)).toBe(true);
      if (isBlocked(liveness.recoveryDays))
        expect(liveness.recoveryDays.message + liveness.recoveryDays.detail).toMatch(/never recovered/);
    });

    it("recovery includes the days out of the set, not just the earning days", () => {
      const l = slashingLadder(funded).find((r) => r.rung === "extended_downtime")!;
      expect(isBlocked(l.recoveryDays)).toBe(false);
      if (isBlocked(l.recoveryDays)) return;
      expect(l.daysOutOfSet.value).toBeCloseTo(7, 6); // ejection_cooldown_blocks
      expect(l.recoveryDays.value).toBeGreaterThan(l.daysOutOfSet.value);
    });
  });

  it("queue cost: full balance frozen, zero reward, and names the E.41 cap gap", () => {
    const q = queueCost(305_505, 90, 0.05);
    expect(q.stakeLocked.value).toBe(305_505);
    expect(q.rewardWhileQueued.value).toBe(0);
    expect(q.opportunityCost!.value).toBeCloseTo(305_505 * 0.05 * (90 / 365), 6);
    expect(q.opportunityCost!.bucket).toBe("ABSENT"); // the rate is the user's, not the spec's
    expect(q.note).toContain("E.41");
  });
});

// --------------------------------------------------------------------- agent

describe("agent", () => {
  const IN = { escrow: 1000, turns: 100, gnClaimed: 50_000, unitToFlop: 0.001 };

  it("conservation holds for arbitrary E and P", () => {
    for (const [E, P] of [
      [1000, 250],
      [1, 0],
      [1e9, 1e9],
      [42.5, 17.3],
      [0.05, 0.05],
    ] as const) {
      expect(Math.abs(conservationResidual(E, P))).toBeLessThan(1e-9);
    }
  });

  it("conservation holds across every resolved close path", () => {
    for (const o of closePaths(IN)) {
      if (isBlocked(o.agentRecovers) || isBlocked(o.minerKeeps) || isBlocked(o.burned)) continue;
      const total = o.agentRecovers.value + o.minerKeeps.value + o.burned.value;
      // Paths that refund or pay in full account for the whole escrow; the "no remedy" rows
      // deliberately account for none, and say so in their caveat.
      if (o.caveat === undefined) expect(total).toBeCloseTo(IN.escrow, 6);
    }
  });

  it("cooperative settle pays the full escrow and refunds nothing — the headline", () => {
    const coop = closePaths(IN).find((p) => p.path === "cooperative_settle")!;
    expect(isBlocked(coop.agentRecovers)).toBe(false);
    if (isBlocked(coop.agentRecovers) || isBlocked(coop.minerKeeps)) return;
    expect(coop.agentRecovers.value).toBe(0);
    expect(coop.minerKeeps.value).toBe(IN.escrow);
    expect(coop.rule).toMatch(/no completion SLA/);
    expect(coop.cites.join(" ")).toContain("M9");
  });

  it("ambiguous early close splits (1-phi)(E-P) / phi(E-P) at phi = 20%", () => {
    const amb = closePaths(IN).find((p) => p.path === "ambiguous_early_close")!;
    if (isBlocked(amb.agentRecovers) || isBlocked(amb.burned) || isBlocked(amb.minerKeeps)) {
      throw new Error("should not be blocked with a rate supplied");
    }
    const P = amb.minerKeeps.value;
    expect(amb.agentRecovers.value).toBeCloseTo(0.8 * (IN.escrow - P), 6);
    expect(amb.burned.value).toBeCloseTo(0.2 * (IN.escrow - P), 6);
  });

  it("full-refund paths return exactly E", () => {
    const paths = closePaths(IN);
    for (const id of ["non_delivery_timeout", "force_open_unacked", "upheld_fraud_dispute", "da_unrecoverable"]) {
      const p = paths.find((x) => x.path === id)!;
      if (isBlocked(p.agentRecovers)) throw new Error(`${id} unexpectedly blocked`);
      expect(p.agentRecovers.value, id).toBe(IN.escrow);
    }
  });

  it("ghost-task failure returns nothing to the agent", () => {
    const g = closePaths(IN).find((p) => p.path === "ghost_task_failure")!;
    if (isBlocked(g.agentRecovers)) throw new Error("unexpected block");
    expect(g.agentRecovers.value).toBe(0);
    expect(g.caveat).toBeTruthy();
  });

  it("SLA breach is blocked, not guessed — the rebate is negotiated", () => {
    const s = closePaths(IN).find((p) => p.path === "sla_breach")!;
    expect(isBlocked(s.agentRecovers)).toBe(true);
    if (isBlocked(s.agentRecovers)) expect(s.agentRecovers.cites.join(" ")).toMatch(/M6|sla_breach/);
  });

  describe("refusal to compute", () => {
    it("the tariff in channel pay units needs no assumption at all", () => {
      // Both legs are DEFINED (both coefficients are 1); only the FLOP conversion is missing.
      const u = tariffUnits({ escrow: 1000, turns: 10, gnClaimed: 500 });
      expect(u.bucket).toBe("DEFINED");
      expect(u.value).toBe(510);
      expect(u.unit).toBe("channel pay units");
    });

    it("the tariff blocks without the channel-unit conversion, naming E.30", () => {
      const t = tariff({ escrow: 1000, turns: 10, gnClaimed: 500 });
      expect(isBlocked(t)).toBe(true);
      if (isBlocked(t)) {
        expect(t.missing).toEqual(["channel_unit_to_flop"]);
        expect(t.cites.join(" ")).toContain("E.30");
      }
    });

    it("every tariff-dependent path blocks along with it", () => {
      const noRate = { escrow: 1000, turns: 10, gnClaimed: 500 };
      const amb = closePaths(noRate).find((p) => p.path === "ambiguous_early_close")!;
      expect(isBlocked(amb.agentRecovers)).toBe(true);
      expect(isBlocked(overReservation(noRate).unused)).toBe(true);
      expect(isBlocked(topUp(noRate).required)).toBe(true);
    });

    it("paths that need no tariff still resolve without a rate", () => {
      const noRate = { escrow: 1000, turns: 10, gnClaimed: 500 };
      const coop = closePaths(noRate).find((p) => p.path === "cooperative_settle")!;
      expect(isBlocked(coop.minerKeeps)).toBe(false);
      if (!isBlocked(coop.minerKeeps)) expect(coop.minerKeeps.value).toBe(1000);
    });

    it("a supplied rate is recorded as an assumption, and drags the bucket to ABSENT", () => {
      const t = tariff(IN);
      expect(isBlocked(t)).toBe(false);
      if (isBlocked(t)) return;
      expect(t.bucket).toBe("ABSENT");
      expect(t.assumptions[0]!.key).toBe("channel_unit_to_flop");
    });
  });

  it("over-reservation: the whole remainder is lost on cooperative settle", () => {
    const o = overReservation(IN);
    if (isBlocked(o.unused) || isBlocked(o.lostIfCooperative) || isBlocked(o.burnedIfAmbiguous)) return;
    expect(o.lostIfCooperative.value).toBeCloseTo(o.unused.value, 10);
    expect(o.burnedIfAmbiguous.value).toBeCloseTo(0.2 * o.unused.value, 10);
  });

  it("top-up is zero when over-reserved and positive when under-reserved", () => {
    const over = topUp(IN);
    if (!isBlocked(over.required)) expect(over.required.value).toBe(0);
    const under = topUp({ ...IN, escrow: 1 });
    if (!isBlocked(under.required)) expect(under.required.value).toBeGreaterThan(0);
  });

  it("reservation slots: 4 base, +1 per 50 FLOP", () => {
    expect(reservationSlots(0).value).toBe(4);
    expect(reservationSlots(49).value).toBe(4);
    expect(reservationSlots(50).value).toBe(5);
    expect(reservationSlots(500).value).toBe(14);
    expect(escrowForSlots(4).value).toBe(0);
    expect(escrowForSlots(10).value).toBe(300);
  });

  it("dispute bond is 100 FLOP, with the failed-dispute outcome marked ABSENT", () => {
    const d = disputeCost();
    expect(d.bond.value).toBe(100);
    expect(d.bond.bucket).toBe("DEFINED");
    expect(d.lossIfFails.bucket).toBe("ABSENT");
    expect(d.caveat).toMatch(/not stated/);
  });

  it("the HARD/SOFT value-cap trade cannot be priced, and says so", () => {
    const t = tierComparison();
    expect(isBlocked(t.agentCostDifference)).toBe(true);
    if (isBlocked(t.agentCostDifference)) expect(t.agentCostDifference.cites.join(" ")).toMatch(/R3\.2|E\.33/);
    expect(t.spotCheckFallsOn).toMatch(/MINER-side/);
  });
});

// --------------------------------------------------------------------- provenance rules

describe("provenance", () => {
  it("no figure is returned without at least one citation or assumption", () => {
    const funded: ValidatorInputs = { ...VAL, daCostPerYear: 1, gpuBackendCostPerYear: 1 };
    const be = breakEven(funded);
    for (const [name, f] of Object.entries({
      revenue: be.revenue,
      blockReward: be.blockReward,
      specAnchor: be.specAnchor,
      netAgainstSpecAnchor: be.netAgainstSpecAnchor,
    })) {
      expect(f.cites.length + f.assumptions.length, `${name} has no provenance`).toBeGreaterThan(0);
    }
  });

  it("a figure built purely from spec parameters stays DEFINED", () => {
    expect(blockReward(0).bucket).toBe("DEFINED");
    expect(rolePoolPerYear("validator", 0).bucket).toBe("DEFINED");
    expect(auditPoolSolvency().breakEvenPerTurn.bucket).toBe("DEFINED");
  });

  it("any user assumption downgrades the result to ABSENT", () => {
    const c = operatingCost({ ...VAL, daCostPerYear: 1, gpuBackendCostPerYear: 1 });
    if (isBlocked(c)) throw new Error("unexpected block");
    expect(c.bucket).toBe("ABSENT");
  });

  it("the parked agent leg is PLANNED and pays nothing", () => {
    const p = param("agent_reward_distribution");
    expect(p.bucket).toBe("PLANNED");
    expect(p.value).toBeUndefined();
    expect(p.cite).toContain("E.40");
    expect(p.note).toMatch(/pure cost centres/);
  });
});
