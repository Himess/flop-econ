// GENERATED FILE — DO NOT EDIT BY HAND.
// Source: params.yaml (sha256:5ca8bc30fd1803a4)
// Regenerate: npm run gen:params
//
// Every constant the model and UI use traces to an entry here. There are no magic numbers
// elsewhere in the codebase; `npm test` enforces both that rule's inputs and this file's
// sync with the YAML.

export type Bucket = "DEFINED" | "PLANNED" | "ABSENT";

export interface Param {
  readonly key: string;
  readonly value?: number | string;
  readonly unit?: string;
  readonly bucket: Bucket;
  readonly cite: string;
  readonly note?: string;
  readonly derived?: boolean;
  readonly derivation?: string;
}

export interface Disagreement {
  readonly id: string;
  readonly spec_says: string;
  readonly downstream_says: string;
  readonly status: string;
  readonly quote?: string;
  readonly tracking?: string;
  readonly handling: string;
  /** ISO date a disagreement was settled. Resolved entries are marked, never removed. */
  readonly resolved?: string;
}

export const PARAMS_SHA256 = "5ca8bc30fd1803a4";

export const META = {
  "spec_source": "https://github.com/flop-labs/yellowpaper (yellowpaper.md, main)",
  "spec_mirror": "https://flop.finance/intro/yellowpaper/",
  "spec_status": "0.5.0 (draft) - initial public draft",
  "spec_decision_record": "v0.5 (D-0501 ratified, D-0502 proposed)",
  "fetched": "2026-09-10",
  "fetch_bytes": 248811,
  "fetch_sha256": "cb414e5cdfe72eec",
  "fetch_note": "REBASED onto the initial public release. The prior basis was a 2026-09-09 fetch of the pre-publication draft (spec/yp.txt, 203,145 B), kept as evidence because three load-bearing statements changed between them. Re-verified all 29 quoted claims against the published text: 26 unchanged, 3 reversed - see the v0_5_0_rebase disagreement.",
  "published_sources": [
    "https://github.com/flop-labs/yellowpaper (yellowpaper.md) - value of record is Appendix A",
    "https://flop.finance/intro/yellowpaper/ - the same document, rendered",
    "https://flop.finance/intro/revenue/ - cash-flow model and ratification notes",
    "https://flop.finance/teaser/ - allocation tables in HTML",
    "https://flop.finance/assets/tokenomics.png - the tokenomics GRAPHIC, sha256 e05656909de1a8a9",
    "https://flop.finance/intro/{miner,validator,agent,verification}/ and /"
  ],
  "source_note": "IMAGE ASSETS ARE PART OF THE PUBLISHED SURFACE. A reconcile that greps page text cannot read a figure rendered inside a PNG, and on 2026-09-10 a superseded version of tokenomics.png carried a total supply and a validator airdrop that contradicted Appendix A. Any future reconcile MUST fetch and LOOK AT the graphics, and pin their hashes. See disagreements.tokenomics_graphic.",
  "extraction": "yellowpaper.md from the upstream repository, not vendored here - get it from spec_source and check it against fetch_sha256.",
  "superseded_basis": "A 2026-09-09 fetch of the pre-publication draft (203,145 B), retained locally as evidence of the three reversed statements. Not published: it is FLOP's document, not this repository's.",
  "appendix_a_rows": {
    "enforced": 112,
    "reference_only": 33,
    "derived_narrative": 23
  },
  "open_items_total": 29
} as const;

export const PARAMS: readonly Param[] = [
  {
    "key": "initial_block_reward",
    "value": 96,
    "unit": "FLOP_per_block",
    "bucket": "DEFINED",
    "cite": "Appendix A; §9; D-008",
    "note": "Block reward at genesis (Era 0)."
  },
  {
    "key": "halving_interval_blocks",
    "value": 63072000,
    "unit": "blocks",
    "bucket": "DEFINED",
    "cite": "Appendix A; §9",
    "note": "~730 days at 1 s/block."
  },
  {
    "key": "max_halvings",
    "value": 5,
    "unit": "count",
    "bucket": "DEFINED",
    "cite": "Appendix A; §9; D-0436",
    "note": "R9.2: 96 -> 48 -> 24 -> 12 -> 6 -> 3, then the floor forever."
  },
  {
    "key": "floor_reward",
    "value": 3,
    "unit": "FLOP_per_block",
    "bucket": "DEFINED",
    "cite": "Appendix A; §9; R9.2; D-0436",
    "note": "Perpetual per-block reward from era 5 (block 315,360,001, Day 3650)."
  },
  {
    "key": "block_time_seconds",
    "value": 1,
    "unit": "seconds",
    "bucket": "DEFINED",
    "cite": "§2.2 (target parameters table); §1.2; R9.8",
    "note": "§2.2's table reads \"Block interval | 1 second (fixed)\", and §1.2 states \"All durations assume 1-second blocks\" — so this is the accounting convention every block-count window in the spec is converted through, and Appendix A's own descriptions use it (\"~730 days at 1s/block\"). Caveat worth carrying: §2.1 says \"One-second blocks and sub-second finality are TARGETS; latency remains workload-, topology-, and committee-dependent until benchmarked\", and E.46 leaves that unmeasured. The parameter of record is 1 s; realised cadence is not established."
  },
  {
    "key": "blocks_per_year",
    "value": 31536000,
    "unit": "blocks",
    "bucket": "DEFINED",
    "derived": true,
    "derivation": "365 x 86,400 at the §2.2 block interval of 1 second. Appendix A states the figure itself in the floor_annual_emission row — \"perpetual floor tail: 3 FLOP/block x 31,536,000 blocks/yr (= 189,216,000 FLOP/era)\" — so it is read from Appendix A, not inferred from it.",
    "cite": "Appendix A (floor_annual_emission); §2.2; D-0436",
    "note": "Cross-checks, all exact, all from halving_interval_blocks = 63,072,000 at this cadence: subsidy total 63,072,000 x (16+8+4+2+1) = 1,955,232,000 (R9.3); cumulative emission through era 5 = 63,072,000 x 189 = 11,920,608,000 (R9.2); 2*R0*H = 12,109,824,000 (R9.2); floor_annual_emission = 3 x 31,536,000 = 94,608,000. Independently corroborated downstream: FLOP's own calculator states era-0 issuance as \"9.6768M FLOP/day\", which is exactly (96 reward + 16 subsidy) x 86,400 blocks/day. Appendix A carries no standalone block-time or blocks-per-year row; this is the nearest thing to one and every stated total reproduces from it."
  },
  {
    "key": "miner_share_ppt",
    "value": 750,
    "unit": "parts_per_thousand",
    "bucket": "DEFINED",
    "cite": "Appendix A; §2.1; D-0435",
    "note": "Era 0 = 72 FLOP/block."
  },
  {
    "key": "validator_share_ppt",
    "value": 100,
    "unit": "parts_per_thousand",
    "bucket": "DEFINED",
    "cite": "Appendix A; §9; R9.5",
    "note": "Era 0 = 9.6 FLOP/block. R9.5: the pool MUST NOT be increased by an inference surcharge."
  },
  {
    "key": "agent_share_ppt",
    "value": 100,
    "unit": "parts_per_thousand",
    "bucket": "DEFINED",
    "cite": "Appendix A; §2.1; D-0435",
    "note": "Minted, but NOT distributed. R9.12 forbids onward distribution until E.40 ratifies. Era 0 = 9.6 FLOP/block accruing to a sovereign pool account."
  },
  {
    "key": "staker_share_ppt",
    "value": 50,
    "unit": "parts_per_thousand",
    "bucket": "DEFINED",
    "cite": "Appendix A; §2.1; D-0435",
    "note": "Same parked status as the agent leg (R9.12, E.40). Era 0 = 4.8 FLOP/block."
  },
  {
    "key": "finality_committee_premium_weight_ppm",
    "value": 1100000,
    "unit": "ppm",
    "bucket": "DEFINED",
    "cite": "Appendix A; §9; R9.5",
    "note": "1.1x weight for current finality-committee members inside the validator pool. R9.5: weight = stake_i x (1.1 if i in committee else 1.0), integer dust assigned deterministically so payouts sum exactly to the pool."
  },
  {
    "key": "subsidy_per_block_per_recipient",
    "value": 8,
    "unit": "FLOP_per_block",
    "bucket": "DEFINED",
    "cite": "Appendix A; §2.2; R9.3; D-0436",
    "note": "Labs and Foundation, 8 each = 16/block in era 0, on top of the block reward. Halves with the reward, exactly 0 from era 5. NOT participant revenue - it dilutes and pays neither role."
  },
  {
    "key": "genesis_supply",
    "value": 3500000000,
    "unit": "FLOP",
    "bucket": "DEFINED",
    "cite": "Appendix A (param-genesis_supply); §9.3; R9.4; R9.7; D-0438",
    "note": "CORRECTED 2026-09-10. This tool carried 2,483,460,000 and labelled 3,500,000,000 as an unratified workbook figure. That is backwards: D-0438 ratified 3,500,000,000, superseding the D-0421/D-0435 pool sizes and leaving emission untouched. Appendix A's row reads \"3_500_000_000 FLOP | §9.3 | D-0438\". R9.4 requires it be allocated to exactly four genesis buckets and nothing else. Genesis supply is the divisor for token price, so every dollar figure the tool printed before this correction was wrong - see disagreements.genesis_supply_fork, now marked resolved."
  },
  {
    "key": "genesis_miner_airdrop",
    "value": 1200000000,
    "unit": "FLOP",
    "bucket": "DEFINED",
    "cite": "Appendix A (param-genesis_miner_airdrop); §9.3; R9.4; D-0438",
    "note": "34.29% of genesis. One of R9.4's four buckets."
  },
  {
    "key": "genesis_agent_airdrop",
    "value": 1200000000,
    "unit": "FLOP",
    "bucket": "DEFINED",
    "cite": "Appendix A (param-genesis_agent_airdrop); §9.3; R9.4; D-0438",
    "note": "34.29% of genesis. One of R9.4's four buckets."
  },
  {
    "key": "genesis_reserve",
    "value": 794495000,
    "unit": "FLOP",
    "bucket": "DEFINED",
    "cite": "Appendix A (param-genesis_reserve); §9.3; R9.4; D-0438",
    "note": "22.70% of genesis - \"Ecosystem/incentives reserve\". The fourth bucket. The four sum exactly: 1,200,000,000 + 305,505,000 + 1,200,000,000 + 794,495,000 = 3,500,000,000."
  },
  {
    "key": "airdrop_vesting_duration_blocks",
    "value": 7776000,
    "unit": "blocks",
    "bucket": "DEFINED",
    "cite": "Appendix A (param-airdrop_vesting_duration_blocks); §9.3",
    "note": "90-day linear airdrop vesting at 1 s blocks. Not modelled by the tool - see E.38."
  },
  {
    "key": "subsidy_duration_blocks",
    "value": 315360000,
    "unit": "blocks",
    "bucket": "DEFINED",
    "cite": "Appendix A (param-subsidy_duration_blocks); §9; R9.3",
    "note": "~10 years, 5 subsidy halving eras. Total minted = 63,072,000 x (16+8+4+2+1) = 1,955,232,000 FLOP (R9.3). This is the figure FLOP's teaser rounds to \"2.0bn Team + Foundation\"."
  },
  {
    "key": "genesis_validator_airdrop",
    "value": 305505000,
    "unit": "FLOP",
    "bucket": "DEFINED",
    "cite": "Appendix A (param-genesis_validator_airdrop); §9.3; D-0435",
    "note": "Unchanged by D-0438, and the same figure FLOP's teaser genesis table gives (\"Validators 305,505,000 (1.8%) - the aggregate stake that secures the network at launch\"). Exactly validator_min_stake x 1,000. Relation inferred, not stated."
  },
  {
    "key": "validator_min_stake",
    "value": 305505,
    "unit": "FLOP",
    "bucket": "DEFINED",
    "cite": "Appendix A (reference-only); §15.2; D-0413",
    "note": "Baseline floor (MinimumValidatorStake). Compounds - see validator_growth_*."
  },
  {
    "key": "validator_growth_numerator",
    "value": 109,
    "unit": "ratio",
    "bucket": "DEFINED",
    "cite": "Appendix A; §11; §15.2; D-0413",
    "note": "109/100 = +9%/yr compounding on the validator minimum-stake floor."
  },
  {
    "key": "validator_growth_denominator",
    "value": 100,
    "unit": "ratio",
    "bucket": "DEFINED",
    "cite": "Appendix A; §11; §15.2; D-0413"
  },
  {
    "key": "validator_value_coupled_floor_k",
    "bucket": "ABSENT",
    "cite": "E.8 — Value-coupled floor k + retarget cadence [TBD]",
    "note": "effective_minimum_stake() = max(validator_min_stake, ValueCoupledStakeFloor) where the floor is k * V_booked. Storage default is 0, i.e. baseline-identical, so the live case is the baseline. E.35 adds a stress point: \"base floor ratifying at ~1.16M FLOP\". Placeholder in E.8: k >= m*kappa/(theta*N*sigma*delta). Blocking #556."
  },
  {
    "key": "validator_self_stake_ratio_min_percent",
    "value": 20,
    "unit": "percent",
    "bucket": "DEFINED",
    "cite": "§15.2 (MinSelfStakeRatio)",
    "note": "Self-stake MUST be >= 20% of (self + delegated). Caps delegation leverage at 5x."
  },
  {
    "key": "validator_max_slots_per_entity",
    "value": 5,
    "unit": "count",
    "bucket": "DEFINED",
    "cite": "§15.2 (MaxSlotsPerEntity)"
  },
  {
    "key": "validator_min_delegation",
    "value": 100,
    "unit": "FLOP",
    "bucket": "DEFINED",
    "cite": "§15.2; §6.1"
  },
  {
    "key": "validator_active_set_cap",
    "value": 1000,
    "unit": "count",
    "bucket": "PLANNED",
    "cite": "Appendix A; §15.5; R15.5b; D-0437; blocked by E.41",
    "note": "Ratified at 1,000 but not reachable: E.41 — the runtime's MaxAuthorities = MAX_ACTIVE_VALIDATORS = 200, and new_session passes the whole ActiveValidators set to pallet_session untruncated. /intro/validator/ concurs: \"does not yet enforce the cap\". Model both 200 and 1,000."
  },
  {
    "key": "validator_active_set_wired",
    "value": 200,
    "unit": "count",
    "bucket": "PLANNED",
    "cite": "E.41 — Active-set cap vs. BABE authority bound [PLANNED]; blocking #1393",
    "note": "The bound the runtime can actually reach today."
  },
  {
    "key": "finality_committee_size",
    "value": 100,
    "unit": "count",
    "bucket": "DEFINED",
    "cite": "Appendix A; §15.4; R15.4a; D-0437",
    "note": "Sampled stake-weighted without replacement off a BABE-VRF seed from ActiveValidators filtered to effective_minimum_stake() AND is_work_verified_recent. Seed unbiasability is open (E.42)."
  },
  {
    "key": "committee_seat_inclusion_probability",
    "bucket": "PLANNED",
    "cite": "R15.4a (mechanism DEFINED); E.42 — Committee seat-capture model [TBD]; tracking #848",
    "note": "R15.4a fixes the MECHANISM: 100 members sampled \"stake-weighted without replacement\" off a BABE-VRF seed. It does not give a closed form for one validator's inclusion probability, and E.42 says the exact analysis is open — \"no aggregate-stake/binomial bridge\", and it must cover \"unequal stakes, small eligible pools, stake splitting, repeated draws\". The tool uses the first-order approximation p = min(1, committee_size * stake / network_stake), which is exact at the set average and degrades for large stake fractions. Marked PLANNED, never DEFINED, and overridable."
  },
  {
    "key": "validator_rotation_interval_blocks",
    "value": 2592000,
    "unit": "blocks",
    "bucket": "DEFINED",
    "cite": "Appendix A; §15.5; D-0416",
    "note": "~30 days at 1 s."
  },
  {
    "key": "validators_to_eject",
    "value": 50,
    "unit": "count",
    "bucket": "DEFINED",
    "cite": "Appendix A; §15.5; R15.5"
  },
  {
    "key": "validators_to_promote",
    "value": 50,
    "unit": "count",
    "bucket": "DEFINED",
    "cite": "Appendix A; §15.5; R15.5",
    "note": "Promoted from ValidatorQueue only while a slot is free (R15.5b)."
  },
  {
    "key": "ejection_cooldown_blocks",
    "value": 604800,
    "unit": "blocks",
    "bucket": "DEFINED",
    "cite": "Appendix A; §15.5",
    "note": "~7 days. Rejoin with stake topped to the current minimum."
  },
  {
    "key": "validator_unbonding_blocks",
    "value": 1814400,
    "unit": "blocks",
    "bucket": "DEFINED",
    "cite": "Appendix A; §13; §15.7; D-0419",
    "note": "~21 days, slash-locked while any session/dispute/audit is open. Deliberately > da_ephemeral_retention_blocks (14 d)."
  },
  {
    "key": "work_recency_window_blocks",
    "value": 86400,
    "unit": "blocks",
    "bucket": "DEFINED",
    "cite": "§15.2 (WorkRecencyWindow)",
    "note": "24 h. LastVerifiedWork must fall inside it or the validator is \"active but out of the PoUI committee\". This is what forces the GPU backend - see validator_gpu_backend_cost."
  },
  {
    "key": "validator_rotation_rank_key",
    "value": "stake",
    "unit": "enum",
    "bucket": "DEFINED",
    "cite": "R15.5; D-0416",
    "note": "\"Ranking MUST be by stake subject to a minimum-performance floor (verified-work + liveness), so wash verified-work does not improve rank.\" The 40/30/20/10 composite score is the FLOOR input (§15.4), not the rank. /intro/validator/ says the running implementation still ranks on work+performance - see disagreements.rotation_rank."
  },
  {
    "key": "performance_score_weights",
    "value": "40/30/20/10",
    "unit": "percent_uptime_blockrate_accuracy_latency",
    "bucket": "DEFINED",
    "cite": "Appendix A; §15.4",
    "note": "Composite score used as the rotation floor, not the rank key."
  },
  {
    "key": "validator_queue_stake_lock",
    "value": "full_reducible_balance",
    "unit": "enum",
    "bucket": "DEFINED",
    "cite": "§15.2",
    "note": "\"register freezes the account's full reducible balance as self-stake and places the validator in ValidatorQueue, not directly in ActiveValidators.\" Queued validators earn no validator-leg reward (R15.5b)."
  },
  {
    "key": "validator_unbonding_slash_lock",
    "value": "blocked while any session, dispute or audit is open",
    "unit": "rule",
    "bucket": "DEFINED",
    "cite": "§15.7; §13.1 (M11); D-0419",
    "note": "The 21-day unbonding clock does not merely run alongside open work — it is frozen by it. M11: \"unbonding frozen while any session/dispute open (slash-lock); unlock cooldown runs after last closes\". §1.2's reading rule states the principle: \"stake outlives disputes\". So time-to-cash is 21 days AFTER the last open item closes, not 21 days from the request."
  },
  {
    "key": "validator_bond_lock_months",
    "bucket": "ABSENT",
    "cite": "not in the yellow paper; E.38 leaves the genesis distribution path unspecified",
    "note": "Community reporting says the testnet top-1000 receive their bond free, locked 24 months. Searched the yellow paper for \"24 month\", \"24-month\", \"two year\", \"bonded stake\" and \"locked 24\": ZERO hits. E.38 states the path distributing genesis_supply \"has no normative section\", and lists \"what the validator cohort converts on\" as open. So this is a user input with a dotted mark, never a default wearing a spec badge."
  },
  {
    "key": "network_stake_growth_rate",
    "bucket": "ABSENT",
    "cite": "no spec view on what other validators do",
    "note": "Needed only because reward auto-compounding (E.39, D-0408) grows your stake, and pool share is pro-rata by stake. If every validator compounds at the same rate the share is UNCHANGED — the pool is fixed by emission, not by total stake, so compounding redistributes nothing at the set average. Your share only grows if you compound faster than the network. The spec has no view on that, so it is an input."
  },
  {
    "key": "validator_reward_liquidity",
    "bucket": "PLANNED",
    "cite": "E.39 — Validator-reward liquidity [RATIFY]; D-0408; blocking #1356",
    "note": "Binary and unresolved. Current behaviour: the validator 10% pool auto-compounds into LOCKED stake. The workbook (rev 2026-08-20) ratifies 0% reward lock but the distribution hook is unchanged. Model both - it materially changes IRR."
  },
  {
    "key": "audit_fee_split_ppm",
    "value": 10000,
    "unit": "ppm",
    "bucket": "DEFINED",
    "cite": "Appendix A; §7; D-0403 (#846)",
    "note": "Ratified 1% of the miner's settlement payment (the session-fee leg) carved into the audit pool that pays validators for audit work. This - not the workbook's 85/15 - is the enforced split. See disagreements.fee_split."
  },
  {
    "key": "audit_fee_per_turn",
    "value": 1,
    "unit": "FLOP",
    "bucket": "DEFINED",
    "cite": "Appendix A; §12.1; D-0403 (#846)",
    "note": "Flat fee a VRF-assigned validator claims per audit verdict via claim_audit_fee, \"gated on submitted evidence and pool solvency\". Apportionment is per-audit-performed, not pro-rata."
  },
  {
    "key": "sampled_audit_alpha_ppm",
    "value": 50000,
    "unit": "ppm",
    "bucket": "DEFINED",
    "cite": "Appendix A; §3.5 (#628)",
    "note": "Default alpha for sampled-audit certificate mode: 5% of turns selected post-epoch via VRF beacon. Described as the default for that mode; whether it applies to every session is not stated. audit_quantum_gn and high_value_gn_threshold force ADDITIONAL audits on top."
  },
  {
    "key": "sampled_audit_checkpoint_turns",
    "value": 16,
    "unit": "turns",
    "bucket": "DEFINED",
    "cite": "Appendix A; §3.5 (#628)"
  },
  {
    "key": "audit_quantum_gn",
    "value": 100000000,
    "unit": "G_n",
    "bucket": "DEFINED",
    "cite": "Appendix A; §12.2 (#764)",
    "note": "At least one audit ticket forced every this many G_n of served work."
  },
  {
    "key": "high_value_gn_threshold",
    "value": 10000000,
    "unit": "G_n",
    "bucket": "DEFINED",
    "cite": "Appendix A; §12.2 (#764)",
    "note": "Any single turn at or above this is force-audited (effective alpha = 1 for its leaf)."
  },
  {
    "key": "slash_liveness_percent",
    "value": 1,
    "unit": "percent",
    "bucket": "DEFINED",
    "cite": "Appendix A; §11.3; §13.2 (V1); D-0409",
    "note": "Downtime > 300 blocks. Effect: jailed. Re-entry: un_jail after >= 1 h."
  },
  {
    "key": "slash_extended_downtime_percent",
    "value": 5,
    "unit": "percent",
    "bucket": "DEFINED",
    "cite": "Appendix A; §11.3; §13.2 (V1); D-0409",
    "note": "Downtime > 24 h. Effect: kicked. Re-entry: rejoin with full stake top-up."
  },
  {
    "key": "slash_equivocation_lone_percent",
    "value": 50,
    "unit": "percent",
    "bucket": "DEFINED",
    "cite": "Appendix A; §11.3; §13.2 (V2); D-0420",
    "note": "Lone double-sign. The other 50% is RETURNED after 180 days. Effect: eject, re-stakeable after the return plus unlock cooldown. >= 1/3 correlated escalates to 100% + blacklist."
  },
  {
    "key": "equivocation_return_days",
    "value": 180,
    "unit": "days",
    "bucket": "DEFINED",
    "cite": "§11.3; D-0420"
  },
  {
    "key": "slash_fraud_percent",
    "value": 100,
    "unit": "percent",
    "bucket": "DEFINED",
    "cite": "Appendix A; §11.3; §13.2; D-0409",
    "note": "Full-burn class, four distinct offences: Collusion / Evidence forgery / TEE-attestation failure (HARD only) / >=1/3 correlated equivocation. Effect: eject + blacklist. No re-entry."
  },
  {
    "key": "da_serve_or_slash_percent",
    "value": 1,
    "unit": "percent",
    "bucket": "DEFINED",
    "cite": "Appendix A; §5.3; R5.3b; §13.2 (V3); D-0402",
    "note": "Bounded Liveness class, NOT fraud, and NOT part of the §11.3 table. A penalty MUST be re-derived from the live validator set, never stale-slashing a rotated-out provider."
  },
  {
    "key": "slash_loss_order",
    "value": "operator_self_stake, delegators_pro_rata, sponsors_at_fault_rate",
    "unit": "enum",
    "bucket": "DEFINED",
    "cite": "§11.3 (delegated-loss waterfall)"
  },
  {
    "key": "slash_proceeds_destination",
    "value": "FLOP_Foundation",
    "unit": "enum",
    "bucket": "DEFINED",
    "cite": "Appendix D; R9.10",
    "note": "Slashing proceeds transfer to FLOPFoundationAccount - never miner or validator revenue."
  },
  {
    "key": "validator_implied_annual_cost_flop",
    "value": 42236,
    "unit": "FLOP_per_year",
    "bucket": "DEFINED",
    "cite": "§2.2 (derived from the committee-cap disclosure)",
    "derived": true,
    "derivation": "§2.2: \"The committee cap of 100 is cost-derived. At the original 1.5 FLOP floor the validator reward pool sustained ~112 bare-metal validators... D-0436 doubled the floor to 3 FLOP/block, so that pool now sustains ~224.\" 1.5 * 0.10 * 31,536,000 / 112 = 42,235.7 3.0 * 0.10 * 31,536,000 / 224 = 42,235.7 The identity across two independent pool sizes confirms a straight pool-divided-by-fixed-cost calculation, so the paper carries this implicit per-validator annual operating cost.",
    "note": "This is the spec's own implied cost basis, NOT an observed cost. The USD basis behind it is not public (it lives in the non-public miner-validator-economics.md). Use as a reference point, never as a quoted operating cost."
  },
  {
    "key": "validator_da_volume_bytes",
    "bucket": "ABSENT",
    "cite": "E.47 — DA availability and anti-grinding model [TBD]; blocking #1497",
    "note": "One of the two heavy legs (§15.3). Unit economics ARE derivable: Reed-Solomon rate 1/2, R=6 shards, k=3 reconstruct on a deterministic stake-weighted subset (hash(commitment) -> subset), so one assigned validator stores ~orig/3 bytes per blob, retained 14 d. Blob sizes: TEE quote 5-10 KB, event log <= 256 KB, plus proof_data (unstated). What is ABSENT is the total: E.47 leaves \"the cumulative storage/retention budget across the full session+challenge lifecycle\" open. §15.3 says only \"GB-scale bandwidth\". R5.3c: there MUST NOT be a per-byte DA fee - the duty is funded from the reward share."
  },
  {
    "key": "validator_gpu_requirement",
    "value": 0,
    "unit": "GPUs",
    "bucket": "DEFINED",
    "cite": "§15.1 (MUST NOT); §15.3; R15.4c",
    "note": "Normatively ZERO, and this reversed at publication. §15.1: \"A validator function MUST NOT require executing inference, producing PoUI proofs, or owning a GPU or TEE: committee eligibility is verification liveness (§15.4), and re-execution is a checker duty (§3.5).\" §15.3 concludes \"The one heavy leg is DA storage/serving; no validator duty requires a GPU or TEE\", and rates the verification duties \"light CPU\". The superseded draft said the opposite - \"a production validator co-locates or delegates to a calibrated miner backend\", \"GPU-heavy\", \"the two heavy legs\". This tool modelled a GPU cost leg on that basis and no longer does. See disagreements.v0_5_0_rebase."
  },
  {
    "key": "validator_ref_cpu_cores",
    "value": 8,
    "unit": "physical_cores",
    "bucket": "PLANNED",
    "cite": "§15.3 (SHOULD; validator-miner-hardware-costs.md §2.1)",
    "note": "SHOULD, not MUST, and the sizing document behind it is not public - so the tool can quote it but cannot verify it. \"8 physical cores at >=3.4 GHz with SMT off\". PLANNED for that reason."
  },
  {
    "key": "validator_ref_ram_gb",
    "value": 32,
    "unit": "GB",
    "bucket": "PLANNED",
    "cite": "§15.3 (SHOULD; validator-miner-hardware-costs.md §2.1)",
    "note": "ECC."
  },
  {
    "key": "validator_ref_nvme_tb",
    "value": 4,
    "unit": "TB",
    "bucket": "PLANNED",
    "cite": "§15.3 (SHOULD; validator-miner-hardware-costs.md §2.1)",
    "note": "Enterprise NVMe - chain state plus DA custody under the §5.3 retention window."
  },
  {
    "key": "validator_ref_link_gbps",
    "value": 1,
    "unit": "Gbps",
    "bucket": "PLANNED",
    "cite": "§15.3 (SHOULD; validator-miner-hardware-costs.md §2.1)",
    "note": "\"a 1 Gbps symmetric UNMETERED link\". The closest the spec comes to sizing the DA bandwidth duty, and unmetered is the operative word: the cost is a flat link, not per-GB egress. It does not close E.47 - repair bandwidth and audit timing stay open - but it does tell an operator what to buy, which the superseded draft did not."
  },
  {
    "key": "validator_hardware_spec",
    "bucket": "PLANNED",
    "cite": "§15.3 (SHOULD-level reference profile); validator-miner-hardware-costs.md (not public)",
    "note": "CHANGED at publication. The superseded draft gave no hardware guidance at all, only qualitative intensities, and this row said so. §15.3 now carries a SHOULD-level reference profile - see validator_ref_* - described as \"the AlephBFT-class node reference plus storage\". Still not a MUST, and the document behind it is not published, so PLANNED."
  },
  {
    "key": "da_ephemeral_retention_blocks",
    "value": 1209600,
    "unit": "blocks",
    "bucket": "DEFINED",
    "cite": "Appendix A; §5.3; R5.3d; D-0412",
    "note": "14 days. Bounds the session challenge window (7 d <= 14 d)."
  },
  {
    "key": "da_shard_count",
    "value": 6,
    "unit": "count",
    "bucket": "DEFINED",
    "cite": "Appendix A; §5.3; R5.3a; D-0402",
    "note": "Reed-Solomon rate 1/2, R = 6 (k = 3+3, any 3 reconstruct)."
  },
  {
    "key": "da_min_replication_factor",
    "value": 3,
    "unit": "count",
    "bucket": "DEFINED",
    "cite": "Appendix A; §5.3; R5.3a; D-0402"
  },
  {
    "key": "da_erasure_expansion_ratio",
    "value": 2,
    "unit": "ratio",
    "bucket": "DEFINED",
    "cite": "§5.3 R5.3a; Appendix F.4 (Reed-Solomon rate 1/2)",
    "note": "Rate 1/2 means the stored bytes are twice the original. R=6 shards of orig/3 each; any k=3 reconstruct. The subset SIZE is never stated, but it cancels: subset x shard = 2 x original by construction, so expected per-validator bytes do not depend on it."
  },
  {
    "key": "toploc_commitment_bytes",
    "value": 258,
    "unit": "bytes",
    "bucket": "DEFINED",
    "cite": "§3.4",
    "note": "\"TOPLOC commits the top-128 values+indices of each token's last hidden state, polynomial-encoded to ~258 bytes / 32 tokens.\" Stated with a tilde - it is a size for a scheme, not a protocol constant, so a derivation from it is approximate and says so. R3.4a makes the commitment mandatory for every session and requires publication to DA."
  },
  {
    "key": "toploc_commitment_token_window",
    "value": 32,
    "unit": "tokens",
    "bucket": "DEFINED",
    "cite": "§3.4",
    "note": "The window the 258 bytes covers."
  },
  {
    "key": "verified_turn_bytes_base",
    "value": 269,
    "unit": "bytes",
    "bucket": "DEFINED",
    "cite": "Appendix F.3 (VerifiedTurn); D-0505",
    "note": "\"SCALE size 269 + compact_len(L) + 33L B for path length L\". The fixed part; the V3 leaf preimage itself is still 236 B. WAS 268 in the superseded pre-publication draft. D-0505 added an explicit leaf_version field to the container - one byte. Numerically negligible; the citation was not."
  },
  {
    "key": "verified_turn_merkle_item_bytes",
    "value": 33,
    "unit": "bytes",
    "bucket": "DEFINED",
    "cite": "Appendix F.3",
    "note": "Each Merkle path item is (sibling_hash:H256, sibling_is_left:bool) = 32 + 1 B."
  },
  {
    "key": "work_recency_window_blocks_gate",
    "value": 86400,
    "unit": "blocks",
    "bucket": "DEFINED",
    "cite": "§15.2 table; R15.4a; R15.4c (verification liveness)",
    "note": "24 h. Still a RECENCY test on a timestamp rather than a quantity test - but R15.4c, new at publication, changed WHAT refreshes it. Only an on-chain ACCEPTED VERIFICATION duty counts: signing an accepted attestation bundle (R3.6b), signing an accepted TOPLOC mismatch or escalation-clear quorum (R3.5d), an accepted DA retrievability-audit response (R5.3b), an accepted dispute opening (R12.1f), or a correct answer to a protocol-issued known-answer verification challenge. Explicitly: \"Prover credit (OnProofVerified) MUST NOT refresh it.\" The superseded draft refreshed it with verified PoUI work - the prover credit now forbidden. §15.3 rates these duties \"light CPU\". Because (a)-(d) exist only when there is traffic, the protocol MUST issue every active validator at least one challenge per window."
  },
  {
    "key": "calibration_min_utilization_ppm",
    "value": 500000,
    "unit": "ppm",
    "bucket": "DEFINED",
    "cite": "Appendix A; §6.1; R7.2",
    "note": "50%. A MINER rule, not a validator one - §15.1: \"Validators are not miners - a validator account MAY also register as a miner, but miner activity confers no validator eligibility.\" Renewal work MUST cover C_effective x max(1, current_block - renewal_trigger) x this / 10^6, relative to the miner's OWN effective capacity. Carried here because the superseded draft routed validator committee eligibility through a calibrated miner backend, and this was the only quantity floor behind it. R15.4c cut that link."
  },
  {
    "key": "calibration_lease_blocks",
    "value": 604800,
    "unit": "blocks",
    "bucket": "DEFINED",
    "cite": "Appendix A; §6.1; R7.2; D-0433",
    "note": "7 days. At the exact expiry boundary every PoUI and compute-channel consumer fails closed."
  },
  {
    "key": "calibration_renewal_min_verified_jobs",
    "value": 8,
    "unit": "jobs",
    "bucket": "DEFINED",
    "cite": "Appendix A; §6.1; R7.2; D-0433",
    "note": "Minimum fresh one-shot Ghost canaries per renewal. Job count alone MUST NOT renew a cap."
  },
  {
    "key": "calibration_renewal_max_age_blocks",
    "value": 600,
    "unit": "blocks",
    "bucket": "DEFINED",
    "cite": "Appendix A; §6.1; R7.2",
    "note": "10 minutes. Bounds the renewal window, so the 50% floor applies over at most 600 blocks - a burst, not a sustained duty."
  },
  {
    "key": "network_sessions_per_day",
    "bucket": "ABSENT",
    "cite": "E.49 — independent-demand and value-at-risk model [TBD]; tracking #735",
    "note": "The single genuine unknown behind the DA duty, and more so since publication. The spec has no demand model (E.49 open), and D-0502 WITHDREW the throughput figures the superseded draft carried: \"no session-control transactions-per-block, finalized-lifecycles-per-second, or inclusion/finality-latency target is specified.\" There is no published capacity figure left to anchor against."
  },
  {
    "key": "network_turns_per_session",
    "bucket": "ABSENT",
    "cite": "no normative source; bounded above by channel_max_settlement_turns",
    "note": "Traffic shape, not a protocol figure. The spec bounds a settlement bundle (channel_max_settlement_turns) but says nothing about typical session length."
  },
  {
    "key": "network_tokens_per_turn",
    "bucket": "ABSENT",
    "cite": "no normative source",
    "note": "Drives the TOPLOC commitment volume at 258 B per 32 tokens. Pricing is quoted in tokens (§4) but no typical turn length is stated anywhere."
  },
  {
    "key": "da_storage_price_usd_gb_month",
    "bucket": "ABSENT",
    "cite": "outside the protocol - the operator's own hosting contract",
    "note": "Not a spec figure and never will be. R5.3c/§15.3: the duty is \"funded by reward share, no per-byte fee\", so what a validator pays for storage is a fact about their provider."
  },
  {
    "key": "da_bandwidth_volume",
    "bucket": "ABSENT",
    "cite": "E.47 — DA availability and anti-grinding model [TBD]; tracking #1497",
    "note": "NOT derivable, and deliberately left out of the model rather than approximated. E.47 leaves \"audit/repair timing, repair bandwidth\" open, and §15.3 quantifies the duty only as \"GB-scale bandwidth\". Storage is derivable; the egress that goes with it is not."
  },
  {
    "key": "da_direct_rail_blob_bytes",
    "bucket": "ABSENT",
    "cite": "§5.2 (5-10 KB quote, event log <= 256 KB); E.46 [TBD]; tracking #1496",
    "note": "The direct PoUI rail's DA payload is \"proof_data, TEE quote (5-10 KB), event log (<= 256 KB)\" - a range, a ceiling, and one unstated term. E.46 calls its byte figures \"arithmetic byte ceilings only\". Modelling it would mean picking a number inside a 50x band, so the derivation covers the session-transcript path only and says so."
  },
  {
    "key": "da_endpoint_deposit",
    "value": 1,
    "unit": "FLOP",
    "bucket": "DEFINED",
    "cite": "Appendix A (reference-only); §5.3",
    "note": "Refundable, held while a validator's DA serving endpoint announcement exists."
  },
  {
    "key": "da_lease_deposit_per_byte",
    "value": 200,
    "unit": "FLOP_per_GB",
    "bucket": "DEFINED",
    "cite": "Appendix A; §5.3; R5.3d; D-0412",
    "note": "NOT a validator cost. Refundable anti-spam deposit for leased model weights, held on the PUBLISHER, \"returned in full on prune or withdrawal - never revenue\"."
  },
  {
    "key": "refund_penalty_phi_percent",
    "value": 20,
    "unit": "percent",
    "bucket": "DEFINED",
    "cite": "Appendix A; §12.1; R12.1d; D-0422",
    "note": "Applies to ambiguous early close ONLY. phi = 0 for miner-fault non-delivery. Cooperative settle never reaches phi (E is paid in full, no unused remainder). Penalty routes 100% to burn/Foundation, never the miner."
  },
  {
    "key": "channel_base_per_turn",
    "value": 1,
    "unit": "channel_pay_units",
    "bucket": "DEFINED",
    "cite": "Appendix A; §12.1; R12.1d (#719 option A)",
    "note": "The two-part tariff's flat leg: P = BasePerTurn*n + rate_G*G_claimed. Applies on the unilateral force_settle -> finalize path, not the cooperative one."
  },
  {
    "key": "channel_c_turn_fixed",
    "value": 1,
    "unit": "channel_pay_units",
    "bucket": "DEFINED",
    "cite": "Appendix A; §12.1 (#719)",
    "note": "integrity_test asserts BasePerTurn >= CTurnFixed so dust turns are not net-negative."
  },
  {
    "key": "channel_rate_g_per_gn",
    "value": 1,
    "unit": "channel_pay_units_per_G_n",
    "bucket": "DEFINED",
    "cite": "§12.1; R12.1d",
    "note": "rate_G in the two-part tariff. R12.1d: \"The current implementation uses a numeric rate of one channel pay unit per stored G_n unit.\" Both tariff legs are therefore in channel pay units, not FLOP — see channel_unit_to_flop."
  },
  {
    "key": "channel_unit_to_flop",
    "bucket": "ABSENT",
    "cite": "E.30 — G_n numeric type and unit taxonomy [TBD]; blocking #588",
    "note": "THE units hole, and it governs the WHOLE tariff rather than just the work leg. R12.1d gives P = BasePerTurn*n + rate_G*G_claimed with channel_base_per_turn = 1 and rate_G = 1, so P is denominated in channel pay units end to end; E.30 \"must ratify its dimensional relation to FLOP's base units and 18 decimals.\" Escrow E is in FLOP. Comparing P against E therefore needs this conversion, and R4.4 forbids assuming one: \"Until E.30 ratifies, implementations MUST treat the settlement unit as reference F_eff and MUST NOT conflate it with physical FP16/INT8/INT4 ops, energy, or latency.\""
  },
  {
    "key": "escrow_sizing_formula",
    "bucket": "ABSENT",
    "cite": "E.23 — Minimum-escrow / bonded-reservation economics [TBD]; blocking ENG-10 (#220)",
    "note": "No formula, no floor, no ceiling. Nothing relates escrow to sla, precision, settlement_class, token count or G_n. min_force_open_escrow_for_failed_ack (0.05 FLOP) is a FailedAcks threshold on the permissionless path, NOT a minimum escrow. E.23: \"the general pricing of a minimum escrow / bonded reservation is unspecified.\""
  },
  {
    "key": "session_price",
    "bucket": "ABSENT",
    "cite": "App. C.2; App. C.3; R12.1a; §15.6; M8",
    "note": "There is no protocol price, no auction, no floor and no fee market. App. C.3: \"escrow is reserved and is the price.\" App. C.2: the agent selects a miner OFF-CHAIN. §15.6: \"there is no on-chain scheduler.\" M8 rates on-chain matching \"reputation layer only [GAP]\". This is not \"unratified\" - the protocol has no view. User supplies a bare scalar."
  },
  {
    "key": "channel_challenger_bond",
    "value": 100,
    "unit": "FLOP",
    "bucket": "DEFINED",
    "cite": "Appendix A; §12.1; R12.1f",
    "note": "Bond a challenger posts to open a session dispute. Standing is restricted to the session agent (own channel) and active validators (any channel); arbitrary public challengers are rejected before bond lock. R3.5a makes the agent the standing challenger for its own channel."
  },
  {
    "key": "challenger_bond_on_failed_dispute",
    "bucket": "ABSENT",
    "cite": "no rule stated; R13.0c covers only the DA-unrecoverable return path",
    "note": "The spec states the bond IS returned on the DA-unrecoverable path (\"challenger-bond return\", R13.0c / V4). It does not state what happens on a dispute that simply fails. Model as forfeited and label the assumption conservative."
  },
  {
    "key": "max_active_reservations_base",
    "value": 4,
    "unit": "count",
    "bucket": "DEFINED",
    "cite": "Appendix A; §12.2; R12.2",
    "note": "Base concurrent active capacity reservations per agent identity."
  },
  {
    "key": "escrow_per_reservation_slot",
    "value": 50,
    "unit": "FLOP",
    "bucket": "DEFINED",
    "cite": "Appendix A; §12.2; R12.2",
    "note": "Escrow that grants +1 reservation slot beyond base. Freed on settle/expire/timeout/fraud."
  },
  {
    "key": "channel_max_settlement_turns",
    "value": 1024,
    "unit": "count",
    "bucket": "DEFINED",
    "cite": "Appendix A; §12.1",
    "note": "Hard cap per settle/force_settle bundle, and the ceiling on an SLA's max_turns at open."
  },
  {
    "key": "channel_max_merkle_path_len",
    "value": 64,
    "unit": "count",
    "bucket": "DEFINED",
    "cite": "Appendix A; §12.1"
  },
  {
    "key": "channel_dispute_window_blocks",
    "value": 604800,
    "unit": "blocks",
    "bucket": "DEFINED",
    "cite": "Appendix A; §12.1; R12.1f; D-0403",
    "note": "7 days. integrity_test enforces <= da_ephemeral_retention_blocks (14 d)."
  },
  {
    "key": "channel_dispute_response_window_blocks",
    "value": 7200,
    "unit": "blocks",
    "bucket": "DEFINED",
    "cite": "Appendix A; §12.1; D-0403",
    "note": "2 hours. Non-response defaults to a fraud verdict (R12.1f)."
  },
  {
    "key": "channel_ack_window_blocks",
    "value": 600,
    "unit": "blocks",
    "bucket": "DEFINED",
    "cite": "Appendix A; §12.1; App. C.3",
    "note": "10 min for a named miner to force_ack a force_open before expire refunds escrow in full."
  },
  {
    "key": "min_force_open_escrow_for_failed_ack",
    "value": 0.05,
    "unit": "FLOP",
    "bucket": "DEFINED",
    "cite": "Appendix A; §12.1; D-0423",
    "note": "NOT a minimum escrow. It is the threshold above which an expired, unacked force_open increments the named miner's FailedAcks counter."
  },
  {
    "key": "min_certificate_premium_ppm",
    "value": 1500000,
    "unit": "ppm",
    "bucket": "DEFINED",
    "cite": "Appendix A; §12.2 (#535)",
    "note": "1.5x minimum price multiple over \"the model's per-GFLOP rate\" for certificate-backed premium settlement. Note what it multiplies: a per-GFLOP rate that does not exist as a protocol parameter (see session_price). A defined multiplier over an undefined base."
  },
  {
    "key": "settlement_class_enumeration",
    "bucket": "ABSENT",
    "cite": "App. G (field exists); §12.2 (only certificate_settle named)",
    "note": "open_channel takes a settlement_class argument but the classes are never enumerated. Exactly one is named anywhere in the spec: certificate_settle, priced by min_certificate_premium_ppm."
  },
  {
    "key": "sla_breach_rebate",
    "bucket": "ABSENT",
    "cite": "M6 (§13.1); E.22 (SPEC-026)",
    "note": "M6: \"soft economic SLA: ceiling reject + rebate + reputation; slash only for timing fraud\", agent recovery \"rebate on co-signed breach\". The rebate is CO-SIGNED, i.e. negotiated bilaterally, not protocol-computed. No size is specified."
  },
  {
    "key": "agent_identity_min_stake",
    "value": 10,
    "unit": "FLOP",
    "bucket": "DEFINED",
    "cite": "Appendix A; §6.2"
  },
  {
    "key": "agent_per_tx_limit",
    "value": 100,
    "unit": "FLOP",
    "bucket": "DEFINED",
    "cite": "Appendix A (reference-only); §6.2"
  },
  {
    "key": "agent_daily_cap_autonomous",
    "value": 500,
    "unit": "FLOP",
    "bucket": "DEFINED",
    "cite": "Appendix A (reference-only); §6.2"
  },
  {
    "key": "circuit_breaker_tx_count",
    "value": 100,
    "unit": "count",
    "bucket": "DEFINED",
    "cite": "Appendix A; §6.2; R6.2b"
  },
  {
    "key": "circuit_breaker_flop_cap",
    "value": 250,
    "unit": "FLOP",
    "bucket": "DEFINED",
    "cite": "Appendix A; §6.2; R6.2b"
  },
  {
    "key": "circuit_breaker_window_blocks",
    "value": 60,
    "unit": "blocks",
    "bucket": "DEFINED",
    "cite": "Appendix A (reference-only); §6.2"
  },
  {
    "key": "session_key_max_duration_blocks",
    "value": 864000,
    "unit": "blocks",
    "bucket": "DEFINED",
    "cite": "§6.2 (SessionKeysMaxDuration)",
    "note": "~10 days at uninterrupted 1 s cadence only; §6.2 notes missed or delayed blocks extend the elapsed lifetime, so it is not a wall-clock bound."
  },
  {
    "key": "agent_reward_distribution",
    "bucket": "PLANNED",
    "cite": "R9.12; E.40 — Agent & staker leg distribution [TBD]; blocking #1350, #1351",
    "note": "Agents are pure cost centres today. R9.12: the agent and staker legs MUST be minted to sovereign pool accounts and \"Onward distribution from either pool MUST NOT occur until its distribution policy is ratified (E.40)\". E.40's placeholder basis for agents is \"pro-rata by settled inference spend\", marked unconfirmed. The parked legs still MINT, so they dilute every holder while paying nobody. Model as zero; expose an upside switch only."
  },
  {
    "key": "agent_testnet_conversion",
    "bucket": "ABSENT",
    "cite": "E.38 — Genesis allocation & airdrop vesting [TBD]; blocking #257, #1176",
    "note": "/intro/agent/ states \"Every 3 FLOP of inference fees unlocks 1 airdropped FLOP\" and \"Agent airdrops are locked to inference spend or stake delegation\". The yellow paper contains the words \"faucet\" and \"technocore\" ZERO times, and E.38 says the path distributing genesis_supply \"has no normative section\", listing \"whether spend-to-unlock ships\" as open and noting the agent vesting horizon disagrees with itself (90-day linear in the pallet vs. three-year Y1/Y2/Y3 in the sim params). Do not model."
  },
  {
    "key": "min_miner_self_stake",
    "value": 10000,
    "unit": "FLOP",
    "bucket": "DEFINED",
    "cite": "Appendix A; §6.1",
    "note": "Retained because a validator needs a calibrated miner backend for the committee gate."
  },
  {
    "key": "miner_capacity_stake_per_gflop",
    "value": 0.01,
    "unit": "FLOP_per_GFLOP_per_s",
    "bucket": "DEFINED",
    "cite": "Appendix A; §6.1; D-0418",
    "note": "required_self_stake(B_p) = min_miner_self_stake + this * B_p. LINEAR, NO CAP. D-0418 is marked \"provisional pending sim calibration\" and /intro/miner/ says \"The rate is still under economic reconciliation, so size a fleet against the live requirement rather than a published coefficient.\""
  },
  {
    "key": "miner_stake_surge_multiplier_ppm",
    "value": 1250000,
    "unit": "ppm",
    "bucket": "DEFINED",
    "cite": "Appendix A; §6.1",
    "note": "1.25x exposure stake while a cap is still burst/audit-ratcheted. Miner-side, not agent."
  },
  {
    "key": "soft_tier_spot_check_rate_ppm",
    "value": 25000,
    "unit": "ppm",
    "bucket": "DEFINED",
    "cite": "Appendix A; §4.2",
    "note": "~1 session in 40. MINER-side exposure, surfaced with the calibration snapshot event. It does not cost the agent anything."
  },
  {
    "key": "miner_unbonding_blocks",
    "value": 604800,
    "unit": "blocks",
    "bucket": "DEFINED",
    "cite": "Appendix A; §6.1"
  },
  {
    "key": "miner_reward_apportionment",
    "bucket": "ABSENT",
    "cite": "E.44 — Cooperative work-credit eligibility [TBD]; blocking #1494",
    "note": "Recorded for completeness because it is why the miner leg is not ours to build. Appendix D gives the validator leg an explicit apportionment and the miner leg none. R12.1b: \"Public reward eligibility and late-fraud recovery therefore remain open in E.44.\" /intro/miner/ states \"weighted by G_n\"; the normative spec does not."
  },
  {
    "key": "soft_tier_settlement_path",
    "bucket": "PLANNED",
    "cite": "E.33 — SOFT-tier (non-TEE) miner class [TBD]; R3.2; R12.1c; D-0432; blocking #650",
    "note": "Affects an agent's tier choice. R12.1c: \"The SOFT profile has no TEE-measured root; its model/decode binding, evidence predicate, value cap, and dispute path are E.33.\" /intro/miner/ markets SOFT as the default while also saying \"the currently wired settlement path remains the attested one.\""
  },
  {
    "key": "tee_tier_value_cap_premium",
    "bucket": "ABSENT",
    "cite": "R3.2 (asserts a higher cap, gives no number); E.33 (SOFT's cap)",
    "note": "R3.2: a TEE attestation \"raises its assurance tier (HARD) and its permitted value cap\". No cap is stated for either tier anywhere. The HARD-vs-SOFT economic trade cannot be priced from the spec."
  },
  {
    "key": "aggregate_reservation_model",
    "bucket": "PLANNED",
    "cite": "E.22 — Aggregate reservation + statistical drift + cache-aware metering [PLANNED]; D-0433",
    "note": "Still open: miner-wide capacity reservation across overlapping channels, rolling eligible-work coverage, and \"a proof-bound cached-prefix witness so reused prompt prefill is not charged again\". The last one bears directly on what an agent is billed for."
  }
];

export const DISAGREEMENTS: readonly Disagreement[] = [
  {
    "id": "tokenomics_graphic",
    "resolved": "2026-09-10",
    "spec_says": "Appendix A: genesis_supply = 3,500,000,000 split across four buckets - miners 1,200,000,000, validators 305,505,000, agents 1,200,000,000, reserve 794,495,000 (R9.4, D-0438/D-0435). Year-10 cumulative supply computes to 17,186,624,000.",
    "downstream_says": "A superseded version of flop.finance/assets/tokenomics.png stated \"18.1bn total supply by year 10\", \"0.5% terminal inflation / yr\", and an Airdrop of 4.4bn (24.3%) broken down as miners 1.20bn, VALIDATORS 1.20bn, agents 1.20bn, reserve 0.80bn. That validator line is roughly 4x Appendix A, and it accounts for the whole 0.9bn gap between 18.1bn and 17.19bn.",
    "status": "SUPERSEDED, not live. The asset now served at that URL reads \"17.2bn total supply by year 10\", \"0.6% terminal inflation\", Airdrop 3.5bn (20.4%), and an airdrop sub-split of miners 1.20bn / validators 0.31bn / agents 1.20bn / reserve 0.79bn - every figure agreeing with Appendix A and with this tool. The teaser page's own alt text describes the current version. Recorded because the older graphic circulated: anyone holding that screenshot has a validator airdrop roughly 4x too high and a total supply 0.9bn too high.",
    "quote": "\"// 18.1bn total supply by year 10 // 0.5% terminal inflation / yr ... Airdrop 4.4bn 24.3% - Miners 1.20bn 6.6% - Validators 1.20bn 6.6% - Agents 1.20bn 6.6% - Reserve / Incentives 0.80bn 4.4%\" (superseded flop.finance tokenomics graphic, marked DRAFT)",
    "tracking": "no issue number; both versions carry a preliminary/draft disclaimer",
    "handling": "Model Appendix A. The live graphic already agrees with it, so there is nothing to reconcile in the numbers - only the record of what circulated. Live asset archived at spec/assets/tokenomics-live-2026-09-10.png, sha256 e05656909de1a8a9."
  },
  {
    "id": "v0_5_0_rebase",
    "spec_says": "Published v0.5.0, §15.1: \"A validator function MUST NOT require executing inference, producing PoUI proofs, or owning a GPU or TEE: committee eligibility is verification liveness (§15.4), and re-execution is a checker duty (§3.5).\" §15.3: \"The one heavy leg is DA storage/serving; no validator duty requires a GPU or TEE.\"",
    "downstream_says": "The pre-publication draft this tool was first built against, §15.1: \"committee eligibility requires recent verified PoUI work (§15.4), so a production validator co-locates or delegates to a calibrated miner backend.\" §15.3 rated that duty \"GPU-heavy\" and concluded \"The two heavy legs are DA storage/serving and the committee-keeping GPU work.\"",
    "status": "Not a disagreement between sources - a reversal between drafts, recorded because this tool published figures on the old reading. R15.4c is new and decides it: the recency signal is refreshed only by accepted VERIFICATION duties, and \"Prover credit (OnProofVerified) MUST NOT refresh it.\" Three further changes came with it: VerifiedTurn 268 -> 269 B (D-0505 added leaf_version), a SHOULD-level reference hardware profile appeared in §15.3, and D-0502 withdrew the block-size and throughput targets.",
    "quote": "\"Prover credit (OnProofVerified) MUST NOT refresh it.\"",
    "tracking": "D-0501 (ratified), D-0502 (proposed), D-0505; github.com/flop-labs/yellowpaper",
    "handling": "Rebased. The GPU cost leg is removed, the committee gate is modelled as verification liveness, and both superseded findings were withdrawn rather than edited. 26 of the 29 quoted claims were re-verified unchanged; spec/yp.txt is kept as evidence of what moved."
  },
  {
    "id": "genesis_supply_fork",
    "resolved": "2026-09-10",
    "spec_says": "RESOLVED IN FAVOUR OF THE DOWNSTREAM FIGURE. Appendix A now reads genesis_supply = 3_500_000_000 FLOP (§9.3, D-0438); R9.4 requires it be split across exactly four buckets.",
    "downstream_says": "3,500,000,000 FLOP - the position /intro/revenue/, the teaser and the tokenomics workbook held from 2026-08-22, now ratified.",
    "status": "RESOLVED 2026-09-10 by D-0438, which superseded the D-0421/D-0435 pool sizes and left emission untouched. Kept rather than deleted: this tool published the OLD figure as ratified and the new one as unratified, which is backwards, and the record of that matters more than a tidy file.",
    "quote": "\"D-0438 ratified genesis_supply = 3,500,000,000 (the workbook's 2026-08-22 restatement), so the params page, the Yellow Paper appendix and this cash-flow model now agree.\" (flop.finance/intro/revenue/, retrieved 2026-09-10)",
    "tracking": "#1418, closed by D-0438",
    "handling": "Model 3,500,000,000. The superseded 2,483,460,000 is still computed side by side, because the difference is what the tool's own published dollar figures were wrong by."
  },
  {
    "id": "fee_split",
    "spec_says": "audit_fee_split_ppm = 10,000 ppm -> miner 99% / audit pool 1% (Appendix A, §7, D-0403)",
    "downstream_says": "85% miner / 15% validator (tokenomics workbook target; teaser)",
    "status": "The teaser flags itself.",
    "quote": "\"Two figures on this page LEAD the protocol parameters of record and are not yet ratified: the 3.5bn genesis airdrop (the parameters say 2,483,460,000) and the 85/15 inference-fee split (settlement pays the miner 99%, with 1% to the audit pool, until the validator fee leg lands).\"",
    "tracking": "#1352 (stated on flop.finance/intro/revenue/, not in the yellow paper)",
    "handling": "Use 1% for the audit pool. The 85/15 validator fee leg does not exist yet."
  },
  {
    "id": "session_market_shape",
    "spec_says": "Agent-initiated, 1:1, miner named in the extrinsic and selected off-chain. App. C.2: \"an agent selects a miner off-chain (model_registry::find_best_miners)\". §15.6: \"open_channel names the miner and pins model_hash; there is no on-chain scheduler.\"",
    "downstream_says": "/intro/agent/ and /intro/: \"Agents create a session request in the mempool. A capable miner accepts\", described as a \"Session request / 5 fields / Model-weight hash, max latency, FLOPs, a confidentiality flag, and the fee.\"",
    "status": "Direct contradiction. The real extrinsic has eleven fields (App. G), no FLOPs field (G_n is measured per turn, R12.1b) and no confidentiality flag. There is no mempool broadcast and no bidding.",
    "handling": "Do not model the mempool market. Surface the contradiction in the assumptions drawer."
  },
  {
    "id": "rotation_rank",
    "spec_says": "R15.5: \"Ranking MUST be by stake subject to a minimum-performance floor (verified-work + liveness)\". The 40/30/20/10 composite is the FLOOR input (§15.4), not the rank.",
    "downstream_says": "/intro/validator/: \"the running rotation ranks on recent verified work and performance score\", \"Planned: rank by stake above that floor instead.\"",
    "status": "Ratified rule and running implementation differ. FLOP says so itself.",
    "handling": "Model the ratified rule; note that the running network differs."
  },
  {
    "id": "active_set_cap",
    "spec_says": "validator_active_set_cap = 1,000 (Appendix A, R15.5b, D-0437)",
    "downstream_says": "E.41: \"the runtime cannot reach it: MaxAuthorities = MAX_ACTIVE_VALIDATORS = 200\". /intro/validator/: \"does not yet enforce the cap.\"",
    "status": "STRENGTHENED 2026-09-10. Not merely unwired: §5.3 of the published release states plainly that \"1,000 active validators is not a supported runtime state\", and refers to \"the supported active-set maximum of 200\" while sizing the attestation bundle. Appendix A still carries validator_active_set_cap = 1,000 under D-0437, so the ratified cap and the supported runtime state disagree inside one document.",
    "tracking": "#1393 (yellow paper, E.41 Blocking)",
    "handling": "Model both 200 and 1,000; the per-validator share differs 5x between them."
  },
  {
    "id": "agent_testnet_unlock",
    "spec_says": "E.38: the genesis-distribution path \"has no normative section\"; \"whether spend-to-unlock ships\" is open. \"faucet\" and \"technocore\" appear zero times in the yellow paper.",
    "downstream_says": "/intro/agent/: 'Every 3 FLOP of inference fees unlocks 1 airdropped FLOP.'",
    "status": "Product claim with no normative basis.",
    "tracking": "#257, #1176 (yellow paper, E.38 Blocking)",
    "handling": "Do not model. Name it in the drawer as an open item."
  },
  {
    "id": "validator_reward_liquidity",
    "spec_says": "Current behaviour: the validator 10% pool auto-compounds into locked stake (D-0408).",
    "downstream_says": "The workbook (rev 2026-08-20) ratifies 0% reward lock.",
    "status": "E.39 [RATIFY] - 'the distribution hook is unchanged'.",
    "tracking": "#1356 (yellow paper, E.39 Blocking)",
    "handling": "Model both. It materially changes IRR."
  }
];

export type ParamKey = "initial_block_reward" | "halving_interval_blocks" | "max_halvings" | "floor_reward" | "block_time_seconds" | "blocks_per_year" | "miner_share_ppt" | "validator_share_ppt" | "agent_share_ppt" | "staker_share_ppt" | "finality_committee_premium_weight_ppm" | "subsidy_per_block_per_recipient" | "genesis_supply" | "genesis_miner_airdrop" | "genesis_agent_airdrop" | "genesis_reserve" | "airdrop_vesting_duration_blocks" | "subsidy_duration_blocks" | "genesis_validator_airdrop" | "validator_min_stake" | "validator_growth_numerator" | "validator_growth_denominator" | "validator_value_coupled_floor_k" | "validator_self_stake_ratio_min_percent" | "validator_max_slots_per_entity" | "validator_min_delegation" | "validator_active_set_cap" | "validator_active_set_wired" | "finality_committee_size" | "committee_seat_inclusion_probability" | "validator_rotation_interval_blocks" | "validators_to_eject" | "validators_to_promote" | "ejection_cooldown_blocks" | "validator_unbonding_blocks" | "work_recency_window_blocks" | "validator_rotation_rank_key" | "performance_score_weights" | "validator_queue_stake_lock" | "validator_unbonding_slash_lock" | "validator_bond_lock_months" | "network_stake_growth_rate" | "validator_reward_liquidity" | "audit_fee_split_ppm" | "audit_fee_per_turn" | "sampled_audit_alpha_ppm" | "sampled_audit_checkpoint_turns" | "audit_quantum_gn" | "high_value_gn_threshold" | "slash_liveness_percent" | "slash_extended_downtime_percent" | "slash_equivocation_lone_percent" | "equivocation_return_days" | "slash_fraud_percent" | "da_serve_or_slash_percent" | "slash_loss_order" | "slash_proceeds_destination" | "validator_implied_annual_cost_flop" | "validator_da_volume_bytes" | "validator_gpu_requirement" | "validator_ref_cpu_cores" | "validator_ref_ram_gb" | "validator_ref_nvme_tb" | "validator_ref_link_gbps" | "validator_hardware_spec" | "da_ephemeral_retention_blocks" | "da_shard_count" | "da_min_replication_factor" | "da_erasure_expansion_ratio" | "toploc_commitment_bytes" | "toploc_commitment_token_window" | "verified_turn_bytes_base" | "verified_turn_merkle_item_bytes" | "work_recency_window_blocks_gate" | "calibration_min_utilization_ppm" | "calibration_lease_blocks" | "calibration_renewal_min_verified_jobs" | "calibration_renewal_max_age_blocks" | "network_sessions_per_day" | "network_turns_per_session" | "network_tokens_per_turn" | "da_storage_price_usd_gb_month" | "da_bandwidth_volume" | "da_direct_rail_blob_bytes" | "da_endpoint_deposit" | "da_lease_deposit_per_byte" | "refund_penalty_phi_percent" | "channel_base_per_turn" | "channel_c_turn_fixed" | "channel_rate_g_per_gn" | "channel_unit_to_flop" | "escrow_sizing_formula" | "session_price" | "channel_challenger_bond" | "challenger_bond_on_failed_dispute" | "max_active_reservations_base" | "escrow_per_reservation_slot" | "channel_max_settlement_turns" | "channel_max_merkle_path_len" | "channel_dispute_window_blocks" | "channel_dispute_response_window_blocks" | "channel_ack_window_blocks" | "min_force_open_escrow_for_failed_ack" | "min_certificate_premium_ppm" | "settlement_class_enumeration" | "sla_breach_rebate" | "agent_identity_min_stake" | "agent_per_tx_limit" | "agent_daily_cap_autonomous" | "circuit_breaker_tx_count" | "circuit_breaker_flop_cap" | "circuit_breaker_window_blocks" | "session_key_max_duration_blocks" | "agent_reward_distribution" | "agent_testnet_conversion" | "min_miner_self_stake" | "miner_capacity_stake_per_gflop" | "miner_stake_surge_multiplier_ppm" | "soft_tier_spot_check_rate_ppm" | "miner_unbonding_blocks" | "miner_reward_apportionment" | "soft_tier_settlement_path" | "tee_tier_value_cap_premium" | "aggregate_reservation_model";

const BY_KEY = new Map<string, Param>(PARAMS.map((p) => [p.key, p]));

/** The parameter record, or throw. Never returns undefined — a bad key is a bug, not a value. */
export function param(key: ParamKey): Param {
  const p = BY_KEY.get(key);
  if (!p) throw new Error(`unknown parameter: ${key}`);
  return p;
}
