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

/**
 * How much of the reference profile's disk the DA duty actually uses.
 *
 * There is no separate storage bill to model. §15.3's profile provisions "4 TB enterprise NVMe
 * (chain state plus DA custody under §5.3 retention)" and "a 1 Gbps symmetric UNMETERED link" —
 * so the disk is bought with the machine and the serving runs over a flat link. Asking an operator
 * for a per-GB-month rental price on top of the hardware they already bought is double-counting,
 * and it invites them to picture object storage they do not need.
 *
 * What is worth showing is the ratio, because the finding is how small it is.
 */
export function daShareOfProfile(t: DaTraffic, stakeShare: number): Computed {
  const gb = validatorDaGb(t, stakeShare);
  if ("blocked" in gb) return gb;
  const profileGb = num(param("validator_ref_nvme_tb")) * 1e3;
  return figure({
    value: gb.value / profileGb,
    unit: "fraction of the reference disk",
    buckets: [gb.bucket],
    cites: [param("validator_ref_nvme_tb").cite, ...gb.cites],
    assumptions: gb.assumptions,
    derivation:
      `${gb.value.toFixed(3)} GB / ${profileGb.toLocaleString("en-US")} GB. The §15.3 profile buys ` +
      `the disk outright for "chain state plus DA custody", so there is no per-GB bill to add.`,
  });
}

// ---------------------------------------------------------------------------- the rig

/**
 * Physical facts about the operator's own machine.
 *
 * This was a GPU rig — cards, draw per card, utilisation — because the draft this tool was first
 * built against routed committee eligibility through "a calibrated miner backend". The published
 * §15.1 forbids that reading: a validator function "MUST NOT require executing inference,
 * producing PoUI proofs, or owning a GPU or TEE." So the machine is a node.
 *
 * There is no duty-cycle term either, and there should never have been one. §11.3 slashes a
 * validator 1% and jails it after 300 blocks offline, then 5% and kicks it past 24 hours — the
 * protocol requires the machine to be up. Asking for a draw AND a duty cycle asked the same
 * question twice and invited a number below 1 that the slashing table forbids. One field: what the
 * node draws, continuously.
 */
export interface Rig {
  /** Continuous draw of the whole node, watts. Always-on is enforced (§11.3 V1). */
  nodeWatts?: number;
}

/**
 * The §15.3 SHOULD-level reference profile, quoted so the tool can show an operator what the
 * specification actually recommends. Not a MUST, and the sizing document behind it is not public,
 * so every row is PLANNED.
 */
export const REFERENCE_PROFILE = {
  cores: num(param("validator_ref_cpu_cores")),
  ramGb: num(param("validator_ref_ram_gb")),
  nvmeTb: num(param("validator_ref_nvme_tb")),
  linkGbps: num(param("validator_ref_link_gbps")),
} as const;

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
  const watts = need(r.nodeWatts, "node_watts", "node draw");
  if (missing.length > 0) return blocked(missing);

  return figure({
    value: watts / WATTS_PER_KW,
    unit: "kW",
    cites: [param("validator_hardware_spec").cite],
    assumptions: [
      { key: "node_watts", value: watts, unit: "W", cite: "your hardware", label: "node draw", kind: "physical" },
    ],
    derivation: `${watts} W / ${WATTS_PER_KW}. Continuous — §11.3 slashes downtime, so the node is up.`,
  });
}

// ---------------------------------------------------------------------------- the committee gate

/**
 * What the specification actually requires to keep a committee seat, quoted.
 *
 * This section was written twice, and the rewrite is the point. Against the pre-publication draft
 * the gate was "recent verified PoUI work", which is why an earlier version of this tool modelled
 * a GPU cost leg and shipped a finding about how nobody can size it.
 *
 * The published draft settles it the other way. R15.4c is new and normative: the recency signal
 * "MUST be refreshed only by an on-chain accepted verification duty" — signing an accepted
 * attestation bundle, signing an accepted TOPLOC mismatch or escalation-clear quorum, an accepted
 * DA retrievability-audit response, an accepted dispute opening, or a correct answer to a
 * protocol-issued known-answer challenge. And then, explicitly: "Prover credit (OnProofVerified)
 * MUST NOT refresh it." §15.3 rates every one of those duties "light CPU".
 *
 * So there is no GPU gate to size. §15.1: a validator function "MUST NOT require executing
 * inference, producing PoUI proofs, or owning a GPU or TEE."
 */
export const COMMITTEE_GATE = {
  /** One accepted verification duty inside this window keeps the seat. */
  recencyWindowBlocks: num(param("work_recency_window_blocks_gate")),
  /** No GPU, no TEE, no inference. §15.1, at MUST NOT strength. */
  gpusRequired: num(param("validator_gpu_requirement")),
} as const;

/** The five accepted duties that refresh the recency signal (R15.4c), in reading order. */
export const VERIFICATION_DUTIES = [
  { cite: "R3.6b", label: "sign an accepted validator attestation bundle" },
  { cite: "R3.5d / §12.1", label: "sign an accepted TOPLOC mismatch or escalation-clear quorum" },
  { cite: "R5.3b", label: "answer an accepted DA retrievability audit" },
  { cite: "R12.1f", label: "open an accepted dispute" },
  { cite: "§8.1 pattern", label: "answer a protocol-issued known-answer challenge" },
] as const;

const BLOCKS_PER_DAY = BLOCKS_PER_YEAR / DAYS_PER_YEAR;
const BLOCKS_PER_HOUR = BLOCKS_PER_DAY / 24;

/** The gate in units a person reads. */
export function committeeGateDuty(): {
  recencyHours: number;
  gpusRequired: number;
  duties: number;
  profile: typeof REFERENCE_PROFILE;
} {
  return {
    recencyHours: COMMITTEE_GATE.recencyWindowBlocks / BLOCKS_PER_HOUR,
    gpusRequired: COMMITTEE_GATE.gpusRequired,
    duties: VERIFICATION_DUTIES.length,
    profile: REFERENCE_PROFILE,
  };
}

/** Hours per year, exported so the cost model and the docs quote the same figure. */
export { HOURS_PER_YEAR, RETENTION_DAYS };
