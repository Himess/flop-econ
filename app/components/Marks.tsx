"use client";

/**
 * The provenance primitives. Every number in the interface goes through one of these, so it is
 * not structurally possible to render a figure without its bucket and citation.
 */
import { useId, useState } from "react";
import { dedupe, isBlocked, type Bucket, type Computed } from "@/model/types";
import { auto } from "../lib/format";

const MARK: Record<Bucket, string> = { DEFINED: "b-def", PLANNED: "b-plan", ABSENT: "b-abs" };
const MEANS: Record<Bucket, string> = {
  DEFINED: "A value the specification fixes.",
  PLANNED: "Named by the specification but deferred, unwired, or awaiting ratification.",
  ABSENT: "Not defined by the specification. This rests on a figure you supplied.",
};

export function Mark({ bucket, label }: { bucket: Bucket; label?: string }) {
  return (
    <span className={`b ${MARK[bucket]}`} title={MEANS[bucket]}>
      {label ?? bucket.toLowerCase()}
    </span>
  );
}

export function Cites({ cites }: { cites: readonly string[] }) {
  return <>{dedupe(cites).join(" · ")}</>;
}

/**
 * A labelled row with its value, mark and citation. The workhorse of both panels.
 * Blocked results render at the same weight as a number — a refusal is a result, not an error.
 */
export function Row({
  label,
  result,
  mark,
  total,
  note,
}: {
  label: string;
  result: Computed;
  /** Overrides the citation shown beside the value, e.g. a short "R9.5". */
  mark?: string;
  total?: boolean;
  note?: React.ReactNode;
}) {
  return (
    <div
      className="flex items-baseline justify-between gap-4 border-b py-[11px]"
      style={{ borderColor: "var(--rule)" }}
    >
      <span className="text-[14px]" style={{ color: total ? "var(--ink)" : "var(--ink-2)" }}>
        {label}
        {note}
      </span>
      <span
        className="whitespace-nowrap font-mono"
        style={{ fontSize: total ? "20px" : "16px", fontFamily: "var(--font-mono)" }}
      >
        {isBlocked(result) ? (
          <span style={{ color: "var(--absent)", fontSize: "13px" }}>needs an input</span>
        ) : (
          <>
            {auto(result.value)}
            <Mark bucket={result.bucket} label={mark ?? undefined} />
          </>
        )}
      </span>
    </div>
  );
}

/**
 * A blocked panel. States the fix first and the citation second — "Enter a DA cost to compute
 * net" is actionable in a way that "blocked · E.47" is not.
 */
export function Blocked({ result }: { result: Computed }) {
  if (!isBlocked(result)) return null;
  return (
    <div
      className="mt-4 px-[14px] py-3"
      style={{ background: "var(--panel)", borderLeft: "2px dotted var(--absent)" }}
    >
      <p className="text-[13px]" style={{ color: "var(--ink)" }}>
        {result.message}
      </p>
      <p className="mt-1 text-[12.5px]" style={{ color: "var(--ink-3)" }}>
        {result.detail}
      </p>
      <p
        className="mt-2 text-[11.5px]"
        style={{ fontFamily: "var(--font-mono)", color: "var(--ink-3)" }}
      >
        <Cites cites={result.cites} />
      </p>
    </div>
  );
}

/** A short collapsed explanation next to the number it concerns. Nothing longer than a paragraph. */
export function Note({ summary, children }: { summary: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="ml-2 cursor-pointer text-[12px] underline decoration-dotted underline-offset-[3px]"
        style={{ color: "var(--ink-3)", background: "none", border: 0 }}
      >
        {open ? "hide" : summary}
      </button>
      <span
        id={id}
        hidden={!open}
        className="mb-3 mt-1 block px-[14px] py-[11px] text-[13px] leading-[1.65] print-block"
        style={{ background: "var(--panel)", borderLeft: "2px solid var(--defined)", color: "var(--ink-2)" }}
      >
        {children}
      </span>
    </>
  );
}

export function Field({
  id,
  label,
  value,
  onChange,
  suffix,
  assumed,
  cite,
  hint,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
  /** Stands in for an ABSENT parameter: marked, and listed in the ledger when filled. */
  assumed?: boolean;
  cite?: string;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[12px]" style={{ color: "var(--ink-2)" }}>
        {label}
        {assumed ? (
          <span style={{ color: "var(--absent)", fontFamily: "var(--font-mono)" }}> ·</span>
        ) : null}
      </label>
      <div className="flex items-center gap-1.5">
        <input
          id={id}
          inputMode="decimal"
          value={value}
          placeholder={placeholder ?? (assumed ? "not defined" : undefined)}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-[3px] px-2.5 py-2 font-mono text-[13px]"
          style={{
            background: "var(--panel)",
            border: `1px solid ${assumed && value === "" ? "var(--absent)" : "var(--rule)"}`,
            color: "var(--ink)",
            fontFamily: "var(--font-mono)",
          }}
        />
        {suffix ? (
          <span className="whitespace-nowrap text-[11.5px]" style={{ color: "var(--ink-3)" }}>
            {suffix}
          </span>
        ) : null}
      </div>
      {hint ? (
        <p className="mt-1 text-[11.5px] leading-snug" style={{ color: "var(--ink-3)" }}>
          {hint}
        </p>
      ) : null}
      {cite ? (
        <p
          className="mt-0.5 text-[10.5px]"
          style={{ fontFamily: "var(--font-mono)", color: "var(--absent)" }}
        >
          {cite}
        </p>
      ) : null}
    </div>
  );
}

export function Select({
  id,
  label,
  value,
  onChange,
  options,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly { value: string; label: string }[];
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[12px]" style={{ color: "var(--ink-2)" }}>
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
      {hint ? (
        <p className="mt-1 text-[11.5px] leading-snug" style={{ color: "var(--ink-3)" }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Section({
  title,
  sub,
  children,
  last,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <section
      className="py-[30px]"
      style={{ borderBottom: last ? "none" : "1px solid var(--rule)" }}
    >
      <h2 className="text-[16px] font-medium">{title}</h2>
      {sub ? (
        <p className="mb-5 mt-1 max-w-[62ch] text-[13.5px]" style={{ color: "var(--ink-3)" }}>
          {sub}
        </p>
      ) : null}
      {children}
    </section>
  );
}

export function FieldRow({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="grid gap-3.5 pb-[22px]"
      style={{
        gridTemplateColumns: "repeat(auto-fit,minmax(158px,1fr))",
        borderBottom: "1px solid var(--rule)",
      }}
    >
      {children}
    </div>
  );
}
