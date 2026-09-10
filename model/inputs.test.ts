/**
 * The boundary between what a person types and what the model is allowed to see.
 *
 * These are regression tests for a crash, not for arithmetic. Typing a minus sign into the
 * self-stake field produced a negative committee-seat probability, the model's own invariant
 * threw, and the React tree unmounted: a blank page, everything typed lost, and no way back but a
 * reload. A shared link carrying `?s=-500` did the same thing without a keystroke.
 *
 * Two guards, so neither path can reach the model. The field one is a DOM detail and lives with
 * the component; this covers the URL and the saved scenario, which are the ones a person can be
 * handed by someone else.
 */
import { describe, expect, it } from "vitest";
import { fromQuery, toQuery, EXAMPLE } from "../app/lib/state";
import { needsInput } from "./types";
import { seatRateFromStake } from "./validator";

describe("a scenario arriving from a URL", () => {
  it("drops a negative quantity instead of passing it on", () => {
    const q = fromQuery("s=-500&ns=61101000")!;
    expect(q.stake, "a negative stake is not a scenario").toBeUndefined();
    expect(q.networkStake).toBe(61_101_000);
  });

  it("drops NaN and infinities", () => {
    const q = fromQuery("s=abc&ns=Infinity&val=1e999")!;
    expect(q.stake).toBeUndefined();
    expect(q.networkStake).toBeUndefined();
    expect(q.valuationUsd).toBeUndefined();
  });

  it("still admits zero, which is a real answer for an optional field", () => {
    expect(fromQuery("gn=0")!.gn).toBe(0);
  });

  it("round-trips the shipped example unchanged", () => {
    const back = fromQuery(toQuery(EXAMPLE))!;
    for (const k of Object.keys(EXAMPLE) as (keyof typeof EXAMPLE)[]) {
      expect(back[k], k).toEqual(EXAMPLE[k]);
    }
  });

  /**
   * The invariant this all exists to protect. If this ever stops throwing, the guards above are
   * still right but the reason recorded here has gone stale.
   */
  it("would have produced an out-of-range seat probability", () => {
    const r = seatRateFromStake(-500, 61_101_000);
    expect(r.value).toBeLessThan(0);
  });
});

describe("refusing a cleared required input", () => {
  it("asks for the field by name rather than blaming the specification", () => {
    const b = needsInput([{ key: "stake", label: "your self-stake" }]);
    expect(b.blocked).toBe(true);
    expect(b.message).toBe("Enter your self-stake");
    expect(b.cites, "nothing in the spec is missing here — the user is").toEqual([]);
    expect(b.detail).toMatch(/will not stand a zero in for it/);
  });

  it("names both when both are gone", () => {
    const b = needsInput([
      { key: "stake", label: "your self-stake" },
      { key: "networkStake", label: "the average stake" },
    ]);
    expect(b.message).toBe("Enter your self-stake and the average stake");
    expect(b.missing).toEqual(["stake", "networkStake"]);
  });
});
