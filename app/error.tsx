"use client";

/**
 * The last line of defence, and the reason it exists.
 *
 * The model throws on impossible inputs by design — a committee-seat probability outside [0,1] is
 * a bug, not a scenario, and a guard that returns a plausible number instead of throwing is how
 * wrong figures reach a screen. But an uncaught throw in a client component unmounts the whole
 * tree, and what the user sees is a blank page. That is the worst of both: the guard fires and
 * the person loses everything they typed with no idea why.
 *
 * So the throw stays, and it lands here instead of nowhere. Two recoveries, because a bad saved
 * scenario would otherwise reload straight back into the same crash: retry, and start over from
 * the worked example with storage and query cleared.
 */
import { useEffect } from "react";
import { clearSaved } from "./lib/state";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("flop-econ crashed:", error);
  }, [error]);

  return (
    <main className="mx-auto max-w-[70ch] px-5 py-20">
      <p className="text-[11.5px] uppercase tracking-wide" style={{ color: "var(--absent)" }}>
        the tool stopped
      </p>
      <h1 className="mt-3 text-[22px] font-medium" style={{ color: "var(--ink)" }}>
        Something in the scenario could not be computed.
      </h1>
      <p className="mt-4 text-[14px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
        This is a refusal that escaped rather than a wrong answer: the model checks its own
        invariants and stops instead of printing a figure it cannot stand behind. What it should
        have done is tell you which input caused it. That it did not is a bug — please report it
        with the message below.
      </p>

      <pre
        className="mt-5 overflow-x-auto rounded-[3px] p-3 text-[12px]"
        style={{
          background: "var(--panel)",
          border: "1px solid var(--rule)",
          color: "var(--ink-2)",
          fontFamily: "var(--font-mono)",
        }}
      >
        {error.message}
        {error.digest ? `\ndigest ${error.digest}` : ""}
      </pre>

      <div className="mt-7 flex flex-wrap gap-3">
        <button
          onClick={reset}
          className="rounded-[3px] px-3.5 py-2 text-[13px]"
          style={{ background: "var(--panel)", border: "1px solid var(--rule)", color: "var(--ink)" }}
        >
          Try again
        </button>
        <button
          onClick={() => {
            // A saved scenario is the likeliest culprit, and it would reload into the same crash.
            clearSaved();
            window.location.href = window.location.pathname;
          }}
          className="rounded-[3px] px-3.5 py-2 text-[13px]"
          style={{ background: "transparent", border: "1px solid var(--rule)", color: "var(--ink-2)" }}
        >
          Start over from the worked example
        </button>
      </div>

      <p className="mt-8 text-[12.5px]" style={{ color: "var(--ink-3)" }}>
        <a href="https://github.com/Himess/flop-econ/issues" style={{ color: "var(--ink-2)" }}>
          github.com/Himess/flop-econ/issues
        </a>
      </p>
    </main>
  );
}
