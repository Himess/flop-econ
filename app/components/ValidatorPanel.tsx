"use client";

import { useEffect, useMemo } from "react";
import {
  auditIncome,
  auditPoolSolvency,
  baseSeatRate,
  blockRewardIncome,
  breakEven,
  committeePremiumValue,
  operatingCost,
  queueCost,
  seatRateFromStake,
  slashingLadder,
  specImpliedCost,
  type ValidatorInputs,
} from "@/model/validator";
import { blockReward, BLOCKS_PER_YEAR, rolePoolPerYear } from "@/model/emission";
import { param } from "@/model/params.generated";
import { isBlocked, num, type AssumptionRef } from "@/model/types";
import { auto, dp2, int, pct, signed } from "../lib/format";
import { SET_SIZES, type Scenario } from "../lib/state";
import { Blocked, Cites, Field, FieldRow, Mark, Note, Row, Section, Select } from "./Marks";
import { Dial } from "./Dial";

const ANCHOR = specImpliedCost();
const MAX_HALVINGS = num(param("max_halvings"));

/** Era labels for the emission chart: every halving era, then the perpetual floor. */
const ERAS = Array.from({ length: MAX_HALVINGS + 1 }, (_, i) => i);

/**
 * Emission-chart geometry, derived rather than typed. Bar pitch used to be a literal that
 * happened to equal the era-0 block reward, which the magic-number guard could not distinguish
 * from a protocol constant — and it was right not to.
 */
const CHART = { w: 600, h: 150, pad: 18, baseline: 116, plot: 104, label: 132 };
const PITCH = (CHART.w - CHART.pad * 2) / ERAS.length;
const BAR_W = PITCH * 0.66;

export function ValidatorPanel({
  s,
  set,
  onAssumptions,
}: {
  s: Scenario;
  set: (patch: Partial<Scenario>) => void;
  onAssumptions: (a: AssumptionRef[]) => void;
}) {
  const inputs: ValidatorInputs = useMemo(
    () => ({
      stake: s.stake ?? 0,
      networkStake: s.networkStake ?? 0,
      activeSetSize: s.setSize,
      era: s.era,
      ...(s.seatRate === undefined
        ? s.stake && s.networkStake
          ? { committeeSeatProbability: seatRateFromStake(s.stake, s.networkStake).value }
          : {}
        : { committeeSeatProbability: Math.min(1, Math.max(0, s.seatRate)) }),
      ...(s.daCost === undefined ? {} : { daCostPerYear: s.daCost }),
      ...(s.gpuCost === undefined ? {} : { gpuBackendCostPerYear: s.gpuCost }),
      ...(s.verdicts === undefined ? {} : { auditVerdictsPerYear: s.verdicts }),
    }),
    [s],
  );

  const be = useMemo(() => breakEven(inputs), [inputs]);
  const premium = useMemo(() => committeePremiumValue(inputs), [inputs]);
  const ladder = useMemo(() => slashingLadder(inputs), [inputs]);
  const solvency = useMemo(() => auditPoolSolvency(s.settlePerTurn), [s.settlePerTurn]);
  const queue = useMemo(() => queueCost(s.stake ?? 0, s.queueDays ?? 0), [s.stake, s.queueDays]);
  const cost = useMemo(() => operatingCost(inputs), [inputs]);
  const seat = useMemo(
    () => (s.stake && s.networkStake ? seatRateFromStake(s.stake, s.networkStake) : null),
    [s.stake, s.networkStake],
  );

  // Publish assumptions to the ledger. An effect, not a memo: this writes to parent state, and
  // doing that during render is a setState-in-render bug.
  useEffect(() => {
    const a: AssumptionRef[] = [];
    if (!isBlocked(cost)) a.push(...cost.assumptions);
    if (s.settlePerTurn !== undefined) {
      a.push({
        key: "settlement_value_per_turn",
        value: s.settlePerTurn,
        unit: "FLOP per turn",
        cite: param("session_price").cite,
        label: "settlement value per turn",
      });
    }
    onAssumptions(a);
  }, [cost, s.settlePerTurn, onAssumptions]);

  const pBar = baseSeatRate(s.setSize);
  const setShare = (n: number) =>
    s.stake && s.networkStake
      ? blockRewardIncome({ ...inputs, activeSetSize: n, networkStake: (s.networkStake / s.setSize) * n })
      : null;

  const maxReward = blockReward(0).value;
  // Scale for the ladder bars: the longest finite recovery among the non-terminal rungs.
  const maxRecovery = ladder.reduce(
    (m, r) => (r.terminal || isBlocked(r.recoveryDays) ? m : Math.max(m, r.recoveryDays.value)),
    0,
  );

  return (
    <div>
      <FieldRow>
        <Field
          id="v-stake"
          label="Self-stake"
          suffix="FLOP"
          value={s.stake === undefined ? "" : String(s.stake)}
          onChange={(v) => set({ stake: v === "" ? undefined : Number(v) })}
        />
        <Field
          id="v-net"
          label="Total active-set stake"
          suffix="FLOP"
          value={s.networkStake === undefined ? "" : String(s.networkStake)}
          onChange={(v) => set({ networkStake: v === "" ? undefined : Number(v) })}
        />
        <Select
          id="v-set"
          label="Active set size"
          value={String(s.setSize)}
          onChange={(v) => set({ setSize: Number(v) })}
          options={[
            { value: String(SET_SIZES[0]), label: `${int(SET_SIZES[0])} — wired` },
            { value: String(SET_SIZES[1]), label: `${int(SET_SIZES[1])} — ratified` },
          ]}
        />
        <Field
          id="v-da"
          label="DA cost"
          suffix="FLOP/yr"
          assumed
          cite="E.47"
          value={s.daCost === undefined ? "" : String(s.daCost)}
          onChange={(v) => set({ daCost: v === "" ? undefined : Number(v) })}
        />
        <Field
          id="v-gpu"
          label="GPU backend"
          suffix="FLOP/yr"
          assumed
          cite="no sizing in the spec"
          value={s.gpuCost === undefined ? "" : String(s.gpuCost)}
          onChange={(v) => set({ gpuCost: v === "" ? undefined : Number(v) })}
        />
      </FieldRow>

      {/* headline */}
      <div
        className="grid items-center gap-8 py-[30px] md:grid-cols-[196px_minmax(0,1fr)]"
        style={{ borderBottom: "1px solid var(--rule)" }}
      >
        <div>
          <Dial net={be.net} anchor={ANCHOR.value} />
        </div>
        <div style={{ borderTop: "1px solid var(--rule)" }}>
          <Row label="Block-reward pool share" result={be.blockReward} mark="R9.5" />
          <div>
            <div
              className="flex items-baseline justify-between gap-4 border-b py-[11px]"
              style={{ borderColor: "var(--rule)" }}
            >
              <span className="text-[14px]" style={{ color: "var(--ink-2)" }}>
                Finality-committee premium
                <Note summary={Math.abs(premium.value) < 1 ? "why zero" : "how this works"}>
                  The committee is resampled every epoch, so annual income tracks the seating{" "}
                  <em>rate</em>, not a snapshot. At the set-average rate the 1.1× cancels exactly.
                  It is a redistribution toward validators seated more often than average — under
                  stake-weighted sampling, that means larger stakes. Raise your stake above the set
                  average and this line goes positive.
                </Note>
              </span>
              <span
                className="whitespace-nowrap font-mono text-[16px]"
                style={{
                  fontFamily: "var(--font-mono)",
                  color: Math.abs(premium.value) < 1 ? "var(--ink-3)" : "var(--ink)",
                }}
              >
                {Math.abs(premium.value) < 1 ? "0" : signed(premium.value)}
                <Mark bucket={premium.bucket} label="R15.4a" />
              </span>
            </div>
          </div>
          <Row label="Audit-pool income" result={be.audit} mark="§7" />
          <Row label="Operating cost" result={cost} mark="assumed" />
          <Row label="Net" result={be.net} total />
          <Blocked result={be.net} />
        </div>
      </div>

      <Section
        title="Seat rate"
        sub="How often stake-weighted sampling is expected to seat you, and what the set average is. The mechanism is specified; the exact inclusion probability is not."
      >
        <Row
          label="Your expected seat rate"
          result={
            seat ?? {
              blocked: true,
              missing: ["stake"],
              cites: ["R15.4a"],
              message: "Enter a self-stake and a total active-set stake to compute this.",
              detail: "Seat rate is a share of the set, so both figures are needed.",
            }
          }
          mark="E.42"
        />
        <div
          className="flex items-baseline justify-between gap-4 py-[11px]"
          style={{ borderBottom: "1px solid var(--rule)" }}
        >
          <span className="text-[14px]" style={{ color: "var(--ink-2)" }}>
            Set average
          </span>
          <span className="font-mono text-[16px]" style={{ fontFamily: "var(--font-mono)" }}>
            {pct(pBar)}
            <Mark bucket="DEFINED" label="R15.4a" />
          </span>
        </div>
      </Section>

      <Section
        title="Slashing ladder"
        sub="Days of net income needed to return to break-even after each fault class, including the days spent outside the active set."
      >
        <div>
          {ladder.map((r) => {
            const denom = s.stake || 1;
            const severity = r.lossPermanent.value / denom;
            // The bar tracks RECOVERY TIME — the single quantity this section is about. It used
            // to track severity while the number tracked time, which made the eye read
            // "7 days is longer than 22 days". Severity is carried by the percentage in the
            // label and by the colour ramp instead.
            const days = isBlocked(r.recoveryDays) ? null : r.recoveryDays.value;
            const width = days === null || maxRecovery === 0 ? 0 : Math.max(2, (days / maxRecovery) * 100);
            const colour = r.terminal
              ? "var(--absent)"
              : severity >= 0.05
                ? "var(--planned)"
                : "var(--defined)";
            return (
              <div
                key={r.rung}
                className="grid items-center gap-3.5 py-[7px]"
                style={{ gridTemplateColumns: "minmax(140px,190px) minmax(0,1fr) 76px" }}
              >
                <span className="text-[13px]" style={{ color: "var(--ink-2)" }}>
                  {r.label.split(/[—-]/)[0]!.trim()}{" "}
                  <span style={{ color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>
                    {pct(severity + r.lossReturned.value / denom).replace(".00", "")}
                  </span>
                </span>
                {r.terminal ? (
                  <span className="text-[12px]" style={{ color: "var(--absent)" }}>
                    terminal — eject and blacklist, no recovery path
                  </span>
                ) : (
                  <div
                    className="h-4 rounded-[2px]"
                    style={{ width: `${width}%`, background: colour, minWidth: "3px" }}
                    title={`${days === null ? "not computable" : dp2(days) + " days"} to recover · ${auto(r.lossPermanent.value)} FLOP burned · ${r.reentry}`}
                  />
                )}
                <span
                  className="text-right text-[12.5px]"
                  style={{ fontFamily: "var(--font-mono)", color: "var(--ink-2)" }}
                >
                  {r.terminal ? "ejected" : days === null ? "—" : `${dp2(days)}d`}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-3 max-w-[68ch] text-[12px]" style={{ color: "var(--ink-3)" }}>
          Bar length is recovery time. The percentage beside each label is the stake at risk, and
          the colour follows it — so a long bar on a small percentage is exactly the point.
          Lone equivocation is the case: it burns nothing permanently, because half is withheld and
          returned after 180 days, so a 50% headline recovers faster than a 5% one. The fraud class
          is terminal. DA serve-or-slash sits outside the §11.3 table.
        </p>
      </Section>

      <Section
        title="Active set — ratified against wired"
        sub="The specification ratifies a cap of 1,000. The runtime carries MAX_ACTIVE_VALIDATORS = 200 and the validator page says the cap is not yet enforced. Your share differs fivefold between them."
      >
        <div
          className="grid gap-px overflow-hidden rounded-[3px]"
          style={{
            gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
            background: "var(--rule)",
            border: "1px solid var(--rule)",
          }}
        >
          {SET_SIZES.map((n, i) => {
            const r = setShare(n);
            return (
              <div key={n} className="panel-print px-[18px] py-4" style={{ background: "var(--panel)" }}>
                <div className="mb-1.5 text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                  {int(n)} — {i === 0 ? "wired today" : "ratified"}
                </div>
                <div className="font-mono text-[23px] font-medium" style={{ fontFamily: "var(--font-mono)" }}>
                  {r ? auto(r.value) : "—"}
                </div>
                <div className="mt-1 text-[12px]" style={{ color: "var(--ink-3)" }}>
                  {i === 0 ? "E.41 · issue #1393" : "R15.5b · D-0437"}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section
        title="Emission across eras"
        sub="The block reward halves five times, then holds at a permanent floor. Your validator leg is a tenth of each era's issuance."
      >
        <svg viewBox={`0 0 ${CHART.w} ${CHART.h}`} className="h-auto w-full" role="img" aria-label={`Block reward by era: ${ERAS.map((e) => auto(blockReward(e).value)).join(", ")} FLOP, the last being the perpetual floor`}>
          {ERAS.map((e, i) => {
            const r = blockReward(e).value;
            const h = (r / maxReward) * CHART.plot;
            const x = CHART.pad + i * PITCH;
            const y = CHART.baseline - h;
            return (
              <g key={e}>
                <rect
                  x={x}
                  y={y}
                  width={BAR_W}
                  height={h}
                  rx="2"
                  fill={e === s.era ? "var(--defined)" : "var(--panel-2)"}
                />
                <text
                  x={x + BAR_W / 2}
                  y={y - 6}
                  textAnchor="middle"
                  style={{ fontFamily: "var(--font-mono)", fontSize: "9px", fill: "var(--ink-3)" }}
                >
                  {auto(r)}
                </text>
                <text
                  x={x + BAR_W / 2}
                  y={CHART.label}
                  textAnchor="middle"
                  style={{ fontFamily: "var(--font-mono)", fontSize: "9px", fill: "var(--ink-3)" }}
                >
                  {e < MAX_HALVINGS ? `era ${e}` : "floor"}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1">
          <Field
            id="v-era"
            label="Era"
            value={String(s.era)}
            onChange={(v) => set({ era: v === "" ? 0 : Math.max(0, Math.floor(Number(v))) })}
          />
          <span className="text-[12.5px]" style={{ color: "var(--ink-3)" }}>
            Validator pool at this era: {auto(rolePoolPerYear("validator", s.era).value)} FLOP/yr
            across the whole set ({int(BLOCKS_PER_YEAR)} blocks).
          </span>
        </div>
      </Section>

      <Section
        title="Audit-pool solvency"
        sub="Inflow is one percent of each settlement; outflow is a flat fee per verdict at the default sampling rate. Below the floor, the pool that funds Tier-3 enforcement cannot pay for its own audits — and payment is gated on pool solvency."
      >
        <div className="mb-4 max-w-xs">
          <Field
            id="v-turn"
            label="Settlement value per turn"
            suffix="FLOP"
            assumed
            cite="no protocol price exists"
            value={s.settlePerTurn === undefined ? "" : String(s.settlePerTurn)}
            onChange={(v) => set({ settlePerTurn: v === "" ? undefined : Number(v) })}
          />
        </div>
        <div className="flex items-baseline justify-between gap-4 py-[11px]">
          <span className="text-[14px]" style={{ color: "var(--ink-2)" }}>
            Pool position
          </span>
          <span className="font-mono text-[16px]" style={{ fontFamily: "var(--font-mono)" }}>
            {solvency.solvent === undefined ? (
              <span style={{ color: "var(--absent)", fontSize: "13px" }}>needs a settlement value</span>
            ) : solvency.solvent ? (
              <>
                <span style={{ color: "var(--defined)" }}>solvent</span>
                <Mark
                  bucket="DEFINED"
                  label={`${dp2(s.settlePerTurn!)} ≥ ${dp2(solvency.breakEvenPerTurn.value)}`}
                />
              </>
            ) : (
              <>
                <span style={{ color: "var(--absent)" }}>below floor</span>
                <Mark
                  bucket="ABSENT"
                  label={`${dp2(s.settlePerTurn!)} < ${dp2(solvency.breakEvenPerTurn.value)}`}
                />
              </>
            )}
          </span>
        </div>
        <p className="text-[12px]" style={{ color: "var(--ink-3)" }}>
          <Cites cites={solvency.breakEvenPerTurn.cites} />
        </p>
      </Section>

      <Section
        title="Queue cost"
        sub="Below the active set the full reducible balance is frozen, the validator leg pays nothing, and promotion waits on a free slot behind a cap that is ratified but not wired."
        last
      >
        <div className="mb-4 max-w-xs">
          <Field
            id="v-qd"
            label="Days queued"
            value={s.queueDays === undefined ? "" : String(s.queueDays)}
            onChange={(v) => set({ queueDays: v === "" ? undefined : Number(v) })}
          />
        </div>
        <Row label="Stake frozen while queued" result={queue.stakeLocked} mark="§15.2" />
        <Row label="Validator-leg reward while queued" result={queue.rewardWhileQueued} mark="R15.5b" />
        <Row
          label="Block-reward income forgone over the period"
          result={
            s.queueDays !== undefined && !isBlocked(be.blockReward)
              ? {
                  ...be.blockReward,
                  value: (be.blockReward.value * (s.queueDays ?? 0)) / 365,
                  unit: "FLOP",
                }
              : {
                  blocked: true,
                  missing: ["queueDays"],
                  cites: ["R15.5b"],
                  message: "Enter a number of days queued to compute this.",
                  detail: "Forgone income is a rate multiplied by a period.",
                }
          }
          mark="R15.5b"
        />
        <p className="mt-3 text-[12px]" style={{ color: "var(--ink-3)" }}>
          {queue.note}
        </p>
      </Section>
    </div>
  );
}

export { auditIncome, blockRewardIncome };
