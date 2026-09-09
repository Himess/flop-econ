/**
 * Emission schedule and role splits.
 *
 * Everything here is DEFINED — this is the best-founded part of FLOP's economics and the only
 * part of the tool that needs no user assumption at all.
 */
import { param } from "./params.generated";
import { figure, num, type Figure } from "./types";

export const BLOCKS_PER_YEAR = num(param("blocks_per_year"));
export const BLOCKS_PER_DAY = 86_400; // = blocks_per_year / 365, at block_time_seconds = 1

const R0 = num(param("initial_block_reward"));
const HALVING_BLOCKS = num(param("halving_interval_blocks"));
const MAX_HALVINGS = num(param("max_halvings"));
const FLOOR = num(param("floor_reward"));

const PPT = 1000;

export type Role = "miner" | "validator" | "agent" | "staker";

const SHARE_KEY = {
  miner: "miner_share_ppt",
  validator: "validator_share_ppt",
  agent: "agent_share_ppt",
  staker: "staker_share_ppt",
} as const;

/**
 * Block reward in era `era`.
 * R9.2: 96 -> 48 -> 24 -> 12 -> 6 -> 3 after max_halvings = 5, then floor_reward forever.
 */
export function blockReward(era: number): Figure {
  if (!Number.isInteger(era) || era < 0) throw new Error(`era must be a non-negative integer, got ${era}`);
  const value = era >= MAX_HALVINGS ? FLOOR : R0 / 2 ** era;
  return figure({
    value,
    unit: "FLOP/block",
    buckets: ["DEFINED"],
    cites: [param("initial_block_reward").cite, param("max_halvings").cite, param("floor_reward").cite],
    derivation:
      era >= MAX_HALVINGS
        ? `era ${era} >= max_halvings ${MAX_HALVINGS} -> floor_reward ${FLOOR}`
        : `initial_block_reward ${R0} / 2^${era}`,
  });
}

/** Which era a given block height falls in (uncapped era index). */
export function eraAtBlock(block: number): number {
  if (block < 0) throw new Error(`block must be >= 0, got ${block}`);
  return Math.floor(block / HALVING_BLOCKS);
}

/** The block at which an era begins. */
export function eraStartBlock(era: number): number {
  return era * HALVING_BLOCKS;
}

/** A role's per-block share of the reward in a given era. */
export function roleRewardPerBlock(role: Role, era: number): Figure {
  const share = num(param(SHARE_KEY[role]));
  const r = blockReward(era);
  return figure({
    value: (r.value * share) / PPT,
    unit: "FLOP/block",
    buckets: ["DEFINED"],
    cites: [...r.cites, param(SHARE_KEY[role]).cite],
    derivation: `blockReward(era ${era}) ${r.value} x ${share}/${PPT}`,
  });
}

/** A role's pool over a year at a given era's rate. */
export function rolePoolPerYear(role: Role, era: number): Figure {
  const perBlock = roleRewardPerBlock(role, era);
  return figure({
    value: perBlock.value * BLOCKS_PER_YEAR,
    unit: "FLOP/year",
    buckets: ["DEFINED"],
    cites: [...perBlock.cites, param("blocks_per_year").cite],
    derivation: `${perBlock.value} FLOP/block x ${BLOCKS_PER_YEAR.toLocaleString("en-US")} blocks/yr`,
  });
}

/**
 * The Labs/Foundation subsidy per block in a given era, both recipients combined.
 * R9.3: 8 each in era 0, halving on the same boundaries, exactly 0 from era 5.
 * Not participant revenue — it dilutes and pays neither role this tool models.
 */
export function subsidyPerBlock(era: number): Figure {
  const per = num(param("subsidy_per_block_per_recipient"));
  const value = era >= MAX_HALVINGS ? 0 : (per * 2) / 2 ** era;
  return figure({
    value,
    unit: "FLOP/block",
    buckets: ["DEFINED"],
    cites: [param("subsidy_per_block_per_recipient").cite],
    derivation:
      era >= MAX_HALVINGS
        ? `R9.3: subsidy is exactly 0 from era ${MAX_HALVINGS}`
        : `2 recipients x ${per} / 2^${era}`,
  });
}

/** Role splits must sum to 1000 ppt (R9.5 / R9.12). Asserted in tests. */
export function splitSumPpt(): number {
  return (["miner", "validator", "agent", "staker"] as const).reduce(
    (a, r) => a + num(param(SHARE_KEY[r])),
    0,
  );
}

export const blocksToDays = (blocks: number) => blocks / BLOCKS_PER_DAY;
export const daysToBlocks = (days: number) => days * BLOCKS_PER_DAY;
