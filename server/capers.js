// Capers: little fun stories around a prop or a move (Binoy, Nov 3: "when I tell him to create a bazooka and after
// he gets the prop he is like 'let me call Mimi and as soon as she comes I am going to shoot the bazooka at her', and
// then the story can continue like 'Mimi gets annoyed and shouts at him' or 'Mimi blocks it with a shield'").
//
// A caper is 3–6 scenes the page can act out with the kit's own abilities (a friend comes, he uses the prop on them,
// they answer, block, laugh, copy a move, storm off, throw one back). Gemma writes the scenes from the prop, the
// friends and what happened before (so a cross Mimi stays cross); a hand-written one stands in when the model is down.
// What happens leaves marks: "Mimi stormed off" becomes a plan to make it up to her, and the brain hears all of it.
//
// Scene shape: { who: "mochi"|"mimi"|"cocoa", do: DO, who2?: "mimi"|"cocoa", line?: string }
//   call      who2 comes over (mochi says line)
//   say       mochi says line
//   use_on    mochi uses the prop at/on who2 (squirts, throws, shows; the kit adds the hit)
//   use       mochi uses the prop (fires it in the air, rides it, waves it)
//   show      mochi holds the prop up to who2
//   move      mochi does the move (with the prop if it's one he uses it with)
//   friend_say who says line
//   react     who reacts: how = laugh | annoyed | block | copy | throw_back | hug | leave | dance
import { stripActions } from "./brain.js";
import { narrated } from "../shared/speech.js";
import { PROP_EXAMPLES } from "../shared/craft.js";
import { momentOfDay, spice, tooLike, seedNow, wobble } from "./variety.js";
const DO = ["call", "say", "use_on", "use", "show", "move", "friend_say", "react", "activity"];
const HOW = ["laugh", "annoyed", "block", "copy", "throw_back", "hug", "leave", "dance", "paint", "juggle", "trick"];
const ACT = ["paint", "juggle", "trick"];
const Name = (w) => (w === "mimi" ? "Mimi" : "Cocoa");

export const SCENE_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    title: { type: "string" },
    scenes: { type: "array", minItems: 3, maxItems: 6, items: { type: "object", additionalProperties: false,
      properties: { who: { type: "string", enum: ["mochi", "mimi", "cocoa"] }, do: { type: "string", enum: DO }, who2: { type: "string", enum: ["mimi", "cocoa", ""] }, how: { type: "string", enum: [...HOW, ""] }, line: { type: "string" } },
      required: ["who", "do", "who2", "how", "line"] } },
  },
  required: ["title", "scenes"],
};

const FRIENDS = `Mimi is his girlfriend: sweet, a big pink bow, says "eep!" and "hehe", adds ♡ sometimes, giggles when he's silly, gets a bit cross ("Mochi! Hmph.") when he's too wild and may storm off, forgives him for a hug. Cocoa is his best buddy: a brown sheep with a teal bandana, sporty and goofy, says "dude" and "bro", loves a water fight, blocks with a shield or throws one right back, never really angry.`;

const aimable = (arch) => arch === "launcher" || arch === "throwable";

/** a hand-written caper for when the model can't write one */
export function fallbackCaper({ prop = null, move = null, premise = "", history = [] } = {}) {
  const act = /\b(paint|draw|portrait|picture)\b/i.test(premise) ? "paint" : /\bjuggl/i.test(premise) ? "juggle" : /\b(trick|magic)\b/i.test(premise) ? "trick" : null;
  if (act) {
    const w = /cocoa/i.test(premise) ? "cocoa" : "mimi";
    return { title: act === "paint" ? `a portrait of ${Name(w)}` : act === "juggle" ? `juggling for ${Name(w)}` : `a magic show for ${Name(w)}`, scenes: [
      { who: "mochi", do: "call", who2: w, line: `${Name(w)}! Sit still a sec!` },
      { who: w, do: "friend_say", line: w === "mimi" ? "Ooh, what are you doing? ♡" : "Uh… okay, dude?" },
      { who: "mochi", do: "activity", how: act, who2: w, line: act === "paint" ? `${Name(w)}'s portrait` : "" },
      { who: w, do: "react", how: w === "mimi" ? "hug" : "laugh", line: w === "mimi" ? "I love it! ♡" : "Haha, epic!" },
    ] };
  }
  const cross = history.some((h) => /mimi.*(cross|annoyed|stormed)/i.test(h));
  const who = /cocoa/i.test(premise) ? "cocoa" : /mimi/i.test(premise) ? "mimi" : cross ? "cocoa" : Math.random() < 0.55 ? "mimi" : "cocoa";
  const other = who === "mimi" ? "cocoa" : "mimi";
  if (move) return { title: `showing off my ${move.name}`, scenes: [
    { who: "mochi", do: "call", who2: who, line: `${Name(who)}! Come see what I learned!` },
    { who: "mochi", do: "move", line: "Watch this…" },
    { who, do: "friend_say", line: who === "mimi" ? "Ooh! Do it again! ♡" : "Whoa. Okay, my turn, bro." },
    { who, do: "react", how: "copy", line: "" },
    { who: "mochi", do: "say", line: who === "mimi" ? "You're a natural, Mimi!" : "Not bad, Cocoa. Not bad." },
  ] };
  const p = prop || { name: "thing", archetype: "handheld_tool" };
  if (aimable(p.archetype)) {
    const end = who === "mimi" ? (Math.random() < 0.5 ? [{ who: "mimi", do: "react", how: "annoyed", line: "Mochi! My bow! Hmph!" }, { who: "mochi", do: "say", line: "Oops… too much?" }] : [{ who: "mimi", do: "react", how: "laugh", line: "Eep! Hehe, you got me!" }, { who: "mochi", do: "say", line: "Gotcha!" }])
      : [{ who: "cocoa", do: "react", how: "block", line: "Ha! Shield, bro!" }, { who: "cocoa", do: "react", how: "throw_back", line: "My turn!" }, { who: "mochi", do: "say", line: "Hey! Okay, okay, truce!" }];
    return { title: `the ${p.name} ambush`, scenes: [
      { who: "mochi", do: "say", line: `Hehe. I have a plan for my ${p.name}…` },
      { who: "mochi", do: "call", who2: who, line: `${Name(who)}! Come here a sec!` },
      { who: "mochi", do: "use_on", who2: who, line: "Surprise!" }, ...end,
    ] };
  }
  if (p.archetype === "ride" && /\b(car|truck|jeep|kart|van|bus|convertible|buggy)s?\b/i.test(p.name)) return { title: `a drive with ${Name(who)}`, scenes: [
    { who: "mochi", do: "say", line: `Vroom vroom! Who wants a ride?` },
    { who: "mochi", do: "call", who2: who, line: `${Name(who)}! Hop in!` },
    { who: "mochi", do: "use_on", who2: who, line: "Buckle up!" },
    { who, do: "friend_say", line: who === "mimi" ? "Wheee! Not so fast! ♡" : "Faster, dude! Faster!" },
    { who: "mochi", do: "say", line: "Best road trip ever." },
  ] };
  if (p.archetype === "ride") return { title: `a ride on my ${p.name}`, scenes: [
    { who: "mochi", do: "use", line: "Wheee!" },
    { who: "mochi", do: "call", who2: "cocoa", line: "Cocoa! Race you!" },
    { who: "cocoa", do: "friend_say", line: "You're on, dude!" },
    { who: "cocoa", do: "react", how: "dance", line: "" },
    { who: "mochi", do: "say", line: "I win! …I think." },
  ] };
  return { title: `showing ${Name(who)} my ${p.name}`, scenes: [
    { who: "mochi", do: "call", who2: who, line: `${Name(who)}, look what I've got!` },
    { who: "mochi", do: "show", who2: who, line: `My very own ${p.name}!` },
    { who, do: "friend_say", line: who === "mimi" ? "So cute! Can I try? ♡" : "Sweet. Does it do anything?" },
    { who: "mochi", do: "use", line: "Like this!" },
    { who, do: "react", how: who === "mimi" ? "hug" : "laugh", line: "" },
    ...(Math.random() < 0.4 ? [{ who: "mochi", do: "call", who2: other, line: `${Name(other)}, you too!` }] : []),
  ] };
}

/** ask the model for a caper; falls back to a hand-written one */
export async function writeCaper({ llm, prop = null, move = null, premise = "", history = [], facts = [], redirect = "", recent = [], memory = null, rnd = Math.random, log = console }) {
  const fb = () => fallbackCaper({ prop, move, premise, history });
  if (!llm) return fb();
  const thing = prop ? `his ${prop.name} (a ${prop.archetype.replace("_", " ")}${aimable(prop.archetype) ? ": it can be fired or thrown at someone, which gets them wet or covered in confetti, all in fun" : prop.archetype === "ride" ? (/\b(car|truck|jeep|kart|van|bus|convertible|buggy)s?\b/i.test(prop.name) ? ": he drives it, and use_on gives a friend a ride in the back seat" : ": he can ride it") : prop.archetype.includes("wearable") ? ": he wears it" : ": he holds it"})` : move ? `the move he just learned, "${move.name}"` : "something he'd love to do with his friends";   // (an idea of his own: "paint Mimi's portrait")
  // fresh each time (variety.js): the real day, a twist not used lately, the recent ones to steer away from; and if it
  // still comes back like one of those, once more with another twist
  for (let attempt = 0; attempt < 2; attempt++) try {
    const twist = spice(memory, "caper", rnd);
    const r = await llm.chat({ what: "caper", maxTokens: 500, temperature: wobble(attempt ? 1.0 : 0.85, rnd), seed: seedNow() + attempt, schema: SCENE_SCHEMA, schemaName: "caper",
      system: `You write tiny stage plays for Mochi, a small cheerful chibi sheep on someone's screen, and his two friends. ${FRIENDS} Everything is soft and silly; nobody really gets hurt. Write 3 to 6 scenes a child would enjoy, each one line long, in plain words. Use only these scene types: call (a friend comes over; who2 says which), say, use_on (he uses the prop on who2), use, show (to who2), activity (he really does something: how = paint, with line = what he paints, e.g. "Mimi's portrait"; how = juggle; how = trick, a party trick), move, friend_say (who = the friend), react (who = the friend; how = laugh, annoyed, block, copy, throw_back, hug, leave or dance). Lines under 70 characters. End with a little consequence: a friend cross and storming off, a friend hugging him, a water fight, a friend copying the move. Keep who2 and how empty when they don't apply. Give it a short playful title.`,
      user: `The caper is about ${thing}.${premise ? ` The idea: ${premise}.` : ""}${redirect ? ` The person watching asked for this to happen next: ${redirect}.` : ""}${history.length ? ` What happened before (keep it consistent): ${history.slice(-4).join("; ")}.` : ""}${facts.length ? ` About the person watching: ${facts.slice(0, 3).join("; ")}.` : ""} ${momentOfDay()} Work in this twist: ${twist}.${recent.length ? ` Recent capers (make this one different: other events, other lines): ${recent.slice(-4).join(" | ")}.` : ""}` });
    const j = r.json || (r.text ? JSON.parse(String(r.text).replace(/^```json|```$/g, "")) : null);
    const scenes = (j && Array.isArray(j.scenes) ? j.scenes : []).map((s) => ({
      who: ["mochi", "mimi", "cocoa"].includes(s.who) ? s.who : "mochi", do: DO.includes(s.do) ? s.do : "say",
      who2: ["mimi", "cocoa"].includes(s.who2) ? s.who2 : undefined, how: HOW.includes(s.how) ? s.how : undefined, line: stripActions(String(s.line || "")).text.replace(/^["“]|["”]$/g, "").slice(0, 90) }))   // words only: no (stage directions)
      .map((s) => { const fl = /^(mimi|cocoa)\s*:\s*(.+)$/i.exec(s.line); if (fl && s.who === "mochi") { s.who = fl[1].toLowerCase(); s.do = s.do === "react" ? "react" : "friend_say"; s.line = fl[2].replace(/^["“]|["”]$/g, ""); }   // "Mimi: Eep!" in his line is her line
        { const n = s.who !== "mochi" && ["friend_say", "react"].includes(s.do) && narrated(s.line, s.who); if (n) { s.do = "react"; s.how = n.act === "hug" ? "hug" : n.act === "dance" ? "dance" : n.act === "wave" ? "leave" : "laugh"; s.line = ""; } }   // (a friend narrating: acted out, Nov 7)
        if (s.do === "use_on" && !prop) { s.do = "move"; }   // a move caper: he does the move for them
        if (s.do === "activity" && !ACT.includes(s.how)) s.how = "trick";
        if (s.do === "friend_say" && s.who === "mochi") s.who = s.who2 || "mimi"; if (s.do === "react" && s.who === "mochi") s.who = s.who2 || "mimi"; if ((s.do === "call" || s.do === "use_on" || s.do === "show") && !s.who2) s.who2 = s.who !== "mochi" ? s.who : "mimi"; if (s.do === "react" && !s.how) s.how = "laugh"; return s; })
      .filter((s) => s.do !== "say" || s.line).slice(0, 6);
    if (scenes.length >= 3) {
      const out = { title: String(j.title || "a little caper").slice(0, 60), scenes };
      if (attempt === 0 && tooLike(caperText(out), recent)) { log.log && log.log(`[story] caper "${out.title}" came out like a recent one; another go`); continue; }
      return out;
    }
    log.warn && log.warn("[story] caper: model gave too few scenes; using a hand-written one");
    break;
  } catch (e) { log.warn && log.warn("[story] caper:", e.message); break; }
  return fb();
}

/** a caper as words, to compare with others */
export const caperText = (c) => `${c.title || ""}: ${(c.scenes || []).map((s) => s.line).filter(Boolean).join(" / ")}`;

/** one line for the log/scrapbook about how a scene went */
export function sceneLog(scene, { prop = null, move = null } = {}) {
  const thing = String(prop ? prop.name : move ? move.name : "it").replace(/^(my|your|his|the)\s+/i, "");   // (a move taught as "my move": "showed Mimi my move", not "my my move")
  switch (scene.do) {
    case "activity": return scene.how === "paint" ? `painted ${scene.line || "a picture"}${scene.who2 ? ` for ${Name(scene.who2)}` : ""}` : scene.how === "juggle" ? `juggled${scene.who2 ? ` for ${Name(scene.who2)}` : ""}` : `did a party trick${scene.who2 ? ` for ${Name(scene.who2)}` : ""}`;
    case "call": return `called ${Name(scene.who2)} over`;
    case "say": return `said "${scene.line}"`;
    case "use_on": return `${aimable(prop && prop.archetype) ? "fired" : "used"} my ${thing} at ${Name(scene.who2)}`;
    case "use": return `used my ${thing}`;
    case "show": return `showed ${Name(scene.who2)} my ${thing}`;
    case "move": return `did my ${thing}${scene.who2 ? ` for ${Name(scene.who2)}` : ""}`;
    case "friend_say": return `${Name(scene.who)} said "${scene.line}"`;
    case "react": return ({ laugh: `${Name(scene.who)} laughed`, annoyed: `${Name(scene.who)} got cross and stormed off`, block: `${Name(scene.who)} blocked it with a shield`, copy: `${Name(scene.who)} copied the move`, throw_back: `${Name(scene.who)} threw one right back`, hug: `${Name(scene.who)} gave me a hug`, leave: `${Name(scene.who)} went home`, dance: `${Name(scene.who)} danced` })[scene.how] || `${Name(scene.who)} reacted`;
    default: return "did something";
  }
}
/** the mark a finished caper leaves on later plans: null, or a want to add */
export function consequence(caper) {
  const cross = (caper.scenes || []).find((s) => s.do === "react" && s.how === "annoyed");
  if (cross) return { key: `mend:${cross.who}:${caper.id}`, kind: "free", text: `make it up to ${Name(cross.who)}`, why: `${cross.who === "mimi" ? "she" : "he"} was cross about my ${caper.thing || "caper"}`, who: cross.who, mend: true };
  return null;
}

/** The water guns for a water fight (Nov 4): his own water launcher if he made one (the newest), else the pocket water
 * pistol; Cocoa gets the pocket one (the kit paints it in his teal). */
export function waterGuns(memory) {
  const pocket = Object.values(PROP_EXAMPLES).flat().find((e) => e.name === "water pistol");
  const own = memory.props().filter((p) => p.archetype === "launcher" && p.recipe && p.recipe.ammo === "water" && !p.recipe.heavy).at(-1);
  return { gun: own ? { id: own.id, name: own.name, recipe: own.recipe } : { id: null, name: pocket.name, recipe: pocket }, cocoaGun: pocket };
}
/** one more water fight had (the story counts them: Cocoa remembers he owes him one) */
export function wetAgain(memory) { const w = memory.get("waterfights", null) || { n: 0 }; memory.set("waterfights", { ...w, n: (w.n || 0) + 1, last: new Date().toISOString() }); }
/** Mochi starting one calls Cocoa over and gets him as he arrives; once he's been got, Cocoa comes with his shield up
 * the next time (and the time after that, he forgets) */
export function ambushFor(memory) { const w = memory.get("waterfights", null) || {}; return { shield: (w.ambushes || 0) % 2 === 1 }; }
/** the page saw the surprise happen (Cocoa wasn't here yet) */
export function ambushed(memory) { const w = memory.get("waterfights", null) || { n: 0 }; memory.set("waterfights", { ...w, ambushes: (w.ambushes || 0) + 1 }); }
