"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DISAGREEMENTS, META, PARAMS, PARAMS_SHA256 } from "@/model/params.generated";
import type { AssumptionRef } from "@/model/types";
import { ValidatorPanel } from "./components/ValidatorPanel";
import { AgentPanel } from "./components/AgentPanel";
import { Mark } from "./components/Marks";
import {
  cleared,
  clearSaved,
  EXAMPLE,
  isExample,
  load,
  save,
  toQuery,
  type Scenario,
} from "./lib/state";

const REPO = "https://github.com/Himess/flop-econ";
type Tab = "validator" | "agent";

export default function Page() {
  const [s, setScenario] = useState<Scenario>(EXAMPLE);
  const [tab, setTab] = useState<Tab>("validator");
  const [assumptions, setAssumptions] = useState<AssumptionRef[]>([]);
  const [source, setSource] = useState<"url" | "saved" | "example">("example");
  const [copied, setCopied] = useState(false);
  /**
   * Whether the user has changed anything yet. The tool writes its own query string, so without
   * this a plain reload would read that back and report "loaded from a shared link" when nobody
   * shared anything. Nothing is written to the URL or to storage until an actual edit.
   */
  const touched = useRef(false);

  // Read URL first, then storage, then the worked example. Done in an effect so the server
  // render and the first client render agree.
  useEffect(() => {
    const { scenario, source: src } = load();
    setScenario(scenario);
    setSource(src);
  }, []);

  // Keep the address bar in step so any state is shareable, and persist for the next visit —
  // but only once the user has actually edited something (see `touched`).
  useEffect(() => {
    if (typeof window === "undefined" || !touched.current) return;
    window.history.replaceState(null, "", `?${toQuery(s)}`);
    save(s);
  }, [s]);

  const set = useCallback((patch: Partial<Scenario>) => {
    touched.current = true;
    setScenario((prev) => ({ ...prev, ...patch }));
    setSource("saved");
  }, []);

  const onAssumptions = useCallback((a: AssumptionRef[]) => setAssumptions(a), []);

  const showingExample = source !== "url" && !touched.current && isExample(s);
  const planned = PARAMS.filter((p) => p.bucket === "PLANNED");
  const absent = PARAMS.filter((p) => p.bucket === "ABSENT");

  const copyLink = async () => {
    try {
      // Ensure the address bar holds the current scenario even if nothing was edited.
      window.history.replaceState(null, "", `?${toQuery(s)}`);
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
    } catch {
      /* clipboard blocked; the address bar already holds the state */
    }
  };

  return (
    <div className="mx-auto max-w-[1180px] px-7">
      <header className="flex flex-wrap items-center justify-between gap-6 pt-[18px]">
        <div className="text-[14px]" style={{ fontFamily: "var(--font-mono)" }}>
          flop<span style={{ color: "var(--defined)" }}>-</span>econ
        </div>
        <div className="flex items-center gap-4">
          <a
            href={REPO}
            className="text-[11.5px] underline decoration-dotted underline-offset-[3px]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--ink-3)" }}
          >
            params.yaml + model + tests ↗
          </a>
          <span className="text-[11.5px]" style={{ fontFamily: "var(--font-mono)", color: "var(--ink-3)" }}>
            yellow paper draft · params fetched {String(META.fetched)}
          </span>
        </div>
      </header>

      <nav
        className="no-print mt-4 flex gap-0.5"
        style={{ borderBottom: "1px solid var(--rule)" }}
        role="tablist"
        aria-label="Role"
      >
        {(
          [
            ["validator", "Validator"],
            ["agent", "Agent"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className="cursor-pointer px-4 pb-2.5 pt-2 text-[14px]"
            style={{
              background: "none",
              border: 0,
              borderBottom: `2px solid ${tab === id ? "var(--defined)" : "transparent"}`,
              color: tab === id ? "var(--ink)" : "var(--ink-3)",
            }}
          >
            {label}
          </button>
        ))}
        <a
          href="https://flop.finance/intro/revenue/"
          className="ml-auto px-4 pb-2.5 pt-2 text-[13px] no-underline"
          style={{ color: "var(--ink-3)" }}
        >
          Miner — FLOP&rsquo;s own model ↗
        </a>
      </nav>

      {/* Example banner: one line, one control. Nobody meets a dead page. */}
      <div className="no-print mt-3 flex flex-wrap items-center gap-3">
        {showingExample ? (
          <p className="text-[12.5px]" style={{ color: "var(--ink-3)" }}>
            Showing an example scenario. The cost and price figures are illustrative, not
            specification values — they are marked as assumptions wherever they appear.
          </p>
        ) : (
          <p className="text-[12.5px]" style={{ color: "var(--ink-3)" }}>
            {source === "url" ? "Loaded from a shared link." : "Your figures."}
          </p>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={copyLink}
            className="cursor-pointer rounded-[3px] px-2.5 py-1 text-[12px]"
            style={{ background: "var(--panel)", border: "1px solid var(--rule)", color: "var(--ink-2)" }}
          >
            {copied ? "Link copied" : "Copy link"}
          </button>
          <button
            onClick={() => window.print()}
            className="cursor-pointer rounded-[3px] px-2.5 py-1 text-[12px]"
            style={{ background: "var(--panel)", border: "1px solid var(--rule)", color: "var(--ink-2)" }}
          >
            Export PDF
          </button>
          <button
            onClick={() => {
              touched.current = true;
              setScenario(cleared());
              clearSaved();
              setSource("saved");
            }}
            className="cursor-pointer rounded-[3px] px-2.5 py-1 text-[12px]"
            style={{ background: "none", border: "1px solid var(--rule)", color: "var(--ink-3)" }}
          >
            Clear all
          </button>
        </div>
      </div>

      <div className="mt-7 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_268px]">
        <main>
          {tab === "validator" ? (
            <ValidatorPanel s={s} set={set} onAssumptions={onAssumptions} />
          ) : (
            <AgentPanel s={s} set={set} onAssumptions={onAssumptions} />
          )}

          <section className="py-[30px]">
            <h2 className="text-[16px] font-medium">
              Where the published pages and the specification disagree
            </h2>
            <p className="mb-5 mt-1 max-w-[62ch] text-[13.5px]" style={{ color: "var(--ink-3)" }}>
              {DISAGREEMENTS.length} of them, recorded with their own wording. None are errors —
              they are places the product pages lead a draft, and each one changes what a model
              should compute.
            </p>
            {DISAGREEMENTS.map((d) => (
              <div key={d.id} className="py-3" style={{ borderBottom: "1px solid var(--rule)" }}>
                <div className="mb-1 text-[14px]">{d.id.replace(/_/g, " ")}</div>
                <p className="max-w-[74ch] text-[13px]" style={{ color: "var(--ink-2)" }}>
                  <span style={{ color: "var(--ink-3)" }}>Specification: </span>
                  {d.spec_says}
                </p>
                <p className="max-w-[74ch] text-[13px]" style={{ color: "var(--ink-2)" }}>
                  <span style={{ color: "var(--ink-3)" }}>Downstream: </span>
                  {d.downstream_says}
                </p>
                <p className="mt-1 max-w-[74ch] text-[12.5px]" style={{ color: "var(--ink-3)" }}>
                  {d.status}
                  {d.tracking ? ` · ${d.tracking}` : ""} — {d.handling}
                </p>
              </div>
            ))}
          </section>

          <p className="max-w-[74ch] pt-2 text-[12.5px] leading-[1.7]" style={{ color: "var(--ink-3)" }}>
            The yellow paper is a draft on roughly a weekly cadence; this inventory is current as of
            the fetch date above ({String(META.spec_status)}, page updated{" "}
            {String(META.spec_page_updated)}, decision record {String(META.spec_decision_record)},
            params sha256:{PARAMS_SHA256}). Per §0, nothing here is a claim about running code — the
            specification describes the protocol FLOP targets, not a snapshot of the codebase.
            Session price, token price and network demand are your inputs; this tool has no view on
            them. Not financial advice, not a forecast.
          </p>
          <p className="mt-3 max-w-[74ch] text-[12.5px] leading-[1.7]" style={{ color: "var(--ink-3)" }}>
            The repository holds{" "}
            <a href={REPO} className="underline decoration-dotted underline-offset-[3px]">
              the parameter set with its provenance, the model layer, and the tests
            </a>{" "}
            — {PARAMS.length} parameters, each with a bucket and a citation, generated into a typed
            module whose checksum is pinned by a test so it cannot drift from the YAML.
          </p>
        </main>

        {/* Persistent assumption ledger. Below the results on narrow screens, never above. */}
        <aside className="ledger text-[13px] lg:sticky lg:top-6">
          <h3
            className="mb-3 pb-2.5 text-[13px] font-medium"
            style={{ color: "var(--ink-2)", borderBottom: "1px solid var(--rule)" }}
          >
            Assumptions in play
          </h3>

          {assumptions.length === 0 ? (
            <p className="py-2 text-[12.5px]" style={{ color: "var(--ink-3)" }}>
              Nothing supplied yet. Figures that need one are blocked rather than defaulted.
            </p>
          ) : (
            assumptions.map((a, i) => (
              <div
                key={`${a.key}-${i}`}
                className="py-2.5"
                style={{ borderBottom: "1px solid var(--rule)" }}
              >
                <div
                  className="break-all text-[11.5px]"
                  style={{ fontFamily: "var(--font-mono)", color: "var(--ink)" }}
                >
                  {a.key}
                </div>
                <div
                  className="mt-0.5 text-[10.5px]"
                  style={{ fontFamily: "var(--font-mono)", color: "var(--ink-3)" }}
                >
                  {a.cite.split(";")[0]} · {a.value.toLocaleString("en-US")} {a.unit}
                </div>
              </div>
            ))
          )}

          <details className="mt-5">
            <summary
              className="cursor-pointer text-[12.5px]"
              style={{ color: "var(--ink-2)" }}
            >
              Open items behind this tool ({planned.length + absent.length})
            </summary>
            <div className="mt-2">
              {[...planned, ...absent].map((p) => (
                <div key={p.key} className="py-2" style={{ borderBottom: "1px solid var(--rule)" }}>
                  <div
                    className="break-all text-[11px]"
                    style={{ fontFamily: "var(--font-mono)", color: "var(--ink-2)" }}
                  >
                    {p.key}
                    <Mark bucket={p.bucket} />
                  </div>
                  <div
                    className="mt-0.5 text-[10.5px]"
                    style={{ fontFamily: "var(--font-mono)", color: "var(--ink-3)" }}
                  >
                    {p.cite.split(";")[0]}
                  </div>
                </div>
              ))}
            </div>
          </details>

          <p className="mt-4 text-[12px] leading-[1.6]" style={{ color: "var(--ink-3)" }}>
            Every figure carries its provenance. Solid marks are ratified parameters, dashed are
            deferred, dotted are yours.
          </p>
        </aside>
      </div>
    </div>
  );
}
