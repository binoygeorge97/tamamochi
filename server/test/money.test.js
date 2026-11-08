// Mochi's Money World (Nov 8, the PNC track): the wallet, the money card's three indicators and forecast, "what if"
// acted out with the real numbers, Cocoa's loan with a dollar of interest, and teaching Mimi a money rule.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import WebSocket from "ws";
import { moneyIntent, moneyState, moneyCard, whatIf, whatIfScene, applyPick, forecast, earn, repay, loanDue, logIt, amountIn, ruleOf, mimiLearned } from "../money.js";
import { createServer } from "../index.js";

test("what they say: the card, what if, buying, the allowance, lending, earning; not the scam game", () => {
  for (const t of ["how's my money?", "show me my wallet", "how am I doing with my money?", "what's my budget?", "money card", "how much money do I have?"]) assert.equal((moneyIntent(t) || {}).kind, "card", t);
  const w = moneyIntent("what if I buy the cupcake?"); assert.equal(w.kind, "whatif"); assert.equal(w.treat.name, "cupcake"); assert.equal(w.price, 3);
  assert.equal(moneyIntent("should I buy a toy for $10?").price, 10);
  assert.deepEqual(moneyIntent("what if I save $2 every week?"), { kind: "whatif_save", amount: 2 });
  assert.equal(moneyIntent("buy a cupcake from Mimi").kind, "buy");
  assert.equal(moneyIntent("here's my allowance").kind, "allowance");
  assert.equal(moneyIntent("I get $5 a week allowance").amount, 5);
  const l = moneyIntent("Cocoa wants to borrow money"); assert.equal(l.kind, "lend"); assert.equal(l.who, "cocoa"); assert.equal(l.asked, "them");
  assert.equal(moneyIntent("lend Cocoa $3").amount, 3);
  assert.equal(moneyIntent("how can I earn money?").kind, "earn_how");
  assert.equal(moneyIntent("teach me about money").kind, "teach_money");
  assert.equal(moneyIntent("put my money in the piggy bank").kind, "save_all");
  for (const t of ["play the scam game", "is this a scam? you won $1000", "help me save $20 for a kite", "I saved $5", "hi Mochi", "do you like cupcakes?"]) assert.equal(moneyIntent(t), null, t);
  assert.equal(amountIn("five dollars"), 5); assert.equal(amountIn("$2.50"), 2.5);
});

test("a waiting question takes the pick: a number, or words", () => {
  const s = moneyState({ pending: { kind: "whatif", at: Date.now(), w: {} } });
  assert.equal(moneyIntent("2", s).n, 2); assert.equal(moneyIntent("save it instead", s).n, 2); assert.equal(moneyIntent("buy it!", s).n, 1); assert.equal(moneyIntent("a smaller one", s).n, 3);
  assert.equal(moneyIntent("1", moneyState({ pending: { kind: "whatif", at: Date.now() - 11 * 60000, w: {} } })), null, "too late");
  const lo = moneyState({ pending: { kind: "loan", at: Date.now(), who: "cocoa", amount: 5 } });
  assert.equal(moneyIntent("sure!", lo).n, 1); assert.equal(moneyIntent("sorry, no", lo).n, 2);
  assert.equal(ruleOf("save for your bike first"), "goal"); assert.equal(ruleOf("get a cheaper one"), "cheaper");
  assert.equal(mimiLearned("hmm, banana"), null);
});

test("the money card: three indicators and a forecast from what they really saved", () => {
  const now = Date.now();
  let s = moneyState({ wallet: 4 });
  const empty = moneyCard(s, null, now);
  assert.equal(empty.indicators.length, 3); assert.equal(empty.indicators[2].level, "low"); assert.equal(empty.forecast, null, "no saves yet: no made-up date");
  assert.match(empty.next, /save up for/);
  for (const a of [3, 3, 2]) logIt(s, "save", a, "kite", now - 1000);
  logIt(s, "spend", 3, "cupcake", now - 500);
  const sv = { goal: "kite", target: 20, saved: 8 };
  const c = moneyCard(s, sv, now);
  assert.equal(c.indicators[0].level, "good", "three saves this week");
  assert.equal(c.indicators[1].level, "good", "saved $8, spent $3");
  assert.equal(forecast(s, sv).steps, Math.ceil(12 / (8 / 3)));
  assert.match(c.forecast, /more saves? to the kite/);
  assert.equal(c.piggy.saved, 8); assert.equal(c.wallet, 4);
});

test("what if: both futures from the real numbers; the pick is applied for real", () => {
  const sv = { goal: "kite", target: 20, saved: 10 };
  let m = moneyState({ wallet: 8 }); logIt(m, "save", 2, "kite");
  const w = whatIf(m, sv, { treat: { name: "cupcake", price: 3, prop: "cupcake", food: true }, price: 3 });
  assert.equal(w.can, true);
  assert.match(w.buyLine, /from \$8 to \$5/); assert.match(w.buyLine, /still \$10 away/);
  assert.match(w.saveLine, /piggy bank goes to \$13/); assert.match(w.saveLine, /only \$7 away/);
  assert.equal(w.choices.length, 3);
  const sc = whatIfScene(w); assert.equal(sc.waits, "choice"); assert.ok(sc.beats.at(-1).choices.length === 3); assert.equal(sc.beats[0].with, "cupcake");
  m.pending = { kind: "whatif", w, at: Date.now() };
  const saved = applyPick(m, sv, 2); assert.equal(saved.money.wallet, 5); assert.equal(saved.savingsAdd, 3);
  m.pending = { kind: "whatif", w, at: Date.now() };
  const bought = applyPick(moneyState({ ...m, wallet: 8 }), sv, 1); assert.equal(bought.money.wallet, 5); assert.equal(bought.savingsAdd, 0); assert.ok(bought.scene.beats.some((b) => b.do === "eat"));
  const small = applyPick(moneyState({ wallet: 8, pending: { kind: "whatif", w, at: Date.now() } }), sv, 3); assert.equal(small.money.wallet, 5, "a $1 cookie and $2 saved"); assert.equal(small.savingsAdd, 2);
  const poor = whatIf(moneyState({ wallet: 1 }), sv, { treat: { name: "toy", price: 8, prop: "present" }, price: 8 });
  assert.equal(poor.can, false); assert.match(poor.buyLine, /need \$7 more/); assert.match(poor.choices[0].text, /job/);
});

test("earning (once a minute), and Cocoa's loan comes back with a dollar of interest", () => {
  const t0 = 1_000_000_000_000;
  let e = earn(null, "job", "working as a chef", t0); assert.equal(e.amount, 3); assert.equal(e.money.wallet, 3);
  assert.equal(earn(e.money, "chore", "tidying up", t0 + 20000), null, "not a slot machine");
  e = earn(e.money, "chore", "tidying up", t0 + 61000); assert.equal(e.money.wallet, 5);
  const m = e.money; m.pending = { kind: "loan", who: "cocoa", amount: 4, at: t0 };
  const lent = applyPick(m, null, 1, t0 + 62000); assert.equal(lent.money.wallet, 1); assert.deepEqual([lent.money.loan.amount, lent.money.loan.back], [4, 5]);
  assert.equal(loanDue(lent.money, t0 + 63000), false);
  lent.money.loan.turns = 2;
  assert.equal(loanDue(lent.money, t0 + 62000 + 91000), true);
  const back = repay(lent.money, t0 + 200000); assert.equal(back.money.wallet, 6); assert.equal(back.money.loan, null); assert.ok(back.scene.beats.some((b) => /interest/.test(b.line || "")));
});

test("the chat: a job pays, the card, a what-if scene that waits, the pick, then Mimi asks and remembers", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-money-"));
  const fetchImpl = async (url) => url.endsWith("/models") ? new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] })) : new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "Yay!" }, finish_reason: "stop" }] }));
  const S = await createServer({ db: path.join(dir, "m.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, feelings: null, fetchImpl, cloud: false, skitRandom: () => 1 });
  const base = `http://127.0.0.1:${S.port}`;
  const ws = new WebSocket(`ws://127.0.0.1:${S.port}/ws`), got = [];
  ws.on("message", (raw) => { try { const m = JSON.parse(String(raw)); if (m.type === "skit") got.push(m); } catch (_) { /* fine */ } });
  await new Promise((r) => ws.on("open", r));
  const chat = async (text, id) => (await fetch(base + "/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, id }) })).json();
  const scene = async (n) => { for (let i = 0; i < 80 && got.length < n; i++) await new Promise((r) => setTimeout(r, 100)); return got[n - 1]; };
  try {
    let r = await chat("help me save $20 for a kite", "1"); assert.equal(r.savings.event, "goal");
    r = await chat("be a chef", "2"); assert.equal(r.money.earned, 3, "a job pays $3");
    r = await chat("here's my allowance", "3"); assert.equal(r.money.earned, 5);
    r = await chat("put $4 in the piggy bank", "4"); assert.equal(r.savings.saved, 4);
    let card = await (await fetch(base + "/api/money")).json(); assert.equal(card.wallet, 4, "the $4 came out of the wallet"); assert.equal(card.piggy.saved, 4);
    r = await chat("how's my money?", "5"); assert.ok(r.reply.moneyCard); assert.equal(r.reply.moneyCard.indicators.length, 3); assert.ok(r.reply.text);
    r = await chat("what if I buy the cupcake?", "6");
    const wi = await scene(1); assert.equal(wi.waits, "choice"); assert.ok(wi.things.cupcake, "the cupcake is on stage at once"); assert.ok(wi.beats.some((b) => /from \$4 to \$1/.test(b.line || "")));
    r = await chat("2", "7"); assert.equal(r.savings.saved, 7, "saved instead: $3 in the piggy bank");
    const after = await scene(2); assert.ok(after.beats.some((b) => /sparkly bow/.test(b.line || "")), "Mimi asks for advice"); assert.equal(after.waits, "choice");
    r = await chat("save for your bike first!", "8");
    const learned = await scene(3); assert.ok(learned.beats.some((b) => /remember/.test(b.line || "")));
    card = await (await fetch(base + "/api/money")).json(); assert.equal(card.wallet, 1);
    r = await chat("what if I buy a cookie?", "9");
    const again = await scene(4); assert.ok(again.beats.some((b) => /I remember what you taught me/.test(b.line || "")), "next time she uses the rule");
    r = await chat("tell me a joke", "10"); assert.equal(r.reply.moneyCard, undefined, "an unanswered what-if is dropped");
  } finally { ws.close(); await S.close(); }
});

test("everyday lines aren't money (Nov 8 bug sweep)", () => {
  for (const t of ["what if you get sick?", "what if we get lost in the forest?", "what if I get a dog?", "what if we save the princess?", "what if we put the toys away every night?",
    "can Mimi borrow your umbrella?", "Cocoa borrowed my pencil", "I don't get an allowance", "my mom stopped my allowance", "can I have a cookie?", "I'll have an apple please",
    "let's get pizza", "show me the money!", "check out my coins collection", "what's my budget for the trip?", "I don't want to buy a cupcake"]) assert.equal(moneyIntent(t), null, t);
  assert.equal(moneyIntent("should I buy a new bike?").kind, "whatif_price", "a thing with no price: he asks what it costs");
  assert.equal(moneyIntent("what if I spend all my money?").all, true);
  const pend = moneyState({ pending: { kind: "whatif", at: Date.now(), w: {} } });
  assert.equal(moneyIntent("what if I buy a toy instead?", pend).kind, "whatif", "a new question isn't the pick");
  const lo = moneyState({ pending: { kind: "loan", at: Date.now(), who: "cocoa", amount: 5 } });
  assert.equal(moneyIntent("no, just $2", lo).n, 3); assert.equal(moneyIntent("just say no", lo).n, 2); assert.equal(moneyIntent("I don't know", lo), null);
  assert.equal(ruleOf("you should save"), "goal"); assert.equal(ruleOf("buy the bow, it's fine"), "treat");
  assert.equal(earn(null, "allowance", "allowance", Date.now(), 10).amount, 10, "the allowance they said");
});

test("what if, at the edges: a goal already reached, an empty wallet, a stale pick", () => {
  const done = whatIf(moneyState({ wallet: 5 }), { goal: "kite", target: 20, saved: 20 }, { treat: { name: "cupcake", price: 3 }, price: 3 });
  assert.doesNotMatch(done.buyLine, /\$0 away/); assert.match(done.saveLine, /already have enough/);
  const broke = whatIf(moneyState({ wallet: 0 }), { goal: "kite", target: 20, saved: 4 }, { treat: { name: "cupcake", price: 3 }, price: 3 });
  assert.match(broke.saveLine, /wallet is empty/); assert.doesNotMatch(broke.saveLine, /goes to \$7/, "can't save money you don't have");
  const some = whatIf(moneyState({ wallet: 2 }), { goal: "kite", target: 20, saved: 4 }, { treat: { name: "toy", price: 8 }, price: 8 });
  assert.match(some.saveLine, /goes to \$6/);
  const w = whatIf(moneyState({ wallet: 5 }), null, { treat: { name: "cupcake", price: 3, prop: "cupcake" }, price: 3 });
  const stale = applyPick(moneyState({ wallet: 1, pending: { kind: "whatif", w, at: Date.now() } }), null, 1);
  assert.equal(stale.money.wallet, 1, "the wallet went down since they asked: no buying into the red");
  assert.equal(applyPick(moneyState({ wallet: 3, pending: { kind: "whatif", at: Date.now() } }), null, 1).note, "", "an old pending with no what-if in it does nothing");
});

test("the chat: a new goal keeps the piggy bank; Cocoa pays back with the extra dollar after his loan is due", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-money2-"));
  const fetchImpl = async (url) => url.endsWith("/models") ? new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] })) : new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "Okay!" }, finish_reason: "stop" }] }));
  const S = await createServer({ db: path.join(dir, "m.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, feelings: null, fetchImpl, cloud: false, skitRandom: () => 1 });
  const base = `http://127.0.0.1:${S.port}`;
  const ws = new WebSocket(`ws://127.0.0.1:${S.port}/ws`), got = [];
  ws.on("message", (raw) => { try { const m = JSON.parse(String(raw)); if (m.type === "skit") got.push(m); } catch (_) { /* fine */ } });
  await new Promise((r) => ws.on("open", r));
  const chat = async (text, id) => (await fetch(base + "/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, id }) })).json();
  const scene = async (n) => { for (let i = 0; i < 80 && got.length < n; i++) await new Promise((r) => setTimeout(r, 100)); return got[n - 1]; };
  try {
    await chat("help me save $20 for a kite", "1"); await chat("I saved $7", "2");
    let r = await chat("help me save $30 for a bike", "3"); assert.equal(r.savings.saved, 7, "the $7 is still in the piggy bank");
    await chat("here's my $10 allowance", "4");
    r = await chat("Cocoa wants to borrow money", "5"); const ask = await scene(1); assert.equal(ask.waits, "choice");
    r = await chat("1", "6"); await scene(2); let card = await (await fetch(base + "/api/money")).json(); assert.equal(card.wallet, 5); assert.equal(card.loan.back, 6);
    // two turns and 90 s later: make it due, then a plain turn brings Cocoa back with $6
    const m = S.memory.get("money", null); S.memory.set("money", { ...m, loan: { ...m.loan, at: Date.now() - 120000, turns: 1 } });
    r = await chat("hi Mochi", "7");
    const back = await scene(3); assert.match(back.title, /pays back/); assert.ok(back.beats.some((b) => /interest/.test(b.line || "")));
    card = await (await fetch(base + "/api/money")).json(); assert.equal(card.wallet, 11); assert.equal(card.loan, null);
    // a what-if pick whose pending is broken doesn't hang the chat (falls through to the usual chat)
    S.memory.set("money", { ...S.memory.get("money", null), pending: { kind: "whatif", at: Date.now(), w: null } });
    r = await chat("2", "8"); assert.ok(r.reply, "still answers");
  } finally { ws.close(); await S.close(); }
});

test("day zero: he knows nothing about money; the first money talk downloads his money skill pack (once)", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-money3-"));
  const fetchImpl = async (url) => url.endsWith("/models") ? new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] })) : new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "Okay!" }, finish_reason: "stop" }] }));
  const S = await createServer({ db: path.join(dir, "m.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, feelings: null, fetchImpl, cloud: false, skitRandom: () => 1 });
  const base = `http://127.0.0.1:${S.port}`;
  const ws = new WebSocket(`ws://127.0.0.1:${S.port}/ws`), skills = [];
  ws.on("message", (raw) => { try { const m = JSON.parse(String(raw)); if (m.type === "skill") skills.push(m); } catch (_) { /* fine */ } });
  await new Promise((r) => ws.on("open", r));
  const chat = async (text, id) => (await fetch(base + "/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, id }) })).json();
  try {
    let r = await chat("be a chef", "1"); assert.equal(r.money, undefined, "a job for fun on day zero pays nothing: he doesn't know money yet"); assert.equal(skills.length, 0);
    r = await chat("how's my money?", "2");
    assert.equal(r.reply.download.skill, "money smarts"); assert.ok(r.reply.download.items.length >= 5); assert.match(r.reply.download.before, /don't know anything about money/);
    assert.equal(skills.length, 1, "the card plays over the socket too");
    r = await chat("how's my money?", "3"); assert.equal(r.reply.download, undefined, "only once");
    const g = await (await fetch(base + "/api/growth")).json(); assert.ok(g.skills.includes("money smarts"));
    await fetch(base + "/api/skills/forget", { method: "POST" });
    r = await chat("help me save $20 for a kite", "4"); assert.equal(r.reply.download.skill, "money smarts", "the piggy bank is money too");
    await fetch(base + "/api/skills/forget", { method: "POST" });
    r = await chat("Be a chef and earn $3", "5"); assert.equal(r.reply.download.skill, "money smarts", "a job to earn: he learns money first"); assert.equal(r.money.earned, 3);
  } finally { ws.close(); await S.close(); }
});

test("money skits: each ends on a question with buttons; every answer is explained; a right one earns $1", async () => {
  const { MONEY_SKITS, skitScene, skitAnswer, skitReveal, pickSkit } = await import("../money.js");
  assert.ok(MONEY_SKITS.length >= 4);
  for (const k of MONEY_SKITS) {
    const sc = skitScene(k); assert.equal(sc.waits, "choice"); assert.ok(sc.beats.at(-1).choices.length >= 2, k.id);
    assert.ok(sc.beats.at(-2).line.endsWith("?"), `${k.id}: the question is said before the buttons`);
    for (const c of k.choices) { const a = skitAnswer(k.id, c.n); assert.ok(a.scene.beats.length >= 2, `${k.id} ${c.n}`); assert.equal(a.right, c.n === k.right); }
    assert.ok(skitReveal(k.id).beats.length >= 2);
  }
  assert.notEqual(pickSkit(["needs", "stand", "patient"]).id, "needs", "one not played lately");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-money4-"));
  const fetchImpl = async (url) => url.endsWith("/models") ? new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] })) : new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "Ooh!" }, finish_reason: "stop" }] }));
  const S = await createServer({ db: path.join(dir, "m.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, feelings: null, fetchImpl, cloud: false, skitRandom: () => 1 });
  const base = `http://127.0.0.1:${S.port}`;
  const ws = new WebSocket(`ws://127.0.0.1:${S.port}/ws`), got = [];
  ws.on("message", (raw) => { try { const m = JSON.parse(String(raw)); if (m.type === "skit") got.push(m); } catch (_) { /* fine */ } });
  await new Promise((r) => ws.on("open", r));
  const chat = async (text, id) => (await fetch(base + "/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, id }) })).json();
  const scene = async (n) => { for (let i = 0; i < 120 && got.length < n; i++) await new Promise((r) => setTimeout(r, 100)); return got[n - 1]; };
  try {
    let r = await chat("do a money skit", "1"); assert.ok(r.reply.download, "day zero: the money pack first");
    const sk = await scene(1); assert.equal(sk.waits, "choice");
    const id = S.memory.get("money", null).pending.id, k = MONEY_SKITS.find((x) => x.id === id);
    r = await chat(String(k.right), "2"); assert.equal(r.money.earned, 1, "a smart answer earns $1");
    const ans = await scene(2); assert.match(ans.title, /the answer/); assert.equal(ans.waits, null, "and it ends");
    r = await chat("again", "3"); const sk2 = await scene(3); assert.notEqual(sk2.title, sk.title, "another one");
    const w = await (await fetch(base + "/api/scam/wrap", { method: "POST" })).json(); assert.match(w.skit.title, /the answer/, "nobody answered: he says it himself");
  } finally { ws.close(); await S.close(); }
});

test("Mochi Bank: deposits earn interest weekly; the growth chart; giving; coming up on the card", async () => {
  const { growth, accrue, moneyState: ms, moneyCard: mc, moneyIntent: mi } = await import("../money.js");
  const g = growth(10, 10); assert.equal(g.bank.length, 11); assert.equal(g.end, 16.29); assert.equal(g.piggy, 10);
  const s = ms({ bank: { balance: 10, paidAt: Date.now() - 15 * 86400000 } }); assert.equal(accrue(s), 1.03, "two whole weeks: 10 → 10.50 → 11.03"); assert.equal(accrue(s), 0, "paid once");
  for (const t of ["I went to the bank with my mom", "the river bank was muddy", "put $4 in the piggy bank"]) assert.equal(mi(t), null, t);
  assert.equal(mi("What if I keep $10 in the bank for 10 weeks?").kind, "grow");
  const card = mc({ wallet: 2, bank: { balance: 10, paidAt: Date.now() }, loan: { who: "cocoa", amount: 5, back: 6, at: Date.now(), turns: 0 }, shared: 1 }, null);
  assert.equal(card.bank.balance, 10); assert.equal(card.shared, 1); assert.ok(card.upcoming.some((x) => /Cocoa pays you back \$6/.test(x))); assert.ok(card.upcoming.some((x) => /\+\$0\.50/.test(x)));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-money5-"));
  const fetchImpl = async (url) => url.endsWith("/models") ? new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] })) : new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "Ooh!" }, finish_reason: "stop" }] }));
  const S = await createServer({ db: path.join(dir, "m.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, feelings: null, fetchImpl, cloud: false });
  const chat = async (text, id) => (await fetch(`http://127.0.0.1:${S.port}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, id }) })).json();
  try {
    await chat("here's my $10 allowance", "1");
    let r = await chat("Put $3 in Mochi Bank", "2"); assert.equal(r.reply.moneyCard.bank.balance, 3); assert.equal(r.reply.moneyCard.wallet, 7); assert.equal(r.moneyProp.name, "little bank");
    r = await chat("What if I keep $10 in the bank for 10 weeks?", "3"); assert.equal(r.reply.growthCard.end, 16.29);
    r = await chat("Donate $1 to the animal shelter", "4"); assert.equal(r.moneyProp.name, "three money jars");
    r = await chat("take $2 out of the bank", "5"); const c = await (await fetch(`http://127.0.0.1:${S.port}/api/money`)).json();
    assert.equal(c.bank.balance, 1); assert.equal(c.wallet, 8); assert.equal(c.shared, 1);
    r = await chat("Donate $50 to the animal shelter", "6"); assert.equal((await (await fetch(`http://127.0.0.1:${S.port}/api/money`)).json()).wallet, 8, "can't give what you don't have");
  } finally { await S.close(); }
});

test("a topic named picks its skit", async () => {
  const { moneyIntent: mi, pickSkit: ps } = await import("../money.js");
  for (const [t, id] of [["Do a skit about interest", "interest"], ["Do a money skit about the bank", "interest"], ["do a skit about sharing", "share"], ["do a skit about free trials", "trial"], ["do a skit about needs and wants", "needs"], ["do a skit about receipts", "receipt"]]) {
    const w = mi(t); assert.equal(w.kind, "skit", t); assert.equal(ps([], Math.random, w.topic).id, id, t);
  }
  assert.equal(mi("do a money skit").topic, null, "no topic: one not played lately");
  assert.equal(mi("do a skit about scams"), null, "still the scam game");
});
