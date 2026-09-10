/**
 * Agent escrow risk — a close-path outcome matrix, not a cost calculator.
 *
 * The distinction matters. Every input to the OUTCOME side is DEFINED: phi = 20%, the two-part
 * tariff, the conservation identity, no under-use refund, full refund on timeout and on an
 * unacked force_open, the top_up_escrow splice, the 100 FLOP challenger bond, the reservation
 * cap. Every input to the PRICE side is ABSENT — there is no protocol price, no auction and no
 * floor (App. C.2/C.3, §15.6, M8). So the tool answers "given what I reserved and what the
 * session consumed, which close path am I on and what do I recover", and takes price as a bare
 * scalar the user supplies.
 *
 * The headline it exists to surface is M9: cooperative settle pays the reserved escrow IN FULL
 * for a truncated answer, with no completion SLA. The product pages obscure this.
 */
import { param } from "./params.generated";
import { blocked, figure, isBlocked, num, type AssumptionRef, type Computed, type Figure } from "./types";

const PCT = 100;
const PPM = 1_000_000;

// ---------------------------------------------------------------------------- tariff

export interface TariffInputs {
  /** Reserved escrow E, FLOP. */
  escrow: number;
  /** Turns actually served, n. */
  turns: number;
  /** Claimed reference work, G_n. */
  gnClaimed: number;
  /**
   * ABSENT (E.30). FLOP per channel pay unit.
   *
   * Both tariff legs are denominated in channel pay units — channel_base_per_turn = 1 and
   * rate_G = 1 channel pay unit per G_n (R12.1d) — while escrow E is in FLOP. One conversion
   * governs the whole tariff, and E.30 has not ratified it.
   */
  unitToFlop?: number;
}

/**
 * The tariff in CHANNEL PAY UNITS, which is the only form the spec actually fixes.
 * R12.1d: P = BasePerTurn*n + rate_G*G_claimed, with both coefficients equal to 1.
 * Fully DEFINED — no assumption needed, because no FLOP conversion has happened yet.
 */
export function tariffUnits(inp: TariffInputs): Figure {
  const base = num(param("channel_base_per_turn"));
  const rate = num(param("channel_rate_g_per_gn"));
  return figure({
    value: base * inp.turns + rate * inp.gnClaimed,
    unit: "channel pay units",
    buckets: ["DEFINED"],
    cites: [param("channel_base_per_turn").cite, param("channel_rate_g_per_gn").cite],
    derivation:
      `BasePerTurn ${base} x ${inp.turns} turns + rate_G ${rate} x ` +
      `${inp.gnClaimed.toLocaleString("en-US")} G_n (R12.1d)`,
  });
}

/**
 * The unilateral-close tariff P, in FLOP.
 *
 * Blocks without unitToFlop. This is the units hole (E.30) and it is not substitutable: escrow is
 * denominated in FLOP and the tariff in channel pay units, so comparing them at all requires an
 * assumption the spec declines to make (R4.4 forbids assuming one). The model declines too.
 */
export function tariff(inp: TariffInputs): Computed {
  const conv = param("channel_unit_to_flop");
  if (inp.unitToFlop === undefined) {
    return blocked([
      { key: conv.key, cite: conv.cite, label: "channel pay unit to FLOP conversion" },
    ]);
  }

  const units = tariffUnits(inp);
  const assumption: AssumptionRef = {
    key: conv.key,
    value: inp.unitToFlop,
    unit: "FLOP per channel pay unit",
    cite: conv.cite,
    label: "channel pay unit to FLOP conversion",
  };

  return figure({
    value: units.value * inp.unitToFlop,
    unit: "FLOP",
    cites: units.cites,
    assumptions: [assumption],
    derivation: `${units.derivation}; = ${units.value.toLocaleString("en-US")} units x ${inp.unitToFlop} FLOP/unit`,
  });
}

// ---------------------------------------------------------------------------- close paths

export type ClosePath =
  | "cooperative_settle"
  | "non_delivery_timeout"
  | "force_open_unacked"
  | "ambiguous_early_close"
  | "upheld_fraud_dispute"
  | "da_unrecoverable"
  | "sla_breach"
  | "ghost_task_failure"
  | "model_swap_or_selective_serving";

export interface CloseOutcome {
  path: ClosePath;
  label: string;
  /** FLOP returned to the agent. Blocked when the tariff is needed but unavailable. */
  agentRecovers: Computed;
  /** FLOP the miner keeps. */
  minerKeeps: Computed;
  /** FLOP burned or routed to the Foundation — never to the miner. */
  burned: Computed;
  /** Plain-language rule. */
  rule: string;
  cites: string[];
  /** Set when the outcome is not a number the spec fixes. */
  caveat?: string;
}

const PHI = num(param("refund_penalty_phi_percent")) / PCT;

function fixed(value: number, cites: string[], derivation: string): Figure {
  return figure({ value, unit: "FLOP", buckets: ["DEFINED"], cites, derivation });
}

/**
 * Resolve every close path for a given escrow and consumption.
 *
 * Conservation holds on every path that splits the escrow:
 *   P + (1-phi)(E-P) + phi(E-P) = E   (R12.1d)
 */
export function closePaths(inp: TariffInputs): CloseOutcome[] {
  const E = inp.escrow;
  const P = tariff(inp);
  const phiCite = param("refund_penalty_phi_percent").cite;
  const settleCite = "R12.1a; App. C.3";

  // Paths whose arithmetic needs the tariff.
  const withTariff = (
    fn: (p: number) => { agent: number; miner: number; burn: number; derivation: string },
  ): { agentRecovers: Computed; minerKeeps: Computed; burned: Computed } => {
    if (isBlocked(P)) return { agentRecovers: P, minerKeeps: P, burned: P };
    const r = fn(P.value);
    const mk = (v: number, what: string): Figure =>
      figure({
        value: v,
        unit: "FLOP",
        buckets: [P.bucket],
        cites: [phiCite, ...P.cites],
        assumptions: P.assumptions,
        derivation: `${what}: ${r.derivation}`,
      });
    return {
      agentRecovers: mk(r.agent, "agent refund"),
      minerKeeps: mk(r.miner, "miner keeps"),
      burned: mk(r.burn, "burned / Foundation"),
    };
  };

  const out: CloseOutcome[] = [];

  // 1. The headline. This is why the tab exists.
  out.push({
    path: "cooperative_settle",
    label: "Cooperative settle",
    agentRecovers: fixed(0, [settleCite], "no refund path exists on this lane"),
    minerKeeps: fixed(E, [settleCite], `the full reserved escrow ${E.toLocaleString("en-US")} FLOP`),
    burned: fixed(0, [settleCite], "none"),
    rule:
      "Pays the reserved escrow IN FULL. Under-use MUST NOT be refunded, and there is no " +
      "completion SLA — a truncated answer still costs the whole reservation.",
    cites: [settleCite, "R12.1a", "M9 (§13.1)"],
  });

  out.push({
    path: "non_delivery_timeout",
    label: "Non-delivery timeout",
    agentRecovers: fixed(E, ["R12.1d", "App. C.6"], "phi = 0 on miner-fault non-delivery"),
    minerKeeps: fixed(0, ["R12.1d"], "none"),
    burned: fixed(0, ["R12.1d"], "none"),
    rule: "Full refund. R12.1d: a miner-fault non-delivery uses phi = 0.",
    cites: ["R12.1d", "App. C.6"],
  });

  out.push({
    path: "force_open_unacked",
    label: "force_open never acked",
    agentRecovers: fixed(
      E,
      [param("channel_ack_window_blocks").cite],
      `expire_force_open refunds in full after ${num(param("channel_ack_window_blocks"))} blocks`,
    ),
    minerKeeps: fixed(0, ["App. C.3"], "none"),
    burned: fixed(0, ["App. C.3"], "none"),
    rule:
      "Full refund via expire_force_open. Records FailedAcks against the named miner only when " +
      `escrow >= ${num(param("min_force_open_escrow_for_failed_ack"))} FLOP.`,
    cites: ["App. C.3", param("min_force_open_escrow_for_failed_ack").cite],
  });

  {
    const r = withTariff((p) => ({
      agent: (1 - PHI) * (E - p),
      miner: p,
      burn: PHI * (E - p),
      derivation: `E ${E} - P ${p.toFixed(4)} = ${(E - p).toFixed(4)}; phi = ${PHI}`,
    }));
    out.push({
      path: "ambiguous_early_close",
      label: "Failed / ambiguous early close",
      ...r,
      rule:
        `Miner keeps the tariff P. Agent is refunded (1-phi)(E-P); phi(E-P) at phi = ${PHI * 100}% ` +
        "is burned or routed to the Foundation — never the miner.",
      cites: ["R12.1d", phiCite, "D-0422"],
    });
  }

  out.push({
    path: "upheld_fraud_dispute",
    label: "Upheld fraud dispute",
    agentRecovers: fixed(E, ["R12.1f", "M2/M10 (§13.1)"], "escrow refunded on an upheld verdict"),
    minerKeeps: fixed(0, ["R12.1f"], "none — and the miner is slashed"),
    burned: fixed(0, ["R12.1f"], "n/a (slash proceeds go to the Foundation, separately)"),
    rule:
      "Refund plus a miner slash. Disputes cover protocol fraud only — never output quality. " +
      `Opening one costs a ${num(param("channel_challenger_bond"))} FLOP challenger bond.`,
    cites: ["R12.1f", param("channel_challenger_bond").cite],
  });

  out.push({
    path: "da_unrecoverable",
    label: "DA unrecoverable (beyond k shards)",
    agentRecovers: fixed(E, ["R13.0c", "V4 (§13.2)"], "fail-closed escrow refund; agent made whole"),
    minerKeeps: fixed(0, ["R13.0c"], "none — and no fraud slash"),
    burned: fixed(0, ["R13.0c"], "none"),
    rule:
      "Fail-closed escrow refund plus challenger-bond return. Temporary unavailability extends " +
      "the window once first. E.31 leaves the last-co-signed-prefix split open.",
    cites: ["R13.0c", "V4 (§13.2)", "E.31"],
  });

  {
    const p = param("sla_breach_rebate");
    out.push({
      path: "sla_breach",
      label: "SLA breach",
      agentRecovers: blocked([{ key: p.key, cite: p.cite, label: "SLA-breach rebate size" }]),
      minerKeeps: blocked([{ key: p.key, cite: p.cite, label: "SLA-breach rebate size" }]),
      burned: fixed(0, [p.cite], "none"),
      rule:
        "A rebate, but the size is not a protocol figure — M6 calls it a co-signed breach, i.e. " +
        "negotiated bilaterally. Soft economic SLA: ceiling reject, rebate, reputation; slashing " +
        "only for timing fraud.",
      cites: ["M6 (§13.1)", p.cite],
      caveat: "Rebate is negotiated, not computed. Nothing here can predict it.",
    });
  }

  out.push({
    path: "ghost_task_failure",
    label: "Ghost-Task failure",
    agentRecovers: fixed(0, ["R8.1a", "M7 (§13.1)"], "nothing — M7's agent-recovery column reads n/a"),
    minerKeeps: fixed(0, ["R8.1a"], "n/a — a bounded escrow slash applies validator-side"),
    burned: fixed(0, ["R8.1a"], "the slash is bounded but its size is not stated"),
    rule:
      "Nothing reaches the agent. R8.1a applies a bounded escrow slash (OnGhostTaskFailed), " +
      "deliberately NOT the 100% fraud path, so transient drift is forgiven rather than punished. " +
      "This is a validator-side canary, not an agent remedy.",
    cites: ["R8.1a", "M7 (§13.1)"],
    caveat: "The bound on the escrow slash is not given anywhere.",
  });

  out.push({
    path: "model_swap_or_selective_serving",
    label: "Model swap / selective serving",
    agentRecovers: fixed(0, ["M1, M8 (§13.1)"], "no refund path named"),
    minerKeeps: fixed(0, ["M1"], "proof rejected on model swap"),
    burned: fixed(0, ["M1"], "n/a"),
    rule:
      "Model swap: the proof is rejected and fraud draws a 100% slash, but the agent's stated " +
      'recovery is "reopen elsewhere". Selective serving has no on-chain remedy at all — M8 rates ' +
      'it "reputation layer only [GAP]", recovery "retry other miners".',
    cites: ["M1 (§13.1)", "M8 (§13.1)"],
    caveat: "No refund is specified for either. Treat as a total loss of the reservation.",
  });

  return out;
}

// ---------------------------------------------------------------------------- over-reservation

export interface OverReservation {
  /** E - P, the unused reservation. */
  unused: Computed;
  /** The share of the unused remainder burned on an ambiguous close: phi(E-P). */
  burnedIfAmbiguous: Computed;
  /** What cooperative settle costs relative to the tariff: the whole of E - P. */
  lostIfCooperative: Computed;
}

export function overReservation(inp: TariffInputs): OverReservation {
  const P = tariff(inp);
  if (isBlocked(P)) return { unused: P, burnedIfAmbiguous: P, lostIfCooperative: P };
  const unusedV = inp.escrow - P.value;
  const mk = (v: number, d: string) =>
    figure({
      value: v,
      unit: "FLOP",
      buckets: [P.bucket],
      cites: [...P.cites, param("refund_penalty_phi_percent").cite],
      assumptions: P.assumptions,
      derivation: d,
    });
  return {
    unused: mk(unusedV, `E ${inp.escrow} - P ${P.value.toFixed(4)}`),
    burnedIfAmbiguous: mk(PHI * unusedV, `phi ${PHI} x (E-P) ${unusedV.toFixed(4)}`),
    lostIfCooperative: mk(
      unusedV,
      `the entire unused remainder — cooperative settle refunds nothing (R12.1a)`,
    ),
  };
}

/** Conservation check: P + (1-phi)(E-P) + phi(E-P) = E. Asserted in tests. */
export function conservationResidual(E: number, P: number): number {
  return P + (1 - PHI) * (E - P) + PHI * (E - P) - E;
}

// ---------------------------------------------------------------------------- under-reservation

export interface TopUp {
  /** Additional escrow required, FLOP. */
  required: Computed;
  rule: string;
  cites: string[];
}

/** R12.1e: over-use is handled by abort or in-place top_up_escrow (a Lightning-style splice-in). */
export function topUp(inp: TariffInputs): TopUp {
  const P = tariff(inp);
  const required: Computed = isBlocked(P)
      ? P
      : figure({
          value: Math.max(0, P.value - inp.escrow),
          unit: "FLOP",
          buckets: [P.bucket],
          cites: [...P.cites, "R12.1e"],
          assumptions: P.assumptions,
          derivation: `max(0, P ${P.value.toFixed(4)} - E ${inp.escrow})`,
        });
  return {
    required,
    rule:
      "R12.1e: over-use is handled by abort or in-place top_up_escrow — the aggregate G_n " +
      "accumulator already grows unbounded, only the escrow cap is raised. A session does not " +
      "silently fail; it aborts or splices in, and the splice is an extra on-chain inclusion.",
    cites: ["R12.1e", "App. C.7"],
  };
}

// ---------------------------------------------------------------------------- reservations

/** R12.2: base concurrent reservations, plus one slot per escrow_per_reservation_slot escrowed. */
export function reservationSlots(extraEscrow: number): Figure {
  const base = num(param("max_active_reservations_base"));
  const per = num(param("escrow_per_reservation_slot"));
  return figure({
    value: base + Math.floor(Math.max(0, extraEscrow) / per),
    unit: "concurrent reservations",
    buckets: ["DEFINED"],
    cites: [param("max_active_reservations_base").cite, param("escrow_per_reservation_slot").cite],
    derivation: `${base} base + floor(${extraEscrow} / ${per}) additional slots`,
  });
}

/** Escrow needed to hold `slots` concurrent reservations. */
export function escrowForSlots(slots: number): Figure {
  const base = num(param("max_active_reservations_base"));
  const per = num(param("escrow_per_reservation_slot"));
  return figure({
    value: Math.max(0, slots - base) * per,
    unit: "FLOP",
    buckets: ["DEFINED"],
    cites: [param("max_active_reservations_base").cite, param("escrow_per_reservation_slot").cite],
    derivation: `max(0, ${slots} - ${base}) x ${per} FLOP`,
  });
}

// ---------------------------------------------------------------------------- dispute

export interface DisputeCost {
  bond: Figure;
  /** ABSENT: no rule states the outcome of a failed dispute. Modelled as forfeited. */
  lossIfFails: Figure;
  standing: string;
  cites: string[];
  caveat: string;
}

export function disputeCost(): DisputeCost {
  const bond = num(param("channel_challenger_bond"));
  const p = param("challenger_bond_on_failed_dispute");
  return {
    bond: figure({
      value: bond,
      unit: "FLOP",
      buckets: ["DEFINED"],
      cites: [param("channel_challenger_bond").cite],
      derivation: "posted to open a session dispute (anti-griefing)",
    }),
    lossIfFails: figure({
      value: bond,
      unit: "FLOP",
      buckets: ["ABSENT"],
      cites: [p.cite],
      derivation:
        "modelled as forfeited — the spec states the bond IS returned on the DA-unrecoverable " +
        "path (R13.0c) but says nothing about a dispute that simply fails",
    }),
    standing:
      "R12.1f: standing is the session agent (its own channel) plus any active validator (any " +
      "channel). Arbitrary public challengers are rejected before bond lock. R3.5a makes the " +
      "agent the standing challenger for its own channel — a duty, not just an option.",
    cites: ["R12.1f", "R3.5a", param("channel_challenger_bond").cite],
    caveat: "Conservative assumption: forfeiture on failure is not stated anywhere.",
  };
}

// ---------------------------------------------------------------------------- tier choice

export interface TierComparison {
  hardGuarantee: string;
  softStatus: string;
  agentCostDifference: Computed;
  spotCheckFallsOn: string;
  cites: string[];
}

/** What an agent can and cannot learn about the HARD/SOFT trade from the spec. */
export function tierComparison(): TierComparison {
  const capP = param("tee_tier_value_cap_premium");
  return {
    hardGuarantee:
      "R12.1c: a HARD-tier open_channel and settle MUST verify the proof's measured dm-verity " +
      "root against the registry; a wrong root at settle MUST reject.",
    softStatus:
      "PLANNED (E.33). R12.1c: the SOFT profile has no TEE-measured root; its model/decode " +
      "binding, evidence predicate, value cap and dispute path are all open. /intro/miner/ " +
      'markets SOFT as the default while also saying "the currently wired settlement path ' +
      'remains the attested one."',
    agentCostDifference: blocked([
      { key: capP.key, cite: capP.cite, label: "HARD vs SOFT permitted value cap" },
    ]),
    spotCheckFallsOn:
      `The SOFT spot-check (${num(param("soft_tier_spot_check_rate_ppm")) / PPM * 100}% of sessions, ` +
      "~1 in 40) is MINER-side exposure surfaced with the calibration snapshot event, and the " +
      "1.25x surge multiplier applies to miner stake. Neither costs the agent anything.",
    cites: ["R3.2", "R12.1c", "E.33", param("soft_tier_spot_check_rate_ppm").cite],
  };
}

// ---------------------------------------------------------------------------- session windows

/**
 * How long an agent's escrow is exposed, and what can extend it.
 *
 * The close-path table answers "how much do I get back". It cannot answer "and when", which for
 * anyone reserving capital is the other half of the question. §2.2's window table answers it
 * normatively, so this reads the windows rather than inventing a lifecycle:
 *
 *   ack        10 min  miner ratifies a force_open, or the agent reclaims (`expire_force_open`)
 *   response    2 h    the miner's window to answer a named contested turn; miss => fraud default
 *   pause cap   4 h    the most a per-channel attestation outage can stall the clocks (§13 O1)
 *   dispute     7 d    force-settle contestation — TIME TO OPEN ONLY, not to resolve
 *   retention  14 d    DA transcript retrievability; MUST be >= the dispute window
 *
 * The reading that matters: a cooperative settle ends at settlement, but a force_settle can be
 * contested for seven days, and the evidence that decides it is guaranteed to exist for fourteen.
 * Escrow is exposed across that span, not across the session.
 */
export interface SessionWindow {
  key: string;
  label: string;
  /** Days from the moment the channel opens. */
  days: number;
  cite: string;
  /** What it does to the agent's money, in one clause. */
  effect: string;
}

const BLOCKS_PER_DAY = num(param("blocks_per_year")) / 365;

export function sessionWindows(): readonly SessionWindow[] {
  const d = (key: string) => num(param(key as never)) / BLOCKS_PER_DAY;
  return [
    {
      key: "ack",
      label: "force_open ack",
      days: d("channel_ack_window_blocks"),
      cite: param("channel_ack_window_blocks").cite,
      effect: "miner ratifies, or you reclaim the escrow",
    },
    {
      key: "response",
      label: "dispute response",
      days: d("channel_dispute_response_window_blocks"),
      cite: param("channel_dispute_response_window_blocks").cite,
      effect: "the miner answers a contested turn; a miss is a fraud default",
    },
    {
      key: "pause",
      label: "attestation pause cap",
      days: d("channel_attestation_pause_cap_blocks"),
      cite: param("channel_attestation_pause_cap_blocks").cite,
      effect: "the most an outage can stall the clocks",
    },
    {
      key: "dispute",
      label: "dispute window",
      days: d("channel_dispute_window_blocks"),
      cite: param("channel_dispute_window_blocks").cite,
      effect: "time to OPEN a contest, not to resolve one",
    },
    {
      key: "retention",
      label: "DA retention",
      days: d("da_ephemeral_retention_blocks"),
      cite: param("da_ephemeral_retention_blocks").cite,
      effect: "after this the evidence is prunable",
    },
  ];
}
