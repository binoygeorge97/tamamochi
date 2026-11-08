// His shelf: small copies of his props, newest first, six at most; a tap finds the one under the finger; the one he's
// holding is missing from it; what he says about each one.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import * as C from "../../shared/craft.js";

const threePath = fileURLToPath(new URL("../../kit/node_modules/three/build/three.module.js", import.meta.url));
const have = fs.existsSync(threePath);
const THREE = have ? await import(threePath) : null;
const SH = have ? await import("../../kit/src/shelf.js") : null;
const SC = have ? await import("../../kit/src/stagecraft.js") : null;
const ex = (n) => Object.values(C.PROP_EXAMPLES).flat().find((e) => e.name === n);

test("what he says about each thing on his shelf", { skip: !have }, () => {
  assert.equal(SH.shelfStory({ name: "umbrella", origin: 'you asked for it on Nov 2: "it\'s pouring"' }), 'My umbrella! You asked me for it on Nov 2, when you said "it\'s pouring".');
  assert.equal(SH.shelfStory({ name: "piggy bank", origin: "you asked for it on Nov 1" }), "My piggy bank! You asked me for it on Nov 1.");
  assert.equal(SH.shelfStory({ name: "gold medal", origin: "I made it on my own: for your interview" }), "My gold medal! I made it on my own, for your interview.");
  assert.equal(SH.shelfStory({ name: "desk globe", origin: "it was in my pocket, and you showed me what to do with it" }), "My desk globe! It was in my pocket, and you showed me what to do with it.");
  assert.equal(SH.shelfStory({ name: "kite", origin: "the day you told me it was windy" }), "My kite! The day you told me it was windy.");
});

test("kit: newest six on the shelf, a tap finds one, the one in his hoof is missing", { skip: !have }, () => {
  const scene = new THREE.Scene(), root = new THREE.Group(), body = new THREE.Group(); scene.add(root); root.add(body);
  const arms = [-1, 1].map((s) => { const a = new THREE.Group(); a.position.set(s * 0.34, 0.74, 0.4); body.add(a); return a; });
  const camera = new THREE.PerspectiveCamera(24, 2, 0.1, 50); camera.position.set(0, 1.64, 7.6); camera.lookAt(0.8, 1.0, 0);
  let spawned = 0;
  const m = { scene, root, body, arms, legs: [], camera, reduce: false, head: new THREE.Group(), neck: new THREE.Group(), P: {}, r: Math.random, ground: { material: { map: null, opacity: 1 }, scale: new THREE.Vector3(1, 1, 1) },
    spawn() { spawned++; }, say() {}, touch() {}, setFace() {}, faceBase: () => 0, queue: [], canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 500 }) }, host: { getBoundingClientRect: () => ({ width: 300, height: 400, left: 350, top: 0 }) } };
  m.craft = new SC.Stagecraft(m);
  const shelf = new SH.Shelf(m);
  assert.equal(shelf.set([]), 0); assert.equal(shelf.group.visible, false, "nothing yet: no shelf");
  const names = ["little blue umbrella", "water pistol", "magenta headphones", "gold medal", "desk globe", "bicycle", "piggy bank"];
  const list = names.map((n, i) => ({ id: i + 1, name: n, recipe: ex(n), origin: "you asked for it on Nov 2" }));
  assert.equal(shelf.set(list), 6, "six fit"); assert.equal(spawned, 0, "the first load doesn't sparkle");
  assert.ok(!shelf.items.some((it) => it.data.name === "little blue umbrella"), "the oldest waits off the shelf");
  assert.equal(shelf.items[0].data.name, "piggy bank", "newest first");
  for (const it of shelf.items) { const b = new THREE.Box3().setFromObject(it.g), sz = b.getSize(new THREE.Vector3()); assert.ok(Math.max(sz.x, sz.y) < 0.45, `${it.data.name} is a small copy`); }
  shelf.step(1000); scene.updateMatrixWorld(true);
  const it = shelf.items[1], p = new THREE.Box3().setFromObject(it.g).getCenter(new THREE.Vector3()).project(camera);
  const hit = shelf.pick((p.x + 1) / 2 * 1000, (1 - p.y) / 2 * 500);
  assert.equal(hit && hit.name, it.data.name, "a tap finds it");
  assert.equal(shelf.pick(5, 5), null);
  m.craft.hold(ex(it.data.name), { quiet: true }); shelf.step(1100);
  assert.ok(it.g.scale.x < 0.01, "while he holds it, its spot is empty");
  shelf.set([{ id: 99, name: "snowball", recipe: ex("snowball"), origin: "x" }, ...list]);
  assert.ok(spawned >= 4, "a new one arrives with sparkles");
});
