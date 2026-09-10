/**
 * The derivations that replaced two unanswerable inputs.
 *
 * Every constant these tests assert is a normative figure from the spec, so a failure here means
 * either the arithmetic drifted or params.yaml did.
 */
import { describe, expect, it } from "vitest";
import {
  COMMITTEE_GATE,
  committeeGateDuty,
  daBytesPerSession,
  daStorageUsdYear,
  merklePathLength,
  rigPowerKw,
  RETENTION_DAYS,
  validatorDaGb,
} from "./physical";
import { isBlocked, num } from "./types";
import { param } from "./params.generated";

const TRAFFIC = { sessionsPerDay: 5_000, turnsPerSession: 20, tokensPerTurn: 800 };

function value(c: ReturnType<typeof daBytesPerSession>): number {
  if (isBlocked(c)) throw new Error(`blocked: ${c.message}`);
  return c.value;
}

describe("DA byte arithmetic", () => {
  it("retention resolves to the spec's 14 days", () => {
    expect(RETENTION_DAYS).toBe(14);
  });

  it("a Merkle path is ceil(log2(turns))", () => {
    expect(merklePathLength(1)).toBe(0);
    expect(merklePathLength(2)).toBe(1);
    expect(merklePathLength(20)).toBe(5);
    expect(merklePathLength(1_024)).toBe(10);
  });

  it("sizes one session from Appendix F.3 and §3.4", () => {
    // 20 turns, path length 5: VerifiedTurn = 268 + compact_len(5)=1 + 33x5 = 434 B.
    // TOPLOC = ceil(800/32) x 258 = 25 x 258 = 6,450 B per turn.
    const perTurn = 434 + 6_450;
    expect(value(daBytesPerSession(TRAFFIC))).toBe(20 * perTurn);
  });

  it("pins the constants it reads to params.yaml", () => {
    expect(num(param("verified_turn_bytes_base"))).toBe(268);
    expect(num(param("verified_turn_merkle_item_bytes"))).toBe(33);
    expect(num(param("toploc_commitment_bytes"))).toBe(258);
    expect(num(param("toploc_commitment_token_window"))).toBe(32);
    expect(num(param("da_erasure_expansion_ratio"))).toBe(2);
  });

  it("refuses each traffic figure it has not been given", () => {
    for (const k of ["sessionsPerDay", "turnsPerSession", "tokensPerTurn"] as const) {
      const r = daBytesPerSession({ ...TRAFFIC, [k]: undefined });
      // sessions/day does not enter the per-session figure, so only the other two block it.
      if (k === "sessionsPerDay") continue;
      expect(isBlocked(r), k).toBe(true);
    }
    expect(isBlocked(validatorDaGb({ ...TRAFFIC, sessionsPerDay: undefined }, 0.005))).toBe(true);
  });

  it("every traffic figure it consumes is ABSENT in params.yaml", () => {
    for (const k of [
      "network_sessions_per_day",
      "network_turns_per_session",
      "network_tokens_per_turn",
      "da_storage_price_usd_gb_month",
    ] as const) {
      expect(param(k).bucket, k).toBe("ABSENT");
      expect(param(k).value, k).toBeUndefined();
    }
  });
});

describe("the validator's share", () => {
  const perSession = value(daBytesPerSession(TRAFFIC));

  it("is stake share x expansion x the standing volume", () => {
    const share = 1 / 200;
    const expected = (perSession * TRAFFIC.sessionsPerDay * 14 * 2 * share) / 1e9;
    expect(value(validatorDaGb(TRAFFIC, share))).toBeCloseTo(expected, 9);
  });

  it("does not depend on the R=6 subset size, which the spec never states", () => {
    // The derivation contains no subset-size term at all; this asserts the property that makes
    // that legitimate — shards on the subset sum to expansion x original however many there are.
    const shards = num(param("da_shard_count"));
    const expansion = num(param("da_erasure_expansion_ratio"));
    const shardBytes = (perSession * expansion) / shards;
    expect(shardBytes * shards).toBeCloseTo(perSession * expansion, 6);
  });

  it("scales linearly in stake share, like the seat rate", () => {
    const a = value(validatorDaGb(TRAFFIC, 0.005));
    const b = value(validatorDaGb(TRAFFIC, 0.01));
    expect(b / a).toBeCloseTo(2, 9);
  });

  it("drags to ABSENT because the traffic behind it is the user's", () => {
    const r = validatorDaGb(TRAFFIC, 0.005);
    expect(isBlocked(r)).toBe(false);
    if (!isBlocked(r)) {
      expect(r.bucket).toBe("ABSENT");
      expect(r.assumptions.map((a) => a.key).sort()).toEqual([
        "network_sessions_per_day",
        "network_tokens_per_turn",
        "network_turns_per_session",
      ]);
    }
  });

  /**
   * The finding this derivation produced. §15.3 calls DA store-and-serve one of "the two heavy
   * legs", and the tool's old example asked for 250,000 FLOP/yr — but the STORAGE half is single-
   * digit gigabytes even at a million sessions a day. Whatever is heavy about the leg is the
   * bandwidth, which E.47 leaves open.
   */
  it("is single-digit GB even at a million sessions a day", () => {
    const heavy = { ...TRAFFIC, sessionsPerDay: 1_000_000 };
    const gb = value(validatorDaGb(heavy, 1 / 200));
    expect(gb).toBeGreaterThan(1);
    expect(gb).toBeLessThan(100);
  });

  it("costs cents per year at an ordinary storage price", () => {
    const usd = value(daStorageUsdYear(TRAFFIC, 1 / 200, 0.02));
    expect(usd).toBeLessThan(1);
  });

  it("blocks without a storage price rather than assuming one", () => {
    expect(isBlocked(daStorageUsdYear(TRAFFIC, 1 / 200, undefined))).toBe(true);
  });
});

describe("the rig", () => {
  it("derives kW from cards, draw and utilisation", () => {
    expect(value(rigPowerKw({ gpuCount: 2, wattsPerGpu: 700, utilisation: 0.5 }))).toBeCloseTo(0.7, 9);
  });

  it("refuses a utilisation above one", () => {
    expect(isBlocked(rigPowerKw({ gpuCount: 1, wattsPerGpu: 700, utilisation: 1.5 }))).toBe(true);
  });

  it("blocks on each missing physical figure", () => {
    expect(isBlocked(rigPowerKw({ wattsPerGpu: 700, utilisation: 0.5 }))).toBe(true);
    expect(isBlocked(rigPowerKw({ gpuCount: 1, utilisation: 0.5 }))).toBe(true);
    expect(isBlocked(rigPowerKw({ gpuCount: 1, wattsPerGpu: 700 }))).toBe(true);
  });
});

describe("the committee GPU gate, as the spec states it", () => {
  const d = committeeGateDuty();

  it("is a 24-hour recency window with no quantity attached", () => {
    expect(d.recencyHours).toBe(24);
    expect(COMMITTEE_GATE.recencyWindowBlocks).toBe(86_400);
  });

  it("puts the only quantity floor in the calibration renewal rule", () => {
    expect(d.utilisationFloor).toBe(0.5);
    expect(d.minVerifiedJobs).toBe(8);
    expect(d.leaseDays).toBe(7);
    expect(d.renewalWindowMinutes).toBe(10);
  });

  /**
   * The floor is relative to the operator's own C_effective (R7.2), so no absolute hardware
   * figure exists anywhere in the spec. That absence is a result, not a gap in this model.
   */
  it("has no absolute hardware minimum to read", () => {
    expect(param("validator_hardware_spec").bucket).toBe("ABSENT");
    expect(param("validator_hardware_spec").value).toBeUndefined();
  });
});
