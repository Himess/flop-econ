# Flop Labs / Technocore — codebase analysis and contribution strategy

Prepared 2026-09-09. Verified against `flop-labs/technocore-chat` at `20a4457` (v0.13.0, the commit the hosted service reports at `/config`) and `flop-labs/tclk` at `5cc4ab9`.

**Conventions.** Every claim about code cites `file:line` from a local clone (`repos/`). Live measurements cite the endpoint and are dated — the hosted instance changes hourly. Anything I did not read, I mark *[inferred]*. I opened nothing, filed nothing, and posted nothing to technocore.chat; every request I made was a documented read (`/llms.txt`, `/config`, `/.well-known/*`, `/rooms`, `/humans`, `/r/<room>?format=json`, `/r/lobby/export`).

## Read this first: four premises in the brief that the evidence contradicts

1. **The Phase 4 "stated open problem" is not open.** It was filed as issue #466 on 2026-08-26, fixed twice, and the maintainer has picked a winner. PR #103 is open, mergeable, and `sv` said on 2026-09-06 he is keeping it over the competing #532. Making this "the primary target" would be the third parallel branch on a settled question. Details in §4.

2. **The queue is not frozen — it is moving fast.** 4–14 PRs merge per day, every day. 26 of the 41 externally-authored merges happened in the last 14 days. The scarce resource is not the maintainer's attention; it is a submission that is not already in the queue. Details in §2.

3. **"Almost nobody can review TCLK competently" is wrong.** TCLK has 58 open PRs and 31 open issues against 8.4k lines. The sharpest available adaptor-signature finding — extraction not bound to the nonce — was filed by a third party on 2026-09-05 as PR #118, with a correct write-up. Details in §5.

4. **A Rust client is not a virgin gap.** Two exist (`Pokerdisk/technocore-rs`, `zmctinas/technocore-rs`), both created 2026-08-25, both abandoned the same day. One is competent. Details in §6.

Three smaller corrections: `/stats` returns 404 to the public (token-gated, `src/app.py:1902`), so `client_identity` is not something you can read; the `/humans` CSP is a `sha256-` pin, not a per-response nonce (`src/manifest.py:49`), and `SECURITY.md`'s description of it is stale; the open PR count is 237, and there are also 117 open issues.

---

## 1. Product

### What it is

An append-only chat and notes service whose entire API is reachable with `GET`, returning `text/plain`. The premise is a population constraint, not an aesthetic one: an LLM agent whose sandbox exposes only a `webfetch` tool can issue a URL and read a string, and nothing else. It cannot set a header, choose a verb, or parse a client library. So every operation is encoded in a path segment.

**What GET-as-write buys that POST does not** is not idempotency or caching — it is *reach*. A POST lane exists too (`src/app.py:1440`, `1723`) and carries the payloads a URL cannot: the 8192-char note, the 4096-char message in a script that costs 9–12 URL bytes per character. The GET lane is what makes a fetch-only agent a peer rather than a reader. The price is stated plainly in `SECURITY.md:77-84` and is real: every link unfurler, prefetcher and scanner is a writer, and a message containing write URLs turns any agent that "reads the room" into a confused deputy under its own IP budget. That is accepted as inherent, and it is why `/r/events` is the one non-world-writable path (`src/app.py:1123-1137`) — a forgeable discovery log would let an attacker steer agents into rooms of its choosing.

### Storage engine

One JSONL file per room, sharded into 256 blake2b buckets (`src/store.py:515-518`). One record per line is the load-bearing invariant, which is why `clean_text` (`src/store.py:446`) replaces every character in `Cc, Cf, Cs, Co, Zl, Zp` with a space and then trims. The second reason for that sweep is stated at `src/store.py:429-442`: text that renders as nothing is how instructions get smuggled into another agent's context.

The budgets, all from `src/store.py`:

| constant | value | line |
|---|---|---|
| `MAX_TEXT_CHARS` | 4096 | 35 |
| `MAX_VALUE_CHARS` | 8192 | 36 |
| `MAX_ROOM_BYTES` | 10 MiB | 37 |
| `COMPACT_KEEP_BYTES` | 5 MiB (`MAX_ROOM_BYTES // 2`) | 49 |
| `READ_BUDGET` | 1 MiB | 50 |
| `MAX_TOTAL_ROOM_BYTES` | 5 GiB | 76 |
| `RESERVED_ROOM_BYTES` | 32 KiB (`5 GiB // MAX_ROOMS`) | 92 |
| `IDLE_SECONDS` | 7 days | 269 |
| `STILLBORN_SECONDS` | 24 h default, clamped to whole hours and to `IDLE_SECONDS` | 293 |

The ring oscillates rather than sliding: `_write_record` appends, and only when `size + len(line) > _ring_limit(root)` does it compact to `limit // 2` (`src/store.py:2586-2591`). So a room's history is between 5 and 10 MiB, not a steady 10. `_ring_limit` (`2246`) drops the whole store to the 32 KiB floor once total room bytes exceed the 5 GiB budget — history shortens, writes are never refused.

**What is guaranteed:** `seq` is contiguous and assigned under the room's exclusive lock, so two readers always agree on order (`src/store.py:2569`, under `_create_gate` at `2549`). Truncation is never silent — a reply's `first_seq` greater than your `since+1` means you missed lines. A signed record re-verifies from its exported line alone; I confirmed this offline against two production records (§4).

**What is not:** durability of anything. `fsync` is off on the hosted instance (`/config`: `"fsync": false`), so a 200 does not mean the bytes reached disk. Rooms and notes idle 7 days are deleted; a room still on its first message goes after 12 h on this deployment (`CHAT_STILLBORN_SECONDS=43200`). `ts` is stamped *before* the room lock is taken (`src/store.py:2532` precedes `2549`), so a write that waits on the lock carries a timestamp older than records that beat it to a lower `seq`. The manual already says `ts` is never the tiebreak; this is the mechanism.

### Room lifecycle and name classes

A name matches `^[a-z0-9][a-z0-9_-]{0,47}$` (`src/store.py:33`) and is validated with `fullmatch`, not `match` — the comment at `344-348` records that `$` also matches before a trailing newline and that `match()` once created a room whose filename carried one. That allowlist is the only control that makes traversal impossible, so it has to mean exactly what it says. I could not construct an escape from it.

Classes compose by prefix and the last hyphen-segment is always the body (`room_classes`, `src/store.py:384-396`): `mb-p-x` → `{mb, p}`, `pastel` → `{}`, a bare `d` is not ownable. `p-` is unlisted (never enumerated), `mb-` takes signed writes only, `d-` is ownable, `e-` expires lazily on read. Creation is writing; `/r/events` gets one `created <name>` line per new *public* room (`src/store.py:2454`) and deliberately nothing at all for a `p-` room, because even an anonymous line would leak the timing.

### The signed lane

`did:key` Ed25519 only. `src/didkey.py` is 148 lines and is the best-argued file in the repo. Three shapes are enforced there and published from the same constants into `/openapi.json` (`src/didkey.py:45-64`): the DID is exactly 48 multibase characters starting `z6Mk`; the signature is 86 base64url characters whose last must be one of `AQgw`, because 64 bytes is 512 bits and 86 base64url characters carry 516 — an unconstrained `{86}` would accept sixteen spellings of every signature; the nonce is 1–19 digits.

Payload construction: `f"{room}|{nonce}|{body}"` where `body = store.clean_text(p["text"])` — the sweep runs *first*, so the signature covers the bytes that get stored (`src/app.py:1367-1368`). The note lane signs `f"{ns}|{key}|{nonce}|{value}"` (`src/app.py:1703`). Verification is `nacl.signing.VerifyKey.verify` (`src/didkey.py:146`), which rejects small-order and non-canonical `S`. Everything fails closed; there is no "unverified but accepted" path.

Two different replay counters, correctly distinguished:

- **Messages** — `_last_nonce` (`src/store.py:2472`) scans backwards through the room file with `reverse_lines`, whose default `max_bytes` is `READ_BUDGET` = 1 MiB. The comparison and the append are inside one `_create_gate` critical section (`2560-2568`), so two concurrent replays cannot both read the same last nonce. This is the bounded window of §4.
- **Notes** — only `room-owners` and `room-allow` take signed writes (`src/app.py:1569-1576`), and `_burn_nonce` (`1667`) spends a monotonic counter in the server-written `room-nonce` namespace with a compare-and-set. Notes have no ring, so a captured signed note URL would otherwise work forever; this is the smallest state that closes it, and the reaper keeps guard notes alive as long as their room is (`_guards_a_live_room`, `src/store.py:1478`).

Ownership is from birth: a `d-` room with any message cannot be claimed (`src/app.py:1616`), a first claim must be signed by the key it stores (`1607`), and hand-over is exempted from that with an explicit reason (`1604-1606`).

### Rate limiting

Two token buckets per client IP, reads and writes separate, refilling continuously. This deployment: 600 reads/min, 300 writes/min, 20 new rooms/day (`/config`). The room budget is charged last, so an IP hammering a mailbox it cannot write to does not also burn the room budget (`src/app.py:1180-1183`), and it is refunded on every non-creating exit including a duplicate refusal (`src/app.py:1294`).

What is in-process and what is not is stated honestly: `_buckets` is an LRU, so a flood of distinct IPs evicts entries early, which is free for a per-minute budget and *not* free for a daily one (`src/app.py:1200-1205`). The authoritative limit belongs in the proxy. `CHAT_CLIENT_IP_HEADER` is withheld from `/config` with a good reason — naming the one trusted header tells anyone who can reach the origin directly which header to forge.

### MCP

`uvx technocore-mcp`, nine tools, plus a hosted streamable-HTTP endpoint. It is a thin wrapper over the same HTTP surface, and its bugs are *lane-parity* bugs: recently merged fixes include rejecting swept-empty signed messages (#761), sending both note conditions (#621), bounding `list_notes` (#713), and preserving large nonces. That is the pattern to notice — see §7.

### Where it is clean and where it is load-bearing but fragile

Clean: `didkey.py`, the class/name grammar, the write gates, the note-condition logic. Each carries the failure it prevents in a comment rather than a restatement of the code.

Load-bearing and fragile, in my reading:

- **`_last_nonce`'s raw-byte prefilter** (`src/store.py:2496-2500`) skips lines not containing the DID literally, before parsing. Correct for records this store wrote; a foreign writer that escaped the DID as `\uXXXX` narrows that record's replay window to nothing. The comment states the boundary and the benchmark reason for not covering it. Fine, but it is a correctness property that depends on an encoder's output shape.
- **`ts` stamped before the lock** (`2532` vs `2549`). Harmless for humans, and it is one half of the production artifact in §4.
- **The counter/usage files.** `USAGE_FILE`, `NOTES_FILE`, `.counters`, `.seqstate` are a hand-rolled consistency layer under concurrency, and they are where the recent bug density is: #805, #637, #588, #489, #793 are all open against it. This is the part of the store I would least want to change without the Hypothesis suite.
- **The edge.** The Cloudflare worker is a second cache policy the origin cannot see, and both live inconsistencies I found are there rather than in `src/` — F1 in §3, and the stale `/rooms` snapshot below.

---

## 2. Queue state

Numbers as of 2026-09-09, from `gh` against `flop-labs/technocore-chat`. The repo is **27 days old** (first commit 2026-08-13, 147 commits, 149 stars).

| | count |
|---|---|
| PRs total | 622 |
| open | 237 (3 drafts) |
| merged | 136 |
| closed unmerged | 249 |
| issues total | 180 (117 open) |
| distinct authors of open PRs | 136 |

**Merge rate.** `sv` authored 94 of the 136 merges. External merges: **41**. Against ~528 external PRs that is an **~8% external merge rate**. Closed-unmerged outnumbers merged 249 to 136.

**But the queue is being worked, hard.** Merges per day over the last two weeks: 11, 10, 12, 4, 5, 6, 14, 4, 13, 5, 7, 5, 9, 1. **26 of the 41 external merges landed in the last 14 days.** Old PRs land too — #156 and #304 were merged on 2026-09-07. The backlog is not a graveyard; it is a queue with a high rejection rate.

### The revealed bar

Median externally-merged PR: **+38 lines, 2 files**. The shape is remarkably consistent:

- **A specific defect at an edge, with the invariant fixed where it lives.** `_b58decode` losing leading zero bytes (#156); a signature having sixteen valid spellings (#178); `_compact` dropping the newest record when it alone exceeds the budget (#274); a non-ASCII `/stats` token byte producing a 500 instead of a 404 (#686); `Host` matched with `match` instead of `fullmatch` (#491); HEAD accepted on write-shaped GET routes (#135).
- **Lane parity.** Six of the 41 are `fix(mcp)` making the wrapper agree with the origin.
- **Docs that contradict code.** #48, #185, #195, #346, #659 — each names a specific false sentence.
- **Tests that pin a boundary.** #319 (a 650-line Hypothesis model of the signed lane's replay window), #425, #464.

### The mechanical gates (CONTRIBUTING.md, `.github/workflows/pr-guards.yml`)

These are worth more than any style advice, because they are automated and they fail:

- Conventional-commit title (`fix:`, `fix(scope):`, `feat`, `docs`, `perf`, `test`, `build`, `ci`).
- **A `fix:` PR must change something under `tests/`, and CI runs those tests against the base commit and requires them to FAIL there** (`CONTRIBUTING.md:136-138`). A regression test that passes without the fix is not one.
- The contract check fuzzes the running service against the `/openapi.json` that same instance serves; **an undocumented status code fails it**, so a new response goes into `src/manifest.py` in the same change (`CONTRIBUTING.md:85-87`).
- Core size caps in `sz-baseline.json`, and queue-guard fails a fork PR that edits `CHANGELOG.md` or `sz-baseline.json`.
- queue-guard posts a comment listing open PRs citing the same issues.

### What the maintainer pushes back on

From reading closed PRs and `sv`'s own comments:

- **Racing an existing PR.** #532 was closed as a duplicate of #103 with: *"it came first by six days… Per CONTRIBUTING's 'Overlapping work', review or build on #103 rather than carrying a parallel branch."* Credit was given to the later author for filing the issue. This is the single most enforced rule.
- **Quietly deleting tests that pin the old behaviour.** On #532: *"A rebase that quietly deletes those three tests would be the wrong shape… update each of the three to assert the new policy, and say in the PR body that they were intentional inversions."*
- **Framing a policy change as a bug fix.** *"So this is a policy decision, not a bug fix, and it needs to be made explicitly."*
- **Standalone artifacts that do not integrate.** #14 (`signed_client.py`) was closed for being a second Python signer beside `scripts/sign.py`, not for being wrong.
- **Translations of agent-facing documents** are declined by policy (`CONTRIBUTING.md:119-127`).

One more signal, and it is the important one for strategy: **issue #75 — "No client outside Python: what shape would a JavaScript reference implementation need to take?" — has 19 comments and zero from the maintainer.** Design-proposal threads do not get answered. Specific defects with a failing test do get merged. Do not open a proposal issue and wait.

### Ideas already taken — check this list before writing anything

**Loudly: the replay/nonce area is the most crowded topic in the repository.** ~25 PRs and ~13 issues touch it.

| your candidate | already claimed by | state |
|---|---|---|
| **Widen `_last_nonce` beyond the 1 MiB tail** | **issue #466; PR #103 (kept), PR #532 (closed as dup)** | **maintainer has chosen #103** |
| Nonce-rejection message overstates the scan | issue #349; PRs #350, #459, #520, #522, #548 | five PRs on one docs line |
| `isinstance(nonce, int)` admits `True`/`False` | issue #810 (WIZARDspace) | open |
| Zero-padded / leading-zero nonce | issue #574, PR #356, PR #575 | filed |
| 19-digit nonces lost to JSON float | issue #711, PRs #712, #728, #685 | filed |
| TOCTOU on room-ownership claim | issues #173, #176, #628; PR #706 | filed |
| Guard notes outliving a stillborn room | issue #516 | filed |
| Owned-room handoff race on allow-list | issue #499 | filed |
| Forged delegation suppressing a valid one | issue #782 | filed |
| Unsigned writers forging `~server` | issue #137 | filed |
| Conformance vectors for the signed lane | **PR #318 (open, +2361), PR #314 (closed), issue #75** | large and in flight |
| Hypothesis model of the replay window | PR #319 | **merged** |
| `clean_text` per-character `unicodedata` (73×) | issue #322 | open, `help wanted` |
| Windows `fcntl` startup failure | issue #255 | open |
| `move_to_end` KeyError in `take()` | issue #378 | open |
| `/rooms` stale edge copy | issue #714 | open, well measured |
| `/humans` CSP docs say nonce, code says hash | PR #737 | open |
| `.seqstate` unbounded / global lock | issue #489 | open |
| `_settle_count` double-count | issue #805 | open |
| TCLK: extraction not bound to the nonce | **tclk PR #118** | open, correct |
| TCLK: presig verification scope in SPEC §3.3 | tclk issue #36, PR #100 | open |

`zeycan1`'s issue #490 is a tracking issue for *five* further findings from a source read. Assume the obvious source-read findings are gone.

### One increment on an existing issue, if you want a cheap second contact

Issue #714 (`/rooms` edge copy re-stamps but never refreshes) is well measured and open. It reports a stale *count*. I observed something slightly worse and not in the thread: the stale snapshot also publishes a **stale cap**.

```bash
curl -s https://technocore.chat/rooms          | head -1   # edge snapshot
curl -s 'https://technocore.chat/rooms?limit=1' | head -1   # different key, reaches origin
```

At 2026-09-09T12:29Z, ~13 minutes apart in `x-edge-stamp` but far apart in content:

```
# 50 of 51524 rooms (cap 81920,  705.7M of 5.0G stored)   <- Age: 774, s-maxage=86400
# 1 of 49516 rooms  (cap 163840,   1.7G of 5.0G stored)   <- origin
```

So the bare path advertises a room cap the service stopped enforcing and less than half the true stored bytes, under `Cache-Control: s-maxage=86400` — while `/config` publishes `edge_cache_seconds: 5` and a plain room read really does carry `s-maxage=5`. `/rooms` is one of the surfaces that publishes a documented cap, and it is publishing a superseded one. That is a comment on #714, not a new issue.

---

## 3. Security findings

I worked the in-scope list against the code and verified each documented "not a vulnerability" claim. **I found one thing worth reporting, and it is modest.** I am not going to inflate the rest.

### F1 — `technocore.chat` serves a `script-src` nonce the origin never generated

**Confidence: high on the observation, medium on the significance. Deployment issue, not a source bug. Not an exploitable XSS.**

`SECURITY.md:45-46` puts XSS on `/humans` in scope and names the control: *"every field renders through `textContent` under a `default-src 'none'` CSP with a per-response nonce."* The code moved off the nonce in PR #660 — `manifest.humans_csp` (`src/manifest.py:49-59`) emits **only** `sha256-` hashes of the inline blocks, and `src/app.py:1788-1793` explains why: a per-response nonce made every response unique, so the 60 KiB document could never be shared by the edge.

The live header carries both:

```bash
curl -sI https://technocore.chat/humans | grep -i content-security-policy
```

```
content-security-policy: default-src 'none'; connect-src 'self'; img-src 'self' data:;
  script-src 'sha256-o202UxgVaVB/I0ZvxErcZxHLNWgQZKMLF6JqQFE0vY0='
             'nonce-27faa1887e696249b3f7f620206911f8';
  style-src 'sha256-768C+BOZ0ud8vQoXs49GPlDtft5GF+Dm747CvQeAJ48=';
  base-uri 'none'; form-action 'none'; frame-ancestors 'none'
```

Three facts establish that the nonce is injected downstream of the origin:

1. The two `sha256-` values in the live header are **byte-identical** to the hashes computed from `src/humans.html` at `20a4457`, so the deployed document and the origin policy are the repo's.
2. `grep -i 'nonce\|csp\|content-security' edge/src/worker.js` returns nothing — the worker in this repository does not touch the header.
3. **The nonce changes on a cache HIT.** Same URL, four requests:

```bash
U="https://technocore.chat/humans?cb=fixed12345"
for i in 1 2 3 4; do curl -sI "$U" | grep -iE 'cf-cache-status|nonce-'; done
```

```
nonce-4060b46328d91d81ad256155683ba50b   cf-cache-status: MISS
nonce-c2fa30171de0a3fac469c6f547b84640   cf-cache-status: MISS
nonce-eeb6e2ce5c89eb70b3ceae5696602908   cf-cache-status: HIT   Age: 1
nonce-7cc2b8b5ed0e9a921624a5116e6c0ff0   cf-cache-status: HIT   Age: 1
```

A value that differs across two cache HITs of one cached object is being written after the cache, i.e. by the CDN. *[Inferred: which Cloudflare feature does it — I did not identify the product.]*

**Impact.** A hash-only `script-src` authorises exactly two known blocks. Adding a nonce source authorises **any** inline `<script nonce="…">` carrying that request's value. `src/app.py:1786` states the design intent as *"even an injected tag could not execute"*; on the hosted deployment that is no longer true. There is no injection sink today — `/humans` is a static file, nothing server-side interpolates into markup, and the script writes `textContent` and never `innerHTML` (`src/humans.html:710`, `798`, `1051`) — so this is a **removed mitigation, not a vulnerability**. It matters because it silently converts the one control SECURITY.md names into a weaker one, and because it would turn any future injection from unexploitable into exploitable.

**Interaction with open work worth mentioning:** PR #737 correctly changes `SECURITY.md`, `README` and `docs/design.md` to say the CSP is a `sha256-` pin and not a nonce. Once merged, the docs will be right about the code and wrong about the hosted service in a new way.

**Recommendation: private advisory.** Not because it is exploitable — it is not — but because it is about the hosted deployment's configuration rather than the source, `SECURITY.md:35` puts the `/humans` CSP in scope by name, and the fix is an operator action. Expect it to be triaged as hardening. Say explicitly in the report that you assess it as non-exploitable; the maintainer's comments show he values a correct severity claim more than a loud one.

### Verified and found sound — no finding

These are the in-scope claims I actually checked. Reporting any of them would be a negative signal; I list them so the work is not repeated.

- **`p-` never enumerable.** `_listable` (`src/store.py:363-381`) excludes unlisted names, and both `list_rooms` (`1219`) and `list_notes` (`2761`) filter through it — `list_notes` deliberately calls the *undecorated* function so a big namespace cannot evict the room cache. `room_stats` (`1316-1324`) skips unlisted rooms before it even stats them, so the `total` and `bytes` it publishes exclude them. `append` suppresses the `/r/events` line for unlisted rooms (`2454`). No leak found. (The `total`/`bytes` undercount is issue #260, already filed.)
- **Unsigned write into `mb-`.** `_room_write_gate` (`src/app.py:1159`) refuses `signer is None` for any name whose classes include `mb`, and `room_classes` composes correctly on every ordering I tried (`mb-p-x`, `p-mb-x`, `mb-`, `mb`). Both write lanes route through the same gate.
- **Non-owner writing a claimed `d-` room.** `_allowed_keys` (`src/app.py:1140-1150`) fails closed on an owner note that is not a DID; `_note_write_gate` (`1578-1646`) refuses a first claim not signed by the key it stores, refuses an allow-list from a non-owner, and fails closed on any unparseable entry. `room-nonce` is refused on both lanes before the signer check (`1563-1568`). *The known race is issue #173/#176 — already filed.*
- **Signature verifying against text it did not sign.** The sweep runs before the canonical string is built on both lanes (`src/app.py:1367`, `1703`), the separator cannot appear in `room`/`ns`/`key`/`nonce`, and the free-form field is last, so the string parses one way only. The canonical-spelling constraint on the signature (`src/didkey.py:61`) closes the sixteen-spellings issue.
- **Name-grammar escape / traversal.** `fullmatch` at `src/store.py:349`; `_resolve` (`551`) and `room_path` (`587`) build paths only from validated names. I could not construct an escape.
- **XSS on `/humans`.** No `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function` or `srcdoc` anywhere in the 2464-line file. The page is static; no message reaches markup. F1 weakens the CSP but supplies no sink.
- **Storage growth past the budget without an append.** Every room byte goes through `_write_record`, which compacts under the same lock (`src/store.py:2586-2591`). Note capacity is checked in `_check_note_capacity`. *The known counter races are issues #637, #805, #793 — filed.*

### Not a finding, but the strongest artifact I produced — see §4

A live, offline-verifiable production record pair showing the signed-lane nonce rule visibly not holding in `/r/lobby`. It is the *documented* behaviour, so it is not a vulnerability report. It is evidence for PR #103.

---

## 4. Replay / nonce design

### Confirming the implementation

`_last_nonce` (`src/store.py:2472-2504`) opens the room file and iterates `reverse_lines(f)` — default `max_bytes=READ_BUDGET` = 1 MiB (`src/store.py:827`, `50`). It skips lines not containing the DID as raw bytes, parses the rest, and returns the first record whose `from` equals the DID and whose `nonce` is an `int`. `_write_record` compares under the room lock and raises unless `nonce > previous` (`2560-2568`). The documented behaviour is exactly what the code does. **The brief's description is accurate; `SECURITY.md:68-75` is accurate.**

One detail the docs do not spell out and that matters for the fix: the ring is not a steady 10 MiB. Compaction triggers at `> limit` and cuts to `limit // 2`, so a busy room lives between 5 and 10 MiB. The guarded fraction is therefore between 10% and 20% of retention, not a fixed tenth.

### How cheap is the flood, in real numbers

Measured against the live service on 2026-09-09. Mean stored record size in `lobby`, from a 200-record sample: **324 bytes** (median 323); 100% of that sample was signed.

**Attacker-driven, single IP, inside the documented 300 writes/min:**

| message size | bytes/record | writes to bury 1 MiB | wall clock |
|---|---|---|---|
| 4096 chars | ~4186 | **250** | **~50 s** |
| 1000 chars | ~1090 | 962 | ~3.2 min |
| 200 chars | ~290 | 3616 | ~12 min |

The duplicate filter does not impede this: it refuses more than 5 copies of one normalised text in 120 s, and 250 distinct texts are free. The room-creation budget is untouched — writing to an existing room never reaches it (`src/app.py:1207-1208`). So **one IP, obeying every published limit, closes the window in under a minute.**

**Organic, zero attacker effort.** Measured message rates over 20-second windows:

| room | msg/min | time to bury 1 MiB |
|---|---|---|
| `lobby` | **1732** | **~1.9 min** |
| `technocore` | 297 | ~11 min |
| `kibble` | 242 | ~13 min |

`/r/lobby/export` on 2026-09-09T12:34Z was 6,030,834 bytes / 18,159 records spanning **624 seconds**. So `lobby`'s whole ring is ~10.4 minutes of history and its nonce window is ~1.8 minutes. **In the busiest room on the service the guarantee lasts under two minutes and nobody has to attack anything.**

### Is it being exploited? No.

I scanned the full `lobby` export: 18,127 signed records, **16,601 distinct DIDs**, and:

- duplicate `(did, nonce)` pairs: **0**
- exact `(did, nonce, sig, text)` repeats: **0**

So the window is cheap and wide open, and *nobody is using it*. That is worth saying out loud, because it bounds how urgent #103 is. (16,601 DIDs across 18,127 records — most identities post once — is the Sybil pattern of issue #269, not replay.)

### But the guarantee does visibly fail in production

One pair in that same export breaks nonce monotonicity. Both records are in `live/evidence-nonce-regression.jsonl`; **both signatures verify offline from the exported lines alone**, using only `did:key` decoding and `lobby|<nonce>|<text>`:

```
seq 37836805  ts 12:30:10.051362Z  nonce 1788957007812  sig YW0bBL2I…  VERIFIES
seq 37844157  ts 12:29:58.483723Z  nonce 1788956998163  sig tluzMiY8…  VERIFIES
did:key:z6MkpH6ts62AhmqwsbkAekCuWzwhsfVzFpT2R8XFhUBPbpTc — same room, same text, different sigs
```

The record at `seq 37844157` carries a nonce **9,649 lower** than the one the same key already used at `seq 37836805`, 7,352 records (~2.3 MiB, ~4 min of `lobby`) earlier. It was accepted because the earlier record had scrolled past the 1 MiB scan window.

This is not an attack — `ts` is stamped before the room lock (`src/store.py:2532` precedes `2549`), so this looks like a signed write that was issued at 12:29:58 and did not reach the append until after 12:30:10's had landed. *[Inferred: I cannot see whether it waited on the lock or upstream.]*

**Why it is the useful artifact anyway:** it is the shape a replay would take, and from the export a reader cannot tell the two apart. The ordering property that would distinguish "the key holder was slow" from "a third party replayed a captured URL" is exactly the one the bounded window drops. PR #103 argues this from the export's documented byte-exactness; this is an observed instance of it, with verifying signatures, from the public surface. **Caveat: it is perishable — `lobby`'s ring turns over in ~10 minutes, so the file in `live/` is the only copy.**

### Candidate bounded designs

The constraint is real: no per-`(room, key)` state that outlives the messages. Assessed against 163,840 rooms and, from the export, ~16.6k distinct DIDs per ring in the busiest room.

**A. Widen the scan to the retained file — what PR #103 does.** `reverse_lines(f, max_bytes=MAX_ROOM_BYTES)`. Zero new state, zero new core lines, and the file's own idiom (`_compact` already passes that budget). Cost is linear in retained bytes: #466 measured 2.47 ms at 1 MiB → 24.93 ms at 10 MiB on the author's machine. On the write path, under the room lock, in the busiest room. **Verdict: right answer, and it is already chosen.** One residual gap worth a review comment rather than a competing PR: `MAX_ROOM_BYTES` is not the same as "the retained file". After a completed write the file is ≤ `_ring_limit`, but a crash between the append (`2581`) and the compaction (`2591`) leaves it larger by up to one record, so a 10 MiB scan can miss the oldest line. #532 used `os.fstat(f.fileno()).st_size` for exactly this. The window is one record wide; whether that is worth a keyword change is the maintainer's call.

**B. Monotonic counter per key with bounded storage.** A `kv`-style `(room, did) → nonce` map. This is the thing the design refuses, and correctly: at 16.6k DIDs per busy ring × 163,840 rooms it is unbounded in the dimension that matters, and it needs cross-worker invalidation, restart reconstruction and crash consistency — none of which this store has. **Rejected.**

**C. Time-windowed nonces.** Require the nonce to be a millisecond clock within ±W of server time. Kills replay after W regardless of traffic, and bounds state to zero. Two fatal costs: it breaks every counter-based client (the manual explicitly blesses "a counter or a millisecond clock"), and it makes correctness depend on the client's clock — an agent with 10 minutes of skew simply cannot write. It also *shortens* the guarantee in quiet rooms, where today it is long. **Rejected as a replacement; viable only as an additional refusal on top of A, and not worth the compatibility break.**

**D. Bloom / cuckoo filter over `(did, nonce)`.** Attractive until the numbers: false positives here mean *refusing a legitimate signed write*, permanently and unfixably from the client's side, since the client cannot know which nonce collided and "count up" may not clear it. At 18k entries and a 1e-6 rate a Bloom filter is ~62 KiB per room — 10 GiB across the room cap, twice the disk budget. Per-room-and-in-memory it dies at restart and diverges across `--workers 3`. Cuckoo adds deletion, which does not help because nothing knows when to delete. **Rejected: the failure mode is a false refusal on the attributable path, and the memory does not fit.**

**E. Epoch rotation.** Fold an epoch into the signed string (`room|epoch|nonce|text`) and let nonces reset each epoch. Bounds state to one epoch counter per room and gives a hard replay horizon. But it is a **wire-format change** — every existing signature, every published client (five JS ones, two Rust), the conformance vectors in PR #318, and `scripts/sign.py` all move. Against a problem that option A fixes with one keyword argument. **Rejected on cost, not on soundness.**

**F. Seq-anchored signatures.** Have the client sign `room|last_seq_seen|nonce|text` and refuse if `last_seq_seen` is older than the retained floor. Genuinely bounded and it makes staleness explicit. But `seq` restarts on a room epoch (`src/store.py:2598`), a client must do a read before every write — doubling the request cost on a lane whose whole premise is one GET — and the manual deliberately excludes `seq` from the signed material because *"you cannot know them when you sign"*. **Rejected: it breaks the fetch-only-agent premise.**

**G. What I would actually add on top of A, if anything.** Nothing to `src/`. The residual after A is "a nonce is forgotten when its record is evicted," which is honest and matches retention. The gap worth closing is *observability*, not enforcement: a reader of `?format=json` or `/export` has no way to say "this record's nonce is no longer guarded." Neither does the report above, without a measurement. That is a documentation and tooling problem, and it is the one thing in this whole area that is not already claimed.

---

## 5. TCLK review

`flop-labs/tclk` at `5cc4ab9`, ~8.4k lines TypeScript across `src/`, `mcp/` and `mcp/worker/`.

### What is implemented vs stubbed

**Implemented and tested:** the frame codec with canonical JSON (sorted keys, compact separators, dropped `undefined`, `\uXXXX`-escaped non-ASCII), `offerId`/`contractId` derivation, the full state machine (`src/machine.ts`, `proposed → accepted → locked → claimed | refunded | cancelled`), hash locks (`src/locks.ts`), point locks (`src/points.ts`), the Schnorr adaptor cycle (`src/adaptor.ts`), transcript folding (`src/transcript.ts`), the venue naming conventions (`src/technocore.ts`), an MCP server and a Cloudflare worker, and a published JSON schema.

**Stubbed, and honestly:** every rail. `PaperRail` (`src/paper-rail.ts`) records the lock/claim/refund lifecycle in world-writable venue notes and backs it with nothing; `memory` is process-local. `SECURITY.md:27-33` states this in those words: *"No rail here holds value… 'an attacker takes the money' is not currently reachable through this repository."*

### Is the cryptographic construction sound?

**The adaptor scheme is correct.** `preSign` (`src/adaptor.ts:93`) computes `R̂ = rG`, `e = H(R̂+T ‖ P ‖ m)`, `ŝ = r + e·d`. `adapt` (`113`) gives `R = R̂ + tG`, `s = ŝ + t`, so `sG = R̂ + eP + tG = R + eP` with the same `e` — the completed signature verifies as a full-Schnorr signature under `e = H(R ‖ P ‖ m)`, and `verifySignature` (`158`) checks exactly that. The challenge binds the *decrypted* nonce, which is what makes the pre-signature completable only by a holder of `t`. `toScalar` (`33`) rejects `0` and `≥ n` rather than reducing, mirroring the on-chain `Scalar::from_repr` — the comment says so and PR #27 is where that landed.

**Its documented limitations are documented.** Full-Schnorr rather than BIP-340 x-only, no even-y normalisation, no `needs_negation` witness flag, random nonces rather than RFC6979/BIP-340 derivation, no constant-time claim. All stated in the module banner (`src/adaptor.ts:3-21`), in `README.md` and in `SPEC.md §7`, and `SECURITY.md:35-42` says a report whose finding is *that* gets closed with a link. Do not send it.

**The one real gap I found is already filed.** `extractWitness` (`129`) returns `mod(sig.s − pre.s)` and never reads `pre.nonce` or `sig.nonce`, so it reports success with a scalar that opens nothing whenever the completed signature is not the adaptation of *that* pre-signature — e.g. two pre-signatures over the same message under the same statement, which differ only in the random `r` the caller never sees. The docstring asserts *"`t` opens `Point(T)`"* and nothing enforces it. **This is tclk PR #118 (`stupeterwilliams-ui`, 2026-09-05, +67−3), open, with a correct reproduction and a correct severity assessment** (`applyFrame`'s `reveal` case already runs `verifySecret`, so the protocol path was never exposed; the MCP helper `tclk_adaptor_extract` was). Nothing for you here except a review.

Related and also filed: tclk issue #36 / PR #100 on whether SPEC §3.3's claim about `verifyPreSignature` matches the code.

### Hashlock / timelock / refund

`hashLockFromPreimage` and `verifyHashPreimage` (`src/locks.ts:22`, `36`) are fail-closed and compare lowercase hex. `verifySecret` (`45`) closes the union — an unknown lock kind verifies nothing (PR #15). `validateDeadlines` (`58`) validates every operand before doing arithmetic, with the reasoning stated: NaN comparisons are false in both directions and `-Infinity` manufactures an infinite safe window (PR #34). The ordering rule enforced is `claimByMs − now ≥ minClaimWindow` and `refundAfterMs − claimByMs ≥ minRefundGap`, with no default margins supplied because there is no safe universal one. That is the right call.

### Does the protocol survive room eviction? Yes, and it is designed for it.

This is answered in `SPEC.md:93-105`, which pre-empts three venue sharp edges by name — the duplicate filter (every offer/accept carries a random nonce), the **replay window** (*"the state machine is idempotent — a replayed frame is a no-op rejection, and money never moves on a frame, only on the rail"*), **retention** (*"the room is coordination, not the record. Both parties persist frames they care about (`/export` gives byte-exact re-verifiable JSONL) and the rail holds the money state. Deadlines longer than the venue's retention are fine — they bind the rail, not the room"*), and **room epochs** (contract ids are self-contained hashes, never `room/seq` references, so nothing dedupes on `seq`).

So the brief's premise here is wrong: eviction was thought about first. What *is* live and open is the operational consequence — `dealRoom()` (`src/technocore.ts:61`) derives `mb-p-tclk-<16 hex>`, and on the hosted venue a room still on its first message is reaped after 12 hours while a claimed room needs the 7-day idle rule. Filed as tclk issues #61 (SPEC §2's room binding is unsatisfiable on the shared venue), #104 and #688/#707 (deal rooms cannot be created at the room cap), with PRs #62 and #65 proposing offer-room fallbacks.

### Threat model

**It is written down**, contrary to the brief. `SECURITY.md` has an eight-item in-scope list and a seven-item "not a vulnerability" list, plus two framing facts. `SPEC.md §7` carries security considerations and §8 the arbitration design with §8.4 stating what is deliberately absent.

### Gaps a protocol engineer would fill

Honestly assessed after reading the queue: **fewer than the brief assumes, and most are taken.** 58 open PRs and 31 open issues cover canonical-JSON escape forms (#48, #68, #117, #144), nonces above 2^53 (#78, #82), rail alias normalisation (#85, #86), `foldTranscript` trusting export row order and unsigned `ts` (#93, #96, #97), `lock.ref` unconstrained at the frame boundary (#123), and `PaperRail` read-back asymmetries (#87).

What I did not find claimed, and would rate genuinely open:

1. **No cross-implementation test vectors for the *adaptor* cycle.** PR #105 proposes portable golden vectors for all 8 frame types; nothing covers pre-sign/adapt/extract/verify as data. An independent implementation cannot currently check its adaptor against this one. Moderate value.
2. **`SPEC.md §7`'s per-rail time-domain requirement has no conformance test.** Each rail is said to re-enforce deadlines in its own domain; only `memory` and `paper` exist to check it against.
3. **No statement of what breaks when the audited signing stack replaces `src/adaptor.ts`.** The banner says MuSig2 nonce aggregation and BIP-340 normalisation are deferred; nothing says which call sites and which SPEC clauses move with them. This is the piece a protocol engineer is uniquely placed to write, and it is a document, not code.

---

## 6. Build candidates

Duplication checked by GitHub search on 2026-09-09: `technocore` matches **1,329** repositories. The ecosystem is saturated with DID generators, dashboards, censuses, observatories, "safe agents", translations and airdrop guides, in Python, JavaScript, TypeScript and HTML.

### Rust client — the brief's hypothesis, answered

**Two exist.** Both created 2026-08-25, both last pushed the same day, both 0 stars, 0 forks:

- **`zmctinas/technocore-rs`** — ~58 KB of source: CLI, `identity.rs`, `crypto.rs`, `net.rs`, `proof.rs`, `protocol.rs`, integration tests, and a Python fixture generator for cross-checking. **It is competent.** `normalize_text` sweeps `Cc, Cf, Co, Zl, Zp` then trims, with a correct note that Rust `char` cannot represent `Cs`; `message_payload` builds `room|nonce|text` post-sweep; name grammar, nonce grammar and the 4096/8192 caps are all right. The one durable weakness I can see is that it takes the categories from the `unicode_categories` crate, which pins an older Unicode than CPython's `unicodedata`. *[Inferred: I did not run it.]*
- **`Pokerdisk/technocore-rs`** — ~8 KB, and **functionally broken on the signed lane**: `Identity::sign` signs `format!("{room}|{nonce}|{text}")` on the raw text (`src/did.rs`), with no sweep and no trim anywhere in the crate. Any message with a leading space or an invisible character 403s. This is precisely the trap catalogued in technocore-chat issue #75.

So the honest answer to "is there a Rust client" is: **yes, and the good one has been abandoned for two weeks with no users.** That is not a gap in the sense the brief means. Writing a third one is building into a niche whose demand is demonstrably zero — the runtimes that actually appear in `/rooms` are Python and Node, and the chain being Rust does not make *this* service's clients Rust. And note that issue #75 — nineteen comments, five JS implementations, careful Unicode measurements — **received no maintainer reply at all.**

### Ranked candidates

Effort estimates are for someone with the brief's background, and assume reading the surrounding code first.

**1. Review PR #103 and produce the retention-boundary measurement it lacks. — 3–5 h. Not duplicated.**
The fix is chosen but not merged. What no one has supplied: the production numbers in §4 (1.9 min in `lobby`, 250 writes / 50 s for an attacker inside the published limits, and the verifying record pair where the guarantee visibly did not hold), plus the `MAX_ROOM_BYTES`-vs-retained-file gap. This is a review comment plus an attached measurement, not a PR. Who uses it: `sv`, to close the last open question on a change he has already said he wants. Highest signal per hour of anything here, because it converts a settled-in-principle policy change into one with evidence attached, and it is the one contribution that cannot be a duplicate — you would be helping the PR that won.

**2. A retention/replay-boundary probe, out of tree. — 8–12 h. Not duplicated.**
The tooling half of §4-G: point it at any Technocore instance and it reports, per room, the measured message rate, the bytes-per-record, the derived time for the 1 MiB nonce window and the full ring, and it scans `/export` for duplicate `(did, nonce)` pairs and monotonicity breaks. Nothing in the 1,329 repos does this — the census/observatory/pulse tools count identities and rooms, not guard depth. Who uses it: the maintainer, to know whether replay is happening (today: no); operators of self-hosted instances, to size their own window. It also survives PR #103 merging, because the window then becomes the ring and the same tool measures the new boundary.

**3. Lane-parity fix in `mcp/` with a failing regression test. — 4–8 h each. Check overlap first.**
Six of 41 external merges are `fix(mcp)`, the most recent on 2026-09-07. The wrapper drifts from the origin faster than it is checked, and each drift is a small, provable, mechanically-gated fix that fits the merged shape exactly. Find one that is not among #685, #712, #728, #124, #136, #81.

**4. Adaptor-cycle golden vectors for TCLK. — 10–16 h. Adjacent to PR #105, not the same.**
Pre-sign/adapt/extract/verify as language-neutral data, so a second implementation can check its adaptor rather than only its frame codec. PR #105 covers the 8 frame types; this covers the cryptography. Genuinely in your wheelhouse and genuinely unclaimed. Risk: it is a `test(` PR of some size in a repo whose maintainer merges 19 of 101, and PR #318's fate in the other repo (open, +2361, since 2026-08-26) suggests large test contributions sit.

**5. `clean_text` ASCII fast path (issue #322). — 4–6 h. Issue open and labelled `help wanted`.**
A per-character `unicodedata.category` call on every write; the issue claims 73× on a full-length message. `perf` PRs get base-vs-head numbers posted by CI automatically, so the evidence is mechanical. Check for an open PR first — the issue is popular.

**6. A third Rust client. — 20–40 h. Duplicated twice. Do not.**

**7. A conformance suite for the HTTP surface. — 30+ h. Duplicated.**
PR #318 (+2361, open) and closed PR #314. `tests/test_contract.py` already fuzzes the service against its own `/openapi.json` on every PR, and `tests/test_store_stateful.py` plus the merged Hypothesis model in #319 cover the store and the signed lane. The niche is full.

**8. A name-grammar fuzzer. — 6–10 h. Low value.**
The grammar is one anchored regex used by one validator, `fullmatch`ed, with `_listable` deriving from the same pattern. `CONTRIBUTING.md:32-34` states "one grammar, one parser" as policy. There is little surface for a fuzzer to find, and I could not construct an escape by hand.

---

## 7. Recommended sequence

The governing fact is that this repository is 27 days old, has taken 622 PRs, and merges roughly two external contributions a day. Anything obvious has been filed. Optimise for *not being the 238th open PR*.

**First — the F1 advisory. ~2 h.** It is the only unclaimed security observation I found, it is cheap, it is reproducible in two curl commands, and the private channel is the correct venue. State plainly that you assess it as a removed mitigation with no reachable sink. A calibrated report is itself the signal; an inflated one is anti-signal, and `SECURITY.md:21` says there is no bounty, so the only thing you are buying is credibility.

**Second — the PR #103 review with the measurements. ~3–5 h.** Post it as a review on #103, not as an issue and not as a PR. You bring three things the thread does not have: the production burial rates, the verifying record pair from `/export`, and the `MAX_ROOM_BYTES`-vs-retained-file distinction that #532 handled and #103 does not. It is directly useful to a change the maintainer has already committed to, it credits the existing author rather than competing, and CONTRIBUTING's "Overlapping work" section names exactly this as the wanted behaviour. **Keep the evidence file — `lobby`'s ring turns over in ten minutes and the record pair is already gone from the live service.**

**Third — the probe tool, out of tree. ~8–12 h.** Publish it in your own repository and link it from the #103 review as the thing that produced the numbers. Do not propose it in-tree: #14's rejection and #75's silence both say that standalone client-shaped artifacts belong outside, and the maintainer does not answer "would you like…" threads.

**Then reassess.** If the review lands well, a lane-parity `fix(mcp)` or the `clean_text` fast path is the natural follow-on into the merged shape. If TCLK is where you would rather be, the adaptor golden vectors are real work that nobody has claimed — but read PR #118 and issue #36 first and consider reviewing #118 instead, since a competent review of an adaptor-signature PR is rarer in that queue than another PR.

**Skip:** anything touching the nonce/replay code path (25 PRs deep, and settled); a Rust client; a conformance suite; a name-grammar fuzzer; any proposal issue; anything whose first sentence is "I noticed that `_last_nonce`…".

### Two things to know before you write anything

- **`fix:` PRs are mechanically required to add a test that fails on the base commit.** Write the failing test first. A `fix` PR without a `tests/` change is rejected by a workflow, not a human.
- **Verify against current `main` and name the commit.** `CONTRIBUTING.md:68` asks for this explicitly, and the #532 thread shows how much churn a stale base causes: five rebases, four coordinator read-backs, and it still closed as a duplicate.

## Appendix — artifacts

| path | what |
|---|---|
| `repos/` | clones of all six repositories at the commits cited |
| `live/llms.txt`, `live/config`, `live/.well-known_*` | the service documents as fetched 2026-09-09 |
| `live/prs.json`, `live/issues.json` | full PR/issue dumps used for every count in §2 |
| `live/lobby-export.jsonl` | 6.03 MB / 18,159 records — the `/r/lobby` ring at 12:34Z |
| `live/evidence-nonce-regression.jsonl` | **the two records from §4; both signatures verify offline** |
