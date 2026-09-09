/**
 * The split's own guard rails.
 *
 * Two rules from the brief, made mechanical:
 *   1. A provenance mark with no destination is a regression.
 *   2. The docs parameter table renders from params.yaml and cannot drift from it.
 *
 * A third is worth enforcing because it is the whole point of the split: the tool page answers and
 * does not lecture, so no section on it carries more than one sentence of prose.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ANCHORS, CALCS, FINDINGS, LIMITS, paramAnchor, paramRows } from "../app/lib/docs";
import { DISAGREEMENTS, PARAMS } from "./params.generated";

const ROOT = join(__dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

const toolFiles = [
  join(ROOT, "app", "page.tsx"),
  ...walk(join(ROOT, "app", "components")),
];
const docsSource = readFileSync(join(ROOT, "app", "docs", "page.tsx"), "utf8");
const toolSource = toolFiles.map((f) => readFileSync(f, "utf8")).join("\n");

describe("every provenance mark has a destination", () => {
  const anchorValues = new Set<string>(Object.values(ANCHORS));

  it("every ANCHORS id is rendered by the docs page", () => {
    // Section anchors come from ANCHORS directly; calculation anchors come from CALCS, which the
    // docs page maps over. Both must resolve to something the page actually emits.
    const calcIds = new Set(CALCS.map((c) => c.id));
    const missing: string[] = [];
    for (const id of anchorValues) {
      const renderedDirectly = docsSource.includes(`id={ANCHORS.`) && isSectionAnchor(id);
      const renderedViaCalcs = calcIds.has(id as never);
      if (!renderedDirectly && !renderedViaCalcs) missing.push(id);
    }
    expect(missing, "these anchors are referenced but nothing renders them").toEqual([]);
  });

  it("every ANCHORS key the tool references exists in the registry", () => {
    const used = [...toolSource.matchAll(/ANCHORS\.(\w+)/g)].map((m) => m[1]!);
    expect(used.length, "the tool should reference the registry, not raw strings").toBeGreaterThan(10);
    const unknown = used.filter((k) => !(k in ANCHORS));
    expect(unknown).toEqual([]);
  });

  it("no Mark is rendered without a docs target", () => {
    // The Mark component requires `docs`, so a missing one is a type error — but a raw <a class="b">
    // would slip past the type system, so the source is checked for that shape too.
    const rawMarks = [...toolSource.matchAll(/className=\{?["'`]b b-/g)];
    expect(rawMarks.map((m) => m[0])).toEqual([]);
  });

  it("the docs page links back to the calculator", () => {
    expect(docsSource).toMatch(/href="\/"/);
  });
});

function isSectionAnchor(id: string): boolean {
  return (
    id === ANCHORS.params ||
    id === ANCHORS.disagreements ||
    id === ANCHORS.findings ||
    id === ANCHORS.limits
  );
}

describe("the docs parameter table is the parameter set", () => {
  it("renders every parameter, in order, from the generated module", () => {
    expect(paramRows()).toHaveLength(PARAMS.length);
    expect(paramRows().map((p) => p.key)).toEqual(PARAMS.map((p) => p.key));
  });

  it("gives every parameter a stable anchor", () => {
    const anchors = new Set(paramRows().map((p) => paramAnchor(p.key)));
    expect(anchors.size).toBe(PARAMS.length);
    for (const a of anchors) expect(a).toMatch(/^p-[a-z0-9_]+$/);
  });

  it("renders the table from paramRows rather than a hand-written copy", () => {
    expect(docsSource).toMatch(/paramRows\(\)/);
    expect(docsSource).toMatch(/paramAnchor\(/);
  });

  it("renders every disagreement", () => {
    expect(DISAGREEMENTS.length).toBeGreaterThan(0);
    expect(docsSource).toMatch(/DISAGREEMENTS\.map/);
  });
});

describe("the tool page answers and does not lecture", () => {
  /**
   * The rule that motivated the split: no section on the tool page gets more than one sentence.
   * Counted on JSX text nodes, which is where prose would land — a paragraph typed into a
   * component reads as several sentences in a single text run.
   */
  it("no JSX text run on the tool page exceeds two sentences", () => {
    const offenders: string[] = [];
    for (const f of toolFiles) {
      const src = readFileSync(f, "utf8");
      // Text between tags, ignoring runs that are mostly markup or expressions.
      for (const m of src.matchAll(/>([^<>{}]{80,})</g)) {
        const text = m[1]!.replace(/\s+/g, " ").trim();
        const sentences = text.split(/[.!?](?:\s|$)/).filter((x) => x.trim().length > 12);
        if (sentences.length > 2) {
          offenders.push(`${f.replace(ROOT, "")}: ${text.slice(0, 70)}…`);
        }
      }
    }
    expect(offenders, "move this prose to app/docs and link to it").toEqual([]);
  });

  it("the tool page does not embed the disagreements or the parameter table", () => {
    expect(toolSource).not.toMatch(/DISAGREEMENTS\.map/);
    expect(toolSource).not.toMatch(/PARAMS\.filter/);
  });
});

describe("the docs page carries the depth", () => {
  it("documents every calculation with a citation", () => {
    expect(CALCS.length).toBeGreaterThan(15);
    for (const c of CALCS) {
      expect(c.body.length, c.id).toBeGreaterThan(60);
      expect(c.cites, c.id).toBeTruthy();
    }
  });

  it("carries all four findings, each with a claim and a body", () => {
    expect(FINDINGS).toHaveLength(4);
    for (const f of FINDINGS) {
      expect(f.claim.length, f.id).toBeGreaterThan(60);
      expect(f.body.length, f.id).toBeGreaterThanOrEqual(3);
      expect(f.cites, f.id).toBeTruthy();
    }
  });

  it("names the findings the work established", () => {
    const ids = FINDINGS.map((f) => f.id);
    expect(ids).toContain("f-committee-premium");
    expect(ids).toContain("f-audit-floor");
    expect(ids).toContain("f-lock-payback");
    expect(ids).toContain("f-gpu-backend");
  });

  it("lists the limits, including the ones that were cut deliberately", () => {
    const titles = LIMITS.map((l) => l.title.toLowerCase()).join(" ");
    expect(titles).toMatch(/price path/);
    expect(titles).toMatch(/circulating/);
    expect(titles).toMatch(/bond lock/);
    expect(titles).toMatch(/agent-side timing/);
  });
});
