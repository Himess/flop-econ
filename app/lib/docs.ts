/**
 * The anchor registry that binds the tool to the documentation.
 *
 * The split this file exists to serve: the tool answers, the documentation explains. Every
 * provenance mark on the tool page is a link into `/docs`, so the traceability claim survives
 * while the wall of text does not.
 *
 * A mark with no destination is a regression, so the ids live here rather than being typed at each
 * call site, and `model/docs.test.ts` asserts every id the tool references is one the docs page
 * actually renders.
 */
import { PARAMS, type Param } from "@/model/params.generated";

export const DOCS_PATH = "/docs";

/** Every anchor the documentation page defines. */
export const ANCHORS = {
  // how each figure is calculated
  blockReward: "calc-block-reward",
  committeePremium: "calc-committee-premium",
  auditIncome: "calc-audit-income",
  operatingCost: "calc-operating-cost",
  net: "calc-net",
  seatRate: "calc-seat-rate",
  slashing: "calc-slashing",
  queue: "calc-queue",
  solvency: "calc-solvency",
  emission: "calc-emission",
  supply: "calc-supply",
  price: "calc-price",
  breakEvenValuation: "calc-breakeven-valuation",
  breakEvenPrice: "calc-breakeven-price",
  cashPayback: "calc-cash-payback",
  accountingPayback: "calc-accounting-payback",
  fixedPrice: "calc-fixed-price",
  tariff: "calc-tariff",
  closePaths: "calc-close-paths",
  overReservation: "calc-over-reservation",
  reservations: "calc-reservations",
  dispute: "calc-dispute",
  // reference sections
  params: "parameters",
  disagreements: "disagreements",
  findings: "findings",
  limits: "limits",
} as const;

export type AnchorId = (typeof ANCHORS)[keyof typeof ANCHORS];

export const href = (a: AnchorId) => `${DOCS_PATH}#${a}`;

/** Per-parameter anchor, so the parameter table is deep-linkable too. */
export const paramAnchor = (key: string) => `p-${key}`;
export const paramHref = (key: string) => `${DOCS_PATH}#${paramAnchor(key)}`;

/**
 * The parameter table the docs page renders.
 *
 * Sourced from the generated module, which is itself generated from params.yaml with its sha256
 * pinned by a test — so the table cannot drift from the file that defines it.
 */
export function paramRows(): readonly Param[] {
  return PARAMS;
}

/** How each figure is calculated. Rendered by the docs page; ids are the link targets. */
export interface CalcEntry {
  id: AnchorId;
  title: string;
  role: "validator" | "agent" | "shared";
  formula?: string;
  body: string;
  cites: string;
}

export const CALCS: readonly CalcEntry[] = [
  {
    id: ANCHORS.blockReward,
    title: "Block-reward pool share",
    role: "validator",
    formula:
      "share = stake × (p·1.1 + (1−p)) ÷ [ networkStake × (p̄·1.1 + (1−p̄)) ]\nincome = validatorPool(era) × share",
    body: "R9.5 splits the validator pool by stake, with a 1.1× weight for validators seated on the finality committee. The committee is resampled every epoch (R15.4a), so annual income depends on the rate at which you are seated (p) against the set average (p̄), not on whether you happen to be seated right now. The pool itself is 10% of the block reward for that era.",
    cites: "R9.5 · R15.4a · Appendix A",
  },
  {
    id: ANCHORS.committeePremium,
    title: "Finality-committee premium",
    role: "validator",
    formula: "premium = income(at your seat rate) − income(at the set-average seat rate)",
    body: "Worth exactly zero to a validator seated at the set average, by construction. See the findings section — this is one of the four things this work established.",
    cites: "R9.5 · R15.4a",
  },
  {
    id: ANCHORS.auditIncome,
    title: "Audit income",
    role: "validator",
    formula: "income = auditFeePerTurn × verdicts claimed per year",
    body: "A flat 1 FLOP per audit verdict, claimed by a VRF-assigned validator through claim_audit_fee, and gated on the audit pool being solvent. It is a claimed fee rather than a pool distribution, which is why E.39's reward lock does not apply to it — this is the only validator income that stays liquid under the current behaviour.",
    cites: "audit_fee_per_turn · §12.1 · D-0403",
  },
  {
    id: ANCHORS.operatingCost,
    title: "Operating cost",
    role: "validator",
    formula: "cost = electricity × kW × 8,760 + hardware ÷ amortMonths × 12 + hosting × 12",
    body: "Every term is yours; the specification fixes none of them. It states no hardware minimums at all — §15.3 gives qualitative intensities only, naming DA storage-and-serving and the committee-keeping GPU work as the two heavy legs. The tool refuses to compute a net figure until both are supplied rather than defaulting them.",
    cites: "§15.3 · E.47 · your assumptions",
  },
  {
    id: ANCHORS.net,
    title: "Net per year",
    role: "validator",
    formula: "net = (blockReward + audit) × price − operatingCost",
    body: "FLOP income converted at one assumed price, less your dollar costs. The FLOP side is spec-grounded; the price and the costs are not, so the result always carries an assumed mark.",
    cites: "R9.5 · your assumptions",
  },
  {
    id: ANCHORS.seatRate,
    title: "Committee seat rate",
    role: "validator",
    formula: "p ≈ min(1, committeeSize × stake ÷ networkStake)",
    body: "R15.4a fixes the mechanism — 100 members sampled stake-weighted without replacement off a BABE-VRF seed — but not a closed form for one validator's inclusion probability. E.42 states the exact analysis is open, noting there is no aggregate-stake/binomial bridge for unequal weights. This is the first-order approximation: exact at the set average, degrading as one stake approaches a large share of the total. It is marked planned, never defined, and can be overridden.",
    cites: "R15.4a · E.42 · #848",
  },
  {
    id: ANCHORS.slashing,
    title: "Slashing ladder",
    role: "validator",
    formula: "recoveryDays = permanentLoss ÷ netPerYear × 365 + daysOutOfSet",
    body: "Six offences plus the DA serve-or-slash path, which sits outside the §11.3 table. Bar length tracks recovery time, the quantity the section is about; severity is carried by the percentage in the label and the colour. Lone equivocation burns nothing permanently — half is withheld and returned after 180 days — so a 50% headline recovers faster than a 5% one. The fraud class is terminal: eject plus blacklist, no recovery path to compute.",
    cites: "§11.3 · R5.3b · D-0409 · D-0420",
  },
  {
    id: ANCHORS.queue,
    title: "Queue cost",
    role: "validator",
    formula: "forgone = blockRewardIncome × daysQueued ÷ 365",
    body: "Registering freezes the account's full reducible balance as self-stake and admits to ValidatorQueue, not the active set. Queued validators are not finality-eligible and earn no validator-leg reward, and promotion waits on a free slot behind a cap that is ratified at 1,000 but wired at 200.",
    cites: "§15.2 · R15.5b · E.41",
  },
  {
    id: ANCHORS.solvency,
    title: "Audit-pool solvency floor",
    role: "validator",
    formula: "breakEvenPerTurn = (α × auditFeePerTurn) ÷ auditFeeSplit = (0.05 × 1) ÷ 0.01 = 5 FLOP",
    body: "Inflow is 1% of each settlement; outflow is a flat fee per audited turn at the default 5% sampling rate. Below roughly 5 FLOP per audited turn the pool cannot fund its own audits, and payment is explicitly gated on pool solvency. See the findings section.",
    cites: "audit_fee_split_ppm · audit_fee_per_turn · sampled_audit_alpha_ppm · §3.5",
  },
  {
    id: ANCHORS.emission,
    title: "Emission schedule",
    role: "shared",
    formula: "reward(era) = era ≥ 5 ? 3 : 96 ÷ 2^era      halving every 63,072,000 blocks",
    body: "96 FLOP halving five times to a permanent floor of 3, at a one-second block interval. Every emission total the specification states in prose reproduces exactly from these rows: the subsidy total of 1,955,232,000, cumulative emission through era 5 of 11,920,608,000, and the floor annual emission of 94,608,000. A separate test pins all of them.",
    cites: "R9.2 · R9.3 · Appendix A · D-0436",
  },
  {
    id: ANCHORS.supply,
    title: "Outstanding supply",
    role: "shared",
    formula: "outstanding(t) = genesis + Σ (blockReward + subsidy) × blocks in each era up to t",
    body: "Both the reward and the subsidy mint, so both dilute. Integrated era by era, because a horizon crossing a halving would otherwise be wrong by up to a factor of two. This is outstanding supply, not circulating: E.38 states the path distributing the genesis supply has no normative section, so a circulating figure would be invented rather than derived.",
    cites: "R9.2 · R9.3 · E.38",
  },
  {
    id: ANCHORS.price,
    title: "Token price",
    role: "shared",
    formula: "valuation mode: price = valuation ÷ outstanding(anchorYear)\ndirect mode: price entered",
    body: "FLOP has no maximum supply — after five halvings the reward holds at 3 in perpetuity — so there is no fully-diluted point to anchor on, and the anchor year is explicit and adjustable. The tool always computes both genesis scenarios: the specification ratifies 2,483,460,000 while the workbook behind FLOP's own calculator uses 3,500,000,000, with no ratifying decision. The two are about 41% apart at genesis, but era-0 issuance exceeds genesis itself, so the gap narrows to roughly 17% by year one and less after that.",
    cites: "genesis_supply · #1418 · your assumption",
  },
  {
    id: ANCHORS.breakEvenValuation,
    title: "Break-even valuation",
    role: "validator",
    formula: "breakEvenValuation = breakEvenPrice × outstanding(anchorYear)",
    body: "The valuation FLOP must reach for this position to cover its costs. Unlike a forward projection it carries no view on where the market goes, which is why the tool leads with it. It differs between the two genesis scenarios because it multiplies by a supply they disagree about — that is where the unratified figure stops being a footnote and moves your own threshold.",
    cites: "#1418 · your assumptions",
  },
  {
    id: ANCHORS.breakEvenPrice,
    title: "Break-even token price",
    role: "validator",
    formula: "breakEvenPrice = annualCost ÷ annualFlopEarned",
    body: "Identical under both genesis scenarios, because it depends only on your costs and the FLOP you earn. At exactly this price, net is zero — a test asserts the forward and reverse directions agree.",
    cites: "your assumptions",
  },
  {
    id: ANCHORS.accountingPayback,
    title: "Accounting payback",
    role: "validator",
    formula: "first month where cumulative earned ≥ cumulative cost",
    body: "What most mining calculators show. It counts income as it accrues, whether or not any of it can be withdrawn.",
    cites: "your assumptions",
  },
  {
    id: ANCHORS.cashPayback,
    title: "Cash payback",
    role: "validator",
    formula: "first month where cumulative withdrawable ≥ cumulative cost",
    body: "The one you can spend, and typically far later. Under E.39's current behaviour the validator block-reward leg is auto-compounded into locked stake — it does not mature after a waiting period, it becomes stake. Realising it means leaving the active set, and unbonding then runs 21 days from when the last open session, dispute or audit closes, not from when you ask. The distance between this and accounting payback is the single most important number the tool produces.",
    cites: "E.39 · D-0408 · M11 · §15.7",
  },
  {
    id: ANCHORS.fixedPrice,
    title: "The fixed-price assumption",
    role: "shared",
    body: "Every dollar figure on the timeline uses one price for every month. A token locked for two years will not be worth today's assumption when it unlocks. This tool does not model a price path and does not try to: that exposure is the risk the timeline reveals, not one it can resolve. Read the dollar lines as at today's assumed price, and the FLOP quantities as what is actually owed.",
    cites: "your assumption",
  },
  {
    id: ANCHORS.tariff,
    title: "The two-part tariff",
    role: "agent",
    formula: "P = BasePerTurn × n + rate_G × G_n     (both coefficients = 1 channel pay unit)",
    body: "R12.1d fixes both legs at one channel pay unit, so the tariff itself is fully defined — in channel pay units. What is not defined is what a channel pay unit is worth in FLOP; E.30 must ratify that relation, and escrow is denominated in FLOP. Comparing the two therefore takes a conversion the specification declines to supply, so the tool declines too.",
    cites: "R12.1d · E.30 · #588",
  },
  {
    id: ANCHORS.closePaths,
    title: "Close-path outcomes",
    role: "agent",
    formula: "conservation: P + (1−φ)(E−P) + φ(E−P) = E     φ = 20%",
    body: "Nine paths, each with a different outcome for the agent. Cooperative settle pays the reserved escrow in full with no refund even for a truncated answer, because there is no completion SLA. Non-delivery, an unacked force_open, an upheld fraud dispute and unrecoverable DA all refund fully. An ambiguous early close splits the unused remainder, burning a fifth of it. A Ghost-Task failure returns nothing to the agent. Model swap and selective serving have no refund path named at all.",
    cites: "R12.1a · R12.1d · R12.1f · R13.0c · M1 · M7 · M9 · D-0422",
  },
  {
    id: ANCHORS.overReservation,
    title: "Over-reservation",
    role: "agent",
    formula: "unused = E − P;   lost on cooperative settle = unused;   burned on ambiguous close = 0.20 × unused",
    body: "Escrow is the price, and under-use is never refunded. Reserving more than the session consumes is a pure loss on the path most sessions take. Reserving too little does not silently fail — R12.1e handles it by abort or in-place top_up_escrow, at the cost of another on-chain inclusion.",
    cites: "R12.1a · R12.1e · M9",
  },
  {
    id: ANCHORS.reservations,
    title: "Concurrent reservations",
    role: "agent",
    formula: "slots = 4 + floor(extraEscrow ÷ 50 FLOP)",
    body: "A base allowance of four concurrent reservations per agent identity, plus one more for every 50 FLOP escrowed. Slots free on settle, expiry, timeout or upheld fraud.",
    cites: "R12.2 · Appendix A",
  },
  {
    id: ANCHORS.dispute,
    title: "Disputes",
    role: "agent",
    formula: "bond = 100 FLOP",
    body: "Standing is restricted to the session agent for its own channel and any active validator for any channel; arbitrary public challengers are rejected before the bond locks. R3.5a makes the agent the standing challenger for its own channel, so this is a duty rather than only an option. What happens to the bond on a dispute that simply fails is not stated anywhere, so the tool models it as forfeited and labels that assumption conservative.",
    cites: "§12.1 · R12.1f · R3.5a",
  },
];

export const CALC_BY_ID = new Map(CALCS.map((c) => [c.id, c]));

/** The four things this work established. The most valuable page on the site. */
export interface Finding {
  id: string;
  title: string;
  claim: string;
  body: readonly string[];
  cites: string;
}

export const FINDINGS: readonly Finding[] = [
  {
    id: "f-committee-premium",
    title: "The finality-committee premium is worth nothing to an average validator",
    claim:
      "R9.5's 1.1× weight for committee members reads like free income for anyone seated. It is not. It cancels exactly at the set-average seat rate.",
    body: [
      "The committee is resampled every epoch — pallet_aleph snapshots it and exposes authorities() to finality-aleph — so a validator's annual income depends on the rate at which it is seated, not on whether it happens to be seated in any given epoch.",
      "Write the pool share with that rate in it and the premium divides out. Your weight is stake × (p·1.1 + (1−p)); the network's is networkStake × (p̄·1.1 + (1−p̄)). When p = p̄, the bracketed terms cancel and the share is simply stake ÷ networkStake. The 1.1× has done nothing.",
      "It is a redistribution, not an addition. It pays only validators seated more often than average — which, under stake-weighted sampling, means larger stakes. A model that treats committee membership as a snapshot boolean instead of a rate will report a premium that is not there.",
      "The tool opens with a stake slightly above the set average so the premium reads positive, and drag it toward the mean and it falls to zero. That is the mechanism, visible.",
    ],
    cites: "R9.5 · R15.4a · Appendix A (finality_committee_premium_weight_ppm)",
  },
  {
    id: "f-audit-floor",
    title: "The audit pool has a solvency floor, and it is a price floor on sessions",
    claim:
      "Below roughly 5 FLOP of settlement per audited turn, the pool that funds Tier-3 enforcement cannot pay for its own audits.",
    body: [
      "Three enforced parameters set it. Inflow is audit_fee_split_ppm — 1% of the miner's settlement payment, carved into the audit pool. Outflow is audit_fee_per_turn, a flat 1 FLOP claimed by a VRF-assigned validator per audit verdict. The rate is sampled_audit_alpha_ppm, 5% of turns.",
      "Per settled turn: inflow is 0.01 × P, expected outflow is 0.05 × 1 FLOP. Break-even is P ≥ 5 FLOP.",
      "The parameter's own wording anticipates the shortfall — the fee is claimable only when gated on submitted evidence and pool solvency. So in a low-price regime the payment simply stops, and Tier-3 re-execution is the enforcement arm of the entire verification stack.",
      "Two caveats, both worsening it. α is described as the default for sampled-audit certificate mode and may not apply to every session; and audit_quantum_gn and high_value_gn_threshold force additional audits on top, which lowers the margin further.",
      "I have not found this stated anywhere in the specification or the published pages.",
    ],
    cites: "audit_fee_split_ppm · audit_fee_per_turn · sampled_audit_alpha_ppm · §3.5 · §7 · §12.2 · D-0403",
  },
  {
    id: "f-lock-payback",
    title: "Profitable is not the same as paid",
    claim:
      "At the worked example a validator is profitable on paper from month 5, earns 4,556,184 FLOP over three years, and can withdraw 15,000 of it.",
    body: [
      "Under the behaviour the specification currently describes, the validator 10% pool is auto-compounded into locked stake. Auto-compounding does not mean the reward matures after a waiting period. It means the reward becomes stake.",
      "There is no date on which it turns into a spendable balance. The only way to realise it is to leave the active set, and unbonding then takes 21 days measured from when the last open session, dispute or audit closes — not from when you ask. M11 states the clock is frozen while any of those is open, and §1.2's reading rule gives the principle: stake outlives disputes.",
      "The only validator income that stays liquid is the audit fee, because it is a claimed fee rather than a pool distribution and E.39 scopes itself to block-reward earnings. At the worked example that is the entire 15,000 FLOP.",
      "This corrected a real error in this tool. The earlier payback figure divided hardware cost by nominal annual net with no lock awareness and reported 4.88 months. Under the current behaviour, cash payback does not arrive within 36 months at all.",
      "E.39 is unresolved and binary — the workbook ratifies a 0% reward lock while the distribution hook is unchanged — so the tool computes both and never picks one. On paper the two are identical. In cash they are three hundred times apart.",
    ],
    cites: "E.39 · D-0408 · M11 · §15.7 · §1.2 · #1356",
  },
  {
    id: "f-gpu-backend",
    title: "A validator needs a GPU backend, and no published cost model says so",
    claim:
      "Committee eligibility requires recent verified proof-of-useful-inference work, so a production validator co-locates or delegates to a calibrated miner backend.",
    body: [
      "§15.1 says it directly: a validator is not required to own a TEE GPU to validate, but committee eligibility requires recent verified PoUI work, so a production validator co-locates or delegates to a calibrated miner backend. LastVerifiedWork must fall inside a 24-hour window or the validator is active but out of the committee.",
      "§15.3's duty table rates that work GPU-heavy and concludes that the two heavy legs are DA storage-and-serving and the committee-keeping GPU work.",
      "Neither is sized anywhere. The specification states no hardware minimums at all, and E.47 leaves the cumulative DA storage and retention budget open. Community reporting that circulates CPU, RAM and NVMe figures is describing the small half.",
      "So the tool refuses to compute a net figure until both are supplied, rather than defaulting them to zero and quietly producing a number that omits a validator's largest cost.",
    ],
    cites: "§15.1 · §15.3 · §15.2 (WorkRecencyWindow) · E.47",
  },
];

/** What is not modelled, and why. */
export const LIMITS: readonly { title: string; body: string }[] = [
  {
    title: "No price path",
    body: "Every dollar figure uses one fixed price. Projecting how the token moves over a multi-year horizon would be the least defensible thing in the tool, and it would hide the lock exposure rather than reveal it.",
  },
  {
    title: "Circulating supply",
    body: "Not modelled. E.38 states the path distributing the genesis supply has no normative section, the agent leg unlocks against spend with the mechanism itself undecided, and the validator cohort's conversion is open. Outstanding supply is used and labelled as such everywhere it appears.",
  },
  {
    title: "The validator bond lock",
    body: "Community reporting says the testnet top-1000 receive their bond free, locked 24 months. The yellow paper contains no occurrence of 24 month, 24-month, two year, bonded stake or locked 24. It is a user input defaulting to blank, never a default wearing a spec badge.",
  },
  {
    title: "Agent-side timing",
    body: "Escrow slot release is event-driven rather than clock-driven — R12.2 frees a slot on settle, expiry, timeout or fraud, and the specification fixes no duration for a session. The only real clocks are the ten-minute force_open ack window and the seven-day dispute window. There is no honest month-by-month agent timeline to build.",
  },
  {
    title: "Delegator reward timing",
    body: "Delegation exists, with a 100 FLOP minimum and a cap of four times self-stake, but nothing states when a delegator's share is distributed or whether it inherits E.39's lock.",
  },
  {
    title: "The two ABSENT cost inputs",
    body: "DA volume (E.47) and the GPU backend (no sizing anywhere) are the validator's two heavy legs and neither is sized by the specification. Every figure downstream of them inherits whatever you assumed, and carries an assumed mark saying so.",
  },
  {
    title: "The G_n to FLOP conversion",
    body: "E.30 has not ratified the dimensional relation between channel pay units and FLOP's base units. Until it does, the agent tariff can be computed in channel pay units but not compared against an escrow denominated in FLOP without an assumption you supply.",
  },
  {
    title: "Named comparable valuations",
    body: "Cut deliberately. Quoting another network's market capitalisation would put a live market figure inside a tool whose whole claim is that every number traces to a citable source; it would be stale within a day and unverifiable against the specification.",
  },
];
