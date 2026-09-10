"use client";

/**
 * Tool-page primitives.
 *
 * The rule this file enforces: no component here accepts a paragraph. Provenance survives as a
 * one-line mark that links into `/docs`; the explanation lives there. A mark without a destination
 * is a regression, so `docs` is required on every Mark that carries a citation.
 */
import { useState } from "react";
import { isBlocked, type Bucket, type Computed } from "@/model/types";
import { href, type AnchorId } from "../lib/docs";
import { auto } from "../lib/format";

const CLS: Record<Bucket, string> = { DEFINED: "b-def", PLANNED: "b-plan", ABSENT: "b-abs" };
const MEANS: Record<Bucket, string> = {
  DEFINED: "Fixed by the specification. Click for the calculation.",
  PLANNED: "Named by the specification but unresolved. Click for the calculation.",
  ABSENT: "Not in the specification — rests on a figure you supplied. Click for the calculation.",
};

/**
 * The mark under a headline names its provenance, not itself. Three figures each carrying the
 * words "how this is calculated" is three identical red strings that say nothing about where the
 * number came from; "R9.5 · E.39" says it in the specification's own vocabulary and still links to
 * the same place. Two citations is the legible limit at a headline's scale.
 */
function citeLabel(result: Computed): string {
  // "computed" is the model's synthetic cite for a horizon that simply ran out; it names no rule,
  // so a call site that hits that path passes its own mark instead.
  const cites = result.cites.filter((c) => c !== "computed").slice(0, 2);
  if (cites.length === 0) return "how this is calculated";
  const short = cites.map((c) => c.split("—")[0]!.split("(")[0]!.trim());
  const joined = short.join(" · ");
  return joined.length > 30 ? short[0]! : joined;
}

/** A citation mark. Always a link; the destination is checked by a test. */
export function Mark({
  bucket,
  label,
  docs,
}: {
  bucket: Bucket;
  label: string;
  docs: AnchorId;
}) {
  return (
    <a className={`b ${CLS[bucket]}`} href={href(docs)} title={MEANS[bucket]}>
      {label}
    </a>
  );
}

/** The three figures that dominate the validator answer. */
export function Headline({
  label,
  result,
  docs,
  suffix,
  prefix,
  fallback,
  mark,
}: {
  label: string;
  result: Computed;
  docs: AnchorId;
  suffix?: string;
  prefix?: string;
  /** Shown instead of a number when the result is a refusal, e.g. "not within 36 months". */
  fallback?: string;
  /** Overrides the derived citation where the result carries no rule of its own. */
  mark?: string;
}) {
  const blocked = isBlocked(result);
  return (
    <div>
      <div className="text-[11.5px] uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>
        {label}
      </div>
      <div
        className="mt-1.5 font-mono leading-none"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "clamp(26px, 4.2vw, 38px)",
          fontWeight: 500,
          color: blocked ? "var(--absent)" : "var(--ink)",
        }}
      >
        {blocked ? (
          <span style={{ fontSize: "clamp(15px, 2.2vw, 19px)" }}>{fallback ?? "needs an input"}</span>
        ) : (
          <>
            {prefix}
            {auto(result.value)}
            {suffix ? (
              <span className="ml-1 text-[14px]" style={{ color: "var(--ink-3)" }}>
                {suffix}
              </span>
            ) : null}
          </>
        )}
      </div>
      <div className="mt-2.5">
        <Mark
          bucket={blocked ? "ABSENT" : result.bucket}
          label={mark ?? citeLabel(result)}
          docs={docs}
        />
      </div>
    </div>
  );
}

/** A one-line diagnostic row. Label, value, mark. No prose. */
export function Line({
  label,
  result,
  docs,
  mark,
  suffix,
  fallback,
}: {
  label: string;
  result: Computed;
  docs: AnchorId;
  mark: string;
  suffix?: string;
  fallback?: string;
}) {
  const blocked = isBlocked(result);
  return (
    <div
      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2"
      style={{ borderBottom: "1px solid var(--rule)" }}
    >
      <span className="text-[13.5px]" style={{ color: "var(--ink-2)" }}>
        {label}
      </span>
      <span className="whitespace-nowrap font-mono text-[14px]" style={{ fontFamily: "var(--font-mono)" }}>
        {blocked ? (
          <span className="text-[12.5px]" style={{ color: "var(--absent)" }}>
            {fallback ?? "needs an input"}
          </span>
        ) : (
          <>
            {auto(result.value)}
            {suffix ? <span style={{ color: "var(--ink-3)" }}> {suffix}</span> : null}
          </>
        )}
        <Mark bucket={blocked ? "ABSENT" : result.bucket} label={mark} docs={docs} />
      </span>
    </div>
  );
}

export function Field({
  id,
  label,
  value,
  onChange,
  suffix,
  assumed,
  placeholder,
  grouped,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
  assumed?: boolean;
  placeholder?: string;
  /**
   * Show thousands separators while the field is not being typed in.
   *
   * `300000000` is nine digits nobody counts correctly at a glance; `300,000,000` is read in one.
   * Only while unfocused, because grouping a value as it is typed fights the caret — so the
   * separators appear on blur and vanish the moment you click in.
   */
  grouped?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const shown =
    grouped && !editing && value !== "" && Number.isFinite(Number(value))
      ? Number(value).toLocaleString("en-US")
      : value;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[11.5px]" style={{ color: "var(--ink-3)" }}>
        {label}
        {assumed ? <span style={{ color: "var(--absent)" }}> ·</span> : null}
      </label>
      <div className="flex items-center gap-1.5">
        <input
          id={id}
          inputMode="decimal"
          value={shown}
          placeholder={placeholder ?? (assumed ? "yours" : undefined)}
          onFocus={() => setEditing(true)}
          onBlur={() => setEditing(false)}
          // Separators are display only; a pasted "300,000,000" still parses.
          onChange={(e) => onChange(e.target.value.replace(/,/g, ""))}
          // min-w-0 rather than w-full: a flex item at 100% width pushes its unit label off the
          // right edge in a two-column phone grid, which is how "FLOP/yr" got clipped.
          className="min-w-0 flex-1 rounded-[3px] px-2.5 py-2 font-mono text-[13px]"
          style={{
            background: "var(--panel)",
            border: `1px solid ${assumed && value === "" ? "var(--absent)" : "var(--rule)"}`,
            color: "var(--ink)",
            fontFamily: "var(--font-mono)",
          }}
        />
        {suffix ? (
          <span className="whitespace-nowrap text-[11px]" style={{ color: "var(--ink-3)" }}>
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function Select({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[11.5px]" style={{ color: "var(--ink-3)" }}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[3px] px-2.5 py-2 font-mono text-[13px]"
        style={{
          background: "var(--panel)",
          border: "1px solid var(--rule)",
          color: "var(--ink)",
          fontFamily: "var(--font-mono)",
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * One compact input row.
 *
 * `bare` is for the row nested inside a drawer, where a second panel inside a panel would read as
 * a box in a box; everywhere else the fields sit on their own surface so the eye can tell the
 * things you type from the things the tool answers.
 */
export function Inputs({ children, bare }: { children: React.ReactNode; bare?: boolean }) {
  return (
    <div
      className={bare ? "grid gap-3" : "grid gap-x-3 gap-y-4 rounded-[6px] p-4"}
      style={{
        gridTemplateColumns: "repeat(auto-fit,minmax(136px,1fr))",
        ...(bare ? {} : { background: "var(--panel)", border: "1px solid var(--rule)" }),
      }}
    >
      {children}
    </div>
  );
}

/**
 * A labelled band of inputs.
 *
 * The three groups are the whole point of the input rebuild: what you ARE (position), what you
 * OWN (hardware), and what you are GUESSING (estimates). Without the labels a reader cannot tell
 * which fields the assumptions chip is counting, and the count stops meaning anything.
 */
export function Group({
  title,
  note,
  children,
}: {
  title: string;
  /** One clause. Not a sentence about methodology. */
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span className="text-[11.5px] uppercase tracking-[.06em]" style={{ color: "var(--ink-2)" }}>
          {title}
        </span>
        {note ? (
          <span className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>
            {note}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

/**
 * A titled surface. The chart earns one because a plot floating on the page ground has no edge,
 * and an edge is most of what makes a figure read as considered rather than pasted in.
 */
export function Card({
  title,
  aside,
  children,
}: {
  title: string;
  /** One short link or label, right-aligned in the header. */
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-[6px]"
      style={{ background: "var(--panel)", border: "1px solid var(--rule)" }}
    >
      <header
        className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3"
        style={{ borderBottom: "1px solid var(--rule)" }}
      >
        <h2 className="text-[13px] font-medium tracking-[.01em]">{title}</h2>
        {aside ? <div className="text-[12px]">{aside}</div> : null}
      </header>
      <div className="px-4 pb-4 pt-4">{children}</div>
    </section>
  );
}

/** The three answers, on one rule-separated row. */
export function Answers({ children }: { children: React.ReactNode }) {
  return (
    <div className="answers grid gap-x-8 gap-y-9 sm:grid-cols-3">{children}</div>
  );
}

/**
 * A collapsed block of diagnostics. Everything that is not the answer lives behind one of these.
 * `summary` is a label, never a sentence.
 */
export function Drawer({
  summary,
  count,
  children,
}: {
  summary: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <details className="drawer group" style={{ borderBottom: "1px solid var(--rule)" }}>
      <summary
        className="flex cursor-pointer list-none items-center gap-2.5 py-3.5 text-[13.5px]"
        style={{ color: "var(--ink-2)" }}
      >
        <span
          className="inline-block transition-transform group-open:rotate-90"
          style={{ color: "var(--ink-3)" }}
        >
          ▸
        </span>
        {summary}
        {count !== undefined ? (
          <span style={{ color: "var(--ink-3)", fontFamily: "var(--font-mono)", fontSize: "11.5px" }}>
            {count}
          </span>
        ) : null}
      </summary>
      <div className="pb-4">{children}</div>
    </details>
  );
}

/** A heading with at most one sentence beneath it. The type enforces the rule. */
export function Block({
  title,
  note,
  children,
}: {
  title: string;
  /** One sentence. If it needs a paragraph, the paragraph belongs in /docs. */
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-[14px] font-medium">{title}</h2>
      {note ? (
        <p className="mt-1 max-w-[70ch] text-[12.5px]" style={{ color: "var(--ink-3)" }}>
          {note}
        </p>
      ) : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}
