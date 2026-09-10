# FLOP Network miner economics — parameter inventory

> **Correction, 2026-09-10.** This report was written against a pre-publication draft and states
> `genesis_supply` = 2,483,460,000 as the ratified value, with 3,500,000,000 as an unratified
> workbook figure. That is backwards. **D-0438 ratified 3,500,000,000**, superseding the
> D-0421/D-0435 pool sizes. Genesis supply is the divisor for token price, so every dollar figure
> below is understated: at the year-one anchor the correction raises supply 16.9%, lowers the
> implied price 14.5%, and raises the break-even valuation 16.9%. The body is left as the dated
> record. See [RECONCILE.md](RECONCILE.md).

Phase 1 pass. Prepared 2026-09-09 against the yellow paper at `flop.finance/intro/yellowpaper/`
(Draft, v0.4 decision record, page footer "Updated 2026-08-27"), the teaser (v0.1 draft, updated
2026-08-26), `flop.finance/intro/miner/`, `flop.finance/intro/revenue/`, and `gpus.flop.finance`.
A local text extraction of the yellow paper is in `spec/yp.txt`; every `§`/`R`/`E`/parameter
citation below is checkable against it.

**Method note that governs everything here.** The yellow paper states its own precedence rule, and
it matters more than any single number:

> "Every protocol constant is named in Appendix A, which is generated from
> `params/flop-protocol-params.yaml` (the single machine-checked source, gated by
> `scripts/check_params.py`). … **Concrete figures appearing inline are worked examples; the value
> of record is always Appendix A.**"

So: Appendix A is the contract. The teaser, the intro pages and the official calculator are all
*downstream*, and at least three of them currently lead the contract on purpose. I have taken
Appendix A as normative throughout and flagged every place a secondary source disagrees.

**What I read vs. what I inferred.** Everything in the DEFINED column is quoted from the document.
Anything I computed is marked *[derived]* with its inputs. Anything I reasoned to without a
citation is marked *[inferred]*. There are no invented numbers.

---

## 1. Corrections — what the brief got wrong

The brief asked me to open with this and predicted a similar error rate to last time. It is lower:
the revenue-side numbers are almost all right. The cost side and the market structure are where it
breaks.

**Right, and confirmed against Appendix A:** 96 FLOP initial reward; halving every 730 days
(`halving_interval_blocks` = 63,072,000 at 1 s); five halvings (`max_halvings` = 5); permanent
3 FLOP floor (`floor_reward`); the 75/10/10/5 split (`miner_share_ppt` 750 / `validator_share_ppt`
100 / `agent_share_ppt` 100 / `staker_share_ppt` 50); genesis supply 2,483,460,000
(`genesis_supply`); 1 s block time.

Now the nine corrections.

**1. The single most important unknown is worse than the brief thinks — but for a different
reason.** The brief expected the miner's share to be "proportional to verified compute contributed"
and wanted to know the measure and window. The intro page does say that — *"a share of the miner
block-reward pool, weighted by G_n"*, and *"Of each era block reward, distributed by verified G_n
contribution"* (`/intro/miner/`). But the **normative spec does not contain that rule**. Appendix D
gives the validator leg an explicit apportionment ("active validators by stake, 1.1× for
finality-committee members") and gives the miner leg none — the row just says "miners 75% (72)".
And the eligibility predicate is an open item in so many words:

> **E.44 — Cooperative work-credit eligibility [TBD].** "Define when a co-signed session receipt
> becomes eligible for public work rewards. Signatures, Merkle membership, and sum equality prove
> agreement and arithmetic, not claimed execution. … Placeholder: cooperative payout transfers
> reserved escrow, while **public work credit carries no end-to-end correctness claim until this
> rule ratifies**."

R12.1b says the same from the other side: *"The current cooperative path pays and credits the
co-signed claim immediately. Public reward eligibility and late-fraud recovery therefore remain
open in E.44."* So the mechanism is G_n-weighted in the product description and unratified in the
spec. That is the headline finding of this pass.

**2. There is no fee market, no auction, and no protocol price. At all.** The brief offered three
candidates (agent-declared, auction, floor price) and none is right. Matching is off-chain and
bilateral:

> Appendix C.2: "Sessions are agent-initiated and 1:1; an agent selects a miner **off-chain**
> (`model_registry::find_best_miners`) and opens a channel. **On-chain discovery/reputation is
> future**."
> Appendix C.3: "`open_channel(...)`; **escrow is reserved and is the price**."
> R12.1a: "Escrow at `open_channel` is the payment for reserved capacity; settle pays the reserved
> amount in full (no settlement fee). **Under-use MUST NOT be refunded.**"

The threat table is blunter still — M8 "Selective serving / censorship": *"none on-chain (matching
is off-chain) | reputation layer only [GAP]"*. So the price per unit of inference is not a protocol
parameter, is not observable on-chain today, and has no floor, ceiling or discovery mechanism. It
is whatever an agent and a miner agree off-chain.

**3. The session-fee split question resolves to 99/1, and the teaser says so itself.** The brief
asked which of 85/15 and 99/1 is normative. Appendix A settles it: `audit_fee_split_ppm` =
10,000 ppm — *"ratified 1% … of the miner's settlement payment (the session-fee leg) carved into
the audit pool that pays validators for audit work"* (§7, D-0403). The teaser's own draft banner
flags itself: *"Two figures on this page LEAD the protocol parameters of record and are not yet
ratified: the 3.5bn genesis airdrop (the parameters say 2,483,460,000) and the 85/15 inference-fee
split (settlement pays the miner 99%, with 1% to the audit pool, until the validator fee leg
lands)."* 85/15 is a workbook target blocked on issue #1352.

**4. The storage deposit the brief wants to model does not exist.** The brief says commitments and
audit data are "miner-funded, serve-or-slash" for the challenge window and "nobody is modelling
it." Three things are wrong. Appendix D:

> "DA ephemeral (quotes/proofs/transcripts/I-O) | — (path-gated) | — | **no charge**"
> "Per-byte DA fee | — | — | **none — DA is a validator duty funded by the reward share**"

Serve-or-slash binds **validators**, not miners (`da_serve_or_slash_percent` = 1%, §5.3, D-0402 —
"a validator failing a DA audit is slashed ≤1%"). The only DA deposit is on *leased model weights*
(`da_lease_deposit_per_byte` = 200 FLOP/GB), paid by the **publisher**, "returned in full on prune /
voluntary withdrawal (D-0412)" and explicitly "never validator revenue." There is no recurring
per-session storage cost on the miner. Delete that line from the cost model.

**5. 100% slashing is one fault class, not the general penalty.** `slash_fraud_percent` = 100% is
scoped: *"Collusion / EvidenceForgery / TEE-attestation failure / correlated equivocation /
double-spend → 100% slash + eject + blacklist"* (§13.2, D-0409). The lesser penalties the brief
asked about all exist and are separately parameterised: `slash_liveness_percent` 1%,
`slash_extended_downtime_percent` 5%, `slash_equivocation_lone_percent` 50% (+50% returned after
180 d), `refund_penalty_phi_percent` 20% on ambiguous early close (taken from *escrow*, routed to
burn/Foundation, "never miner"), and `channel_audit_forfeit_slash_ppm` 1,000,000 ppm — which is
100% *of the withheld settlement window's value*, not of stake. Ghost-Task failure is deliberately
outside the fraud path: R8.1a applies "a bounded escrow slash (`OnGhostTaskFailed`) — deliberately
**not** the PoUI 100%-slash + blacklist fraud path, so transient drift is not treated as fraud."

**6. Miner stake scales with calibrated capacity, not with job value.** §6.1 gives the formula
normatively:

> `required_self_stake(B_p) = min_miner_self_stake + miner_capacity_stake_per_gflop · B_p`
> with 10,000 FLOP and 0.01 FLOP/(GFLOP·s), "LINEAR, NO CAP — a cap would make the largest miners'
> fraud +EV" (D-0418).

It is the **validator** floor that is value-coupled — `max(baseline, k·V_booked)` — and even there
`k` is unset (E.8 [TBD]).

**7. The TEE value-cap difference does not exist as a number.** R3.2 does say a TEE "raises its
assurance tier (HARD) and its permitted value cap" — but no cap is given anywhere, and for the
non-TEE tier it is explicitly open: R12.1c, "The SOFT profile has no TEE-measured root; its model/
decode binding, evidence predicate, **value cap**, and dispute path are E.33." So the brief's
question — does TEE hardware earn materially more — **cannot be answered from the spec.** What the
spec does quantify is the SOFT tier's *extra cost*: `soft_tier_spot_check_rate_ppm` = 25,000 ppm
(≈1 session in 40) plus `miner_stake_surge_multiplier_ppm` = 1,250,000 ppm (1.25× exposure stake
while burst-ratcheted). Notably, the product framing has moved the other way from the brief's
assumption: *"SOFT is the default tier… No confidential-computing hardware is required"*
(`/intro/miner/`).

**8. The session request fields in the brief are from press coverage and do not match the spec.**
Appendix G gives the actual extrinsic:

> `open_channel(miner, model_hash, measured_root, decode_policy_hash, precision, enclave_key,
> agent_key, sla, escrow, nonce, settlement_class)`

There is **no declared-FLOPs field** (G_n is measured per turn and accumulated, R12.1b), **no
confidentiality flag** (confidentiality is the HARD/SOFT path choice), max latency lives inside
`sla`, and the "fee" is `escrow`. The brief's list also omits `decode_policy_hash`, `precision` and
`settlement_class`.

**9. The calculator the brief defers to "later" already exists, and it is FLOP's own.**
`flop.finance/intro/revenue/` is a published parametric miner-revenue model with scenario paths for
both token value and network competition, a live GPU-rental cost basis, per-period ROI and export.
There is also a "macro simulator" referenced beside it. Details and assessment in §5.

Two smaller ones. "Sub-second on the roadmap" is **finality** latency, not block time — §2.1 gives
"1 s block / deterministic once ordered; sub-second target". And the brief's premise that there is
no live data is right for demand but wrong for cost: `gpus.flop.finance` is a live rentable-GPU
market monitor publishing price floors, per-model modeled rental cost, G_n delivery and break-even
rent.

---

## 2. Parameter inventory

Buckets are as the brief defined them. **DEFINED** = a number or formula in the spec. **PLANNED** =
named but marked unimplemented/deferred. **ABSENT** = the model needs it and the spec does not have
it. Where a value is enforced, it comes from Appendix A (machine-checked); where it is a formula,
from the cited requirement.

### 2.1 Revenue side

| Parameter | Bucket | Value / citation |
|---|---|---|
| Initial block reward | **DEFINED** | `initial_block_reward` = 96 FLOP, §9, D-008 |
| Halving interval | **DEFINED** | `halving_interval_blocks` = 63,072,000 (~730 d at 1 s), §9 |
| Number of halvings | **DEFINED** | `max_halvings` = 5, §9, D-0436 |
| Perpetual floor | **DEFINED** | `floor_reward` = 3 FLOP/block from block 315,360,001, §9, D-0436. R9.2: "96 → 48 → 24 → 12 → 6 → 3 … then floor_reward = 3 FLOP/block forever" |
| Four-way split | **DEFINED** | 750/100/100/50 ppt; era 0 = "72 · 9.6 · 9.6 · 4.8 FLOP/block", §9 table |
| Miner era-0 pool | **DEFINED** *[derived]* | 72 FLOP/block × 86,400 = **6,220,800 FLOP/day**; floor era = 2.25 FLOP/block |
| **Miner-pool apportionment** | **ABSENT** | No rule in §9, R9.1–R9.12 or Appendix D. Eligibility is **E.44 [TBD]**. Product docs say "weighted by G_n" (`/intro/miner/`); the spec does not |
| Apportionment window | **ABSENT** | Not specified anywhere. R12.1b credits "immediately" on settle; no epoch/window named |
| Validator-leg apportionment | **DEFINED** | R9.5: "weight `stake_i × (1.1 if i ∈ current finality committee else 1.0)`, integer dust assigned deterministically" |
| Agent + staker legs (15%) | **PLANNED** | R9.12: minted to sovereign pool accounts, "Onward distribution … MUST NOT occur until its distribution policy is ratified (**E.40**)". Placeholder only |
| Session fee split | **DEFINED** | `audit_fee_split_ppm` = 10,000 ppm → miner 99% / audit pool 1%, §7, D-0403. 85/15 is an unratified target (issue #1352) |
| Audit-pool payout | **DEFINED** | `audit_fee_per_turn` = 1 FLOP per audit verdict, claimed by a VRF-assigned validator, §12.1 |
| **How the session fee is set** | **ABSENT** | No auction, floor, or tariff. Off-chain bilateral; "escrow … is the price" (App. C.3, R12.1a). Matching off-chain, "reputation layer only [GAP]" (M8) |
| Unilateral-close tariff | **DEFINED (units unratified)** | R12.1d: `P = BasePerTurn·n + rate_G·G_claimed`; `channel_base_per_turn` = 1, `channel_c_turn_fixed` = 1. **But**: "The current implementation uses a numeric rate of one channel pay unit per stored G_n unit; **E.30 must ratify its dimensional relation to FLOP's base units and 18 decimals**" |
| G_n → FLOP conversion | **ABSENT** | **E.30 [TBD]**. R4.4: "Until E.30 ratifies, implementations MUST treat the settlement unit as reference F_eff and MUST NOT conflate it with physical FP16/INT8/INT4 ops, energy, or latency" |
| Work unit | **DEFINED** | R4.1: `G_n = F_eff / 10⁹`, computed by `hp_poui::flop_meter` (R4.2), not from bare 2·P·N |
| Per-token work, reference models | **DEFINED** | §4.2, KAT-pinned: Llama-3-8B **16**, DeepSeek-V3 **74**, Llama-3-70B **140** G_n/token |
| Tx-fee split | **DEFINED (interim)** | R9.6: 10% burn, 100% of remainder to block author, "co-located on the author **until per-miner G_n fee attribution splits the miner share**". Ratified target 80/10/10 |
| Genesis supply | **DEFINED (contested)** | `genesis_supply` = 2,483,460,000 (§2.3, D-0421). The workbook restated it to 3,500,000,000 on 2026-08-22; "landing that in params is Tier A work blocked on an open gap with no ratifying decision yet (ECON-009 §2.3 W1, issue #1418)" — the official calculator already uses 3.5bn |
| Genesis cohort split | **DEFINED** | miner 993,384,000 (40%) · validator 305,505,000 (12.3%) · agent 596,030,400 (24%) · reserve 588,540,600 (23.7%) |
| Airdrop vesting | **PLANNED / ABSENT** | `airdrop_vesting_duration_blocks` = 7,776,000 (90 d linear) is DEFINED, but **E.38 [TBD]**: "The path that distributes `genesis_supply` has no normative section … airdrop-vesting's tier set, linear schedule, performance adjustment, and claim path are unspecified" |
| Labs/Foundation subsidy | **DEFINED** | R9.3: 8 FLOP/block **each**, halving 8→4→2→1→0.5, zero from era 5; total 1,955,232,000. Not miner revenue; it dilutes |
| Work-vesting unlock | **DEFINED** | R8.1: `UnlockRate = (G_n_actual / B_p)² = R_p²`; blackout <10% capacity for `blackout_revoke_blocks` (86,400 ≈ 1 d) → grant revoked at 1.0× |
| Survival governor | **PLANNED (off)** | `governor_default_enabled` = false. If armed: boost ≤1.5× below 0.3 utilization; burn 10→15→25% by era |
| Block time | **DEFINED** | 1 s; epoch 3,600 blocks |

### 2.2 Cost side

| Parameter | Bucket | Value / citation |
|---|---|---|
| Minimum miner self-stake | **DEFINED** | `min_miner_self_stake` = 10,000 FLOP, §6.1 |
| Capacity-proportional stake | **DEFINED (coefficient provisional)** | §6.1: `10,000 + 0.01·B_p` FLOP, B_p in GFLOP/s, linear, no cap. D-0418 is marked "provisional pending sim calibration"; `/intro/miner/` says "The rate is still under economic reconciliation, so size a fleet against the live requirement rather than a published coefficient" |
| Stake per H100-equivalent | *[derived]* | 0.01 × 453,900 G_n/s = **4,539 FLOP per H100 80GB PCIe**. Inputs: the coefficient (Appendix A) and the calculator's baseline "756,500 peak dense FP16 GFLOPs × 0.60 sustained = 453,900 Gn/s" — the 0.60 factor is the calculator's, **not a protocol parameter** |
| Miner unbonding | **DEFINED** | `miner_unbonding_blocks` = 604,800 (~7 d), slash-locked while any session/dispute/audit is open |
| Commission cap | **DEFINED** | `miner_commission_cap_percent` = 20%; delegation ≤10× self-stake |
| Surge multiplier | **DEFINED** | `miner_stake_surge_multiplier_ppm` = 1,250,000 (1.25×) while cap is burst-ratcheted |
| Fraud slash | **DEFINED** | `slash_fraud_percent` = 100% for the named fault class only (§13.2, D-0409) |
| Lesser penalties | **DEFINED** | liveness 1%; extended downtime 5%; lone equivocation 50% (+50% returned after 180 d, ≥⅓ correlated → 100%); φ = 20% of unused escrow on ambiguous early close; audit-forfeit 100% of the withheld window's value |
| Ghost-Task penalty | **PLANNED** | R8.1a: "a bounded escrow slash (`OnGhostTaskFailed`)" — the bound is not given |
| Challenge window | **DEFINED** | `channel_dispute_window_blocks` = 604,800 (7 d), ≤ DA retention 14 d; response window 7,200 (2 h), non-response defaults to a fraud verdict |
| Dispute bond | **DEFINED** | `channel_challenger_bond` = 100 FLOP (challenger side). Standing: session agent + any active validator; public challengers rejected before bond lock (R12.1f) |
| Miner-side defence bond | **ABSENT** | No bond named for defending a dispute |
| **Storage deposit (miner)** | **ABSENT — does not exist** | Appendix D: ephemeral DA "no charge"; "Per-byte DA fee — none — DA is a validator duty funded by the reward share" |
| DA lease deposit | **DEFINED (not a miner cost)** | `da_lease_deposit_per_byte` = 200 FLOP/GB, refundable, paid by the weights publisher |
| **TOPLOC generation overhead** | **ABSENT** | §3.4 gives only the *size*: "top-128 values+indices of each token's last hidden state, polynomial-encoded to ~258 bytes / 32 tokens". No compute or latency cost is stated. Closest figure in the paper is a modelling claim, not a measurement: "FLOP's duplex overhead δ ≈ low single-digit % (below Pearl's cuPOW ~10% reference), machine-checked as `Duplexia.subsidy_below_cost`" (§9 rationale). arXiv:2501.16007's abstract confirms 258 B/32 tokens and a 1000× storage reduction vs. storing embeddings (262 KB for Llama-3.1-8B), and says validation is "significantly faster than the original inference" — but reports **no generation-side compute or latency overhead** there |
| TEE requirement | **DEFINED (qualitative)** | §3.3: NVIDIA CC (H100/H200/Blackwell) + Intel TDX host CVM, DCAP/dcap-qvl verification |
| TEE value-cap premium | **ABSENT** | R3.2 asserts a higher "permitted value cap"; no number. SOFT's cap is **E.33 [TBD]** |
| SOFT audit exposure | **DEFINED** | `soft_tier_spot_check_rate_ppm` = 25,000 ppm (≈1 in 40) |
| Electricity / hardware / power | **ABSENT (correctly)** | Out of protocol scope. §7's priced BOM lives in a non-public research doc (`validator-miner-hardware-costs.md`). `gpus.flop.finance` publishes live rental floors |

### 2.3 Matching and eligibility

| Parameter | Bucket | Value / citation |
|---|---|---|
| Session request fields | **DEFINED** | Appendix G: `open_channel(miner, model_hash, measured_root, decode_policy_hash, precision, enclave_key, agent_key, sla, escrow, nonce, settlement_class)` |
| Matching mechanism | **ABSENT (by design, for now)** | Off-chain agent selection; "On-chain discovery/reputation is future" (App. C.2); M8 "[GAP]"; I2 escape hatches are `force_open`/`force_settle` |
| Hardware minimums / whitelist | **DEFINED — none** | Registration is permissionless above the stake floor. Entry gate is the §7 calibration burst: `calibration_min_verified_jobs` 64, `calibration_min_burst_blocks` 600, `calibration_min_utilization_ppm` 500,000, cap lease `calibration_lease_blocks` 604,800 (7 d, renewable with 8 fresh canaries) |
| Tiers | **DEFINED / PLANNED** | HARD = `min(empirical, SKU ceiling × calibration_provisional_discount_ppm 900,000)`, ≤16 attested SKUs. SOFT = "no inventory ceiling", first-class (D-0432) but end-to-end lane is **E.33 [TBD]** |
| Which models a GPU can serve at a latency | **ABSENT** | No mapping in the spec. Only the reject-only tripwire: `throughput_tripwire_gflops_per_sec` = 2,000,000, R4.3 "MUST reject (never clamp or rewrite)". Latency shows up as `Adjusted_G_n = G_n · clamp(target/actual, 0.5, 1.5)` — but §7 says "(tracked; **reward weighting is E.22**)" |
| Reservation caps | **DEFINED** | `max_active_reservations_base` = 4, +1 per `escrow_per_reservation_slot` = 50 FLOP |
| Per-block work ceiling | **DEFINED** | `max_gn_weight` ≤ 1 PFLOP/payload (R12.2) |

### 2.4 The spec's own economic claim

The brief asked me to collect the parameters the "cheating loses money in expectation" claim depends
on, and not to evaluate it. Collected — and the paper has already done this work, and disowns the
strong reading:

> §3.5: "a necessary deterrence inequality is `p_effective · collectible_penalty >
> total_profitable_exposure`. … Here `p_effective` is the probability chain `P(selected) ·
> P(data | selected) · P(challenge | …) · P(included | …) · P(upheld | …) · P(collectible | …)`.
> Every factor conditions on all preceding events; this is the chain rule, not an independence or
> Markov assumption. **The inequality alone does not establish a Nash equilibrium for challengers,
> coalitions, bribery, or Byzantine actors.**"

| Input | Bucket |
|---|---|
| Lottery sampling rate | **DEFINED** — `sampled_audit_alpha_ppm` = 50,000 ppm (5%); `high_value_gn_threshold` = 10,000,000 G_n force-audited (α=1); `audit_quantum_gn` = 100,000,000 G_n forces ≥1 ticket; `sampled_audit_checkpoint_turns` = 16 |
| Dispute bond | **DEFINED** — 100 FLOP |
| Slash fraction | **DEFINED** — 100% (fraud class) |
| Challenge window | **DEFINED** — 7 d |
| Job value | **ABSENT** — the escrow is off-chain-negotiated (correction 2) |
| Storage deposit | **n/a** — does not exist (correction 4) |
| `p_effective` factors | **ABSENT** — every one of the six |
| The whole payoff model | **ABSENT** — **E.45 [TBD]**: "Placeholder: `total_profitable_exposure < p_effective × collectible_penalty` is a **conditional risk-neutral deterrence budget, not a unique-equilibrium or zero-fraud theorem**" |

**Verdict on this sub-question: the parameters to evaluate the claim do not exist.** Four of the
six are DEFINED; the two that decide the answer — the job value at risk and the six-factor
probability chain — are ABSENT, and the paper says so itself. It cannot be a validation test for
our model. It is a research programme (E.45, blocked on E.22 + a ratified payoff model, tracking
#1495).

---

## 3. Blocking unknowns

Separating what genuinely blocks a model from what can be an assumed input.

### Genuinely blocking

**B1. The G_n → FLOP conversion (E.30).** There is no ratified way to turn a unit of work into an
amount of money. R12.1d's tariff uses "one channel pay unit per stored G_n unit" and R4.4 forbids
treating that as a physical or monetary quantity until E.30 ratifies. Any revenue-per-G_n figure is
an invention. *This one is not substitutable* — it is the model's unit conversion.

**B2. Miner-pool apportionment and work-credit eligibility (E.44).** Not just the weight function
but *whether a settled session earns public reward at all*. A model that assumes G_n-pro-rata is
modelling the product page, not the protocol. It may well ratify that way — but today it is a
placeholder, and E.44 explicitly contemplates "false-work rejection or recovery, late-fraud effects
on issued rewards" changing what gets credited retroactively.

**B3. The session price.** Not blocking in the same sense — it is legitimately a market variable,
not a spec gap. But note *what kind* of unknown it is: it is not "unratified," it is "the protocol
has no view." There will never be a spec citation for it. Every session-revenue number is therefore
an assumption about a market that does not exist yet, forever, not just pre-testnet.

### Not blocking — assumable inputs with a stated range

- **Network competition (total verified G_n).** The dominant term, and structurally an input. FLOP's
  own calculator treats it exactly this way, with scenario paths.
- **FLOP price.** Same. Input, with paths.
- **Electricity, hardware, rent.** Out of protocol scope by construction; `gpus.flop.finance` gives
  a live cost basis.
- **TOPLOC generation overhead.** ABSENT in spec, but boundable from the literature and from the
  paper's own δ ≈ low-single-digit-% claim — carry it as a percentage-of-throughput input with a
  0–10% range and cite where each end comes from.
- **TEE premium.** ABSENT; model it as a switch with a stated default of **zero premium**, which is
  what the official calculator does ("this model adds no TEE premium or non-TEE penalty").
- **Agent + staker legs.** PLANNED-undistributed; model as 0 to the miner, note it as upside if
  E.40 ever routes any of it.

### The genesis-supply fork

`genesis_supply` is 2,483,460,000 in params and 3,500,000,000 in the workbook the official
calculator uses (issue #1418, no ratifying decision). A dilution model has to pick one and say
which. Picking the params value makes you disagree with FLOP's own calculator by ~1B tokens;
picking the workbook value makes you disagree with the normative spec. **Model both.** This is a
config value, not a judgement call.

---

## 4. Model sketch

Phase 1 supports a model, with one hard caveat: **the revenue side has a unit hole (B1) and an
eligibility hole (B2) that no amount of parameterisation closes.** What can be built honestly is a
model whose block-reward leg is well-founded and whose session leg is explicitly a market
assumption.

### Revenue

```
miner_pool(t)        = R(t) · 0.75 · blocks_per_period          [DEFINED: Appendix A]
R(t)                 = max(96 · 2^(-floor(t / 63_072_000)), 3)  [DEFINED: R9.2]

reward_income(t)     = w_i(t) · miner_pool(t) · price(t)
  w_i(t)             = ABSENT (E.44). Placeholder: G_n_i(t) / G_n_total(t)   ← flag every use
  price(t)           = INPUT (network value ÷ circulating supply)

session_income(t)    = escrow_i(t) · 0.99                        [split DEFINED; escrow ABSENT]
  escrow_i(t)        = INPUT. No protocol price exists (correction 2)

tx_fee_income(t)     = 0 for a non-authoring miner                [R9.6: author-proxy today]
agent/staker legs    = 0                                          [PLANNED, E.40]
```

### Cost

```
stake_locked_i       = 10_000 + 0.01 · B_p_i          [DEFINED: §6.1]   ← FLOP, not USD
stake_opportunity(t) = stake_locked_i · price(t) · r_opportunity   [INPUT: r]
capacity_cost(t)     = rent OR purchase/amortisation_days          [INPUT; live basis available]
verification_cost(t) = δ · capacity_cost(t)                        [ABSENT; δ INPUT, 0–10%]
storage_cost(t)      = 0                                           [DEFINED: no such cost]
expected_slash(t)    = p_fault · min(stake_locked_i, exposure)     [p_fault ABSENT, E.45]
```

### Supply / dilution

```
circulating(t) = genesis_released(t)
               + Σ R(τ)·blocks              [all four legs mint, incl. the parked 15%]
               + Σ subsidy(τ)·blocks        [16 → 8 → 4 → 2 → 1, zero from era 5]
```
The parked agent+staker legs still *mint* (R9.12) — they dilute the price even though nobody
receives them. That is a real and easily-missed term.

### Break-even and sensitivity

Break-even is `reward_income + session_income = capacity_cost + stake_opportunity +
verification_cost`. My prediction of the sensitivity ranking, to be tested rather than asserted:

1. **`w_i` (competition share)** — enters linearly and is unbounded below as the network grows.
2. **`price(t)`** — enters linearly, and interacts with dilution: circulating supply grows ~20× over
   era 0 on the calculator's own basis, so a flat network value is a ~95% price decline.
3. **`escrow_i`** — dominates *if* a paid-session market materialises at all, and is zero if it
   does not. This is a bimodal input, not a continuous one, and averaging over it is wrong.
4. **`capacity_cost`** — well-measured, moves least.
5. **δ, `r_opportunity`, `p_fault`** — second-order at plausible magnitudes.

The honest headline is that (1) and (2) are both inputs and both unbounded, so the output range is
wide by construction. That is the finding, not a defect in the model.

### Failure modes, stated up front

- **Unit risk (B1):** if E.30 ratifies a G_n↔FLOP relation different from 1:1, the entire
  session-revenue leg rescales by an unknown factor. Not a percentage error — a units error.
- **Eligibility risk (B2):** if E.44 ratifies anything other than "co-signed settle credits G_n
  pro-rata," the block-reward leg's weight function changes shape, not just magnitude.
- **The `w_i` proxy:** H100-equivalents ≈ G_n share holds only under equal verified utilization and
  quality. The official calculator states this limitation in the same words; an independent model
  inherits it.
- **Prefill/decode conflation:** the official calculator documents a previous version that
  overstated session income **~3.4×** by blending one tok/s figure and pricing it as output. Prefill
  and decode are separate capacity limits with separate prices. Any independent model must
  reproduce that split or it will make the same error.
- **Vesting non-linearity:** R8.1's `R_p²` means a fleet at 50% of its calibrated baseline unlocks
  25% of its work-vesting grant. Any model that treats utilization linearly on the airdrop leg is
  wrong by construction — though note E.38 means the airdrop leg itself is unspecified.

---

## 5. Prior art

**This is the part that changes the verdict.**

### FLOP's own tooling, already published

**`flop.finance/intro/revenue/` — "FLOP Miner Revenue Model."** A working parametric calculator,
updated 2026-08-27, that does what this brief proposes. It has:

- token-value and network-competition scenario paths, independently stressed ("The paths are
  independent, not duplicates … a usable onboarding estimate must stress both");
- an editable fleet with per-device G_n weights and live rental cost basis;
- an optional session-revenue leg at the 85% workbook share, explicitly labelled conservative
  because settlement pays 99% today;
- period ROI, curve-integrated annualised return, break-even, PNG/PDF export;
- a published formula, an eight-step on-page calculation trace, and a full assumptions table.

Its self-documentation is unusually candid — it discloses the ~3.4× prefill/decode bug it used to
have, states that exactly one hardware row is measured and every other device is solved against it,
labels placeholders as placeholders, and says outright "None of this is observed FLOP demand or a
protocol tariff." It also openly leads the spec on genesis supply and says why.

Alongside it: a **macro simulator** ("shares the calculator's cost basis but grows network capacity
from modeled demand"), and **`gpus.flop.finance`**, a live rentable-GPU market monitor with price
floors, per-model modeled rental cost, G_n delivery, margin ranges and break-even rent.

### Third-party work

**None found.** GitHub search for FLOP mining calculators / tokenomics models / PoUI miner economics
returns **zero repositories** across four query formulations. The `flop-labs` GitHub org contains
only `technocore-chat`, `tclk` and `.github` — the chain, `params/flop-protocol-params.yaml` and the
calculator are **not public**. Web search surfaces only press coverage restating the yellow paper's
headline numbers.

So the honest position is: **the niche is occupied by the protocol team, not by the community, and
their tool is closed-source.**

---

## 6. Verdict

**Build a narrower version, and change what it is for.**

Not "wait": enough *is* defined. Appendix A carries **112 enforced parameters** — mirrored into code
and gated by `scripts/check_params.py` — plus 33 reference-only and 23 derived/narrative rows, with
a generated-from-source guarantee and a stated precedence rule. Against that sit **28 numbered open
items** in Appendix E. The emission side, the stake formula,
the slashing table, the audit sampling rates, the windows and the work unit are all DEFINED and
citable. That is more than most pre-launch L1s publish, and it is a real foundation.

Not "build it as scoped" either, for three reasons:

**1. The original deliverable is taken, by the incumbent, with better inputs.** FLOP's own
calculator has a live GPU cost feed, a measured hardware anchor, and the tokenomics workbook. An
independent rebuild competes on ground where you cannot win: you do not have the workbook, the
measured H100 row, or the rental feed. Publishing a second calculator with worse inputs is the
"broad model that breaks on contact" the brief wants to avoid.

**2. The two holes that matter cannot be parameterised away.** B1 (G_n→FLOP, E.30) is a *units*
gap, and B2 (work-credit eligibility, E.44) is a *shape* gap. A calculator that hides those behind
sliders is confidence theater. The official one hides them too — it prices sessions at market API
rates and calls the reward share an "H100-equivalent proxy" — which is defensible for onboarding
and not defensible for the analysis the brief actually wants.

**3. What is genuinely missing is the opposite artifact.** Nobody — including FLOP — has published
a **parameter-provenance and gap analysis**: which economic inputs are ratified, which are
placeholders, which are unratified figures leading the spec, and what each one does to the output.
That is what this pass produced, and it is what a Rust-heavy protocol engineer is positioned to
write and a marketing site structurally cannot.

### What I would build

**Primary: an open, versioned parameter set plus a sensitivity harness — not a calculator UI.**

- `params.yaml` mirroring Appendix A's economic subset, each entry tagged
  `DEFINED | PLANNED | ABSENT`, with its `§`/`R`/`E` citation and its D-id. A spec revision is then
  a diff, which is the brief's own stated design goal.
- A thin model over it that outputs **ranges and rankings**, not point estimates, and that **refuses
  to run** without an explicit assumption for every ABSENT input — no defaults that quietly become
  numbers.
- The deliverable is the sensitivity report: which assumption dominates, and by how much. The brief
  already identified this as the product; it is more clearly the product now that the point-estimate
  tool exists.

**Secondary, and the higher-signal half: a written parameter-provenance analysis.** §1, §2.4 and §3
of this document are its skeleton. Three findings in it are, as far as I can tell, not written down
anywhere public: that the miner-pool apportionment is stated in the product docs and absent from the
normative spec (E.44); that the deterrence claim's own paper disowns the strong reading (E.45); and
that the official calculator and the ratified params disagree on genesis supply by ~1B FLOP with no
ratifying decision (#1418).

### What to skip

A web calculator, in any form. The token-price scenario paths — that is a market view, not
engineering, and the brief's own audience test ("survives being wrong") fails there hardest. Any
attempt to evaluate the "cheating loses money" claim: the parameters do not exist, and E.45 says so.

### One caveat on this whole pass

The yellow paper is a Draft, marked v0.1 with a v0.4 decision record, changing on roughly a weekly
cadence (footers 2026-08-26 / 08-27; the spec cites decisions up to D-0501). Appendix H is a
conformance matrix tracking implemented / in-progress / designed per requirement, and §0 states
"Implementation status is out of band. This specification describes the protocol FLOP targets, not a
snapshot of the codebase." **Nothing here is a claim about running code** — only about the
specification as published today. Re-run the inventory against Appendix A before anything is
published on top of it.

---

## Appendix — artifacts

| path | what |
|---|---|
| `spec/yp.html` · `spec/yp.txt` | the yellow paper as fetched, and the greppable extraction every citation resolves against |
| `spec/flop.finance_teaser_.txt` | teaser v0.1, incl. its self-flagged unratified figures |
| `spec/flop.finance_intro_miner_.txt` | the miner page — source of the "weighted by G_n" claim |
| `spec/rev.txt` | the official miner revenue model: formula, assumptions table, benchmark anchors |
| `spec/gpus.flop.finance_.txt` | the live GPU market monitor |
