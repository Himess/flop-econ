"use client";

import { useEffect, useMemo } from "react";
import {
  auditPoolSolvency,
  baseSeatRate,
  breakEven,
  committeePremiumValue,
  maxDelegated,
  minimumStake,
  operatingCost,
  queueCost,
  seatRateFromStake,
  slashingLadder,
  specImpliedCost,
  type ValidatorInputs,
} from "@/model/validator";
import { blockReward, rolePoolPerYear } from "@/model/emission";
import { annualCostUsd, forward, GENESIS, reverse, tokenPrice } from "@/model/valuation";
import { bothScenarios, liquiditySummary, payback } from "@/model/timeline";
import { param } from "@/model/params.generated";
import { isBlocked, num, type AssumptionRef } from "@/model/types";
import { auto, dp2, int, pct } from "../lib/format";
import { ANCHORS, href } from "../lib/docs";
import { SET_SIZES, type Scenario } from "../lib/state";
import { Block, Drawer, Field, Headline, Inputs, Line, Mark, Select } from "./Marks";
import { Chart } from "./Chart";

const MAX_HALVINGS = num(param("max_halvings"));
const ERAS = Array.from({ length: MAX_HALVINGS + 1 }, (_, i) => i);

export function ValidatorPanel({
  s,
  set,
  onAssumptions,
}: {
  s: Scenario;
  set: (patch: Partial<Scenario>) => void;
  onAssumptions: (a: AssumptionRef[]) => void;
}) {
  const validator: ValidatorInputs = useMemo(
    () => ({
      stake: s.stake ?? 0,
      networkStake: s.networkStake ?? 0,
      activeSetSize: s.setSize,
      era: s.era,
      ...(s.stake && s.networkStake
        ? { committeeSeatProbability: seatRateFromStake(s.stake, s.networkStake).value }
        : {}),
      ...(s.daCost === undefined ? {} : { daCostPerYear: s.daCost }),
      ...(s.gpuCost === undefined ? {} : { gpuBackendCostPerYear: s.gpuCost }),
      ...(s.verdicts === undefined ? {} : { auditVerdictsPerYear: s.verdicts }),
    }),
    [s],
  );

  const be = useMemo(() => breakEven(validator), [validator]);
  const revenueFlop = isBlocked(be.revenue) ? 0 : be.revenue.value;

  const valuationInputs = useMemo(
    () => ({
      mode: s.priceMode,
      ...(s.valuationUsd === undefined ? {} : { valuationUsd: s.valuationUsd }),
      ...(s.pricePerToken === undefined ? {} : { pricePerToken: s.pricePerToken }),
      anchorYear: s.anchorYear,
    }),
    [s.priceMode, s.valuationUsd, s.pricePerToken, s.anchorYear],
  );
  const costs = useMemo(
    () => ({
      electricityPrice: s.electricityPrice,
      powerKw: s.powerKw,
      hardwareUsd: s.hardwareUsd,
      amortMonths: s.amortMonths,
      hostingUsdMonth: s.hostingUsdMonth,
    }),
    [s.electricityPrice, s.powerKw, s.hardwareUsd, s.amortMonths, s.hostingUsdMonth],
  );

  const price = useMemo(() => tokenPrice(valuationInputs, "params"), [valuationInputs]);
  const usdCost = useMemo(() => annualCostUsd(costs), [costs]);
  const rev = useMemo(
    () => reverse(revenueFlop, costs, s.anchorYear, "params"),
    [revenueFlop, costs, s.anchorYear],
  );
  const revWorkbook = useMemo(
    () => reverse(revenueFlop, costs, s.anchorYear, "workbook"),
    [revenueFlop, costs, s.anchorYear],
  );
  const fwd = useMemo(
    () => forward(revenueFlop, valuationInputs, costs, "params"),
    [revenueFlop, valuationInputs, costs],
  );

  const monthlyCostUsd = useMemo(() => {
    if (s.electricityPrice === undefined || s.powerKw === undefined || s.hostingUsdMonth === undefined) {
      return undefined;
    }
    return (s.electricityPrice * s.powerKw * 24 * 365) / 12 + s.hostingUsdMonth;
  }, [s.electricityPrice, s.powerKw, s.hostingUsdMonth]);

  const timelineInputs = useMemo(
    () => ({
      validator,
      months: s.horizonMonths,
      ...(isBlocked(price) ? {} : { priceUsd: price.value }),
      ...(s.hardwareUsd === undefined ? {} : { hardwareUsd: s.hardwareUsd }),
      ...(monthlyCostUsd === undefined ? {} : { monthlyCostUsd }),
      ...(s.bondLockMonths === undefined ? {} : { bondLockMonths: s.bondLockMonths }),
      ...(s.exitAtMonth === undefined ? {} : { exitAtMonth: s.exitAtMonth }),
    }),
    [validator, s.horizonMonths, price, s.hardwareUsd, monthlyCostUsd, s.bondLockMonths, s.exitAtMonth],
  );

  const runs = useMemo(() => bothScenarios(timelineInputs), [timelineInputs]);
  const live = "locked_autocompound" as const;
  const payLive = useMemo(() => payback(runs[live], timelineInputs, live), [runs, timelineInputs]);
  const payLiquid = useMemo(() => payback(runs.liquid, timelineInputs, "liquid"), [runs, timelineInputs]);
  const sumLive = useMemo(() => liquiditySummary(runs[live], live), [runs]);

  const ladder = useMemo(() => slashingLadder(validator), [validator]);
  const solvency = useMemo(() => auditPoolSolvency(s.settlePerTurn), [s.settlePerTurn]);
  const queue = useMemo(() => queueCost(s.stake ?? 0, s.queueDays ?? 0), [s.stake, s.queueDays]);
  const premium = useMemo(() => committeePremiumValue(validator), [validator]);
  const seat = useMemo(
    () => (s.stake && s.networkStake ? seatRateFromStake(s.stake, s.networkStake) : null),
    [s.stake, s.networkStake],
  );

  useEffect(() => {
    const a: AssumptionRef[] = [];
    const c = operatingCost(validator);
    if (!isBlocked(c)) a.push(...c.assumptions);
    if (!isBlocked(price)) a.push(...price.assumptions);
    if (!isBlocked(usdCost)) a.push(...usdCost.assumptions);
    onAssumptions(a);
  }, [validator, price, usdCost, onAssumptions]);

  const maxRecovery = ladder.reduce(
    (m, r) => (r.terminal || isBlocked(r.recoveryDays) ? m : Math.max(m, r.recoveryDays.value)),
    0,
  );
  const last = runs[live][runs[live].length - 1]!;

  return (
    <div>
      <Inputs>
        <Field
          id="v-stake"
          label="Self-stake"
          suffix="FLOP"
          value={s.stake === undefined ? "" : String(s.stake)}
          onChange={(v) => set({ stake: v === "" ? undefined : Number(v) })}
        />
        <Field
          id="v-net"
          label="Set total stake"
          suffix="FLOP"
          value={s.networkStake === undefined ? "" : String(s.networkStake)}
          onChange={(v) => set({ networkStake: v === "" ? undefined : Number(v) })}
        />
        <Select
          id="v-set"
          label="Set size"
          value={String(s.setSize)}
          onChange={(v) => set({ setSize: Number(v) })}
          options={[
            { value: String(SET_SIZES[0]), label: `${int(SET_SIZES[0])} wired` },
            { value: String(SET_SIZES[1]), label: `${int(SET_SIZES[1])} ratified` },
          ]}
        />
        <Field
          id="v-da"
          label="DA cost"
          suffix="FLOP/yr"
          assumed
          value={s.daCost === undefined ? "" : String(s.daCost)}
          onChange={(v) => set({ daCost: v === "" ? undefined : Number(v) })}
        />
        <Field
          id="v-gpu"
          label="GPU backend"
          suffix="FLOP/yr"
          assumed
          value={s.gpuCost === undefined ? "" : String(s.gpuCost)}
          onChange={(v) => set({ gpuCost: v === "" ? undefined : Number(v) })}
        />
        <Field
          id="v-val"
          label="Valuation"
          suffix="USD"
          assumed
          value={s.valuationUsd === undefined ? "" : String(s.valuationUsd)}
          onChange={(v) => set({ valuationUsd: v === "" ? undefined : Number(v) })}
        />
        <Field
          id="v-hw"
          label="Hardware"
          suffix="USD"
          assumed
          value={s.hardwareUsd === undefined ? "" : String(s.hardwareUsd)}
          onChange={(v) => set({ hardwareUsd: v === "" ? undefined : Number(v) })}
        />
        <Field
          id="v-host"
          label="Hosting"
          suffix="USD/mo"
          assumed
          value={s.hostingUsdMonth === undefined ? "" : String(s.hostingUsdMonth)}
          onChange={(v) => set({ hostingUsdMonth: v === "" ? undefined : Number(v) })}
        />
      </Inputs>

      {/* ------------------------------------------------------------------ the answer */}
      <div
        className="mt-12 grid gap-10 sm:grid-cols-3"
        style={{ borderTop: "1px solid var(--rule)", paddingTop: "36px" }}
      >
        <Headline
          label="Break-even valuation"
          result={rev.breakEvenValuation}
          docs={ANCHORS.breakEvenValuation}
          prefix="$"
        />
        <Headline label="Net per year" result={fwd.netUsdYear} docs={ANCHORS.net} prefix="$" />
        <Headline
          label="Cash payback"
          result={payLive.cashMonths}
          docs={ANCHORS.cashPayback}
          suffix="months"
          fallback={`never within ${int(s.horizonMonths)} months`}
          mark="E.39"
        />
      </div>

      <p className="mt-5 max-w-[74ch] text-[13px]" style={{ color: "var(--ink-2)" }}>
        {isBlocked(payLive.accountingMonths) ? (
          "Supply the dotted inputs above to see when this pays back."
        ) : (
          <>
            Profitable on paper from month{" "}
            <strong style={{ color: "var(--planned)" }}>{int(payLive.accountingMonths.value)}</strong>;{" "}
            {isBlocked(payLive.cashMonths) ? (
              <>
                withdrawable in cash{" "}
                <strong style={{ color: "var(--absent)" }}>
                  never within {int(s.horizonMonths)} months
                </strong>
              </>
            ) : (
              <>
                withdrawable from month{" "}
                <strong style={{ color: "var(--defined)" }}>{int(payLive.cashMonths.value)}</strong>
              </>
            )}
            .{" "}
            <a
              href={href(ANCHORS.cashPayback)}
              className="underline decoration-dotted underline-offset-2"
              style={{ color: "var(--ink-3)" }}
            >
              Why they differ
            </a>
          </>
        )}
      </p>

      {/* ------------------------------------------------------------------ the chart */}
      <div className="mt-10">
        <Chart rows={runs[live]} priceKnown={!isBlocked(price)} />
        <p className="mt-3 text-[12px]" style={{ color: "var(--ink-3)" }}>
          One fixed price for every month; a token locked for two years will not be worth it when it
          unlocks.{" "}
          <a href={href(ANCHORS.fixedPrice)} className="underline decoration-dotted underline-offset-2">
            More
          </a>
        </p>
      </div>

      {/* ------------------------------------------------------------------ diagnostics */}
      <Drawer summary="Timeline detail and the other reward-lock scenario">
        <Line
          label="Accounting payback"
          result={payLive.accountingMonths}
          docs={ANCHORS.accountingPayback}
          mark="E.39"
          suffix="months"
          fallback={`not within ${int(s.horizonMonths)}`}
        />
        <Line
          label="Cash payback, if rewards were liquid"
          result={payLiquid.cashMonths}
          docs={ANCHORS.cashPayback}
          mark="E.39"
          suffix="months"
          fallback={`not within ${int(s.horizonMonths)}`}
        />
        <Line
          label="Still locked at the horizon"
          result={sumLive.stillLockedAtHorizon}
          docs={ANCHORS.cashPayback}
          mark="E.39"
          suffix="FLOP"
        />
        <div
          className="flex flex-wrap items-baseline justify-between gap-x-4 py-2"
          style={{ borderBottom: "1px solid var(--rule)" }}
        >
          <span className="text-[13.5px]" style={{ color: "var(--ink-2)" }}>
            Earned vs withdrawable at month {int(s.horizonMonths)}
          </span>
          <span className="font-mono text-[14px]" style={{ fontFamily: "var(--font-mono)" }}>
            {auto(last.cumulativeEarnedFlop)} / {auto(last.cumulativeLiquidFlop)}
            <Mark bucket="PLANNED" label="E.39" docs={ANCHORS.cashPayback} />
          </span>
        </div>
        <div className="mt-4">
          <Inputs>
            <Field
              id="v-h"
              label="Horizon"
              suffix="months"
              value={String(s.horizonMonths)}
              onChange={(v) =>
                set({ horizonMonths: v === "" ? 36 : Math.max(1, Math.floor(Number(v))) })
              }
            />
            <Field
              id="v-exit"
              label="Stop validating at"
              suffix="month"
              value={s.exitAtMonth === undefined ? "" : String(s.exitAtMonth)}
              onChange={(v) => set({ exitAtMonth: v === "" ? undefined : Number(v) })}
            />
            <Field
              id="v-bond"
              label="Bond lock"
              suffix="months"
              assumed
              value={s.bondLockMonths === undefined ? "" : String(s.bondLockMonths)}
              onChange={(v) => set({ bondLockMonths: v === "" ? undefined : Number(v) })}
            />
          </Inputs>
        </div>
      </Drawer>

      <Drawer summary="Price, supply and the two genesis figures">
        <Line label="Implied token price" result={price} docs={ANCHORS.price} mark="#1418" suffix="USD" />
        <Line
          label={`Break-even valuation, workbook genesis ${int(GENESIS.workbook.value)}`}
          result={revWorkbook.breakEvenValuation}
          docs={ANCHORS.breakEvenValuation}
          mark="#1418"
          suffix="USD"
        />
        <Line
          label="Break-even token price"
          result={rev.breakEvenPrice}
          docs={ANCHORS.breakEvenPrice}
          mark="yours"
          suffix="USD"
        />
        <Line label="Revenue per year" result={fwd.revenueUsdYear} docs={ANCHORS.net} mark="yours" suffix="USD" />
        <Line
          label="Hardware payback, nominal"
          result={fwd.paybackMonths}
          docs={ANCHORS.accountingPayback}
          mark="yours"
          suffix="months"
          fallback="never"
        />
        <div className="mt-4">
          <Inputs>
            <Select
              id="v-mode"
              label="Price input"
              value={s.priceMode}
              onChange={(v) => set({ priceMode: v === "direct" ? "direct" : "valuation" })}
              options={[
                { value: "valuation", label: "valuation" },
                { value: "direct", label: "price" },
              ]}
            />
            {s.priceMode === "direct" ? (
              <Field
                id="v-ppt"
                label="Price per token"
                suffix="USD"
                assumed
                value={s.pricePerToken === undefined ? "" : String(s.pricePerToken)}
                onChange={(v) => set({ pricePerToken: v === "" ? undefined : Number(v) })}
              />
            ) : null}
            <Field
              id="v-year"
              label="Supply anchored to"
              suffix="years"
              value={String(s.anchorYear)}
              onChange={(v) => set({ anchorYear: v === "" ? 1 : Math.max(0, Number(v)) })}
            />
            <Field
              id="v-elec"
              label="Electricity"
              suffix="USD/kWh"
              assumed
              value={s.electricityPrice === undefined ? "" : String(s.electricityPrice)}
              onChange={(v) => set({ electricityPrice: v === "" ? undefined : Number(v) })}
            />
            <Field
              id="v-kw"
              label="Draw"
              suffix="kW"
              assumed
              value={s.powerKw === undefined ? "" : String(s.powerKw)}
              onChange={(v) => set({ powerKw: v === "" ? undefined : Number(v) })}
            />
            <Field
              id="v-am"
              label="Amortisation"
              suffix="months"
              assumed
              value={s.amortMonths === undefined ? "" : String(s.amortMonths)}
              onChange={(v) => set({ amortMonths: v === "" ? undefined : Number(v) })}
            />
          </Inputs>
        </div>
      </Drawer>

      <Drawer summary="Slashing ladder" count={ladder.length}>
        {ladder.map((r) => {
          const denom = s.stake || 1;
          const severity = r.lossPermanent.value / denom;
          const days = isBlocked(r.recoveryDays) ? null : r.recoveryDays.value;
          const width =
            days === null || maxRecovery === 0 ? 0 : Math.max(2, (days / maxRecovery) * 100);
          const colour = r.terminal
            ? "var(--absent)"
            : severity >= 0.05
              ? "var(--planned)"
              : "var(--defined)";
          return (
            <div
              key={r.rung}
              className="grid items-center gap-3 py-1.5"
              style={{ gridTemplateColumns: "minmax(130px,180px) minmax(0,1fr) 74px" }}
            >
              <span className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                {r.label.split(/[—-]/)[0]!.trim()}{" "}
                <span style={{ color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>
                  {pct(severity + r.lossReturned.value / denom).replace(".00", "")}
                </span>
              </span>
              {r.terminal ? (
                <span className="text-[11.5px]" style={{ color: "var(--absent)" }}>
                  terminal
                </span>
              ) : (
                <div
                  className="h-3.5 rounded-[2px]"
                  style={{ width: `${width}%`, background: colour, minWidth: "3px" }}
                />
              )}
              <span
                className="text-right text-[12px]"
                style={{ fontFamily: "var(--font-mono)", color: "var(--ink-2)" }}
              >
                {r.terminal ? "—" : days === null ? "—" : `${dp2(days)}d`}
              </span>
            </div>
          );
        })}
        <p className="mt-2 text-[12px]" style={{ color: "var(--ink-3)" }}>
          Bar length is recovery time, not severity.{" "}
          <a href={href(ANCHORS.slashing)} className="underline decoration-dotted underline-offset-2">
            More
          </a>
        </p>
      </Drawer>

      <Drawer summary="Committee, queue and audit-pool diagnostics">
        <Line
          label="Committee premium"
          result={premium}
          docs={ANCHORS.committeePremium}
          mark="R9.5"
          suffix="FLOP/yr"
        />
        {seat ? <Line label="Your seat rate" result={seat} docs={ANCHORS.seatRate} mark="E.42" /> : null}
        <div
          className="flex flex-wrap items-baseline justify-between gap-x-4 py-2"
          style={{ borderBottom: "1px solid var(--rule)" }}
        >
          <span className="text-[13.5px]" style={{ color: "var(--ink-2)" }}>
            Set-average seat rate
          </span>
          <span className="font-mono text-[14px]" style={{ fontFamily: "var(--font-mono)" }}>
            {pct(baseSeatRate(s.setSize))}
            <Mark bucket="DEFINED" label="R15.4a" docs={ANCHORS.seatRate} />
          </span>
        </div>
        <Line
          label="Audit-pool break-even per turn"
          result={solvency.breakEvenPerTurn}
          docs={ANCHORS.solvency}
          mark="§3.5"
          suffix="FLOP"
        />
        <Line
          label="Reward while queued"
          result={queue.rewardWhileQueued}
          docs={ANCHORS.queue}
          mark="R15.5b"
          suffix="FLOP/yr"
        />
        <Line
          label="Stake frozen while queued"
          result={queue.stakeLocked}
          docs={ANCHORS.queue}
          mark="§15.2"
          suffix="FLOP"
        />
        <Line
          label={`Minimum stake, year ${s.era * 2}`}
          result={minimumStake(s.era * 2)}
          docs={ANCHORS.queue}
          mark="D-0413"
          suffix="FLOP"
        />
        <Line
          label="Maximum delegated"
          result={maxDelegated(s.stake ?? 0)}
          docs={ANCHORS.queue}
          mark="§15.2"
          suffix="FLOP"
        />
        <Line
          label="Spec-implied annual cost"
          result={specImpliedCost()}
          docs={ANCHORS.operatingCost}
          mark="§2.2"
          suffix="FLOP"
        />
        <div className="mt-4">
          <Inputs>
            <Field
              id="v-verd"
              label="Audit verdicts"
              suffix="/yr"
              value={s.verdicts === undefined ? "" : String(s.verdicts)}
              onChange={(v) => set({ verdicts: v === "" ? undefined : Number(v) })}
            />
            <Field
              id="v-turn"
              label="Settlement per turn"
              suffix="FLOP"
              assumed
              value={s.settlePerTurn === undefined ? "" : String(s.settlePerTurn)}
              onChange={(v) => set({ settlePerTurn: v === "" ? undefined : Number(v) })}
            />
            <Field
              id="v-qd"
              label="Days queued"
              value={s.queueDays === undefined ? "" : String(s.queueDays)}
              onChange={(v) => set({ queueDays: v === "" ? undefined : Number(v) })}
            />
          </Inputs>
        </div>
      </Drawer>

      <Drawer summary="Emission schedule">
        <div className="flex flex-wrap items-end gap-4">
          {ERAS.map((e) => {
            const r = blockReward(e).value;
            const h = (r / blockReward(0).value) * 84;
            return (
              <div key={e} className="text-center">
                <div
                  className="text-[11px]"
                  style={{ fontFamily: "var(--font-mono)", color: "var(--ink-3)" }}
                >
                  {auto(r)}
                </div>
                <div
                  className="mx-auto mt-1 w-10 rounded-[2px]"
                  style={{
                    height: `${Math.max(3, h)}px`,
                    background: e === s.era ? "var(--defined)" : "var(--panel-2)",
                  }}
                />
                <div
                  className="mt-1 text-[10.5px]"
                  style={{ fontFamily: "var(--font-mono)", color: "var(--ink-3)" }}
                >
                  {e < MAX_HALVINGS ? `era ${e}` : "floor"}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3">
          <Line
            label="Validator pool at this era"
            result={rolePoolPerYear("validator", s.era)}
            docs={ANCHORS.emission}
            mark="R9.2"
            suffix="FLOP/yr"
          />
        </div>
      </Drawer>

      <Block title="Where this comes from">
        <p className="text-[12.5px]" style={{ color: "var(--ink-3)" }}>
          Every mark above links to the calculation behind it.{" "}
          <a href={href(ANCHORS.findings)} className="underline decoration-dotted underline-offset-2">
            Findings
          </a>{" "}
          ·{" "}
          <a href={href(ANCHORS.params)} className="underline decoration-dotted underline-offset-2">
            Parameter set
          </a>{" "}
          ·{" "}
          <a href={href(ANCHORS.disagreements)} className="underline decoration-dotted underline-offset-2">
            Disagreements
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
