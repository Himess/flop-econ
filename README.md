# flop-econ

**A machine-readable FLOP Network economic parameter set, with provenance — and two calculators
built on top of it.**

[`params.yaml`](params.yaml) is the substantial half of this repository. It mirrors the economic
subset of the FLOP yellow paper's Appendix A, and every entry carries three things the paper's own
table does not put together in one place:

- a **bucket** — `DEFINED` (the specification fixes a value), `PLANNED` (named but deferred,
  unwired, or awaiting ratification), or `ABSENT` (the model needs it and the specification has
  not got it);
- a **citation** — the §, R-number, E-item or D-id it resolves to;
- a **note** saying what the value actually governs, and what it does not.

`ABSENT` entries carry **no value at all**. They carry the open item that blocks them. That is the
whole point: 13 of the 96 parameters an economic model of FLOP needs do not exist yet, and a tool
that quietly defaults them is worse than no tool.

The file also records **seven places where FLOP's own published pages lead or contradict the
normative specification** — the genesis-supply fork (2,483,460,000 against 3,500,000,000, issue
#1418), the 85/15 against 99/1 fee split (#1352), the mempool framing on `/intro/agent/` against
§15.6, the ratified-against-running rotation rank, the active-set cap (E.41), the testnet unlock
(E.38), and validator reward liquidity (E.39). None are errors. Each one changes what a model
should compute.

## The calculators

Two roles have no economic tooling from anyone, FLOP included:

- **Validator break-even** — pool share under R9.5, audit income, the slashing ladder with
  time-to-recover, queue cost, and the audit pool's solvency floor.
- **Agent escrow risk** — a close-path outcome matrix. Not a cost calculator.

**Miner economics are not built here.** FLOP publishes its own calculator at
[flop.finance/intro/revenue/](https://flop.finance/intro/revenue/), with a live GPU-rental cost
basis and a measured hardware anchor. This complements it; it does not compete with it.

## Three rules, enforced by tests

1. **Every displayed figure carries a bucket and a citation.** Marks are encoded by colour *and*
   line treatment — solid, dashed, dotted — so they survive greyscale and colour-blindness.
2. **The tool refuses to compute when an `ABSENT` input has not been supplied.** It lands on a
   worked example so nobody meets a dead page, but clearing a required field is a deliberate act
   and refusal is the right answer to it. Blocked states name the fix first and the citation
   second.
3. **No market claims.** Session price, token price and network demand are inputs with no
   suggested value. The specification has no view on them and neither does this.

## Layout

```
params.yaml                  the parameter set — the deliverable
  └─ scripts/gen-params.ts   generates ↓, and rejects an ABSENT entry that carries a value
model/params.generated.ts    typed and exhaustive; no runtime YAML, works in Node and the browser
model/{types,emission,validator,agent}.ts    pure functions, no React
model/*.test.ts              68 tests
app/                         Next.js UI
```

Every constant in `model/` and `app/` traces to a `params.yaml` entry. One test pins the YAML's
sha256 into the generated module so the two cannot drift; another fails the build on a protocol
constant typed into a component.

## Running it

```bash
npm install
npm run gen:params   # after editing params.yaml
npm test             # 68 tests
npm run dev
```

## What the tests pin

- Conservation: `P + (1−φ)(E−P) + φ(E−P) = E` for arbitrary inputs and across every resolved close
  path.
- The **42,236 FLOP/yr** validator cost anchor reproduces from *both* committee-cap points §2.2
  discloses (~112 validators at the 1.5 FLOP floor, ~224 at 3 FLOP). The identity across two
  independent pool sizes is what shows the paper divided a pool by a fixed cost.
- The **audit-pool solvency floor** at ~5 FLOP per audited turn, derived from three enforced
  parameters rather than hardcoded.
- Emission: five halvings then a permanent floor; role splits sum to 1000 ppt; the subsidy total
  reproduces the specification's 1,955,232,000 FLOP figure.
- No function returns a number when a required `ABSENT` input is missing.
- No `toLocaleString()` call anywhere omits its locale.

## Two findings the model surfaces

**The 1.1× finality-committee premium is worth nothing to an average validator.** The committee is
resampled every epoch (R15.4a), so annual income tracks the seating *rate*, not a snapshot. At the
set-average rate the premium cancels exactly — it redistributes toward validators seated more often
than average, which under stake-weighted sampling means larger stakes. A snapshot model hides this.

**The audit pool has a price floor.** Inflow is 1% of the miner's settlement
(`audit_fee_split_ppm`); outflow is a flat 1 FLOP per verdict (`audit_fee_per_turn`) at a 5%
sampling rate (`sampled_audit_alpha_ppm`). Break-even is **≥ 5 FLOP per audited turn**. Below it,
the pool funding Tier-3 enforcement cannot pay for its own audits — and `audit_fee_per_turn` is
explicitly *"gated on … pool solvency"*, so payment simply stops.

## Provenance and caveat

The yellow paper states its own precedence rule and this repository follows it: *"Concrete figures
appearing inline are worked examples; the value of record is always Appendix A."*

It is a **Draft** on roughly a weekly cadence. The inventory is current as of the `fetched` date in
`params.yaml`; re-fetch and diff before trusting it. Per §0, nothing here is a claim about running
code — the specification *"describes the protocol FLOP targets, not a snapshot of the codebase."*

Not financial advice. Not a forecast.
