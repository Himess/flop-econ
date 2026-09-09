"use client";

import { useEffect, useMemo } from "react";
import {
  closePaths,
  disputeCost,
  overReservation,
  reservationSlots,
  tariff,
  tariffUnits,
  tierComparison,
  topUp,
  type TariffInputs,
} from "@/model/agent";
import { param } from "@/model/params.generated";
import { isBlocked, num, type AssumptionRef } from "@/model/types";
import { auto, dp2, int, pct } from "../lib/format";
import type { Scenario } from "../lib/state";
import { Blocked, Cites, Field, FieldRow, Mark, Note, Row, Section } from "./Marks";

const PHI = num(param("refund_penalty_phi_percent")) / 1e2;
const BOND = num(param("channel_challenger_bond"));
const SLOT_ESCROW = num(param("escrow_per_reservation_slot"));

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
  const tiers = useMemo(() => tierComparison(), []);

  // Effect, not memo — see the note in ValidatorPanel.
  useEffect(() => {
    onAssumptions(isBlocked(P) ? [] : [...P.assumptions]);
  }, [P, onAssumptions]);

  const share =
    !isBlocked(over.unused) && s.escrow ? over.unused.value / s.escrow : undefined;

  return (
    <div>
      <FieldRow>
        <Field
          id="a-esc"
          label="Escrow reserved, E"
          suffix="FLOP"
          value={s.escrow === undefined ? "" : String(s.escrow)}
          onChange={(v) => set({ escrow: v === "" ? undefined : Number(v) })}
        />
        <Field
          id="a-turns"
          label="Turns delivered, n"
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
          label="FLOP per channel pay unit"
          assumed
          cite="E.30"
          hint="Both tariff legs are denominated in channel pay units; escrow is in FLOP."
          value={s.unitToFlop === undefined ? "" : String(s.unitToFlop)}
          onChange={(v) => set({ unitToFlop: v === "" ? undefined : Number(v) })}
        />
      </FieldRow>

      <Section
        title="What the cooperative path actually costs you"
        sub="Cooperative settle pays the reserved escrow in full — for a truncated answer, with no completion SLA to appeal to. Over-reservation is a pure loss on this path, and it is the path most sessions take."
      >
        <div style={{ borderTop: "1px solid var(--rule)" }}>
          <Row
            label="Tariff in channel pay units"
            result={units}
            mark="R12.1d"
            note={
              <Note summary="why two rows">
                R12.1d gives P = BasePerTurn·n + rate_G·G_n, and the specification fixes both
                coefficients at one channel pay unit. So the tariff itself is fully defined — what
                is not defined is what a channel pay unit is worth in FLOP. E.30 must ratify that
                relation, and until it does, comparing P against an escrow denominated in FLOP
                takes a figure you supply.
              </Note>
            }
          />
          <Row label="Tariff earned, P" result={P} mark="E.30" />
          <Row label="Unused remainder, E − P" result={over.unused} mark="R12.1a" />
          <Row
            label="Lost to over-reservation on cooperative settle"
            result={over.lostIfCooperative}
            total
          />
          <Blocked result={P} />
        </div>
        {share !== undefined ? (
          <p className="mt-3 text-[13px]" style={{ color: "var(--ink-2)" }}>
            That is {pct(share)} of the reservation, returned to nobody. On an ambiguous early
            close you would instead recover {dp2(1 - PHI)} of it, with the rest burned.
          </p>
        ) : null}
      </Section>

      <Section
        title="Close-path outcomes"
        sub="Which path resolves decides what you recover. Every rule here comes from the specification; the price does not, so it is yours to supply."
      >
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th
                className="pb-2.5 pr-3 text-left text-[12px] font-medium"
                style={{ color: "var(--ink-3)", borderBottom: "1px solid var(--rule)", width: "34%" }}
              >
                Path
              </th>
              <th
                className="pb-2.5 pr-3 text-left text-[12px] font-medium"
                style={{ color: "var(--ink-3)", borderBottom: "1px solid var(--rule)" }}
              >
                You recover
              </th>
              <th
                className="pb-2.5 text-left text-[12px] font-medium"
                style={{ color: "var(--ink-3)", borderBottom: "1px solid var(--rule)", width: "26%" }}
              >
                Cite
              </th>
            </tr>
          </thead>
          <tbody>
            {paths.map((p) => (
              <tr key={p.path}>
                <td
                  className="py-2.5 pr-3 align-top text-[13.5px]"
                  style={{
                    borderBottom: "1px solid var(--rule)",
                    color: p.path === "cooperative_settle" ? "var(--ink)" : "var(--ink-2)",
                  }}
                >
                  {p.label}
                </td>
                <td
                  className="py-2.5 pr-3 align-top text-[13px]"
                  style={{ borderBottom: "1px solid var(--rule)", color: "var(--ink)" }}
                >
                  {isBlocked(p.agentRecovers) ? (
                    <span style={{ color: "var(--absent)" }}>{p.caveat ?? "not specified"}</span>
                  ) : (
                    <span style={{ fontFamily: "var(--font-mono)" }}>
                      {auto(p.agentRecovers.value)}
                    </span>
                  )}
                  <span className="ml-2 text-[12px]" style={{ color: "var(--ink-3)" }}>
                    {p.path === "cooperative_settle" ? "— no refund, even truncated" : null}
                  </span>
                </td>
                <td
                  className="py-2.5 align-top text-[11.5px]"
                  style={{
                    borderBottom: "1px solid var(--rule)",
                    fontFamily: "var(--font-mono)",
                    color: "var(--ink-3)",
                  }}
                >
                  <Cites cites={p.cites} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section
        title="Under-reservation and disputes"
        sub="Reserving too little does not silently fail the session; it aborts or splices in more escrow, at the cost of another on-chain inclusion."
      >
        <Row label="Top-up needed" result={up.required} mark="R12.1e" />
        <Row label="Challenger bond to open a dispute" result={dispute.bond} mark="§12.1" />
        <Row label="Bond lost if the dispute fails" result={dispute.lossIfFails} mark="assumed" />
        <p className="mt-3 max-w-[74ch] text-[12.5px]" style={{ color: "var(--ink-3)" }}>
          {dispute.standing} {dispute.caveat}
        </p>
      </Section>

      <Section
        title="Reservation capacity"
        sub="A base allowance of concurrent reservations, plus one more for every fixed escrow increment. Slots free on settle, expiry, timeout or upheld fraud."
        last
      >
        <Row label="Concurrent sessions available" result={slots} mark="R12.2" />
        <p className="mt-3 text-[12.5px]" style={{ color: "var(--ink-3)" }}>
          One additional slot per {int(SLOT_ESCROW)} FLOP escrowed. A bond of {int(BOND)} FLOP opens
          a dispute, and standing is restricted — arbitrary public challengers are rejected before
          the bond locks.
        </p>
        <p className="mt-4 max-w-[74ch] text-[12.5px]" style={{ color: "var(--ink-3)" }}>
          Tier choice is not a priced trade-off. {tiers.softStatus} {tiers.spotCheckFallsOn}
        </p>
      </Section>
    </div>
  );
}
