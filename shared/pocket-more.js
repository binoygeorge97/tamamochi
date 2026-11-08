// More hand-made patterns for his pocket (Nov 3, the activity book): the things everyday activities need, so "let's
// cook", "play the drums", "go fishing", "build a snowman" have something real in his hooves or beside him. craft.js
// adds these to PROP_EXAMPLES (they're validated with the rest).
const p = (shape, size, at, color, material, more = {}) => ({ shape, size, at, color, material, ...more });

export const MORE_PROPS = {
  handheld_canopy: [{
    name: "butterfly net", archetype: "handheld_canopy", hold: "upright",
    parts: [
      p("cylinder", [0.05, 1.0, 0.05], [0, 0.5, 0], "#c99a62", "wood", { label: "stick" }),
      p("torus", [0.44, 0.44, 0.035], [0, 1.1, 0], "#d4a443", "metal", { rotate: [90, 0, 0], label: "hoop" }),
      p("cone", [0.42, 0.42, 0.42], [0, 0.9, 0], "#f4fbff", "cloth", { rotate: [180, 0, 0], label: "net" }),
    ],
  }, {
    name: "fishing rod", archetype: "handheld_canopy", hold: "upright",
    parts: [
      p("cylinder", [0.045, 1.4, 0.045], [0.24, 0.66, 0], "#3d7bff", "plastic", { rotate: [0, 0, -20], taper: 0.45, label: "rod" }),
      p("cylinder", [0.13, 0.07, 0.13], [0.06, 0.2, 0.05], "#c9ced6", "metal", { rotate: [90, 0, 0], label: "reel" }),
      p("cylinder", [0.006, 0.66, 0.006], [0.48, 0.99, 0], "#ffffff", "plastic", { label: "line" }),
      p("sphere", [0.11, 0.11, 0.11], [0.48, 0.63, 0], "#e5484d", "plastic", { label: "bobber" }),
      p("sphere", [0.115, 0.06, 0.115], [0.48, 0.66, 0], "#ffffff", "plastic"),
    ],
  }],
  head_wearable: [{
    // a scammer's silly disguise for Cocoa's skits (Nov 7): dark sunglasses …
    name: "dark sunglasses", archetype: "head_wearable",
    parts: [
      p("box", [0.3, 0.2, 0.03], [-0.21, -0.52, 0.65], "#1b1b22", "glass", { round: 0.5, label: "lens" }),
      p("box", [0.3, 0.2, 0.03], [0.21, -0.52, 0.65], "#1b1b22", "glass", { round: 0.5 }),
      p("box", [0.14, 0.035, 0.03], [0, -0.47, 0.66], "#1b1b22", "plastic", { round: 0.4, label: "bridge" }),
    ],
  }, {
    // … and the whole disguise in one (one thing on the head at a time): the dark glasses and a big fake moustache,
    // curled at the ends
    name: "silly disguise", archetype: "head_wearable",
    parts: [
      p("box", [0.3, 0.2, 0.03], [-0.21, -0.52, 0.65], "#1b1b22", "glass", { round: 0.5, label: "lens" }),
      p("box", [0.3, 0.2, 0.03], [0.21, -0.52, 0.65], "#1b1b22", "glass", { round: 0.5 }),
      p("box", [0.14, 0.035, 0.03], [0, -0.47, 0.66], "#1b1b22", "plastic", { round: 0.4, label: "bridge" }),
      p("sphere", [0.17, 0.24, 0.16], [0, -0.63, 0.7], "#f2a48c", "plastic", { label: "big fake nose" }),   // (the classic: glasses, nose and moustache in one)
      p("capsule", [0.13, 0.3, 0.1], [-0.13, -0.8, 0.66], "#3b2618", "fluffy", { rotate: [0, 0, 70], label: "left half" }),
      p("capsule", [0.13, 0.3, 0.1], [0.13, -0.8, 0.66], "#3b2618", "fluffy", { rotate: [0, 0, -70], label: "right half" }),
      p("sphere", [0.09, 0.09, 0.08], [-0.28, -0.74, 0.63], "#3b2618", "fluffy", { label: "curl" }),
      p("sphere", [0.09, 0.09, 0.08], [0.28, -0.74, 0.63], "#3b2618", "fluffy"),
    ],
  }, {
    name: "chef hat", archetype: "head_wearable",
    parts: [
      p("cylinder", [0.78, 0.22, 0.78], [0, 0.12, 0], "#ffffff", "cloth", { label: "band" }),
      p("sphere", [0.92, 0.4, 0.84], [0, 0.34, 0], "#ffffff", "cloth", { label: "puff" }),
      p("sphere", [0.44, 0.3, 0.44], [-0.2, 0.46, 0.02], "#ffffff", "cloth"),
      p("sphere", [0.44, 0.3, 0.44], [0.2, 0.46, -0.02], "#ffffff", "cloth"),
    ],
  }, {
    name: "wizard hat", archetype: "head_wearable",
    parts: [
      p("cone", [0.78, 1.0, 0.78], [0, 0.52, 0], "#6c4bd6", "cloth", { label: "cone" }),
      p("disc", [1.45, 0.05, 1.45], [0, 0.04, 0], "#5a3cc0", "cloth", { label: "brim" }),
      p("star", [0.17, 0.17, 0.04], [0.06, 0.42, 0.3], "#fff3b0", "glow", { rotate: [-20, 0, 0], label: "star" }),
      p("star", [0.11, 0.11, 0.03], [-0.1, 0.72, 0.17], "#fff3b0", "glow", { rotate: [-20, 0, 0] }),
    ],
  }, {
    name: "firefighter helmet", archetype: "head_wearable",
    parts: [
      p("dome", [0.98, 0.52, 0.98], [0, 0.08, 0], "#e5484d", "plastic", { label: "shell" }),
      p("disc", [1.3, 0.04, 1.42], [0, 0.07, 0.06], "#c9343a", "plastic", { label: "brim" }),
      p("capsule", [0.1, 0.62, 0.12], [0, 0.36, 0], "#c9343a", "plastic", { rotate: [90, 0, 0], label: "ridge" }),
      p("coin", [0.26, 0.3, 0.04], [0, 0.3, 0.44], "#f2c14e", "metal", { rotate: [-28, 0, 0], label: "badge" }),
    ],
  }, {
    name: "nightcap", archetype: "head_wearable",
    parts: [
      p("cone", [0.72, 0.92, 0.72], [0.12, 0.4, 0], "#7fb6ff", "cloth", { rotate: [0, 0, -26], label: "cap" }),
      p("torus", [0.76, 0.76, 0.12], [0, 0.02, 0], "#ffffff", "fluffy", { rotate: [90, 0, 0], label: "band" }),
      p("sphere", [0.2, 0.2, 0.2], [0.34, 0.82, 0], "#ffffff", "fluffy", { label: "pompom" }),
      p("star", [0.13, 0.13, 0.03], [0.08, 0.36, 0.3], "#fff3b0", "paper", { rotate: [-18, 0, 0] }),
    ],
  }, {
    name: "flower crown", archetype: "head_wearable",
    parts: [
      p("torus", [0.92, 0.92, 0.07], [0, 0.02, 0], "#62c46b", "cloth", { rotate: [90, 0, 0], label: "vine" }),
      p("sphere", [0.17, 0.17, 0.1], [0, 0.05, 0.46], "#ff8fb8", "cloth", { label: "flower" }),
      p("sphere", [0.15, 0.15, 0.1], [-0.33, 0.05, 0.33], "#ffd34d", "cloth"),
      p("sphere", [0.15, 0.15, 0.1], [0.33, 0.05, 0.33], "#ffffff", "cloth"),
      p("sphere", [0.14, 0.14, 0.1], [-0.46, 0.05, 0], "#b48cff", "cloth"),
      p("sphere", [0.14, 0.14, 0.1], [0.46, 0.05, 0], "#ff8fb8", "cloth"),
      p("leaf", [0.1, 0.16, 0.03], [0.14, 0.05, 0.44], "#62c46b", "cloth", { rotate: [0, 0, -60] }),
    ],
  }, {
    // dressing up for a job (Nov 7, Binoy: "let mochi be capable to dress up as any popular professions like Doctor,
    // engineer, police etc. No need to over dress him, just make sure he has something that shows that profession
    // clearly"): one hat that says it, sat on his head like the chef's hat and the firefighter's helmet
    // a police officer's peaked cap: navy band and wide flat top, a black visor, a gold badge at the front
    name: "police cap", archetype: "head_wearable",
    parts: [
      p("cylinder", [0.88, 0.2, 0.88], [0, 0.14, 0], "#24324f", "cloth", { label: "band" }),
      p("cylinder", [1.1, 0.12, 1.04], [0, 0.3, -0.02], "#24324f", "cloth", { round: 0.5, label: "top" }),
      p("torus", [0.9, 0.9, 0.04], [0, 0.07, 0], "#14141a", "plastic", { rotate: [90, 0, 0], label: "band trim" }),
      p("disc", [0.72, 0.04, 0.34], [0, 0.07, 0.5], "#14141a", "plastic", { rotate: [-14, 0, 0], label: "visor" }),
      p("coin", [0.17, 0.19, 0.04], [0, 0.18, 0.45], "#e8b730", "metal", { label: "badge" }),
      p("star", [0.08, 0.08, 0.02], [0, 0.18, 0.475], "#fff3b0", "metal", { label: "badge star" }),
    ],
  }, {
    // a pilot's cap: like a police cap but white on top, gold braid on the visor and gold wings at the front
    name: "pilot cap", archetype: "head_wearable",
    parts: [
      p("cylinder", [0.88, 0.2, 0.88], [0, 0.14, 0], "#1d2a45", "cloth", { label: "band" }),
      p("cylinder", [1.1, 0.12, 1.04], [0, 0.3, -0.02], "#fbf8f2", "cloth", { round: 0.5, label: "top" }),
      p("disc", [0.72, 0.04, 0.34], [0, 0.07, 0.5], "#14141a", "plastic", { rotate: [-14, 0, 0], label: "visor" }),
      p("capsule", [0.04, 0.5, 0.04], [0, 0.1, 0.46], "#e8b730", "metal", { rotate: [0, 0, 90], label: "braid" }),
      p("coin", [0.1, 0.1, 0.04], [0, 0.19, 0.45], "#e8b730", "metal", { label: "wings" }),
      p("capsule", [0.06, 0.2, 0.03], [-0.13, 0.2, 0.44], "#e8b730", "metal", { rotate: [0, 0, 70], label: "wing" }),
      p("capsule", [0.06, 0.2, 0.03], [0.13, 0.2, 0.44], "#e8b730", "metal", { rotate: [0, 0, -70], label: "wing" }),
    ],
  }, {
    // a builder's or engineer's hard hat: a yellow shell with a ridge down the middle and a little brim all round
    name: "hard hat", archetype: "head_wearable",
    parts: [
      p("dome", [1.14, 0.64, 1.14], [0, 0.14, 0], "#ffc629", "plastic", { label: "shell" }),
      p("disc", [1.38, 0.04, 1.48], [0, 0.0, 0.06], "#f2b200", "plastic", { label: "brim" }),
      p("capsule", [0.14, 0.68, 0.16], [0, 0.44, 0], "#f2b200", "plastic", { rotate: [90, 0, 0], label: "ridge" }),
    ],
  }, {
    // a farmer's straw hat: a round straw crown, a wide brim, a red band
    name: "straw hat", archetype: "head_wearable",
    parts: [
      p("cylinder", [0.86, 0.38, 0.86], [0, 0.24, 0], "#e9c97a", "wood", { taper: 0.9, round: 0.6, label: "crown" }),
      p("cylinder", [1.66, 0.04, 1.66], [0, 0.06, 0], "#e3bf6c", "wood", { round: 0.5, label: "brim" }),
      p("cylinder", [0.89, 0.09, 0.89], [0, 0.12, 0], "#d63a44", "cloth", { label: "band" }),
    ],
  }, {
    // an artist's beret, tipped to one side, with its little stalk on top
    name: "beret", archetype: "head_wearable",
    parts: [
      p("sphere", [1.0, 0.26, 0.94], [0.06, 0.12, 0], "#d63a44", "cloth", { rotate: [0, 0, -10], label: "beret" }),
      p("cylinder", [0.06, 0.08, 0.06], [0.08, 0.27, 0], "#a82a33", "cloth", { label: "stalk" }),
    ],
  }, {
    // a detective's deerstalker: a brown checked cap with a peak in front and behind, the ear flaps tied up on top
    name: "detective hat", archetype: "head_wearable",
    parts: [
      p("dome", [0.96, 0.46, 0.96], [0, 0.07, 0], "#8f6a44", "cloth", { pattern: "checks", pattern_color: "#c9a77c", label: "cap" }),
      p("disc", [0.52, 0.04, 0.3], [0, 0.08, 0.52], "#8f6a44", "cloth", { rotate: [-16, 0, 0], label: "front peak" }),
      p("disc", [0.52, 0.04, 0.3], [0, 0.08, -0.52], "#8f6a44", "cloth", { rotate: [16, 0, 0], label: "back peak" }),
      p("sphere", [0.16, 0.08, 0.1], [0, 0.31, 0], "#6b4e31", "cloth", { label: "bow" }),
    ],
  }, {
    // an astronaut's helmet (a clear bubble, then a white hood, were lost in his fleece: Nov 7): a white space helmet
    // over the top of his head like his protective helmet, a grey rim, a gold visor flipped up on his forehead, a
    // little antenna with a blue light, a red mission patch on the side
    name: "space helmet", archetype: "head_wearable",
    parts: [
      p("dome", [1.36, 0.62, 1.3], [0, -0.02, -0.02], "#f4f6fa", "plastic", { label: "shell" }),
      p("torus", [1.38, 1.32, 0.07], [0, -0.33, -0.02], "#a9b3c1", "rubber", { rotate: [90, 0, 0], label: "rim" }),
      p("box", [0.78, 0.2, 0.08], [0, -0.1, 0.56], "#ffcf5c", "metal", { round: 0.5, rotate: [-34, 0, 0], label: "visor" }),
      p("cylinder", [0.04, 0.18, 0.04], [0.3, 0.36, -0.06], "#c9ced6", "metal", { label: "antenna" }),
      p("sphere", [0.09, 0.09, 0.09], [0.3, 0.47, -0.06], "#2fd8ff", "glow", { label: "light" }),
      p("coin", [0.18, 0.18, 0.03], [-0.66, -0.12, 0.06], "#d63a44", "plastic", { rotate: [0, -80, 0], label: "patch" }),
    ],
  }],
  handheld_tool: [{
    // the stop sign (Nov 7, the scam check: he holds it up at a scam, "Blocked!"): a red round sign, white rim, a big
    // white hand in the middle, on a short pole
    name: "stop sign", archetype: "handheld_tool", hold: "upright",
    parts: [
      p("cylinder", [0.06, 0.62, 0.06], [0, 0.2, 0], "#c9ced6", "metal", { label: "pole" }),
      p("coin", [0.7, 0.7, 0.06], [0, 0.74, 0.02], "#e0263a", "plastic", { label: "sign" }),
      p("torus", [0.7, 0.7, 0.045], [0, 0.74, 0.03], "#ffffff", "plastic", { label: "rim" }),
      p("paw", [0.36, 0.4, 0.05], [0, 0.73, 0.07], "#ffffff", "plastic", { label: "hand" }),
    ],
  }, {
    name: "wooden spoon", archetype: "handheld_tool", hold: "upright",
    parts: [
      p("cylinder", [0.06, 0.72, 0.06], [0, 0.22, 0], "#c99a62", "wood", { label: "handle" }),
      p("sphere", [0.19, 0.25, 0.07], [0, 0.66, 0], "#c99a62", "wood", { label: "bowl" }),
    ],
  }, {
    name: "toothbrush", archetype: "handheld_tool", hold: "upright",
    parts: [
      p("box", [0.07, 0.62, 0.05], [0, 0.2, 0], "#5ec8ff", "plastic", { round: 0.45, label: "handle" }),
      p("box", [0.09, 0.15, 0.08], [0, 0.56, 0.05], "#ffffff", "fluffy", { round: 0.2, label: "bristles" }),
      p("capsule", [0.06, 0.13, 0.06], [0, 0.57, 0.11], "#a8f0d8", "candy", { label: "toothpaste" }),
    ],
  }, {
    name: "watering can", archetype: "handheld_tool", hold: "upright",
    parts: [
      p("cylinder", [0.36, 0.32, 0.36], [0, 0.22, 0], "#62c46b", "metal", { label: "can" }),
      p("cylinder", [0.05, 0.42, 0.05], [0.28, 0.32, 0], "#62c46b", "metal", { rotate: [0, 0, -55], label: "spout" }),
      p("cylinder", [0.11, 0.06, 0.11], [0.45, 0.45, 0], "#d4a443", "metal", { rotate: [0, 0, -55], label: "rose" }),
      p("tube", [1, 1, 1], [0, 0, 0], "#4fa65a", "metal", { points: [[-0.15, 0.34, 0], [-0.12, 0.47, 0], [0.08, 0.47, 0], [0.12, 0.36, 0]], thick: 0.04, label: "handle" }),
    ],
  }, {
    name: "little trowel", archetype: "handheld_tool", hold: "upright",
    parts: [
      p("cylinder", [0.08, 0.3, 0.08], [0, 0.05, 0], "#c99a62", "wood", { label: "handle" }),
      p("cylinder", [0.03, 0.14, 0.03], [0, 0.26, 0], "#c9ced6", "metal", { label: "neck" }),
      p("leaf", [0.22, 0.34, 0.03], [0, 0.48, 0], "#c9ced6", "metal", { label: "blade" }),
    ],
  }, {
    name: "camera", archetype: "handheld_tool", hold: "upright",
    parts: [
      p("box", [0.42, 0.28, 0.18], [0, 0.22, 0], "#2b2b33", "plastic", { round: 0.25, label: "body" }),
      p("cylinder", [0.17, 0.12, 0.17], [0.04, 0.22, 0.12], "#c9ced6", "metal", { rotate: [90, 0, 0], label: "lens" }),
      p("coin", [0.12, 0.12, 0.02], [0.04, 0.22, 0.185], "#5ec8ff", "glass", { label: "glass" }),
      p("box", [0.1, 0.06, 0.06], [-0.12, 0.39, 0], "#fff3b0", "glow", { round: 0.3, label: "flash" }),
      p("cylinder", [0.06, 0.04, 0.06], [0.14, 0.38, 0], "#e5484d", "plastic", { label: "button" }),
    ],
  }, {
    name: "telescope", archetype: "handheld_tool", hold: "upright",
    parts: [
      p("cylinder", [0.13, 0.8, 0.13], [0.2, 0.35, 0], "#3d7bff", "metal", { rotate: [0, 0, -30], taper: 1.35, label: "tube" }),
      p("cylinder", [0.09, 0.12, 0.09], [-0.02, -0.02, 0], "#d4a443", "metal", { rotate: [0, 0, -30], label: "eyepiece" }),
      p("cylinder", [0.2, 0.06, 0.2], [0.36, 0.63, 0], "#d4a443", "metal", { rotate: [0, 0, -30], label: "band" }),
      p("star", [0.1, 0.1, 0.03], [0.12, 0.2, 0.08], "#fff3b0", "glow", { rotate: [0, 0, -30] }),
    ],
  }, {
    name: "tennis racket", archetype: "handheld_tool", hold: "upright",
    parts: [
      p("cylinder", [0.075, 0.38, 0.075], [0, 0.08, 0], "#e5484d", "rubber", { label: "grip" }),
      p("cylinder", [0.045, 0.16, 0.045], [0, 0.33, 0], "#5b9cf0", "plastic", { label: "throat" }),
      p("torus", [0.44, 0.54, 0.045], [0, 0.66, 0], "#5b9cf0", "plastic", { label: "frame" }),
      p("coin", [0.4, 0.5, 0.01], [0, 0.66, 0], "#f4f4f4", "cloth", { label: "strings" }),
    ],
  }, {
    name: "foam sword", archetype: "handheld_tool", hold: "upright",
    parts: [
      p("box", [0.12, 0.76, 0.05], [0, 0.6, 0], "#7fd1ff", "rubber", { round: 0.45, label: "blade" }),
      p("box", [0.36, 0.07, 0.08], [0, 0.2, 0], "#ffd34d", "rubber", { round: 0.4, label: "guard" }),
      p("cylinder", [0.08, 0.26, 0.08], [0, 0.04, 0], "#9b6bd6", "rubber", { label: "handle" }),
      p("sphere", [0.1, 0.1, 0.1], [0, -0.12, 0], "#ffd34d", "rubber", { label: "pommel" }),
    ],
  }, {
    name: "feather duster", archetype: "handheld_tool", hold: "upright",
    parts: [
      p("cylinder", [0.06, 0.55, 0.06], [0, 0.17, 0], "#c99a62", "wood", { label: "handle" }),
      p("leaf", [0.17, 0.36, 0.04], [0, 0.62, 0], "#ff8fb8", "fluffy", { label: "feathers" }),
      p("leaf", [0.15, 0.32, 0.04], [-0.1, 0.57, 0], "#ffd34d", "fluffy", { rotate: [0, 0, 30] }),
      p("leaf", [0.15, 0.32, 0.04], [0.1, 0.57, 0], "#7fd1ff", "fluffy", { rotate: [0, 0, -30] }),
      p("leaf", [0.13, 0.28, 0.04], [-0.17, 0.49, 0], "#b48cff", "fluffy", { rotate: [0, 0, 55] }),
      p("leaf", [0.13, 0.28, 0.04], [0.17, 0.49, 0], "#7be08a", "fluffy", { rotate: [0, 0, -55] }),
    ],
  }, {
    name: "maraca", archetype: "handheld_tool", hold: "upright",
    parts: [
      p("sphere", [0.3, 0.34, 0.3], [0, 0.46, 0], "#ff6f91", "plastic", { pattern: "stripes", pattern_color: "#ffd34d", label: "head" }),
      p("cylinder", [0.07, 0.34, 0.07], [0, 0.13, 0], "#c99a62", "wood", { label: "handle" }),
      p("star", [0.1, 0.1, 0.03], [0, 0.48, 0.15], "#ffffff", "paper"),
    ],
  }, {
    name: "toy trumpet", archetype: "handheld_tool", hold: "upright",
    parts: [
      p("cylinder", [0.06, 0.56, 0.06], [0, 0.2, 0], "#f2c14e", "metal", { label: "pipe" }),
      p("cylinder", [0.12, 0.22, 0.12], [0, 0.56, 0], "#f2c14e", "metal", { taper: 2.4, label: "bell" }),
      p("torus", [0.3, 0.3, 0.03], [0, 0.67, 0], "#ffd86b", "metal", { rotate: [90, 0, 0], label: "rim" }),
      p("sphere", [0.05, 0.05, 0.05], [0.06, 0.14, 0], "#ffffff", "plastic", { label: "valve" }),
      p("sphere", [0.05, 0.05, 0.05], [0.06, 0.22, 0], "#ffffff", "plastic"),
      p("sphere", [0.05, 0.05, 0.05], [0.06, 0.3, 0], "#ffffff", "plastic"),
    ],
  }, {
    name: "toy hammer", archetype: "handheld_tool", hold: "upright",
    parts: [
      p("cylinder", [0.07, 0.5, 0.07], [0, 0.15, 0], "#c99a62", "wood", { label: "handle" }),
      p("box", [0.34, 0.16, 0.16], [0, 0.46, 0], "#e5484d", "rubber", { round: 0.3, label: "head" }),
    ],
  }, {
    // an engineer's wrench (Nov 7): an open jaw at the top, a long silver handle, a red grip where his hoof holds it
    name: "wrench", archetype: "handheld_tool", hold: "upright",
    parts: [
      p("box", [0.1, 0.22, 0.07], [0, 0.0, 0], "#d63a44", "rubber", { round: 0.4, label: "grip" }),
      p("box", [0.07, 0.36, 0.045], [0, 0.26, 0], "#c9ced6", "metal", { round: 0.3, label: "handle" }),
      p("box", [0.22, 0.09, 0.05], [0, 0.46, 0], "#c9ced6", "metal", { round: 0.3, label: "head" }),
      p("box", [0.06, 0.14, 0.05], [-0.08, 0.56, 0], "#c9ced6", "metal", { round: 0.3, label: "jaw" }),
      p("box", [0.06, 0.14, 0.05], [0.08, 0.56, 0], "#c9ced6", "metal", { round: 0.3, label: "jaw" }),
    ],
  }, {
    // the judge's gavel (Nov 7, Binoy: "can mochi also act like a judge"): a turned wooden mallet, gold bands round its head
    name: "gavel", archetype: "handheld_tool", hold: "upright",
    parts: [
      p("cylinder", [0.06, 0.46, 0.06], [0, 0.13, 0], "#8f5b36", "wood", { label: "handle" }),
      p("sphere", [0.08, 0.06, 0.08], [0, -0.11, 0], "#8f5b36", "wood", { label: "knob" }),
      p("cylinder", [0.16, 0.38, 0.16], [0, 0.42, 0], "#6b3f22", "wood", { rotate: [0, 0, 90], label: "head" }),
      p("cylinder", [0.172, 0.035, 0.172], [-0.12, 0.42, 0], "#e8b730", "metal", { rotate: [0, 0, 90], label: "band" }),
      p("cylinder", [0.172, 0.035, 0.172], [0.12, 0.42, 0], "#e8b730", "metal", { rotate: [0, 0, 90], label: "band" }),
    ],
  }, {
    // a hackathon judge's clipboard: the score sheet clipped on, a few lines, a gold star for the winner
    name: "clipboard", archetype: "handheld_tool", hold: "upright",
    parts: [
      p("box", [0.42, 0.56, 0.03], [0, 0.3, 0], "#c99a62", "wood", { round: 0.1, label: "board" }),
      p("box", [0.36, 0.46, 0.01], [0, 0.27, 0.02], "#fffaf2", "paper", { label: "score sheet" }),
      p("box", [0.17, 0.07, 0.045], [0, 0.56, 0.02], "#c9ced6", "metal", { round: 0.3, label: "clip" }),
      p("box", [0.24, 0.016, 0.006], [-0.03, 0.42, 0.028], "#9aa3ad", "paper", { label: "line" }),
      p("box", [0.24, 0.016, 0.006], [-0.03, 0.36, 0.028], "#9aa3ad", "paper", { label: "line" }),
      p("box", [0.24, 0.016, 0.006], [-0.03, 0.3, 0.028], "#9aa3ad", "paper", { label: "line" }),
      p("box", [0.16, 0.016, 0.006], [-0.07, 0.24, 0.028], "#9aa3ad", "paper", { label: "line" }),
      p("star", [0.09, 0.09, 0.01], [0.1, 0.13, 0.03], "#ffd34d", "paper", { label: "gold star" }),
    ],
  }, {
    name: "pizza slice", archetype: "handheld_tool", hold: "upright",
    parts: [
      p("wedge", [0.42, 0.52, 0.05], [0, 0.36, 0], "#ffd34d", "candy", { label: "cheese" }),
      p("capsule", [0.07, 0.44, 0.07], [0, 0.1, 0], "#d99a4e", "candy", { rotate: [0, 0, 90], label: "crust" }),
      p("coin", [0.09, 0.09, 0.02], [-0.07, 0.24, 0.025], "#e5484d", "candy", { label: "pepperoni" }),
      p("coin", [0.08, 0.08, 0.02], [0.07, 0.3, 0.025], "#e5484d", "candy"),
      p("coin", [0.06, 0.06, 0.02], [0, 0.43, 0.025], "#e5484d", "candy"),
    ],
  }, {
    name: "cookie", archetype: "handheld_tool", hold: "upright",
    parts: [
      p("coin", [0.38, 0.38, 0.06], [0, 0.24, 0], "#d99a4e", "candy", { label: "cookie" }),
      p("sphere", [0.06, 0.06, 0.03], [-0.08, 0.3, 0.035], "#4a3426", "candy", { label: "chip" }),
      p("sphere", [0.06, 0.06, 0.03], [0.09, 0.27, 0.035], "#4a3426", "candy"),
      p("sphere", [0.05, 0.05, 0.03], [-0.02, 0.15, 0.035], "#4a3426", "candy"),
      p("sphere", [0.05, 0.05, 0.03], [0.05, 0.37, 0.035], "#4a3426", "candy"),
    ],
  }, {
    name: "apple", archetype: "handheld_tool", hold: "upright",
    parts: [
      p("sphere", [0.32, 0.3, 0.32], [0, 0.17, 0], "#e5484d", "candy", { label: "apple" }),
      p("cylinder", [0.025, 0.1, 0.025], [0, 0.35, 0], "#6b4a32", "wood", { label: "stem" }),
      p("leaf", [0.1, 0.14, 0.02], [0.06, 0.37, 0], "#62c46b", "plastic", { rotate: [0, 0, -50], label: "leaf" }),
    ],
  }, {
    name: "popcorn", archetype: "handheld_tool", hold: "upright",
    parts: [
      p("cylinder", [0.36, 0.42, 0.36], [0, 0.15, 0], "#ffffff", "paper", { taper: 1.25, pattern: "segments", pattern_color: "#e5484d", label: "bucket" }),
      p("sphere", [0.15, 0.13, 0.15], [0, 0.43, 0.04], "#fff3d0", "fluffy", { label: "popcorn" }),
      p("sphere", [0.13, 0.12, 0.13], [-0.12, 0.4, 0], "#fff3d0", "fluffy"),
      p("sphere", [0.13, 0.12, 0.13], [0.12, 0.41, -0.02], "#fff3d0", "fluffy"),
      p("sphere", [0.12, 0.11, 0.12], [0.03, 0.5, -0.06], "#fff3d0", "fluffy"),
    ],
  }, {
    name: "hot cocoa", archetype: "handheld_tool", hold: "upright",
    parts: [
      p("cylinder", [0.3, 0.32, 0.3], [0, 0.12, 0], "#ff8fb8", "plastic", { label: "mug" }),
      p("tube", [1, 1, 1], [0, 0, 0], "#ff8fb8", "plastic", { points: [[0.14, 0.22, 0], [0.25, 0.18, 0], [0.25, 0.07, 0], [0.14, 0.04, 0]], thick: 0.045, label: "handle" }),
      p("disc", [0.26, 0.02, 0.26], [0, 0.27, 0], "#6b4a32", "candy", { label: "cocoa" }),
      p("box", [0.08, 0.07, 0.08], [-0.05, 0.29, 0.03], "#ffffff", "fluffy", { round: 0.4, label: "marshmallow" }),
      p("box", [0.08, 0.07, 0.08], [0.06, 0.29, -0.03], "#ffffff", "fluffy", { round: 0.4, rotate: [0, 30, 0] }),
    ],
  }],
  throwable: [{
    name: "soccer ball", archetype: "throwable", hold: "throw", ammo: "stars",
    parts: [
      p("sphere", [0.38, 0.38, 0.38], [0, 0.15, 0], "#ffffff", "rubber", { label: "ball" }),
      p("sphere", [0.12, 0.12, 0.05], [0, 0.15, 0.175], "#2b2b33", "rubber", { label: "patch" }),
      p("sphere", [0.1, 0.1, 0.05], [-0.13, 0.27, 0.1], "#2b2b33", "rubber", { rotate: [-30, -40, 0] }),
      p("sphere", [0.1, 0.1, 0.05], [0.13, 0.27, 0.1], "#2b2b33", "rubber", { rotate: [-30, 40, 0] }),
      p("sphere", [0.1, 0.1, 0.05], [0, 0.0, 0.13], "#2b2b33", "rubber", { rotate: [40, 0, 0] }),
    ],
  }, {
    name: "basketball", archetype: "throwable", hold: "throw", ammo: "stars",
    parts: [
      p("sphere", [0.4, 0.4, 0.4], [0, 0.16, 0], "#f08a3c", "rubber", { label: "ball" }),
      p("torus", [0.41, 0.41, 0.015], [0, 0.16, 0], "#4a3426", "rubber", { rotate: [0, 90, 0], label: "seam" }),
      p("torus", [0.41, 0.41, 0.015], [0, 0.16, 0], "#4a3426", "rubber", { rotate: [90, 0, 0] }),
      p("torus", [0.41, 0.41, 0.015], [0, 0.16, 0], "#4a3426", "rubber"),
    ],
  }],
  companion: [{
    // a child's sun (Nov 4: "make a sun" came out as a star badge): a round face in a ring of pointed rays, a smile
    // and rosy cheeks. The rays are its biggest colour, so a drawn sun's rays take your first crayon, its face the next.
    name: "sun", archetype: "companion",
    parts: [
      p("burst", [1.3, 1.3, 0.16], [0, 0.65, -0.04], "#ff9f43", "plastic", { label: "rays" }),
      p("sphere", [0.78, 0.78, 0.36], [0, 0.65, 0.04], "#ffd34d", "candy", { label: "face" }),
      p("sphere", [0.08, 0.1, 0.04], [-0.13, 0.72, 0.205], "#2a1d18", "plastic", { label: "eye" }),
      p("sphere", [0.08, 0.1, 0.04], [0.13, 0.72, 0.205], "#2a1d18", "plastic"),
      p("torus", [0.22, 0.14, 0.035], [0, 0.615, 0.215], "#2a1d18", "plastic", { arc: 180, rotate: [0, 0, 180], label: "smile" }),
      p("coin", [0.1, 0.07, 0.02], [-0.24, 0.59, 0.18], "#ff8fb8", "rubber", { label: "cheek" }),
      p("coin", [0.1, 0.07, 0.02], [0.24, 0.59, 0.18], "#ff8fb8", "rubber"),
    ],
  }, {
    name: "toy drum", archetype: "companion",
    parts: [
      p("cylinder", [0.6, 0.42, 0.6], [0, 0.21, 0], "#e5484d", "plastic", { pattern: "zigzag", pattern_color: "#ffd34d", label: "drum" }),
      p("disc", [0.58, 0.03, 0.58], [0, 0.43, 0], "#fbf8f1", "cloth", { label: "skin" }),
      p("torus", [0.62, 0.62, 0.05], [0, 0.42, 0], "#f2c14e", "metal", { rotate: [90, 0, 0], label: "rim" }),
      p("torus", [0.62, 0.62, 0.05], [0, 0.02, 0], "#f2c14e", "metal", { rotate: [90, 0, 0] }),
      p("star", [0.14, 0.14, 0.03], [0, 0.21, 0.31], "#ffffff", "paper"),
      p("cylinder", [0.035, 0.42, 0.035], [-0.04, 0.47, 0.12], "#c99a62", "wood", { rotate: [0, 0, 70], label: "stick" }),
      p("cylinder", [0.035, 0.42, 0.035], [0.04, 0.47, 0.06], "#c99a62", "wood", { rotate: [0, 0, -70] }),
    ],
  }, {
    name: "little piano", archetype: "companion",
    parts: [
      p("box", [1.0, 0.42, 0.42], [0, 0.38, 0], "#2b2b33", "plastic", { round: 0.2, label: "piano" }),
      p("box", [0.9, 0.05, 0.16], [0, 0.6, 0.14], "#fbf8f1", "plastic", { round: 0.1, label: "keys" }),
      p("box", [0.06, 0.04, 0.09], [-0.3, 0.63, 0.11], "#111111", "plastic"),
      p("box", [0.06, 0.04, 0.09], [-0.15, 0.63, 0.11], "#111111", "plastic"),
      p("box", [0.06, 0.04, 0.09], [0.1, 0.63, 0.11], "#111111", "plastic"),
      p("box", [0.06, 0.04, 0.09], [0.25, 0.63, 0.11], "#111111", "plastic"),
      p("cylinder", [0.07, 0.18, 0.07], [-0.4, 0.09, 0], "#2b2b33", "plastic", { label: "leg" }),
      p("cylinder", [0.07, 0.18, 0.07], [0.4, 0.09, 0], "#2b2b33", "plastic"),
      p("star", [0.12, 0.12, 0.03], [0, 0.4, 0.22], "#f2c14e", "metal"),
    ],
  }, {
    name: "cooking pot", archetype: "companion",
    parts: [
      p("box", [0.72, 0.14, 0.72], [0, 0.07, 0], "#3d3d48", "metal", { round: 0.3, label: "stove" }),
      p("leaf", [0.12, 0.16, 0.03], [-0.1, 0.18, 0.33], "#ff9f43", "glow", { label: "flame" }),
      p("leaf", [0.12, 0.18, 0.03], [0.08, 0.19, 0.33], "#ffd34d", "glow"),
      p("cylinder", [0.62, 0.4, 0.62], [0, 0.36, 0], "#c9ced6", "metal", { label: "pot" }),
      p("disc", [0.56, 0.02, 0.56], [0, 0.55, 0], "#ffb347", "candy", { label: "soup" }),
      p("torus", [0.14, 0.1, 0.035], [-0.35, 0.48, 0], "#2b2b33", "metal", { label: "handle" }),
      p("torus", [0.14, 0.1, 0.035], [0.35, 0.48, 0], "#2b2b33", "metal"),
    ],
  }, {
    name: "birthday cake", archetype: "companion",
    parts: [
      p("disc", [0.96, 0.04, 0.96], [0, 0.02, 0], "#ffffff", "plastic", { label: "plate" }),
      p("cylinder", [0.8, 0.3, 0.8], [0, 0.19, 0], "#ffd9e6", "candy", { label: "cake" }),
      p("torus", [0.82, 0.82, 0.06], [0, 0.34, 0], "#ffffff", "candy", { rotate: [90, 0, 0], label: "icing" }),
      p("cylinder", [0.56, 0.24, 0.56], [0, 0.46, 0], "#ffb3cf", "candy"),
      p("torus", [0.58, 0.58, 0.05], [0, 0.58, 0], "#ffffff", "candy", { rotate: [90, 0, 0] }),
      p("cylinder", [0.04, 0.18, 0.04], [-0.14, 0.67, 0.05], "#7fd1ff", "candy", { label: "candle" }),
      p("cylinder", [0.04, 0.18, 0.04], [0, 0.67, 0.1], "#ffd34d", "candy"),
      p("cylinder", [0.04, 0.18, 0.04], [0.14, 0.67, 0.05], "#b48cff", "candy"),
      p("leaf", [0.05, 0.09, 0.03], [-0.14, 0.8, 0.05], "#ffb347", "glow", { label: "flame" }),
      p("leaf", [0.05, 0.09, 0.03], [0, 0.8, 0.1], "#ffb347", "glow"),
      p("leaf", [0.05, 0.09, 0.03], [0.14, 0.8, 0.05], "#ffb347", "glow"),
      p("sphere", [0.08, 0.08, 0.08], [0, 0.24, 0.4], "#e5484d", "candy", { label: "cherry" }),
    ],
  }, {
    name: "present", archetype: "companion",
    parts: [
      p("box", [0.6, 0.5, 0.6], [0, 0.25, 0], "#5ec8ff", "paper", { round: 0.08, label: "box" }),
      p("box", [0.12, 0.52, 0.62], [0, 0.25, 0], "#ff6f91", "cloth", { label: "ribbon" }),
      p("box", [0.62, 0.52, 0.12], [0, 0.25, 0], "#ff6f91", "cloth"),
      p("torus", [0.2, 0.16, 0.06], [-0.1, 0.57, 0], "#ff6f91", "cloth", { label: "bow" }),
      p("torus", [0.2, 0.16, 0.06], [0.1, 0.57, 0], "#ff6f91", "cloth"),
      p("sphere", [0.08, 0.08, 0.08], [0, 0.53, 0], "#ff4f7f", "cloth"),
    ],
  }, {
    name: "campfire", archetype: "companion",
    parts: [
      p("cylinder", [0.12, 0.72, 0.12], [0, 0.1, 0], "#8f5b36", "wood", { rotate: [0, 40, 85], label: "log" }),
      p("cylinder", [0.12, 0.72, 0.12], [0, 0.13, 0], "#7a4a2a", "wood", { rotate: [0, -40, 85] }),
      p("cone", [0.36, 0.52, 0.36], [0, 0.36, 0], "#ff9f43", "glow", { label: "flame" }),
      p("cone", [0.22, 0.36, 0.22], [0.02, 0.32, 0.08], "#ffd34d", "glow"),
      p("cone", [0.16, 0.3, 0.16], [0.13, 0.28, -0.02], "#ff6f61", "glow"),
      p("sphere", [0.14, 0.1, 0.14], [-0.34, 0.06, 0.05], "#9aa0a8", "rubber", { label: "stone" }),
      p("sphere", [0.14, 0.1, 0.14], [0.34, 0.06, 0.05], "#9aa0a8", "rubber"),
      p("sphere", [0.14, 0.1, 0.14], [0, 0.06, 0.32], "#a7adb5", "rubber"),
      p("sphere", [0.14, 0.1, 0.14], [0, 0.06, -0.3], "#8d939b", "rubber"),
    ],
  }, {
    name: "little tent", archetype: "companion",
    parts: [
      p("cone", [1.2, 1.15, 1.2], [0, 0.58, 0], "#ffb347", "cloth", { label: "tent" }),
      p("cone", [0.42, 0.62, 0.04], [0, 0.31, 0.49], "#8f5b36", "cloth", { rotate: [-27, 0, 0], label: "door" }),
      p("cylinder", [0.03, 0.34, 0.03], [0, 1.28, 0], "#c99a62", "wood", { label: "pole" }),
      p("box", [0.18, 0.1, 0.02], [0.1, 1.38, 0], "#e5484d", "cloth", { label: "flag" }),
    ],
  }, {
    name: "snowman", archetype: "companion",
    parts: [
      p("sphere", [0.62, 0.58, 0.62], [0, 0.29, 0], "#ffffff", "fluffy", { label: "bottom" }),
      p("sphere", [0.44, 0.42, 0.44], [0, 0.76, 0], "#ffffff", "fluffy", { label: "middle" }),
      p("sphere", [0.32, 0.31, 0.32], [0, 1.1, 0], "#ffffff", "fluffy", { label: "head" }),
      p("sphere", [0.045, 0.045, 0.03], [-0.07, 1.14, 0.15], "#2b2b33", "plastic", { label: "eye" }),
      p("sphere", [0.045, 0.045, 0.03], [0.07, 1.14, 0.15], "#2b2b33", "plastic"),
      p("cone", [0.06, 0.18, 0.06], [0, 1.09, 0.22], "#ff9f43", "candy", { rotate: [90, 0, 0], label: "carrot nose" }),
      p("torus", [0.36, 0.36, 0.07], [0, 0.95, 0], "#e5484d", "cloth", { rotate: [90, 0, 0], label: "scarf" }),
      p("sphere", [0.05, 0.05, 0.03], [0, 0.8, 0.22], "#2b2b33", "plastic", { label: "button" }),
      p("sphere", [0.05, 0.05, 0.03], [0, 0.66, 0.21], "#2b2b33", "plastic"),
    ],
  }, {
    name: "sandcastle", archetype: "companion",
    parts: [
      p("box", [0.72, 0.3, 0.5], [0, 0.15, 0], "#e9c97a", "rubber", { round: 0.15, label: "wall" }),
      p("cylinder", [0.22, 0.5, 0.22], [-0.32, 0.25, 0.05], "#e9c97a", "rubber", { label: "tower" }),
      p("cylinder", [0.22, 0.5, 0.22], [0.32, 0.25, 0.05], "#e9c97a", "rubber"),
      p("cone", [0.26, 0.18, 0.26], [-0.32, 0.59, 0.05], "#dfb763", "rubber"),
      p("cone", [0.26, 0.18, 0.26], [0.32, 0.59, 0.05], "#dfb763", "rubber"),
      p("cylinder", [0.28, 0.66, 0.28], [0, 0.33, -0.05], "#e9c97a", "rubber"),
      p("cone", [0.32, 0.22, 0.32], [0, 0.77, -0.05], "#dfb763", "rubber"),
      p("cylinder", [0.02, 0.26, 0.02], [0, 0.98, -0.05], "#c99a62", "wood", { label: "flag pole" }),
      p("box", [0.13, 0.08, 0.02], [0.07, 1.06, -0.05], "#e5484d", "cloth", { label: "flag" }),
      p("star", [0.1, 0.1, 0.03], [0, 0.16, 0.26], "#ffffff", "candy", { label: "shell" }),
    ],
  }, {
    name: "rubber duck", archetype: "companion",
    parts: [
      p("sphere", [0.52, 0.4, 0.44], [0, 0.2, 0], "#ffd34d", "rubber", { label: "body" }),
      p("sphere", [0.3, 0.3, 0.3], [0.04, 0.5, 0.06], "#ffd34d", "rubber", { label: "head" }),
      p("sphere", [0.16, 0.07, 0.12], [0.04, 0.47, 0.22], "#ff9f43", "rubber", { label: "beak" }),
      p("sphere", [0.045, 0.045, 0.03], [-0.04, 0.56, 0.18], "#2b2b33", "plastic", { label: "eye" }),
      p("sphere", [0.045, 0.045, 0.03], [0.12, 0.56, 0.18], "#2b2b33", "plastic"),
      p("cone", [0.14, 0.18, 0.14], [-0.04, 0.3, -0.22], "#ffd34d", "rubber", { rotate: [-60, 0, 0], label: "tail" }),
    ],
  }, {
    name: "bowling pins", archetype: "companion",
    parts: [
      p("disc", [0.8, 0.04, 0.6], [0, 0.02, 0], "#e9c97a", "wood", { label: "lane" }),
      p("sphere", [0.18, 0.38, 0.18], [-0.24, 0.23, 0.08], "#ffffff", "plastic", { label: "pin" }),
      p("sphere", [0.11, 0.15, 0.11], [-0.24, 0.47, 0.08], "#ffffff", "plastic"),
      p("torus", [0.1, 0.1, 0.025], [-0.24, 0.4, 0.08], "#e5484d", "plastic", { rotate: [90, 0, 0], label: "stripe" }),
      p("sphere", [0.18, 0.38, 0.18], [0.24, 0.23, 0.08], "#ffffff", "plastic"),
      p("sphere", [0.11, 0.15, 0.11], [0.24, 0.47, 0.08], "#ffffff", "plastic"),
      p("torus", [0.1, 0.1, 0.025], [0.24, 0.4, 0.08], "#e5484d", "plastic", { rotate: [90, 0, 0] }),
      p("sphere", [0.18, 0.38, 0.18], [0, 0.23, -0.14], "#ffffff", "plastic"),
      p("sphere", [0.11, 0.15, 0.11], [0, 0.47, -0.14], "#ffffff", "plastic"),
      p("torus", [0.1, 0.1, 0.025], [0, 0.4, -0.14], "#e5484d", "plastic", { rotate: [90, 0, 0] }),
    ],
  }, {
    name: "picnic basket", archetype: "companion",
    parts: [
      p("box", [0.62, 0.36, 0.42], [0, 0.18, 0], "#c99a62", "wood", { round: 0.2, label: "basket" }),
      p("box", [0.64, 0.06, 0.44], [0, 0.37, 0], "#e5484d", "cloth", { round: 0.3, pattern: "checks", pattern_color: "#fbf8f2", label: "cloth" }),
      p("tube", [1, 1, 1], [0, 0, 0], "#b5844f", "wood", { points: [[-0.24, 0.38, 0], [-0.16, 0.6, 0], [0.16, 0.6, 0], [0.24, 0.38, 0]], thick: 0.05, label: "handle" }),
      p("sphere", [0.16, 0.15, 0.16], [0.16, 0.44, 0.06], "#e5484d", "candy", { label: "apple" }),
      p("capsule", [0.1, 0.4, 0.1], [-0.08, 0.46, -0.02], "#e9c97a", "candy", { rotate: [0, 0, 65], label: "bread" }),
    ],
  }, {
    // what a judge bangs the gavel on: a round wooden block on the floor beside him
    name: "sound block", archetype: "companion",
    parts: [
      p("cylinder", [0.42, 0.1, 0.42], [0, 0.05, 0], "#6b3f22", "wood", { label: "block" }),
      p("cylinder", [0.32, 0.03, 0.32], [0, 0.115, 0], "#8f5b36", "wood", { label: "top" }),
    ],
  }],
  body_wearable: [{
    // a cosy knitted scarf (Nov 4: a Christmas scarf went through his tummy): a chunky striped ring round his neck,
    // where his head meets his body, a knot at the front and two ends hanging down his chest
    name: "scarf", archetype: "body_wearable",
    parts: [
      p("torus", [1.3, 1.22, 0.22], [0, 0.4, 0], "#e5484d", "cloth", { rotate: [90, 0, 0], pattern: "stripes", pattern_color: "#ffffff", label: "scarf" }),
      p("sphere", [0.26, 0.22, 0.18], [0.14, 0.36, 0.5], "#e5484d", "cloth", { label: "knot" }),
      p("box", [0.2, 0.56, 0.07], [0.2, 0.08, 0.55], "#e5484d", "cloth", { round: 0.4, rotate: [-12, 0, 8], pattern: "stripes", pattern_color: "#ffffff", label: "end" }),
      p("box", [0.2, 0.44, 0.07], [0.02, 0.14, 0.56], "#e5484d", "cloth", { round: 0.4, rotate: [-12, 0, -6], pattern: "stripes", pattern_color: "#ffffff" }),
    ],
  }, {
    name: "apron", archetype: "body_wearable",
    parts: [
      p("box", [0.9, 0.78, 0.08], [0, -0.12, 0.6], "#ff8fb8", "cloth", { round: 0.4, rotate: [-8, 0, 0], label: "apron" }),
      p("box", [0.38, 0.2, 0.04], [0, -0.3, 0.66], "#ffd1e2", "cloth", { round: 0.3, label: "pocket" }),
      p("heart", [0.14, 0.13, 0.03], [0, 0.08, 0.66], "#ffffff", "cloth", { label: "heart" }),
    ],
  }, {
    // a cape (Nov 4: two leaves splayed read as "a red collar"): five overlapping panels hanging from his collar round
    // the curve of his back, flaring out a little toward the bottom, like cloth draped over him
    name: "cape", archetype: "body_wearable",
    parts: [
      p("box", [0.44, 1.0, 0.04], [-0.629, -0.08, -0.307], "#d63a44", "cloth", { round: 0.3, rotate: [-154.1, -61.5, -156.9], label: "cape" }),
      p("box", [0.44, 1.0, 0.04], [-0.371, -0.08, -0.594], "#d63a44", "cloth", { round: 0.3, rotate: [-165.9, -31.2, -172.6] }),
      p("box", [0.44, 1.0, 0.04], [0, -0.08, -0.7], "#d63a44", "cloth", { round: 0.3, rotate: [-168, 0, 180] }),
      p("box", [0.44, 1.0, 0.04], [0.371, -0.08, -0.594], "#d63a44", "cloth", { round: 0.3, rotate: [-165.9, 31.2, 172.6] }),
      p("box", [0.44, 1.0, 0.04], [0.629, -0.08, -0.307], "#d63a44", "cloth", { round: 0.3, rotate: [-154.1, 61.5, 156.9] }),
      p("torus", [1.12, 1.06, 0.08], [0, 0.4, 0], "#e5484d", "cloth", { rotate: [90, 0, 0], label: "collar" }),
      p("star", [0.15, 0.15, 0.04], [0, 0.36, 0.56], "#f2c14e", "metal", { label: "clasp" }),
    ],
  }, {
    // a doctor's stethoscope (Nov 7, Binoy: "it couldn't get it correctly to fit on mochi. It was too low"; the old one
    // hung its chest piece at his tummy and read as "a blue necklace"): the tubing round the back of his neck, both
    // ends down his front, the silver chest piece on one side, the metal earpieces with their black tips on the other
    name: "stethoscope", archetype: "body_wearable",
    parts: [
      p("torus", [1.1, 1.02, 0.05], [0, 0.4, 0], "#3f6fb5", "rubber", { rotate: [90, 0, 0], label: "tubing" }),
      p("tube", [1, 1, 1], [0, 0, 0], "#3f6fb5", "rubber", { points: [[-0.24, 0.4, 0.42], [-0.27, 0.24, 0.53], [-0.25, 0.06, 0.57]], thick: 0.05, label: "tubing" }),
      p("coin", [0.18, 0.18, 0.06], [-0.25, 0.0, 0.58], "#c9ced6", "metal", { label: "chest piece" }),
      p("coin", [0.12, 0.12, 0.02], [-0.25, 0.0, 0.615], "#8a939e", "metal", { label: "diaphragm" }),
      p("tube", [1, 1, 1], [0, 0, 0], "#3f6fb5", "rubber", { points: [[0.24, 0.4, 0.42], [0.27, 0.26, 0.52], [0.26, 0.16, 0.55]], thick: 0.05, label: "tubing" }),
      p("tube", [1, 1, 1], [0, 0, 0], "#c9ced6", "metal", { points: [[0.26, 0.16, 0.55], [0.21, 0.06, 0.58], [0.2, -0.02, 0.58]], thick: 0.026, label: "earpiece" }),
      p("tube", [1, 1, 1], [0, 0, 0], "#c9ced6", "metal", { points: [[0.26, 0.16, 0.55], [0.32, 0.06, 0.54], [0.33, -0.02, 0.53]], thick: 0.026, label: "earpiece" }),
      p("sphere", [0.06, 0.06, 0.06], [0.2, -0.04, 0.58], "#2b2b33", "rubber", { label: "ear tip" }),
      p("sphere", [0.06, 0.06, 0.06], [0.33, -0.04, 0.53], "#2b2b33", "rubber", { label: "ear tip" }),
    ],
  }, {
    name: "backpack", archetype: "body_wearable",
    parts: [
      p("box", [0.82, 0.78, 0.4], [0, -0.05, -0.66], "#5ec8ff", "cloth", { round: 0.45, label: "pack" }),
      p("box", [0.5, 0.3, 0.12], [0, -0.22, -0.86], "#3d9be0", "cloth", { round: 0.4, label: "pocket" }),
      p("box", [0.1, 0.62, 0.04], [-0.3, 0.06, 0.6], "#3d9be0", "cloth", { round: 0.4, rotate: [-10, 0, 8], label: "strap" }),
      p("box", [0.1, 0.62, 0.04], [0.3, 0.06, 0.6], "#3d9be0", "cloth", { round: 0.4, rotate: [-10, 0, -8] }),
    ],
  }, {
    name: "swim ring", archetype: "body_wearable",
    parts: [
      p("torus", [1.54, 1.54, 0.3], [0, -0.22, 0], "#ff6f91", "plastic", { rotate: [90, 0, 0], label: "ring" }),
      p("star", [0.2, 0.2, 0.05], [0, -0.22, 0.76], "#ffffff", "plastic"),
      p("heart", [0.16, 0.15, 0.05], [-0.56, -0.22, 0.58], "#ffd34d", "plastic", { rotate: [0, -44, 0] }),
      p("heart", [0.16, 0.15, 0.05], [0.56, -0.22, 0.58], "#7fd1ff", "plastic", { rotate: [0, 44, 0] }),
    ],
  }, {
    // a ballet tutu (Nov 4, the bench: Gemma's was a disc in front of him, "a pink collar or ring"): three puffy tiers of
    // tulle flaring out round his hips from a satin waistband, ruffles all round the hem, a little bow at the front
    name: "tutu", archetype: "body_wearable",
    parts: [
      p("torus", [1.34, 1.27, 0.1], [0, -0.09, 0], "#ff8fb8", "cloth", { rotate: [90, 0, 0], label: "waistband" }),
      p("cylinder", [1.5, 0.13, 1.42], [0, -0.16, 0], "#ffb3d1", "cloth", { hollow: true, taper: 0.88, label: "tulle" }),
      p("cylinder", [1.64, 0.14, 1.56], [0, -0.25, 0], "#ffc4da", "cloth", { hollow: true, taper: 0.86 }),
      p("cylinder", [1.76, 0.14, 1.68], [0, -0.34, 0], "#ffd6e6", "cloth", { hollow: true, taper: 0.88 }),
      p("sphere", [0.24, 0.09, 0.18], [0.274, -0.4, 0.714], "#ffd6e6", "cloth", { rotate: [0, 20, 0], label: "ruffle" }),
      p("sphere", [0.24, 0.09, 0.18], [0.693, -0.4, 0.38], "#ffd6e6", "cloth", { rotate: [0, 60.0, 0] }),
      p("sphere", [0.24, 0.09, 0.18], [0.788, -0.4, -0.132], "#ffd6e6", "cloth", { rotate: [0, 100, 0] }),
      p("sphere", [0.24, 0.09, 0.18], [0.514, -0.4, -0.582], "#ffd6e6", "cloth", { rotate: [0, 140, 0] }),
      p("sphere", [0.24, 0.09, 0.18], [0, -0.4, -0.76], "#ffd6e6", "cloth", { rotate: [0, 180, 0] }),
      p("sphere", [0.24, 0.09, 0.18], [-0.514, -0.4, -0.582], "#ffd6e6", "cloth", { rotate: [0, -140.0, 0] }),
      p("sphere", [0.24, 0.09, 0.18], [-0.788, -0.4, -0.132], "#ffd6e6", "cloth", { rotate: [0, -100, 0] }),
      p("sphere", [0.24, 0.09, 0.18], [-0.693, -0.4, 0.38], "#ffd6e6", "cloth", { rotate: [0, -60.0, 0] }),
      p("sphere", [0.24, 0.09, 0.18], [-0.274, -0.4, 0.714], "#ffd6e6", "cloth", { rotate: [0, -20, 0] }),
      p("sphere", [0.08, 0.08, 0.06], [0, -0.09, 0.71], "#ff6fa3", "cloth", { label: "bow" }),
      p("cone", [0.13, 0.15, 0.06], [0.085, -0.09, 0.7], "#ff6fa3", "cloth", { rotate: [0, 0, 90] }),
      p("cone", [0.13, 0.15, 0.06], [-0.085, -0.09, 0.7], "#ff6fa3", "cloth", { rotate: [0, 0, -90] }),
    ],
  }, {
    // a pleated skirt: an A-line flaring out round his bottom half from a waistband (pleats: stripes running down it), a
    // white trim round the hem
    name: "skirt", archetype: "body_wearable",
    parts: [
      p("torus", [1.34, 1.27, 0.09], [0, -0.08, 0], "#3d6fc4", "cloth", { rotate: [90, 0, 0], label: "waistband" }),
      p("cylinder", [1.56, 0.42, 1.48], [0, -0.3, 0], "#5b9cf0", "cloth", { hollow: true, taper: 0.85, pattern: "segments", pattern_color: "#4a86d6", label: "skirt" }),
      p("torus", [1.56, 1.48, 0.05], [0, -0.51, 0], "#ffffff", "cloth", { rotate: [90, 0, 0], label: "hem" }),
      p("coin", [0.09, 0.09, 0.03], [0.3, -0.08, 0.66], "#ffffff", "plastic", { rotate: [0, 24, 0], label: "button" }),
    ],
  }, {
    // a grass skirt (hula): long green leaves hanging all round him from a woven band at his hips, swinging out
    // a little toward the bottom,, a flower tucked in at
    // the front
    name: "grass skirt", archetype: "body_wearable",
    parts: [
      p("torus", [1.36, 1.29, 0.11], [0, -0.1, 0], "#c8a165", "cloth", { rotate: [90, 0, 0], label: "waistband" }),
      p("leaf", [0.2, 0.58, 0.03], [0, -0.371, 0.7], "#5fb85a", "cloth", { rotate: [-14, 0, 0], label: "grass" }),
      p("leaf", [0.2, 0.58, 0.03], [0.325, -0.371, 0.631], "#8fd16a", "cloth", { rotate: [-15.5, 24.9, 6.6] }),
      p("leaf", [0.2, 0.58, 0.03], [0.586, -0.371, 0.437], "#4aa352", "cloth", { rotate: [-21.8, 49.3, 16.9] }),
      p("leaf", [0.2, 0.58, 0.03], [0.731, -0.371, 0.156], "#5fb85a", "cloth", { rotate: [-48.3, 71.1, 46.7] }),
      p("leaf", [0.2, 0.58, 0.03], [0.731, -0.371, -0.156], "#8fd16a", "cloth", { rotate: [-131.7, 71.1, 133.3] }),
      p("leaf", [0.2, 0.58, 0.03], [0.586, -0.371, -0.437], "#4aa352", "cloth", { rotate: [-158.2, 49.3, 163.1] }),
      p("leaf", [0.2, 0.58, 0.03], [0.325, -0.371, -0.631], "#5fb85a", "cloth", { rotate: [-164.5, 24.9, 173.4] }),
      p("leaf", [0.2, 0.58, 0.03], [0, -0.371, -0.7], "#8fd16a", "cloth", { rotate: [-166, 0, 180] }),
      p("leaf", [0.2, 0.58, 0.03], [-0.325, -0.371, -0.631], "#4aa352", "cloth", { rotate: [-164.5, -24.9, -173.4] }),
      p("leaf", [0.2, 0.58, 0.03], [-0.586, -0.371, -0.437], "#5fb85a", "cloth", { rotate: [-158.2, -49.3, -163.1] }),
      p("leaf", [0.2, 0.58, 0.03], [-0.731, -0.371, -0.156], "#8fd16a", "cloth", { rotate: [-131.7, -71.1, -133.3] }),
      p("leaf", [0.2, 0.58, 0.03], [-0.731, -0.371, 0.156], "#4aa352", "cloth", { rotate: [-48.3, -71.1, -46.7] }),
      p("leaf", [0.2, 0.58, 0.03], [-0.586, -0.371, 0.437], "#5fb85a", "cloth", { rotate: [-21.8, -49.3, -16.9] }),
      p("leaf", [0.2, 0.58, 0.03], [-0.325, -0.371, 0.631], "#8fd16a", "cloth", { rotate: [-15.5, -24.9, -6.6] }),
      p("star", [0.17, 0.17, 0.05], [0.36, -0.07, 0.64], "#ff6f91", "cloth", { rotate: [0, 30, 0], label: "flower" }),
    ],
  }, {
    // a party dress: a fitted top round his chest up to his neck, a full skirt flaring out from a sash at his middle
    // (polka dots all over), puffed sleeves, a bow at the front and a trim round the hem
    name: "dress", archetype: "body_wearable",
    parts: [
      p("dome", [1.44, 0.7, 1.36], [0, 0.32, 0], "#ff8fb8", "cloth", { pattern: "dots", pattern_color: "#ffffff", label: "bodice" }),
      p("sphere", [0.32, 0.28, 0.3], [-0.66, 0.2, 0.04], "#ff8fb8", "cloth", { label: "sleeve" }),
      p("sphere", [0.32, 0.28, 0.3], [0.66, 0.2, 0.04], "#ff8fb8", "cloth"),
      p("cylinder", [1.6, 0.5, 1.52], [0, -0.28, 0], "#ff8fb8", "cloth", { hollow: true, taper: 0.86, pattern: "dots", pattern_color: "#ffffff", label: "skirt" }),
      p("torus", [1.44, 1.36, 0.1], [0, -0.03, 0], "#ffffff", "cloth", { rotate: [90, 0, 0], label: "sash" }),
      p("sphere", [0.09, 0.09, 0.06], [0, -0.03, 0.74], "#ffffff", "cloth", { label: "bow" }),
      p("cone", [0.15, 0.17, 0.06], [0.1, -0.03, 0.73], "#ffffff", "cloth", { rotate: [0, 0, 90] }),
      p("cone", [0.15, 0.17, 0.06], [-0.1, -0.03, 0.73], "#ffffff", "cloth", { rotate: [0, 0, -90] }),
      p("torus", [1.6, 1.52, 0.05], [0, -0.53, 0], "#ffffff", "cloth", { rotate: [90, 0, 0], label: "hem" }),
    ],
  }, {
    // a cosy jumper (the bench's was "a pink collar"): knitted, striped, all the way round him from his neck down past
    // his middle, a ribbed collar and hem, a heart on the front,
    // sleeves at his sides
    name: "sweater", archetype: "body_wearable",
    parts: [
      p("dome", [1.44, 0.7, 1.36], [0, 0.33, 0], "#4caf7d", "cloth", { pattern: "stripes", pattern_color: "#fbf3e4", label: "sweater" }),
      p("cylinder", [1.36, 0.34, 1.28], [0, -0.17, 0], "#4caf7d", "cloth", { hollow: true, taper: 1.06, pattern: "stripes", pattern_color: "#fbf3e4" }),
      p("torus", [1.14, 1.08, 0.12], [0, 0.39, 0], "#3d9467", "cloth", { rotate: [90, 0, 0], label: "collar" }),
      p("torus", [1.36, 1.28, 0.09], [0, -0.34, 0], "#3d9467", "cloth", { rotate: [90, 0, 0], label: "hem" }),
      p("heart", [0.3, 0.27, 0.05], [0, 0.12, 0.68], "#e5484d", "cloth", { rotate: [-10, 0, 0], label: "heart" }),
      p("capsule", [0.28, 0.42, 0.28], [-0.62, 0.08, 0.04], "#4caf7d", "cloth", { rotate: [0, 0, -28], pattern: "stripes", pattern_color: "#fbf3e4", label: "sleeve" }),
      p("capsule", [0.28, 0.42, 0.28], [0.62, 0.08, 0.04], "#4caf7d", "cloth", { rotate: [0, 0, 28], pattern: "stripes", pattern_color: "#fbf3e4" }),
    ],
  }, {
    // a judge's robe (Nov 7): long and black, all the way round him and down past his middle, wide sleeves, a white
    // collar and the two white bands at the throat
    name: "judge's robe", archetype: "body_wearable",
    parts: [
      p("dome", [1.44, 0.7, 1.36], [0, 0.33, 0], "#22202a", "cloth", { label: "robe" }),
      p("cylinder", [1.36, 0.5, 1.28], [0, -0.25, 0], "#22202a", "cloth", { hollow: true, taper: 1.06 }),
      p("torus", [1.14, 1.08, 0.12], [0, 0.39, 0], "#fbf8f2", "cloth", { rotate: [90, 0, 0], label: "collar" }),
      p("box", [0.07, 0.17, 0.025], [-0.045, 0.3, 0.62], "#fbf8f2", "cloth", { round: 0.3, rotate: [-14, 0, 3], label: "bands" }),
      p("box", [0.07, 0.17, 0.025], [0.045, 0.3, 0.62], "#fbf8f2", "cloth", { round: 0.3, rotate: [-14, 0, -3], label: "bands" }),
      p("box", [0.04, 0.5, 0.02], [0, -0.05, 0.7], "#34313d", "cloth", { round: 0.3, rotate: [-10, 0, 0], label: "front seam" }),
      p("capsule", [0.28, 0.42, 0.28], [-0.62, 0.08, 0.04], "#22202a", "cloth", { rotate: [0, 0, -28], label: "sleeve" }),
      p("capsule", [0.28, 0.42, 0.28], [0.62, 0.08, 0.04], "#22202a", "cloth", { rotate: [0, 0, 28] }),
    ],
  }, {
    // a hackathon judge's hoodie (Nov 7): comfy navy hoodie, hood down at the back, and the judge badge on its lanyard
    name: "hackathon hoodie", archetype: "body_wearable",
    parts: [
      p("dome", [1.44, 0.7, 1.36], [0, 0.33, 0], "#2f4a7a", "cloth", { label: "hoodie" }),
      p("cylinder", [1.36, 0.34, 1.28], [0, -0.17, 0], "#2f4a7a", "cloth", { hollow: true, taper: 1.06 }),
      p("torus", [1.36, 1.28, 0.09], [0, -0.34, 0], "#26406b", "cloth", { rotate: [90, 0, 0], label: "hem" }),
      p("sphere", [0.86, 0.46, 0.4], [0, 0.42, -0.56], "#26406b", "cloth", { label: "hood" }),
      p("box", [0.56, 0.2, 0.05], [0, -0.2, 0.66], "#26406b", "cloth", { round: 0.4, label: "pocket" }),
      p("capsule", [0.28, 0.42, 0.28], [-0.62, 0.08, 0.04], "#2f4a7a", "cloth", { rotate: [0, 0, -28], label: "sleeve" }),
      p("capsule", [0.28, 0.42, 0.28], [0.62, 0.08, 0.04], "#2f4a7a", "cloth", { rotate: [0, 0, 28] }),
      p("torus", [0.5, 0.56, 0.03], [0, 0.18, 0.62], "#ff7a45", "cloth", { rotate: [0, 0, 180], arc: 180, label: "lanyard" }),
      p("box", [0.22, 0.28, 0.02], [0, -0.06, 0.695], "#fffaf2", "plastic", { round: 0.2, label: "judge badge" }),
      p("box", [0.22, 0.07, 0.01], [0, 0.04, 0.708], "#ff7a45", "plastic", { round: 0.2, label: "badge stripe" }),
      p("star", [0.08, 0.08, 0.01], [0, -0.1, 0.708], "#ffd34d", "plastic", { label: "badge star" }),
    ],
  }],
};
