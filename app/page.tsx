"use client";

import { useCallback, useState } from "react";
import { DISAGREEMENTS, META, PARAMS, PARAMS_SHA256 } from "@/model/params.generated";
import type { AssumptionRef } from "@/model/types";
import { ValidatorTab } from "./components/ValidatorTab";
import { AgentTab } from "./components/AgentTab";
import { BucketBadge } from "./components/Provenance";

type Tab = "validator" | "agent";

export default function Page() {
  const [tab, setTab] = useState<Tab>("validator");
  const [assumptions, setAssumptions] = useState<AssumptionRef[]>([]);

  const onValidator = useCallback((a: AssumptionRef[]) => setAssumptions(a), []);
  const onAgent = useCallback((a: AssumptionRef[]) => setAssumptions(a), []);

  const planned = PARAMS.filter((p) => p.bucket === "PLANNED");
  const absent = PARAMS.filter((p) => p.bucket === "ABSENT");

  return (
    <main className="mx-auto max-w-[1400px] px-5 py-6">
      <header>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-lg font-semibold tracking-tight">
            FLOP validator &amp; agent economics
          </h1>
          <div className="no-print flex items-center gap-3 text-xs">
            <a
              className="text-neutral-600 underline decoration-neutral-300 underline-offset-2 hover:text-neutral-900"
              href="https://flop.finance/intro/revenue/"
              target="_blank"
              rel="noreferrer"
            >
              Miner economics → FLOP&apos;s own calculator
            </a>
            <button
              onClick={() => window.print()}
              className="rounded border border-neutral-300 bg-white px-2 py-1 hover:bg-neutral-50"
            >
              Export PDF
            </button>
          </div>
        </div>

        {/* Pinned banner — required, and it appears in the export. */}
        <div className="mt-3 rounded border border-neutral-300 bg-neutral-100 px-3 py-2 text-[11px] leading-snug text-neutral-700">
          The FLOP yellow paper is a <strong>Draft</strong> on roughly a weekly cadence. This
          inventory is current as of <strong>{String(META.fetched)}</strong> (
          {String(META.spec_status)}, page updated {String(META.spec_page_updated)}, decision record{" "}
          {String(META.spec_decision_record)}; params sha256:{PARAMS_SHA256}). Per §0,{" "}
          <strong>nothing here is a claim about running code</strong> — the spec &ldquo;describes the
          protocol FLOP targets, not a snapshot of the codebase&rdquo;. Session price, FLOP price and
          network demand are your inputs; the spec has no view on them and neither does this tool.
        </div>
      </header>

      <nav className="no-print mt-5 flex gap-1 border-b border-neutral-300">
        {(
          [
            ["validator", "Validator break-even"],
            ["agent", "Agent escrow risk"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-3 py-1.5 text-sm ${
              tab === id
                ? "border-neutral-900 font-medium text-neutral-900"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="mt-5">
        {tab === "validator" ? (
          <ValidatorTab onAssumptions={onValidator} />
        ) : (
          <AgentTab onAssumptions={onAgent} />
        )}
      </div>

      {/* ------------------------------------------------------- assumptions drawer */}
      <div className="page-break mt-10">
        <details open className="rounded border border-neutral-300 bg-white">
          <summary className="cursor-pointer select-none border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-semibold">
            Assumptions and open items in this result
          </summary>
          <div className="space-y-5 p-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Inputs you supplied that the spec does not define
              </h3>
              {assumptions.length === 0 ? (
                <p className="mt-1 text-xs text-neutral-600">
                  None supplied yet. Figures depending on them are blocked rather than defaulted.
                </p>
              ) : (
                <ul className="mt-1.5 space-y-1.5">
                  {assumptions.map((a, i) => (
                    <li key={`${a.key}-${i}`} className="text-xs">
                      <span className="font-medium">{a.label}</span>{" "}
                      <span className="font-mono tabular-nums">
                        = {a.value.toLocaleString("en-US")} {a.unit}
                      </span>
                      <span className="ml-2 font-mono text-[10px] text-rose-700">{a.cite}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                PLANNED values in play ({planned.length})
              </h3>
              <ul className="mt-1.5 space-y-1">
                {planned.map((p) => (
                  <li key={p.key} className="text-xs">
                    <BucketBadge bucket="PLANNED" />{" "}
                    <span className="font-mono">{p.key}</span>
                    {p.value !== undefined ? (
                      <span className="font-mono tabular-nums"> = {String(p.value)}</span>
                    ) : null}
                    <span className="ml-2 font-mono text-[10px] text-neutral-500">{p.cite}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                ABSENT parameters ({absent.length}) — the spec has no value for these
              </h3>
              <ul className="mt-1.5 space-y-1">
                {absent.map((p) => (
                  <li key={p.key} className="text-xs">
                    <BucketBadge bucket="ABSENT" /> <span className="font-mono">{p.key}</span>
                    <span className="ml-2 font-mono text-[10px] text-rose-700">{p.cite}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Where FLOP&apos;s published pages lead or contradict the spec ({DISAGREEMENTS.length})
              </h3>
              <ul className="mt-1.5 space-y-2.5">
                {DISAGREEMENTS.map((d) => (
                  <li key={d.id} className="text-xs">
                    <div className="font-medium">{d.id}</div>
                    <div className="mt-0.5 text-neutral-700">
                      <span className="text-neutral-500">spec:</span> {d.spec_says}
                    </div>
                    <div className="text-neutral-700">
                      <span className="text-neutral-500">downstream:</span> {d.downstream_says}
                    </div>
                    <div className="mt-0.5 text-neutral-600">
                      {d.status}
                      {d.tracking ? ` · ${d.tracking}` : ""}
                    </div>
                    <div className="mt-0.5 italic text-neutral-600">{d.handling}</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </details>
      </div>

      <footer className="mt-8 border-t border-neutral-200 pt-3 text-[11px] leading-snug text-neutral-500">
        <p>
          {PARAMS.length} parameters, each carrying a bucket and a citation into the yellow paper.
          Source of record is Appendix A, which the spec states is generated from
          params/flop-protocol-params.yaml and gated by scripts/check_params.py: &ldquo;Concrete
          figures appearing inline are worked examples; the value of record is always Appendix
          A.&rdquo;
        </p>
        <p className="mt-1">
          Not financial advice. Not a forecast. An ABSENT parameter is never filled with a plausible
          number — where the spec has no value, this tool refuses to compute until you supply one,
          and records that you did.
        </p>
      </footer>
    </main>
  );
}
