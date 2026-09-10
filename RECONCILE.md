# RECONCILE — the published specification against the tool, exhaustively

**Date:** 2026-09-10 · **Basis:** yellow paper `0.5.0 (draft)`, sha256 `cb414e5c…5c8ea9`

**One correction, and it was on a live public site.** `genesis_supply` was carried as
2,483,460,000 and labelled *ratified*, with 3,500,000,000 labelled *unratified workbook*. That is
backwards. D-0438 ratified 3,500,000,000. Genesis supply is the divisor for token price, so every
dollar figure the site published was wrong by a measurable amount: **break-even valuation was 16.9%
too low, implied token price 14.5% too high.** Fixed and deployed.

**On the brief's other claims:** the 18.1bn total and the 1.20bn validator airdrop are real and
come from the official tokenomics graphic — which a text-only reconcile cannot read, and which my
first pass therefore dismissed. Both are **superseded**: the asset now served states 17.2bn and a
0.31bn validator airdrop, agreeing with Appendix A throughout. Recorded, with the method fixed.

---

## 1. Banner status

| | |
|---|---|
| Deployed | 2026-09-10, before any other work — production, both routes |
| Text | *"Being re-verified. Supply and genesis figures are under review against FLOP's tokenomics update of 2026-09-10 and yellow paper 0.5.0. Treat every dollar figure as provisional until this notice is removed."* |
| Removed | 2026-09-10, after the correction shipped and every figure was confirmed against Appendix A |

The site was never taken down.

## 2. Spec dump

| | |
|---|---|
| Path | `spec/yellowpaper-v0.5.0.md` |
| Size | 248,811 bytes |
| sha256 | `cb414e5cdfe72eec048102720c0ebff5e25b00d8910ae2affe137746b59c8ea9` |
| Source | `raw.githubusercontent.com/flop-labs/yellowpaper/main/yellowpaper.md` |
| Sections | 25 top-level |
| Last section | `## Appendix I — Runtime Composition`, ending cleanly |

**Completeness check — all nine appendices present:**

| A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|
| ✓ @137310 | ✓ @189481 | ✓ @191524 | ✓ @195262 | ✓ @198125 | ✓ @218657 | ✓ @230765 | ✓ @236032 | ✓ @242597 |

No truncation, no paging needed. `https://flop.finance/intro/yellowpaper/` was also fetched
(449,433 B of HTML) and carries the same figures — the markdown is the source of that page.
The v0.4 snapshot is retained at `spec/yp.txt` as evidence of what moved.

## 3. Genesis supply — the correction

Appendix A, verbatim:

```
| genesis_supply | 3_500_000_000 FLOP | §9.3 | D-0438 |
  Genesis (pre-emission) total supply, pinned normatively by R9.7 (§9.3).
```

R9.4 requires it be allocated to **exactly four buckets and nothing else**. All four are in
Appendix A and they sum exactly:

| Bucket | Value | Share | Decision |
|---|---|---|---|
| `genesis_miner_airdrop` | 1,200,000,000 | 34.29% | D-0438 |
| `genesis_agent_airdrop` | 1,200,000,000 | 34.29% | D-0438 |
| `genesis_validator_airdrop` | 305,505,000 | 8.73% | D-0435 |
| `genesis_reserve` | 794,495,000 | 22.70% | D-0438 |
| **Total** | **3,500,000,000** | 100% | |

`/intro/revenue/` confirms it in its own words: *"D-0438 ratified `genesis_supply` =
3,500,000,000 (the workbook's 2026-08-22 restatement), so the params page, the Yellow Paper
appendix and this cash-flow model now agree."*

### What it changed downstream

| At the year-1 anchor | Before | After | Δ |
|---|---|---|---|
| Genesis | 2,483,460,000 | 3,500,000,000 | +40.9% |
| Outstanding supply | 6,015,492,000 | 7,032,032,000 | **+16.9%** |
| Implied price at $300M valuation | $0.049871 | $0.042662 | **−14.5%** |
| Break-even valuation (worked example) | $50,198,545 | $58,681,447 | **+16.9%** |
| Live headline break-even | $49,140,032 | $57,444,059 | **+16.9%** |

Disagreement `genesis_supply_fork` is **marked resolved**, dated, with D-0438 as the ratifying
decision — not deleted. Both columns are still computed side by side, relabelled *ratified
(D-0438)* and *superseded (D-0421/D-0435)*, because the gap between them is the size of the error
this tool published.

## 4. Validator airdrop — 305,505,000 against "1.20bn"

> **Corrected after first publication.** My first answer here was "there is no contradiction, this
> is a misreading of two tables." That was wrong, and wrong in a way my method guaranteed: the
> claim lives in **`flop.finance/assets/tokenomics.png`**, and I searched page *text*. A grep
> cannot read a figure rendered inside an image. See §4b.

**Settled: the contradiction was real, in a version of the official graphic that has since been
replaced. The asset now live agrees with Appendix A.**

There is no tokenomics *page* on flop.finance — the sitemap lists ten URLs. The allocation figures
appear in two places: the `/teaser/` HTML tables, and a graphic embedded on that page. The HTML
tables are **two of them**, and reading them together was where the "two tables" answer came
from.

The first is headed *"Cumulative supply to year 10, and the year-10 allocation split"*, with the
column *"Share of year-10 supply"*:

> Validators **1.2bn** $FLOP 6.8% — *"Verify compute and facilitate transactions: they check
> miners' work certificates, build blocks, and store model weights, earning block rewards and 15%
> of inference fees."*

That is validators' **cumulative earnings by year 10**, not an airdrop.

The second table, immediately below, is the genesis breakdown:

> *"The genesis airdrop of 3,500,000,000 $FLOP — 20.4% of the total network supply at year 10 — is
> allocated as follows … Validators **305,505,000 (1.8%)** — The aggregate stake that secures the
> network at launch."*

**305,505,000, matching Appendix A exactly.** Its four rows sum to 3,500,000,000 and reproduce
Appendix A's four buckets, `genesis_reserve` included. Nothing to record.

## 4b. The tokenomics graphic — what my method missed

`/teaser/` embeds `<img src="/assets/tokenomics.png">`. Two versions are in play.

**Superseded version** (circulating; marked DRAFT):

| | |
|---|---|
| Total supply, year 10 | **18.1bn** |
| Terminal inflation | **0.5% / yr** |
| Airdrop | **4.4bn (24.3%)** |
| — Miners | 1.20bn 6.6% |
| — **Validators** | **1.20bn 6.6%** |
| — Agents | 1.20bn 6.6% |
| — Reserve / Incentives | 0.80bn 4.4% |

**Currently served** (sha256 `e05656909de1a8a9`, fetched 2026-09-10, archived at
`spec/assets/tokenomics-live-2026-09-10.png`):

| Figure | Live graphic | Appendix A / this tool | Agrees |
|---|---|---|---|
| Total supply, year 10 | **17.2bn** | 17,186,624,000 | ✓ |
| Terminal inflation | **0.6% / yr** | 0.550% | ✓ |
| Airdrop | **3.5bn (20.4%)** | `genesis_supply` 3,500,000,000 | ✓ |
| — Miners | 1.20bn 7.0% | 1,200,000,000 | ✓ |
| — **Validators** | **0.31bn 1.8%** | 305,505,000 | ✓ |
| — Agents | 1.20bn 7.0% | 1,200,000,000 | ✓ |
| — Reserve / Incentives | 0.79bn 4.6% | 794,495,000 | ✓ |
| Team + Foundation | 2.0bn 11.4% | 1,955,232,000 (R9.3) | ✓ |

The `/teaser/` page's own `alt` text describes the current version — *"rising to 17.2bn … airdrop
3.5bn (20.4%) … validators 0.31bn"* — so the page and its graphic are consistent today.

**The brief was right and I was wrong.** The 4× validator discrepancy existed, and the entire
0.9bn gap between 18.1bn and 17.19bn is that one line: 1,200,000,000 − 305,505,000 = 894,495,000.
The older graphic was internally consistent — it simply used a 4.4bn genesis instead of R9.4's
3.5bn, and 0.5% is 94,608,000 over *its* total.

Recorded as the `tokenomics_graphic` disagreement, marked superseded with both versions in their
own figures, because anyone holding the older screenshot has a validator airdrop roughly four
times too high.

**The method fix.** `meta.published_sources` now lists the image assets explicitly, with a note
that a text-only reconcile cannot see them, and pins the live graphic's sha256. Any future pass
must fetch the graphics and look at them.

## 5. Team + Foundation 2.0bn

**Confirmed as the subsidy — and the teaser says so itself.** Its own description:

> *"Team + Foundation 2.0bn $FLOP 11.4% — Funds network development and upkeep: **8 $FLOP per block
> each to Flop Labs and the Flop Foundation, issued on top of the block reward**, halving on the
> same schedule and **sunsetting after year ten**."*

That is `subsidy_per_block_per_recipient` = 8 + 8, over `subsidy_duration_blocks` = 315,360,000
(~10 years), total **1,955,232,000 FLOP** by R9.3 — which rounds to the stated 2.0bn.

**But the brief's inference does not follow.** The table is explicitly a *year-10 supply* split,
not a genesis pie, and the genesis breakdown is a separate table beneath it that does not contain
this row. Presenting a ten-year mint as a share of ten-year supply is correct. Nothing to record
as a disagreement.

**The tool does model the subsidy.** `subsidy_per_block_per_recipient` has been in `params.yaml`
throughout and `cumulativeEmission()` integrates reward *and* subsidy era by era; `emission.test.ts`
pins the 1,955,232,000 total. Not an omission. `subsidy_duration_blocks` and the three other
genesis buckets have now been added for completeness.

## 6. Active set — the comparison survives, the labels did not

Both figures are real, and they disagree **inside one document**:

- **Appendix A:** `validator_active_set_cap` = **1,000**, D-0437.
- **§5.3:** *"The finality committee is a separate set capped at 100; **1,000 active validators is
  not a supported runtime state.**"* — and it sizes attestation bundles *"at the supported
  active-set maximum of 200"*.
- **E.41 `[PLANNED]`** gives the mechanism: *"D-0437 ratifies `validator_active_set_cap` = 1,000,
  but the runtime cannot reach it: `MaxAuthorities` = `MAX_ACTIVE_VALIDATORS` = **200**."*

So the comparison is still meaningful — 200 is what the runtime supports, 1,000 is what governance
ratified — but the old labels *"200 wired / 1,000 ratified"* understated it. Now **"200 supported"
/ "1,000 unreachable"**, and the `active_set_cap` disagreement carries §5.3's wording.

**No conflation.** `finality_committee_size` = 100 is a separate quantity, used only for the seat
rate; the active set drives pool share. They have never been mixed.

## 7. The 18.1bn question

> **Corrected after first publication.** I originally wrote that 18.1bn "does not appear on any
> published FLOP page". It appeared in the tokenomics graphic (§4b) — which my text search could
> not read. The figure is real; it is also superseded.

**18.1bn came from the superseded graphic, and it is arithmetically consistent with it.** I fetched
all eight pages in the sitemap and searched their *text* for `18.1`, `18,100,000,000`,
`terminal inflation` and `0.5%` — zero hits, because the figures are in a PNG. The graphic now
served states **17.2bn** and **0.6%**.

18.1bn follows from a 4.4bn genesis: 17,186,624,000 + 894,495,000 (the validator-airdrop
difference) = 18,081,119,000, which rounds to 18.1bn. And 94,608,000 ÷ 18.1bn = 0.523%, the stated
0.5%. The older graphic was self-consistent; it just used a genesis figure R9.4 does not.

What *is* published is the teaser's year-10 table, and it reconciles with the emission schedule.
The tool's own supply model, run to year 10:

| Component | FLOP |
|---|---|
| Block reward, eras 0–4 = 63,072,000 × (96+48+24+12+6) | 11,731,392,000 |
| Subsidy (R9.3) | 1,955,232,000 |
| Genesis (D-0438) | 3,500,000,000 |
| **Year-10 total** | **17,186,624,000** |

Against the teaser's stated shares:

| Row | Allocation | Stated share | Actual share of 17.19bn | Implied total |
|---|---|---|---|---|
| Airdrop | 3.5bn | 20.4% | 20.36% | 17,156,862,745 |
| Miners | 8.8bn | 51.2% | **51.20%** | **17,187,500,000** |
| Validators | 1.2bn | 6.8% | 6.98% | 17,647,058,824 |
| Brokers / agents | 1.2bn | 6.8% | 6.98% | 17,647,058,824 |
| Team + Foundation | 2.0bn | 11.4% | 11.64% | 17,543,859,649 |
| Staking rewards | 0.6bn | 3.4% | 3.49% | 17,647,058,824 |

The two largest rows — the two carrying the least rounding error — imply **17.16–17.19bn**, and
miners at 51.2% is exact to two decimals against 17,186,624,000. The four smaller rows are stated
to one decimal against allocations rounded to 0.1bn, which is enough slack to explain the spread.

**So there is no gap to explain.** The brief's own arithmetic (17,186,624,000) is correct and it
*matches* the published table. The 18.1bn figure it was tested against is not in the sources. The
terminal-inflation cross-check points the same way: `floor_annual_emission` = 94,608,000 is 0.550%
of 17.19bn and 0.523% of 18.1bn — the latter is closer to a round 0.5%, which is likely where the
number came from, but it is not what FLOP published.

**The tool's supply figure needs no correction beyond the genesis fix**, which is applied.

## 8. Full parameter diff

Every entry in `params.yaml` located in Appendix A of the dump. See
[`RECONCILE-TABLE.md`](RECONCILE-TABLE.md) for all 124 rows.

| Outcome | Count |
|---|---|
| Confirmed identical to Appendix A | 68 |
| **Corrected** | **1** (`genesis_supply`) |
| Extraction artefact — verified by hand, my value correct | 3 |
| Not an Appendix A identifier (derived keys, traffic estimates, physical inputs) | 53 |

The three artefacts, each a prose-y Appendix A cell my numeric reader mis-parsed:

| Parameter | Cell text | My value | Verdict |
|---|---|---|---|
| `performance_score_weights` | `40/30/20/10 percent` | `40/30/20/10` | correct |
| `da_endpoint_deposit` | `VFY FLOP` (description: *"1 VFY = 1 FLOP"*) | `1` | correct |
| `miner_capacity_stake_per_gflop` | `VFY / 100 FLOP per GFLOP/s (= 0.01)` | `0.01` | correct |

**Why the last pass missed this and this one did not.** The previous check asked *"is the string
`2,483,460,000` present in the document?"* It was — as a superseded value. That is a presence test,
not a value test. This pass parsed Appendix A into a keyed table and compared every value
positionally. A method that asks the right question catches both the GPU reversal and the genesis
change; the earlier one caught only the first.

Seventy-nine Appendix A rows are not carried, all outside the economic subset (BABE slot
probability, TOPLOC band constants, transaction-fee multipliers, governor tiers). Five that were
economically load-bearing have now been added: the three other genesis buckets,
`airdrop_vesting_duration_blocks` and `subsidy_duration_blocks`.

## 9. Appendix E changes

Appendix E is 20,532 bytes with **29 open items** (`meta.open_items_total` corrected from 28).
Every item this tool's `ABSENT` and `PLANNED` marks rest on is still open, with an unchanged tag:

| Item | Status | Bearing on the tool |
|---|---|---|
| E.33 | `[TBD]` | SOFT-tier miner class |
| E.38 | `[TBD]` | *"The path that distributes `genesis_supply` has no normative section"* — why supply is reported outstanding, not circulating |
| E.39 | `[RATIFY]` | The reward lock behind cash payback |
| E.40 | `[TBD]` | Agent and staker legs minted but undistributed |
| E.41 | `[PLANNED]` | Active-set cap against `MaxAuthorities` — now quoted directly |
| E.42 | `[TBD]` | Seat-capture model behind the `PLANNED` seat rate |
| E.44 | `[TBD]` | Cooperative work-credit eligibility |
| E.47 | `[TBD]` | DA availability, repair bandwidth — why egress stays out of the model |
| E.49 | `[TBD]` | Independent-demand model — why network traffic is the user's estimate |

No mark needed rebucketing.

## 10. What is still wrong, or unfinished

**Fixed and deployed today:**
- `genesis_supply`, and the inverted scenario labels.
- The `/docs` prose that said *"the specification ratifies 2,483,460,000 … with no ratifying
  decision"* — it was on the live site and is now corrected with the correction's size stated.
- The queue-cost prose saying the cap was *"wired at 200"*, now quoting §5.3 and E.41.
- Set-size labels.
- `ECONOMICS.md` and `VALUATION.md` carry a dated correction note at the top; their bodies are left
  as the record. `README.md`'s disagreement list is updated.

**Known and still true:**
- Supply is **outstanding, not circulating**. E.38 leaves the distribution path unspecified, so a
  circulating figure cannot be derived honestly. Every valuation figure rests on that.
- **DA egress is out of the model.** E.47 leaves repair bandwidth and audit timing open. A
  validator sizing costs from the storage figure alone will understate the leg.
- `airdrop_vesting_duration_blocks` (90-day linear) is recorded but **not modelled**. It affects
  when genesis tokens actually circulate, which is E.38 territory.
- The **year-1 anchor is a choice**, not a spec figure. It is adjustable and marked.

**A second process failure, and the more interesting one:** the first version of this report
dismissed a real contradiction because my reconcile reads text and the claim was in an image. I
reached the right conclusion about the *current* sources by luck of timing, not by method — the
live graphic happens to agree with Appendix A. Image assets are now in the source hierarchy with
a pinned hash and an explicit instruction to look at them.

**Process, stated plainly:** this tool published a wrong divisor on a public site for roughly one
day. Not a rounding error — 16.9% on the headline figure. It was caught by an exhaustive diff, not
by the spot-check that preceded it, and the exhaustive diff is now the method.

---

*Sources: yellow paper 0.5.0 (`flop-labs/yellowpaper`), `flop.finance/intro/revenue/`,
`flop.finance/teaser/`, and the eight pages in `flop.finance/sitemap.xml`. Community threads and
graphics were not used as sources.*
