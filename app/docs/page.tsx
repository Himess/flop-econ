import type { Metadata } from "next";
import { DISAGREEMENTS, META, PARAMS_SHA256 } from "@/model/params.generated";
import {
  ANCHORS,
  CALCS,
  FINDINGS,
  LIMITS,
  paramAnchor,
  paramRows,
  type CalcEntry,
} from "../lib/docs";

export const metadata: Metadata = {
  title: "How this is calculated — flop-econ",
  description:
    "Every formula behind the FLOP validator and agent calculators, the full parameter set with buckets and citations, where the published pages disagree with the specification, and the four findings this work established.",
};

const ROLE_LABEL: Record<CalcEntry["role"], string> = {
  validator: "validator",
  agent: "agent",
  shared: "shared",
};

const BUCKET_CLS: Record<string, string> = {
  DEFINED: "b-def",
  PLANNED: "b-plan",
  ABSENT: "b-abs",
};

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="mt-16 scroll-mt-6 pb-2 text-[19px] font-medium"
      style={{ borderBottom: "1px solid var(--rule)" }}
    >
      {children}
    </h2>
  );
}

export default function DocsPage() {
  const params = paramRows();
  const counts = {
    DEFINED: params.filter((p) => p.bucket === "DEFINED").length,
    PLANNED: params.filter((p) => p.bucket === "PLANNED").length,
    ABSENT: params.filter((p) => p.bucket === "ABSENT").length,
  };

  return (
    <div className="mx-auto max-w-[860px] px-7 pb-24">
      <header className="flex flex-wrap items-baseline justify-between gap-4 pt-[18px]">
        <a href="/" className="text-[14px] no-underline" style={{ fontFamily: "var(--font-mono)" }}>
          flop<span style={{ color: "var(--defined)" }}>-</span>econ
        </a>
        <a
          href="/"
          className="text-[12.5px] underline decoration-dotted underline-offset-[3px]"
          style={{ color: "var(--ink-3)" }}
        >
          ← back to the calculator
        </a>
      </header>

      <h1 className="mt-10 text-[28px] font-medium leading-tight">How this is calculated</h1>
      <p className="mt-3 max-w-[70ch] text-[14.5px]" style={{ color: "var(--ink-2)" }}>
        The calculator answers; this page explains. Every provenance mark in the tool links to a
        section here. Nothing on this page is a claim about running code — the FLOP yellow paper is
        a draft, and per §0 it describes the protocol FLOP targets rather than a snapshot of the
        codebase.
      </p>
      <p className="mt-2 text-[12px]" style={{ fontFamily: "var(--font-mono)", color: "var(--ink-3)" }}>
        spec fetched {String(META.fetched)} · {String(META.spec_status)} · decision record{" "}
        {String(META.spec_decision_record)} · params sha256:{PARAMS_SHA256}
      </p>

      <nav className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[13px]">
        {[
          [ANCHORS.findings, "Findings"],
          ["calculations", "How each figure is calculated"],
          [ANCHORS.params, "The parameter set"],
          [ANCHORS.disagreements, "Disagreements"],
          [ANCHORS.limits, "Limits"],
        ].map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="underline decoration-dotted underline-offset-[3px]"
            style={{ color: "var(--ink-2)" }}
          >
            {label}
          </a>
        ))}
      </nav>

      {/* ------------------------------------------------------------------ findings */}
      <H2 id={ANCHORS.findings}>Findings</H2>
      <p className="mt-3 max-w-[70ch] text-[14px]" style={{ color: "var(--ink-2)" }}>
        {FINDINGS.length} things this work established that are not stated in the specification or
        on FLOP&rsquo;s published pages. Each is checkable against the citations given; each is
        pinned by a test in the repository.
      </p>
      {FINDINGS.map((f, i) => (
        <article key={f.id} id={f.id} className="mt-10 scroll-mt-6">
          <div className="text-[11.5px]" style={{ fontFamily: "var(--font-mono)", color: "var(--ink-3)" }}>
            finding {i + 1} of {FINDINGS.length}
          </div>
          <h3 className="mt-1 text-[17px] font-medium leading-snug">{f.title}</h3>
          <p
            className="mt-3 max-w-[70ch] px-4 py-3 text-[14px]"
            style={{ background: "var(--panel)", borderLeft: "2px solid var(--defined)", color: "var(--ink)" }}
          >
            {f.claim}
          </p>
          {f.body.map((para, j) => (
            <p key={j} className="mt-3 max-w-[70ch] text-[14px]" style={{ color: "var(--ink-2)" }}>
              {para}
            </p>
          ))}
          <p className="mt-3 text-[11.5px]" style={{ fontFamily: "var(--font-mono)", color: "var(--ink-3)" }}>
            {f.cites}
          </p>
        </article>
      ))}

      {/* ------------------------------------------------------------------ calculations */}
      <H2 id="calculations">How each figure is calculated</H2>
      <p className="mt-3 max-w-[70ch] text-[14px]" style={{ color: "var(--ink-2)" }}>
        Every figure the tool prints, with its formula, which inputs come from the specification and
        which are yours.
      </p>
      {CALCS.map((c) => (
        <article key={c.id} id={c.id} className="mt-9 scroll-mt-6">
          <div className="flex flex-wrap items-baseline gap-2">
            <h3 className="text-[15.5px] font-medium">{c.title}</h3>
            <span
              className="text-[11px]"
              style={{ fontFamily: "var(--font-mono)", color: "var(--ink-3)" }}
            >
              {ROLE_LABEL[c.role]}
            </span>
          </div>
          {c.formula ? (
            <pre
              className="mt-2 max-w-full overflow-x-auto px-4 py-3 text-[12.5px] leading-relaxed"
              style={{
                background: "var(--panel)",
                border: "1px solid var(--rule)",
                borderRadius: "3px",
                fontFamily: "var(--font-mono)",
                color: "var(--ink)",
              }}
            >
              {c.formula}
            </pre>
          ) : null}
          <p className="mt-2 max-w-[70ch] text-[14px]" style={{ color: "var(--ink-2)" }}>
            {c.body}
          </p>
          <p className="mt-1.5 text-[11.5px]" style={{ fontFamily: "var(--font-mono)", color: "var(--ink-3)" }}>
            {c.cites}
          </p>
        </article>
      ))}

      {/* ------------------------------------------------------------------ parameters */}
      <H2 id={ANCHORS.params}>The parameter set</H2>
      <p className="mt-3 max-w-[70ch] text-[14px]" style={{ color: "var(--ink-2)" }}>
        All {params.length} parameters, rendered from <code>params.yaml</code> — {counts.DEFINED}{" "}
        defined, {counts.PLANNED} planned, {counts.ABSENT} absent. A parameter marked absent carries
        no value at all, only the open item that blocks it; that is the rule the whole tool rests on.
        The yellow paper states its own precedence: concrete figures appearing inline are worked
        examples, and the value of record is always Appendix A.
      </p>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              {["Parameter", "Value", "Bucket", "Citation"].map((h) => (
                <th
                  key={h}
                  className="pb-2 pr-3 text-left text-[11px] font-medium uppercase tracking-wide"
                  style={{ color: "var(--ink-3)", borderBottom: "1px solid var(--rule)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {params.map((p) => (
              <tr key={p.key} id={paramAnchor(p.key)} className="scroll-mt-6 align-top">
                <td
                  className="py-2 pr-3"
                  style={{ borderBottom: "1px solid var(--rule)", fontFamily: "var(--font-mono)", color: "var(--ink)" }}
                >
                  {p.key}
                </td>
                <td
                  className="py-2 pr-3 whitespace-nowrap"
                  style={{ borderBottom: "1px solid var(--rule)", fontFamily: "var(--font-mono)", color: "var(--ink-2)" }}
                >
                  {p.value === undefined ? "—" : String(p.value)}
                  {p.unit && p.value !== undefined ? (
                    <span style={{ color: "var(--ink-3)" }}> {p.unit}</span>
                  ) : null}
                </td>
                <td className="py-2 pr-3" style={{ borderBottom: "1px solid var(--rule)" }}>
                  <span className={`b ${BUCKET_CLS[p.bucket]}`}>{p.bucket.toLowerCase()}</span>
                </td>
                <td
                  className="py-2"
                  style={{ borderBottom: "1px solid var(--rule)", fontFamily: "var(--font-mono)", color: "var(--ink-3)", fontSize: "11px" }}
                >
                  {p.cite}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ------------------------------------------------------------------ disagreements */}
      <H2 id={ANCHORS.disagreements}>Where the published pages and the specification disagree</H2>
      <p className="mt-3 max-w-[70ch] text-[14px]" style={{ color: "var(--ink-2)" }}>
        {DISAGREEMENTS.length} of them. None are errors — they are places FLOP&rsquo;s own product
        pages lead a draft specification, and each one changes what a model should compute.
      </p>
      {DISAGREEMENTS.map((d) => (
        <article key={d.id} id={`d-${d.id}`} className="mt-7 scroll-mt-6">
          <h3 className="text-[15px] font-medium">{d.id.replace(/_/g, " ")}</h3>
          <dl className="mt-2 max-w-[70ch] text-[14px]">
            <dt className="text-[12px]" style={{ color: "var(--ink-3)" }}>
              Specification
            </dt>
            <dd className="mt-0.5" style={{ color: "var(--ink-2)" }}>
              {d.spec_says}
            </dd>
            <dt className="mt-2 text-[12px]" style={{ color: "var(--ink-3)" }}>
              Downstream
            </dt>
            <dd className="mt-0.5" style={{ color: "var(--ink-2)" }}>
              {d.downstream_says}
            </dd>
            <dt className="mt-2 text-[12px]" style={{ color: "var(--ink-3)" }}>
              How the tool handles it
            </dt>
            <dd className="mt-0.5" style={{ color: "var(--ink-2)" }}>
              {d.handling}
            </dd>
          </dl>
          {d.quote ? (
            <blockquote
              className="mt-3 max-w-[70ch] px-4 py-2.5 text-[13px] italic"
              style={{ background: "var(--panel)", borderLeft: "2px solid var(--planned)", color: "var(--ink-2)" }}
            >
              {d.quote}
            </blockquote>
          ) : null}
          <p className="mt-2 text-[11.5px]" style={{ fontFamily: "var(--font-mono)", color: "var(--ink-3)" }}>
            {d.status}
            {d.tracking ? ` · ${d.tracking}` : ""}
          </p>
        </article>
      ))}

      {/* ------------------------------------------------------------------ limits */}
      <H2 id={ANCHORS.limits}>Limits</H2>
      <p className="mt-3 max-w-[70ch] text-[14px]" style={{ color: "var(--ink-2)" }}>
        What this tool does not model, and why each was left out rather than approximated.
      </p>
      {LIMITS.map((l) => (
        <article key={l.title} className="mt-6">
          <h3 className="text-[14.5px] font-medium">{l.title}</h3>
          <p className="mt-1 max-w-[70ch] text-[14px]" style={{ color: "var(--ink-2)" }}>
            {l.body}
          </p>
        </article>
      ))}

      <footer
        className="mt-16 pt-5 text-[12.5px] leading-relaxed"
        style={{ borderTop: "1px solid var(--rule)", color: "var(--ink-3)" }}
      >
        <p className="max-w-[70ch]">
          This inventory is built against the initial public release, fetched {String(META.fetched)}. Session price, token price and network demand are your inputs — the
          specification has no view on them and neither does this. Not financial advice, not a
          forecast.
        </p>
        <p className="mt-3">
          <a href="/" className="underline decoration-dotted underline-offset-[3px]">
            ← back to the calculator
          </a>
        </p>
      </footer>
    </div>
  );
}
