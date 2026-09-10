# flop-econ

**A machine-readable FLOP Network economic parameter set, with provenance — and two calculators
built on top of it.**

**Live: [flop-econ.vercel.app](https://flop-econ.vercel.app)** · [how each figure is
calculated](https://flop-econ.vercel.app/docs)

Verified against the yellow paper **0.5.0 (draft)** — the initial public release,
[flop-labs/yellowpaper](https://github.com/flop-labs/yellowpaper) — fetched 2026-09-10.

[`params.yaml`](params.yaml) is the substantial half of this repository. It mirrors the economic
subset of the FLOP yellow paper's Appendix A, and every entry carries three things the paper's own
table does not put together in one place:

- a **bucket** — `DEFINED` (the specification fixes a value), `PLANNED` (named but deferred,
  unwired, or awaiting ratification), or `ABSENT` (the model needs it and the specification has
  not got it);
- a **citation** — the §, R-number, E-item or D-id it resolves to;
- a **note** saying what the value actually governs, and what it does not.

`ABSENT` entries carry **no value at all**. They carry the open item that blocks them. That is the
whole point: **19 of the 128 parameters** an economic model of FLOP needs do not exist yet
(94 `DEFINED`, 15 `PLANNED`, 19 `ABSENT`), and a tool that quietly defaults them is worse than no
tool.

The file also records **nine places where sources disagree** — the genesis-supply fork
(resolved 2026-09-10 by D-0438 in favour of 3,500,000,000, issue #1418), the 85/15 against 99/1 fee split (#1352), the
mempool framing on `/intro/agent/` against §15.6, the ratified-against-running rotation rank, the
active-set cap (E.41), the testnet unlock (E.38), validator reward liquidity (E.39), the
**live and unresolved** tokenomics-graphic fork, and the `v0_5_0_rebase` entry below.

Only that eighth one is open: a FLOP tokenomics graphic dated 2026-09-10 puts the validator
airdrop at 1.20bn and total year-10 supply at 18.1bn, against Appendix A's 305,505,000 and
17,186,624,000. The difference is exactly the validator line. When this was checked,
flop.finance was still serving the *older* graphic from origin, so FLOP's own surfaces disagree
with each other.

`params.yaml` keeps Appendix A as its value of record and carries 4.4bn beside it as a `PLANNED`
alternative — exactly as 3,500,000,000 was carried before D-0438 ratified it 19 days later. **The
calculator goes the other way, deliberately:** its headline break-even divides by the announced
4.4bn, says `announced genesis` on the figure itself, and prints the Appendix A break-even in the
panel below it. On the shipped example those are **$65,034,029** and **$57,655,008** — a 12.8%
gap, and the reason both are on screen. Nothing computed from the announced figure can read
`DEFINED`.

None of the other eight are errors. Each one changes what a model should compute.

## The rebase, recorded rather than hidden

This tool was first built against a pre-publication draft. When the yellow paper was published as
0.5.0 I re-verified all 29 quoted claims against the released text before making anything public:
**26 unchanged, 3 reversed** — and the three were load-bearing.

- §15.1 now reads *"A validator function **MUST NOT** require executing inference, producing PoUI
  proofs, or owning a GPU or TEE"*. The superseded draft said a production validator *"co-locates
  or delegates to a calibrated miner backend"*.
- **R15.4c is new** and decides it: the committee recency signal *"MUST be refreshed only by an
  on-chain accepted verification duty"*, and *"Prover credit (`OnProofVerified`) MUST NOT refresh
  it."* The one thing the old gate required is the one thing that no longer counts.
- *"The two heavy legs"* became *"The one heavy leg is DA storage/serving; no validator duty
  requires a GPU or TEE"*, and a SHOULD-level reference profile appeared — 8 cores ≥3.4 GHz SMT
  off, 32 GB ECC, 4 TB enterprise NVMe, 1 Gbps symmetric unmetered.

Two findings built on the old reading were **withdrawn**, not edited, and one finding replaced
them. A finding the published specification contradicts is worse than no finding. The change is
carried as the `v0_5_0_rebase` disagreement so it is visible in the data, not just in the history.

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
model/*.test.ts              163 tests
app/                         Next.js UI
```

Every constant in `model/` and `app/` traces to a `params.yaml` entry. One test pins the YAML's
sha256 into the generated module so the two cannot drift; another fails the build on a protocol
constant typed into a component.

## Running it

```bash
npm install
npm run gen:params   # after editing params.yaml
npm test             # 163 tests
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

## Findings the model surfaces

**The 1.1× finality-committee premium is worth nothing to an average validator.** The committee is
resampled every epoch (R15.4a), so annual income tracks the seating *rate*, not a snapshot. At the
set-average rate the premium cancels exactly — it redistributes toward validators seated more often
than average, which under stake-weighted sampling means larger stakes. A snapshot model hides this.

**The audit pool has a price floor.** Inflow is 1% of the miner's settlement
(`audit_fee_split_ppm`); outflow is a flat 1 FLOP per verdict (`audit_fee_per_turn`) at a 5%
sampling rate (`sampled_audit_alpha_ppm`). Break-even is **≥ 5 FLOP per audited turn**. Below it,
the pool funding Tier-3 enforcement cannot pay for its own audits — and `audit_fee_per_turn` is
explicitly *"gated on … pool solvency"*, so payment simply stops.

**A validator needs no GPU, at `MUST NOT` strength.** See the rebase section above. The cost of
running one is a node, a link and a stake.

**The DA storage duty is a rounding error, and §15.3 calls it the one heavy leg.** Derived from the
specification's own byte rules — a `VerifiedTurn` at `269 + compact_len(L) + 33L` B (App. F.3), a
mandatory TOPLOC commitment at ~258 B per 32 tokens (§3.4), 14-day ephemeral retention, rate-½
erasure coding onto a stake-weighted subset — one validator holds **0.12 GB** at 5,000 sessions a
day and ~23 GB at a million. Cents to a few dollars a year. The R=6 subset size is never stated and
does not need to be: it cancels. Whatever is heavy about the leg is the bandwidth, which E.47
leaves open.

**Profitable is not the same as paid.** Under E.39's current behaviour the block-reward leg is
swept into stake rather than becoming spendable, so a validator can be profitable on paper from
month 5 and still have nothing withdrawable at month 36.

## The DID this repository is bound to

    did:key:z6MknZR82Hspszghsb5SEYSu3HZFpSVnYjpLwv7zX2FroeRK

[`DID.json`](DID.json) carries a signature over a statement naming this repository and the commit
it was made at. Verify it from a clone — no private key is needed, and none is in here:

```bash
node tools/technocore-did.mjs verify bind "$(node -p 'require("./DID.json").nonce')" "$(node -p 'require("./DID.json").signature')" $(node -p 'require("./DID.json").statement')
```

Be exact about what that proves. A `did:key` signature proves **possession of a key** — not
identity, not honesty, not authorship. The Technocore DID note proves less still. It is
world-writable: signed writes exist for `room-owners` and `room-allow` and, in the service's own
words, "nowhere else", and the note's path is derived from the DID by a published rule, so anyone
holding a DID can compute where its note lives and write over it. Nor does it last —
*"Rooms and notes with no write for 7 days are deleted."*

What carries weight is the pair. The commit is timestamped and belongs to an account; the
signature inside it names the repository and that commit. Forging the pair after the fact means
rewriting a public git history. Neither half is evidence alone, and the durable half is this one.

## Provenance and caveat

The yellow paper states its own precedence rule and this repository follows it: *"Concrete figures
appearing inline are worked examples; the value of record is always Appendix A."*

It is a **draft**, and it moves. Three of this tool's claims were overturned by a single release.
The inventory is current as of the `fetched` date in `params.yaml` and the site carries the same
stamp in its masthead; re-fetch and diff before trusting either. Per §0, nothing here is a claim
about running code — the specification *"describes the protocol FLOP targets, not a snapshot of the
codebase."*

The yellow paper itself is not vendored here. `params.yaml` records the upstream source, the
release and the sha256 of the fetch it was built from; get the paper from
[flop-labs/yellowpaper](https://github.com/flop-labs/yellowpaper).

Not financial advice. Not a forecast.
