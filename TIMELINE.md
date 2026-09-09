# Cash-flow timeline and lock modelling

Prepared 2026-09-09 against the yellow paper at `flop.finance/intro/yellowpaper/`, unchanged since
the parameter set was built.

---

## 1. Payback correction — the finding, first

**The old payback figure was wrong, and it was wrong in the direction that flatters.** At the
shipped worked example it said **4.88 months**. Under the liquidity behaviour the specification
actually describes, cash payback **does not arrive within 36 months at all**.

### What the old figure did

```ts
payback = (hardwareUsd / netUsdPerYear) × 12
```

Hardware cost divided by *nominal* annual net, with no lock awareness of any kind. It answered
"how many months of income equal the hardware cost", which would be right if income were spendable.
Under E.39's current behaviour it is not: the validator block-reward leg is *"auto-compounded into
locked stake"* (§9 table, Appendix D, D-0408). The old figure reported a month at which nothing had
been recovered in cash.

### At the worked example

Validator staking 1.2× the baseline minimum in the wired 200-set, $300M valuation anchored to
year 1 (⇒ $0.049871/FLOP), $30,000 hardware, $499/month in electricity and hosting:

| | accounting payback | cash payback | gap |
|---|---|---|---|
| **auto-compounded into locked stake** (current, D-0408) | 5 months | **never within 36 months** | — |
| **0% reward lock** (workbook target) | 5 months | 5 months | 0 |
| *old figure, lock-unaware* | *4.88 months* | *—* | *—* |

Over 36 months that position earns **4,556,184 FLOP** and can withdraw **15,000** of it — 0.3%. The
remaining **4,541,184 FLOP** is stake, not income.

The 15,000 is audit income: `claim_audit_fee` is a fee a validator claims, not a pool distribution
swept into stake, and E.39 scopes itself to *"validator block-reward earnings"*. So it stays
spendable. It is also the only thing that does.

### A correction inside the correction

My first implementation of the lock was also wrong, in a subtler way, and the test suite caught it
before the number reached the report. I modelled compounded reward as a tranche that matures after
unbonding — 21 days, so effectively liquid the following month. That produced a 1-month gap and a
reassuring picture.

It is not what auto-compounding means. The reward does not mature; it **becomes stake**. There is
no waiting period after which it turns into a spendable balance. The only way to realise it is to
leave the active set, and unbonding then runs 21 days from when the last open session, dispute or
audit closes — not from when you ask. While you keep validating, that income is not spendable at
all, at any horizon.

The model now reflects that: with no exit modelled, nothing from the block-reward leg is ever
released. A `stop validating at` input lets the user see the release land, and the tests pin both
behaviours.

---

## 2. Timing inventory

| Rule | Bucket | Value | Citation |
|---|---|---|---|
| Validator unbonding | `DEFINED` | 21 days (1,814,400 blocks) | Appendix A; §13; §15.7; D-0419 |
| **Slash-lock on unbonding** | `DEFINED` | frozen while any session, dispute or audit is open | §15.7; §13.1 (M11); D-0419 |
| Ejection cooldown | `DEFINED` | 7 days (604,800 blocks) | Appendix A; §15.5 |
| Miner unbonding | `DEFINED` | 7 days | Appendix A; §6.1 |
| Halving interval | `DEFINED` | 63,072,000 blocks ≈ 730 days | Appendix A; §9 |
| Reward liquidity | `PLANNED` | unresolved, binary | E.39 [RATIFY]; D-0408; #1356 |
| Reservation slot release | `DEFINED` | on settle, expire, timeout or fraud | R12.2 |
| `force_open` ack window | `DEFINED` | 600 blocks (10 min) | Appendix A; §12.1; App. C.3 |
| Session dispute window | `DEFINED` | 604,800 blocks (7 days) | Appendix A; §12.1; D-0403 |
| Settlement turn cap | `DEFINED` | 1,024 per bundle | Appendix A; §12.1 |
| **Validator bond lock** | **`ABSENT`** | — | **not in the yellow paper** |
| Network stake growth | `ABSENT` | — | no spec view on other validators |
| 3:1 spend-to-unlock | `ABSENT` | — | E.38; product page only |

### The bond lock is not normative

Community reporting says the testnet top-1000 receive their bond free, locked 24 months. I searched
the yellow paper for **"24 month"**, **"24-month"**, **"two year"**, **"bonded stake"** and
**"locked 24"**: **zero hits**. E.38 states the path distributing `genesis_supply` *"has no
normative section"* and lists *"what the validator cohort converts on"* as open.

So it is a user input with a dotted mark, defaulting to blank — never a default wearing a spec
badge. The timeline honours it when supplied: a bond lock longer than the exit defers every release
past it.

### The slash-lock is the rule most easily missed

The 21 days is not a countdown you start. M11: *"unbonding frozen while any session/dispute open
(slash-lock); unlock cooldown runs after last closes"*. §1.2's reading rule states the principle
generally — *"stake outlives disputes"*. Real time-to-cash is 21 days **after your last open item
clears**, which the panel says in place.

---

## 3. What the timeline computes

Month by month over a user-set horizon, defaulting to 36 so a two-year lock sits inside the view.

```
earned(m)  = blockRewardIncome(stake(m), era(m))/12 + auditIncome/12
locked(m)  = blockRewardIncome leg, under "auto-compounded"; 0 under "0% lock"
liquid(m)  = earned(m) − locked(m) + anything released this month
stake(m+1) = stake(m) + locked(m)          // compounding, under "auto-compounded"
```

Release happens only on exit: `ceil(max(exitMonth + 21 days, bondLock + 21 days))`. With no exit,
nothing releases.

**Era boundaries land in the right month** because the reward is read per month from block height,
not assumed flat. A 36-month horizon crosses one halving at **month 25** (730 days is a shade over
24 months); a 60-month horizon crosses two. Tests assert both counts and the month.

**Costs run on their own clock and in fiat.** Hardware is charged once in month one — not smeared
through an amortisation line, which would understate the early cash hole. Electricity and hosting
are monthly.

### The compounding feedback loop — real, and it nets to zero at the average

You asked whether the annual figure flattens a loop. It does not, and the reason is worth stating,
because it is the same shape as the committee-premium finding.

Compounded reward raises your stake, and pool share is pro-rata by stake — so mechanically the loop
exists. But **the validator pool is fixed by emission, not by total stake**: it is 10% of the block
reward whatever the set holds. If every validator compounds at the same rate, everyone's stake grows
by the same factor and the share is *unchanged*. Compounding at the set average redistributes
nothing.

The loop only pays if you compound faster than the network — and the spec has no view on what other
validators do, so `network_stake_growth_rate` is `ABSENT` and exposed as an input. The default holds
the network in step, which is the neutral assumption, and the tests assert monthly earnings are flat
within an era under it and rising when the network does not keep pace.

So: the annual figure was not hiding compounding growth. It was hiding the **lock**.

---

## 4. E.39 scenario comparison

Both rendered together throughout — headline, payback pair, and two charts. Neither is picked
silently, and both carry a `PLANNED` mark because E.39 is unresolved.

At the worked example, 36-month horizon, no exit:

| | auto-compounded (D-0408, current) | 0% reward lock (workbook) |
|---|---|---|
| Cumulative earned | 4,556,184 FLOP | 4,556,184 FLOP |
| Cumulative withdrawable | **15,000 FLOP** | **4,556,184 FLOP** |
| Still locked at month 36 | 4,541,184 FLOP | 0 |
| Accounting payback | 5 months | 5 months |
| Cash payback | **never within 36 months** | 5 months |

The two sides are identical on paper and 300× apart in cash. That is the entire argument for
refusing to pick one.

With `stop validating at month 12` supplied, cash payback under auto-compound lands at **month 13** —
the exit plus 21 days. Adding a 24-month bond lock pushes it to **month 25**.

---

## 5. Presentation

- The section leads with the constraint, in the register asked for: *you are profitable on paper
  from month 5, and your hardware is recovered in cash not at all within 36 months.*
- One chart per scenario: cumulative earned, cumulative withdrawable, cumulative cost. Flat lines,
  no gradient, no area fill. **Distinguished by dash pattern as well as colour** — solid for
  withdrawable, dashed for earned, dotted for cost — matching the bucket marks' convention so the
  chart survives greyscale.
- Halving boundaries are drawn as vertical rules with a label, so the step in the earned line has a
  visible cause.
- The fixed-price warning sits directly under the charts, not in a footnote: every dollar figure
  uses one price for every month, a token locked for two years will not be worth today's assumption
  when it unlocks, and the tool does not model a price path. FLOP quantities are given alongside so
  the reader can separate what is owed from what it is guessed to be worth.

---

## 6. What I could not do honestly

**No price path, by instruction and by conviction.** Modelling how the token moves over 36 months
would be the single least defensible thing in the tool — and it would hide the exposure rather than
reveal it. Stated in place instead.

**The bond lock stays an input.** Nothing normative fixes it. Defaulting it to 24 months would put a
community rumour behind a spec-shaped number, which is the failure mode the whole project exists to
avoid.

**Agent-side timing is thin, and deliberately not padded out.** Escrow slot release is event-driven,
not clock-driven — R12.2 frees a slot *"on settle/expire/timeout/fraud"*, and the spec fixes no
duration for a session. The only real clocks are the 10-minute `force_open` ack window and the
7-day dispute window, both already on the Agent tab. There is no honest month-by-month agent
timeline to build, so I did not build one.

**Delegator reward timing is absent.** Delegation exists (min 100 FLOP, ≤4× leverage) but nothing
states when a delegator's share is distributed or whether it inherits E.39's lock. Not modelled.

**One caveat that is not a limitation but should be read as one.** The timeline draws its FLOP
revenue from the validator model, whose cost side still rests on two `ABSENT` inputs (DA volume,
E.47; GPU backend, no sizing anywhere). The *shape* of the earned/locked/liquid split is
spec-grounded; the dollar magnitudes inherit whatever the user assumed. The marks and the ledger
say which is which on every figure.
