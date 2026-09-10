/**
 * Generates model/params.generated.ts from params.yaml.
 *
 * Why generate rather than parse at runtime: the model layer must work unchanged in Node (Vitest)
 * and in a browser bundle, with no YAML parser shipped to the client and no filesystem access.
 * Generating also gives the model a typed, exhaustive key union, so a typo in a parameter key is
 * a compile error rather than an undefined at runtime.
 *
 * `npm test` asserts the generated file is in sync with the YAML, so the two cannot drift.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const yamlPath = join(root, "params.yaml");
const outPath = join(root, "model", "params.generated.ts");

const raw = readFileSync(yamlPath, "utf8");
const doc = parse(raw) as {
  meta: Record<string, unknown>;
  parameters: Array<Record<string, unknown>>;
  disagreements: Array<Record<string, unknown>>;
};

if (!doc.parameters?.length) throw new Error("params.yaml has no parameters");

// Invariants the YAML itself must satisfy. These run at generation time so a malformed
// parameter set never reaches the model.
const seen = new Set<string>();
for (const p of doc.parameters) {
  const key = p.key as string;
  if (!key) throw new Error("parameter with no key");
  if (seen.has(key)) throw new Error(`duplicate parameter key: ${key}`);
  seen.add(key);

  const bucket = p.bucket as string;
  if (!["DEFINED", "PLANNED", "ABSENT"].includes(bucket)) {
    throw new Error(`${key}: bucket must be DEFINED | PLANNED | ABSENT, got ${bucket}`);
  }
  if (!p.cite) throw new Error(`${key}: every parameter needs a cite`);

  // The rule that makes the whole tool honest: an ABSENT parameter carries no value.
  if (bucket === "ABSENT" && p.value !== undefined) {
    throw new Error(`${key}: ABSENT parameters must not carry a value (got ${String(p.value)})`);
  }
  if (bucket === "DEFINED" && p.value === undefined) {
    throw new Error(`${key}: DEFINED parameters must carry a value`);
  }
}

const hash = createHash("sha256").update(raw).digest("hex").slice(0, 16);

const body = `// GENERATED FILE — DO NOT EDIT BY HAND.
// Source: params.yaml (sha256:${hash})
// Regenerate: npm run gen:params
//
// Every constant the model and UI use traces to an entry here. There are no magic numbers
// elsewhere in the codebase; \`npm test\` enforces both that rule's inputs and this file's
// sync with the YAML.

export type Bucket = "DEFINED" | "PLANNED" | "ABSENT";

export interface Param {
  readonly key: string;
  readonly value?: number | string;
  readonly unit?: string;
  readonly bucket: Bucket;
  readonly cite: string;
  readonly note?: string;
  readonly derived?: boolean;
  readonly derivation?: string;
}

export interface Disagreement {
  readonly id: string;
  readonly spec_says: string;
  readonly downstream_says: string;
  readonly status: string;
  readonly quote?: string;
  readonly tracking?: string;
  readonly handling: string;
  /** ISO date a disagreement was settled. Resolved entries are marked, never removed. */
  readonly resolved?: string;
}

export const PARAMS_SHA256 = ${JSON.stringify(hash)};

export const META = ${JSON.stringify(doc.meta, null, 2)} as const;

export const PARAMS: readonly Param[] = ${JSON.stringify(doc.parameters, null, 2)};

export const DISAGREEMENTS: readonly Disagreement[] = ${JSON.stringify(doc.disagreements ?? [], null, 2)};

export type ParamKey = ${doc.parameters.map((p) => JSON.stringify(p.key)).join(" | ")};

const BY_KEY = new Map<string, Param>(PARAMS.map((p) => [p.key, p]));

/** The parameter record, or throw. Never returns undefined — a bad key is a bug, not a value. */
export function param(key: ParamKey): Param {
  const p = BY_KEY.get(key);
  if (!p) throw new Error(\`unknown parameter: \${key}\`);
  return p;
}
`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, body, "utf8");
console.log(
  `wrote ${outPath}\n  ${doc.parameters.length} parameters ` +
    `(${doc.parameters.filter((p) => p.bucket === "DEFINED").length} DEFINED, ` +
    `${doc.parameters.filter((p) => p.bucket === "PLANNED").length} PLANNED, ` +
    `${doc.parameters.filter((p) => p.bucket === "ABSENT").length} ABSENT)\n` +
    `  ${(doc.disagreements ?? []).length} disagreements\n  sha256:${hash}`,
);
