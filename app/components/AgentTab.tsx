"use client";

import { useEffect, useMemo, useState } from "react";
import {
  closePaths,
  disputeCost,
  escrowForSlots,
  overReservation,
  reservationSlots,
  tariff,
  tierComparison,
  topUp,
  type TariffInputs,
} from "@/model/agent";
import { isBlocked, type AssumptionRef } from "@/model/types";
import { Cell, CiteList, Cites, NumberField, Section, Stat } from "./Provenance";

type N = number | "";
const val = (x: N, d = 0) => (x === "" ? d : x);

export function AgentTab({ onAssumptions }: { onAssumptions: (a: AssumptionRef[]) => void }) {
  const [escrow, setEscrow] = useState<N>(1000);
  const [turns, setTurns] = useState<N>(100);
  const [gn, setGn] = useState<N>(50_000);
  const [rate, setRate] = useState<N>("");
  const [slots, setSlots] = useState<N>(10);

  const inputs: TariffInputs = useMemo(
    () => ({
      escrow: val(escrow),
      turns: val(turns),
      gnClaimed: val(gn),
      ...(rate === "" ? {} : { rateGToFlop: rate }),
    }),
    [escrow, turns, gn, rate],
  );

  const P = useMemo(() => tariff(inputs), [inputs]);
  const paths = useMemo(() => closePaths(inputs), [inputs]);
  const over = useMemo(() => overReservation(inputs), [inputs]);
  const up = useMemo(() => topUp(inputs), [inputs]);
  const slotsFig = useMemo(() => escrowForSlots(val(slots, 4)), [slots]);
  const dispute = useMemo(() => disputeCost(), []);
  const tiers = useMemo(() => tierComparison(), []);

  useEffect(() => {
    onAssumptions(isBlocked(P) ? [] : [...P.assumptions]);
  }, [P, onAssumptions]);

  return (
    <div>
      {/* The headline. This is why the tab exists. */}
      <div className="rounded border-l-4 border-rose-500 bg-rose-50 p-4">
        <h2 className="text-sm font-semibold text-rose-950">
          Cooperative settle pays your full reservation — even for a truncated answer
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-rose-900">
          R12.1a: escrow at <code className="font-mono text-xs">open_channel</code> is the payment
          for reserved capacity; settle pays the reserved amount in full and{" "}
          <strong>under-use MUST NOT be refunded</strong>. M9 (§13.1) adds that there is{" "}
          <strong>no completion SLA</strong> — an early-stopped or truncated session still costs the
          whole reservation, and your stated recovery is nothing. Over-reserving is a pure loss.
        </p>
        <p className="mt-1.5 font-mono text-[10px] text-rose-700">
          R12.1a · M9 (§13.1) · App. C.3
        </p>
      </div>

      <p className="mt-4 max-w-3xl text-sm text-neutral-700">
        This is not a cost calculator. Every input to the <em>outcome</em> side is DEFINED; every
        input to the <em>price</em> side is ABSENT — there is no protocol price, no auction and no
        floor, because the agent picks a miner off-chain and the escrow it posts is the price
        (App. C.2/C.3, §15.6). So the question answered here is: given what you reserved and what
        the session consumed, which close path are you on and what do you recover.
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3 rounded border border-neutral-200 bg-white p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Session</h3>
          <NumberField label="Reserved escrow, E" value={escrow} onChange={setEscrow} unit="FLOP" />
          <NumberField label="Turns served, n" value={turns} onChange={setTurns} step={1} />
          <NumberField label="Claimed work, G_n" value={gn} onChange={setGn} />
          <NumberField
            label="G_n → FLOP rate"
            value={rate}
            onChange={setRate}
            unit="FLOP/G_n"
            absent
            cite="E.30 — G_n numeric type and unit taxonomy [TBD]"
            hint="R12.1d uses one channel pay unit per G_n, but E.30 must ratify its relation to FLOP's base units. Without this, every tariff-dependent path stays blocked — the model will not guess."
          />
          <div className="pt-1">
            <Stat label="Unilateral-close tariff, P" result={P} />
          </div>

          <h3 className="pt-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Concurrency
          </h3>
          <NumberField label="Concurrent reservations wanted" value={slots} onChange={setSlots} step={1} />
          <Stat label="Escrow to hold that many" result={slotsFig} />
        </div>

        <div>
          <Section
            title="Close-path outcome matrix"
            subtitle="Which path you land on decides everything. Conservation holds on the paths that split the escrow: P + (1−φ)(E−P) + φ(E−P) = E."
          >
            <div className="overflow-x-auto rounded border border-neutral-200 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-neutral-200 bg-neutral-50 text-[11px] uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-2 py-1.5">Close path</th>
                    <th className="px-2 py-1.5 text-right">You recover</th>
                    <th className="px-2 py-1.5 text-right">Miner keeps</th>
                    <th className="px-2 py-1.5 text-right">Burned</th>
                    <th className="px-2 py-1.5">Rule</th>
                  </tr>
                </thead>
                <tbody>
                  {paths.map((p) => (
                    <tr
                      key={p.path}
                      className={`border-b border-neutral-100 align-top ${
                        p.path === "cooperative_settle" ? "bg-rose-50" : ""
                      }`}
                    >
                      <td className="px-2 py-1.5">
                        <div className="font-medium">{p.label}</div>
                        <CiteList cites={p.cites} className="block font-mono text-[10px] text-neutral-500" />
                      </td>
                      <td className="px-2 py-1.5 text-right"><Cell result={p.agentRecovers} /></td>
                      <td className="px-2 py-1.5 text-right"><Cell result={p.minerKeeps} /></td>
                      <td className="px-2 py-1.5 text-right"><Cell result={p.burned} /></td>
                      <td className="max-w-md px-2 py-1.5 text-neutral-600">
                        {p.rule}
                        {p.caveat ? (
                          <span className="mt-0.5 block text-rose-700">{p.caveat}</span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section
            title="What over- and under-reservation cost"
            subtitle="The asymmetry is the decision: over-reserve and the surplus is lost or partly burned; under-reserve and you pay for an extra on-chain inclusion, or the session aborts."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Unused reservation, E − P" result={over.unused} />
              <Stat
                label="Lost on cooperative settle"
                result={over.lostIfCooperative}
                hint="The entire remainder. There is no refund lane."
              />
              <Stat
                label="Burned on an ambiguous close"
                result={over.burnedIfAmbiguous}
                hint="φ(E−P) at φ = 20%, routed to burn/Foundation — never the miner."
              />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Stat label="Top-up needed if under-reserved" result={up.required} hint={up.rule} />
              <div className="rounded border border-neutral-200 bg-white p-3">
                <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Dispute cost
                </div>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <div>
                    <div className="font-mono text-lg tabular-nums">{dispute.bond.value}</div>
                    <div className="text-[11px] text-neutral-500">FLOP bond to open</div>
                  </div>
                  <div>
                    <div className="font-mono text-lg tabular-nums text-rose-700">
                      −{dispute.lossIfFails.value}
                    </div>
                    <div className="text-[11px] text-rose-700">if it fails (assumed)</div>
                  </div>
                </div>
                <p className="mt-1.5 text-[11px] text-neutral-600">{dispute.standing}</p>
                <p className="mt-1 text-[11px] text-rose-700">{dispute.caveat}</p>
                <Cites cites={dispute.cites} />
              </div>
            </div>
          </Section>

          <Section
            title="Tier choice — HARD vs SOFT"
            subtitle="An agent choosing a tier today is not making a priced trade-off. It is making an unresolved one."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded border border-neutral-200 bg-white p-3">
                <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  HARD guarantee
                </div>
                <p className="mt-1 text-xs text-neutral-700">{tiers.hardGuarantee}</p>
              </div>
              <div className="rounded border border-amber-300 bg-amber-50 p-3">
                <div className="text-xs font-medium uppercase tracking-wide text-amber-900">
                  SOFT status
                </div>
                <p className="mt-1 text-xs text-amber-900">{tiers.softStatus}</p>
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Stat label="Cost difference to the agent" result={tiers.agentCostDifference} />
              <div className="rounded border border-neutral-200 bg-white p-3">
                <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Who pays for the SOFT spot-check
                </div>
                <p className="mt-1 text-xs text-neutral-700">{tiers.spotCheckFallsOn}</p>
                <Cites cites={tiers.cites} />
              </div>
            </div>
          </Section>

          <p className="mt-6 text-[11px] leading-snug text-neutral-500">
            Agents are pure cost centres today. The 10% agent leg is minted but R9.12 forbids
            distribution until E.40 ratifies, so it dilutes every holder while paying nobody. The
            testnet unlock mechanism on /intro/agent/ has no normative basis — E.38 lists whether
            spend-to-unlock ships at all as open — so it is not modelled here.
          </p>
        </div>
      </div>
    </div>
  );
}
