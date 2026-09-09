/**
 * Display formatting. Every formatter pins en-US explicitly.
 *
 * This is not fussiness: `toLocaleString()` with no locale rendered 250,000 as "250.000" on the
 * machine this was built on, which reads as 250. A provenance tool that misstates its own numbers
 * has nothing left. `model/guards.test.ts` fails the build if any call omits the locale.
 */

const GROUPED = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const TWO_DP = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const COMPACT = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/** Whole units with thousands separators. */
export const int = (n: number): string => (Number.isFinite(n) ? GROUPED.format(Math.round(n)) : "—");

/** Two decimal places, for money-shaped and ratio-shaped values. */
export const dp2 = (n: number): string => (Number.isFinite(n) ? TWO_DP.format(n) : "—");

/** Compact, for axis labels and dense cells only. */
export const compact = (n: number): string => (Number.isFinite(n) ? COMPACT.format(n) : "—");

/** Signed, for deltas where the direction is the point. */
export const signed = (n: number): string => {
  if (!Number.isFinite(n)) return "—";
  const s = int(Math.abs(n));
  if (Math.round(n) === 0) return "0";
  return n > 0 ? `+${s}` : `−${s}`;
};

/**
 * Pick a sensible precision from magnitude. Used for figures whose scale varies widely
 * (a seat rate of 0.5 and an annual pool of 300,000,000 go through the same component).
 */
export function auto(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs === 0) return "0";
  if (abs >= 1e3) return int(n);
  if (abs >= 1) return dp2(n);
  return n.toPrecision(3);
}

export const pct = (fraction: number): string =>
  Number.isFinite(fraction) ? `${dp2(fraction * 1e2)}%` : "—";

/** Parse a user-typed figure, tolerating separators. Empty and unparseable both mean "absent". */
export function parseNum(raw: string): number | undefined {
  const t = raw.trim().replace(/,/g, "").replace(/−/g, "-");
  if (t === "") return undefined;
  const v = Number(t);
  return Number.isFinite(v) ? v : undefined;
}
