// The kit's move/prop layer (kit/src/stagecraft.js) on a stand-in body, frame by frame on a fake clock: props land in
// the right slot and stay upright, moves reach their poses and return to rest, interruptions let go smoothly, nothing
// snaps, launchers fire from the muzzle, pats make a move smoother, posing becomes a recipe. Needs kit/node_modules
// (three.js); skipped where the kit's dependencies aren't installed.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const threePath = fileURLToPath(new URL("../../kit/node_modules/three/build/three.module.js", import.meta.url));
const have = fs.existsSync(threePath);
const THREE = have ? await import(threePath) : null;
const SC = have ? await import("../../kit/src/stagecraft.js") : null;
const C = await import("../../shared/craft.js");

let NOW = 1000;
if (have) Object.defineProperty(performance, "now", { value: () => NOW, configurable: true, writable: true });

function fakeMochi() {
  const scene = new THREE.Scene(), root = new THREE.Group(), body = new THREE.Group(), neck = new THREE.Group(), head = new THREE.Group();
  scene.add(root); root.add(body); neck.position.set(0, 1.04, 0.04); body.add(neck); head.position.set(0, 0.54, 0.05); head.scale.setScalar(1.17); neck.add(head);
  const arms = [-1, 1].map((s) => { const a = new THREE.Group(); a.position.set(s * 0.34, 0.74, 0.4); a.userData.side = s; body.add(a); return a; });
  const legs = [-1, 1].map((s) => { const l = new THREE.Group(); l.position.set(s * 0.25, 0.15, 0.24); body.add(l); return l; });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true }));
  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 50); camera.position.set(0, 1.64, 7.6); camera.lookAt(0, 1.28, 0);
  const P = {}; for (const k of ["smile", "blush", "mouthOpen", "ear", "eyeHappy", "bed"]) P[k] = { x: 0, t: 0 };
  let seed = 7; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const m = { scene, root, body, neck, head, arms, legs, ground, camera, P, r, reduce: false, mood: "idle", cur: null, curEnd: 0, queue: [], inBed: false, sulking: false, held: false, duo: { x: 0 },
    spawned: [], said: [], spawn(k) { this.spawned.push(k); }, say(t) { this.said.push(t); }, touch() {}, setFace() {}, faceBase: () => 0, lastActive: 0,
    play(name, ms) { this.cur = name; this.mood = name; this.curEnd = NOW + (ms || 1500); },
    run(steps) { this.queue = steps.slice(); this.next(); },
    next() { const s = this.queue.shift(); if (s && s[0] === "@perf") this.craft.begin(s[1]); else if (s) this.play(s[0], s[1]); else { this.cur = null; this.mood = "idle"; } },
    host: { getBoundingClientRect: () => ({ width: 260, height: 350, left: 0, top: 0 }) }, canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 374, height: 434 }) } };
  // the invisible shapes the kit uses for touches: his head and his body
  m.headHit = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12)); m.headHit.scale.set(0.68, 0.66, 0.6); head.add(m.headHit);
  m.tummy = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12)); m.tummy.scale.set(0.64, 0.66, 0.6); m.tummy.position.y = 0.56; body.add(m.tummy);
  m.craft = new SC.Stagecraft(m);
  return m;
}
// how deep the held prop's parts sit inside his head or body (world units; 0 = clear)
function sunk(m) { m.scene.updateMatrixWorld(true); const o = m.craft.overlap(m.craft.prop); return Math.max(o.head, o.body - 0.15); }   // his head: none; his tummy by the hoof: a little
// one frame of the body: the kit's animate() rests the limbs, then the craft layer goes on top
function frame(m, dt = 1 / 60) {
  NOW += dt * 1000;
  if (m.cur && NOW > m.curEnd) m.next();
  m.craft.pre(NOW, dt);
  m.arms.forEach((a) => a.rotation.set(-0.62, 0, a.userData.side * 0.22));
  m.legs.forEach((l) => l.rotation.set(-Math.PI / 2 + 0.18, 0, 0));
  m.neck.rotation.set(0, 0, 0); m.root.position.set(0, 0, 0); m.root.rotation.set(0, 0, 0); m.body.rotation.set(0, 0, 0); m.ground.scale.set(1, 1, 1);
  m.craft.post(NOW, NOW / 1000, dt);
  m.scene.updateMatrixWorld(true);
}
const run = (m, s, each) => { for (let i = 0; i < Math.round(s * 60); i++) { frame(m); if (each) each(i); } };
const limbs = (m) => [m.arms[0].rotation.x, m.arms[0].rotation.z, m.arms[1].rotation.x, m.arms[1].rotation.z, m.legs[0].rotation.x, m.legs[1].rotation.x];
const ex = (n) => Object.values(C.PROP_EXAMPLES).flat().find((e) => e.name === n);
const mv = (n) => C.MOVE_EXAMPLES.find((e) => e.name === n);

test("props go to their slots; a hat or a vest stays on while he holds, rides or sets down something else", { skip: !have }, () => {
  const m = fakeMochi(), c = m.craft, placed = (P, mount) => !!P && mount.children.includes(P.group);
  let r = c.hold(ex("little blue umbrella"), { quiet: true });
  assert.equal(r.slot, "hand"); assert.ok(placed(c.prop, c.handSpin)); run(m, 0.6); assert.ok(c.prop.group.scale.x > 0.6, "popped in");
  r = c.hold(ex("golden crown"), { quiet: true });
  assert.equal(r.worn, true); assert.ok(placed(c.worn.head, c.headMount)); assert.equal(c.prop.recipe.name, "little blue umbrella", "still holding the umbrella");
  run(m, 0.6); assert.ok(c.worn.head.group.scale.x > 0.6, "the crown popped on");
  r = c.hold(ex("protective vest"), { quiet: true }); assert.equal(r.worn, true); assert.ok(placed(c.worn.body, c.bodyMount));
  r = c.hold(ex("piggy bank"), { quiet: true }); assert.equal(r.slot, "beside"); assert.ok(placed(c.prop, c.beside));
  assert.deepEqual(c.holding().wearing.sort(), ["golden crown", "protective vest"], "the umbrella went back, the crown and vest stayed on");
  r = c.hold(ex("protective helmet"), { quiet: true }); assert.equal(c.worn.head.recipe.name, "protective helmet", "one hat at a time"); assert.equal(c.headProp(), true, "costume hats step aside");
  r = c.hold(ex("skateboard"), { quiet: true }); assert.equal(r.slot, "ride"); run(m, 0.8);
  assert.equal(c.holding().name, "skateboard"); assert.deepEqual(c.holding().wearing.sort(), ["protective helmet", "protective vest"], "helmet on, on the skateboard");
  r = c.hold(ex("confetti popper"), { quiet: true }); assert.equal(r.slot, "hand"); assert.ok(placed(c.prop, c.handSpin));
  // a hat as the only thing: then something for his hoof: the hat stays on
  c.letGo(true); c.takeOff("head", true); c.takeOff("body", true);
  c.hold(ex("party hat"), { quiet: true }); assert.equal(c.prop.slot, "head");
  c.hold(ex("star wand"), { quiet: true }); assert.equal(c.prop.recipe.name, "star wand"); assert.equal(c.worn.head.recipe.name, "party hat");
  c.letGo(false); run(m, 1); assert.equal(c.prop, null); assert.ok(c.worn.head, "the hat is still on for a while");
  run(m, 10); assert.equal(c.worn.head, null); assert.equal(c.leaving.length, 0, "then it comes off, shrunk away and disposed");
});

test("a held upright prop stays upright whatever the arm does; a canopy goes over his head", { skip: !have }, () => {
  const m = fakeMochi(), c = m.craft;
  c.hold(ex("little blue umbrella"), { quiet: true, ms: 60000 });
  run(m, 0.8);
  const up = new THREE.Vector3(), q = new THREE.Quaternion();
  for (const raise of [-0.5, 0, 0.5, 1]) {
    c.play({ name: "t", duration: 2, tracks: { "rightArm.raise": [[0, 0], [0.5, raise], [1.5, raise], [2, 0]], "head.nod": [[0, 0], [1, 0.3], [2, 0]] } }, { skill: 1 });
    run(m, 1.0);
    c.prop.group.getWorldQuaternion(q); up.set(0, 1, 0).applyQuaternion(q);
    assert.ok(up.y > 0.85, `upright at raise ${raise}: ${up.y.toFixed(2)}`);
    run(m, 1.4);
  }
  const top = new THREE.Box3().setFromObject(c.prop.group).max.y;
  assert.ok(top > 2.2, `the canopy is up above his head: top at ${top.toFixed(2)}`);
});

test("a move reaches its pose, comes back to rest, and the mood goes back", { skip: !have }, () => {
  const m = fakeMochi(), c = m.craft, wave = mv("big wave");
  run(m, 0.1);   // the body at rest first
  assert.equal(c.play(wave, { skill: 1, id: 5 }).ok, true);
  let maxRz = -9, prev = limbs(m), maxStep = 0;
  run(m, wave.duration + 0.6, () => { maxRz = Math.max(maxRz, m.arms[1].rotation.z); const l = limbs(m); maxStep = Math.max(maxStep, ...l.map((x, i) => Math.abs(x - prev[i]))); prev = l; });
  assert.ok(maxRz > SC.armRz(1, 0.85), `waved up high (rz ${maxRz.toFixed(2)})`);
  assert.ok(Math.abs(m.arms[1].rotation.z - 0.22) < 0.01, "back at rest");
  assert.equal(c.perf, null); assert.equal(c.lastPerf.id, 5); assert.equal(m.mood, "idle");
  assert.ok(maxStep < 0.3, `no snaps (largest frame step ${maxStep.toFixed(3)} rad)`);
});

test("interrupted mid-spin: lets go within a fifth of a second and lands facing front", { skip: !have }, () => {
  const m = fakeMochi(), c = m.craft;
  c.play({ name: "spin", duration: 3, tracks: { "body.spin": [[0, 0], [2.5, 1], [3, 1]], "leftArm.spread": [[0, 0], [1, 0.8], [3, 0]] } }, { skill: 1 });
  run(m, 1.3);
  const mid = m.root.rotation.y;
  assert.ok(Math.abs(mid) > 1, `mid-turn (${mid.toFixed(2)} rad)`);
  m.play("reading", 2000);   // a new message
  let prev = limbs(m), maxStep = 0;
  run(m, 0.3, () => { const l = limbs(m); maxStep = Math.max(maxStep, ...l.map((x, i) => Math.abs(x - prev[i]))); prev = l; });
  assert.equal(c.perf, null, "released");
  const facing = ((m.root.rotation.y % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  assert.ok(facing < 0.01 || facing > 2 * Math.PI - 0.01, `faces front (${facing.toFixed(3)})`);
  assert.ok(maxStep < 0.35, `smooth release (${maxStep.toFixed(3)})`);
});

test("mood changes cross-fade instead of snapping", { skip: !have }, () => {
  const m = fakeMochi(), c = m.craft;
  run(m, 0.2);
  // the body suddenly wants the arms way up (like the superexcited mood), then back down
  let target = 0, prev = limbs(m), maxStep = 0;
  const orig = c.post.bind(c);
  c.post = (now, t, dt) => { if (target) m.arms.forEach((a) => a.rotation.set(-0.12, 0, a.userData.side * 2.75)); orig(now, t, dt); };
  m.mood = "superexcited"; target = 1;
  run(m, 0.6, () => { const l = limbs(m); maxStep = Math.max(maxStep, ...l.map((x, i) => Math.abs(x - prev[i]))); prev = l; });
  assert.ok(Math.abs(m.arms[1].rotation.z - 2.75) < 0.01, "arrives");
  m.mood = "concerned"; target = 0;
  run(m, 0.6, () => { const l = limbs(m); maxStep = Math.max(maxStep, ...l.map((x, i) => Math.abs(x - prev[i]))); prev = l; });
  assert.ok(Math.abs(m.arms[1].rotation.z - 0.22) < 0.01, "and comes back");
  assert.ok(maxStep < 0.2, `largest frame step ${maxStep.toFixed(3)} rad for a 2.5 rad swing`);
});

test("a launcher fires harmless ammo from its muzzle, along the barrel", { skip: !have }, () => {
  const m = fakeMochi(), c = m.craft;
  c.hold({ ...ex("bubble blaster"), ammo: "water" }, { quiet: true, ms: 60000 });
  run(m, 0.8);
  const muzzle = c.prop.group.localToWorld(c.prop.group.userData.muzzle.clone());
  c.fire();
  assert.ok(c.ammo.length >= 16, `${c.ammo.length} drops`);
  const avg = new THREE.Vector3(); c.ammo.forEach((a) => avg.add(a.vel)); avg.normalize();
  assert.ok(avg.x > 0.4, `out to his side (${avg.x.toFixed(2)})`);
  assert.ok(c.ammo.every((a) => a.mesh.position.distanceTo(muzzle) < 1e-6), "from the muzzle");
  run(m, 2); assert.equal(c.ammo.length, 0, "all gone after their life");
  c.letGo(true); c.fire(); assert.ok(c.ammo.length > 0, "no launcher: confetti from the hoof instead");
});

test("practice: a pat right after a move queues a smoother try", { skip: !have }, () => {
  const m = fakeMochi(), c = m.craft;
  c.play(mv("polite bow"), { skill: 0.2, id: 9 });
  run(m, 2.4);
  assert.equal(c.lastPerf.id, 9);
  c.patted();
  const next = m.queue.find((q) => q[0] === "@perf");
  assert.ok(next, "a replay is queued"); assert.ok(Math.abs(next[1].skill - 0.35) < 1e-9, "15 points smoother");
  c.patted(); assert.equal(m.queue.filter((q) => q[0] === "@perf").length, 1, "one replay per pat, not one per stroke");
  NOW += 9000; c.lastPerf.at = NOW - 9000; c.patted(); assert.equal(m.queue.filter((q) => q[0] === "@perf").length, 1, "too late to count");
});

test("posing: dragged channels become a move recipe that starts and ends at rest", { skip: !have }, () => {
  const m = fakeMochi(), c = m.craft;
  c.poseStart(); assert.equal(m.mood, "posing");
  run(m, 0.3);
  c.poseSet("rightArm.raise", 1); run(m, 0.6);
  c.poseSet("rightArm.raise", 0.2); run(m, 0.4);
  c.poseSet("body.spin", 1.1); run(m, 0.8);
  c.poseSet("head.nod", 0.5); run(m, 0.5);
  const out = c.poseDone("test twirl", { playBack: false });
  assert.equal(out.ok, true, JSON.stringify(out.errors));
  const t = out.recipe.tracks;
  assert.ok(t["rightArm.raise"] && t["body.spin"] && t["head.nod"]);
  for (const [ch, keys] of Object.entries(t)) { assert.deepEqual(keys[0], [0, 0], ch); assert.ok(keys.length <= 12, ch); }
  assert.equal(t["body.spin"].at(-1)[1], 1, "the spin lands on a whole turn");
  assert.equal(t["rightArm.raise"].at(-1)[1], 0, "the arm comes home");
  assert.ok(out.recipe.duration <= 4);
  assert.equal(c.posing, null);
});

test("recipeFromSamples: idle time trimmed, nothing recorded → an error", { skip: !have }, () => {
  const samples = [];
  for (let i = 0; i < 40; i++) samples.push({ t: i * 0.1, v: { "leftArm.spread": i < 15 ? 0 : i < 25 ? (i - 15) / 10 : 1 } });
  const r = SC.recipeFromSamples(samples, "lift");
  assert.equal(r.ok, true);
  assert.ok(r.recipe.duration < 2.6, `idle start and end trimmed (${r.recipe.duration} s)`);
  assert.equal(SC.recipeFromSamples([{ t: 0, v: {} }, { t: 0.1, v: {} }]).ok, false);
});

// screen point (canvas client px) of a world point, for the fake's 374×434 canvas
const toScreen = (m, v) => { const p = v.clone().project(m.camera); return [(p.x + 1) / 2 * 374, (1 - p.y) / 2 * 434]; };

test("pointing: a tap aims a held launcher there, a shell flies to the spot and bursts; a tap on the prop uses it", { skip: !have }, () => {
  const m = fakeMochi(), c = m.craft;
  c.hold(ex("confetti popper"), { quiet: true }); run(m, 0.6);
  assert.equal(c.holding().launcher, true);
  const [x, y] = [60, 90];   // up and to his left: across his body
  assert.equal(c.pointAt(x, y), "aim");
  const target = c.aim.target.clone();
  let worst = 0, prev = limbs(m);
  run(m, 0.28, () => { const l = limbs(m); worst = Math.max(worst, ...l.map((v, i) => Math.abs(v - prev[i]))); prev = l; });
  const g = c.prop.group; g.updateWorldMatrix(true, false);
  const barrel = new THREE.Vector3(1, 0, 0).transformDirection(g.matrixWorld), muzzle = g.localToWorld(g.userData.muzzle.clone());
  assert.ok(barrel.angleTo(target.clone().sub(muzzle).normalize()) < 0.3, `the barrel points at the spot (${barrel.angleTo(target.clone().sub(muzzle).normalize()).toFixed(2)} rad)`);
  assert.ok(worst < 0.3, `no snap while turning to aim (${worst.toFixed(3)} rad)`);
  run(m, 0.1);
  assert.equal(c.shells.length, 1, "fired once it pointed there");
  for (let i = 0; i < 60 && c.shells.length; i++) frame(m);
  assert.equal(c.shells.length, 0);
  frame(m);
  assert.ok(c.ammo.some((a) => a.mesh.position.distanceTo(target) < 0.3), "the burst is where they tapped");
  run(m, 0.7);
  assert.ok(c.marks.length >= 0 && c.prop.until > NOW + 15000, "kept out while in use");
  run(m, 1.6);
  assert.equal(c.aim, null, "then back to the ready pose");
  // a tap on the launcher itself fires it straight ahead
  const part = c.prop.group.children.find((o) => o.isMesh) || c.prop.group.children[0];
  const n0 = c.ammo.length, [px, py] = toScreen(m, new THREE.Box3().setFromObject(part).getCenter(new THREE.Vector3()));
  assert.equal(c.pointAt(px, py), "prop"); assert.ok(c.ammo.length > n0);
});

test("tapping other props uses them: an umbrella twirls, a friend beside him hops, a hat wiggles; empty taps do nothing", { skip: !have }, () => {
  const m = fakeMochi(), c = m.craft;
  c.hold(ex("little blue umbrella"), { quiet: true }); run(m, 0.6);
  assert.equal(c.pointAt(10, 420), null, "no launcher: an empty tap does nothing");
  let spun = 0;
  assert.equal(c.useProp(), true); run(m, 1.0, () => { spun = Math.max(spun, Math.abs(c.handSpin.rotation.y)); });
  assert.ok(spun > 1, "twirled"); assert.equal(c.useAnim, null);
  c.hold(ex("piggy bank"), { quiet: true }); run(m, 0.6);
  let up = 0; c.useProp(); run(m, 0.7, () => { up = Math.max(up, c.beside.position.y); });
  assert.ok(up > 0.2, "hopped");
  c.letGo(true); c.hold(ex("golden crown"), { quiet: true }); run(m, 0.6);
  let tilt = 0; c.useProp(); run(m, 0.7, () => { tilt = Math.max(tilt, Math.abs(c.prop.group.rotation.z)); });
  assert.ok(tilt > 0.03, "wiggled");
});

test("from the conversation: he looks at the globe (it turns), fires confetti up, and squirts the viewer", { skip: !have }, () => {
  const m = fakeMochi(), c = m.craft;
  m.P.lookX = { x: 0, t: 0 }; m.P.lookY = { x: 0, t: 0 };
  frame(m);   // a rest frame first (the fake's limbs start unposed)
  assert.equal(c.studyProp(ex("desk globe"), { ms: 1500 }).ok, true);
  let turn = 0, spin0 = null, spin1 = 0, prev = limbs(m), worst = 0;
  run(m, 1.0, (i) => { turn = Math.max(turn, m.neck.rotation.y); if (i === 5) spin0 = c.handSpin.rotation.y; spin1 = c.handSpin.rotation.y; const l = limbs(m); worst = Math.max(worst, ...l.map((v, k) => Math.abs(v - prev[k]))); prev = l; });
  assert.ok(turn > 0.25, `head turns to the globe (${turn.toFixed(2)})`); assert.ok(m.P.lookX.t > 0.4, "eyes on it");
  assert.ok(Math.abs(spin1 - spin0) > 0.5, "the globe turns in his hoof");
  assert.ok(worst < 0.3, `smoothly (${worst.toFixed(3)} rad)`);
  run(m, 1.5);
  assert.equal(c.study, null); assert.ok(m.neck.rotation.y < 0.1, "then he looks back up");
  // celebrating: the popper fires up into the air
  c.hold(ex("confetti popper"), { quiet: true }); run(m, 0.5);
  assert.equal(c.cheer(), true); run(m, 0.35);
  assert.equal(c.shells.length, 1); assert.ok(c.shells[0].to.y > 2, "up over his head");
  // a tease: the water pistol fires out of the screen and splats on the glass
  c.hold(ex("water pistol"), { quiet: true }); run(m, 0.5);
  const splats = []; c.splat = (kind, at) => splats.push({ kind, at });
  assert.equal(c.atViewer(), true);
  run(m, 0.5);
  const g = c.prop.group; g.updateWorldMatrix(true, false);
  const barrel = new THREE.Vector3(1, 0, 0).transformDirection(g.matrixWorld);
  assert.ok(barrel.z > 0.6, `the barrel points out of the screen (z ${barrel.z.toFixed(2)})`);
  run(m, 1.0);
  assert.equal(splats.length, 1); assert.equal(splats[0].kind, "water"); assert.ok(splats[0].at.z > 5, "it reached the glass");
});

test("held props don't pass through him and stay in his hoof: the globe he studies, a launcher aimed across him", { skip: !have }, () => {
  const m = fakeMochi(), c = m.craft;
  frame(m);
  c.studyProp(ex("desk globe"), { ms: 3000 });
  let worst = 0; run(m, 2.0, (i) => { if (i > 30) worst = Math.max(worst, sunk(m)); });
  assert.ok(worst < 0.04, `the globe stays out of his head (${worst.toFixed(3)})`);
  assert.ok(c.hand.position.distanceTo(c.pushBase) < 1e-9, "the grip never leaves his hoof: his arm moved, not the prop");
  assert.ok(c.clear.spread > 0.05, "his arm swung out to make room");
  c.hold(ex("confetti popper"), { quiet: true }); run(m, 0.5);
  c.aimAt(new THREE.Vector3(-1.6, 2.4, 0.6));   // up and across to his left
  worst = 0; run(m, 0.9, (i) => { if (i > 20) worst = Math.max(worst, sunk(m)); });
  assert.ok(worst < 0.05, `aimed across him, the popper stays out of his face (${worst.toFixed(3)})`);
});

test("he stands up, walks across the stage and back, sits down; never in bed", { skip: !have }, () => {
  const m = fakeMochi(), c = m.craft, S = c.stance;
  m.touch = () => { m.lastActive = NOW; }; m.touch();
  run(m, 0.5);
  assert.ok(!S.standing()); assert.ok(m.legs[0].rotation.x < -1.3, "sitting: legs out in front");
  assert.ok(S.stand()); run(m, 1.2);
  assert.ok(S.standing());
  assert.ok(Math.abs(m.legs[0].rotation.x + 0.08) < 0.12 && Math.abs(m.legs[1].rotation.x + 0.08) < 0.12, `legs straight down (${m.legs[0].rotation.x.toFixed(2)})`);
  assert.ok(m.root.position.y > 0.12, "up on his feet");
  let maxX = 0, minX = 0, maxYaw = 0, steps = 0, prevLeg = m.legs[0].rotation.x, prevDir = 0;
  assert.ok(S.walk({ reach: 0.85, first: 1 }));
  run(m, 9.5, () => {
    maxX = Math.max(maxX, m.root.position.x); minX = Math.min(minX, m.root.position.x); maxYaw = Math.max(maxYaw, Math.abs(m.root.rotation.y));
    const d = Math.sign(m.legs[0].rotation.x - prevLeg); if (d && d !== prevDir) { steps++; prevDir = d; } prevLeg = m.legs[0].rotation.x;
  });
  assert.ok(maxX > 0.8 && minX < -0.8, `across and back (${minX.toFixed(2)} … ${maxX.toFixed(2)})`);
  assert.ok(maxYaw > 0.8, "turned three-quarters toward where he walks"); assert.ok(steps > 12, `legs stepping (${steps})`);
  assert.ok(!S.walking()); assert.ok(Math.abs(m.root.position.x) < 0.01 && Math.abs(m.root.rotation.y) < 0.02, "back in the middle, facing you");
  assert.ok(S.standing(), "still standing after the walk");
  S.sit(); run(m, 1.2);
  assert.ok(m.legs[0].rotation.x < -1.25, "sitting again"); assert.ok(m.root.position.y < 0.02);
  m.inBed = true; S.stand(); run(m, 0.6); assert.ok(!S.standing(), "not in bed"); m.inBed = false;
  S.stand(); m.lastActive = NOW - 100000; run(m, 0.2); assert.ok(!S.standing(), "left alone a long while, he sits back down");
});

test("the big launcher: he stands to carry it on both hooves, it sags and he heaves it up, it fires a rocket and the kick plops him down", { skip: !have }, () => {
  const m = fakeMochi(), c = m.craft, S = c.stance;
  m.touch = () => { m.lastActive = NOW; }; m.touch();
  const r = c.hold(ex("big confetti rocket launcher"), { quiet: true, ms: 60000 });
  assert.ok(r.ok); assert.ok(c.prop.heavy, "heavy"); assert.ok(c.heavyMount.children.includes(c.prop.group), "on its own mount, not in one hoof");
  assert.equal(c.holding().heavy, true); assert.ok(c.isLauncher());
  run(m, 1.5);
  assert.ok(S.standing(), "he stands up to carry it"); assert.ok(m.root.position.y > 0.1);
  assert.ok(sunk(m) < 0.06, `it's in front of him, not inside him (${sunk(m).toFixed(3)})`);
  const rest = -0.62, l = m.arms[0].rotation.x, rr = m.arms[1].rotation.x;
  assert.ok(l < rest - 0.2 && rr < rest - 0.4, `both hooves up under it (${l.toFixed(2)}, ${rr.toFixed(2)})`);
  // it sags and he heaves it back up (within ~8 s)
  let sagged = 0, heaved = false;
  run(m, 8, () => { if (c.hv) { sagged = Math.max(sagged, c.hv.sag); if (c.hv.sag < -0.1) heaved = true; } });
  assert.ok(sagged > 0.8 && heaved, `sags (${sagged.toFixed(2)}) and is heaved back up`);
  // it goes off: a rocket out of the muzzle, the kick sits him down for a moment, then he's back up
  m.scene.updateMatrixWorld(true);
  const muzzle = c.prop.group.localToWorld(c.prop.group.userData.muzzle.clone());
  c.fire();
  assert.equal(c.shells.length, 1); assert.ok(c.shells[0].rocket); assert.ok(c.shells[0].from.distanceTo(muzzle) < 1e-6, "from the muzzle");
  run(m, 0.5);
  assert.ok(S.w.x < 0.6, `the kick sat him down (${S.w.x.toFixed(2)})`);
  run(m, 1.0);
  assert.equal(c.shells.length, 0, "the rocket popped"); assert.ok(c.ammo.some((a) => a.kind === "starbursts"), "into stars and confetti");
  run(m, 1.5); assert.ok(S.w.x > 0.9, "back on his feet");
  // aimed: it swings toward the spot (as far as it goes) and fires there
  c.aimAt(new THREE.Vector3(2.5, 2.6, 0.5));
  run(m, 1.2);
  assert.ok(c.heavyPitch.x > 0.4, `the barrel swung up (${c.heavyPitch.x.toFixed(2)})`); assert.ok(c.shells.length === 1 || c.ammo.some((a) => a.kind === "starbursts"));
  c.letGo(true); run(m, 1.5);
  assert.ok(!S.standing(), "he sits back down once it's put away"); assert.ok(m.legs[0].rotation.x < -1.25);
});

test("stance edge cases: the idle sit doesn't wake him, an interrupted walk eases home, the kick freezes a walk", { skip: !have }, () => {
  const m = fakeMochi(), c = m.craft, S = c.stance;
  let touched = 0; m.touch = () => { touched++; m.lastActive = NOW; }; m.touch();
  S.stand(); run(m, 1); const t0 = touched;
  m.lastActive = NOW - 100000; run(m, 0.2);
  assert.ok(!S.standing()); assert.equal(touched, t0, "sitting back down on his own is not a touch");
  // a walk cut short by bed: no jump
  m.touch(); S.walk({ reach: 0.85, first: 1 }); run(m, 2.5);
  const xBefore = m.root.position.x; assert.ok(xBefore > 0.3, `out on the stage (${xBefore.toFixed(2)})`);
  m.inBed = true; let maxStep = 0, prev = xBefore;
  run(m, 1.5, () => { maxStep = Math.max(maxStep, Math.abs(m.root.position.x - prev)); prev = m.root.position.x; });
  assert.ok(maxStep < 0.1, `no teleport (biggest step ${maxStep.toFixed(3)})`); assert.ok(Math.abs(m.root.position.x) < 0.02, "back in the middle");
  m.inBed = false;
  // a walk with the big launcher: the kick sits him down and the walk waits
  c.hold(ex("big confetti rocket launcher"), { quiet: true, ms: 60000 }); run(m, 1.5);
  S.walk({ reach: 0.85, first: 1 }); run(m, 2.0);
  const xk = m.root.position.x; c.fire(); run(m, 0.6);
  assert.ok(S.w.x < 0.6, "sat down by the kick"); assert.ok(Math.abs(m.root.position.x - xk) < 0.08, `didn't slide (${(m.root.position.x - xk).toFixed(2)})`);
  run(m, 1.2); assert.ok(S.walking() && S.w.x > 0.8, "back up and walking on"); run(m, 8); assert.ok(!S.walking(), "the walk finished afterwards"); assert.ok(Math.abs(m.root.position.x) < 0.02);
});
