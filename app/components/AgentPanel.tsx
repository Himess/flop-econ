"use client";

import { useEffect, useMemo } from "react";
import {
  closePaths,
  disputeCost,
  overReservation,
  reservationSlots,
  tariff,
  tariffUnits,
  topUp,
  type TariffInputs,
} from "@/model/agent";
import { isBlocked, type AssumptionRef } from "@/model/types";
import { auto, pct } from "../lib/format";
import { ANCHORS, href } from "../lib/docs";
import type { Scenario } from "../lib/state";
import { Answers, Block, Drawer, Field, Headline, Inputs, Line, Mark } from "./Marks";

/**
 * The table's column is "you recover", so cooperative settle is a truthful 0 — and it sits three
 * inches under a headline saying you lost 150 FLOP to over-reservation. Both are right and read as
 * a contradiction side by side, so the row says which side of the trade it is reporting.
 */
const PATH_NOTES: Record<string, string> = {
  cooperative_settle: "the tariff is paid and the remainder is not returned",
};

export function AgentPanel({
  s,
  set,
  onAssumptions,
}: {
  s: Scenario;
  set: (patch: Partial<Scenario>) => void;
  onAssumptions: (a: AssumptionRef[]) => void;
}) {
  const inputs: TariffInputs = useMemo(
    () => ({
      escrow: s.escrow ?? 0,
      turns: s.turns ?? 0,
      gnClaimed: s.gn ?? 0,
      ...(s.unitToFlop === undefined ? {} : { unitToFlop: s.unitToFlop }),
    }),
    [s],
  );

  const units = useMemo(() => tariffUnits(inputs), [inputs]);
  const P = useMemo(() => tariff(inputs), [inputs]);
  const paths = useMemo(() => closePaths(inputs), [inputs]);
  const over = useMemo(() => overReservation(inputs), [inputs]);
  const up = useMemo(() => topUp(inputs), [inputs]);
  const slots = useMemo(() => reservationSlots(s.escrow ?? 0), [s.escrow]);
  const dispute = useMemo(() => disputeCost(), []);

  useEffect(() => {
    onAssumptions(isBlocked(P) ? [] : [...P.assumptions]);
  }, [P, onAssumptions]);

  const share = !isBlocked(over.unused) && s.escrow ? over.unused.value / s.escrow : undefined;

  return (
    <div>
      <Inputs>
        <Field
          id="a-esc"
          label="Escrow reserved"
          suffix="FLOP"
          value={s.escrow === undefined ? "" : String(s.escrow)}
          onChange={(v) => set({ escrow: v === "" ? undefined : Number(v) })}
        />
        <Field
          id="a-turns"
          label="Turns delivered"
          value={s.turns === undefined ? "" : String(s.turns)}
          onChange={(v) => set({ turns: v === "" ? undefined : Number(v) })}
        />
        <Field
          id="a-gn"
          label="G_n claimed"
          value={s.gn === undefined ? "" : String(s.gn)}
          onChange={(v) => set({ gn: v === "" ? undefined : Number(v) })}
        />
        <Field
          id="a-u2f"
          label="FLOP per pay unit"
          assumed
          value={s.unitToFlop === undefined ? "" : String(s.unitToFlop)}
          onChange={(v) => set({ unitToFlop: v === "" ? undefined : Number(v) })}
        />
      </Inputs>

      {/* ------------------------------------------------------------------ the answer */}
      <div className="mt-11">
        <Answers>
        <Headline
          label="Lost to over-reservation"
          result={over.lostIfCooperative}
          docs={ANCHORS.overReservation}
          suffix="FLOP"
        />
        <Headline label="Tariff earned by the miner" result={P} docs={ANCHORS.tariff} suffix="FLOP" />
        <Headline
          label="Burned on an ambiguous close"
          result={over.burnedIfAmbiguous}
          docs={ANCHORS.closePaths}
          suffix="FLOP"
        />
        </Answers>
      </div>

      <p className="mt-5 max-w-[74ch] text-[13px]" style={{ color: "var(--ink-2)" }}>
        {share === undefined ? (
          "Supply a FLOP-per-pay-unit conversion to compare the tariff against your escrow."
        ) : (
          <>
            Cooperative settle pays the reservation in full — that is{" "}
            <strong style={{ color: "var(--absent)" }}>{pct(share)}</strong> of it returned to
            nobody, with no completion SLA to appeal to.{" "}
            <a
              href={href(ANCHORS.overReservation)}
              className="underline decoration-dotted underline-offset-2"
              style={{ color: "var(--ink-3)" }}
            >
              Why
            </a>
          </>
        )}
      </p>

      {/* ------------------------------------------------------------------ the table */}
      <Block title="Close-path outcomes" note="Which path resolves decides what you recover.">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Path", "You recover", "Reference"].map((h, i) => (
                  <th
                    key={h}
                    className="pb-2 pr-3 text-left text-[11.5px] font-medium uppercase tracking-wide"
                    style={{
                      color: "var(--ink-3)",
                      borderBottom: "1px solid var(--rule)",
                      width: i === 0 ? "38%" : i === 2 ? "26%" : undefined,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paths.map((p) => (
                <tr key={p.path}>
                  <td
                    className="py-2.5 pr-3 align-top text-[13px]"
                    style={{
                      borderBottom: "1px solid var(--rule)",
                      color: p.path === "cooperative_settle" ? "var(--ink)" : "var(--ink-2)",
                    }}
                  >
                    {p.label}
                    {PATH_NOTES[p.path] ? (
                      <span className="mt-0.5 block text-[11.5px]" style={{ color: "var(--ink-3)" }}>
                        {PATH_NOTES[p.path]}
                      </span>
                    ) : null}
                  </td>
                  <td
                    className="py-2.5 pr-3 align-top text-[13px]"
                    style={{ borderBottom: "1px solid var(--rule)", fontFamily: "var(--font-mono)" }}
                  >
                    {isBlocked(p.agentRecovers) ? (
                      <span style={{ color: "var(--absent)", fontFamily: "var(--font-sans)" }}>
                        not specified
                      </span>
                    ) : (
                      auto(p.agentRecovers.value)
                    )}
                  </td>
                  <td className="py-2.5 align-top" style={{ borderBottom: "1px solid var(--rule)" }}>
                    <Mark
                      bucket={isBlocked(p.agentRecovers) ? "ABSENT" : p.agentRecovers.bucket}
                      label={p.cites[0] ?? "spec"}
                      docs={ANCHORS.closePaths}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Block>

      {/* ------------------------------------------------------------------ diagnostics */}
      <Drawer summary="Tariff, reservations and disputes">
        <Line label="Tariff in channel pay units" result={units} docs={ANCHORS.tariff} mark="R12.1d" />
        <Line label="Unused remainder" result={over.unused} docs={ANCHORS.overReservation} mark="R12.1a" suffix="FLOP" />
        <Line label="Top-up needed if under-reserved" result={up.required} docs={ANCHORS.overReservation} mark="R12.1e" suffix="FLOP" />
        <Line label="Concurrent reservations" result={slots} docs={ANCHORS.reservations} mark="R12.2" />
        <Line label="Challenger bond" result={dispute.bond} docs={ANCHORS.dispute} mark="§12.1" suffix="FLOP" />
        <Line label="Bond lost if the dispute fails" result={dispute.lossIfFails} docs={ANCHORS.dispute} mark="assumed" suffix="FLOP" />
      </Drawer>

      <Block title="Where this comes from">
        <p className="text-[12.5px]" style={{ color: "var(--ink-3)" }}>
          Agents earn nothing from the protocol today — the 10% agent leg is minted but undistributed.{" "}
          <a href={href(ANCHORS.findings)} className="underline decoration-dotted underline-offset-2">
            Findings
          </a>{" "}
          ·{" "}
          <a href={href(ANCHORS.limits)} className="underline decoration-dotted underline-offset-2">
            Limits
          </a>
        </p>
      </Block>
    </div>
  );
}
