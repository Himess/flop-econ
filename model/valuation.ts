/**
 * The valuation layer: FLOP-denominated results converted into dollars, and the reverse.
 *
 * Everything here rests on figures the specification has no view on — a token price, a network
 * valuation, an electricity tariff. So every output in this module is bucketed ABSENT, always,
 * regardless of how well-founded the FLOP-denominated input was. A valuation never wears a
 * DEFINED mark.
 *
 * The supply side is different: it is computed from the emission schedule, which is DEFINED and
 * pinned by emission.test.ts. Only the genesis figure is contested, and that contest is the
 * point. It has now forked twice. Appendix A ratifies 3,500,000,000 under D-0438; a FLOP
 * tokenomics graphic published 2026-09-10 states 4,400,000,000, with a validator airdrop roughly
 * four times Appendix A's and no ratifying decision. The tool models the announced figure by
 * operator decision and computes the ratified one beside it, always, so the gap is visible rather
 * than chosen silently. The announced column can never read DEFINED.
 */
import { param } from "./params.generated";
import { blockReward, subsidyPerBlock, BLOCKS_PER_YEAR, eraAtBlock } from "./emission";
import { blocked, figure, isBlocked, num, type AssumptionRef, type Computed, type Figure } from "./types";

const MONTHS_PER_YEAR = 12;

// ---------------------------------------------------------------------------- supply

/**
 * Which genesis figure to divide by.
 *
 * `announced` is the default the tool now shows, by operator decision: a FLOP tokenomics graphic
 * published 2026-09-10 states an airdrop of 4.4bn with validators at 1.20bn. It is PLANNED, never
 * DEFINED — it carries no ratifying decision, and Appendix A still reads 3,500,000,000 under
 * D-0438. `ratified` is that Appendix A value, kept computable beside it so the gap between what
 * was announced and what is ratified is always one click away rather than a choice this tool made
 * silently.
 */
export type GenesisScenario = "announced" | "ratified";

export const GENESIS: Record<GenesisScenario, { value: number; label: string; cite: string }> = {
  ratified: {
    value: num(param("genesis_supply")),
    label: "ratified (D-0438)",
    cite: param("genesis_supply").cite,
  },
  announced: {
    /**
     * The announced figure, and the tool's default.
     *
     * It leads the specification rather than following it, exactly as 3,500,000,000 did before
     * D-0438 ratified it nineteen days later. Modelling it is an operator decision; marking it
     * DEFINED would not be, so it stays PLANNED and every figure derived from it inherits that.
     */
    value: num(param("genesis_supply_announced")),
    label: "announced 2026-09-10",
    cite: param("genesis_supply_announced").cite,
  },
};

/**
 * Total FLOP minted over `years` from genesis: block reward plus the Labs/Foundation subsidy,
 * both of which mint and therefore both of which dilute.
 *
 * Integrated era by era rather than assumed flat, because a horizon crossing a halving boundary
 * would otherwise be wrong by up to a factor of two.
 */
export function cumulativeEmission(years: number): Figure {
  if (years < 0) throw new Error(`years must be >= 0, got ${years}`);
  const totalBlocks = Math.round(years * BLOCKS_PER_YEAR);
  let minted = 0;
  let done = 0;
  while (done < totalBlocks) {
    const era = eraAtBlock(done);
    const eraEnd = (era + 1) * num(param("halving_interval_blocks"));
    const span = Math.min(eraEnd, totalBlocks) - done;
    minted += span * (blockReward(era).value + subsidyPerBlock(era).value);
    done += span;
  }
  return figure({
    value: minted,
    unit: "FLOP",
    buckets: ["DEFINED"],
    cites: [param("initial_block_reward").cite, param("subsidy_per_block_per_recipient").cite],
    derivation:
      `block reward + Labs/Foundation subsidy over ${totalBlocks.toLocaleString("en-US")} blocks, ` +
      `integrated across halving boundaries. Both mint, so both dilute.`,
  });
}

/**
 * Tokens outstanding at year `t` under one genesis scenario.
 *
 * OUTSTANDING, not circulating. Circulating cannot be derived honestly: E.38 states the path
 * distributing genesis_supply "has no normative section", the agent leg unlocks against spend
 * with the mechanism itself undecided, and the validator cohort's conversion is open. Rather
 * than pick one silently, this returns outstanding and the UI says so.
 */
export function outstandingSupply(years: number, scenario: GenesisScenario): Figure {
  const g = GENESIS[scenario];
  const emitted = cumulativeEmission(years);
  const isRatified = scenario === "ratified";
  return figure({
    value: g.value + emitted.value,
    unit: "FLOP",
    // Only the Appendix A value can read DEFINED. The announced figure has no ratifying decision,
    // so every supply, price and valuation figure computed from it inherits PLANNED.
    buckets: isRatified ? ["DEFINED"] : ["PLANNED"],
    cites: [g.cite, ...emitted.cites],
    derivation:
      `genesis ${g.value.toLocaleString("en-US")} (${g.label}) + ` +
      `${Math.round(emitted.value).toLocaleString("en-US")} minted over ${years} year(s). ` +
      `Outstanding, not circulating — E.38 leaves the distribution path unspecified.`,
  });
}

// ---------------------------------------------------------------------------- price

export type PriceMode = "valuation" | "direct";

export interface ValuationInputs {
  mode: PriceMode;
  /** Valuation mode: network valuation in USD. */
  valuationUsd?: number;
  /** Direct mode: tokens outstanding the user has in mind. */
  tokensOutstanding?: number;
  /** Direct mode: price per token in USD. */
  pricePerToken?: number;
  /** Year the valuation is anchored to. FLOP has no maximum supply, so there is no FDV point. */
  anchorYear: number;
}

function priceAssumption(label: string, value: number, unit: string): AssumptionRef {
  return {
    key: label === "valuation" ? "network_valuation_usd" : "token_price_usd",
    value,
    unit,
    cite: "your assumption — the specification has no view on price or valuation",
    label: label === "valuation" ? "network valuation" : "token price",
    kind: "estimate",
  };
}

/**
 * Token price in USD under one genesis scenario.
 *
 * Valuation mode divides the supplied valuation by outstanding supply at the anchor year — and
 * which supply that is, is the whole point of running both scenarios.
 * Direct mode takes the price as given and ignores the supply model entirely.
 */
export function tokenPrice(inp: ValuationInputs, scenario: GenesisScenario): Computed {
  if (inp.mode === "direct") {
    if (inp.pricePerToken === undefined) {
      return blocked([
        {
          key: "token_price_usd",
          cite: "your assumption — the specification has no view on price",
          label: "token price",
        },
      ]);
    }
    return figure({
      value: inp.pricePerToken,
      unit: "USD/FLOP",
      cites: [],
      assumptions: [priceAssumption("price", inp.pricePerToken, "USD/FLOP")],
      derivation: "entered directly; the supply model is not consulted in this mode",
    });
  }

  if (inp.valuationUsd === undefined) {
    return blocked([
      {
        key: "network_valuation_usd",
        cite: "your assumption — the specification has no view on valuation",
        label: "network valuation",
      },
    ]);
  }
  const supply = outstandingSupply(inp.anchorYear, scenario);
  return figure({
    value: inp.valuationUsd / supply.value,
    unit: "USD/FLOP",
    buckets: [supply.bucket],
    cites: supply.cites,
    assumptions: [priceAssumption("valuation", inp.valuationUsd, "USD")],
    derivation:
      `$${inp.valuationUsd.toLocaleString("en-US")} / ${Math.round(supply.value).toLocaleString("en-US")} FLOP ` +
      `outstanding at year ${inp.anchorYear} (${GENESIS[scenario].label})`,
  });
}

/** How far apart the two genesis scenarios put the price, as a fraction. */
export function genesisSpread(inp: ValuationInputs): Computed {
  const a = tokenPrice(inp, "announced");
  const b = tokenPrice(inp, "ratified");
  if (isBlocked(a)) return a;
  if (isBlocked(b)) return b;
  if (b.value === 0) return blocked([{ key: "genesis_spread", cite: "-", label: "a non-zero price" }]);
  return figure({
    value: a.value / b.value - 1,
    unit: "fraction",
    buckets: ["PLANNED"],
    cites: [GENESIS.announced.cite],
    derivation:
      `announced price / ratified price - 1. The announced genesis is the larger pool, so it ` +
      `dilutes the same valuation across more tokens and its implied price is the lower one.`,
  });
}

// ---------------------------------------------------------------------------- costs

export interface CostInputs {
  /** USD per kWh. */
  electricityPrice?: number;
  /** Continuous draw in kW. */
  powerKw?: number;
  /** Hardware capital cost in USD. */
  hardwareUsd?: number;
  /** Amortisation period in months. */
  amortMonths?: number;
  /** Hosting or colocation, USD per month. */
  hostingUsdMonth?: number;
}

const HOURS_PER_YEAR = 24 * 365;

/** Annual operating cost in USD. Blocks on any component the user has not supplied. */
export function annualCostUsd(c: CostInputs): Computed {
  const missing: { key: string; cite: string; label: string }[] = [];
  const need = (v: number | undefined, key: string, label: string) => {
    if (v === undefined) {
      missing.push({ key, cite: "your assumption — not a protocol figure", label });
      return 0;
    }
    return v;
  };

  const price = need(c.electricityPrice, "electricity_price_usd_kwh", "electricity price");
  const kw = need(c.powerKw, "power_draw_kw", "power draw");
  const hw = need(c.hardwareUsd, "hardware_cost_usd", "hardware cost");
  const months = need(c.amortMonths, "amortisation_months", "amortisation period");
  const hosting = need(c.hostingUsdMonth, "hosting_usd_month", "hosting cost");
  if (missing.length > 0) return blocked(missing);
  if (months <= 0) {
    return blocked([
      {
        key: "amortisation_months",
        cite: "your assumption",
        label: "amortisation period greater than zero",
      },
    ]);
  }

  const energy = price * kw * HOURS_PER_YEAR;
  const amort = (hw / months) * MONTHS_PER_YEAR;
  const host = hosting * MONTHS_PER_YEAR;

  const assumptions: AssumptionRef[] = [
    { key: "electricity_price_usd_kwh", value: price, unit: "USD/kWh", cite: "your tariff", label: "electricity price", kind: "physical" },
    { key: "power_draw_kw", value: kw, unit: "kW", cite: "derived from your cards", label: "power draw", kind: "physical" },
    { key: "hardware_cost_usd", value: hw, unit: "USD", cite: "what you paid", label: "hardware cost", kind: "physical" },
    { key: "amortisation_months", value: months, unit: "months", cite: "your decision", label: "amortisation period", kind: "physical" },
    { key: "hosting_usd_month", value: hosting, unit: "USD/month", cite: "your contract", label: "hosting cost", kind: "physical" },
  ];

  return figure({
    value: energy + amort + host,
    unit: "USD/year",
    cites: [],
    assumptions,
    derivation:
      `energy ${Math.round(energy).toLocaleString("en-US")} (${kw} kW x ${HOURS_PER_YEAR.toLocaleString("en-US")} h x $${price}) ` +
      `+ amortisation ${Math.round(amort).toLocaleString("en-US")} ($${hw.toLocaleString("en-US")} over ${months} months) ` +
      `+ hosting ${Math.round(host).toLocaleString("en-US")}. DA custody and serving are inside ` +
      `the §15.3 profile — its 4 TB NVMe and 1 Gbps unmetered link — so there is no separate line.`,
  });
}

// ---------------------------------------------------------------------------- forward

export interface ForwardResult {
  price: Computed;
  revenueUsdYear: Computed;
  revenueUsdMonth: Computed;
  costUsdYear: Computed;
  netUsdYear: Computed;
  paybackMonths: Computed;
}

/** Forward direction: given a valuation, what does this earn. */
export function forward(
  revenueFlopYear: number,
  inp: ValuationInputs,
  costs: CostInputs,
  scenario: GenesisScenario,
): ForwardResult {
  const price = tokenPrice(inp, scenario);
  const cost = annualCostUsd(costs);

  const revYear: Computed = isBlocked(price)
    ? price
    : figure({
        value: revenueFlopYear * price.value,
        unit: "USD/year",
        cites: price.cites,
        assumptions: price.assumptions,
        derivation: `${Math.round(revenueFlopYear).toLocaleString("en-US")} FLOP/yr x $${price.value.toPrecision(4)}`,
      });

  const revMonth: Computed = isBlocked(revYear)
    ? revYear
    : figure({
        value: revYear.value / MONTHS_PER_YEAR,
        unit: "USD/month",
        cites: revYear.cites,
        assumptions: revYear.assumptions,
        derivation: `annual / ${MONTHS_PER_YEAR}`,
      });

  const net: Computed =
    isBlocked(revYear) || isBlocked(cost)
      ? isBlocked(revYear)
        ? revYear
        : cost
      : figure({
          value: revYear.value - cost.value,
          unit: "USD/year",
          cites: [...revYear.cites, ...cost.cites],
          assumptions: [...revYear.assumptions, ...cost.assumptions],
          derivation: `revenue ${Math.round(revYear.value).toLocaleString("en-US")} - cost ${Math.round(cost.value).toLocaleString("en-US")}`,
        });

  let payback: Computed;
  if (isBlocked(net) || costs.hardwareUsd === undefined) {
    payback = isBlocked(net)
      ? net
      : blocked([{ key: "hardware_cost_usd", cite: "your assumption", label: "hardware cost" }]);
  } else if (net.value <= 0) {
    payback = blocked([
      {
        key: "payback",
        cite: "computed",
        label: "a positive net income — at these figures the hardware never pays back",
      },
    ]);
  } else {
    payback = figure({
      value: (costs.hardwareUsd / net.value) * MONTHS_PER_YEAR,
      unit: "months",
      cites: net.cites,
      assumptions: net.assumptions,
      derivation: `$${costs.hardwareUsd.toLocaleString("en-US")} / net ${Math.round(net.value).toLocaleString("en-US")} per year`,
    });
  }

  return { price, revenueUsdYear: revYear, revenueUsdMonth: revMonth, costUsdYear: cost, netUsdYear: net, paybackMonths: payback };
}

// ---------------------------------------------------------------------------- reverse

export interface ReverseResult {
  breakEvenPrice: Computed;
  breakEvenValuation: Computed;
  supplyAtAnchor: Figure;
}

/**
 * Reverse direction, and the more useful half: the threshold below which participating costs
 * money. Unlike a forward projection this carries no view on where the market goes — it is a
 * decision criterion, and it cannot be wrong in the way a forecast can.
 */
export function reverse(
  revenueFlopYear: number,
  costs: CostInputs,
  anchorYear: number,
  scenario: GenesisScenario,
): ReverseResult {
  const cost = annualCostUsd(costs);
  const supply = outstandingSupply(anchorYear, scenario);

  let bePrice: Computed;
  if (isBlocked(cost)) {
    bePrice = cost;
  } else if (revenueFlopYear <= 0) {
    bePrice = blocked([
      {
        key: "revenue_flop",
        cite: "computed",
        label: "a positive FLOP revenue — with none, no price breaks even",
      },
    ]);
  } else {
    bePrice = figure({
      value: cost.value / revenueFlopYear,
      unit: "USD/FLOP",
      cites: cost.cites,
      assumptions: cost.assumptions,
      derivation:
        `annual cost $${Math.round(cost.value).toLocaleString("en-US")} / ` +
        `${Math.round(revenueFlopYear).toLocaleString("en-US")} FLOP earned per year`,
    });
  }

  const beValuation: Computed = isBlocked(bePrice)
    ? bePrice
    : figure({
        value: bePrice.value * supply.value,
        unit: "USD",
        buckets: [supply.bucket],
        cites: [...bePrice.cites, ...supply.cites],
        assumptions: bePrice.assumptions,
        derivation:
          `break-even price $${bePrice.value.toPrecision(4)} x ${Math.round(supply.value).toLocaleString("en-US")} FLOP ` +
          `outstanding at year ${anchorYear} (${GENESIS[scenario].label})`,
      });

  return { breakEvenPrice: bePrice, breakEvenValuation: beValuation, supplyAtAnchor: supply };
}

// ---------------------------------------------------------------------------- sensitivity

export interface SensitivityEntry {
  key: string;
  label: string;
  /** Absolute change in annual net USD from a +/- swing of `swing` on this input alone. */
  effect: number;
  /** Signed direction: does increasing this input raise or lower net. */
  direction: "raises" | "lowers";
}

/**
 * Which single assumption moves the answer most.
 *
 * With this many user-supplied inputs a point estimate is a guess with decoration; the ranking is
 * what keeps it honest. Each input is perturbed alone by `swing` and the change in annual net is
 * measured — a one-at-a-time sweep, which is exact for the linear terms here and does not claim
 * to capture interactions.
 */
export function sensitivity(
  revenueFlopYear: number,
  inp: ValuationInputs,
  costs: CostInputs,
  scenario: GenesisScenario,
  swing = 0.2,
): SensitivityEntry[] {
  const base = forward(revenueFlopYear, inp, costs, scenario).netUsdYear;
  if (isBlocked(base)) return [];

  const probe = (label: string, key: string, mutate: (f: number) => { i: ValuationInputs; c: CostInputs }) => {
    const up = forward(revenueFlopYear, mutate(1 + swing).i, mutate(1 + swing).c, scenario).netUsdYear;
    const down = forward(revenueFlopYear, mutate(1 - swing).i, mutate(1 - swing).c, scenario).netUsdYear;
    if (isBlocked(up) || isBlocked(down)) return null;
    const effect = Math.abs(up.value - down.value) / 2;
    return {
      key,
      label,
      effect,
      direction: (up.value >= base.value ? "raises" : "lowers") as "raises" | "lowers",
    };
  };

  const out: (SensitivityEntry | null)[] = [];

  if (inp.mode === "valuation" && inp.valuationUsd !== undefined) {
    out.push(
      probe("network valuation", "network_valuation_usd", (f) => ({
        i: { ...inp, valuationUsd: inp.valuationUsd! * f },
        c: costs,
      })),
    );
  }
  if (inp.mode === "direct" && inp.pricePerToken !== undefined) {
    out.push(
      probe("token price", "token_price_usd", (f) => ({
        i: { ...inp, pricePerToken: inp.pricePerToken! * f },
        c: costs,
      })),
    );
  }
  const costKeys: [keyof CostInputs, string, string][] = [
    ["electricityPrice", "electricity_price_usd_kwh", "electricity price"],
    ["powerKw", "power_draw_kw", "power draw"],
    ["hardwareUsd", "hardware_cost_usd", "hardware cost"],
    ["amortMonths", "amortisation_months", "amortisation period"],
    ["hostingUsdMonth", "hosting_usd_month", "hosting cost"],
  ];
  for (const [field, key, label] of costKeys) {
    const v = costs[field];
    if (v === undefined) continue;
    out.push(probe(label, key, (f) => ({ i: inp, c: { ...costs, [field]: v * f } })));
  }

  return out
    .filter((x): x is SensitivityEntry => x !== null && x.effect > 0)
    .sort((a, b) => b.effect - a.effect);
}

/**
 * A neutral scale for placing a valuation guess: decade markers only.
 *
 * Named comparables were cut deliberately. Quoting another network's market capitalisation would
 * mean shipping a live market figure inside a tool whose entire claim is that every number traces
 * to a citable source — it would be stale within a day and unverifiable from the specification.
 * A bare ruler does the placing job without pretending to a precision it has not got.
 */
export const VALUATION_RULER = [1e7, 1e8, 1e9, 1e10] as const;
