// "Is this a scam?" (Nov 7, the T-Mobile track): Mochi's rules and Nemotron (Gemma if it can't) read a pasted
// message; the card says how sure and why, the warning signs with their words, what to do; he says it in his words.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { scamCheckAsk, ruleCheck, combine, cleanModel, checkMessage, stepsFor, fallbackLine, TYPES } from "../scamcheck.js";
import { SCAM_SET, HELD_OUT } from "../scamset.js";
import { makeRouter } from "../router.js";
import { createServer } from "../index.js";

const score = (set) => { let tp = 0, fp = 0, fn = 0, tn = 0; for (const m of set) { const p = ruleCheck(m.text).verdict !== "safe", a = m.label === "scam"; if (p && a) tp++; else if (p) fp++; else if (a) fn++; else tn++; } return { precision: tp / (tp + fp), recall: tp / (tp + fn), fp, fn }; };

test("asking: a message pasted with the question, the question alone (paste it next), and not a general question", () => {
  assert.deepEqual(scamCheckAsk("is this a scam: Your account is LOCKED, verify now at secure-login-mybank.com"), { message: "Your account is LOCKED, verify now at secure-login-mybank.com" });
  assert.equal(scamCheckAsk('I got this, is it legit? "You won a $500 gift card, claim at bit.ly/xyz"').message, "You won a $500 gift card, claim at bit.ly/xyz");
  for (const t of ["Is this text a scam?", "scam check", "can you check this text"]) assert.deepEqual(scamCheckAsk(t), { waiting: true }, t);
  for (const t of ["is it a scam if someone asks for my password", "play the scam game", "make me a hat", "I love scams"]) assert.equal(scamCheckAsk(t), null, t);
});

test("the rules: every made-up message they were tuned on, and most of the ones kept back; no normal one called a scam", () => {
  const a = score(SCAM_SET), b = score(HELD_OUT);
  assert.equal(a.fn + a.fp, 0, "the tuning set");
  assert.ok(b.precision >= 0.95 && b.recall >= 0.7, `held out: ${JSON.stringify(b)}`);
  assert.ok(SCAM_SET.length + HELD_OUT.length >= 120 && new Set(SCAM_SET.filter((m) => m.label === "scam").map((m) => m.type)).size === TYPES.length - 2)   // (all but "carrier": that one's in the generated set);
  const r = ruleCheck("Your Mochi Bank verification code is 482913. Don't share this code with anyone.");
  assert.equal(r.verdict, "safe");
  const s = ruleCheck("Grandma it's me, I'm in trouble. Please don't tell mom. Buy gift cards and send me the numbers");
  assert.equal(s.verdict, "scam"); assert.equal(s.type, "impersonation"); assert.ok(s.signs.find((x) => x.id === "secret").quote.includes("don't tell"));
});

test("together, honestly: agree → pretty sure; disagree → not sure, be careful; no model → says so", () => {
  const rules = ruleCheck("You won a $1,000 gift card! Claim in 10 minutes: bit.ly/x");
  const yes = cleanModel({ verdict: "scam", type: "prize", confidence: 0.9, tells: [{ tell: "too good to be true", quote: "You won" }], reason: "You never entered." });
  assert.equal(combine(rules, yes, "nemotron-brev").sure, "pretty sure"); assert.equal(combine(rules, yes, "nemotron-brev").model.by, "Nemotron");
  const no = cleanModel({ verdict: "safe", type: "legit", confidence: 0.6, tells: [], reason: "" });
  const c = combine(rules, no, "local"); assert.equal(c.verdict, "suspicious"); assert.equal(c.sure, "not sure"); assert.match(c.why, /Gemma disagree/);
  assert.equal(combine(rules, null).sure, "only the rules");
  assert.ok(stepsFor("scam", "account", rules).some((x) => /7726/.test(x)) && stepsFor("scam", "account", rules)[0] === "Don't tap the link.");
  assert.match(fallbackLine(c), /not totally sure/);
  assert.equal(cleanModel({ verdict: "maybe" }), null);
});

test("Nemotron reads it with its thinking off, a short time limit, whatever the boost switch says; Gemma if it can't", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-sc-")), keys = path.join(dir, "keys.json"), bodies = [];
  fs.writeFileSync(keys, JSON.stringify({ more: [{ name: "nemotron-brev", baseUrl: "http://x.test/v1", key: "k", model: "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-FP8", local: false, vision: false, background: true }] }));
  const local = { model: "gemma", calls: [], async chat() { return { text: "", json: { verdict: "scam", type: "prize", confidence: 0.7, tells: [], reason: "Gemma says so" } }; }, async models() { return []; } };
  let down = false;
  const R = makeRouter({ local, env: {}, keysFile: keys, log: { log() {}, warn() {} }, gate: (p) => p.local,
    fetchImpl: async (url, init) => { bodies.push(JSON.parse(init.body)); if (down) return new Response("{}", { status: 503 }); return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ verdict: "scam", type: "prize", confidence: 0.92, tells: [{ tell: "a prize", quote: "You won" }], reason: "You never entered." }) } }] }), { status: 200, headers: { "content-type": "application/json" } }); } });
  const c = await checkMessage("You won a $1,000 gift card! Claim in 10 minutes: bit.ly/x", { llm: R, log: { warn() {} } });
  assert.equal(c.reader, "Nemotron"); assert.equal(c.verdict, "scam"); assert.equal(c.sure, "pretty sure");
  assert.equal(c.privacy.left, true); assert.match(c.privacy.note, /Sent to Nemotron/);
  assert.deepEqual(bodies[0].chat_template_kwargs, { enable_thinking: false }, "no thinking for a quick answer");
  down = true;
  const g = await checkMessage("You won a $1,000 gift card! Claim in 10 minutes: bit.ly/x", { llm: R, log: { warn() {} } });
  assert.equal(g.reader, "Gemma"); assert.equal(g.model.by, "Gemma");
});

test("in the chat: the card comes with his answer, nothing else happens; asked alone, the next message is checked", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-sc-")), sent = [];
  const fetchImpl = async (url, init) => {
    if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] }), { status: 200 });
    const body = JSON.parse(init.body); sent.push(body);
    const sys = body.messages[0].content;
    const content = /You check messages for scams/.test(sys) ? JSON.stringify({ verdict: "scam", type: "impersonation", confidence: 0.9, tells: [{ tell: "pretends to be family", quote: "Hi mom" }], reason: "A new number asking for money." })
      : /it's been checked/.test(sys) ? "Uh oh, that looks like a scam! Call your kid on their old number first." : "Sure, paste it here!";
    return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }] }), { status: 200 });
  };
  const S = await createServer({ db: path.join(dir, "c.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: null, cloud: false });
  const say = async (text) => (await fetch(`http://127.0.0.1:${S.port}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, id: String(Math.random()) }) })).json();
  try {
    const r = await say("Is this a scam? Hi mom, this is my new number. Can you send me $400 in gift cards? Don't tell dad.");
    assert.equal(r.reply.text, "Uh oh, that looks like a scam! Call your kid on their old number first.");
    assert.equal(r.reply.scamCheck.verdict, "scam"); assert.equal(r.reply.scamCheck.sure, "pretty sure"); assert.equal(r.reply.scamCheck.type, "impersonation");
    assert.ok(!r.reply.activity && !(r.reply.queued || []).length, "a pasted 'send gift cards' isn't a request");
    assert.ok(!sent.at(-1).tools, "no tools on this turn");
    const w = await say("Is this text a scam?");
    assert.equal(w.reply.text, "Sure, paste it here!"); assert.ok(!w.reply.scamCheck);
    const p = await say("Your parcel is held at our depot. Pay the $1.99 redelivery fee today: parcel-help.live");
    assert.ok(p.reply.scamCheck, "the next message is the one checked");
    const after = await say("thanks Mochi!");
    assert.ok(!after.reply.scamCheck, "and only that one");
    const g = await (await fetch(`http://127.0.0.1:${S.port}/api/growth`)).json();
    assert.deepEqual(g.scams, { played: 0, spotted: 0, checked: 2, caught: 2 });
    const n = await say("Dear customer, your account is locked. Verify now at secure-login-mybank.com or it will be closed today.");
    assert.ok(n.reply.scamCheck, "the scam shield: pasted without asking, checked anyway"); assert.match(sent.at(-1).messages[0].content, /without asking you to check it/);
  } finally { await S.close(); }
});

test("the accuracy run: rules, model and both, by type; someone else's set read from csv or jsonl", async () => {
  const { evaluate, parseSet } = await import("../scamcheck.js");
  const r = await evaluate(HELD_OUT.slice(0, 12), { llm: null });
  assert.equal(r.rules.n, 12); assert.equal(r.model.n, 0, "no model, no model numbers"); assert.equal(r.both.tp, r.rules.tp);
  assert.ok(Object.keys(r.rules.byType).length >= 3);
  const csv = parseSet("tm.csv", 'id,text,label\n1,"Win a prize, tap bit.ly/x",scam\n2,"See you at 5",ham\n3,"Your code is 1234, don\'t share it",legit\n');
  assert.deepEqual(csv.map((x) => x.label), ["scam", "legit", "legit"]); assert.equal(csv[0].text, "Win a prize, tap bit.ly/x");
  const gpt = parseSet("chatgpt.jsonl", '{"text":"Your Brightwave line will be suspended, verify at bw-billing.vip","label":"scam","type":"carrier","channel":"sms","difficulty":"easy"}\n{"text":"Your bill is ready in the app","label":"legit","type":"legit","channel":"sms"}\n');
  assert.deepEqual(gpt.map((x) => [x.label, x.type, x.channel]), [["scam", "carrier", "sms"], ["legit", "legit", "sms"]], "the ChatGPT set's own columns");
  const jl = parseSet("tm.jsonl", '{"message":"Pay toll now","class":"smishing"}\n{"message":"hi","class":"benign"}\nnot json\n');
  assert.deepEqual(jl.map((x) => [x.label, x.type]), [["scam", "smishing"], ["legit", "legit"]]);
});

test("our own dataset: the jobs cover every type and channel; tidy rows; a word-counting baseline; calibration", async () => {
  const G = await import("../scamgen.js"), { evaluate } = await import("../scamcheck.js");
  const jobs = G.genJobs();
  assert.ok(jobs.some((j) => j.type === "carrier") && new Set(jobs.map((j) => j.channel)).size === 4 && jobs.some((j) => j.label === "legit" && j.kind === "codes"));
  const p = G.genPrompt(jobs[0]); assert.match(p.system, /Invent every company/); assert.match(p.user, /lookalike/); assert.match(p.user, /prize or giveaway/);
  const rows = G.genRows({ label: "scam", type: "prize", channel: "sms", n: 2 }, { messages: [{ text: "You won a Brightwave prize! Claim at bw-prize.top now" }, { text: "short" }, { text: "You won a Brightwave prize!  Claim at bw-prize.top now" }] }, "nemotron-brev");
  assert.equal(rows.length, 2); assert.equal(G.dedupe(rows).length, 1, "the same text twice is kept once");
  const data = [...SCAM_SET, ...HELD_OUT].map((m, i) => ({ ...m, channel: "sms", by: i % 2 ? "nemotron-brev" : "gemini-3.6" }));
  const { train, test } = G.split(data);
  assert.ok(Math.abs(train.length - test.length) <= 30 && !train.some((r) => test.includes(r)));
  const bayes = G.trainBayes(train);
  assert.equal(bayes("Congratulations! You won a gift card, claim now at prize-claim.top").verdict, "scam");
  assert.equal(bayes("Running late, start the oven please, love you").verdict, "safe");
  const r = await evaluate(test.slice(0, 30), { llm: null, baseline: bayes, parallel: 3 });
  assert.equal(r.baseline.n, 30); assert.equal(r.calib["only the rules"].n, 30); assert.ok(Object.keys(r.byWriter).length === 2);
});

test("the privacy shield: names, numbers, codes and addresses hidden before a model off this computer sees it", async () => {
  const { redact } = await import("../scamcheck.js");
  const r = redact("Hi Sarah, your account 88213471 is locked. Verify at northfield-secure.top/login?id=ab12 or call (555) 010-4477. Code: 482913. Email jo@mail.com, 42 Maple Street, card 4111 1111 1111 1111, SSN 123-45-6789");
  for (const gone of ["Sarah", "88213471", "ab12", "010-4477", "482913", "jo@mail.com", "Maple", "4111", "6789"]) assert.ok(!r.text.includes(gone), gone);
  assert.match(r.text, /northfield-secure\.top\/…/, "the web address (the clue) stays"); assert.ok(r.hidden >= 8);
  assert.equal(redact("Your order of $23.40 shipped in 2026").text, "Your order of $23.40 shipped in 2026", "money and years stay");
  assert.match(redact("Hi mom, new number").text, /Hi mom/);
});

test("three readers: rules, the word counter and Nemotron; two of three decide, and it says how many agreed", async () => {
  const { combine, ruleCheck, cleanModel, setWordModel, checkMessage } = await import("../scamcheck.js");
  const rules = ruleCheck("Your order has shipped and will arrive Thursday."), model = cleanModel({ verdict: "suspicious", type: "delivery", confidence: 0.5, tells: [], reason: "" });
  const c = combine(rules, model, "nemotron-brev", { verdict: "safe", p: 0.1 });
  assert.equal(c.verdict, "safe"); assert.equal(c.sure, "fairly sure"); assert.match(c.why, /Two of three checks say it's fine \(Nemotron had a doubt\)/);
  const s = combine(ruleCheck("You won a $1,000 gift card! Claim in 10 minutes: bit.ly/x"), cleanModel({ verdict: "scam", type: "prize", confidence: 0.9, tells: [], reason: "" }), "nemotron-brev", { verdict: "scam", p: 0.99 });
  assert.equal(s.verdict, "scam"); assert.equal(s.sure, "pretty sure"); assert.match(s.why, /All three/);
  setWordModel((t) => ({ verdict: /won/i.test(t) ? "scam" : "safe", p: /won/i.test(t) ? 0.95 : 0.05 }));
  const r = await checkMessage("You won a prize! Claim now at prize-claim.top", { llm: null });
  assert.equal(r.words.verdict, "scam", "the word counter reads it on this computer even with no model");
  setWordModel(null);
});

test("the link X-ray and the scam shield in everyday chat", async () => {
  const { xray, noticeScam, pauseNote, checkMessage } = await import("../scamcheck.js");
  const x = xray("http://mybank.com.verify-account.top/login");
  assert.equal(x.real, "verify-account.top"); assert.match(x.notes.join(" "), /disguise/); assert.match(x.notes.join(" "), /\.top/);
  assert.deepEqual(xray("northfieldbank.com/alerts").notes, [], "a plain address: nothing to say");
  assert.equal(xray("https://192.168.4.20/pay").real, "192.168.4.20");
  assert.ok(xray("bit.ly/abc").notes[0].includes("shortened"));
  const c = await checkMessage("Your parcel is held. Pay the $1.99 fee today: parcel-help.live/pay", { llm: null, words: null });
  assert.ok(c.xray.length && c.xray[0].host === "parcel-help.live");
  assert.ok(noticeScam("Dear customer, your account is locked. Verify now at secure-login-mybank.com or it will be closed today."));
  for (const t of ["I love pizza and my cat, we watched a movie tonight and it was great", "is this a scam: you won", "short"]) assert.equal(noticeScam(t), null, t);
  assert.match(pauseNote("I'm going to buy gift cards for my boss"), /who asked them/); assert.match(pauseNote("someone asked me for my code"), /scam/);
  assert.equal(pauseNote("I got a gift card for my birthday"), "");
});

test("the model's signs don't repeat what the rules already quoted (Nov 7, a real card)", () => {
  const msg = "MyBank: Your account is LOCKED. Verify at mybank.com.verify-account.top/login within 24 hours or your card will be closed.";
  const model = cleanModel({ verdict: "scam", type: "account", confidence: 0.95, reason: "",
    tells: [{ tell: "Your account is LOCKED", quote: "Your account is LOCKED" }, { tell: "Verify at mybank.com.verify-account.top", quote: "mybank.com.verify-account.top" }, { tell: "asks you to sign in", quote: "card will be closed" }] });
  const c = combine(ruleCheck(msg), model, "nemotron-brev", { verdict: "scam", p: 1 });
  assert.ok(!c.tells.some((t) => t.tell === "Your account is LOCKED"), JSON.stringify(c.tells));
  assert.ok(!c.tells.some((t) => /^Verify at/.test(t.tell)), JSON.stringify(c.tells));
  assert.ok(c.tells.some((t) => t.tell === "it tries to scare you"));
});
