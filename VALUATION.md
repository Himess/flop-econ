# Valuation layer, emission audit, and two UI fixes

> **Correction, 2026-09-10.** This report was written against a pre-publication draft and states
> `genesis_supply` = 2,483,460,000 as the ratified value, with 3,500,000,000 as an unratified
> workbook figure. That is backwards. **D-0438 ratified 3,500,000,000**, superseding the
> D-0421/D-0435 pool sizes. Genesis supply is the divisor for token price, so every dollar figure
> below is understated: at the year-one anchor the correction raises supply 16.9%, lowers the
> implied price 14.5%, and raises the break-even valuation 16.9%. The body is left as the dated
> record. See [RECONCILE.md](RECONCILE.md).

Prepared 2026-09-09 against the yellow paper at `flop.finance/intro/yellowpaper/`, re-fetched and
byte-identical to the copy the parameter set was built from.

---

## 1. Emission audit — the blocking phase

**There is no factor-of-six error. Nothing in the tool changes. No figure moves.**

That is the answer, and it is worth stating flatly before anything else, because the brief made
Phase 0 blocking on exactly the risk that a units error would get laundered into a published
financial claim. It would have. It did not happen.

### What I checked

Every emission total the specification states in its own prose, recomputed from the Appendix A rows
the model actually reads:

| Spec's stated figure | Where | Recomputed | Match |
|---|---|---|---|
| Total subsidy 1,955,232,000 | R9.3 | `63,072,000 × (16+8+4+2+1)` | exact |
| Cumulative emission through era 5 = 11,920,608,000 | R9.2 | `63,072,000 × 189` | exact |
| `2·R₀·H` = 12,109,824,000 | R9.2 | `2 × 96 × 63,072,000` | exact |
| `floor_annual_emission` = 94,608,000 | Appendix A | `3 × 31,536,000` | exact |

All four hold simultaneously at one cadence, and only one: **1 second**. `halving_interval_blocks`
= 63,072,000 divided by 730 days is exactly 1 block/second. `floor_annual_emission` inverted against
the 3 FLOP floor gives 94,608,000 / 3 = 31,536,000 blocks/yr, which is 365 × 86,400 — again 1
second. The figures are not merely compatible with a 1-second cadence; they pin it.

### Where the 6.0 actually comes from

The clean ratio is real, and it is not a cadence.

**The block reward is exactly six times the combined Labs/Foundation subsidy in every era, by
construction**: 96/16, 48/8, 24/4, 12/2, 6/1. So *any* total computed from rewards is exactly six
times the same total computed from subsidy. That is the 6.0.

The brief's figure identifies itself once you look for it:

```
63,072,000 × (96 + 48 + 24 + 12 + 6) = 63,072,000 × 186 = 11,731,392,000
```

That is the cumulative **block-reward** emission across the five halving eras, excluding the
perpetual-floor era. It is a correct figure for a different quantity. Comparing it against the
**subsidy** total and reading the mismatch as a units error is the step that went wrong; the ratio
186/31 = 6 is the per-era 6× above, surfacing at the aggregate.

The genesis-coherence check in the brief points the same way once corrected. R9.2 states outright
that cumulative emission reaches ~11.9 billion by year 12 — so a genesis of 2,483,460,000 against
billions of emission is not incoherent, it is the specification's own model.

### Independent corroboration

FLOP's own calculator states era-0 issuance as **"9.6768M FLOP/day"**. That is exactly
`(96 reward + 16 subsidy) × 86,400 blocks/day`. A 6-second cadence would put it at 1.6128M/day. The
downstream document and the specification agree, at 1 second.

### What changed

Only the bucket, which the brief was right to insist on:

- **`blocks_per_year`** is no longer inferred. It is now marked `derived: true` with its derivation
  recorded — 365 × 86,400 at the §2.2 block interval — and cited to the Appendix A row that states
  the figure verbatim: *"perpetual floor tail: 3 FLOP/block × 31,536,000 blocks/yr"*. It is read
  from Appendix A, not inferred from it. Appendix A carries **no** standalone block-time or
  blocks-per-year row; that line is the nearest thing to one, and every stated total reproduces
  from it.
- **`block_time_seconds`** gains a caveat it was missing. §2.2's table says *"Block interval | 1
  second (fixed)"* and §1.2 says *"All durations assume 1-second blocks"* — but §2.1 says *"One-second
  blocks and sub-second finality are **targets**; latency remains workload-, topology-, and
  committee-dependent until benchmarked"*, with E.46 leaving it unmeasured. So: 1 second is the
  parameter of record and the accounting convention every block-count window converts through;
  realised cadence is not established. Both facts now sit in the note.

To answer the brief's sub-question directly: **the sub-second language is about finality, not block
time.** §2.2 lists *"Finality | deterministic BFT once ordered; sub-second latency target"*.

### Pinned

`model/emission.test.ts` recomputes all four stated totals, the 6× per-era relation, and the
identification of 11,731,392,000 as the five-era reward total. If anyone changes the cadence, the
reward schedule or the subsidy schedule, at least one breaks. The audit is now a regression test
rather than a memory.

---

## 2. Supply model

```
outstanding(t) = genesis + Σ over eras [ (block reward + subsidy) × blocks in era ∩ [0, t) ]
```

Integrated era by era, not assumed flat — a horizon crossing a halving boundary would otherwise be
wrong by up to a factor of two. Both the reward and the subsidy mint, so both dilute; the subsidy
pays neither role this tool models but still enlarges the denominator.

**Anchored to year 1, adjustable.** FLOP has no maximum supply — after five halvings the reward
holds at 3 FLOP in perpetuity — so there is no fully-diluted point to anchor on. The input is
labelled with the anchor rather than leaving the reader to guess.

**Both genesis figures, always, side by side:**

| | value | bucket | source |
|---|---|---|---|
| ratified params | 2,483,460,000 | `DEFINED` | Appendix A, §2.3, R9.7, D-0421 |
| workbook | 3,500,000,000 | `PLANNED` | flop.finance/intro/revenue/, unratified, #1418 |

The workbook column can never render `DEFINED`; a test asserts it.

**A correction to the brief's premise.** The brief says the two give token prices "about 41% apart".
That is the genesis-only ratio — true at year 0. But era-0 issuance is *larger than genesis itself*
(3,532,032,000 FLOP in year one against a 2.48bn genesis), so the gap in outstanding supply narrows
fast:

| anchor | spread |
|---|---|
| year 0 | 40.93% |
| **year 1** | **16.90%** |
| year 2 | 10.65% |
| year 5 | 7.28% |

The two-column treatment is still right — at the worked example, 17% is the difference between a
$52.3M and a $61.1M break-even valuation, which is a decision-changing gap — but the headline number
is anchor-dependent, and the tool now says so in place.

**Circulating supply is not modelled, deliberately.** E.38 states the path distributing
`genesis_supply` *"has no normative section"*; the agent leg unlocks against spend with the mechanism
itself listed as undecided; the validator cohort's conversion is open. Rather than pick one silently,
the tool computes **outstanding** and labels it as such everywhere it appears.

---

## 3. What the valuation layer computes

Inputs marked **spec** come from `params.yaml`; **yours** are user-supplied, dotted, and in the
ledger. Every dollar figure is `ABSENT`-bucketed regardless of how well-founded its FLOP input was —
a test asserts no valuation output can ever read `DEFINED`.

### Price

```
valuation mode:  price = valuation ÷ outstanding(anchorYear, scenario)     yours ÷ spec
direct mode:     price = entered directly                                  yours
```

Direct mode does not consult the supply model at all, so both genesis columns agree — which is
correct, and the derivation says so.

### Forward

```
revenue_usd/yr  = revenue_flop/yr × price          spec × yours
revenue_usd/mo  = revenue_usd/yr ÷ 12
net_usd/yr      = revenue_usd/yr − cost_usd/yr
payback_months  = hardware ÷ net_usd/yr × 12       refuses when net ≤ 0
cost_usd/yr     = electricity × kW × 8,760 + hardware/months × 12 + hosting × 12    all yours
```

### Reverse — the half that carries no market view

```
break_even_price     = cost_usd/yr ÷ revenue_flop/yr
break_even_valuation = break_even_price × outstanding(anchorYear, scenario)
```

Both computed in each genesis scenario. The break-even **price** is identical across columns — it
depends only on costs and FLOP earned. The break-even **valuation** is not, because it multiplies
that price by a supply the two scenarios disagree about. That is where the unratified genesis figure
stops being a footnote and moves the user's own threshold.

A test asserts the two directions agree: at exactly the break-even price, forward net is zero.

### Sensitivity

Each input perturbed alone by ±20%, ranked by how far annual net moves, with direction recorded
(raises/lowers). One-at-a-time, so interactions are not captured, and the UI says so.

### What FLOP revenue feeds it

`blockRewardIncome + auditIncome` from the validator model — the only spec-grounded quantity on the
tab. The USD cost inputs **replace** the FLOP-denominated DA and GPU figures on the Validator tab
rather than adding to them; the panel states this, because entering costs in both places would
double-count them silently.

---

## 4. UI fixes

**The slashing ladder now encodes one scale.** Bar length tracks **recovery time**, the single
quantity the section is about. Severity moved to the percentage beside each label plus the existing
colour ramp. Extended downtime (22.12d) is now the longest bar and lone equivocation (7.00d) is
visibly shorter — the reverse of before. The fraud class draws no bar and reads "terminal — eject
and blacklist, no recovery path". The caption now states the reading explicitly: *a long bar on a
small percentage is exactly the point.*

**Both default scenarios now expose their findings on arrival.**

- Validator: self-stake opens at 1.2× the baseline minimum, above the set average. Seat rate reads
  0.600 against a set average of 50%, and the committee premium opens at **+17,300 FLOP/yr** instead
  of a hardcoded-looking zero. The note's label changes to "how this works", and dragging stake back
  toward the mean shows it cancel — which teaches the mechanism.
- Agent: escrow opens at 600 against a 450 tariff, so **150.00 FLOP — 25% of the reservation** —
  shows as lost to over-reservation immediately. The exactly-break-even case is now something a
  visitor reaches by tuning down.

**Issue numbers — verified, and two needed re-attribution.**

| number | resolves | where |
|---|---|---|
| #1393 | yes | yellow paper, E.41 *Blocking* |
| #257, #1176 | yes | yellow paper, E.38 *Blocking* |
| #1356 | yes | yellow paper, E.39 *Blocking* |
| **#1418** | yes | **flop.finance/intro/revenue/ — not in the yellow paper** |
| **#1352** | yes | **flop.finance/intro/revenue/ — not in the yellow paper** |

Both of the last two are quoted verbatim from the calculator page and appear nowhere in the
specification. They were being rendered beside yellow-paper citations, which implied a provenance
they do not have. Each tracking number in the disagreements section now names its source document.

---

## 5. What I could not do honestly

**Named comparable valuations — cut.** The brief asks for a small neutral scale of reference
valuations for comparable networks. Quoting another network's market capitalisation would put a live
market figure inside a tool whose entire claim is that every number traces to a citable source: it
would be stale within a day and unverifiable against any specification. Shipped instead as a bare
decade ruler — $10M / $100M / $1B / $10B, with the user's own guess highlighted in its decade. It
does the placing job without pretending to a precision it has not got, and the panel says why the
names are absent.

**Circulating supply — cut, and labelled.** As above: E.38 leaves the distribution path with no
normative section, so any circulating figure would be invented. Outstanding is used and labelled
everywhere.

**Currency other than USD — not shipped.** More than a formatting change, since it needs a rate the
tool would have to source and keep current. USD, noted in place.

**One thing to watch.** The valuation tab draws FLOP revenue from the validator model, whose own
cost side rests on two `ABSENT` inputs (DA volume, E.47; GPU backend, no sizing anywhere). The
break-even figures are therefore honest about price and supply but inherit whatever the user
assumed about cost. The sensitivity ranking exists precisely to show when that is the term doing
the work.
