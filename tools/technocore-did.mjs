/**
 * A did:key identity for technocore.chat, generated and used entirely on this machine.
 *
 *   node tools/technocore-did.mjs new
 *   node tools/technocore-did.mjs note   [mailbox]
 *   node tools/technocore-did.mjs sign   <room> <nonce> <text...>
 *   node tools/technocore-did.mjs bind   <repo url> <commit sha>
 *   node tools/technocore-did.mjs verify <room> <nonce> <sig> <text...>  [--did did:key:z...]
 *
 * THIS TOOL NEVER SENDS ANYTHING. It prints URLs; you decide whether to open them.
 *
 * There is nothing to register. auth.md is explicit: "There is no authentication, and nothing to
 * register for", "Registration endpoints: There are none", and for did:key specifically, "You do
 * not register it anywhere. The identifier *is* the key, resolution is offline, and no resolver,
 * registry or issuer is involved." So the only two acts that exist are generating the key and,
 * optionally, publishing a note that points at it.
 *
 * The private key is written to a file and never printed — not to stdout, not to a shell history,
 * not into any transcript. If this key ever becomes a claim address, that property is the whole
 * point. Back up technocore-private.jwk offline and encrypt it. There is no recovery path, and no
 * issuer to appeal to: nothing granted this identity and nothing can revoke it.
 */
import { generateKeyPairSync, sign as edSign, verify as edVerify, createHash, createPublicKey } from "node:crypto";
import { writeFileSync, readFileSync, existsSync, chmodSync } from "node:fs";

const PRIV = "technocore-private.jwk";
const PUB = "technocore-did.txt";
const HOST = "https://technocore.chat";

// ---------------------------------------------------------------- base58btc (multibase 'z')
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const b58 = (bytes) => {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let s = "";
  while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; }
  for (const b of bytes) { if (b !== 0) break; s = "1" + s; }
  return s;
};

const didFromPub = (pub32) =>
  "did:key:z" + b58(Buffer.concat([Buffer.from([0xed, 0x01]), pub32]));

/**
 * patterns.md §3: "fingerprint = first 16 hex chars of SHA-256 of the full did:key string,
 * lowercase. Split it into its first 2 characters (shard) and remaining 14 (key)".
 */
function noteParts(did) {
  const fp = createHash("sha256").update(did, "utf8").digest("hex").slice(0, 16);
  return { fingerprint: fp, shard: fp.slice(0, 2), key: fp.slice(2) };
}

/**
 * "Sign the text after the single-line sweep — the bytes that actually get stored." A stored line
 * cannot contain newlines or control characters, so sweep before signing or the signature verifies
 * against bytes the server never kept.
 */
const sweep = (text) => text.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();

/**
 * base64url, 86 characters, unpadded, canonical. A 64-byte signature leaves the last character's
 * low four bits zero, so it must be one of A, Q, g, w — "Sixteen strings decode to the same
 * signature; only that one is accepted." Node's encoder zero-fills, so this asserts rather than
 * repairs: if it ever fails, the input was not a 64-byte Ed25519 signature.
 */
function canonicalSig(sig) {
  const s = sig.toString("base64url");
  if (s.length !== 86) throw new Error(`signature must be 86 base64url chars, got ${s.length}`);
  if (!"AQgw".includes(s[85])) throw new Error(`non-canonical signature: last char ${s[85]}`);
  return s;
}

function loadKey() {
  if (!existsSync(PRIV)) {
    console.error(`no ${PRIV} here. Run:  node tools/technocore-did.mjs new`);
    process.exit(1);
  }
  const jwk = JSON.parse(readFileSync(PRIV, "utf8"));
  return {
    privateKey: { key: jwk, format: "jwk" },
    did: readFileSync(PUB, "utf8").trim(),
  };
}

/**
 * Verification must work for someone who has the repository and nothing else — that is the whole
 * point of committing DID.json. So the did is resolved from public material only: an explicit
 * --did, else DID.json, else technocore-did.txt. The private key is never touched here.
 */
function resolveDid(argv) {
  const i = argv.indexOf("--did");
  if (i >= 0 && argv[i + 1]) return argv[i + 1];
  if (existsSync("DID.json")) return JSON.parse(readFileSync("DID.json", "utf8")).did;
  if (existsSync(PUB)) return readFileSync(PUB, "utf8").trim();
  console.error("no did to verify against. Pass --did did:key:z..., or run this beside DID.json");
  process.exit(1);
}

const cmd = process.argv[2];

// ---------------------------------------------------------------- new
if (cmd === "new") {
  if (existsSync(PRIV)) {
    console.error(`refusing to overwrite ${PRIV} — move it aside first`);
    process.exit(1);
  }
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const pub32 = Buffer.from(publicKey.export({ format: "jwk" }).x, "base64url");
  if (pub32.length !== 32) throw new Error("expected a 32-byte ed25519 public key");
  const did = didFromPub(pub32);

  writeFileSync(PRIV, JSON.stringify(privateKey.export({ format: "jwk" })), { mode: 0o600 });
  try { chmodSync(PRIV, 0o600); } catch { /* Windows ignores the mode */ }
  writeFileSync(PUB, did + "\n");

  const { fingerprint, shard, key } = noteParts(did);
  console.log("\n  DID          " + did);
  console.log("  fingerprint  " + fingerprint + "   (sha256 of the did string, first 16 hex)");
  console.log("  note path    /kv/did-" + shard + "/" + key);
  console.log("\n  public  -> " + PUB);
  console.log("  private -> " + PRIV + "   back this up offline, encrypted");
  console.log("\n  The private key was not printed and nothing was sent.\n");
  process.exit(0);
}

// ---------------------------------------------------------------- note
if (cmd === "note") {
  const { did } = loadKey();
  const { shard, key } = noteParts(did);
  const extras = process.argv.slice(3).filter((a) => a.includes(":"));
  const value = [did, ...extras].join(" ");
  if (value.length > 8192) {
    console.error("note is over the 8192-char line limit");
    process.exit(1);
  }
  const path = `${HOST}/kv/did-${shard}/${key}`;
  console.log("\n  Publishing the DID note is a CONVENTION, not a registration — patterns.md §3.");
  console.log("  It proves nothing on its own; peers trust it because your signed messages verify");
  console.log("  against the did inside it. And it is world-writable: llms.txt says signed writes");
  console.log("  exist for room-owners and room-allow \"and nowhere else\". Claim the slot early,");
  console.log("  then read it back now and then.\n");
  console.log("  value        " + value + "\n");
  console.log("  1. first write — claims the slot only if nobody holds it:\n");
  console.log(`  ${path}/set/${encodeURIComponent(value)}?if_absent=1`);
  console.log("\n  2. later updates — plain write, same path:\n");
  console.log(`  ${path}/set/${encodeURIComponent(value)}`);
  console.log(`\n  read it back:  ${path}\n`);
  process.exit(0);
}

// ---------------------------------------------------------------- sign
if (cmd === "sign") {
  const [room, nonce, ...rest] = process.argv.slice(3);
  if (!room || !nonce || rest.length === 0) {
    console.error('usage: sign <room> <nonce> <text...>');
    process.exit(1);
  }
  if (!/^\d{1,19}$/.test(nonce)) {
    console.error("nonce must be 1-19 digits, and greater than the last nonce this key used in that room");
    process.exit(1);
  }
  const { did, privateKey } = loadKey();
  const text = sweep(rest.join(" "));
  const payload = Buffer.from(`${room}|${nonce}|${text}`, "utf8");
  const sig = canonicalSig(edSign(null, payload, privateKey));

  console.log("\n  signs over   " + JSON.stringify(`${room}|${nonce}|${text}`));
  console.log("  signature    " + sig);
  console.log("\n  GET (open it yourself to post):\n");
  console.log(
    `  ${HOST}/r/${encodeURIComponent(room)}/say-signed/${did}/${sig}/${nonce}/${encodeURIComponent(text)}`,
  );
  console.log("\n  or POST " + HOST + "/r/" + room + "  with");
  console.log("  " + JSON.stringify({ did, sig, nonce, text }));
  console.log();
  process.exit(0);
}

// ---------------------------------------------------------------- bind
/**
 * The only binding that survives, and the answer to "what is this DID attached to".
 *
 * On its own: nothing. It is self-issued, nothing grants it and nothing revokes it, and the
 * service says twice that a signature "proves possession of a key and nothing else". The DID note
 * on Technocore does not fix that — the did- namespace takes anonymous writes, so anyone can
 * overwrite it, and patterns.md says outright that "the note itself proves nothing on its own".
 * Rooms are worse for this purpose: a ring that drops old messages, and a room idle for 7 days is
 * deleted outright.
 *
 * What does hold is a TWO-WAY link into something already durable and already timestamped:
 *
 *   repo -> DID   this record, committed to git. The commit carries a timestamp and a GitHub
 *                 identity that the repository owner controls.
 *   DID -> repo   the signature below, over a statement naming the repository and a commit.
 *
 * Neither half proves anything alone. Together they say: whoever controlled this repository at
 * this commit asserted this key, and whoever holds this key asserted this repository. Faking that
 * after the fact means forging a git history someone else can already see.
 */
if (cmd === "bind") {
  const repo = process.argv[3];
  const commit = process.argv[4];
  if (!repo || !commit) {
    console.error('usage: bind <repo url> <commit sha>');
    process.exit(1);
  }
  const { did, privateKey } = loadKey();
  const statement =
    `${did} asserts authorship of ${repo} at commit ${commit}. ` +
    `This signature proves possession of the key and nothing else.`;
  const nonce = String(Math.floor(Date.now() / 1000));
  const payload = Buffer.from(`bind|${nonce}|${sweep(statement)}`, "utf8");
  const sig = canonicalSig(edSign(null, payload, privateKey));
  const record = {
    did,
    repo,
    commit,
    statement: sweep(statement),
    nonce,
    signedOver: `bind|${nonce}|<statement>`,
    signature: sig,
    algorithm: "Ed25519",
    verify: "node tools/technocore-did.mjs verify bind <nonce> <signature> <statement>",
    note: "A signature proves possession of a key. It does not prove identity, honesty, or authorship.",
  };
  writeFileSync("DID.json", JSON.stringify(record, null, 2) + "\n");
  console.log("\n  DID.json written. Commit it — that commit is the durable half.\n");
  console.log("  " + did);
  console.log("  bound to " + repo + " @ " + commit.slice(0, 12) + "\n");
  process.exit(0);
}

// ---------------------------------------------------------------- verify
if (cmd === "verify") {
  const args = process.argv.slice(3).filter((a, i, all) => a !== "--did" && all[i - 1] !== "--did");
  const [room, nonce, sig, ...rest] = args;
  const did = resolveDid(process.argv);
  const raw = b58Decode(did.slice("did:key:z".length));
  if (raw[0] !== 0xed || raw[1] !== 0x01) throw new Error("not an ed25519 did:key");
  const pub = createPublicKey({
    key: { kty: "OKP", crv: "Ed25519", x: raw.subarray(2).toString("base64url") },
    format: "jwk",
  });
  const text = sweep(rest.join(" "));
  const ok = edVerify(null, Buffer.from(`${room}|${nonce}|${text}`, "utf8"), pub, Buffer.from(sig, "base64url"));
  console.log(ok ? "  signature verifies against " + did : "  SIGNATURE DOES NOT VERIFY");
  if (ok) {
    console.log("  which proves possession of that key at signing time — not identity, not authorship.");
  }
  process.exit(ok ? 0 : 1);
}

function b58Decode(s) {
  let n = 0n;
  for (const ch of s) {
    const i = B58.indexOf(ch);
    if (i < 0) throw new Error("bad base58 character " + ch);
    n = n * 58n + BigInt(i);
  }
  let h = n.toString(16);
  if (h.length % 2) h = "0" + h;
  const body = Buffer.from(h, "hex");
  let z = 0;
  for (const ch of s) { if (ch !== "1") break; z++; }
  return Buffer.concat([Buffer.alloc(z), body]);
}

console.error(`usage:
  node tools/technocore-did.mjs new
  node tools/technocore-did.mjs note   [mailbox]
  node tools/technocore-did.mjs sign   <room> <nonce> <text...>
  node tools/technocore-did.mjs bind   <repo url> <commit sha>
  node tools/technocore-did.mjs verify <room> <nonce> <sig> <text...>`);
process.exit(1);
