// The big launcher aims for real (Binoy, Nov 2: "the bazooka points in one direction even though the target is the other direction"): his body turns round, the barrel servos onto the target, and it only goes off once it points there.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
const threePath = fileURLToPath(new URL("../../kit/node_modules/three/build/three.module.js", import.meta.url));
const have = fs.existsSync(threePath);
const THREE = have ? await import(threePath) : null;
const SC = have ? await import("../../kit/src/stagecraft.js") : null;
const C = await import("../../shared/craft.js");
let NOW = 1000; Object.defineProperty(performance, "now", { value: () => NOW, configurable: true, writable: true });
function fakeMochi() {
  const scene = new THREE.Scene(), root = new THREE.Group(), body = new THREE.Group(), neck = new THREE.Group(), head = new THREE.Group();
  scene.add(root); root.add(body); neck.position.set(0, 1.04, 0.04); body.add(neck); head.position.set(0, 0.54, 0.05); head.scale.setScalar(1.17); neck.add(head);
  const arms = [-1, 1].map((s) => { const a = new THREE.Group(); a.position.set(s * 0.34, 0.74, 0.4); a.userData.side = s; body.add(a); return a; });
  const legs = [-1, 1].map((s) => { const l = new THREE.Group(); l.position.set(s * 0.25, 0.15, 0.24); body.add(l); return l; });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true }));
  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 50); camera.position.set(0, 1.64, 7.6); camera.lookAt(0, 1.28, 0);
  const P = {}; for (const k of ["smile", "blush", "mouthOpen", "ear", "eyeHappy", "bed", "sweat", "eyeScale", "eyeOpen", "mouthW", "brow", "browY", "eyeClosed", "puff", "browSad", "lookX", "lookY"]) P[k] = { x: 0, t: 0 };
  let seed = 7; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const m = { scene, root, body, neck, head, arms, legs, ground, camera, P, r, reduce: false, mood: "idle", cur: null, curEnd: 0, queue: [], inBed: false, sulking: false, held: false, duo: { x: 0 },
    spawn() {}, say() {}, touch() { this.lastActive = NOW; }, setFace() {}, faceBase: () => 0, lastActive: 0, hop() {},
    play(name, ms) { this.cur = name; this.mood = name; this.curEnd = NOW + (ms || 1500); }, run() {}, next() {},
    host: { getBoundingClientRect: () => ({ width: 260, height: 350, left: 0, top: 0 }) }, canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 374, height: 434 }) } };
  m.headHit = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12)); m.headHit.scale.set(0.68, 0.66, 0.6); head.add(m.headHit);
  m.tummy = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12)); m.tummy.scale.set(0.64, 0.66, 0.6); m.tummy.position.y = 0.56; body.add(m.tummy);
  m.craft = new SC.Stagecraft(m); return m;
}
function frame(m, dt = 1 / 60) {
  NOW += dt * 1000; m.craft.pre(NOW, dt);
  m.arms.forEach((a) => a.rotation.set(-0.62, 0, a.userData.side * 0.22)); m.legs.forEach((l) => l.rotation.set(-Math.PI / 2 + 0.18, 0, 0));
  m.neck.rotation.set(0, 0, 0); m.root.position.set(0, 0, 0); m.root.rotation.set(0, 0, 0); m.body.rotation.set(0, 0, 0); m.ground.scale.set(1, 1, 1);
  m.craft.post(NOW, NOW / 1000, dt); m.scene.updateMatrixWorld(true);
}
const ex = (n) => Object.values(C.PROP_EXAMPLES).flat().find((e) => e.name === n);
test("the big launcher turns him toward a target on either side and fires only when it points there", { skip: !have }, () => {
  for (const [tx, label] of [[-3.2, "left"], [3.2, "right"], [0.4, "ahead"]]) {
    const m = fakeMochi(), c = m.craft;
    c.hold(ex("big confetti rocket launcher"), { quiet: true, ms: 60000 });
    for (let i = 0; i < 90; i++) frame(m);
    const target = new THREE.Vector3(tx, 2.2, 1.5);
    c.aimAt(target);
    let firedAt = null, angleAtFire = null;
    for (let i = 0; i < 240; i++) {
      frame(m);
      if (c.shells.length && firedAt === null) {
        firedAt = i;
        const S = c.shells[0], dir = S.dir;   // the barrel's direction when it went off
        angleAtFire = dir.angleTo(target.clone().sub(S.from).normalize());
      }
    }
    assert.ok(firedAt !== null, `${label}: it fired`);
    assert.ok(angleAtFire < 0.3, `${label}: barrel within ${(angleAtFire * 57.3).toFixed(0)}° of the target when it fired (frame ${firedAt})`);
  }
});
