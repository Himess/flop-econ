"use client";

import { useEffect, useMemo, useState } from "react";
import {
  auditPoolSolvency,
  baseSeatRate,
  breakEven,
  maxDelegated,
  minimumStake,
  queueCost,
  rewardLiquidity,
  slashingLadder,
  type RewardLiquidity,
  type ValidatorInputs,
} from "@/model/validator";
import { param } from "@/model/params.generated";
import { isBlocked } from "@/model/types";
import type { AssumptionRef } from "@/model/types";
import { Cell, CiteList, Cites, NumberField, Section, Stat, fmt } from "./Provenance";

type N = number | "";
const val = (x: N, d = 0) => (x === "" ? d : x);
const opt = (x: N) => (x === "" ? undefined : x);

export function ValidatorTab({ onAssumptions }: { onAssumptions: (a: AssumptionRef[]) => void }) {
  const [stake, setStake] = useState<N>(305_505);
  const [networkStake, setNetworkStake] = useState<N>(305_505 * 200);
  const [setSize, setSetSize] = useState<N>(200);
  const [era, setEra] = useState<N>(0);
  const [seatRate, setSeatRate] = useState<N>("");
  const [daCost, setDaCost] = useState<N>("");
  const [gpuCost, setGpuCost] = useState<N>("");
  const [otherCost, setOtherCost] = useState<N>("");
  const [verdicts, setVerdicts] = useState<N>("");
  const [settlePerTurn, setSettlePerTurn] = useState<N>("");
  const [liquidity, setLiquidity] = useState<RewardLiquidity>("locked_autocompound");
  const [queueDays, setQueueDays] = useState<N>(90);
  const [oppRate, setOppRate] = useState<N>("");

  const inputs: ValidatorInputs = useMemo(
    () => ({
      stake: val(stake, 1),
      networkStake: val(networkStake, 1),
      activeSetSize: val(setSize, 1),
      era: val(era, 0),
      ...(seatRate === "" ? {} : { committeeSeatProbability: Math.min(1, Math.max(0, seatRate)) }),
      ...(daCost === "" ? {} : { daCostPerYear: daCost }),
      ...(gpuCost === "" ? {} : { gpuBackendCostPerYear: gpuCost }),
      ...(otherCost === "" ? {} : { otherCostPerYear: otherCost }),
      ...(verdicts === "" ? {} : { auditVerdictsPerYear: verdicts }),
    }),
    [stake, networkStake, setSize, era, seatRate, daCost, gpuCost, otherCost, verdicts],
  );

  const be = useMemo(() => breakEven(inputs), [inputs]);
  const ladder = useMemo(() => slashingLadder(inputs), [inputs]);
  const solvency = useMemo(() => auditPoolSolvency(opt(settlePerTurn)), [settlePerTurn]);
  const q = useMemo(() => queueCost(val(stake), val(queueDays), opt(oppRate)), [stake, queueDays, oppRate]);
  const liq = useMemo(() => rewardLiquidity(be.revenue, liquidity), [be.revenue, liquidity]);
  const minStake = useMemo(() => minimumStake(val(era, 0) * 2), [era]);
  const delegCap = useMemo(() => maxDelegated(val(stake)), [stake]);

  // Publish every assumption in play to the drawer. An effect, not a memo: publishing is a
  // side-effect on the parent, and doing it during render is a setState-in-render bug.
  useEffect(() => {
    const a: AssumptionRef[] = [];
    if (!isBlocked(be.cost)) a.push(...be.cost.assumptions);
    if (q.opportunityCost) a.push(...q.opportunityCost.assumptions);
    onAssumptions(a);
  }, [be.cost, q.opportunityCost, onAssumptions]);

  const pBar = baseSeatRate(val(setSize, 1));

  return (
    <div>
      <p className="max-w-3xl text-sm text-neutral-700">
        The validator is the only FLOP role whose reward apportionment is normatively specified —
        R9.5 splits the pool by stake with a 1.1&times; finality-committee multiplier. The miner&apos;s
        is an open item (E.44) and the agent&apos;s leg is parked (R9.12). So the revenue side below is{" "}
        <strong>DEFINED</strong>. The cost side is not: §15.3 names DA storage/serving and the
        committee-keeping GPU work as &ldquo;the two heavy legs&rdquo;, and the spec sizes neither.
        Both must be supplied before this page will compute a net figure.
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* ---------------------------------------------------------------- inputs */}
        <div className="space-y-3 rounded border border-neutral-200 bg-white p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Position</h3>
          <NumberField label="Your stake (self + delegated)" value={stake} onChange={setStake} unit="FLOP" />
          <NumberField label="Total active-set stake" value={networkStake} onChange={setNetworkStake} unit="FLOP" />
          <NumberField
            label="Active set size"
            value={setSize}
            onChange={setSetSize}
            hint="Ratified cap is 1,000 (D-0437); the runtime reaches only 200 (E.41). Try both."
          />
          <NumberField label="Emission era" value={era} onChange={setEra} step={1} hint="0 = launch. Halves every 730 days, five times, then floors at 3 FLOP." />
          <NumberField
            label="Committee seat rate"
            value={seatRate}
            onChange={setSeatRate}
            step={0.01}
            hint={`Blank = the set average, ${pBar.toFixed(4)}. The committee is resampled every epoch (R15.4a), so this is a rate, not a snapshot.`}
          />

          <h3 className="pt-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Cost — the spec sizes none of this
          </h3>
          <NumberField
            label="DA storage + bandwidth"
            value={daCost}
            onChange={setDaCost}
            unit="FLOP/yr"
            absent
            cite="E.47 — cumulative retention budget [TBD]"
            hint="Unit economics are derivable (RS rate ½, R=6, k=3, 14 d retention); the total is not."
          />
          <NumberField
            label="GPU backend for the committee gate"
            value={gpuCost}
            onChange={setGpuCost}
            unit="FLOP/yr"
            absent
            cite="§15.1, §15.3 — 'GPU-heavy', no sizing given"
            hint="Committee eligibility needs verified PoUI work inside 24 h, so a production validator co-locates or delegates to a calibrated miner backend."
          />
          <NumberField label="Other operating cost" value={otherCost} onChange={setOtherCost} unit="FLOP/yr" />
          <NumberField
            label="Audit verdicts claimed"
            value={verdicts}
            onChange={setVerdicts}
            unit="/yr"
            hint="Flat 1 FLOP each, VRF-assigned, gated on pool solvency."
          />

          <h3 className="pt-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Scenario switches</h3>
          <label className="block">
            <span className="text-xs font-medium text-neutral-700">Reward liquidity (E.39, unresolved)</span>
            <select
              value={liquidity}
              onChange={(e) => setLiquidity(e.target.value as RewardLiquidity)}
              className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm"
            >
              <option value="locked_autocompound">Locked, auto-compounded (current, D-0408)</option>
              <option value="liquid">Liquid on issue (workbook target)</option>
            </select>
          </label>
        </div>

        {/* ---------------------------------------------------------------- outputs */}
        <div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Block-reward income" result={be.blockReward} big />
            <Stat label="Audit income" result={be.audit} />
            <Stat label="Total revenue" result={be.revenue} />
            <Stat label="Net of your costs" result={be.net} big />
          </div>

          <Section
            title="Against the spec's own implied cost"
            subtitle="§2.2 discloses the committee cap as cost-derived: ~112 validators at the 1.5 FLOP floor, ~224 at 3 FLOP. Both divide out to the same figure, which is the closest thing to an operating-cost basis the paper contains. It is the spec's assumption, not an observed cost."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Stat label="Spec-implied annual cost" result={be.specAnchor} />
              <Stat label="Revenue minus that anchor" result={be.netAgainstSpecAnchor} />
            </div>
          </Section>

          <Section
            title="Slashing ladder"
            subtitle="Time to recover is measured against NET earnings, not revenue — a validator earning less than it spends never recovers — and includes the days spent out of the active set."
          >
            <div className="overflow-x-auto rounded border border-neutral-200 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-neutral-200 bg-neutral-50 text-[11px] uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-2 py-1.5">Offence</th>
                    <th className="px-2 py-1.5 text-right">Burned</th>
                    <th className="px-2 py-1.5 text-right">Withheld</th>
                    <th className="px-2 py-1.5 text-right">Days out</th>
                    <th className="px-2 py-1.5 text-right">Days to recover</th>
                    <th className="px-2 py-1.5">Re-entry</th>
                  </tr>
                </thead>
                <tbody>
                  {ladder.map((r) => (
                    <tr key={r.rung} className={`border-b border-neutral-100 ${r.terminal ? "bg-rose-50" : ""}`}>
                      <td className="px-2 py-1.5">
                        <div className="font-medium">{r.label}</div>
                        <CiteList cites={r.cites} className="block font-mono text-[10px] text-neutral-500" />
                      </td>
                      <td className="px-2 py-1.5 text-right"><Cell result={r.lossPermanent} /></td>
                      <td className="px-2 py-1.5 text-right"><Cell result={r.lossReturned} /></td>
                      <td className="px-2 py-1.5 text-right"><Cell result={r.daysOutOfSet} /></td>
                      <td className="px-2 py-1.5 text-right"><Cell result={r.recoveryDays} /></td>
                      <td className="px-2 py-1.5 text-neutral-600">{r.reentry}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-1.5 text-[11px] text-neutral-600">
              Lone equivocation burns nothing permanently — 50% is withheld and returned after 180
              days (D-0420). The fraud class is terminal: eject plus blacklist, so there is no
              recovery path to compute. DA serve-or-slash sits outside the §11.3 table (R5.3b).
            </p>
          </Section>

          <Section
            title="Audit-pool solvency"
            subtitle="A network-health indicator, not an input. Inflow is 1% of the miner's settlement; outflow is a flat 1 FLOP per verdict at a 5% sampling rate. Below the floor, the pool that funds Tier-3 enforcement cannot pay for its own audits — and audit_fee_per_turn is explicitly gated on pool solvency."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Stat label="Break-even settlement per audited turn" result={solvency.breakEvenPerTurn} big />
              <div className="rounded border border-neutral-200 bg-white p-3">
                <NumberField
                  label="Your assumed settlement per turn"
                  value={settlePerTurn}
                  onChange={setSettlePerTurn}
                  unit="FLOP"
                  absent
                  cite="no protocol price exists — App. C.2/C.3, §15.6"
                />
                {solvency.solvent !== undefined ? (
                  <p
                    className={`mt-2 text-xs font-medium ${solvency.solvent ? "text-emerald-800" : "text-rose-800"}`}
                  >
                    {solvency.solvent
                      ? "Above the floor — the pool funds its own audits."
                      : "Below the floor — the audit pool cannot self-fund at the default sampling rate."}
                  </p>
                ) : null}
              </div>
            </div>
          </Section>

          <Section
            title="Queue cost"
            subtitle="§15.2: register freezes the account's full reducible balance and admits to ValidatorQueue, not the active set. R15.5b: queued validators earn no validator-leg reward."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Stake frozen while queued" result={q.stakeLocked} />
              <Stat label="Reward while queued" result={q.rewardWhileQueued} />
              {q.opportunityCost ? (
                <Stat label="Opportunity cost over the period" result={q.opportunityCost} />
              ) : (
                <div className="rounded border border-neutral-200 bg-white p-3">
                  <NumberField label="Days queued" value={queueDays} onChange={setQueueDays} />
                  <div className="mt-2">
                    <NumberField
                      label="Your capital cost"
                      value={oppRate}
                      onChange={setOppRate}
                      step={0.01}
                      unit="/yr"
                      absent
                      cite="your assumption — the spec has no view on capital cost"
                    />
                  </div>
                </div>
              )}
            </div>
            <p className="mt-1.5 text-[11px] text-neutral-600">{q.note}</p>
          </Section>

          <Section title="Stake requirements">
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat
                label={`Minimum stake, year ${val(era, 0) * 2}`}
                result={minStake}
                hint="Baseline 305,505 FLOP compounding +9%/yr. The value-coupled floor's k is ABSENT (E.8); its storage default is 0, so the baseline is the live case."
              />
              <Stat label="Max delegated at your self-stake" result={delegCap} hint="MinSelfStakeRatio: self ≥ 20% of the total, so ≤ 4× delegation." />
              <div className="rounded border border-neutral-200 bg-white p-3">
                <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Reward liquidity (E.39)
                </div>
                <div className="mt-1 font-mono text-lg tabular-nums">
                  {fmt(liq.liquidNow.value)} <span className="text-xs text-neutral-500">liquid</span>
                </div>
                <div className="font-mono text-sm tabular-nums text-neutral-600">
                  {fmt(liq.addedToStake.value)} <span className="text-xs">to locked stake</span>
                </div>
                <Cites cites={liq.liquidNow.cites} derivation={liq.liquidNow.derivation} />
              </div>
            </div>
          </Section>

          <p className="mt-6 text-[11px] leading-snug text-neutral-500">
            Rotation ranks on <strong>stake</strong> above a minimum-performance floor (R15.5); the
            40/30/20/10 composite score is that floor&apos;s input (§15.4), not the rank key.
            /intro/validator/ notes the running network still ranks on work and performance. The
            spec states <strong>no</strong> hardware minimums — §15.3 gives qualitative intensities
            only ({param("validator_hardware_spec").cite}).
          </p>
        </div>
      </div>
    </div>
  );
}
