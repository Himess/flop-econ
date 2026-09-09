"use client";

/**
 * The provenance primitives. Every displayed figure goes through here, so it is not possible to
 * render a number without also rendering its bucket and citation.
 */
import type { Bucket, Computed, Figure } from "@/model/types";
import { dedupe, isBlocked } from "@/model/types";

const BADGE: Record<Bucket, string> = {
  DEFINED: "bg-emerald-100 text-emerald-900 border-emerald-300",
  PLANNED: "bg-amber-100 text-amber-900 border-amber-300",
  ABSENT: "bg-rose-100 text-rose-900 border-rose-300",
};

const BADGE_TITLE: Record<Bucket, string> = {
  DEFINED: "A number or formula fixed by the spec.",
  PLANNED: "Named by the spec but deferred, unwired, or awaiting ratification.",
  ABSENT: "Not defined by the spec. This figure rests on an assumption you supplied.",
};

export function BucketBadge({ bucket }: { bucket: Bucket }) {
  return (
    <span
      title={BADGE_TITLE[bucket]}
      className={`inline-block rounded border px-1 py-px text-[10px] font-medium leading-tight tracking-wide ${BADGE[bucket]}`}
    >
      {bucket}
    </span>
  );
}

export function fmt(n: number, unit?: string): string {
  const abs = Math.abs(n);
  let s: string;
  if (!Number.isFinite(n)) s = "—";
  else if (abs >= 1e9) s = `${(n / 1e9).toFixed(2)}bn`;
  else if (abs >= 1e6) s = `${(n / 1e6).toFixed(2)}M`;
  else if (abs >= 1000) s = Math.round(n).toLocaleString("en-US");
  else if (abs >= 1) s = n.toFixed(2).replace(/\.00$/, "");
  else if (abs === 0) s = "0";
  else s = n.toPrecision(3);
  return unit ? `${s} ${unit}` : s;
}

/** A number with its bucket badge and a citation footnote. The core unit of the UI. */
export function Stat({
  label,
  result,
  hint,
  big,
}: {
  label: string;
  result: Computed;
  hint?: string;
  big?: boolean;
}) {
  if (isBlocked(result)) {
    return (
      <div className="rounded border border-rose-300 bg-rose-50 p-3">
        <div className="text-xs font-medium uppercase tracking-wide text-rose-900">{label}</div>
        <div className="mt-1 text-sm font-medium text-rose-900">Blocked</div>
        <p className="mt-1 text-xs text-rose-800">{result.message}</p>
        <p className="mt-1 font-mono text-[10px] text-rose-700">
          {result.missing.join(", ")} · {result.cites.join(" · ")}
        </p>
      </div>
    );
  }
  return (
    <div className="rounded border border-neutral-200 bg-white p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</span>
        <BucketBadge bucket={result.bucket} />
      </div>
      <div className={`mt-1 font-mono tabular-nums ${big ? "text-2xl" : "text-lg"}`}>
        {fmt(result.value)}{" "}
        <span className="text-xs font-normal text-neutral-500">{result.unit}</span>
      </div>
      {hint ? <p className="mt-1 text-xs text-neutral-600">{hint}</p> : null}
      <Cites cites={result.cites} derivation={result.derivation} />
    </div>
  );
}

/** Citation atoms, deduped. Never render a raw cites array — compound strings repeat sections. */
export function CiteList({ cites, className }: { cites: readonly string[]; className?: string }) {
  return (
    <span className={className ?? "font-mono text-[10px] leading-snug text-neutral-500"}>
      {dedupe(cites).join(" · ")}
    </span>
  );
}

export function Cites({ cites, derivation }: { cites: readonly string[]; derivation?: string }) {
  return (
    <div className="mt-1.5 border-t border-neutral-100 pt-1.5">
      <p className="font-mono text-[10px] leading-snug text-neutral-500">{dedupe(cites).join(" · ")}</p>
      {derivation ? (
        <p className="mt-1 text-[10px] leading-snug text-neutral-500">{derivation}</p>
      ) : null}
    </div>
  );
}

/** Inline value for use inside tables. */
export function Cell({ result }: { result: Computed }) {
  if (isBlocked(result)) {
    return (
      <span
        className="font-mono text-xs text-rose-700"
        title={`${result.message} (${result.cites.join(" · ")})`}
      >
        blocked
      </span>
    );
  }
  return (
    <span className="font-mono text-xs tabular-nums" title={result.derivation ?? ""}>
      {fmt(result.value)}
    </span>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  unit,
  step,
  absent,
  cite,
  hint,
}: {
  label: string;
  value: number | "";
  onChange: (v: number | "") => void;
  unit?: string;
  step?: number;
  /** Marks this as an input the spec does not define — styled to stand out. */
  absent?: boolean;
  cite?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-neutral-700">{label}</span>
        {absent ? <BucketBadge bucket="ABSENT" /> : null}
      </span>
      <span className="mt-1 flex items-center gap-1">
        <input
          type="number"
          step={step ?? "any"}
          value={value}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          className={`w-full rounded border px-2 py-1 font-mono text-sm tabular-nums outline-none focus:ring-1 ${
            absent && value === ""
              ? "border-rose-300 bg-rose-50 focus:ring-rose-400"
              : "border-neutral-300 bg-white focus:ring-neutral-400"
          }`}
        />
        {unit ? <span className="whitespace-nowrap text-xs text-neutral-500">{unit}</span> : null}
      </span>
      {hint ? <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">{hint}</p> : null}
      {cite ? <p className="mt-0.5 font-mono text-[10px] text-rose-700">{cite}</p> : null}
    </label>
  );
}

export function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
      {subtitle ? <p className="mt-0.5 max-w-3xl text-xs text-neutral-600">{subtitle}</p> : null}
      <div className="mt-2">{children}</div>
    </section>
  );
}

export type { Figure };
