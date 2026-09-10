/**
 * What the headline break-even actually rests on.
 *
 * The panel computes its headline against the ANNOUNCED genesis and the workbook figure against
 * the RATIFIED one. This mirrors that chain exactly, on the shipped example, and prints both, so
 * the claim "the site's number is the 4.4bn number" is checked rather than asserted.
 */
import { breakEven, seatRateFromStake } from "../model/validator";
import { annualCostUsd, reverse, tokenPrice, GENESIS, type CostInputs } from "../model/valuation";
import { rigPowerKw } from "../model/physical";
import { EXAMPLE } from "../app/lib/state";
import { isBlocked } from "../model/types";
import type { ValidatorInputs } from "../model/validator";

const s = EXAMPLE;
const powerKw = rigPowerKw({ nodeWatts: s.nodeWatts! });

const base: ValidatorInputs = {
  stake: s.stake!,
  networkStake: s.networkStake!,
  activeSetSize: s.setSize,
  era: s.era,
  committeeSeatProbability: seatRateFromStake(s.stake!, s.networkStake!).value,
  auditVerdictsPerYear: s.verdicts!,
};

const revenueFlop = (() => {
  const r = breakEven(base).revenue;
  return isBlocked(r) ? 0 : r.value;
})();

const costs: CostInputs = {
  electricityPrice: s.electricityPrice!,
  ...(isBlocked(powerKw) ? {} : { powerKw: powerKw.value }),
  hardwareUsd: s.hardwareUsd!,
  amortMonths: s.amortMonths!,
  hostingUsdMonth: s.hostingUsdMonth!,
};

const usd = annualCostUsd(costs);
const money = (v: number) => "$" + Math.round(v).toLocaleString("en-US");

console.log("\nshipped example — stake", s.stake, "of", s.networkStake, "| anchor year", s.anchorYear);
console.log("annual cost:", isBlocked(usd) ? "blocked" : money(usd.value));
console.log("revenue FLOP/yr:", Math.round(revenueFlop).toLocaleString("en-US"));

for (const scenario of ["announced", "ratified"] as const) {
  const r = reverse(revenueFlop, costs, s.anchorYear, scenario);
  const p = tokenPrice({ mode: s.priceMode, valuationUsd: s.valuationUsd!, anchorYear: s.anchorYear }, scenario);
  const be = r.breakEvenValuation;
  console.log(
    "\n" + scenario.padEnd(10),
    "genesis", GENESIS[scenario].value.toLocaleString("en-US"),
    "(" + GENESIS[scenario].label + ")",
  );
  console.log("  break-even FDV :", isBlocked(be) ? "blocked: " + be.message : money(be.value));
  console.log("  bucket         :", isBlocked(be) ? "—" : be.bucket);
  console.log("  implied price  :", isBlocked(p) ? "blocked" : "$" + p.value.toFixed(6));
}

const a = reverse(revenueFlop, costs, s.anchorYear, "announced").breakEvenValuation;
const b = reverse(revenueFlop, costs, s.anchorYear, "ratified").breakEvenValuation;
if (!isBlocked(a) && !isBlocked(b)) {
  console.log("\ngap: announced is", ((a.value / b.value - 1) * 100).toFixed(1) + "% above ratified");
  console.log("     difference  ", money(a.value - b.value));
}
