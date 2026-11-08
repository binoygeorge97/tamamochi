// Props from the conversation: Mochi takes out the thing that fits what you said, without being asked. A geography
// question → he takes out his globe and looks at it, then answers; rain → his umbrella; good news → the confetti
// popper, fired into the air; a tease → a squirt from his water pistol, at you. Decided by plain word rules next to
// the feelings model (in the ~15 ms before he starts "reading"), so the prop is out while he thinks, and the brain is
// told what he did so his words match.
//
// Each cue: words to match, the prop (his own if he made one, else the hand-made pattern from shared/craft.js, his
// "pocket"), what he does with it, and a line for the brain. Guards: never in a crisis, in care mode, while sulking,
// or when the person is hurting (comfort/concern), except the teddy, which is for comfort; never for a request to
// make something (that's the workbench); one cue per message; each cue rests a while before it fires again, and
// props come out now and then, not all the time: none within 40 s or 2 messages of the last one (a tease's squirt
// keeps its own longer rest), and not if he's already holding that thing.
import { PROP_EXAMPLES } from "../shared/craft.js";

const PATTERNS = Object.values(PROP_EXAMPLES).flat();
export const pattern = (name) => PATTERNS.find((e) => e.name === name) || null;

// how: study (take it out and look at it before answering), hold, wear, beside, use (tap it), cheer (fire up), squirt
export const CUES = [
  { id: "globe", prop: "desk globe", kinds: ["globe"], how: "study", rest: 60000,
    re: /\b(countr(y|ies)|borders?|bordering|capital (city )?of|continents?|oceans?|geography|equator|hemisphere|latitude|longitude|time zones?|which (country|continent|ocean)|where('s| is) [a-z]+ (located|on the map)|located in|largest (country|desert|island|lake|river)|longest river|highest mountain|population of|flag of|travel(l?ing)? to [a-z]+|trip to [a-z]+|visit(ing)? [A-Z])\b/i,
    note: "You just took out your desk globe and looked at it before answering (they can see it in your hoof). You can mention checking it, briefly, then answer." },
  { id: "map", prop: "folded map", kinds: ["map"], how: "study", rest: 60000,
    re: /\b(directions?|how (do|can) i get to|which way|route|road ?trip|nearest|get(ting)? lost|i'?m lost|navigat(e|ion)|treasure|hiking trail|street|neighbou?rhood)\b/i,
    note: "You just unfolded your map and looked at it (it's in your hoof). Mention it briefly if it fits." },
  { id: "ruler", prop: "wooden ruler", kinds: ["ruler"], how: "study", rest: 60000,
    re: /\b(how (long|tall|wide|big|high|deep|far|short)|(what('?s| is)|tell me) the (length|width|height|size)|measur(e|es|ed|ing|ement|ements)|inches|centimet(er|re)s?|millimet(er|re)s?|\d+\s?(cm|mm|in)\b|met(er|re)s? (long|tall)|feet tall|length|width of|size of|height of|ruler)\b/i,
    note: "You just held up your wooden ruler as if measuring. You can joke that it's only a little ruler, then answer." },
  { id: "umbrella", prop: "little blue umbrella", kinds: ["umbrella", "parasol"], how: "hold", rest: 120000,
    re: /\b(rain(ing|y|ed|s)?|pouring|drizzl(e|ing)|thunderstorms?|storm(y|ing)?|monsoon|showers? (today|later|outside))\b/i, not: /\b(brainstorm|rain ?check)\b/i,
    friends: [["mimi", "huddle"]],
    note: "You just opened your umbrella over your head because of the rain talk, and Mimi snuggled in close to share it." },
  { id: "celebrate", prop: "confetti popper", kinds: ["popper", "launcher"], how: "cheer", rest: 90000, decisions: ["cheer", "warm", "affection", "neutral", "surprised", "laugh"],
    re: /\b(happy birthday|my birthday|it'?s my bday|congrat(s|ulations)|i (got|landed) the job|got (a )?promot(ed|ion)|i passed|we won|i won|graduat(ed|ing|ion)|got engaged|we'?re engaged|it'?s a (boy|girl)|new year|hooray|woo+hoo+|let'?s celebrate|nailed it)\b/i,
    friends: [["mimi", "cheer"], ["cocoa", "cheer"]],
    note: "You just fired your confetti popper into the air to celebrate with them, and Mimi and Cocoa hopped in to celebrate too. Be excited with them." },
  { id: "piggy", prop: "piggy bank", kinds: ["piggy"], how: "beside", rest: 120000,
    re: /\b(sav(e|ing) (up|money|for)|savings|budget(ing)?|piggy bank|allowance|paycheck|pay ?day|rent money|spend(ing)? (too much|money))\b/i,
    note: "Your piggy bank just hopped out beside you, because they mentioned saving money." },
  { id: "coin", prop: "big gold coin", kinds: ["coin"], how: "use", rest: 60000,
    re: /\b(flip a coin|coin (flip|toss)|heads or tails|toss a coin|can'?t decide between|help me (decide|choose) between)\b/i,
    note: "You just took out your big gold coin and flipped it to help decide. Say which side it landed on (pick one) and what that means." },
  { id: "headphones", prop: "magenta headphones", kinds: ["headphones"], how: "wear", rest: 120000,
    re: /\b(song|songs|music|playlist|listen(ing)? to|album|concert|spotify|my jam|banger|favou?rite band|singer)\b/i,
    friends: [["mimi", "dance"]],
    note: "You just put on your magenta headphones because they're talking about music, and Mimi started dancing beside you." },
  { id: "flashlight", prop: "flashlight", kinds: ["flashlight", "torch"], how: "hold", rest: 120000, decisions: ["neutral", "concern", "surprised", "laugh", "cheer"],
    re: /\b(power (is |went )?out|blackout|it'?s (so )?dark|in the dark|can'?t see anything|scared of the dark|camping at night|ghost stor(y|ies))\b/i,
    note: "You just switched on your flashlight because it's dark where they are." },
  { id: "crown", prop: "golden crown", kinds: ["crown"], how: "wear", rest: 180000,
    re: /\b((you'?re|you are) (the |a )?(king|queen|prince|princess|royalty)|your majesty|bow down|all hail|royal(ty)?|king of the|queen of the)\b/i,
    note: "You just put on your golden crown, feeling royal." },
  { id: "helmet", prop: "protective helmet", kinds: ["helmet"], how: "wear", rest: 180000,
    re: /\b(bike ride|biking|cycling|skateboard(ing)?|scooter|roller ?blad(e|ing)|construction site|safety first|motorcycle|police officer|cop)\b/i,
    note: "You just put on your protective helmet. Safety first!" },
  { id: "goggles", prop: "night-vision goggles", kinds: ["goggles"], how: "wear", rest: 180000,
    re: /\b(spy|secret mission|stealth|sneak(ing|y)? (in|out|around)|undercover|top secret|night vision|hide and seek)\b/i,
    note: "You just put on your night-vision goggles, on a secret mission." },
  { id: "walkie", prop: "walkie-talkie", kinds: ["walkie"], how: "hold", rest: 120000,
    re: /\b(over and out|copy that|roger that|do you copy|come in,? mochi|walkie)\b/i,
    note: "You just grabbed your walkie-talkie. You can answer in radio talk (\"copy that, over!\")." },
  { id: "sunflower", prop: "potted sunflower", kinds: ["sunflower", "flower", "plant"], how: "beside", rest: 180000,
    re: /\b(garden(ing)?|plant(ed|ing)? (some|a|flowers|seeds)|flowers? (are )?bloom|spring is|sunny day|so sunny)\b/i,
    note: "Your potted sunflower just popped up beside you." },
  { id: "teddy", prop: "little teddy bear", kinds: ["teddy", "bear", "plush"], how: "beside", rest: 300000, decisions: ["comfort", "gentle", "concern", "neutral"], gentle: true,
    re: /\b(i'?m (so |really )?(lonely|alone)|feel(ing)? (so |really )?(lonely|alone)|can'?t sleep|had a nightmare|i miss (him|her|them|my))\b/i,
    friends: [["mimi", "comfort"]],
    note: "Your little teddy bear just sat down beside you, for them, and Mimi came and stood close, gently. Be gentle; you can offer the teddy as a hug." },
  { id: "squirt", prop: "water pistol", kinds: ["water pistol", "squirt", "blaster", "launcher"], how: "squirt", rest: 180000, decisions: ["pout"], tease: true,
    re: /\b((you'?re|you are|ur) (so |such a |a )?(slow|dumb|silly|weird|annoying|boring|lame|nerd|dork|goofy)|lol you|stupid sheep|smelly sheep|baa+ baa+|blah blah)\b/i,   // only without the feelings model
    friends: [["mimi", "giggle"]],
    note: "They teased you, so you just gave them a quick harmless squirt from your water pistol, right out of the screen, and Mimi giggled. Be cheeky and playful about it, not mean; you're not actually upset." },
  // friends only, no prop
  { id: "cocoa", prop: null, how: "friends", rest: 0, always: true, friends: [["cocoa", "hello"]],
    re: /\bcocoa\b/i,
    note: "Your best buddy Cocoa just slid in from the left and bumped hooves with you." },
  { id: "mimi", prop: null, how: "friends", rest: 0, always: true, friends: [["mimi", "showoff"]],
    decisions: ["neutral", "affection", "warm", "cheer", "surprised", "laugh", "concern", "comfort", "gentle", "forgive", "unhurt"],
    re: /\bmimi\b/i,
    note: "Mimi, your girlfriend, just hopped in beside you and waved; she's right here on screen." },
  { id: "buddy", prop: null, how: "friends", rest: 90000, friends: [["cocoa", "hello"]],
    re: /\b(best (friend|buddy|bud|pal)|bestie|your (friends|buddies|pals|buddy|bud)\b|do you have (any |a )?(friends?|buddy|buddies|pals?)|who('?s| is| are) your (best )?(friends?|buddy|buddies|pals?)|got (any )?friends)\b/i,
    note: "Your best buddy Cocoa (a brown sheep with little curled horns, freckles and a teal bandana) just slid in from the left and bumped hooves with you. Introduce him proudly; Mimi is your girlfriend, Cocoa is your best buddy." },
  { id: "dance", prop: null, how: "friends", rest: 120000, friends: [["mimi", "dance"], ["cocoa", "dance"]],
    re: /\b(let'?s dance|dance (party|with me|for me)|can you dance|show me your (dance )?moves)\b/i,
    note: "Mimi and Cocoa just joined you to dance." },
  { id: "play", prop: null, how: "friends", rest: 120000, friends: [["cocoa", "play"]],
    re: /\b(let'?s play|wanna play|want to play|play (a game|tag|catch|hide and seek|soccer|football|basketball|video ?games)|video ?games?|board games?|soccer|football|basketball|baseball|tennis|race you|i'?m (so )?bored|so bored)\b/i,
    note: "Your best buddy Cocoa just slid in, bumped hooves with you and is bouncing around, keen to play. You can include him." },
  { id: "joke", prop: null, how: "friends", rest: 120000, friends: [["cocoa", "giggle"]],
    re: /\b(tell (me |us )?a joke|know any jokes|another joke|something funny|make me laugh|a pun)\b/i,
    note: "Cocoa just slid in to hear the joke and is already giggling. Tell one short, silly, kind joke." },
  { id: "snack", prop: null, how: "friends", rest: 180000, friends: [["cocoa", "hello"]],
    re: /\b(snacks?|pizza|cookies?|i'?m (so )?hungry|ice cream|popcorn|candy|chocolate)\b/i,
    note: "Cocoa popped in from the left at the mention of food; he loves snacks. You can tease him about it." },
];

/**
 * Which cue fits this message, if any. ctx: { feelings decision, request, crisis, care, sulking, mode, owned (his props),
 * holding (name), lastFired: { id: time }, now }. Returns { id, how, note, prop: { name, archetype, recipe, id? } } or null.
 */
export const CUE_GAP = { ms: 40000, messages: 2 };
export function pickCue(text, ctx = {}) {
  const t = String(text || "");
  const { decision = null, request = "none", crisis = false, care = false, sulking = false, owned = [], lastFired = {}, now = Date.now(), lastAny = 0, since = 99, holding = null } = ctx;
  if (!t.trim() || crisis || care || sulking) return null;
  const quiet = (lastAny && now - lastAny < CUE_GAP.ms) || since < CUE_GAP.messages;
  if (request === "craft" || /\b(make|build|craft|create) (me |you |us )?(a|an|some|your)\b/i.test(t)) return null;   // asking for one: the workbench
  for (const c of CUES) {
    if (c.tease ? !(decision === "pout" || (decision === null && c.re.test(t))) : !c.re.test(t)) continue;
    if (c.not && c.not.test(t)) continue;
    if (c.decisions ? !(c.decisions.includes(decision ?? "neutral") || (c.tease && decision === null)) : ["hurt", "comfort", "concern", "gentle", "pout", "sheepish"].includes(decision)) continue;
    if (c.rest && lastFired[c.id] && now - lastFired[c.id] < c.rest) continue;
    if (quiet && !c.tease && !c.always) continue;
    const friends = (c.friends || []).map(([who, role]) => ({ who, role }));
    if (!c.prop) return { id: c.id, how: c.how, note: c.note, prop: null, friends };
    const mine = owned.find((p) => c.kinds.some((k) => String(p.name).toLowerCase().includes(k)) && (c.how !== "squirt" && c.how !== "cheer" || p.archetype === "launcher"));
    const pat = pattern(c.prop);
    const prop = mine ? { id: mine.id, name: mine.name, archetype: mine.archetype, recipe: mine.recipe } : pat && { name: pat.name, archetype: pat.archetype, recipe: pat, pocket: true };
    if (!prop) continue;
    if (holding && holding.name === prop.name) return null;   // it's already out
    return { id: c.id, how: c.how, note: c.note, prop, friends };
  }
  return null;
}
