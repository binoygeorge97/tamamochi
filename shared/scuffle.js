/* Soft-toy throwing: Mochi and Cocoa throw water balloons, snowballs, confetti balls and foam balls at each other
 * (or at you, the viewer: it splats on the glass). Pure logic, shared by the server (to tell the brain what just
 * happened, so his words match the screen) and the kit (to play it).
 *
 * Who learns what: whoever gets hit says "Ouch!" and keeps a shield ready from then on, so the next throw at them
 * bounces off it. After two blocks they get cocky, put the shield away, and the next one gets them again. */

export const THROWABLES = ["water balloon", "snowball", "confetti ball", "foam ball"];
export const SHIELD = "toy shield";

// the thing they asked for, as one of his throwables. A grenade or a bomb is a confetti ball; anything that could
// hurt (a rock, a knife) becomes a soft foam ball.
const THING_WORDS = [
  [/\bwater[- ]?(balloons?|bombs?)\b|\bballoons?\b/, "water balloon"],
  [/\bsnow ?balls?\b|\bsnow\b/, "snowball"],
  [/\bconfetti( ?(balls?|bombs?))?\b|\bgrenades?\b|\bbombs?\b|\bparty ?(bombs?|poppers?)\b|\bglitter ?bombs?\b/, "confetti ball"],
  [/\b(foam ?balls?|dodge ?balls?|beach ?balls?|balls?|bean ?bags?|pillows?|rocks?|stones?|bricks?|knives|knife|sticks?|shoes?|eggs?|tomato(es)?)\b/, "foam ball"],
];
export const UNSAFE_THING = /\b(rocks?|stones?|bricks?|knives|knife|sticks?|grenades?|bombs?|shoes?|eggs?)\b/;
export function thingFor(text, month = new Date().getMonth()) {
  const t = String(text || "").toLowerCase();
  for (const [re, name] of THING_WORDS) if (re.test(t)) return name;
  return month === 11 || month <= 1 ? "snowball" : "water balloon";   // "throw something at Cocoa": a snowball in winter
}

const VERB = "(?:throw|throws|throwing|toss|tosses|tossing|chuck|chucks|lob|lobs|pelt|pelts|hurl|hurls|fling|flings)";
const HIT_VERB = "(?:hit|get|splash|soak|bonk|peg|pelt|pelts|nail|splat)";
const WHO = "(cocoa|mochi|mimi|me|you|him|her|us|yourself|each other)";
const NOT = /(?<!why )\b(don'?t|do not)\b|\b(stop|no more|never|quit|please no)\b/;
const NOT_PLAY = /\b(throw|throws|throwing|toss|tossing)(?: (?:it|them|that|this|those|these|her|my|your|his|the trash|the rubbish))? (up|away|out|a party|a fit|a tantrum|shade|in the towel|together|back|off|a curveball)\b|\bthrowback\b/;
// said to Mochi or Cocoa: "throw it at Cocoa", "Cocoa, throw a snowball at Mochi", "can you throw…", "tell Cocoa to throw…"
const ASKED = new RegExp([
  `^(?:(?:hey|ok|okay|now|please|go|quick|quickly|and|then|mochi|cocoa|yes|yeah|lol|haha)[ ,!]+)*${VERB}\\b`,
  `^(?:(?:hey|ok|okay|now|please|go|quick|and|then|mochi|cocoa|yes|yeah)[ ,!]+)*${HIT_VERB} ${WHO} with\\b`,
  `\\b(?:can|could|will|would|wanna|want to|gonna|going to|did|why don'?t) (?:you|cocoa|mochi|he)(?: please| just)? ${VERB}\\b`,
  `\\b(?:tell|make|let|have|get|ask|dare) (?:cocoa|mochi|him|you)(?: to)? ${VERB}\\b`,
  `\\bi dare you to ${VERB}\\b`,
  `\\b(?:cocoa|mochi),? (?:please |go |now )?${VERB}\\b`,
].join("|"));
const FIGHT = /\b(snow ?ball|water[- ]?balloon|confetti|foam[- ]?ball|dodge ?ball|pillow)s? (fight|war|battle)s?\b/;
const FIGHT_ASK = /^(?:(?:hey|ok|okay|yay|yes|ooh|omg)[ ,!]+)*(?:a |an )?\S+ ?\S* (?:fight|war|battle)!*$|\b(let'?s|lets|wanna|want to|can (?:you|we|you two|you guys)|start|time for|have a|do a|how about|go)\b/;
const EACH_OTHER = new RegExp(`\\b${VERB}\\b[^.?!]*\\b(at each other|at one another)\\b`);

/** "throw a water balloon at Cocoa" → { steps: [{ from: "mochi", at: "cocoa" }], thing: "water balloon", asked } or
 * null. at: "cocoa", "mochi", "mimi", "viewer", or null (he throws where they tap). A fight is three throws back and forth.
 * Mimi (Nov 7: "Throw it at mimi" had him wait for a tap, and Gemma said he missed her and hit Cocoa): she can be thrown
 * at; she squeals and giggles, and has no shield. */
export function throwIntent(text, { month } = {}) {
  const raw = String(text || "").toLowerCase().replace(/[’`]/g, "'");
  if (!raw.trim()) return null;
  for (const clause of raw.split(/[.?!\n;]+/).map((s) => s.trim()).filter(Boolean)) {
    if (NOT.test(clause) || NOT_PLAY.test(clause)) continue;
    const thing = thingFor(clause, month), asked = clause.match(UNSAFE_THING) ? clause.match(UNSAFE_THING)[0] : null;
    // a fight: "snowball fight!", "let's have a water balloon fight with Cocoa", "throw stuff at each other"
    if ((FIGHT.test(clause) && FIGHT_ASK.test(clause)) || (EACH_OTHER.test(clause) && ASKED.test(clause.replace(/\bat each other\b.*/, "")))) {
      return { steps: [{ from: "mochi", at: "cocoa" }, { from: "cocoa", at: "mochi" }, { from: "mochi", at: "cocoa" }], thing, asked, fight: true };
    }
    if (!ASKED.test(clause)) continue;
    const verbAt = clause.search(new RegExp(`\\b${VERB}\\b|\\b${HIT_VERB} ${WHO} with\\b`));
    const before = clause.slice(0, Math.max(0, verbAt));
    const atM = clause.match(new RegExp(`\\b(?:at|on) ${WHO}\\b`)) || clause.match(new RegExp(`\\b${HIT_VERB} ${WHO} with\\b`));
    let target = atM ? atM[1] : null;
    // who throws: Cocoa when he's told to ("Cocoa, throw…", "tell Cocoa to throw…"), else Mochi
    const from = /\bcocoa\b/.test(before) && target !== "cocoa" ? "cocoa" : "mochi";
    const other = from === "mochi" ? "cocoa" : "mochi";
    let at;
    if (target === "mimi" || target === "her") at = "mimi";
    else if (target === "cocoa" || target === "mochi") at = target === from ? null : target;
    else if (target === "him") at = other;
    else if (target === "me" || target === "us") at = "viewer";
    else if (target === "you") at = from === "cocoa" ? "mochi" : "viewer";
    else if (target === "each other") return { steps: [{ from: "mochi", at: "cocoa" }, { from: "cocoa", at: "mochi" }, { from: "mochi", at: "cocoa" }], thing, asked, fight: true };
    else at = from === "cocoa" ? "mochi" : null;   // Cocoa throws at his buddy; Mochi waits for a tap
    // "throw" with nothing to throw and nobody to throw at isn't a throw ("throw it in the bin")
    if (!at && !THING_WORDS.some(([re]) => re.test(clause)) && !/\b(something|anything|one|it)\b/.test(clause)) continue;
    if (!at && /\b(in|into|on|onto|over|across|out|away|down) (the|a|my|your)\b/.test(clause) && !THING_WORDS.some(([re]) => re.test(clause))) continue;
    return { steps: [{ from, at }], thing, asked, fight: false };
  }
  return null;
}

export const newGuard = () => ({ mochi: 0, cocoa: 0, blocks: { mochi: 0, cocoa: 0 }, n: 0 });
export function cleanGuard(g) {
  const x = newGuard();
  if (!g || typeof g !== "object") return x;
  for (const k of ["mochi", "cocoa"]) { x[k] = g[k] ? 1 : 0; x.blocks[k] = Math.max(0, Math.min(3, +(g.blocks && g.blocks[k]) || 0)); }
  x.n = Math.max(0, Math.min(1e6, +g.n || 0));
  return x;
}
const LINES = {
  hit: [["Ouch!", "Shield next time!"], ["Ow! Hey!", "Okay, I'm getting my shield."], ["Ouch! No fair!", "Next time I'll be ready!"]],
  block: [["Ha! Missed me!"], ["Blocked!"], ["Nope! Shield!"]],
  cocky: [["Ha! Too easy!", "Don't even need this."], ["Blocked again!", "I'm unstoppable!"]],
  splat: [["Gotcha!"], ["Hehe, splat!"], ["Got you!"]],
  miss: [["Wheee!"]],
  mimi: [["Eep!", "Mochi! My bow! …hehe ♡"], ["Kyaa! Cold!", "Hmph! …okay, that was a little funny ♡"], ["Eep! Mochi!", "You're SO getting a hug for that ♡"]],
};
const pick = (kind, n) => LINES[kind][n % LINES[kind].length];

/** Play out the throws against who's ready with a shield. Returns { plan: [{ from, at, outcome, says, shield }],
 * guard } where outcome is "hit" | "block" | "cocky" (blocked, then puts the shield away) | "splat" (on the glass) |
 * "land" (where they tapped), says is what the one on the receiving end says (or the thrower, for a splat), and
 * shield whether the target has a shield up for it. The guard passed in is not changed. */
export function planThrows(steps, guard) {
  const g = cleanGuard(guard), plan = [];
  for (const s of steps || []) {
    const from = s.from === "cocoa" ? "cocoa" : "mochi", at = ["cocoa", "mochi", "mimi", "viewer"].includes(s.at) && s.at !== from ? s.at : null;
    const n = g.n++;
    if (!at) { plan.push({ from, at: null, outcome: "land", says: [], shield: false }); continue; }
    if (at === "mimi") { plan.push({ from, at, outcome: "hit", says: pick("mimi", n), shield: false }); continue; }   // (no shield: she squeals and giggles)
    if (at === "viewer") { plan.push({ from, at, outcome: "splat", says: pick("splat", n), shield: false }); continue; }
    if (g[at]) {
      g.blocks[at]++;
      if (g.blocks[at] >= 2) { g[at] = 0; g.blocks[at] = 0; plan.push({ from, at, outcome: "cocky", says: pick("cocky", n), shield: true }); }
      else plan.push({ from, at, outcome: "block", says: pick("block", n), shield: true });
    } else {
      g[at] = 1; g.blocks[at] = 0;
      plan.push({ from, at, outcome: "hit", says: pick("hit", n), shield: false });
    }
  }
  return { plan, guard: g };
}

const NAME = { mochi: "you", cocoa: "Cocoa", mimi: "Mimi", viewer: "them (it splats on their screen)" };
/** What the brain is told happened, in his words' terms ("you" is Mochi). */
export function throwNote(plan, thing, { asked = null } = {}) {
  const swap = asked ? ` They asked for ${/^[aeiou]/.test(asked) ? "an" : "a"} ${asked}; in your world that's a ${thing}, soft and harmless.` : "";
  const lines = plan.map((p) => {
    const who = p.from === "mochi" ? "You threw" : "Cocoa threw", at = p.at ? ` at ${NAME[p.at]}` : "";
    const got = p.at === "mochi" ? "you" : "him";
    if (p.at === "mimi") return `${who} a ${thing} at Mimi: SPLAT, it got her (nobody else). She squealed "${p.says[0]}"${p.says[1] ? ` and then "${p.says[1]}"` : ""}. She isn't really cross.`;
    switch (p.outcome) {
      case "hit": return `${who} a ${thing}${at}: SPLAT, it got ${got}. ${p.at === "mochi" ? "You" : "He"} said "${p.says[0]}" and will have a shield ready next time.`;
      case "block": return `${who} a ${thing}${at}, but ${p.at === "mochi" ? "you" : "he"} blocked it with a shield ("${p.says[0]}").`;
      case "cocky": return `${who} a ${thing}${at}; blocked again ("${p.says[0]}"), and now ${p.at === "mochi" ? "you're" : "he's"} so cocky the shield is going away.`;
      case "splat": return `${who} a ${thing}${at}.`;
      default: return `${who === "You threw" ? "You're holding" : "Cocoa is holding"} a ${thing}, waiting for them to tap where it should go. Nothing has been thrown or hit yet: don't say it hit anyone or missed.`;
    }
  });
  return `On screen just now: ${lines.join(" ")}${swap} It's all soft and silly: play along in your reply.`;
}

/* ---------------------------------------------------------------- water fights (Nov 4)
 * Binoy: "have a water gun fight with cocoa" fired once into the air and Cocoa only talked about it; and "it would be
 * interesting if sometimes cocoa could pull out his own water gun and have a fun little fight with mochi". A water
 * fight: Cocoa pulls out his own water gun (teal, like his bandana), they take turns squirting, the one squirted at
 * sometimes dodges (he really steps out of the way and it splashes where he was), and it ends in a truce. */
const WATER_FIGHT = /\b(?:water|squirt|spray)[- ]?(?:guns?|pistols?|blasters?|squirters?|shooters?)?\s*(?:fight|war|battle|duel|showdown)s?\b|\b(?:squirt|spray|soak)(?:ing)? (?:each other|one another)\b|\bwater[- ]?gun (?:game|fun|time)\b/;
export function waterFightIntent(text) {
  const t = String(text || "").toLowerCase().replace(/[’`]/g, "'");
  if (!WATER_FIGHT.test(t) || /\bballoons?\b/.test(t)) return null;   // a water balloon fight is a throwing fight
  if (/(?<!why )\b(don'?t|do not)\b|\b(stop|no more|never|quit|enough)\b/.test(t)) return null;
  if (/\b(i|we|he|they|you) (had|won|lost|did)\b/.test(t) && !/\b(let'?s|another|again|wanna|want to)\b/.test(t)) return null;   // telling, not asking
  return { with: "cocoa", starter: /\bcocoa\b[^.?!]*\b(start|go first|begin)/.test(t) ? "cocoa" : "mochi" };
}
const WET = {
  cocoa: { hit: ["Hey! I'm soaked!", "Pfft! Right in the bandana!", "Oh, it's ON now!", "My fluff! Hahaha!"], dodge: ["Missed me, bro!", "Too slow, dude!", "Ha! Nope!"] },
  mochi: { hit: ["Eep! Cold!", "Hehe, you got me!", "Splash! No fair!", "Wahh, my wool!"], dodge: ["Whoa! Missed!", "Hehe, too slow!", "Nope, nope!"] },
};
/** The fight, worked out in advance so the brain can be told what happens: 4–6 squirts taking turns (whoever starts),
 * about one in three dodged, each of them gets wet at least once, then a truce. rnd: () => 0..1 (tests pass their own). */
export function planWaterFight({ starter = "mochi", rnd = Math.random, ambush = null } = {}) {
  const n = 4 + Math.floor(rnd() * 3), shots = [];
  let from = starter === "cocoa" ? "cocoa" : "mochi";
  // he starts it: he calls Cocoa over and gets him as he arrives; the time after, Cocoa comes with his shield up
  if (ambush && from === "mochi") { shots.push({ from: "mochi", at: "cocoa", outcome: ambush.shield ? "block" : "hit", says: ambush.shield ? "Ha! Not this time, bro!" : "Hey!! No fair, dude!", ambush: true }); from = "cocoa"; }
  const wet = { mochi: 0, cocoa: 0 }, said = { mochi: { hit: Math.floor(rnd() * 4), dodge: Math.floor(rnd() * 3) }, cocoa: { hit: Math.floor(rnd() * 4), dodge: Math.floor(rnd() * 3) } };
  if (shots.length && shots[0].outcome === "hit") wet.cocoa++;
  for (let i = shots.length; i < n; i++) {
    const at = from === "mochi" ? "cocoa" : "mochi", last = i >= n - 2;
    const dodge = !(last && !wet[at]) && rnd() < 0.36, kind = dodge ? "dodge" : "hit";
    if (!dodge) wet[at]++;
    const lines = WET[at][kind];
    shots.push({ from, at, outcome: kind, says: lines[said[at][kind]++ % lines.length] });   // (no line twice in a row)
    from = at;
  }
  return { starter: shots[0].from, shots, ambush: shots[0].ambush ? { shield: shots[0].outcome === "block" } : null,
    start: starter === "cocoa" ? ["Surprise, dude!", "Hehe… I've got one too!"] : ["Oh, you want a water fight? Say no more!", "Bring it, dude!"], truce: { mochi: "Okay, okay, truce!", cocoa: "Truce! …for now, bro." }, wet };
}
/** What the brain is told happened. */
export function waterFightNote(fight) {
  const who = (x) => (x === "mochi" ? "you" : "Cocoa");
  const lines = fight.shots.filter((s) => !s.ambush).map((s) => `${s.from === "mochi" ? "You squirt Cocoa" : "Cocoa squirts you"}: ${s.outcome === "hit" ? `got ${s.at === "mochi" ? "you" : "him"}` : `${who(s.at)} dodged it`}.`);
  const A = fight.ambush ? (fight.ambush.shield ? "You call Cocoa over and squirt him by surprise as he arrives, but he's learned: he comes in with his shield up and it splashes right off. Then he pulls out his own water gun (teal, like his bandana)." : "You call Cocoa over and squirt him by surprise as he arrives (got him!). Then he pulls out his own water gun (teal, like his bandana).") : null;
  return `On screen just now: a water fight with Cocoa! ${A || (fight.starter === "cocoa" ? "Cocoa snuck up with his own water gun and started it, and you both have one." : "Cocoa pulled out his own water gun (teal, like his bandana), and you both have one.")} ${lines.join(" ")} Then you call a truce. It's all wet and silly: say something short and playful as it starts. Cocoa says his own lines on screen; don't write lines for him.`;
}
