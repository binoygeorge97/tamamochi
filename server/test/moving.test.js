// Moving parts on anything he has (Nov 7, kit/src/moving.js): found by label, like a ride's wheels.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const threePath = fileURLToPath(new URL("../../kit/node_modules/three/build/three.module.js", import.meta.url));
const have = fs.existsSync(threePath);
const THREE = have ? await import(threePath) : null;
const MV = have ? await import("../../kit/src/moving.js") : null;
const C = await import("../../shared/craft.js");

// a prop as buildProp makes it: one mesh per part, at its place, turned, labelled, with its part
function prop(parts) {
  const g = new THREE.Group();
  for (const p of parts) {
    const o = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    o.scale.set(...p.size); o.position.set(...p.at); if (p.rotate) o.rotation.set(...p.rotate.map((d) => (d * Math.PI) / 180));
    o.userData.label = p.label; o.userData.part = p; g.add(o);
  }
  return g;
}
const near = (a, b, e = 1e-6) => a.distanceTo(b) < e;
const corner = (o, x, y, z) => new THREE.Vector3(x / 2, y / 2, z / 2).applyMatrix4(o.matrix);   // a point on the part's own box, as drawn
const upd = (g) => g.traverse((o) => o.updateMatrix());

test("which labels move: spinners, flags, charms, flames, lids; not a sword's blade, a flag's pole, a door handle or a ribbon", { skip: !have }, () => {
  const k = (l, o) => MV.kindOf(l, o);
  assert.equal(k("pinwheel"), "spin"); assert.equal(k("fan blades"), "spin"); assert.equal(k("propeller"), "spin");
  assert.equal(k("flag"), "wave"); assert.equal(k("flag star"), "wave"); assert.equal(k("pennant"), "wave"); assert.equal(k("flag pole"), null);
  assert.equal(k("charm"), "swing"); assert.equal(k("charm ring"), null); assert.equal(k("tassel"), "swing");
  assert.equal(k("flame"), "glow"); assert.equal(k("light bulb"), "glow");
  assert.equal(k("lid"), "lid"); assert.equal(k("tent door"), "lid"); assert.equal(k("door handle"), null); assert.equal(k("hatch rim"), null);
  for (const l of ["blade", "sword blade", "ribbon", "cover", "flap", "handle", "body"]) assert.equal(k(l), null, l);
  assert.equal(k("propeller", { ride: true }), null, "a ride's propeller is rides.js's"); assert.equal(k("flag", { ride: true }), "wave", "its flag waves");
  // the hand-made patterns: what moves now
  const moving = [];
  for (const [a, list] of Object.entries(C.PROP_EXAMPLES)) for (const e of list) for (const p of e.parts) { const kind = k(p.label, { ride: a === "ride" }); if (kind) moving.push(`${e.name}: ${p.label} ${kind}`); }
  for (const want of ["birthday cake: flame glow", "campfire: flame glow", "little tent: door lid", "little tent: flag wave", "sandcastle: flag wave", "magenta smartphone: charm swing", "pirate ship: flag wave", "sailboat: pennant wave"]) assert.ok(moving.includes(want), want);
  assert.ok(!moving.some((x) => /sword|scissors|trowel|medal|present/.test(x)), moving.filter((x) => /sword|scissors|trowel|medal|present/.test(x)).join("; "));
  assert.match(C.propSpecText("handheld_tool"), /"propeller", "fan", "pinwheel" or "windmill" spins/, "Gemma is told which labels move");
});

test("a flag waves from its pole edge, its star goes with it; a charm swings from its top; a spinner turns in place", { skip: !have }, () => {
  const g = prop([
    { label: "pole", size: [0.05, 1.2, 0.05], at: [0, 0.6, 0] },
    { label: "flag", size: [0.5, 0.3, 0.02], at: [0.25, 1.05, 0] },
    { label: "flag star", size: [0.1, 0.1, 0.02], at: [0.3, 1.05, 0.015] },
    { label: "charm", size: [0.06, 0.12, 0.02], at: [-0.2, 0.4, 0] },
    { label: "pinwheel", size: [0.4, 0.4, 0.04], at: [0, 1.3, 0.05] },
  ]);
  upd(g);
  const [, flag, star, charm, wheel] = g.children;
  const edge0 = corner(flag, -1, 1, 0), far0 = corner(flag, 1, 1, 0), top0 = corner(charm, 0, 1, 0), wheelAt = wheel.position.clone(), starOff0 = star.position.clone().sub(flag.position);
  const M = new MV.Movers(g, { seed: 0 });
  assert.equal(M.items.length, 3); assert.equal(M.items.find((x) => x.kind === "wave").members.length, 1, "the star is the flag's");
  let flapped = 0;
  for (let t = 0; t < 2000; t += 50) {
    M.step(t); upd(g);
    assert.ok(near(corner(flag, -1, 1, 0), edge0, 1e-4), "the flag stays on its pole");
    flapped = Math.max(flapped, corner(flag, 1, 1, 0).distanceTo(far0));
    assert.ok(near(corner(charm, 0, 1, 0), top0, 1e-4), "the charm hangs from its top");
    assert.ok(near(wheel.position, wheelAt), "the pinwheel turns where it is");
    assert.ok(Math.abs(star.position.clone().sub(flag.position).length() - starOff0.length()) < 1e-4, "the star rides on the flag");
  }
  assert.ok(flapped > 0.08, `its free end flaps (${flapped.toFixed(2)})`);
  M.reset(); upd(g); assert.ok(near(corner(flag, 1, 1, 0), far0, 1e-6));
});

test("a lid opens from its back edge when he's tapped, then closes; a flame flickers, but not while it's being eaten", { skip: !have }, () => {
  const g = prop([{ label: "box", size: [0.6, 0.4, 0.5], at: [0, 0.2, 0] }, { label: "lid", size: [0.62, 0.08, 0.52], at: [0, 0.44, 0] }, { label: "flame", size: [0.05, 0.1, 0.05], at: [0, 0.6, 0] }]);
  upd(g);
  const [, lid, flame] = g.children, hinge0 = corner(lid, 0, 0, -1), front0 = corner(lid, 0, 0, 1);
  const M = new MV.Movers(g);
  assert.equal(M.hasLid, true);
  M.step(0); upd(g); assert.ok(near(corner(lid, 0, 0, 1), front0, 1e-6), "shut until tapped");
  assert.equal(M.open(1000), true);
  M.step(2000); upd(g);
  assert.ok(near(corner(lid, 0, 0, -1), hinge0, 1e-4), "it turns on its hinge");
  assert.ok(corner(lid, 0, 0, 1).y > front0.y + 0.3, "its front lifts right up");
  M.step(4000); upd(g); assert.ok(near(corner(lid, 0, 0, 1), front0, 1e-4), "and shuts again");
  const heights = []; for (let t = 0; t < 1000; t += 37) { M.step(t); heights.push(flame.scale.y); }
  assert.ok(Math.max(...heights) - Math.min(...heights) > 0.01, "the flame flickers");
  flame.userData.eat0 = { s: flame.scale.clone() }; flame.scale.set(0.01, 0.02, 0.01);
  M.step(5000); assert.equal(flame.scale.y, 0.02, "being eaten: left alone");
  assert.equal(new MV.Movers(prop([{ label: "handle", size: [0.1, 0.5, 0.1], at: [0, 0, 0] }])).any, false, "nothing to move, nothing done");
});
