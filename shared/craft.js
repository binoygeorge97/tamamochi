// Mochi's crafting language: what a prop or a move may be, the checker that keeps whatever a model writes safe and
// playable, and the move sampler the body uses. Pure JS (no three.js): the server, the page and the kit all import it.
//
// Units are Mochi's own: sitting, he is about 2.2 tall; his head is about 1.25 wide; a hoof is about 0.2 wide.
// Coordinates: +x is the screen's right, +y is up, +z is toward the viewer. Angles are degrees.

import { MORE_PROPS } from "./pocket-more.js";
import { VEHICLES } from "./pocket-vehicles.js";

/* ------------------------------------------------------------------ props */

export const ARCHETYPES = {
  head_wearable: {
    slot: "head", maxSize: 1.4, fit: 1.9, sizeNote: "Only a hat brim may stick out wider, up to 1.9.",
    about: "something he wears on his head: a hat, crown, headband, flower crown, soft helmet, bow, halo, tiara",
    origin: "the top of his head, where a hat's brim sits. His head is about 1.25 wide; its fluffy fleece rises about 0.12 above the origin around a band and 0.3 at the very top, so the bottom of a crown or a short hat should sit at y = 0.05 to 0.12 to show above the wool. His eyes are at y = -0.5 (glasses and goggles go there, at z = 0.5)",
  },
  handheld_tool: {
    slot: "hand", maxSize: 1.4, hold: "upright",
    about: "a thing he holds in one hoof: a wand, cup, lollipop, flower, brush, phone, coin, foam sword, rattle, ice cream, a shield (round, or a tall riot shield), a walkie-talkie, a flashlight, binoculars, a guitar, stationery (a book, pen, pencil, ruler, scissors, a map, a desk globe)",
    origin: "the point his hoof grips. The thing stands up from there: put the handle or stick around y = -0.1 to 0.3 and the interesting end above it",
  },
  handheld_canopy: {
    slot: "hand", maxSize: 2.0, hold: "upright",
    about: "something held up high on a stick or string: an umbrella, parasol, big leaf, balloon, kite, pinwheel, lantern on a pole",
    origin: "the point his hoof grips, at the bottom of the stick. The stick goes up from y = 0 and the canopy, balloon or kite sits at its top, around y = 0.9 to 1.4",
  },
  launcher: {
    slot: "hand", maxSize: 1.4, hold: "aim",
    about: "a toy that shoots something harmless: a confetti popper, bubble blaster, water pistol, glitter or petal cannon, party popper",
    origin: "the point his hoof grips (the handle). The barrel points along +x (to the right) and ends at the muzzle; give \"muzzle\": [x, y, z] at the barrel's open end",
  },
  throwable: {
    slot: "hand", maxSize: 0.6, hold: "throw",
    about: "something small and soft he throws: a water balloon, snowball, confetti ball, foam ball, beanbag (a grenade or a bomb is a confetti ball)",
    origin: "the point his hoof holds it from below. It sits on his hoof: put its middle around y = 0.14, and keep it small, about 0.3 to 0.45 across",
  },
  body_wearable: {
    slot: "body", maxSize: 1.6, fit: 1.8, sizeNote: "Only a skirt or tutu may flare out wider at the hem, up to 1.8.",   // (Nov 4: a tutu sticks out)
    about: "something he wears on his round body (not something he holds): a protective vest, a life jacket, a scarf, a cape, a backpack, a medal, a sash, a bandana, a badge",
    origin: "the middle of his round, fluffy body. His body is about 1.3 wide, 1.2 tall and 1.25 deep around it (y from -0.6 to +0.6); his head sits on top from y = 0.45 and his front legs come out at the front (x = ±0.34, y = 0.18, z = 0.42). Anything that wraps around him must be a bit bigger than his body (about 1.36 wide and 1.3 deep) or the fleece pokes through; things on his chest sit at z ≈ 0.64",
  },
  ride: {
    slot: "ride", maxSize: 2.0, fit: 3.0, parts: 36, hold: "ride",
    about: "something he rides or drives: a bicycle, tricycle, skateboard, scooter, a little car, go-kart, truck, bus, tractor or wagon, a train, a rocket ship or spaceship, a plane, a helicopter, a boat, a ship or a submarine (he sits on a seat and pedals, stands on a board, or sits in the driver's seat and drives, flies or sails across the stage, a friend in the back)",
    origin: "the ground under its middle: wheels stand on y = 0. It points along +x (the way it rolls), so a bike is seen from the side: wheels are rings facing the viewer (torus or coin, no rotation). He is big and round (his body is 1.3 wide): a bike or trike is about 1.8 long with wheels about 0.55 across, the seat about 0.5 up and the handlebar about 0.65 in front of the seat, as wide as 0.65 along z; a skateboard deck is about 1.1 long, 0.35 wide, its top about 0.18 up. Label the parts: \"wheel\" (each wheel, and \"spoke\" or \"hub\" for its spokes and hub), \"pedal\" and \"crank\", \"seat\", \"handlebar\", \"deck\" A car (or kart, truck): about 2.8 long and 1.4 wide (up to 3), built from round shapes (big rounded boxes with round 0.5, squashed spheres for the hood, the trunk and the wheel arches) so it looks like a real little car, not blocks; four tyres (torus, labelled \"front wheel\" and \"rear wheel\") at both sides (z = +-0.66) with hubs; the driver\'s \"seat\" sunk deep inside the body (its top about y = 0.55, with the sides coming up to about y = 1.05, so they hide his legs and tummy), a \"back seat\" behind it for a friend, a \"steering\" wheel in front of the seat (call it steering, never wheel), a windshield, headlights and taillights.",
  },
  companion: {
    slot: "beside", maxSize: 1.6,
    about: "a little friend or object that sits on the ground beside him: a plush toy, tiny robot, potted plant, cake, snowman, pet rock, a tiny toy car (a car he can ride in is a ride)",
    origin: "the ground under its middle: its lowest point is at y = 0. It faces the viewer (+z), like a toy on a shelf: an animal's or a character's face points toward +z",
  },
};
export const ARCHETYPE_NAMES = Object.keys(ARCHETYPES);

// Shapes, each sized by a bounding box "size": [width (x), height (y), depth (z)] and centred on "at".
export const SHAPES = {
  sphere: "a ball (an egg or blob if the sizes differ)",
  box: "a box with rounded corners; \"round\": 0 to 0.5 makes the corners rounder",
  cylinder: "a tube or stick standing up (size [diameter, length, diameter]; to lie along x, rotate [0, 0, 90]); \"taper\": 0 to 2 makes the top narrower or wider than the bottom; \"hollow\": true makes it an open tube (a crown band, a cup, a collar, a vest)",
  cone: "a cone, point up",
  capsule: "a pill shape standing up (to lie along x, rotate [0, 0, 90])",
  dome: "half a ball, round side up, open underneath (an umbrella canopy, a cap)",
  disc: "a flat round plate lying flat, like a plate on a table (a brim, a plate, a base, a lid)",
  coin: "a flat round plate standing up and facing the viewer, no rotation needed (a coin, a badge, a lens, a button, a clock face, a round shield, a wheel); size [width, height, thickness]",
  torus: "a ring facing the viewer (a donut, a handle, a hoop); size [width, height, tube thickness]; \"arc\": 1 to 360 degrees makes a partial ring starting at the right and going up and over (180 is an upside-down U)",
  star: "a puffy five-pointed star, already facing the viewer with no rotation (size [width, height, thickness]); only rotate it to tilt or lay it on a surface that faces elsewhere",
  heart: "a puffy heart, already facing the viewer with no rotation (size [width, height, thickness])",
  leaf: "a leaf or petal shape, already facing the viewer, point up, with no rotation (size [width, height, thickness])",
  // Nov 4: more building blocks (Binoy: "expand the list of building blocks so that Gemma has more to work with")
  wedge: "a soft triangular block, its triangle facing the viewer, point up (a slice of cheese, pizza, cake or watermelon, a roof, a ramp, a sail, a flag's point); size [width, height, depth]; rotate [0, 0, 180] for point down, [0, 0, -90] for point right",
  tube: "a bendy tube that passes through 2 to 4 points, with round ends (a mug or basket handle, a strap, a hose, a spout, a curly tail, a rope, a candy cane's hook, a straw): give \"points\" ([x, y, z] each, in the prop's own coordinates like \"at\") and \"thick\" (its thickness, e.g. 0.05); its \"at\" and \"size\" are worked out from the points, so put anything there",
  cloud: "a puffy cloud, facing the viewer (size [width, height, thickness])",
  moon: "a puffy crescent moon, horns to the right, facing the viewer (size [width, height, thickness])",
  bolt: "a puffy lightning bolt, facing the viewer (size [width, height, thickness])",
  drop: "a puffy raindrop or teardrop, point up, facing the viewer (size [width, height, thickness])",
  fish: "a puffy fish, head to the right, tail to the left, facing the viewer (size [width, height, thickness])",
  paw: "a paw print: a big pad and four toes, facing the viewer (size [width, height, thickness])",
  arrow: "a puffy arrow pointing right, facing the viewer (size [width, height, thickness])",
  note: "a puffy music note, facing the viewer (size [width, height, thickness])",
  burst: "a sunburst: a ring of 12 pointed rays round a filled middle, facing the viewer (a sun's rays, behind a round face; a rosette, a splash, a 'pow'); size [width, height, thickness]",
};
// patterns on a part (Nov 4): "pattern" and a second colour, "pattern_color"
export const PATTERNS = {
  stripes: "bands going round it (a striped scarf, a candy cane, a lighthouse); on a ring or a bendy tube they go across it",
  segments: "wedge-shaped stripes from top to bottom, like a beach ball or a peeled orange (on a box or tube: stripes running along it)",
  dots: "polka dots", checks: "a checkerboard (a picnic cloth, a racing flag)", stars: "little stars all over", zigzag: "a zigzag band (a drum, a party hat, a crown)",
};
export const PATTERN_NAMES = Object.keys(PATTERNS);
const PATTERN_ALIASES = { striped: "stripes", stripe: "stripes", stripy: "stripes", bands: "stripes", banded: "stripes", rings: "stripes", candy: "stripes", "candy stripes": "stripes",
  segment: "segments", wedges: "segments", "beach ball": "segments", vertical: "segments", "vertical stripes": "segments", panels: "segments",
  dot: "dots", dotted: "dots", spots: "dots", spotted: "dots", spotty: "dots", "polka dots": "dots", polka: "dots", seeds: "dots",
  check: "checks", checked: "checks", checkered: "checks", chequered: "checks", checker: "checks", checkerboard: "checks", plaid: "checks", gingham: "checks", tartan: "checks",
  star: "stars", starry: "stars", sparkles: "stars", zig: "zigzag", "zig zag": "zigzag", chevron: "zigzag", chevrons: "zigzag", wavy: "zigzag", waves: "zigzag" };
function normPattern(x) {
  const k = String(x || "").trim().toLowerCase().replace(/[-_]+/g, " ");
  if (!k || /^(none|no|plain|solid|null|false)$/.test(k)) return null;
  return PATTERNS[k] ? k : PATTERN_ALIASES[k] || (Object.keys(PATTERN_ALIASES).find((a) => k.split(" ").includes(a)) ? PATTERN_ALIASES[Object.keys(PATTERN_ALIASES).find((a) => k.split(" ").includes(a))] : null);
}
/** a second colour that shows on the first: white on colour, a cheerful red on white or pale */
function patternColour(c, base, material) {
  const n = c != null && c !== "" ? normColor(c, material) : null;
  if (n && n.toLowerCase() !== String(base).toLowerCase()) return n;
  const [, , light] = hslOf(base);
  return light > 0.8 ? "#e5484d" : "#fbf8f2";
}
export const SHAPE_NAMES = Object.keys(SHAPES);
const SHAPE_ALIASES = {
  ball: "sphere", orb: "sphere", egg: "sphere", blob: "sphere", ellipsoid: "sphere", bead: "sphere", head: "sphere", pompom: "sphere", "pom-pom": "sphere", bubble: "sphere",
  cube: "box", block: "box", rectangle: "box", rect: "box", brick: "box", slab: "box", panel: "box", plank: "box", "rounded box": "box", rounded_box: "box", prism: "box",
  stick: "cylinder", rod: "cylinder", pole: "cylinder", shaft: "cylinder", handle: "cylinder", pipe: "cylinder", barrel: "cylinder", can: "cylinder", trunk: "cylinder", stem: "cylinder",
  pyramid: "cone", spike: "cone", horn: "cone", point: "cone", tip: "cone",
  pill: "capsule", bean: "capsule",
  hemisphere: "dome", "half sphere": "dome", half_sphere: "dome", halfsphere: "dome", canopy: "dome", bowl: "dome", cap: "dome",
  plate: "disc", disk: "disc", brim: "disc", circle: "disc", base: "disc", lid: "disc",
  badge: "coin", medallion: "coin", lens: "coin", button: "coin", wheel: "coin", clock: "coin", token: "coin", "round shield": "coin",
  ring: "torus", donut: "torus", doughnut: "torus", hoop: "torus", loop: "torus", hook: "torus", arc: "torus", halo: "torus",
  petal: "leaf", feather: "leaf", flame: "leaf", wing: "leaf",
  triangle: "wedge", slice: "wedge", ramp: "wedge", roof: "wedge", sail: "wedge", "triangular prism": "wedge", "triangle prism": "wedge",
  hose: "tube", rope: "tube", strap: "tube", spout: "tube", straw: "tube", curve: "tube", "curved tube": "tube", "bent tube": "tube", "bendy tube": "tube", cord: "tube", string: "tube", wire: "tube", tail: "tube",
  crescent: "moon", lightning: "bolt", "lightning bolt": "bolt", zap: "bolt", raindrop: "drop", teardrop: "drop", droplet: "drop", "water drop": "drop",
  "paw print": "paw", pawprint: "paw", footprint: "paw", "music note": "note", "musical note": "note",
  sunburst: "burst", starburst: "burst", rays: "burst", "sun rays": "burst", sunrays: "burst", rosette: "burst", splash: "burst", splat: "burst", pow: "burst", sun: "burst", corona: "burst",
};
export const MATERIALS = {
  plastic: "smooth glossy toy plastic", cloth: "soft fabric", fluffy: "wool or plush fur", metal: "shiny metal",
  wood: "warm wood", glass: "see-through glass or ice", rubber: "matte rubber", paper: "matte paper or card",
  glow: "softly glowing (lights, magic)", candy: "shiny sugary candy",
};
export const MATERIAL_NAMES = Object.keys(MATERIALS);
const MATERIAL_ALIASES = {
  fabric: "cloth", felt: "cloth", silk: "cloth", cotton: "cloth", canvas: "cloth", nylon: "cloth", leather: "cloth",
  wool: "fluffy", plush: "fluffy", fur: "fluffy", fuzzy: "fluffy", furry: "fluffy", velvet: "fluffy",
  gold: "metal", silver: "metal", steel: "metal", chrome: "metal", iron: "metal", brass: "metal", copper: "metal", tin: "metal",
  crystal: "glass", ice: "glass", gem: "glass", jewel: "glass", diamond: "glass", water: "glass",
  light: "glow", neon: "glow", magic: "glow", emissive: "glow", led: "glow", fire: "glow",
  sugar: "candy", sweet: "candy", jelly: "candy", gummy: "candy", icing: "candy", frosting: "candy", chocolate: "candy",
  card: "paper", cardboard: "paper", matte: "rubber", foam: "rubber", clay: "rubber", stone: "rubber", rock: "rubber",
  shiny: "plastic", glossy: "plastic", toy: "plastic", ceramic: "plastic", porcelain: "plastic",
};
// Launchers only ever shoot these. A "gun" becomes a water pistol: safety lives in what props can do, not in names.
export const AMMO = ["confetti", "bubbles", "water", "petals", "stars", "hearts", "snow", "glitter", "coins", "starbursts"];
// a rocket launcher or a bazooka is his big confetti rocket launcher (the heavy one): never the water pistol, never real
// (not a rocket ship: Nov 4, "a shiny silver rocket with big colorful fins" came out as the confetti bazooka)
export const BIG_LAUNCHER = /\b(rockets?(?![- ]?(?:ships?|car|cars|boats?|bikes?|man|men|scientists?|science|pops?|lolly|lollies|shaped|ride|rides))|rocket[- ]?launchers?|bazookas?|rpgs?|missiles?|missile[- ]?launchers?|grenade[- ]?launchers?|big (?:gun|launcher|blaster)s?)\b/i;
/** how he eats something, by its name (Nov 4: "a better action for mochi eating or sipping or scooping food"):
 * "sip" a drink, "scoop" from a bowl with a spoon, "bite" anything else to eat; null if it isn't food */
const SIP = /\b(tea|cocoa|hot chocolate|coffee|latte|milk|milkshake|shake|juice|smoothie|soda|lemonade|drink|potion|boba|bubble tea|cider|cup|mug|glass of|bottle of|water bottle|thermos)\b/;
const NOT_FOOD = /\b(magnifying|traffic|pine ?cone|party|water (?:pistol|gun|balloon|blaster)|paint|bath|cupboard|tea ?pot|trophy|world cup)\b/;
const SCOOP = /\b(soup|noodles?|ramen|udon|pho|cereal|porridge|oatmeal|stew|chili|rice|salad|pudding|yogh?urt|curry|pasta|spaghetti|macaroni|mac and cheese|congee|bowl|sundae|jelly|jello|custard|beans|risotto|dumplings)\b/;
const BITE = /\b(cookies?|biscuits?|pizza|sandwich|burger|hamburger|hot ?dog|taco|burrito|apple|banana|pear|orange|peach|carrot|donut|doughnut|cupcake|muffin|cake|slice|pie|bread|toast|bagel|croissant|pretzel|waffle|pancakes?|sushi|onigiri|rice ball|dumpling|fries|chips|candy|chocolate|lollipop|popsicle|ice ?cream|waffle cone|brownie|cracker|cheese|egg|strawberr(?:y|ies)|watermelon|grapes?|cherr(?:y|ies)|fruit|snack|treat|food|macaron|mochi|corn|drumstick|nuggets?|kebab|skewer|marshmallow|candy cane|gingerbread)\b/;
export function eatStyle(name) {
  const n = String(name || "").toLowerCase();
  if (NOT_FOOD.test(n)) return null;
  if (/\b(bowl|plate) of\b/.test(n) || /\b(soup|noodles?|ramen|cereal|porridge|oatmeal|stew)\b/.test(n)) return "scoop";
  if (SIP.test(n)) return "sip";
  if (SCOOP.test(n)) return "scoop";
  if (BITE.test(n)) return "bite";
  return null;
}
/** a vehicle he rides, by name (a rocket ship, a plane, a boat, a train…), not a toy one he holds; null if it isn't */
export const VEHICLE = /\b(rocket ?ships?|space ?ships?|rocketships?|space rockets?|space shuttles?|ufos?|flying saucers?|(?:air|aero)?planes?|jets?|biplanes?|seaplanes?|gliders?|helicopters?|choppers?|airships?|blimps?|zeppelins?|boats?|speedboats?|motorboats?|galleons?|ships?|sailboats?|yachts?|canoes?|kayaks?|rafts?|submarines?|ferr(?:y|ies)|steamboats?|tugboats?|gondolas?|dinghy|dinghies|speedboats?|rowboats?|trains?|locomotives?|steam engines?|trams?|trolleys?|buses|bus|fire ?trucks?|tractors?|diggers?|bulldozers?|excavators?|motorbikes?|motorcycles?|go[- ]?karts?|race ?cars?|cars?|trucks?|vans?|jeeps?|taxis?|ambulances?|police cars?)\b/i;
export const ROCKET_RIDE = /\b(rocket ?ships?|space ?ships?|rocketships?|space rockets?|space shuttles?)\b/i;
const AMMO_ALIASES = { fireworks: "starbursts", firework: "starbursts", "confetti rockets": "starbursts", starburst: "starbursts", bubble: "bubbles", soap: "bubbles", droplets: "water", splash: "water", flowers: "petals", flower: "petals", star: "stars", heart: "hearts", snowflakes: "snow", sparkles: "glitter", sparkle: "glitter", streamers: "confetti", paper: "confetti", coin: "coins", money: "coins", "chocolate coins": "coins", gold: "coins" };
const UNSAFE_AMMO = /bullet|shell|round|missile|rocket|bomb|grenade|dart|arrow|fire|flame|laser|poison|acid|nail|spike|blade|knife|explosive|shot/;

const NAMED_COLORS = {
  red: "#e5484d", crimson: "#d93a4a", pink: "#ff8fb8", "hot pink": "#ff5fa2", rose: "#f07fa0", magenta: "#e05fd0", purple: "#a77ce8",
  violet: "#9c7ae6", lilac: "#c9b3f2", lavender: "#cdbcf5", blue: "#5b9cf0", navy: "#3557a8", "sky blue": "#8cc8ff", cyan: "#5fd3e0",
  teal: "#3fb8a8", turquoise: "#4fd0c0", mint: "#9ee8c4", green: "#62c46b", lime: "#a8e05a", olive: "#9aa04a", "dark green": "#3f8a4a",
  yellow: "#ffd34d", gold: "#f2c14e", golden: "#f2c14e", orange: "#ff9f43", peach: "#ffb899", coral: "#ff7f6e", brown: "#9a6a44",
  tan: "#d6b48a", beige: "#ead8bd", cream: "#fff3d6", white: "#fbf8f2", ivory: "#fffaf0", grey: "#9aa0a8", gray: "#9aa0a8",
  silver: "#c9ced6", black: "#3a3540", charcoal: "#4a4550", rainbow: "#ff8fb8",
};
const MATERIAL_DEFAULT_COLOR = { plastic: "#8cc8ff", cloth: "#ff8fb8", fluffy: "#fbf8f2", metal: "#c9ced6", wood: "#a8744a", glass: "#cfe9ff", rubber: "#9aa0a8", paper: "#fff3d6", glow: "#ffe27a", candy: "#ff9ac0" };

export const PROP_LIMITS = { parts: 16, nameLength: 40 };

const num = (x, d) => (typeof x === "number" && Number.isFinite(x) ? x : typeof x === "string" && x.trim() !== "" && Number.isFinite(+x) ? +x : d);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const round3 = (x) => Math.round(x * 1000) / 1000;
function vec3(x, d, label, out, scalarFill) {
  if (Array.isArray(x)) {
    const a = x.map((v) => num(v, NaN));
    if (a.length === 3 && a.every(Number.isFinite)) return a;
    if (a.length === 2 && a.every(Number.isFinite)) { out.push(`${label}: 2 numbers, used [${a[0]}, ${a[1]}, ${a[0]}]`); return [a[0], a[1], a[0]]; }
    if (a.length === 1 && Number.isFinite(a[0])) return [a[0], a[0], a[0]];
  } else if (Number.isFinite(num(x, NaN))) { const n = num(x, 0); return scalarFill ? [n, n, n] : [0, 0, n]; }
  else if (x && typeof x === "object") { const a = [num(x.x, NaN), num(x.y, NaN), num(x.z, NaN)]; if (a.every(Number.isFinite)) return a; }
  return d;
}
export function normColor(c, material) {
  if (typeof c === "string") {
    const s = c.trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(s)) return s;
    if (/^#[0-9a-f]{3}$/.test(s)) return "#" + s.slice(1).split("").map((h) => h + h).join("");
    if (NAMED_COLORS[s]) return NAMED_COLORS[s];
    const word = Object.keys(NAMED_COLORS).sort((a, b) => b.length - a.length).find((k) => s.includes(k));
    if (word) return NAMED_COLORS[word];
    if (s.startsWith("#")) {   // a garbled code ("#2d3lin34" for #2d3436): its first hex digits still carry the colour
      const h = s.slice(1).replace(/[^0-9a-f]/g, "");
      if (h.length >= 6) return "#" + h.slice(0, 6);
      if (h.length >= 2) {
        const r = parseInt(h.slice(0, 2), 16), g = h.length >= 4 ? parseInt(h.slice(2, 4), 16) : h.length === 3 ? parseInt(h[2] + "8", 16) : r;
        const b = h.length === 5 ? parseInt(h[4] + "8", 16) : Math.round((r + g) / 2);
        return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
      }
    }
  }
  return MATERIAL_DEFAULT_COLOR[material] || "#8cc8ff";
}
function normShape(s) {
  const k = String(s || "").trim().toLowerCase().replace(/[-_]+/g, " ");
  if (SHAPES[k]) return k;
  if (SHAPE_ALIASES[k]) return SHAPE_ALIASES[k];
  const k2 = k.replace(/ /g, "_");
  if (SHAPES[k2]) return k2;
  const word = Object.keys(SHAPE_ALIASES).find((a) => k.split(" ").includes(a));
  return word ? SHAPE_ALIASES[word] : null;
}
function normMaterial(m) {
  const k = String(m || "").trim().toLowerCase();
  if (MATERIALS[k]) return k;
  if (MATERIAL_ALIASES[k]) return MATERIAL_ALIASES[k];
  const word = Object.keys(MATERIAL_ALIASES).find((a) => k.includes(a));
  return word ? MATERIAL_ALIASES[word] : null;
}
// jewellery is held up to show, not worn round his tummy (Nov 5: "make a gold ring" came out a body wearable 0.4
// across, and sat hidden inside his fleece while he said "I'm holding it right here in my hoof!")
export const JEWEL = /\b(?:(?:gold|golden|silver|diamond|wedding|engagement|magic|promise|toy|candy|ruby|emerald|sapphire)\s+)?(?:rings?|bracelets?|bangles?|anklets?|jewels?|jewell?ery|gems?|gemstones?|diamonds?|rubies|ruby|emeralds?|sapphires?|pearls?|earrings?|wrist ?watch(?:es)?|pocket ?watch(?:es)?)\b/;
export const NOT_JEWEL = /\b(?:wrestling|boxing|circus|onion|swim|swimming|key|ring ?toss|tree|rings? of|smoke|bell|phone|life|ring ?buoy|necklace|crown|tiara)\b/;
export function guessArchetype(text) {
  { const t = String(text || "").toLowerCase(); if (JEWEL.test(t) && !NOT_JEWEL.test(t)) return "handheld_tool"; }
  const t = String(text || "").toLowerCase();
  if (/\b(water[- ]?balloons?|water[- ]?bombs?|snow ?balls?|confetti ?(balls?|bombs?)|grenades?|bombs?|foam ?balls?|dodge ?balls?|bean ?bags?|throwables?)\b/.test(t)) return "throwable";
  if (/\b(bikes?|bicycles?|tricycles?|trikes?|unicycles?|skate ?boards?|longboards?|scooters?|go[- ]?karts?|hoverboards?|roller ?skates?|wagons?)\b/.test(t)) return "ride";
  // a car he can get into and drive (Nov 3: "mochi was not able to get in the car it built and drive around in it"); a
  // toy, model or tiny one sits beside him
  if (/\b(cars?|trucks?|jeeps?|vans?|buses|bus|taxis?|limos?|limousines?|convertibles?|buggy|buggies|tractors?|fire ?trucks?|race ?cars?|racecars?|sports cars?|monster trucks?|ambulances?|karts?|automobiles?|roadsters?)\b/.test(t) && !/\b(toy|model|tiny|mini|matchbox|hot wheels|remote[- ]control(?:led)?|rc)\s+(?:\w+\s+)?(cars?|trucks?|vans?|bus)\b/.test(t)) return "ride";
  if (/\b(umbrellas?|parasols?|balloons?|kites?|pinwheels?|canopy|lanterns? on|flags?|banners?)\b/.test(t)) return "handheld_canopy";
  if (/\b(launchers?|blasters?|bazookas?|cannons?|poppers?|squirters?|guns?|pistols?|rifles?|shooters?|sprayers?|rockets?|slingshots?|crossbows?|bow and arrow|water ?guns?|nerf|tasers?)\b/.test(t)) return "launcher";
  if (/\b(vests?|jackets?|armou?r|body ?armou?r|life ?jackets?|scarf|scarves|capes?|cloaks?|backpacks?|rucksacks?|medals?|sash|bandanas?|bibs?|aprons?|ties?|necklaces?|badges?|uniforms?|harness|belts?|shirts?|sweaters?|hoodies?|coats?|tutus?|kevlar)\b/.test(t)) return "body_wearable";
  if (/\b(hats?|crowns?|caps?|helmets?|tiaras?|halos?|headbands?|beanies?|bows?|ears|wigs?|hoods?|bonnets?|berets?|visors?|goggles|glasses|sunglasses|antennae?|headphones|headsets?|earmuffs|night[- ]vision|masks?)\b/.test(t)) return "head_wearable";
  if (/\b(teddy|bears?|plush(ie)?s?|robots?|friends?|pets?|plants?|pots?|cakes?|snowman|snowmen|cars?|trucks?|dogs?|cats?|bunny|bunnies|rabbits?|ducks?|frogs?|dragons?|dinosaurs?|chicks?|house|rocks?|piggy ?banks?|traffic cones?|safes?|vaults?|towers?|jars?|tents?|drones?|tanks?|boats?|trains?|castles?)\b/.test(t)) return "companion";
  if (/\b(balls?|baseballs?|softballs?|tennis balls?)\b/.test(t) && !/\b(crystal|disco|ball ?gown|ballpoint)\b/.test(t)) return "throwable";
  return "handheld_tool";
}

// Euler XYZ (three.js default order) rotation of a point, degrees. The matrix is Rx·Ry·Rz, so a point is turned
// about z first, then y, then x.
function rot(p, r) {
  const [ax, ay, az] = r.map((d) => (d * Math.PI) / 180);
  let [x, y, z] = p;
  let c = Math.cos(az), s = Math.sin(az); [x, y] = [x * c - y * s, x * s + y * c];
  c = Math.cos(ay); s = Math.sin(ay); [x, z] = [x * c + z * s, -x * s + z * c];
  c = Math.cos(ax); s = Math.sin(ax); [y, z] = [y * c - z * s, y * s + z * c];
  return [x, y, z];
}
export function partBounds(p) {   // axis-aligned box of a (rotated) part
  const h = p.size.map((v) => v / 2), lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const q = rot([sx * h[0], sy * h[1], sz * h[2]], p.rotate || [0, 0, 0]);
    for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], q[i] + p.at[i]); hi[i] = Math.max(hi[i], q[i] + p.at[i]); }
  }
  return { lo, hi };
}
export function propBounds(parts) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const p of parts) { const b = partBounds(p); for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], b.lo[i]); hi[i] = Math.max(hi[i], b.hi[i]); } }
  return { lo, hi, size: hi.map((v, i) => v - lo[i]) };
}

// A helmet or cap shell (a dome) whose top is below his fleece (about y = 0.15 at the head slot) is inside his head:
// the whole prop is lifted until the dome's top is at y = 0.28, like a helmet that fits.
function liftSunkenShell(parts, warnings) {
  const domes = parts.filter((p) => p.shape === "dome");
  if (!domes.length) return;
  const shell = domes.reduce((a, b) => (a.size[0] * a.size[2] >= b.size[0] * b.size[2] ? a : b));
  if (Math.max(shell.size[0], shell.size[2]) < 0.6) return;   // a small dome is a detail (a light, a button), not the shell
  const top = partBounds(shell).hi[1];
  if (top >= 0.15) return;
  const lift = Math.min(0.6, 0.28 - top);
  for (const p of parts) p.at = [p.at[0], round3(p.at[1] + lift), p.at[2]];
  warnings.push(`the ${shell.label || "dome"} sat inside his head; lifted everything ${round3(lift)}`);
}

// Goggles and glasses sunk into his face (tubes at z = 0.3 when his face is at z ≈ 0.6) would be invisible: everything
// at eye level in front of the head moves forward together until the deepest-buried bit pokes out of the face.
// His face, seen from the head slot's origin: an ellipsoid centred at (0, -0.55, 0.14), radii 0.56 × 0.5 × 0.5.
function unburyFaceGear(parts, warnings) {
  const wraps = (p) => p.shape === "dome" || (p.shape === "cylinder" && p.hollow) || (p.shape === "torus" && Math.max(p.size[0], p.size[1]) > 0.9);   // shells and straps go round the head
  // only small gear in front of his face: chin straps, padding and brims at the sides or inside a helmet stay put
  const eye = parts.filter((p) => { if (wraps(p) || Math.max(...p.size) > 0.5) return false; const b = partBounds(p), cx = (b.lo[0] + b.hi[0]) / 2, cy = (b.lo[1] + b.hi[1]) / 2; return Math.abs(cy + 0.52) <= 0.3 && Math.abs(cx) <= 0.42 && (b.lo[2] + b.hi[2]) / 2 > 0.15; });
  let push = 0;
  for (const p of eye) {
    const b = partBounds(p), cx = (b.lo[0] + b.hi[0]) / 2, cy = (b.lo[1] + b.hi[1]) / 2;
    const nx = cx / 0.56, ny = (cy + 0.55) / 0.5, r2 = 1 - nx * nx - ny * ny;
    if (r2 <= 0) continue;
    const face = 0.14 + 0.5 * Math.sqrt(r2), depth = b.hi[2] - b.lo[2];
    if (b.hi[2] < face + 0.01) push = Math.max(push, face + 0.01 - b.hi[2] + depth * 0.5);
  }
  if (push <= 0.005) return;
  push = Math.min(push, 0.35);
  for (const p of eye) p.at = [p.at[0], p.at[1], round3(p.at[2] + push)];
  warnings.push(`${eye.map((p) => p.label || p.shape).slice(0, 3).join(", ")} sat inside his face; moved ${round3(push)} forward`);
}

// Worn on his body: things on his front (a scarf, a medal, a tie, a bib) written too far in sit inside his fleece and
// poke out of his tummy (M5, Nov 4: a Christmas scarf at z 0.26, half inside him). Like gear on his face, the pieces in
// front of him move forward together until the deepest-buried one sits on his front, and things on his back move back.
// Things that go round his neck (a scarf, a necklace, a bow tie) and were written down at his middle go up to his neck
// first. Straps and shells that go round him are left alone.
const NECK_WORDS = /scarf|scarves|necklace|collar|bow ?tie|bowtie|choker|lei\b|bandana|neckerchief|cravat|ascot|pendant|locket|bib\b/;
const wrapsBody = (p) => (p.shape === "torus" && Math.max(p.size[0], p.size[1]) > 0.9) || (p.shape === "cylinder" && p.hollow) || p.shape === "dome" || (p.size[0] > 1.1 && p.size[2] > 1.0);   // goes round him
export function unburyBodyGear(parts, name, warnings) {
  const R = [0.64, 0.64, 0.6];
  const gear = parts.filter((p) => !wrapsBody(p)), mid = (b, k) => (b.lo[k] + b.hi[k]) / 2;
  if (!gear.length) return;
  if (NECK_WORDS.test(String(name).toLowerCase())) {   // round his neck, not his middle: its top at the bottom of his head
    const top = Math.max(...parts.map((p) => partBounds(p).hi[1]));
    if (top < 0.3) { const up = round3(0.42 - top); for (const p of parts) p.at = [p.at[0], round3(p.at[1] + up), p.at[2]]; warnings.push(`it sat down on his middle; moved up ${up} to his neck`); }
  }
  for (const side of [1, -1]) {
    let push = 0;
    const these = gear.filter((p) => side * mid(partBounds(p), 2) > 0.05);
    for (const p of these) {
      const b = partBounds(p), nx = mid(b, 0) / R[0], ny = mid(b, 1) / R[1], r2 = 1 - nx * nx - ny * ny;
      if (r2 <= 0) continue;
      const skin = R[2] * Math.sqrt(r2), out = side > 0 ? b.hi[2] : -b.lo[2], depth = b.hi[2] - b.lo[2];
      if (out < skin + 0.01) push = Math.max(push, skin + 0.01 - out + depth * 0.5);
    }
    if (push <= 0.01) continue;
    push = Math.min(push, 0.45);
    for (const p of these) p.at = [p.at[0], p.at[1], round3(p.at[2] + side * push)];
    // what hangs off those pieces (tassels beside him) comes along
    const moved = new Set(these);
    for (const p of gear) if (!moved.has(p) && side * mid(partBounds(p), 2) > -0.05 && Math.abs(mid(partBounds(p), 0)) >= R[0] * 0.95) p.at = [p.at[0], p.at[1], round3(p.at[2] + side * push)];
    warnings.push(`${these.map((p) => p.label || p.shape).slice(0, 3).join(", ")} sat inside him; moved ${round3(push)} ${side > 0 ? "forward" : "back"}`);
  }
}

/* Fitting something he wears (Nov 4, Binoy: "whenever a dress or something to be worn by mochi is made I want the
 * tester and the coder to consider the size of the item relative to mochi's own body and where it can best be
 * placed"). FIT_GUIDE goes to Gemma when it designs one; fitReport() measures what it wrote against him. */
export const FIT_GUIDE = {
  body: [
    `Fitting it to Mochi. His body is a soft round ball 1.28 wide, 1.28 tall and 1.2 deep, centred on the origin. His head sits on top (its bottom at about y = 0.4); his front surface is at z = 0.6 in the middle, about 0.46 up at his neck and 0.5 at y = -0.3.`,
    `Where things go, and how big (compare with him):`,
    `- round his neck (scarf, necklace, collar, bow tie, lei): a ring about 1.1 to 1.3 across at y = 0.38 to 0.45; a bow or knot in front at z = 0.48; ends hang down his chest.`,
    `- on his chest (badge, medal, tie, bib, name tag): flat pieces lying on his front, their back at his surface (z ≈ 0.55 at y = 0.1 to 0.3); a tie hangs from y = 0.4 down to y = -0.15. A badge is 0.2 to 0.35 across.`,
    `- round his middle (belt, sash, apron strings): a ring 1.3 to 1.4 across at y = -0.15 to -0.3; a sash runs from one shoulder to the other hip across his front.`,
    `- his bottom half (skirt, tutu, grass skirt, kilt): a flared ring round him from y = -0.1 down to -0.5, 1.4 to 1.7 across at the hem; it goes all the way round, not a disc in front.`,
    `- on his back (cape, backpack, wings, shell, jetpack): z from -0.55 back to -0.9; a cape hangs from his neck (y = 0.4) down to about y = -0.5, 1.0 to 1.3 wide.`,
    `- all over (sweater, vest, life jacket, costume): a shell that goes round him, 1.32 to 1.45 across, from y = 0.4 down to y = -0.3, with holes or gaps for his arms at the sides. A rounded top that follows him: a dome about 1.44 across and 0.7 tall standing on y = 0 (its top tucks up under his chin).`,
    `- a dress: that rounded top, and a skirt flaring out from a sash at his middle (y = 0) down to about y = -0.55, 1.5 to 1.7 across at the hem.`,
    `Nothing inside him and nothing floating off him: every piece touches his fleece or the piece it hangs from.`,
  ].join("\n"),
  head: [
    `Fitting it to Mochi's head. His head is a soft ball about 1.25 wide, 1.2 tall and 1.12 deep, its centre at y = -0.5 below the origin (the top of his head); his eyes are at y = -0.5, z = 0.5, his ears stick out at the sides at y = -0.35.`,
    `- on top (hats, crowns, bows): the bottom at y = 0.05 to 0.12, a hat 0.9 to 1.3 across (a brim up to 1.9), a crown 0.8 to 1.0; a bow or flower off to one side at y = 0.0.`,
    `- round his head (headband, flower crown, halo): a ring 1.1 to 1.3 across at y = -0.05 to 0.05 (a halo floats 0.15 above).`,
    `- on his face (glasses, goggles, a mask): at y = -0.5, z = 0.5 to 0.6, about 1.0 across.`,
  ].join("\n"),
};
/* Vehicles (Nov 4, Binoy: "give it better building blocks and instructions to help it make future vehicle requests
 * like a ship or helicopter"): how each kind is put together, in his units, with the labels that make it move when he
 * rides it. VEHICLE_GUIDE goes to Gemma with the nearest hand-made ones (shared/pocket-vehicles.js) as examples. */
export const VEHICLE_GUIDE = {
  all: [
    `Building a vehicle for Mochi. It points along +x (the way it goes) and stands on y = 0; seen from the side, like his car. It is up to 3 long, about 1.2 to 1.5 wide, and he rides it, so it needs a "seat" for him: a flat box 0.5 to 0.62 long and 0.6 wide, sunk into it so its top is 0.5 to 1.1 up, with the sides (a body, a hull, a cabin or a cockpit rim) rising 0.3 to 0.5 above the seat to hide his legs. Sitting in it he is 2.2 tall above the seat and 1.3 wide, so nothing goes over the seat lower than 2.2 above it: no roof (keep the top open, like a convertible or a kiddie ride), and a helicopter's rotor goes up at about 2.95, on a mast behind him. The whole vehicle stays under 3.0 tall.`,
    `Build it from 12 to 30 round, chunky parts that touch: a big main shape first (body, hull, cabin, boiler), then the parts that say what it is, then 3 to 6 small details (windows, portholes, a stripe, a star, lights, a flag).`,
    `Labels make it move when he rides it, so use them: "wheel" (each wheel: a torus or coin standing up, facing the viewer, its bottom on y = 0) with a "hub" in it; "propeller" or "rotor" for anything that spins (one long thin box, or two crossing, centred on the hub, thinnest side along the axle); "flame" for a rocket's fire (a glowing cone pointing backwards, -x); "water" for the pond a boat sits in (a flat disc, about 3.0 by 1.7, glass, light blue, at y = 0.02); "steering" for what he holds (a steering wheel, a joystick, a ship's wheel).`,
    `To lie along x: a cylinder or capsule with rotate [0, 0, 90]; a cone pointing forward with rotate [0, 0, -90] (backward: [0, 0, 90]); a ring round a body lying along x with rotate [0, 90, 0]; a ring lying flat (a cockpit rim) with rotate [90, 0, 0].`,
  ].join("\n"),
  fly: `A rocket ship lies on its side like a kiddie ride: a fat capsule body about 1.9 long and 1.0 thick (centre y = 0.78), a nose cone at the front (x = 1.0 to 1.55), three fins at the back (one on top, two below touching the ground, at z = ±0.4), a bell nozzle and a "flame" behind it, two or three round portholes with metal rims on the side facing the viewer (z = 0.5), bands of colour round it, an open cockpit on top in the middle with a rim and a little windscreen. A plane: a body like that (about 2.3 long, 0.8 thick), wings as one wide flat rounded box crossing it (about 0.7 by 0.09 by 2.6, along z), a small tail wing and a tail fin at the back, a "propeller" and a spinner on the nose, an open cockpit, two wheels on struts under the wings. A helicopter: a round cabin (a rounded box about 1.5 by 0.72 by 1.2) open on top, a glass bubble at the front, a thin tail boom to a little tail fin and a "tail rotor" facing the viewer, a mast behind his seat up to a hub about 2.95 up with a "rotor" of two long thin boxes crossing (2.4 long), and two skids along x on short struts.`,
  sail: `A boat sits in its "water": a hull (a rounded box about 1.9 by 0.52 by 1.1, round 0.5, its bottom just in the water) with a pointed bow (a cone pointing forward, squashed: size [0.52, 0.72, 1.1]) and a white rim along the top; a sailboat has a tall thin mast and a triangular sail (a wedge, cloth, white) in front of his seat; a ship has a cabin with round windows, a funnel with a coloured top and a puff of "smoke" (a cloud), portholes along the hull and a stripe at the waterline; a submarine is a fat capsule body (about 2.3 long, 1.0 thick) with portholes, a tower on top that he sits in, a periscope (a bendy tube), fins and a "propeller" at the back.`,
  drive: `A train engine: a boiler lying along x (a cylinder, about 1.3 long, 0.72 thick) with a dark front plate, a chimney with a puff of "smoke", a gold dome and a lamp, a cowcatcher (a wedge pointing forward) low at the front, an open cab at the back that he sits in (a tall back, no roof), a dark chassis, and three wheels each side (coins facing the viewer, the back ones bigger) joined by a rod. A bus or truck: the car, longer and taller, with a row of windows and a flat front; a fire truck is red with a ladder on top.`,
};
/** which vehicle guide notes go with this name (a rocket ship flies, a ship sails, a train drives) */
export function vehicleGuide(name) {
  const n = String(name || "").toLowerCase(), kind = FLYING.test(n) ? "fly" : SAILING.test(n) ? "sail" : VEHICLE.test(n) ? "drive" : null;
  return kind ? [VEHICLE_GUIDE.all, VEHICLE_GUIDE[kind]].join("\n") : null;   // (a bike or a skateboard: the ride's own notes)
}
const FIT_KINDS = [
  ["neck", /scarf|scarves|necklace|collar|bow ?tie|bowtie|choker|\blei\b|bandana|neckerchief|cravat|pendant|locket|\bbib\b|\btie\b|necktie/],
  ["back", /cape|cloak|backpack|rucksack|wings?\b|jet ?pack|shell|quiver|parachute/],
  ["skirt", /skirt|tutu|kilt|sarong|grass skirt|hula/],
  ["waist", /belt|sash|fanny|bum bag|waistband/],
  ["chest", /badge|medal|name ?tag|brooch|pin\b|sticker|rosette/],
  ["front", /apron|pinafore|smock|breastplate/],
  ["all", /sweater|jumper|hoodie|vest|jacket|coat|shirt|t-shirt|tee\b|dress|costume|suit|armou?r|life ?jacket|overalls|onesie|robe|tunic|jersey|top\b/],
];
export function fitKind(name) { const t = String(name || "").toLowerCase(); const k = FIT_KINDS.find(([, re]) => re.test(t)); return k ? k[0] : null; }
/** What's wrong with how it would sit on him, measured: too big or too small next to him, floating off him, or in the
 * wrong place for the kind of thing it is. [] when it fits. Body things only (a hat is checked by the validator). */
export function fitReport(recipe) {
  const A = recipe && ARCHETYPES[recipe.archetype];
  if (!A || A.slot !== "body" || !recipe.parts || !recipe.parts.length) return [];
  const R = [0.64, 0.64, 0.6], out = [], bs = recipe.parts.map(partBounds);
  const lo = [0, 1, 2].map((k) => Math.min(...bs.map((b) => b.lo[k]))), hi = [0, 1, 2].map((k) => Math.max(...bs.map((b) => b.hi[k])));
  const W = hi[0] - lo[0], H = hi[1] - lo[1], D = hi[2] - lo[2], kind = fitKind(recipe.name), r2 = (n) => Math.round(n * 100) / 100;
  if (W > (kind === "skirt" || kind === "back" ? 2.0 : 1.75) || D > 1.9) out.push(`it's too big for him: ${r2(W)} wide and ${r2(D)} deep, and he's 1.28 wide; bring it down to ${kind === "skirt" ? "1.4 to 1.7" : "about 1.3 to 1.5"} across`);
  if (Math.max(W, H, D) < 0.16) out.push(`it's too small to see on him (${r2(Math.max(W, H, D))} at most); make it at least 0.3 across`);
  // how close it comes to him: the nearest point of its pieces to his fleece
  const gap = Math.min(...bs.map((b) => {
    const c = [0, 1, 2].map((k) => Math.max(b.lo[k], Math.min(b.hi[k], 0)));   // its point nearest his middle
    const n = Math.hypot(c[0] / R[0], c[1] / R[1], c[2] / R[2]);
    return (n - 1) * 0.62;
  }));
  if (gap > 0.1) out.push(`it doesn't touch him: its nearest piece is ${r2(gap)} away from his fleece; move it in so it sits on him`);
  const my = (lo[1] + hi[1]) / 2, vol = (p) => p.size[0] * p.size[1] * p.size[2];
  const pieces = recipe.parts.filter((p) => !wrapsBody(p)), pool = pieces.length ? pieces : recipe.parts;
  const main = pool.reduce((a, p) => (vol(p) > vol(a) ? p : a), pool[0]), mb = partBounds(main), mz = (mb.lo[2] + mb.hi[2]) / 2;   // where its biggest piece is (not the straps or collar that go round)
  if (kind === "neck" && (hi[1] < 0.25 || lo[1] > 0.6)) out.push(`a ${recipe.name} goes round his neck (y = 0.38 to 0.45, his head starts at 0.4), but its top is at y = ${r2(hi[1])}`);
  if (kind === "back" && mz > -0.15) out.push(`a ${recipe.name} goes on his back (z from -0.55 to -0.9), but it's at z = ${r2(mz)}`);
  if (kind === "skirt" && my > 0.05) out.push(`a ${recipe.name} goes round his bottom half (y = -0.1 down to -0.5), but it's up at y = ${r2(my)}`);
  if (kind === "skirt" && (W < 1.25 || D < 1.1)) out.push(`a ${recipe.name} goes all the way round him: make it a flared ring at least 1.35 across and deep (it's ${r2(W)} × ${r2(D)})`);
  if (kind === "waist" && (my > 0.15 || my < -0.45)) out.push(`a ${recipe.name} goes round his middle (y = -0.15 to -0.3), but it's at y = ${r2(my)}`);
  if (kind === "chest" && (hi[2] < 0.5 || my < -0.35)) out.push(`a ${recipe.name} goes on his chest, lying on his front (z ≈ 0.55, y = 0.1 to 0.3)`);
  if (kind === "front" && mz < 0.25) out.push(`a ${recipe.name} goes on his front (z ≈ 0.5 to 0.62), but its main piece is at z = ${r2(mz)}`);
  if (kind === "all" && (W < 1.2 || D < 1.05)) out.push(`a ${recipe.name} goes round all of him: at least 1.32 across and 1.2 deep (it's ${r2(W)} × ${r2(D)})`);
  return out;
}

// Glasses arms written standing up (a stick [0.05, 0.5, 0.05] by each ear) stick up like antennae: models put the length
// in the second number whatever the direction. On glasses and goggles, sticks named arms or temples at eye level beside
// the frame are laid back along z, from the back of the frame towards his ears.
const GLASSES = /glass|shades|specs|spectacle|sunnies|monocle|goggle/;
const ARM_WORDS = /(^|[^a-z])(arms?|temples?|ear ?pieces?|legs?|stems?)([^a-z]|$)/;
function layGlassesArms(parts, name, warnings) {
  if (!GLASSES.test(String(name).toLowerCase())) return;
  const mid = (b, k) => (b.lo[k] + b.hi[k]) / 2;
  const front = parts.filter((p) => { const b = partBounds(p); return mid(b, 2) > 0.4 && Math.abs(mid(b, 0)) <= 0.62 && Math.abs(mid(b, 1) + 0.5) <= 0.35 && Math.max(...p.size) <= 0.6; });
  if (!front.length) return;
  const back = Math.min(...front.map((p) => partBounds(p).lo[2])), laid = [];
  for (const p of parts) {
    const label = String(p.label || "").toLowerCase(), [w, h, d] = p.size;
    if (front.includes(p) || !["capsule", "cylinder", "box"].includes(p.shape) || !p.rotate.every((v) => v === 0)) continue;
    if (h < 3.5 * Math.max(w, d) || !ARM_WORDS.test(label) || /mount|strap|chin|band/.test(label)) continue;
    if (Math.abs(p.at[0]) < 0.2 || Math.abs(p.at[1] + 0.5) > 0.35) continue;
    p.rotate = [90, 0, 0]; p.at = [p.at[0], p.at[1], round3(back - h / 2 + 0.02)];
    laid.push(p.label || p.shape);
  }
  if (laid.length) warnings.push(`${laid.join(", ")} stood up like antennae; laid back towards his ears`);
}

// On a worn prop, thin sticks poking far out (chin straps written sideways) would make the whole prop shrink to fit,
// leaving a helmet too small for his head. The sticks are trimmed to the space the solid parts leave instead.
function trimSticks(parts, maxSize, warnings) {
  const thin = (p) => { const s = [...p.size].sort((a, b) => a - b); return s[1] <= 0.1 && s[2] >= 3 * s[1]; };
  const solid = parts.filter((p) => !thin(p));
  if (!solid.length || solid.length === parts.length || Math.max(...propBounds(parts).size) <= maxSize) return;
  const b = propBounds(solid);   // (if the solid parts are too big themselves, scaling still follows, but only by their size)
  const room = b.size.map((v) => Math.max(0, (maxSize - v) / 2)), lo = b.lo.map((v, k) => v - room[k]), hi = b.hi.map((v, k) => v + room[k]);
  const trimmed = [], gone = new Set();
  for (const p of parts) {
    if (!thin(p) || !p.rotate.every((v) => v % 90 === 0)) continue;
    const pb = partBounds(p);
    for (let k = 0; k < 3; k++) {
      const a = Math.max(pb.lo[k], lo[k]), z = Math.min(pb.hi[k], hi[k]);
      if (a <= pb.lo[k] + 1e-6 && z >= pb.hi[k] - 1e-6) continue;
      if (z - a < 0.05) { gone.add(p); break; }   // entirely outside: it can't be a strap of this prop
      const j = [0, 1, 2].find((jj) => { const e = [0, 0, 0]; e[jj] = 1; return Math.abs(rot(e, p.rotate)[k]) > 0.9; });
      if (j === undefined) continue;
      p.size[j] = round3(z - a); p.at[k] = round3((a + z) / 2);
      trimmed.push(p.label || p.shape);
    }
  }
  for (let i = parts.length - 1; i >= 0; i--) if (gone.has(parts[i])) parts.splice(i, 1);
  if (trimmed.length) warnings.push(`${[...new Set(trimmed)].join(", ")} stuck out past the rest; trimmed to fit`);
  if (gone.size) warnings.push(`${[...gone].map((p) => p.label || p.shape).join(", ")} sat far outside the rest; left out`);
}

const BADGE_WORDS = /(^|[^a-z])(badges?|emblems?|insignias?|patch(es)?|medals?|medallions?|lens(es)?|coins?|tokens?|dials?|clock|stickers?|seals?|crests?|logos?)([^a-z]|$)/;

// What a worn prop sits on, in its own coordinates (the same plain stand-ins the crafter renders it on): his head for
// the head slot, his body for the body slot. Anything resting on or around these is held by them.
export const STAND_IN = { head: { c: [0, -0.5, 0], r: [0.64, 0.6, 0.56] }, body: { c: [0, 0, 0], r: [0.62, 0.6, 0.6] } };
function touchesStandIn(b, S, margin = 0.04) {   // the box's nearest point is within the (slightly grown) ellipsoid
  let d2 = 0;
  for (let k = 0; k < 3; k++) {
    const lo = (b.lo[k] - S.c[k]) / (S.r[k] + margin), hi = (b.hi[k] - S.c[k]) / (S.r[k] + margin);
    const d = lo > 0 ? lo : hi < 0 ? -hi : 0; d2 += d * d;
  }
  return d2 <= 1;
}

// Bits that float free of the rest (a charm a little way off a phone) are moved until they just touch the nearest part
// of the main body: models often leave small gaps, and a floating bit reads as broken, not as a detail. On a worn prop
// his head or body holds things too (a goggle strap round the back, glasses arms by his ears): those stay where they are.
function attachFloating(parts, warnings, standIn = null) {
  const B = parts.map(partBounds), n = parts.length, TOUCH = 0.012, GLUE = n;
  const gap = (a, b) => { let d2 = 0; for (let k = 0; k < 3; k++) { const d = Math.max(0, a.lo[k] - b.hi[k], b.lo[k] - a.hi[k]); d2 += d * d; } return Math.sqrt(d2); };
  const root = [...parts.map((_, i) => i), GLUE], find = (i) => (root[i] === i ? i : (root[i] = find(root[i])));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (gap(B[i], B[j]) <= TOUCH) root[find(i)] = find(j);
  if (standIn) for (let i = 0; i < n; i++) if (touchesStandIn(B[i], standIn)) root[find(i)] = find(GLUE);
  const groups = new Map();
  parts.forEach((p, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(i); });
  if (groups.size < 2) return;
  const vol = (i) => parts[i].size[0] * parts[i].size[1] * parts[i].size[2];
  const list = [...groups.entries()].sort(([, a], [, b]) => b.reduce((s, i) => s + vol(i), 0) - a.reduce((s, i) => s + vol(i), 0));
  const held = find(GLUE), main = new Set(list[0][1]);   // the biggest piece stays, and so does whatever rests on him
  if (groups.has(held)) for (const i of groups.get(held)) main.add(i);
  for (const [r, g] of list.slice(1)) {
    if (r === held) continue;
    let best = null;   // the closest pair between this group and the main body
    for (const i of g) for (const j of main) { const d = gap(B[i], B[j]); if (!best || d < best.d) best = { d, i, j }; }
    if (!best || best.d > 0.6) continue;   // far away on purpose (or nonsense): leave it
    const a = B[best.i], b = B[best.j], delta = [0, 0, 0];
    for (let k = 0; k < 3; k++) {
      if (a.lo[k] > b.hi[k]) delta[k] = b.hi[k] - a.lo[k] - 0.006;
      else if (a.hi[k] < b.lo[k]) delta[k] = b.lo[k] - a.hi[k] + 0.006;
    }
    for (const i of g) { parts[i].at = parts[i].at.map((v, k) => round3(v + delta[k])); B[i] = partBounds(parts[i]); main.add(i); }
    warnings.push(`${g.map((i) => parts[i].label || `part ${i + 1}`).join(", ")} floated ${round3(best.d)} away; moved to touch the rest`);
  }
}

/** Check and repair a prop recipe. Never throws. Returns { ok, recipe, errors, warnings }. */
// A ride: how he gets on (sits on a seat and pedals, or stands on a board) and where. The seat is the top of the
// part named seat or saddle (a board: the top of the deck), else the top of the middle of it.
export const RIDE_WHEEL = /wheel|tire|tyre/, RIDE_SPIN = /spoke|hub|rim/, RIDE_CRANK = /pedal|crank|chainring/;
// Nov 4: rides that fly and sail. What spins in the air or the water ("propeller", "rotor"), what flickers ("flame"),
// and the little pond a boat sits in ("water"); and which vehicles fly or sail, by name (a rocket ship flies, a ship
// sails: the rocket is looked for first) or by their parts (wings or a rotor; a hull or a sail)
export const RIDE_PROP = /propell|rotor|\bblades?\b|\bfan\b/, RIDE_FLAME = /flame|exhaust|thruster|afterburn/, RIDE_WATER = /^water$|^pond$|^sea$|^waves?$/;
// Parts that move on the stage on anything he has (Nov 7, kit/src/moving.js), found by label like a ride's wheels:
// spinners turn, flags wave, charms swing, flames flicker, and a lid, door or hatch opens when you tap it
export const MOVE_SPIN = /pinwheel|windmill|propell|\bfan\b|spinner|rotor|turbine|whirligig/;
export const MOVE_WAVE = /\bflag\b(?!\s*pole)|banner|pennant|streamer|windsock/;
export const MOVE_SWING = /pendulum|clapper|\bcharm\b(?!\s*ring)|dangl|tassel|keychain/;
export const MOVE_GLOW = /flame|\bfire\b|\bglow|\bbulb\b|candle ?light|sparkle|twinkle/;
export const MOVE_LID = /\blid\b|\bdoor\b(?!\s*(?:handle|knob|frame))|\bhatch\b(?!\s*rim)/;
export const MOVING_NOTE = `Some labels move on the stage: a part labelled "propeller", "fan", "pinwheel" or "windmill" spins; "flag", "banner" or "pennant" waves; "charm", "tassel" or "pendulum" swings; "flame", "glow" or "bulb" flickers; "lid", "door" or "hatch" opens when he's tapped. Use them where the real thing moves.`;
export const FLYING = /\b(rocket|spaceship|space ship|rocketship|space shuttle|shuttle|ufo|flying saucer|(air|aero)?planes?|jets?|jet ?plane|biplane|seaplane|glider|helicopters?|choppers?|copters?|airships?|blimps?|zeppelin|hot ?air balloon|drone)\b/;
export const SAILING = /\b(boats?|ships?|sailboat|sailing boat|yacht|canoe|kayak|raft|submarine|sub|ferry|steamboat|tugboat|gondola|dinghy|pirate ship|houseboat|paddle ?boat|ocean liner|cruise ship|speedboat|motorboat|rowboat|row boat|banana boat|swan boat|duck boat)\b/;
function rideInfo(parts, name) {
  const lab = (p) => String(p.label || "").toLowerCase(), b = propBounds(parts);
  const top = (p) => { const pb = partBounds(p); return [round3((pb.lo[0] + pb.hi[0]) / 2), round3(pb.hi[1]), round3((pb.lo[2] + pb.hi[2]) / 2)]; };
  const seat = parts.find((p) => /^(bike |bicycle |trike |driver'?s? |front )?(seat|saddle)$/.test(lab(p))) || parts.find((p) => /seat|saddle/.test(lab(p)) && !/tube|post|stay|belt|back|rear|passenger/.test(lab(p))) || parts.find((p) => /seat|saddle/.test(lab(p)) && !/tube|post|stay|belt/.test(lab(p)));
  const back = parts.find((p) => p !== seat && /(back|rear|passenger|second) ?seat|bench/.test(lab(p)));
  const drive = parts.some((p) => /steering/.test(lab(p))) || /\b(car|truck|jeep|van|bus|taxi|limo|convertible|buggy|tractor|kart|automobile|roadster|ambulance|train|locomotive|engine|tram|trolley|fire ?truck|digger|bulldozer|excavator|tank)s?\b/.test(String(name).toLowerCase());
  const deck = parts.find((p) => /^deck$|^board$/.test(lab(p))) || parts.find((p) => /deck|board/.test(lab(p)));
  const board = !seat && (!!deck || /skate|board|scooter|hover|skates/.test(String(name).toLowerCase()) || b.hi[1] < 0.4);
  const at = seat ? top(seat) : deck ? top(deck) : [round3((b.lo[0] + b.hi[0]) / 2), round3(board ? b.hi[1] : b.hi[1] * 0.6), 0];
  const bars = parts.find((p) => /handle ?bar|handlebar|bars|handle/.test(lab(p)));
  const steer = parts.find((p) => /steering/.test(lab(p)));
  const n = String(name).toLowerCase();
  const fly = FLYING.test(n) || (!SAILING.test(n) && !drive && parts.some((p) => /wing|rotor/.test(lab(p))));
  const sail = !fly && (SAILING.test(n) || (!drive && parts.some((p) => /hull|^sail$|^mast$/.test(lab(p)))));
  return { seat: at, rideKind: fly ? "fly" : sail ? "sail" : board ? "board" : drive && !parts.some((p) => /pedal/.test(lab(p))) ? "drive" : parts.some((p) => /pedal/.test(lab(p))) ? "pedal" : "sit", bars: steer ? top(steer) : bars ? top(bars) : null, ...(back ? { passenger: top(back) } : {}) };
}
export function validateProp(input, { request } = {}) {
  const errors = [], warnings = [];
  let r = input;
  if (typeof r === "string") { try { r = JSON.parse(r); } catch (_) { return { ok: false, recipe: null, errors: ["not JSON"], warnings }; } }
  if (!r || typeof r !== "object" || Array.isArray(r)) return { ok: false, recipe: null, errors: ["not an object"], warnings };
  if (r.recipe && typeof r.recipe === "object" && !r.parts) r = r.recipe;   // {plan, recipe} wrapper
  const name = String(r.name || request || "something").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, PROP_LIMITS.nameLength) || "something";
  let archetype = String(r.archetype || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!ARCHETYPES[archetype]) {
    const g = guessArchetype(`${archetype} ${name} ${request || ""}`);
    if (archetype) warnings.push(`unknown archetype "${r.archetype}", used ${g}`);
    archetype = g;
  }
  const A = ARCHETYPES[archetype];
  // a big launcher he has to lug about on his shoulder may be bigger than anything he holds in one hoof
  const heavy = archetype === "launcher" && (r.heavy === true || /\b(big|giant|huge|heavy|massive|enormous|bazooka)\b/i.test(name));
  const FIT = heavy ? 2.3 : A.fit || A.maxSize;   // what it is scaled down to: a hat's brim may be wider than the hat itself
  const rawParts = Array.isArray(r.parts) ? r.parts : [], MAXP = A.parts || PROP_LIMITS.parts;
  if (!rawParts.length) errors.push("no parts");
  if (rawParts.length > MAXP) warnings.push(`${rawParts.length} parts; kept the first ${MAXP}`);
  const parts = [];
  rawParts.slice(0, MAXP).forEach((q, i) => {
    if (!q || typeof q !== "object") { warnings.push(`part ${i + 1} is not an object; dropped`); return; }
    const fix = [];
    let shape = normShape(q.shape || q.type || q.kind || q.geometry);
    if (!shape) { warnings.push(`part ${i + 1}: unknown shape "${q.shape}", used sphere`); shape = "sphere"; }
    const material = normMaterial(q.material) || (q.material ? (warnings.push(`part ${i + 1}: unknown material "${q.material}", used plastic`), "plastic") : "plastic");
    let size = vec3(q.size ?? q.scale ?? q.dimensions, null, `part ${i + 1} size`, fix, true);
    if (!size) { warnings.push(`part ${i + 1}: no size, used 0.3`); size = [0.3, 0.3, 0.3]; }
    if (size.some((v) => v <= 0)) fix.push(`part ${i + 1}: size must be positive`);
    size = size.map((v) => clamp(Math.abs(v), 0.02, FIT));
    const at = vec3(q.at ?? q.position ?? q.pos ?? q.center ?? q.offset, [0, 0, 0], `part ${i + 1} at`, fix).map((v) => clamp(v, -FIT * 1.25, FIT * 1.25));
    let rotate = vec3(q.rotate ?? q.rotation ?? q.rot, [0, 0, 0], `part ${i + 1} rotate`, fix);
    rotate = rotate.map((d) => ((d % 360) + 540) % 360 - 180);
    const part = { shape, size: size.map(round3), at: at.map(round3), rotate: rotate.map((d) => Math.round(d)), color: normColor(q.color ?? q.colour, material), material };
    // a bendy tube: its points (written in the prop's coordinates) become a path inside its own box, so moving and
    // scaling the prop, and every check that uses boxes, just work. Without usable points it's a plain cylinder.
    if (shape === "tube") {
      const rawPts = Array.isArray(q.points) ? q.points.slice(0, 4).map((pt) => (Array.isArray(pt) && pt.length === 3 && pt.every((v) => isFinite(+v)) ? pt.map((v) => clamp(+v, -FIT * 1.25, FIT * 1.25)) : null)).filter(Boolean) : null;
      if (rawPts && rawPts.length >= 2) {
        const thick = clamp(num(q.thick ?? q.thickness ?? q.radius * 2, 0.06), 0.015, 0.4);
        const lo = [0, 1, 2].map((k) => Math.min(...rawPts.map((pt) => pt[k]))), hi = [0, 1, 2].map((k) => Math.max(...rawPts.map((pt) => pt[k])));
        part.at = lo.map((v, k) => round3((v + hi[k]) / 2)); part.size = lo.map((v, k) => round3(clamp(hi[k] - v + thick, thick, FIT)));
        part.path = rawPts.map((pt) => pt.map((v, k) => round3(clamp((v - part.at[k]) / part.size[k], -0.5, 0.5))));
        part.thick = round3(thick / Math.max(...part.size)); part.rotate = [0, 0, 0];
      } else if (Array.isArray(q.path) && q.path.length >= 2 && q.path.every((pt) => Array.isArray(pt) && pt.length === 3 && pt.every((v) => isFinite(+v)))) {   // already made (a resize, a theme)
        part.path = q.path.slice(0, 4).map((pt) => pt.map((v) => round3(clamp(+v, -0.5, 0.5)))); part.thick = round3(clamp(num(q.thick, 0.1), 0.01, 1));
      } else { part.shape = "cylinder"; warnings.push(`part ${i + 1}: a tube with no points; made it a straight one`); }
    }
    if (shape === "torus") part.arc = clamp(Math.round(num(q.arc, 360)), 1, 360);
    if (shape === "box") part.round = clamp(num(q.round, 0.15), 0, 0.5);
    if (part.shape === "cylinder") { part.taper = clamp(num(q.taper, 1), 0, 2); if (q.hollow === true || q.hollow === "true" || q.open === true) part.hollow = true; }
    const pattern = material === "glass" ? null : normPattern(q.pattern);
    if (pattern) { part.pattern = pattern; part.pattern_color = patternColour(q.pattern_color ?? q.patternColor ?? q.pattern_colour, part.color, material); }
    else if (q.pattern && !/^(none|no|plain|solid)$/i.test(String(q.pattern)) && material !== "glass") warnings.push(`part ${i + 1}: unknown pattern "${q.pattern}"; left plain`);
    // A tube written lying down ([length, width, width] with no turn) reads as a squashed oval drum. Models do this for
    // barrels and handles; an oval cross-section is almost never meant, so stand the size up and turn it to lie along x (or z).
    if ((shape === "cylinder" || shape === "capsule") && rotate.every((d) => d === 0)) {
      const [w, h, d] = part.size;
      if (w >= 1.6 * d && w >= 1.6 * h) { part.size = [round3(h), round3(w), round3(d)]; part.rotate = [0, 0, 90]; warnings.push(`part ${i + 1}: a ${shape} lying along x; turned it on its side`); }
      else if (d >= 1.6 * w && d >= 1.6 * h) { part.size = [round3(w), round3(d), round3(h)]; part.rotate = [90, 0, 0]; warnings.push(`part ${i + 1}: a ${shape} lying along z; turned it to point at the viewer`); }
    }
    // A big full ring on a worn prop, centred on his head or body but standing up to face the viewer, would ring his face
    // like a picture frame. Straps, bands and rims go round him: lay it flat. (A squashed ring, [1.4, 0.3, 0.3], is a
    // rim seen from the front: it becomes a round rim with that thickness.)
    const S = STAND_IN[A.slot];
    if (S && shape === "torus" && part.arc >= 300 && rotate.every((d) => d === 0)) {
      const [w, h, d] = part.size, [x, y, z] = part.at;
      if (w >= 0.9 && Math.abs(x - S.c[0]) <= 0.25 && Math.abs(z - S.c[2]) <= 0.45 && Math.abs(y - S.c[1]) <= S.r[1]) {
        part.size = h >= 0.5 * w ? [w, h, d] : [w, round3(w * S.r[2] / S.r[0]), round3(Math.min(h, d))];
        part.rotate = [90, 0, 0];
        warnings.push(`part ${i + 1}: a ring standing in front of his ${A.slot}; laid it flat around him`);
      }
    }
    // Round plates that should face the viewer. A disc or cylinder written thin along z ([0.3, 0.3, 0.05]) is meant as a
    // coin, and would otherwise be a slab with a square outline; a badge, patch, lens or dial written as a flat disc lies
    // like a tray. Not on props held pointing forward, where "facing" is along the barrel.
    const label = String(q.label || q.id || q.name || "").toLowerCase();
    if ((shape === "disc" || (shape === "cylinder" && !part.hollow)) && rotate.every((d) => d === 0) && !/^(along|aim)$/.test(String(r.hold || A.hold || ""))) {
      const [w, h, d] = part.size;
      if (d < 0.4 * Math.min(w, h) && h <= 1.6 * w && w <= 1.6 * h) {
        part.shape = "coin"; delete part.taper;
        warnings.push(`part ${i + 1}: a thin round ${shape} standing up; made it a coin facing the viewer`);
      } else if (shape === "disc" && h < 0.5 * Math.min(w, d) && BADGE_WORDS.test(label)) {
        part.shape = "coin"; part.size = [w, d, h];
        warnings.push(`part ${i + 1}: a flat ${label.replace(/[_-]+/g, " ").trim()} turned to face the viewer`);
      }
    }
    if (q.label || q.id || q.name) part.label = String(q.label || q.id || q.name).slice(0, 24);
    if (typeof q.color === "string" && !/^#[0-9a-f]{3,6}$/i.test(q.color.trim())) fix.push(`part ${i + 1}: colour "${q.color}" read as ${part.color}`);
    warnings.push(...fix);
    parts.push(part);
  });
  const out = { name, archetype, parts };
  if (A.slot === "head" && parts.length) { liftSunkenShell(parts, warnings); unburyFaceGear(parts, warnings); layGlassesArms(parts, name, warnings); }
  if (A.slot === "body" && parts.length) unburyBodyGear(parts, name, warnings);
  if ((A.slot === "head" || A.slot === "body") && parts.length > 1) trimSticks(parts, A.maxSize, warnings);
  if (parts.length > 1) attachFloating(parts, warnings, STAND_IN[A.slot] || null);
  if (parts.length) {
    // keep it inside its size class: scale the whole prop down around the grip
    let b = propBounds(parts), big = Math.max(...b.size);
    if (big > FIT) {
      const k = FIT / big;
      for (const p of parts) { p.size = p.size.map((v) => round3(v * k)); p.at = p.at.map((v) => round3(v * k)); }
      warnings.push(`${round3(big)} wide; scaled to fit ${FIT}`);
      b = propBounds(parts);
    }
    if (big < 0.12) warnings.push(`only ${round3(big)} across; it will look like a speck`);
    if ((A.slot === "beside" || A.slot === "ride") && Math.abs(b.lo[1]) > 0.02) {   // stand on the ground
      for (const p of parts) p.at[1] = round3(p.at[1] - b.lo[1]);
      warnings.push(`moved to stand on the ground (lowest point was ${round3(b.lo[1])})`);
    }
    if (A.slot === "hand") {
      const near = parts.some((p) => { const pb = partBounds(p); return pb.lo.every((v, i) => v <= 0.18) && pb.hi.every((v, i) => v >= -0.18); });
      if (!near) warnings.push("nothing reaches the grip point at [0,0,0]; his hoof will hold empty air");
    }
    if (archetype === "handheld_canopy" && b.hi[1] < 0.5) warnings.push("nothing is held up high; a canopy prop should rise above the hoof");
    if (A.slot === "head" && b.hi[1] < -1.15) warnings.push("everything sits below his chin");   // glasses at -0.6 are fine
  }
  if (archetype === "ride" && parts.length) Object.assign(out, rideInfo(parts, name));
  if (archetype === "throwable") {   // what it bursts into when it lands
    const fallback = /water|balloon/.test(name.toLowerCase()) ? "water" : /snow/.test(name.toLowerCase()) ? "snow" : /glitter/.test(name.toLowerCase()) ? "glitter" : /confetti|party|grenade|bomb/.test(name.toLowerCase()) ? "confetti" : "stars";
    let ammo = String(r.ammo || fallback).toLowerCase().trim();
    if (UNSAFE_AMMO.test(ammo) && !AMMO.includes(ammo) && !AMMO_ALIASES[ammo]) ammo = "confetti";
    out.ammo = AMMO.includes(ammo) ? ammo : AMMO_ALIASES[ammo] || fallback;
  }
  if (heavy) out.heavy = true;
  if (archetype === "launcher") {
    let ammo = String(r.ammo || "confetti").toLowerCase().trim();
    // the listed kinds are all harmless (starbursts are little confetti rockets that pop into stars); anything else
    // that sounds like real ammunition becomes confetti
    if (UNSAFE_AMMO.test(ammo) && !AMMO.includes(ammo) && !AMMO_ALIASES[ammo]) { warnings.push(`ammo "${r.ammo}" made safe: confetti`); ammo = "confetti"; }
    ammo = AMMO.includes(ammo) ? ammo : AMMO_ALIASES[ammo] || (warnings.push(`unknown ammo "${r.ammo}", used confetti`), "confetti");
    out.ammo = ammo;
    let muzzle = vec3(r.muzzle, null, "muzzle", warnings);
    if (!muzzle && parts.length) {   // the right-most point of the parts, at its middle height
      const b = propBounds(parts); muzzle = [b.hi[0], (b.lo[1] + b.hi[1]) / 2, 0];
      warnings.push("no muzzle; used the right-hand end");
    }
    if (muzzle) out.muzzle = muzzle.map((v) => round3(clamp(v, -A.maxSize * 1.25, A.maxSize * 1.25)));
  }
  if (A.slot === "hand") {
    const hold = String(r.hold || A.hold).toLowerCase();
    out.hold = archetype === "throwable" ? "throw" : ["upright", "along", "aim", "guard"].includes(hold) ? hold : A.hold;
  }
  if (typeof r.origin === "string" && r.origin.trim()) out.origin = r.origin.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 120);
  return { ok: errors.length === 0, recipe: errors.length ? (parts.length ? out : null) : out, errors, warnings };
}

/* ------------------------------------------------------------------ moves */

// Channels a move may drive. Values are normalised; left and right are as you look at the screen.
export const CHANNELS = {
  "body.hop": { min: 0, max: 1, about: "jumps up; 1 is a big hop" },
  "body.sway": { min: -1, max: 1, about: "leans sideways; + leans to the screen's right" },
  "body.lean": { min: -1, max: 1, about: "leans forward toward you (a bow) at +, back at -" },
  "body.spin": { min: -2, max: 2, about: "turns around on the spot; 1 is one full turn. Must end on a whole number (0, 1, -1, 2)" },
  "head.nod": { min: -1, max: 1, about: "+ looks down (a nod or bow), - looks up" },
  "head.tilt": { min: -1, max: 1, about: "+ tilts the head toward the screen's right" },
  "head.turn": { min: -1, max: 1, about: "+ turns the face toward the screen's right" },
  "leftArm.raise": { min: -1, max: 1, about: "arm on the screen's left: 0 resting, 0.5 held forward, 1 straight up, -1 back" },
  "leftArm.spread": { min: -1, max: 1, about: "arm on the screen's left: 0 resting, 0.5 out to the side, 1 up beside the head, -1 across the tummy" },
  "rightArm.raise": { min: -1, max: 1, about: "arm on the screen's right: 0 resting, 0.5 held forward, 1 straight up, -1 back" },
  "rightArm.spread": { min: -1, max: 1, about: "arm on the screen's right: 0 resting, 0.5 out to the side, 1 up beside the head, -1 across the tummy" },
  "leftLeg.kick": { min: 0, max: 1, about: "kicks the foot on the screen's left up and out to the side" },
  "rightLeg.kick": { min: 0, max: 1, about: "kicks the foot on the screen's right up and out to the side" },
  "face.smile": { min: -1, max: 1, about: "+ smiles more, - frowns" },
  "face.eyes": { min: 0, max: 1, about: "happy closed eyes (^ ^)" },
  "face.blush": { min: 0, max: 1, about: "blushes" },
  "face.mouth": { min: 0, max: 1, about: "opens the mouth (a cheer, a gasp)" },
  "face.ears": { min: -1, max: 1, about: "+ perks the ears up, - droops them" },
  "prop.spin": { min: -4, max: 4, about: "spins the held prop around its own stick; 1 is one turn. Must end on a whole number" },
  "prop.tilt": { min: -1, max: 1, about: "tips the held prop toward the screen's right" },
};
export const CHANNEL_NAMES = Object.keys(CHANNELS);
const WHOLE_TURNS = new Set(["body.spin", "prop.spin"]);
// faces and states only Mochi's feelings may show: a move can't fake a sulk, a shock or being carried
const RESERVED = /shock|puff|sulk|angry|turnaway|held|carry|yank|bed|sleep|tear|cry|sweat|phone|pad|glasses/;
export const MOVE_EVENTS = { pop: "the held launcher fires (launcher props only)", open: "opens the held canopy", close: "closes the held canopy", sparkle: "a burst of stars", hearts: "a few floating hearts" };
export const MOVE_LIMITS = { tracks: 12, keys: 12, duration: 4, minDuration: 0.4 };

const CHANNEL_ALIASES = (() => {
  const a = {};
  for (const side of ["left", "right"]) {
    const S = side[0], C = side[0].toUpperCase() + side.slice(1);
    for (const [part, acts] of [["Arm", ["raise", "spread"]], ["Leg", ["kick"]]]) for (const act of acts) {
      const canon = `${side}${part}.${act}`;
      for (const k of [`${side}_${part.toLowerCase()}.${act}`, `${part.toLowerCase()}${C}.${act}`, `${part.toLowerCase()}${S.toUpperCase()}.${act}`, `${part.toLowerCase()}_${side}.${act}`,
        `${side}${part}_${act}`, `${side}_${part.toLowerCase()}_${act}`, `${part.toLowerCase()}.${side}.${act}`, `${S}${part}.${act}`, `${S.toLowerCase()}${part.toLowerCase()}.${act}`]) a[k.toLowerCase()] = canon;
    }
  }
  Object.assign(a, { "body.jump": "body.hop", hop: "body.hop", jump: "body.hop", "body.bounce": "body.hop", "body.tilt": "body.sway", sway: "body.sway", lean: "body.lean", bow: "body.lean",
    "body.turn": "body.spin", "body.rotate": "body.spin", spin: "body.spin", twirl: "body.spin", nod: "head.nod", "head.pitch": "head.nod", tilt: "head.tilt", "head.roll": "head.tilt",
    "head.yaw": "head.turn", "head.shake": "head.turn", smile: "face.smile", eyes: "face.eyes", "face.happyeyes": "face.eyes", "face.happy": "face.eyes", blush: "face.blush",
    mouth: "face.mouth", "face.mouthopen": "face.mouth", ears: "face.ears", "face.ear": "face.ears", "prop.twirl": "prop.spin", "prop.rotate": "prop.spin" });
  return a;
})();
function normChannel(c) {
  const k = String(c || "").trim();
  if (CHANNELS[k]) return k;
  const low = k.toLowerCase().replace(/\s+/g, "");
  const exact = CHANNEL_NAMES.find((n) => n.toLowerCase() === low);
  return exact || CHANNEL_ALIASES[low] || null;
}

/** Check and repair a move recipe. Never throws. Returns { ok, recipe, errors, warnings }. */
export function validateMove(input, { request } = {}) {
  const errors = [], warnings = [];
  let r = input;
  if (typeof r === "string") { try { r = JSON.parse(r); } catch (_) { return { ok: false, recipe: null, errors: ["not JSON"], warnings }; } }
  if (!r || typeof r !== "object" || Array.isArray(r)) return { ok: false, recipe: null, errors: ["not an object"], warnings };
  if (r.recipe && typeof r.recipe === "object" && !r.tracks) r = r.recipe;
  const name = String(r.name || request || "a move").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 40) || "a move";
  // tracks: {channel: [[t, v], ...]} or [{channel|ch, keys}]
  let raw = r.tracks;
  if (Array.isArray(raw)) { const o = {}; for (const tr of raw) if (tr && (tr.channel || tr.ch)) o[tr.channel || tr.ch] = tr.keys || tr.keyframes || tr.values; raw = o; }
  if (!raw || typeof raw !== "object") { errors.push("no tracks"); raw = {}; }
  let duration = num(r.duration, NaN);
  const tracks = {};
  for (const [ch0, keys0] of Object.entries(raw)) {
    if (RESERVED.test(String(ch0).toLowerCase())) { warnings.push(`"${ch0}" is reserved for his feelings; dropped`); continue; }
    const ch = normChannel(ch0);
    if (!ch) { warnings.push(`unknown channel "${ch0}"; dropped`); continue; }
    if (tracks[ch]) { warnings.push(`"${ch0}" repeats ${ch}; kept the first`); continue; }
    if (!Array.isArray(keys0)) { warnings.push(`${ch}: keys are not a list; dropped`); continue; }
    let keys = keys0.map((k) => Array.isArray(k) ? [num(k[0], NaN), num(k[1], NaN)] : k && typeof k === "object" ? [num(k.t ?? k.time, NaN), num(k.v ?? k.value, NaN)] : [NaN, NaN])
      .filter(([t, v]) => Number.isFinite(t) && Number.isFinite(v));
    if (!keys.length) { warnings.push(`${ch}: no usable keys; dropped`); continue; }
    tracks[ch] = keys;
  }
  const names = Object.keys(tracks);
  if (names.length > MOVE_LIMITS.tracks) { warnings.push(`${names.length} tracks; kept ${MOVE_LIMITS.tracks}`); for (const n of names.slice(MOVE_LIMITS.tracks)) delete tracks[n]; }
  const lastKey = Math.max(0, ...Object.values(tracks).flat().map((k) => k[0]));
  if (!Number.isFinite(duration)) duration = lastKey + 0.2;
  if (lastKey > duration + 0.01) duration = lastKey;
  if (duration > MOVE_LIMITS.duration) {   // squeeze into 4 s rather than cut it off
    const k = MOVE_LIMITS.duration / duration;
    for (const keys of Object.values(tracks)) for (const key of keys) key[0] *= k;
    warnings.push(`${round3(duration)} s long; squeezed to ${MOVE_LIMITS.duration} s`);
    duration = MOVE_LIMITS.duration;
  }
  duration = clamp(duration, MOVE_LIMITS.minDuration, MOVE_LIMITS.duration);
  for (const [ch, keys0] of Object.entries(tracks)) {
    const C = CHANNELS[ch];
    let keys = keys0.map(([t, v]) => [clamp(t, 0, duration), clamp(v, C.min, C.max)]).sort((a, b) => a[0] - b[0]);
    keys = keys.filter((k, i) => i === 0 || k[0] - keys[i - 1][0] > 0.02);   // same instant twice: keep the first
    // start and end at rest (a whole number of turns for spins), so moves chain and never leave him twisted
    if (keys[0][0] > 0.05) keys.unshift([0, 0]); else if (keys[0][1] !== 0) { warnings.push(`${ch}: started at ${keys[0][1]}; starts at rest now`); keys[0] = [0, 0]; }
    const end = WHOLE_TURNS.has(ch) ? Math.round(keys[keys.length - 1][1]) : 0;
    if (WHOLE_TURNS.has(ch) && keys[keys.length - 1][1] !== end) warnings.push(`${ch}: ended at ${keys[keys.length - 1][1]} turns; rounded to ${end}`);
    const lk = keys[keys.length - 1];
    if (lk[0] < duration - 0.05) keys.push([duration, end]);
    else if (lk[1] !== end) { if (!WHOLE_TURNS.has(ch)) warnings.push(`${ch}: ended at ${lk[1]}; ends at rest now`); keys[keys.length - 1] = [duration, end]; }
    if (keys.length > MOVE_LIMITS.keys) { keys = simplifyTrack(keys, MOVE_LIMITS.keys); warnings.push(`${ch}: simplified to ${MOVE_LIMITS.keys} keys`); }
    // nothing faster than the whole range in about a sixth of a second: a snap reads as a glitch, not a move
    const vmax = (C.max - C.min) / 0.16, n = keys.length;
    let fast = false;
    for (let i = 1; i < n; i++) {
      const dt = keys[i][0] - keys[i - 1][0], dv = keys[i][1] - keys[i - 1][1];
      if (Math.abs(dv) <= vmax * dt + 1e-9) continue;
      fast = true;
      if (i < n - 1) keys[i] = [keys[i][0], keys[i - 1][1] + Math.sign(dv) * vmax * dt];
      else keys[i - 1] = [keys[i - 1][0], keys[i][1] - Math.sign(dv) * vmax * dt];   // the last key is the rest pose: ease the one before it
    }
    if (fast) warnings.push(`${ch}: too fast in places; softened`);
    tracks[ch] = keys.map(([t, v]) => [round3(t), round3(v)]);
  }
  const moving = Object.values(tracks).some((keys) => keys.some(([, v]) => Math.abs(v) >= 0.15));
  if (!Object.keys(tracks).length) errors.push("no usable tracks");
  else if (!moving) errors.push("nothing moves more than a twitch");
  const out = { name, duration: round3(duration), tracks };
  if (r.stand === true) out.stand = true;   // taught standing up: he stands for it
  const prop = String(r.prop || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (prop && prop !== "null" && prop !== "none") { if (ARCHETYPES[prop] && ARCHETYPES[prop].slot === "hand") out.prop = prop; else warnings.push(`prop "${r.prop}" can't be held in a move; ignored`); }
  const events = [];
  for (const e of Array.isArray(r.events) ? r.events : []) {
    const t = num(Array.isArray(e) ? e[0] : e && (e.t ?? e.time), NaN), what = String(Array.isArray(e) ? e[1] : e && (e.do || e.event || e.name) || "").toLowerCase();
    if (!Number.isFinite(t) || !MOVE_EVENTS[what]) { warnings.push(`event ${JSON.stringify(e)} not understood; dropped`); continue; }
    if (what === "pop" && out.prop !== "launcher") { warnings.push("pop needs a launcher prop; dropped"); continue; }
    if ((what === "open" || what === "close") && out.prop !== "handheld_canopy") { warnings.push(`${what} needs a canopy prop; dropped`); continue; }
    events.push([round3(clamp(t, 0, duration)), what]);
  }
  if (events.length) out.events = events.sort((a, b) => a[0] - b[0]).slice(0, 8);
  if (!out.prop && Object.keys(tracks).some((c) => c.startsWith("prop."))) warnings.push("prop channels without a prop do nothing");
  return { ok: errors.length === 0, recipe: errors.length ? null : out, errors, warnings };
}

/** Ramer-Douglas-Peucker on [t, v] keys down to at most maxKeys (time weighted like value). */
export function simplifyTrack(keys, maxKeys = MOVE_LIMITS.keys) {
  if (keys.length <= maxKeys) return keys.slice();
  const keep = new Set([0, keys.length - 1]);
  while (keep.size < maxKeys) {
    const idx = [...keep].sort((a, b) => a - b);
    let best = -1, bestD = -1;
    for (let s = 0; s < idx.length - 1; s++) {
      const a = keys[idx[s]], b = keys[idx[s + 1]];
      for (let i = idx[s] + 1; i < idx[s + 1]; i++) {
        const u = (keys[i][0] - a[0]) / Math.max(1e-6, b[0] - a[0]), d = Math.abs(keys[i][1] - (a[1] + (b[1] - a[1]) * u));
        if (d > bestD) { bestD = d; best = i; }
      }
    }
    if (best < 0) break;
    keep.add(best);
  }
  return [...keep].sort((a, b) => a - b).map((i) => keys[i]);
}

// Smooth, never-overshooting interpolation through the keys: a monotone cubic (PCHIP) with time-aware tangents. The
// velocity is continuous everywhere (no kinks at keys, even when keys are unevenly spaced), peaks and holds land
// exactly on their keys, and the first and last keys have zero velocity, so every move eases in and out of rest.
const TANGENTS = new WeakMap();
function tangents(keys) {
  let m = TANGENTS.get(keys);
  if (m) return m;
  const n = keys.length, h = [], d = [];
  m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) { h[i] = Math.max(1e-6, keys[i + 1][0] - keys[i][0]); d[i] = (keys[i + 1][1] - keys[i][1]) / h[i]; }
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) continue;   // a peak, a dip or a hold: stop there for an instant
    const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1];
    m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
  }
  TANGENTS.set(keys, m);
  return m;
}
export function sampleKeys(keys, t) {
  const n = keys.length;
  if (t <= keys[0][0]) return keys[0][1];
  if (t >= keys[n - 1][0]) return keys[n - 1][1];
  let i = 0; while (i < n - 2 && t > keys[i + 1][0]) i++;
  const m = tangents(keys), [t1, v1] = keys[i], [t2, v2] = keys[i + 1], h = Math.max(1e-6, t2 - t1);
  const u = (t - t1) / h, u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * v1 + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * v2 + (u3 - u2) * h * m[i + 1];
}
// a little seeded, slow noise, so a new move looks like a careful first try and settles as it's practised
function wobble(seed, ch, t) {
  let h = 2166136261; for (const c of seed + ch) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const p1 = ((h >>> 0) % 1000) / 1000 * 6.28, p2 = ((h >>> 10) % 1000) / 1000 * 6.28;
  return Math.sin(t * 4.1 + p1) * 0.65 + Math.sin(t * 7.3 + p2) * 0.35;
}
const ease = (x) => { const u = Math.max(0, Math.min(1, x)); return u * u * (3 - 2 * u); };
/** Values of every track at time t (seconds). skill 0 (first try, wobbly) .. 1 (smooth).
 * The wobble and the uneven rhythm both vanish at the start and the end, so a move always begins and ends at rest. */
export function sampleMove(recipe, t, { skill = 1, seed = "" } = {}) {
  const out = {}, rough = Math.max(0, Math.min(1, 1 - skill)), d = Math.max(0.01, recipe.duration || 1);
  const tt = Math.max(0, Math.min(d, t + rough * 0.035 * d * Math.sin((2 * Math.PI * t) / d)));   // a slightly uneven rhythm at first
  const edge = ease(t / 0.3) * ease((d - t) / 0.3);
  for (const [ch, keys] of Object.entries(recipe.tracks || {})) {
    const C = CHANNELS[ch]; if (!C) continue;
    let v = sampleKeys(keys, tt);
    if (rough > 0 && !WHOLE_TURNS.has(ch)) v += wobble(seed, ch, t) * rough * 0.13 * (C.max - C.min) * 0.5 * edge;
    out[ch] = Math.max(C.min, Math.min(C.max, v));
  }
  return out;
}

/* ------------------------------------------------------------------ Zero Day look */
// The same prop re-skinned for Zero Day mode: its body keeps its own colour, deeper and a little cooler (a satin
// finish, not metal), the small details glow in the neon palette, glass turns smoky. Every prop then belongs to the
// same cyber set while keeping its shape and still reading as itself. Pure function: the stored recipe never changes.
// Nov 7 (Binoy: "in the zero day mode some of the props look too black and so can't be seen"): bodies used to be
// near-black gunmetal (about 8% light, as metal under Zero Day's dim lights), so a cupcake, a guitar or a book
// vanished against the night and his dark fleece. Now never below 30% light; the stage also lights them a little
// from inside (stagecraft.js build).
// Zero Day (the hacker look): phosphor green, terminal cyan, amber, and magenta for the hot bits
export const NEON = { green: "#39ff7a", cyan: "#2fd8ff", amber: "#ffcf5c", magenta: "#ff2bd6" };
function hexToRgb(h) { const n = parseInt(String(h).replace("#", "").padEnd(6, "0").slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbToHex([r, g, b]) { return "#" + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0")).join(""); }
function hslOf(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}
function hslHex(h, s, l) {
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return rgbToHex([f(0), f(8), f(4)].map((v) => v * 255));
}
const mixHex = (a, b, u) => { const A = hexToRgb(a), B = hexToRgb(b); return rgbToHex(A.map((v, i) => v + (B[i] - v) * u)); };
export function neonFor(hex) {
  const [h, s, l] = hslOf(hex);
  if (s < 0.18) return l > 0.55 ? NEON.green : NEON.cyan;
  if (h < 40 || h >= 285) return NEON.magenta;
  if (h < 75) return NEON.amber;
  if (h < 170) return NEON.green;
  return NEON.cyan;
}
const ZD_KEEP = new Set(["fluffy", "cloth", "rubber", "paper", "wood", "candy"]);
/** a body's colour in Zero Day: its own hue, a little cooler and deeper, never dark enough to vanish (30–52% light);
 * greys, whites and blacks become a cool slate, lighter for white things */
export function zdBody(hex) {
  const [h, s, l] = hslOf(hex), rgb = hexToRgb(hex), chroma = (Math.max(...rgb) - Math.min(...rgb)) / 255;
  if (chroma < 0.12) return hslHex(160, 0.1, Math.min(0.52, Math.max(0.3, 0.28 + 0.26 * l)));   // (by how coloured it looks: cream is near-white)
  return hslHex(h, Math.min(0.75, Math.max(0.25, chroma * 1.4)), Math.min(0.5, Math.max(0.3, 0.2 + 0.36 * l)));
}
export function themeRecipe(recipe, theme) {
  if (!recipe || theme !== "zeroday" || !Array.isArray(recipe.parts)) return recipe;
  const vol = (p) => p.size[0] * p.size[1] * p.size[2], max = Math.max(1e-9, ...recipe.parts.map(vol));
  const parts = recipe.parts.map((p) => {
    const neon = neonFor(p.color), [, sat, light] = hslOf(p.color);
    if (p.material === "glass") return { ...p, color: mixHex("#0f1f18", neon, 0.45) };
    // glowing: what already glowed, and small bright or vivid details (lights, buttons, stars, tips)
    if (p.material === "glow" || (vol(p) < 0.015 * max && (sat > 0.45 || light > 0.62))) return { ...p, color: neon, material: "glow" };
    return { ...p, color: zdBody(p.color), material: ZD_KEEP.has(p.material) ? p.material : "plastic", ...(p.pattern ? { pattern_color: neonFor(p.pattern_color || neon) } : {}) };   // the body (a pattern in neon)
  });
  return { ...recipe, parts, theme: "zeroday" };
}

// "It's too big": the same prop k times the size, around its grip (or the ground it stands on), then checked again so
// it stays inside its size class. { ok, recipe, k } where k is the factor it really got (a big one can't grow past its class).
export function resizeRecipe(recipe, k) {
  if (!recipe || !Array.isArray(recipe.parts) || !recipe.parts.length || !(k > 0)) return { ok: false, recipe, k: 1 };
  const before = Math.max(...propBounds(recipe.parts).size);
  const scaled = { ...recipe, parts: recipe.parts.map((p) => ({ ...p, size: p.size.map((v) => round3(v * k)), at: p.at.map((v) => round3(v * k)) })) };
  if (Array.isArray(recipe.muzzle)) scaled.muzzle = recipe.muzzle.map((v) => round3(v * k));
  const v = validateProp(scaled, { request: recipe.name });
  if (!v.recipe) return { ok: false, recipe, k: 1 };
  const out = { ...recipe, ...v.recipe, name: recipe.name, archetype: recipe.archetype };
  const after = Math.max(...propBounds(out.parts).size);
  return { ok: true, recipe: out, k: before > 0 ? round3(after / before) : k };
}
// The same prop turned by hand (Nov 3: "the props… rotated and moved by the user if needed"): every part goes round
// the grip (a held thing), or round its middle on the ground (a thing that stands beside him), and turns with it.
// axis "x" | "y" | "z", deg in degrees. Checked again after, so it still fits its size class and stands on the ground.
// { ok, recipe }. Rides keep pointing the way they roll, and a launcher can only roll about its barrel (its aim
// depends on the barrel pointing along x).
export function rotateRecipe(recipe, axis, deg) {
  if (!recipe || !Array.isArray(recipe.parts) || !recipe.parts.length || !["x", "y", "z"].includes(axis) || !isFinite(+deg)) return { ok: false, recipe };
  const A = ARCHETYPES[recipe.archetype] || {};
  if (A.slot === "ride" || (recipe.archetype === "launcher" && axis !== "x")) return { ok: false, recipe };
  const a = (+deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const G = axis === "x" ? [[1, 0, 0], [0, c, -s], [0, s, c]] : axis === "y" ? [[c, 0, s], [0, 1, 0], [-s, 0, c]] : [[c, -s, 0], [s, c, 0], [0, 0, 1]];
  const mul = (M, v) => [0, 1, 2].map((i) => M[i][0] * v[0] + M[i][1] * v[1] + M[i][2] * v[2]);
  const b = propBounds(recipe.parts), ground = A.slot === "beside";
  const pivot = ground ? [(b.lo[0] + b.hi[0]) / 2, 0, (b.lo[2] + b.hi[2]) / 2] : [0, 0, 0];
  const turnPoint = (p) => { const q = mul(G, [p[0] - pivot[0], p[1] - pivot[1], p[2] - pivot[2]]); return [q[0] + pivot[0], q[1] + pivot[1], q[2] + pivot[2]]; };
  const parts = recipe.parts.map((p) => {
    // the part's own turn as a matrix (columns: where its axes point), turned again by G, back to degrees (XYZ)
    const r = p.rotate || [0, 0, 0], cols = [rot([1, 0, 0], r), rot([0, 1, 0], r), rot([0, 0, 1], r)].map((v) => mul(G, v));
    const m = (i, j) => cols[j][i];   // row i, column j
    const ry = Math.asin(Math.max(-1, Math.min(1, m(0, 2))));
    const rx = Math.abs(m(0, 2)) < 0.9999999 ? Math.atan2(-m(1, 2), m(2, 2)) : Math.atan2(m(2, 1), m(1, 1));
    const rz = Math.abs(m(0, 2)) < 0.9999999 ? Math.atan2(-m(0, 1), m(0, 0)) : 0;
    return { ...p, at: turnPoint(p.at).map(round3), rotate: [rx, ry, rz].map((v) => Math.round((v * 180) / Math.PI)) };
  });
  const turned = { ...recipe, parts };
  if (Array.isArray(recipe.muzzle)) turned.muzzle = turnPoint(recipe.muzzle).map(round3);
  const v = validateProp(turned, { request: recipe.name });
  if (!v.recipe) return { ok: false, recipe };
  return { ok: true, recipe: { ...recipe, ...v.recipe, name: recipe.name, archetype: recipe.archetype } };
}
/** Parts turned about a point (no validation): what rotateRecipe does to a recipe, for a piece borrowed into another
 * prop (Nov 7, server/crafter.js expandBorrowed). */
export function turnParts(parts, axis, deg, pivot = [0, 0, 0]) {
  if (!deg || !["x", "y", "z"].includes(axis)) return parts;
  const a = (+deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const G = axis === "x" ? [[1, 0, 0], [0, c, -s], [0, s, c]] : axis === "y" ? [[c, 0, s], [0, 1, 0], [-s, 0, c]] : [[c, -s, 0], [s, c, 0], [0, 0, 1]];
  const mul = (M, v) => [0, 1, 2].map((i) => M[i][0] * v[0] + M[i][1] * v[1] + M[i][2] * v[2]);
  return parts.map((p) => {
    const r = p.rotate || [0, 0, 0], cols = [rot([1, 0, 0], r), rot([0, 1, 0], r), rot([0, 0, 1], r)].map((v) => mul(G, v));
    const m = (i, j) => cols[j][i];
    const ry = Math.asin(Math.max(-1, Math.min(1, m(0, 2))));
    const rx = Math.abs(m(0, 2)) < 0.9999999 ? Math.atan2(-m(1, 2), m(2, 2)) : Math.atan2(m(2, 1), m(1, 1));
    const rz = Math.abs(m(0, 2)) < 0.9999999 ? Math.atan2(-m(0, 1), m(0, 0)) : 0;
    const q = mul(G, [p.at[0] - pivot[0], p.at[1] - pivot[1], p.at[2] - pivot[2]]);
    const out = { ...p, at: [q[0] + pivot[0], q[1] + pivot[1], q[2] + pivot[2]].map(round3), rotate: [rx, ry, rz].map((v) => Math.round((v * 180) / Math.PI)) };
    if (Array.isArray(p.path)) out.path = p.path;   // (a tube's path is inside its own box: it turns with the box)
    return out;
  });
}
// How much bigger or smaller they want it, from what they said: a factor, or null when it isn't about its size.
export function sizeChange(text) {
  const t = String(text || "").toLowerCase().replace(/[’`]/g, "'");
  if (/\b(half (the|its|as) (size|big)|half[- ]size(d)?)\b/.test(t)) return 0.5;
  if (/\b(twice as (big|large)|double (the |its )?size|two times (bigger|as big))\b/.test(t)) return 2;
  const lot = /\b(way|much|really|super|so|very|far|waaa*y|too too|a lot|lots)\b/.test(t), bit = /\b(a (little|tiny|wee) (bit )?|a bit|a tad|slightly|bit|little bit|just a)\b/.test(t);
  // the whole thing's size only: "too long" or "too thin" is about its shape (a remake), not a resize (Nov 3 review)
  if (/\btoo (big|large|huge|giant|massive|enormous)\b|\b(smaller|tinier|littler|shrink|less big|not so big|scale (it )?down|make it (small|tiny|little|mini))\b|\bit'?s (huge|massive|enormous|gigantic)\b/.test(t)) return lot ? 0.5 : bit ? 0.82 : 0.65;
  if (/\btoo (small|tiny|little)\b|\b(bigger|larger|huger|grow|enlarge|scale (it )?up|make it (big|huge|large))\b|\bit'?s (tiny|minuscule|so small)\b/.test(t)) return lot ? 1.8 : bit ? 1.2 : 1.45;
  return null;
}

/* ------------------------------------------------------------------ text for the crafting model */

export function propSpecText(archetype) {
  const A = ARCHETYPES[archetype];
  return [
    `Mochi is a small, round, fluffy cartoon sheep. ${"Units: sitting, he is about 2.2 tall; his head is about 1.25 wide; a hoof is about 0.2 wide."}`,
    `Coordinates: +x is the screen's right, +y is up, +z is toward the viewer. Angles are degrees.`,
    `This prop is a ${archetype.replace(/_/g, " ")}: ${A.about}.`,
    `Its origin [0, 0, 0] is ${A.origin}. It must fit in a box ${A.maxSize} across.${A.sizeNote ? ` ${A.sizeNote}` : ""}`,
    `Build it from 1 to ${A.parts || PROP_LIMITS.parts} parts. Each part: {"shape", "size": [w, h, d], "at": [x, y, z] (its centre), "rotate": [x, y, z] degrees, "color": "#rrggbb", "material"}.`,
    `Shapes: ${Object.entries(SHAPES).map(([k, v]) => `${k} (${v})`).join("; ")}.`,
    `Materials: ${Object.entries(MATERIALS).map(([k, v]) => `${k} (${v})`).join(", ")}.`,
    `Any part (not glass) can have a "pattern" in a second colour, "pattern_color": ${Object.entries(PATTERNS).map(([k, v]) => `${k} (${v})`).join("; ")}. Use one where the real thing has it; most parts stay plain.`,
    archetype === "launcher" ? `A launcher also needs "muzzle": [x, y, z] (the barrel's open end) and "ammo": one of ${AMMO.join(", ")}. It can only ever shoot those.` : "",
    MOVING_NOTE,
    `Style: chunky, rounded, toy-like and cute, in soft bright colours, like a plush or a candy-coloured toy. Exaggerate the one feature that makes it recognisable (an umbrella's wide canopy, a crown's points, a wand's star). Parts should touch or overlap so it reads as one object, not floating bits. No letters, words, logos or brand marks: a brand can only show through its colours.`,
    `Safety: everything is a soft, harmless toy. Weapons become toys: a gun is a water pistol or bubble blaster, a sword is a foam sword, a bomb or grenade is a confetti ball he can throw. Nothing sharp, scary or real-looking.`,
  ].filter(Boolean).join("\n");
}
export function moveSpecText() {
  return [
    `Mochi is a small, round, fluffy cartoon sheep sitting and facing you. A move is a short animation of him, at most ${MOVE_LIMITS.duration} seconds.`,
    `Write it as tracks: {"channel": [[time, value], ...]} with up to ${MOVE_LIMITS.tracks} channels and up to ${MOVE_LIMITS.keys} keys each. Every track starts at 0 at time 0 and ends at 0 (or a whole number of turns for spins) at the end.`,
    `Channels (left and right are as you look at the screen):`,
    ...Object.entries(CHANNELS).map(([k, c]) => `- ${k} (${c.min} to ${c.max}): ${c.about}`),
    `Optional "events": [[time, name]] with names: ${Object.entries(MOVE_EVENTS).map(([k, v]) => `${k} (${v})`).join("; ")}.`,
    `If the move needs him to hold something, set "prop" to its kind: handheld_tool, handheld_canopy or launcher. He holds it in the arm on the screen's right, so drive rightArm.* for it.`,
    `Good moves are clear and readable: big simple shapes, a little anticipation before the main action, and a hold of about a quarter second at the peak. Mirror arms for symmetric moves.`,
  ].join("\n");
}

/* ------------------------------------------------------------------ worked examples (also the starter library) */

// Nov 3 patterns for likely demo requests (build log "still open" 5): made in ~2 s instead of designed from scratch.
// Some go by more than one name ("soup", "a bowl of soup"): a pattern is found by its own last word.
const SOUP = [
  { shape: "dome", size: [0.52, 0.26, 0.52], at: [0, 0.14, 0], rotate: [180, 0, 0], color: "#f4efe6", material: "plastic", label: "bowl" },
  { shape: "torus", size: [0.52, 0.52, 0.035], at: [0, 0.14, 0], rotate: [90, 0, 0], color: "#e8735a", material: "plastic", label: "rim" },
  { shape: "disc", size: [0.46, 0.02, 0.46], at: [0, 0.125, 0], color: "#f0a33a", material: "candy", label: "soup" },
  { shape: "box", size: [0.06, 0.03, 0.06], at: [-0.1, 0.14, 0.06], color: "#7bc96f", material: "plastic", round: 0.3, label: "veggie" },
  { shape: "box", size: [0.05, 0.03, 0.05], at: [0.08, 0.14, -0.05], color: "#ff8a3d", material: "plastic", round: 0.3 },
  { shape: "box", size: [0.05, 0.03, 0.05], at: [0.02, 0.14, 0.12], color: "#7bc96f", material: "plastic", round: 0.3 },
  { shape: "cylinder", size: [0.03, 0.42, 0.03], at: [0.15, 0.27, 0.02], rotate: [0, 0, -32], color: "#c9ced6", material: "metal", label: "spoon" },
  { shape: "sphere", size: [0.09, 0.03, 0.07], at: [0.05, 0.12, 0.02], color: "#c9ced6", material: "metal" },
  { shape: "leaf", size: [0.07, 0.16, 0.01], at: [-0.08, 0.32, 0], color: "#ffffff", material: "glass", label: "steam" },
  { shape: "leaf", size: [0.06, 0.14, 0.01], at: [0.02, 0.38, 0], rotate: [0, 0, 15], color: "#ffffff", material: "glass" },
];
const TEA = [
  { shape: "disc", size: [0.44, 0.03, 0.44], at: [0, 0, 0], color: "#ffffff", material: "plastic", label: "saucer" },
  { shape: "cylinder", size: [0.3, 0.24, 0.3], at: [0, 0.13, 0], color: "#ffffff", material: "plastic", taper: 1.18, hollow: true, label: "cup" },
  { shape: "disc", size: [0.27, 0.02, 0.27], at: [0, 0.03, 0], color: "#ffffff", material: "plastic" },
  { shape: "disc", size: [0.3, 0.015, 0.3], at: [0, 0.21, 0], color: "#b56a2a", material: "candy", label: "tea" },
  { shape: "torus", size: [0.14, 0.15, 0.035], at: [0.19, 0.14, 0], color: "#ffffff", material: "plastic", label: "handle" },
  { shape: "heart", size: [0.08, 0.07, 0.015], at: [0, 0.12, 0.16], color: "#ff8fb8", material: "plastic", label: "heart" },
  { shape: "leaf", size: [0.06, 0.15, 0.01], at: [-0.04, 0.3, 0], color: "#ffffff", material: "glass", label: "steam" },
  { shape: "leaf", size: [0.05, 0.13, 0.01], at: [0, 0.38, 0], rotate: [0, 0, -15], color: "#ffffff", material: "glass" },
];
const ICE_CREAM = [
  { shape: "cone", size: [0.26, 0.44, 0.26], at: [0, 0.12, 0], rotate: [180, 0, 0], color: "#e3b071", material: "paper", label: "cone" },
  { shape: "sphere", size: [0.32, 0.28, 0.32], at: [0, 0.38, 0], color: "#ffc0d4", material: "candy", label: "strawberry scoop" },
  { shape: "sphere", size: [0.28, 0.26, 0.28], at: [0, 0.58, 0], color: "#fff3d6", material: "candy", label: "vanilla scoop" },
  { shape: "sphere", size: [0.09, 0.13, 0.06], at: [0.1, 0.29, 0.11], color: "#ffc0d4", material: "candy", label: "drip" },
  { shape: "sphere", size: [0.09, 0.09, 0.09], at: [0, 0.74, 0], color: "#e5484d", material: "candy", label: "cherry" },
  { shape: "box", size: [0.05, 0.015, 0.015], at: [-0.07, 0.64, 0.11], rotate: [0, 0, 30], color: "#5ec8ff", material: "candy", label: "sprinkle" },
  { shape: "box", size: [0.05, 0.015, 0.015], at: [0.06, 0.6, 0.12], rotate: [0, 0, -40], color: "#ffd34d", material: "candy" },
  { shape: "box", size: [0.05, 0.015, 0.015], at: [0.01, 0.68, 0.12], rotate: [0, 0, 80], color: "#7bc96f", material: "candy" },
];
export const PROP_EXAMPLES = {
  handheld_canopy: [{
    name: "little blue umbrella", archetype: "handheld_canopy", hold: "upright",
    parts: [
      { shape: "dome", size: [1.5, 0.55, 1.5], at: [0, 1.25, 0], color: "#8cc8ff", material: "cloth", label: "canopy" },
      { shape: "cylinder", size: [0.07, 0.12, 0.07], at: [0, 1.56, 0], color: "#ffffff", material: "plastic", taper: 0.6, label: "top" },
      { shape: "cylinder", size: [0.05, 1.3, 0.05], at: [0, 0.62, 0], color: "#f2f2f2", material: "metal", label: "shaft" },
      { shape: "torus", size: [0.28, 0.28, 0.06], at: [-0.12, -0.02, 0], rotate: [0, 0, 180], arc: 180, color: "#a8744a", material: "wood", label: "handle" },
      { shape: "sphere", size: [0.06, 0.06, 0.06], at: [0.75, 0.98, 0], color: "#ffffff", material: "plastic", label: "rib tip" },
      { shape: "sphere", size: [0.06, 0.06, 0.06], at: [-0.75, 0.98, 0], color: "#ffffff", material: "plastic" },
      { shape: "sphere", size: [0.06, 0.06, 0.06], at: [0, 0.98, 0.75], color: "#ffffff", material: "plastic" },
      { shape: "sphere", size: [0.06, 0.06, 0.06], at: [0, 0.98, -0.75], color: "#ffffff", material: "plastic" },
      { shape: "sphere", size: [0.06, 0.06, 0.06], at: [0.53, 0.98, 0.53], color: "#ffffff", material: "plastic" },
      { shape: "sphere", size: [0.06, 0.06, 0.06], at: [-0.53, 0.98, 0.53], color: "#ffffff", material: "plastic" },
      { shape: "sphere", size: [0.06, 0.06, 0.06], at: [0.53, 0.98, -0.53], color: "#ffffff", material: "plastic" },
      { shape: "sphere", size: [0.06, 0.06, 0.06], at: [-0.53, 0.98, -0.53], color: "#ffffff", material: "plastic" },
    ],
  }, {
    name: "red balloon", archetype: "handheld_canopy", hold: "upright",
    parts: [
      { shape: "sphere", size: [0.7, 0.85, 0.7], at: [0, 1.35, 0], color: "#e5484d", material: "plastic" },
      { shape: "cone", size: [0.12, 0.1, 0.12], at: [0, 0.9, 0], rotate: [180, 0, 0], color: "#e5484d", material: "plastic" },
      { shape: "cylinder", size: [0.015, 0.88, 0.015], at: [0, 0.42, 0], color: "#fbf8f2", material: "cloth" },
    ],
  }, {
    name: "kite", archetype: "handheld_canopy", hold: "upright",
    parts: [
      { shape: "box", size: [0.52, 0.52, 0.02], at: [0.18, 1.02, 0], rotate: [0, 0, 45], color: "#ff6f91", material: "cloth", round: 0.05, label: "sail" },
      { shape: "box", size: [0.26, 0.26, 0.022], at: [0.18, 1.2, 0.002], rotate: [0, 0, 45], color: "#ffd34d", material: "cloth", round: 0.05, label: "top panel" },
      { shape: "cylinder", size: [0.02, 0.74, 0.02], at: [0.18, 1.02, 0.02], color: "#8a6a48", material: "wood", label: "spar" },
      { shape: "cylinder", size: [0.02, 0.74, 0.02], at: [0.18, 1.02, 0.02], rotate: [0, 0, 90], color: "#8a6a48", material: "wood" },
      { shape: "cylinder", size: [0.01, 0.68, 0.01], at: [0.09, 0.34, 0], rotate: [0, 0, -15], color: "#fbf8f2", material: "cloth", label: "string" },
      { shape: "cylinder", size: [0.008, 0.4, 0.008], at: [0.26, 0.47, 0], rotate: [0, 0, 23], color: "#fbf8f2", material: "cloth", label: "tail" },
      { shape: "box", size: [0.09, 0.05, 0.01], at: [0.24, 0.56, 0], rotate: [0, 0, 20], color: "#5ec8ff", material: "cloth", round: 0.4, label: "tail bow" },
      { shape: "box", size: [0.09, 0.05, 0.01], at: [0.3, 0.44, 0], rotate: [0, 0, -15], color: "#7bc96f", material: "cloth", round: 0.4 },
      { shape: "box", size: [0.09, 0.05, 0.01], at: [0.33, 0.32, 0], rotate: [0, 0, 25], color: "#ffd34d", material: "cloth", round: 0.4 },
    ],
  }],
  head_wearable: [{
    name: "hat", archetype: "head_wearable",   // a plain sun hat (Nov 3: a doodled "hat" was built from scratch and looked like an earring)
    parts: [
      { shape: "cylinder", size: [0.74, 0.34, 0.74], at: [0, 0.2, 0], color: "#e9c97a", material: "cloth", taper: 0.86, round: 0.6, label: "crown" },
      { shape: "cylinder", size: [1.6, 0.04, 1.6], at: [0, 0.04, 0], color: "#e3bf6c", material: "cloth", round: 0.5, label: "brim" },
      { shape: "cylinder", size: [0.77, 0.09, 0.77], at: [0, 0.1, 0], color: "#ff8fb8", material: "cloth", label: "band" },
      { shape: "sphere", size: [0.14, 0.14, 0.08], at: [0.3, 0.14, 0.24], color: "#ffffff", material: "cloth", label: "flower" },
      { shape: "sphere", size: [0.06, 0.06, 0.04], at: [0.31, 0.14, 0.28], color: "#ffd34d", material: "cloth" },
    ],
  }, {
    name: "party hat", archetype: "head_wearable",
    parts: [
      { shape: "cone", size: [0.6, 0.8, 0.6], at: [0, 0.32, 0], color: "#ff8fb8", material: "paper" },
      { shape: "sphere", size: [0.2, 0.2, 0.2], at: [0, 0.76, 0], color: "#ffd34d", material: "fluffy" },
      { shape: "torus", size: [0.6, 0.6, 0.08], at: [0, -0.06, 0], rotate: [90, 0, 0], color: "#ffd34d", material: "fluffy" },
      { shape: "star", size: [0.16, 0.16, 0.04], at: [0, 0.3, 0.24], rotate: [-20, 0, 0], color: "#ffffff", material: "paper" },
    ],
  }, {
    name: "golden crown", archetype: "head_wearable",
    parts: [
      { shape: "cylinder", size: [0.8, 0.24, 0.8], at: [0, 0.13, 0], color: "#f2c14e", material: "metal", taper: 1.08, hollow: true, label: "band" },
      { shape: "torus", size: [0.84, 0.84, 0.05], at: [0, 0.02, 0], rotate: [90, 0, 0], color: "#e0a93a", material: "metal", label: "rim" },
      { shape: "cone", size: [0.17, 0.26, 0.17], at: [0, 0.37, 0.38], color: "#f2c14e", material: "metal", label: "point" },
      { shape: "cone", size: [0.17, 0.26, 0.17], at: [-0.36, 0.37, 0.13], color: "#f2c14e", material: "metal" },
      { shape: "cone", size: [0.17, 0.26, 0.17], at: [0.36, 0.37, 0.13], color: "#f2c14e", material: "metal" },
      { shape: "cone", size: [0.17, 0.26, 0.17], at: [-0.23, 0.37, -0.31], color: "#f2c14e", material: "metal" },
      { shape: "cone", size: [0.17, 0.26, 0.17], at: [0.23, 0.37, -0.31], color: "#f2c14e", material: "metal" },
      { shape: "sphere", size: [0.08, 0.08, 0.08], at: [0, 0.51, 0.38], color: "#fff1c2", material: "metal", label: "ball" },
      { shape: "sphere", size: [0.08, 0.08, 0.08], at: [-0.36, 0.51, 0.13], color: "#fff1c2", material: "metal" },
      { shape: "sphere", size: [0.08, 0.08, 0.08], at: [0.36, 0.51, 0.13], color: "#fff1c2", material: "metal" },
      { shape: "sphere", size: [0.08, 0.08, 0.08], at: [-0.23, 0.51, -0.31], color: "#fff1c2", material: "metal" },
      { shape: "sphere", size: [0.08, 0.08, 0.08], at: [0.23, 0.51, -0.31], color: "#fff1c2", material: "metal" },
      { shape: "sphere", size: [0.12, 0.12, 0.07], at: [0, 0.14, 0.43], color: "#e5484d", material: "glass", label: "gem" },
    ],
  }, {
    name: "round reading glasses", archetype: "head_wearable",
    parts: [
      { shape: "torus", size: [0.26, 0.26, 0.03], at: [-0.22, -0.52, 0.64], color: "#5b3a33", material: "plastic", label: "rim" },
      { shape: "torus", size: [0.26, 0.26, 0.03], at: [0.22, -0.52, 0.64], color: "#5b3a33", material: "plastic" },
      { shape: "torus", size: [0.18, 0.12, 0.025], at: [0, -0.48, 0.66], arc: 180, color: "#5b3a33", material: "plastic", label: "bridge" },
      { shape: "coin", size: [0.22, 0.22, 0.01], at: [-0.22, -0.52, 0.64], color: "#e4f3ff", material: "glass", label: "lens" },
      { shape: "coin", size: [0.22, 0.22, 0.01], at: [0.22, -0.52, 0.64], color: "#e4f3ff", material: "glass" },
    ],
  }, {
    name: "magenta headphones", archetype: "head_wearable",
    parts: [
      { shape: "torus", size: [1.3, 1.3, 0.08], at: [0, -0.5, 0], arc: 180, color: "#e20074", material: "plastic", label: "band" },
      { shape: "capsule", size: [0.1, 0.42, 0.1], at: [0, 0.14, 0], rotate: [0, 0, 90], color: "#2a2238", material: "rubber", label: "top pad" },
      { shape: "cylinder", size: [0.3, 0.12, 0.3], at: [-0.6, -0.52, 0], rotate: [0, 0, 90], color: "#e20074", material: "plastic", label: "ear cup" },
      { shape: "cylinder", size: [0.3, 0.12, 0.3], at: [0.6, -0.52, 0], rotate: [0, 0, 90], color: "#e20074", material: "plastic" },
      { shape: "torus", size: [0.2, 0.2, 0.03], at: [-0.665, -0.52, 0], rotate: [0, 90, 0], color: "#ff7ad9", material: "glow", label: "light ring" },
      { shape: "torus", size: [0.2, 0.2, 0.03], at: [0.665, -0.52, 0], rotate: [0, 90, 0], color: "#ff7ad9", material: "glow" },
    ],
  }, {
    name: "protective helmet", archetype: "head_wearable",
    parts: [
      { shape: "dome", size: [1.36, 0.6, 1.3], at: [0, -0.02, -0.02], color: "#2c3e66", material: "plastic", label: "shell" },
      { shape: "torus", size: [1.38, 1.32, 0.06], at: [0, -0.32, -0.02], rotate: [90, 0, 0], color: "#1d2a45", material: "rubber", label: "rim" },
      { shape: "disc", size: [0.78, 0.035, 0.3], at: [0, -0.3, 0.55], rotate: [-8, 0, 0], color: "#1d2a45", material: "plastic", label: "brim" },
      { shape: "star", size: [0.16, 0.16, 0.04], at: [0, 0.1, 0.46], rotate: [-42, 0, 0], color: "#f2c14e", material: "metal", label: "badge" },
      { shape: "dome", size: [0.16, 0.09, 0.16], at: [0, 0.31, -0.02], color: "#4da3ff", material: "glow", label: "light" },
      { shape: "disc", size: [0.14, 0.03, 0.14], at: [-0.66, -0.15, 0], rotate: [0, 0, 90], color: "#1d2a45", material: "rubber", label: "vent" },
      { shape: "disc", size: [0.14, 0.03, 0.14], at: [0.66, -0.15, 0], rotate: [0, 0, 90], color: "#1d2a45", material: "rubber" },
    ],
  }, {
    name: "night-vision goggles", archetype: "head_wearable",
    parts: [
      { shape: "torus", size: [1.32, 1.26, 0.05], at: [0, -0.45, -0.02], rotate: [90, 0, 0], color: "#3b4a2f", material: "cloth", label: "strap" },
      { shape: "cylinder", size: [0.17, 0.2, 0.17], at: [-0.2, -0.56, 0.62], rotate: [90, 0, 0], color: "#3b4a2f", material: "metal", label: "tube" },
      { shape: "cylinder", size: [0.17, 0.2, 0.17], at: [0.2, -0.56, 0.62], rotate: [90, 0, 0], color: "#3b4a2f", material: "metal" },
      { shape: "coin", size: [0.15, 0.15, 0.02], at: [-0.2, -0.56, 0.725], color: "#39ff88", material: "glow", label: "lens" },
      { shape: "coin", size: [0.15, 0.15, 0.02], at: [0.2, -0.56, 0.725], color: "#39ff88", material: "glow" },
      { shape: "box", size: [0.2, 0.09, 0.1], at: [0, -0.52, 0.6], color: "#2c3826", material: "plastic", round: 0.35, label: "bridge" },
      { shape: "box", size: [0.08, 0.34, 0.06], at: [0, -0.3, 0.56], rotate: [-18, 0, 0], color: "#2c3826", material: "plastic", round: 0.4, label: "mount arm" },
    ],
  }],
  handheld_tool: [{
    name: "star wand", archetype: "handheld_tool", hold: "upright",
    parts: [
      { shape: "cylinder", size: [0.06, 0.8, 0.06], at: [0, 0.3, 0], color: "#c9b3f2", material: "plastic" },
      { shape: "star", size: [0.42, 0.42, 0.1], at: [0, 0.82, 0], color: "#ffd34d", material: "glow" },
      { shape: "sphere", size: [0.1, 0.1, 0.1], at: [0, -0.12, 0], color: "#ff8fb8", material: "plastic" },
    ],
  }, {
    name: "magenta smartphone", archetype: "handheld_tool", hold: "upright",
    parts: [
      { shape: "box", size: [0.38, 0.66, 0.07], at: [0, 0.26, 0], color: "#e20074", material: "plastic", round: 0.32, label: "case" },
      { shape: "box", size: [0.31, 0.55, 0.012], at: [0, 0.275, 0.037], color: "#1b1530", material: "plastic", round: 0.25, label: "screen" },
      { shape: "box", size: [0.034, 0.05, 0.01], at: [-0.07, 0.265, 0.046], color: "#ffffff", material: "glow", round: 0.4, label: "signal bar" },
      { shape: "box", size: [0.034, 0.08, 0.01], at: [-0.025, 0.28, 0.046], color: "#ffffff", material: "glow", round: 0.4 },
      { shape: "box", size: [0.034, 0.11, 0.01], at: [0.02, 0.295, 0.046], color: "#ffffff", material: "glow", round: 0.4 },
      { shape: "box", size: [0.034, 0.14, 0.01], at: [0.065, 0.31, 0.046], color: "#ff8fd0", material: "glow", round: 0.4 },
      { shape: "capsule", size: [0.016, 0.1, 0.01], at: [0, 0.07, 0.046], rotate: [0, 0, 90], color: "#8a7aa8", material: "plastic", label: "home bar" },
      { shape: "capsule", size: [0.014, 0.08, 0.01], at: [0, 0.525, 0.044], rotate: [0, 0, 90], color: "#0e0b18", material: "plastic", label: "speaker" },
      { shape: "box", size: [0.02, 0.1, 0.03], at: [0.195, 0.38, 0], color: "#b8005e", material: "plastic", round: 0.4, label: "button" },
      { shape: "torus", size: [0.07, 0.07, 0.016], at: [-0.17, -0.07, 0], color: "#f2c14e", material: "metal", label: "charm ring" },
      { shape: "heart", size: [0.11, 0.1, 0.045], at: [-0.17, -0.15, 0.01], color: "#ff5fb0", material: "candy", label: "charm" },
    ],
  }, {
    name: "big gold coin", archetype: "handheld_tool", hold: "upright",
    parts: [
      { shape: "coin", size: [0.52, 0.52, 0.07], at: [0, 0.3, 0], color: "#f2c14e", material: "metal", label: "coin" },
      { shape: "torus", size: [0.5, 0.5, 0.045], at: [0, 0.3, 0.035], color: "#e0a93a", material: "metal", label: "rim" },
      { shape: "star", size: [0.22, 0.22, 0.05], at: [0, 0.3, 0.045], color: "#ffd86b", material: "metal", label: "emblem" },
      { shape: "star", size: [0.09, 0.09, 0.02], at: [0.2, 0.52, 0.06], color: "#ffffff", material: "glow", label: "sparkle" },
    ],
  }, {
    name: "toy shield", archetype: "handheld_tool", hold: "upright",
    parts: [
      { shape: "coin", size: [0.86, 0.86, 0.06], at: [0, 0.34, 0.12], color: "#9fd4ff", material: "glass", label: "clear face" },
      { shape: "torus", size: [0.88, 0.88, 0.06], at: [0, 0.34, 0.12], color: "#24314f", material: "rubber", label: "rim" },
      { shape: "dome", size: [0.26, 0.1, 0.26], at: [0, 0.34, 0.16], rotate: [90, 0, 0], color: "#c9ced6", material: "metal", label: "boss" },
      { shape: "star", size: [0.15, 0.15, 0.04], at: [0, 0.34, 0.22], color: "#ffd34d", material: "plastic" },
      { shape: "capsule", size: [0.07, 0.3, 0.07], at: [0, 0.06, 0.07], color: "#2b2f3a", material: "rubber", label: "handle" },
    ],
  }, {
    name: "riot shield", archetype: "handheld_tool", hold: "upright",
    parts: [
      { shape: "box", size: [0.76, 1.16, 0.05], at: [0, 0.42, 0.13], color: "#a9d6ff", material: "glass", round: 0.3, label: "clear panel" },
      { shape: "capsule", size: [0.07, 1.2, 0.07], at: [-0.38, 0.42, 0.13], color: "#1f2a44", material: "rubber", label: "edge" },
      { shape: "capsule", size: [0.07, 1.2, 0.07], at: [0.38, 0.42, 0.13], color: "#1f2a44", material: "rubber" },
      { shape: "capsule", size: [0.07, 0.8, 0.07], at: [0, 0.99, 0.13], rotate: [0, 0, 90], color: "#1f2a44", material: "rubber" },
      { shape: "capsule", size: [0.07, 0.8, 0.07], at: [0, -0.15, 0.13], rotate: [0, 0, 90], color: "#1f2a44", material: "rubber" },
      { shape: "box", size: [0.68, 0.13, 0.02], at: [0, 0.68, 0.165], color: "#24314f", material: "plastic", round: 0.4, label: "band" },
      { shape: "box", size: [0.68, 0.035, 0.02], at: [0, 0.59, 0.165], color: "#f4f7ff", material: "plastic", round: 0.4, label: "stripe" },
      { shape: "capsule", size: [0.07, 0.3, 0.07], at: [0, 0.06, 0.07], color: "#2b2f3a", material: "rubber", label: "handle" },
    ],
  }, {
    name: "walkie-talkie", archetype: "handheld_tool", hold: "upright",
    parts: [
      { shape: "box", size: [0.2, 0.36, 0.11], at: [0, 0.2, 0], color: "#2b2f3a", material: "plastic", round: 0.3, label: "body" },
      { shape: "cylinder", size: [0.035, 0.24, 0.035], at: [0.055, 0.5, 0], color: "#1c1f27", material: "rubber", label: "antenna" },
      { shape: "sphere", size: [0.05, 0.05, 0.05], at: [0.055, 0.625, 0], color: "#1c1f27", material: "rubber" },
      { shape: "box", size: [0.13, 0.06, 0.01], at: [0, 0.32, 0.058], color: "#7dffb0", material: "glow", round: 0.3, label: "display" },
      { shape: "capsule", size: [0.018, 0.12, 0.01], at: [0, 0.245, 0.058], rotate: [0, 0, 90], color: "#111318", material: "plastic", label: "grille" },
      { shape: "capsule", size: [0.018, 0.12, 0.01], at: [0, 0.21, 0.058], rotate: [0, 0, 90], color: "#111318", material: "plastic" },
      { shape: "capsule", size: [0.018, 0.12, 0.01], at: [0, 0.175, 0.058], rotate: [0, 0, 90], color: "#111318", material: "plastic" },
      { shape: "cylinder", size: [0.05, 0.05, 0.05], at: [-0.05, 0.405, 0], color: "#111318", material: "rubber", label: "knob" },
      { shape: "box", size: [0.03, 0.08, 0.04], at: [-0.105, 0.24, 0], color: "#ff9f43", material: "plastic", round: 0.4, label: "talk button" },
    ],
  }, {
    name: "flashlight", archetype: "handheld_tool", hold: "along",
    parts: [
      { shape: "cylinder", size: [0.1, 0.36, 0.1], at: [0, 0.12, 0], color: "#2a2f3a", material: "metal", label: "body" },
      { shape: "cylinder", size: [0.18, 0.14, 0.18], at: [0, 0.36, 0], color: "#2a2f3a", material: "metal", taper: 1.25, label: "head" },
      { shape: "disc", size: [0.19, 0.02, 0.19], at: [0, 0.435, 0], color: "#fff6c8", material: "glow", label: "lens" },
      { shape: "torus", size: [0.12, 0.12, 0.022], at: [0, 0.0, 0], rotate: [90, 0, 0], color: "#14161c", material: "rubber", label: "grip ring" },
      { shape: "torus", size: [0.12, 0.12, 0.022], at: [0, 0.07, 0], rotate: [90, 0, 0], color: "#14161c", material: "rubber" },
      { shape: "box", size: [0.035, 0.06, 0.035], at: [0, 0.2, 0.055], color: "#ff9f43", material: "plastic", round: 0.4, label: "button" },
    ],
  }, {
    name: "wooden ruler", archetype: "handheld_tool", hold: "upright",
    parts: [
      { shape: "box", size: [0.15, 1, 0.026], at: [0, 0.42, 0], color: "#e6bb78", material: "wood", round: 0.12, label: "ruler" },
      { shape: "box", size: [0.075, 0.014, 0.008], at: [-0.032, 0.02, 0.015], color: "#5a4030", material: "plastic", round: 0.3, label: "mark" },
      { shape: "box", size: [0.042, 0.014, 0.008], at: [-0.048, 0.105, 0.015], color: "#5a4030", material: "plastic", round: 0.3 },
      { shape: "box", size: [0.075, 0.014, 0.008], at: [-0.032, 0.19, 0.015], color: "#5a4030", material: "plastic", round: 0.3 },
      { shape: "box", size: [0.042, 0.014, 0.008], at: [-0.048, 0.275, 0.015], color: "#5a4030", material: "plastic", round: 0.3 },
      { shape: "box", size: [0.075, 0.014, 0.008], at: [-0.032, 0.36, 0.015], color: "#5a4030", material: "plastic", round: 0.3 },
      { shape: "box", size: [0.042, 0.014, 0.008], at: [-0.048, 0.445, 0.015], color: "#5a4030", material: "plastic", round: 0.3 },
      { shape: "box", size: [0.075, 0.014, 0.008], at: [-0.032, 0.53, 0.015], color: "#5a4030", material: "plastic", round: 0.3 },
      { shape: "box", size: [0.042, 0.014, 0.008], at: [-0.048, 0.615, 0.015], color: "#5a4030", material: "plastic", round: 0.3 },
      { shape: "box", size: [0.075, 0.014, 0.008], at: [-0.032, 0.7, 0.015], color: "#5a4030", material: "plastic", round: 0.3 },
      { shape: "box", size: [0.042, 0.014, 0.008], at: [-0.048, 0.785, 0.015], color: "#5a4030", material: "plastic", round: 0.3 },
      { shape: "box", size: [0.075, 0.014, 0.008], at: [-0.032, 0.87, 0.015], color: "#5a4030", material: "plastic", round: 0.3 },
      { shape: "coin", size: [0.045, 0.045, 0.03], at: [0.03, 0.86, 0.004], color: "#6b4d33", material: "rubber", label: "hole" },
    ],
  }, {
    name: "safety scissors", archetype: "handheld_tool", hold: "upright",
    parts: [
      { shape: "cone", size: [0.12, 0.58, 0.028], at: [0.058, 0.533, 0.012], rotate: [0, 0, -14], color: "#d3d8e0", material: "metal", label: "blade" },
      { shape: "cone", size: [0.12, 0.58, 0.028], at: [-0.058, 0.533, -0.012], rotate: [0, 0, 14], color: "#d3d8e0", material: "metal" },
      { shape: "capsule", size: [0.07, 0.25, 0.055], at: [-0.044, 0.21, -0.012], rotate: [0, 0, -26], color: "#ff7a2f", material: "plastic", label: "handle" },
      { shape: "torus", size: [0.19, 0.25, 0.06], at: [-0.132, 0.03, -0.012], rotate: [0, 0, -26], color: "#ff7a2f", material: "plastic", label: "finger loop" },
      { shape: "capsule", size: [0.07, 0.25, 0.055], at: [0.044, 0.21, 0.012], rotate: [0, 0, 26], color: "#ff7a2f", material: "plastic" },
      { shape: "torus", size: [0.19, 0.25, 0.06], at: [0.132, 0.03, 0.012], rotate: [0, 0, 26], color: "#ff7a2f", material: "plastic" },
      { shape: "coin", size: [0.075, 0.075, 0.07], at: [0, 0.3, 0], color: "#9aa3ad", material: "metal", label: "pivot screw" },
    ],
  }, {
    name: "desk globe", archetype: "handheld_tool", hold: "upright",
    parts: [
      { shape: "disc", size: [0.38, 0.06, 0.38], at: [0, -0.16, 0], color: "#6b4a32", material: "wood", label: "base" },
      { shape: "cylinder", size: [0.075, 0.32, 0.075], at: [0, 0, 0], color: "#d4a443", material: "metal", taper: 0.8, label: "stem" },
      { shape: "sphere", size: [0.56, 0.56, 0.56], at: [0.132, 0.471, 0], color: "#3f8fe0", material: "plastic", label: "ocean" },
      { shape: "torus", size: [0.71, 0.71, 0.035], at: [0.132, 0.471, 0], rotate: [0, 0, 67], color: "#d4a443", material: "metal", arc: 180, label: "meridian" },
      { shape: "cylinder", size: [0.02, 0.66, 0.02], at: [0.132, 0.471, 0], rotate: [0, 0, -23], color: "#d4a443", material: "metal", label: "axis" },
      { shape: "sphere", size: [0.25, 0.2, 0.05], at: [0.019, 0.572, 0.22], rotate: [-25, -25, 0], color: "#6cc070", material: "plastic", label: "land" },
      { shape: "sphere", size: [0.14, 0.18, 0.05], at: [0.052, 0.513, 0.251], rotate: [-10, -17, 0], color: "#6cc070", material: "plastic" },
      { shape: "sphere", size: [0.13, 0.22, 0.05], at: [0.1, 0.385, 0.251], rotate: [19, -7, 0], color: "#6cc070", material: "plastic" },
      { shape: "sphere", size: [0.09, 0.12, 0.05], at: [0.118, 0.323, 0.222], rotate: [34, -3, 0], color: "#6cc070", material: "plastic" },
      { shape: "sphere", size: [0.2, 0.15, 0.05], at: [0.238, 0.55, 0.231], rotate: [-19, 23, 0], color: "#6cc070", material: "plastic" },
      { shape: "sphere", size: [0.15, 0.22, 0.05], at: [0.26, 0.457, 0.234], rotate: [3, 29, 0], color: "#6cc070", material: "plastic" },
      { shape: "sphere", size: [0.17, 0.12, 0.05], at: [0.298, 0.583, 0.177], rotate: [-32, 38, 0], color: "#6cc070", material: "plastic" },
      { shape: "sphere", size: [0.22, 0.2, 0.05], at: [0.132, 0.717, 0.102], rotate: [-68, 0, 0], color: "#f4f8ff", material: "plastic", label: "ice cap" },
    ],
  }, {
    name: "folded map", archetype: "handheld_tool", hold: "upright",
    parts: [
      { shape: "box", size: [0.32, 0.52, 0.014], at: [-0.308, 0.28, 0], rotate: [0, 16, 0], color: "#f6efdc", material: "paper", round: 0.04, label: "paper panel" },
      { shape: "box", size: [0.32, 0.52, 0.014], at: [0, 0.28, 0], rotate: [0, -16, 0], color: "#f6efdc", material: "paper", round: 0.04 },
      { shape: "box", size: [0.32, 0.52, 0.014], at: [0.308, 0.28, 0], rotate: [0, 16, 0], color: "#f6efdc", material: "paper", round: 0.04 },
      { shape: "sphere", size: [0.2, 0.26, 0.01], at: [-0.324, 0.35, 0.017], rotate: [0, 16, 15], color: "#a9d89b", material: "paper", label: "land" },
      { shape: "sphere", size: [0.24, 0.15, 0.01], at: [0.016, 0.14, 0.017], rotate: [0, -16, 10], color: "#a9d89b", material: "paper" },
      { shape: "sphere", size: [0.19, 0.27, 0.01], at: [0.321, 0.32, 0.009], rotate: [0, 16, -12], color: "#a9d89b", material: "paper" },
      { shape: "sphere", size: [0.15, 0.1, 0.012], at: [-0.032, 0.41, 0.003], rotate: [0, -16, 0], color: "#8cc8f0", material: "paper", label: "lake" },
      { shape: "star", size: [0.07, 0.07, 0.01], at: [-0.4, 0.09, 0.039], rotate: [0, 16, 0], color: "#3d5a80", material: "plastic", label: "compass" },
      { shape: "capsule", size: [0.02, 0.065, 0.008], at: [-0.31, 0.143, 0.017], rotate: [0, 16, -45], color: "#e04848", material: "plastic", label: "route" },
      { shape: "capsule", size: [0.02, 0.065, 0.008], at: [-0.219, 0.229, -0.009], rotate: [0, 16, -52], color: "#e04848", material: "plastic" },
      { shape: "capsule", size: [0.02, 0.065, 0.008], at: [-0.125, 0.288, -0.019], rotate: [0, -16, -66], color: "#e04848", material: "plastic" },
      { shape: "capsule", size: [0.02, 0.065, 0.008], at: [-0.046, 0.314, 0.003], rotate: [0, -16, -83], color: "#e04848", material: "plastic" },
      { shape: "capsule", size: [0.02, 0.065, 0.008], at: [0.044, 0.317, 0.029], rotate: [0, -16, -92], color: "#e04848", material: "plastic" },
      { shape: "capsule", size: [0.02, 0.065, 0.008], at: [0.116, 0.316, 0.05], rotate: [0, -16, -86], color: "#e04848", material: "plastic" },
      { shape: "capsule", size: [0.02, 0.065, 0.008], at: [0.235, 0.334, 0.038], rotate: [0, 16, -70], color: "#e04848", material: "plastic" },
      { shape: "sphere", size: [0.07, 0.07, 0.07], at: [0.32, 0.403, 0.043], color: "#e53935", material: "plastic", label: "pin" },
    ],
  }, {
    name: "book", archetype: "handheld_tool", hold: "upright",
    parts: [
      { shape: "box", size: [0.5, 0.66, 0.035], at: [0, 0.3, 0.055], color: "#3f7fd6", material: "paper", round: 0.15, label: "front cover" },
      { shape: "box", size: [0.5, 0.66, 0.035], at: [0, 0.3, -0.055], color: "#3f7fd6", material: "paper", round: 0.15, label: "back cover" },
      { shape: "box", size: [0.46, 0.62, 0.08], at: [0.015, 0.3, 0], color: "#fbf6e9", material: "paper", round: 0.05, label: "pages" },
      { shape: "box", size: [0.06, 0.66, 0.145], at: [-0.24, 0.3, 0], color: "#2f63ad", material: "paper", round: 0.4, label: "spine" },
      { shape: "star", size: [0.2, 0.2, 0.02], at: [0.02, 0.33, 0.078], color: "#ffd34d", material: "paper", label: "star" },
      { shape: "box", size: [0.3, 0.05, 0.01], at: [0.02, 0.52, 0.076], color: "#ffd34d", material: "paper", round: 0.4, label: "title" },
    ],
  }, {
    name: "pencil", archetype: "handheld_tool", hold: "upright",
    parts: [
      { shape: "cylinder", size: [0.08, 0.7, 0.08], at: [0, 0.3, 0], color: "#ffcf3f", material: "wood", label: "body" },
      { shape: "cone", size: [0.08, 0.14, 0.08], at: [0, 0.72, 0], color: "#f2d2a9", material: "wood", label: "sharpened tip" },
      { shape: "cone", size: [0.03, 0.05, 0.03], at: [0, 0.775, 0], color: "#333333", material: "rubber", label: "lead" },
      { shape: "cylinder", size: [0.086, 0.06, 0.086], at: [0, -0.075, 0], color: "#c9ced6", material: "metal", label: "ferrule" },
      { shape: "capsule", size: [0.08, 0.1, 0.08], at: [0, -0.13, 0], color: "#ff8fb8", material: "rubber", label: "eraser" },
    ],
  }, {
    name: "paintbrush", archetype: "handheld_tool", hold: "upright",
    parts: [
      { shape: "cylinder", size: [0.06, 0.6, 0.06], at: [0, 0.2, 0], color: "#d9534f", material: "wood", taper: 0.8, label: "handle" },
      { shape: "cylinder", size: [0.07, 0.12, 0.07], at: [0, 0.56, 0], color: "#c9ced6", material: "metal", label: "ferrule" },
      { shape: "capsule", size: [0.09, 0.18, 0.06], at: [0, 0.69, 0], color: "#4a3426", material: "fluffy", label: "bristles" },
      { shape: "sphere", size: [0.075, 0.08, 0.055], at: [0, 0.78, 0], color: "#5ec8ff", material: "candy", label: "paint" },
    ],
  }, {
    name: "magnifying glass", archetype: "handheld_tool", hold: "upright",
    parts: [
      { shape: "coin", size: [0.4, 0.4, 0.03], at: [0, 0.62, 0], color: "#bfe3ff", material: "glass", label: "lens" },
      { shape: "torus", size: [0.46, 0.46, 0.05], at: [0, 0.62, 0], color: "#d4a443", material: "metal", label: "rim" },
      { shape: "cylinder", size: [0.05, 0.08, 0.05], at: [0, 0.37, 0], color: "#d4a443", material: "metal", label: "neck" },
      { shape: "cylinder", size: [0.075, 0.42, 0.075], at: [0, 0.13, 0], color: "#6b4a32", material: "wood", taper: 0.85, label: "handle" },
    ],
  }, {
    name: "microphone", archetype: "handheld_tool", hold: "upright",
    parts: [
      { shape: "cylinder", size: [0.09, 0.44, 0.09], at: [0, 0.17, 0], color: "#2b2b33", material: "plastic", taper: 1.35, label: "handle" },
      { shape: "cylinder", size: [0.15, 0.04, 0.15], at: [0, 0.4, 0], color: "#ff74a6", material: "plastic", label: "ring" },
      { shape: "sphere", size: [0.23, 0.23, 0.23], at: [0, 0.5, 0], color: "#c9ced6", material: "metal", label: "mesh head" },
      { shape: "coin", size: [0.05, 0.05, 0.01], at: [0, 0.22, 0.05], color: "#7bc96f", material: "glow", label: "on light" },
    ],
  }, {
    name: "trophy", archetype: "handheld_tool", hold: "upright",
    parts: [
      { shape: "box", size: [0.34, 0.1, 0.26], at: [0, -0.05, 0], color: "#6b4a32", material: "wood", round: 0.2, label: "base" },
      { shape: "cylinder", size: [0.07, 0.24, 0.07], at: [0, 0.12, 0], color: "#f5c542", material: "metal", label: "stem" },
      { shape: "dome", size: [0.44, 0.34, 0.44], at: [0, 0.42, 0], rotate: [180, 0, 0], color: "#f5c542", material: "metal", label: "cup" },
      { shape: "torus", size: [0.44, 0.04, 0.44], at: [0, 0.42, 0], rotate: [90, 0, 0], color: "#f5c542", material: "metal", label: "rim" },
      { shape: "torus", size: [0.16, 0.2, 0.035], at: [-0.25, 0.36, 0], color: "#f5c542", material: "metal", label: "handle" },
      { shape: "torus", size: [0.16, 0.2, 0.035], at: [0.25, 0.36, 0], color: "#f5c542", material: "metal" },
      { shape: "star", size: [0.13, 0.13, 0.03], at: [0, 0.31, 0.2], color: "#fff3b0", material: "glow", label: "star" },
    ],
  }, {
    name: "guitar", archetype: "handheld_tool", hold: "upright",
    parts: [
      { shape: "sphere", size: [0.44, 0.44, 0.12], at: [0, 0.12, 0], color: "#e08a3c", material: "wood", label: "body" },
      { shape: "sphere", size: [0.34, 0.34, 0.12], at: [0, 0.4, 0], color: "#e08a3c", material: "wood" },
      { shape: "coin", size: [0.12, 0.12, 0.01], at: [0, 0.32, 0.062], color: "#3a2516", material: "wood", label: "sound hole" },
      { shape: "box", size: [0.15, 0.035, 0.02], at: [0, 0.1, 0.065], color: "#3a2516", material: "wood", round: 0.3, label: "bridge" },
      { shape: "box", size: [0.07, 0.5, 0.045], at: [0, 0.78, 0], color: "#6b4a32", material: "wood", round: 0.2, label: "neck" },
      { shape: "box", size: [0.11, 0.14, 0.045], at: [0, 1.08, 0], color: "#3a2516", material: "wood", round: 0.3, label: "head" },
      { shape: "cylinder", size: [0.006, 0.95, 0.006], at: [0, 0.6, 0.07], color: "#e8e8e8", material: "metal", label: "strings" },
    ],
  }, {
    name: "cupcake", archetype: "handheld_tool", hold: "upright",
    parts: [
      { shape: "cylinder", size: [0.32, 0.22, 0.32], at: [0, 0.1, 0], color: "#7cc6f2", material: "paper", taper: 1.25, label: "wrapper" },
      { shape: "sphere", size: [0.4, 0.26, 0.4], at: [0, 0.29, 0], color: "#ffb3cf", material: "candy", label: "frosting" },
      { shape: "sphere", size: [0.25, 0.19, 0.25], at: [0, 0.42, 0], color: "#ffb3cf", material: "candy" },
      { shape: "sphere", size: [0.09, 0.09, 0.09], at: [0, 0.54, 0], color: "#e5484d", material: "candy", label: "cherry" },
      { shape: "box", size: [0.05, 0.015, 0.015], at: [-0.1, 0.36, 0.13], rotate: [0, 0, 30], color: "#5ec8ff", material: "candy", label: "sprinkle" },
      { shape: "box", size: [0.05, 0.015, 0.015], at: [0.09, 0.34, 0.14], rotate: [0, 0, -40], color: "#ffd34d", material: "candy" },
    ],
  }, {
    name: "soup", archetype: "handheld_tool", hold: "upright", parts: SOUP.map((p) => ({ ...p })),
  }, {
    name: "bowl of soup", archetype: "handheld_tool", hold: "upright", parts: SOUP.map((p) => ({ ...p })),
  }, {
    name: "tea", archetype: "handheld_tool", hold: "upright", parts: TEA.map((p) => ({ ...p })),
  }, {
    name: "cup of tea", archetype: "handheld_tool", hold: "upright", parts: TEA.map((p) => ({ ...p })),
  }, {
    name: "teacup", archetype: "handheld_tool", hold: "upright", parts: TEA.map((p) => ({ ...p })),
  }, {
    name: "ice cream", archetype: "handheld_tool", hold: "upright", parts: ICE_CREAM.map((p) => ({ ...p })),
  }, {
    name: "ice cream cone", archetype: "handheld_tool", hold: "upright", parts: ICE_CREAM.map((p) => ({ ...p })),
  }],
  launcher: [{
    name: "confetti popper", archetype: "launcher", hold: "aim", ammo: "confetti", muzzle: [0.72, 0.2, 0],
    parts: [
      { shape: "cylinder", size: [0.26, 0.6, 0.26], at: [0.38, 0.2, 0], rotate: [0, 0, -90], color: "#ff8fb8", material: "plastic", taper: 1.3 },
      { shape: "torus", size: [0.36, 0.36, 0.06], at: [0.69, 0.2, 0], rotate: [0, 90, 0], color: "#ffd34d", material: "plastic" },
      { shape: "box", size: [0.14, 0.32, 0.12], at: [0.08, 0.02, 0], rotate: [0, 0, -12], color: "#c9b3f2", material: "plastic", round: 0.4 },
      { shape: "star", size: [0.14, 0.14, 0.04], at: [0.38, 0.2, 0.14], color: "#ffffff", material: "paper" },
    ],
  }, {
    name: "water pistol", archetype: "launcher", hold: "aim", ammo: "water", muzzle: [0.7, 0.24, 0],
    parts: [
      { shape: "box", size: [0.15, 0.36, 0.13], at: [0.02, 0.0, 0], rotate: [0, 0, -16], color: "#ff9f43", material: "plastic", round: 0.45, label: "pistol grip" },
      { shape: "capsule", size: [0.24, 0.64, 0.22], at: [0.26, 0.22, 0], rotate: [0, 0, 90], color: "#3fb8a8", material: "plastic", label: "body" },
      { shape: "cylinder", size: [0.09, 0.16, 0.09], at: [0.62, 0.24, 0], rotate: [0, 0, 90], color: "#ff9f43", material: "plastic", taper: 0.75, label: "nozzle" },
      { shape: "capsule", size: [0.17, 0.34, 0.17], at: [0.22, 0.42, 0], rotate: [0, 0, 90], color: "#8cd6ff", material: "glass", label: "water tank" },
      { shape: "cylinder", size: [0.08, 0.07, 0.08], at: [0.08, 0.5, 0], color: "#ff9f43", material: "plastic", label: "tank cap" },
      { shape: "torus", size: [0.15, 0.15, 0.03], at: [0.13, 0.06, 0], arc: 180, rotate: [0, 0, 180], color: "#2a8f83", material: "plastic", label: "trigger guard" },
      { shape: "box", size: [0.035, 0.08, 0.05], at: [0.13, 0.08, 0], rotate: [0, 0, -10], color: "#ffd34d", material: "plastic", round: 0.45, label: "trigger" },
      { shape: "capsule", size: [0.1, 0.24, 0.1], at: [0.42, 0.08, 0], rotate: [0, 0, 90], color: "#ffd34d", material: "plastic", label: "pump" },
    ],
  }, {
    name: "big confetti rocket launcher", archetype: "launcher", hold: "aim", ammo: "starbursts", heavy: true, muzzle: [1.3, 0.3, 0],
    // a huge candy-coloured toy launcher he lugs on his shoulder (he wobbles under it): a fat mint tube with yellow
    // rings, a red-and-white rocket poking out of the front, grips underneath, a sight and star stickers; it fires
    // little confetti rockets that burst like fireworks
    parts: [
      { shape: "cylinder", size: [0.38, 1.8, 0.38], at: [0.35, 0.3, 0], rotate: [0, 0, 90], color: "#7be08a", material: "plastic", label: "tube" },
      { shape: "torus", size: [0.48, 0.48, 0.08], at: [1.24, 0.3, 0], rotate: [0, 90, 0], color: "#ffd34d", material: "plastic", label: "muzzle ring" },
      { shape: "torus", size: [0.46, 0.46, 0.07], at: [-0.54, 0.3, 0], rotate: [0, 90, 0], color: "#ffd34d", material: "plastic", label: "rear ring" },
      { shape: "torus", size: [0.42, 0.42, 0.05], at: [0.35, 0.3, 0], rotate: [0, 90, 0], color: "#ff8fb8", material: "plastic", label: "band" },
      { shape: "cone", size: [0.25, 0.3, 0.25], at: [1.42, 0.3, 0], rotate: [0, 0, -90], color: "#ff5f6d", material: "plastic", label: "rocket tip" },
      { shape: "cylinder", size: [0.26, 0.08, 0.26], at: [1.27, 0.3, 0], rotate: [0, 0, 90], color: "#ffffff", material: "plastic", label: "rocket tip band" },
      { shape: "dome", size: [0.34, 0.16, 0.34], at: [-0.6, 0.3, 0], rotate: [0, 0, 90], color: "#5b9cf0", material: "plastic", label: "exhaust" },
      { shape: "box", size: [0.14, 0.34, 0.14], at: [0, 0.04, 0], rotate: [0, 0, -12], color: "#5b9cf0", material: "plastic", round: 0.4, label: "grip" },
      { shape: "box", size: [0.12, 0.28, 0.12], at: [0.62, 0.07, 0], rotate: [0, 0, -8], color: "#5b9cf0", material: "plastic", round: 0.4, label: "front grip" },
      { shape: "box", size: [0.2, 0.12, 0.08], at: [0.75, 0.53, 0], color: "#3a3540", material: "plastic", round: 0.3, label: "sight" },
      { shape: "coin", size: [0.08, 0.08, 0.02], at: [0.75, 0.53, 0.045], color: "#8cd6ff", material: "glass", label: "sight lens" },
      { shape: "star", size: [0.22, 0.22, 0.03], at: [0.05, 0.3, 0.19], color: "#ffffff", material: "plastic", label: "star sticker" },
      { shape: "star", size: [0.16, 0.16, 0.03], at: [0.65, 0.3, 0.19], color: "#ffd34d", material: "plastic", label: "star sticker" },
    ],
  }, {
    name: "bubble blaster", archetype: "launcher", hold: "aim", ammo: "bubbles", muzzle: [0.78, 0.22, 0],
    parts: [
      { shape: "capsule", size: [0.3, 0.7, 0.3], at: [0.38, 0.22, 0], rotate: [0, 0, -90], color: "#8cc8ff", material: "plastic" },
      { shape: "torus", size: [0.3, 0.3, 0.06], at: [0.76, 0.22, 0], rotate: [0, 90, 0], color: "#ff8fb8", material: "plastic" },
      { shape: "box", size: [0.14, 0.3, 0.12], at: [0.1, 0.03, 0], color: "#ffd34d", material: "plastic", round: 0.4 },
      { shape: "sphere", size: [0.2, 0.2, 0.2], at: [0.3, 0.42, 0], color: "#cfe9ff", material: "glass" },
    ],
  }],
  throwable: [{
    // a tied rubber balloon full of water: a glossy drop shape, the pinched neck and knot on top, a bright highlight
    name: "water balloon", archetype: "throwable", hold: "throw", ammo: "water",
    parts: [
      { shape: "sphere", size: [0.36, 0.38, 0.36], at: [0, 0.15, 0], color: "#4fa8ff", material: "candy", label: "balloon" },
      { shape: "cylinder", size: [0.08, 0.07, 0.08], at: [0, 0.355, 0], color: "#4fa8ff", material: "candy", taper: 0.55, label: "neck" },
      { shape: "sphere", size: [0.075, 0.06, 0.075], at: [0, 0.4, 0], color: "#3a8fe6", material: "rubber", label: "knot" },
      { shape: "cylinder", size: [0.07, 0.05, 0.07], at: [0, 0.445, 0], color: "#3a8fe6", material: "rubber", taper: 1.6, label: "knot end" },
      { shape: "sphere", size: [0.06, 0.1, 0.03], at: [-0.085, 0.24, 0.155], rotate: [0, 0, 25], color: "#ffffff", material: "candy", label: "highlight" },
    ],
  }, {
    // a packed snowball: a round core with lumps pressed into it, and a couple of icy glints
    name: "snowball", archetype: "throwable", hold: "throw", ammo: "snow",
    parts: [
      { shape: "sphere", size: [0.34, 0.32, 0.34], at: [0, 0.15, 0], color: "#f4f8ff", material: "paper", label: "snow" },
      { shape: "sphere", size: [0.15, 0.13, 0.13], at: [0.11, 0.24, 0.07], color: "#f4f8ff", material: "paper", label: "lump" },
      { shape: "sphere", size: [0.14, 0.12, 0.13], at: [-0.12, 0.09, 0.08], color: "#eef4fc", material: "paper", label: "lump" },
      { shape: "sphere", size: [0.13, 0.12, 0.12], at: [-0.06, 0.27, -0.06], color: "#f8fbff", material: "paper", label: "lump" },
      { shape: "sphere", size: [0.13, 0.11, 0.12], at: [0.12, 0.06, -0.06], color: "#eef4fc", material: "paper", label: "lump" },
      { shape: "sphere", size: [0.12, 0.11, 0.11], at: [0.02, 0.16, 0.15], color: "#f8fbff", material: "paper", label: "lump" },
      { shape: "sphere", size: [0.035, 0.035, 0.02], at: [-0.05, 0.22, 0.165], color: "#cfe9ff", material: "glass", label: "ice glint" },
      { shape: "sphere", size: [0.03, 0.03, 0.02], at: [0.08, 0.1, 0.16], color: "#cfe9ff", material: "glass", label: "ice glint" },
    ],
  }, {
    // a shiny party ball, dotted with confetti, with a curly ribbon bow on top: it bursts into confetti
    name: "confetti ball", archetype: "throwable", hold: "throw", ammo: "confetti",
    parts: [
      { shape: "sphere", size: [0.34, 0.34, 0.34], at: [0, 0.15, 0], color: "#ff8fb8", material: "plastic", label: "ball" },
      { shape: "coin", size: [0.07, 0.07, 0.016], at: [-0.07, 0.22, 0.15], color: "#ffd34d", material: "paper", label: "confetti dot" },
      { shape: "coin", size: [0.06, 0.06, 0.016], at: [0.08, 0.2, 0.15], color: "#5fd3e0", material: "paper", label: "confetti dot" },
      { shape: "coin", size: [0.065, 0.065, 0.016], at: [0.01, 0.08, 0.165], color: "#62c46b", material: "paper", label: "confetti dot" },
      { shape: "star", size: [0.08, 0.08, 0.02], at: [0.1, 0.07, 0.13], color: "#ffffff", material: "paper", label: "confetti star" },
      { shape: "coin", size: [0.055, 0.055, 0.016], at: [-0.12, 0.1, 0.11], color: "#a77ce8", material: "paper", label: "confetti dot" },
      { shape: "torus", size: [0.11, 0.08, 0.025], at: [-0.06, 0.345, 0], rotate: [0, 0, 20], color: "#ffd34d", material: "cloth", label: "bow loop" },
      { shape: "torus", size: [0.11, 0.08, 0.025], at: [0.06, 0.345, 0], rotate: [0, 0, -20], color: "#ffd34d", material: "cloth", label: "bow loop" },
      { shape: "sphere", size: [0.05, 0.045, 0.05], at: [0, 0.325, 0], color: "#f2c14e", material: "cloth", label: "bow knot" },
    ],
  }, {
    // a squishy two-tone foam ball with crossing stripes, like a playground ball: it bonks and bounces
    name: "foam ball", archetype: "throwable", hold: "throw", ammo: "stars",
    parts: [
      { shape: "sphere", size: [0.36, 0.36, 0.36], at: [0, 0.15, 0], color: "#ff9f43", material: "rubber", label: "ball" },
      { shape: "torus", size: [0.37, 0.37, 0.04], at: [0, 0.15, 0], rotate: [0, 90, 0], color: "#5b9cf0", material: "rubber", label: "stripe" },
      { shape: "torus", size: [0.37, 0.37, 0.04], at: [0, 0.15, 0], rotate: [90, 0, 0], color: "#5b9cf0", material: "rubber", label: "stripe" },
      { shape: "sphere", size: [0.06, 0.08, 0.03], at: [-0.08, 0.25, 0.15], rotate: [0, 0, 25], color: "#ffd9b0", material: "rubber", label: "shine" },
    ],
  }],
  ride: [{
    // a kid's bike seen from the side: red frame, spoked wheels, a tall handlebar he can reach with pink grips, a bell, pedals on the crank
    name: "bicycle", archetype: "ride", hold: "ride",
    parts: [
      { shape: "torus", size: [0.58, 0.58, 0.08], at: [-0.66, 0.29, 0], color: "#3a3540", material: "rubber", label: "rear wheel" },
      { shape: "torus", size: [0.58, 0.58, 0.08], at: [0.64, 0.29, 0], color: "#3a3540", material: "rubber", label: "front wheel" },
      { shape: "coin", size: [0.09, 0.09, 0.12], at: [-0.66, 0.29, 0], color: "#c9ced6", material: "metal", label: "rear hub" },
      { shape: "coin", size: [0.09, 0.09, 0.12], at: [0.64, 0.29, 0], color: "#c9ced6", material: "metal", label: "front hub" },
      { shape: "cylinder", size: [0.016, 0.52, 0.016], at: [-0.66, 0.29, 0], rotate: [0, 0, 45], color: "#c9ced6", material: "metal", label: "rear spoke" },
      { shape: "cylinder", size: [0.016, 0.52, 0.016], at: [-0.66, 0.29, 0], rotate: [0, 0, -45], color: "#c9ced6", material: "metal", label: "rear spoke" },
      { shape: "cylinder", size: [0.016, 0.52, 0.016], at: [0.64, 0.29, 0], rotate: [0, 0, 45], color: "#c9ced6", material: "metal", label: "front spoke" },
      { shape: "cylinder", size: [0.016, 0.52, 0.016], at: [0.64, 0.29, 0], rotate: [0, 0, -45], color: "#c9ced6", material: "metal", label: "front spoke" },
      { shape: "cylinder", size: [0.07, 0.602, 0.07], at: [0.205, 0.445, 0], rotate: [0, 0, -54.5], color: "#ff5f6d", material: "metal", label: "down tube" },
      { shape: "cylinder", size: [0.065, 0.311, 0.065], at: [-0.145, 0.385, 0], rotate: [0, 0, 42.4], color: "#ff5f6d", material: "metal", label: "seat tube" },
      { shape: "cylinder", size: [0.06, 0.702, 0.06], at: [0.105, 0.535, 0], rotate: [0, 0, -79.3], color: "#ff5f6d", material: "metal", label: "top tube" },
      { shape: "cylinder", size: [0.045, 0.62, 0.045], at: [-0.35, 0.28, 0], rotate: [0, 0, 88.2], color: "#ff5f6d", material: "metal", label: "chain stay" },
      { shape: "cylinder", size: [0.045, 0.461, 0.045], at: [-0.45, 0.385, 0], rotate: [0, 0, 114.3], color: "#ff5f6d", material: "metal", label: "seat stay" },
      { shape: "cylinder", size: [0.055, 0.371, 0.055], at: [0.555, 0.455, 0], rotate: [0, 0, -152.7], color: "#ff5f6d", material: "metal", label: "fork" },
      { shape: "cylinder", size: [0.05, 0.404, 0.05], at: [0.43, 0.8, 0], rotate: [0, 0, 8.5], color: "#c9ced6", material: "metal", label: "stem" },
      { shape: "cylinder", size: [0.045, 0.66, 0.045], at: [0.4, 1.0, 0], rotate: [90, 0, 0], color: "#c9ced6", material: "metal", label: "handlebar" },
      { shape: "capsule", size: [0.075, 0.15, 0.075], at: [0.4, 1.0, 0.3], rotate: [90, 0, 0], color: "#ff8fb8", material: "rubber", label: "grip" },
      { shape: "capsule", size: [0.075, 0.15, 0.075], at: [0.4, 1.0, -0.3], rotate: [90, 0, 0], color: "#ff8fb8", material: "rubber", label: "grip" },
      { shape: "capsule", size: [0.14, 0.36, 0.22], at: [-0.28, 0.55, 0], rotate: [0, 0, 90], color: "#3a3540", material: "cloth", label: "seat" },
      { shape: "coin", size: [0.17, 0.17, 0.035], at: [-0.04, 0.27, 0.05], color: "#c9ced6", material: "metal", label: "crank" },
      { shape: "coin", size: [0.12, 0.12, 0.035], at: [-0.04, 0.27, -0.05], color: "#c9ced6", material: "metal", label: "crank" },
      { shape: "box", size: [0.11, 0.035, 0.08], at: [0.05, 0.27, 0.09], color: "#3a3540", material: "rubber", round: 0.3, label: "pedal" },
      { shape: "box", size: [0.11, 0.035, 0.08], at: [-0.13, 0.27, -0.09], color: "#3a3540", material: "rubber", round: 0.3, label: "pedal" },
      { shape: "coin", size: [0.09, 0.09, 0.05], at: [0.4, 1.05, -0.17], rotate: [-90, 0, 0], color: "#ffd34d", material: "metal", label: "bell" },
    ],
  }, {
    // a trike: a big front wheel with the pedals on its hub, two little back wheels on an axle, a step behind the pink seat, streamers on the grips
    name: "tricycle", archetype: "ride", hold: "ride",
    parts: [
      { shape: "torus", size: [0.66, 0.66, 0.09], at: [0.5, 0.33, 0], color: "#3a3540", material: "rubber", label: "front wheel" },
      { shape: "coin", size: [0.11, 0.11, 0.2], at: [0.5, 0.33, 0], color: "#c9ced6", material: "metal", label: "front hub" },
      { shape: "cylinder", size: [0.018, 0.6, 0.018], at: [0.5, 0.33, 0], rotate: [0, 0, 45], color: "#c9ced6", material: "metal", label: "front spoke" },
      { shape: "cylinder", size: [0.018, 0.6, 0.018], at: [0.5, 0.33, 0], rotate: [0, 0, -45], color: "#c9ced6", material: "metal", label: "front spoke" },
      { shape: "torus", size: [0.38, 0.38, 0.08], at: [-0.5, 0.19, 0.34], color: "#3a3540", material: "rubber", label: "rear wheel" },
      { shape: "torus", size: [0.38, 0.38, 0.08], at: [-0.5, 0.19, -0.34], color: "#3a3540", material: "rubber", label: "rear wheel" },
      { shape: "coin", size: [0.1, 0.1, 0.1], at: [-0.5, 0.19, 0.34], color: "#ffd34d", material: "plastic", label: "rear hub" },
      { shape: "coin", size: [0.1, 0.1, 0.1], at: [-0.5, 0.19, -0.34], color: "#ffd34d", material: "plastic", label: "rear hub" },
      { shape: "cylinder", size: [0.05, 0.64, 0.05], at: [-0.5, 0.19, 0], rotate: [90, 0, 0], color: "#c9ced6", material: "metal", label: "axle" },
      { shape: "box", size: [0.26, 0.04, 0.5], at: [-0.64, 0.3, 0], color: "#4fd0c0", material: "plastic", round: 0.3, label: "step" },
      { shape: "cylinder", size: [0.085, 1.011, 0.085], at: [-0.06, 0.45, 0], rotate: [0, 0, -65.5], color: "#4fd0c0", material: "plastic", label: "frame" },
      { shape: "cylinder", size: [0.065, 0.342, 0.065], at: [0.455, 0.495, 0], rotate: [0, 0, -164.7], color: "#4fd0c0", material: "plastic", label: "fork" },
      { shape: "capsule", size: [0.17, 0.38, 0.28], at: [-0.16, 0.5, 0], rotate: [0, 0, 90], color: "#ff8fb8", material: "cloth", label: "seat" },
      { shape: "cylinder", size: [0.05, 0.342, 0.05], at: [0.38, 0.83, 0], rotate: [0, 0, 6.7], color: "#c9ced6", material: "metal", label: "stem" },
      { shape: "cylinder", size: [0.05, 0.66, 0.05], at: [0.36, 1.0, 0], rotate: [90, 0, 0], color: "#c9ced6", material: "metal", label: "handlebar" },
      { shape: "capsule", size: [0.08, 0.15, 0.08], at: [0.36, 1.0, 0.3], rotate: [90, 0, 0], color: "#ffd34d", material: "rubber", label: "grip" },
      { shape: "capsule", size: [0.08, 0.15, 0.08], at: [0.36, 1.0, -0.3], rotate: [90, 0, 0], color: "#ffd34d", material: "rubber", label: "grip" },
      { shape: "leaf", size: [0.07, 0.2, 0.012], at: [0.36, 0.92, 0.39], rotate: [0, 0, 160], color: "#ff8fb8", material: "paper", label: "streamer" },
      { shape: "leaf", size: [0.07, 0.2, 0.012], at: [0.36, 0.92, -0.39], rotate: [0, 0, 160], color: "#a77ce8", material: "paper", label: "streamer" },
      { shape: "coin", size: [0.13, 0.13, 0.03], at: [0.5, 0.33, 0.085], color: "#c9ced6", material: "metal", label: "crank" },
      { shape: "box", size: [0.1, 0.04, 0.08], at: [0.59, 0.33, 0.13], color: "#3a3540", material: "rubber", round: 0.3, label: "pedal" },
      { shape: "box", size: [0.1, 0.04, 0.08], at: [0.41, 0.33, -0.13], color: "#3a3540", material: "rubber", round: 0.3, label: "pedal" },
    ],
  }, {
    // a teal skateboard with kicked-up ends, dark grip tape on top, a pink stripe and a star sticker on the side, yellow wheels
    // a little convertible he drives, with a back seat for Mimi or Cocoa (Nov 3: "the car didn't look realistic enough,
    // looked like blocks"): round shapes all over (a long rounded body, swelling wheel arches, a domed hood and trunk),
    // real tyres with hubs, a sloped windshield, chrome bumpers, lights front and back
    name: "car", archetype: "ride", hold: "ride",
    parts: [
      { shape: "box", size: [2.8, 0.5, 1.36], at: [0, 0.55, 0], color: "#e5484d", material: "plastic", round: 0.5, label: "body" },
      { shape: "sphere", size: [1.02, 0.68, 1.48], at: [0.92, 0.58, 0], color: "#e5484d", material: "plastic", label: "front arch" },
      { shape: "sphere", size: [1.02, 0.68, 1.48], at: [-0.92, 0.58, 0], color: "#e5484d", material: "plastic", label: "rear arch" },
      { shape: "sphere", size: [1.24, 0.46, 1.3], at: [0.88, 0.78, 0], color: "#ef5b60", material: "plastic", label: "hood" },
      { shape: "sphere", size: [0.86, 0.42, 1.3], at: [-1.04, 0.78, 0], color: "#ef5b60", material: "plastic", label: "trunk" },
      { shape: "box", size: [1.5, 0.32, 1.38], at: [-0.16, 0.91, 0], color: "#e5484d", material: "plastic", round: 0.5, label: "cabin sides" },
      { shape: "capsule", size: [0.1, 1.28, 0.1], at: [0.58, 1.07, 0], rotate: [90, 0, 0], color: "#f7f7fa", material: "metal", label: "dash" },
      { shape: "box", size: [0.05, 0.42, 1.16], at: [0.64, 1.27, 0], rotate: [0, 0, -28], color: "#bfe6ff", material: "glass", round: 0.4, label: "windshield" },
      { shape: "capsule", size: [0.06, 1.2, 0.06], at: [0.54, 1.46, 0], rotate: [90, 0, 0], color: "#c9ced6", material: "metal", label: "windshield frame" },
      { shape: "box", size: [0.52, 0.08, 0.9], at: [0.06, 0.52, 0], color: "#fff1d6", material: "cloth", round: 0.4, label: "seat" },
      { shape: "box", size: [0.12, 0.42, 0.92], at: [-0.3, 1.12, 0], color: "#fff1d6", material: "cloth", round: 0.5, label: "seat back" },
      { shape: "box", size: [0.52, 0.08, 0.9], at: [-0.86, 0.6, 0], color: "#fff1d6", material: "cloth", round: 0.4, label: "back seat" },
      { shape: "box", size: [0.12, 0.44, 0.92], at: [-1.14, 1.18, 0], color: "#fff1d6", material: "cloth", round: 0.5, label: "back seat back" },
      { shape: "torus", size: [0.32, 0.32, 0.05], at: [0.4, 1.22, 0.2], rotate: [0, 90, -20], color: "#3a3540", material: "rubber", label: "steering" },
      { shape: "cylinder", size: [0.035, 0.26, 0.035], at: [0.49, 1.12, 0.2], rotate: [0, 0, -50], color: "#3a3540", material: "metal", label: "steering column" },
      { shape: "torus", size: [0.64, 0.64, 0.22], at: [0.92, 0.32, 0.66], color: "#2b2a30", material: "rubber", label: "front wheel" },
      { shape: "torus", size: [0.64, 0.64, 0.22], at: [0.92, 0.32, -0.66], color: "#2b2a30", material: "rubber", label: "front wheel" },
      { shape: "torus", size: [0.64, 0.64, 0.22], at: [-0.92, 0.32, 0.66], color: "#2b2a30", material: "rubber", label: "rear wheel" },
      { shape: "torus", size: [0.64, 0.64, 0.22], at: [-0.92, 0.32, -0.66], color: "#2b2a30", material: "rubber", label: "rear wheel" },
      { shape: "coin", size: [0.4, 0.4, 0.18], at: [0.92, 0.32, 0.66], color: "#d9dde3", material: "metal", label: "hub" },
      { shape: "coin", size: [0.4, 0.4, 0.18], at: [0.92, 0.32, -0.66], color: "#d9dde3", material: "metal", label: "hub" },
      { shape: "coin", size: [0.4, 0.4, 0.18], at: [-0.92, 0.32, 0.66], color: "#d9dde3", material: "metal", label: "hub" },
      { shape: "coin", size: [0.4, 0.4, 0.18], at: [-0.92, 0.32, -0.66], color: "#d9dde3", material: "metal", label: "hub" },
      { shape: "star", size: [0.16, 0.16, 0.2], at: [0.92, 0.32, 0.68], color: "#ffd34d", material: "plastic", label: "hub cap" },
      { shape: "star", size: [0.16, 0.16, 0.2], at: [-0.92, 0.32, 0.68], color: "#ffd34d", material: "plastic", label: "hub cap" },
      { shape: "sphere", size: [0.22, 0.22, 0.22], at: [1.36, 0.68, 0.4], color: "#fff6c8", material: "glow", label: "headlight" },
      { shape: "sphere", size: [0.22, 0.22, 0.22], at: [1.36, 0.68, -0.4], color: "#fff6c8", material: "glow", label: "headlight" },
      { shape: "sphere", size: [0.14, 0.14, 0.14], at: [-1.4, 0.7, 0.45], color: "#ff3b4a", material: "glow", label: "taillight" },
      { shape: "sphere", size: [0.14, 0.14, 0.14], at: [-1.4, 0.7, -0.45], color: "#ff3b4a", material: "glow", label: "taillight" },
      { shape: "capsule", size: [0.13, 1.28, 0.13], at: [1.42, 0.38, 0], rotate: [90, 0, 0], color: "#d9dde3", material: "metal", label: "front bumper" },
      { shape: "capsule", size: [0.13, 1.28, 0.13], at: [-1.42, 0.38, 0], rotate: [90, 0, 0], color: "#d9dde3", material: "metal", label: "rear bumper" },
      { shape: "box", size: [0.06, 0.16, 0.5], at: [1.42, 0.56, 0], color: "#3a3540", material: "metal", round: 0.4, label: "grille" },
      { shape: "box", size: [0.16, 0.04, 0.03], at: [0.15, 0.82, 0.69], color: "#d9dde3", material: "metal", round: 0.5, label: "door handle" },
      { shape: "sphere", size: [0.13, 0.09, 0.08], at: [0.55, 1.12, 0.7], color: "#e5484d", material: "plastic", label: "mirror" },
    ],
  }, {
    name: "skateboard", archetype: "ride", hold: "ride",
    parts: [
      { shape: "box", size: [1.2, 0.05, 0.38], at: [0, 0.16, 0], color: "#4fd0c0", material: "wood", round: 0.45, label: "deck" },
      { shape: "box", size: [0.24, 0.05, 0.36], at: [0.69, 0.195, 0], rotate: [0, 0, 18], color: "#4fd0c0", material: "wood", round: 0.45, label: "deck nose" },
      { shape: "box", size: [0.24, 0.05, 0.36], at: [-0.69, 0.195, 0], rotate: [0, 0, -18], color: "#4fd0c0", material: "wood", round: 0.45, label: "deck tail" },
      { shape: "box", size: [1.16, 0.012, 0.34], at: [0, 0.19, 0], color: "#3a3540", material: "rubber", round: 0.4, label: "grip tape" },
      { shape: "box", size: [1.12, 0.022, 0.012], at: [0, 0.16, 0.19], color: "#ff8fb8", material: "plastic", label: "stripe" },
      { shape: "star", size: [0.1, 0.1, 0.02], at: [0.36, 0.16, 0.2], color: "#ffd34d", material: "plastic", label: "sticker" },
      { shape: "box", size: [0.1, 0.06, 0.32], at: [0.42, 0.1, 0], color: "#c9ced6", material: "metal", round: 0.3, label: "truck" },
      { shape: "box", size: [0.1, 0.06, 0.32], at: [-0.42, 0.1, 0], color: "#c9ced6", material: "metal", round: 0.3, label: "truck" },
      { shape: "cylinder", size: [0.12, 0.07, 0.12], at: [0.42, 0.06, 0.17], rotate: [90, 0, 0], color: "#ffd34d", material: "rubber", label: "wheel" },
      { shape: "cylinder", size: [0.12, 0.07, 0.12], at: [0.42, 0.06, -0.17], rotate: [90, 0, 0], color: "#ffd34d", material: "rubber", label: "wheel" },
      { shape: "cylinder", size: [0.12, 0.07, 0.12], at: [-0.42, 0.06, 0.17], rotate: [90, 0, 0], color: "#ffd34d", material: "rubber", label: "wheel" },
      { shape: "cylinder", size: [0.12, 0.07, 0.12], at: [-0.42, 0.06, -0.17], rotate: [90, 0, 0], color: "#ffd34d", material: "rubber", label: "wheel" },
    ],
  }],
  companion: [{
    // a classic sitting plush bear: big head, round ears with cream insides, a cream muzzle with a dark nose, button
    // eyes, chunky arms resting forward, legs out front with cream foot pads
    name: "little teddy bear", archetype: "companion",
    parts: [
      { shape: "sphere", size: [0.58, 0.6, 0.52], at: [0, 0.36, 0], color: "#8f5b36", material: "fluffy", label: "tummy" },
      { shape: "sphere", size: [0.56, 0.5, 0.47], at: [0, 0.85, 0.02], color: "#8f5b36", material: "fluffy", label: "head" },
      { shape: "sphere", size: [0.19, 0.19, 0.09], at: [-0.22, 1.05, 0], color: "#8f5b36", material: "fluffy", label: "ear" },
      { shape: "sphere", size: [0.19, 0.19, 0.09], at: [0.22, 1.05, 0], color: "#8f5b36", material: "fluffy" },
      { shape: "sphere", size: [0.11, 0.11, 0.04], at: [-0.22, 1.045, 0.04], color: "#efd6ae", material: "fluffy", label: "inner ear" },
      { shape: "sphere", size: [0.11, 0.11, 0.04], at: [0.22, 1.045, 0.04], color: "#efd6ae", material: "fluffy" },
      { shape: "sphere", size: [0.24, 0.16, 0.15], at: [0, 0.77, 0.21], color: "#efd6ae", material: "fluffy", label: "muzzle" },
      { shape: "sphere", size: [0.085, 0.06, 0.05], at: [0, 0.81, 0.285], color: "#2a1d18", material: "plastic", label: "nose" },
      { shape: "sphere", size: [0.06, 0.07, 0.04], at: [-0.11, 0.91, 0.21], color: "#2a1d18", material: "plastic", label: "button eye" },
      { shape: "sphere", size: [0.06, 0.07, 0.04], at: [0.11, 0.91, 0.21], color: "#2a1d18", material: "plastic" },
      { shape: "capsule", size: [0.17, 0.32, 0.16], at: [-0.28, 0.4, 0.13], rotate: [-35, 0, -28], color: "#8f5b36", material: "fluffy", label: "arm" },
      { shape: "capsule", size: [0.17, 0.32, 0.16], at: [0.28, 0.4, 0.13], rotate: [-35, 0, 28], color: "#8f5b36", material: "fluffy" },
      { shape: "capsule", size: [0.21, 0.34, 0.21], at: [-0.17, 0.11, 0.17], rotate: [90, 0, 0], color: "#8f5b36", material: "fluffy", label: "leg" },
      { shape: "capsule", size: [0.21, 0.34, 0.21], at: [0.17, 0.11, 0.17], rotate: [90, 0, 0], color: "#8f5b36", material: "fluffy" },
      { shape: "coin", size: [0.16, 0.16, 0.03], at: [-0.17, 0.11, 0.345], color: "#efd6ae", material: "fluffy", label: "foot pad" },
      { shape: "coin", size: [0.16, 0.16, 0.03], at: [0.17, 0.11, 0.345], color: "#efd6ae", material: "fluffy" },
    ],
  }, {
    name: "potted sunflower", archetype: "companion",
    parts: [
      { shape: "cylinder", size: [0.42, 0.36, 0.42], at: [0, 0.18, 0], color: "#e08a5a", material: "rubber", taper: 1.2 },
      { shape: "cylinder", size: [0.05, 0.7, 0.05], at: [0, 0.68, 0], color: "#62c46b", material: "plastic" },
      { shape: "leaf", size: [0.2, 0.3, 0.04], at: [0.1, 0.62, 0], rotate: [0, 0, -50], color: "#62c46b", material: "plastic" },
      { shape: "disc", size: [0.5, 0.06, 0.5], at: [0, 1.08, 0.02], rotate: [80, 0, 0], color: "#ffd34d", material: "cloth" },
      { shape: "disc", size: [0.24, 0.07, 0.24], at: [0, 1.08, 0.05], rotate: [80, 0, 0], color: "#9a6a44", material: "fluffy" },
    ],
  }, {
    name: "piggy bank", archetype: "companion",
    parts: [
      { shape: "sphere", size: [0.72, 0.6, 0.66], at: [0, 0.38, 0], color: "#ff8a3d", material: "plastic", label: "body" },
      { shape: "cylinder", size: [0.2, 0.1, 0.15], at: [0, 0.37, 0.33], rotate: [90, 0, 0], color: "#ffa660", material: "plastic", label: "snout" },
      { shape: "sphere", size: [0.04, 0.05, 0.03], at: [-0.04, 0.37, 0.385], color: "#5a2a14", material: "plastic", label: "nostril" },
      { shape: "sphere", size: [0.04, 0.05, 0.03], at: [0.04, 0.37, 0.385], color: "#5a2a14", material: "plastic" },
      { shape: "sphere", size: [0.065, 0.08, 0.04], at: [-0.13, 0.52, 0.28], color: "#2a1e1e", material: "candy", label: "eye" },
      { shape: "sphere", size: [0.065, 0.08, 0.04], at: [0.13, 0.52, 0.28], color: "#2a1e1e", material: "candy" },
      { shape: "sphere", size: [0.09, 0.05, 0.02], at: [-0.22, 0.42, 0.28], rotate: [0, -35, 0], color: "#ffb0a0", material: "plastic", label: "cheek" },
      { shape: "sphere", size: [0.09, 0.05, 0.02], at: [0.22, 0.42, 0.28], rotate: [0, 35, 0], color: "#ffb0a0", material: "plastic" },
      { shape: "cone", size: [0.15, 0.15, 0.07], at: [-0.2, 0.68, 0.1], rotate: [0, 0, 22], color: "#ff8a3d", material: "plastic", label: "ear" },
      { shape: "cone", size: [0.15, 0.15, 0.07], at: [0.2, 0.68, 0.1], rotate: [0, 0, -22], color: "#ff8a3d", material: "plastic" },
      { shape: "cylinder", size: [0.13, 0.12, 0.13], at: [-0.2, 0.06, 0.16], color: "#ff8a3d", material: "plastic", label: "leg" },
      { shape: "cylinder", size: [0.13, 0.12, 0.13], at: [0.2, 0.06, 0.16], color: "#ff8a3d", material: "plastic" },
      { shape: "cylinder", size: [0.13, 0.12, 0.13], at: [-0.2, 0.06, -0.16], color: "#ff8a3d", material: "plastic" },
      { shape: "cylinder", size: [0.13, 0.12, 0.13], at: [0.2, 0.06, -0.16], color: "#ff8a3d", material: "plastic" },
      { shape: "box", size: [0.2, 0.03, 0.06], at: [0, 0.68, -0.04], color: "#3a2a20", material: "rubber", round: 0.45, label: "coin slot" },
      { shape: "disc", size: [0.17, 0.025, 0.17], at: [0, 0.74, -0.04], rotate: [90, 0, 0], color: "#f2c14e", material: "metal", label: "coin" },
    ],
  }, {
    name: "little signal tower", archetype: "companion",
    parts: [
      { shape: "cylinder", size: [0.5, 0.12, 0.5], at: [0, 0.06, 0], color: "#3a3550", material: "plastic", label: "base" },
      { shape: "cylinder", size: [0.12, 0.9, 0.12], at: [0, 0.57, 0], color: "#e8e6f0", material: "metal", taper: 0.6, label: "mast" },
      { shape: "torus", size: [0.34, 0.34, 0.05], at: [0, 0.62, 0], rotate: [90, 0, 0], color: "#e20074", material: "plastic", label: "ring" },
      { shape: "box", size: [0.08, 0.26, 0.04], at: [0, 0.84, 0.09], color: "#ffffff", material: "plastic", round: 0.4, label: "antenna panel" },
      { shape: "box", size: [0.08, 0.26, 0.04], at: [0.078, 0.84, -0.045], rotate: [0, 120, 0], color: "#ffffff", material: "plastic", round: 0.4 },
      { shape: "box", size: [0.08, 0.26, 0.04], at: [-0.078, 0.84, -0.045], rotate: [0, -120, 0], color: "#ffffff", material: "plastic", round: 0.4 },
      { shape: "sphere", size: [0.16, 0.16, 0.16], at: [0, 1.08, 0], color: "#ff4fc4", material: "glow", label: "beacon" },
      { shape: "torus", size: [0.45, 0.45, 0.05], at: [0, 1.08, 0], rotate: [0, 0, -45], arc: 90, color: "#ff4fc4", material: "glow", label: "signal wave" },
      { shape: "torus", size: [0.7, 0.7, 0.05], at: [0, 1.08, 0], rotate: [0, 0, -45], arc: 90, color: "#ff4fc4", material: "glow" },
      { shape: "torus", size: [0.45, 0.45, 0.05], at: [0, 1.08, 0], rotate: [0, 0, 135], arc: 90, color: "#ff4fc4", material: "glow" },
      { shape: "torus", size: [0.7, 0.7, 0.05], at: [0, 1.08, 0], rotate: [0, 0, 135], arc: 90, color: "#ff4fc4", material: "glow" },
    ],
  }, {
    name: "traffic cone", archetype: "companion",
    parts: [
      { shape: "box", size: [0.62, 0.06, 0.62], at: [0, 0.03, 0], color: "#ff7a1a", material: "rubber", round: 0.3, label: "base" },
      { shape: "cone", size: [0.48, 0.86, 0.48], at: [0, 0.49, 0], color: "#ff7a1a", material: "plastic" },
      { shape: "torus", size: [0.33, 0.33, 0.05], at: [0, 0.42, 0], rotate: [90, 0, 0], color: "#fbfbfb", material: "plastic", label: "stripe" },
      { shape: "torus", size: [0.2, 0.2, 0.04], at: [0, 0.62, 0], rotate: [90, 0, 0], color: "#fbfbfb", material: "plastic" },
      { shape: "sphere", size: [0.05, 0.065, 0.03], at: [-0.06, 0.27, 0.185], color: "#2a1e1e", material: "candy", label: "eye" },
      { shape: "sphere", size: [0.05, 0.065, 0.03], at: [0.06, 0.27, 0.185], color: "#2a1e1e", material: "candy" },
    ],
  }],
  body_wearable: [{
    name: "protective vest", archetype: "body_wearable",
    parts: [
      { shape: "cylinder", size: [1.38, 0.86, 1.34], at: [0, -0.08, 0], color: "#24314f", material: "cloth", taper: 0.95, hollow: true, label: "vest" },
      { shape: "torus", size: [1.2, 1.15, 0.06], at: [0, 0.34, 0], rotate: [90, 0, 0], color: "#1b2540", material: "cloth", label: "collar" },
      { shape: "torus", size: [1.38, 1.32, 0.06], at: [0, -0.2, 0], rotate: [90, 0, 0], color: "#e6ff5a", material: "glow", label: "reflective band" },
      { shape: "box", size: [0.3, 0.22, 0.1], at: [-0.27, -0.3, 0.6], rotate: [0, -16, 0], color: "#2c3b5e", material: "cloth", round: 0.3, label: "pocket" },
      { shape: "box", size: [0.3, 0.22, 0.1], at: [0.27, -0.3, 0.6], rotate: [0, 16, 0], color: "#2c3b5e", material: "cloth", round: 0.3 },
      { shape: "box", size: [0.32, 0.07, 0.11], at: [-0.27, -0.18, 0.61], rotate: [0, -16, 0], color: "#1b2540", material: "cloth", round: 0.4, label: "flap" },
      { shape: "box", size: [0.32, 0.07, 0.11], at: [0.27, -0.18, 0.61], rotate: [0, 16, 0], color: "#1b2540", material: "cloth", round: 0.4 },
      { shape: "star", size: [0.17, 0.17, 0.05], at: [-0.25, 0.1, 0.6], rotate: [0, -14, 0], color: "#f2c14e", material: "metal", label: "badge" },
      { shape: "box", size: [0.15, 0.22, 0.08], at: [0.27, 0.1, 0.58], rotate: [0, 16, 0], color: "#1a1f2e", material: "plastic", round: 0.35, label: "radio" },
    ],
  }, {
    name: "gold medal", archetype: "body_wearable",
    parts: [
      { shape: "box", size: [0.1, 0.42, 0.02], at: [-0.08, 0.2, 0.62], rotate: [0, 0, 18], color: "#3d7bff", material: "cloth", round: 0.2, label: "ribbon" },
      { shape: "box", size: [0.1, 0.42, 0.02], at: [0.08, 0.2, 0.61], rotate: [0, 0, -18], color: "#e5484d", material: "cloth", round: 0.2 },
      { shape: "coin", size: [0.28, 0.28, 0.05], at: [0, -0.06, 0.66], color: "#f2c14e", material: "metal", label: "medal" },
      { shape: "star", size: [0.14, 0.14, 0.035], at: [0, -0.06, 0.695], color: "#ffd86b", material: "metal" },
    ],
  }],
};
// the activity book's things (shared/pocket-more.js): cooking, music, sports, the garden, camping…
for (const [arch, list] of Object.entries(MORE_PROPS)) (PROP_EXAMPLES[arch] = PROP_EXAMPLES[arch] || []).push(...list);
for (const [arch, list] of Object.entries(VEHICLES)) (PROP_EXAMPLES[arch] = PROP_EXAMPLES[arch] || []).push(...list);   // (Nov 4: rocket ship, plane, helicopter, boats, train)
export const MOVE_EXAMPLES = [
  { name: "big wave", duration: 2.2, tracks: {
    "rightArm.spread": [[0, 0], [0.35, 0.9], [0.6, 0.75], [0.85, 0.95], [1.1, 0.75], [1.35, 0.95], [1.6, 0.8], [2.2, 0]],
    "head.tilt": [[0, 0], [0.4, 0.3], [1.6, 0.3], [2.2, 0]], "face.smile": [[0, 0], [0.3, 0.6], [1.8, 0.6], [2.2, 0]], "face.eyes": [[0, 0], [0.4, 1], [1.6, 1], [2.2, 0]] } },
  { name: "polite bow", duration: 2.0, tracks: {
    "body.lean": [[0, 0], [0.5, 0.9], [1.2, 0.9], [1.8, 0]], "head.nod": [[0, 0], [0.5, 0.7], [1.2, 0.7], [1.8, 0]],
    "leftArm.spread": [[0, 0], [0.5, -0.6], [1.2, -0.6], [1.8, 0]], "rightArm.spread": [[0, 0], [0.5, -0.6], [1.2, -0.6], [1.8, 0]], "face.eyes": [[0, 0], [0.5, 1], [1.3, 1], [1.8, 0]] } },
  { name: "happy dance", duration: 3.2, tracks: {
    "body.sway": [[0, 0], [0.4, 0.7], [0.8, -0.7], [1.2, 0.7], [1.6, -0.7], [2.0, 0.7], [2.4, -0.7], [3.2, 0]],
    "body.hop": [[0, 0], [0.2, 0.4], [0.4, 0], [1.0, 0.4], [1.2, 0], [1.8, 0.4], [2.0, 0], [3.2, 0]],
    "leftArm.spread": [[0, 0], [0.4, 0.9], [0.8, 0.3], [1.2, 0.9], [1.6, 0.3], [2.0, 0.9], [2.4, 0.3], [3.2, 0]],
    "rightArm.spread": [[0, 0], [0.4, 0.3], [0.8, 0.9], [1.2, 0.3], [1.6, 0.9], [2.0, 0.3], [2.4, 0.9], [3.2, 0]],
    "face.smile": [[0, 0], [0.3, 1], [2.8, 1], [3.2, 0]], "face.mouth": [[0, 0], [0.3, 0.5], [2.8, 0.5], [3.2, 0]] } },
  { name: "umbrella twirl", duration: 3.0, prop: "handheld_canopy", tracks: {
    "rightArm.raise": [[0, 0], [0.4, 0.8], [2.6, 0.8], [3.0, 0]], "prop.spin": [[0, 0], [0.5, 0], [2.4, 2], [3.0, 2]],
    "body.sway": [[0, 0], [0.8, 0.4], [1.6, -0.4], [2.4, 0.4], [3.0, 0]], "head.tilt": [[0, 0], [0.6, 0.4], [2.4, 0.4], [3.0, 0]], "face.eyes": [[0, 0], [0.5, 1], [2.5, 1], [3.0, 0]] } },
  { name: "confetti cheer", duration: 2.4, prop: "launcher", events: [[1.0, "pop"]], tracks: {
    "rightArm.raise": [[0, 0], [0.5, 0.7], [0.9, 0.85], [1.1, 0.6], [2.0, 0.7], [2.4, 0]],
    "body.hop": [[0, 0], [0.9, 0], [1.1, 0.5], [1.35, 0], [2.4, 0]], "face.mouth": [[0, 0], [0.9, 0], [1.1, 0.8], [1.8, 0.4], [2.4, 0]], "face.eyes": [[0, 0], [1.1, 1], [2.0, 1], [2.4, 0]] } },
];

/** a thing to wear on his body that would sit inside his fleece where nobody can see it (nothing of it reaches past
 * his round body, or only a speck does): Nov 5's gold ring, a torus 0.4 across in the middle of him with a tiny star
 * just poking out the front */
export function hiddenInBody(recipe) {
  if (!recipe || recipe.archetype !== "body_wearable" || !Array.isArray(recipe.parts) || !recipe.parts.length) return false;
  const B = [0.66, 0.62, 0.64].map((r) => r * 1.15);   // (his fleece's puffs reach about this far: a bit just past them still doesn't show)
  return recipe.parts.every((p) => {
    const r = Math.max(...(p.size || [0])) / 2, a = p.at || [0, 0, 0];
    return ((Math.abs(a[0]) + r) / B[0]) ** 2 + ((Math.abs(a[1]) + r) / B[1]) ** 2 + ((Math.abs(a[2]) + r) / B[2]) ** 2 < 1;
  });
}
/** the same thing as one he holds up: shrunk to sit on his hoof (about 0.42 across, its middle at y = 0.14) */
export function asHeld(recipe) {
  const ps = recipe.parts || [];
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const p of ps) { const r = (p.size || [0, 0, 0]).map((x) => x / 2), a = p.at || [0, 0, 0]; for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], a[i] - r[i]); hi[i] = Math.max(hi[i], a[i] + r[i]); } }
  const span = Math.max(...hi.map((h, i) => h - lo[i])) || 1, k = Math.min(1.4, 0.42 / span), c = hi.map((h, i) => (h + lo[i]) / 2);
  const parts = ps.map((p) => ({ ...p, size: (p.size || []).map((x) => +(x * k).toFixed(3)), at: (p.at || [0, 0, 0]).map((x, i) => +((x - c[i]) * k + (i === 1 ? 0.14 : 0)).toFixed(3)),
    ...(p.points ? { points: p.points.map((q) => q.map((x, i) => +((x - c[i]) * k + (i === 1 ? 0.14 : 0)).toFixed(3))) } : {}) }));
  return { ...recipe, archetype: "handheld_tool", hold: "upright", parts };
}
