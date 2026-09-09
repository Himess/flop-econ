/**
 * Validator break-even model.
 *
 * This is the better-founded of the two legs, for one reason: the validator's reward
 * apportionment is normatively specified (R9.5 — pool share by stake with a 1.1x
 * finality-committee multiplier), where the miner's is an open item (E.44). Everything on the
 * revenue side below is DEFINED. The cost side has one DEFINED anchor (the spec's own implied
 * figure, §2.2) and two ABSENT legs the user must supply: DA volume (E.47) and the GPU backend
 * the committee gate requires (no sizing given anywhere).
 */
import { param } from "./params.generated";
import { BLOCKS_PER_YEAR, blocksToDays, rolePoolPerYear } from "./emission";
import {
  blocked,
  figure,
  isBlocked,
  num,
  type AssumptionRef,
  type Blocked,
  type Computed,
  type Figure,
} from "./types";

const PPM = 1_000_000;
const PCT = 100;

// ---------------------------------------------------------------------------- inputs

export interface ValidatorInputs {
  /** This validator's self + delegated stake, FLOP. */
  stake: number;
  /** Total stake across the active set, FLOP. Drives pool share. */
  networkStake: number;
  /** Size of the active set. See active_set_cap (1,000 ratified) vs wired (200, E.41). */
  activeSetSize: number;
  /** Emission era (0 = launch). */
  era: number;
  /**
   * Probability this validator is seated on the finality committee in any given epoch (R9.5 1.1x).
   *
   * Defaults to the uniform-set rate, finality_committee_size / activeSetSize. The committee is
   * resampled every epoch (R15.4a: "pallet_aleph snapshots this committee each epoch"), so annual
   * income is driven by the seating RATE, not by whether you happen to be seated right now.
   * Pass 1 or 0 to model the always-/never-seated bounds.
   */
  committeeSeatProbability?: number;

  /** ABSENT (E.47). Annual DA storage + bandwidth cost, FLOP. User must supply. */
  daCostPerYear?: number;
  /** ABSENT (no spec sizing). Annual GPU-backend cost for the committee gate, FLOP. */
  gpuBackendCostPerYear?: number;
  /** Optional: any other operating cost the user wants to add, FLOP/yr. */
  otherCostPerYear?: number;

  /** Audit income: verdicts this validator expects to claim per year. Optional. */
  auditVerdictsPerYear?: number;
}

// ---------------------------------------------------------------------------- revenue

/** The uniform-set seating rate: finality_committee_size / activeSetSize, capped at 1. */
export function baseSeatRate(activeSetSize: number): number {
  return Math.min(1, num(param("finality_committee_size")) / Math.max(1, activeSetSize));
}

/**
 * R9.5: the validator pool is split with weight stake_i x (1.1 if i in committee else 1.0).
 *
 * Modelled in expectation over epochs, because the committee is resampled every epoch (R15.4a).
 * A validator's annual income depends on the RATE at which it is seated, not on a snapshot:
 *
 *   my weight      = stake x (p x 1.1 + (1 - p))          p = this validator's seat rate
 *   network weight = networkStake x (p_bar x 1.1 + (1 - p_bar))   p_bar = committeeSize/setSize
 *
 * A consequence worth stating plainly, because a naive snapshot model hides it: for a validator
 * seated at the average rate, the 1.1x premium cancels exactly. It is a redistribution toward
 * validators seated MORE often than average — which, under stake-weighted sampling (R15.4a),
 * means larger stakes. It is not free income for everyone.
 */
export function blockRewardIncome(inp: ValidatorInputs): Figure {
  const pool = rolePoolPerYear("validator", inp.era);
  const premium = num(param("finality_committee_premium_weight_ppm")) / PPM;
  const committeeSize = num(param("finality_committee_size"));

  const pBar = baseSeatRate(inp.activeSetSize);
  const p = inp.committeeSeatProbability ?? pBar;
  if (p < 0 || p > 1) throw new Error(`committeeSeatProbability must be in [0,1], got ${p}`);

  const myWeight = inp.stake * (p * premium + (1 - p));
  const networkWeight = inp.networkStake * (pBar * premium + (1 - pBar));
  const share = networkWeight > 0 ? myWeight / networkWeight : 0;

  return figure({
    value: pool.value * share,
    unit: "FLOP/year",
    buckets: ["DEFINED"],
    cites: [...pool.cites, param("finality_committee_premium_weight_ppm").cite, param("finality_committee_size").cite],
    derivation:
      `pool ${Math.round(pool.value).toLocaleString("en-US")} FLOP/yr x weighted share ${(share * 100).toFixed(4)}%. ` +
      `Seat rate p = ${p.toFixed(4)} against the set average ${pBar.toFixed(4)} ` +
      `(${committeeSize} seats / ${inp.activeSetSize} active). The ${premium}x premium cancels at ` +
      `p = p_bar; it only pays above the average seat rate.`,
  });
}

/**
 * Audit income. audit_fee_per_turn is a flat 1 FLOP per verdict claimed by a VRF-assigned
 * validator, "gated on submitted evidence and pool solvency" — so this is an upper bound that
 * the solvency check below can invalidate.
 */
export function auditIncome(inp: ValidatorInputs): Figure {
  const fee = num(param("audit_fee_per_turn"));
  const verdicts = inp.auditVerdictsPerYear ?? 0;
  return figure({
    value: fee * verdicts,
    unit: "FLOP/year",
    buckets: ["DEFINED"],
    cites: [param("audit_fee_per_turn").cite],
    derivation: `${verdicts.toLocaleString("en-US")} verdicts x ${fee} FLOP (subject to pool solvency)`,
  });
}

// ------------------------------------------------------------------- audit pool solvency

export interface AuditSolvency {
  /** Minimum settlement value per audited turn for the pool to fund its own audits, FLOP. */
  breakEvenPerTurn: Figure;
  /** True when the supplied per-turn settlement clears the floor. Undefined if none supplied. */
  solvent?: boolean;
}

/**
 * The audit pool's solvency floor.
 *
 * Inflow per turn is audit_fee_split_ppm x P_turn; expected outflow is
 * sampled_audit_alpha_ppm x audit_fee_per_turn. Break-even:
 *
 *   0.01 * P_turn >= 0.05 * 1 FLOP   ->   P_turn >= 5 FLOP
 *
 * A network-health indicator, not a user input. Below the floor, the pool that funds Tier-3
 * enforcement cannot pay for its own audits — and audit_fee_per_turn is explicitly gated on
 * pool solvency, so payment simply stops.
 *
 * Caveats carried into the derivation: alpha is described as the default for sampled-audit
 * certificate mode and may not apply to every session, and audit_quantum_gn /
 * high_value_gn_threshold force additional audits on top, which only worsens the ratio.
 */
export function auditPoolSolvency(settlementPerTurn?: number): AuditSolvency {
  const split = num(param("audit_fee_split_ppm")) / PPM;
  const fee = num(param("audit_fee_per_turn"));
  const alpha = num(param("sampled_audit_alpha_ppm")) / PPM;
  const breakEven = (alpha * fee) / split;

  const f = figure({
    value: breakEven,
    unit: "FLOP per audited turn",
    buckets: ["DEFINED"],
    cites: [
      param("audit_fee_split_ppm").cite,
      param("audit_fee_per_turn").cite,
      param("sampled_audit_alpha_ppm").cite,
    ],
    derivation:
      `inflow ${split} x P_turn >= outflow ${alpha} x ${fee} FLOP  ->  P_turn >= ${breakEven} FLOP. ` +
      `Caveat: alpha is the default for sampled-audit certificate mode; audit_quantum_gn and ` +
      `high_value_gn_threshold force additional audits, which lowers the effective margin further.`,
  });

  return settlementPerTurn === undefined
    ? { breakEvenPerTurn: f }
    : { breakEvenPerTurn: f, solvent: settlementPerTurn >= breakEven };
}

// ---------------------------------------------------------------------------- cost

/** The spec's own implied per-validator operating cost, from the §2.2 committee-cap disclosure. */
export function specImpliedCost(): Figure {
  const p = param("validator_implied_annual_cost_flop");
  return figure({
    value: num(p),
    unit: "FLOP/year",
    buckets: ["DEFINED"],
    cites: [p.cite],
    derivation: p.derivation ?? "",
  });
}

function costAssumptions(inp: ValidatorInputs): {
  supplied: AssumptionRef[];
  missing: { key: string; cite: string; label: string }[];
} {
  const supplied: AssumptionRef[] = [];
  const missing: { key: string; cite: string; label: string }[] = [];

  const daP = param("validator_da_volume_bytes");
  if (inp.daCostPerYear === undefined) {
    missing.push({ key: daP.key, cite: daP.cite, label: "DA storage and bandwidth cost" });
  } else {
    supplied.push({
      key: daP.key,
      value: inp.daCostPerYear,
      unit: "FLOP/year",
      cite: daP.cite,
      label: "DA storage and bandwidth cost",
    });
  }

  const gpuP = param("validator_gpu_backend_cost");
  if (inp.gpuBackendCostPerYear === undefined) {
    missing.push({ key: gpuP.key, cite: gpuP.cite, label: "GPU backend for the committee gate" });
  } else {
    supplied.push({
      key: gpuP.key,
      value: inp.gpuBackendCostPerYear,
      unit: "FLOP/year",
      cite: gpuP.cite,
      label: "GPU backend for the committee gate",
    });
  }

  return { supplied, missing };
}

/**
 * Total annual operating cost.
 *
 * Blocks unless BOTH ABSENT legs are supplied. §15.3 names them as "the two heavy legs"; a model
 * that omits either is wrong, so the tool refuses rather than defaulting them to zero.
 */
export function operatingCost(inp: ValidatorInputs): Computed {
  const { supplied, missing } = costAssumptions(inp);
  if (missing.length > 0) return blocked(missing);

  const other = inp.otherCostPerYear ?? 0;
  const total = inp.daCostPerYear! + inp.gpuBackendCostPerYear! + other;

  return figure({
    value: total,
    unit: "FLOP/year",
    cites: [],
    assumptions: supplied,
    derivation:
      `DA ${inp.daCostPerYear!.toLocaleString("en-US")} + GPU ${inp.gpuBackendCostPerYear!.toLocaleString("en-US")}` +
      (other ? ` + other ${other.toLocaleString("en-US")}` : "") +
      ` FLOP/yr. The spec states no hardware minimums (§15.3 gives qualitative intensities only).`,
  });
}

// ---------------------------------------------------------------------------- break-even

export interface BreakEven {
  revenue: Figure;
  blockReward: Figure;
  audit: Figure;
  cost: Computed;
  /** revenue - cost. Blocked when cost is blocked. */
  net: Computed;
  /** Revenue measured against the spec's own implied cost, always available. */
  netAgainstSpecAnchor: Figure;
  specAnchor: Figure;
}

export function breakEven(inp: ValidatorInputs): BreakEven {
  const br = blockRewardIncome(inp);
  const au = auditIncome(inp);
  const revenue = figure({
    value: br.value + au.value,
    unit: "FLOP/year",
    buckets: [br.bucket, au.bucket],
    cites: [...br.cites, ...au.cites],
    derivation: `block reward ${Math.round(br.value).toLocaleString("en-US")} + audit ${Math.round(au.value).toLocaleString("en-US")}`,
  });

  const cost = operatingCost(inp);
  const anchor = specImpliedCost();

  const net: Computed = isBlocked(cost)
    ? cost
    : figure({
        value: revenue.value - cost.value,
        unit: "FLOP/year",
        buckets: [revenue.bucket],
        cites: [...revenue.cites, ...cost.cites],
        assumptions: cost.assumptions,
        derivation: `revenue ${Math.round(revenue.value).toLocaleString("en-US")} - cost ${Math.round(cost.value).toLocaleString("en-US")}`,
      });

  return {
    revenue,
    blockReward: br,
    audit: au,
    cost,
    net,
    specAnchor: anchor,
    netAgainstSpecAnchor: figure({
      value: revenue.value - anchor.value,
      unit: "FLOP/year",
      buckets: ["DEFINED"],
      cites: [...revenue.cites, ...anchor.cites],
      derivation:
        `revenue ${Math.round(revenue.value).toLocaleString("en-US")} - the spec's implied ` +
        `${anchor.value.toLocaleString("en-US")} FLOP/yr (§2.2). A reference point, not an observed cost.`,
    }),
  };
}

// ---------------------------------------------------------------------------- stake

/**
 * effective_minimum_stake() = max(validator_min_stake, ValueCoupledStakeFloor).
 * The coupled floor's coefficient k is ABSENT (E.8); storage default is 0, i.e.
 * baseline-identical, so the baseline is the live case. Compounds +9%/yr (D-0413).
 */
export function minimumStake(yearsFromGenesis: number, valueCoupledFloor?: number): Figure {
  const base = num(param("validator_min_stake"));
  const numr = num(param("validator_growth_numerator"));
  const den = num(param("validator_growth_denominator"));
  const compounded = base * (numr / den) ** yearsFromGenesis;

  const assumptions: AssumptionRef[] = [];
  if (valueCoupledFloor !== undefined) {
    const p = param("validator_value_coupled_floor_k");
    assumptions.push({
      key: p.key,
      value: valueCoupledFloor,
      unit: "FLOP",
      cite: p.cite,
      label: "value-coupled stake floor (k x V_booked)",
    });
  }

  return figure({
    value: Math.max(compounded, valueCoupledFloor ?? 0),
    unit: "FLOP",
    buckets: ["DEFINED"],
    cites: [param("validator_min_stake").cite, param("validator_growth_numerator").cite],
    assumptions,
    derivation:
      `max(${base.toLocaleString("en-US")} x (${numr}/${den})^${yearsFromGenesis} = ` +
      `${Math.round(compounded).toLocaleString("en-US")}` +
      (valueCoupledFloor !== undefined ? `, coupled floor ${valueCoupledFloor.toLocaleString("en-US")}` : ", coupled floor 0 (storage default)") +
      `)`,
  });
}

/** Maximum delegated stake given self-stake: MinSelfStakeRatio >= 20% of (self + delegated). */
export function maxDelegated(selfStake: number): Figure {
  const ratio = num(param("validator_self_stake_ratio_min_percent")) / PCT;
  return figure({
    value: selfStake / ratio - selfStake,
    unit: "FLOP",
    buckets: ["DEFINED"],
    cites: [param("validator_self_stake_ratio_min_percent").cite],
    derivation: `self/(self+delegated) >= ${ratio} -> delegated <= self x (1/${ratio} - 1) = ${1 / ratio - 1}x self`,
  });
}

// ---------------------------------------------------------------------------- slashing ladder

export type SlashRung =
  | "liveness"
  | "extended_downtime"
  | "equivocation_lone"
  | "da_serve_or_slash"
  | "fraud";

interface RungSpec {
  key: string;
  label: string;
  trigger: string;
  /** Fraction of stake burned permanently. */
  permanentFraction: number;
  /** Fraction withheld but returned later (equivocation's other 50%). */
  returnedFraction: number;
  returnedAfterDays: number;
  /** Days out of the active set before earning can resume. */
  downtimeDays: number;
  terminal: boolean;
  reentry: string;
}

function rungSpec(rung: SlashRung): RungSpec {
  const ejectionDays = blocksToDays(num(param("ejection_cooldown_blocks")));
  const unbondDays = blocksToDays(num(param("validator_unbonding_blocks")));

  switch (rung) {
    case "liveness":
      return {
        key: "slash_liveness_percent",
        label: "Liveness — downtime > 300 blocks",
        trigger: "downtime > 300 blocks",
        permanentFraction: num(param("slash_liveness_percent")) / PCT,
        returnedFraction: 0,
        returnedAfterDays: 0,
        downtimeDays: 1 / 24, // un_jail after >= 1 h
        terminal: false,
        reentry: "un_jail after >= 1 h",
      };
    case "extended_downtime":
      return {
        key: "slash_extended_downtime_percent",
        label: "Extended downtime > 24 h",
        trigger: "downtime > 24 h",
        permanentFraction: num(param("slash_extended_downtime_percent")) / PCT,
        returnedFraction: 0,
        returnedAfterDays: 0,
        downtimeDays: ejectionDays,
        terminal: false,
        reentry: "kicked; rejoin with full stake top-up after the ejection cooldown",
      };
    case "equivocation_lone":
      return {
        key: "slash_equivocation_lone_percent",
        label: "Equivocation — lone double-sign",
        trigger: "conflicting blocks, uncorrelated",
        permanentFraction: 0,
        returnedFraction: num(param("slash_equivocation_lone_percent")) / PCT,
        returnedAfterDays: num(param("equivocation_return_days")),
        downtimeDays: ejectionDays,
        terminal: false,
        reentry: "eject; re-stakeable after the 180 d return plus unlock cooldown",
      };
    case "da_serve_or_slash":
      return {
        key: "da_serve_or_slash_percent",
        label: "DA serve-or-slash",
        trigger: "failed retrievability audit",
        permanentFraction: num(param("da_serve_or_slash_percent")) / PCT,
        returnedFraction: 0,
        returnedAfterDays: 0,
        downtimeDays: 0,
        terminal: false,
        reentry: "bounded Liveness class, not fraud; no ejection stated",
      };
    case "fraud":
      return {
        key: "slash_fraud_percent",
        label: "Fraud class — collusion / evidence forgery / TEE-attestation failure / >=1/3 correlated equivocation",
        trigger: "evidence-backed fraud",
        permanentFraction: num(param("slash_fraud_percent")) / PCT,
        returnedFraction: 0,
        returnedAfterDays: 0,
        downtimeDays: unbondDays,
        terminal: true,
        reentry: "eject + blacklist. No re-entry.",
      };
  }
}

export interface SlashOutcome {
  rung: SlashRung;
  label: string;
  trigger: string;
  reentry: string;
  terminal: boolean;
  /** Stake burned permanently, FLOP. */
  lossPermanent: Figure;
  /** Stake withheld and later returned, FLOP. */
  lossReturned: Figure;
  daysOutOfSet: Figure;
  /** Days of net earnings needed to recover the permanent loss. Blocked if cost is blocked. */
  recoveryDays: Computed;
  cites: string[];
}

/**
 * The slashing ladder, with time-to-recover against net earnings.
 *
 * Recovery is measured against NET (revenue - operating cost), not revenue, because a validator
 * earning less than it spends never recovers. The days out of the set are added on top, since
 * nothing is earned during them.
 */
export function slashingLadder(inp: ValidatorInputs): SlashOutcome[] {
  const be = breakEven(inp);
  const rungs: SlashRung[] = [
    "da_serve_or_slash",
    "liveness",
    "extended_downtime",
    "equivocation_lone",
    "fraud",
  ];

  return rungs.map((rung) => {
    const s = rungSpec(rung);
    const permanent = inp.stake * s.permanentFraction;
    const returned = inp.stake * s.returnedFraction;
    const p = param(s.key as never);

    let recovery: Computed;
    if (s.terminal) {
      recovery = blocked([
        {
          key: s.key,
          cite: p.cite,
          label: "terminal offence — eject + blacklist, so there is no recovery path",
        },
      ]);
    } else if (isBlocked(be.net)) {
      recovery = be.net;
    } else if (be.net.value <= 0) {
      recovery = blocked([
        {
          key: "net_earnings",
          cite: "computed",
          label: "net earnings are zero or negative, so the loss is never recovered",
        },
      ]);
    } else {
      const earnDays = (permanent / be.net.value) * 365;
      recovery = figure({
        value: earnDays + s.downtimeDays,
        unit: "days",
        buckets: [be.net.bucket],
        cites: [...be.net.cites, p.cite],
        assumptions: be.net.assumptions,
        derivation:
          `${Math.round(permanent).toLocaleString("en-US")} FLOP permanent loss / net ` +
          `${Math.round(be.net.value).toLocaleString("en-US")} FLOP/yr = ${earnDays.toFixed(1)} earning days, ` +
          `plus ${s.downtimeDays.toFixed(2)} days out of the set`,
      });
    }

    return {
      rung,
      label: s.label,
      trigger: s.trigger,
      reentry: s.reentry,
      terminal: s.terminal,
      lossPermanent: figure({
        value: permanent,
        unit: "FLOP",
        buckets: ["DEFINED"],
        cites: [p.cite],
        derivation: `${(s.permanentFraction * 100).toFixed(0)}% of ${inp.stake.toLocaleString("en-US")} FLOP`,
      }),
      lossReturned: figure({
        value: returned,
        unit: "FLOP",
        buckets: ["DEFINED"],
        cites: [p.cite],
        derivation: returned
          ? `${(s.returnedFraction * 100).toFixed(0)}% withheld, returned after ${s.returnedAfterDays} days`
          : "none",
      }),
      daysOutOfSet: figure({
        value: s.downtimeDays,
        unit: "days",
        buckets: ["DEFINED"],
        cites: [param("ejection_cooldown_blocks").cite],
      }),
      recoveryDays: recovery,
      cites: [p.cite],
    };
  });
}

// ---------------------------------------------------------------------------- queue cost

export interface QueueCost {
  /** Stake frozen while queued. */
  stakeLocked: Figure;
  /** Validator-leg reward while queued: zero, by R15.5b. */
  rewardWhileQueued: Figure;
  /** Opportunity cost over the supplied holding period, at the user's own rate. */
  opportunityCost?: Figure;
  note: string;
}

/**
 * The cost of sitting in ValidatorQueue.
 *
 * §15.2: register "freezes the account's full reducible balance as self-stake" and admits to
 * ValidatorQueue, not the active set. R15.5b: queued validators are not finality-eligible and
 * earn no validator-leg reward. Promotion is gated on a free slot — behind a cap ratified at
 * 1,000 but wired at 200 (E.41).
 */
export function queueCost(stake: number, days: number, opportunityRatePerYear?: number): QueueCost {
  const assumptions: AssumptionRef[] = [];
  if (opportunityRatePerYear !== undefined) {
    assumptions.push({
      key: "opportunity_rate",
      value: opportunityRatePerYear,
      unit: "fraction/year",
      cite: "your assumption — the spec has no view on capital cost",
      label: "opportunity cost of locked stake",
    });
  }

  return {
    stakeLocked: figure({
      value: stake,
      unit: "FLOP",
      buckets: ["DEFINED"],
      cites: [param("validator_queue_stake_lock").cite],
      derivation: "register freezes the account's full reducible balance (§15.2)",
    }),
    rewardWhileQueued: figure({
      value: 0,
      unit: "FLOP/year",
      buckets: ["DEFINED"],
      cites: [param("validators_to_promote").cite],
      derivation: "R15.5b: queued validators are not finality-eligible and earn no validator-leg reward",
    }),
    ...(opportunityRatePerYear !== undefined
      ? {
          opportunityCost: figure({
            value: stake * opportunityRatePerYear * (days / 365),
            unit: "FLOP",
            cites: [],
            assumptions,
            derivation: `${stake.toLocaleString("en-US")} x ${opportunityRatePerYear} x ${days}/365 days`,
          }),
        }
      : {}),
    note:
      "Promotion is gated on a free slot. The active-set cap is ratified at 1,000 (D-0437) but " +
      "the runtime reaches only 200 (E.41), so queue depth is bounded by the wired figure, not " +
      "the ratified one.",
  };
}

// ---------------------------------------------------------------------------- reward liquidity

export type RewardLiquidity = "locked_autocompound" | "liquid";

/**
 * E.39 [RATIFY] is binary and unresolved: the validator pool currently auto-compounds into
 * locked stake (D-0408); the workbook ratifies 0% lock but the distribution hook is unchanged.
 * Both are modelled; the caller must choose, and the choice is recorded as PLANNED.
 */
export function rewardLiquidity(revenue: Figure, mode: RewardLiquidity): {
  liquidNow: Figure;
  addedToStake: Figure;
  mode: RewardLiquidity;
} {
  const p = param("validator_reward_liquidity");
  const liquid = mode === "liquid" ? revenue.value : 0;
  const staked = mode === "liquid" ? 0 : revenue.value;
  const mk = (v: number, what: string) =>
    figure({
      value: v,
      unit: "FLOP/year",
      buckets: ["PLANNED"],
      cites: [...revenue.cites, p.cite],
      derivation: `${what} under E.39 mode "${mode}" (unresolved — model both)`,
    });
  return { liquidNow: mk(liquid, "liquid on issue"), addedToStake: mk(staked, "auto-compounded into locked stake"), mode };
}

export type { Blocked, Computed, Figure };
