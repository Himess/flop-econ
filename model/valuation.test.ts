/**
 * Valuation-layer invariants.
 *
 * The risk this layer introduces is that a dollar figure looks more authoritative than the
 * assumption behind it. These tests pin the two rules that stop that: nothing here is ever
 * DEFINED, and nothing computes without the assumption being supplied and recorded.
 */
import { describe, expect, it } from "vitest";
import {
  annualCostUsd,
  cumulativeEmission,
  forward,
  genesisSpread,
  GENESIS,
  outstandingSupply,
  reverse,
  sensitivity,
  tokenPrice,
  type CostInputs,
  type ValuationInputs,
} from "./valuation";
import { blockReward, subsidyPerBlock, BLOCKS_PER_YEAR } from "./emission";
import { isBlocked, num } from "./types";
import { param } from "./params.generated";

const COSTS: CostInputs = {
  electricityPrice: 0.09,
  powerKw: 1.5,
  hardwareUsd: 30_000,
  amortMonths: 36,
  hostingUsdMonth: 400,
  // Derived by physical.daStorageUsdYear in the app; a literal here keeps this file testing the
  // cost sum rather than the DA derivation, which has its own suite.
  daStorageUsdYear: 24,
};
const VAL: ValuationInputs = { mode: "valuation", valuationUsd: 300_000_000, anchorYear: 1 };
const REV_FLOP = 1_800_000; // FLOP/yr, as the validator model would supply it

describe("supply model", () => {
  it("one year of emission is reward plus subsidy at the era-0 rate", () => {
    const expected = (blockReward(0).value + subsidyPerBlock(0).value) * BLOCKS_PER_YEAR;
    expect(cumulativeEmission(1).value).toBe(expected);
  });

  it("integrates across the halving boundary rather than assuming a flat rate", () => {
    // Years 0..3 span era 0 (years 0-2) and era 1 (years 2-3).
    const naive = (blockReward(0).value + subsidyPerBlock(0).value) * BLOCKS_PER_YEAR * 3;
    const actual = cumulativeEmission(3).value;
    expect(actual).toBeLessThan(naive);
    const era0 = (blockReward(0).value + subsidyPerBlock(0).value) * BLOCKS_PER_YEAR * 2;
    const era1 = (blockReward(1).value + subsidyPerBlock(1).value) * BLOCKS_PER_YEAR;
    expect(actual).toBe(era0 + era1);
  });

  it("outstanding supply adds genesis to cumulative emission", () => {
    for (const sc of ["params", "workbook"] as const) {
      expect(outstandingSupply(1, sc).value).toBe(GENESIS[sc].value + cumulativeEmission(1).value);
    }
  });

  /**
   * The labels inverted on 2026-09-10. D-0438 ratified 3,500,000,000 and superseded the
   * D-0421/D-0435 pool sizes; this tool had been carrying 2,483,460,000 as the ratified value and
   * 3,500,000,000 as an unratified workbook figure — backwards, on a public site, on the divisor
   * for every dollar figure. The second column is now the superseded one and can never read
   * DEFINED, for the mirror-image reason it could not before.
   */
  it("the superseded genesis column can never read DEFINED", () => {
    expect(outstandingSupply(1, "params").bucket).toBe("DEFINED");
    expect(outstandingSupply(1, "workbook").bucket).toBe("PLANNED");
    expect(outstandingSupply(1, "workbook").cites.join(" ")).toContain("D-0438");
  });

  it("the value of record is the ratified 3.5bn, not the superseded 2.48bn", () => {
    expect(GENESIS.params.value).toBe(3_500_000_000);
    expect(GENESIS.workbook.value).toBe(2_483_460_000);
    expect(num(param("genesis_supply"))).toBe(3_500_000_000);
  });

  /** R9.4: genesis MUST be allocated to exactly four buckets and nothing else. */
  it("the four genesis buckets sum exactly to genesis supply", () => {
    const sum =
      num(param("genesis_miner_airdrop")) +
      num(param("genesis_validator_airdrop")) +
      num(param("genesis_agent_airdrop")) +
      num(param("genesis_reserve"));
    expect(sum).toBe(num(param("genesis_supply")));
  });

  it("says outstanding, not circulating, and names why", () => {
    expect(outstandingSupply(1, "params").derivation).toMatch(/E\.38/);
  });
});

describe("price", () => {
  it("valuation mode divides by outstanding supply at the anchor year", () => {
    const p = tokenPrice(VAL, "params");
    if (isBlocked(p)) throw new Error("unexpected block");
    expect(p.value).toBeCloseTo(300_000_000 / outstandingSupply(1, "params").value, 12);
  });

  it("the two genesis scenarios move the price materially at the same valuation", () => {
    const a = tokenPrice(VAL, "params");
    const b = tokenPrice(VAL, "workbook");
    if (isBlocked(a) || isBlocked(b)) throw new Error("unexpected block");
    // Ratified genesis is now the LARGER pool, so the ratified price is the lower one. The
    // direction of this inequality flipping is the whole correction.
    expect(a.value).toBeLessThan(b.value);
    const spread = genesisSpread(VAL);
    if (isBlocked(spread)) throw new Error("unexpected block");
    expect(Math.abs(spread.value)).toBeGreaterThan(0.05);
  });

  it("direct mode takes the price as given and does not consult supply", () => {
    const p = tokenPrice({ mode: "direct", pricePerToken: 2, anchorYear: 1 }, "params");
    if (isBlocked(p)) throw new Error("unexpected block");
    expect(p.value).toBe(2);
    expect(p.derivation).toMatch(/not consulted/);
    // Same answer under either genesis scenario, because supply is not used.
    const q = tokenPrice({ mode: "direct", pricePerToken: 2, anchorYear: 1 }, "workbook");
    if (isBlocked(q)) throw new Error("unexpected block");
    expect(q.value).toBe(2);
  });

  it("blocks without a valuation, and without a price in direct mode", () => {
    expect(isBlocked(tokenPrice({ mode: "valuation", anchorYear: 1 }, "params"))).toBe(true);
    expect(isBlocked(tokenPrice({ mode: "direct", anchorYear: 1 }, "params"))).toBe(true);
  });

  it("a price is NEVER bucketed DEFINED, in either mode", () => {
    for (const inp of [VAL, { mode: "direct" as const, pricePerToken: 2, anchorYear: 1 }]) {
      for (const sc of ["params", "workbook"] as const) {
        const p = tokenPrice(inp, sc);
        if (isBlocked(p)) continue;
        expect(p.bucket, `${inp.mode}/${sc}`).toBe("ABSENT");
      }
    }
  });
});

describe("costs", () => {
  it("blocks naming every component the user has not supplied", () => {
    const c = annualCostUsd({});
    expect(isBlocked(c)).toBe(true);
    if (!isBlocked(c)) return;
    expect(c.missing).toHaveLength(6);
    expect(c.message).toMatch(/^Enter /);
  });

  it("blocks on a single missing component too", () => {
    const c = annualCostUsd({ ...COSTS, hostingUsdMonth: undefined });
    expect(isBlocked(c)).toBe(true);
    if (isBlocked(c)) expect(c.missing).toEqual(["hosting_usd_month"]);
  });

  it("sums energy, amortisation, hosting and DA storage", () => {
    const c = annualCostUsd(COSTS);
    if (isBlocked(c)) throw new Error("unexpected block");
    const energy = 0.09 * 1.5 * 24 * 365;
    const amort = (30_000 / 36) * 12;
    const hosting = 400 * 12;
    expect(c.value).toBeCloseTo(energy + amort + hosting + 24, 6);
    expect(c.bucket).toBe("ABSENT");
    expect(c.assumptions).toHaveLength(5);
  });

  /**
   * DA store-and-serve is one of the two heavy legs (§15.3), so the USD cost model cannot leave
   * it out. It is required rather than optional-with-zero for the same reason the FLOP version
   * blocked: a silent zero is an invented figure.
   */
  it("blocks without DA storage rather than treating it as zero", () => {
    const c = annualCostUsd({ ...COSTS, daStorageUsdYear: undefined });
    expect(isBlocked(c)).toBe(true);
    if (isBlocked(c)) expect(c.missing).toEqual(["da_storage_usd_year"]);
  });

  it("refuses a zero amortisation period rather than dividing by it", () => {
    expect(isBlocked(annualCostUsd({ ...COSTS, amortMonths: 0 }))).toBe(true);
  });
});

describe("forward", () => {
  it("revenue is FLOP earned times price, and monthly is a twelfth of annual", () => {
    const f = forward(REV_FLOP, VAL, COSTS, "params");
    if (isBlocked(f.price) || isBlocked(f.revenueUsdYear) || isBlocked(f.revenueUsdMonth)) {
      throw new Error("unexpected block");
    }
    expect(f.revenueUsdYear.value).toBeCloseTo(REV_FLOP * f.price.value, 8);
    expect(f.revenueUsdMonth.value).toBeCloseTo(f.revenueUsdYear.value / 12, 8);
  });

  it("payback refuses rather than returning infinity when net is not positive", () => {
    const f = forward(REV_FLOP, { ...VAL, valuationUsd: 1 }, COSTS, "params");
    expect(isBlocked(f.paybackMonths)).toBe(true);
    if (isBlocked(f.paybackMonths)) expect(f.paybackMonths.message + f.paybackMonths.detail).toMatch(/never pays back/);
  });

  it("every forward output is ABSENT-bucketed — a dollar figure is never a spec value", () => {
    const f = forward(REV_FLOP, VAL, COSTS, "params");
    for (const [name, r] of Object.entries(f)) {
      if (isBlocked(r)) continue;
      expect(r.bucket, name).toBe("ABSENT");
    }
  });
});

describe("reverse — the decision criterion", () => {
  it("break-even price is annual cost divided by annual FLOP earned", () => {
    const r = reverse(REV_FLOP, COSTS, 1, "params");
    const c = annualCostUsd(COSTS);
    if (isBlocked(r.breakEvenPrice) || isBlocked(c)) throw new Error("unexpected block");
    expect(r.breakEvenPrice.value).toBeCloseTo(c.value / REV_FLOP, 12);
  });

  it("at exactly the break-even price, forward net is zero", () => {
    const r = reverse(REV_FLOP, COSTS, 1, "params");
    if (isBlocked(r.breakEvenPrice)) throw new Error("unexpected block");
    const f = forward(REV_FLOP, { mode: "direct", pricePerToken: r.breakEvenPrice.value, anchorYear: 1 }, COSTS, "params");
    if (isBlocked(f.netUsdYear)) throw new Error("unexpected block");
    expect(Math.abs(f.netUsdYear.value)).toBeLessThan(1e-6);
  });

  it("break-even valuation is the break-even price times supply at the anchor", () => {
    const r = reverse(REV_FLOP, COSTS, 1, "params");
    if (isBlocked(r.breakEvenPrice) || isBlocked(r.breakEvenValuation)) throw new Error("unexpected block");
    expect(r.breakEvenValuation.value).toBeCloseTo(r.breakEvenPrice.value * r.supplyAtAnchor.value, 4);
  });

  it("the superseded genesis figure moves the user's own threshold", () => {
    const a = reverse(REV_FLOP, COSTS, 1, "params");
    const b = reverse(REV_FLOP, COSTS, 1, "workbook");
    if (isBlocked(a.breakEvenValuation) || isBlocked(b.breakEvenValuation)) throw new Error("unexpected block");
    // Same break-even PRICE (costs and FLOP revenue are unchanged), different valuation. The
    // ratified pool is now the larger one, so the ratified break-even valuation is the higher
    // number — the inequality flipped with D-0438, and this is the figure the tool headlines.
    expect(a.breakEvenValuation.value).toBeGreaterThan(b.breakEvenValuation.value);
  });

  it("blocks rather than dividing by zero revenue", () => {
    expect(isBlocked(reverse(0, COSTS, 1, "params").breakEvenPrice)).toBe(true);
  });
});

describe("sensitivity", () => {
  it("ranks the inputs by how much each alone moves annual net", () => {
    const ranked = sensitivity(REV_FLOP, VAL, COSTS, "params");
    expect(ranked.length).toBeGreaterThan(2);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1]!.effect).toBeGreaterThanOrEqual(ranked[i]!.effect);
    }
  });

  it("records direction, so the user can tell a lever from a cost", () => {
    const ranked = sensitivity(REV_FLOP, VAL, COSTS, "params");
    const valuation = ranked.find((r) => r.key === "network_valuation_usd");
    const hardware = ranked.find((r) => r.key === "hardware_cost_usd");
    expect(valuation?.direction).toBe("raises");
    expect(hardware?.direction).toBe("lowers");
  });

  it("returns nothing rather than guessing when net cannot be computed", () => {
    expect(sensitivity(REV_FLOP, VAL, {}, "params")).toEqual([]);
  });
});
