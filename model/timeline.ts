/**
 * Month-by-month cash-flow timeline.
 *
 * The tool's other tabs answer *how much*. This one answers *when*, and for FLOP that is the
 * harder half: rewards do not arrive as spendable income. A validator can be profitable on paper
 * and unable to touch anything for two years.
 *
 * Three quantities the annual figure collapses into one:
 *
 *   earned  — accrued this month
 *   locked  — accrued but not withdrawable, with the month it unlocks
 *   liquid  — actually withdrawable, after unbonding
 *
 * Costs run on their own clock and in fiat: hardware up front, electricity and hosting monthly.
 * The gap between paying in dollars every month and receiving in locked FLOP is the whole point.
 *
 * FIXED PRICE ASSUMPTION. Every dollar figure here uses one price for every month. A token locked
 * for two years will not be worth today's assumption when it unlocks. This module does not model a
 * price path and does not try to: that risk is what the section reveals, not something it resolves.
 */
import { param } from "./params.generated";
import { blockReward, eraAtBlock, BLOCKS_PER_YEAR } from "./emission";
import { blockRewardIncome, auditIncome, type ValidatorInputs } from "./validator";
import { blocked, figure, isBlocked, num, type AssumptionRef, type Computed, type Figure } from "./types";

const MONTHS_PER_YEAR = 12;
const BLOCKS_PER_MONTH = BLOCKS_PER_YEAR / MONTHS_PER_YEAR;
const DAYS_PER_MONTH = 365 / MONTHS_PER_YEAR;

/** E.39 is binary and unresolved. Both are modelled; neither is picked silently. */
export type LiquidityScenario = "locked_autocompound" | "liquid";

export interface TimelineInputs {
  validator: ValidatorInputs;
  /** Horizon in months. Defaults to 36 in the UI so a 24-month lock is visible. */
  months: number;
  /** ABSENT — the lock on a genesis bond is not in the spec. Months; 0 means none. */
  bondLockMonths?: number;
  /** Fixed USD per FLOP applied to every month. Never a spec value. */
  priceUsd?: number;
  /** Fiat costs. */
  hardwareUsd?: number;
  monthlyCostUsd?: number;
  /**
   * Does the rest of the network compound in step with you? Default true, which holds pool share
   * constant — the honest neutral, since the pool is fixed by emission and compounding at the set
   * average redistributes nothing.
   */
  networkCompoundsInStep?: boolean;
  /**
   * Month the operator stops validating and unbonds, if they ever do.
   *
   * This matters more than it looks. Under E.39's current behaviour the block-reward leg is swept
   * into stake — it does not become withdrawable after some waiting period, it BECOMES STAKE. The
   * only way to realise it is to leave the set, and unbonding then takes 21 days from the moment
   * the last open session, dispute or audit closes (slash-lock, M11). While you keep validating,
   * that income is not spendable at all. Leaving it undefined models exactly that.
   */
  exitAtMonth?: number;
}

export interface TimelineMonth {
  month: number;
  era: number;
  /** True on the month a halving lands. */
  eraBoundary: boolean;
  earnedFlop: number;
  /** Accrued this month but not withdrawable. */
  lockedFlop: number;
  /** Became withdrawable this month. */
  unlockedFlop: number;
  cumulativeEarnedFlop: number;
  cumulativeLiquidFlop: number;
  /** Still locked at the end of this month. */
  outstandingLockedFlop: number;
  /** Stake at the end of the month, after any auto-compounding. */
  stakeFlop: number;
  costUsd: number;
  cumulativeCostUsd: number;
  cumulativeEarnedUsd: number;
  cumulativeLiquidUsd: number;
  cumulativeNetUsd: number;
}

const UNBOND_DAYS =
  num(param("validator_unbonding_blocks")) / (BLOCKS_PER_YEAR / 365);

/** Unbonding expressed in months, for placing the first liquid month. */
export const UNBOND_MONTHS = UNBOND_DAYS / DAYS_PER_MONTH;

/**
 * Build the month-by-month projection.
 *
 * Era boundaries land in the right month because the reward is read per month from the block
 * height, not assumed flat: a 36-month horizon crosses one halving at month 24, a 60-month
 * horizon crosses two.
 */
export function timeline(inp: TimelineInputs, scenario: LiquidityScenario): TimelineMonth[] {
  const months = Math.max(1, Math.floor(inp.months));
  const price = inp.priceUsd ?? 0;
  const monthlyCost = inp.monthlyCostUsd ?? 0;
  const hardware = inp.hardwareUsd ?? 0;
  const bondLock = inp.bondLockMonths ?? 0;
  const inStep = inp.networkCompoundsInStep ?? true;
  const exitMonth = inp.exitAtMonth ?? null;

  const out: TimelineMonth[] = [];
  let stake = inp.validator.stake;
  let networkStake = inp.validator.networkStake;
  let cumEarned = 0;
  let cumLiquid = 0;
  let cumCost = 0;
  let outstandingLocked = 0;
  /** Locked tranches keyed by the month they become withdrawable. */
  const unlockAt = new Map<number, number>();

  for (let m = 1; m <= months; m++) {
    const blockAtStart = Math.round((m - 1) * BLOCKS_PER_MONTH);
    const era = eraAtBlock(blockAtStart);
    const prevEra = m === 1 ? era : eraAtBlock(Math.round((m - 2) * BLOCKS_PER_MONTH));

    // Income for this month at this era's rate, against the current stake.
    const monthInputs: ValidatorInputs = { ...inp.validator, stake, networkStake, era };
    const br = blockRewardIncome(monthInputs).value / MONTHS_PER_YEAR;
    const audit = auditIncome(monthInputs).value / MONTHS_PER_YEAR;
    const earned = br + audit;

    // E.39: under the current behaviour the block-reward leg auto-compounds into LOCKED stake.
    // Audit income is a claimed fee, not a pool distribution, so it is not swept into stake.
    const lockedThisMonth = scenario === "locked_autocompound" ? br : 0;
    const liquidThisMonth = earned - lockedThisMonth;

    if (scenario === "locked_autocompound") {
      stake += br;
      // If the rest of the set compounds too, the pool share is unchanged — the pool is fixed by
      // emission, so compounding at the set average redistributes nothing.
      if (inStep) networkStake += br * (networkStake / Math.max(stake - br, 1));
      outstandingLocked += br;
      // Nothing is scheduled for release here. Compounded reward is stake, not a maturing
      // tranche: it is realised only by exiting the set, which the block below handles.
      if (exitMonth !== null) {
        const key = Math.ceil(Math.max(exitMonth + UNBOND_MONTHS, bondLock + UNBOND_MONTHS));
        unlockAt.set(key, (unlockAt.get(key) ?? 0) + br);
      }
    }

    const unlockedNow = unlockAt.get(m) ?? 0;
    outstandingLocked -= unlockedNow;

    cumEarned += earned;
    cumLiquid += liquidThisMonth + unlockedNow;
    const costThisMonth = monthlyCost + (m === 1 ? hardware : 0);
    cumCost += costThisMonth;

    out.push({
      month: m,
      era,
      eraBoundary: era !== prevEra,
      earnedFlop: earned,
      lockedFlop: lockedThisMonth,
      unlockedFlop: unlockedNow,
      cumulativeEarnedFlop: cumEarned,
      cumulativeLiquidFlop: cumLiquid,
      outstandingLockedFlop: outstandingLocked,
      stakeFlop: stake,
      costUsd: costThisMonth,
      cumulativeCostUsd: cumCost,
      cumulativeEarnedUsd: cumEarned * price,
      cumulativeLiquidUsd: cumLiquid * price,
      cumulativeNetUsd: cumLiquid * price - cumCost,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------- payback

export interface Payback {
  /** When cumulative EARNED covers cost. What most calculators show. */
  accountingMonths: Computed;
  /** When cumulative LIQUID covers cost. The one that can be spent. */
  cashMonths: Computed;
  /** cash - accounting, in months. The headline of the section. */
  gapMonths: Computed;
}

function firstMonthWhere(rows: TimelineMonth[], pred: (r: TimelineMonth) => boolean): number | null {
  const hit = rows.find(pred);
  return hit ? hit.month : null;
}

/**
 * Accounting payback against cash payback.
 *
 * The distance between them is what this whole section exists to show. Under E.39's current
 * behaviour the block-reward leg is swept into locked stake, so cash payback can be far later
 * than accounting payback — or never arrive inside the horizon at all.
 */
export function payback(
  rows: TimelineMonth[],
  inp: TimelineInputs,
  scenario: LiquidityScenario,
): Payback {
  const missing: { key: string; cite: string; label: string }[] = [];
  if (inp.priceUsd === undefined) {
    missing.push({ key: "token_price_usd", cite: "your assumption", label: "token price" });
  }
  if (inp.hardwareUsd === undefined) {
    missing.push({ key: "hardware_cost_usd", cite: "your assumption", label: "hardware cost" });
  }
  if (missing.length > 0) {
    const b = blocked(missing);
    return { accountingMonths: b, cashMonths: b, gapMonths: b };
  }

  const assumptions: AssumptionRef[] = [
    { key: "token_price_usd", value: inp.priceUsd!, unit: "USD/FLOP", cite: "your assumption — fixed for every month", label: "token price" },
    { key: "hardware_cost_usd", value: inp.hardwareUsd!, unit: "USD", cite: "your assumption", label: "hardware cost" },
  ];

  const acc = firstMonthWhere(rows, (r) => r.cumulativeEarnedUsd >= r.cumulativeCostUsd);
  const cash = firstMonthWhere(rows, (r) => r.cumulativeLiquidUsd >= r.cumulativeCostUsd);
  const horizon = rows.length;

  const mk = (m: number | null, what: string): Computed =>
    m === null
      ? blocked([
          {
            key: what === "accounting" ? "accounting_payback" : "cash_payback",
            cite: "computed",
            label: `a longer horizon — ${what} payback does not arrive within ${horizon} months`,
          },
        ])
      : figure({
          value: m,
          unit: "months",
          cites: [param("validator_reward_liquidity").cite],
          assumptions,
          derivation:
            what === "accounting"
              ? `first month where cumulative EARNED covers cumulative cost`
              : `first month where cumulative LIQUID covers cumulative cost, under E.39 "${scenario}"`,
        });

  const accountingMonths = mk(acc, "accounting");
  const cashMonths = mk(cash, "cash");

  const gapMonths: Computed =
    acc === null || cash === null
      ? blocked([
          {
            key: "payback_gap",
            cite: "computed",
            label: `a longer horizon — one of the two paybacks does not arrive within ${horizon} months`,
          },
        ])
      : figure({
          value: cash - acc,
          unit: "months",
          cites: [param("validator_reward_liquidity").cite],
          assumptions,
          derivation: `cash payback month ${cash} - accounting payback month ${acc}`,
        });

  return { accountingMonths, cashMonths, gapMonths };
}

// ---------------------------------------------------------------------------- headline

export interface LiquiditySummary {
  /** Month from which cumulative earned exceeds cumulative cost. */
  profitableFrom: Computed;
  /** Month from which anything at all is withdrawable. */
  firstLiquidMonth: Computed;
  /** FLOP still locked at the end of the horizon. */
  stillLockedAtHorizon: Figure;
  scenario: LiquidityScenario;
}

export function liquiditySummary(
  rows: TimelineMonth[],
  scenario: LiquidityScenario,
): LiquiditySummary {
  const profitable = firstMonthWhere(rows, (r) => r.cumulativeEarnedUsd >= r.cumulativeCostUsd);
  const firstLiquid = firstMonthWhere(rows, (r) => r.cumulativeLiquidFlop > 0);
  const last = rows[rows.length - 1]!;

  const mk = (m: number | null, label: string): Computed =>
    m === null
      ? blocked([{ key: label, cite: "computed", label: `a longer horizon — ${label} does not arrive within ${rows.length} months` }])
      : figure({
          value: m,
          unit: "months",
          buckets: ["PLANNED"],
          cites: [param("validator_reward_liquidity").cite],
          derivation: `E.39 scenario "${scenario}"`,
        });

  return {
    profitableFrom: mk(profitable, "profitability"),
    firstLiquidMonth: mk(firstLiquid, "first withdrawable FLOP"),
    stillLockedAtHorizon: figure({
      value: last.outstandingLockedFlop,
      unit: "FLOP",
      buckets: ["PLANNED"],
      cites: [param("validator_reward_liquidity").cite, param("validator_unbonding_blocks").cite],
      derivation: `locked and not yet released at month ${last.month}, under "${scenario}"`,
    }),
    scenario,
  };
}

/** Both E.39 sides, computed together. Never pick one silently. */
export function bothScenarios(inp: TimelineInputs): Record<LiquidityScenario, TimelineMonth[]> {
  return {
    locked_autocompound: timeline(inp, "locked_autocompound"),
    liquid: timeline(inp, "liquid"),
  };
}

export { BLOCKS_PER_MONTH };
