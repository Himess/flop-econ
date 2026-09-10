"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AssumptionRef } from "@/model/types";
import { ValidatorPanel } from "./components/ValidatorPanel";
import { AgentPanel } from "./components/AgentPanel";
import { ANCHORS, DOCS_PATH } from "./lib/docs";
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
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [source, setSource] = useState<"url" | "saved" | "example">("example");
  const [copied, setCopied] = useState(false);
  const touched = useRef(false);

  useEffect(() => {
    const { scenario, source: src } = load();
    setScenario(scenario);
    setSource(src);
  }, []);

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

  const copyLink = async () => {
    try {
      window.history.replaceState(null, "", `?${toQuery(s)}`);
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
    } catch {
      /* clipboard blocked; the address bar already holds the state */
    }
  };

  const btn = {
    background: "var(--panel)",
    border: "1px solid var(--rule)",
    color: "var(--ink-2)",
  } as const;
  const btnCls =
    "cursor-pointer rounded-[4px] px-3 py-1.5 text-[12px] transition-colors hover:brightness-125";

  return (
    <div className="mx-auto max-w-[1060px] px-7 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-4 pt-5">
        <div className="flex items-baseline gap-3">
          <span className="text-[14px]" style={{ fontFamily: "var(--font-mono)" }}>
            flop<span style={{ color: "var(--defined)" }}>-</span>econ
          </span>
          <span className="text-[12px]" style={{ color: "var(--ink-3)" }}>
            validator &amp; agent economics
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-[12.5px]">
          <a
            href={DOCS_PATH}
            className="underline decoration-dotted underline-offset-[3px]"
            style={{ color: "var(--ink-2)" }}
          >
            How this is calculated
          </a>
          <a
            href={REPO}
            className="underline decoration-dotted underline-offset-[3px]"
            style={{ color: "var(--ink-3)" }}
          >
            Repository
          </a>
        </div>
      </header>

      <nav
        className="mt-6 flex flex-wrap items-center gap-0.5"
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
          className="ml-auto px-3 pb-2.5 pt-2 text-[12.5px] no-underline"
          style={{ color: "var(--ink-3)" }}
        >
          Miner — FLOP&rsquo;s own model ↗
        </a>
      </nav>

      {/* one line of status, the assumption chip, two controls */}
      <div className="mb-3 mt-5 flex flex-wrap items-center gap-2.5">
        <p className="text-[12px]" style={{ color: "var(--ink-3)" }}>
          {showingExample
            ? "Example figures — replace them with yours."
            : source === "url"
              ? "Loaded from a shared link."
              : "Your figures."}
        </p>
        <button
          onClick={() => setShowAssumptions((v) => !v)}
          aria-expanded={showAssumptions}
          className="cursor-pointer rounded-full px-2.5 py-[3px] text-[11.5px] transition-colors"
          style={{
            background: "none",
            border: `1px dotted ${assumptions.length ? "var(--absent)" : "var(--rule)"}`,
            color: assumptions.length ? "var(--absent)" : "var(--ink-3)",
            fontFamily: "var(--font-mono)",
          }}
          title="Figures the specification does not define. Click to list them."
        >
          {assumptions.length} assumed
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button onClick={copyLink} className={btnCls} style={btn}>
            {copied ? "Copied" : "Copy link"}
          </button>
          <button
            onClick={() => {
              touched.current = true;
              setScenario(cleared());
              clearSaved();
              setSource("saved");
            }}
            className={btnCls}
            style={{ background: "none", border: "1px solid var(--rule)", color: "var(--ink-3)" }}
          >
            Clear
          </button>
        </div>
      </div>

      {showAssumptions ? (
        <div
          className="mt-3 rounded-[6px] px-4 py-3.5"
          style={{ background: "var(--panel)", border: "1px dotted var(--absent)" }}
        >
          <p className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>
            Figures the specification does not define, which you supplied.
          </p>
          <p className="mt-1 text-[11.5px]" style={{ color: "var(--ink-3)" }}>
            Your stake, the set size and the average stake are your situation rather than
            assumptions, so they are not counted here.
          </p>
          {assumptions.length === 0 ? (
            <p className="mt-2.5 text-[12px]" style={{ color: "var(--ink-3)" }}>
              None — a figure that needs one is blocked rather than defaulted.
            </p>
          ) : (
            <ul className="mt-3 grid gap-x-10 gap-y-0 sm:grid-cols-2">
              {assumptions.map((a, i) => (
                <li
                  key={`${a.key}-${i}`}
                  className="flex items-baseline justify-between gap-4 py-1.5 text-[12.5px]"
                  style={{ borderBottom: "1px solid var(--rule)" }}
                >
                  <span style={{ color: "var(--ink-2)" }}>{a.label}</span>
                  <span
                    className="whitespace-nowrap"
                    style={{
                      color: "var(--ink)",
                      fontFamily: "var(--font-mono)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {a.value.toLocaleString("en-US")}{" "}
                    <span style={{ color: "var(--ink-3)" }}>{a.unit}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11.5px]" style={{ color: "var(--ink-3)" }}>
            <a href={DOCS_PATH} className="underline decoration-dotted underline-offset-2">
              What each one affects
            </a>
          </p>
        </div>
      ) : null}

      <main className="mt-6">
        {tab === "validator" ? (
          <ValidatorPanel s={s} set={set} onAssumptions={onAssumptions} />
        ) : (
          <AgentPanel s={s} set={set} onAssumptions={onAssumptions} />
        )}
      </main>

      <footer
        className="mt-16 pt-4 text-[12px] leading-relaxed"
        style={{ borderTop: "1px solid var(--rule)", color: "var(--ink-3)" }}
      >
        <p className="flex flex-wrap items-center gap-x-1 gap-y-2">
          <span>A mark carries its provenance and links to the calculation:</span>
          <Mark bucket="DEFINED" label="ratified" docs={ANCHORS.params} />
          <Mark bucket="PLANNED" label="deferred" docs={ANCHORS.params} />
          <Mark bucket="ABSENT" label="yours" docs={ANCHORS.params} />
        </p>
        <p className="mt-2.5">Not financial advice, not a forecast.</p>
      </footer>
    </div>
  );
}
