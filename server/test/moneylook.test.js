// Money props that show what's inside, and every transaction as a moment on stage (Nov 8: shared/money-look.js, the
// "pay" beats in money.js, the drawer in kit/src/moving.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "../index.js";

const C = await import("../../shared/craft.js");
const { moneyLook, lookState, fillLevel } = await import("../../shared/money-look.js");
const ALL = Object.values(C.PROP_EXAMPLES).flat();
const get = (n) => ALL.find((x) => x.name === n);
const labels = (r) => r.parts.map((p) => p.label || "");
const st = (o = {}) => ({ wallet: 0, saved: 0, target: 20, goal: "kite", bank: 0, shared: 0, spentWeek: 0, pays: 0, ...o });

test("how full: 0 when empty, 1 to 4 by the share of full", () => {
  assert.equal(fillLevel(0, 20), 0); assert.equal(fillLevel(1, 20), 1); assert.equal(fillLevel(10, 20), 2); assert.equal(fillLevel(19, 20), 4); assert.equal(fillLevel(50, 20), 4);
  assert.equal(fillLevel(3, null), 2, "no target: half full");
});

test("each money prop shows its numbers, stays valid, never grows parts, and the pattern isn't changed", () => {
  const names = ["savings jar", "piggy bank", "three money jars", "little bank", "cash register", "growing money tree", "wallet"];
  const before = JSON.stringify(names.map(get));
  for (const n of names) for (const s of [st(), st({ wallet: 3, saved: 7, bank: 10, shared: 1, spentWeek: 3, pays: 1 }), st({ wallet: 12, saved: 20, bank: 30, shared: 6, spentWeek: 5, pays: 6 })]) {
    const d = moneyLook(get(n), s), v = C.validateProp(d);
    assert.ok(v.ok, `${n}: ${JSON.stringify(v.errors || [])}`); assert.deepEqual(v.warnings || [], [], n);
    assert.ok(d.parts.length <= get(n).parts.length, n);
  }
  assert.equal(JSON.stringify(names.map(get)), before, "moneyLook works on a copy");
  // the piggy bank: no coin in the slot when it's empty; a sparkling one when the goal is reached
  assert.ok(!labels(moneyLook(get("piggy bank"), st())).includes("coin"));
  assert.ok(labels(moneyLook(get("piggy bank"), st({ saved: 20 }))).includes("coin sparkle"));
  // the savings jar: the pile grows with what's saved, the top coins sit on it
  const pile = (s) => moneyLook(get("savings jar"), s).parts.find((p) => p.label === "coin pile");
  assert.equal(pile(st()), undefined); assert.ok(pile(st({ saved: 5 })).size[1] < pile(st({ saved: 15 })).size[1]);
  const jar = moneyLook(get("savings jar"), st({ saved: 5 })), top = jar.parts.find((p) => p.label === "top coin"), pl = jar.parts.find((p) => p.label === "coin pile");
  assert.ok(Math.abs(top.at[1] - (pl.at[1] + pl.size[1] / 2)) < 0.06, "the top coin sits on the pile");
  assert.ok(!labels(jar).includes("sparkle")); assert.ok(labels(moneyLook(get("savings jar"), st({ saved: 20 }))).includes("sparkle"));
  // three jars: spend = wallet, save = piggy, share = given
  const jars = moneyLook(get("three money jars"), st({ wallet: 10, saved: 0, shared: 1 }));
  assert.ok(labels(jars).includes("spend money")); assert.ok(!labels(jars).includes("save money")); assert.ok(labels(jars).includes("share money"));
  // Mochi Bank: money behind the door, the star spins only while money grows
  assert.ok(!labels(moneyLook(get("little bank"), st())).includes("star spinner")); assert.ok(!labels(moneyLook(get("little bank"), st())).includes("money inside"));
  assert.ok(labels(moneyLook(get("little bank"), st({ bank: 3 }))).includes("star spinner"));
  // the register's drawer has cash once something was bought; the tree grows a coin per interest payment
  assert.ok(!labels(moneyLook(get("cash register"), st())).includes("drawer cash")); assert.ok(labels(moneyLook(get("cash register"), st({ spentWeek: 2 }))).includes("drawer cash"));
  const coins = (p) => labels(moneyLook(get("growing money tree"), st({ pays: p }))).filter((l) => l === "money coin").length;
  assert.deepEqual([0, 1, 2, 9].map(coins), [1, 2, 3, 5]);
  // the wallet: no play money peeking out when it's empty
  assert.ok(!labels(moneyLook(get("wallet"), st())).includes("play money peeking out")); assert.ok(labels(moneyLook(get("wallet"), st({ wallet: 6 }))).includes("second bill"));
  // anything else comes back as it is
  assert.equal(moneyLook(get("umbrella") || ALL[0], st()), get("umbrella") || ALL[0]);
});

test("the look from the money state: this week's spending, interest payments, the goal", () => {
  const now = Date.now(), iso = (ms) => new Date(now - ms).toISOString();
  const L = lookState({ wallet: 4, bank: { balance: 12 }, shared: 1, log: [{ at: iso(1000), kind: "spend", amount: 3 }, { at: iso(9 * 86400000), kind: "spend", amount: 5 }, { at: iso(2000), kind: "interest", amount: 0.5 }] }, { goal: "kite", target: 20, saved: 7 }, now);
  assert.deepEqual(L, { wallet: 4, saved: 7, target: 20, goal: "kite", bank: 12, shared: 1, spentWeek: 3, pays: 1 });
  assert.equal(lookState(null, null).bank, 0);
});

test("every transaction is a moment: pay beats, the receipt, the IOU, the bank door, the money tree", async () => {
  const M = await import("../money.js");
  const beat = (sk, k) => sk.beats.find((b) => b.do === "pay" && b.kind === k);
  // buying a cupcake: pay at the stand, then the receipt with what's left
  let s = M.moneyState({ wallet: 5 }); const w = M.whatIf(s, null, { treat: M.treatIn("cupcake"), price: 3 }); s.pending = { kind: "whatif", w, at: Date.now() };
  let r = M.applyPick(s, null, 1);
  assert.equal(beat(r.scene, "spend").amount, 3); assert.equal(beat(r.scene, "spend").wallet, 2);
  const receipt = r.scene.beats.find((b) => b.do === "show" && b.with === "receipt"); assert.match(receipt.line, /cupcake, \$3\. \$2 left/);
  assert.ok(r.scene.beats.indexOf(beat(r.scene, "spend")) < r.scene.beats.indexOf(receipt), "pay, then the receipt");
  // lending: the coins go to Cocoa, an IOU; paying back: the money returns
  s = M.moneyState({ wallet: 6, pending: { kind: "loan", who: "cocoa", amount: 5, at: Date.now() } }); r = M.applyPick(s, null, 1);
  assert.equal(beat(r.scene, "lend").to, "cocoa"); assert.match(r.scene.beats.find((b) => b.with === "receipt").line, /IOU: "Cocoa owes Mochi \$6\."/);
  const back = M.repay(r.money); assert.equal(beat(back.scene, "repay").amount, 6); assert.equal(beat(back.scene, "repay").wallet, 7);
  // Mochi Bank: out comes the bank, its door opens, the money goes in
  const d = M.depositScene(3, 3, 7); assert.deepEqual(d.beats.slice(0, 3).map((b) => b.do), ["show", "use", "pay"]); assert.equal(d.beats[0].with, "little bank");
  assert.equal(beat(M.withdrawScene(2, 1, 8), "withdraw").wallet, 8);
  assert.equal(beat(M.shareScene(1, 1), "share").amount, 1); assert.equal(M.shareScene(1, 1).beats[0].with, "three money jars");
  const i = M.interestScene(0.5, 10.5); assert.equal(i.beats[0].with, "growing money tree"); assert.equal(beat(i, "interest").amount, 0.5);
  // the page has time for them
  const { skitMs } = await import("../skits.js"); assert.ok(skitMs(d) > skitMs({ beats: d.beats.filter((b) => b.do !== "pay") }));
});

test("on the server: the props come dressed, the scene's props too, and /api/money says what they show", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-look-"));
  const fetchImpl = async (url) => url.endsWith("/models") ? new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] })) : new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "Ooh!" }, finish_reason: "stop" }] }));
  const S = await createServer({ db: path.join(dir, "m.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, feelings: null, fetchImpl, cloud: false });
  const chat = async (text, id) => (await fetch(`http://127.0.0.1:${S.port}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, id }) })).json();
  try {
    let r = await chat("what if I buy a cupcake?", "0");
    assert.equal(r.moneyProp.name, "wallet", "an empty wallet comes out"); assert.ok(!r.moneyProp.recipe.parts.some((p) => p.label === "play money peeking out"));
    await chat("here's my $10 allowance", "1");
    r = await chat("Put $3 in Mochi Bank", "2");
    const bank = r.moneyProp.recipe.parts.map((p) => p.label);
    assert.ok(bank.includes("money inside") && bank.includes("star spinner"), "the bank shows the $3 and its star spins");
    const c = await (await fetch(`http://127.0.0.1:${S.port}/api/money`)).json();
    assert.equal(c.look.bank, 3); assert.equal(c.look.wallet, 7); assert.equal(c.spentWeek, 0);
  } finally { await S.close(); }
});

test("a drawer slides out of its front when tapped (the cash register); its knob and cash go with it", { skip: !fs.existsSync(fileURLToPath(new URL("../../kit/node_modules/three/build/three.module.js", import.meta.url))) }, async () => {
  const THREE = await import(fileURLToPath(new URL("../../kit/node_modules/three/build/three.module.js", import.meta.url)));
  const { Movers, kindOf } = await import("../../kit/src/moving.js");
  assert.equal(kindOf("drawer"), "lid"); assert.equal(kindOf("drawer cash"), "lid");
  const reg = moneyLook(get("cash register"), st({ spentWeek: 2 })), g = new THREE.Group();
  for (const p of reg.parts) { const o = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)); o.scale.set(...p.size); o.position.set(...p.at); o.userData.label = p.label || ""; o.userData.part = p; g.add(o); }
  const mv = new Movers(g), at = (l) => g.children.find((o) => o.userData.label === l).position.clone();
  assert.ok(mv.hasLid);
  const z0 = { d: at("drawer").z, k: at("drawer knob").z, c: at("drawer cash").z };
  mv.open(1000); mv.step(1000 + 1000);
  assert.ok(at("drawer").z > z0.d + 0.2, "out it slides"); assert.ok(Math.abs((at("drawer knob").z - z0.k) - (at("drawer").z - z0.d)) < 1e-6, "the knob with it");
  assert.ok(Math.abs((at("drawer cash").z - z0.c) - (at("drawer").z - z0.d)) < 1e-6, "and the cash");
  assert.equal(at("drawer").y, reg.parts.find((p) => p.label === "drawer").at[1], "it slides, it doesn't tip");
  mv.step(1000 + 3000); assert.ok(Math.abs(at("drawer").z - z0.d) < 1e-6, "and back in");
});
