# FLOP agent & validator economics — inventory

Phase 1 pass for the agent and validator legs. Prepared 2026-09-09 against the yellow paper at
`flop.finance/intro/yellowpaper/`, re-fetched at the start of this pass and **byte-identical to the
copy taken this morning** (`diff` clean) — so every citation from `ECONOMICS.md` still resolves.
Local extraction: `spec/yp.txt`. Also read in full this pass: `/intro/agent/`, `/intro/validator/`,
`/intro/` (the index) — none of which had been read before.

Method unchanged: **Appendix A is the contract**; product pages are downstream and several lead it
on purpose. Buckets are `DEFINED` / `PLANNED` / `ABSENT`. Derived figures carry their inputs.
Inferences are marked. No gap is filled with a plausible number.

---

## 1. Corrections

The brief is second-hand from the last pass and asked me to assume errors. Most of what it carries
forward is right — the extrinsic signature, `escrow is the price`, φ = 20%, the 1% audit split, E.8
and E.40 — and I re-verified each. Ten corrections, of which four change the work.

**1. The official agent page describes a market the protocol does not have.** This is the big one,
and it is not the brief's error — the brief has the correct extrinsic. `/intro/agent/` says *"Agents
create a session request in the mempool. A capable miner accepts"*, and calls it a **"Session
request / 5 fields / Model-weight hash, max latency, FLOPs, a confidentiality flag, and the fee."*
`/intro/` repeats it. The spec says the opposite, twice, normatively:

> App. C.2: "Sessions are agent-initiated and 1:1; an agent selects a miner **off-chain**
> (`model_registry::find_best_miners`)."
> §15.6: "Miner and model selection is agent-driven (`open_channel` names the miner and pins
> `model_hash`); **there is no on-chain scheduler**."

There is no mempool broadcast, no bidding, no "capable miner accepts", and the extrinsic has eleven
fields, not five — with **no FLOPs field** (G_n is measured per turn, R12.1b) and **no
confidentiality flag** (confidentiality is the HARD/SOFT path). Any agent-side tool built from the
product pages models a market that does not exist. Three of FLOP's own pages are wrong about this.

**2. There is no escrow-sizing formula, and the spec says so.** The brief asks how escrow is
"computed or bounded". It is not. No formula relates escrow to `sla`, `precision`,
`settlement_class`, token count or G_n. There is no minimum and no maximum. `min_force_open_escrow_
for_failed_ack` = 0.05 FLOP is **not** a minimum escrow — it is the threshold above which an expired
unacked `force_open` increments the named miner's `FailedAcks` counter (§12.1, D-0423). The gap is
an open item:

> **E.23 — Minimum-escrow / bonded-reservation economics [TBD] (A10).** "Dust count is bounded by
> the per-identity reservation cap and the `min_force_open_escrow_for_failed_ack` floor, but **the
> general pricing of a minimum escrow / bonded reservation is unspecified**."

**3. `settlement_class` is not enumerated anywhere.** Exactly one class is named in the whole
document — `certificate_settle`, the premium lane, priced by `min_certificate_premium_ppm` =
1,500,000 ppm, *"Minimum price multiple (1.5x) over **the model's per-GFLOP rate** for
certificate-backed premium settlement"* (§12.2, #535). Note what that multiplies: a per-GFLOP rate
that, per the last pass, **does not exist as a protocol parameter**. So the one priced settlement
class is 1.5× of an undefined base. The other classes are not listed.

**4. The testnet economics the brief wants as a "first-class section" have no normative basis at
all.** `/intro/agent/` does state it: *"Agent airdrops are locked to inference spend or stake
delegation"* and *"Every 3 FLOP of inference fees unlocks 1 airdropped FLOP."* But the yellow paper
contains the words "faucet" and "technocore" **zero times**, and E.38 lists the mechanism itself as
undecided:

> **E.38 — Genesis allocation & airdrop vesting [TBD].** "The path that distributes `genesis_supply`
> **has no normative section** … as is the testnet→mainnet conversion that funds it. Still open: …
> the agent vesting horizon (90-day linear in the pallet vs. a three-year Y1/Y2/Y3 release in the
> sim params), **whether spend-to-unlock ships**, and the unallocated-remainder disposition."

So the 3:1 ratio is a product claim, not a ratified rule, and *whether the mechanism exists at all*
is open. Everything the brief lists as "community reporting" is downstream of that.

**5. Validator rotation ranks on stake, not on the performance score.** The brief asks for the
normative version of "uptime, block production, accuracy and latency". R15.5: *"Ranking MUST be by
**stake** subject to a minimum-performance floor (verified-work + liveness), so wash verified-work
does not improve rank."* The composite score — 40% uptime + 30% block_rate + 20% accuracy + 10%
latency (`performance_score_weights`) — is *"the rotation-**floor** input"* (§15.4), i.e. the gate,
not the rank. And ratified ≠ running: `/intro/validator/` says *"the running rotation ranks on
recent verified work and performance score"* and *"Planned: rank by stake above that floor instead."*

**6. Validators need GPUs, and the brief's cost list omits the largest item.** §15.1: *"A validator
is not required to own a TEE GPU to validate, but **committee eligibility requires recent verified
PoUI work** (§15.4), so a production validator co-locates or delegates to a calibrated miner
backend."* §15.3's duty table lists *"Produce verified PoUI work (committee gate) | **GPU-heavy —
calibrated miner backend** | falls out of committee if stale"*, and concludes: *"**The two heavy legs
are DA storage/serving and the committee-keeping GPU work.**"* The CPU/RAM/NVMe/bandwidth figures
the brief quotes as community reporting are the small half.

**7. Sitting in the queue costs your entire liquid balance.** §15.2: *"`register` **freezes the
account's full reducible balance** as self-stake and places the validator in `ValidatorQueue`, not
directly in `ActiveValidators`."* R15.5b: *"Queued validators hold stake and may do useful work;
they are not finality-eligible until promoted."* So the waiting list costs the full stake and earns
nothing from the validator leg.

**8. The slashing table has six rows, plus DA serve-or-slash as a separate path.** The brief lists
five and folds `da_serve_or_slash_percent` into the table. §11.3 has: Collusion 100%; Equivocation
(lone 50%, ≥⅓ correlated 100%); **Evidence forgery 100%**; **TEE-attestation failure 100%**;
Liveness 1%; Extended downtime 5%. DA serve-or-slash is R5.3b, a separate bounded Liveness penalty.

**9. Two entry constraints the brief does not have.** §15.2: self-stake MUST be ≥ **20% of (self +
delegated)** (`MinSelfStakeRatio`) — so delegation leverage caps at 5×; and **≤ 5 slots per entity**
(`MaxSlotsPerEntity`). Minimum delegation is 100 FLOP.

**10. The 1,000 cap is ratified but not enforced.** E.41 [PLANNED]: *"D-0437 ratifies
`validator_active_set_cap` = 1,000, but the runtime cannot reach it: `MaxAuthorities` =
`MAX_ACTIVE_VALIDATORS` = **200**."* `/intro/validator/` says the same: *"the 1,000 cap and
stake-ordered ranking are both ratified but only partly wired … does not yet enforce the cap."*

---

## 2. Agent inventory

### 2.1 The structure, corrected

An agent names a miner it found off-chain and posts:

```
open_channel(miner, model_hash, measured_root, decode_policy_hash, precision,
             enclave_key, agent_key, sla, escrow, nonce, settlement_class)   [App. G]
```

`escrow` is reserved at open and **is the price** (App. C.3). R12.1a: *"settle pays the reserved
amount in full (no settlement fee). **Under-use MUST NOT be refunded.** The only refund paths are a
non-delivery timeout, an upheld fraud dispute, or a failed/early-terminated session (R12.1d)."*

The permissionless variant `force_open(...)` names a miner that has not handshaked; it sits in
`PendingAck` for `channel_ack_window_blocks` = 600 (10 min); the miner accepts with `force_ack`, or
`expire_force_open` **refunds in full**.

### 2.2 Escrow sizing

| Parameter | Bucket | Value / citation |
|---|---|---|
| Escrow formula | **ABSENT** | None. **E.23 [TBD]**: "the general pricing of a minimum escrow / bonded reservation is unspecified" |
| Minimum escrow | **ABSENT** | No floor. `min_force_open_escrow_for_failed_ack` = 0.05 FLOP is a `FailedAcks` threshold, not a minimum |
| Maximum escrow | **ABSENT** | No ceiling on escrow. Work per block is bounded (`max_gn_weight` ≤ 1 PFLOP/payload, R12.2) but that is not an escrow bound |
| Relation to `sla` / `precision` | **ABSENT** | No pricing relation stated for any field |
| Over-use behaviour | **DEFINED** | R12.1e: *"Handled by abort or in-place `top_up_escrow` (Lightning splice-in); the aggregate-G_n accumulator already grows unbounded, only the escrow cap is raised."* App. C.7: *"`top_up_escrow` raises the reserved-capacity cap."* So a session does **not** silently fail — it aborts or splices in |
| Under-use behaviour | **DEFINED** | R12.1a: no refund, ever, on the cooperative path |
| Reservation cap | **DEFINED** | R12.2: `max_active_reservations_base` = 4 concurrent, +1 per `escrow_per_reservation_slot` = 50 FLOP escrowed; freed on settle/expire/timeout/fraud |
| `settlement_class` enumeration | **ABSENT** | Only `certificate_settle` is named |
| Certificate premium | **DEFINED (over an undefined base)** | `min_certificate_premium_ppm` = 1.5× "the model's per-GFLOP rate" (§12.2) |
| Session bounds | **DEFINED** | `channel_max_settlement_turns` = 1,024 caps a settle bundle and an SLA's `max_turns`; D_max/n_max bound blast radius (R12.1h); re-attest every k ≤ min(Bond/v_turn, T_tcb/t_turn) |

**The one sizing signal that exists is negative, and it is the whole product.** M9 (§13.1):

> "Early-stop / truncation … cooperative settle pays **reserved escrow in full**; unilateral
> failed/early close uses R12.1d tariff; **no completion SLA** | partial output; refund only under
> the selected close rule"

So on the cooperative path an agent pays its full reservation for a truncated answer, and there is
no completion guarantee to appeal to. Over-reserving is a pure loss; under-reserving forces a
`top_up_escrow` (an extra on-chain inclusion) or an abort. **That asymmetry is the agent's real
decision, and no published number helps with it.**

### 2.3 Refunds, penalties, and what the agent recovers

R12.1d is the only close-path arithmetic in the spec:

> "the miner keeps the two-part tariff `P = BasePerTurn·n + rate_G·G_claimed` … the agent is refunded
> `(1−φ)·(E−P)`, and the penalty `φ·(E−P)` (`refund_penalty_phi_percent` = 20%) MUST be
> burned/routed to the Foundation — **never the miner**. A miner-fault non-delivery uses **φ = 0**
> (full refund). Conservation: `P + (1−φ)(E−P) + φ(E−P) = E`."

| Close path | Agent outcome | Citation |
|---|---|---|
| Cooperative `settle` | Pays **E in full**. No refund even for partial output | R12.1a, M9 |
| Non-delivery timeout | **Full refund**, φ = 0 | R12.1d, App. C.6 |
| `force_open` never acked | **Full refund** (`expire_force_open`) | App. C.3 |
| Failed / ambiguous early close | Refund `(1−0.20)·(E−P)`; 20% of the unused remainder burned | R12.1d, D-0422 |
| Upheld fraud dispute | Refund + miner slashed | R12.1f, M2/M10 |
| DA unrecoverable (V4/R13.0c) | *"fail-closed escrow refund + challenger-bond return"*; **"agent made whole from escrow"** | R13.0c, V4 |
| SLA breach (M6) | *"rebate on co-signed breach"* — **rebate size ABSENT**, it is co-signed, i.e. negotiated | M6, E.22 (SPEC-026) |
| Ghost-Task failure | **Nothing to the agent.** *"bounded escrow slash — forgiveness by design, not fraud"*; M7's agent column reads *"n/a (validator-side)"* | R8.1a, M7 |
| Model swap (M1) | No refund path named — *"reopen elsewhere"* | M1 |
| Selective serving (M8) | No remedy — *"reputation layer only [GAP]"*, *"retry other miners"* | M8 |

**Dispute cost.** `channel_challenger_bond` = 100 FLOP (§12.1). Standing is restricted: R12.1f,
*"the session agent (its own channel) + any active validator (any channel); arbitrary public
challengers MUST be rejected before bond lock."* The bond returns on the DA-unrecoverable path
(R13.0c, explicitly "challenger-bond return"). **What happens to the bond on a failed dispute is
ABSENT** — no rule states it is forfeited or returned. R3.5a makes the agent the standing challenger
for its own channel, so this is a duty, not just an option.

**φ trigger boundary, precisely.** φ = 20% applies to *ambiguous* early close only. φ = 0 for
miner-fault non-delivery. Cooperative settle never reaches φ (there is no unused remainder — E is
paid in full). This is the brief's assumption, confirmed.

### 2.4 Tier choice as an agent decision

| Question | Bucket | Answer |
|---|---|---|
| What does HARD cost the agent? | **ABSENT** | No escrow premium, no fee, no availability figure is stated for either tier |
| HARD/SOFT value cap difference | **ABSENT** | R3.2 asserts HARD "raises … its permitted value cap"; no number. R12.1c: *"The SOFT profile has no TEE-measured root; its model/decode binding, evidence predicate, **value cap**, and dispute path are **E.33**"* |
| Does the SOFT spot-check cost the agent? | **DEFINED — no** | `soft_tier_spot_check_rate_ppm` = 25,000 ppm is *"SOFT-tier channel spot-check exposure surfaced with the calibration snapshot event"* (§4.2) — miner-side exposure. The 1.25× surge multiplier is on **miner** stake (§6.1) |
| What is the agent's HARD-tier guarantee? | **DEFINED** | R12.1c: HARD `open_channel` and `settle` MUST verify the measured dm-verity root against the registry; *"a wrong root at settle MUST reject"* |
| What is the agent's SOFT-tier guarantee? | **PLANNED** | E.33 [TBD] — settlement, dispute resolution, evidence predicate and *"pricing disclosure to agents"* are all unspecified. `/intro/miner/`: *"the currently wired settlement path remains the attested one"* |

**The honest reading for an agent choosing a tier today: SOFT is the marketed default
(`/intro/miner/`: "SOFT is the default tier"), its dispute path is not specified, and the wired path
is the attested one.** That is not a priced trade-off; it is an unresolved one.

### 2.5 The agent reward leg — verified carefully, as asked

**Agents are pure cost centres today, and the spec is emphatic about it.**

`agent_share_ppt` = 100 (10% of every block reward; era 0 = 9.6 FLOP/block) is **DEFINED** and is
minted. Distribution is not.

> **R9.12** — "The `agent_share_ppt` = 100 ppt and `staker_share_ppt` = 50 ppt legs MUST be minted
> every distribution period to two protocol-derived sovereign pool accounts … **Onward distribution
> from either pool MUST NOT occur until its distribution policy is ratified (E.40)**; the pools
> accrue and the mint is evented."

> **E.40 — Agent & staker leg distribution [TBD].** "Specify how the … pools are paid out: the
> eligible set …, the pro-rata basis (**agents: verified inference spend, unconfirmed**), cadence,
> dust handling, and whether payouts are liquid on issue. Until this ratifies both legs accrue in
> sovereign pool accounts and are **never distributed**."

Appendix D confirms: *"Agent & staker legs (10% + 5%) | (emission) | **sovereign pool accounts —
parked, no distribution policy (E.40)**"*. And note the dilution asymmetry: the parked legs still
**mint**, so they dilute every holder while paying nobody.

The teaser's *"Brokers / agents | 1.2bn $FLOP | their block-reward share subsidises agents' compute
purchases"* describes a rebate that has no ratified mechanism.

### 2.6 Agent spend controls (DEFINED, and useful)

The one part of the agent surface that is fully specified. §6.2, `pallet_session_keys` +
`pallet_agent_wallet`: lifetime cap, per-tx cap, daily cap (epoch-reset), pallet/destination
allowlist, circuit breaker. Enforced values: `agent_identity_min_stake` = 10 FLOP;
`circuit_breaker_tx_count` = 100 txs; `circuit_breaker_flop_cap` = 250 FLOP;
`circuit_breaker_window` = 60 blocks; `agent_per_tx_limit` = 100 FLOP;
`agent_daily_cap_autonomous` = 500 FLOP; session-key lifetime ≤ 864,000 blocks (~10 d at cadence —
§6.2 notes missed blocks extend elapsed lifetime). R6.2b: a captured session key MUST be bounded by
these caps (INV-02).

### 2.7 Testnet agent economics

| Claim | Bucket | Status |
|---|---|---|
| Every 3 FLOP spent unlocks 1 airdropped FLOP | **ABSENT from spec** | Stated on `/intro/agent/`. E.38 lists *"whether spend-to-unlock ships"* as open |
| Airdrop locked to inference spend or stake delegation | **ABSENT from spec** | `/intro/agent/`. E.38: airdrop-vesting "has no normative section" |
| Faucet on technocore.chat, DID-gated | **ABSENT** | Neither word appears in the yellow paper |
| Agent genesis pool | **DEFINED (contested)** | `genesis_agent_airdrop` = 596,030,400 FLOP (24%, §3.5, D-0421). Teaser says "up to 1,200,000,000" under the unratified 3.5bn restatement |
| Agent vesting horizon | **ABSENT** | E.38: "90-day linear in the pallet vs. a three-year Y1/Y2/Y3 release in the sim params" — the two disagree |
| What an agent should optimise | **ABSENT** | Cannot be derived. The conversion score's "cap levels and the sublinear form" are open (E.38) |

**This section cannot be written honestly today.** A tool that tells a testnet agent what to optimise
would be inventing the scoring function. The one defensible thing to say is *what is undecided and
where it will land* — E.38, blocking issues #257 and #1176.

---

## 3. Validator inventory

### 3.1 Revenue — better specified than the miner's

| Parameter | Bucket | Value / citation |
|---|---|---|
| Block-reward share | **DEFINED** | `validator_share_ppt` = 100 (10%); era 0 = 9.6 FLOP/block |
| **Apportionment** | **DEFINED** | R9.5: *"split inside the pool with weight `stake_i × (1.1 if i ∈ current finality committee else 1.0)`, integer dust assigned deterministically so payouts sum exactly to the pool"*. Appendix D: "active validators by stake, 1.1× for finality-committee members, auto-compounded + locked" |
| Committee membership | **DEFINED** | R15.4a: filter `ActiveValidators` to those meeting `effective_minimum_stake()` **and** `is_work_verified_recent`, then sample `finality_committee_size` = 100 **stake-weighted without replacement** off a BABE-VRF seed. Seed is epoch randomness, one epoch old (R15.4b); unbiasability is open (E.42) |
| Work-recency gate | **DEFINED** | `LastVerifiedWork` within `WorkRecencyWindow` = 86,400 blocks (24 h), else "active but out of the PoUI committee" (§15.2) |
| Reward liquidity | **PLANNED** | **E.39 [RATIFY]**: currently auto-compounds into locked stake (D-0408); "the workbook (rev 2026-08-20) ratifies 0% reward lock but the distribution hook is unchanged" |
| Audit pool inflow | **DEFINED** | `audit_fee_split_ppm` = 10,000 ppm — 1% of the miner's settlement payment (§7, D-0403) |
| **Audit pool apportionment** | **DEFINED** | `audit_fee_per_turn` = **1 FLOP flat per audit verdict**, claimed by a **VRF-assigned** validator via `claim_audit_fee`, *"gated on submitted evidence and pool solvency"* (§12.1, D-0403). So: per audit performed, not pro-rata |
| Transaction fees | **DEFINED (interim)** | R9.6: 10% burn; block author takes 100% of the remainder, accounted as 80 ppt miner-proxy + 10 ppt validator "co-located on the author until per-miner G_n fee attribution splits the miner share". Tips 100% to author |
| Era-0 pool | *[derived]* | 9.6 × 31,536,000 = **302,745,600 FLOP/yr**; at the floor, 0.3 × 31,536,000 = **9,460,800 FLOP/yr** |

**A derived finding worth surfacing: the audit pool has a solvency floor, and it is a price floor on
sessions.** Inflow per turn is `0.01 × P_turn`; expected outflow is `α × 1 FLOP` with
`sampled_audit_alpha_ppm` = 50,000 (α = 5%). Break-even:

```
0.01 · P_turn  ≥  0.05 · 1 FLOP    →    P_turn ≥ 5 FLOP per turn
```

*[derived; inputs: `audit_fee_split_ppm`, `audit_fee_per_turn`, `sampled_audit_alpha_ppm`, all
Appendix A]*. Below roughly 5 FLOP of settlement per audited turn the pool cannot fund its own
audits, and the parameter's own wording anticipates this — payment is *"gated on … pool solvency"*.
Since Tier-3 re-execution is the enforcement arm of the whole verification stack, a low-price regime
defunds the thing that makes the stack work. **Caveats:** α is described as the default for
"sampled-audit certificate mode" and may not apply to every session; `audit_quantum_gn` (one forced
ticket per 100,000,000 G_n) and `high_value_gn_threshold` (10,000,000 G_n → α = 1) force *additional*
audits, which only worsens the ratio. I have not found this stated anywhere.

### 3.2 Cost

| Parameter | Bucket | Value / citation |
|---|---|---|
| Baseline stake | **DEFINED** | `validator_min_stake` = **305,505 FLOP**, compounding **+9%/yr** (`validator_growth_numerator/denominator` = 109/100, D-0413) |
| Value-coupled floor | **ABSENT (the coefficient)** | `effective_minimum_stake() = max(validator_min_stake, ValueCoupledStakeFloor)`; `validator_stake_value_coupled_floor` is "dynamic FLOP", storage default **0 = baseline-identical**. **E.8 [TBD]** sets `k`. E.35 [TBD] adds: "no down-retarget; **base floor ratifying at ~1.16M FLOP**" |
| Self-stake ratio | **DEFINED** | ≥ 20% of (self + delegated) — `MinSelfStakeRatio`, so ≤ 5× leverage |
| Slots per entity | **DEFINED** | ≤ 5 (`MaxSlotsPerEntity`) |
| Registration lock | **DEFINED** | *"`register` freezes the account's **full reducible balance** as self-stake"* (§15.2) |
| Unbonding | **DEFINED** | `validator_unbonding_blocks` = 1,814,400 (~21 d), slash-locked while any session/dispute/audit is open; "safely > the 14 d DA retention W" |
| Ejection cooldown | **DEFINED** | `ejection_cooldown_blocks` = 604,800 (~7 d), rejoin with stake topped to current minimum |
| **GPU backend** | **DEFINED (qualitatively), ABSENT (quantitatively)** | §15.1: committee eligibility "requires recent verified PoUI work … so a production validator co-locates or delegates to a calibrated miner backend". §15.3: "**GPU-heavy**". No sizing given |
| **DA duty — unit cost** | **DEFINED (partially)** | R5.3a: Reed–Solomon **rate ½, R = 6 shards, k = 3** reconstruct, on a *deterministic stake-weighted subset* (`hash(commitment) → subset`). §5.3 blob sizes: TEE quote **5–10 KB**, event log **≤256 KB**, plus `proof_data` (unstated). Retention `da_ephemeral_retention_blocks` = 14 d. §15.3: "**GB-scale bandwidth**" |
| **DA duty — total volume** | **ABSENT** | **E.47 [TBD]**: "Specify … repair bandwidth, and **the cumulative storage/retention budget across the full session+challenge lifecycle**" |
| DA funding | **DEFINED — none** | R5.3c: *"DA is a validator duty, funded from the validator share of block rewards + fees; there MUST NOT be a per-byte DA fee or DA-fee income stream."* |
| Leased-weights deposit | **DEFINED (not a validator cost)** | `da_lease_deposit_per_byte` = 200 FLOP/GB, held on the **publisher**, refundable in full |
| DA endpoint deposit | **DEFINED** | `da_endpoint_deposit` = 1 FLOP, refundable, held while the serving endpoint is announced |
| Hardware / bandwidth minimums | **ABSENT** | The spec states none. §15.3 gives qualitative intensities only ("light CPU", "GB-scale bandwidth", "GPU-heavy") |

*[derived]* Per session-blob, a validator in the assigned subset stores one shard ≈ `orig/3` bytes
(rate ½, k = 3 ⇒ 6 shards × orig/3 = 2× orig network-wide), retained 14 days, with 6 of N validators
assigned per blob. The **unit** cost is therefore derivable; the **volume** is not, because session
rate is unknown and E.47 leaves the cumulative budget unspecified. That is the honest boundary of
any validator cost model.

**The spec's own validator cost anchor.** §2.2 contains an unusual disclosure:

> "The committee cap of 100 is **cost-derived**. At the original 1.5 FLOP floor the validator reward
> pool sustained ~112 bare-metal validators, which is where the cap of 100 was sized. D-0436 doubled
> the floor to 3 FLOP/block, so that pool now sustains ~224."

*[derived]* Both figures divide out to the same number: 4,730,400 / 112 = 9,460,800 / 224 =
**42,236 FLOP/yr per bare-metal validator**. The identity across two independent pool sizes confirms
the arithmetic is a straight pool ÷ fixed-cost division, so **the paper carries an implicit
per-validator annual operating cost of ~42,236 FLOP**. The USD basis behind it is not public (it
lives in `miner-validator-economics.md`). This is the single most useful validator anchor in the
document and it is not labelled as one.

For scale, *[derived]* era-0 pool ÷ set size, pro-rata pre-premium: 100 validators → 3,027,456
FLOP/yr each; 224 → 1,351,543; 1,000 → 302,746.

### 3.3 Penalties — the full table

§11.3, plus the two paths outside it:

| Offence | Penalty | Effect | Re-entry | Cite |
|---|---|---|---|---|
| Collusion (signing a fake G_n proof) | `slash_fraud_percent` = **100%** burn | eject + blacklist | none | §11.3 |
| Equivocation — lone | `slash_equivocation_lone_percent` = **50%** (other 50% returned after 180 d) | eject | re-stake after return + cooldown | §11.3, D-0420 |
| Equivocation — ≥⅓ correlated | **100%** burn | eject + blacklist | none | §11.3 |
| Evidence forgery | **100%** burn | eject + blacklist | none | §11.3 |
| TEE-attestation failure (HARD attestations only) | **100%** burn | eject + blacklist | none | §11.3 |
| Liveness — downtime > 300 blocks | `slash_liveness_percent` = **1%** | jailed | `un_jail` after ≥ 1 h | §11.3 |
| Extended downtime > 24 h | `slash_extended_downtime_percent` = **5%** | kicked | rejoin with full top-up | §11.3 |
| **DA serve-or-slash** (separate path) | `da_serve_or_slash_percent` = **≤1%**, Liveness class not fraud | — | penalty re-derived from the live set, never stale-slashing a rotated-out provider | R5.3b |

Loss order on every path (§11.3): *"operator self-stake first, then native delegators pro-rata, then
sponsors at the fault rate."* Slashing proceeds go to the FLOP Foundation (Appendix D).

### 3.4 Set membership

| Parameter | Bucket | Value |
|---|---|---|
| Active-set cap | **DEFINED, PLANNED enforcement** | 1,000 (D-0437); E.41 — runtime `MaxAuthorities` = 200 blocks it today |
| Rotation cadence | **DEFINED** | `validator_rotation_interval_blocks` = 2,592,000 (~30 d), `on_initialize` + manual |
| Eject / promote | **DEFINED** | 50 / 50 per rotation, promote only while a slot is free (R15.5b) |
| Ranking (ratified) | **DEFINED** | **By stake**, subject to a min-performance floor (verified-work + liveness), R15.5 |
| Ranking (running) | **PLANNED** | `/intro/validator/`: ranks on recent verified work + performance score today |
| Performance floor input | **DEFINED** | 40% uptime + 30% block_rate + 20% accuracy + 10% latency (`performance_score_weights`) |
| Committee size | **DEFINED** | 100, stake-weighted without replacement, BABE-VRF seeded |
| Cost of queueing | **DEFINED** | Full reducible balance frozen; no validator-leg reward until promoted |
| Testnet bond free / 24-month lock | **ABSENT** | Nothing normative. E.38 covers the validator cohort's conversion and lists "what the validator cohort converts on" as open. `genesis_validator_airdrop` = 305,505,000 FLOP — exactly `validator_min_stake` × 1,000, which *[inferred]* is why the 305,505 baseline exists |
| Governance rights | **DEFINED, and narrower than advertised** | `/intro/validator/`: *"Through the first halving, **only the FLOP Foundation may submit a FIP**."* Approval `governance_root_track_approval` = 67%, turnout floor 15%, decision period 28 d, enactment timelock 14 d |

---

## 4. Blocking unknowns

### Genuinely blocking

**B1 (agent). The session price.** Carried over from the last pass, and it is the agent leg's
version of the miner leg's problem. There is no protocol price, no auction, no floor. Every absolute
agent cost figure is an assumption about a market that does not exist.

**B2 (agent). Escrow sizing has no formula and no bounds (E.23).** Unlike B1 this is not "the market
decides" — it is a *protocol* gap the spec acknowledges. It cannot be closed by an input, because
what is missing is the relation between escrow and consumption, and that relation is what a sizing
tool would compute.

**B3 (agent). The entire testnet-conversion mechanism (E.38).** Including whether spend-to-unlock
exists. Not assumable — the two published vesting horizons (90-day pallet vs. three-year sim)
disagree with each other inside the spec's own open item.

**B4 (validator). Cumulative DA volume (E.47).** The unit economics are derivable, the totals are
not, and this is one of the two heavy legs.

**B5 (validator). The GPU backend requirement.** Committee eligibility needs recent verified PoUI
work, but no sizing is given — how much work, on what hardware, at what cost. This is the other
heavy leg, and it means validator cost is coupled to *miner* economics, which have their own ABSENT
apportionment rule (E.44).

### Assumable, with a stated range

- **`k` in the value-coupled stake floor (E.8).** Storage default is 0 = baseline-identical, so
  **model the baseline as the live case** and E.35's "~1.16M FLOP" as the stress case. Both are
  citable; neither is invented.
- **Validator reward liquidity (E.39).** Binary. Model both: locked auto-compound (current) vs. 0%
  lock (workbook). Materially changes validator IRR.
- **Agent leg distribution (E.40).** Model as **zero** with the E.40 placeholder ("pro-rata by
  settled inference spend") as an upside switch.
- **DA session volume.** Input with a range, driven by the same demand assumption everything else
  needs.
- **SLA-breach rebate (M6).** Co-signed, so negotiated. Input, default 0.
- **Dispute-bond outcome on a failed challenge.** ABSENT; model as forfeited (conservative) and say
  so.

---

## 5. Prior art

**The niche is empty. Say so plainly, as the brief asks.**

**FLOP publishes nothing for either role.** The entire site is nine pages plus the GPU monitor
(`/`, `/intro/`, `/intro/{agent,miner,validator,verification,revenue,yellowpaper}/`, `/teaser/`,
`gpus.flop.finance`). `/intro/agent/` and `/intro/validator/` are prose briefs with no calculator,
no cost table and no sizing guidance. `/intro/revenue/` is **miner-only** — its agent and validator
mentions are navigation links and split explanations. The "macro simulator" referenced on
`/intro/miner/` has **no link anywhere on the site** and appears unpublished.

**No third party has built either.** GitHub across five query formulations returns zero calculators.
The single adjacent repo, `Amt4687/flop-research` ("FLOP Network research notes — agent identity,
economics, testnet prep"), is 6 KB of notes, created and abandoned on 2026-08-27, zero stars. Web
search returns only press restatements.

So the brief's premise holds, and more strongly than for the miner leg: **two of three roles have
no economic tooling from anyone, including the protocol team.**

---

## 6. Product recommendation

### I disagree with the brief's ordering, and the inventory is why

The brief says *"Agent is the priority. Do it first and go deeper on it. Validator second."* I went
deeper on the agent leg as instructed — §2 is the longest section here — and the finding is that
**the validator leg is the better-founded product, and the agent leg's honest product is not the one
the brief has in mind.**

The reason is a clean asymmetry in what is DEFINED:

| | Revenue rule | Apportionment | Cost |
|---|---|---|---|
| **Miner** | escrow + block reward | **ABSENT (E.44)** | mostly derivable |
| **Agent** | none — 10% leg is parked (E.40) | n/a | **ABSENT (B1, B2)** |
| **Validator** | 10% leg + audit pool | **DEFINED (R9.5, `audit_fee_per_turn`)** | one derivable anchor, one ABSENT (E.47) |

The validator is the only role whose reward apportionment is normatively specified. FLOP's own
calculator models the role whose apportionment is *missing*, using a proxy it labels as a proxy.

### The agent leg: build an escrow risk tool, not a cost calculator

**Can it be modelled honestly? Yes — but only the risk structure, not the amount.** Every input to
the *outcome* side is DEFINED: φ = 20%, the two-part tariff `P = BasePerTurn·n + rate_G·G_claimed`,
conservation `P + (1−φ)(E−P) + φ(E−P) = E`, no under-use refund, full refund on timeout and on
unacked `force_open`, the `top_up_escrow` splice, the 100 FLOP challenger bond, the 4 + 1-per-50-FLOP
reservation cap. Every input to the *price* side is ABSENT.

So the question it answers best is **not** "what will this cost me" but:

> *"I reserved E and the session consumed X. Which close path am I on, what do I recover, and what
> did over-reservation cost me?"*

A close-path outcome matrix, driven entirely by DEFINED parameters, with price as a pure scalar the
user supplies. That is defensible on the day the testnet opens because it makes no market claim at
all. It also surfaces the finding the product pages actively obscure — that cooperative settle pays
**full escrow for a truncated answer with no completion SLA** (M9), which is the single most
important thing an agent operator does not currently know.

**Skip** the testnet-optimisation section entirely (B3), and skip any agent ROI figure (the reward
leg is parked, R9.12).

### The validator leg: build the break-even model the brief describes

**Can it be modelled honestly? Yes, better than the agent leg.** The brief's candidate question —
*"what does the bond plus the DA duty actually cost against the reward share, and at what point does
a slashing event put me underwater"* — is close to right. I would sharpen it to three questions the
inventory can actually answer:

1. **Break-even against the spec's own anchor.** Pool ÷ set size vs. the implicit ~42,236 FLOP/yr
   cost basis, across eras. Every input is DEFINED or derived from DEFINED values.
2. **Slashing exposure as a ladder**, not a single event: 1% liveness / 5% downtime / 50% lone
   equivocation / 100% fraud / ≤1% DA — against a stake that is 305,505 FLOP compounding at 9%/yr,
   with a 21-day unbonding lock and a 7-day ejection cooldown. Recovery time to break-even after
   each rung is a real, computable, decision-relevant number.
3. **The queue cost.** Full reducible balance frozen, zero validator-leg reward, promotion gated on a
   free slot behind a cap that is ratified at 1,000 but wired at 200 (E.41). Nobody has costed
   sitting in the queue.

And surface the **audit-pool solvency floor** (§3.1) as a network-health indicator: below ~5 FLOP per
audited turn, the pool that pays for Tier-3 enforcement cannot fund itself. That is an original,
fully-cited, derived finding and it belongs in the tool.

**The one thing to be honest about up front:** validator cost is not CPU/RAM/NVMe. It is DA
storage-and-bandwidth (volume ABSENT, E.47) plus a GPU backend for the committee gate (sizing
ABSENT). A validator model that omits the GPU leg is wrong in the same way the brief's cost list
was. Both go in as explicit, prominent, user-supplied assumptions.

### Where the provenance work lives

Not as a standalone audit report — agreed. As **an assumptions drawer attached to every output**:
each number the tool prints carries its bucket and its citation, and the drawer lists every ABSENT
input the user supplied, with its E-item. Concretely: the `params.yaml` from the last pass gains
`bucket` and `cite` fields; the UI renders them as a footnote per figure and a summary panel per
result. A user who exports a result exports the assumption set with it. That makes the honesty
structural rather than editorial, and it means a spec revision is a config diff — which was the
design goal from the start.

The complementarity is then real rather than rhetorical: FLOP's calculator owns the miner leg and
does not show its buckets; this tool owns the other two roles and shows nothing else.

### What to skip

Any absolute agent cost-per-session figure (B1). The testnet optimisation guide (B3). Any claim that
agents earn a rebate (R9.12 forbids distribution). Any validator hardware spec presented as
normative — the spec states none. And do not model the mempool/bidding market the product pages
describe; it does not exist (§15.6).

### Standing caveat

The yellow paper is a Draft on a weekly cadence; it was unchanged between this morning and this
pass, which is not a guarantee about next week. Appendix H tracks per-requirement implementation
status and §0 warns that *"Implementation status is out of band."* Nothing here is a claim about
running code — only about the specification as published on 2026-09-09.

---

## Appendix — artifacts

| path | what |
|---|---|
| `spec/yp.txt` | the yellow paper extraction every citation resolves against (re-fetched, diff-clean vs. this morning) |
| `spec/intro_agent.txt` | `/intro/agent/` — source of the "mempool / 5 fields" and 3:1 unlock claims |
| `spec/intro_validator.txt` | `/intro/validator/` — ratified-vs-running rotation, the cap-not-enforced note, the Foundation-only FIP window |
| `spec/intro_index.txt` | `/intro/` — repeats the mempool framing |
| `spec/rev.txt` | FLOP's miner calculator: confirmed miner-only |
