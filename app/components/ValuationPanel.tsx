"use client";

import { useEffect, useMemo } from "react";
import {
  annualCostUsd,
  forward,
  genesisSpread,
  GENESIS,
  outstandingSupply,
  reverse,
  sensitivity,
  tokenPrice,
  VALUATION_RULER,
  type CostInputs,
  type GenesisScenario,
  type ValuationInputs,
} from "@/model/valuation";
import { breakEven, seatRateFromStake, type ValidatorInputs } from "@/model/validator";
import { isBlocked, type AssumptionRef, type Computed } from "@/model/types";
import { auto, compact, dp2, int, pct } from "../lib/format";
import type { Scenario } from "../lib/state";
import { Blocked, Cites, Field, FieldRow, Mark, Note, Row, Section, Select } from "./Marks";

const SCENARIOS: GenesisScenario[] = ["params", "workbook"];

/** A USD figure. Always dotted — a dollar value is never a specification parameter. */
function Usd({ r, big }: { r: Computed; big?: boolean }) {
  if (isBlocked(r)) {
    return (
      <span className="text-[13px]" style={{ color: "var(--absent)" }}>
        needs an input
      </span>
    );
  }
  return (
    <span
      className="whitespace-nowrap font-mono"
      style={{ fontFamily: "var(--font-mono)", fontSize: big ? "26px" : "16px" }}
      title={r.derivation ?? ""}
    >
      ${auto(r.value)}
      <Mark bucket="ABSENT" label="assumed" />
    </span>
  );
}

export function ValuationPanel({
  s,
  set,
  onAssumptions,
}: {
  s: Scenario;
  set: (patch: Partial<Scenario>) => void;
  onAssumptions: (a: AssumptionRef[]) => void;
}) {
  // Revenue in FLOP comes from the validator model — spec-grounded, and the only part of this
  // tab that is.
  const vInputs: ValidatorInputs = useMemo(
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
  const be = useMemo(() => breakEven(vInputs), [vInputs]);
  const revenueFlop = isBlocked(be.revenue) ? 0 : be.revenue.value;

  const inp: ValuationInputs = useMemo(
    () => ({
      mode: s.priceMode,
      ...(s.valuationUsd === undefined ? {} : { valuationUsd: s.valuationUsd }),
      ...(s.pricePerToken === undefined ? {} : { pricePerToken: s.pricePerToken }),
      anchorYear: s.anchorYear,
    }),
    [s.priceMode, s.valuationUsd, s.pricePerToken, s.anchorYear],
  );

  const costs: CostInputs = useMemo(
    () => ({
      electricityPrice: s.electricityPrice,
      powerKw: s.powerKw,
      hardwareUsd: s.hardwareUsd,
      amortMonths: s.amortMonths,
      hostingUsdMonth: s.hostingUsdMonth,
    }),
    [s.electricityPrice, s.powerKw, s.hardwareUsd, s.amortMonths, s.hostingUsdMonth],
  );

  const cost = useMemo(() => annualCostUsd(costs), [costs]);
  const rev = useMemo(
    () => Object.fromEntries(SCENARIOS.map((sc) => [sc, reverse(revenueFlop, costs, s.anchorYear, sc)])),
    [revenueFlop, costs, s.anchorYear],
  ) as Record<GenesisScenario, ReturnType<typeof reverse>>;
  const fwd = useMemo(
    () => Object.fromEntries(SCENARIOS.map((sc) => [sc, forward(revenueFlop, inp, costs, sc)])),
    [revenueFlop, inp, costs],
  ) as Record<GenesisScenario, ReturnType<typeof forward>>;
  const spread = useMemo(() => genesisSpread(inp), [inp]);
  const ranked = useMemo(
    () => sensitivity(revenueFlop, inp, costs, "params"),
    [revenueFlop, inp, costs],
  );

  useEffect(() => {
    const a: AssumptionRef[] = [];
    if (!isBlocked(cost)) a.push(...cost.assumptions);
    const p = tokenPrice(inp, "params");
    if (!isBlocked(p)) a.push(...p.assumptions);
    onAssumptions(a);
  }, [cost, inp, onAssumptions]);

  const anchorLabel = `year ${s.anchorYear}`;

  return (
    <div>
      <FieldRow>
        <Select
          id="x-mode"
          label="Input mode"
          value={s.priceMode}
          onChange={(v) => set({ priceMode: v === "direct" ? "direct" : "valuation" })}
          options={[
            { value: "valuation", label: "Enter a valuation" },
            { value: "direct", label: "Enter a price directly" },
          ]}
        />
        {s.priceMode === "valuation" ? (
          <Field
            id="x-val"
            label={`Network valuation at ${anchorLabel}`}
            suffix="USD"
            assumed
            cite="your assumption — the spec has no view on valuation"
            value={s.valuationUsd === undefined ? "" : String(s.valuationUsd)}
            onChange={(v) => set({ valuationUsd: v === "" ? undefined : Number(v) })}
          />
        ) : (
          <Field
            id="x-ppt"
            label="Price per token"
            suffix="USD"
            assumed
            cite="your assumption — the spec has no view on price"
            value={s.pricePerToken === undefined ? "" : String(s.pricePerToken)}
            onChange={(v) => set({ pricePerToken: v === "" ? undefined : Number(v) })}
          />
        )}
        <Field
          id="x-year"
          label="Supply anchored to"
          suffix="years"
          hint="FLOP has no maximum supply — after five halvings the reward holds at 3 FLOP in perpetuity, so there is no fully-diluted point to anchor on."
          value={String(s.anchorYear)}
          onChange={(v) => set({ anchorYear: v === "" ? 1 : Math.max(0, Number(v)) })}
        />
      </FieldRow>

      {/* ---------------------------------------------------- lead with the threshold */}
      <Section
        title="The threshold"
        sub="Below this, participating costs you money. This is the half of the answer that carries no view on where the market goes — a forecast can be wrong; a break-even cannot."
      >
        <div
          className="grid gap-px overflow-hidden rounded-[3px]"
          style={{
            gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
            background: "var(--rule)",
            border: "1px solid var(--rule)",
          }}
        >
          {SCENARIOS.map((sc) => (
            <div key={sc} className="panel-print px-5 py-4" style={{ background: "var(--panel)" }}>
              <div className="mb-1 flex items-baseline gap-2">
                <span className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                  genesis {int(GENESIS[sc].value)}
                </span>
                <Mark
                  bucket={sc === "params" ? "DEFINED" : "PLANNED"}
                  label={sc === "params" ? "live" : "unratified"}
                />
              </div>
              <div className="mb-3 text-[11.5px]" style={{ color: "var(--ink-3)" }}>
                {GENESIS[sc].label}
              </div>

              <div className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>
                Break-even valuation
              </div>
              <div className="mt-0.5">
                <Usd r={rev[sc].breakEvenValuation} big />
              </div>
              <p className="mt-2 max-w-[40ch] text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                {isBlocked(rev[sc].breakEvenValuation)
                  ? rev[sc].breakEvenValuation.message
                  : `With these costs, this breaks even if FLOP reaches at least this valuation by ${anchorLabel}. Below it, you are paying to participate.`}
              </p>

              <div className="mt-4 text-[11.5px]" style={{ color: "var(--ink-3)" }}>
                Break-even token price
              </div>
              <div className="mt-0.5">
                <Usd r={rev[sc].breakEvenPrice} />
              </div>

              <div className="mt-3 text-[11.5px]" style={{ color: "var(--ink-3)" }}>
                Supply outstanding at {anchorLabel}: {compact(rev[sc].supplyAtAnchor.value)} FLOP
              </div>
            </div>
          ))}
        </div>
        <Blocked result={rev.params.breakEvenValuation} />
        <p className="mt-3 max-w-[74ch] text-[12.5px]" style={{ color: "var(--ink-3)" }}>
          The break-even <em>price</em> is identical in both columns — it depends only on your costs
          and the FLOP you earn. The break-even <em>valuation</em> is not, because it multiplies that
          price by a supply the two scenarios disagree about. That disagreement is #1418, and it has
          no ratifying decision.
        </p>
      </Section>

      {/* ---------------------------------------------------- forward */}
      <Section
        title="Forward, if you supply a valuation"
        sub="What the same position earns at a price you name. This half is a projection and is only as good as the number you put in."
      >
        <div className="grid gap-6 md:grid-cols-2">
          {SCENARIOS.map((sc) => (
            <div key={sc}>
              <div className="mb-2 flex items-baseline gap-2">
                <span className="text-[13px]">genesis {compact(GENESIS[sc].value)}</span>
                <Mark
                  bucket={sc === "params" ? "DEFINED" : "PLANNED"}
                  label={sc === "params" ? "live" : "unratified"}
                />
              </div>
              <div style={{ borderTop: "1px solid var(--rule)" }}>
                <div
                  className="flex items-baseline justify-between gap-4 py-[11px]"
                  style={{ borderBottom: "1px solid var(--rule)" }}
                >
                  <span className="text-[14px]" style={{ color: "var(--ink-2)" }}>
                    Implied token price
                  </span>
                  <Usd r={fwd[sc].price} />
                </div>
                <div
                  className="flex items-baseline justify-between gap-4 py-[11px]"
                  style={{ borderBottom: "1px solid var(--rule)" }}
                >
                  <span className="text-[14px]" style={{ color: "var(--ink-2)" }}>
                    Revenue per year
                  </span>
                  <Usd r={fwd[sc].revenueUsdYear} />
                </div>
                <div
                  className="flex items-baseline justify-between gap-4 py-[11px]"
                  style={{ borderBottom: "1px solid var(--rule)" }}
                >
                  <span className="text-[14px]" style={{ color: "var(--ink-2)" }}>
                    Revenue per month
                  </span>
                  <Usd r={fwd[sc].revenueUsdMonth} />
                </div>
                <div
                  className="flex items-baseline justify-between gap-4 py-[11px]"
                  style={{ borderBottom: "1px solid var(--rule)" }}
                >
                  <span className="text-[14px]" style={{ color: "var(--ink-2)" }}>
                    Net after costs
                  </span>
                  <Usd r={fwd[sc].netUsdYear} />
                </div>
                <div className="flex items-baseline justify-between gap-4 py-[11px]">
                  <span className="text-[14px]" style={{ color: "var(--ink-2)" }}>
                    Hardware payback
                  </span>
                  {isBlocked(fwd[sc].paybackMonths) ? (
                    <span className="text-[13px]" style={{ color: "var(--absent)" }}>
                      never at these figures
                    </span>
                  ) : (
                    <span className="font-mono text-[16px]" style={{ fontFamily: "var(--font-mono)" }}>
                      {dp2(fwd[sc].paybackMonths.value)} months
                      <Mark bucket="ABSENT" label="assumed" />
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        {!isBlocked(spread) ? (
          <p className="mt-4 max-w-[74ch] text-[13px]" style={{ color: "var(--ink-2)" }}>
            At the same valuation the two genesis figures put the token price{" "}
            <strong>{pct(Math.abs(spread.value))}</strong> apart.
            <Note summary="why this matters here">
              The specification ratifies a genesis supply of {int(GENESIS.params.value)}. The
              tokenomics workbook behind FLOP&rsquo;s own calculator restated the pool to{" "}
              {int(GENESIS.workbook.value)} and the calculator uses that figure; landing it in the
              parameters is blocked with no ratifying decision (#1418, stated on
              flop.finance/intro/revenue/). Dividing one valuation by two different supplies gives
              two different prices, so the unratified figure moves your own break-even threshold —
              which is why both columns are always shown rather than one being picked for you.{" "}
              <strong>The gap shrinks as the anchor moves out.</strong> The two genesis figures are
              about 41% apart on their own, but era-0 issuance is larger than genesis itself, so by
              year 1 the difference in outstanding supply is nearer 17%, and smaller again after
              that. Move the anchor above and watch this number fall.
            </Note>
          </p>
        ) : null}
      </Section>

      {/* ---------------------------------------------------- costs */}
      <Section
        title="Your costs"
        sub="All user-supplied, none from the specification. These replace the FLOP-denominated cost figures on the Validator tab rather than adding to them — enter your costs in one place or the other, not both."
      >
        <FieldRow>
          <Field
            id="x-elec"
            label="Electricity price"
            suffix="USD/kWh"
            assumed
            value={s.electricityPrice === undefined ? "" : String(s.electricityPrice)}
            onChange={(v) => set({ electricityPrice: v === "" ? undefined : Number(v) })}
          />
          <Field
            id="x-kw"
            label="Continuous draw"
            suffix="kW"
            assumed
            value={s.powerKw === undefined ? "" : String(s.powerKw)}
            onChange={(v) => set({ powerKw: v === "" ? undefined : Number(v) })}
          />
          <Field
            id="x-hw"
            label="Hardware cost"
            suffix="USD"
            assumed
            value={s.hardwareUsd === undefined ? "" : String(s.hardwareUsd)}
            onChange={(v) => set({ hardwareUsd: v === "" ? undefined : Number(v) })}
          />
          <Field
            id="x-am"
            label="Amortisation"
            suffix="months"
            assumed
            value={s.amortMonths === undefined ? "" : String(s.amortMonths)}
            onChange={(v) => set({ amortMonths: v === "" ? undefined : Number(v) })}
          />
          <Field
            id="x-host"
            label="Hosting or colocation"
            suffix="USD/month"
            assumed
            value={s.hostingUsdMonth === undefined ? "" : String(s.hostingUsdMonth)}
            onChange={(v) => set({ hostingUsdMonth: v === "" ? undefined : Number(v) })}
          />
        </FieldRow>
        <div className="mt-4">
          <Row label="FLOP earned per year, from the Validator tab" result={be.revenue} mark="R9.5" />
          <div className="flex items-baseline justify-between gap-4 py-[11px]">
            <span className="text-[14px]" style={{ color: "var(--ink)" }}>
              Total annual cost
            </span>
            <Usd r={cost} />
          </div>
          <Blocked result={cost} />
        </div>
        <p className="mt-3 text-[12.5px]" style={{ color: "var(--ink-3)" }}>
          Figures are in USD. Working in another currency is a formatting change this does not make;
          convert at your own rate.
        </p>
      </Section>

      {/* ---------------------------------------------------- sensitivity */}
      <Section
        title="Which assumption moves the answer most"
        sub="Each input perturbed alone by a fifth, ranked by how far annual net moves. A point estimate built on six assumptions is not a result; this is what says which one to worry about."
      >
        {ranked.length === 0 ? (
          <p className="text-[13px]" style={{ color: "var(--ink-3)" }}>
            Supply the costs and a valuation above and the ranking appears here.
          </p>
        ) : (
          <div>
            {ranked.map((r) => (
              <div
                key={r.key}
                className="grid items-center gap-3.5 py-[7px]"
                style={{ gridTemplateColumns: "minmax(140px,190px) minmax(0,1fr) 96px" }}
              >
                <span className="text-[13px]" style={{ color: "var(--ink-2)" }}>
                  {r.label}
                </span>
                <div
                  className="h-4 rounded-[2px]"
                  style={{
                    width: `${Math.max(2, (r.effect / ranked[0]!.effect) * 100)}%`,
                    background: r.direction === "raises" ? "var(--defined)" : "var(--planned)",
                  }}
                  title={`${r.direction} net when increased`}
                />
                <span
                  className="text-right text-[12.5px]"
                  style={{ fontFamily: "var(--font-mono)", color: "var(--ink-2)" }}
                >
                  ${compact(r.effect)}
                </span>
              </div>
            ))}
            <p className="mt-3 max-w-[74ch] text-[12px]" style={{ color: "var(--ink-3)" }}>
              One input at a time, so interactions between them are not captured. Teal raises net
              when increased; amber lowers it.
            </p>
          </div>
        )}
      </Section>

      {/* ---------------------------------------------------- ruler */}
      <Section
        title="Placing your guess"
        sub="A bare scale, not a recommendation. There is no suggested value and no default."
        last
      >
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
          {VALUATION_RULER.map((v) => {
            const here =
              s.priceMode === "valuation" &&
              s.valuationUsd !== undefined &&
              s.valuationUsd >= v &&
              s.valuationUsd < v * 10;
            return (
              <span
                key={v}
                className="font-mono text-[13px]"
                style={{
                  fontFamily: "var(--font-mono)",
                  color: here ? "var(--defined)" : "var(--ink-3)",
                  borderBottom: here ? "1.5px solid var(--defined)" : "1px solid var(--rule)",
                }}
              >
                ${compact(v)}
              </span>
            );
          })}
        </div>
        <p className="mt-3 max-w-[74ch] text-[12.5px]" style={{ color: "var(--ink-3)" }}>
          Named comparable networks were left out on purpose. Quoting another network&rsquo;s market
          capitalisation would put a live market figure inside a tool whose whole claim is that
          every number traces to a citable source — it would be stale within a day and could not be
          checked against the specification. The decades do the placing job without pretending to a
          precision they have not got.
        </p>
      </Section>
    </div>
  );
}

export { outstandingSupply };
