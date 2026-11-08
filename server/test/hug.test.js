// Hugs that hold together (Nov 4, Binoy: "mochi and mimi hug ends up with each of them phasing through the other. can
// you make sure the actual hug physics are correct and they dont phase through"). The kit's hug.js on stand-in rigs
// shaped like the real ones: the friend ends up where the fleece meets (never inside), and an arm round the other
// rests its hoof on their fleece, not inside it.
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../../kit/node_modules/three/build/three.module.js";
import { contactX, wrapArm, shellsOf, closest, overlapping, SQUISH } from "../../kit/src/hug.js";

const unit = () => new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6));
function rig() {   // Mochi and Mimi's shapes, as mochi.js builds them (just the parts the hug looks at)
  const scene = new THREE.Group(), m = { ears: [], mimiEars: [] };
  const root = m.root = new THREE.Group(); scene.add(root);
  const body = m.body = new THREE.Group(); root.add(body);
  m.tummy = unit(); m.tummy.scale.set(0.64, 0.66, 0.6); m.tummy.position.y = 0.56; body.add(m.tummy);
  const neck = m.neck = new THREE.Group(); neck.position.set(0, 1.04, 0.04); body.add(neck);
  const head = new THREE.Group(); head.position.set(0, 0.54, 0.05); head.scale.setScalar(1.17); neck.add(head);
  m.headHit = unit(); m.headHit.scale.set(0.68, 0.66, 0.6); head.add(m.headHit);
  for (const s of [-1, 1]) { const p = new THREE.Group(); p.position.set(s * 0.47, -0.02, 0); p.rotation.y = s * -0.25; head.add(p); const o = unit(); o.scale.set(0.25, 0.1, 0.14); o.position.set(s * 0.21, -0.02, 0); p.add(o); p.userData.side = s; m.ears.push(p); }
  m.arms = [-1, 1].map((s) => { const a = new THREE.Group(); a.position.set(s * 0.34, 0.74, 0.4); a.userData.side = s; body.add(a); return a; });
  const mm = m.mimi = new THREE.Group(); mm.scale.setScalar(0.88); mm.position.set(0.64, 0, 0.05); mm.rotation.y = -0.32; scene.add(mm);
  const mb = m.mimiBody = new THREE.Group(); mm.add(mb);
  const mn = m.mimiNeck = new THREE.Group(); mn.position.set(0, 1.0, 0.04); mb.add(mn);
  m.mimiHead = new THREE.Group(); m.mimiHead.position.set(0, 0.52, 0.05); m.mimiHead.scale.setScalar(1.12); mn.add(m.mimiHead);
  for (const s of [-1, 1]) { const p = new THREE.Group(); p.position.set(s * 0.46, -0.04, 0); p.rotation.z = -s * 0.42; m.mimiHead.add(p); const o = unit(); o.scale.set(0.24, 0.095, 0.13); o.position.set(s * 0.2, -0.02, 0); p.add(o); p.userData.side = s; m.mimiEars.push(p); }
  m.mimiArms = [-1, 1].map((s) => { const a = new THREE.Group(); a.position.set(s * 0.32, 0.72, 0.37); a.userData.side = s; mb.add(a); return a; });
  root.position.x = -0.62; scene.updateMatrixWorld(true);
  return m;
}

test("her spot beside him overlapped him (his ear was in her head): she's moved out to just touching", () => {
  const m = rig();
  assert.ok(overlapping(m, "mimi", 1), "the spot she used to stand in");
  const x = contactX(m, "mimi", m.mimi, 1, 1); m.mimi.position.x = x; m.mimi.updateMatrixWorld(true);
  const r = closest(shellsOf(m, "mochi"), shellsOf(m, "mimi"));
  assert.ok(r >= 1 && r < 1.03, `just touching (${r.toFixed(3)})`);
});

test("hugging: she comes in to where the fleece squashes together, and no closer, whatever way he's leaning", () => {
  for (const [lean, yaw] of [[0, 0], [-0.1, 0.28], [0.15, -0.2]]) {
    const m = rig(); m.root.rotation.z = lean; m.root.rotation.y = yaw; m.root.updateMatrixWorld(true);
    const x = contactX(m, "mimi", m.mimi, 1, SQUISH); m.mimi.position.x = x; m.mimi.updateMatrixWorld(true);
    const r = closest(shellsOf(m, "mochi"), shellsOf(m, "mimi"));
    assert.ok(r >= SQUISH - 0.005 && r < SQUISH + 0.03, `lean ${lean}: ${r.toFixed(3)}`);
    assert.ok(x - m.root.position.x > 1.0, "her middle well clear of his");
  }
});

test("an arm round the other rests its hoof on their fleece, not inside them", () => {
  const m = rig(); m.root.rotation.y = 0.28; m.mimi.rotation.y = -0.54; m.neck.rotation.z = 0.3; m.mimiNeck.rotation.z = -0.3;
  m.mimi.position.x = contactX(m, "mimi", m.mimi, 1, SQUISH); m.mimi.parent.updateMatrixWorld(true);
  const mine = shellsOf(m, "mochi"), hers = shellsOf(m, "mimi");
  for (const [arm, reach, own, other] of [[m.arms[1], 0.245, mine, hers], [m.mimiArms[0], 0.23, hers, mine]]) {
    const p = wrapArm(arm, reach, own, other, 1);
    assert.ok(p, "somewhere to put the hoof");
    arm.updateMatrixWorld(true);
    const hoof = new THREE.Vector3(0, -reach, 0).applyMatrix4(arm.matrixWorld), I = other[0].clone().invert();
    const r = hoof.clone().applyMatrix4(I).length();
    assert.ok(r > 0.95 && r < 1.25, `the hoof on their fleece (${r.toFixed(3)})`);
  }
});
