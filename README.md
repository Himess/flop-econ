# FLOP validator & agent economics

Two tools for the FLOP Network roles that have no economic tooling from anyone, including the
protocol team:

- **Validator break-even** — pool share, audit income, the slashing ladder with time-to-recover,
  queue cost, and the audit pool's solvency floor.
- **Agent escrow risk** — a close-path outcome matrix. Not a cost calculator.

**Miner economics are not built here.** FLOP publishes its own calculator at
[flop.finance/intro/revenue/](https://flop.finance/intro/revenue/), with a live GPU-rental cost
basis and a measured hardware anchor. This complements it; it does not compete with it.

## The design principle

Large parts of FLOP's economics are not ratified, and the published product pages lead — and in
places contradict — the normative spec. So the differentiator here is not accuracy. It is
**provenance**.

Three rules, enforced by tests rather than by discipline:

1. **Every displayed figure carries a bucket and a citation.** `DEFINED` (a number or formula the
   spec fixes), `PLANNED` (named but deferred or unwired), `ABSENT` (the spec has no value). The
   `Stat` component cannot render a number without also rendering its provenance.
2. **The tool refuses to compute when an `ABSENT` input has not been supplied.** No silent
   defaults. An empty field returns a `Blocked` result naming the E-item that blocks it. Supplying
   one downgrades the result's bucket to `ABSENT` and records the assumption in the drawer.
3. **No market claims.** Session price, FLOP price and network demand are user inputs with no
   suggested value. The spec has no view on them and neither does this.

## Layout

```
params.yaml                  the parameter set with provenance — a deliverable in its own right
  └─ scripts/gen-params.ts   generates ↓ ; validates the bucket rules at generation time
model/params.generated.ts    typed, exhaustive; no runtime YAML, works in Node and the browser
model/{types,emission,validator,agent}.ts    pure functions, no React
model/model.test.ts          56 tests
app/                         Next.js UI
```

Every constant in `model/` and `app/` traces to a `params.yaml` entry. A test asserts the
generated file is in sync with the YAML by sha256, so the two cannot drift.

## Running it

```bash
npm install
npm run gen:params   # regenerate after editing params.yaml
npm test             # 56 tests
npm run dev
```

## What the tests pin

- Conservation: `P + (1−φ)(E−P) + φ(E−P) = E` for arbitrary inputs and across every resolved
  close path.
- The **42,236 FLOP/yr** validator cost anchor reproduces from *both* committee-cap points the
  spec discloses in §2.2 (~112 validators at the 1.5 FLOP floor, ~224 at 3 FLOP). The identity
  across two independent pool sizes is what shows the paper divided a pool by a fixed cost.
- The **audit-pool solvency floor** at ~5 FLOP per audited turn, derived from the three enforced
  parameters rather than hardcoded.
- Emission: five halvings then a permanent 3 FLOP floor; role splits sum to 1000 ppt; the subsidy
  total reproduces the spec's 1,955,232,000 FLOP figure.
- No function returns a number when a required `ABSENT` input is missing.
- `ABSENT` parameters carry no value; `DEFINED` ones do; reading an `ABSENT` one throws.

## Two findings the model surfaces

**The 1.1× finality-committee premium is worth nothing to an average validator.** The committee is
resampled every epoch (R15.4a), so annual income depends on the seating *rate*, not a snapshot. At
the set-average rate the premium cancels exactly — it is a redistribution toward validators seated
more often than average, which under stake-weighted sampling means larger stakes. A snapshot model
hides this; the test `the premium cancels exactly for a validator seated at the set average` pins
it.

**The audit pool has a price floor.** Inflow is 1% of the miner's settlement
(`audit_fee_split_ppm`); outflow is a flat 1 FLOP per verdict (`audit_fee_per_turn`) at a 5%
sampling rate (`sampled_audit_alpha_ppm`). Break-even is **≥ 5 FLOP per audited turn**. Below it
the pool that funds Tier-3 enforcement cannot pay for its own audits — and `audit_fee_per_turn` is
explicitly *"gated on … pool solvency"*, so payment simply stops. `audit_quantum_gn` and
`high_value_gn_threshold` force additional audits on top, which only worsens the ratio.

## Provenance of the parameter set

`params.yaml` mirrors the economic subset of the yellow paper's Appendix A, which the spec states
is generated from `params/flop-protocol-params.yaml` and gated by `scripts/check_params.py`. The
spec's own precedence rule governs: *"Concrete figures appearing inline are worked examples; the
value of record is always Appendix A."*

The file also carries a `disagreements` section recording every place a downstream FLOP source
leads or contradicts the spec — the genesis-supply fork (2,483,460,000 vs. 3,500,000,000, issue
#1418), the 85/15 vs. 99/1 fee split (#1352), the mempool framing on `/intro/agent/` versus §15.6,
the ratified-vs-running rotation rank, the active-set cap (E.41), the testnet unlock (E.38), and
validator reward liquidity (E.39). The UI renders all seven in the assumptions drawer.

## Caveat

The yellow paper is a **Draft** on roughly a weekly cadence. This inventory is current as of the
`fetched` date in `params.yaml`; re-fetch and diff before trusting it. Per §0, nothing here is a
claim about running code — the spec *"describes the protocol FLOP targets, not a snapshot of the
codebase."*

Not financial advice. Not a forecast.
