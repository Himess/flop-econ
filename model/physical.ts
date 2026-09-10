/**
 * Physical duties: what a validator actually has to store and run.
 *
 * The tool used to ask for `DA cost` and `GPU backend` in FLOP per year. Nobody can answer
 * either. Working out "900,000 FLOP/yr" for a GPU backend means pricing hardware in dollars,
 * assuming a FLOP price, and dividing — backwards work using the number the tool exists to
 * produce. And a DA cost in FLOP/yr was not derivable at all, because the duty is not a fee:
 * §15.3 records it as "funded by reward share, no per-byte fee", so what it costs is a fact about
 * the operator's storage provider, not about the protocol.
 *
 * This module derives both from quantities a validator can know.
 *
 * THE DA DUTY IS DERIVABLE, AND THE SUBSET SIZE CANCELS. A DataRef's bytes are erasure-coded at
 * Reed–Solomon rate ½ into R=6 shards, any k=3 of which reconstruct (§5.3 R5.3a, App. F.4), and
 * they live on "a deterministic stake-weighted subset (hash(commitment) → subset)". The subset's
 * SIZE is never stated — but it does not matter. Whatever the subset is, the shards on it sum to
 * expansion × original by construction, and a stake-weighted draw gives a validator an expected
 * share equal to its stake share. So:
 *
 *     expected bytes held = original bytes × expansion × (your stake ÷ network stake)
 *
 * At the set-average stake that is 2 × original ÷ set size. This is the same shape as the
 * committee seat rate, and for the same reason.
 *
 * WHAT IS NOT DERIVABLE, AND IS THEREFORE ABSENT. The bytes per session follow from Appendix F.3
 * and §3.4. The number of sessions the network carries does not follow from anything: E.49 has no
 * demand model, and §12.3's throughput figures are stated as "not a measured network capacity".
 * Bandwidth is worse — E.47 leaves "audit/repair timing, repair bandwidth" open and §15.3
 * quantifies it only as "GB-scale bandwidth", so egress is left out of the model rather than
 * approximated. The direct PoUI rail's DA payload is out too: "TEE quote (5–10 KB), event log
 * (≤ 256 KB)" is a range, a ceiling and one unstated term, and E.46 calls its own byte figures
 * "arithmetic byte ceilings only". Picking a number inside a 50× band is not a derivation.
 */
import { BLOCKS_PER_YEAR } from "./emission";
import { param, type ParamKey } from "./params.generated";
import { blocked, figure, num, type AssumptionRef, type Computed } from "./types";

const DAYS_PER_YEAR = 365;
const MONTHS_PER_YEAR = 12;
const BYTES_PER_GB = 1e9;
const WATTS_PER_KW = 1e3;
const HOURS_PER_YEAR = 24 * DAYS_PER_YEAR;

const EXPANSION = num(param("da_erasure_expansion_ratio"));
const TOPLOC_BYTES = num(param("toploc_commitment_bytes"));
const TOPLOC_WINDOW = num(param("toploc_commitment_token_window"));
const TURN_BASE_BYTES = num(param("verified_turn_bytes_base"));
const MERKLE_ITEM_BYTES = num(param("verified_turn_merkle_item_bytes"));
const RETENTION_DAYS =
  num(param("da_ephemeral_retention_blocks")) / (BLOCKS_PER_YEAR / DAYS_PER_YEAR);

/**
 * SCALE compact length of a Merkle path length. One byte below 64, which every realistic path is
 * (a path of 63 addresses 2^63 turns, and settlement is bounded by channel_max_merkle_path_len).
 */
const COMPACT_LEN = 1;

// ---------------------------------------------------------------------------- network traffic

/** The user's view of a network that does not exist yet. Every field is ABSENT. */
export interface DaTraffic {
  sessionsPerDay?: number;
  turnsPerSession?: number;
  tokensPerTurn?: number;
}

function trafficRefs(t: DaTraffic): {
  supplied: AssumptionRef[];
  missing: { key: string; cite: string; label: string }[];
} {
  const supplied: AssumptionRef[] = [];
  const missing: { key: string; cite: string; label: string }[] = [];
  const want: [number | undefined, ParamKey, string, string][] = [
    [t.sessionsPerDay, "network_sessions_per_day", "sessions/day", "network sessions per day"],
    [t.turnsPerSession, "network_turns_per_session", "turns", "turns per session"],
    [t.tokensPerTurn, "network_tokens_per_turn", "tokens", "tokens per turn"],
  ];
  for (const [v, key, unit, label] of want) {
    const p = param(key);
    if (v === undefined || !(v > 0)) missing.push({ key, cite: p.cite, label });
    else supplied.push({ key, value: v, unit, cite: p.cite, label, kind: "estimate" });
  }
  return { supplied, missing };
}

/** Merkle path length for a transcript of `turns` leaves. */
export function merklePathLength(turns: number): number {
  return turns <= 1 ? 0 : Math.ceil(Math.log2(turns));
}

/**
 * Bytes a single session puts into ephemeral DA, before erasure coding.
 *
 * Per turn: a VerifiedTurn at "268 + compact_len(L) + 33L B" (App. F.3) plus the mandatory TOPLOC
 * commitment at ~258 B per 32 tokens (§3.4, R3.4a). The TOPLOC figure is written with a tilde in
 * the spec — it sizes a scheme, not a protocol constant — so this derivation is approximate and
 * the docs say so.
 */
export function daBytesPerSession(t: DaTraffic): Computed {
  const { supplied, missing } = trafficRefs(t);
  if (missing.length > 0) return blocked(missing);

  const turns = t.turnsPerSession!;
  const tokens = t.tokensPerTurn!;
  const L = merklePathLength(turns);
  const perTurn = TURN_BASE_BYTES + COMPACT_LEN + MERKLE_ITEM_BYTES * L;
  const toploc = Math.ceil(tokens / TOPLOC_WINDOW) * TOPLOC_BYTES;
  const total = turns * (perTurn + toploc);

  return figure({
    value: total,
    unit: "bytes",
    cites: ["App. F.3", "§3.4", "R3.4a"],
    assumptions: supplied.filter((a) => a.key !== "network_sessions_per_day"),
    derivation:
      `${turns} turns x (VerifiedTurn ${perTurn} B [268 + 1 + 33 x path ${L}] + ` +
      `TOPLOC ${toploc.toLocaleString("en-US")} B [ceil(${tokens}/${TOPLOC_WINDOW}) x ${TOPLOC_BYTES}])`,
  });
}

/**
 * The bytes one validator is expected to hold, in GB.
 *
 * Steady state: blobs arrive at a daily rate and are retained for the ephemeral window, so the
 * standing volume is rate × window. `stakeShare` is this validator's share of active-set stake,
 * which is what the stake-weighted assignment gives it in expectation.
 */
export function validatorDaGb(t: DaTraffic, stakeShare: number): Computed {
  const per = daBytesPerSession(t);
  if ("blocked" in per) return per;
  const { supplied, missing } = trafficRefs(t);
  if (missing.length > 0) return blocked(missing);
  if (!(stakeShare > 0)) {
    return blocked([
      {
        key: "network_stake_share",
        cite: "derived from your stake and the average stake",
        label: "a stake share above zero",
      },
    ]);
  }

  const networkPerDay = per.value * t.sessionsPerDay!;
  const stored = networkPerDay * RETENTION_DAYS * EXPANSION;
  const yours = (stored * stakeShare) / BYTES_PER_GB;

  return figure({
    value: yours,
    unit: "GB",
    buckets: [per.bucket],
    cites: [
      "§5.3 R5.3a",
      "App. F.4",
      param("da_ephemeral_retention_blocks").cite,
      "E.47 (total volume open)",
    ],
    assumptions: supplied,
    derivation:
      `${Math.round(per.value).toLocaleString("en-US")} B/session x ${t.sessionsPerDay!.toLocaleString("en-US")} sessions/day ` +
      `x ${RETENTION_DAYS.toFixed(0)} d retention x ${EXPANSION} (rate 1/2) x ${(stakeShare * 1e2).toFixed(3)}% stake share. ` +
      `The R=6 subset size cancels: shards sum to expansion x original whatever it is.`,
  });
}

/** Annual USD cost of that storage, at the operator's own per-GB-month price. */
export function daStorageUsdYear(
  t: DaTraffic,
  stakeShare: number,
  usdPerGbMonth?: number,
): Computed {
  const gb = validatorDaGb(t, stakeShare);
  if ("blocked" in gb) return gb;
  const p = param("da_storage_price_usd_gb_month");
  if (usdPerGbMonth === undefined || !(usdPerGbMonth >= 0)) {
    return blocked([{ key: p.key, cite: p.cite, label: "your storage price per GB-month" }]);
  }

  return figure({
    value: gb.value * usdPerGbMonth * MONTHS_PER_YEAR,
    unit: "USD/year",
    buckets: [gb.bucket],
    cites: gb.cites,
    assumptions: [
      ...gb.assumptions,
      {
        key: p.key,
        value: usdPerGbMonth,
        unit: "USD/GB-month",
        cite: p.cite,
        label: "storage price",
        kind: "physical",
      },
    ],
    derivation:
      `${gb.value.toFixed(2)} GB x $${usdPerGbMonth}/GB-month x ${MONTHS_PER_YEAR}. ` +
      `Egress is NOT included: E.47 leaves repair bandwidth and audit timing open.`,
  });
}

// ---------------------------------------------------------------------------- the rig

/** Physical facts about the operator's own machine. */
export interface Rig {
  gpuCount?: number;
  wattsPerGpu?: number;
  /** Expected duty cycle, 0..1. The operator's decision, not a spec figure. */
  utilisation?: number;
}

/**
 * Continuous draw in kW.
 *
 * Replaces a single typed "power draw" field, which asked the user to do this multiplication in
 * their head and gave the tool no way to show the arithmetic.
 */
export function rigPowerKw(r: Rig): Computed {
  const missing: { key: string; cite: string; label: string }[] = [];
  const need = (v: number | undefined, key: string, label: string) => {
    if (v === undefined || !(v > 0)) {
      missing.push({ key, cite: "your hardware", label });
      return 0;
    }
    return v;
  };
  const count = need(r.gpuCount, "gpu_count", "GPU count");
  const watts = need(r.wattsPerGpu, "watts_per_gpu", "power draw per GPU");
  const util = need(r.utilisation, "gpu_utilisation", "expected utilisation");
  if (missing.length > 0) return blocked(missing);
  if (util > 1) {
    return blocked([
      { key: "gpu_utilisation", cite: "your hardware", label: "a utilisation between 0 and 1" },
    ]);
  }

  return figure({
    value: (count * watts * util) / WATTS_PER_KW,
    unit: "kW",
    cites: [param("validator_hardware_spec").cite],
    assumptions: [
      { key: "gpu_count", value: count, unit: "cards", cite: "your hardware", label: "GPU count", kind: "physical" },
      { key: "watts_per_gpu", value: watts, unit: "W", cite: "your hardware", label: "power draw per GPU", kind: "physical" },
      { key: "gpu_utilisation", value: util, unit: "fraction", cite: "your decision", label: "expected utilisation", kind: "physical" },
    ],
    derivation: `${count} cards x ${watts} W x ${(util * 1e2).toFixed(0)}% / ${WATTS_PER_KW}`,
  });
}

// ---------------------------------------------------------------------------- the committee gate

/**
 * What the specification actually requires of the committee-keeping GPU, quoted.
 *
 * The expectation going in was that the spec would not say how much work the gate needs. It is
 * more specific than that, and more surprising: the GATE is a recency test, and the only quantity
 * floor anywhere lives one layer down, in the calibration-cap renewal rule — where it is stated
 * relative to the operator's OWN effective capacity, so it sets no absolute hardware minimum at
 * all. §15.3's duty table rates the leg "GPU-heavy" and the spec states no hardware minimums.
 */
export const COMMITTEE_GATE = {
  /** One verified proof inside this window keeps the seat. No quantity is attached. */
  recencyWindowBlocks: num(param("work_recency_window_blocks_gate")),
  /** Renewal cadence for the calibration cap that lets you produce verified work at all. */
  leaseBlocks: num(param("calibration_lease_blocks")),
  /** Fresh one-shot Ghost canaries per renewal. "Job count alone MUST NOT renew a cap." */
  minVerifiedJobs: num(param("calibration_renewal_min_verified_jobs")),
  /** The renewal window is bounded, so the floor is a burst rather than a duty cycle. */
  renewalWindowBlocks: num(param("calibration_renewal_max_age_blocks")),
  /** Fraction of your own C_effective the renewal burst must cover. */
  utilisationFloor: num(param("calibration_min_utilization_ppm")) / 1e6,
} as const;

const BLOCKS_PER_DAY = BLOCKS_PER_YEAR / DAYS_PER_YEAR;
const BLOCKS_PER_HOUR = BLOCKS_PER_DAY / 24;

/** The gate in units a person reads: hours, days, minutes, percent. */
export function committeeGateDuty(): {
  recencyHours: number;
  leaseDays: number;
  renewalWindowMinutes: number;
  minVerifiedJobs: number;
  utilisationFloor: number;
} {
  return {
    recencyHours: COMMITTEE_GATE.recencyWindowBlocks / BLOCKS_PER_HOUR,
    leaseDays: COMMITTEE_GATE.leaseBlocks / BLOCKS_PER_DAY,
    renewalWindowMinutes: COMMITTEE_GATE.renewalWindowBlocks / (BLOCKS_PER_HOUR / 60),
    minVerifiedJobs: COMMITTEE_GATE.minVerifiedJobs,
    utilisationFloor: COMMITTEE_GATE.utilisationFloor,
  };
}

/** Hours per year, exported so the cost model and the docs quote the same figure. */
export { HOURS_PER_YEAR, RETENTION_DAYS };
