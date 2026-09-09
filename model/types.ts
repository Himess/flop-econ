/**
 * Result types for the model layer.
 *
 * The governing rule: nothing returns a bare number. Every figure carries the bucket of the
 * weakest input that produced it and the citations behind it, so a UI cannot render a value
 * without also being able to render where it came from.
 *
 * The second rule: when a required ABSENT input has not been supplied, the model returns a
 * Blocked result naming the E-item. It never substitutes a plausible number.
 */
import type { Bucket, Param } from "./params.generated";

export type { Bucket, Param };

/** An input the spec does not define, which the user supplied themselves. */
export interface AssumptionRef {
  /** The params.yaml key this stands in for, where one exists. */
  readonly key: string;
  /** What the user supplied. */
  readonly value: number;
  readonly unit: string;
  /** The open item that makes this an assumption rather than a parameter. */
  readonly cite: string;
  readonly label: string;
}

/** A computed figure with its provenance. */
export interface Figure {
  readonly value: number;
  readonly unit: string;
  readonly bucket: Bucket;
  readonly cites: readonly string[];
  readonly assumptions: readonly AssumptionRef[];
  /** Present when the figure is derived rather than read: how it was obtained. */
  readonly derivation?: string;
}

/** Returned instead of a Figure when a required ABSENT input is missing. */
export interface Blocked {
  readonly blocked: true;
  /** The params.yaml keys that were not supplied. */
  readonly missing: readonly string[];
  /** The open items behind them, e.g. "E.47 — DA availability and anti-grinding model [TBD]". */
  readonly cites: readonly string[];
  readonly message: string;
}

export type Computed = Figure | Blocked;

export function isBlocked(r: Computed): r is Blocked {
  return (r as Blocked).blocked === true;
}

/**
 * Bucket lattice: a result is only as strong as its weakest input.
 * DEFINED > PLANNED > ABSENT.
 */
const RANK: Record<Bucket, number> = { DEFINED: 2, PLANNED: 1, ABSENT: 0 };

export function weakest(buckets: readonly Bucket[]): Bucket {
  if (buckets.length === 0) return "DEFINED";
  return buckets.reduce((a, b) => (RANK[b] < RANK[a] ? b : a));
}

/** Build a Figure, deriving the bucket from its inputs. */
export function figure(args: {
  value: number;
  unit: string;
  buckets?: readonly Bucket[];
  cites: readonly string[];
  assumptions?: readonly AssumptionRef[];
  derivation?: string;
}): Figure {
  const assumptions = args.assumptions ?? [];
  // Any user-supplied assumption drags the result to ABSENT: the number is only as good as the
  // guess behind it, and the UI must say so.
  const buckets: Bucket[] = [...(args.buckets ?? [])];
  if (assumptions.length > 0) buckets.push("ABSENT");
  const cites = [...args.cites, ...assumptions.map((a) => a.cite)];
  return {
    value: args.value,
    unit: args.unit,
    bucket: weakest(buckets),
    cites: dedupe(cites),
    assumptions,
    ...(args.derivation ? { derivation: args.derivation } : {}),
  };
}

export function blocked(missing: readonly { key: string; cite: string; label: string }[]): Blocked {
  return {
    blocked: true,
    missing: missing.map((m) => m.key),
    cites: dedupe(missing.map((m) => m.cite)),
    message:
      missing.length === 1
        ? `Cannot compute: ${missing[0]!.label} is not defined by the spec and was not supplied.`
        : `Cannot compute: ${missing.length} inputs are not defined by the spec and were not supplied.`,
  };
}

/**
 * Citations arrive as compound strings ("Appendix A; §9; D-0436"). Deduping whole strings leaves
 * the same section repeated across several of them, which makes a footnote unreadable. Split into
 * atoms, dedupe those, and keep first-seen order.
 */
export function dedupe(xs: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of xs) {
    for (const atom of x.split(";")) {
      const a = atom.trim();
      if (!a || seen.has(a)) continue;
      seen.add(a);
      out.push(a);
    }
  }
  return out;
}

/** Read a DEFINED numeric parameter, or throw. Used only for values the spec actually fixes. */
export function num(p: Param): number {
  if (p.bucket === "ABSENT") {
    throw new Error(`${p.key} is ABSENT (${p.cite}) — it has no value to read`);
  }
  if (typeof p.value !== "number") {
    throw new Error(`${p.key} is not numeric (got ${typeof p.value})`);
  }
  return p.value;
}
