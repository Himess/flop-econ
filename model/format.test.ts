/**
 * Axis and end-marker formatting, which is read side by side and so has to be spelled one way.
 *
 * `notation: "compact"` only abbreviates from a thousand up. Below that it prints the number and
 * honours `maximumFractionDigits`, so a chart whose other markers said $174K and $45.2K put
 * $567.3 on the third — a tenth of a dollar on an axis where nothing is measured to one.
 */
import { describe, expect, it } from "vitest";
import { compact } from "../app/lib/format";

describe("compact", () => {
  it("abbreviates from a thousand up", () => {
    expect(compact(1_000)).toBe("1K");
    expect(compact(45_200)).toBe("45.2K");
    expect(compact(174_000)).toBe("174K");
    expect(compact(1_250_000)).toBe("1.3M");
  });

  it("prints whole units below a thousand, with no stray fraction", () => {
    expect(compact(567.3)).toBe("567");
    expect(compact(12)).toBe("12");
    expect(compact(0)).toBe("0");
  });

  /** The boundary the first attempt got wrong: 999.5 rounds INTO the abbreviated range. */
  it("does not spell the same number two ways at the boundary", () => {
    expect(compact(999.5)).toBe(compact(1_000));
  });

  it("refuses rather than printing NaN", () => {
    expect(compact(Number.NaN)).toBe("—");
    expect(compact(Number.POSITIVE_INFINITY)).toBe("—");
  });
});
