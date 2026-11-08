/* Parts that move on anything he has (Nov 7, Binoy: "more moving parts"): found by their labels, like a ride's wheels
 * (rides.js), so a prop Gemma designs moves too if it names its parts. Spinners turn round their thinnest side, flags
 * wave from the edge nearer the pole, charms swing from their top, flames flicker, and a lid, door or hatch swings open
 * from its back edge when he's tapped, then closes. Parts named after one that moves ("flag star") go with it.
 * Rides use only the waving and swinging here: their propellers, rotors and flames are rides.js's. */
import * as THREE from "three";
import { MOVE_SPIN, MOVE_WAVE, MOVE_SWING, MOVE_GLOW, MOVE_LID } from "../../shared/craft.js";

const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const q = new THREE.Quaternion(), v = new THREE.Vector3();

export function kindOf(label, { ride = false } = {}) {
  const L = String(label || "").toLowerCase();
  if (!L) return null;
  if (MOVE_WAVE.test(L)) return "wave";
  if (MOVE_SWING.test(L)) return "swing";
  if (ride) return null;
  if (MOVE_LID.test(L)) return "lid";
  if (MOVE_SPIN.test(L)) return "spin";
  if (MOVE_GLOW.test(L)) return "glow";
  return null;
}

export class Movers {
  constructor(group, { ride = false, seed = 0 } = {}) {
    this.items = []; this.openAt = -1e9;
    const meshes = []; group.traverse((o) => { if (o.isMesh && o.userData && o.userData.label) meshes.push(o); });
    const info = (o) => { const p = o.userData.part || {}; return { o, p0: o.position.clone(), q0: o.quaternion.clone(), s0: o.scale.clone(), size: p.size || [0.2, 0.2, 0.2] }; };
    const lead = [], byLen = [...meshes].sort((a, b) => a.userData.label.length - b.userData.label.length);
    const follows = (o, x) => x.kind !== "glow" && x.kind !== "spin" && o.userData.label.startsWith(`${String(x.o.userData.label).split(/\s+/)[0]} `) && x.p0.distanceTo(o.position) < Math.max(...x.size);
    for (const o of byLen) {   // (shortest names first: "flag" leads, "flag star" goes with it)
      const kind = kindOf(o.userData.label, { ride });
      if (!kind) continue;
      const owner = lead.find((x) => follows(o, x));
      if (owner) { owner.members.push(info(o)); continue; }
      const it = { ...info(o), kind, ph: (seed + lead.length * 1.7) % 6.28, members: [] }, [w, h, d] = it.size;
      if (kind === "spin") {   // round its thinnest side
        const k = it.size.indexOf(Math.min(...it.size));
        it.axis = (k === 0 ? X : k === 1 ? Y : Z).clone().applyQuaternion(it.q0);
        it.speed = /fan|propell|rotor|turbine/.test(o.userData.label) ? 11 : 4.5;
      } else if (kind === "wave") {   // from the edge nearer the middle of the prop (the pole), round the up axis
        const side = Math.sign(it.p0.x) || 1;
        it.pivot = it.p0.clone().add(new THREE.Vector3(-side * w / 2, 0, 0).applyQuaternion(it.q0)); it.axis = Y.clone();
      } else if (kind === "swing") {   // from its top
        it.pivot = it.p0.clone().add(new THREE.Vector3(0, h / 2, 0).applyQuaternion(it.q0)); it.axis = Z.clone();
      } else if (kind === "lid") {   // a hinge along its back edge (a door: its side)
        const door = /door/.test(o.userData.label);
        it.pivot = it.p0.clone().add(new THREE.Vector3(door ? -w / 2 : 0, 0, door ? 0 : -d / 2).applyQuaternion(it.q0));
        it.axis = (door ? Y : X).clone().applyQuaternion(it.q0); it.max = door ? 1.2 : -1.15;
      }
      lead.push(it); this.items.push(it);
    }
    // a part named after one that moves ("flag star", "lid knob") and touching it goes with it
    for (const o of meshes) {
      if (lead.some((it) => it.o === o || it.members.some((m) => m.o === o))) continue;
      const it = lead.find((x) => follows(o, x));
      if (it) it.members.push(info(o));
    }
  }
  get any() { return this.items.length > 0; }
  get hasLid() { return this.items.some((it) => it.kind === "lid"); }
  /** tapped: lids, doors and hatches open, then close */
  open(now) { if (!this.hasLid) return false; this.openAt = now; return true; }
  turn(it, angle) {   // the part (and its members) turned by `angle` about its pivot
    q.setFromAxisAngle(it.axis, angle);
    for (const x of [it, ...it.members]) {
      v.copy(x.p0).sub(it.pivot).applyQuaternion(q).add(it.pivot);
      x.o.position.copy(v); x.o.quaternion.copy(q).multiply(x.q0);
    }
  }
  step(now, calm = 1) {
    const t = now / 1000, open = (() => { const u = (now - this.openAt) / 1000; return u < 0 ? 0 : u < 0.35 ? u / 0.35 : u < 1.9 ? 1 : u < 2.4 ? 1 - (u - 1.9) / 0.5 : 0; })();
    const ease = open * open * (3 - 2 * open);
    for (const it of this.items) {
      if (it.o.userData.eat0) continue;   // being eaten (eating.js shrinks it): left alone
      if (it.kind === "spin") { q.setFromAxisAngle(it.axis, t * it.speed * calm + it.ph); it.o.quaternion.copy(q).multiply(it.q0); }
      else if (it.kind === "wave") this.turn(it, (0.24 * Math.sin(t * 3.6 + it.ph) + 0.08 * Math.sin(t * 7.3 + it.ph)) * calm);
      else if (it.kind === "swing") this.turn(it, 0.32 * Math.sin(t * 2.4 + it.ph) * calm);
      else if (it.kind === "glow") { const k = 1 + (0.08 * Math.sin(t * 9 + it.ph) + 0.05 * Math.sin(t * 17.3 + it.ph * 2)) * calm; it.o.scale.set(it.s0.x * (2 - k) ** 0.5, it.s0.y * k, it.s0.z * (2 - k) ** 0.5); }
      else if (it.kind === "lid") this.turn(it, it.max * ease);
    }
  }
  reset() { for (const it of this.items) { for (const x of [it, ...it.members]) { x.o.position.copy(x.p0); x.o.quaternion.copy(x.q0); x.o.scale.copy(x.s0); } } }
}
