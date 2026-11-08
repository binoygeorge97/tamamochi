// Vehicles he rides (Nov 4, Binoy: "the rocketship mochi made looks terrible… can you make it better? also give it
// better building blocks and instructions to help it make future vehicle requests like a ship or helicopter etc.").
// Hand-made patterns the workshop starts from (a "rocket ship" or a "spaceship" is this rocket, as it is, recoloured;
// a "pirate ship" or a "jet" starts from the nearest one and Gemma changes what makes it that), and the worked
// examples Gemma sees for any other vehicle. craft.js adds them to PROP_EXAMPLES.
//
// All of them point along +x (the way they go) and stand on y = 0, the way his car does, and he sits in each one on
// the part labelled "seat", sunk in so the sides hide his legs. What moves when he rides is in the labels (see
// rides.js): "wheel" rolls; "propeller" and "rotor" spin; "flame" flickers; "water" is the little pond a boat sits in.
// How it moves comes from what it is: rocket ships, planes and helicopters fly (take off, fly across the stage and
// back, land); boats, ships and submarines sail (bobbing on the water); trains drive.
const p = (shape, size, at, color, material, more = {}) => ({ shape, size, at, color, material, ...more });

export const VEHICLES = {
  ride: [{
    // a kiddie-ride rocket lying on its side: a fat silver body with a red nose cone, three red fins, round portholes
    // with metal rims, a red band, an open cockpit with a windscreen and a joystick, a bell nozzle and a flame
    name: "rocket ship", archetype: "ride", hold: "ride",
    parts: [
      p("capsule", [1.0, 1.9, 1.0], [0, 0.6, 0], "#e6eaf0", "metal", { rotate: [0, 0, 90], label: "body" }),
      p("cone", [0.94, 0.72, 0.94], [1.18, 0.6, 0], "#ff5f6d", "plastic", { rotate: [0, 0, -90], label: "nose cone" }),
      p("torus", [1.02, 1.02, 0.09], [0.62, 0.6, 0], "#ff5f6d", "plastic", { rotate: [0, 90, 0], label: "band" }),
      p("torus", [1.02, 1.02, 0.09], [-0.62, 0.6, 0], "#ff5f6d", "plastic", { rotate: [0, 90, 0], label: "band" }),
      p("wedge", [0.62, 0.62, 0.09], [-0.62, 1.24, 0], "#ff5f6d", "plastic", { rotate: [0, 0, 18], label: "top fin" }),
      p("wedge", [0.6, 0.46, 0.09], [-0.66, 0.31, 0.4], "#ff5f6d", "plastic", { rotate: [0, 0, 162], label: "fin" }),
      p("wedge", [0.6, 0.46, 0.09], [-0.66, 0.31, -0.4], "#ff5f6d", "plastic", { rotate: [0, 0, 162], label: "fin" }),
      p("coin", [0.26, 0.26, 0.05], [0.3, 0.48, 0.49], "#9fdcff", "glass", { label: "porthole" }),
      p("torus", [0.3, 0.3, 0.05], [0.3, 0.48, 0.5], "#c9ced6", "metal", { label: "porthole rim" }),
      p("coin", [0.2, 0.2, 0.05], [-0.22, 0.42, 0.49], "#9fdcff", "glass", { label: "porthole" }),
      p("torus", [0.24, 0.24, 0.05], [-0.22, 0.42, 0.5], "#c9ced6", "metal", { label: "porthole rim" }),
      p("star", [0.2, 0.2, 0.04], [0.82, 0.72, 0.44], "#ffd34d", "plastic", { label: "star" }),
      p("box", [0.62, 0.08, 0.62], [-0.08, 0.8, 0], "#3d7bff", "cloth", { round: 0.4, label: "seat" }),
      p("torus", [0.92, 0.92, 0.1], [-0.08, 1.04, 0], "#c9ced6", "metal", { rotate: [90, 0, 0], label: "cockpit rim" }),
      p("box", [0.05, 0.34, 0.66], [0.4, 1.18, 0], "#bfe6ff", "glass", { round: 0.4, rotate: [0, 0, -24], label: "windscreen" }),
      p("cylinder", [0.05, 0.26, 0.05], [0.24, 0.98, 0], "#3a3540", "metal", { rotate: [0, 0, -20], label: "steering" }),
      p("sphere", [0.11, 0.11, 0.11], [0.29, 1.11, 0], "#ff5f6d", "plastic", { label: "steering knob" }),
      p("cylinder", [0.5, 0.26, 0.5], [-1.04, 0.6, 0], "#8a8f99", "metal", { rotate: [0, 0, 90], taper: 1.35, label: "nozzle" }),
      p("cone", [0.44, 0.3, 0.44], [-1.29, 0.6, 0], "#ffa53d", "glow", { rotate: [0, 0, 90], label: "flame" }),
      p("cone", [0.24, 0.26, 0.24], [-1.3, 0.6, 0], "#fff3a0", "glow", { rotate: [0, 0, 90], label: "inner flame" }),
    ],
  }, {
    // a little propeller plane: a yellow body, red wings and tail, a red spinner and a two-blade propeller, an open
    // cockpit with a windscreen, wheels under the wings and a little tail wheel
    name: "airplane", archetype: "ride", hold: "ride",
    parts: [
      p("capsule", [0.82, 2.3, 0.82], [0, 0.66, 0], "#ffd34d", "plastic", { rotate: [0, 0, 90], label: "body" }),
      p("cone", [0.34, 0.26, 0.34], [1.24, 0.66, 0], "#ff5f6d", "plastic", { rotate: [0, 0, -90], label: "spinner" }),
      p("box", [0.05, 0.92, 0.13], [1.3, 0.66, 0.02], "#5b5f6b", "wood", { round: 0.5, label: "propeller" }),
      p("box", [0.72, 0.09, 2.6], [0.22, 0.52, 0], "#ff5f6d", "plastic", { round: 0.45, label: "wing" }),
      p("box", [0.38, 0.07, 1.0], [-1.0, 0.74, 0], "#ff5f6d", "plastic", { round: 0.45, label: "tail wing" }),
      p("wedge", [0.46, 0.5, 0.07], [-1.02, 1.02, 0], "#ff5f6d", "plastic", { rotate: [0, 0, 16], label: "tail fin" }),
      p("torus", [0.84, 0.84, 0.07], [-0.62, 0.66, 0], "#ff5f6d", "plastic", { rotate: [0, 90, 0], label: "band" }),
      p("star", [0.22, 0.22, 0.04], [0.62, 0.74, 0.38], "#ffffff", "plastic", { label: "star" }),
      p("box", [0.52, 0.08, 0.5], [-0.2, 0.8, 0], "#3d7bff", "cloth", { round: 0.4, label: "seat" }),
      p("torus", [0.78, 0.78, 0.09], [-0.2, 1.01, 0], "#c9ced6", "metal", { rotate: [90, 0, 0], label: "cockpit rim" }),
      p("box", [0.05, 0.3, 0.56], [0.24, 1.14, 0], "#bfe6ff", "glass", { round: 0.4, rotate: [0, 0, -28], label: "windscreen" }),
      p("cylinder", [0.045, 0.24, 0.045], [0.1, 0.96, 0], "#3a3540", "metal", { rotate: [0, 0, -20], label: "steering" }),
      p("cylinder", [0.05, 0.3, 0.05], [0.42, 0.3, 0.42], "#5b5f6b", "metal", { label: "strut" }),
      p("cylinder", [0.05, 0.3, 0.05], [0.42, 0.3, -0.42], "#5b5f6b", "metal", { label: "strut" }),
      p("torus", [0.3, 0.3, 0.1], [0.42, 0.15, 0.44], "#2b2a30", "rubber", { label: "wheel" }),
      p("torus", [0.3, 0.3, 0.1], [0.42, 0.15, -0.44], "#2b2a30", "rubber", { label: "wheel" }),
      p("coin", [0.14, 0.14, 0.12], [0.42, 0.15, 0.44], "#d9dde3", "metal", { label: "hub" }),
      p("coin", [0.14, 0.14, 0.12], [0.42, 0.15, -0.44], "#d9dde3", "metal", { label: "hub" }),
      p("cylinder", [0.04, 0.2, 0.04], [-1.0, 0.2, 0], "#5b5f6b", "metal", { label: "tail strut" }),
      p("coin", [0.14, 0.14, 0.07], [-1.0, 0.08, 0], "#2b2a30", "rubber", { label: "tail wheel" }),
    ],
  }, {
    // a round little helicopter: a blue cabin he sits in (open on top, like his car) with a glass bubble nose, a tail
    // boom with a fin and a tail rotor, a mast behind him up to a big two-blade rotor over his head (2.95 up: he's 2.2
    // tall sitting, on a seat 0.8 up), and skids
    name: "helicopter", archetype: "ride", hold: "ride",
    parts: [
      p("box", [1.5, 0.72, 1.2], [0.05, 0.72, 0], "#3d7bff", "plastic", { round: 0.5, label: "cabin" }),
      p("sphere", [0.9, 0.78, 1.04], [0.72, 0.84, 0], "#bfe6ff", "glass", { label: "bubble" }),
      p("capsule", [0.24, 1.24, 0.24], [-1.04, 0.96, 0], "#3d7bff", "plastic", { rotate: [0, 0, 90], label: "tail boom" }),
      p("wedge", [0.34, 0.42, 0.06], [-1.6, 1.2, 0], "#ffd34d", "plastic", { rotate: [0, 0, 16], label: "tail fin" }),
      p("box", [0.06, 0.46, 0.03], [-1.6, 0.98, 0.15], "#5b5f6b", "plastic", { round: 0.5, label: "tail rotor" }),
      p("sphere", [0.1, 0.1, 0.1], [-1.6, 0.98, 0.13], "#ffd34d", "plastic", { label: "tail hub" }),
      p("box", [0.62, 0.08, 0.66], [0.02, 0.76, 0], "#ffd34d", "cloth", { round: 0.4, label: "seat" }),
      p("cylinder", [0.045, 0.26, 0.045], [0.42, 1.06, 0], "#3a3540", "metal", { rotate: [0, 0, -20], label: "steering" }),
      p("cylinder", [0.09, 1.9, 0.09], [-0.5, 1.97, 0], "#5b5f6b", "metal", { label: "mast" }),
      p("sphere", [0.2, 0.14, 0.2], [-0.5, 2.92, 0], "#ffd34d", "plastic", { label: "rotor hub" }),
      p("box", [2.4, 0.035, 0.16], [-0.5, 2.95, 0], "#5b5f6b", "plastic", { round: 0.5, label: "rotor" }),
      p("box", [0.16, 0.035, 2.4], [-0.5, 2.95, 0], "#5b5f6b", "plastic", { round: 0.5, label: "rotor" }),
      p("star", [0.22, 0.22, 0.04], [-0.32, 0.72, 0.6], "#ffd34d", "plastic", { label: "star" }),
      p("capsule", [0.1, 1.5, 0.1], [0.08, 0.07, 0.46], "#3a3540", "metal", { rotate: [0, 0, 90], label: "skid" }),
      p("capsule", [0.1, 1.5, 0.1], [0.08, 0.07, -0.46], "#3a3540", "metal", { rotate: [0, 0, 90], label: "skid" }),
      p("cylinder", [0.05, 0.36, 0.05], [0.45, 0.22, 0.46], "#3a3540", "metal", { label: "strut" }),
      p("cylinder", [0.05, 0.36, 0.05], [-0.35, 0.22, 0.46], "#3a3540", "metal", { label: "strut" }),
      p("cylinder", [0.05, 0.36, 0.05], [0.45, 0.22, -0.46], "#3a3540", "metal", { label: "strut" }),
      p("cylinder", [0.05, 0.36, 0.05], [-0.35, 0.22, -0.46], "#3a3540", "metal", { label: "strut" }),
    ],
  }, {
    // a toy sailboat in a little pond: a red hull with a white rim and a pointed bow, a tall white sail on a wooden
    // mast in front of him, a pennant at the top, a life ring on the side
    name: "sailboat", archetype: "ride", hold: "ride",
    parts: [
      p("disc", [3.0, 0.04, 1.7], [0.15, 0.02, 0], "#7fd3ff", "glass", { label: "water" }),
      p("box", [1.9, 0.52, 1.1], [-0.2, 0.3, 0], "#ff5f6d", "plastic", { round: 0.5, label: "hull" }),
      p("cone", [0.52, 0.72, 1.1], [1.1, 0.3, 0], "#ff5f6d", "plastic", { rotate: [0, 0, -90], label: "bow" }),
      p("box", [1.92, 0.07, 1.12], [-0.2, 0.57, 0], "#fbf8f2", "plastic", { round: 0.5, label: "rim" }),
      p("box", [0.6, 0.08, 0.72], [-0.55, 0.47, 0], "#3d7bff", "cloth", { round: 0.4, label: "seat" }),
      p("cylinder", [0.07, 2.0, 0.07], [0.2, 1.5, 0], "#c99a62", "wood", { label: "mast" }),
      p("wedge", [0.95, 1.5, 0.04], [0.47, 1.47, 0.02], "#fbf8f2", "cloth", { rotate: [0, 0, 16.7], label: "sail" }),
      p("wedge", [0.3, 0.22, 0.03], [0.36, 2.42, 0], "#ffd34d", "cloth", { rotate: [0, 0, -90], label: "pennant" }),
      p("torus", [0.32, 0.32, 0.08], [0.25, 0.32, 0.56], "#ffffff", "rubber", { pattern: "segments", pattern_color: "#ff5f6d", label: "life ring" }),
      p("box", [0.08, 0.3, 0.1], [-1.2, 0.2, 0], "#c99a62", "wood", { round: 0.4, label: "rudder" }),
    ],
  }, {
    // a little steamboat: a navy hull with a red bottom stripe and a white rim, portholes along its side, a white cabin
    // with round windows, a red funnel with a black top puffing a cloud, a flag at the back, a life ring
    name: "ship", archetype: "ride", hold: "ride",
    parts: [
      p("disc", [3.0, 0.04, 1.7], [0.1, 0.02, 0], "#7fd3ff", "glass", { label: "water" }),
      p("box", [2.1, 0.58, 1.16], [-0.15, 0.33, 0], "#2f4a8a", "plastic", { round: 0.45, label: "hull" }),
      p("cone", [0.58, 0.66, 1.16], [1.22, 0.33, 0], "#2f4a8a", "plastic", { rotate: [0, 0, -90], label: "bow" }),
      p("box", [2.12, 0.14, 1.18], [-0.15, 0.1, 0], "#e5484d", "plastic", { round: 0.45, label: "bottom stripe" }),
      p("box", [2.12, 0.07, 1.18], [-0.15, 0.63, 0], "#fbf8f2", "plastic", { round: 0.5, label: "rim" }),
      p("coin", [0.13, 0.13, 0.04], [-0.95, 0.36, 0.59], "#bfe6ff", "glass", { label: "porthole" }),
      p("coin", [0.13, 0.13, 0.04], [-0.6, 0.36, 0.59], "#bfe6ff", "glass", { label: "porthole" }),
      p("coin", [0.13, 0.13, 0.04], [0.5, 0.36, 0.59], "#bfe6ff", "glass", { label: "porthole" }),
      p("coin", [0.13, 0.13, 0.04], [0.85, 0.36, 0.59], "#bfe6ff", "glass", { label: "porthole" }),
      p("box", [0.6, 0.08, 0.72], [-0.62, 0.52, 0], "#ffd34d", "cloth", { round: 0.4, label: "seat" }),
      p("box", [0.78, 0.52, 0.86], [0.42, 0.92, 0], "#fbf8f2", "plastic", { round: 0.3, label: "cabin" }),
      p("box", [0.9, 0.07, 0.96], [0.42, 1.2, 0], "#e5484d", "plastic", { round: 0.4, label: "cabin roof" }),
      p("coin", [0.16, 0.16, 0.04], [0.26, 0.94, 0.44], "#9fdcff", "glass", { label: "window" }),
      p("coin", [0.16, 0.16, 0.04], [0.58, 0.94, 0.44], "#9fdcff", "glass", { label: "window" }),
      p("cylinder", [0.3, 0.52, 0.3], [0.5, 1.48, 0], "#e5484d", "plastic", { taper: 1.12, label: "funnel" }),
      p("cylinder", [0.34, 0.1, 0.34], [0.5, 1.72, 0], "#3a3540", "plastic", { label: "funnel top" }),
      p("cloud", [0.56, 0.36, 0.26], [0.6, 1.9, 0], "#ffffff", "fluffy", { label: "smoke" }),
      p("cylinder", [0.04, 0.7, 0.04], [-1.14, 0.98, 0], "#c9ced6", "metal", { label: "flag pole" }),
      p("box", [0.32, 0.2, 0.02], [-0.97, 1.22, 0], "#ffd34d", "cloth", { round: 0.2, label: "flag" }),
      p("torus", [0.26, 0.26, 0.07], [0.42, 0.88, 0.45], "#ffffff", "rubber", { pattern: "segments", pattern_color: "#ff5f6d", label: "life ring" }),
    ],
  }, {
    // a yellow submarine bobbing at the surface: a fat body with porthole windows, a tower he sits in with its hatch
    // open, a periscope, fins and a propeller at the back
    name: "submarine", archetype: "ride", hold: "ride",
    parts: [
      p("disc", [3.0, 0.04, 1.7], [0, 0.02, 0], "#7fd3ff", "glass", { label: "water" }),
      p("capsule", [1.0, 2.3, 0.95], [0, 0.55, 0], "#ffd34d", "plastic", { rotate: [0, 0, 90], label: "body" }),
      p("box", [0.78, 0.44, 0.7], [-0.1, 1.0, 0], "#ffd34d", "plastic", { round: 0.45, label: "tower" }),
      p("torus", [0.62, 0.62, 0.08], [-0.1, 1.23, 0], "#ff9f43", "metal", { rotate: [90, 0, 0], label: "hatch rim" }),
      p("box", [0.5, 0.08, 0.5], [-0.1, 0.9, 0], "#3d7bff", "cloth", { round: 0.4, label: "seat" }),
      p("tube", [1, 1, 1], [0, 0, 0], "#8a8f99", "metal", { points: [[0.26, 1.08, 0], [0.26, 1.62, 0], [0.46, 1.64, 0]], thick: 0.07, label: "periscope" }),
      p("coin", [0.24, 0.24, 0.05], [0.55, 0.55, 0.47], "#9fdcff", "glass", { label: "porthole" }),
      p("torus", [0.28, 0.28, 0.05], [0.55, 0.55, 0.48], "#ff9f43", "metal", { label: "porthole rim" }),
      p("coin", [0.24, 0.24, 0.05], [-0.55, 0.55, 0.47], "#9fdcff", "glass", { label: "porthole" }),
      p("torus", [0.28, 0.28, 0.05], [-0.55, 0.55, 0.48], "#ff9f43", "metal", { label: "porthole rim" }),
      p("wedge", [0.4, 0.36, 0.07], [-1.06, 0.96, 0], "#ff9f43", "plastic", { rotate: [0, 0, 18], label: "tail fin" }),
      p("box", [0.32, 0.06, 0.9], [-1.06, 0.55, 0], "#ff9f43", "plastic", { round: 0.45, label: "side fins" }),
      p("cone", [0.3, 0.22, 0.3], [-1.22, 0.55, 0], "#8a8f99", "metal", { rotate: [0, 0, 90], label: "hub" }),
      p("box", [0.05, 0.62, 0.12], [-1.32, 0.55, 0], "#8a8f99", "metal", { round: 0.5, label: "propeller" }),
    ],
  }, {
    // a little steam train engine: a red boiler with a black chimney and a puff of smoke, a gold dome, a bell, a lamp,
    // an open blue cab he sits in (a roof would go through his head: he's 2.2 tall sitting), a cowcatcher, red wheels
    name: "train", archetype: "ride", hold: "ride",
    parts: [
      p("box", [2.3, 0.2, 0.96], [0.05, 0.38, 0], "#3a3540", "metal", { round: 0.3, label: "chassis" }),
      p("cylinder", [0.72, 1.32, 0.72], [0.5, 0.82, 0], "#e5484d", "plastic", { rotate: [0, 0, 90], label: "boiler" }),
      p("coin", [0.74, 0.74, 0.06], [1.17, 0.82, 0], "#3a3540", "metal", { rotate: [0, 90, 0], label: "boiler front" }),
      p("torus", [0.74, 0.74, 0.05], [0.2, 0.82, 0], "#ffd34d", "metal", { rotate: [0, 90, 0], label: "band" }),
      p("cylinder", [0.26, 0.44, 0.26], [0.9, 1.36, 0], "#3a3540", "plastic", { taper: 1.5, label: "chimney" }),
      p("cloud", [0.56, 0.36, 0.26], [0.98, 1.72, 0], "#ffffff", "fluffy", { label: "smoke" }),
      p("sphere", [0.28, 0.24, 0.28], [0.45, 1.2, 0], "#ffd34d", "metal", { label: "dome" }),
      p("sphere", [0.18, 0.18, 0.14], [1.2, 1.12, 0], "#fff6c8", "glow", { label: "headlight" }),
      p("wedge", [0.38, 0.32, 0.86], [1.32, 0.3, 0], "#ffd34d", "metal", { rotate: [0, 0, -90], label: "cowcatcher" }),
      p("box", [0.9, 0.56, 1.0], [-0.62, 0.74, 0], "#3d7bff", "plastic", { round: 0.3, label: "cab" }),
      p("box", [0.6, 0.08, 0.72], [-0.62, 0.6, 0], "#ffd34d", "cloth", { round: 0.4, label: "seat" }),
      p("box", [0.14, 0.62, 1.0], [-1.0, 1.28, 0], "#3d7bff", "plastic", { round: 0.4, label: "cab back" }),
      p("box", [0.24, 0.08, 1.06], [-1.0, 1.62, 0], "#e5484d", "plastic", { round: 0.4, label: "cab top" }),
      p("dome", [0.2, 0.16, 0.2], [0.05, 1.22, 0], "#ffd34d", "metal", { rotate: [180, 0, 0], label: "bell" }),
      p("coin", [0.44, 0.44, 0.1], [0.82, 0.24, 0.5], "#e5484d", "plastic", { label: "wheel" }),
      p("coin", [0.44, 0.44, 0.1], [0.82, 0.24, -0.5], "#e5484d", "plastic", { label: "wheel" }),
      p("coin", [0.44, 0.44, 0.1], [0.24, 0.24, 0.5], "#e5484d", "plastic", { label: "wheel" }),
      p("coin", [0.44, 0.44, 0.1], [0.24, 0.24, -0.5], "#e5484d", "plastic", { label: "wheel" }),
      p("coin", [0.52, 0.52, 0.1], [-0.62, 0.28, 0.5], "#e5484d", "plastic", { label: "wheel" }),
      p("coin", [0.52, 0.52, 0.1], [-0.62, 0.28, -0.5], "#e5484d", "plastic", { label: "wheel" }),
      p("coin", [0.16, 0.16, 0.12], [0.82, 0.24, 0.52], "#ffd34d", "metal", { label: "hub" }),
      p("coin", [0.16, 0.16, 0.12], [0.24, 0.24, 0.52], "#ffd34d", "metal", { label: "hub" }),
      p("coin", [0.18, 0.18, 0.12], [-0.62, 0.28, 0.52], "#ffd34d", "metal", { label: "hub" }),
      p("capsule", [0.05, 1.5, 0.05], [0.1, 0.24, 0.57], "#ffd34d", "metal", { rotate: [0, 0, 90], label: "rod" }),
    ],
  }, {
    // a pirate ship (the M5 bench's was a brown steamboat): a wooden hull with a gold stripe and rim, dark portholes, a
    // tall mast in front of him with two puffy white sails and a crow's nest, a black flag with a white star, a
    // bowsprit, a lantern at the back (no cannons: everything's a toy)
    name: "pirate ship", archetype: "ride", hold: "ride",
    parts: [
      p("disc", [2.9, 0.04, 1.7], [0.15, 0.02, 0], "#7fd3ff", "glass", { label: "water" }),
      p("box", [2.0, 0.62, 1.16], [-0.15, 0.36, 0], "#8b5a2b", "wood", { round: 0.4, label: "hull" }),
      p("cone", [0.62, 0.62, 1.16], [1.16, 0.38, 0], "#8b5a2b", "wood", { rotate: [0, 0, -90], label: "bow" }),
      p("box", [2.02, 0.06, 1.18], [-0.15, 0.46, 0], "#e0b04a", "metal", { round: 0.4, label: "stripe" }),
      p("box", [2.02, 0.07, 1.18], [-0.15, 0.68, 0], "#e0b04a", "metal", { round: 0.5, label: "rim" }),
      p("coin", [0.14, 0.14, 0.04], [0.45, 0.32, 0.59], "#3a3540", "plastic", { label: "porthole" }),
      p("coin", [0.14, 0.14, 0.04], [0.8, 0.32, 0.59], "#3a3540", "plastic", { label: "porthole" }),
      p("coin", [0.14, 0.14, 0.04], [-0.95, 0.32, 0.59], "#3a3540", "plastic", { label: "porthole" }),
      p("box", [0.6, 0.08, 0.72], [-0.5, 0.56, 0], "#e5484d", "cloth", { round: 0.4, label: "seat" }),
      p("cylinder", [0.08, 2.22, 0.08], [0.62, 1.78, 0], "#6e4422", "wood", { label: "mast" }),
      p("box", [0.84, 0.66, 0.06], [0.62, 1.38, 0.06], "#fbf8f2", "cloth", { round: 0.5, label: "sail" }),
      p("box", [0.66, 0.5, 0.06], [0.62, 2.1, 0.06], "#fbf8f2", "cloth", { round: 0.5, label: "top sail" }),
      p("cylinder", [0.3, 0.16, 0.3], [0.62, 2.55, 0], "#8b5a2b", "wood", { label: "crow's nest" }),
      p("box", [0.38, 0.24, 0.02], [0.83, 2.78, 0], "#2b2a30", "cloth", { round: 0.2, label: "flag" }),
      p("star", [0.14, 0.14, 0.03], [0.85, 2.78, 0.02], "#ffffff", "cloth", { label: "flag star" }),
      p("cylinder", [0.05, 0.5, 0.05], [1.42, 0.78, 0], "#6e4422", "wood", { rotate: [0, 0, -62], label: "bowsprit" }),
      p("cylinder", [0.04, 0.34, 0.04], [-1.08, 0.85, 0], "#6e4422", "wood", { label: "lantern post" }),
      p("sphere", [0.15, 0.17, 0.15], [-1.08, 1.06, 0], "#ffd36b", "glow", { label: "lantern" }),
    ],
  }, {
    // a speedboat: a long white hull with a sharp bow and a red racing stripe, a windscreen and a steering wheel in front
    // of his seat, an outboard motor with a propeller at the back, a splash of spray behind it
    name: "speedboat", archetype: "ride", hold: "ride",
    parts: [
      p("disc", [2.9, 0.04, 1.6], [0.05, 0.02, 0], "#7fd3ff", "glass", { label: "water" }),
      p("box", [1.8, 0.42, 1.0], [-0.15, 0.26, 0], "#fbf8f2", "plastic", { round: 0.5, label: "hull" }),
      p("cone", [0.42, 0.8, 1.0], [1.13, 0.27, 0], "#fbf8f2", "plastic", { rotate: [0, 0, -90], label: "bow" }),
      p("box", [1.82, 0.08, 1.02], [-0.15, 0.28, 0], "#e5484d", "plastic", { round: 0.5, label: "stripe" }),
      p("box", [1.82, 0.06, 1.02], [-0.15, 0.47, 0], "#2f4a8a", "plastic", { round: 0.5, label: "rim" }),
      p("star", [0.18, 0.18, 0.04], [0.5, 0.3, 0.5], "#ffd34d", "plastic", { label: "star" }),
      p("box", [0.6, 0.08, 0.7], [-0.4, 0.42, 0], "#e5484d", "cloth", { round: 0.4, label: "seat" }),
      p("box", [0.05, 0.34, 0.84], [0.3, 0.66, 0], "#bfe6ff", "glass", { round: 0.4, rotate: [0, 0, -30], label: "windscreen" }),
      p("torus", [0.26, 0.26, 0.04], [0.12, 0.7, 0.16], "#3a3540", "rubber", { rotate: [0, 90, -20], label: "steering" }),
      p("cylinder", [0.035, 0.22, 0.035], [0.2, 0.6, 0.16], "#3a3540", "metal", { rotate: [0, 0, -50], label: "steering column" }),
      p("box", [0.3, 0.46, 0.34], [-1.12, 0.5, 0], "#2f4a8a", "plastic", { round: 0.4, label: "motor" }),
      p("cylinder", [0.1, 0.34, 0.1], [-1.14, 0.2, 0], "#3a3540", "metal", { label: "motor leg" }),
      p("box", [0.04, 0.26, 0.08], [-1.22, 0.16, 0], "#c9ced6", "metal", { round: 0.5, label: "propeller" }),
      p("cloud", [0.34, 0.2, 0.34], [-1.3, 0.12, 0], "#ffffff", "fluffy", { label: "spray" }),
    ],
  }],
};
