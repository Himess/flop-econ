/**
 * Guards on the two things that quietly destroy this tool.
 *
 * 1. A magic number in the UI. The differentiator is that every figure carries provenance; a
 *    constant typed straight into a component has none, and no badge can be honest about it.
 * 2. Locale-dependent number formatting. `toLocaleString()` without a locale rendered 250,000 as
 *    "250.000" on this machine, which reads as 250. Every call must pin en-US.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { PARAMS } from "./params.generated";
import { committeePremiumValue, seatRateFromStake, baseSeatRate, type ValidatorInputs } from "./validator";
import { tariffUnits } from "./agent";

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(p)) out.push(p);
  }
  return out;
}

const ROOT = join(__dirname, "..");
const appFiles = walk(join(ROOT, "app"));
const modelFiles = walk(join(ROOT, "model")).filter((f) => !f.endsWith(".test.ts"));

/**
 * Strip everything that is not a real expression position: comments, string and template
 * literals, JSX text, and presentational attributes.
 *
 * Order matters, and getting it wrong cost a false-positive run: stripping `//` line comments
 * BEFORE string literals eats the tail of any string containing a URL ("https://..."), which
 * unbalances the quotes and desynchronises every later string match in the file. Strings first.
 */
const PRESENTATIONAL =
  /\b(step|width|height|viewBox|cx|cy|r|x|y|x1|x2|y1|y2|rx|ry|strokeWidth|strokeDasharray|strokeLinecap|fontSize|tabIndex|rows|cols|maxLength|size|opacity)=\{?[^\s}>]*\}?/g;

function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``")
    .replace(/^\s*\/\/[^\n]*/gm, " ")
    .replace(/>([^<>{}]*)</g, "><")
    .replace(PRESENTATIONAL, " ");
}

describe("no magic numbers in app/", () => {
  /**
   * Every domain constant must arrive from model/, which reads params.generated.ts, which is
   * generated from params.yaml. This denylist is every numeric value the parameter set defines
   * with magnitude >= 1000, plus the high-signal small ones that are unmistakably protocol
   * figures rather than layout. Small layout integers stay legal.
   */
  const domainNumbers = new Set<number>();
  for (const p of PARAMS) {
    if (typeof p.value === "number" && Math.abs(p.value) >= 1000) domainNumbers.add(p.value);
  }
  // Unmistakably protocol, even though small.
  for (const n of [96, 48, 24, 12, 6, 3, 0.75, 0.05, 0.01, 1.1, 1.25, 1.5, 0.2, 42236]) {
    domainNumbers.add(n);
  }
  // Legal anywhere: array indices, halves, percent scaling, opacity.
  for (const n of [0, 1, 2, 3, 6, 12, 24, 48, 100]) domainNumbers.delete(n);

  it("finds no protocol constant hardcoded in a component", () => {
    const offenders: string[] = [];
    for (const f of appFiles) {
      const src = code(readFileSync(f, "utf8"));
      for (const m of src.matchAll(/(?<![\w.$])(\d[\d_]*(?:\.\d+)?)(?![\w.])/g)) {
        const n = Number(m[1]!.replace(/_/g, ""));
        if (domainNumbers.has(n)) {
          offenders.push(`${f.replace(ROOT, "")}: ${m[1]}`);
        }
      }
    }
    expect(offenders, "import these from model/ instead of typing them").toEqual([]);
  });

  it("the denylist is not vacuous — it would catch a real regression", () => {
    // Sanity: the guard must actually fire on the numbers it claims to police.
    expect(domainNumbers.has(42236)).toBe(true);
    expect(domainNumbers.has(31536000)).toBe(true);
    expect(domainNumbers.has(305505)).toBe(true);
    expect(domainNumbers.size).toBeGreaterThan(15);
  });
});

describe("number formatting is locale-pinned", () => {
  it("no toLocaleString() call omits a locale, anywhere", () => {
    const offenders: string[] = [];
    for (const f of [...appFiles, ...modelFiles]) {
      const src = readFileSync(f, "utf8");
      // Matches .toLocaleString() with an empty argument list.
      if (/\.toLocaleString\(\s*\)/.test(src)) offenders.push(f.replace(ROOT, ""));
    }
    expect(offenders, 'pin these to "en-US"').toEqual([]);
  });

  it("no Intl formatter is constructed without an explicit locale", () => {
    const offenders: string[] = [];
    for (const f of [...appFiles, ...modelFiles]) {
      const src = code(readFileSync(f, "utf8"));
      if (/new Intl\.NumberFormat\(\s*[,)]/.test(src)) offenders.push(f.replace(ROOT, ""));
    }
    expect(offenders).toEqual([]);
  });

  it("en-US grouping renders 250000 unambiguously", () => {
    expect((250_000).toLocaleString("en-US")).toBe("250,000");
  });
});

describe("committee seat rate and premium", () => {
  const base: ValidatorInputs = {
    stake: 305_505,
    networkStake: 305_505 * 200,
    activeSetSize: 200,
    era: 0,
  };

  it("the stake-implied seat rate equals the set average at average stake", () => {
    const r = seatRateFromStake(base.stake, base.networkStake);
    expect(r.value).toBeCloseTo(baseSeatRate(base.activeSetSize), 12);
  });

  it("is PLANNED, never DEFINED — E.42 leaves the exact analysis open", () => {
    const r = seatRateFromStake(base.stake, base.networkStake);
    expect(r.bucket).toBe("PLANNED");
    expect(r.cites.join(" ")).toContain("E.42");
  });

  it("clamps at 1 for a dominant stake rather than exceeding certainty", () => {
    expect(seatRateFromStake(1_000_000, 1_000_000).value).toBe(1);
  });

  it("the premium is worth exactly zero at the set-average seat rate", () => {
    expect(committeePremiumValue(base).value).toBeCloseTo(0, 6);
  });

  it("the premium turns positive only above the average seat rate", () => {
    const above = committeePremiumValue({ ...base, committeeSeatProbability: 1 });
    const below = committeePremiumValue({ ...base, committeeSeatProbability: 0 });
    expect(above.value).toBeGreaterThan(0);
    expect(below.value).toBeLessThan(0);
  });
});

describe("tariff units", () => {
  it("both legs are DEFINED at 1 channel pay unit, so P = n + G_n", () => {
    const u = tariffUnits({ escrow: 0, turns: 180, gnClaimed: 0 });
    expect(u.value).toBe(180);
    expect(tariffUnits({ escrow: 0, turns: 180, gnClaimed: 20 }).value).toBe(200);
  });
});
