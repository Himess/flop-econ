/**
 * The README quotes counts. Counts drift.
 *
 * After the v0.5.0 rebase the parameter set grew and the README kept saying 119/88/12/19 while
 * the file held 128/94/15/19 — wrong numbers on the repository's front page, in the sentence
 * that carries the whole argument. The app never had the bug because it derives its counts;
 * only the prose was hand-typed. So the prose gets a test too.
 *
 * This is deliberately not a "does the README mention 128" search. A superseded number can sit in
 * a file quite happily while the right one sits somewhere else — that is precisely the failure
 * this replaces. It parses the claim and compares it to the data.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DISAGREEMENTS, PARAMS } from "./params.generated";

const README = readFileSync(join(__dirname, "..", "README.md"), "utf8");

const count = (b: string) => PARAMS.filter((p) => p.bucket === b).length;

describe("README counts match the parameter set", () => {
  it("states the total and the ABSENT share", () => {
    const m = README.match(/\*\*(\d+) of the (\d+) parameters\*\*/);
    expect(m, "the 'N of the M parameters' claim is missing from the README").toBeTruthy();
    expect(Number(m![2]), "total parameters").toBe(PARAMS.length);
    expect(Number(m![1]), "ABSENT parameters").toBe(count("ABSENT"));
  });

  it("states the bucket split", () => {
    const m = README.match(/\((\d+) `DEFINED`, (\d+) `PLANNED`, (\d+) `ABSENT`\)/);
    expect(m, "the bucket split is missing from the README").toBeTruthy();
    expect(Number(m![1]), "DEFINED").toBe(count("DEFINED"));
    expect(Number(m![2]), "PLANNED").toBe(count("PLANNED"));
    expect(Number(m![3]), "ABSENT").toBe(count("ABSENT"));
  });

  it("states how many disagreements the file records", () => {
    const words: Record<string, number> = { seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11 };
    const m = README.match(/\*\*(\w+) places where sources disagree\*\*/);
    expect(m, "the disagreement count is missing from the README").toBeTruthy();
    const claimed = words[m![1]!.toLowerCase()];
    expect(claimed, `unrecognised number word "${m![1]}"`).toBeDefined();
    // DISAGREEMENTS is generated from the same yaml the params come from.
    expect(claimed).toBe(DISAGREEMENTS.length);
  });
});
