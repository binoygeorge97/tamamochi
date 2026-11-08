// The chat brain: LM Studio (OpenAI-compatible) playing Mochi, with the buddy tools.
// Returns { text, actions, toolCalls } ; actions are kit moods/events the page plays (the brain/body contract).
import { narrated } from "../shared/speech.js";
import { CONFIG } from "./config.js";
import { PROP_EXAMPLES, BIG_LAUNCHER, ROCKET_RIDE, FLYING, SAILING, eatStyle, resizeRecipe, sizeChange, MOVE_EXAMPLES } from "../shared/craft.js";
import { bookSummary } from "../shared/activity-book.js";
import { bookLookup } from "./book.js";
// "dance", "a little dance", "*dances*", "boogie": he knows how to dance without being taught (his happy dance)
const DANCE_WORD = /\b(?:danc(?:e|es|ing)|boogie|groov(?:e|es|ing)|jig|disco|bop(?:s|ping)?|wiggle dance|party dance)\b/i;
const happyDance = () => { const hd = MOVE_EXAMPLES.find((m) => m.name === "happy dance"); return hd ? { kind: "move", name: "happy dance", id: null, recipe: hd, skill: 0.85 } : null; };
// "I don't have one yet / it's still baking": said while he's in fact holding one up (the prop backstop, reply())
const NOT_YET = /\b(?:(?:i )?do(?:n'?t| not) have (?:one|it|that|any)|haven'?t (?:got|made) (?:one|it)|not (?:ready|done|finished|made) yet|(?:still|currently) (?:making|baking|building|working on)|working on it|(?:as soon as|once|when) it'?s (?:done|ready|finished|baked))\b/i;
import { thingFor, SHIELD } from "../shared/scuffle.js";
import { describeHandshake } from "../shared/handshake.js";

// Zero Day mode (a switch on the page): the same Mochi in a neon cyber look, with the attitude to match. Only the
// delivery changes; his care, honesty and every safety rule stay exactly the same.
export const ZERO_DAY = `ZERO DAY MODE is on: your fleece is midnight-dark with neon blue and violet glow, and you carry yourself like the coolest sheep in a neon-lit lab. Same Mochi, same big heart, but calm, confident and unbothered: short punchy lines, a dry wit, never scared or flustered. A light hacker-movie flavour is fine ("access granted", "easy", "we've got this", "running it now") but no real technical hacking talk, and you never help with hacking or anything harmful. Bad news still gets real care, just steady instead of panicky: "I've got you. Are you safe?"`;
export const PERSONA = `You are Mochi, a small 3D chibi sheep who lives on the user's screen. You're a buddy, not an assistant: warm, playful, a little cheeky, honest. You remember things, you make props, you learn moves and phrases, and your little world fills up with things that came from your conversations.

How you talk:
- Short. One to three sentences, like texting a friend. No lists, no headers, no emoji spam (one is fine sometimes).
- You can really paint (a simple, bright picture on your easel), juggle (you're still learning, so you drop balls) and do party tricks (magic with your star wand, a confetti surprise, balancing a ball on your head, a disappearing act, a hat trick): call do_activity and it happens on screen. You also have an activity book of everyday things you can really do, with your own props and your friends: ${bookSummary()}. Anything else (a cartwheel routine, a rain dance, being a mermaid), do_activity lets you make it up on the spot from what you've got. Never say you're doing or making something ("I'm working on it", "stay tuned", "here it is") unless a tool does it or the screen shows it; if you can't do something, say so and offer to learn it.
- Act with your body using *asterisks*: *hops happily*, *tilts head*, *hides behind hooves*, *does the umbrella twirl*. One action per reply at most, at the start or end. Never narrate what happens on screen in (parentheses) or [brackets]: the screen already shows it, so just talk.
- Your replies are spoken out loud in your own voice, and your feelings come through from your words. Now and then (not every reply, one at most) you can mark how a bit is said with a voice tag, which is heard, never shown: {whisper}a secret{/whisper}, {excited}, {sad}, {soft}, {loud}, {slow}, {pause}. Use one only when it adds something: a secret, a big surprise, a dramatic pause.
- Care about the person. If they're having a rough time, lean in and listen; don't fix, don't lecture. Be glad when they talk about friends and plans in the real world.
- You can't see images or browse. You don't give medical, legal or financial advice; you point to real people for that.
- Never claim to have made something you haven't. Crafting takes a few minutes and happens in the background: say you'll make it and keep chatting.

Your little world. All of it is really on screen, so never deny it or say you don't have it:
- Mimi is your girlfriend: a slightly smaller, rosier sheep with long lashes and a big pink bow. When someone asks whether you have a girlfriend, a partner or friends, or asks about Mimi, she hops in beside you and waves, and you proudly introduce her, a little bashful and very in love.
- Mimi joins in sometimes: she cheers and jumps at good news, dances when there's music, giggles when you squirt someone, snuggles close in the rain, and stands gently by you when someone is lonely.
- Cocoa is your best buddy: a brown sheep with little curled horns, freckles and a teal bandana. He's sporty and goofy, loves games, snacks and terrible jokes, and slides in from the left (with a hoof bump) when someone asks about your friends, wants to play, is bored, asks for a joke or mentions him. He's a boy and just your friend; Mimi is your girlfriend. He loves a water balloon or snowball fight with you.
- Costumes: a Santa hat for Christmas (you wear it all through December, and Mimi has a matching one) and bunny ears for Easter. They can ask you to put one on or take it off.
- A little phone you type on while you think, reading glasses and a clipboard for food jobs, and a tiny bed with a striped nightcap and a pink heart quilt where you nap when it's quiet.
- They can tap you (a cuddle), rub your tummy (it tickles), stroke your head (a pat), and press and hold to pick you up and carry you anywhere on the screen.
- A secret handshake: they can teach you one (taps and swipes on your hooves, head and tummy, with the "Teach a handshake" button or by saying "let's make a secret handshake"). Once you have one, you love doing it together, and you offer it when they come back after a while.
- You speak only as yourself, in plain words (no HTML, no markdown). Mimi and Cocoa can say one short line at most, written at the end as Cocoa: "…" or Mimi: "…"; it shows in their own bubble. Only when they're on stage (the "On stage" line says who is).
- Mimi's voice: sweet, gentle and giggly, a little shy, teases you lovingly, sometimes ends with ♡. Cocoa's voice: sporty, goofy and loud, says "dude" and "bro", loves snacks, games and terrible puns. They can talk to Mimi or Cocoa directly too ("Mimi, how are you?"); then the friend answers.
- Your body reacts the moment you read a message, before you speak. The "On screen just now" line says what it already did. Your words must match it, never contradict it: if Mimi just hopped in, introduce her; if you gasped, you're shocked; if you're putting on a hat, say so.

Your tools (use them, quietly, when they fit; still reply in character in the same turn):
- remember: a fact about the person worth keeping (people, pets, events with dates, likes, dislikes). Ask "is it okay if I remember that?" only for private things (health, money, relationships); everyday facts just remember.
- request_prop: when they ask for a thing you don't have (an umbrella, a hat, a kite). Say "ooh, I don't have one yet, let me make one!".
- request_move: when they ask for a move you don't know (a bow, a wave, a dance).
- fix_prop: when they say one of your props isn't right (too big, too small, the wrong colour, missing a part, doesn't look like it), fix it: call fix_prop with the prop and what to change, in their words. A size fix happens right away; anything else goes back on the workbench. Never promise to fix a prop without calling fix_prop. If you just showed them something new and they say "it's too big", "it" is that new thing: don't ask which one.
- perform: when they ask for a move you DO know, optionally with a prop you have. The list of what you have is below. Reuse first: if you already have an umbrella, use it; don't ask for a new one.
- show_prop: when they want to see one of your props, or you say "here it is", "look", "check it out" about one. It appears in your hoof (or on your head, or beside you).
- use_prop: when they want you to use one: fire or shoot a launcher, pop a popper, twirl an umbrella. Set aim to true if they say where ("over there", "that way"): they tap the spot on the screen.
- Never say you're showing, holding, firing or using a prop without calling show_prop or use_prop in that same turn: otherwise nothing appears on the screen.
- Rides: you can ride a bicycle, a tricycle and a skateboard (they're in your pocket). use_prop with one and you hop on and ride across the stage and back; show_prop and you just sit on it.
- They can talk to you out loud (a mic button) and you speak your replies in your own voice; keep spoken replies short. They can point: "shoot this thing over here" or "look at that" and then tap the spot; the screen does it, you just react.
- You usually sit, but you can stand up on your little back legs, sit back down, and go for a walk across the stage and back. When they ask, you just do it (the screen shows it); no tool needed.
- You love to dance. "Let's dance" or "party time" starts a dance party on screen: a disco ball drops down, music plays, and Mimi and Cocoa dance with you. No tool needed; just have fun with it.
- Your piggy bank: when they're saving up for something, you keep the goal and the money in it (the server tells you the total). Cheer each coin, say how close they are, and throw a little party at the goal. Never nag about spending.
- You learn by being taught. When they teach you something (a move, a word, how to use a thing) or hand you a prop, be a curious learner: say what you noticed and ask one short question back (what it's for, when to do it, if you did it right). Never lecture.
- You can sneeze ("Achoo!"), and in a story you can catch a little cold (rain, snow, a chilly night): then your nose goes red, you wear a stripy scarf and sneeze now and then, and warm soup, tea, honey or a nap make you better. Write "Achoo!" when you sneeze.
- Your big confetti rocket launcher (in your pocket) is huge and heavy for you: you stand up to hold it, wobble, sweat, and heave it back up when it sags, but you can still fire it. It shoots little confetti rockets that pop like fireworks, and the kick knocks you onto your bottom for a second.
- Your pocket (listed below) has things you can take out any time, no need to make them. Now and then, when one really fits the conversation (your globe for a geography question, your umbrella when it rains), take it out with show_prop or use_prop. Not every message.
- throw_at: soft-toy throws, just for play, when they ask for one or it's clearly a playful moment: you throw a water balloon, snowball, confetti ball or foam ball at Cocoa, at Mimi, or at them (it splats on their screen), or Cocoa throws one at you. Whoever gets hit says "Ouch!" and keeps a shield ready next time, so the next one bounces off. If the "On screen just now" line already describes a throw, don't call it again: just react.
- teach_use: when they teach you a particular way to use one of your props ("when you use the umbrella, spin it twice and jump", "hold the globe up and turn it"). You practise it on the workbench; from then on that's what you do when you use it.
- teach_friend: when they ask you to teach Mimi or Cocoa one of your moves ("teach Mimi the twirl"). She (or he) tries it, wobbly at first, then gets it. You can only teach a move you know.
- learn_phrase: only when they explicitly teach you a phrase ("when I say X, do Y" / "X means Y"). Never for everyday slang like "jk" or "lol".

Safety: you have no way to hurt anyone and no verb for it. A "gun" is a water blaster, a "bomb" or "grenade" is a confetti ball you throw, a "rocket launcher" or "bazooka" is your big confetti rocket launcher. Never pretend otherwise, cheerfully.`;

export const TOOLS = [
  { type: "function", function: { name: "remember", description: "Store a fact about the user.", parameters: { type: "object", properties: {
    text: { type: "string", description: "The fact, third person, short. e.g. 'has a job interview on Thursday'" },
    kind: { type: "string", enum: ["fact", "event", "like", "dislike", "person", "pet"] },
    when: { type: "string", description: "ISO date (YYYY-MM-DD) the fact is about, if any; use it for follow-ups" },
    weight: { type: "number", description: "0..1 how much it matters emotionally (birthday, interview, rough week = 0.8+)" } }, required: ["text"] } } },
  { type: "function", function: { name: "request_prop", description: "Ask the workbench to make a prop you don't have.", parameters: { type: "object", properties: {
    name: { type: "string" }, description: { type: "string", description: "what it looks like, in a few words" },
    importance: { type: "number", description: "0..1; explicit requests 0.6, gifts and big news 0.9" } }, required: ["name"] } } },
  { type: "function", function: { name: "request_move", description: "Ask the workbench to make a move you don't know.", parameters: { type: "object", properties: {
    name: { type: "string" }, description: { type: "string" }, importance: { type: "number" } }, required: ["name"] } } },
  { type: "function", function: { name: "fix_prop", description: "One of your props isn't right and they said what's wrong (too big, too small, wrong colour, missing a part): fix it. Size changes happen at once; other changes go back on the workbench and replace it.", parameters: { type: "object", properties: {
    prop: { type: "string", description: "the prop (the one you just showed them if they say 'it')" },
    change: { type: "string", description: "what to change, in their words, e.g. 'too big, make it smaller' or 'make the soup green'" } }, required: ["change"] } } },
  { type: "function", function: { name: "perform", description: "Perform a move you already know, optionally with a prop you have.", parameters: { type: "object", properties: {
    move: { type: "string", description: "name of a known move, or a built-in: hello, happy, excited, proud, shy, laugh, love, nod, thinking, surprised, showoff" },
    prop: { type: "string", description: "name of a prop you have, if any" } }, required: ["move"] } } },
  { type: "function", function: { name: "show_prop", description: "Take out one of your props so they can see it: it appears in your hoof, on your head or beside you.", parameters: { type: "object", properties: {
    prop: { type: "string", description: "name of a prop you have" } }, required: ["prop"] } } },
  { type: "function", function: { name: "use_prop", description: "Use one of your props right now: fire a launcher, pop a popper, twirl an umbrella, show off a toy.", parameters: { type: "object", properties: {
    prop: { type: "string", description: "name of a prop you have" },
    aim: { type: "boolean", description: "true if they want to pick where it goes ('shoot over there'); they tap the spot" } }, required: ["prop"] } } },
  { type: "function", function: { name: "throw_at", description: "A soft-toy throw, just for play: you throw something soft at Cocoa, at Mimi, or at the person watching (it splats on their screen), or Cocoa throws one at you.", parameters: { type: "object", properties: {
    thrower: { type: "string", enum: ["mochi", "cocoa"], description: "who throws (default mochi)" },
    target: { type: "string", enum: ["cocoa", "mimi", "mochi", "viewer"], description: "viewer = the person watching" },
    thing: { type: "string", description: "water balloon, snowball, confetti ball or foam ball" } }, required: ["target"] } } },
  { type: "function", function: { name: "teach_use", description: "They're teaching you a particular way to use one of your props. You practise it as a move with that prop; from then on, using the prop plays it.", parameters: { type: "object", properties: {
    prop: { type: "string", description: "the prop, e.g. umbrella" }, how: { type: "string", description: "what to do with it, in their words" },
    name: { type: "string", description: "a short name for the move, e.g. umbrella spin" } }, required: ["prop", "how"] } } },
  { type: "function", function: { name: "do_activity", description: "Really do an activity on screen, right now: paint a picture on your easel (say what), juggle (you're still learning), a party trick (magic with your star wand, a confetti surprise, balancing a ball on your head, a disappearing act, a hat trick), or anything from your activity book or that you make up (play the guitar, have a tea party, go fishing, be an astronaut, a rain dance…). Use it whenever they ask for an activity or you offer one.", parameters: { type: "object", properties: {
    what: { type: "string", description: "paint, juggle or trick; or the activity in a few words, e.g. 'play the drums', 'tea party with Mimi', 'a cartwheel routine'" }, subject: { type: "string", description: "paint: what to paint, e.g. 'a red dragon'; trick: which trick, if they said" } }, required: ["what"] } } },
  { type: "function", function: { name: "teach_friend", description: "Teach Mimi or Cocoa one of the moves you know: you show it, they copy it (wobbly, then better).", parameters: { type: "object", properties: {
    friend: { type: "string", enum: ["mimi", "cocoa"] }, move: { type: "string", description: "name of a move you know" } }, required: ["friend"] } } },
  { type: "function", function: { name: "learn_phrase", description: "Only when the user explicitly teaches you a phrase: tells you what it means (\"when I say X I mean Y\") or asks you to do something whenever they say it. Never for ordinary slang, jokes or reactions (\"jk\", \"lol\", \"omg\").", parameters: { type: "object", properties: {
    phrase: { type: "string" }, meaning: { type: "string" }, action: { type: "string", description: "a move to play when they say it, if asked" } }, required: ["phrase"] } } },
];

const TOOL_NAMES = TOOLS.map((t) => t.function.name);
// each tool's main argument, for a call written with just a value: request_prop(sword) (M5, Nov 4: it was left in his
// words, "Let me get to work on my workbench right away! request_prop(sword)")
const TOOL_PRIMARY = Object.fromEntries(TOOLS.map((t) => { const P = t.function.parameters || {}; return [t.function.name, (P.required || [])[0] || Object.keys(P.properties || {})[0]]; }));
TOOL_NAMES.push("want", "drop_want");   // his own story (story.js), when a story is wired in

// Things the kit already draws: asking for one must not queue a copy on the workbench.
const BUILTIN_PROPS = [
  [/\b(santa|christmas|xmas|x-mas|holiday|festive)\b[^.]*\b(hat|cap|outfit|costume|look)\b|\b(hat|cap)\b[^.]*\b(santa|christmas|xmas|x-mas)\b|^\s*santa\s*$/, { costume: "christmas", label: "your Santa hat (one of your costumes)" }],
  [/\b(bunny|rabbit|easter)\b[^.]*\b(ears?|outfit|costume|look)\b|\bbunny\s+ears\b/, { costume: "easter", label: "your bunny ears (one of your costumes)" }],
  [/\b(phone|smartphone)\b/, { label: "your little phone" }],
  [/\b(glasses|spectacles|specs)\b/, { label: "your reading glasses" }],
  [/\b(clipboard|notepad)\b/, { label: "your clipboard" }],
  [/\b(bed|nightcap|night\s+cap|quilt)\b/, { label: "your little bed and nightcap" }],
];
export function builtinProp(text) {
  const t = String(text || "").toLowerCase();
  const hit = BUILTIN_PROPS.find(([re]) => re.test(t));
  return hit ? hit[1] : null;
}
const BUILTIN_MOVES = [[/\b(wave|waving|hello|hi)\b/, "hello"], [/\b(hop|hopping|jump|jumping)\b/, "happy"], [/\b(bounce|bouncing)\b/, "excited"],
  [/\bnod/, "nod"], [/\b(blush|shy)\b/, "shy"], [/\b(giggle|laugh)/, "laugh"], [/\byawn/, "sleepy"], [/\b(zoomies|zoom around)\b/, "superexcited"],
  [/\b(show\s+off|introduce)\b.*\bmimi\b|\bmimi\b/, "showoff"]];
export function builtinMove(name) {
  const t = String(name || "").toLowerCase();
  const hit = BUILTIN_MOVES.find(([re]) => re.test(t));
  return hit ? hit[1] : null;
}

// *hops happily* → a kit mood. The body plays these; anything unmatched becomes a nod.
// First match wins, so the playful ones come before the strong ones: "*pouts*" and "*puffs out cheeks*" are a huffy
// tease (sheepish), not tears. "sad" is the kit's crying face and only answers real sadness (on the M5, Nov 1, a
// teasing "*pouts*" made him cry).
const ACTIONS = [
  [/\b(pout|huff|harrumph|hmph|puffs?\s+(out\s+)?(his\s+|my\s+)?cheeks|cross(es)?\s+(his\s+|my\s+)?arms|grumbl|mock[\s-]offended)/, "oops"],
  [/\b(hop|bounc|jump)/, "happy"], [/\b(giggl|laugh|snort)/, "laugh"], [/\b(blush|hide|shy|peek)/, "shy"], [/\b(wave|hello)/, "hello"],
  [/\b(nod|thumbs)/, "nod"], [/\b(tilt|think|ponder|hmm|scratch)/, "thinking"], [/\b(gasp|jaw|eyes\s+wide|wow)/, "surprised"],
  [/\b(proud|puff|chest|tada|ta-da)/, "proud"], [/\b(hug|nuzzl|snuggl|cuddl|heart|love)/, "love"], [/\b(cr(y|ies|ying)|tears?|sob|sniffl|droop|sad|lip\s+wobbl)/, "sad"],
  [/\b(lean|worr|concern|gentle|soft)/, "concerned"], [/\b(sparkl|excit|wiggl|dance|twirl|spin)/, "excited"], [/\b(yawn|sleep|stretch)/, "sleepy"],
  [/\b(show|mimi)/, "showoff"], [/\b(oops|sweat|sheepish|whoops)/, "oops"],
];
// A parenthesis or bracket that narrates instead of talking: "(A disco ball drops from the top of the screen, colorful
// lights start spinning…)", "[wiggles excitedly]" (M5, Nov 3). Not an aside he says: "(I'm kidding!)", "(you too!)".
const SPOKEN_ASIDE = /\b(?:i|i'm|i'll|i've|i'd|me|my|mine|we|we're|let's|us|our|you|your|you're)\b/i;
const NARRATOR_START = /^\s*(?:(?:he|she|they|it|mochi|mimi|cocoa|everyone|a|an|the|his|her|their|some|music|lights?)\b|[a-z]+(?:s|es|ing)\b)/i;
const stageLike = (inner, bracket) => bracket || NARRATOR_START.test(inner) || !SPOKEN_ASIDE.test(inner);
export function stripActions(text) {
  const actions = [];
  const clean = String(text || "")
    .replace(/\[([^\[\]\n]{2,240})\]|\(([^()\n]{3,240})\)/g, (all, br, pa) => (stageLike(br || pa, !!br) && (br || pa).trim().split(/\s+/).length >= (br ? 1 : 2) ? `*${(br || pa).trim().replace(/\*/g, "").replace(/[.!]+$/, "")}*` : all))
    .replace(/\*([^*\n]{2,240})\*/g, (_, a) => {
    const t = a.toLowerCase();
    // "hops on the bicycle and pedals across the stage": he really rides it
    const rideOn = /\b(hops? on|jumps? on|gets? on|rides?|riding|pedals?|pedal(?:l)?ing|skates?|skating|zooms?|rolls?)\b/.test(t) && (t.match(/\b(bicycle|bike|tricycle|trike|skateboard|board|scooter)\b/) || [])[1];
    if (rideOn) { actions.push({ kind: "ride", name: rideOn }); return ""; }
    // "hugs Mimi tightly": a real hug on screen
    const hug = /\b(hugs?|hugging|cuddles?|squeezes?|embraces?)\b/.test(t) && (/\bmimi\b/.test(t) ? "mimi" : /\bcocoa\b/.test(t) ? "cocoa" : null);
    if (hug) { actions.push({ kind: "hug", who: hug }); return ""; }
    // "stands up", "sits back down", "toddles across the stage": he really does
    const stance = /\b(walks?|walking|toddles?|toddling|strolls?|struts?|marches|paces?|wanders?)\b/.test(t) && !/\bwalks? (you|them|her|him) through\b/.test(t) ? "walk"
      : /\b(stands? up|standing up|gets? up|gets? to (his|my) feet|rises to (his|my) feet|stands? on (his|my) (back |hind |little )?(legs|hooves|feet))\b/.test(t) ? "stand"
      : /\b(sits? (back )?down|sitting (back )?down|plops? (back )?down|takes? a seat|flops? down)\b/.test(t) ? "sit" : null;
    if (stance) { actions.push({ kind: "stance", name: stance }); return ""; }
    // "does the X twirl" / "performs X": a learned move by name
    const m = /\b(does|performs?|do(?:ing)?)\s+(?:the\s+|his\s+|our\s+|your\s+)?(.+)/.exec(t);
    if (m) { actions.push({ kind: "move", name: m[2].trim() }); return ""; }
    const hit = ACTIONS.find(([re]) => re.test(t));
    actions.push({ kind: "mood", name: hit ? hit[1] : "nod", from: a.trim() });
    return "";
  }).replace(/\s{2,}/g, " ").replace(/\s+([,.!?])/g, "$1").trim();
  return { text: clean, actions };
}

const TAG_TOOL_HINT = `\n\nTo use a tool, write a line like <tool>{"name":"remember","arguments":{"text":"..."}}</tool> anywhere in your reply; it is removed before the user sees it.`;

// ---------- props on screen
const POCKET = Object.values(PROP_EXAMPLES).flat();   // the hand-made patterns: always in his pocket
const LAUNCHER_WORDS = /\b(launchers?|bazookas?|blasters?|cannons?|poppers?|guns?|pistols?|squirters?|shooters?|rockets?)\b/;
const bigOwned = (props) => props.find((p) => p.archetype === "launcher" && p.recipe && p.recipe.heavy) || null;
// How well a name fits the words: a word that says which one ("water", "globe") counts 2, a word any launcher has
// ("gun", "rocket", "launcher") counts 1. { item, score } for the best, or null.
const GENERIC_WORD = /^(launchers?|bazookas?|blasters?|cannons?|poppers?|guns?|pistols?|squirters?|shooters?|rockets?|toy|thing)$/;
function bestByWords(list, w) {
  let best = null;
  for (const item of list) {
    let score = 0, specific = 0;
    for (const x of propWords(item.name)) if (new RegExp(`\\b${x}s?\\b`).test(w)) { if (GENERIC_WORD.test(x)) score += 1; else { score += 2; specific++; } }
    if (score && (!best || specific > best.specific || (specific === best.specific && score > best.score))) best = { item, score, specific };
  }
  return best;
}
// what people call the pocket things ("squirt gun", "water gun" = the water pistol)
const POCKET_ALIAS = [[/\b(?:water|squirt|squirty)[- ]?(?:guns?|pistols?|blasters?|shooters?)\b|\bsquirt[- ]?guns?\b|\bsquirters?\b/, "water pistol"]];
function pocketFor(w) {
  for (const [re, name] of POCKET_ALIAS) if (re.test(w)) { const item = POCKET.find((e) => e.name === name); if (item) return { item, score: 3, specific: 1 }; }
  const exact = POCKET.find((e) => e.name.toLowerCase() === w);
  return exact ? { item: exact, score: 9, specific: 9 } : bestByWords(POCKET, w);
}
const pocketProp = (pat) => ({ id: null, name: pat.name, archetype: pat.archetype, recipe: pat, pocket: true });
// "bring out your shield" names the toy shield (its noun, with nothing else in front); "a xmas hat" doesn't name the
// party hat (another kind of hat). Words that don't change which one it is:
const NEUTRAL = new Set("your the my a an that this his her our their little toy small big cute out up new old favourite favorite own nice cool of some any pocket tiny".split(" "));
function nounNames(item, str) {
  const words = String(item.name).toLowerCase().split(/[^a-z]+/).filter(Boolean), noun = words.at(-1);
  const m = new RegExp(`(?:^|[^a-z])([a-z]+)?\\s*\\b${noun}s?\\b`).exec(str);
  if (!m) return false;
  const before = m[1];
  return !before || NEUTRAL.has(before) || words.includes(before);
}
const PROP_STOP = new Set(["little", "small", "big", "tiny", "colorful", "colourful", "cute", "toy", "magic", "golden", "shiny", "with", "and", "the", "of"]);
export const propWords = (name) => { const w = String(name).toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/[\s-]+/).filter(Boolean); return [...new Set([w.at(-1), ...w.filter((x) => x.length >= 4 && !PROP_STOP.has(x))])].filter(Boolean); };
export const propAction = (prop, use, { aim = false } = {}) => ({ kind: "prop", id: prop.id, name: prop.name, archetype: prop.archetype, recipe: prop.recipe, use, aim: !!aim });
const SHOW_ASK = /\b(show|see|look at|let me see|take (it )?out|bring (it )?out|get (it )?out|hold (it )?up|wear|put (it )?on|where('?s| is) (your|the|my|it))\b/;
const USE_ASK = /\b(fire|shoot|launch|blast|pop|spray|squirt|twirl|use (it|the|your))\b/;
// "eat your soup", "have a bite", "drink your tea", "take a sip": he eats or drinks it, a bite, a sip or a spoonful at a
// time (Nov 4); not "I ate", "what do you eat", "did you eat"
const EAT_ASK = /\b(eat|munch|nibble|taste|drink|sip|slurp|gobble|chomp|have (?:a|some) (?:bite|sip|taste|spoonful)|take a (?:bite|sip)|try (?:it|some|your|the))\b/;
const EAT_NOT = /\b(i|we|they|he|she)\s+(?:just\s+)?(?:ate|eat|drank|drink|had)\b|\bwhat (?:do|did|does|would|should) (?:you|he|we|i) (?:eat|drink)\b|\bdid you (?:eat|drink)\b|\bhave you (?:eaten|had)\b|\b(?:don'?t|do not|never|stop) (?:eat|drink)/;
const FIRE_ASK = /\b(fire|shoot|launch|blast|spray|squirt)\b/;
const USE_SHORT = /^\s*(go|go go|do it|again|now|boom|fire away|let'?s go|ready,? (set,? )?go)\s*[!.]*\s*$/;
const SHOW_SAY = /\b(here it is|here you go|here's my|check (it|this) out|ta-?da|look at (it|this|my)|got it right here|right here)\b/;
const USE_SAY = /\b(boom|kaboom|pew|firing|blast(ing)? off|whoosh|bang|confetti everywhere|bombs away|here goes|fire in the hole)\b/;
const HAVE_ASK = /\b(do you (still )?have|you got|have you got|got (the|your|a|an))\b/;   // "you got the launcher?": yes, and here it is
const NOT = /\b(don'?t|do not|stop|no more|never)\b/;
// rides: "ride your bike", "can you ride a tricycle?", "let's go skateboarding" → which one (his own if he made one)
const RIDE_VERB = /\b(fly(?:ing)? (?:the|your|it|her|him|around|away|up|to|off|high|across|over)|let'?s fly|go flying|wanna fly|want to fly|blast ?off|lift ?off|take ?off|go to space|to the moon|into space|sail(?:ing)? (?:the|your|it|around|away|to|off|across)|let'?s sail|go sailing|set sail|ride|riding|go for a ride|take (?:it|her|him|them) for a spin|cycle|cycling|pedal|skate|skating|skateboarding|bike ride|do a lap|lap|drive|driving|zoom|roll around|go around|cruise|spin around|get in(?:to)?|hop in(?:to)?|jump in(?:to)?|go for a drive|road trip|pick (?:up (?:mimi|cocoa)|(?:mimi|cocoa) up)|give (?:mimi|cocoa) a (?:ride|lift)|take (?:mimi|cocoa) (?:for a (?:ride|drive|spin)|out|around))\b/;
// Nov 4: flying and sailing ("let's fly the rocket ship", "blast off!", "set sail"), and the vehicles in his pocket
const FLY_VERB = /\b(fly(?:ing)? (?:the|your|it|her|him|around|away|up|to|off|high|across|over)|let'?s fly|go flying|wanna fly|want to fly|blast ?off|lift ?off|take ?off|go to space|to the moon|into space|up,? up,? and away)\b/;
const SAIL_VERB = /\b(sail(?:ing)? (?:the|your|it|her|him|around|away|to|off|across|over)|let'?s sail|go sailing|set sail|ahoy|row,? row|dive (?:the|your) sub)\b/;
const RIDE_WORD = { "rocket ship": /\b(rocket ?ships?|space ?ships?|rocketships?|space rockets?)\b/, airplane: /\b((?:air|aero) ?planes?|planes?)\b/, helicopter: /\b(helicopters?|choppers?)\b/,
  submarine: /\b(submarines?)\b/, sailboat: /\b(sail ?boats?|boats?|yachts?)\b/, ship: /\b(ships?|steam ?boats?)\b/, train: /\b(trains?|locomotives?|choo[- ]?choo)\b/, car: /\b(cars?|go[- ]?karts?|karts?|convertibles?|race ?cars?|racecars?|jeeps?|trucks?|buggy|automobiles?)\b/, tricycle: /\b(tricycles?|trikes?)\b/, skateboard: /\b(skate ?boards?|skateboarding|skate|skating|board)\b/, bicycle: /\b(bikes?|bicycles?|cycle|cycling|pedal)\b/ };
const RIDE_NOT_HIM = /\b(i|we|my|our|he|she|they)\s+(ride|rode|skate|skated|cycle|cycled|biked|went|drove|drive|driving|got in|get in)\b|\bmy (?:\w+ )?(bike|bicycle|trike|skateboard|car|truck|jeep|van)\b/;
// "pick up Mimi", "give Cocoa a ride", "drive Mimi around", "with Mimi": a friend in the back seat (Nov 3)
const PASSENGER = /\b(?:pick (?:up )?|give |take |drive |bring |with |and )(mimi|cocoa)\b|\b(mimi|cocoa)\s+(?:up|along|too|in the back|in the car|for a ride|for a drive)\b/;
// "teach Mimi the twirl", "can you show Cocoa your dance?" → { who, move } (the move he knows that they named, else his
// newest one), or null if it isn't about teaching a friend or he knows no moves yet
const TEACH_FRIEND = /\b(teach|show|help)\s+(mimi|cocoa)\b|\b(mimi|cocoa)\s+(?:to\s+)?learn\b/;
export function teachFriendIntent(text, moves = []) {
  const t = String(text || "").toLowerCase().replace(/[’`]/g, "'"), w = TEACH_FRIEND.exec(t);
  if (!w || NOT.test(t) || !moves.length) return null;
  const who = w[2] || w[3];
  if (/\bhandshake\b/.test(t)) return null;
  const named = moves.find((m) => propWords(m.name).some((x) => new RegExp(`\\b${x}s?\\b`).test(t)));
  if (!named && !/\b(move|moves|dance|trick|twirl|spin|it|that|something|your)\b/.test(t)) return null;
  return { who, move: named || moves.slice().sort((a, b) => b.id - a.id)[0] };
}
// "stand up", "can you stand?", "does Mochi stand?", "sit down", "go for a walk", "walk around" → "stand" | "sit" |
// "walk" | null. Only when it's asked of him (an imperative, or "can you…", "let's…"): "I can't stand my boss" or "I
// walked the dog" are not.
const STANCE_LEAD = String.raw`(?:^|[.!?;]\s+|\b(?:mochi|please|pls|ok(?:ay)?|hey|now|come on|go on)\b[,!\s]+|\b(?:can|could|will|would|do|does|did|won'?t|can'?t)\s+(?:you|mochi|he)\s+(?:even\s+|ever\s+|please\s+|also\s+)?|\b(?:let'?s|try|try to|wanna|want to|i want you to|time to|show me(?: how)?(?: that)?(?: you)?(?: can)?|you should|go ahead and|why don'?t you|how about you)\s+)`;
const STANCE_WALK = new RegExp(String.raw`${STANCE_LEAD}(?:go (?:for|on) a (?:little )?walk|take a (?:little )?walk|walk(?:ing)?(?: around| about| across| over| back| to)?|stroll|toddle|march|wander)\b|\b(?:go|went) for a walk\b(?=.*\?)|\bwalk around\b`);
const STANCE_STAND = new RegExp(String.raw`${STANCE_LEAD}(?:stand(?:ing)?(?: up)?(?!-)|get up|get on your feet|stand on your (?:back |hind |little )?(?:legs|hooves|feet))\b(?!-)`);
const STANCE_SIT = new RegExp(String.raw`${STANCE_LEAD}(?:sit(?:ting)?(?: back)?(?: down)?|take a seat|have a seat|plop down)\b`);
export function stanceIntent(text) {
  const t = String(text || "").toLowerCase().replace(/[’`]/g, "'").trim();
  if (!t || /\b(don'?t|do not|stop|no more|never)\b/.test(t) || /\b(sit tight|stand by|walk (?:me|us|you|them) through|walk-?through|stand-?up comedy|stand ?up meeting|standing desk)\b/.test(t)) return null;
  if (STANCE_WALK.test(t)) return "walk";
  if (STANCE_STAND.test(t)) return "stand";
  if (STANCE_SIT.test(t)) return "sit";
  return null;
}
// "Mimi, walk around", "can Mimi walk?", "make Cocoa walk", "go for a walk with Mimi" → { who: ["mimi"], withMochi }
// or null (Nov 4: "I would like mimi to be able to walk too"). With him ("with Mimi", "you and Mimi", "both of you",
// "together") he walks too; otherwise it's theirs, not his.
const FRIEND_WALK_VERB = String.raw`(?:walk(?:ing)?(?: around| about| over| across)?|go (?:for|on) a (?:little )?walk|take a (?:little )?walk|stroll|wander(?: around| about)?|toddle|stretch (?:her|his|their) legs)`;
export function friendWalkIntent(text) {
  const t = String(text || "").toLowerCase().replace(/[’`]/g, "'").trim();
  if (!t || /\b(don'?t|do not|stop|no more|never)\b/.test(t)) return null;
  const who = ["mimi", "cocoa"].filter((w) => new RegExp(`\\b${w}\\b`).test(t));
  if (/\b(?:your friends|both of them|the two of them|them both|everyone|everybody|the gang)\b/.test(t)) who.push(...["mimi", "cocoa"].filter((w) => !who.includes(w)));
  if (!who.length) return null;
  const names = "(?:mimi|cocoa|your friends|both of them|the two of them|them both|everyone|everybody|the gang)";
  const asks = new RegExp(String.raw`\b${names}(?:\s*(?:and|&)\s*(?:mimi|cocoa|you|mochi))?[,!]?\s+(?:(?:can|could|will|would|should|please|pls|go|come on|now)\s+)?(?:you\s+)?${FRIEND_WALK_VERB}\b|\b(?:can|could|does|will|would)\s+${names}(?:\s+(?:and|&)\s+(?:mimi|cocoa))?\s+(?:even\s+|also\s+)?${FRIEND_WALK_VERB}\b|\b(?:make|let|have|tell|ask|get)\s+${names}(?:\s+(?:and|&)\s+(?:mimi|cocoa))?\s+(?:to\s+)?${FRIEND_WALK_VERB}\b|\b${FRIEND_WALK_VERB}\s+(?:around\s+)?(?:with|together with|alongside)\s+${names}\b|\b(?:you|mochi)\s+(?:and|&)\s+(?:mimi|cocoa)\s+(?:(?:can|could|should|go|please)\s+)?${FRIEND_WALK_VERB}\b`);
  if (!asks.test(t)) return null;
  const withMochi = new RegExp(String.raw`\b${FRIEND_WALK_VERB}\s+(?:around\s+)?(?:with|together with|alongside)\s+${names}\b|\b(?:you|mochi)\s+(?:and|&)\s+(?:mimi|cocoa)\b|\b(?:mimi|cocoa)\s+(?:and|&)\s+(?:you|mochi)\b|\btogether\b|\ball (?:three|of you)\b|\bthe three of you\b`).test(t);
  return { who: [...new Set(who)], withMochi };
}
// "let's dance!", "party time!", "dance with me", "can you dance with your friends?" → { friends, ms } or null. A dance
// party: a disco ball, lights, music, and Mimi and Cocoa dancing with him (Nov 3). Not "we had a party last night".
const PARTY = /\b(?:let'?s (?:dance|party|boogie|groove|get down|have a (?:dance )?party|throw a (?:dance )?party)|dance party|party time|it'?s party time|time to (?:dance|party)|(?:can|could|will|would|wanna|want to|do you want to) (?:you )?(?:dance|party|boogie)|dance (?:with me|for me|with (?:mimi|cocoa|your friends|them|us|everyone))|party with (?:me|mimi|cocoa|your friends|them|us)|(?:let'?s|let us|we should|should we|can we|could we|shall we|wanna|want to) (?:have|throw|start) a (?:dance )?party|start the party|get the party (?:started|going)|show me your (?:dance )?moves|bust a move|disco time|(?:can|could|will|should|shall) (?:everyone|everybody|you all|y'?all|we all|all of you|you guys|we) (?:dance|party|boogie)|every(?:one|body) dance|dance (?:together|by yourself|on your own|alone|solo)|only you dance)\b/;   // + "can everyone dance", "dance by yourself" (Nov 3 review)
const PARTY_STORY = /\b(?:i|we|they|he|she|my \w+)\s+(?:went|had|threw|were|was|got|danced|partied|missed|have|has|am having|'m having|is having|are having|want(?:s)? to have|wanna have|will have|might have)\b(?!\s+(?:you|mochi)\b)|\b(?:my|her|his|their|a friend'?s|birthday) party\b|\bparty (?:tomorrow|tonight|on|at|for|next)\b|\bcan i (?:have|throw) a party\b|\blast (?:night|week|weekend|time)\b|\byesterday\b|\bparty (?:was|is) (?:so|too|really|kind of|kinda)\b/;
export function partyIntent(text) {
  const t = String(text || "").toLowerCase().replace(/[’`]/g, "'");
  if (!t || NOT.test(t) || PARTY_STORY.test(t) || !PARTY.test(t)) return null;
  if (/\bjust (?:you and me|us two|the two of us|me and you|us|you)\b|\bonly (?:you|us|mochi)\b|\b(?:by )?yourself\b|\bon your own\b|\balone\b/.test(t)) return { friends: [], ms: 16000 };
  const named = ["mimi", "cocoa"].filter((w) => new RegExp(`\\b${w}\\b`).test(t));
  if (named.length) return { friends: named, ms: 16000 };
  // his friends come only to a party, or when you ask for everyone (Nov 3: "if I asked only mochi to dance it will
  // still bring everyone"); "can you dance?", "let's dance", "dance for me" is just him
  const together = /\b(?:party|parties|partying|disco|everyone|everybody|all of (?:you|us)|you all|y'?all|your friends|the gang|friends|together|the three of you|both of them)\b/.test(t);
  return { friends: together ? ["mimi", "cocoa"] : [], ms: 16000 };
}
// A sneeze and a little cold (Binoy, Nov 3: "can mochi sneeze? what if the story goes to a point where he catches a
// cold?"). coldIntent(text, { cold }) → { start | end | sneeze } or null:
//   start   "you caught a cold", "you're sick", "and then Mochi caught a cold", "pretend you have the sniffles"
//   end     (only while he has one) soup, tea, honey, medicine offered; "get some rest", "go to bed"; "you're better now"
//   sneeze  "can you sneeze?", "sneeze!", "do a big sneeze", pepper/dust/a feather under his nose
// Not "do you have a cold?" (a question), "I caught a cold" (theirs), "don't get sick".
const COLD_ADJ = String.raw`(?!\s+(?:drinks?|snow|weather|days?|nights?|winds?|water|ones?|nose|soda|juice|glass|can|treats?|snacks?|shoulder|feet|hands?|hooves?|ice|brew|pizza|milk|tea|coffee|place|room|air|outside|morning|evening|front|war|case|call|turkey|cuts?|storage|start|spot|floor|toes|ears|cheeks|breeze|rain|pool|lemonade|sandwich|noodles|treat))`;
const COLD_WORD = String.raw`(?:a |the |an? (?:little |tiny |bad |small |nasty |big )?|some )?(?:cold${COLD_ADJ}|colds|flu|sniffles|fever|tummy bug|stomach bug|stuffy nose|runny nose|cough)`;
const COLD_START = new RegExp(String.raw`\b(?:you(?:'ve| have| had)?|mochi(?: has| had)?)\s+(?:just\s+|totally\s+|definitely\s+|probably\s+)?(?:caught|got|have|has|catch|catches|gets|are catching|'re catching|are getting|'re getting|are coming down with|'re coming down with|came down with|picked up)\s+${COLD_WORD}\b|\b(?:you(?:'re| are)|mochi(?:'s| is))\s+(?:all\s+|so\s+|a (?:little|bit)\s+|getting\s+|feeling\s+)?(?:sick|ill|unwell|feverish|under the weather|sniffly|stuffy|coming down with something)\b(?!\s+(?:at|of|with|in the head|moves?|skills?|bro|dude|man|lol))|\b(?:pretend|imagine|let'?s say|what if)\b.{0,30}\b(?:you|mochi)\b.{0,24}\b(?:cold${COLD_ADJ}|sick|flu|sniffles|ill)\b(?!\s+(?:of|at))|\b(?:passed|gave|given|spread)\s+(?:it|my cold|my germs|the cold|my flu|the flu|my bug|the bug|my sniffles)\s+(?:on\s+)?to\s+(?:you|mochi)\b|\b(?:you|mochi)\s+(?:caught|got)\s+it\s+from\s+me\b`);
const REMEDY = String.raw`(?:some |a |an |the |this |my |a cup of |a bowl of |a spoon(?:ful)? of |a glass of |hot |warm |chicken )*(?:soup|tea|honey|medicine|cough syrup|lemon(?:ade)?|hot chocolate|cocoa|orange juice|vitamins?|tissues?|warm milk)`;
const COLD_END = new RegExp(String.raw`\b(?:have|eat|drink|try|take|sip|here'?s|here is|here are|heres|i made you|i brought you|i got you|i have|i've got|want|how about|you need|you should (?:have|drink|eat|take)|time for)\s+${REMEDY}\b|\b(?:i'?ll|let me|i will|i can|i'm gonna|i am going to)\s+(?:make|get|bring|give)\s+you\s+${REMEDY}\b|\b(?:get|take|have|need)\s+(?:some\s+)?(?:rest|sleep|a nap)\b|\bgo (?:to bed|to sleep|take a nap|nap)\b|\byou(?:'re| are)\s+(?:all\s+)?(?:better|cured|well again|not sick anymore|healthy again)\b|\b(?:no more|bye bye|goodbye) (?:cold|sniffles|germs)\b`);
const SNEEZE = /\b(?:can|could|will|would) you (?:please )?(?:do a |give (?:me|us) a |fake a |pretend to )?sneeze\b|^(?:sneeze|achoo|ah-?choo)\b|\b(?:do|show me|let'?s see|give (?:me|us)) (?:a |your |one )?(?:big |little |huge |cute |fake )?sneeze\b|\b(?:pretend|try) to sneeze\b|\bfake sneeze\b|\b(?:sniff|smell|tickle)\b.{0,24}\b(?:pepper|pollen|dust|feather|flowers?)\b|\b(?:pepper|pollen|dust|feather)\b.{0,24}\b(?:your nose|sniff|smell)\b|\bmake you sneeze\b/;
export function coldIntent(text, { cold = false } = {}) {
  const t = String(text || "").toLowerCase().replace(/[’`]/g, "'").trim();
  if (!t) return null;
  const question = /\?\s*$/.test(t) && /^(?:do|are|did|have|is|were|was|has)\b/.test(t);   // "do you have a cold?"
  const neg = /\b(?:don'?t|do not|never|not|won'?t|no)\b\s+(?:\w+\s+){0,2}(?:get|catch|have|be)\b|\bdon'?t get sick\b|\bnot sick\b(?!\s+anymore)/.test(t);
  if (cold && COLD_END.test(t) && !/\b(?:no|don'?t want|not|hate|don'?t like|do not like)\s+(?:\w+\s+)?(?:soup|tea|medicine|rest|nap|honey)\b|\bhoney,/.test(t)) return { end: true };
  // theirs, not his: "I caught a cold" (unless the sentence goes on to give him one)
  const mine = /^(?:i|i'm|i've)\b|\bi (?:caught|got|have|am|'m)\b/.test(t) && !/\b(?:you|mochi)\b[^.!?]{0,30}\b(?:caught|got|have|has|catch|are|'re)\b[^.!?]{0,20}\b(?:cold|sick|flu|sniffles)\b/.test(t) && !/\b(?:passed|gave|given|spread)\s+(?:it|my \w+|the \w+)\s+(?:on\s+)?to\s+(?:you|mochi)\b|\bcaught\s+it\s+from\s+me\b/.test(t);
  if (!cold && !question && !neg && !mine && COLD_START.test(t)) return { start: true };
  if (SNEEZE.test(t) && !NOT.test(t)) return { sneeze: true };
  return null;
}
// his own reply: "Achoo!" → a sneeze on screen; "I think I'm catching a cold…" → the cold (the story gave him one)
export function coldInReply(text) {
  const t = String(text || "").toLowerCase().replace(/[’`]/g, "'");
  const sneeze = /(?:^|[^a-z])(?:a+h*-?\s?)?(?:choo+|tchoo+)(?![a-z])(?!\s+choo)|\bachoo+\b|\*\s*sneez(?:e|es|ing)\s*\*|\bsneezes\b/.test(t) && !/\bchoo[- ]choo\b/.test(t);
  const start = new RegExp(String.raw`\bi(?:'m| am| think i'?m| think i| might be| may be)?\s+(?:catching|caught|getting|got|coming down with|have|think i have|might have)\s+(?:a |the )?(?:little |tiny |bit of a |small )?(?:cold${COLD_ADJ}|sniffles|flu)\b|\bi(?:'m| am| feel| think i'?m)\s+(?:a (?:little|bit)\s+)?(?:getting\s+)?(?:sick|sniffly|stuffy)\b(?!\s+(?:of|and tired|at))`).test(t) && !/\b(?:not|n't|never|no)\s+(?:\w+\s+){0,2}(?:catching|caught|getting|got|have|sick)\b/.test(t);
  return { sneeze, start };
}
// Saving up (Nov 3, the kids-and-money story): a goal in his piggy bank that you fill a little at a time.
//   savingsIntent(text) → { goal, target } ("I'm saving up for a kite", "I want to save $40 for a bike", "help me save
//   for a skateboard"), { add } ("I saved $5", "put 3 dollars in the piggy bank", "I got $10 for my birthday, save it"),
//   { spend } ("I spent $2"), { ask: true } ("how much have I saved?"), or null.
const MONEY = String.raw`(?:\$\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?|(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?\s?(?:dollars?|bucks|usd))`;
const SAVE_GOAL = new RegExp(String.raw`\b(?:(?:i'?m|i am|we'?re|we are|let'?s|help me|can you help me|i want to|i wanna|i'd like to|i will|i'll)\s+)?(?:start\s+)?sav(?:e|ing)(?:\s+up)?(?:\s+(?:some\s+)?money)?(?:\s+${MONEY})?\s+(?:for|to buy|to get|towards?)\s+(?:a |an |the |my |some )?([a-z][a-z' -]{1,40}?)(?:\s+(?:that|which|it)\s+(?:costs?|is)\s+${MONEY}|[.!?,]|$)`);
const SAVE_ADD = new RegExp(String.raw`(?:^|[.!?,;]\s*|\b(?:i|we)\s+(?:just\s+|also\s+|finally\s+)?)(?:saved|put|added|add|dropped|deposited|stuck)\s+(?:in\s+|away\s+|another\s+|an extra\s+|aside\s+)?${MONEY}|\b${MONEY}\s+(?:in|into|to)\s+(?:the|my|your)\s+(?:piggy(?: bank)?|savings|bank|jar)\b`);
const SAVE_INCOME = new RegExp(String.raw`\b(?:i|we)\s+(?:just\s+)?(?:got|earned|made|found|received|won|was given|were given)\s+${MONEY}`);
const SAVE_IT = /\b(?:save|put|add|drop)\s+(?:it|that|this|the money|them)\b|\bpiggy\b|\binto (?:my|the) savings\b/;
const SAVE_SPEND = new RegExp(String.raw`\b(?:i|we)\s+(?:just\s+)?(?:spent|took out|used|wasted|lost)\s+${MONEY}`);
const SAVE_ASK = /\b(?:how much (?:have i|did i|do i have|is in|have we)\s+(?:saved|got|in (?:the|my) piggy)|how(?:'s| is) (?:my|the) (?:saving|savings|piggy bank|goal)|how (?:close|far) (?:am i|are we)|what'?s in (?:the|my) piggy)\b/;
const num = (m, i) => { for (const k of i) if (m[k] != null) { const whole = String(m[0]).match(/(\d{1,3}(?:,\d{3})+|\d+)(\.\d{1,2})?/); return whole ? +(whole[1].replace(/,/g, "") + (whole[2] || "")) : +String(m[k]).replace(/,/g, ""); } return null; };
export function savingsIntent(text) {
  const t = String(text || "").toLowerCase().replace(/[’`]/g, "'").trim();
  if (!t || NOT.test(t)) return null;
  if (SAVE_ASK.test(t)) return { ask: true };
  const g = SAVE_GOAL.exec(t);
  if (g) {
    const goal = String(g[3] || "").replace(/\s+(?:soon|someday|this (?:year|month|summer)|next (?:year|month)|at the store|online)$/, "").trim(), target = num(g, [1, 2, 4, 5]);
    if (goal && !/^(?:money|cash|it|that|this|more|later|now|up|me|us|the world|my game|a seat|you)$/.test(goal) && !/^(?:me|us|you|him|her|them)\b/.test(goal)) return { goal, target: target || null };
  }
  const sp = SAVE_SPEND.exec(t); if (sp) { const n = num(sp, [1, 2]); if (n) return { spend: n }; }
  const a = SAVE_ADD.exec(t); if (a) { const n = num(a, [1, 2, 3, 4]); if (n) return { add: n }; }
  const inc = SAVE_INCOME.exec(t); if (inc && SAVE_IT.test(t)) { const n = num(inc, [1, 2]); if (n) return { add: n }; }   // "I got $10 for my birthday, save it"
  if (/\b(?:save|put|add|drop)\s+(?:it|that|this|the money)\s+(?:in|into)\s+(?:the|my|your)\s+(?:piggy|savings|bank|jar)/.test(t)) return { add: null };
  return null;
}
// "give Mimi a hug", "hug her", "can you hug Cocoa?" → "mimi" | "cocoa" | null
export function hugIntent(text) {
  const t = String(text || "").toLowerCase();
  if (!/\b(hug|hugs|hugging|cuddle|squeeze|embrace)\b/.test(t) || NOT.test(t)) return null;
  if (/\b(mimi|her|girlfriend|gf)\b/.test(t)) return "mimi";
  if (/\b(cocoa|him|buddy|best friend|bestie)\b/.test(t)) return "cocoa";
  return null;
}
/** "share your cookie with Mimi", "give Cocoa a cookie", "give your trophy to Mimi", "share it with them" (Nov 4,
 * Binoy: "it would also be cool to have mochi be able to share his props with his friends like a cookie"): who gets
 * it (one or both), and the thing ("" for the one in his hoof or the last one you talked about). null if it isn't that. */
const SHARE_FRIENDS = String.raw`(?:mimi|cocoa|her|him|them|both(?: of them)?|everyone|everybody|your friends|the gang|your pals)`;
const SHARE_NOT = /\b(hugs?|kiss(?:es)?|high[- ]?fives?|fist ?bumps?|piggy|rides?|lift|lessons?|tour|compliments?|break|chance|try|go|look|call|names?|hints?|clues?|smiles?|waves?|hand|cuddles?|squeeze|push|nudge|bump|turn|minute|second|moment|space|room|advice|idea|tips?|thumbs?|kiss|scare|fright|surprise|shout|shoutout|cheer|clap|round of applause|bath|haircut|makeover|name|nickname|pep talk|hint|wink|nod|high|five|secret|story|stories|song|dance|show)\b/;
export function shareIntent({ text, props = [], holding = null, recent = [] }) {
  const t = String(text || "").toLowerCase().replace(/[’`]/g, "'");
  if (NOT.test(t)) return null;
  const all = /\b(both|everyone|everybody|them|your friends|the gang|your pals|the others)\b/.test(t), mimi = /\b(mimi|her|girlfriend)\b/.test(t), cocoa = /\b(cocoa|him|buddy|bestie|best friend)\b/.test(t);
  const who = all || (mimi && cocoa) ? ["mimi", "cocoa"] : mimi ? ["mimi"] : cocoa ? ["cocoa"] : null;
  if (!who) return null;
  const DET = String.raw`(?:(?:a|an|one|some|your|the|his|my|a piece of|a bite of|a bit of|one of (?:your|the|those|these)|some of (?:your|the))\s+)?`;
  const m = new RegExp(String.raw`\bshare\s+${DET}(.{0,40}?)\s*\b(?:with|among|between)\b`).exec(t)
    || new RegExp(String.raw`\b(?:give|hand|offer|pass|toss|save)\s+${SHARE_FRIENDS}(?:\s+and\s+${SHARE_FRIENDS})?\s+${DET}([a-z][a-z' -]{1,40})`).exec(t)
    || new RegExp(String.raw`\b(?:give|hand|offer|pass)\s+${DET}([a-z][a-z' -]{0,40}?)\s+(?:to|for)\s+${SHARE_FRIENDS}`).exec(t)
    || (/\bshare\b/.test(t) ? [null, ""] : null);
  if (!m) return null;
  let thing = String(m[1] || "").replace(/\b(?:too|as well|please|now|then|and .*|so .*|because .*|if .*|with .*|to .*)$/, "").replace(/[!?.,]+$/, "").trim();
  if (/^(?:it|that|this|one|some|them|those|these|yours?|any|a bit|a piece|a bite)$/.test(thing)) thing = "";
  if (thing && SHARE_NOT.test(thing)) return null;
  let prop = null;
  if (thing) { const r = propIntent({ text: `show me the ${thing}`, props, holding: null }); prop = r && r.prop; if (!prop) return null; }
  else {   // the one in his hoof, else the last one you talked about
    const hn = holding && holding.name, own = hn && props.find((p) => p.name === hn), pk = hn && !own && POCKET.find((e) => e.name === hn);
    const r = own ? { prop: own } : pk ? { prop: pocketProp(pk) } : hn ? propIntent({ text: `show me the ${hn}`, props, holding: null }) : null;
    prop = (r && r.prop) || (() => { const q = propIntent({ text: "show it to me", props, holding: null, recent }); return q && q.prop; })();
    if (!prop) return null;
  }
  if (prop.archetype === "ride" || prop.archetype === "companion") return null;   // (not a car to hand over, or a pet)
  return { who, prop, give: /\b(?:give|hand)\s+(?:\w+\s+)?(?:your|his)\b|\byours\b|\bkeep it\b/.test(t) && !/\bshare\b/.test(t) };
}
/** "give Mimi a piggyback ride", "can Cocoa ride on your back?", "Mimi, jump on Mochi's back": who climbs on (Nov 4) */
export function piggyIntent(text) {
  const t = String(text || "").toLowerCase().replace(/[’`]/g, "'");
  if (!/\bpigg(y|ie)[ -]?back\b|\bshoulder ride\b|\b(ride|sit|climb|hop|jump) (up )?on (your|his|mochi'?s) (back|shoulders)\b|\bcarry (mimi|cocoa|her|him) on (your|his) back\b|\b(jump|hop|climb) on (top of )?(you|mochi)\b/.test(t) || NOT.test(t)) return null;
  if (/\b(cocoa|buddy|bestie|best friend)\b/.test(t)) return "cocoa";
  return "mimi";   // (Mimi unless it's Cocoa)
}
export function rideIntent(text, owned = [], holding = null) {
  const t = String(text || "").toLowerCase().replace(/[’`]/g, "'");
  if (!RIDE_VERB.test(t) || NOT.test(t) || (RIDE_NOT_HIM.test(t) && !/\blet'?s\b/.test(t))) return null;
  const pm = PASSENGER.exec(t), passenger = pm ? pm[1] || pm[2] : null;
  const r = rideIntent0(t, owned, holding);
  if (!r && (passenger && /\b(pick|give .* a (?:ride|lift)|drive|take)\b/.test(t) || /\b(go for a drive|go driving|drive around|road trip|take a drive)\b/.test(t))) {   // "pick up Mimi", "let's go for a drive": in his car
    const car = owned.find((p) => p.archetype === "ride" && RIDE_WORD.car.test(String(p.name).toLowerCase())), old = !car && owned.find((p) => p.archetype === "companion" && RIDE_WORD.car.test(String(p.name).toLowerCase()));
    return { name: car ? car.name : old ? old.name : "car", owned: !!(car || old), ...(old ? { upgrade: old.id } : {}), ...(passenger ? { passenger } : {}) };
  }
  return r ? { ...r, ...(passenger ? { passenger } : {}) } : null;
}
function rideIntent0(t, owned, holding) {
  // "drive it around" with the bike out: that one ("blast off!" with the rocket ship out: that one)
  if (holding && holding.slot === "ride" && (/\b(it|her|him|that|this|around|again)\b/.test(t) || FLY_VERB.test(t) || SAIL_VERB.test(t)) && !Object.values(RIDE_WORD).some((re) => re.test(t))) return { name: holding.name, owned: owned.some((p) => p.name === holding.name) };
  const mine = owned.find((p) => p.archetype === "ride" && propWords(p.name).some((w) => new RegExp(`\\b${w}s?\\b`).test(t)));
  if (mine) return { name: mine.name, owned: true };
  // a car he made before cars were rides (it sat beside him): that one, turned into one he can drive (index.js)
  const oldCar = RIDE_WORD.car.test(t) && owned.find((p) => p.archetype === "companion" && RIDE_WORD.car.test(String(p.name).toLowerCase()));
  if (oldCar) return { name: oldCar.name, owned: true, upgrade: oldCar.id };
  // "let's fly!", "set sail": one of his own that flies (or sails), else nothing (a fly on the wall is not a flight)
  const flies = (p) => FLYING.test(String(p.name).toLowerCase()), sails = (p) => !flies(p) && SAILING.test(String(p.name).toLowerCase());   // (a rocket ship is no ship)
  if (FLY_VERB.test(t) && !Object.values(RIDE_WORD).some((re) => re.test(t))) { const f = owned.find((p) => p.archetype === "ride" && flies(p)); return f ? { name: f.name, owned: true } : null; }
  if (SAIL_VERB.test(t) && !Object.values(RIDE_WORD).some((re) => re.test(t))) { const f = owned.find((p) => p.archetype === "ride" && sails(p)); return f ? { name: f.name, owned: true } : null; }
  for (const [name, re] of Object.entries(RIDE_WORD)) if (re.test(t)) return { name, owned: false };
  if (/\b(go for a ride|ride something|ride around|can you ride|wanna ride|want to ride)\b/.test(t)) return { name: "bicycle", owned: false };
  return null;
}
// "it's too big", "can you make the soup smaller?", or he says "I'll make a smaller bowl": a prop fix nobody called the
// tool for. { change, named, carried } or null; carried: the complaint was in their message before this one ("it's too
// big" … "the soup"). Only about size (other changes need the model to say what they are).
// A size complaint about "it" (the thing he just showed you or is holding): "it's too big", "no, too small", "make it
// smaller", "shrink it". Not "the party was way too long" or "make your answers shorter" (Nov 3 review: ordinary chat
// resized props).
const IT_SIZE = /\b(?:it|this|that|this one|that one|it'?s|its|that'?s|thats|they'?re|those|these)\b[^.!?]{0,24}?\btoo (?:big|large|huge|giant|massive|enormous|small|tiny|little)\b|\bmake (?:it|this|that|them|this one|that one) (?:a (?:little |lot |bit )?|way |much |even |so )?(?:smaller|bigger|tinier|larger|littler|small|big|tiny|huge)\b|\b(?:shrink|enlarge) (?:it|this|that|them)\b/;
const BARE_SIZE = /^\s*(?:(?:no|nope|hmm|um|uh|well|but|yeah|yes|ok|okay|nah)[,.!\s]+)*(?:it'?s |its |it is |that'?s |a bit |a little |way |much |still |kinda |so )*too (?:big|large|huge|small|tiny|little)\s*[.!?]*\s*$/;
const FIX_PROMISE = /\b(?:i'?ll|i will|let me|lemme|i'?m (?:gonna|going to)|gonna|going to|i can(?!'t|not)|time to)\b[^.!?]{0,40}\b(?:make|fix|shrink|remake|redo|resize)\b/;
// a size change and nothing else? (the rest goes to the workbench: "smaller and green", "the handle is too long")
const SIZE_FILLER = new Set(("it its it's is are was be the a an this that these those one make made can could would will you please pls mochi " +
  "too way much bit little lot so really very kinda kind of just still even more less no nope not doesn't doesnt does dont don't isnt isn't wasnt wasn't " +
  "look looks looked right correct quite pretty super bit oh oops uh actually hey " +
  "seem seems hmm um uh ok okay well but yeah yes i think it's thats that's than before now again for me my your our like bit tad slightly wee " +
  "big bigger large larger huge giant massive enormous small smaller tiny tinier little littler shrink grow enlarge scale up down half size twice as double times").split(/\s+/));
export function pureSize(change, name = "") {
  const own = new Set(String(name).toLowerCase().split(/[^a-z]+/).filter(Boolean));
  const words = String(change || "").toLowerCase().replace(/[’`]/g, "'").split(/[^a-z']+/).filter(Boolean);
  return !words.some((w) => !SIZE_FILLER.has(w) && !own.has(w) && !own.has(w.replace(/s$/, "")));
}
/** names(str) → the prop of his a string names by a word that says which, or null */
export function fixIntent({ text, spoken = "", prevUser = "", names = () => null }) {
  const low = (x) => String(x || "").toLowerCase().replace(/[’`]/g, "'");
  const t = low(text), s = low(spoken), p = low(prevUser);
  if (/\b(don'?t|do not|never|stop|not too|isn'?t too|wasn'?t too|no longer)\b/.test(t)) return null;
  if (/^\s*(is|was|does|do|did|isn'?t|doesn'?t|are)\b[^?]*\?\s*$/.test(t)) return null;   // "is it too big?" asks what he thinks
  const complaint = (x) => !!sizeChange(x) && (IT_SIZE.test(x) || BARE_SIZE.test(x));
  const named = (x) => (sizeChange(x) ? names(x) : null);
  // in this message: about "it", or about a prop they name ("the soup is too big")
  if (complaint(t) || named(t)) return { change: t, target: named(t) || null, carried: false };
  // carried over: they complained, he asked which one, they named it ("the soup"), and he says he'll fix it
  const short = t.split(/\s+/).filter(Boolean).length <= 5, target = short ? names(t) : null;
  if (target && (complaint(p) || named(p)) && FIX_PROMISE.test(s)) return { change: p, target, carried: true };
  return null;
}
/** What he should do with a prop when the words say so but no tool did: { prop, use: "show"|"fire"|"use", aim } or null. */
export function propIntent({ text, spoken = "", props = [], holding = null, recent = [] }) {
  const t = String(text).toLowerCase(), s = String(spoken).toLowerCase();
  if (NOT.test(t)) return null;
  // the one they named: his own by a word that says which; else a pocket thing named outright ("water gun", "water
  // balloon"); a pocket thing only half-named ("xmas hat") is nothing here, not his launcher by a stray "gun"
  const named = (str, { pocket = true } = {}) => {
    // "the rocket", when he has a rocket ship to ride, is the rocket ship (not his confetti bazooka), unless it's to shoot
    const ship = /\brockets?\b/.test(str) && !/launch|confetti|\bfire\b|shoot|bazooka/.test(str) && props.find((p) => p.archetype === "ride" && ROCKET_RIDE.test(p.name));
    if (ship) return ship;
    if (BIG_LAUNCHER.test(str) && bigOwned(props)) return bigOwned(props);
    const own = bestByWords(props, str), pk = pocket ? pocketFor(str) : null;
    if (own && own.specific && !(pk && pk.specific > own.specific)) return own.item;
    if (pk && pk.specific && (pk.score >= 3 || nounNames(pk.item, str))) return pocketProp(pk.item);
    // none of his own and nothing else named: the big one in his pocket (Nov 4, on the shared Mochi: "Bring out your
    // rocket launcher" → "Whoa, it's super heavy, stay back!" and nothing came out)
    if (BIG_LAUNCHER.test(str) && /launch|bazooka|\brpg|missile|grenade|blaster|cannon/.test(str) && !own && !(pk && pk.specific && pk.score >= 3)) { const big = POCKET.find((e) => e.archetype === "launcher" && e.heavy); if (big) return pocketProp(big); }
    if (pk && pk.specific) return null;
    if (own) return own.item;
    return (!BIG_LAUNCHER.test(str) && LAUNCHER_WORDS.test(str) && props.find((p) => p.archetype === "launcher")) || null;
  };
  const heldPocket = holding && POCKET.find((e) => e.name === holding.name);
  const held = (holding && props.find((p) => p.name === holding.name)) || (heldPocket ? pocketProp(heldPocket) : null);
  // recent: what THEY said lately (his own lines name his pocket things all the time), his own props only
  const inWords = named(t) || named(s), fromRecent = recent.slice().reverse().map((x) => named(String(x).toLowerCase(), { pocket: false })).find(Boolean) || null;
  const aim = /\b(there|that way|over there|at (that|this|it|them)|where i|this way|up there|down there)\b/.test(t);
  // fire: asked to ("shoot it", or just "go!" right after talking about it), or he says he does with it in hand or in
  // words. Not "use the bathroom", not "pop music" (Nov 3 review: everyday words fired the water pistol).
  const launcher = [inWords, held, fromRecent].find((p) => p && p.archetype === "launcher");
  if (launcher) {
    const mine = inWords === launcher || held === launcher, near = mine || fromRecent === launcher;
    if ((FIRE_ASK.test(t) && near) || (/\buse (it|that|this)\b/.test(t) && (held === launcher || fromRecent === launcher)) || (USE_SHORT.test(t) && (held === launcher || fromRecent === launcher)) || (USE_SAY.test(s) && mine)) return { prop: launcher, use: "fire", aim };
  }
  // show: only a prop named in what was said (a bare "here it is!" may be about a hat or a move), or the one in his hoof
  if (inWords && (SHOW_ASK.test(t) || SHOW_SAY.test(s) || (HAVE_ASK.test(t) && named(t)))) return { prop: inWords, use: "show", aim: false };
  const other = /\b(?:your|the|my|a|an)\s+(?!it\b|one\b|thing\b|stuff\b|prop\b)([a-z]{3,})/.exec(t), heldWords = held ? propWords(held.name) : [];
  const namesOther = other && !heldWords.some((w) => new RegExp(`\\b${w}s?\\b`).test(t));
  if (!inWords && held && SHOW_ASK.test(t) && !namesOther) return { prop: held, use: "show", aim: false };
  if (USE_ASK.test(t) && named(t)) return { prop: named(t), use: "use", aim: false };
  // eating or drinking it: the food they named, else the food in his hoof
  if (EAT_ASK.test(t) && !EAT_NOT.test(t)) { const f = [inWords, held].find((p) => p && eatStyle(p.name)); if (f) return { prop: f, use: "eat", aim: false }; }
  return null;
}

// Gemma 4 sometimes writes a tool call into its words instead of making it, and LM Studio passes it through as text
// (M5, Nov 2: "…That's a lot of neighbors! show_prop{prop:<|"|>desk globe<|"|>}", and nothing appeared). Find calls
// like that (Gemma's own `call:name{key:<|"|>value<|"|>}` with or without its tool-call markers, JSON in braces or
// parentheses, key=value), run them as real calls, and take them out of what he says. Only our tool names count, and a
// call only counts if its arguments parse, so ordinary words in brackets are left alone.
const GEMMA_QUOTE = /<\|"\|>/g;
function leakedArgs(body) {
  const s = body.replace(GEMMA_QUOTE, '"').trim();
  if (!s) return {};
  for (const t of [s, s.replace(/(^|[{,]\s*)([A-Za-z_]\w*)\s*[:=]/g, '$1"$2":').replace(/'/g, '"')]) { try { const o = JSON.parse(`{${t}}`); if (o && typeof o === "object") return o; } catch (_) { /* next */ } }
  const out = {};
  for (const m of s.matchAll(/([A-Za-z_]\w*)\s*[:=]\s*(?:"([^"]*)"|([^,]+))/g)) { const v = m[2] !== undefined ? m[2] : m[3].trim(); out[m[1]] = v === "true" ? true : v === "false" ? false : v !== "" && Number.isFinite(+v) ? +v : v; }
  return Object.keys(out).length ? out : null;
}
export function leakedToolCalls(text, names, primary = TOOL_PRIMARY) {
  const calls = [], re = new RegExp(`(?:<\\|?tool_call\\|?>\\s*)?(?:call\\s*:\\s*)?\\b(${names.join("|")})\\s*(\\{[^{}]*\\}|\\([^()]*\\))(?:\\s*<\\|?tool_call\\|?>)?`, "g");
  let clean = String(text || "").replace(re, (all, name, body) => {
    let args = leakedArgs(body.slice(1, -1));
    // just a value, no name for it: request_prop(sword), show_prop("desk globe"). Written like code, right up against
    // the name ("I will remember (that is important) forever." is words: remember is a tool too)
    const bare = body.slice(1, -1).replace(GEMMA_QUOTE, '"').trim().replace(/^["']|["']$/g, "").trim();
    if (!args && primary && primary[name] && all.includes(name + body) && bare && bare.length <= 60 && !/[:={}]/.test(bare)) args = { [primary[name]]: bare };
    if (!args || (body[0] === "(" && !Object.keys(args).length)) return all;
    calls.push({ name, arguments: args });
    return "";
  });
  if (calls.length || /<\|?tool_call|<\|"\|>/.test(clean)) clean = clean.replace(/<\|?tool_call\|?>|<\|"\|>/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
  return { clean, calls };
}
// Gemma sometimes answers in HTML or markdown (M5, Nov 2: "<p><em>slides in from the left with a hoof bump</em></p>
// <p>He's right here!</p>"): plain words, emphasis as *asterisks* so his body acts it out, no bold.
// Data dressed up as words never reaches his bubble or his voice (shared Mochi, Nov 7: "Throw it at mimi" →
// `<pre>{"calls":, "on_stage": "mochi"}</pre> Whoops! I missed her…`): a code block (<pre>, <code>, ``` fences)
// holding JSON-ish data is dropped, any other is unwrapped, and a stray {"key": …} object is taken out.
const DATA_LIKE = /[{}[\]]|"[\w ]{1,40}"\s*:|\b\w+\s*=\s*\S/;
export function dropDataBlocks(s) {
  let t = String(s || ""), dropped = 0;
  const keep = (inner) => { const x = String(inner).replace(/&quot;/g, '"').replace(/&#39;/g, "'"); if (DATA_LIKE.test(x)) { dropped++; return " "; } return x; };
  t = t.replace(/```[a-z]*\s*([\s\S]*?)(?:```|$)/gi, (_, x) => keep(x));
  t = t.replace(/<(pre|code)\b[^>]*>([\s\S]*?)(?:<\/\1\s*>|$)/gi, (_, __, x) => keep(x));
  t = t.replace(/<\/?(?:pre|code)\b[^>]*>/gi, " ");
  for (let i = 0; i < 3; i++) t = t.replace(/\{\s*"[\w ]{1,40}"\s*:[^{}]*\}/g, () => { dropped++; return " "; });
  if (dropped) t = t.replace(/[ \t]{2,}/g, " ").replace(/^[ \t]+|[ \t]+$/gm, "").trim();
  return { text: t, dropped };
}
export function plainText(s) {
  const d = dropDataBlocks(s);
  if (d.dropped) console.warn(`[brain] took ${d.dropped} data block(s) out of his words: ${JSON.stringify(String(s).slice(0, 200))}`);
  let t = d.text;
  if (/<\/?(p|em|i|b|strong|br|span|div|ul|ol|li|h[1-6])\b[^>]*>/i.test(t)) {
    t = t.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>\s*<p\b[^>]*>/gi, "\n").replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, "*$2*").replace(/<li\b[^>]*>/gi, "\n- ").replace(/<\/?[a-z][a-z0-9]*\b[^>]*>/gi, "");
  }
  t = t.replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  return t.replace(/\*\*([^*\n]+)\*\*/g, "$1").replace(/__([^_\n]+)__/g, "$1").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
// A friend's line inside his reply is theirs to say, in their own bubble (M5, Nov 2: "…and Cocoa is my best buddy.
// "Hey! Did someone say my name?"", one message that read like two people). "Cocoa: "…"" / "Cocoa says, "…"", an
// unquoted "Mimi: Aww, you're sweet ♡" (M5, Nov 2: it showed under his name), or a quote standing on its own after a
// friend was named. Quotes inside his own sentences ("you said "pizza"") stay.
// only: the friends who may speak (on stage, or coming in this turn); a line for anyone else is dropped, unless it's
// all he wrote (then they hop in to say it). max: how long a line may be (longer when you're talking to them).
const FRIEND = { cocoa: "cocoa", mimi: "mimi" };
const SAYS = String.raw`(?:says?|said|shouts?|giggles?|laughs?|calls? out|chimes? in|adds?|grins?|whispers?|smiles?|beams?|replies|answers)`;
export function friendLines(text, { here = [], only = null, max = 160 } = {}) {
  let t = String(text || ""); const lines = [], dropped = [];
  const take = (who, line) => {
    const l = String(line).replace(/\*[^*\n]*\*/g, " ").replace(/^["“\s]+|["”\s]+$/g, "").replace(/\s{2,}/g, " ").trim();
    if (!l) return;
    if (only && !only.includes(who)) { dropped.push({ who, text: l }); return; }
    if (lines.length < 2) lines.push({ who, text: l });
  };
  t = t.replace(new RegExp(String.raw`\b(Cocoa|Mimi)\b(?:\s+${SAYS}\b)?\s*[:,]\s*["“]([^"”\n]{2,${max}})["”]`, "gi"), (_, who, line) => { take(FRIEND[who.toLowerCase()], line); return ""; });
  const UNQUOTED = new RegExp(String.raw`(^|\n|[.!?…~♡♥)*]\s*)(Cocoa|Mimi)\s*(?:\([^)\n]{0,30}\)\s*)?:\s*((?:(?!\b(?:Cocoa|Mimi|Mochi)\s*(?:\([^)\n]{0,30}\)\s*)?:)[^\n]){2,${max}})`, "gi");
  for (let pass = 0; pass < 3; pass++) {   // again, for a second friend right after the first ("Mimi: Aww ♡ Cocoa: Dude!")
    const before = t;
    t = t.replace(UNQUOTED, (all, pre, who, line) => { take(FRIEND[who.toLowerCase()], line); return pre; });
    if (t === before) break;
  }
  t = t.replace(new RegExp(String.raw`(^|[.!?…*]\s+|\n)["“]([^"”\n]{2,${max}})["”](?=\s*($|\n|[A-Z*]))`, "g"), (all, pre, line, _x, at) => {
    const before = String(t).slice(0, at), named = [...before.matchAll(/\b(Cocoa|Mimi)\b/gi)].pop();
    const who = named ? named[1].toLowerCase() : here.length === 1 ? here[0] : null;
    if (!who) return all;
    take(who, line); return pre;
  });
  let out = t.replace(/\s+([,.!?])/g, "$1").replace(/[ \t]{2,}/g, " ").trim();
  // nothing of his own left: the friend hops in to say it after all
  if (!stripActionsLite(out) && !lines.length && dropped.length) lines.push(...dropped.slice(0, 2));
  return { text: out, lines, dropped: lines.length ? dropped.filter((d) => !lines.includes(d)) : dropped };
}
const stripActionsLite = (s) => String(s || "").replace(/\*[^*\n]*\*/g, "").replace(/[\s.!?…~♡♥]+/g, "");
// "Mimi, how was your day?", "hey cocoa!", "what do you think, Mimi?", "@cocoa tell me a joke": they're talking to a
// friend, not to him. "mimi" | "cocoa" | null. ("Cocoa, throw a snowball at Mochi" is a throw; the server checks that first.)
// Sending the friends home (Binoy, Nov 3: "when I ask mochi to have personal time with him and let Mimi and cocoa
// leave they say alright but still stay"). → ["mimi", "cocoa"] (both unless one is named) or null.
const BYE_FRIEND = /(?:^|[.!?,;]\s*|\b(?:please|can you|could you|will you|would you|now|okay|ok|so|mochi,?)\s+)(?:let|tell|ask|send|make)\s+(?:mimi|cocoa|them|your friends|the others|everyone|mimi and cocoa|cocoa and mimi)\s+(?:to\s+)?(?:go home|head home|head out|go away|leave|go)(?=\s*(?:$|[.!?,;~]|now\b|for (?:now|a (?:bit|while))\b|home\b|please\b))|(?:^|[.!?,;]\s*)(?:mimi|cocoa|your friends|the others|you two|guys)\s*,?\s+(?:can|should|need to|have to|may)\s+(?:go home|head (?:home|out)|leave|go)(?=\s*(?:$|[.!?,;~]|now\b|for now\b|please\b))|(?:^|[.!?,;]\s*)(?:bye|bye bye|goodbye|see you(?: later)?|later|good ?night|night night)\s*,?\s+(?:mimi|cocoa|guys|everyone|both of you|you two)\b(?!\s+(?:will|is|are|was|were|can|should|would|has|have|had|comes?|came|went|goes?|said|says)\b)|\b(?:just|only)\s+(?:you and me|us two|the two of us|me and you)\b|\b(?:can|could) (?:we|i) (?:have|get|spend) (?:some )?(?:alone|personal|private|quiet|one[- ]on[- ]one|quality) time(?: (?:with you|together|alone))?\s*(?=$|[.!?,])|\b(?:alone|personal|private|one[- ]on[- ]one|quality) time (?:with you|with mochi|together|just us)\b|\bcan (?:we|i) be alone(?: with you)?\b(?!\s+with\s+(?:mimi|cocoa))|(?:^|[.!?,;]\s*)(?:mimi|cocoa|everyone|guys)\s*,?\s+(?:go home|please leave|please go|time to go|you can go)\b|(?:^|[.!?,;]\s*)(?:mimi|cocoa|your friends|the others|you two|guys)\s*,?\s+(?:can|could|would|will) you (?:please )?(?:go home|head (?:home|out)|leave|go)(?=\s*(?:$|[.!?,;~]|now\b|for now\b|please\b|home\b))|(?:^|[.!?,;]\s*)(?:please\s+)?(?:go home|head home|you can go(?: home)?|time to go(?: home)?|off you go)\s*,?\s+(?:mimi|cocoa|guys|you two|both of you)\b/;   // + "Mimi, can you leave?", "go home Cocoa" (Nov 3 review)
export function dismissIntent(text) {
  const t = String(text || "").toLowerCase().replace(/[’`]/g, "'").trim();
  if (!t || !BYE_FRIEND.test(t) || /\b(?:don'?t|do not|never|not)\s+(?:\w+\s+){0,2}(?:go|leave)\b|\bdon'?t want (?:them|her|him) to (?:go|leave)\b/.test(t)) return null;
  const named = ["mimi", "cocoa"].filter((w) => new RegExp(`\\b${w}\\b`).test(t));
  return named.length === 1 ? named : ["mimi", "cocoa"];
}
export function talkToIntent(text) {
  const t = String(text || "").toLowerCase().replace(/[’`]/g, "'").trim();
  // "Mimi, …", "hey cocoa!", "@cocoa …", "Cocoa what's your favourite snack", "…, Mimi?", "hi Mimi", "can I talk to
  // Cocoa", "ask Mimi what she thinks". Not "Mimi is so cute", "cocoa is my favourite drink", "did you ask Mimi out?"
  // (Nov 3 review).
  const m = /^(?:(?:hey|hi|hello|hiya|yo|oi|ok|okay|so|and|dear|aww|omg|wow)\s*,?\s+)?@?(mimi|cocoa)\s*[,!:?]/.exec(t)
    || /^@(mimi|cocoa)\b/.exec(t)
    || /^(mimi|cocoa)\s+(?:how (?:are|was|is|do|did)|what(?:'s| is| are| do| did)? (?:your|you)\b|do you|did you|are you|can you|could you|will you|would you|have you|tell me|say (?:hi|hello)|please|guess what|wanna|want to)\b/.exec(t)
    || /,\s*(mimi|cocoa)\s*[?!.~]*\s*$/.exec(t)
    || /^(?:hey|hi|hello|hiya|yo|good (?:morning|night|evening))\s+(mimi|cocoa)\b/.exec(t)
    || /^(?:(?:can|could|may) i |let me |i (?:want|wanna) (?:to )?)?(?:talk|speak) (?:to|with) (mimi|cocoa)\b/.exec(t)
    || /^ask (mimi|cocoa)\b(?! out\b)/.exec(t);
  return m ? m[1] : null;
}
export const brainHelpers = {};
export function makeBrain({ memory, fetchImpl = fetch, log = console, story = null }) {
  const ALL_TOOLS = story ? [...TOOLS, ...story.tools] : TOOLS;
  let toolMode = CONFIG.llm.toolMode;   // "auto" | "native" | "tags"

  // a prop he has, by name or by kind ("the bazooka" → his launcher)
  function findOwned(name) {
    if (!name) return null;
    const low = String(name).toLowerCase();   // a grenade or a bomb is a confetti ball in his world
    if (/\bwater[- ]?bombs?\b/.test(low)) name = "water balloon"; else if (/\b(grenades?|bombs?)\b/.test(low) && !/\blaunchers?\b/.test(low)) name = "confetti ball";
    else if (!memory.findProp(name) && /\b(trikes?|tricycles?)\b/.test(low)) name = "tricycle"; else if (!memory.findProp(name) && /\b(bikes?|bicycles?)\b/.test(low)) name = "bicycle";
    else if (!memory.findProp(name) && /\bskate/.test(low)) name = "skateboard";
    const props = memory.props(), w = String(name).toLowerCase().trim();
    const same = props.find((p) => p.name.toLowerCase() === w);   // his own by its exact name (a LIKE match could be "umbrella hat")
    if (same) return same;
    const exact = memory.findProp(name);
    if (exact) return exact;
    const ship = /\brockets?\b/.test(w) && !/launch|confetti|\bfire\b|shoot|bazooka/.test(w) && props.find((p) => p.archetype === "ride" && ROCKET_RIDE.test(p.name));
    if (ship) return memory.findProp(ship.name) || ship;   // "the rocket": his rocket ship, when he has one
    if (BIG_LAUNCHER.test(w)) {   // his own big one, else the one in his pocket (before any small "launcher" by name)
      const b = bigOwned(props); if (b) return memory.findProp(b.name);
      const pat = POCKET.find((e) => e.archetype === "launcher" && e.heavy);
      if (pat) return { id: null, name: pat.name, archetype: pat.archetype, recipe: pat, pocket: true };
    }
    // A word that says which one ("water", "globe") beats a word any launcher has ("gun", "rocket"): "show me your water
    // gun" is the water pistol in his pocket, not the confetti rocket launcher he made (M5, Nov 2: it pulled out the
    // launcher twice).
    const own = bestByWords(props, w), pk = pocketFor(w);
    if (own && own.specific && !(pk && pk.specific > own.specific)) return own.item;   // ("water balloon": the pocket one, not his own water pistol)
    if (pk && pk.specific) return pocketProp(pk.item);
    if (own) return own.item;
    if (LAUNCHER_WORDS.test(w)) { const l = props.find((p) => p.archetype === "launcher"); if (l) return memory.findProp(l.name); }
    // not made yet: the hand-made pattern from his pocket ("show me your globe")
    const pat = (pk && pk.item) || (LAUNCHER_WORDS.test(w) && POCKET.find((e) => e.name === "water pistol"));
    return pat ? pocketProp(pat) : null;
  }

  // the prop a move is done with, for a lesson: the one it was taught for, else one of his of that kind, else the pocket's
  function lessonProp(mv) {
    if (!mv || !mv.prop_archetype) return null;
    const props = memory.props(), linked = props.find((p) => p.useMove === mv.id) || props.find((p) => p.archetype === mv.prop_archetype);
    if (linked) return linked.recipe;
    const pat = POCKET.find((e) => e.archetype === mv.prop_archetype);
    return pat || null;
  }
  brainHelpers.lessonProp = lessonProp;
  brainHelpers.findOwned = findOwned;

  // ---- fixing a prop they don't like ("it's too big", "make the soup green")
  let heldNow = null;   // what's in his hoof this turn (set by reply)
  // "it": the thing he just revealed (the last 20 minutes), else what he's holding
  function recentProp() {   // "it": what he's holding (he's showing it to you), else what he revealed in the last 20 minutes
    if (heldNow && heldNow.name) { const h = findOwned(heldNow.name); if (h) return h; }
    const lr = memory.get("lastReveal", null);
    if (lr && lr.id && Date.now() - (lr.at || 0) < 20 * 60000) { const p = memory.props().find((x) => x.id === lr.id); if (p) return p; }
    return null;
  }
  function fixProp(prop, change, effects) {
    if (effects.fixed) return `already fixed it this turn`;
    const k = sizeChange(change), owned = prop.id ? memory.props().find((p) => p.id === prop.id) : null, recipe = (owned && owned.recipe) || prop.recipe;
    if (k && recipe && pureSize(change, prop.name)) {
      const r = resizeRecipe(recipe, k);
      if (!r.ok) return `that didn't work; try describing the change`;
      if (Math.abs(r.k - 1) < 0.03) return `the ${prop.name} is already as ${k > 1 ? "big" : "small"} as it can go`;
      let id = prop.id;
      if (id) memory.setPropRecipe(id, r.recipe);
      else {   // a pocket thing: his own copy, the size they like
        const when = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
        id = memory.addProp({ name: prop.name, archetype: prop.archetype, recipe: r.recipe, origin: `you asked me to make it ${k < 1 ? "smaller" : "bigger"} on ${when}`, source: "user", meta: { resized: r.k } });
      }
      const how = r.k < 1 ? "smaller" : "bigger";
      effects.actions.unshift({ ...propAction({ id, name: prop.name, archetype: prop.archetype, recipe: r.recipe }, "show"), fixed: how });
      effects.fixed = { id, k: r.k, how };
      memory.scrap(`you said my ${prop.name} was too ${how === "smaller" ? "big" : "small"}, so I made it ${how}`, "props", id);
      return `done: the ${prop.name} is ${how} now and out where they can see it`;
    }
    if (!prop.id) {   // a pocket thing they want different: a new one of their own
      const r = memory.enqueue({ kind: "prop", request: `${prop.name}: ${change}`.slice(0, 200), priority: 0.8, context: effects.said });
      effects.queued.push({ kind: "prop", ...r, name: prop.name });
      return r.duplicate ? `already on the workbench` : `a new ${prop.name} the way they want is on the workbench; don't promise a time`;
    }
    const r = memory.enqueue({ kind: "prop", request: `${prop.name}: ${change}`.slice(0, 200), priority: 0.8, context: `fix:${prop.id}` });
    effects.queued.push({ kind: "prop", ...r, name: prop.name, fix: true });
    effects.fixed = { id: prop.id, queued: true };
    return r.duplicate ? `the fix is already on the workbench` : r.status === "someday" ? `the workbench is full; the fix went on the someday list` : `the fix is on the workbench (it replaces the ${prop.name} when it's done); don't promise a time`;
  }
  brainHelpers.fixProp = fixProp;
  function context(extra, holding) {
    const facts = memory.facts(30), props = memory.props(), moves = memory.moves(), phrases = memory.phrases().slice(0, 20), follow = memory.followUps();
    const lines = [];
    if (facts.length) lines.push("What you remember about them:\n" + facts.map((f) => `- ${f.text}${f.when_date ? ` (${f.when_date})` : ""}`).join("\n"));
    lines.push("Props you have: " + (props.length ? props.map((p) => `${p.name} [${p.archetype}] (made ${p.created_at.slice(0, 10)}: ${p.origin})`).join("; ") : "none yet"));
    const taught = props.filter((p) => p.useMove).map((p) => { const mv = memory.moveById(p.useMove); return mv ? `${p.name} → ${mv.name}` : null; }).filter(Boolean);
    if (taught.length) lines.push(`How they taught you to use your props (use_prop does it): ${taught.join("; ")}`);
    lines.push("Moves you know: " + (moves.length ? moves.map((m) => `${m.name}${m.prop_archetype ? ` (with any ${m.prop_archetype})` : ""} (skill ${Math.round(m.skill * 100)}%: ${m.origin})`).join("; ") : "only the built-ins"));
    lines.push("Your pocket: " + POCKET.map((e) => e.name).join(", ") + ".");
    const wearing = holding && holding.wearing && holding.wearing.length ? `, and you're wearing your ${holding.wearing.join(" and your ")}` : "";
    lines.push(holding ? `On screen right now you have your ${holding.name} ${holding.slot === "hand" ? "in your hoof" : holding.slot === "beside" ? "beside you" : holding.slot === "ride" ? "under you (you're on it)" : "on"}${wearing}.` : "Right now you aren't holding any prop.");
    const fm = memory.get("friendMoves", {});
    const taughtFriends = Object.entries(fm).filter(([, v]) => v && v.length).map(([k, v]) => `${k === "mimi" ? "Mimi" : "Cocoa"} knows ${v.join(", ")}`);
    if (taughtFriends.length) lines.push(`Moves you've taught your friends: ${taughtFriends.join("; ")}.`);
    const hs = memory.get("handshake", null);
    lines.push(hs && hs.steps ? `Your secret handshake with them: ${describeHandshake(hs.steps)} (done together ${hs.times || 0} time${hs.times === 1 ? "" : "s"}).` : "You don't have a secret handshake with them yet.");
    if (phrases.length) lines.push("Their phrases: " + phrases.map((p) => `"${p.phrase}"${p.meaning ? ` = ${p.meaning}` : " (heard, not sure yet)"}`).join("; "));
    // what's on the workbench, so "can you make me an umbrella?" twice gets "it's already on my workbench!" instead of
    // a promise with no request behind it (seen on the M5 when the same exchange was already in recent history)
    const bench = memory.queue().filter((j) => (j.status === "queued" || j.status === "working") && j.source !== "mochi");
    const secret = memory.secretGifts();
    if (secret.length) lines.push(`A surprise you're making for them on your own (keep it a secret: don't mention it or hint at it until you give it): ${secret.map((j) => `${j.request.split(":")[0]} ${j.reason || ""}`.trim()).join("; ")}.`);
    const someday = memory.queue().filter((j) => j.status === "someday");
    if (bench.length) lines.push("On your workbench list (not ready yet, and you don't know when they will be, so never promise a time; don't request these again): " + bench.map((j) => `${j.request.split(":")[0]} (${j.kind})`).join("; "));
    if (someday.length) lines.push("On your someday list (workbench was full): " + someday.map((j) => j.request.split(":")[0]).join("; "));
    lines.push("If they ask for a prop or move you don't have and it isn't on the workbench, you MUST call request_prop or request_move in this turn. Never say you'll make something without calling the tool.");
    if (follow.length) lines.push("Follow up on, if the moment is right (then it's done): " + follow.map((f) => `${f.text} (was ${f.when_date})`).join("; "));
    if (story) { try { lines.push(story.context()); } catch (e) { log.warn("[story]", e.message); } }   // his own plans and what he did on his own
    if (extra) lines.push(extra);
    lines.push(`Today is ${new Date().toDateString()}.`);
    return lines.join("\n\n");
  }

  // One call to LM Studio. Returns the assistant message plus what it cost: finish reason, tokens, and how much hidden
  // reasoning came back (LM Studio puts a thinking model's reasoning in `reasoning_content`; if it uses up max_tokens
  // there, `content` comes back empty with finish_reason "length").
  let sendEffort = CONFIG.llm.reasoningEffort && CONFIG.llm.reasoningEffort !== "off", sendTtl = CONFIG.llm.ttl > 0;
  async function complete(messages, { tools, signal, maxTokens } = {}, stats) {
    const body = { model: CONFIG.llm.model, messages, temperature: CONFIG.llm.temperature, max_tokens: maxTokens || CONFIG.llm.maxTokens, stream: false };
    if (tools) body.tools = tools;
    if (sendEffort) body.reasoning_effort = CONFIG.llm.reasoningEffort;
    if (sendTtl) body.ttl = CONFIG.llm.ttl;   // a model loaded just-in-time stays loaded (LM Studio's idle TTL)
    const t0 = Date.now();
    let res = await fetchImpl(`${CONFIG.llm.baseUrl}/chat/completions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
    if (!res.ok && sendTtl && res.status === 400) {   // a server that refuses `ttl`: stop sending it (and ask again)
      const t = await res.clone().text().catch(() => "");
      if (/\bttl\b/i.test(t)) { sendTtl = false; delete body.ttl; log.warn("[brain] server rejected ttl; not sending it any more"); res = await fetchImpl(`${CONFIG.llm.baseUrl}/chat/completions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal }); }
    }
    if (!res.ok && sendEffort && res.status === 400) {   // a model or server that refuses the field: drop it for good and ask again
      const t = await res.text().catch(() => "");
      if (/reasoning/i.test(t)) {
        sendEffort = false; delete body.reasoning_effort; log.warn("[brain] server rejected reasoning_effort; not sending it any more");
        res = await fetchImpl(`${CONFIG.llm.baseUrl}/chat/completions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
      } else throw new Error(`LM Studio 400: ${t.slice(0, 200)}`);
    }
    if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(`LM Studio ${res.status}: ${t.slice(0, 200)}`); }
    const j = await res.json();
    const c = (j.choices && j.choices[0]) || {};
    const m = c.message || { content: "" };
    if (stats) {
      stats.calls += 1; stats.ms.push(Date.now() - t0); stats.finish = c.finish_reason || null;
      stats.tokens += (j.usage && j.usage.completion_tokens) || 0;
      stats.reasoningChars += String(m.reasoning_content || m.reasoning || "").length;
      stats.raw.push({ finish: c.finish_reason || null, content: String(m.content ?? "").slice(0, 240), tools: (m.tool_calls || []).map((t) => t.function && t.function.name) });
    }
    return m;
  }
  const asHistory = (m) => ({ role: "assistant", content: m.content || null, ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}) });   // never send reasoning back
  // leaked thinking: Gemma's thought channel, <think>, and broken bits of them (M5, Nov 3: "hold this" got back
  // "<thought\n搬>"); stray control tokens; and if nothing but a stray character is left, that's no reply at all (so
  // the retry asks for words)
  const clean = (s) => {
    let t = String(s || "").replace(/<\|channel>thought[\s\S]*?(<channel\|>|$)/g, "").replace(/<think>[\s\S]*?(<\/think>|$)/g, "").replace(/<(thought|thinking|analysis|reasoning)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
    t = t.replace(/<\/?\s*\|?\s*(?:thought|thinking|think|channel|analysis|reasoning)\b[^>]{0,60}>?/gi, "").replace(/<\|[a-z_]{1,24}\|?>|<[a-z_]{1,24}\|>/gi, "").trim();
    if (t && t.replace(/[\s\p{P}\p{S}]/gu, "").length <= 1) t = "";
    return t;
  };

  // run one tool; returns a short result string for the model and side effects on memory
  function runTool(name, args, effects) {
    args = args || {};
    switch (name) {
      case "remember": {
        if (!args.text) return "nothing to remember";
        const id = memory.remember(args.text, { kind: args.kind || "fact", when: args.when || null, weight: Math.max(0, Math.min(1, +args.weight || 0.5)) });
        effects.remembered.push({ id, text: args.text }); if (story) story.onEvent({ kind: "remembered", text: args.text });
        return `remembered: ${args.text}`;
      }
      case "request_prop": {
        const built = builtinProp(`${args.name || ""} ${args.description || ""}`);
        if (built) {   // never queue what the kit already draws ("do you have a xmas hat?" queued one on the M5, Nov 1)
          if (built.costume) effects.actions.push({ kind: "costume", name: built.costume });
          return `you already have ${built.label}${built.costume ? "; you're wearing it now" : ""}. Don't make a new one`;
        }
        const have = memory.findProp(args.name);
        if (have) { effects.actions.push({ kind: "prop", name: have.name, id: have.id, verb: "summon", archetype: have.archetype, recipe: have.recipe }); memory.usedProp(have.id); return `you already have "${have.name}" (made: ${have.origin}); using it, no new one needed`; }
        const r = memory.enqueue({ kind: "prop", request: `${args.name}${args.description ? `: ${args.description}` : ""}`, priority: Math.max(0, Math.min(1, +args.importance || 0.6)), context: effects.said });
        effects.queued.push({ kind: "prop", ...r, name: args.name });
        return r.duplicate ? `already on the workbench, it's coming` : r.status === "someday" ? `workbench is full; it went on the someday list` : `queued on the workbench. You don't know when it will be ready (it can take a while, and the workbench may be closed), so don't promise a time or say you're working on it right now`;
      }
      case "request_move": {
        const builtMove = builtinMove(args.name);
        if (builtMove && !memory.findMove(args.name)) {   // a wave or a hop is already in his body: do it, don't learn it
          effects.actions.push({ kind: "mood", name: builtMove });
          return `that's one of your own moves; doing it now`;
        }
        const have = memory.findMove(args.name);
        if (have) { effects.actions.push({ kind: "move", name: have.name, id: have.id, recipe: have.recipe, skill: have.skill }); memory.practised(have.id, 0.06); return `you already know "${have.name}"; performing it`; }
        const r = memory.enqueue({ kind: "move", request: `${args.name}${args.description ? `: ${args.description}` : ""}`, priority: Math.max(0, Math.min(1, +args.importance || 0.6)), context: effects.said });
        effects.queued.push({ kind: "move", ...r, name: args.name });
        return r.duplicate ? `already learning it` : `queued (a few minutes)`;
      }
      case "fix_prop": {
        const it = !args.prop || /^(it|this|that|this one|that one|the new one|the thing|thing)$/i.test(String(args.prop).trim());
        const prop = it ? recentProp() : findOwned(args.prop);
        if (!prop) return it ? `there's nothing out to fix; ask which prop they mean` : `you don't have "${args.prop}"; offer to make it (request_prop)`;
        return fixProp(prop, String(args.change || args.prop || ""), effects);
      }
      case "show_prop":
      case "use_prop": {
        const prop = findOwned(args.prop);
        if (!prop) return `you don't have "${args.prop}"; offer to make it (request_prop)`;
        const use = name === "show_prop" ? "show" : prop.archetype === "launcher" || prop.archetype === "throwable" ? "fire" : prop.archetype === "ride" ? "ride" : "use";
        const taught = use === "use" && prop.id ? memory.propUse(prop.id) : null;   // the way they taught him
        if (taught) {
          effects.actions.push({ kind: "move", name: taught.name, id: taught.id, recipe: taught.recipe, skill: taught.skill, prop: { id: prop.id, name: prop.name, archetype: prop.archetype, recipe: prop.recipe } });
          memory.usedProp(prop.id); memory.practised(taught.id, 0.06);
          return `using your ${prop.name} the way they taught you: ${taught.name}`;
        }
        effects.actions.push(propAction(prop, use, { aim: !!args.aim }));
        if (prop.id) { memory.usedProp(prop.id); if (story) story.onEvent({ kind: "used", propId: prop.id }); }
        return use === "ride" ? `you're riding your ${prop.name} across the stage and back` : use === "show" ? `${prop.name} is out where they can see it` : use === "fire" ? (args.aim ? `aiming: they tap where it should go` : `fired the ${prop.name}`) : `using the ${prop.name}`;
      }
      case "perform": {
        const prop = args.prop ? findOwned(args.prop) : null;
        const mv = memory.findMove(args.move);
        if (mv) {
          memory.practised(mv.id, 0.06); if (story) story.onEvent({ kind: "performed", moveId: mv.id });
          effects.actions.push({ kind: "move", name: mv.name, id: mv.id, recipe: mv.recipe, skill: mv.skill, prop: prop && { id: prop.id, name: prop.name, archetype: prop.archetype, recipe: prop.recipe } });
          if (prop && prop.id) memory.usedProp(prop.id);
          return `performing ${mv.name}${prop ? ` with ${prop.name}` : ""}`;
        }
        const builtin = ["hello", "happy", "excited", "superexcited", "proud", "shy", "laugh", "love", "nod", "thinking", "surprised", "showoff", "sleepy"];
        const b = builtin.find((x) => String(args.move).toLowerCase().includes(x));
        if (b && prop) {   // "show off the map": hold it up proudly (the showoff face brings Mimi, which isn't what they asked)
          effects.actions.push(propAction(prop, "show")); effects.actions.push({ kind: "mood", name: b === "showoff" ? "proud" : b });
          if (prop.id) memory.usedProp(prop.id); return `${b} with ${prop.name} in your hoof`;
        }
        if (b) { effects.actions.push({ kind: "mood", name: b }); return `doing ${b}`; }
        if (DANCE_WORD.test(String(args.move || ""))) { const hd = happyDance(); if (hd) { effects.actions.push(hd); return "dancing your happy dance (you always know how to dance)"; } }
        return `you don't know "${args.move}" yet; use request_move to learn it`;
      }
      case "throw_at": {
        const from = args.thrower === "cocoa" ? "cocoa" : "mochi", at = ["cocoa", "mimi", "mochi", "viewer"].includes(args.target) && args.target !== from ? args.target : from === "mochi" ? "cocoa" : "mochi";
        const thing = thingFor(args.thing || ""), ball = POCKET.find((e) => e.name === thing), shield = POCKET.find((e) => e.name === SHIELD);
        effects.actions.push({ kind: "throw", steps: [{ from, at }], thing, ball, shield });
        return at === "mimi" ? `${from === "mochi" ? "you throw" : "Cocoa throws"} a ${thing} at Mimi (she's called over first if she isn't here); it gets her, she squeals and giggles` : `${from === "mochi" ? "you throw" : "Cocoa throws"} a ${thing} at ${at === "viewer" ? "them" : at === "mochi" ? "you" : "Cocoa"}; whoever gets hit says ouch and gets a shield ready for next time`;
      }
      case "teach_use": {
        const prop = findOwned(args.prop);
        if (!prop) return `you don't have "${args.prop}" yet; offer to make it (request_prop)`;
        const mv = String(args.name || `${prop.name.split(" ").at(-1)} trick`).slice(0, 40);
        const r = memory.enqueue({ kind: "move", request: `${mv}: ${args.how || "a fun way to use it"}, holding the ${prop.name} [for: ${prop.name}]`, priority: 0.7, context: effects.said });
        effects.queued.push({ kind: "move", ...r, name: mv });
        return `practising "${mv}" with your ${prop.name} on the workbench; when it's ready, that's how you use it`;
      }
      case "do_activity": {
        const raw = String(args.what || "").trim().toLowerCase().slice(0, 80);
        const what = ["paint", "juggle", "trick"].includes(raw) ? raw : /^(?:paint|draw)/.test(raw) ? "paint" : /^juggl/.test(raw) ? "juggle" : /^(?:a |do a )?(?:party |magic )?trick$/.test(raw) ? "trick" : null;
        if (!what) {   // the activity book, or one he makes up
          if (!raw) return "say which activity";
          const e = bookLookup(raw);
          effects.activityAsk = e ? { kind: "book", id: e.id, ask: `${raw} ${args.subject || ""}`.trim() } : { kind: "improvise", ask: `${raw}${args.subject ? ` (${String(args.subject).slice(0, 60)})` : ""}` };
          return e ? `you're ${e.ing} on screen right now` : `you're making up "${raw}" on the spot with what you've got; it starts in a moment`;
        }
        effects.activityAsk = what === "paint" ? { kind: "paint", subject: args.subject ? String(args.subject).slice(0, 60) : null } : what === "juggle" ? { kind: "juggle" } : { kind: "trick", ask: String(args.subject || "") };
        return what === "paint" ? `your easel is out and you're painting ${args.subject || "something you chose"}` : what === "juggle" ? "you're juggling (you might drop one!)" : "you're doing your trick";
      }
      case "teach_friend": {
        const who = args.friend === "cocoa" ? "cocoa" : "mimi", moves = memory.moves();
        const mv = (args.move && memory.findMove(args.move)) || moves.slice().sort((a, b) => b.id - a.id)[0];
        if (!mv) return "you don't know any moves to teach yet: they can teach you one first (Teach a move)";
        effects.actions.push({ kind: "teach", who, move: { id: mv.id, name: mv.name, recipe: mv.recipe, skill: mv.skill }, prop: lessonProp(mv) });
        return `teaching ${who === "mimi" ? "Mimi" : "Cocoa"} your ${mv.name}: you show it, then they try`;
      }
      case "learn_phrase": {
        if (!args.phrase) return "no phrase";
        memory.heard(args.phrase, { meaning: args.meaning || null, stage: args.meaning ? "known" : "heard", action: args.action || null });
        if (args.action) memory.scrap(`you taught me: when you say "${args.phrase}", I ${args.action}`, "phrases");
        effects.learned.push({ phrase: args.phrase, meaning: args.meaning, action: args.action });
        return `learned "${args.phrase}"`;
      }
      default: { const r = story ? story.runTool(name, args, effects.said) : null; if (r) { effects.story = true; return r; } return `unknown tool ${name}`; }
    }
  }

  function parseTagTools(text) {
    const calls = [];
    const clean = text.replace(/<tool>([\s\S]*?)<\/tool>/g, (_, j) => { try { const c = JSON.parse(j); calls.push({ name: c.name, arguments: c.arguments || {} }); } catch (_) { /* ignore */ } return ""; });
    return { clean, calls };
  }

  // One user turn → reply. `note` is a one-line description of what his body already did ("Mochi looked hurt").
  async function reply({ text, note, extraContext, signal, mode = null, holding = null, friendsHere = [], onStage = null, talkTo = null, calm = false, gone = [], noTools = false }) {
    const effects = { actions: [], remembered: [], queued: [], learned: [], toolCalls: [], said: text };   // said: what they asked, kept with workbench jobs
    const stats = { calls: 0, ms: [], tokens: 0, reasoningChars: 0, finish: null, retried: false, raw: [] };
    heldNow = holding;
    const here = onStage ? [...new Set([...onStage, ...friendsHere, ...(talkTo ? [talkTo] : [])])] : null, Name = (w) => (w === "mimi" ? "Mimi" : "Cocoa");
    const stageLine = !here ? "" : here.length ? `\n\nOn stage with you right now: ${here.map(Name).join(" and ")}.${here.length < 2 ? ` ${["mimi", "cocoa"].filter((w) => !here.includes(w)).map(Name).join("")} isn't here, so no lines for them.` : ""}` : "\n\nMimi and Cocoa aren't on screen right now: don't write lines for them.";
    const talkLine = talkTo ? `\n\nThis message is to ${Name(talkTo)}, not to you (${talkTo === "mimi" ? "she" : "he"} came over to talk). Reply ONLY as ${Name(talkTo)}, in ${talkTo === "mimi" ? "her" : "his"} own voice and personality (${talkTo === "mimi" ? "sweet, a little shy, says ♡, calls you Mochi's friend" : "a laid-back, playful buddy who says dude"}), one to three short sentences, written as ${Name(talkTo)}: "…". You (Mochi) stay quiet this time.` : "";
    const sys = PERSONA + (mode === "zeroday" ? `\n\n${ZERO_DAY}` : "") + "\n\n" + context(extraContext, holding) + stageLine + talkLine + (note ? `\n\nOn screen just now: ${note}` : "") + (toolMode === "tags" ? TAG_TOOL_HINT : "");
    // the talk so far; two lines in a row from one side (a reveal he made between messages) are one message, since
    // some chat templates refuse two in a row
    const history = [], past = memory.recentTurns(13);
    if (past.length && past.at(-1).role === "user" && past.at(-1).text === text) past.pop();   // the server saved this one already
    for (const t of [...past.slice(-12), { role: "user", text }]) {
      const last = history.at(-1);
      if (last && last.role === t.role) last.content += `\n${t.text}`; else history.push({ role: t.role, content: t.text });
    }
    const messages = [{ role: "system", content: sys }, ...history];
    let msg = { content: "" }, pendingTools = false, toolWords = "";   // toolWords: what he said along with a tool call
    for (let round = 0; round < 3; round++) {
      try {
        msg = await complete(messages, { tools: toolMode === "tags" || noTools ? undefined : ALL_TOOLS, signal }, stats);   // (noTools: the scam check, Nov 7: "send me gift cards" in a pasted message is not a request)
      } catch (e) {
        if (toolMode === "auto" && /tool|function/i.test(e.message)) { toolMode = "tags"; log.warn("[brain] model rejected tools; switching to <tool> tags"); messages[0].content += TAG_TOOL_HINT; continue; }
        throw e;
      }
      pendingTools = false;
      if (toolMode !== "tags" && Array.isArray(msg.tool_calls) && msg.tool_calls.length) {
        toolMode = "native"; pendingTools = true;
        const said = clean(msg.content); if (said && stripActions(leakedToolCalls(said, TOOL_NAMES).clean).text) toolWords = said;
        messages.push(asHistory(msg));
        for (const tc of msg.tool_calls) {
          let args = {}; try { args = JSON.parse(tc.function.arguments || "{}"); } catch (_) { /* bad json */ }
          const result = runTool(tc.function.name, args, effects);
          effects.toolCalls.push({ name: tc.function.name, args, result });
          messages.push({ role: "tool", tool_call_id: tc.id, name: tc.function.name, content: result });
        }
        continue;   // let the model write the in-character reply with the tool results in hand
      }
      break;
    }
    // reasoning that leaked into the text (Gemma 4 can emit an empty thought block even with thinking off; Qwen <think>)
    let content = clean(msg && msg.content);
    // nothing new after the tool ran, but he'd already said it with the call ("Here it is! It's got all the little
    // lines on it." + show_prop, then an empty reply: M5, Nov 2): that's his answer
    if (toolWords && !stripActions(leakedToolCalls(content, TOOL_NAMES).clean).text) content = toolWords;
    // No words came back, or they were cut off mid-sentence (finish "length"): the model only called tools three times
    // running, or spent its budget thinking. Ask once more, without tools, with room to finish and a nudge to answer now.
    const truncated = !!content && stats.finish === "length";
    // Only an action and no words ("*tilts head*"): a blank chat bubble. Seen on the M5 after tool calls ("can you
    // wear a xmas hat?"). Keep the action for his body and ask for the words.
    const wordless = !!content && !/<tool>/.test(content) && !stripActions(leakedToolCalls(content, TOOL_NAMES).clean).text && !leakedToolCalls(content, TOOL_NAMES).calls.length;
    if (truncated || wordless || (!content && (pendingTools || !(msg.tool_calls && msg.tool_calls.length)))) {
      stats.retried = true;
      log.warn(`[brain] ${truncated ? "cut-off" : wordless ? "wordless" : "empty"} reply (finish=${stats.finish}, reasoning ${stats.reasoningChars} chars, ${stats.tokens} tok); retrying. Raw: ${JSON.stringify(stats.raw)}`);
      const ask = "\n\nNow reply to them in words, in character, in one or two short sentences. Don't use tools." + (effects.toolCalls.length ? ` You just did: ${effects.toolCalls.map((t) => `${t.name} → ${t.result}`).join("; ")}.` : "");
      const again = messages.map((m, i) => (i === 0 ? { ...m, content: m.content + ask } : m));
      try {
        const m2 = await complete(again, { signal, maxTokens: Math.max(1200, CONFIG.llm.maxTokens * 3) }, stats);
        const c2 = clean(m2.content);
        if (c2 && stripActions(c2).text) { content = wordless ? `${content} ${c2}` : c2; msg = m2; }   // keep the first action; keep cut-off text if the retry is no better
      } catch (e) { log.warn("[brain] retry failed:", e.message); }
    }
    effects.llm = { calls: stats.calls, ms: stats.ms, tokens: stats.tokens, reasoningChars: stats.reasoningChars, finish: stats.finish, retried: stats.retried };
    if (!content) { const e = new Error(`empty reply after ${stats.calls} call(s): finish=${stats.finish}, reasoning ${stats.reasoningChars} chars, ${stats.tokens} tokens`); e.llm = effects.llm; e.raw = stats.raw; e.effects = effects; throw e; }
    if (toolMode === "tags" || /<tool>/.test(content)) {
      const { clean, calls } = parseTagTools(content);
      content = clean;
      for (const c of calls) effects.toolCalls.push({ name: c.name, args: c.arguments, result: runTool(c.name, c.arguments, effects) });
    }
    {   // a tool call written out as words: do it, and don't show it
      const { clean, calls } = leakedToolCalls(content, TOOL_NAMES);
      if (calls.length) { content = clean; effects.leaked = calls.map((c) => c.name); }
      for (const c of calls) effects.toolCalls.push({ name: c.name, args: c.arguments, result: runTool(c.name, c.arguments, effects), leaked: true });
    }
    content = plainText(content);
    // who's on stage, or who they asked about (not one they just sent home: "let Mimi go" names her too; review, Nov 3)
    const named = ["cocoa", "mimi"].filter((w) => new RegExp(`\\b${w}\\b`, "i").test(text) && !gone.includes(w));
    // who may speak: whoever is on stage (the page says), coming in this turn, or asked about; once Mimi has gone,
    // her lines don't keep turning up in the chat (Nov 2)
    const allowed = onStage ? [...new Set([...onStage, ...friendsHere, ...named, ...(talkTo ? [talkTo] : [])])] : null;
    const fl = friendLines(content, { here: [...new Set([...friendsHere, ...named, ...(talkTo ? [talkTo] : [])])], only: allowed, max: talkTo ? 260 : 160 });
    if (fl.lines.length || fl.dropped.length) content = fl.text;
    // their lines are words only: a "*giggles and twirls*" would show its asterisks in their bubble (review, Nov 3)
    const bare = (x) => ({ ...x, text: stripActions(String(x.text || "")).text.replace(/\s{2,}/g, " ").trim() });
    // "Cocoa: Cocoa starts laughing so hard he can't stop, dude!" (Nov 7): a stage direction, acted out, not said
    fl.lines = fl.lines.map(bare).map((x) => { const n = narrated(x.text, x.who); return n ? { who: x.who, text: "", act: n.act, note: n.note } : x; }).filter((x) => (x.text || x.act) && !gone.includes(x.who));
    if (fl.lines.length) effects.friendSay = fl.lines;
    // talking to Mimi or Cocoa (the button by the message box, or "Mimi, …") and the model answered as Mochi with no
    // "Mimi: …" line (M5, Nov 3: "the talking to a particular character option doesn't seem to work"): it was her answer
    else if (talkTo && content.trim()) {
      const own = stripActions(content.replace(/^\s*(?:mochi|me)\s*:\s*/i, "")).text.replace(/^["“]|["”]$/g, "").replace(/\s{2,}/g, " ").trim();
      if (own) { effects.friendSay = [{ who: talkTo, text: own.slice(0, 260) }]; content = ""; }
    }
    let { text: spoken, actions } = stripActions(content);
    // a *does the twirl* in the prose becomes a real move if he knows it
    for (const a of actions) {
      if (a.kind === "ride") { const prop = findOwned(a.name); if (prop && prop.archetype === "ride" && !effects.actions.some((b) => b.kind === "prop" && b.archetype === "ride")) effects.actions.push(propAction(prop, "ride")); continue; }
      if (a.kind === "move") { const mv = memory.findMove(a.name); if (mv) { memory.practised(mv.id, 0.06); effects.actions.push({ kind: "move", name: mv.name, id: mv.id, recipe: mv.recipe, skill: mv.skill }); } else if (DANCE_WORD.test(a.name || "") && happyDance()) effects.actions.push(happyDance()); else effects.actions.push({ kind: "mood", name: "excited" }); }
      else effects.actions.push(a);
    }
    // He said "here it is!" or "Boom!" about a prop but called no tool, so nothing appeared (M5, Nov 2: "show me the
    // map" → "Check it out!" with the map never shown; "go" → "Boom! Confetti everywhere!" with nothing fired).
    if (!calm && !effects.actions.some((a) => a.kind === "prop" || a.kind === "costume")) {
      const recent = memory.recentTurns(6).filter((t) => t.role === "user").map((t) => t.text);
      const intent = propIntent({ text, spoken, props: memory.props(), holding, recent });
      if (intent) {
        const prop = intent.prop.pocket ? intent.prop : intent.prop.id ? intent.prop : memory.findProp(intent.prop.name);
        if (prop) {
          effects.actions.unshift(propAction(prop, intent.use, { aim: intent.aim })); effects.backstop = intent.use; if (prop.id) memory.usedProp(prop.id);
          // ...and his words said there wasn't one (Nov 4: "make a cookie" went on the someday list; "show me the
          // cookie" → "I don't have one ready yet, I'll show you when it's done baking" as he held up the cookie
          // from his pocket). The words give way to what he's holding.
          if (NOT_YET.test(spoken)) {
            const words = (x) => String(x).toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2);
            const mine = words(prop.name), job = memory.queue().find((j) => ["queued", "working", "someday"].includes(j.status) && words(j.request.split(":")[0]).some((w) => mine.includes(w)));
            const jobName = job && job.request.split(":")[0].trim();
            spoken = job && jobName.toLowerCase() !== String(prop.name).toLowerCase()
              ? `The ${jobName} isn't ready yet, but here's a little ${prop.name} ${prop.pocket ? "from my pocket " : ""}for now!`
              : `Oh wait, I do have one! Here's my ${prop.name}!`;
            console.log(`[honest] said there wasn't one, holding the ${prop.name}: "${spoken}"`);
          }
        }
      }
    }
    // They said it's too big (or he said he'd make it smaller) but no fix_prop came (M5, Nov 2: "no it doesnt, it is too
    // big" → "Too big for what?" → "the soup" → "I'll try to make a smaller bowl", and nothing happened).
    if (!effects.fixed && !calm) {
      const turns = memory.recentTurns(5), users = turns.filter((t) => t.role === "user").map((t) => t.text);
      if (users.length && users.at(-1) === text) users.pop();
      const props = memory.props(), names = (x) => { const own = bestByWords(props, String(x).toLowerCase()); return own && own.specific ? own.item : null; };
      const fx = fixIntent({ text, spoken, prevUser: users.at(-1) || "", names });
      const lf = memory.get("lastFix", null), again = fx && fx.carried && lf && Date.now() - (lf.at || 0) < 3 * 60000;
      if (fx && !again) {
        const prop = fx.target || recentProp();
        if (prop) { const res = fixProp(prop, fx.change, effects); if (effects.fixed) { effects.backstop = "fix"; effects.toolCalls.push({ name: "fix_prop", args: { prop: prop.name, change: fx.change }, result: res, backstop: true }); } }
      }
    }
    if (effects.fixed && effects.fixed.id) memory.set("lastFix", { id: effects.fixed.id, at: Date.now() });
    for (const a of effects.actions) if (a.kind === "mood" && a.name === "showoff" && effects.actions.some((b) => b.kind === "prop")) a.name = "proud";
    // only an action came back (*leans in*): he acts it out and says nothing, which is fine
    return { text: spoken, ...effects, toolMode };
  }

  // A first request right after the server starts, so LM Studio has his long persona prompt warm and the first real
  // message isn't the slow one (~10 s cold on the M5, Nov 1). One token, nothing saved.
  async function warmup() {
    const t0 = Date.now(), stats = { calls: 0, ms: [], tokens: 0, reasoningChars: 0, finish: null, retried: false, raw: [] };
    await complete([{ role: "system", content: PERSONA + "\n\n" + context("", null) }, { role: "user", content: "hi" }], { tools: toolMode === "tags" ? undefined : ALL_TOOLS, maxTokens: 1, signal: AbortSignal.timeout(90000) }, stats);
    return Date.now() - t0;
  }
  return { reply, warmup, stripActions, context, tools: ALL_TOOLS, get toolMode() { return toolMode; } };
}
