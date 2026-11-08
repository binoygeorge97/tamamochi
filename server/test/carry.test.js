// Carrying Mochi about (Nov 7, Binoy: "I feel like mochi stretches too much when we hold him to move him around").
// He used to get up to ~21% taller and thinner on an ordinary drag and ~32% on his first carry (when he digs his
// hooves in before being yanked along), frame to frame. Now: a few percent, eased, volume kept. The spring and the
// swing are the real ones (kit/src/carry.js), driven by a finger path at 60 fps.
import { test } from "node:test";
import assert from "node:assert/strict";
import { stepCarry, carryShape, STRETCH } from "../../kit/src/carry.js";

const FPS = 60, dt = 1 / FPS;
const seg = (fx, fy, tx, ty, ms, held = true) => { const n = Math.round(ms / 1000 * FPS); return Array.from({ length: n }, (_, i) => [fx + (tx - fx) * (i + 1) / n, fy + (ty - fy) * (i + 1) / n, held]); };
const hold = (x, y, ms, held = true) => seg(x, y, x, y, ms, held);
const there = (d, up, ms) => [...hold(0, 0, 200), ...seg(0, 0, -d, -up, ms), ...hold(-d, -up, 500), ...seg(-d, -up, 0, 0, ms), ...hold(0, 0, 400), ...hold(0, 0, 1500, false)];
function carry(path, { yank = false } = {}) {
  const D = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, swing: 0, swingV: 0, yankAt: -1e9 };
  let simT = 0, yanked = false;
  const out = [];
  for (const [x, y, held] of path) {
    D.tx = x; D.ty = y;
    if (yank && !yanked && Math.hypot(x, y) > 28) { yanked = true; D.yankAt = simT; }   // (as dragTo does on the first real tug)
    simT += dt * 1000;
    stepCarry(D, dt, { held, simT });
    const s = carryShape(D);
    out.push({ s, D: { ...D }, held });
  }
  return out;
}
const stretchPct = (o) => (o.s.y / o.s.xz - 1) * 100;   // how much taller than wide, in percent

test("carried, he stretches only a hint: a few percent, never the rubber band he was", () => {
  const cases = {
    "first carry, digs in then yanked": [carry(there(520, 120, 450), { yank: true }), 6.5],
    "normal carry": [carry(there(520, 120, 450)), 3.5],
    "fast flick": [carry(there(700, 0, 250)), 6],
    "slow carry": [carry(there(400, 120, 1500)), 1.5],
    "wiggled about": [carry([...hold(0, 0, 200), ...Array.from({ length: 120 }, (_, i) => [150 * Math.sin(i / FPS * 2 * Math.PI * 3), 0, true]), ...hold(0, 0, 1000, false)]), 4.5],
  };
  for (const [name, [run, cap]] of Object.entries(cases)) {
    const worst = Math.max(...run.map(stretchPct));
    assert.ok(worst <= cap, `${name}: up to ${worst.toFixed(1)}% stretched (at most ${cap}%)`);
  }
  assert.ok(STRETCH.speed + STRETCH.resist <= 0.09, "the most it can ever be stays under 9%");
});

test("the stretch eases in and out (no frame-to-frame wobble) and keeps his volume", () => {
  const run = carry(there(520, 120, 450));
  for (let i = 1; i < run.length; i++) assert.ok(Math.abs(run[i].s.y - run[i - 1].s.y) < 0.006, `frame ${i}: jumped ${(run[i].s.y - run[i - 1].s.y).toFixed(4)}`);
  for (const o of run) assert.ok(Math.abs(o.s.y * o.s.xz * o.s.xz - 1) < 1e-9, "taller is thinner all round, the same amount of Mochi");
  const last = run.at(-1);
  assert.equal(last.s.y, 1, "put down and settled: his own shape again"); assert.equal(last.D.x, 0); assert.equal(last.D.vx, 0);
});

test("the carry itself is unchanged: he follows your finger, swings, and toddles when he isn't held", () => {
  const run = carry(there(520, 120, 450));
  const far = run.findIndex((o) => o.D.x < -500);
  assert.ok(far > 0 && far < 50, `he keeps up with your finger (${far} frames to get there)`);
  assert.ok(run.some((o) => Math.abs(o.D.swing) > 0.05), "and swings below it like a pendulum");
  // let go far from where he wants to be: he walks there at a toddle
  const D = { x: 0, y: 0, vx: 0, vy: 0, tx: 300, ty: 0, swing: 0, swingV: 0, yankAt: -1e9 };
  stepCarry(D, dt, { held: false, simT: 5000, canWalk: true });
  assert.equal(D.walk, 1); assert.ok(Math.abs(D.x - 220 / FPS) < 0.01, "about 220 px a second");
  stepCarry(D, dt, { held: false, simT: 5000, canWalk: false });
  assert.equal(D.walk, 0, "not while he's in bed, sulking or riding");
});
