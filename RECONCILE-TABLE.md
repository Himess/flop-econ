# RECONCILE — full parameter diff

Every entry in `params.yaml` against Appendix A of yellow paper 0.5.0
(`spec/yellowpaper-v0.5.0.md`, sha256 `cb414e5c…`), 2026-09-10.

`Changed` compares what this file carried **before** today's reconcile against Appendix A.
Only `genesis_supply` moved. See [RECONCILE.md](RECONCILE.md) §8 for the three
extraction artefacts and why the previous pass missed the genesis change.

| Parameter | params.yaml | Appendix A | Changed | Bucket | Citation |
|---|---|---|---|---|---|
| `agent_daily_cap_autonomous` | 500 | 500 | no | DEFINED |   |
| `agent_identity_min_stake` | 10 | 10 | no | DEFINED | [§6.2](#62-agent-autonomy--operating-without-per-action-consensus)  |
| `agent_per_tx_limit` | 100 | 100 | no | DEFINED |   |
| `agent_reward_distribution` | — | — | not in App. A | PLANNED | R9.12; E.40 — Agent & staker leg distribution [TBD]; blocking #1350, #1351 |
| `agent_share_ppt` | 100 | 100 | no | DEFINED | [§2.1](#21-requirements) D-0435 |
| `agent_testnet_conversion` | — | — | not in App. A | ABSENT | E.38 — Genesis allocation & airdrop vesting [TBD]; blocking #257, #1176 |
| `aggregate_reservation_model` | — | — | not in App. A | PLANNED | E.22 — Aggregate reservation + statistical drift + cache-aware metering [PLANNED]; D-0433 |
| `airdrop_vesting_duration_blocks` | 7776000 | 7776000 | no | DEFINED | [§9](#9-emission--supply) SPEC-022 |
| `audit_fee_per_turn` | 1 | 1 | no | DEFINED | [§12.1](#121-sessions--attested-streaming--aggregate-settlement) D-0403 |
| `audit_fee_split_ppm` | 10000 | 10000 | no | DEFINED | [§7](#7-hardware-calibration--drift) D-0403 |
| `audit_quantum_gn` | 100000000 | 100000000 | no | DEFINED | [§12.2](#122-per-identity-capacity-reservation)  |
| `block_time_seconds` | 1 | — | not in App. A | DEFINED | §2.2 (target parameters table); §1.2; R9.8 |
| `blocks_per_year` | 31536000 | — | not in App. A | DEFINED | Appendix A (floor_annual_emission); §2.2; D-0436 |
| `calibration_lease_blocks` | 604800 | 604800 | no | DEFINED | [§6.1](#61-primitives) D-0433 |
| `calibration_min_utilization_ppm` | 500000 | 500000 | no | DEFINED | [§6.1](#61-primitives)  |
| `calibration_renewal_max_age_blocks` | 600 | 600 | no | DEFINED | [§6.1](#61-primitives)  |
| `calibration_renewal_min_verified_jobs` | 8 | 8 | no | DEFINED | [§6.1](#61-primitives) D-0433 |
| `challenger_bond_on_failed_dispute` | — | — | not in App. A | ABSENT | no rule stated; R13.0c covers only the DA-unrecoverable return path |
| `channel_ack_window_blocks` | 600 | 600 | no | DEFINED | [§12.1](#121-sessions--attested-streaming--aggregate-settlement)  |
| `channel_base_per_turn` | 1 | 1 | no | DEFINED | [§12.1](#121-sessions--attested-streaming--aggregate-settlement)  |
| `channel_c_turn_fixed` | 1 | 1 | no | DEFINED | [§12.1](#121-sessions--attested-streaming--aggregate-settlement)  |
| `channel_challenger_bond` | 100 | 100 | no | DEFINED | [§12.1](#121-sessions--attested-streaming--aggregate-settlement)  |
| `channel_dispute_response_window_blocks` | 7200 | 7200 | no | DEFINED | [§12.1](#121-sessions--attested-streaming--aggregate-settlement) D-0403 |
| `channel_dispute_window_blocks` | 604800 | 604800 | no | DEFINED | [§12.1](#121-sessions--attested-streaming--aggregate-settlement) D-0403 |
| `channel_max_merkle_path_len` | 64 | 64 | no | DEFINED | [§12.1](#121-sessions--attested-streaming--aggregate-settlement)  |
| `channel_max_settlement_turns` | 1024 | 1024 | no | DEFINED | [§12.1](#121-sessions--attested-streaming--aggregate-settlement)  |
| `channel_rate_g_per_gn` | 1 | — | not in App. A | DEFINED | §12.1; R12.1d |
| `channel_unit_to_flop` | — | — | not in App. A | ABSENT | E.30 — G_n numeric type and unit taxonomy [TBD]; blocking #588 |
| `circuit_breaker_flop_cap` | 250 | 250 | no | DEFINED | [§6.2](#62-agent-autonomy--operating-without-per-action-consensus)  |
| `circuit_breaker_tx_count` | 100 | 100 | no | DEFINED | [§6.2](#62-agent-autonomy--operating-without-per-action-consensus)  |
| `circuit_breaker_window_blocks` | 60 | — | not in App. A | DEFINED | Appendix A (reference-only); §6.2 |
| `committee_seat_inclusion_probability` | — | — | not in App. A | PLANNED | R15.4a (mechanism DEFINED); E.42 — Committee seat-capture model [TBD]; tracking #848 |
| `da_bandwidth_volume` | — | — | not in App. A | ABSENT | E.47 — DA availability and anti-grinding model [TBD]; tracking #1497 |
| `da_direct_rail_blob_bytes` | — | — | not in App. A | ABSENT | §5.2 (5-10 KB quote, event log <= 256 KB); E.46 [TBD]; tracking #1496 |
| `da_endpoint_deposit` | 1 | 1 | no — extractor artefact | DEFINED | cell reads "VFY FLOP"; the description says "1 VFY = 1 FLOP" |
| `da_ephemeral_retention_blocks` | 1209600 | 1209600 | no | DEFINED | [§5.3](#53-the-verified-task-footprint--sovereign-da) D-0412 |
| `da_erasure_expansion_ratio` | 2 | — | not in App. A | DEFINED | §5.3 R5.3a; Appendix F.4 (Reed-Solomon rate 1/2) |
| `da_lease_deposit_per_byte` | 200 | 200 | no | DEFINED |  D-0412 |
| `da_min_replication_factor` | 3 | 3 | no | DEFINED | [§5.3](#53-the-verified-task-footprint--sovereign-da) D-0402 |
| `da_serve_or_slash_percent` | 1 | 1 | no | DEFINED | [§5.3](#53-the-verified-task-footprint--sovereign-da) D-0402 |
| `da_shard_count` | 6 | 6 | no | DEFINED | [§5.3](#53-the-verified-task-footprint--sovereign-da) D-0402 |
| `da_storage_price_usd_gb_month` | — | — | not in App. A | ABSENT | outside the protocol - the operator's own hosting contract |
| `ejection_cooldown_blocks` | 604800 | 604800 | no | DEFINED | [§15.5](#155-rotation--set-size)  |
| `equivocation_return_days` | 180 | — | not in App. A | DEFINED | §11.3; D-0420 |
| `escrow_per_reservation_slot` | 50 | 50 | no | DEFINED | [§12.2](#122-per-identity-capacity-reservation)  |
| `escrow_sizing_formula` | — | — | not in App. A | ABSENT | E.23 — Minimum-escrow / bonded-reservation economics [TBD]; blocking ENG-10 (#220) |
| `finality_committee_premium_weight_ppm` | 1100000 | 1100000 | no | DEFINED | [§9](#9-emission--supply)  |
| `finality_committee_size` | 100 | 100 | no | DEFINED | [§15.4](#154-selection--the-poui-gated-committee) D-0437 |
| `floor_reward` | 3 | 3 | no | DEFINED | [§9](#9-emission--supply) D-0436 |
| `genesis_agent_airdrop` | 1200000000 | 1200000000 | no | DEFINED | [§9.3](#93-genesis-configuration) D-0438 |
| `genesis_miner_airdrop` | 1200000000 | 1200000000 | no | DEFINED | [§9.3](#93-genesis-configuration) D-0438 |
| `genesis_reserve` | 794495000 | 794495000 | no | DEFINED | [§9.3](#93-genesis-configuration) D-0438 |
| `genesis_supply` | 3500000000 | 3500000000 | **CORRECTED 2026-09-10** (was 2483460000) | DEFINED | [§9.3](#93-genesis-configuration) D-0438 |
| `genesis_validator_airdrop` | 305505000 | 305505000 | no | DEFINED | [§9.3](#93-genesis-configuration) D-0435 |
| `halving_interval_blocks` | 63072000 | 63072000 | no | DEFINED | [§9](#9-emission--supply)  |
| `high_value_gn_threshold` | 10000000 | 10000000 | no | DEFINED | [§12.2](#122-per-identity-capacity-reservation)  |
| `initial_block_reward` | 96 | 96 | no | DEFINED | [§9](#9-emission--supply) D-008 |
| `max_active_reservations_base` | 4 | 4 | no | DEFINED | [§12.2](#122-per-identity-capacity-reservation)  |
| `max_halvings` | 5 | 5 | no | DEFINED | [§9](#9-emission--supply) D-0436 |
| `min_certificate_premium_ppm` | 1500000 | 1500000 | no | DEFINED | [§12.2](#122-per-identity-capacity-reservation)  |
| `min_force_open_escrow_for_failed_ack` | 0.05 | 0.05 | no | DEFINED | [§12.1](#121-sessions--attested-streaming--aggregate-settlement) D-0423 |
| `min_miner_self_stake` | 10000 | 10000 | no | DEFINED | [§6.1](#61-primitives)  |
| `miner_capacity_stake_per_gflop` | 0.01 | 0.01 | no — extractor artefact | DEFINED | cell reads "VFY / 100 FLOP per GFLOP/s (= 0.01)" |
| `miner_reward_apportionment` | — | — | not in App. A | ABSENT | E.44 — Cooperative work-credit eligibility [TBD]; blocking #1494 |
| `miner_share_ppt` | 750 | 750 | no | DEFINED | [§2.1](#21-requirements) D-0435 |
| `miner_stake_surge_multiplier_ppm` | 1250000 | 1250000 | no | DEFINED | [§6.1](#61-primitives)  |
| `miner_unbonding_blocks` | 604800 | 604800 | no | DEFINED | [§6.1](#61-primitives)  |
| `network_sessions_per_day` | — | — | not in App. A | ABSENT | E.49 — independent-demand and value-at-risk model [TBD]; tracking #735 |
| `network_stake_growth_rate` | — | — | not in App. A | ABSENT | no spec view on what other validators do |
| `network_tokens_per_turn` | — | — | not in App. A | ABSENT | no normative source |
| `network_turns_per_session` | — | — | not in App. A | ABSENT | no normative source; bounded above by channel_max_settlement_turns |
| `performance_score_weights` | 40/30/20/10 | 40/30/20/10 | no — extractor artefact | DEFINED | cell reads "40/30/20/10 percent"; my value is the whole string |
| `refund_penalty_phi_percent` | 20 | 20 | no | DEFINED | [§12.1](#121-sessions--attested-streaming--aggregate-settlement) D-0422 |
| `sampled_audit_alpha_ppm` | 50000 | 50000 | no | DEFINED | [§3.5](#35-tier-3--independent-optimistic-re-execution--slashing)  |
| `sampled_audit_checkpoint_turns` | 16 | 16 | no | DEFINED | [§3.5](#35-tier-3--independent-optimistic-re-execution--slashing)  |
| `session_key_max_duration_blocks` | 864000 | — | not in App. A | DEFINED | §6.2 (SessionKeysMaxDuration) |
| `session_price` | — | — | not in App. A | ABSENT | App. C.2; App. C.3; R12.1a; §15.6; M8 |
| `settlement_class_enumeration` | — | — | not in App. A | ABSENT | App. G (field exists); §12.2 (only certificate_settle named) |
| `sla_breach_rebate` | — | — | not in App. A | ABSENT | M6 (§13.1); E.22 (SPEC-026) |
| `slash_equivocation_lone_percent` | 50 | 50 | no | DEFINED | [§13.2](#132-validator-consensus--da--leader-duties) D-0420 |
| `slash_extended_downtime_percent` | 5 | 5 | no | DEFINED | [§13.2](#132-validator-consensus--da--leader-duties) D-0409 |
| `slash_fraud_percent` | 100 | 100 | no | DEFINED | [§13.2](#132-validator-consensus--da--leader-duties) D-0409 |
| `slash_liveness_percent` | 1 | 1 | no | DEFINED | [§13.2](#132-validator-consensus--da--leader-duties) D-0409 |
| `slash_loss_order` | operator_self_stake, delegators_pro_rata, sponsors_at_fault_rate | — | not in App. A | DEFINED | §11.3 (delegated-loss waterfall) |
| `slash_proceeds_destination` | FLOP_Foundation | — | not in App. A | DEFINED | Appendix D; R9.10 |
| `soft_tier_settlement_path` | — | — | not in App. A | PLANNED | E.33 — SOFT-tier (non-TEE) miner class [TBD]; R3.2; R12.1c; D-0432; blocking #650 |
| `soft_tier_spot_check_rate_ppm` | 25000 | 25000 | no | DEFINED | [§4.2](#42-the-op-count-model)  |
| `staker_share_ppt` | 50 | 50 | no | DEFINED | [§2.1](#21-requirements) D-0435 |
| `subsidy_duration_blocks` | 315360000 | 315360000 | no | DEFINED | [§9](#9-emission--supply) D-0436 |
| `subsidy_per_block_per_recipient` | 8 | 8 | no | DEFINED | [§2.2](#22-target-parameters) D-0436 |
| `tee_tier_value_cap_premium` | — | — | not in App. A | ABSENT | R3.2 (asserts a higher cap, gives no number); E.33 (SOFT's cap) |
| `toploc_commitment_bytes` | 258 | — | not in App. A | DEFINED | §3.4 |
| `toploc_commitment_token_window` | 32 | — | not in App. A | DEFINED | §3.4 |
| `validator_active_set_cap` | 1000 | 1000 | no | PLANNED | [§15.5](#155-rotation--set-size) D-0437 |
| `validator_active_set_wired` | 200 | — | not in App. A | PLANNED | E.41 — Active-set cap vs. BABE authority bound [PLANNED]; blocking #1393 |
| `validator_bond_lock_months` | — | — | not in App. A | ABSENT | not in the yellow paper; E.38 leaves the genesis distribution path unspecified |
| `validator_da_volume_bytes` | — | — | not in App. A | ABSENT | E.47 — DA availability and anti-grinding model [TBD]; blocking #1497 |
| `validator_gpu_requirement` | 0 | — | not in App. A | DEFINED | §15.1 (MUST NOT); §15.3; R15.4c |
| `validator_growth_denominator` | 100 | 100 | no | DEFINED | [§11](#11-security-invariants) D-0413 |
| `validator_growth_numerator` | 109 | 109 | no | DEFINED | [§11](#11-security-invariants) D-0413 |
| `validator_hardware_spec` | — | — | not in App. A | PLANNED | §15.3 (SHOULD-level reference profile); validator-miner-hardware-costs.md (not public) |
| `validator_implied_annual_cost_flop` | 42236 | — | not in App. A | DEFINED | §2.2 (derived from the committee-cap disclosure) |
| `validator_max_slots_per_entity` | 5 | — | not in App. A | DEFINED | §15.2 (MaxSlotsPerEntity) |
| `validator_min_delegation` | 100 | — | not in App. A | DEFINED | §15.2; §6.1 |
| `validator_min_stake` | 305505 | 305505 | no | DEFINED |  D-0413 |
| `validator_queue_stake_lock` | full_reducible_balance | — | not in App. A | DEFINED | §15.2 |
| `validator_ref_cpu_cores` | 8 | — | not in App. A | PLANNED | §15.3 (SHOULD; validator-miner-hardware-costs.md §2.1) |
| `validator_ref_link_gbps` | 1 | — | not in App. A | PLANNED | §15.3 (SHOULD; validator-miner-hardware-costs.md §2.1) |
| `validator_ref_nvme_tb` | 4 | — | not in App. A | PLANNED | §15.3 (SHOULD; validator-miner-hardware-costs.md §2.1) |
| `validator_ref_ram_gb` | 32 | — | not in App. A | PLANNED | §15.3 (SHOULD; validator-miner-hardware-costs.md §2.1) |
| `validator_reward_liquidity` | — | — | not in App. A | PLANNED | E.39 — Validator-reward liquidity [RATIFY]; D-0408; blocking #1356 |
| `validator_rotation_interval_blocks` | 2592000 | 2592000 | no | DEFINED | [§15.5](#155-rotation--set-size) D-0416 |
| `validator_rotation_rank_key` | stake | — | not in App. A | DEFINED | R15.5; D-0416 |
| `validator_self_stake_ratio_min_percent` | 20 | — | not in App. A | DEFINED | §15.2 (MinSelfStakeRatio) |
| `validator_share_ppt` | 100 | 100 | no | DEFINED | [§9](#9-emission--supply)  |
| `validator_unbonding_blocks` | 1814400 | 1814400 | no | DEFINED | [§13](#13-failure-semantics--actor--failure-matrix) D-0419 |
| `validator_unbonding_slash_lock` | blocked while any session, dispute or audit is open | — | not in App. A | DEFINED | §15.7; §13.1 (M11); D-0419 |
| `validator_value_coupled_floor_k` | — | — | not in App. A | ABSENT | E.8 — Value-coupled floor k + retarget cadence [TBD] |
| `validators_to_eject` | 50 | 50 | no | DEFINED | [§15.5](#155-rotation--set-size)  |
| `validators_to_promote` | 50 | 50 | no | DEFINED | [§15.5](#155-rotation--set-size)  |
| `verified_turn_bytes_base` | 269 | — | not in App. A | DEFINED | Appendix F.3 (VerifiedTurn); D-0505 |
| `verified_turn_merkle_item_bytes` | 33 | — | not in App. A | DEFINED | Appendix F.3 |
| `work_recency_window_blocks` | 86400 | — | not in App. A | DEFINED | §15.2 (WorkRecencyWindow) |
| `work_recency_window_blocks_gate` | 86400 | — | not in App. A | DEFINED | §15.2 table; R15.4a; R15.4c (verification liveness) |
