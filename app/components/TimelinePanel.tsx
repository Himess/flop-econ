"use client";

import { useEffect, useMemo } from "react";
import {
  bothScenarios,
  liquiditySummary,
  payback,
  UNBOND_MONTHS,
  type LiquidityScenario,
  type TimelineInputs,
  type TimelineMonth,
} from "@/model/timeline";
import { seatRateFromStake, type ValidatorInputs } from "@/model/validator";
import { annualCostUsd, tokenPrice } from "@/model/valuation";
import { param } from "@/model/params.generated";
import { isBlocked, num, type AssumptionRef, type Computed } from "@/model/types";
import { auto, compact, dp2, int } from "../lib/format";
import type { Scenario } from "../lib/state";
import { Blocked, Cites, Field, FieldRow, Mark, Note, Section } from "./Marks";

const SCENARIOS: LiquidityScenario[] = ["locked_autocompound", "liquid"];
const LABEL: Record<LiquidityScenario, string> = {
  locked_autocompound: "auto-compounded into locked stake",
  liquid: "0% reward lock",
};
const SUBLABEL: Record<LiquidityScenario, string> = {
  locked_autocompound: "current behaviour, D-0408",
  liquid: "workbook target",
};

/** Chart geometry, derived so no literal collides with a protocol figure. */
const CH = { w: 640, h: 210, padL: 8, padR: 8, padT: 14, padB: 22 };

function Chart({ rows }: { rows: TimelineMonth[] }) {
  const n = rows.length;
  const maxY = Math.max(
    1,
    ...rows.map((r) => Math.max(r.cumulativeEarnedUsd, r.cumulativeLiquidUsd, r.cumulativeCostUsd)),
  );
  const x = (m: number) => CH.padL + ((m - 1) / Math.max(1, n - 1)) * (CH.w - CH.padL - CH.padR);
  const y = (v: number) => CH.h - CH.padB - (v / maxY) * (CH.h - CH.padT - CH.padB);
  const path = (get: (r: TimelineMonth) => number) =>
    rows.map((r, i) => `${i === 0 ? "M" : "L"}${x(r.month).toFixed(1)},${y(get(r)).toFixed(1)}`).join(" ");

  const boundaries = rows.filter((r) => r.eraBoundary);

  return (
    <svg
      viewBox={`0 0 ${CH.w} ${CH.h}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Cumulative earned, cumulative withdrawable and cumulative cost in dollars over ${n} months`}
    >
      {boundaries.map((b) => (
        <g key={b.month}>
          <line
            x1={x(b.month)}
            x2={x(b.month)}
            y1={CH.padT}
            y2={CH.h - CH.padB}
            stroke="var(--rule)"
            strokeWidth="1"
          />
          <text
            x={x(b.month) + 4}
            y={CH.padT + 8}
            style={{ fontFamily: "var(--font-mono)", fontSize: "8px", fill: "var(--ink-3)" }}
          >
            halving
          </text>
        </g>
      ))}
      <line
        x1={CH.padL}
        x2={CH.w - CH.padR}
        y1={CH.h - CH.padB}
        y2={CH.h - CH.padB}
        stroke="var(--rule)"
      />
      {/* Encoded by dash pattern as well as colour, like the bucket marks. */}
      <path d={path((r) => r.cumulativeCostUsd)} fill="none" stroke="var(--absent)" strokeWidth="1.5" strokeDasharray="2 3" />
      <path d={path((r) => r.cumulativeEarnedUsd)} fill="none" stroke="var(--planned)" strokeWidth="1.5" strokeDasharray="6 3" />
      <path d={path((r) => r.cumulativeLiquidUsd)} fill="none" stroke="var(--defined)" strokeWidth="2" />
      {[1, Math.round(n / 2), n].map((m) => (
        <text
          key={m}
          x={x(m)}
          y={CH.h - 6}
          textAnchor={m === 1 ? "start" : m === n ? "end" : "middle"}
          style={{ fontFamily: "var(--font-mono)", fontSize: "9px", fill: "var(--ink-3)" }}
        >
          m{m}
        </text>
      ))}
    </svg>
  );
}

function Legend() {
  const item = (dash: string, colour: string, label: string) => (
    <span className="flex items-center gap-1.5">
      <svg width="22" height="8" aria-hidden="true">
        <line x1="0" y1="4" x2="22" y2="4" stroke={colour} strokeWidth="2" strokeDasharray={dash} />
      </svg>
      <span className="text-[11.5px]" style={{ color: "var(--ink-2)" }}>
        {label}
      </span>
    </span>
  );
  return (
    <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1">
      {item("", "var(--defined)", "cumulative withdrawable")}
      {item("6 3", "var(--planned)", "cumulative earned")}
      {item("2 3", "var(--absent)", "cumulative cost")}
    </div>
  );
}

export function TimelinePanel({
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
      ...(s.verdicts === undefined ? {} : { auditVerdictsPerYear: s.verdicts }),
    }),
    [s],
  );

  const price = useMemo(
    () =>
      tokenPrice(
        {
          mode: s.priceMode,
          ...(s.valuationUsd === undefined ? {} : { valuationUsd: s.valuationUsd }),
          ...(s.pricePerToken === undefined ? {} : { pricePerToken: s.pricePerToken }),
          anchorYear: s.anchorYear,
        },
        "params",
      ),
    [s.priceMode, s.valuationUsd, s.pricePerToken, s.anchorYear],
  );
  const annualCost = useMemo(
    () =>
      annualCostUsd({
        electricityPrice: s.electricityPrice,
        powerKw: s.powerKw,
        hardwareUsd: s.hardwareUsd,
        amortMonths: s.amortMonths,
        hostingUsdMonth: s.hostingUsdMonth,
      }),
    [s.electricityPrice, s.powerKw, s.hardwareUsd, s.amortMonths, s.hostingUsdMonth],
  );

  // Monthly fiat outgoings exclude the hardware amortisation line — hardware is paid once, up
  // front, and the timeline charges it in month one rather than smearing it.
  const monthlyCostUsd = useMemo(() => {
    if (s.electricityPrice === undefined || s.powerKw === undefined || s.hostingUsdMonth === undefined) {
      return undefined;
    }
    return (s.electricityPrice * s.powerKw * 24 * 365) / 12 + s.hostingUsdMonth;
  }, [s.electricityPrice, s.powerKw, s.hostingUsdMonth]);

  const inp: TimelineInputs = useMemo(
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

  const runs = useMemo(() => bothScenarios(inp), [inp]);
  const pay = useMemo(
    () =>
      Object.fromEntries(SCENARIOS.map((sc) => [sc, payback(runs[sc], inp, sc)])) as Record<
        LiquidityScenario,
        ReturnType<typeof payback>
      >,
    [runs, inp],
  );
  const summary = useMemo(
    () =>
      Object.fromEntries(SCENARIOS.map((sc) => [sc, liquiditySummary(runs[sc], sc)])) as Record<
        LiquidityScenario,
        ReturnType<typeof liquiditySummary>
      >,
    [runs],
  );

  useEffect(() => {
    const a: AssumptionRef[] = [];
    if (!isBlocked(price)) a.push(...price.assumptions);
    if (!isBlocked(annualCost)) a.push(...annualCost.assumptions);
    if (s.bondLockMonths !== undefined) {
      a.push({
        key: "validator_bond_lock_months",
        value: s.bondLockMonths,
        unit: "months",
        cite: param("validator_bond_lock_months").cite,
        label: "bond lock",
      });
    }
    onAssumptions(a);
  }, [price, annualCost, s.bondLockMonths, onAssumptions]);

  const live = "locked_autocompound" as const;
  const liveSummary = summary[live];
  const livePay = pay[live];

  const monthOf = (c: Computed) => (isBlocked(c) ? null : c.value);

  return (
    <div>
      <FieldRow>
        <Field
          id="t-h"
          label="Horizon"
          suffix="months"
          hint="36 by default, so a two-year lock is inside the view."
          value={String(s.horizonMonths)}
          onChange={(v) => set({ horizonMonths: v === "" ? 36 : Math.max(1, Math.floor(Number(v))) })}
        />
        <Field
          id="t-bond"
          label="Bond lock"
          suffix="months"
          assumed
          cite="not in the yellow paper — community reporting"
          hint="Reporting says the testnet top-1000 bond is locked 24 months. Nothing normative says so."
          value={s.bondLockMonths === undefined ? "" : String(s.bondLockMonths)}
          onChange={(v) => set({ bondLockMonths: v === "" ? undefined : Number(v) })}
        />
        <Field
          id="t-exit"
          label="Stop validating at"
          suffix="month"
          hint="Leave blank to keep validating. Compounded reward is stake — exiting is the only way to realise it."
          value={s.exitAtMonth === undefined ? "" : String(s.exitAtMonth)}
          onChange={(v) => set({ exitAtMonth: v === "" ? undefined : Number(v) })}
        />
      </FieldRow>

      {/* ---------------------------------------------- lead with the liquidity constraint */}
      <Section
        title="Profitable is not the same as paid"
        sub="Rewards do not arrive as spendable income. Under the behaviour the specification currently describes, the validator block-reward leg is swept into locked stake — so it is possible to be profitable on paper for years and unable to withdraw a token."
      >
        <div
          className="px-5 py-4"
          style={{ background: "var(--panel)", borderLeft: "2px solid var(--defined)" }}
        >
          {isBlocked(liveSummary.profitableFrom) ? (
            <p className="text-[15px]">{liveSummary.profitableFrom.message}</p>
          ) : (
            <p className="text-[15px] leading-relaxed">
              Under {LABEL[live]}, you are profitable on paper from{" "}
              <strong style={{ color: "var(--planned)" }}>
                month {int(liveSummary.profitableFrom.value)}
              </strong>
              , and your hardware is recovered in cash{" "}
              {isBlocked(livePay.cashMonths) ? (
                <strong style={{ color: "var(--absent)" }}>
                  not at all within {int(s.horizonMonths)} months
                </strong>
              ) : (
                <strong style={{ color: "var(--defined)" }}>
                  from month {int(livePay.cashMonths.value)}
                </strong>
              )}
              .
            </p>
          )}
          <p className="mt-2 text-[13px]" style={{ color: "var(--ink-2)" }}>
            {auto(liveSummary.stillLockedAtHorizon.value)} FLOP is still locked at month{" "}
            {int(s.horizonMonths)}
            <Mark bucket="PLANNED" label="E.39" />
            <Note summary="why it never unlocks">
              Auto-compounding does not mean the reward matures after a waiting period — it means
              the reward <em>becomes stake</em>. The only way to realise it is to leave the active
              set, and unbonding then takes 21 days measured from when the last open session,
              dispute or audit closes, not from when you ask. Set a month in &ldquo;stop validating
              at&rdquo; above to see the release land.
            </Note>
          </p>
        </div>
        <Blocked result={livePay.cashMonths} />
      </Section>

      {/* ---------------------------------------------- payback, both kinds */}
      <Section
        title="Accounting payback against cash payback"
        sub="The first is what most calculators show. The second is the one you can spend. The distance between them is the point of this section."
      >
        <div className="grid gap-6 md:grid-cols-2">
          {SCENARIOS.map((sc) => (
            <div key={sc}>
              <div className="mb-2 flex flex-wrap items-baseline gap-2">
                <span className="text-[13px]">{LABEL[sc]}</span>
                <Mark bucket="PLANNED" label={SUBLABEL[sc]} />
              </div>
              <div style={{ borderTop: "1px solid var(--rule)" }}>
                {(
                  [
                    ["Accounting payback", pay[sc].accountingMonths],
                    ["Cash payback", pay[sc].cashMonths],
                    ["Gap", pay[sc].gapMonths],
                  ] as const
                ).map(([label, r]) => (
                  <div
                    key={label}
                    className="flex items-baseline justify-between gap-4 py-[11px]"
                    style={{ borderBottom: "1px solid var(--rule)" }}
                  >
                    <span className="text-[14px]" style={{ color: "var(--ink-2)" }}>
                      {label}
                    </span>
                    <span
                      className="whitespace-nowrap font-mono text-[16px]"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {isBlocked(r) ? (
                        <span className="text-[13px]" style={{ color: "var(--absent)" }}>
                          not within {int(s.horizonMonths)} months
                        </span>
                      ) : (
                        <>
                          {monthOf(r) === 0 ? "none" : `${dp2(r.value)} months`}
                          <Mark bucket="ABSENT" label="assumed" />
                        </>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ---------------------------------------------- chart */}
      <Section
        title="Month by month"
        sub="Cumulative earned, cumulative withdrawable and cumulative cost, in dollars. Lines differ by dash pattern as well as colour."
      >
        <div className="grid gap-6 md:grid-cols-2">
          {SCENARIOS.map((sc) => (
            <div key={sc}>
              <div className="mb-1 flex flex-wrap items-baseline gap-2">
                <span className="text-[13px]">{LABEL[sc]}</span>
                <Mark bucket="PLANNED" label={SUBLABEL[sc]} />
              </div>
              <Chart rows={runs[sc]} />
              <Legend />
              <p className="mt-2 text-[12px]" style={{ color: "var(--ink-3)" }}>
                At month {int(s.horizonMonths)}: earned {compact(runs[sc][runs[sc].length - 1]!.cumulativeEarnedFlop)} FLOP,
                withdrawable {compact(runs[sc][runs[sc].length - 1]!.cumulativeLiquidFlop)} FLOP.
              </p>
            </div>
          ))}
        </div>
        <p
          className="mt-5 max-w-[74ch] px-4 py-3 text-[12.5px]"
          style={{ background: "var(--panel)", borderLeft: "2px dotted var(--absent)", color: "var(--ink-2)" }}
        >
          <strong>Every dollar figure on this timeline uses one fixed price for every month.</strong>{" "}
          A token locked for two years will not be worth today&rsquo;s assumption when it unlocks.
          This tool does not model a price path and does not try to — that exposure is the risk this
          section exists to reveal, not one it can resolve. Read the dollar lines as &ldquo;at
          today&rsquo;s assumed price&rdquo;, and the FLOP figures as the quantities actually owed.
        </p>
      </Section>

      {/* ---------------------------------------------- mechanics */}
      <Section
        title="What gates withdrawal"
        sub="Every rule here is in the specification, with one exception that is marked."
        last
      >
        <div style={{ borderTop: "1px solid var(--rule)" }}>
          {[
            {
              k: "Validator unbonding",
              v: `${dp2(UNBOND_MONTHS * (365 / 12))} days`,
              m: "DEFINED" as const,
              c: param("validator_unbonding_blocks").cite,
            },
            {
              k: "Slash-lock",
              v: "frozen while any session, dispute or audit is open",
              m: "DEFINED" as const,
              c: param("validator_unbonding_slash_lock").cite,
            },
            {
              k: "Ejection cooldown",
              v: `${int(num(param("ejection_cooldown_blocks")) / 86_400)} days`,
              m: "DEFINED" as const,
              c: param("ejection_cooldown_blocks").cite,
            },
            {
              k: "Reward liquidity",
              v: "unresolved — both scenarios shown",
              m: "PLANNED" as const,
              c: param("validator_reward_liquidity").cite,
            },
            {
              k: "Bond lock",
              v: "not in the specification",
              m: "ABSENT" as const,
              c: param("validator_bond_lock_months").cite,
            },
          ].map((row) => (
            <div
              key={row.k}
              className="flex flex-wrap items-baseline justify-between gap-3 py-[11px]"
              style={{ borderBottom: "1px solid var(--rule)" }}
            >
              <span className="text-[14px]" style={{ color: "var(--ink-2)" }}>
                {row.k}
              </span>
              <span className="flex items-baseline gap-2">
                <span className="text-[13px]" style={{ color: "var(--ink)" }}>
                  {row.v}
                </span>
                <Mark bucket={row.m} />
                <span
                  className="text-[10.5px]"
                  style={{ fontFamily: "var(--font-mono)", color: "var(--ink-3)" }}
                >
                  <Cites cites={[row.c]} />
                </span>
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 max-w-[74ch] text-[12.5px]" style={{ color: "var(--ink-3)" }}>
          The 21 days do not begin when you ask to unbond. M11 states the clock is frozen while any
          session, dispute or audit is open and the cooldown runs after the last one closes, so the
          real wait is 21 days after your last open item clears.
        </p>
      </Section>
    </div>
  );
}
