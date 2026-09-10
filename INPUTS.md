# INPUTS — ask for what the user knows, derive the rest

Spec basis: FLOP yellow paper, fetched 2026-09-09, Draft, decision record v0.4 (D-0401..D-0437,
D-0501). `params.yaml` sha256 `b726d199bf24afe5` — 115 parameters, 87 DEFINED / 7 PLANNED /
21 ABSENT.

The tool asked for two things nobody can answer: `DA cost` and `GPU backend`, both in FLOP per
year. This is what replaced them and what could not be replaced.

**Headline result.** Eight counted assumptions became **four**, and both unanswerable inputs became
derived figures. The derivation also produced two findings that change how a validator should size
their costs — the DA storage duty is a rounding error where §15.3 calls it a heavy leg, and the
committee GPU gate has no absolute requirement at all.

---

## 1. DA derivation

### What is derivable

All of it, down to two traffic figures. Every constant is normative.

| Quantity | Value | Source | Bucket |
|---|---|---|---|
| `VerifiedTurn` SCALE size | `268 + compact_len(L) + 33L` B for path length L | App. F.3 | DEFINED |
| Merkle path item | 33 B (`sibling_hash:H256` + `sibling_is_left:bool`) | App. F.3 | DEFINED |
| V3 leaf preimage | 236 B | App. F.3 | DEFINED |
| TOPLOC commitment | **~258 B / 32 tokens** | §3.4 | DEFINED |
| TOPLOC mandatory per session, published to DA | yes | R3.4a | DEFINED |
| Erasure coding | Reed–Solomon rate ½ | §5.3 R5.3a, App. F.4 | DEFINED |
| Shard count R | 6 | `da_shard_count`, D-0402 | DEFINED |
| Reconstruction threshold k | 3 | `da_min_replication_factor`, D-0402 | DEFINED |
| Ephemeral retention W | 1,209,600 blocks = **14 days** | `da_ephemeral_retention_blocks`, D-0412 | DEFINED |
| Assignment | `hash(commitment) → subset`, stake-weighted, deterministic | §5.3 R5.3a, App. F.4 | DEFINED |
| Session dispute window | 7 d ≤ W | §12.1 D-0403 | DEFINED |

**The byte arithmetic:**

```
L        = ceil(log2(turns))
perTurn  = 268 + compact_len(L) + 33 × L            [App. F.3]
toploc   = ceil(tokensPerTurn / 32) × 258           [§3.4]
session  = turns × (perTurn + toploc)
stored   = session × sessionsPerDay × 14 d × 2      [rate ½, W = 14 d]
yours    = stored × (your stake ÷ network stake)    [App. F.4, stake-weighted]
```

### The subset size cancels, which is why this works

`hash(commitment) → subset` names a subset but never its size. That looked like a blocker and is
not one. Whatever the subset is, the shards on it sum to `expansion × original` by construction
(rate ½ ⇒ 6 shards of `original/3`), and a stake-weighted draw gives a validator an expected share
equal to its stake share. So:

```
expected bytes held = original × 2 × (your stake ÷ network stake)
```

At the set-average stake that is `2 × original ÷ set size`. Same shape as the committee seat rate,
for the same reason. `model/physical.test.ts` asserts the property that makes the omission
legitimate rather than just omitting the term.

### What stays an estimate

Three figures, all ABSENT, all the user's:

| Key | Why it cannot be derived |
|---|---|
| `network_sessions_per_day` | E.49 has no demand model. §12.3's own throughput figures are stated as "not a measured network capacity". |
| `network_turns_per_session` | Traffic shape. The spec bounds a settlement bundle (`channel_max_settlement_turns`) and says nothing about typical length. |
| `network_tokens_per_turn` | Pricing is quoted in tokens (§4) but no typical turn length appears anywhere. |

Plus one physical fact: `da_storage_price_usd_gb_month`. Not a spec figure and never will be —
§15.3 and R5.3c make the duty "funded by reward share, no per-byte fee", so what storage costs is
a fact about the operator's provider.

### FINDING — the storage half of the "heavy leg" is a rounding error

§15.3 names DA store-and-serve one of "the two heavy legs". Run the spec's own arithmetic:

| Scenario | Standing duty, one validator (200-set, average stake) | At $0.02/GB-month |
|---|---|---|
| 5,000 sessions/day, 20 turns, 800 tokens/turn | **0.12 GB** | **$0.03/yr** |
| 1,000,000 sessions/day, same shape | ~23 GB | ~$5/yr |

Against a 305,505 FLOP stake floor. The tool's previous worked example asked the user to type
`250,000 FLOP/yr` for this line.

Whatever is heavy about the leg is the **bandwidth**, and that is exactly what cannot be derived
(see §4). A validator sizing costs from the storage figure alone will understate it, and the tool
says so where the figure is shown rather than quietly implying the leg is cheap.

---

## 2. GPU requirement

The expectation going in was that the spec does not say how much work the committee gate needs.
It is more specific than that, and the answer is more useful.

### The gate is a recency test, not a quantity test

> "Verified-work (committee) | LastVerifiedWork within WorkRecencyWindow = 86,400 blk (24 h);
> else active but out of the PoUI committee" — §15.2

R2.4 and R15.4a restrict membership to validators meeting `effective_minimum_stake()` **and**
`is_work_verified_recent`. That predicate is a timestamp comparison. **One verified proof inside
the 24-hour window satisfies it.** No minimum G_n, job count, or utilisation appears in the gate.

### The only quantity floor is one layer down, and it is relative

R7.2, the calibration-cap renewal rule:

> "renew_benchmark_cap requires at least `calibration_renewal_min_verified_jobs` fresh one-shot
> jobs issued at or after a miner-declared renewal trigger. That trigger MUST NOT be in the future
> or older than `calibration_renewal_max_age_blocks`. Their aggregate verified work MUST cover
> `C_effective × max(1, current_block − renewal_trigger) × calibration_min_utilization_ppm / 10^6`.
> Job count alone MUST NOT renew a cap."

| Parameter | Value | Reading |
|---|---|---|
| `calibration_min_utilization_ppm` | 500,000 ppm | 50% |
| `calibration_renewal_min_verified_jobs` | 8 | fresh Ghost canaries |
| `calibration_renewal_max_age_blocks` | 600 | 10 minutes — so the 50% is a **burst**, not a duty cycle |
| `calibration_lease_blocks` | 604,800 | renew every 7 days |

`C_effective` is the operator's **own** benchmarked capacity. A small card with a small cap clears
the same rule as a large one.

### FINDING — there is no absolute hardware minimum in the specification

§15.3 gives qualitative intensities only: "light CPU", "GB-scale bandwidth", "GPU-heavy". No
CPU/RAM/NVMe/bandwidth figure is stated anywhere, and §15.1 says a validator "is not required to
own a TEE GPU to validate, but committee eligibility requires recent verified PoUI work (§15.4),
so a production validator co-locates or delegates to a calibrated miner backend."

The spec is candid about the consequence. R15.5 ranks by stake subject to a performance floor
"so wash verified-work does not improve rank (**only clearing the floor remains gameable**)".

This is why the tool asks for cards, draw and utilisation and derives a cost, instead of asking
what a GPU backend costs per year: **the protocol fixes the shape of the duty and the operator
fixes its size.** Anyone planning to validate on a VPS is not wrong about the gate as written —
they are exposed to E.42, which is open.

---

## 3. New input model

### Your position — facts and decisions

Self-stake · average validator stake · set size (200 wired / 1,000 ratified) · horizon · days
queued · exit month. Agent tab: escrow · turns · G_n.

No assumption mark, not counted by the chip.

`Set total stake` is gone. Nobody can estimate a network aggregate for a network that does not
exist; **average validator stake × set size** puts the question in the frame the operator can
answer, and in the same frame as the committee-premium finding, which is entirely about position
against the average. Changing the set size holds the average and moves the total. `networkStake`
remains the stored field, so every shared link written before the change still resolves.

### Your hardware — physical quantities

GPUs · draw per card · utilisation · electricity price · hardware cost · hosting · storage price.

Marked as non-spec (a result resting on them is still ABSENT) but **not counted by the chip**: a
validator knows how many cards they own. `power_draw_kw` is no longer typed — it is
`cards × watts × utilisation ÷ 1000`, and the tool shows the arithmetic.

### Your estimates — the short list

| Field | Count |
|---|---|
| Network sessions per day | 1 |
| Turns per session | 2 |
| Tokens per turn | 3 |
| Network valuation | 4 |

**Four**, down from eight. Every one is something a person forming a view on FLOP has an actual
opinion about. The chip reads `4 estimated`, and opening it lists all four by name with value and
unit, then the eight physical figures separately under "Derived from your own setup" — so the
number is checkable against something.

### The unit collision is gone

One cost model, in dollars, in one place:

```
energy      = kW × 8,760 h × $/kWh
amortisation= hardware ÷ months × 12
hosting     = $/month × 12
DA storage  = derived GB × $/GB-month × 12
```

`operatingCost` still keeps two legs because §15.3 names two, but both are now derived and
converted once at the price the user's own valuation implies. `DA cost` and `GPU backend` in
FLOP/yr are **outputs**, shown in the "What your inputs derive" drawer with their derivations
linked into `/docs`.

### What the derived drawer shows, on the shipped example

```
DA bytes per session        137,680 bytes            App. F.3
Your DA storage duty          0.116 GB               §5.3 R5.3a
DA storage cost              $0.028 /yr              your storage price
Rig draw                      0.700 kW               your hardware
Total operating cost        $15,352 /yr              derived
Committee gate              1 proof / 24 h           R15.4a
Calibration renewal         8 jobs, 50% of your own capacity, every 7 d   R7.2
```

---

## 4. What could not be derived, and why

| Left out | Why | Where it is stated |
|---|---|---|
| **DA bandwidth / egress** | E.47 leaves "audit/repair timing, repair bandwidth" open; §15.3 quantifies the duty only as "GB-scale bandwidth". No audit frequency, no repair volume. | `da_bandwidth_volume` (ABSENT), Limits |
| **Direct-rail DA blobs** | "proof_data, TEE quote (5–10 KB), event log (≤ 256 KB)" — a range, a ceiling, one unstated term. E.46 calls its own byte figures "arithmetic byte ceilings only". Picking a number inside a 50× band is not a derivation. | `da_direct_rail_blob_bytes` (ABSENT) |
| **Cumulative retention budget** | E.47 explicitly: "the cumulative storage/retention budget across the full session+challenge lifecycle" is open. The per-blob arithmetic closes; the lifecycle total does not. | E.47, tracking #1497 |
| **Provider subset size** | Never stated. Did not need to be — it cancels (§1). Recorded rather than assumed. | `da_erasure_expansion_ratio` note |
| **Absolute GPU requirement** | Does not exist. The floor is relative to `C_effective`. | `validator_hardware_spec` (ABSENT) |
| **Whether one proof per 24 h is really enough** | E.42 is open on seat capture, bootstrap and undersized pools; R15.5 concedes clearing the floor is gameable. The gate as written is the gate the tool models. | E.42, tracking #848 |

The TOPLOC figure carries a tilde in the spec — "polynomial-encoded to **~258 bytes** / 32 tokens".
It sizes a scheme, not a protocol constant, so the DA derivation is approximate by inheritance and
the docs say so rather than presenting it as exact.

---

## Carried from the last review

All three were already shipped before this brief landed:

- **Cash payback provenance** — was marked `E.39` alone; now `your assumption · E.39`, because the
  figure moves with the derived cost chain.
- **The invisible withdrawable line** — every series now ends in a ringed marker, and a caption
  reads "Withdrawable ends at $748 — under 2% of a $250K axis, so the line sits on the baseline
  rather than being missing."
- **Cooperative settle vs the headline** — the table row carries "the tariff is paid and the
  remainder is not returned", so `0` under "you recover" no longer reads as a contradiction of
  "150 FLOP lost".

## Verification

- 162 tests green, including 19 new in `model/physical.test.ts` pinning every constant above to
  `params.yaml` and asserting the subset-size cancellation.
- Magic-number guard green. `tsc --noEmit` clean. Production build clean.
- 25 provenance marks across both tabs, zero dead destinations.
- No console or page errors at 1440 or 375.

## Rules honoured

Inventory before rebuilding — every derivation above cites a normative line. No ABSENT parameter
was filled with a plausible default: the three traffic figures and the storage price block rather
than default, and bandwidth was left out rather than approximated. Preview deploy only; nothing
public, nothing pushed, nothing posted.
