/**
 * Scenario state: the worked example, URL encoding, and persistence.
 *
 * Two rules from the brief shape this file.
 *
 * 1. Nobody should meet a dead page. The tool lands on a worked example with every field filled,
 *    computing from the first frame. Refusal is the right answer to a user CLEARING a required
 *    input; it is the wrong answer to arriving.
 *
 * 2. Example values are user inputs shown as examples — never spec values wearing a spec badge.
 *    Everything in EXAMPLE that stands in for an ABSENT parameter is still badged as an
 *    assumption and still appears in the ledger, exactly as a typed value would be. The only
 *    thing the example changes is whether the field starts empty.
 *
 * Numbers here that coincide with protocol figures are read from the model, not typed, so the
 * magic-number guard stays meaningful.
 */
import { param } from "@/model/params.generated";
import { num } from "@/model/types";

export interface Scenario {
  // validator
  stake: number | undefined;
  networkStake: number | undefined;
  setSize: number;
  era: number;
  seatRate: number | undefined;
  daCost: number | undefined;
  gpuCost: number | undefined;
  verdicts: number | undefined;
  settlePerTurn: number | undefined;
  liquidity: "locked_autocompound" | "liquid";
  queueDays: number | undefined;
  // agent
  escrow: number | undefined;
  turns: number | undefined;
  gn: number | undefined;
  unitToFlop: number | undefined;
}

const MIN_STAKE = num(param("validator_min_stake"));
const WIRED_SET = num(param("validator_active_set_wired"));
const RATIFIED_SET = num(param("validator_active_set_cap"));

export const SET_SIZES = [WIRED_SET, RATIFIED_SET] as const;

/**
 * The worked example. A validator staking exactly the baseline minimum inside the wired set,
 * with plausible-but-invented cost and price figures.
 *
 * The cost figures are deliberately round: they are illustrative, they are badged ABSENT
 * wherever they appear, and a round number reads as "someone chose this" rather than as a
 * measurement. That is the intended reading.
 */
export const EXAMPLE: Scenario = {
  stake: MIN_STAKE,
  networkStake: MIN_STAKE * WIRED_SET,
  setSize: WIRED_SET,
  era: 0,
  seatRate: undefined, // blank = derived from stake, which is the honest default
  daCost: 250_000,
  gpuCost: 900_000,
  verdicts: 5_000,
  settlePerTurn: 3.1,
  liquidity: "locked_autocompound",
  queueDays: 90,
  escrow: 500,
  turns: 180,
  gn: 0,
  unitToFlop: 2.5,
};

/** Every field that stands in for an ABSENT parameter, so the UI can badge them consistently. */
export const ASSUMED_FIELDS = [
  "daCost",
  "gpuCost",
  "settlePerTurn",
  "unitToFlop",
] as const satisfies readonly (keyof Scenario)[];

const KEYS: Record<keyof Scenario, string> = {
  stake: "s",
  networkStake: "ns",
  setSize: "set",
  era: "era",
  seatRate: "sr",
  daCost: "da",
  gpuCost: "gpu",
  verdicts: "av",
  settlePerTurn: "spt",
  liquidity: "liq",
  queueDays: "qd",
  escrow: "e",
  turns: "n",
  gn: "gn",
  unitToFlop: "u2f",
};

const STORAGE_KEY = "flop-econ.scenario.v1";

/** Encode a scenario into a query string. Absent fields are encoded as empty, not omitted, so a
 *  shared link reproduces a deliberately-cleared field rather than silently refilling it. */
export function toQuery(s: Scenario): string {
  const q = new URLSearchParams();
  for (const [field, key] of Object.entries(KEYS) as [keyof Scenario, string][]) {
    const v = s[field];
    q.set(key, v === undefined ? "" : String(v));
  }
  return q.toString();
}

function readNum(q: URLSearchParams, key: string): number | undefined {
  if (!q.has(key)) return undefined;
  const raw = q.get(key)!;
  if (raw === "") return undefined;
  const v = Number(raw);
  return Number.isFinite(v) ? v : undefined;
}

export function fromQuery(query: string): Partial<Scenario> | null {
  const q = new URLSearchParams(query);
  if ([...q.keys()].length === 0) return null;
  const out: Partial<Scenario> = {};
  for (const [field, key] of Object.entries(KEYS) as [keyof Scenario, string][]) {
    if (!q.has(key)) continue;
    if (field === "liquidity") {
      out.liquidity = q.get(key) === "liquid" ? "liquid" : "locked_autocompound";
    } else if (field === "setSize" || field === "era") {
      const v = readNum(q, key);
      if (v !== undefined) (out[field] as number) = v;
    } else {
      (out[field] as number | undefined) = readNum(q, key);
    }
  }
  return out;
}

export function load(): { scenario: Scenario; source: "url" | "saved" | "example" } {
  if (typeof window === "undefined") return { scenario: EXAMPLE, source: "example" };

  const fromUrl = fromQuery(window.location.search.replace(/^\?/, ""));
  if (fromUrl) return { scenario: { ...EXAMPLE, ...fromUrl }, source: "url" };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Scenario>;
      return { scenario: { ...EXAMPLE, ...parsed }, source: "saved" };
    }
  } catch {
    // Private mode, cleared site data, or a storage-blocking browser. Fall through to the
    // example rather than failing — persistence is a convenience, never a dependency.
  }
  return { scenario: EXAMPLE, source: "example" };
}

export function save(s: Scenario): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable; the URL is still the durable share path */
  }
}

/** Clearing means empty, not "back to the example" — every optional field goes undefined. */
export function cleared(): Scenario {
  return {
    stake: undefined,
    networkStake: undefined,
    setSize: WIRED_SET,
    era: 0,
    seatRate: undefined,
    daCost: undefined,
    gpuCost: undefined,
    verdicts: undefined,
    settlePerTurn: undefined,
    liquidity: "locked_autocompound",
    queueDays: undefined,
    escrow: undefined,
    turns: undefined,
    gn: undefined,
    unitToFlop: undefined,
  };
}

export function clearSaved(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
}

/** True when the scenario still matches the shipped example in every field. */
export function isExample(s: Scenario): boolean {
  return (Object.keys(KEYS) as (keyof Scenario)[]).every((k) => s[k] === EXAMPLE[k]);
}
