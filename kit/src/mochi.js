/* Mochi: the assistant's chibi sheep.
 *
 * A small three.js scene drawn on the chat page. Everything is built from code (no model files), so it works
 * offline and stays small. Mochi listens for these events on `document`:
 *   mochi:said    {text, photo}        you sent a message: Mochi reads it, then reacts
 *   mochi:busy    {busy}               the assistant is working: Mochi types on a little phone, or, for a food
 *                                      task (logging, recipes, goals, a photo), puts on glasses and writes on a notepad
 *   mochi:replied {error, proposals, text}
 *   mochi:logged                       you confirmed a card
 *   mochi:reset                        new chat
 *   mochi:sulk    {on, animate}        (v1.34) the user kept being mean or said "I hate you": arms crossed, cheeks puffed,
 *                                      turned away, until they apologise (the app answers "....." meanwhile)
 *   mochi:forgive                      they apologised: Mochi turns back, pouts a moment, then softens
 * Asked whether it has a friend or a girlfriend, Mochi proudly shows off Mimi, who hops in beside it (v1.34).
 * Touch: a tap is a cuddle, rubbing the tummy tickles, stroking the head is a pat; press and hold to pick Mochi up and
 * carry it anywhere on the screen (sometimes it gets yanked along by surprise). The spot is remembered on this device. After a couple of quiet minutes
 * (or a "good night") Mochi yawns and tucks itself into a tiny bed.
 * Build: npm install && npm run build  (writes dist/mochi.min.js)
 */
import { MIMI_SCALE, COCOA_SCALE } from "./sizes.js";
import { Smoother, poseChannels } from "./smoother.js";
import { Piggyback } from "./piggyback.js";
import { PropAct } from "./propact.js";
import { stepCarry, carryShape } from "./carry.js";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Stagecraft, HEAVY } from "./stagecraft.js";
import { ZeroDay } from "./zeroday.js";
import { Scuffle } from "./scuffle.js";
import { Handshake } from "./handshake.js";
import { Shelf, shelfStory } from "./shelf.js";
import { Floor } from "./floor.js";
import { Scenery } from "./scenery.js";
import { shown } from "./props.js";
import { FriendMoves } from "./friendmoves.js";
import { Boom } from "./boom.js";
import { Party } from "./party.js";
import { Cold } from "./cold.js";
import { eatStyle } from "../../shared/craft.js";

/* ------------------------------------------------------------------ how Mochi reads your message */
const NEGATED = /\b(don'?t|do\s+not|never|not|no|didn'?t|won'?t|wouldn'?t|doesn'?t)\s+(\w+\s+)?$/;
const RULES = [
  // alarming news about the user: a real shock (then a worried lean), before anything else
  ["shocked", /\b((got|get|getting|been|was|were)\s+(shot|stabbed|mugged|robbed|attacked|assaulted|run\s+over|hit\s+by\s+(a|an|the)\s+\w+|bitten\s+by|fired(?!\s+up)|laid\s+off|arrested|hospitali[sz]ed|electrocuted)|(car|bike|motorcycle|scooter|bus|bad|serious|terrible)\s+(accident|crash)|(was|were|been|got)\s+(in|into)\s+(an?\s+)?(accident|crash|car\s+crash)|crashed\s+my\s+(car|bike|motorcycle|scooter)|in\s+(the\s+)?(hospital|icu|emergency\s+room)|in\s+the\s+er|(went|go|going|rushed|taken|ended\s+up)\s+(to|in)\s+(the\s+)?(hospital|er|emergency|icu)|ambulance|heart\s+attack|had\s+a\s+stroke|seizure|concussion|overdos(e|ed)|broke\s+my\s+(arm|leg|wrist|ankle|nose|back|neck|foot|hand|ribs?|finger|toe|collarbone|hip|jaw|tooth)|fainted|collapsed|caught\s+(on\s+)?fire|(house|kitchen|grease)\s+fire|fire\s+in\s+my|broke\s+into\s+my|food\s+poisoning|allergic\s+reaction|anaphyla\w*|(almost|nearly)\s+(died|choked|drowned|crashed|fainted)|(choked|choking)\s+on|(cut|burned|burnt|sliced)\s+my(self|\s+(finger|hand|thumb|arm))|earthquake|tornado|hurricane)\b/],
  // v1.32: someone did it to you ("someone shot me", "a guy beat me up", "my neighbour's dog bit me") and more ways of saying it
  ["shocked", /\b((someone|somebody|some\s+(guy|man|woman|dude|kids?|people|lady)|a\s+(guy|man|woman|stranger|dude|kid|dog|car|truck|bus|driver|robber|thief|mugger)|the\s+(guy|man|woman|dog|car|robber|driver)|he|she|they|people|my\s+(\w+\s+)?(dad|father|mom|mother|husband|wife|boyfriend|girlfriend|partner|brother|sister|boss|neighbou?r|ex|son|daughter|uncle|aunt|friend|roommate|dog))\s+(just\s+|literally\s+|actually\s+)?(shot|stabbed|mugged|robbed|attacked|assaulted|punched|kicked|slapped|choked|strangled|kidnapped|threatened|bit|hit|ran\s+over|jumped|beat(\s+up)?|raped|molested|abused|pushed|shoved|tried\s+to\s+(kill|rob|hurt|attack|stab|shoot))\s+(me|us)\b(?!\s+(at|in|on|to|by|with|again|a|an|some|up\s+on)\b)|(got|get|getting|been|was|were|being)\s+(beaten|beat\s+up|punched|kicked|slapped|jumped|kidnapped|threatened|raped|molested|abused|choked|strangled|hurt\s+(badly|bad|really\s+bad)|badly\s+hurt|injured|shot\s+at|struck\s+by|followed|chased|hit(?!\s+(or|and)\s))|i('?m|\s+am)\s+(bleeding|badly\s+hurt|injured|being\s+(followed|chased|attacked|stalked)|in\s+(an\s+)?ambulance|in\s+danger|not\s+safe)|(gun|knife)\s+(to|at|on)\s+(me|my)|pulled\s+a\s+(gun|knife)|(lost|lose)\s+my\s+job|(car|truck|bus)\s+hit\s+me|hit\s+and\s+run|break-in|at\s+gunpoint|shooting\s+(at|near)\s+(my|our|the))/],
  // v1.34: "do you have a girlfriend?", "do you have friends?", "are you single?": Mochi shows off Mimi
  ["showoff", /\b((do|have|got)\s+(you|u)\s+(got\s+|have\s+)?(a\s+|any\s+)?(girl\s*friends?|gf|friends?|best\s*friend|bestie|crush|partner|wife|sweetheart|significant\s+other|someone\s+special|special\s+someone|valentine|lover)\b|are\s+(you|u)\s+(single|dating|taken|seeing\s+(someone|anyone)|in\s+a\s+relationship|married|in\s+love|lonely)\b|who('?s|\s+is)\s+(your|ur)\s+(girl\s*friend|gf|friend|best\s*friend|bestie|crush|partner|wife|sweetheart|valentine)\b|(your|ur)\s+(girl\s*friend|gf)\b|show\s+(me\s+)?(your|ur)\s+(girl\s*friend|gf|friend|partner)\b|(who|where)('?s|\s+is)\s+mimi\b|\b(hi|hello|hey)\s+mimi\b|show\s+(me\s+)?mimi\b)/],
  // v1.36: really good news: Mochi bounces all around the screen
  ["superexcited", /\b((i'?m|i\s+am|we'?re|we\s+are)\s+(getting\s+married|engaged|pregnant|having\s+a\s+baby|expecting(\s+a\s+baby)?|going\s+to\s+be\s+(a\s+)?(mom|mum|dad|parents?|mother|father))|(i|we)\s+(just\s+)?got\s+(engaged|married|the\s+job|hired|promoted|a\s+promotion|my\s+(dream|first)\s+job|into\s+\w+|accepted|the\s+house|our\s+(first\s+)?(house|home|flat))|(she|he)\s+said\s+yes|(he|she)\s+proposed|(my|our)\s+wedding|(i|we)\s+(passed|graduated|won)\b|(hit|reached|made)\s+my\s+goal\s+weight|it'?s\s+a\s+(boy|girl)\b|(i|we)\s+bought\s+(a|our|my)\s+(first\s+)?(house|home|flat|apartment))/],
  ["sad", /\b(i\s+hate\s+(you|u|mochi)|hate\s+(you|u)|you\s+suck|you('?re|\s+are|r)\s+(so\s+|really\s+|very\s+)?(stupid|dumb|useless|annoying|the\s+worst|terrible|awful|ugly|bad|boring|lame)|(stupid|dumb|useless|ugly)\s+(sheep|bot|app|mochi)|shut\s+up|go\s+away|i\s+don'?t\s+like\s+you|nobody\s+likes\s+you|i\s+hate\s+this\s+app|i'?m\s+(so\s+)?done\s+with\s+(you|u)|you\s+never\s+(understand|listen|help|get\s+it)|nobody\s+asked\s+(you|u)|(this|the)\s+app\s+(is\s+)?(garbage|trash|useless|terrible))\b/],
  ["shy", /\b(you('?re|\s+are|r)\s+(so\s+|really\s+|very\s+|just\s+|such\s+a\s+|the\s+)?(cute|adorable|sweet|cutest|precious|fluffy|pretty|beautiful|lovely|cutie|handsome|gorgeous)|cute\s+(sheep|mochi)|(so|how|too)\s+(cute|adorable|fluffy)|cutie(\s+pie)?|i\s+missed\s+you|you('?re|\s+are|r)\s+my\s+(favou?rite|best\s+friend|bestie))\b/],
  ["love", /\b(love\s+(you|u|mochi|this\s+app|it)|ily|thank(s|\s+you|\s+u)?|thx|ty|good\s+(boy|girl|sheep|mochi)|i\s+like\s+you|best\s+sheep)\b/],
  ["excited", /\b(i\s+(did\s+it|made\s+it|hit\s+my|reached\s+my|crushed|smashed|nailed|finished\s+my|lost\s+\d)|new\s+(pr|record|personal\s+best)|(goal|target)\s+(reached|hit|met|done)|down\s+\d+(\.\d+)?\s*(lb|lbs|kg|kgs|pounds?|kilos?)|((came|went|got|is)\s+down|dropped|fell|lowered)\b[^?]*!|i\s+(deadlifted|benched|squatted|lifted|ran|walked|hiked|swam|cycled|biked)\b[^?]*!)/],
  ["proud", /\b(good\s+job|great\s+job|nice\s+(job|work|one)|well\s+done|good\s+work|great\s+work|way\s+to\s+go|you\s+(did\s+(it|great|well|good)|got\s+it(\s+right)?|nailed\s+it|figured\s+it\s+out)|you('?re|\s+are|r)\s+(so\s+|really\s+|very\s+)?(smart|clever|brilliant|helpful|a\s+genius|good\s+at\s+this|the\s+best)|smart\s+(sheep|mochi)|that'?s\s+(exactly\s+)?(right|correct)|exactly\s+right|proud\s+of\s+you)\b/],
  ["happy", /\b(you('?re|\s+are|r)\s+(so\s+|really\s+)?(great|amazing|awesome|funny|hilarious)|awesome|perfect|yay+|amazing|haha+|lol|great|woo+|yes+!)\b/],
  ["concerned", /\b(i('?m|\s+am)\s+(so\s+|really\s+|very\s+|feeling\s+|kinda\s+)?(sad|tired|exhausted|stressed|down|depressed|lonely|sick|upset|anxious|overwhelmed|hurt|in\s+pain|not\s+ok(ay)?|unwell)|i\s+feel\s+(so\s+|really\s+|very\s+)?(bad|awful|terrible|guilty|sick|down|sad|horrible|fat|gross|lonely)|(bad|rough|hard|awful|terrible)\s+day|i\s+binged|overate|ate\s+too\s+much|cheated\s+on\s+my\s+diet|i\s+failed|passed\s+away|funeral|(mom|mother|dad|father|grand\w+|husband|wife|son|daughter|brother|sister|friend|dog|cat|pet)\s+(died|is\s+dying)|lost\s+my\s+(mom|mother|dad|father|grand\w+|husband|wife|son|daughter|brother|sister|friend|dog|cat|pet|baby))\b/],
  ["sleepy", /\b(good\s*night|nighty?[\s-]*night|gn|sweet\s+dreams|sleep\s+(well|tight)|(going|off|heading)\s+to\s+(bed|sleep)|time\s+(for|to)\s+(bed|sleep)|bed\s*time|night\s+mochi|nap\s+time)\b/],
  ["surprised", /\b(wow+|whoa+|woah+|omg|oh\s+my\s+god|no\s+way|seriously\?|for\s+real\?)|\?!|!\?|^\s*(wait\s+what|really\?)/],
  ["hello", /^\s*(hi+|hello+|hey+|hiya|yo|howdy|good\s+(morning|afternoon|evening)|morning|hi\s+mochi)\b/],
  ["thinking", /\?\s*$|^\s*(how|what|why|when|which|where|who|should|can|could|is|are|do|does|did|will|would)\b/],
];
// v1.34: being mean ("I hate you", "you're useless") several times in a row makes Mochi sulk (the chat page counts; 1.35: the
// third in a row). Only an apology ends it; asking why he went quiet gets a peek back and a pouty explanation.
const HATE = /\b(i\s+(really\s+|just\s+|truly\s+|so\s+)?(hate|despise|can'?t\s+stand|loathe)\s+(you|u|mochi)\b|(hate|despise)\s+(you|u)\b|i\s+wish\s+you\s+(were\s+dead|didn'?t\s+exist|were\s+gone))/;
const APOLOGY = /\b(sorry|i\s+apologi[sz]e|apologies|my\s+bad|forgive\s+me|please\s+forgive|i\s+didn'?t\s+mean\s+(it|that)|i\s+take\s+(it|that)\s+back|i\s+was\s+(wrong|mean|rude|out\s+of\s+line)|i\s+regret\s+(it|that|saying))\b/;
const norm = (raw) => String(raw || "").toLowerCase().replace(/[’‘]/g, "'").trim();
export function insultKind(raw) {   // "hate", "insult" or null
  const t = norm(raw);
  if (!t) return null;
  const m = HATE.exec(t);
  if (m && !NEGATED.test(t.slice(0, m.index))) return "hate";
  return classify(t) === "sad" ? "insult" : null;
}
const WHY_QUIET = /\b(why\s+(are|r)\s+(you|u)\s+(so\s+|being\s+)?(quiet|silent|not\s+(talking|answering|replying|responding|speaking)|ignoring\s+me|mad|angry|upset|cross|sulking|grumpy|huffy|pouting|giving\s+me\s+(the\s+)?silent\s+treatment)|why\s+(so\s+quiet|the\s+(silence|silent\s+treatment|dots|attitude)|(only\s+|just\s+)?(dots|\.{3,}))|why\s+(won'?t|wont|don'?t|dont|aren'?t|arent)\s+(you|u)\s+(talk|answer|reply|respond|speak|say)|why\s+(did|have)\s+(you|u)\s+(go(ne)?|went|stop(ped)?)\s+(quiet|silent|talking)|what'?s\s+(wrong|up\s+with\s+you|with\s+the\s+(dots|silence))|are\s+(you|u)\s+(mad|angry|upset|cross|sulking|ignoring\s+me)|is\s+something\s+wrong|talk\s+to\s+me|say\s+something)\b/;
const WHY_SHORT = /^(what\s+(happened|did\s+i\s+do(\s+wrong)?)(\s+(mochi|to\s+you))?|hello+\s*\?|mochi+\s*\?|hey+\s*\?)[\s?!.]*$/;   // "what did I do?", "hello??"
export function asksWhy(raw) {   // "why are you quiet?" while sulking: Mochi peeks back and says why
  const t = norm(raw);
  return !!t && (WHY_QUIET.test(t) || WHY_SHORT.test(t));
}
export function isApology(raw) {
  const t = norm(raw), m = APOLOGY.exec(t);
  return !!m && !NEGATED.test(t.slice(0, m.index)) && !/\bsorry\s+(to\s+hear|for\s+your|about\s+your)\b/.test(t);
}
// "did I hit my protein goal?" is a question, not news to celebrate
const QUESTION = /^\s*(did|do|does|have|has|had|can|could|will|would|am|is|are|should|was|were)\b|[^!?]\?\s*$/;

export { CONCERN_REPLY };
export function classify(raw) {
  const text = String(raw || "").toLowerCase().replace(/[’‘]/g, "'").trim();
  if (!text) return "nod";
  for (const [mood, re] of RULES) {
    const g = new RegExp(re.source, "g");
    let m;
    while ((m = g.exec(text))) {
      if (!NEGATED.test(text.slice(0, m.index)) && !(mood === "excited" && QUESTION.test(text))) return mood;
      if (m[0].length === 0) g.lastIndex++;
    }
  }
  return "nod";
}

/* a job on your food (log, recipe, goal, numbers, a photo): Mochi puts on glasses and works on a notepad */
const TASK = /\b(log(ged|ging|s)?|ate|eaten|drank|breakfast|lunch|dinner|snacks?|meals?|recipes?|ingredients?|calories?|cals?|kcal|protein|carbs?|fibe?re?|sugars?|sodium|cholesterol|macros?|nutrition(al)?|nutrition\s+label|goals?|targets?|remaining|track(ing)?|diary|meal\s+plan|grocer(y|ies)|pantry|fridge|batch(es)?|servings?|portions?|grams?|weigh(t|ed|ing)?|water|exercise|workout|\d+\s*k?\s+steps|\d+\s*(reps?|sets?)\b|bench\s+press|deadlifts?|\d+(\.\d+)?\s*(km|mi|miles?)\b|supplements?|vitamins?|\d+\s*(g|ml|kg|oz|lbs?|cups?|tbsp|tsp|slices?|pieces?)\b)/;
// everyday words that are food jobs in a plain request ("I had pizza", "add that", "what did I eat yesterday?"),
// but not in news or feelings ("I got shot today", "I had a bad day")
const TASK_MAYBE = /\b(had|have|eat|eating|drink|drinking|fat|salt|plan|this\s+week|last\s+week|save|store|add|change|update|swap|remove|delete|cook(ed|ing)?|made|make)\b/;
const PLAIN = new Set(["nod", "thinking", "happy", "excited", "surprised"]);
/* costumes (v1.29): "Mochi, get a Christmas theme", "bunny ears for Easter", "take it off" (1.36: no Halloween costume any more;
   Christmas comes on by itself all through December) */
const COSTUME_NOUN = /\b(theme[ds]?|costumes?|outfits?|hats?|ears|look|mode|dress(ed)?\s+up|dress(ing)?\s+up|gloves|claws)\b/;
const COSTUME_VERB = /\b(get|put\s+on|wear|dress|change\s+(in)?to|switch\s+to|go|turn\s+into|be\s+an?|become)\b/;
const AT_YOU = /\b(you|yourself|mochi|ur|u)\b/;
const COSTUME_OFF = /\b(take\s+(it|that|them|those|(the|your|that)\s+\w+(\s+\w+)?)\s+off|take\s+off\s+(the|your|that)\s+\w+|remove\s+(the|your|that)\s+(\w+\s+)?(costume|outfit|hat|ears|theme|gloves|claws)|(no|without)\s+(more\s+)?(costume|outfit|hat|theme)|back\s+to\s+(normal|regular|yourself|your\s+usual(\s+self)?)|change\s+back|normal\s+mochi|regular\s+mochi|undress|(costume|hat|ears|outfit)\s+off)\b/;
const COSTUMES = [["christmas", /\b(x-?mas|christmas|santa|festive|holiday)/], ["easter", /\b(easter|bunny|rabbit\s+ears)/]];
export function costumeFor(raw) {
  const t = String(raw || "").toLowerCase().replace(/[’‘]/g, "'");
  if (COSTUME_OFF.test(t)) return "none";
  const asks = COSTUME_NOUN.test(t) || (COSTUME_VERB.test(t) && AT_YOU.test(t));
  if (!asks) return null;
  for (const [c, re] of COSTUMES) if (re.test(t)) return c;
  return null;
}

export function isTask(raw, photo) {
  if (photo) return true;
  const text = String(raw || "").toLowerCase().replace(/[’‘]/g, "'");
  if (costumeFor(text) !== null && !TASK.test(text)) return false;   // "take it off", "change back": dressing up, not a food job
  if (TASK.test(text)) return classify(text) !== "shocked" || /\b(log|recipe|calories?|kcal|protein)\b/.test(text);
  return TASK_MAYBE.test(text) && PLAIN.has(classify(text));
}

// v1.32: a reply that's worried about you ("Oh no! Are you okay?") gets a worried face, costume or not
const CONCERN_REPLY = /\b(are\s+you\s+(okay|ok|alright|all\s+right|safe|hurt)|oh\s+no|oh\s+my\s+(goodness|gosh)|(so\s+)?sorry\s+to\s+hear|sorry\s+(that\s+happened|you'?re\s+going\s+through)|that\s+sounds\s+(so\s+)?(scary|awful|terrible|hard|rough|painful|frightening)|call\s+(emergency|911|999|112|an\s+ambulance)|emergency\s+services|get\s+(medical\s+)?help|seek\s+(medical\s+)?(help|care|attention)|go\s+to\s+(a|the)\s+(hospital|doctor|er)|please\s+(stay\s+safe|be\s+careful|take\s+care))\b/i;
const POSITIVE_REPLY = /\b(great|nice|well done|congrat\w*|awesome|good job|fantastic|excellent|amazing|on track|hit your|reached your)\b/i;
// good news in his answer, not "that's not very nice" or "no great loss"
const positiveReply = (t) => { const re = new RegExp(POSITIVE_REPLY.source, "gi"); let m; while ((m = re.exec(t))) { if (!/(\bnot|n't|\bno|\bnever|\bhardly)\s+(very\s+|so\s+|that\s+|really\s+|a\s+)?$/i.test(t.slice(Math.max(0, m.index - 20), m.index))) return true; } return false; };

/* ------------------------------------------------------------------ faces */
const BASE = {
  eyeOpen: 1, eyeScale: 1, eyeHappy: 0, eyeClosed: 0, lookX: 0, lookY: 0, brow: 0, browSad: 0, browY: 0,
  smile: 0.38, mouthOpen: 0, mouthW: 1, blush: 0.45, ear: 0, tilt: 0, pitch: 0, yaw: 0, lean: 0, slump: 0,
  phone: 0, sweat: 0, glasses: 0, pad: 0, bed: 0, lines: 0, shock: 0, held: 0, puff: 0, turn: 0,
};
// his face while he's saying something sad, sorry, worried, scared or cross (the page picks; speakingTone): only the
// parts that carry it (a happy squint, a big smile and perky ears all say "happy", whatever the words)
const TALK_TONES = {
  sad: { smile: -0.6, eyeHappy: 0, browSad: 0.9, brow: 0.8, mouthW: 0.85, ear: -0.6, blush: 0.25, lookY: -0.2 },
  sorry: { smile: -0.25, eyeHappy: 0, browSad: 0.7, brow: 0.65, mouthW: 0.85, ear: -0.4, blush: 0.6 },
  worried: { smile: -0.15, eyeHappy: 0, browSad: 0.6, brow: 0.6, ear: -0.2 },
  scared: { smile: -0.35, eyeHappy: 0, eyeOpen: 1.06, brow: 0.9, browY: 0.7, browSad: 0.4, mouthW: 0.65, ear: -0.5 },
  cross: { smile: -0.4, eyeHappy: 0, browSad: -0.7, brow: 0.85, mouthW: 0.8, puff: 0.35, ear: -0.2 },
};
// how long the feeling stays on his face after he's said it (fading over the last third), and what ends it early
const TONE_LINGER = { sad: 30000, worried: 20000, sorry: 9000, cross: 9000, scared: 5000 };
const LINGER_MOODS = new Set(["idle", "typing", "working", "thinking", "nod", "concerned", "sad", "oops", "shy"]);
const CHEERS = new Set(["patted", "love", "happy", "hello", "excited", "superexcited", "laugh", "tickled", "proud", "showoff"]);
const FACES = {
  idle: {},
  nod: { smile: 0.55, blush: 0.55 },
  present: { smile: 0.6, blush: 0.6, mouthOpen: 0.12 },
  hello: { eyeHappy: 0.85, smile: 0.9, mouthOpen: 0.45, blush: 0.85, ear: 0.55 },
  happy: { eyeHappy: 1, smile: 1, mouthOpen: 0.6, blush: 1, ear: 0.6 },
  love: { eyeHappy: 1, smile: 0.9, mouthOpen: 0.25, blush: 1.15, ear: 0.35, tilt: 0.16 },
  excited: { eyeScale: 1.2, smile: 1, mouthOpen: 0.8, blush: 1, ear: 0.95 },
  superexcited: { eyeScale: 1.3, eyeHappy: 0.35, smile: 1, mouthOpen: 1, blush: 1.2, ear: 1.2, lines: 1 },   // 1.36: over the moon
  sad: { eyeOpen: 0.7, lookY: -0.45, brow: 1, browSad: 1, smile: -0.8, mouthOpen: 0.1, mouthW: 0.8, blush: 0.15, ear: -1, pitch: 0.22, slump: 1 },
  concerned: { eyeOpen: 0.96, brow: 1, browSad: 0.6, smile: 0.1, mouthW: 0.8, blush: 0.55, ear: -0.5, tilt: 0.15, lean: 1 },
  surprised: { eyeScale: 1.28, eyeOpen: 1.08, brow: 1, browY: 1, smile: 0.05, mouthOpen: 0.9, mouthW: 0.5, ear: 1, pitch: -0.1 },
  thinking: { lookX: 0.55, lookY: 0.55, tilt: -0.17, smile: 0.08, mouthW: 0.65, brow: 0.8, browY: 0.5, ear: 0.15 },
  reading: { lookY: -0.3, pitch: 0.1, lean: 0.6, smile: 0.25 },
  typing: { phone: 1, eyeOpen: 0.86, lookY: -1, pitch: 0.24, smile: 0.32, blush: 0.55 },
  working: { glasses: 1, pad: 1, eyeOpen: 0.9, lookY: -0.95, pitch: 0.3, smile: 0.3, brow: 0.35, browY: -0.2, blush: 0.55, ear: 0.1 },
  oops: { eyeOpen: 0.78, smile: -0.2, mouthW: 0.7, brow: 0.9, browSad: 0.45, ear: -0.45, tilt: 0.13, sweat: 1 },
  sleep: { eyeClosed: 1, smile: 0.2, pitch: 0.24, ear: -0.6, blush: 0.6 },
  tickled: { eyeHappy: 1, smile: 1, mouthOpen: 0.75, blush: 1.25, ear: 0.85, tilt: 0.1, pitch: -0.06 },
  laugh: { eyeHappy: 1, smile: 1, mouthOpen: 0.7, blush: 1, ear: 0.75, tilt: -0.08, pitch: -0.1 },   // a giggle in a reply, no tickling
  // v1.25
  shy: { eyeOpen: 0.92, lookX: -0.55, lookY: -0.4, smile: 0.5, mouthW: 0.62, blush: 1.45, lines: 1, ear: -0.35, tilt: 0.16, pitch: 0.14, yaw: 0.28, brow: 0.45, browSad: 0.35 },
  proud: { eyeHappy: 1, smile: 0.9, mouthOpen: 0.12, blush: 0.75, ear: 0.65, pitch: -0.2, tilt: -0.06, brow: 0.6, browY: 0.75, lean: -0.9 },
  sleepy: { eyeClosed: 0.9, mouthOpen: 1.05, mouthW: 0.55, smile: -0.05, brow: 0.35, browSad: 0.4, ear: -0.45, pitch: -0.16, blush: 0.5 },   // a big yawn
  patted: { eyeHappy: 1, smile: 0.9, mouthOpen: 0.12, blush: 1.2, ear: -0.8, tilt: 0.1, pitch: 0.08, lean: 0.25 },
  bed: { bed: 1, eyeClosed: 1, smile: 0.3, blush: 0.7, ear: -0.75, pitch: 0.05, tilt: -0.25 },   // lying on its side, head on the pillow
  // v1.27: alarming news. Eyes huge, brows shot up, jaw dropped, ears straight up, a jump and a tremble; then a worried lean
  // v1.28: picked up and carried; yanked along by surprise; a bit dizzy after a wild ride
  held: { held: 1, eyeScale: 1.15, eyeOpen: 1.05, brow: 0.7, browY: 0.7, smile: 0.3, mouthOpen: 0.3, mouthW: 0.6, ear: 0.75, blush: 0.95, pitch: 0.08 },
  yanked: { held: 1, shock: 1, eyeScale: 1.45, eyeOpen: 1.18, brow: 1, browY: 1.4, browSad: 0.2, smile: -0.4, mouthOpen: 1.2, mouthW: 0.45, ear: 1.4, blush: 0.25, sweat: 1 },
  dizzy: { eyeClosed: 0.75, smile: 0.08, mouthOpen: 0.28, mouthW: 0.62, brow: 0.6, browSad: 0.5, blush: 0.7, ear: -0.35, tilt: 0.1 },
  // v1.34: sulking: cheeks puffed up, brows down, a pout, arms crossed, turned away from you; then forgiving you after an apology
  angry: { eyeOpen: 0.74, lookX: 0.95, lookY: -0.12, brow: 1, browSad: -1.15, browY: -0.4, smile: -0.5, mouthW: 0.42, blush: 1.15, ear: -0.6, yaw: 0.62, pitch: -0.12, tilt: -0.08, puff: 1, turn: 1 },
  peek: { eyeOpen: 0.8, lookX: 0.15, lookY: -0.05, brow: 1, browSad: -0.85, browY: -0.25, smile: -0.4, mouthW: 0.4, mouthOpen: 0.12, blush: 1.25, ear: -0.45, yaw: 0.22, pitch: -0.06, tilt: -0.1, puff: 0.85, turn: 0.45 },   // 1.35: still cross, glancing back to tell you why
  forgive: { eyeOpen: 0.95, lookX: 0.35, lookY: -0.3, brow: 0.6, browSad: 0.25, smile: 0.25, mouthW: 0.6, blush: 1.3, ear: -0.2, yaw: 0.22, tilt: 0.12, pitch: 0.08, puff: 0.35, lines: 0.6 },
  // v1.34: showing off Mimi: proud and a little bashful
  showoff: { eyeHappy: 1, smile: 0.95, mouthOpen: 0.2, blush: 1.25, ear: 0.55, pitch: -0.14, tilt: -0.1, lean: -0.5, lines: 0.5 },
  shocked: { shock: 1, eyeScale: 1.45, eyeOpen: 1.18, brow: 1, browY: 1.4, browSad: 0.3, smile: -0.5, mouthOpen: 1.25, mouthW: 0.42, blush: 0.05, ear: 1.4, pitch: -0.18, lean: -0.7, sweat: 1 },
  // day 2: doing a move (the move's own face channels ride on top), and holding still while you pose him
  performing: { smile: 0.62, blush: 0.7, ear: 0.3, eyeOpen: 1.02 },
  posing: { smile: 0.5, blush: 0.8, eyeOpen: 1.06, ear: 0.3, brow: 0.45, browY: 0.55, lookY: 0.05 },
  // Nov 3: a sneeze: breathing in (eyes half shut, brows up, mouth open, head back), then the ACHOO (screwed up tight)
  achooIn: { eyeClosed: 0.55, brow: 1, browY: 0.9, browSad: 0.45, mouthOpen: 0.55, mouthW: 0.55, smile: -0.15, ear: 0.6, blush: 0.9, lean: -0.4 },
  achoo: { eyeClosed: 1, brow: 1, browSad: 0.3, browY: -0.3, mouthOpen: 1.1, mouthW: 0.7, smile: -0.2, ear: 1.35, blush: 1.15, lean: 0.7 },
};
const MOOD_NAMES = new Set(["superexcited", "showoff", "shocked", "sad", "love", "excited", "happy", "concerned", "surprised", "hello", "thinking", "nod", "oops", "shy", "proud", "sleepy", "laugh"]);
const HOLD = { tickled: 1600, laugh: 1500, nod: 900, present: 1600, hello: 2000, happy: 2300, love: 2400, excited: 2600, sad: 3200,
  concerned: 2800, surprised: 1500, shocked: 1800, yanked: 1300, dizzy: 1700, thinking: 1400, oops: 2800, shy: 2600, proud: 2400, sleepy: 1900, patted: 1400, angry: 1600, superexcited: 3600, peek: 3200, forgive: 1500, showoff: 2600, achooIn: 950, achoo: 650 };
const DOZE_MS = 60000, BED_MS = 150000;
const PAD = { x: 0.22, top: 0.18, bottom: 0.06 };   // how far the canvas reaches past Mochi's box (matches app.css)
const SPOT_KEY = "thali.mochi.spot.v1";   // where you carried Mochi, this device only: {x: px from its corner, top: px from the top of the screen}
const FRIEND_STAY = 40000;                   // Mimi and Cocoa stay at least this long when they come (then say goodbye)
const HOLD_MS = 380;                       // press this long without moving to pick Mochi up   // a quiet minute: Mochi dozes off; two and a half: off to its little bed

/* ------------------------------------------------------------------ helpers */
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
class Spring {   // a value that moves toward its target with a little follow-through
  constructor(v, k = 150, zeta = 0.78) { this.x = v; this.t = v; this.v = 0; this.k = k; this.c = 2 * Math.sqrt(k) * zeta; }
  step(dt) { const a = this.k * (this.t - this.x) - this.c * this.v; this.v += a * dt; this.x += this.v * dt; }
}
function fib(n) {   // evenly spread directions on a sphere
  const out = [], g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), th = g * i;
    out.push(new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r));
  }
  return out;
}
function canvasTex(size, draw, srgb = true) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  draw(c.getContext("2d"), size);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function woolBump() {   // soft lumpy noise for the fleece
  const t = canvasTex(256, (g, s) => {
    g.fillStyle = "#808080"; g.fillRect(0, 0, s, s);
    const r = rng(7);
    for (let i = 0; i < 900; i++) {
      const x = r() * s, y = r() * s, rad = 3 + r() * 11, v = 90 + r() * 120;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(${v},${v},${v},0.55)`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
      g.fillStyle = gr;
      for (const dx of [-s, 0, s]) for (const dy of [-s, 0, s]) { g.save(); g.translate(dx, dy); g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); g.restore(); }
    }
  }, false);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2);
  return t;
}
function radial(inner, outer) {
  return canvasTex(128, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, inner); gr.addColorStop(1, outer);
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  });
}

function quiltTex() {   // a soft pink quilt with little hearts
  const t = canvasTex(256, (g, s) => {
    g.fillStyle = "#ffd6e3"; g.fillRect(0, 0, s, s);
    g.strokeStyle = "rgba(255,255,255,0.55)"; g.lineWidth = 3;
    for (let i = 0; i <= s; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(s, i); g.stroke(); }
    g.fillStyle = "#ffffff";
    for (let y = 32; y < s; y += 64) for (let x = 32; x < s; x += 64) {
      g.beginPath(); g.moveTo(x, y + 9); g.bezierCurveTo(x - 14, y - 2, x - 6, y - 12, x, y - 4); g.bezierCurveTo(x + 6, y - 12, x + 14, y - 2, x, y + 9); g.fill();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1.4);
  return t;
}
function stripeTex() {   // the nightcap's stripes
  const t = canvasTex(64, (g, s) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#ffffff" : "#b9a6ee"; g.fillRect(0, (i * s) / 8, s, s / 8); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 1.2);
  return t;
}

/* a soft tube along a spine that bends in the xy plane (v1.30): the Santa hat and the bunny ears are one smooth,
   floppy piece each, re-bent every frame so they sway and droop like fabric */
class Sweep {
  constructor(rings, seg, length, radius, zr) {
    Object.assign(this, { R: rings, S: seg, L: length, radius, zr, tip: new THREE.Vector3(), dir: new THREE.Vector3(0, 1, 0) });
    const n = (rings + 1) * (seg + 1), g = this.geo = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array((n + 1) * 3), 3));
    const uv = new Float32Array((n + 1) * 2);
    for (let i = 0; i <= rings; i++) for (let j = 0; j <= seg; j++) { const k = i * (seg + 1) + j; uv[k * 2] = j / seg; uv[k * 2 + 1] = i / rings; }
    uv[n * 2] = 0.5; uv[n * 2 + 1] = 1;
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    const idx = [];
    for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) { const a = i * (seg + 1) + j, b = a + seg + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    for (let j = 0; j < seg; j++) { const a = rings * (seg + 1) + j; idx.push(a, n, a + 1); }   // the closed tip
    g.setIndex(idx);
    this.bend(() => 0);
  }
  bend(angle) {   // angle(s): how far the spine leans from straight up at s (0 = base, 1 = tip; + leans toward +x)
    const pos = this.geo.attributes.position, { R, S, L, zr } = this, step = L / R;
    let x = 0, y = 0;
    for (let i = 0; i <= R; i++) {
      const s = i / R, th = angle(s), r = this.radius(s), nx = Math.cos(th), ny = -Math.sin(th);
      for (let j = 0; j <= S; j++) {
        const a = (j / S) * Math.PI * 2, c = Math.cos(a) * r, k = i * (S + 1) + j;
        pos.setXYZ(k, x + nx * c, y + ny * c, Math.sin(a) * r * zr);
      }
      if (i === R) { this.tip.set(x, y, 0); this.dir.set(Math.sin(th), Math.cos(th), 0); break; }
      const mid = angle(s + 0.5 / R);
      x += Math.sin(mid) * step; y += Math.cos(mid) * step;
    }
    pos.setXYZ((R + 1) * (S + 1), this.tip.x + this.dir.x * 0.004, this.tip.y + this.dir.y * 0.004, 0);
    pos.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
  }
}
const smooth = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
const lerp = (a, b, u) => a + (b - a) * u;
const ease01 = (u) => { const x = Math.max(0, Math.min(1, u)); return x * x * (3 - 2 * x); };   // smoothstep

/* ------------------------------------------------------------------ Mochi */
class Mochi {
  constructor(host) {
    this.host = host;
    this.canvas = host.querySelector("canvas");
    this.reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.r = rng(42);
    this.P = {};
    for (const [k, v] of Object.entries(BASE)) this.P[k] = new Spring(v, k === "phone" || k === "pad" ? 90 : k === "glasses" ? 70 : 160, k === "ear" || k === "tilt" ? 0.55 : k === "glasses" ? 0.62 : 0.8);
    this.queue = []; this.cur = null; this.curEnd = 0; this.mood = "idle";
    this.busy = false; this.lastActive = performance.now(); this.hops = []; this.parts = [];
    this.blinkAt = 1200; this.blinkT = -1; this.sacc = { x: 0, y: 0, at: 0 }; this.twitch = [0, 0]; this.twitchAt = 4000;
    this.nodAt = -1; this.waveAt = -1; this.lastFx = 0; this.frames = 0; this.fps = 0; this.fpsT = 0; this.skip = 0;
    this.inBed = false; this.bedAt = 0; this.bedSince = 0; this.patDir = 1; this.dreamUntil = 0;
    this.held = false; this.drag = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, ax: 0, swing: 0, swingV: 0, yankAt: -1e9, rides: 0 };
    this.simT = 0;   // animation time (ms): a slow or janky frame never skips the yank
    this.applied = { x: 0, y: 0 };
    try {   // (1.28 saved {x, y} from the corner; since 1.30 the height is kept from the top of the screen)
      const sp = JSON.parse(localStorage.getItem(SPOT_KEY) || "null");
      if (sp && isFinite(sp.x) && isFinite(sp.top)) this.drag.want = { x: sp.x, top: sp.top };
      else if (sp && isFinite(sp.x) && isFinite(sp.y)) this.drag.oldSpot = sp;
    } catch (_) { /* no storage */ }
    this.build();
    this.craft = new Stagecraft(this);   // props in his hoof, on his head or beside him; moves; posing
    this.zd = new ZeroDay(this);         // the midnight-neon mode (a switch on the page)
    this.scuffle = new Scuffle(this);    // soft-toy throws between Mochi, Cocoa and you
    this.hs = new Handshake(this);       // your secret handshake: taught by taps, done together, offered when you're back
    // the furniture (his shelf, his battlestation) stays where it is when he's carried about: it sits in a group that
    // is moved the opposite way to his box (which is what the drag moves, canvas and all)
    this.furniture = new THREE.Group(); this.furniture.name = "furniture"; this.scene.add(this.furniture);
    this.shelf = new Shelf(this);        // little copies of what he's made, on a bookcase to his right
    this.floor = new Floor(this);        // props you've pulled off it and put down (or are pulling about right now)
    this.propAct = new PropAct(this);    // a prop used on another one: scissors cut the paper (Nov 7)
    this.dance = new Party(this);        // "let's dance!": a disco ball, lights, music notes, and his friends dancing with him
    this.cold = new Cold(this);          // "achoo!": sneezes, and a little cold (a red nose, a scarf) when the story gives him one
    this.friendMoves = new FriendMoves(this);   // Mimi and Cocoa do moves too (he teaches them his)
    this.piggy = new Piggyback(this);           // a friend on his back for a piggyback ride (Nov 4)
    this.boom = new Boom(this);                 // big explosions (the launcher), fireworks or Zero Day data bursts
    this.pop = new Spring(0.001, 120, 0.42); this.pop.t = 1;
    this.play("hello");
    this.resize();
    new ResizeObserver(() => this.resize()).observe(host);
    addEventListener("resize", () => this.trackHome());
    if (window.visualViewport) visualViewport.addEventListener("resize", () => this.trackHome());
    { const D = this.drag, hr = this.homeRect(); if (D.oldSpot) D.want = { x: D.oldSpot.x, top: hr.top + D.oldSpot.y }; this.homeTop = hr.top; this.retarget(); D.x = D.tx; D.y = D.ty; this.placeHost(); }
    this.touchInput();
    this.prev = this.born = performance.now();
    this.renderer.setAnimationLoop((t) => this.frame(t));
  }

  /* ---------- scene */
  build() {
    const R = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, powerPreference: "low-power" });
    R.setClearColor(0x000000, 0);
    R.toneMapping = THREE.NeutralToneMapping; R.toneMappingExposure = 1.0;
    R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
    const S = this.scene = new THREE.Scene();
    // Mochi's own little world (him, his shadow, his bed, his friends, what stands beside him). When you carry him
    // somewhere, this moves inside a drawing that stays put over the window, so the furniture keeps its look and a
    // launcher can still reach the whole window (Nov 2: "the cupboard and the computer rotate and shift… the range of
    // the bazooka changes"). The furniture and the effects in flight live in the scene itself.
    const A = this.actor = new THREE.Group(); A.name = "actor"; S.add(A);
    this.scenery = new Scenery(this);    // the bushes, twigs and tracks of the story he's telling (Nov 5)
    const pm = new THREE.PMREMGenerator(R);
    S.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; S.environmentIntensity = 0.55;
    pm.dispose();
    this.camera = new THREE.PerspectiveCamera(24, 1, 0.1, 50);
    this.camera.position.set(0, 1.64, 7.6); this.camera.lookAt(0, 1.28, 0);

    const key = this.key = new THREE.DirectionalLight(0xfff1e2, 2.4); key.position.set(-2.2, 4, 4.5); this.keyBase = key.position.clone();
    key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 4;
    Object.assign(key.shadow.camera, { left: -1.6, right: 1.6, top: 2.8, bottom: -0.4, near: 1, far: 12 });
    key.shadow.bias = -0.0006; key.shadow.normalBias = 0.025;
    const rim = new THREE.DirectionalLight(0xdfe8ff, 1.7); rim.position.set(2.6, 2.6, -3.5);
    const fill = new THREE.HemisphereLight(0xfff8f0, 0xe7d6cf, 0.55);
    S.add(key, rim, fill);
    this.rimLight = rim; this.fill = fill;   // Zero Day mode recolours them

    const M = this.mat = {
      wool: new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.92, sheen: 1, sheenRoughness: 0.55, sheenColor: 0xffffff, bumpMap: woolBump(), bumpScale: 2.2 }),
      face: new THREE.MeshPhysicalMaterial({ color: 0xf9e1d1, roughness: 0.55, sheen: 0.6, sheenRoughness: 0.4, sheenColor: 0xffd6c8, clearcoat: 0.08 }),
      leg: new THREE.MeshPhysicalMaterial({ color: 0xf0d1be, roughness: 0.6, sheen: 0.4, sheenColor: 0xffd8c8 }),
      hoof: new THREE.MeshPhysicalMaterial({ color: 0x8f6c62, roughness: 0.45, clearcoat: 0.3 }),
      innerEar: new THREE.MeshPhysicalMaterial({ color: 0xf3a5ae, roughness: 0.5, sheen: 0.5, sheenColor: 0xffc4cc }),
      eye: new THREE.MeshPhysicalMaterial({ color: 0x241918, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 }),
      shine: new THREE.MeshBasicMaterial({ color: 0xffffff }),
      line: new THREE.MeshStandardMaterial({ color: 0x3a2724, roughness: 0.6 }),
      brow: new THREE.MeshStandardMaterial({ color: 0xb48e7d, roughness: 0.7 }),
      mouth: new THREE.MeshStandardMaterial({ color: 0x7c2f3a, emissive: 0x2a0a10, roughness: 0.7, side: THREE.DoubleSide }),
      nose: new THREE.MeshPhysicalMaterial({ color: 0xe59c99, roughness: 0.35, clearcoat: 0.5 }),
      blush: new THREE.MeshBasicMaterial({ map: radial("rgba(255,128,150,0.9)", "rgba(255,128,150,0)"), transparent: true, depthWrite: false, opacity: 0.4 }),
      drop: new THREE.MeshPhysicalMaterial({ color: 0x86c8ff, emissive: 0x123a66, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.85 }),
      phone: new THREE.MeshPhysicalMaterial({ color: 0xc9b8f2, roughness: 0.35, clearcoat: 0.6 }),
      phoneDark: new THREE.MeshStandardMaterial({ color: 0x2a2440, roughness: 0.3 }),
    };
    const add = (parent, geo, mat, cast = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m; };
    const sphere = (r = 1, w = 32, h = 24) => new THREE.SphereGeometry(r, w, h);
    const r = rng(11);
    const tint = (g, k) => {   // fleece is never one flat white: each puff a touch warmer or cooler
      const n = g.attributes.position.count, c = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { c[i * 3] = k; c[i * 3 + 1] = k * 0.985; c[i * 3 + 2] = k * 0.955; }
      g.setAttribute("color", new THREE.BufferAttribute(c, 3)); return g;
    };
    const woolBall = (rad, seg = 14) => tint(sphere(rad, seg, Math.round(seg * 0.7)), 0.94 + r() * 0.06);

    // contact shadow
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9),
      new THREE.MeshBasicMaterial({ map: radial("rgba(60,40,40,0.55)", "rgba(60,40,40,0)"), transparent: true, depthWrite: false }));
    this.ground.rotation.x = -Math.PI / 2; this.ground.position.y = 0.004; A.add(this.ground);

    const root = this.root = new THREE.Group(); A.add(root);
    const body = this.body = new THREE.Group(); root.add(body);

    // body: a fleece cloud on a round core
    const core = add(body, woolBall(1, 32), M.wool); core.scale.set(0.5, 0.52, 0.47); core.position.y = 0.56;
    // an invisible shell around the fleece, for finding the tummy under a finger
    this.tummy = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ visible: false }));
    this.tummy.scale.set(0.64, 0.66, 0.6); this.tummy.position.y = 0.56; body.add(this.tummy);
    const puffs = [];
    for (const d of fib(96)) {
      if (d.y < -0.62) continue;
      const g = woolBall(0.115 + r() * 0.055);
      g.translate(d.x * 0.47, 0.56 + d.y * 0.5, d.z * 0.44);
      puffs.push(g);
    }
    add(body, mergeGeometries(puffs), M.wool);
    const tail = add(body, woolBall(0.14, 16), M.wool); tail.position.set(0, 0.4, -0.56);

    // sitting legs, soles toward you
    for (const s of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(s * 0.25, 0.15, 0.24); leg.rotation.x = -Math.PI / 2 + 0.18; body.add(leg); (this.legs = this.legs || []).push(leg);
      add(leg, new THREE.CapsuleGeometry(0.115, 0.16, 8, 16), M.leg).position.y = -0.1;
      const h = add(leg, sphere(1, 24, 16), M.hoof); h.scale.set(0.118, 0.07, 0.118); h.position.y = -0.24;
    }
    // front legs (arms) on shoulder pivots
    this.arms = [-1, 1].map((s) => {
      const a = new THREE.Group(); a.position.set(s * 0.34, 0.74, 0.4); body.add(a);
      add(a, new THREE.CapsuleGeometry(0.1, 0.13, 8, 16), M.leg).position.y = -0.12;
      const h = add(a, sphere(1, 24, 16), M.hoof); h.scale.set(0.102, 0.062, 0.102); h.position.y = -0.245;
      a.userData.side = s; return a;
    });

    // head
    const neck = this.neck = new THREE.Group(); neck.position.set(0, 1.04, 0.04); body.add(neck);
    const head = this.head = new THREE.Group(); head.position.set(0, 0.54, 0.05); head.scale.setScalar(1.17); neck.add(head);
    add(head, woolBall(1, 32), M.wool).scale.set(0.55, 0.53, 0.49);
    const hp = [];
    for (const d of fib(140)) {
      const front = d.z > 0.18 && d.y < 0.5 && Math.abs(d.x) < 0.86;
      if (front || d.y < -0.55) continue;
      const g = woolBall(0.105 + r() * 0.06);
      g.translate(d.x * 0.53, d.y * 0.52 + 0.02, d.z * 0.47);
      hp.push(g);
    }
    add(head, mergeGeometries(hp), M.wool);
    // the face
    this.FC = new THREE.Vector3(0, -0.05, 0.12); this.FR = new THREE.Vector3(0.48, 0.43, 0.43);
    const face = add(head, sphere(1, 48, 32), M.face, false);
    face.scale.copy(this.FR); face.position.copy(this.FC);

    // ears
    this.ears = [-1, 1].map((s) => {
      const p = new THREE.Group(); p.position.set(s * 0.47, -0.02, 0.0); head.add(p);
      const o = add(p, sphere(1, 24, 16), M.face); o.scale.set(0.25, 0.1, 0.14); o.position.set(s * 0.21, -0.02, 0);
      const i = add(p, sphere(1, 24, 16), M.innerEar, false); i.scale.set(0.18, 0.062, 0.06); i.position.set(s * 0.23, -0.02, 0.085);
      p.userData.side = s; return p;
    });

    // eyes, lids-as-scale, happy/closed arcs, brows
    const arcGeo = (() => {
      const c = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.075, 0, 0), new THREE.Vector3(0, 0.1, 0), new THREE.Vector3(0.075, 0, 0));
      const t = new THREE.TubeGeometry(c, 20, 0.017, 8, false);
      const e1 = sphere(0.017, 10, 8); e1.translate(-0.075, 0, 0);
      const e2 = sphere(0.017, 10, 8); e2.translate(0.075, 0, 0);
      return mergeGeometries([t.toNonIndexed(), e1.toNonIndexed(), e2.toNonIndexed()]);
    })();
    this.eyes = [-1, 1].map((s) => {
      const g = new THREE.Group(); head.add(g);
      const ball = add(g, sphere(1, 32, 24), M.eye, false);
      const shine = new THREE.Group(); g.add(shine);
      const s1 = add(shine, sphere(0.028, 12, 10), M.shine, false); s1.position.set(-0.028, 0.045, 0.04);
      const s2 = add(shine, sphere(0.013, 10, 8), M.shine, false); s2.position.set(0.03, -0.035, 0.04);
      const arc = add(g, arcGeo, M.line, false); arc.position.z = 0.012;
      const browG = new THREE.Group(); head.add(browG);
      const brow = add(browG, new THREE.CapsuleGeometry(0.018, 0.08, 4, 8), M.brow, false); brow.rotation.z = Math.PI / 2;
      return { s, g, ball, shine, arc, browG };
    });
    // nose, blush
    this.nose = add(head, sphere(1, 20, 14), M.nose, false); this.nose.scale.set(0.045, 0.03, 0.022);
    this.place(this.nose, 0, -0.09, 0.012);
    this.blush = [-1, 1].map((s) => { const b = add(head, new THREE.CircleGeometry(0.1, 24), M.blush, false); this.place(b, s * 0.3, -0.12, 0.006); return b; });
    // shy: little /// lines over the blush
    this.lineMat = new THREE.MeshBasicMaterial({ color: 0xe0587a, transparent: true, opacity: 0, depthWrite: false });
    this.lines = [];
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      const l = add(head, new THREE.CapsuleGeometry(0.0075, 0.05, 4, 6), this.lineMat, false);
      this.place(l, s * 0.3 + (i - 1) * 0.045, -0.105, 0.014); l.rotateZ(-0.55); l.visible = false; this.lines.push(l);
    }
    // an invisible shell around the head, for finding a pat under a finger
    this.headHit = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ visible: false }));
    this.headHit.scale.set(0.68, 0.66, 0.6); head.add(this.headHit);

    // mouth: a fixed strip of vertices reshaped every frame
    this.MN = 22;
    const mg = new THREE.BufferGeometry();
    mg.setAttribute("position", new THREE.BufferAttribute(new Float32Array((this.MN + 1) * 2 * 3), 3));
    const idx = [];
    for (let i = 0; i < this.MN; i++) { const u = i, l = i + this.MN + 1; idx.push(u, l, u + 1, u + 1, l, l + 1); }
    mg.setIndex(idx);
    this.mouth = add(head, mg, M.mouth, false); this.mouth.frustumCulled = false;
    this.tongue = add(head, new THREE.CircleGeometry(1, 24), new THREE.MeshStandardMaterial({ color: 0xf07f8c, roughness: 0.5 }), false);

    // tears and sweat
    const dropGeo = (() => {
      const pts = [];
      for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI; pts.push(new THREE.Vector2(Math.sin(a) * 0.035 * (1 - 0.55 * Math.max(0, Math.cos(a))), -Math.cos(a) * 0.05 + (i < 4 ? 0.02 * (1 - i / 4) : 0))); }
      return new THREE.LatheGeometry(pts.reverse(), 16);
    })();
    this.tear = add(head, dropGeo, M.drop.clone(), false); this.tear.visible = false;
    this.sweat = add(head, dropGeo, M.drop.clone(), false); this.sweat.visible = false; this.sweat.scale.setScalar(1.25);

    // a little phone for typing (screen faces Mochi; you see the back)
    const phone = this.phone = new THREE.Group(); body.add(phone);
    phone.position.set(0, 0.7, 0.88);   // (lower and further out: Nov 4, "when mochi uses the phone to text it phases into his face")
    const box = (w, h, d, rad) => {
      const sh = new THREE.Shape(); const x = -w / 2, y = -h / 2;
      sh.moveTo(x + rad, y); sh.lineTo(x + w - rad, y); sh.quadraticCurveTo(x + w, y, x + w, y + rad); sh.lineTo(x + w, y + h - rad);
      sh.quadraticCurveTo(x + w, y + h, x + w - rad, y + h); sh.lineTo(x + rad, y + h); sh.quadraticCurveTo(x, y + h, x, y + h - rad);
      sh.lineTo(x, y + rad); sh.quadraticCurveTo(x, y, x + rad, y);
      const g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 6 });
      g.translate(0, 0, -d / 2); return g;
    };
    add(phone, box(0.34, 0.5, 0.03, 0.06), M.phone);
    const logo = add(phone, new THREE.CircleGeometry(0.05, 24), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.3, clearcoat: 1 }), false);
    logo.position.set(0, 0.08, 0.03);
    const cam = add(phone, new THREE.CircleGeometry(0.022, 16), M.phoneDark, false); cam.position.set(-0.1, 0.18, 0.031);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.46), new THREE.MeshBasicMaterial({ color: 0xbfe3ff }));
    screen.position.z = -0.028; screen.rotation.y = Math.PI; phone.add(screen);
    this.glow = new THREE.PointLight(0xa8d6ff, 0, 0.95, 2); this.glow.position.set(0, 1.12, 0.66); body.add(this.glow);

    // round reading glasses, for working on your food: they come down onto the face and lift off again
    const G = this.glasses = new THREE.Group(); head.add(G);
    const frameM = new THREE.MeshPhysicalMaterial({ color: 0x5b3a33, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15 });
    const lensM = new THREE.MeshPhysicalMaterial({ color: 0xe4f3ff, roughness: 0.05, transparent: true, opacity: 0.16, clearcoat: 1, depthWrite: false });
    const rod = (parent, a, b, rad, mat) => {
      const d = new THREE.Vector3().subVectors(b, a), m = add(parent, new THREE.CylinderGeometry(rad, rad, d.length(), 8), mat, false);
      m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return m;
    };
    const RIM = 0.112, inner = [], outer = [];
    this.glints = [];
    for (const s of [-1, 1]) {
      const rim = new THREE.Group(); G.add(rim);
      this.place(rim, s * 0.19, 0.005, 0.075);
      add(rim, new THREE.TorusGeometry(RIM, 0.014, 10, 44), frameM, false);
      add(rim, new THREE.CircleGeometry(RIM - 0.004, 36), lensM, false);
      const glint = add(rim, new THREE.PlaneGeometry(0.026, 0.16), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }), false);
      glint.position.z = 0.004; glint.rotation.z = -0.65; this.glints.push(glint);
      const at = (x) => rim.position.clone().add(new THREE.Vector3(x, 0.01, 0).applyQuaternion(rim.quaternion));
      inner.push(at(-s * RIM)); outer.push(at(s * RIM));
      rod(G, outer[outer.length - 1], new THREE.Vector3(s * 0.5, 0.03, -0.12), 0.011, frameM);   // arm back to the ear
    }
    const mid = inner[0].clone().add(inner[1]).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.035, 0.02));
    add(G, new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(inner[0], mid, inner[1]), 12, 0.012, 8, false), frameM, false);   // bridge
    G.visible = false;

    // a clipboard on the lap and a pencil that writes on it
    const pad = this.pad = new THREE.Group(); body.add(pad);
    pad.position.set(0, 0.64, 0.8); pad.rotation.x = -0.62;
    add(pad, box(0.52, 0.4, 0.024, 0.045), new THREE.MeshPhysicalMaterial({ color: 0xf2c6a0, roughness: 0.55, clearcoat: 0.3 }));
    const pc = document.createElement("canvas"); pc.width = 256; pc.height = 192;
    this.paper = { c: pc, g: pc.getContext("2d"), tex: new THREE.CanvasTexture(pc), x: 0, row: 0, next: 0, gap: 0, y: 0 };
    this.paper.tex.colorSpace = THREE.SRGBColorSpace;
    const sheet = add(pad, new THREE.PlaneGeometry(0.44, 0.33), new THREE.MeshStandardMaterial({ map: this.paper.tex, roughness: 0.9 }), false);
    sheet.position.set(0, -0.015, 0.026);
    const clip = add(pad, box(0.16, 0.05, 0.02, 0.012), new THREE.MeshPhysicalMaterial({ color: 0xc9c9d4, metalness: 0.8, roughness: 0.3 }));
    clip.position.set(0, 0.185, 0.03);
    const pencil = this.pencil = new THREE.Group(); pad.add(pencil);
    const pen = new THREE.Group(); pencil.add(pen);
    pen.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0.5, 0.42, 0.76).normalize());
    add(pen, new THREE.ConeGeometry(0.006, 0.014, 10), new THREE.MeshStandardMaterial({ color: 0x3a3a44, roughness: 0.5 }), false).position.y = 0.007;
    add(pen, new THREE.ConeGeometry(0.019, 0.04, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0xf3d2a2, roughness: 0.8 }), false).position.y = 0.032;
    add(pen, new THREE.CylinderGeometry(0.019, 0.019, 0.2, 12), new THREE.MeshPhysicalMaterial({ color: 0xffcf4d, roughness: 0.45, clearcoat: 0.4 }), false).position.y = 0.152;
    add(pen, new THREE.CylinderGeometry(0.02, 0.02, 0.022, 12), new THREE.MeshStandardMaterial({ color: 0xc0c3cc, metalness: 0.7, roughness: 0.3 }), false).position.y = 0.263;
    add(pen, new THREE.CylinderGeometry(0.019, 0.017, 0.03, 12), new THREE.MeshStandardMaterial({ color: 0xf48aa3, roughness: 0.7 }), false).position.y = 0.288;
    this.clearPaper();
    pad.visible = false;

    // particles
    const heart = new THREE.Shape();
    heart.moveTo(0, -0.09); heart.bezierCurveTo(-0.02, -0.06, -0.11, -0.02, -0.1, 0.04); heart.bezierCurveTo(-0.09, 0.1, -0.02, 0.1, 0, 0.05);
    heart.bezierCurveTo(0.02, 0.1, 0.09, 0.1, 0.1, 0.04); heart.bezierCurveTo(0.11, -0.02, 0.02, -0.06, 0, -0.09);
    this.heartGeo = new THREE.ExtrudeGeometry(heart, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 3, curveSegments: 10 });
    this.heartGeo.center();
    const star = new THREE.Shape();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 2, rr = i % 2 ? 0.03 : 0.09; star[i ? "lineTo" : "moveTo"](Math.cos(a) * rr, Math.sin(a) * rr); }
    this.confettiGeo = new THREE.PlaneGeometry(0.075, 0.042);
    this.starGeo = new THREE.ExtrudeGeometry(star, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.008, bevelSegments: 2 });
    this.starGeo.center();
    this.bangTex = canvasTex(64, (g, s) => { g.font = "900 56px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.lineWidth = 8; g.strokeStyle = "#ffffff"; g.strokeText("!", s / 2, s / 2 + 3); g.fillStyle = "#ff5a7a"; g.fillText("!", s / 2, s / 2 + 3); });
    this.snowTex = radial("rgba(255,255,255,1)", "rgba(255,255,255,0)");
    this.zTex = canvasTex(64, (g, s) => { g.font = "bold 52px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#8f86d6"; g.fillText("z", s / 2, s / 2 + 2); });
    this.noteTex = canvasTex(64, (g) => {   // a little music note (drawn, not a font glyph: every machine has it), white so each one can be tinted
      g.fillStyle = "#ffffff"; g.strokeStyle = "#ffffff"; g.lineWidth = 5; g.lineCap = "round";
      g.beginPath(); g.ellipse(24, 46, 11, 8, -0.45, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(33, 44); g.lineTo(33, 10); g.stroke();
      g.beginPath(); g.moveTo(33, 10); g.quadraticCurveTo(46, 16, 48, 30); g.quadraticCurveTo(44, 22, 33, 22); g.fill();
    });

    // a tiny bed for naps, seen from the side: a tall lilac headboard on the left, a short footboard, a mattress,
    // a pillow under Mochi's head and a heart quilt over its body; Mochi lies on its side facing you
    const bed = this.bedGroup = new THREE.Group(); A.add(bed);
    const lilac = new THREE.MeshPhysicalMaterial({ color: 0xcfc0f4, roughness: 0.45, clearcoat: 0.5 });
    const cream = new THREE.MeshPhysicalMaterial({ color: 0xfffaf2, roughness: 0.8, sheen: 0.7, sheenColor: 0xffffff });
    const quilt = new THREE.MeshPhysicalMaterial({ map: quiltTex(), roughness: 0.85, sheen: 0.5, sheenColor: 0xfff0f6 });
    const pinkM = new THREE.MeshPhysicalMaterial({ color: 0xff8fb0, roughness: 0.35, clearcoat: 1 });
    const K = 0.93, L = this.BED = { k: K, x: 0.5 * K, y: 0.95 * K, s: 0.6 * K, rot: 1.54 };   // where Mochi lies: shift, height, size, how far it tips over (K: the whole bed a touch smaller)
    const post = (h) => box(0.16, h, 0.94, 0.075);
    add(bed, post(1.5), lilac).position.set(-1.0, 0.75, 0);                       // headboard
    add(bed, post(0.98), lilac).position.set(1.0, 0.49, 0);                       // footboard
    for (const [x, y] of [[-1.0, 1.53], [1.0, 1.01]]) for (const z of [-0.4, 0.4]) add(bed, sphere(0.085, 20, 14), lilac).position.set(x, y, z);
    for (const z of [-0.45, 0.45]) add(bed, box(1.86, 0.24, 0.05, 0.06), lilac).position.set(0, 0.32, z);   // side rails
    const bedHeart = add(bed, this.heartGeo, pinkM, false); bedHeart.position.set(0, 0.32, 0.49);
    add(bed, box(1.86, 0.22, 0.86, 0.09), cream).position.set(0, 0.5, 0);       // mattress (top at 0.61)
    const pillow = add(bed, sphere(1, 28, 18), cream); pillow.scale.set(0.38, 0.16, 0.4); pillow.position.set(-0.6, 0.71, -0.02);
    const hump = add(bed, sphere(1, 40, 24), quilt); hump.scale.set(0.52, 0.46, 0.52); hump.position.set(0.33, 0.86, 0.0);
    const drape = add(bed, box(1.0, 0.3, 0.04, 0.03), quilt); drape.position.set(0.33, 0.5, 0.47);   // hanging over the side
    const cuff = add(bed, new THREE.TorusGeometry(1, 0.16, 12, 40), cream); cuff.rotation.y = Math.PI / 2; cuff.scale.set(0.5, 0.44, 0.6); cuff.position.set(-0.13, 0.84, 0);   // the folded-over top edge
    this.quiltParts = [hump, drape, cuff];
    bed.visible = false;
    this.bedParts = { frame: lilac, soft: cream, quilt, heartMat: pinkM, heart: bedHeart };   // Zero Day re-themes these (zdextras.js)
    // and a striped nightcap with a fluffy pompom
    const cap = this.cap = new THREE.Group(); this.head.add(cap);
    cap.position.set(0.08, 0.42, -0.04); cap.rotation.set(-0.2, 0, -0.8);
    const capMat = this.capMat = new THREE.MeshPhysicalMaterial({ map: stripeTex(), roughness: 0.7, sheen: 0.6, sheenColor: 0xffffff });
    add(cap, new THREE.ConeGeometry(0.3, 0.52, 28), capMat).position.y = 0.26;
    add(cap, new THREE.TorusGeometry(0.29, 0.055, 10, 36), cream).rotation.x = Math.PI / 2;
    add(cap, woolBall(0.085, 14), M.wool).position.y = 0.54;
    cap.visible = false;

    // costumes (v1.29, softer in 1.30): a floppy Santa hat and long bunny ears (the Halloween cat went in 1.36)
    const C = this.outfits = {};
    const ring = (n, rad, ball, y) => {   // a fluffy ring of wool puffs
      const parts = [];
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, g = woolBall(ball * (0.85 + r() * 0.3), 14); g.translate(Math.cos(a) * rad, y + (r() - 0.5) * 0.03, Math.sin(a) * rad); parts.push(g); }
      return mergeGeometries(parts);
    };
    const santa = C.christmas = new THREE.Group(); this.head.add(santa);
    santa.position.set(0.02, 0.42, -0.03); santa.rotation.set(-0.14, 0, -0.1);
    const felt = new THREE.MeshPhysicalMaterial({ color: 0xd8323f, roughness: 0.7, sheen: 1, sheenRoughness: 0.45, sheenColor: 0xff9a9a, bumpMap: woolBump(), bumpScale: 0.5, side: THREE.DoubleSide });
    this.hat = new Sweep(30, 30, 0.9, (u) => (0.41 * Math.pow(1 - u, 0.85) + 0.028) * (1 + 0.03 * Math.sin(u * 23)), 0.93);
    add(santa, this.hat.geo, felt);
    this.pompom = add(santa, woolBall(0.115, 18), M.wool);
    add(santa, ring(24, 0.4, 0.085, 0.01), M.wool);   // the fluffy brim
    this.hatFlop = new Spring(1.9, 40, 0.35);

    const bunny = C.easter = new THREE.Group(); this.head.add(bunny);
    const white = new THREE.MeshPhysicalMaterial({ color: 0xfffaf6, roughness: 0.75, sheen: 1, sheenRoughness: 0.45, sheenColor: 0xffffff, side: THREE.DoubleSide });
    const pinkIn = new THREE.MeshPhysicalMaterial({ color: 0xf3a5ae, roughness: 0.55, sheen: 0.5, sheenColor: 0xffc4cc, side: THREE.DoubleSide });
    const earW = (u) => 0.118 * Math.sqrt(Math.max(0, Math.sin(Math.PI * (0.07 + 0.93 * u)))) + 0.004;   // narrow base, wide middle, round tip
    this.bunnyEars = [-1, 1].map((sd) => {
      const e = new THREE.Group(); e.position.set(sd * 0.18, 0.5, -0.04); e.rotation.set(0, 0, -sd * 0.16); bunny.add(e);
      const out = new Sweep(24, 20, 0.66, earW, 0.42), inn = new Sweep(24, 14, 0.62, (u) => earW(u) * 0.6, 0.2);
      add(e, out.geo, white);
      const im = add(e, inn.geo, pinkIn, false); im.position.set(0, 0.02, 0.036);
      e.userData = { side: sd, out, inn }; return e;
    });
    this.costume = ""; this.spinAt = 0;

    // v1.34: puffed-up cheeks for sulking (they swell out of the face), and a little anger mark
    this.cheeks = [-1, 1].map((sd) => { const ch = add(head, sphere(1, 24, 16), M.face, false); ch.visible = false; ch.userData.side = sd; return ch; });
    this.veinTex = canvasTex(64, (g, sz) => {
      for (const [w, col] of [[12, "#ffffff"], [7, "#ff3b5c"]]) {
        g.strokeStyle = col; g.lineWidth = w; g.lineCap = "round";
        for (let k = 0; k < 4; k++) {
          g.save(); g.translate(sz / 2, sz / 2); g.rotate(k * Math.PI / 2);
          g.beginPath(); g.moveTo(sz * 0.08, -sz * 0.34); g.quadraticCurveTo(sz * 0.1, -sz * 0.1, sz * 0.34, -sz * 0.08); g.stroke(); g.restore();
        }
      }
    });

    // v1.34: Mimi, Mochi's girlfriend: a little smaller and rosier, long lashes and a big pink bow. She hops in beside
    // him when someone asks whether he has a friend or a girlfriend.
    const rosy = (rad, seg = 14) => {   // pinkish fleece
      const g = sphere(rad, seg, Math.round(seg * 0.7)), n = g.attributes.position.count, c = new Float32Array(n * 3), k = 0.95 + r() * 0.05;
      for (let i = 0; i < n; i++) { c[i * 3] = k; c[i * 3 + 1] = k * 0.885; c[i * 3 + 2] = k * 0.91; }
      g.setAttribute("color", new THREE.BufferAttribute(c, 3)); return g;
    };
    const mm = this.mimi = new THREE.Group(); A.add(mm); mm.visible = false;
    const mb = new THREE.Group(); mm.add(mb); this.mimiBody = mb;
    const mcore = add(mb, rosy(1, 28), M.wool); mcore.scale.set(0.48, 0.5, 0.45); mcore.position.y = 0.54;
    const mpuffs = [];
    for (const d of fib(80)) { if (d.y < -0.62) continue; const g = rosy(0.11 + r() * 0.05); g.translate(d.x * 0.45, 0.54 + d.y * 0.48, d.z * 0.42); mpuffs.push(g); }
    add(mb, mergeGeometries(mpuffs), M.wool);
    add(mb, rosy(0.13, 16), M.wool).position.set(0, 0.38, -0.52);
    for (const sd of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(sd * 0.23, 0.15, 0.22); leg.rotation.x = -Math.PI / 2 + 0.18; mb.add(leg); (this.mimiLegs = this.mimiLegs || []).push(leg);
      add(leg, new THREE.CapsuleGeometry(0.105, 0.15, 8, 16), M.leg).position.y = -0.1;
      const h = add(leg, sphere(1, 20, 14), M.hoof); h.scale.set(0.11, 0.065, 0.11); h.position.y = -0.23;
    }
    this.mimiArms = [-1, 1].map((sd) => {
      const a = new THREE.Group(); a.position.set(sd * 0.32, 0.72, 0.37); mb.add(a);
      add(a, new THREE.CapsuleGeometry(0.092, 0.12, 8, 16), M.leg).position.y = -0.11;
      const h = add(a, sphere(1, 20, 14), M.hoof); h.scale.set(0.095, 0.058, 0.095); h.position.y = -0.23;
      a.userData.side = sd; return a;
    });
    const mneck = this.mimiNeck = new THREE.Group(); mneck.position.set(0, 1.0, 0.04); mb.add(mneck);
    const mh = this.mimiHead = new THREE.Group(); mh.position.set(0, 0.52, 0.05); mh.scale.setScalar(1.12); mneck.add(mh);
    add(mh, rosy(1, 28), M.wool).scale.set(0.54, 0.52, 0.48);
    const mhp = [];
    for (const d of fib(130)) {
      if ((d.z > 0.18 && d.y < 0.5 && Math.abs(d.x) < 0.86) || d.y < -0.55) continue;
      const g = rosy(0.1 + r() * 0.055); g.translate(d.x * 0.52, d.y * 0.5 + 0.02, d.z * 0.46); mhp.push(g);
    }
    add(mh, mergeGeometries(mhp), M.wool);
    const MFC = new THREE.Vector3(0, -0.05, 0.12), MFR = new THREE.Vector3(0.47, 0.42, 0.42);
    const mface = add(mh, sphere(1, 40, 28), M.face, false); mface.scale.copy(MFR); mface.position.copy(MFC);
    const mplace = (obj, x, y, lift) => {   // on Mimi's face, like place() on Mochi's
      const q = 1 - (x * x) / (MFR.x * MFR.x) - (y * y) / (MFR.y * MFR.y), z = MFR.z * Math.sqrt(Math.max(0.0001, q));
      const n = new THREE.Vector3(x / (MFR.x * MFR.x), y / (MFR.y * MFR.y), z / (MFR.z * MFR.z)).normalize();
      obj.position.set(MFC.x + x, MFC.y + y, MFC.z + z).addScaledVector(n, lift); obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    };
    for (const sd of [-1, 1]) {   // ears, a little droopier than his
      const p = new THREE.Group(); p.position.set(sd * 0.46, -0.04, 0); p.rotation.z = -sd * 0.42; mh.add(p); p.userData.side = sd; (this.mimiEars = this.mimiEars || []).push(p);
      const o = add(p, sphere(1, 20, 14), M.face); o.scale.set(0.24, 0.095, 0.13); o.position.set(sd * 0.2, -0.02, 0);
      const i = add(p, sphere(1, 20, 14), M.innerEar, false); i.scale.set(0.17, 0.058, 0.055); i.position.set(sd * 0.22, -0.02, 0.08);
    }
    this.mimiEyes = [-1, 1].map((sd) => {
      const g = new THREE.Group(); mh.add(g); mplace(g, sd * 0.175, 0.0, 0.004);
      const ball = add(g, sphere(1, 28, 20), M.eye, false); ball.scale.set(0.078, 0.104, 0.034);
      const s1 = add(g, sphere(0.027, 12, 10), M.shine, false); s1.position.set(-0.026, 0.042, 0.04);
      const s2 = add(g, sphere(0.012, 10, 8), M.shine, false); s2.position.set(0.028, -0.032, 0.04);
      for (const [lx, ly, rz] of [[0.045, 0.088, 0.35], [0.068, 0.068, 0.75], [0.082, 0.04, 1.15]]) {   // long lashes at the outer corner
        const l = add(g, new THREE.CapsuleGeometry(0.008, 0.042, 4, 6), M.line, false);
        l.position.set(sd * lx, ly, 0.022); l.rotation.z = -sd * rz;
      }
      return { g, ball, shines: [s1, s2] };
    });
    const mnose = add(mh, sphere(1, 16, 12), M.nose, false); mnose.scale.set(0.04, 0.027, 0.02); mplace(mnose, 0, -0.085, 0.012);
    const mblushM = M.blush.clone(); mblushM.opacity = 0.62;
    for (const sd of [-1, 1]) { const b = add(mh, new THREE.CircleGeometry(0.105, 24), mblushM, false); mplace(b, sd * 0.29, -0.115, 0.006); }
    const smileC = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.045, 0.006, 0), new THREE.Vector3(0, -0.034, 0), new THREE.Vector3(0.045, 0.006, 0));
    const msm = add(mh, new THREE.TubeGeometry(smileC, 16, 0.011, 8, false), M.mouth, false); mplace(msm, 0, -0.19, 0.008);
    const pinkBow = new THREE.MeshPhysicalMaterial({ color: 0xff74a6, roughness: 0.35, clearcoat: 0.8, sheen: 0.4, sheenColor: 0xffd0e2 });
    const mbow = this.mimiBow = new THREE.Group(); mbow.position.set(-0.24, 0.5, 0.16); mbow.rotation.set(0.15, 0.2, 0.42); mbow.scale.setScalar(1.6); mh.add(mbow);
    for (const sd of [-1, 1]) {
      const w = add(mbow, sphere(1, 18, 12), pinkBow); w.scale.set(0.09, 0.064, 0.04); w.position.x = sd * 0.08; w.rotation.z = sd * 0.38;
      const tail = add(mbow, new THREE.CapsuleGeometry(0.014, 0.06, 4, 8), pinkBow); tail.position.set(sd * 0.03, -0.06, 0); tail.rotation.z = sd * 0.35;
    }
    add(mbow, sphere(0.036, 14, 10), pinkBow);
    // 1.36: her own little Christmas outfit (on whenever he wears his): a small Santa hat tipped the other way, so her bow
    // still shows, and a red scarf with a fluffy white trim
    const mx = this.mimiXmas = new THREE.Group(); mx.visible = false; mb.add(mx);
    const mhat = this.mimiHatGroup = new THREE.Group(); mhat.position.set(0.15, 0.4, -0.06); mhat.rotation.set(-0.12, 0, -0.42); mh.add(mhat);
    this.mimiHat = new Sweep(24, 24, 0.66, (u) => (0.3 * Math.pow(1 - u, 0.85) + 0.022) * (1 + 0.03 * Math.sin(u * 21)), 0.93);
    add(mhat, this.mimiHat.geo, felt);
    this.mimiPom = add(mhat, woolBall(0.09, 16), M.wool);
    add(mhat, ring(20, 0.3, 0.068, 0.01), M.wool);
    this.mimiHat.bend((u) => -0.1 + 1.6 * Math.pow(u, 2.3));
    this.mimiPom.position.copy(this.mimiHat.tip).addScaledVector(this.mimiHat.dir, 0.05);
    mhat.visible = false;
    const scarf = add(mx, new THREE.TorusGeometry(0.31, 0.075, 12, 36), felt); scarf.rotation.x = Math.PI / 2 - 0.12; scarf.position.set(0, 1.02, 0.04);
    add(mx, ring(22, 0.33, 0.045, 0), M.wool).position.set(0, 0.96, 0.04);
    const scarfEnd = add(mx, new THREE.CapsuleGeometry(0.06, 0.2, 6, 12), felt); scarfEnd.position.set(0.16, 0.86, 0.33); scarfEnd.rotation.set(0.3, 0, 0.25);
    add(mx, woolBall(0.045, 12), M.wool).position.set(0.19, 0.72, 0.36);
    this.mimiGround = new THREE.Mesh(this.ground.geometry, this.ground.material.clone());
    this.mimiGround.rotation.x = -Math.PI / 2; this.mimiGround.position.y = 0.004; this.mimiGround.visible = false; A.add(this.mimiGround);
    this.duo = new Spring(0, 18, 0.95);   // how far Mochi has stepped aside for her (at a walk: he steps over)
    this.gf = null;

    // Cocoa, Mochi's best buddy: a brown sheep, a bit stockier than Mimi, little curled horns and a teal bandana.
    // Loves games, sports, snacks and terrible jokes; he comes in from the left when the talk is his kind of thing.
    const cocoaWool = (rad, seg = 14) => {
      const g = sphere(rad, seg, Math.round(seg * 0.7)), n = g.attributes.position.count, c = new Float32Array(n * 3), k = 0.9 + r() * 0.1;
      for (let i = 0; i < n; i++) { c[i * 3] = 0.42 * k; c[i * 3 + 1] = 0.26 * k; c[i * 3 + 2] = 0.155 * k; }   // cocoa brown
      g.setAttribute("color", new THREE.BufferAttribute(c, 3)); return g;
    };
    const CM = this.cocoaMat = {
      wool: Object.assign(M.wool.clone(), { sheen: 0.7 }),   // his own fleece: a warm brown sheen, not his friends' white one
      face: new THREE.MeshPhysicalMaterial({ color: 0xe2b98f, roughness: 0.55, sheen: 0.6, sheenRoughness: 0.4, sheenColor: 0xffd9b8, clearcoat: 0.08 }),
      leg: new THREE.MeshPhysicalMaterial({ color: 0x9a6b4a, roughness: 0.6, sheen: 0.4, sheenColor: 0xd9a57e }),
      hoof: new THREE.MeshPhysicalMaterial({ color: 0x4a3226, roughness: 0.45, clearcoat: 0.3 }),
      horn: new THREE.MeshPhysicalMaterial({ color: 0xf1dcb5, roughness: 0.45, clearcoat: 0.4, sheen: 0.3 }),
      band: new THREE.MeshPhysicalMaterial({ color: 0x1fb5a8, roughness: 0.55, sheen: 0.8, sheenColor: 0x9ff3e8 }),
      nose: new THREE.MeshPhysicalMaterial({ color: 0x8a4f3c, roughness: 0.35, clearcoat: 0.5 }),
    };
    CM.wool.sheenColor = new THREE.Color(0xb98a62);
    const cc = this.cocoa = new THREE.Group(); A.add(cc); cc.visible = false;
    const cb = new THREE.Group(); cc.add(cb); this.cocoaBody = cb;
    const ccore = add(cb, cocoaWool(1, 28), CM.wool); ccore.scale.set(0.52, 0.52, 0.48); ccore.position.y = 0.55;
    const cpuffs = [];
    for (const d of fib(84)) { if (d.y < -0.62) continue; const g = cocoaWool(0.115 + r() * 0.05); g.translate(d.x * 0.49, 0.55 + d.y * 0.5, d.z * 0.45); cpuffs.push(g); }
    add(cb, mergeGeometries(cpuffs), CM.wool);
    add(cb, cocoaWool(0.14, 16), CM.wool).position.set(0, 0.38, -0.55);
    for (const sd of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(sd * 0.25, 0.15, 0.22); leg.rotation.x = -Math.PI / 2 + 0.18; cb.add(leg); (this.cocoaLegs = this.cocoaLegs || []).push(leg);
      add(leg, new THREE.CapsuleGeometry(0.11, 0.15, 8, 16), CM.leg).position.y = -0.1;
      const h = add(leg, sphere(1, 20, 14), CM.hoof); h.scale.set(0.115, 0.068, 0.115); h.position.y = -0.23;
    }
    this.cocoaArms = [-1, 1].map((sd) => {
      const a = new THREE.Group(); a.position.set(sd * 0.34, 0.73, 0.38); cb.add(a);
      add(a, new THREE.CapsuleGeometry(0.096, 0.13, 8, 16), CM.leg).position.y = -0.11;
      const h = add(a, sphere(1, 20, 14), CM.hoof); h.scale.set(0.1, 0.06, 0.1); h.position.y = -0.24;
      a.userData.side = sd; return a;
    });
    const cneck = this.cocoaNeck = new THREE.Group(); cneck.position.set(0, 1.02, 0.04); cb.add(cneck);
    const ch = this.cocoaHead = new THREE.Group(); ch.position.set(0, 0.52, 0.05); ch.scale.setScalar(1.12); cneck.add(ch);
    add(ch, cocoaWool(1, 28), CM.wool).scale.set(0.55, 0.52, 0.48);
    const chp = [];
    for (const d of fib(130)) {
      if ((d.z > 0.18 && d.y < 0.5 && Math.abs(d.x) < 0.86) || d.y < -0.55) continue;
      const g = cocoaWool(0.1 + r() * 0.055); g.translate(d.x * 0.53, d.y * 0.5 + 0.02, d.z * 0.46); chp.push(g);
    }
    add(ch, mergeGeometries(chp), CM.wool);
    const CFC = new THREE.Vector3(0, -0.06, 0.12), CFR = new THREE.Vector3(0.48, 0.42, 0.42);
    add(ch, sphere(1, 40, 28), CM.face, false).scale.copy(CFR).multiplyScalar(1); ch.children.at(-1).position.copy(CFC);
    const cplace = (obj, x, y, lift) => {
      const q = 1 - (x * x) / (CFR.x * CFR.x) - (y * y) / (CFR.y * CFR.y), z = CFR.z * Math.sqrt(Math.max(0.0001, q));
      const n = new THREE.Vector3(x / (CFR.x * CFR.x), y / (CFR.y * CFR.y), z / (CFR.z * CFR.z)).normalize();
      obj.position.set(CFC.x + x, CFC.y + y, CFC.z + z).addScaledVector(n, lift); obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    };
    for (const sd of [-1, 1]) {   // ears, perkier than Mimi's
      const p = new THREE.Group(); p.position.set(sd * 0.47, -0.02, 0); p.rotation.z = -sd * 0.25; ch.add(p); p.userData.side = sd; (this.cocoaEars = this.cocoaEars || []).push(p);
      const o = add(p, sphere(1, 20, 14), CM.face); o.scale.set(0.24, 0.1, 0.13); o.position.set(sd * 0.2, -0.02, 0);
      add(p, sphere(1, 20, 14), M.innerEar, false).scale.set(0.17, 0.06, 0.055); p.children.at(-1).position.set(sd * 0.22, -0.02, 0.08);
      // a little curled horn, coming out above the ear and curling back and down
      const hornG = new THREE.Group(); hornG.position.set(sd * 0.47, 0.3, -0.04); hornG.rotation.set(0, sd * 0.35, sd * -0.5); hornG.scale.setScalar(1.25); ch.add(hornG); (this.cocoaHorns = this.cocoaHorns || []).push(hornG);
      const t = add(hornG, new THREE.TorusGeometry(0.1, 0.045, 12, 28, Math.PI * 1.5), CM.horn); t.rotation.set(0, sd > 0 ? 0 : Math.PI, 0.2);
      add(hornG, sphere(0.045, 12, 10), CM.horn).position.set(sd * 0.1, 0, 0);
    }
    this.cocoaEyes = [-1, 1].map((sd) => {
      const g = new THREE.Group(); ch.add(g); cplace(g, sd * 0.17, 0.01, 0.004);
      const ball = add(g, sphere(1, 28, 20), M.eye, false); ball.scale.set(0.074, 0.098, 0.034);
      const s1 = add(g, sphere(0.026, 12, 10), M.shine, false); s1.position.set(-0.024, 0.04, 0.04);
      const s2 = add(g, sphere(0.011, 10, 8), M.shine, false); s2.position.set(0.026, -0.03, 0.04);
      const brow = add(g, new THREE.CapsuleGeometry(0.012, 0.07, 4, 8), M.line, false); brow.position.set(0, 0.135, 0.02); brow.rotation.z = Math.PI / 2 + sd * 0.12;   // bold brows: he's a lively one
      return { g, ball, shines: [s1, s2], brow };
    });
    add(ch, sphere(1, 16, 12), CM.nose, false).scale.set(0.05, 0.032, 0.022); cplace(ch.children.at(-1), 0, -0.085, 0.012);
    for (const sd of [-1, 1]) for (const [fx, fy] of [[0.27, -0.06], [0.31, -0.1], [0.25, -0.12]]) { const f = add(ch, sphere(0.012, 8, 6), CM.nose, false); cplace(f, sd * fx, fy, 0.003); }   // freckles
    const grin = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.07, 0.01, 0), new THREE.Vector3(0, -0.05, 0), new THREE.Vector3(0.07, 0.01, 0));
    this.cocoaMouth = add(ch, new THREE.TubeGeometry(grin, 16, 0.012, 8, false), M.mouth, false); cplace(this.cocoaMouth, 0, -0.19, 0.008);
    const bandana = this.cocoaBandana = add(cb, new THREE.TorusGeometry(0.31, 0.065, 12, 36), CM.band); bandana.rotation.x = Math.PI / 2 - 0.1; bandana.position.set(0, 1.03, 0.04);
    const knot = add(cb, new THREE.ConeGeometry(0.11, 0.2, 16), CM.band); knot.position.set(0.0, 0.9, 0.34); knot.rotation.set(Math.PI + 0.3, 0, 0);
    this.cocoaGround = new THREE.Mesh(this.ground.geometry, this.ground.material.clone());
    this.cocoaGround.rotation.x = -Math.PI / 2; this.cocoaGround.position.y = 0.004; this.cocoaGround.visible = false; A.add(this.cocoaGround);
    this.duo2 = new Spring(0, 18, 0.95);   // how far Mochi has stepped aside for Cocoa
    this.bud = null;
  }

  /* ---------- the notepad: lines of "handwriting" appear as the pencil moves */
  clearPaper() {
    const p = this.paper, g = p.g, w = p.c.width, h = p.c.height;
    g.fillStyle = "#fffdf6"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(120,170,220,0.55)"; g.lineWidth = 1.5;
    for (let y = 40; y < h; y += 32) { g.beginPath(); g.moveTo(10, y); g.lineTo(w - 10, y); g.stroke(); }
    g.strokeStyle = "rgba(240,140,150,0.6)"; g.beginPath(); g.moveTo(30, 6); g.lineTo(30, h - 6); g.stroke();
    p.row = 0; p.x = 38; p.gap = 0; p.y = 36; p.tex.needsUpdate = true;
  }
  stepPaper(now) {   // about 22 pen moves a second, however fast the phone draws
    const p = this.paper;
    if (p.next < now - 300) p.next = now;
    for (let n = 0; n < 8 && now >= p.next; n++) { p.next += 45; this.penMove(); }
  }
  penMove() {
    const p = this.paper;
    const g = p.g, w = p.c.width, y0 = 36 + p.row * 32;
    if (p.gap > 0) { p.gap--; p.x += 4; }
    else {
      g.strokeStyle = "#3a3150"; g.lineWidth = 5; g.lineCap = "round";
      const nx = p.x + 4 + this.r() * 3, ny = y0 - 4 - Math.abs(Math.sin(nx * 0.5)) * (7 + this.r() * 5);
      g.beginPath(); g.moveTo(p.x, p.y || y0); g.lineTo(nx, ny); g.stroke();
      p.x = nx; p.y = ny;
      if (this.r() < 0.09) { p.gap = 2 + Math.floor(this.r() * 2); p.y = 0; }   // a space between words
    }
    if (p.x > w - 24) { p.row++; p.x = 38; p.y = 0; p.gap = 0; }
    if (36 + p.row * 32 > p.c.height - 8) this.clearPaper();
    p.tex.needsUpdate = true;
  }

  // put a mesh on the face surface at (x, y) in face coordinates, facing out
  surf(x, y, lift, out) {
    const { FR } = this;
    const q = 1 - (x * x) / (FR.x * FR.x) - (y * y) / (FR.y * FR.y);
    const z = FR.z * Math.sqrt(Math.max(0.0001, q));
    out.set(this.FC.x + x, this.FC.y + y, this.FC.z + z);
    const n = new THREE.Vector3(x / (FR.x * FR.x), y / (FR.y * FR.y), z / (FR.z * FR.z)).normalize();
    out.addScaledVector(n, lift);
    return n;
  }
  place(obj, x, y, lift) {
    const p = new THREE.Vector3(), n = this.surf(x, y, lift, p);
    obj.position.copy(p); obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  }

  lighten() {
    if (this.quality === 0) return;
    this.quality = this.quality === undefined ? 1 : 0;
    if (this.quality === 1 && this.renderer.getPixelRatio() > 1) { this.dpr = 1; this.resize(); return; }
    this.quality = 0;
    this.renderer.shadowMap.enabled = false;
    this.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  }

  resize() {
    // the canvas reaches past Mochi's box (CSS: 22% each side, 18% above, 6% below) so nothing is cut off when it's lifted
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
    const padX = +this.host.dataset.padX || PAD.x;   // a page can give the canvas more room at the sides (ammo flies further)
    let pl = padX, pr = padX, pt = PAD.top, pb = PAD.bottom;
    // data-cover="viewport": the canvas covers the whole window, so what he fires, throws or rides is never cut off at
    // the edge of a rectangle around him (M5, Nov 2). His box, and so his size and place, stay exactly the same.
    if (this.host.dataset.cover === "viewport" && typeof innerWidth === "number") {
      const r = this.host.getBoundingClientRect(), bx = r.left - (this.applied ? this.applied.x : 0), by = r.top - (this.applied ? this.applied.y : 0);
      const clampP = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
      pl = clampP(bx / w, padX, 5); pr = clampP((innerWidth - bx - w) / w, padX, 5);
      pt = clampP(by / h, PAD.top, 3); pb = clampP((innerHeight - by - h) / h, PAD.bottom, 3);
      Object.assign(this.canvas.style, { left: `${-pl * w}px`, top: `${-pt * h}px`, width: `${w * (1 + pl + pr)}px`, height: `${h * (1 + pt + pb)}px` });
      this.coverKey = `${Math.round(bx)},${Math.round(by)},${innerWidth},${innerHeight},${w},${h}`;
    }
    const cw = w * (1 + pl + pr), ch = h * (1 + pt + pb);
    const big = cw * ch > 700000;   // a big canvas: a touch fewer pixels, so it stays smooth
    this.renderer.setPixelRatio(this.dpr || Math.min(devicePixelRatio || 1, big ? 1.5 : 2));
    this.renderer.setSize(cw, ch, false);
    // keep the whole sheep (and room above for hearts) in view of Mochi's box whatever its shape. The camera looks
    // straight at his box and the canvas around it is the same view carried on past its edges (an off-axis lens).
    // It used to be one wide view centred on the window, so a box off to one side, or moved there, saw him at a
    // slant: stretched and turned (Nov 4, Binoy: "when I move mochi around it seems like he gets stretched and rotated")
    const needH = 3.05, dist = 7.6, aspect = w / h;
    // (Nov 7, on a phone: with Mimi and Cocoa on stage they stood half off the screen; on a narrow screen the view
    // widens while friends are here, and comes back in when they've gone)
    const pals = (this.gf ? 1 : 0) + (this.bud ? 1 : 0), wantW = aspect < 1 && pals ? (pals > 1 ? 2.1 : 1.8) : 1.18;
    this._framedPals = pals;
    const half = Math.max(needH / 2 / dist, (wantW / aspect) / dist);   // tan(half the box's vertical view)
    this.camera.fov = 2 * Math.atan(half) * 180 / Math.PI;
    this.camera.aspect = aspect;
    this.lens = { w, h, pl, pr, pt, pb, cw, ch, half, dist };
    const hb = half * dist * aspect;                                   // half the box's width, at the stage
    this.view = { x: hb * (pr - pl), half: hb * (1 + pl + pr) };       // what's on screen at the stage: x ± half
    // a narrow screen (a phone, Nov 4: "it is hard to see part of the shelf where the props are kept"): his bookcase
    // comes in from 2.2 to where all of it shows, no closer than 1.6 (his hoof and what's in it)
    if (this.shelf && this.shelf.group) {   // (the window's right edge, not the drawing's: the drawing goes past it)
      const hr = this.host.getBoundingClientRect(), perPx = (2 * half * dist) / Math.max(1, h), vw = (window.visualViewport && visualViewport.width) || innerWidth;
      const right = (Math.min(vw, document.documentElement.clientWidth || vw) - (hr.left + hr.width / 2) + (this.applied ? this.applied.x : 0)) * perPx;
      this.shelf.group.position.x = Math.max(1.6, Math.min(2.2, right - 0.85));
    }
    this.aimCamera();

  }
  coverCheck() {   // the window or his box moved: cover the window again
    if (this.host.dataset.cover !== "viewport") return;
    const r = this.host.getBoundingClientRect(), bx = r.left - (this.applied ? this.applied.x : 0), by = r.top - (this.applied ? this.applied.y : 0);
    const key = `${Math.round(bx)},${Math.round(by)},${innerWidth},${innerHeight},${this.host.clientWidth},${this.host.clientHeight}`;
    if (key !== this.coverKey) this.resize();
  }

  /* ---------- moods and timing */
  setFace(name) {
    const f = (this.zd && this.zd.face(name)) || FACES[name] || {};
    for (const k in BASE) this.P[k].t = k in f ? f[k] : BASE[k];
    // after working on your food Mochi keeps the glasses on to show you the card, then takes them off
    if (this.task && !this.busy && (name === "nod" || name === "present")) this.P.glasses.t = 1;
  }
  faceBase(k) { const f = (this.zd && this.zd.face(this.mood)) || FACES[this.mood] || {}; return k in f ? f[k] : BASE[k]; }   // what the current face wants for one channel
  play(name, ms) {
    const now = performance.now();
    this.cur = name; this.curEnd = now + (ms || HOLD[name] || 1500); this.mood = name; this.setFace(name);
    this.lastFx = 0;
    const big = !this.reduce;
    if (name === "hello") { this.waveAt = now; if (big) this.hop(0.1, 380, 0); }
    if (name === "happy") { if (big) { this.hop(0.22, 420, 0); this.hop(0.16, 380, 470); } }
    if (name === "excited") { if (big) { this.hop(0.28, 400, 0); this.hop(0.24, 380, 440); this.hop(0.18, 360, 860); } }
    if (name === "superexcited") {   // 1.36: bounces all around the screen, confetti flying, then hops back to its spot
      for (let i = 0; i < 8; i++) this.spawn(i % 2 ? "confetti" : "star", 1800);
      if (big) this.zoomies(now); else { this.hop(0.28, 400, 0); this.hop(0.24, 380, 440); }
    }
    if (name === "love") { if (big) this.hop(0.1, 380, 0); }
    if (name === "tickled") { if (big) this.hop(0.08, 300, 0); }
    if (name === "laugh") { if (big) this.hop(0.06, 280, 0); }
    if (name === "surprised") { if (big) this.hop(0.12, 260, 0); }
    if (name === "shocked") { this.shockAt = now; if (!this.zd.on) { if (big) this.hop(0.3, 300, 0); this.spawn("bang"); } }   // Zero Day: steady, not startled
    if (name === "proud") { if (big) this.hop(0.1, 320, 0); this.spawn("star"); }
    if (name === "nod" || name === "present") this.nodAt = now;
  }
  base() {
    if (this.craft && this.craft.posing) return "posing";
    if (this.held) return this.mood === "yanked" ? "yanked" : "held";
    if (this.sulking) return "angry";   // v1.34: no typing, no napping: arms crossed until you apologise
    if (this.busy) return this.task ? "working" : "typing";
    if (this.inBed) return "bed";
    return performance.now() - this.lastActive > DOZE_MS ? "sleep" : "idle";
  }
  run(steps) {
    this.queue = steps.slice();
    // a costume change still waiting (a new message or a tap came first): keep it at the end of the new plan
    if (this.wearNext !== undefined && this.wearNext !== this.costume && !this.spinAt && !this.queue.some((q) => q[0] === "@wear")) this.queue.push(["@wear", this.wearNext]);
    const first = this.queue[0];
    // keep going with what's already on screen instead of restarting it
    if (first && first[0] === this.cur) { this.queue.shift(); this.curEnd = performance.now() + (first[1] || HOLD[first[0]] || 1500); return; }
    this.next();
  }
  next() {
    const s = this.queue.shift();
    if (s && s[0] === "@react") {
      const m = (this.pending && this.pending.mood) || "nod";
      this.pending = null; this.reactMood = m; this.reactAt = performance.now();   // how he took your message (the answer's face follows from it)
      if (m === "sleepy") {   // "good night": a yawn now, the little bed once the answer is in
        if (this.busy) this.wantsBed = true; else this.bedAt = performance.now() + 6000;
      }
      this.play(m, HOLD[m] || 1000);
      if (m === "shocked") this.queue.unshift(["concerned", 3200]);   // the gasp, then a worried lean toward you
      if (m === "showoff") this.showGF();                              // "do you have a girlfriend?": here's Mimi
    } else if (s && s[0] === "@wear") {   // a twirl, and the outfit changes halfway round
      this.wearNext = s[1]; this.spinAt = performance.now();
      if (!this.reduce) this.hop(0.12, 320, 0);
      for (let i = 0; i < 3; i++) this.spawn("star");
      this.play(s[1] ? "happy" : "nod", s[1] ? 1700 : 1100);
    } else if (s && s[0] === "@perf") {   // day 2: a move (with a prop, if it needs one)
      this.craft.begin(s[1]);
    } else if (s && s[0] === "@bed") {
      this.inBed = true; this.bedSince = performance.now(); this.cur = null; this.mood = "bed"; this.setFace("bed");
    } else if (s) this.play(s[0], s[1]);
    else { if (!this.busy) this.task = false; this.cur = null; const b = this.base(); this.mood = b; this.setFace(b); }
  }
  touch() {
    const wasAsleep = this.mood === "sleep" || this.mood === "bed" || this.inBed;
    this.wokeFromBed = this.inBed;
    this.inBed = false; this.bedAt = 0;
    this.lastActive = performance.now();
    return wasAsleep;
  }
  wokeNote() { this.note(this.wokeFromBed ? "woke_bed" : "woke"); }

  said(text, id, photo) {
    if (this.sulking) {   // v1.34: still cross: reads it with a sideways glance, huffs, stays turned away
      this.touch(); this.task = false; this.pending = null;
      this.run([["angry", 700], ["angry", 1600]]); this.huff();
      return;
    }
    if (this.forgiving) {   // they said sorry: turns back with a little pout, then softens
      this.forgiving = false; this.touch(); this.task = false; this.pending = null;
      this.run([["forgive", 1500], ["love", 2200]]);
      return;
    }
    const woke = this.touch();
    this.task = isTask(text, photo);
    if (woke) { this.wokeNote(); this.hs.returned("message"); }   // back after a nap: the handshake once he's answered
    // react from the word rules unless the emotion model on the computer answers while Mochi reads
    this.pending = { id, mood: classify(text), waiting: this.expectModel !== false };
    const readMs = Math.min(2000, 700 + String(text || "").length * 22);
    const steps = woke ? [["surprised", 600]] : [];
    steps.push(["reading", readMs]);
    steps.push(["@react"]);
    this.run(steps);
  }
  heard(d) {   // the computer's answer: a mood, or null when its model isn't installed
    const p = this.pending;
    if (!p || p.id !== d.id) return;
    p.waiting = false;
    if (d.mood && MOOD_NAMES.has(d.mood)) { p.mood = d.mood; this.expectModel = true; }
    else if (d.mood === null) this.expectModel = false;
  }
  setBusy(b) {
    this.touch(); this.busy = !!b;
    if (!this.cur) this.next();
  }
  replied(d) {
    this.touch(); this.busy = false;
    this.hs.replied();
    if (this.gf && !this.gf.leaving) this.gf.until = Math.max(this.gf.until, performance.now() + 9000);   // Mimi stays while you read
    if (this.sulking) {   // the "....." answer: still turned away; telling you why he went quiet: a pouty glance back first
      this.run(d && d.text && !/^[.\s…]*$/.test(d.text) ? [["peek", 3200], ["angry", 1600]] : [["angry", 1600]]); return;
    }
    if (this.wantsBed) { this.wantsBed = false; this.bedAt = performance.now() + 6000; }
    // hurt by your message ("you suck": a sad face as he read it): he answers with a pout, not a blushing smile, and
    // "that's not very nice" isn't good news (it used to turn into a happy blush: M5, Nov 2)
    const hurt = (this.reactMood === "sad" || this.reactMood === "oops") && performance.now() - (this.reactAt || 0) < 30000;
    let m = hurt ? "oops" : "present";
    if (d && d.error) m = "oops";
    else if (d && CONCERN_REPLY.test(d.text || "") && (!d.act || ["surprised", "shocked", "concerned", "nod"].includes(d.act))) m = "worried";   // "*gasps* Are you okay?"
    else if (d && d.act && (MOOD_NAMES.has(d.act) || d.act === "tickled" || d.act === "laugh") && !(hurt && ["happy", "love", "shy", "proud", "excited", "superexcited"].includes(d.act))) m = d.act;   // what the reply acted out (*giggles*)
    else if (!hurt && d && positiveReply(d.text || "")) m = "happy";
    else if (d && d.proposals) m = "nod";
    // finish reading and reacting to your message first (say, sad after "I hate you"), then answer
    const steps = this.cur && this.cur !== "typing" ? [[this.cur, Math.max(300, this.curEnd - performance.now())]] : [];
    steps.push(...this.queue);
    if (m === "worried") steps.push(["concerned", 5200]);   // stays with you while you read it
    else steps.push([m]);
    if (m === "nod") steps.push(["present", 1200]);
    this.run(steps);
  }
  wear(name, animate) {   // "" = no costume
    const c = ["christmas", "easter"].includes(name) ? name : "";
    if (!animate) { this.costume = this.wearNext = c; return; }
    if (c === (this.wearNext ?? this.costume)) return;
    this.wearNext = c;
    if (this.cur || this.queue.length) this.queue.push(["@wear", c]);   // after reading your message
    else this.run([["@wear", c]]);
  }
  /* v1.34: sulking until an apology, and forgiving */
  sulk(on, animate) {
    on = !!on;
    if (on === !!this.sulking) return;
    this.sulking = on; this.forgiving = false;
    if (on) {
      this.inBed = false; this.bedAt = 0; this.wantsBed = false;
      if (this.gf && !this.gf.leaving) { this.gf.leaving = true; this.gf.leaveAt = performance.now(); }
      if (animate !== false) { this.pending = null; this.run([["angry", 1600]]); this.huff(); }
      else { this.cur = null; this.mood = "angry"; this.setFace("angry"); }
    } else if (animate === false) { this.cur = null; this.next(); }
  }
  forgive() {
    if (!this.sulking) return;
    this.sulking = false; this.forgiving = true;   // the next message (the apology) plays it
  }
  huff() { for (const sd of [-1, 1]) this.spawn("huff", 900, sd); }
  /* v1.34: Mimi hops in beside Mochi, waves, hearts float between them; she stays a while and hops off again */
  showGF(role = "showoff", ms = 14000, { call = true } = {}) {
    const now = performance.now(), stay = Math.max(ms, FRIEND_STAY);   // (Nov 3: "mimi seems to go away after a few seconds")
    if (this.gf && this.gf.asked) return;   // on her way out because you asked: nothing keeps her
    if (this.gf && !this.gf.leaving) { this.gf.until = Math.max(this.gf.until, now + Math.min(stay, 60000)); this.gf.bye = 0; if (role !== "showoff") { this.gf.role = role; this.gf.roleAt = now; } return; }
    let wait = call ? this.callFor("mimi") : 0;
    if (wait && this.r() < 0.45 && this.peekFriend("mimi", { at: wait, come: true })) wait += 2550;
    const out = this.offstage(1);
    this.gf = { t0: now + wait, until: now + wait + stay, leaving: false, leaveAt: 0, blinkAt: now + 2500, lookAt: now + 3200, role, roleAt: now, bye: 0, called: !!wait,
      out, inMs: Math.max(1500, Math.min(3400, (Math.abs(out - 0.64) / 1.25) * 1000)) };   // a walk (a quick one when it's far)
  }
  // Mimi or Cocoa joins in. Roles: hello, showoff (Mimi: hearts), cheer (jumps, hooves up), dance (bops along),
  // comfort (gentle, close, a soft tilt), giggle (a hoof to the mouth, shaking), huddle (snuggles close), play (Cocoa: hops about),
  // ready (Cocoa: on his toes for a throwing game)
  friend(who, role = "hello", ms = 12000, { call = true } = {}) {   // call: false when they come by themselves (sneaking up on him)
    if (this.sulking || this.inBed) return false;
    if (who === "mimi") { this.showGF(role, ms, { call }); return true; }
    if (who !== "cocoa") return false;
    const now = performance.now(), stay = Math.max(ms, FRIEND_STAY);
    if (this.bud && this.bud.asked) return false;   // on his way out because you asked
    if (this.bud && !this.bud.leaving) { this.bud.until = Math.max(this.bud.until, now + Math.min(stay, 60000)); this.bud.bye = 0; this.bud.role = role; this.bud.roleAt = now; return true; }
    let wait = call ? this.callFor("cocoa") : 0;
    if (wait && this.r() < 0.45 && this.peekFriend("cocoa", { at: wait, come: true })) wait += 2550;   // a peek round the edge first, sometimes
    const out = this.offstage(-1);
    this.bud = { t0: now + wait, until: now + wait + stay, leaving: false, leaveAt: 0, blinkAt: now + 2000, role, roleAt: now, bye: 0, called: !!wait,
      out, inMs: Math.max(650, Math.min(2400, (Math.abs(-1.12 - out) / 2.6) * 1000)) };   // a run, however far
    return true;
  }
  /** where a friend comes in from and goes off to: past the edge of what's on screen (Nov 4: on a wide window they
   * started mid-screen and "just appeared"), stage units, actor space */
  offstage(side) {
    const V = this.view, ax = this.actor ? this.actor.position.x : 0;
    const edge = V ? V.x + side * V.half - ax : side * 2.3;
    return side < 0 ? Math.min(-2.8, edge - 0.9) : Math.max(2.3, edge + 0.9);
  }
  /** A friend who hears their name now and then pokes their head in from the edge of the screen first (Nov 4,
   * Binoy: "it would be cute to have cocoa or mimi poke out from the edge of the screen sometimes when they hear their
   * name before they come to mochi"): leaning in round the edge, a curious tilt, "Hm? Did someone say Cocoa?", then
   * gone again. come: they were called, and come running once they've looked (friend() times it). */
  peekFriend(who, { at = 0, come = false, line = null, ms = 2300 } = {}) {
    if (who !== "mimi" && who !== "cocoa") return false;
    const F = who === "mimi" ? this.gf : this.bud, now = performance.now();
    if (!come && F && !F.leaving) return false;   // here already
    if (this.sulking || this.inBed || (this.peeking && now < this.peeking.until)) return false;
    if (come && now - (this.peekLast || -1e9) < 40000) return false;   // called again soon after: they just come (a peek is a now-and-then thing)
    this.peekLast = now;
    const L = who === "cocoa" ? (come ? ["Hm? Did someone call me?", "Was that my name, dude?"] : ["Hm? Did someone say Cocoa?", "Was that my name, dude?", "Cocoa here! …what's up?"])
      : (come ? ["Hm? Was that my name? ♡", "Did someone call me? ♡"] : ["Hm? Did someone say Mimi? ♡", "Was that my name? ♡", "Mimi is listening~ ♡"]);
    this.peekN = (this.peekN || 0) + 1;
    const t0 = now + at;
    this.peeking = { who, t0, until: t0 + ms, line: line || L[this.peekN % L.length], said: false, come, spot: this.peekSpot(who) };
    return true;
  }
  /** Where on the edge they peek in: their head just in past the edge of the screen at the height they stand, or, if
   * the page has something in front of that bit (the stage's buttons down the left), lower down the same edge where
   * nothing is, so you see a head come round the side of the screen and not a friend half hidden behind the buttons.
   * Checked on the screen: what's in front of the stage there (the canvas lets presses through, so for a moment it
   * doesn't), and what's under it (a big empty container, not a chat bubble). d: how far in the head comes; drop: how
   * far down from the floor. */
  peekSpot(who) {
    const V = this.view, cv = this.canvas || (this.renderer && this.renderer.domElement), fallback = { d: 0.45, drop: 0 };
    if (!V || !cv || typeof document === "undefined" || !document.elementFromPoint || !cv.getBoundingClientRect || !cv.style) return fallback;
    const side = who === "mimi" ? 1 : -1, edge = V.x + side * V.half, vw = innerWidth, vh = innerHeight, big = vw * vh * 0.3;
    const r = cv.getBoundingClientRect(), p = new THREE.Vector3(), was = cv.style.pointerEvents;
    this.camera.updateMatrixWorld();
    const clear = (x, y, front = false) => {
      p.set(x, y, 0).project(this.camera);
      const sx = r.left + ((p.x + 1) / 2) * r.width, sy = r.top + ((1 - p.y) / 2) * r.height;
      if (sx < 2 || sy < 2 || sx > vw - 2 || sy > vh - 2) return false;
      cv.style.pointerEvents = "auto"; const top = document.elementFromPoint(sx, sy); cv.style.pointerEvents = was;
      if (top && top !== cv) return false;                      // something in front of him there: a button, a card
      if (front) return true;
      const under = document.elementFromPoint(sx, sy);
      if (!under || under.contains(cv)) return true;
      const b = under.getBoundingClientRect(); return b.width * b.height > big;   // under him: the page, not a bubble
    };
    // what they say goes beside the head, toward the room and up a little: no buttons there either (it ended up
    // half under "Feedback")
    const roomToSay = (hx, hy) => [0.7, 1.4, 2.1].every((k) => clear(hx - side * k, hy + 0.45, true) && clear(hx - side * k, hy + 0.8, true));
    for (let drop = 0; drop <= 3.61; drop += 0.3) for (const d of [0.45, 0.62, 0.8]) {
      const hx = edge - side * d, hy = 1.2 - drop;   // the middle of their head, leaning in
      if (clear(hx, hy) && clear(hx + side * 0.34, hy) && clear(hx, hy + 0.42) && clear(hx - side * 0.36, hy - 0.2) && roomToSay(hx, hy)) return { d, drop };
    }
    return fallback;
  }
  /** the peek itself: their body past the edge of the screen, leaning in round it, head tilted, looking his way */
  peekPose(who, now, t) {
    const P = this.peeking, mimi = who === "mimi", g = mimi ? this.mimi : this.cocoa, ground = mimi ? this.mimiGround : this.cocoaGround;
    const side = mimi ? 1 : -1, u = (now - P.t0) / (P.until - P.t0), k = Math.max(0, Math.min(1, u / 0.14, (1 - u) / 0.12)), e = k * k * (3 - 2 * k);
    const V = this.view, ax = this.actor ? this.actor.position.x : 0, edge = V ? V.x + side * V.half - ax : side * 2.6;
    g.visible = true; ground.visible = false;
    // their feet just past the edge, the lean bringing their head in round it (rolled about the room's own front-to-
    // back line, after turning to face in, so the lean goes sideways and not off into the room)
    const S = P.spot || { d: 0.45, drop: 0 }, sc = mimi ? MIMI_SCALE : COCOA_SCALE, lean = 0.45, reach = Math.sin(lean) * 1.3 * sc;
    g.position.set(lerp(edge + side * 1.6, edge + side * (reach - S.d), e), -S.drop, mimi ? 0.05 : 0.08);
    g.scale.setScalar(sc);
    g.rotation.order = "ZYX";
    g.rotation.set(0, -side * 0.75, side * lean * e);
    const body = mimi ? this.mimiBody : this.cocoaBody, neck = mimi ? this.mimiNeck : this.cocoaNeck, arms = mimi ? this.mimiArms : this.cocoaArms, eyes = mimi ? this.mimiEyes : this.cocoaEyes;
    body.rotation.set(0, 0, 0);
    neck.rotation.set(0, -side * 0.25, side * (0.22 + 0.08 * Math.sin(t * 3)) * e);   // a curious tilt
    arms.forEach((a) => { const sd = a.userData.side, inner = sd === -side; a.rotation.set(inner ? -1.25 : -0.5, 0, inner ? sd * 0.5 : sd * 0.2); });   // a hoof on the edge
    const bl = u > 0.5 && u < 0.56 ? Math.abs(Math.cos(((u - 0.5) / 0.06) * Math.PI)) : 1;   // one blink
    eyes.forEach((ey) => { ey.ball.scale.y = Math.max(0.003, (mimi ? 0.104 : 0.098) * bl); });
    if (!P.said && u > 0.22) { P.said = true; if (this.scuffle) this.scuffle.friendSay(who, P.line, 1500); }
    // ducking back out: what they said goes with them (it was left floating by the edge, sliding under the buttons)
    if (P.said && !P.hushed && u > 0.84) { P.hushed = true; const B = this.scuffle && this.scuffle.bubbles && this.scuffle.bubbles[who]; if (B) B.until = Math.min(B.until, now); }
  }
  /** Mochi calls a friend over before they come (Nov 4: "something more realistic would be for mochi to call for
   * cocoa"): a hoof to his mouth, a look their way, "Cocoaaa!"; they answer from off-screen and come running */
  callFor(who) {
    if (this.sulking || this.inBed || this.held) return 0;
    const now = performance.now();
    this.calling = { who, t0: now, until: now + 1150 };
    this.say(who === "cocoa" ? "Cocoaaa!" : "Mimiii!");
    return 850;   // they set off when they hear him
  }
  /** Where a friend has walked to, away from their spot (F.fx: a target set by a water fight, a stroll or you):
   * walked there at a pace, their legs stepping (friendWalk sees them move). Now and then, with nothing going on, they
   * wander a few steps about on their own and come back. */
  strollStep(who, F, now, dt, still, speed) {
    const busy = still || F.leaving || F.held || F.inCar || (this.scuffle && (this.scuffle.busy() || this.scuffle.wf)) || (this.friendMoves && this.friendMoves.busy && this.friendMoves.busy()) || (this.party && now < this.party.until) || (this.dance && this.dance.on);
    const S = F.stroll;
    if (S && S.asked && still && !F.leaving && !F.held) { /* asked before they got here: once they have */ }
    else if (S && S.legs.length && !(busy && !S.asked) && !(this.scuffle && this.scuffle.wf)) {
      const L = S.legs[0];
      if (!L.t) L.t = now;
      F.fx = L.x;
      if (Math.abs((F.fxo || 0) - L.x) < 0.02 && now - L.t > L.stay) { S.legs.shift(); if (S.legs[0]) S.legs[0].t = 0; }
      if (!S.legs.length) { F.stroll = null; F.fx = 0; F.strollAt = now + 9000 + this.r() * 9000; }
    } else if (S && busy) { F.stroll = null; F.fx = this.scuffle && this.scuffle.wf ? F.fx : 0; }
    else if (!busy && !F.asked && (F.role === "hello" || F.role === "showoff" || F.role === "play") && now > (F.strollAt || (F.strollAt = now + 6000 + this.r() * 6000))) {
      const side = who === "mimi" ? 1 : -1, far = 0.25 + this.r() * 0.45, back = this.r() < 0.5;   // out a little way (or in toward him), a look about, back
      F.stroll = { legs: [{ x: back ? -side * 0.08 : side * far, stay: 1600 + this.r() * 1800 }, { x: 0, stay: 0 }] };
    }
    const dm = speed * dt, want = F.fx || 0;
    F.fxo = (F.fxo || 0) + Math.max(-dm, Math.min(dm, want - (F.fxo || 0)));
    if (Math.abs(F.fxo) < 1e-4 && !want) F.fxo = 0;
    return F.fxo;
  }
  /** "Mimi, walk around": a proper little walk about the floor, there and back again */
  friendStroll(who) {
    const F = who === "mimi" ? this.gf : who === "cocoa" ? this.bud : null;
    if (!F || F.leaving) return false;
    const side = who === "mimi" ? 1 : -1;
    F.stroll = { asked: true, legs: [{ x: side * 0.85, stay: 1200 }, { x: -side * 0.05, stay: 1000 }, { x: side * 0.45, stay: 900 }, { x: 0, stay: 0 }] };
    F.until = Math.max(F.until, performance.now() + 15000);
    if (this.scuffle) this.scuffle.friendSay(who, who === "mimi" ? "La la la~ ♡" : "Just stretching my legs, dude!", 1800);
    return true;
  }
  /** they've got here (done running or walking in) */
  friendArrived(who) {
    const F = who === "mimi" ? this.gf : who === "cocoa" ? this.bud : null;
    return !!(F && !F.leaving && performance.now() - F.t0 > (F.inMs || 0));
  }
  stayFriend(who, ms = 30000) {   // a while longer, without changing what they're doing
    const F = who === "mimi" ? this.gf : who === "cocoa" ? this.bud : null;
    if (!F || F.leaving || F.asked) return false;
    F.until = Math.max(F.until, performance.now() + ms); F.bye = 0;
    return true;
  }
  /** time's up for a friend: not in the middle of something; otherwise they say goodbye, and a moment later go */
  /** "let Mimi go", "just you and me": they say goodbye now and leave (even mid-game) */
  dismissFriend(who, { quiet = false } = {}) {   // quiet: no goodbye (hide and seek: Cocoa sneaks off to hide)
    const F = who === "mimi" ? this.gf : who === "cocoa" ? this.bud : null;
    if (!F || F.leaving) return false;
    F.asked = true; F.until = 0; F.held = null; F.quiet = !!quiet;
    if (this.dance && this.dance.on) this.dance.stop();
    return true;
  }
  friendGoing(who, F, now) {
    if (this.craft && this.craft.rider && this.craft.rider.passenger() === who) this.craft.rider.unboard();   // out of the car first
    const busy = (this.friendMoves && this.friendMoves.busy && this.friendMoves.busy()) || (this.scuffle && this.scuffle.busy && this.scuffle.busy()) || (this.party && now < this.party.until);
    if (busy && !this.sulking && !F.asked) { F.until = now + 4000; return; }
    if (!F.bye && F.quiet) { F.bye = now; F.until = now + 150; return; }
    if (!F.bye) {
      F.bye = now; F.until = now + 1900;
      const zd = this.zd && this.zd.on, bed = this.inBed || this.mood === "sleep";
      const L = who === "mimi"
        ? (bed ? ["Sleep tight, Mochi ♡", "Night night ♡"] : zd ? ["Logging off ♡ Bye bye!", "Gotta jet ♡ Stay cool!"] : ["I'll let you two chat. Bye bye ♡", "I have to go now! See you later ♡", "Bye, Mochi! Bye bye!"])
        : (bed ? ["Night, buddy! Sleep well!", "Shh… night night, dude."] : zd ? ["Peace out, hackers!", "Cocoa, signing off. Later!"] : ["Gotta bounce, dude. Later!", "Alright, I'm out! Catch you later!", "Snack break! See ya!"]);
      this.byeN = ((this.byeN ?? -1) + 1) % 3;
      const line = L[this.byeN % L.length];
      if (this.scuffle) this.scuffle.say(who, line);
      F.role = "hello"; F.roleAt = now;   // a little wave
      if (typeof document !== "undefined") document.dispatchEvent(new CustomEvent("mochi:friend-bye", { detail: { who, text: line } }));
      return;
    }
    F.leaving = true; F.leaveAt = now;
    // off past the edge of the screen, at their own pace (a walk for her, a run for him)
    const mimi = who === "mimi"; F.out = this.offstage(mimi ? 1 : -1);
    const d = Math.abs(F.out - (mimi ? 0.64 : -1.12));
    F.outMs = mimi ? Math.max(1600, Math.min(3800, 400 + (d / 1.25) * 1000)) : Math.max(900, Math.min(2700, 270 + (d / 2.6) * 1000));
  }
  friendsHere() { return { mimi: this.gf ? (this.gf.leaving ? "leaving" : this.gf.role || "showoff") : null, cocoa: this.bud ? (this.bud.leaving ? "leaving" : this.bud.role) : null }; }
  logged() { this.touch(); this.run([["happy", 1800]]); }
  reset() { this.touch(); this.sulking = false; this.forgiving = false; this.run([["hello", 1800]]); }
  note(e) { this.events = this.events || []; if (!this.events.includes(e)) this.events.push(e); }   // told to the assistant with the next message
  tap() {
    if (this.sulking) { this.touch(); this.run([["angry", 1200]]); this.huff(); return; }   // hmph
    const woke = this.touch();
    if (woke) this.wokeNote(); else this.note("cuddled");
    if (woke) { this.run([["surprised", 900], ["hello", 1400]]); this.hs.returned("tap"); return; }
    const picks = ["love", "happy", "love", "surprised"];
    this.taps = ((this.taps || 0) + 1) % picks.length;
    this.run([[picks[this.taps], 1600]]);
  }
  /** where a tap lands on him: "nose", { ear: -1 | 1 }, { side: -1 | 1 } (his left or right side), or null */
  touchZone(x, y) {
    if (this.inBed || this.held || !this.nose) return null;
    const C = this.craft; C.rayAt(x, y);
    for (const ear of this.ears) if (C.ray.intersectObject(ear, true).length) return { ear: ear.userData.side };
    const r = this.canvas.getBoundingClientRect(), p = this.nose.getWorldPosition(new THREE.Vector3()).project(this.camera);
    const nx = r.left + ((p.x + 1) / 2) * r.width, ny = r.top + ((1 - p.y) / 2) * r.height, size = this.host.getBoundingClientRect().width || 120;
    if (Math.hypot(x - nx, y - ny) < size * 0.085) return "nose";
    const h = C.ray.intersectObject(this.tummy, false)[0];
    if (h) { const l = this.body.worldToLocal(h.point.clone()); if (Math.abs(l.x) > 0.36 && l.y > 0.2 && l.y < 0.95) return { side: Math.sign(l.x) }; }
    return null;
  }
  touchFirst() {   // what every touch does first: cross, a hmph; asleep, he wakes. True when that was all.
    if (this.sulking) { this.touch(); this.run([["angry", 1200]]); this.huff(); return true; }
    if (this.touch()) { this.wokeNote(); this.run([["surprised", 900], ["hello", 1400]]); return true; }
    return false;
  }
  /** a poke in the side: he jumps away from your finger; a few in a row and he protests, then pokes you back */
  poke(side) {
    if (this.touchFirst()) return;
    const now = performance.now();
    this.pokes = now - (this.pokeAt || 0) < 5000 ? (this.pokes || 0) + 1 : 1; this.pokeAt = now;
    this.pokeJolt = { t0: now, dir: -side };
    this.note("poked");
    const n = this.pokes;
    const [lines, face, ms] = n === 1 ? [["Hey!", "Eep!", "Whoa!"], "surprised", 900]
      : n === 2 ? [["Hehe, stop it!", "Hey, that tickles!", "Hehe, quit it!"], "laugh", 1000]
      : n === 3 ? [["Ahh, stop it!", "Ahh, not my sides!", "Stooop, hehe!"], "laugh", 1100]
      : n === 4 ? [["Okay, okay, no more poking!", "Hmph! This is a poke-free zone!"], "oops", 1300]
      : [["Poke! Gotcha back! Hehe!", "Poke! Now we're even!"], "showoff", 1600];
    this.run(n >= 5 ? [["present", 600], [face, ms]] : [[face, ms]]);
    if (n >= 5) { this.pokes = 0; this.spawn("star", 900); }
    this.say(lines[Math.floor(this.r() * lines.length)]);
    if (navigator.vibrate) { try { navigator.vibrate(10); } catch (_) { /* not allowed */ } }
  }
  /** a tap on the nose: it squishes, he blinks and giggles */
  boop() {
    if (this.touchFirst()) return;
    this.boopAt = performance.now(); this.note("booped");
    this.run([["surprised", 450], ["laugh", 1100]]);
    const lines = ["Boop! Hehe!", "Hey, my nose!", "Beep boop!", "Hehe, you booped me!"];
    this.boopN = ((this.boopN ?? -1) + 1) % lines.length;
    this.say(lines[this.boopN]);
  }
  /** a tap on an ear: it flicks right up and wiggles */
  earFlick(side) {
    if (this.touchFirst()) return;
    const i = this.ears.findIndex((e) => e.userData.side === side);
    if (i >= 0 && this.twitch) this.twitch[i] = 2.4;
    this.note("ear_flicked");
    this.run([["surprised", 500], ["happy", 1100]]);
    const lines = ["Hey, my ear!", "Hehe, my ears are ticklish!", "Eep! That's my ear!"];
    this.earN = ((this.earN ?? -1) + 1) % lines.length;
    this.say(lines[this.earN]);
  }
  /* ---------- touch: a tap is a cuddle; rubbing the tummy back and forth tickles */
  /** a client point → where it lands on the plane he stands in (world units), or null if the ray misses */
  stagePoint(x, y) {
    const r = this.canvas.getBoundingClientRect(), nd = new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(nd, this.camera);
    const k = (0 - ray.ray.origin.z) / ray.ray.direction.z;
    return k > 0 ? ray.ray.origin.clone().addScaledVector(ray.ray.direction, k) : null;
  }
  touchInput() {
    const c = this.canvas, ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), local = new THREE.Vector3();
    const hit = this.host.querySelector(".mochi-hit") || c;   // touches land on Mochi's box; the drawing is bigger than it
    let down = null;
    const rub = { last: null, dir: 0, flips: 0, path: 0, t0: 0 };
    const pat = { last: null, path: 0, t0: 0, dir: 0 };
    this.headAt = (x, y) => {   // where on the head a finger is (head coordinates), or null
      const r = c.getBoundingClientRect();
      ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, this.camera);
      const hit = ray.intersectObject(this.headHit, false)[0];
      return hit ? this.head.worldToLocal(local.copy(hit.point)).clone() : null;
    };
    const onHead = (e) => { const h = this.headAt(e.clientX, e.clientY); return !!h && (h.y > 0.06 || this.inBed); };   // top of the head and forehead (lying in bed: anywhere on the head)
    const stroke = (e) => {   // a finger moving across the head, pressed: a pat about every 26 px of stroking
      const now = performance.now();
      if (!onHead(e)) { pat.last = null; return; }
      if (!pat.last || now - pat.t0 > 1400) { pat.t0 = now; pat.path = 0; }
      else {
        const dx = e.clientX - pat.last.x, dy = e.clientY - pat.last.y;
        pat.path += Math.hypot(dx, dy);
        if (Math.abs(dx) > 1) pat.dir = Math.sign(dx);
      }
      pat.last = { x: e.clientX, y: e.clientY };
      const size = this.host.getBoundingClientRect().width / 120;
      if (pat.path > 26 * size) { pat.t0 = now; pat.path = 0; this.patted(pat.dir || 1); }
    };
    const onTummy = (e) => {
      const r = c.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, this.camera);
      const hit = ray.intersectObject(this.tummy, false)[0];
      if (!hit) return false;
      this.body.worldToLocal(local.copy(hit.point));
      return local.y > 0.15 && local.y < 1.0 && local.z > 0.05;     // the front of the body, below the head
    };
    const track = (e) => {
      const now = performance.now();
      if (!onTummy(e)) { rub.last = null; return; }
      if (!rub.last || now - rub.t0 > 1500) { rub.t0 = now; rub.flips = 0; rub.path = 0; rub.dir = 0; rub.seg = 0; }   // a quick rub, not a slow wander
      else {
        const dx = e.clientX - rub.last.x, dy = e.clientY - rub.last.y, d = Math.hypot(dx, dy);
        const dir = Math.sign(Math.abs(dx) >= Math.abs(dy) ? dx : dy);   // back and forth, sideways or up and down
        rub.path += d;
        rub.seg = (rub.seg || 0) + d;
        // a flip counts only after a real stroke the other way (a jittery hand flips direction all the time)
        if (d > 1.5 && dir) { if (rub.dir && dir !== rub.dir) { if (rub.seg > (down || (e.buttons & 1) ? 9 : 20) * (this.host.getBoundingClientRect().width / 120)) rub.flips++; rub.seg = 0; } rub.dir = dir; }
      }
      rub.last = { x: e.clientX, y: e.clientY };
      const size = this.host.getBoundingClientRect().width / 120;
      // pressed, a quick back-and-forth tickles; a mouse that only hovers has to really rub (four strokes, and long
      // ones): just moving past or resting near his tummy is not a tickle (M5, Nov 2)
      const pressed = !!down || (e.buttons & 1) === 1;
      if (pressed ? rub.flips >= 2 && rub.path > 40 * size : rub.flips >= 4 && rub.path > 130 * size) { rub.t0 = now; rub.flips = 0; rub.path = 0; this.tickle(); }
    };
    let last = null;
    hit.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (down && down.id !== e.pointerId) return;   // a second finger while the first is down: one press at a time (it used to leave him stuck "held")
      try { hit.setPointerCapture(e.pointerId); } catch (_) { /* old browsers */ }
      if (this.craft.posing) { this.craft.poseDown(e); return; }   // teaching a move: drags pose him
      if (this.hs.capturing()) { this.hs.down(e); down = null; return; }   // the handshake: taps and swipes are steps
      if (window.VOICE && window.VOICE.pending && window.VOICE.pending()) { down = null; document.dispatchEvent(new CustomEvent("mochi:touch", { detail: { x: e.clientX, y: e.clientY } })); return; }   // "look at this" + a tap on him: the tap is the target
      // pressed on what he holds or wears: pull it and it comes away (you're moving it); press and hold, and the page
      // opens its little panel to turn it (Nov 3). Anywhere else on him, press and hold picks him up as before.
      const ph = this.inBed ? false : this.craft.propHit(e.clientX, e.clientY), onProp = ph ? (ph === "worn" ? "worn" : "hand") : null;
      // his box is bigger than he is: a press in it on a prop standing on the floor or on his bookcase (not on him) is
      // the page's to pull or tap (Nov 3: props under his box couldn't be picked up)
      if (!onProp && !this.inBed && !this.onSelf(e.clientX, e.clientY)) {
        const fl = this.floor.pick(e.clientX, e.clientY), sh = !fl && this.shelf.pick ? this.shelf.pick(e.clientX, e.clientY) : null;
        if (fl || sh) { down = null; document.dispatchEvent(new CustomEvent("mochi:stage-press", { detail: { x: e.clientX, y: e.clientY, pointerId: e.pointerId, kind: fl ? "floor" : "shelf", item: fl || sh } })); return; }
        // Cocoa or Mimi standing in his box: the page's too (a tap aims at them or gets a giggle; a pull moves them)
        const fr = this.friendAt(e.clientX, e.clientY);
        if (fr) { down = null; document.dispatchEvent(new CustomEvent("mochi:stage-press", { detail: { x: e.clientX, y: e.clientY, pointerId: e.pointerId, kind: "friend", who: fr } })); return; }
      }
      down = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: 0, tickled: false, drag: false, onProp, pull: false, menu: false, head: onHead(e) };
      last = { x: e.clientX, y: e.clientY };
      rub.last = null; pat.last = null; if (!onProp) { track(e); stroke(e); }
      clearTimeout(this.holdT);   // press and hold without moving: pick Mochi up (or, on his prop, the panel)
      const d = down;
      this.holdT = setTimeout(() => {
        if (down !== d || d.moved >= 9) return;
        if (d.onProp) { d.menu = true; document.dispatchEvent(new CustomEvent("mochi:prop-menu", { detail: { x: last.x, y: last.y, which: d.onProp } })); return; }
        d.drag = true; this.pickUp(last.x, last.y);
      }, HOLD_MS);
    });
    hit.addEventListener("pointermove", (e) => {
      if (this.craft.posing) { this.craft.poseMove(e); return; }
      if (this.hs.gest) { this.hs.move(e); return; }
      if (down && e.pointerId !== down.id) return;
      if (!down && document.body.classList.contains("pulling")) return;   // the page is pulling a prop across him
      last = { x: e.clientX, y: e.clientY };
      if (down && down.drag) { this.dragTo(e.clientX, e.clientY); return; }
      if (down && down.pull) { this.floor.move(e.clientX, e.clientY); return; }
      if (down && down.onProp && !down.menu && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10 && !this.craft.perf) {   // pulling his prop away
        clearTimeout(this.holdT);
        if (this.floor.begin(null, e.clientX, e.clientY, { held: down.onProp })) { down.pull = true; document.body.classList.add("pulling"); return; }
        down.onProp = false;
      }
      if (down) down.moved = Math.max(down.moved, Math.hypot(e.clientX - down.x, e.clientY - down.y));
      if (down && down.moved >= 9) clearTimeout(this.holdT);
      if (down || e.pointerType === "mouse") track(e);               // a mouse can rub without pressing
      if (down) stroke(e);
    });
    hit.addEventListener("pointerup", (e) => {
      if (this.craft.posing) { this.craft.poseUp(e); down = null; return; }
      if (this.hs.gest) { this.hs.up(e); down = null; return; }
      if (down && e.pointerId !== down.id) return;   // the other finger
      clearTimeout(this.holdT);
      if (down && down.pull) { this.floor.end(e.clientX, e.clientY); document.body.classList.remove("pulling"); down = null; rub.last = null; pat.last = null; return; }
      if (down && down.menu) { down = null; return; }   // the long press opened the panel; letting go does nothing more
      // (not a stroke that started on his head: that's a pat, and a long one down his forehead shouldn't sit him down)
      const swipe = down && !down.drag && !down.onProp && !down.head && performance.now() - down.t < 600 ? { dx: e.clientX - down.x, dy: e.clientY - down.y } : null;
      const size = this.host.getBoundingClientRect().height || 160;
      if (swipe && Math.abs(swipe.dy) > 0.22 * size && Math.abs(swipe.dy) > 1.6 * Math.abs(swipe.dx) && this.craft.stance && this.cur !== "tickled" && this.cur !== "patted") {
        // a quick swipe up on him: he stands up; down: he sits (Nov 2: "get mochi to stand up by touch")
        const S = this.craft.stance;
        if (swipe.dy < 0) { if (!S.standing() && S.stand()) this.note("stood_up_by_touch"); }
        else if (S.standing()) { S.sit(); this.note("sat_down_by_touch"); }
        document.dispatchEvent(new CustomEvent("mochi:stance-touch", { detail: { standing: S.standing() } }));
      }
      else if (down && down.drag) this.drop();
      else if (down && down.moved < 10 && performance.now() - down.t < 500 && this.cur !== "tickled") {
        // a tap on his prop uses it; on Cocoa or Mimi (they stand half inside his box) or the air beside him with a
        // launcher out, it's where to aim (M5, Nov 2: tapping Cocoa got Mochi's cuddle instead); on the hoof your
        // handshake starts with, starts it; anything else on him is a cuddle
        const x = e.clientX, y = e.clientY;
        const ph = this.craft.propHit(x, y);
        if (ph === "worn") { /* a tap on his hat: it wiggles (propHit set that) */ }
        else if (ph) this.craft.useProp();
        else if (!this.onSelf(x, y) && (this.craft.canAim() || this.friendAt(x, y))) { if (this.craft.canAim()) this.craft.pointAt(x, y); else this.pokeFriend(this.friendAt(x, y)); }
        else if (!(this.hs.steps && this.hs.tapStart(this.hs.where(x, y)))) {
          // where on him (Nov 7, Binoy: "poking him from the sides and he might react like 'ahh stop it'"): his sides,
          // his nose, an ear; anywhere else is a cuddle
          const z = this.touchZone(x, y);
          if (z === "nose") this.boop(); else if (z && z.ear) this.earFlick(z.ear); else if (z && z.side) this.poke(z.side); else this.tap();
        }
      }
      down = null; rub.last = null; pat.last = null;
    });
    hit.addEventListener("pointercancel", (e) => { if (down && e.pointerId !== down.id) return; if (down && down.pull) { this.floor.cancel(); document.body.classList.remove("pulling"); } this.hs.gest = null; if (this.craft.posing) { this.craft.poseUp(e); down = null; return; } clearTimeout(this.holdT); if (down && down.drag) this.drop(); down = null; rub.last = null; pat.last = null; });
    hit.addEventListener("pointerleave", () => { if (!down) rub.last = null; });
    hit.addEventListener("contextmenu", (e) => {   // a long press picks Mochi up, no menu; a right-click on his prop opens the page's panel
      e.preventDefault();
      const ph = e.button === 2 ? this.craft.propHit(e.clientX, e.clientY) : false;
      if (ph) document.dispatchEvent(new CustomEvent("mochi:prop-menu", { detail: { x: e.clientX, y: e.clientY, which: ph === "worn" ? "worn" : "hand" } }));
    });
  }
  onSelf(x, y) {   // is this point on Mochi himself (not the margin of his box, a friend in it, or his furniture)?
    const C = this.craft; C.rayAt(x, y);
    const hits = C.ray.intersectObject(this.root, true);
    for (const h of hits) {
      let o = h.object, mine = true;
      while (o && o !== this.root) { if (o === this.cocoa || o === this.mimi || o === this.furniture || (C.prop && o === C.prop.group)) { mine = false; break; } o = o.parent; }
      if (mine && shown(h.object)) return true;
    }
    return false;
  }
  friendAt(x, y) {   // Cocoa or Mimi under a point (client px), or null
    const S = this.scuffle; if (!S) return null;
    this.craft.rayAt(x, y);
    if (S.cocoaHit()) return "cocoa";
    if (S.mimiHit && S.mimiHit()) return "mimi";
    return null;
  }
  /* Nov 3 ("is it possible for mochi and the props and others to be able to be placed by the user even over the chat
   * window and conversation?"): pick Mimi or Cocoa up and put them down anywhere in the window. They stay right there
   * (not beside him) until they go home; the next visit they come to their usual spot again. */
  friendGrab(who, x, y) {
    const F = who === "mimi" ? this.gf : who === "cocoa" ? this.bud : null, o = who === "mimi" ? this.mimi : this.cocoa;
    if (!F || F.leaving || !o || !o.visible || this.sulking) return false;
    o.updateWorldMatrix(true, false);
    const feet = o.getWorldPosition(new THREE.Vector3()), p = this.floor.atDepth(x, y, feet.z);
    if (!p) return false;
    // the pin is where their feet stand, in the window (world), so moving Mochi afterwards doesn't take them along
    const base = F.pin ? F.pin.y : this.actor.position.y;
    F.held = { dx: p.x - feet.x, dy: p.y - base, z: feet.z, t0: performance.now(), vx: 0, lx: p.x };
    F.pin = { x: feet.x, y: base };
    this.stayFriend(who, 30000);
    const L = who === "mimi" ? ["Eep! Hehe, where are we going?", "Wheee!", "Oh! Hi up here ♡"] : ["Whoa, dude!", "Ha! Air Cocoa!", "Wheee! Where to?"];
    this.grabN = ((this.grabN ?? -1) + 1) % L.length;
    if (this.scuffle) this.scuffle.say(who, L[this.grabN]);
    this.friendDrag(who, x, y);
    return true;
  }
  friendDrag(who, x, y) {
    const F = who === "mimi" ? this.gf : who === "cocoa" ? this.bud : null;
    if (!F || !F.held) return false;
    const p = this.floor.atDepth(x, y, F.held.z); if (!p) return false;
    F.held.vx = F.held.vx * 0.6 + (p.x - F.held.lx) * 0.4; F.held.lx = p.x;
    F.pin = { x: p.x - F.held.dx, y: p.y - F.held.dy };
    return true;
  }
  friendDrop(who) {
    const F = who === "mimi" ? this.gf : who === "cocoa" ? this.bud : null;
    if (!F || !F.held) return false;
    F.held = null; F.landAt = performance.now();
    // let go on top of him: they land just beside him instead of inside him (Nov 4 probe)
    const mx = this.actor.position.x + this.root.position.x;
    if (F.pin && Math.abs(F.pin.y - this.actor.position.y) < 0.6 && Math.abs(F.pin.x - mx) < 1.0) F.pin.x = mx + (F.pin.x >= mx ? 1 : -1) * 1.0;
    this.stayFriend(who, 30000);
    if (this.scuffle && this.r() < 0.7) this.scuffle.say(who, who === "mimi" ? ["Ooh, nice view!", "Here? Okay ♡", "Hehe, I like it here!"][Math.floor(this.r() * 3)] : ["Sweet spot!", "Nice! Front row!", "I'll chill here, dude."][Math.floor(this.r() * 3)]);
    this.note(`moved_${who}`);
    return true;
  }
  /** where a friend stands, as an offset from their usual spot (in his world): pinned somewhere, or 0 */
  friendPin(F) {
    if (!F || !F.pin) return null;
    const A = this.actor.position;
    return { x: F.pin.x - A.x, y: F.pin.y - A.y };
  }
  pokeFriend(who) {   // a tap on a friend with nothing to aim: they giggle and wave back
    if (!who) return;
    const lines = who === "cocoa" ? ["Hey! What's up?", "Hoof bump!", "Hehe, that tickles!"] : ["Hehe, hi!", "Hi there~", "Eep! Hehe."];
    this.pokeN = ((this.pokeN || 0) + 1) % lines.length;
    this.friend(who, who === "cocoa" ? "giggle" : "giggle", 6000);
    if (this.scuffle) this.scuffle.say(who, lines[this.pokeN]);
  }
  tickle() {
    if (this.sulking) { this.touch(); if (this.cur !== "angry") this.run([["angry", 1200]]); return; }
    if (this.touch()) this.wokeNote();
    this.note("tickled");
    if (this.cur === "tickled") this.curEnd = performance.now() + HOLD.tickled;   // keep laughing while you rub
    else this.run([["tickled", HOLD.tickled]]);
    if (performance.now() - (this.saidAt || 0) > 1500) {
      const lines = ["Hehe! That tickles!", "Haha, stop it!", "Hee hee hee!", "Ahaha, no fair!", "Hehehe, my tummy!"];
      this.lineN = ((this.lineN ?? -1) + 1 + Math.floor(this.r() * 2)) % lines.length;
      this.say(lines[this.lineN]);
    }
    if (navigator.vibrate) { try { navigator.vibrate(12); } catch (_) { /* not allowed */ } }
  }
  /* stroking the head: Mochi closes its eyes, leans into your finger and melts a little; asleep, it smiles in its sleep */
  patted(dir) {
    const now = performance.now();
    if (dir) this.patDir = dir;
    if (this.mood === "sleep" || this.mood === "bed") {
      if (now > this.dreamUntil) this.spawn("heart");
      this.dreamUntil = now + 1800; this.note("patted_asleep");
      return;
    }
    if (this.sulking) { this.touch(); return; }   // still cross: pats don't fix it, only "sorry" does
    this.touch(); this.note("patted");
    if (this.cur === "patted") this.curEnd = now + HOLD.patted;
    else this.run([["patted", HOLD.patted]]);
    this.craft.patted();   // right after a move: practice makes it smoother, and he shows you
    if (now - (this.saidAt || 0) > 4000) {
      const lines = ["Mmm, that's nice…", "Hehe, more pats please!", "So cozy~", "Aww, thank you!"];
      this.patLine = ((this.patLine ?? -1) + 1) % lines.length;
      this.say(lines[this.patLine]);
    }
  }
  /* ---------- carrying Mochi around the screen */
  homeRect() {   // where Mochi's corner beside the message box is on screen right now
    const r = this.host.getBoundingClientRect();
    return { left: r.left - this.applied.x, top: r.top - this.applied.y, w: r.width || 122, h: r.height || 164 };
  }
  clampSpot(x, y) {   // keep Mochi on the screen (a little of its empty margin may hang off the edges) and never lower than its corner,
    const hr = this.homeRect(), vw = innerWidth;   // so it's never over the message box or the keyboard
    // data-roam="page" (the stage page, Nov 3: "placed by the user even over the chat window and conversation"): anywhere
    // down to the top of its data-floor element (the message box), so over the conversation too
    let yMax = 0;
    if (this.host.dataset.roam === "page" && typeof document !== "undefined") {
      const fl = this.host.dataset.floor && document.querySelector(this.host.dataset.floor);
      const bottom = fl ? fl.getBoundingClientRect().top : innerHeight;
      yMax = Math.max(0, bottom - (hr.top + hr.h) + hr.h * 0.03);
    }
    return { x: Math.max(-hr.left - hr.w * 0.22, Math.min(vw - hr.left - hr.w * 0.78, x)), y: Math.max(-hr.top - hr.h * 0.08, Math.min(yMax, y)) };
  }
  retarget() {   // where Mochi should be: the spot you chose, as far as the screen (and the keyboard) allow
    const D = this.drag;
    if (this.held || this.zoom) return;
    if (!D.want) { D.tx = 0; D.ty = 0; return; }
    const c = this.clampSpot(D.want.x, D.want.top - this.homeRect().top);
    D.tx = c.x; D.ty = c.y;
  }
  trackHome() {
    // The message box moves (the keyboard opens or closes, the text gets longer) and Mochi's corner moves with it. Mochi stays
    // put on screen unless the keyboard or the message box would cover it; then it moves up just enough, and comes back after.
    const D = this.drag, top = this.homeRect().top;
    if (this.homeTop === undefined) this.homeTop = top;
    const d = top - this.homeTop;
    if (Math.abs(d) < 0.5) return;
    this.homeTop = top;
    if (!D.want && !this.held) return;   // in its corner: it simply goes along
    D.y -= d;                           // this very frame: no jump
    if (this.held && this.grab) { this.grab.sy -= d; D.ty -= d; } else this.retarget();
    this.placeHost();
  }
  /** the camera at his box, wherever it is: moved with it (when the drawing covers the window and stays put) and
   * its lens shifted by as much, so the floor and the furniture stay where they are on screen while he's always seen
   * straight on, his friends too */
  /* The camera stays put (Nov 5, Binoy: "the shelf is still stretching and rotating as I move mochi around the
   * screen"). It used to move with him when he was carried, so he was always seen straight on, but everything else
   * (his bookcase, things on the floor) was then seen from somewhere new each time: it slid and turned. Now the world
   * is seen from one place, and he's kept straight-on another way (anchorFurniture). */
  aimCamera() {
    const L = this.lens; if (!L) return;
    this.camera.position.set(0, 1.64, L.dist); this.camera.lookAt(0, 1.28, 0);
    this.camera.setViewOffset(L.w, L.h, -L.pl * L.w, -L.pt * L.h, L.cw, L.ch);   // (and updates the projection)
  }
  anchorFurniture() {   // his box moved by (applied.x, applied.y) px
    const F = this.furniture, A = this.actor; if (!F || !A) return;
    const ax = this.applied ? this.applied.x : 0, ay = this.applied ? this.applied.y : 0, cover = this.host.dataset.cover === "viewport";
    if (!ax && !ay) {
      if (F.position.x || F.position.y) F.position.set(0, 0, 0);
      if (A.position.x || A.position.y || !A.matrixAutoUpdate) { A.position.set(0, 0, 0); A.matrixAutoUpdate = true; A.updateMatrix(); this.key.position.copy(this.keyBase); this.key.target.position.set(0, 0, 0); this.key.target.updateMatrixWorld(); }
      return;
    }
    const L = this.lens, perPx = L ? (2 * L.half * L.dist) / Math.max(1, L.h) : 0.005;   // world units per screen pixel on his plane
    // the drawing covers the window and stays put: he moves in it, the furniture stays where it is
    if (cover) {
      if (F.position.x || F.position.y) F.position.set(0, 0, 0); A.position.set(ax * perPx, -ay * perPx, 0);
      // he's off to one side of the camera now, so he'd be seen a little from the side (stretched and turned: Nov 4).
      // Leaning everything of his across by how far in front of or behind his spot it is, by just that much, undoes
      // it: he's drawn exactly as a camera right in front of him would see him, and the world stays as it is
      const D = L ? L.dist : 7.6, X = A.position.x, Y = A.position.y;
      A.matrixAutoUpdate = false;
      A.matrix.set(1, 0, -X / D, X, 0, 1, -Y / D, Y, 0, 0, 1, 0, 0, 0, 0, 1);
      A.matrixWorldNeedsUpdate = true;
      // the key light (and its small shadow box) goes with him, so he keeps his shadows wherever you put him
      this.key.position.copy(this.keyBase).add(A.position); this.key.target.position.copy(A.position); this.key.target.updateMatrixWorld();
    }
    else { A.matrixAutoUpdate = true; A.position.set(0, 0, 0); F.position.set(-ax * perPx, ay * perPx, 0); }   // the drawing moves with his box: the furniture goes back
  }
  placeHost() {
    const D = this.drag, x = Math.round(D.x * 10) / 10, y = Math.round(D.y * 10) / 10;
    this.applied = { x, y };
    this.host.style.transform = x || y ? `translate(${x}px, ${y}px)` : "";
    if (this.host.dataset.cover === "viewport") this.canvas.style.transform = x || y ? `translate(${-x}px, ${-y}px)` : "";   // the drawing stays over the window
    const r = this.host.getBoundingClientRect();
    this.host.classList.toggle("on-left", r.left + r.width / 2 < innerWidth * 0.45);   // speech bubbles go on the open side
    this.host.classList.toggle("moved", !!D.want);
  }
  pickUp(x, y) {
    const now = performance.now(), D = this.drag;
    if (this.touch()) this.wokeNote();
    this.held = true; this.grab = { x, y, sx: D.tx, sy: D.ty, t: now }; this.yankArmed = true; this.wild = false;
    this.note("carried");
    this.run([["surprised", 420]]);
    const lines = ["Ooh, where are we going?", "Wheee!", "Up we go!", "Hehe, carry me!", "Oh! Hello up here!"];
    this.say(lines[Math.floor(this.r() * lines.length)]);
    if (navigator.vibrate) { try { navigator.vibrate(15); } catch (_) { /* not allowed */ } }
  }
  dragTo(x, y) {
    const g = this.grab, D = this.drag;
    if (!g) return;
    const c = this.clampSpot(g.sx + x - g.x, g.sy + y - g.y);
    D.tx = c.x; D.ty = c.y;
    // the first real tug: sometimes Mochi digs its hooves in, stretches… and gets yanked along by surprise
    if (this.yankArmed && Math.hypot(x - g.x, y - g.y) > 28) {
      this.yankArmed = false;
      if (D.rides++ === 0 || this.r() < 0.45) this.yank(x - g.x, y - g.y);
    }
  }
  yank(dx, dy) {
    const D = this.drag;
    this.wild = true;
    D.yankAt = this.simT; D.yankDir = Math.sign(dx || 1); D.yankUp = dy < 0 ? 1 : 0;
    this.note("yanked");
    this.cur = null; this.queue = [];
    this.play("yanked", 99999);   // stays until put down (or the hold ends)
    this.shockAt = performance.now();
    this.spawn("bang");
    const lines = ["Whoa!", "Hey!", "Waaah!", "Eep!", "Wait wait wait!"];
    this.say(lines[Math.floor(this.r() * lines.length)]);
    if (navigator.vibrate) { try { navigator.vibrate([10, 40, 25]); } catch (_) { /* not allowed */ } }
  }
  drop() {
    const now = performance.now(), D = this.drag;
    this.held = false; this.grab = null; this.touch();
    D.want = Math.abs(D.tx) + Math.abs(D.ty) > 1 ? { x: Math.round(D.tx), top: Math.round(this.homeRect().top + D.ty) } : null;
    try { if (D.want) localStorage.setItem(SPOT_KEY, JSON.stringify(D.want)); else localStorage.removeItem(SPOT_KEY); } catch (_) { /* no storage */ }
    if (!this.reduce) this.hop(0.06, 240, 0);
    const wild = this.wild; this.wild = false;
    this.cur = null; this.queue = [];
    if (wild) {
      this.run([["dizzy", HOLD.dizzy], ["happy", 1100]]);
      for (let i = 0; i < 3; i++) this.spawn("orbit", 1700, i / 3);
      this.say(["Phew… that was fast!", "Everything's spinning…", "Wheee… whoa…"][Math.floor(this.r() * 3)]);
    } else {
      this.run([["happy", 1300]]);
      if (this.r() < 0.6) this.say(["Nice spot!", "Here? Okay!", "Ooh, a new view!", "Cozy!"][Math.floor(this.r() * 4)]);
    }
  }
  home() {   // back to its corner beside the message box
    const D = this.drag; D.tx = D.ty = 0; D.want = null;
    try { localStorage.removeItem(SPOT_KEY); } catch (_) { /* no storage */ }
  }
  stepDrag(dt) {   // the box follows your finger on a spring; Mochi swings below it like a pendulum (carry.js)
    const D = this.drag;
    const canWalk = !this.zoom && !this.wild && !this.inBed && !this.sulking && !(this.craft && this.craft.rider && this.craft.rider.riding());
    const moving = stepCarry(D, dt, { held: this.held, simT: this.simT, reduce: this.reduce, canWalk });
    if (moving || this.placed !== `${D.x},${D.y}`) { this.placed = `${D.x},${D.y}`; this.placeHost(); }
  }
  say(text) {
    // out loud too (Nov 5, Binoy: things he says "remain as a chat bubble and not vocalized", like "everything is
    // spinning" when he's moved, or laughing when he's tickled): the page's voice hears this and speaks it
    if (text && typeof window !== "undefined" && window.dispatchEvent) try { window.dispatchEvent(new CustomEvent("mochi:say", { detail: { who: "mochi", text: String(text) } })); } catch (_) { /* no voice */ }
    let b = this.host.querySelector(".mochi-say");
    if (!b) { b = document.createElement("div"); b.className = "mochi-say"; b.setAttribute("role", "status"); this.host.appendChild(b); }
    b.textContent = text; this.saidAt = performance.now();
    this.host.classList.add("saying");
    clearTimeout(this.sayTimer);
    this.sayTimer = setTimeout(() => this.host.classList.remove("saying"), 1800);
  }
  hop(h, dur, delay) { this.hops.push({ t0: performance.now() + delay, dur, h }); }
  /* v1.36: zoomies for really good news: five big hops to spots around the screen and back home */
  zoomies(now) {
    if (this.held || this.inBed || this.gf) { this.hop(0.3, 420, 0); this.hop(0.26, 400, 460); return; }
    const D = this.drag, vw = innerWidth, vh = innerHeight, sx = D.tx, sy = D.ty, hr = this.homeRect();
    // spots across the whole screen (wherever its corner is), then home again
    const at = (fx, fy) => this.clampSpot(fx * vw - (hr.left + hr.w / 2), fy * vh - (hr.top + hr.h / 2));
    const pts = [at(0.78, 0.5), at(0.5, 0.22), at(0.2, 0.38), at(0.62, 0.3), { x: sx, y: sy }];
    this.zoom = { t0: now, pts, leg: -1 };
  }
  stepZoom(now) {
    const z = this.zoom;
    if (!z) return;
    const LEG = 620, leg = Math.floor((now - z.t0) / LEG);
    if (leg >= z.pts.length || this.held) { this.zoom = null; this.retarget(); return; }
    if (leg !== z.leg) {
      z.leg = leg;
      this.drag.tx = z.pts[leg].x; this.drag.ty = z.pts[leg].y;
      this.hop(leg === z.pts.length - 1 ? 0.2 : 0.42, LEG * 0.92, 0);
      this.spawn(leg % 2 ? "confetti" : "star", 1400); this.spawn("confetti", 1600);
    }
  }

  /* ---------- particles */
  spawn(kind, life, phase, at = null) {   // at: where (the actor's space), for crumbs from his mouth
    let mesh;
    const neon = this.zd && this.zd.on ? this.zd.fx : null;   // Zero Day: neon hearts, stars and confetti
    if (kind === "heart") mesh = new THREE.Mesh(this.heartGeo, new THREE.MeshPhysicalMaterial({ color: neon ? neon.heart : 0xff6f91, emissive: neon ? 0x5a0a55 : 0x000000, roughness: 0.3, clearcoat: 1, transparent: true }));
    else if (kind === "confetti") { const pal = neon ? neon.confetti : [0xff6f91, 0xffd25e, 0x5ec8ff, 0x7be08a, 0xb48cff]; mesh = new THREE.Mesh(this.confettiGeo, new THREE.MeshBasicMaterial({ color: pal[Math.floor(this.r() * pal.length)], side: THREE.DoubleSide, transparent: true })); }
    else if (kind === "coin") { this.coinGeo = this.coinGeo || new THREE.CylinderGeometry(0.09, 0.09, 0.025, 20); mesh = new THREE.Mesh(this.coinGeo, new THREE.MeshPhysicalMaterial({ color: neon ? 0x9dffc4 : 0xf5c542, emissive: neon ? 0x0c3b22 : 0x6a4a00, metalness: 0.6, roughness: 0.3, clearcoat: 1, transparent: true })); }   // Nov 3: into the piggy bank
    else if (kind === "crumb") { this.crumbGeo = this.crumbGeo || new THREE.SphereGeometry(0.028, 8, 6); mesh = new THREE.Mesh(this.crumbGeo, new THREE.MeshPhysicalMaterial({ color: [0xd9a35b, 0xc48a45, 0xf0c987][Math.floor(this.r() * 3)], roughness: 0.7, transparent: true })); }
    else if (kind === "star" || kind === "orbit") mesh = new THREE.Mesh(this.starGeo, new THREE.MeshPhysicalMaterial({ color: neon ? neon.star : 0xffd25e, emissive: neon ? 0x0a4a60 : 0x6a4a00, roughness: 0.3, clearcoat: 1, transparent: true }));
    else mesh = new THREE.Sprite(new THREE.SpriteMaterial({ map: kind === "bang" ? this.bangTex : kind === "vein" ? this.veinTex : kind === "snow" || kind === "huff" ? this.snowTex : kind === "note" ? this.noteTex : this.zTex, transparent: true, depthWrite: false, depthTest: kind !== "bang" && kind !== "vein" }));
    const r = this.r;
    const side = kind === "huff" && phase ? phase : r() < 0.5 ? -1 : 1, sprite = kind === "z" || kind === "bang" || kind === "snow" || kind === "vein" || kind === "huff" || kind === "note";
    if (kind === "note") mesh.material.color.setHex([0xff6f91, 0x8f86d6, 0x4fb3e8, 0xffa63d, 0x5cc98a][Math.floor(r() * 5)]);
    if (kind === "huff") phase = 0;
    const from = kind === "snow" ? new THREE.Vector3((r() - 0.5) * 2.9, 3.3, -0.3 + r() * 0.9)
      : kind === "bang" ? new THREE.Vector3(0.5, 2.18, 0.9)
      : kind === "z" && this.inBed ? this.head.localToWorld(new THREE.Vector3(0.1, 0.55, 0.2)).add(new THREE.Vector3(0.1, 0.05, 0))   // above the head on the pillow
      : kind === "z" ? new THREE.Vector3(0.42, 1.95, 0.3)
      : kind === "confetti" ? new THREE.Vector3((r() - 0.5) * 1.8, 2.3 + r() * 0.5, 0.2 + r() * 0.4)
      : kind === "coin" ? new THREE.Vector3(1.15 + (r() - 0.5) * 0.25, 1.7 + r() * 0.4, 0.35)   // over the piggy bank beside him
      : new THREE.Vector3(side * (0.35 + r() * 0.35), 1.8 + r() * 0.35, 0.3);
    if (kind === "crumb" && at) from.copy(at).add(new THREE.Vector3((r() - 0.5) * 0.12, (r() - 0.5) * 0.05, 0.02));
    if (kind === "orbit") from.copy(this.head.localToWorld(new THREE.Vector3(0, 0.62, 0.05)));   // a ring of stars over the head
    if (kind === "vein") from.copy(this.head.localToWorld(new THREE.Vector3(-0.42, 0.5, 0.3)));   // the anger mark, up on the head
    if (kind === "huff") from.copy(this.head.localToWorld(new THREE.Vector3(side * 0.42, -0.02, 0.22)));   // steam puffs from the cheeks
    if (kind === "heart" && this.gf) from.set(0.06 + (r() - 0.5) * 0.3, 1.55 + r() * 0.3, 0.45);   // between Mochi and Mimi
    if ((kind === "z" && this.inBed) || kind === "orbit" || kind === "vein" || kind === "huff") { this.actor.updateWorldMatrix(true, false); this.actor.worldToLocal(from); }   // those were found in the world
    const p = { mesh, kind, sprite, phase: phase || 0, t0: performance.now(), life: life || (kind === "z" || kind === "note" ? 2200 : kind === "snow" ? 9000 : kind === "vein" ? 1300 : kind === "huff" ? 900 : kind === "coin" ? 800 : 1500), from,
      vel: kind === "crumb" ? new THREE.Vector3((r() - 0.5) * 0.45, -0.85 - r() * 0.5, 0.12) : kind === "snow" ? new THREE.Vector3(0, -0.36 - r() * 0.1, 0) : kind === "coin" ? new THREE.Vector3(0, -1.5, 0) : kind === "confetti" ? new THREE.Vector3((r() - 0.5) * 0.5, -0.7 - r() * 0.4, 0) : kind === "bang" ? new THREE.Vector3(0.04, 0.12, 0) : kind === "vein" ? new THREE.Vector3(0, 0, 0)
        : kind === "huff" ? new THREE.Vector3(side * 0.42, 0.16, 0.05) : new THREE.Vector3(kind === "z" ? 0.18 : side * (0.05 + r() * 0.12), 0.38 + r() * 0.2, 0.05),
      spin: (r() - 0.5) * 3, side };
    mesh.position.copy(p.from); this.actor.add(mesh); this.parts.push(p);
  }
  stepParts(now) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i], u = (now - p.t0) / p.life;
      if (u >= 1) { p.mesh.removeFromParent(); p.mesh.material.dispose(); this.parts.splice(i, 1); continue; }
      const t = (now - p.t0) / 1000;
      if (p.kind === "orbit") {
        const a = (p.phase + t * 0.9) * Math.PI * 2;
        p.mesh.position.set(p.from.x + Math.cos(a) * 0.5, p.from.y + Math.sin(a) * 0.07, p.from.z + Math.sin(a) * 0.32);
      } else p.mesh.position.set(p.from.x + p.vel.x * t + (p.kind === "z" || p.kind === "note" ? Math.sin(t * 3 + p.spin) * 0.07 : p.kind === "snow" ? Math.sin(t * 1.3 + p.spin * 3) * 0.12 : 0), p.from.y + p.vel.y * t, p.from.z);
      const grow = Math.min(1, u * 6), s = (p.kind === "z" ? 0.16 + u * 0.12 : p.kind === "note" ? 0.24 + u * 0.06 : p.kind === "snow" ? 0.07 + Math.abs(p.spin) * 0.03 : p.kind === "orbit" ? 0.5 : p.kind === "bang" ? 0.58 * (1 + 0.35 * Math.max(0, 1 - u * 5))
        : p.kind === "vein" ? 0.56 * (1 + 0.16 * Math.sin(t * 16)) : p.kind === "huff" ? 0.1 + u * 0.22 : 1) * (0.4 + 0.6 * grow) * (1 - Math.max(0, u - 0.8) * 2);
      p.mesh.scale.setScalar(Math.max(0.001, s));
      if (p.kind === "bang") p.mesh.material.rotation = Math.sin(t * 30) * 0.12 * Math.max(0, 1 - u * 2);   // a quick wobble
      else if (!p.sprite) { p.mesh.rotation.z = Math.sin(t * 4) * 0.3 * p.side; p.mesh.rotation.y = t * p.spin; }
      p.mesh.material.opacity = u > 0.65 ? 1 - (u - 0.65) / 0.35 : 1;
    }
  }

  /* ---------- every frame */
  frame(now) {
    if (!this.host.isConnected) { this.renderer.setAnimationLoop(null); return; }
    if (this.host.offsetParent === null) { this.prev = now; return; }
    // sleeping Mochi barely moves: draw a third of the frames to save battery
    if ((this.mood === "sleep" || (this.mood === "bed" && now - this.bedSince > 2000)) && (this.skip = (this.skip + 1) % 3)) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - this.prev) / 1000)); this.prev = now;
    this.frames++;
    if (now - this.fpsT > 1000) {
      this.fps = this.frames * 1000 / (now - this.fpsT); this.frames = 0; this.fpsT = now;
      // a slow phone (or one drawing without its graphics chip): fewer pixels first, then no soft shadows
      if (this.mood === "sleep" || now - this.born < 2500 || this.fps >= 40) this.slow = 0;
      else if ((this.slow = (this.slow || 0) + 1) >= 2) { this.slow = 0; this.lighten(); }
    }

    // still reading and the computer hasn't answered: read a little longer (at most 0.6 s more)
    const waitModel = this.cur === "reading" && this.queue[0] && this.queue[0][0] === "@react" && this.pending && this.pending.waiting && now < this.curEnd + 600;
    if (this.cur && now > this.curEnd && !waitModel) this.next();
    if (!this.cur) {
      const b = this.base();
      if (b !== this.mood) { this.mood = b; this.setFace(b); }
    }
    // a couple of quiet minutes (or a "good night"): a yawn, then into the little bed
    if (!this.cur && !this.busy && !this.inBed && !this.queue.length && !this.held && !this.sulking && !this.gf) {
      if (this.bedAt && now > this.bedAt) { this.bedAt = 0; this.run([["@bed"]]); }
      else if (now - this.lastActive > BED_MS) { if (this.craft) { this.craft.letGo(false); this.craft.stance.sit({ quiet: true }); } this.run([["sleepy", HOLD.sleepy], ["@bed"]]); }   // puts down what he holds, sits, then bed
    }
    if (this.shown !== this.mood) { this.shown = this.mood; this.host.classList.toggle("typing", this.mood === "typing" || this.mood === "working"); this.host.dataset.mood = this.mood; }
    this.simT += dt * 1000;
    this.stepZoom(now);   // 1.36: zoomies set where to hop next
    this.trackHome();
    this.stepDrag(dt);
    this.craft.pre(now, dt);   // a move's face channels set the springs' targets
    const steps = dt > 0.02 ? 2 : 1;
    for (let i = 0; i < steps; i++) { for (const k in this.P) this.P[k].step(dt / steps); this.pop.step(dt / steps); }
    this.animate(now, now / 1000, dt);
    this.stepParts(now);
    // no snaps on screen (Nov 4): a pose that jumps in one frame (a role or a move switching) fades across instead;
    // display only, put back after drawing (smoother.js)
    if (!this.smoothers) this.smoothers = [
      [new Smoother(poseChannels({ body: this.body, neck: this.neck, arms: this.arms, legs: this.legs })), () => true],
      // where he is and which way he faces (not while he rides: the ride is placed from where he really is)
      [new Smoother(poseChannels({ group: this.root }).concat(["x", "y", "z"].map((k) => [this.root.scale, k, false]))), () => !(this.craft.rider && this.craft.rider.cur)],
      [new Smoother(poseChannels({ group: this.cocoa, body: this.cocoaBody, neck: this.cocoaNeck, arms: this.cocoaArms, legs: this.cocoaLegs })), () => this.cocoa.visible && this.cocoa.rotation.order === "XYZ" && !(this.bud && this.bud.inCar)],
      [new Smoother(poseChannels({ group: this.mimi, body: this.mimiBody, neck: this.mimiNeck, arms: this.mimiArms, legs: this.mimiLegs })), () => this.mimi.visible && this.mimi.rotation.order === "XYZ" && !(this.gf && this.gf.inCar)],
    ];
    for (const [S, live] of this.smoothers) S.apply(now, dt, !this.noSmooth && live());
    this.zd.render(now);   // straight to the screen, or (Zero Day) through a glitch now and then
    if (this.onFrame) this.onFrame(now);   // test hook: trace the pose every frame (what was drawn)
    for (const [S] of this.smoothers) S.restore();
  }

  animate(now, t, dt) {
    { const pals = (this.gf ? 1 : 0) + (this.bud ? 1 : 0); if (this.lens && this.lens.w < this.lens.h && pals !== this._framedPals) this.resize(); }   // (friends came or went, on a narrow screen: frame them)
    // talking: his face goes with what he's saying (Nov 5, Binoy: "when mochi talks his mouth is always in a happy
    // smiling shape even when saying something sad"): the page reads the line's tone (speakingTone) and, while he says
    // it, his mouth, brows, eyes and ears lean that way, easing in and out
    // ...and after it, the feeling stays a while (Nov 5: "when mochi finishes responding to something sad he defaults
    // back to a smile"): softer, then slowly gone. A happy moment (a pat, a hug, a hello, a giggle) cheers him up and
    // ends it; anything else he does in between (looking about, a wave of his own) it waits out
    const T0 = this.talkTone;
    if (T0 && now >= T0.until && CHEERS.has(this.mood)) this.talkTone = null;
    let want = 0;
    if (T0 && this.talkTone) {
      if (now < T0.until) want = 1;
      else if (now < T0.until + T0.linger && LINGER_MOODS.has(this.mood)) { const u = (now - T0.until) / T0.linger; want = 0.8 * (u < 0.65 ? 1 : 1 - (u - 0.65) / 0.35); }
      else if (now >= T0.until + T0.linger) this.talkTone = null;
    }
    const TT = want > 0 ? T0.face : null;
    this.toneW = (this.toneW || 0) + (want - (this.toneW || 0)) * (1 - Math.exp(-dt * (want > (this.toneW || 0) ? 9 : 1.5)));
    if (TT) this.toneFace = TT; else if (this.toneW < 0.01) this.toneFace = null;
    const TF = this.toneFace, tw = TF ? this.toneW : 0;
    const P = this.P, v = tw > 0.001 ? (k) => (k in TF ? P[k].x + (TF[k] - P[k].x) * tw : P[k].x) : (k) => P[k].x, mood = this.mood, calm = this.reduce ? 0.3 : 1;
    // hops with squash and stretch
    let hy = 0, sq = 0;
    for (let i = this.hops.length - 1; i >= 0; i--) {
      const h = this.hops[i], u = (now - h.t0) / h.dur;
      if (u < -0.25) continue;
      if (u > 1.3) { this.hops.splice(i, 1); continue; }
      if (u < 0) { h.c = 0.08 * (1 + u * 4); sq -= h.c; }   // crouch before the jump
      else if (u <= 1) { hy += h.h * Math.sin(Math.PI * u); sq += 0.06 * Math.sin(Math.PI * u) - (h.c || 0) * Math.max(0, 1 - u / 0.12) ** 2; }   // (springing up out of the crouch over a few frames, not in one: Nov 4 probe; a hop right now has no crouch to spring from)
      else sq -= 0.1 * Math.sin(Math.PI * (u - 1) / 0.3);  // land
    }
    if (mood === "patted") sq -= 0.035 * (0.6 + 0.4 * Math.sin(t * 5)) * calm;   // melting into the pat
    const asleep = mood === "sleep" || mood === "bed";
    const breath = Math.sin(t * (asleep ? 1.3 : 2.3)) * (asleep ? 0.024 : 0.013);
    const pop = Math.max(0.001, this.pop.x);
    const bd = Math.max(0, Math.min(1.15, v("bed"))), bd1 = Math.min(1, bd), B = this.BED;
    const lie = pop * (1 - bd1 * (1 - B.s));   // in bed Mochi lies on its side, a little smaller so the bed fits
    this.root.scale.set(lie * (1 - sq * 0.6), lie * (1 + sq), lie * (1 - sq * 0.6));
    const shock = Math.max(0, Math.min(1, v("shock"))), shake = mood === "shocked" && !this.zd.on ? Math.max(0, 1 - (now - (this.shockAt || 0)) / 1400) : 0;
    this.root.position.x = bd1 * B.x + Math.sin(t * 58) * 0.022 * shake * calm;   // a tremble from the shock
    this.root.position.y = (hy - v("slump") * 0.04) * (1 - bd1) + bd1 * B.y;
    const swayAmt = mood === "love" ? 0.08 : mood === "excited" ? 0.05 : mood === "superexcited" ? 0.09 : mood === "tickled" ? 0.07 : mood === "laugh" ? 0.035 : 0.025;
    // the sway keeps its rhythm going from one mood to the next (sin(t × a new speed) jumped: Nov 4 probe)
    this.swayPh = (this.swayPh || 0) + (mood === "love" ? 3.2 : mood === "tickled" ? 21 : mood === "laugh" ? 14 : 0.8) * dt;
    this.swayA = (this.swayA ?? swayAmt) + (swayAmt - (this.swayA ?? swayAmt)) * Math.min(1, dt * 6);
    this.root.rotation.z = Math.sin(this.swayPh) * this.swayA * calm * (1 - bd1) + bd1 * B.rot;
    if (mood === "tickled" || mood === "laugh") this.root.position.y += Math.abs(Math.sin(t * 12)) * (mood === "laugh" ? 0.022 : 0.035) * calm;   // giggle bounce
    if (this.pokeJolt) {   // poked in the side: a hop away from your finger and a wobble back (Nov 7)
      const u = (now - this.pokeJolt.t0) / 1000;
      if (u > 0.9) this.pokeJolt = null;
      else { const k = Math.exp(-u * 6) * Math.max(0.3, calm); this.root.position.x += this.pokeJolt.dir * 0.07 * Math.sin(Math.min(u * 14, Math.PI / 2)) * k; this.root.rotation.z += this.pokeJolt.dir * -0.2 * Math.sin(u * 22) * k; this.root.position.y += Math.max(0, Math.sin(u * 16)) * 0.03 * k * (u < 0.2 ? 1 : 0); }
    }
    this.shyK = (this.shyK || 0) + ((mood === "shy" ? 1 : 0) - (this.shyK || 0)) * Math.min(1, dt * 5);
    this.root.rotation.y = Math.sin(t * 0.45) * 0.08 * calm * (1 - bd1) + Math.sin(t * 1.6) * 0.1 * calm * this.shyK;
    // v1.34: sulking turns the whole body away from you; with Mimi there, Mochi steps aside
    this.root.rotation.y += Math.max(0, Math.min(1, v("turn"))) * 0.5 * (1 - bd1);
    if ((mood === "angry" || mood === "peek")) this.root.position.y += Math.max(0, Math.sin(t * 2.2)) * 0.012 * calm;   // little huffy breaths
    // he moves back to the middle once they've set off, not while they're still beside him saying bye (he walked into
    // Mimi as she waved: Nov 4 probe)
    const going = (F, ms, at) => F && (!F.leaving || now - F.leaveAt < (F.outMs || ms) * at);
    this.duo.t = going(this.gf, 1600, 0.5) ? 1 : 0; this.duo.step(dt);
    this.duo2.t = going(this.bud, 900, 0.5) ? 1 : 0; this.duo2.step(dt);
    const dv = Math.max(0, Math.min(1, this.duo.x)) * (1 - bd1), dc = Math.max(0, Math.min(1, this.duo2.x)) * (1 - bd1);
    // he steps aside to make room; he stays his own size (Nov 2: "mochi's size shrinks when mimi or cocoa comes")
    const aside = -0.66 * dv * (1 - dc) + 0.52 * dc * (1 - dv);   // (with Mimi at 0.72: their heads and his ear just clear, hug.js)
    if (dv > 0.001 || dc > 0.001) this.root.position.x += aside;
    // he walks over to make room (Nov 4: sliding there looked like being dragged): the stance steps while it changes
    const av = dt > 0 ? (aside - (this.asidePrev ?? aside)) / dt : 0; this.asidePrev = aside;
    this.duoWalk = Math.abs(av) > 0.12 ? Math.sign(av) : 0;
    // carried: lifted by the scruff, dangling and swinging below your finger; yanked: hooves dug in, stretched, then off it goes
    const held = Math.max(0, Math.min(1.1, v("held"))), D = this.drag;
    if (held > 0.01 || Math.abs(D.swing) > 0.002) {
      const top = 2.3 * lie, a = D.swing + (D.resist ? -D.yankDir * 0.5 * D.resist : 0);
      this.root.rotation.z += a;
      this.root.position.x += top * Math.sin(a);
      this.root.position.y += top * (1 - Math.cos(a)) + held * 0.26 + Math.sin(t * 2.2) * 0.02 * held * calm;
      // a hint of stretch while he's moved about or digs his hooves in (a few percent, eased; Nov 7: "mochi stretches
      // too much when we hold him to move him around"), his volume kept: carry.js
      const sh = carryShape(D);
      this.root.scale.y *= sh.y; this.root.scale.x *= sh.xz; this.root.scale.z *= sh.xz;
    }
    if (bd1 > 0.5) this.body.scale.set(1 + breath * 0.9, 1 + breath * 0.3, 1 + breath * 0.5);   // lying: the side rises and falls
    else this.body.scale.set(1 + breath * 0.5, 1 + breath, 1 + breath * 0.5);
    this.body.rotation.x = v("lean") * 0.12 + v("slump") * 0.08;
    const kick = held > 0.3 ? Math.sin(t * (mood === "yanked" ? 20 : 6)) * (mood === "yanked" ? 0.3 : 0.12) * calm : 0;
    // (y and z too: the move layer adds a kick's swing out to the side every frame, and without this it piled up and
    // spun his legs round and round: Nov 2, "when I touch his legs… it just uncontrollably keeps rotating")
    this.legs.forEach((l, i) => { l.rotation.x = -Math.PI / 2 + 0.18 + Math.max(bd1 * 1.25, Math.min(1, held) * 1.15) + kick * (i ? 1 : -1); l.rotation.y = 0; l.rotation.z = 0; });   // in bed they stretch out; carried, they dangle and kick
    // the little bed pops up around Mochi; the nightcap goes on
    this.bedGroup.visible = bd > 0.02;
    if (this.bedGroup.visible) this.bedGroup.scale.setScalar(Math.max(0.001, bd * B.k));
    // costumes: a twirl when changing; hats and ears give way to the nightcap in bed
    let spin = 0;
    if (this.spinAt) {
      const u = (now - this.spinAt) / 750;
      if (u >= 0.5 && this.costume !== this.wearNext) this.costume = this.wearNext;
      if (u >= 1) this.spinAt = 0; else spin = (u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u)) * Math.PI * 2;
    }
    this.root.rotation.y += spin;
    const headProp = this.craft.headProp();   // a crown or a helmet from the workbench: the costume hat steps aside
    for (const k in this.outfits) this.outfits[k].visible = this.costume === k && bd < 0.3 && !headProp;
    if (this.costume === "christmas" && this.outfits.christmas.visible) {   // the hat droops and sways like soft felt
      this.hatFlop.t = 1.95 + (this.drag.swing || 0) * 1.6 + v("tilt") * 0.8 + Math.sin(t * 1.6) * 0.1 * calm;
      this.hatFlop.step(dt);
      const f = this.hatFlop.x;
      this.hat.bend((u) => -0.1 + f * Math.pow(u, 2.3));
      this.pompom.position.copy(this.hat.tip).addScaledVector(this.hat.dir, 0.06);
    }
    if (this.costume === "easter" && this.outfits.easter.visible) this.bunnyEars.forEach((e) => {
      const sd = e.userData.side, sw = this.drag.swing || 0;
      e.rotation.z = -sd * (0.16 - v("ear") * 0.12) + Math.sin(t * 2 + sd) * 0.03 * calm;
      const fold = sd > 0 ? 1.75 + Math.sin(t * 2.4) * 0.12 * calm + sw * 1.2 : 0;   // the right ear folds over halfway up; the left stands
      const bendFn = (u) => sd * 0.04 * u + (sd > 0 ? fold * smooth(0.42, 0.78, u) : (Math.sin(t * 2.1) * 0.06 * calm + sw * 0.5) * u * u);
      e.userData.out.bend(bendFn); e.userData.inn.bend(bendFn);
    });
    this.cap.visible = bd > 0.3;
    if (this.cap.visible) this.cap.scale.setScalar(Math.max(0.001, (bd - 0.3) / 0.7));
    this.key.intensity = 2.4 - bd1 * 0.55;

    // head: nods, tilts, idle drift
    let nod = 0;
    if (this.nodAt > 0) { const u = (now - this.nodAt) / 700; if (u < 1) nod = Math.sin(u * Math.PI * 2) * 0.16 * (1 - u); else this.nodAt = -1; }
    const typingBob = mood === "typing" ? Math.sin(t * 9) * 0.015 : mood === "working" ? Math.sin(t * 6) * 0.008 - (t % 5.5 > 4.6 ? 0.1 : 0) : 0;
    this.neck.rotation.x = v("pitch") + nod + breath * 0.6 * (1 - bd1 * 0.7) + typingBob + (asleep ? Math.sin(t * 0.6) * 0.06 * (1 - bd1 * 0.8) : 0);
    this.neck.rotation.z = v("tilt") + Math.sin(t * 0.7 + 1) * 0.03 * calm
      + (mood === "patted" ? this.patDir * 0.16 * (0.75 + 0.25 * Math.sin(t * 4)) : 0);   // leaning into your finger
    this.neck.rotation.y = v("yaw") + Math.sin(t * 0.31) * 0.1 * calm * (1 - bd1 * 0.85) + dv * (0.22 + 0.16 * Math.sin(t * 0.9)) * ((mood === "angry" || mood === "peek") ? 0 : 1);
    // calling a friend over: looking off their way, chin up (Cocoa comes from the left, Mimi from the right)
    const CL = this.calling && now < this.calling.until ? this.calling : null;
    var callK = CL ? Math.min(1, (now - CL.t0) / 180, (CL.until - now) / 250) : 0, callSide = CL && CL.who === "cocoa" ? -1 : 1;
    if (callK > 0) { this.neck.rotation.y += callSide * 0.55 * callK; this.neck.rotation.x -= 0.12 * callK; }
    if (this.gaze && now < this.gaze.until) {   // asked to look at a spot: head and eyes go there, easing in and out
      const G = this.gaze, k = Math.min(1, (now - G.t0) / 350) * Math.min(1, (G.until - now) / 400);
      this.neck.rotation.y += G.yaw * k; this.neck.rotation.x += G.pitch * k;
      this.P.lookX.t = this.P.lookX.t * (1 - k) + G.lookX * k; this.P.lookY.t = this.P.lookY.t * (1 - k) + G.lookY * k;
    } else if (this.gaze) this.gaze = null;
    this.ground.scale.set((1 - Math.min(0.35, hy * 1.1)) * (1 + bd1 * 0.45), 1 - Math.min(0.35, hy * 1.1), 1);
    this.ground.position.x = -0.62 * dv * (1 - dc) + 0.52 * dc * (1 - dv);   // under him wherever the friends' room puts him
    this.ground.material.opacity = (1 - Math.min(0.6, hy * 2)) * (1 - Math.min(1, held) * 0.65);   // lifted off the ground
    if (mood === "dizzy") { this.neck.rotation.z += Math.sin(t * 7) * 0.13 * calm; this.neck.rotation.x += Math.cos(t * 7) * 0.08 * calm; this.root.rotation.z += Math.sin(t * 3.5) * 0.05 * calm; }

    // eyes: blinks, small glances, reading scan
    if (now > this.blinkAt && this.blinkT < 0) { this.blinkT = now; this.blinkAt = now + 2200 + this.r() * 3800; if (this.r() < 0.18) this.blinkAt = now + 260; }
    let blink = 1;
    if (this.blinkT > 0) { const u = (now - this.blinkT) / 150; if (u >= 1) this.blinkT = -1; else blink = Math.abs(Math.cos(u * Math.PI)) ** 0.7; }
    if (mood === "idle" && now > this.sacc.at) { this.sacc = { x: (this.r() - 0.5) * 0.5, y: (this.r() - 0.5) * 0.3, at: now + 1400 + this.r() * 2600 }; }
    if (mood !== "idle") { this.sacc.x *= 0.9; this.sacc.y *= 0.9; }
    let scanX = 0, scanY = 0;
    if (mood === "reading") { const ph = (t * 1.25) % 1; scanX = -0.45 + ph * 0.9; scanY = -Math.floor(t * 1.25 % 3) * 0.12; }
    if (mood === "typing") { scanX = Math.sin(t * 1.7) * 0.15; }
    if (mood === "shy" && (t % 2.4) > 1.85) { scanX = 0.55; scanY = 0.4; }   // a quick peek back at you
    // working: eyes follow the pencil; every few seconds a quick look up at you, then back to it
    const peek = mood === "working" && (t % 5.5) > 4.6 ? Math.sin(((t % 5.5) - 4.6) / 0.9 * Math.PI) : 0;
    if (mood === "working") { scanX = (this.paper.x / this.paper.c.width - 0.5) * 0.6 * (1 - peek); scanY = peek * 0.95; }
    const lx = v("lookX") + this.sacc.x + scanX, ly = v("lookY") + this.sacc.y + scanY;
    const open = Math.max(0, v("eyeOpen")) * blink, happy = Math.min(1, Math.max(0, v("eyeHappy"))), closed = Math.min(1, Math.max(0, v("eyeClosed")));
    const es = v("eyeScale");
    const tmp = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1);
    for (const e of this.eyes) {
      const ex = e.s * 0.185 + lx * 0.04, ey = 0.0 + ly * 0.07;
      const n = this.surf(ex, ey, 0.004, tmp);
      e.g.position.copy(tmp); e.g.quaternion.setFromUnitVectors(Z, n);
      const sy = open * (1 - happy) * (1 - closed);
      e.ball.scale.set(0.083 * es, Math.max(0.002, 0.112 * es * sy), 0.036);
      e.ball.visible = sy > 0.02;
      e.shine.scale.set(es, Math.max(0.001, sy) * es, 1); e.shine.visible = sy > 0.25;
      const arcY = happy - closed;
      e.arc.visible = Math.abs(arcY) > 0.04;
      e.arc.scale.set(1, arcY, 1); e.arc.position.y = closed > happy ? 0.02 : -0.02;
      // brows sit above the eyes; sad = inner ends up
      const bShow = Math.max(0, Math.min(1, v("brow")));
      const bn = this.surf(e.s * 0.18, 0.165 + v("browY") * 0.045, 0.006, tmp);
      e.browG.position.copy(tmp); e.browG.quaternion.setFromUnitVectors(Z, bn);
      e.browG.rotateZ(-e.s * 0.5 * v("browSad"));
      e.browG.scale.set(Math.max(0.001, bShow), Math.max(0.001, bShow), 1); e.browG.visible = bShow > 0.03;
    }
    // ears: perk or droop, flick now and then
    if (now > this.twitchAt) { this.twitch[this.r() < 0.5 ? 0 : 1] = 1; this.twitchAt = now + 4000 + this.r() * 6000; }
    this.ears.forEach((ear, i) => {
      this.twitch[i] *= Math.exp(-dt * 7);
      const lift = -0.32 + v("ear") * 0.55 + Math.sin(t * 2.3 + i) * 0.03 * (1 - shock) + this.twitch[i] * 0.35 * (1 - shock) * Math.sin(now / 30);
      ear.rotation.z = ear.userData.side * lift;
      ear.rotation.y = ear.userData.side * -0.25;
    });
    // booped: the nose squishes and springs back (Nov 7)
    const bk = this.boopAt ? Math.max(0, 1 - (now - this.boopAt) / 450) : 0;
    if (bk || this.boopAt) { this.nose.scale.set(0.045 * (1 + 0.3 * bk), 0.03 * (1 - 0.35 * bk), 0.022 * (1 - 0.5 * bk)); if (!bk) this.boopAt = 0; }
    // mouth
    const laugh = mood === "tickled" || mood === "laugh" ? Math.abs(Math.sin(t * 13)) * 0.28 - 0.14 : 0;   // "ha-ha-ha"
    const dream = asleep && now < this.dreamUntil ? 1 : 0;   // patted in its sleep: a little smile
    const talk = this.voiceLevel && now - this.voiceAt < 250 ? this.voiceLevel : 0;   // his voice (the page measures it)
    this.shapeMouth(v("smile") + dream * 0.45, Math.max(0, v("mouthOpen") + laugh + (mood === "typing" ? Math.max(0, Math.sin(t * 5)) * 0.05 : 0), talk * 0.9), Math.max(0.3, v("mouthW")) * (1 - talk * 0.15));
    this.blush.forEach((b) => (b.material.opacity = Math.max(0, Math.min(1, v("blush") + dream * 0.4)) * 0.7));
    // v1.34: puffed-up cheeks (they swell out of the face, the blush rides on top of them)
    const pf = Math.max(0, Math.min(1.1, v("puff"))) * (1 + ((mood === "angry" || mood === "peek") ? Math.sin(t * 2.2) * 0.06 : 0));
    this.cheeks.forEach((ch, i) => {
      ch.visible = pf > 0.02;
      if (!ch.visible) return;
      const sd = ch.userData.side;
      this.place(ch, sd * 0.26, -0.15, -0.03);
      ch.scale.set(0.15 * pf, 0.115 * pf, 0.1 * pf);
      this.place(this.blush[i], sd * 0.29, -0.13, 0.006 + 0.07 * pf);
    });
    if (pf <= 0.02 && this.cheekBlushMoved) this.blush.forEach((b, i) => this.place(b, (i ? 1 : -1) * 0.3, -0.12, 0.006));
    this.cheekBlushMoved = pf > 0.02;
    const ln = Math.max(0, Math.min(1, v("lines")));
    this.lineMat.opacity = ln * 0.9;
    this.lines.forEach((l) => { l.visible = ln > 0.05; });

    // a prop in his hoof: no phone or notepad over it, he just reads and thinks (Nov 3: "the objects are phasing through
    // each other"); the phone and pad come back with his next face once his hooves are free
    const C0 = this.craft, handBusy = !!(C0 && C0.prop && C0.prop.slot === "hand" && !C0.prop.leaving);
    if (handBusy) { if (this.P.phone.t > 0) this.P.phone.t = 0; if (this.P.pad.t > 0) this.P.pad.t = 0; }
    // arms: rest, phone, notepad, wave
    const ph = Math.max(0, Math.min(1, v("phone"))), pd = Math.max(0, Math.min(1, v("pad")));
    const writing = mood === "working" && !((t % 5.5) > 4.6);
    if (writing && pd > 0.9) this.stepPaper(now);
    this.arms.forEach((a) => {
      const s = a.userData.side;
      let rx = -0.62 + Math.sin(t * 2.3) * 0.03, rz = s * 0.22;
      // holding the phone: hooves meet at its sides, tapping in turns
      const tap = mood === "typing" && (t % 2.4) < 1.9 ? Math.max(0, Math.sin(t * 15 + (s > 0 ? Math.PI : 0))) * 0.12 : 0;
      rx = rx * (1 - ph) + (-1.3 - tap) * ph;
      rz = rz * (1 - ph) + (-s * 0.3) * ph;
      // the notepad: left hoof holds its edge, right hoof writes with the pencil
      const wig = writing && s > 0 ? Math.sin(t * 22) * 0.05 : 0;
      const prx = s > 0 ? -1.12 + wig - (0.5 - this.paper.row / 5) * 0.08 : -1.05, prz = s > 0 ? -0.05 - (this.paper.x / this.paper.c.width - 0.5) * 0.35 : 0.42;
      rx = rx * (1 - pd) + prx * pd; rz = rz * (1 - pd) + prz * pd;
      if (mood === "sad") rx += 0.1;
      if (mood === "excited" || mood === "happy") { rz += s * 0.5 * Math.max(0, Math.sin(t * 9)) * (1 - ph); }
      if (mood === "superexcited") { rx = -0.12 + Math.sin(t * 12 + s) * 0.12; rz = s * (2.75 + 0.3 * Math.sin(t * 14 + s)); }   // both arms up, waving wildly
      if (mood === "tickled") { rx = -0.95 + Math.sin(t * 16 + s) * 0.12; rz = -s * 0.32; }   // hugging the tummy, wriggling
      if (mood === "laugh") { rx = -0.78 + Math.sin(t * 13 + s) * 0.06; rz = s * 0.3; }       // arms out a little, shaking with the giggle
      if (mood === "shy") { rx = -1.02 + Math.sin(t * 6 + s * 1.3) * 0.05; rz = -s * 0.46; }   // hooves together, fidgeting
      if (mood === "proud") { rx = -0.32 + Math.sin(t * 2) * 0.02; rz = s * 0.98; }              // hooves on hips
      if (mood === "sleepy") { rx = -2.45 + Math.sin(t * 3 + s) * 0.05; rz = s * 0.42; }          // a big stretch with the yawn
      if (mood === "shocked" && !this.zd.on) { rx = -2.25 + Math.sin(t * 40 + s) * 0.04 * shake; rz = -s * 0.42; }   // hooves up to the cheeks
      if ((mood === "angry" || mood === "peek")) { rx = -1.42 + (s > 0 ? 0.1 : -0.06); rz = -s * 1.12; }                      // arms crossed, hmph
      if (mood === "forgive") { rx = -1.0 + Math.sin(t * 5 + s) * 0.04; rz = -s * 0.44; }                // hooves together, a bit sheepish
      if (mood === "showoff" && s < 0) { rx = -0.9; rz = 1.2 + Math.sin(t * 6) * 0.15; }                   // "this is Mimi!"
      if (s < 0 && this.mochiBump > 0) { const b = this.mochiBump; rx = rx * (1 - b) - 1.45 * b; rz = rz * (1 - b) - 0.95 * b; }   // a hoof bump with Cocoa
      if (callK > 0 && s === callSide) { rx = rx * (1 - callK) - 2.05 * callK; rz = rz * (1 - callK) - s * 0.55 * callK; }   // calling a friend: a hoof cupped by his mouth
      if (mood === "held") { rx = -0.45 + Math.sin(t * 3 + s) * 0.1 * calm; rz = s * 0.5; }                // hanging loose
      if (mood === "yanked") { rx = -2.5 + Math.sin(t * 19 + s * 2) * 0.4 * calm; rz = s * (0.55 + Math.sin(t * 13) * 0.2); }   // flailing
      if (bd1 > 0.5) { rx = -0.25; rz = s * 0.12; }                                                // tucked under the quilt
      if (s > 0 && this.waveAt > 0) {
        const u = (now - this.waveAt) / 1500;
        if (u >= 1) this.waveAt = -1;
        else { const up = Math.min(1, u * 5, (1 - u) * 5); rz = rz * (1 - up) + (2.45 + Math.sin(u * Math.PI * 7) * 0.35) * up; rx = rx * (1 - up) - 0.2 * up; }
      }
      a.rotation.set(rx, 0, rz);
      a.visible = bd1 < 0.6;   // under the quilt
    });
    this.phone.scale.setScalar(Math.max(0.001, ph));
    this.phone.visible = ph > 0.02;
    this.phone.rotation.set(-0.35 + Math.sin(t * 2) * 0.03, Math.sin(t * 1.3) * 0.05, (1 - ph) * 1.2);
    this.glow.intensity = ph * 0.6 * (0.92 + Math.sin(t * 7) * 0.08);
    this.pad.scale.setScalar(Math.max(0.001, pd));
    this.pad.visible = pd > 0.02;
    if (this.pad.visible) {   // the pencil tip sits where the writing is
      const P2 = this.paper, px = (P2.x / P2.c.width - 0.5) * 0.44, py = (0.5 - (P2.y || 36 + P2.row * 32) / P2.c.height) * 0.33 - 0.015;
      this.pencil.position.set(px, py, 0.03 + (writing ? 0 : 0.05));
      this.pencil.rotation.z = writing ? Math.sin(t * 22) * 0.06 : 0;
    }
    const gs = Math.max(0, Math.min(1.15, v("glasses")));
    this.glasses.visible = gs > 0.03;
    if (this.glasses.visible) {   // lowered onto the face from above the head
      this.glasses.position.set(0, (1 - Math.min(1, gs)) * 0.42, (1 - Math.min(1, gs)) * 0.06);
      this.glasses.rotation.x = -(1 - Math.min(1, gs)) * 0.5;
      const u = (t % 3.2) / 0.7;   // a glint sweeps across the lenses now and then
      this.glints.forEach((g, i) => {
        const k = u - i * 0.12;
        g.material.opacity = k > 0 && k < 1 ? Math.sin(k * Math.PI) * 0.75 : 0;
        g.position.x = -0.09 + Math.max(0, Math.min(1, k)) * 0.18;
      });
    }

    // tears, sweat, effects
    if (mood === "sad" && !this.zd.on) {
      const u = (t % 1.7) / 1.7; this.tear.visible = true;
      this.place(this.tear, -0.2, -0.08 - u * 0.2, 0.03);
      this.tear.scale.setScalar(Math.min(1, u * 5) * (1 - Math.max(0, u - 0.8) * 5));
    } else this.tear.visible = false;
    const sw = Math.max(0, Math.min(1, v("sweat")));
    if (sw > 0.05) {
      const u = (t % 2.2) / 2.2; this.sweat.visible = true;
      this.place(this.sweat, 0.33, 0.2 - u * 0.1, 0.035); this.sweat.rotateX(-Math.PI / 2); this.sweat.scale.setScalar(1.5 * sw);
    } else this.sweat.visible = false;
    if (this.costume === "christmas" && now - (this.snowAt || 0) > 1300 && this.parts.filter((p) => p.kind === "snow").length < 7) { this.snowAt = now; this.spawn("snow"); }
    if ((mood === "angry" || mood === "peek")) {
      if (now - (this.veinAt || 0) > 1400) { this.veinAt = now; this.spawn("vein"); }
      if (now - (this.huffAt || 0) > 2600) { this.huffAt = now; this.huff(); }
    }
    this.animateMimi(now, t, dt, calm);
    this.animateCocoa(now, t, dt, calm);
    this.scuffle.pose(now, dt);    // what's in Cocoa's hoof, his throwing arm, his ouch
    this.friendMoves.step(now, dt);   // a move on Mimi's or Cocoa's body (he's teaching them)
    this.dance.step(now, dt);         // a dance party: the ball, the beams, the notes, the next routine
    const every = { superexcited: 150, love: 330, excited: 260, sleep: 1500, bed: 1500, proud: 520, patted: 700, showoff: 420 }[mood];
    if (every && now - this.lastFx > every && this.parts.length < 10) {
      this.lastFx = now;
      this.spawn(mood === "love" || mood === "patted" || mood === "showoff" ? "heart" : mood === "superexcited" ? (this.r() < 0.6 ? "confetti" : "star") : mood === "excited" || mood === "proud" ? "star" : "z");
    }
    this.zd.step(dt, t);           // Zero Day colours and glow, cross-faded
    this.craft.post(now, t, dt);   // the move layer, held props, launcher ammo, and no snaps between poses
    this.propAct.step(now);        // a prop used on another one, and flames it lit
    this.scuffle.step(now, t, dt); // throws between him, Cocoa and you: Cocoa's hoof, ouch wobbles, Cocoa's bubble
    this.hs.step(now, dt);         // the secret handshake: hooves out, what comes next, his answers
    this.piggy.step(now, dt);      // a piggyback ride: the rider goes wherever his back is (after everything that moves him)
    this.friendMoves.settle(now);  // a hug: the friend where their fleece meets, arms round each other (after everything that moves him)
    if (now - (this.coverAt || 0) > 500) { this.coverAt = now; this.coverCheck(); }
    this.shelf.step(now);          // his shelf: what's out is missing from it
    this.floor.step(now);          // props you've put on the floor, and the one you're pulling
    this.scenery.step(now);        // the story's bushes and tracks: popping up, folding away
    this.cold.step(now, dt);       // a sneeze, a sniffle, the scarf and the red nose
    this.anchorFurniture();        // the shelf and the rig stay put while he's carried
    this.boom.step(now, dt);       // explosions in flight, and the camera shake
    const sayRight = !!(this.bud && !this.bud.leaving) || this.hs.mode === "teach" || this.hs.mode === "checked";   // Cocoa, or the teaching panel, on his left
    if (sayRight !== this.sayRight) { this.sayRight = sayRight; this.host.classList.toggle("say-right", sayRight); }
  }

  /* v1.34: Mimi hops in from the right, waves, looks over at Mochi now and then (blushing), and hops off again */
  /* Walking (Nov 3: "sometimes they move around when their legs are in sitting positions… it will be good to have them
   * walk around"): while a friend moves across the stage, they stand up on their back legs and step, turned toward
   * where they're going; stopped, they sit back down. Returns how much to lift them and which way to turn. */
  friendWalk(F, x, dt, legs, still, calm, noTurn = false) {
    const W = F.walk || (F.walk = { px: x, v: 0, k: 0, turn: 0, dir: 0, dist: 0, stopAt: 0 });
    const v = dt > 0 ? (x - W.px) / dt : 0; W.px = x;
    W.v += (Math.max(-6, Math.min(6, v)) - W.v) * Math.min(1, dt * 14);
    const now = performance.now(), moving = !still && Math.abs(W.v) > 0.18;
    if (moving) { W.stopAt = now; W.dir = Math.sign(W.v); }
    // turning round to go the other way takes a moment (it used to flip in one frame, setting off to leave: Nov 4 probe)
    W.face = (W.face ?? W.dir) + (W.dir - (W.face ?? W.dir)) * Math.min(1, dt * 9);
    const up = moving || now - W.stopAt < 260;   // a beat before sitting back down
    W.k += ((up ? 1 : 0) - W.k) * Math.min(1, dt * (up ? 10 : 5));
    W.turn += ((moving && !noTurn ? 1 : 0) - W.turn) * Math.min(1, dt * (moving && !noTurn ? 9 : 4));
    // longer strides the faster they go, so a run is quick steps, not legs whirring 12 times a second (Nov 4 probe)
    W.dist += (Math.abs(W.v) * dt) / (1 + 0.45 * Math.max(0, Math.abs(W.v) - 1));
    // the stride eases in and out (stopping, the legs used to drop from mid-stride to standing in one frame)
    W.amp = (W.amp ?? 0) + ((moving ? 1 : 0) - (W.amp ?? 0)) * Math.min(1, dt * (moving ? 12 : 9));
    const ph = (W.dist / 0.2) * Math.PI, k = Math.max(0, Math.min(1, W.k)), step = W.amp;
    if (legs) legs.forEach((l, i) => { l.rotation.x = (-Math.PI / 2 + 0.18) + (Math.PI / 2 - 0.26) * k + 0.5 * Math.sin(ph + i * Math.PI) * k * step * calm; });
    return { lift: 0.15 * k + Math.abs(Math.sin(ph)) * 0.03 * k * step * calm, dir: W.face, turn: Math.max(0, Math.min(1, W.turn)) };
  }
  animateMimi(now, t, dt, calm) {
    const G = this.gf, mm = this.mimi;
    this.mimiNeck.rotation.x = 0; this.mimiBody.rotation.set(0, 0, 0);   // a move on her adds on top of these each frame (friendmoves.js)
    const PK = this.peeking && this.peeking.who === "mimi" && now >= this.peeking.t0 && now < this.peeking.until;
    if (PK && (!G || now < G.t0)) { this.peekPose("mimi", now, t); return; }   // peeking in from the edge
    if (mm.rotation.order !== "XYZ") mm.rotation.order = "XYZ";
    if (!G) { if (mm.visible) { mm.visible = false; this.mimiGround.visible = false; } return; }
    if (!G.leaving && (now > G.until || (G.asked && (!G.bye || now - G.bye > 1900)))) this.friendGoing("mimi", G, now);   // (asked to go: nothing keeps her, not even his reading)
    const HX = 0.72, OUT = G.out || 2.3, el = now - G.t0, IN = G.inMs || 1500;   // she walks in (Nov 3: "it will be good to have them walk around"), from off-screen
    let x, y = 0, wave = 0;
    if (!G.leaving) {
      const u = Math.max(0, Math.min(1, el / IN));
      x = OUT + (HX - OUT) * (1 - (1 - u) * (1 - u));
      if (el >= 0 && G.called && !G.answered) { G.answered = true; if (this.scuffle) this.scuffle.friendSay("mimi", "Coming~!", 1400); }   // from off-screen
      if (el > IN && el < IN + 1800) wave = Math.min(1, (el - IN) / 200, (IN + 1800 - el) / 200);
    } else {
      const u = Math.min(1, (now - G.leaveAt) / (G.outMs || 1600));
      if (u < 0.25) wave = Math.min(1, u / 0.05, (0.25 - u) / 0.05);   // bye!
      const w = Math.max(0, (u - 0.25) / 0.75);
      x = HX + (OUT - HX) * w * w;
      if (u >= 1) { this.gf = null; mm.visible = false; this.mimiGround.visible = false; return; }
    }
    mm.visible = true;
    const xmas = this.costume === "christmas";   // 1.36: she dresses up with him
    this.mimiXmas.visible = xmas; this.mimiHatGroup.visible = xmas;
    if (xmas) {   // her hat flops gently too
      this.mimiHat.bend((u) => -0.1 + (1.6 + Math.sin(t * 1.8) * 0.12 * calm) * Math.pow(u, 2.3));
      this.mimiPom.position.copy(this.mimiHat.tip).addScaledVector(this.mimiHat.dir, 0.05);
    }
    // her role: what she's doing while she's here
    const role = G.leaving ? "bye" : G.role || "showoff", rel = (now - (G.roleAt || G.t0)) / 1000, dcx = Math.max(0, Math.min(1, this.duo2.x));
    if (role === "huddle" || role === "comfort") x -= 0.18 * Math.min(1, el / 900);   // closer to him
    // into the hug and out of it again gently (it ended with her springing back 0.4 in one frame: Nov 4 probe)
    G.hugW = (G.hugW || 0) + ((role === "hug" && !G.leaving ? 1 : 0) - (G.hugW || 0)) * Math.min(1, dt * 5.5);
    const hugK = ease01(G.hugW);   // (where a hug puts her is worked out after everything has moved: friendMoves.settle)
    G.giveW = (G.giveW || 0) + ((role === "give" ? 1 : 0) - (G.giveW || 0)) * Math.min(1, dt * 6);
    x -= 0.34 * ease01(G.giveW);                                                     // handing him something: a step closer
    x += 0.8 * dcx;                                                                 // room for the three of them
    // put somewhere by hand (friendGrab): she stands right there, wherever he is; leaving, she hops off from there
    const pin = this.friendPin(G); let base = 0;
    if (pin) { x = pin.x + (G.leaving ? x - HX - 0.8 * dcx : 0); base = pin.y; }
    // a stroll (Nov 4: "I would like mimi to be able to walk too"): a few steps about and back, on her own legs
    x += this.strollStep("mimi", G, now, dt, !!pin || el < IN + 2500, 0.95);
    // a hug: right up to him, to where their fleece meets (hug.js; it was a fixed 0.42 in, which put her inside him)
    G.hugBase = x; G.hugK = pin ? 0 : hugK;
    if (G.hugK > 0.001) x = lerp(x, G.hugX ?? x - 0.42, G.hugK);
    let jump = 0, sway = 0, shake = 0, armsUp = 0, cheek = 0, tiltIn = 0;
    if (G.held) { jump = 0.12; sway = Math.sin(now / 140) * 0.08 + Math.max(-0.3, Math.min(0.3, -G.held.vx * 3)); }   // dangling
    else if (G.landAt && now - G.landAt < 380) jump = Math.sin(((now - G.landAt) / 380) * Math.PI) * 0.07;            // a little landing hop
    if (!G.leaving && el > 800 && !G.held) {
      if (role === "cheer") { jump = Math.abs(Math.sin(rel * 7)) * 0.24 * calm; armsUp = 1; }
      else if (role === "dance") { sway = Math.sin(rel * 5.2) * 0.13 * calm; jump = Math.abs(Math.sin(rel * 5.2)) * 0.06 * calm; }
      else if (role === "giggle") { shake = Math.sin(rel * 38) * 0.035 * calm * Math.max(0, 1 - rel / 3); cheek = 1; }
      else if (role === "comfort" || role === "huddle") { tiltIn = 1; }
    }
    y += jump;
    const car = this.craft && this.craft.rider ? this.craft.rider.seatFor("mimi", x) : null;   // in the back seat of his car
    G.inCar = !!(car && car.k > 0.5);
    const fw = this.friendWalk(G, car ? lerp(x, car.x, car.k) : x, dt, this.mimiLegs, !!G.held || !!car, calm, G.hugK > 0.01);   // (hugging she keeps facing him: turning to step in moved where they meet, and round it went: Nov 4 probe)   // stepping, not sliding
    if (car) { mm.position.set(lerp(x, car.x, car.k), lerp(y + base, car.y + 0.06, car.k) + 0.35 * car.hop, lerp(0.05, car.z, car.k)); G.until = Math.max(G.until || 0, now + 5000); }
    else mm.position.set(x, y + base + fw.lift * MIMI_SCALE, 0.05);
    mm.scale.setScalar(car ? lerp(MIMI_SCALE, 0.74, car.k) : MIMI_SCALE);   // (the back seat was made for her old size)
    const breath = Math.sin(t * 2.5) * 0.012;
    this.mimiBody.scale.set(1 + breath * 0.5, 1 + breath, 1 + breath * 0.5);
    mm.rotation.y = car ? lerp(-0.32, car.yaw * 0.35, car.k) : lerp(-0.32 + Math.sin(t * 0.55) * 0.05 * calm, fw.dir * 0.95, fw.turn);
    mm.rotation.z = Math.sin(t * 1.15) * 0.035 * calm + sway + shake + 0.07 * tiltIn + 0.05 * hugK;   // hugging: leaning into him (a little: her head tilts away to make room, friendMoves.settle)
    // looks over at Mochi every few seconds, then back at you
    if (now > G.lookAt) G.lookAt = now + 2600 + this.r() * 2400;
    const lk = Math.max(0, Math.sin(Math.min(1, Math.max(0, (G.lookAt - now) / 1200)) * Math.PI));
    this.mimiNeck.rotation.y = -0.38 * Math.max(lk, 0.6 * tiltIn) + Math.sin(t * 0.4) * 0.06 * calm;
    this.mimiNeck.rotation.z = 0.12 * lk + Math.sin(t * 0.8) * 0.03 + 0.16 * tiltIn - sway * 0.6;
    // blinks
    if (now > G.blinkAt) { G.blinkT = now; G.blinkAt = now + 2200 + this.r() * 3000; }
    const bu = G.blinkT ? (now - G.blinkT) / 150 : 1, open = bu < 1 ? Math.abs(Math.cos(bu * Math.PI)) ** 0.7 : 1;
    this.mimiEyes.forEach((e) => { e.ball.scale.y = Math.max(0.003, 0.104 * open); e.shines.forEach((sh) => { sh.visible = open > 0.3; }); });
    // arms: resting, or waving with the outside hoof
    this.mimiArms.forEach((a) => {
      const sd = a.userData.side;
      let rx = -0.6 + Math.sin(t * 2.4 + sd) * 0.03, rz = sd * 0.2;
      if (sd > 0 && wave > 0) { rz = rz * (1 - wave) + (2.4 + Math.sin(t * 14) * 0.35) * wave; rx = rx * (1 - wave) - 0.2 * wave; }
      if (sd < 0) { rx -= 0.25 * lk; rz -= 0.3 * lk; }   // a shy little hoof to the cheek when she looks at him
      if (armsUp) { rx = -2.7 + Math.sin(t * 9 + sd) * 0.15; rz = sd * (0.5 + Math.sin(t * 7) * 0.12); }   // hooray!
      else if (sway) { rx = -1.3 + Math.sin(t * 5.2 + (sd > 0 ? Math.PI : 0)) * 0.35; rz = sd * 0.7; }   // dancing hooves
      if (cheek && sd < 0) { rx = -2.25; rz = -0.55; }                                                    // a hoof to her mouth
      if (tiltIn && sd < 0) { rx = -1.1; rz = -0.65; }                                                    // reaching to him
      if (hugK && sd > 0) { rx = lerp(rx, -1.2, hugK); rz = lerp(rz, -0.35, hugK); }   // the outer hoof across to him (the inner one goes round him: friendMoves.settle)
      a.rotation.set(rx, 0, rz);
    });
    this.mimiGround.visible = !G.inCar;
    this.mimiGround.position.x = x; this.mimiGround.position.y = base + 0.004;
    this.mimiGround.scale.setScalar(MIMI_SCALE * (1 - Math.min(0.35, y * 1.1)));
    this.mimiGround.material.opacity = 1 - Math.min(0.6, y * 2);
    const hearty = role === "showoff" || role === "comfort" || role === "huddle";
    if (hearty && !G.leaving && el > 900 && el < 5200 && now - (G.heartAt || 0) > (role === "comfort" ? 1100 : 650) && this.parts.length < 10) { G.heartAt = now; this.spawn("heart"); }
    if (role === "cheer" && !G.leaving && el > 900 && el < 4500 && now - (G.heartAt || 0) > 500 && this.parts.length < 12) { G.heartAt = now; this.spawn("star"); }
  }

  /* Cocoa runs in from the left, skids, bumps hooves with Mochi, then does his thing for a while and runs off again */
  animateCocoa(now, t, dt, calm) {
    const B = this.bud, cc = this.cocoa;
    const PK = this.peeking && this.peeking.who === "cocoa" && now >= this.peeking.t0 && now < this.peeking.until;
    if (PK && (!B || now < B.t0)) { this.mochiBump = 0; this.peekPose("cocoa", now, t); return; }   // peeking in from the edge
    if (cc.rotation.order !== "XYZ") cc.rotation.order = "XYZ";
    if (!B) { this.mochiBump = 0; if (cc.visible) { cc.visible = false; this.cocoaGround.visible = false; } return; }
    if (!B.leaving && (now > B.until || (B.asked && (!B.bye || now - B.bye > 1900)))) this.friendGoing("cocoa", B, now);
    const dvx = Math.max(0, Math.min(1, this.duo.x));
    const P = this.craft && this.craft.prop, besideW = P && P.slot === "beside" && !P.leaving && P.box ? (P.box.max.x - P.box.min.x) + 0.2 : 0;
    const HX = -1.12 - 0.45 * dvx - besideW, OUT = B.out || -2.8, IN = B.inMs || 650, el = now - B.t0, e2 = el - (IN - 650);   // (e2: as if it were the old short run)
    let x, y = 0, wave = 0, bump = 0, lean = 0;
    if (!B.leaving) {
      const u = Math.max(0, Math.min(1, el / IN));
      x = OUT + (HX - OUT) * (1 - Math.pow(1 - u, 2.2));
      if (el >= 0 && B.called && !B.answered) { B.answered = true; if (this.scuffle) this.scuffle.friendSay("cocoa", "Coming, dude!", 1400); }   // from off-screen
      // runs leaning in, then skids leaning back: the lean swings over the last bit of the run (it used to flip in one
      // frame as he arrived, his head jumping 0.4: Nov 4 probe), then settles
      lean = u < 0.78 ? -0.18 : u < 1 ? lerp(-0.18, 0.22, ease01((u - 0.78) / 0.22)) : Math.max(0, 0.22 * (1 - (e2 - 650) / 350));
      y = Math.abs(Math.sin(el / 1000 * Math.PI * 4.6)) * 0.1 * (1 - u) * calm;
      if (e2 > 750 && e2 < 1500 && !B.noBump) bump = Math.min(1, (e2 - 750) / 180, (1500 - e2) / 180);   // hoof bump
      else if (e2 > 1500 && e2 < 2600 && B.role === "hello") wave = Math.min(1, (e2 - 1500) / 200, (2600 - e2) / 200);
      if (e2 > 1020 && !B.bumped && !B.noBump) { B.bumped = true; for (let i = 0; i < 3; i++) this.spawn("star", 700); }
    } else {
      const u = Math.min(1, (now - B.leaveAt) / (B.outMs || 900));
      if (u < 0.3) wave = Math.min(1, u / 0.06, (0.3 - u) / 0.06);
      const w = Math.max(0, (u - 0.3) / 0.7);
      x = HX + (OUT - HX) * w * w; y = Math.abs(Math.sin(w * Math.PI * 3)) * 0.1 * calm; lean = -0.15 * w;
      if (u >= 1) { this.bud = null; cc.visible = false; this.cocoaGround.visible = false; return; }
    }
    // put somewhere by hand (friendGrab): he stands right there, wherever Mochi is; leaving, he runs off from there
    const pin = this.friendPin(B); let base = 0;
    if (pin) { x = pin.x + (B.leaving ? x - HX : 0); base = pin.y; bump = 0; }
    // a water fight (scuffle.js): he runs a few steps aside to dodge and back, on his own legs, at a run; or a stroll
    x += this.strollStep("cocoa", B, now, dt, !!pin || el < IN + 2500, (this.scuffle && this.scuffle.wf) ? 1.7 : 1.15);
    this.mochiBump = bump;   // Mochi's left hoof meets his (see the arm pose)
    const role = B.leaving ? "bye" : B.role, rel = (now - (B.roleAt || B.t0)) / 1000;
    let armsUp = 0, sway = 0, belly = 0, hopX = 0;
    if (B.held) { y += 0.12; sway = Math.sin(now / 140) * 0.08 + Math.max(-0.3, Math.min(0.3, -B.held.vx * 3)); }   // dangling
    else if (B.landAt && now - B.landAt < 380) y += Math.sin(((now - B.landAt) / 380) * Math.PI) * 0.07;           // a little landing hop
    if (!B.leaving && el > 1500 && !B.held) {
      if (role === "cheer") { y += Math.abs(Math.sin(rel * 6.5)) * 0.26 * calm; armsUp = 1; }
      else if (role === "dance") { sway = Math.sin(rel * 5.2) * 0.14 * calm; y += Math.abs(Math.sin(rel * 5.2)) * 0.06 * calm; }
      else if (role === "play") { hopX = Math.sin(rel * 3.2) * 0.16 * calm; y += Math.abs(Math.sin(rel * 6.4)) * 0.14 * calm; }
      else if (role === "giggle") { belly = Math.max(0, 1 - rel / 3.5); sway = Math.sin(rel * 30) * 0.04 * belly * calm; }
      else if (role === "ready") { y += Math.abs(Math.sin(rel * 4.6)) * 0.035 * calm; }   // on his toes, ready for a throw
    }
    B.hugW = (B.hugW || 0) + ((role === "hug" && !pin && !B.leaving ? 1 : 0) - (B.hugW || 0)) * Math.min(1, dt * 5.5);
    const hugC = ease01(B.hugW);   // a big buddy hug (not from across the window), in and out gently
    B.giveW = (B.giveW || 0) + ((role === "give" && !pin ? 1 : 0) - (B.giveW || 0)) * Math.min(1, dt * 6);
    hopX += 0.36 * ease01(B.giveW);   // handing him something: a step closer
    cc.visible = true;
    const car = this.craft && this.craft.rider ? this.craft.rider.seatFor("cocoa", x) : null;   // in the back seat of the car
    B.inCar = !!(car && car.k > 0.5);
    // running in on his legs; playing, he hops from side to side on his feet, still facing you (he used to slide
    // about sitting down: Nov 4 probe)
    // a hug: right up to Mochi, to where their fleece meets (hug.js, after everything has moved: friendMoves.settle)
    let hx = x + hopX; B.hugBase = hx; B.hugK = hugC;
    if (hugC > 0.001) hx = lerp(hx, B.hugX ?? hx + 0.4, hugC);
    const fw = this.friendWalk(B, car ? lerp(x, car.x, car.k) : hx, dt, this.cocoaLegs, !!B.held || !!car, calm, role === "play" || hugC > 0.01);
    if (car) { cc.position.set(lerp(x, car.x, car.k), lerp(y + base, car.y + 0.06, car.k) + 0.35 * car.hop, lerp(0.08, car.z, car.k)); B.until = Math.max(B.until, now + 5000); }
    else cc.position.set(hx, y + base + fw.lift * COCOA_SCALE, 0.08);
    cc.scale.setScalar(car ? lerp(COCOA_SCALE, 0.8, car.k) : COCOA_SCALE);
    const breath = Math.sin(t * 2.2 + 1) * 0.012;
    this.cocoaBody.scale.set(1 + breath * 0.5, 1 + breath, 1 + breath * 0.5);
    cc.rotation.y = car ? lerp(0.34, car.yaw * 0.35, car.k) : lerp(0.34 + Math.sin(t * 0.5) * 0.05 * calm, fw.dir * 0.95, fw.turn);
    cc.rotation.z = Math.sin(t * 1.05) * 0.03 * calm + sway - 0.05 * hugC;
    this.cocoaBody.rotation.x = lean;
    this.cocoaNeck.rotation.y = 0.3 * bump + Math.sin(t * 0.45) * 0.08 * calm;
    this.cocoaNeck.rotation.x = -0.12 * belly;
    this.cocoaNeck.rotation.z = 0;   // a move's head tilt adds on top each frame (friendmoves.js); without this it piled up and his head rolled round (Nov 3: "dancing makes cocoa go into a weird position")
    if (now > B.blinkAt) { B.blinkT = now; B.blinkAt = now + 2000 + this.r() * 3000; }
    const bu = B.blinkT ? (now - B.blinkT) / 140 : 1, open = bu < 1 ? Math.abs(Math.cos(bu * Math.PI)) ** 0.7 : 1;
    this.cocoaEyes.forEach((e) => { e.ball.scale.y = Math.max(0.003, 0.098 * open * (belly ? 0.45 : 1)); e.shines.forEach((sh) => { sh.visible = open > 0.3 && !belly; }); });
    this.cocoaArms.forEach((a) => {
      const sd = a.userData.side;
      let rx = -0.6 + Math.sin(t * 2.2 + sd) * 0.03, rz = sd * 0.2;
      if (sd > 0 && bump > 0) { rx = rx * (1 - bump) - 1.45 * bump; rz = rz * (1 - bump) + 0.95 * bump; }       // his right hoof out to Mochi
      if (sd < 0 && wave > 0) { rz = rz * (1 - wave) + (-2.4 - Math.sin(t * 14) * 0.35) * wave; rx = rx * (1 - wave) - 0.2 * wave; }
      if (armsUp) { rx = -2.7 + Math.sin(t * 9 + sd) * 0.15; rz = sd * (0.5 + Math.sin(t * 7) * 0.12); }
      else if (sway && !belly) { rx = -1.3 + Math.sin(t * 5.2 + (sd > 0 ? Math.PI : 0)) * 0.35; rz = sd * 0.7; }
      if (belly) { rx = -0.9; rz = sd * -0.15; }                                                           // holding his belly, laughing
      if (role === "play" && !armsUp) { rx = -1.0 + Math.sin(t * 6.4 + sd) * 0.3; rz = sd * 0.55; }
      if (hugC && sd < 0) { rx = lerp(rx, -1.2, hugC); rz = lerp(rz, 0.35, hugC); }   // the outer hoof across to his buddy (the inner one goes round him: friendMoves.settle)
      a.rotation.set(rx, 0, rz);
    });
    this.cocoaGround.visible = !B.inCar;
    this.cocoaGround.position.x = car ? x + hopX : hx; this.cocoaGround.position.y = base + 0.004;
    this.cocoaGround.scale.setScalar(COCOA_SCALE * (1 - Math.min(0.35, y * 1.1)));
    this.cocoaGround.material.opacity = 1 - Math.min(0.6, y * 2);
    if (role === "cheer" && !B.leaving && el > 1500 && el < 5000 && now - (B.fxAt || 0) > 550 && this.parts.length < 12) { B.fxAt = now; this.spawn("star"); }
  }

  shapeMouth(smile, open, width) {
    const pos = this.mouth.geometry.attributes.position, N = this.MN, w = 0.085 * width, y0 = -0.205, tmp = new THREE.Vector3();
    const s = -0.05 * smile, roundTop = open * 0.035 * (1 - Math.max(0, smile));
    for (let i = 0; i <= N; i++) {
      const u = i / N, x = (u * 2 - 1) * w, q = 1 - (u * 2 - 1) ** 2;
      const yu = y0 + s * q + roundTop * Math.sqrt(q);
      const yl = yu - 0.012 - open * 0.11 * Math.pow(q, 0.75);
      this.surf(x, yu, 0.005, tmp); pos.setXYZ(i, tmp.x, tmp.y, tmp.z);
      this.surf(x, yl, 0.005, tmp); pos.setXYZ(i + N + 1, tmp.x, tmp.y, tmp.z);
    }
    pos.needsUpdate = true;
    // a tongue in the lower half of an open mouth
    const tv = open > 0.3 && smile > -0.2;
    this.tongue.visible = tv;
    if (tv) {
      const depth = 0.012 + open * 0.11, cy = y0 + s - depth * 0.72;
      this.place(this.tongue, 0, cy, 0.0062);
      this.tongue.scale.set(w * 0.5, Math.min(depth * 0.3, w * 0.42), 1);
    }
  }
}

/* ------------------------------------------------------------------ start */
function start() {
  const host = document.getElementById("mochi");
  if (!host || host.dataset.started) return;
  host.dataset.started = "1";
  let m;
  try { m = new Mochi(host); } catch (e) { host.remove(); return; }   // no WebGL: no Mochi, chat works as before
  host.classList.add("on");
  if (window.__MOCHI_PROBE) window.__mochiProbe = m;   // tests only: the motion probe reads him frame by frame (set before the page loads)
  const on = (name, fn) => document.addEventListener(name, (e) => fn((e && e.detail) || {}));
  on("mochi:said", (d) => m.said(d.text, d.id, d.photo));
  on("mochi:mood", (d) => m.heard(d));
  on("mochi:busy", (d) => m.setBusy(d.busy));
  on("mochi:replied", (d) => m.replied(d));
  on("mochi:logged", () => m.logged());
  on("mochi:reset", () => m.reset());
  on("mochi:costume", (d) => m.wear(d.name || "", d.animate !== false));
  on("mochi:sulk", (d) => m.sulk(d.on !== false, d.animate !== false));
  on("mochi:forgive", () => m.forgive());
  on("mochi:mode", (d) => m.zd.set(d.mode === "zeroday", d.animate !== false));   // Zero Day mode on/off
  window.__mochi = { classify, isTask, costumeFor, insultKind, isApology, asksWhy, sulking: () => !!m.sulking, girlfriend: () => (m.gf ? (m.gf.leaving ? "leaving" : "here") : null), showGF: () => m.showGF(), friend: (who, role, ms, o) => m.friend(who, role, ms, o || {}), friends: () => m.friendsHere(), arrived: (who) => m.friendArrived(who), party: (o) => m.dance.start(o), partyStop: () => m.dance.stop(), partying: () => !!m.dance.on, friendAt: (x, y) => m.friendAt(x, y), pokeFriend: (who) => m.pokeFriend(who),
    say: (text) => m.say(String(text || "").slice(0, 120)),
    note: (ev) => m.note(String(ev || "").slice(0, 80)),   // something that happened on the page, for the brain   // a line in his own bubble (the page's little asides)
    sneeze: () => m.cold.sneeze(), cold: (on, until) => (on ? m.cold.start({ until: until || 0, quiet: on === "quiet" }) : m.cold.stop({ quiet: until === "quiet" })), sick: () => m.cold.on,   // Nov 3
    dismissFriend: (who) => m.dismissFriend(who),
    asleep: () => m.inBed || m.mood === "sleep" || m.mood === "bed", wake: () => { const was = m.touch(); if (was) m.run([]); return was; },   // his story never plays in his sleep (Nov 3)
    friendGrab: (who, x, y) => m.friendGrab(who, x, y), friendDrag: (who, x, y) => m.friendDrag(who, x, y), friendDrop: (who) => m.friendDrop(who),   // put them anywhere (Nov 3)
    friendSay: (who, text) => { const here = !!m.friendsHere()[who]; if (!here) m.friend(who, "hello", 30000); else m.stayFriend(who, 30000); setTimeout(() => m.scuffle.friendSay(who, text), here ? 0 : 1300); },
    stayFriend: (who, ms) => m.stayFriend(who, ms),   // keep them here a while longer (you're talking to them)   // their own bubble
    hug: (who) => m.friendMoves.hug(who),
    teachFriend: (who, move, o) => m.friendMoves.teach(who, move, o), friendPlay: (who, recipe, o) => m.friendMoves.play(who, recipe, o), teaching: () => (m.friendMoves.lesson ? m.friendMoves.lesson.phase : null), costume: () => m.wearNext ?? m.costume, wearing: () => m.costume, queue: () => m.queue.map((q) => q[0]), mood: () => m.mood, fps: () => m.fps, takeEvents: () => { const e = m.events || []; m.events = []; return e; },
    tummyPoint: () => {   // where the tummy is on screen (for tests)
      const v = m.body.localToWorld(new THREE.Vector3(0, 0.55, 0.5)).project(m.camera), r = m.canvas.getBoundingClientRect();
      return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
    }, info: () => ({ ...m.renderer.info.render, parts: m.parts.map((p) => p.kind), partsAt: m.parts.map((p) => { const v = p.mesh.position.clone().project(m.camera); return [+v.x.toFixed(2), +v.y.toFixed(2), +p.mesh.scale.x.toFixed(2), +p.mesh.material.opacity.toFixed(2), p.mesh.visible]; }), dpr: m.renderer.getPixelRatio(), shadows: m.renderer.shadowMap.enabled }), play: (n, ms) => m.run([[n, ms]]), work: (on) => { if (on !== false) m.task = true; m.setBusy(on !== false); },
    bed: () => { m.touch(); m.run([["@bed"]]); }, fx: (k, life) => m.spawn(k, life), spot: () => ({ ...m.drag, held: m.held, wild: m.wild, cur: m.cur, queue: m.queue.map((q) => q[0]) }), home: () => m.home(), snap: () => { m.renderer.render(m.scene, m.camera); return m.canvas.toDataURL(); }, pat: (dir) => m.patted(dir || 1), inBed: () => m.inBed,
    headPoint: () => {   // the top of the head on screen (for tests)
      const v = m.head.localToWorld(new THREE.Vector3(0, 0.36, 0.3)).project(m.camera), r = m.canvas.getBoundingClientRect();
      return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
    }, headAt: (x, y) => { const h = m.headAt(x, y); return h && { x: h.x, y: h.y, z: h.z }; }, quietFor: (ms) => { m.lastActive = performance.now() - ms; }, sleep: () => { m.lastActive = performance.now() - DOZE_MS - 1000; m.run([]); } };
  // day 2–3: moves and props (the brain/body contract: the page passes recipes from the server)
  const C = m.craft;
  const limbs = () => ({ arms: m.arms.map((a) => [a.rotation.x, a.rotation.z]), legs: m.legs.map((l) => l.rotation.x), neck: [m.neck.rotation.x, m.neck.rotation.y, m.neck.rotation.z],
    root: [m.root.position.y, m.root.rotation.y, m.root.rotation.z], body: m.body.rotation.x, mood: m.mood, prop: C.holding() });
  window.__mochi.zeroDay = (on, animate = true) => m.zd.set(on, animate);
  window.__mochi.zdBench = (job) => m.zd.bench(job);           // Zero Day: what his workbench is making, on his monitors
  window.__mochi.glitch = (ms, k) => m.zd.glitchNow(ms, k);      // Zero Day: a glitch right now
  window.__mochi.zdQuiet = (on = true) => { m.zd.noGlitch = !!on; };   // tests: no random glitches
  window.__mochi.zdState = () => { const Z = m.zd; return { on: Z.on, k: +Z.k.x.toFixed(2), rig: !!(Z.rig && Z.rig.group.visible), hood: !!(Z.hood && Z.hood.group.visible), keys: !!(Z.keys && Z.keys.group.visible && Z.keys.board.visible), phone: +m.P.phone.x.toFixed(2), downloads: Z.dl ? Z.dl.jobs.length : 0, screens: Z.rig ? Z.rig.screens.length : 0, job: Z.rig && Z.rig.job ? { name: Z.rig.job.name, done: !!Z.rig.job.done, lines: (Z.rig.job.lines || []).length } : null }; };   // tests
  window.__mochi.mode = () => (m.zd.on ? "zeroday" : "normal");
  const H = m.hs;
  window.__mochiHandshake = {
    set: (steps) => H.set(steps), steps: () => H.steps, state: () => ({ mode: H.mode, idx: H.idx, rec: H.rec.map((s) => s.g), next: H.steps && H.mode === "together" && H.steps[H.idx] ? H.steps[H.idx].g : null }),
    teach: () => H.teachStart(), done: () => H.teachDone(), cancel: () => H.teachCancel(), again: () => H.again(), save: (steps) => H.save(steps),
    offer: (o) => H.offer(o), care: (on) => { H.care = !!on; }, awayMs: (ms) => { H.awayMs = Math.max(5000, +ms || 25000); },
    input: (g) => H.input(g), where: (x, y) => H.where(x, y), returned: (why) => H.returned(why || "pointer"), spots: () => H.spots(),
    away: (ms) => { H.seen = performance.now() - ms; m.lastActive = performance.now() - ms; H.lastDone -= ms; H.lastOffer -= ms; },   // tests: as if nobody's been here for ms
  };
  window.__mochiMoves = {
    play: (recipe, o = {}) => C.play(recipe, o),
    stop: () => C.stop(),
    playing: () => (C.perf ? { name: C.perf.name, skill: C.perf.skill, t: (performance.now() - C.perf.t0) / 1000 } : null),
    last: () => (C.lastPerf ? { id: C.lastPerf.id, name: C.lastPerf.name, skill: C.lastPerf.skill } : null),
    pose: { start: () => C.poseStart(), done: (name, o) => C.poseDone(name, o), cancel: () => C.poseCancel(), active: () => !!C.posing, set: (ch, v) => C.poseSet(ch, v),
      anchors: () => C.anchors().map(([p, w]) => [p, C.screen(w)]) },
    limbs,
    lite: () => { m.dpr = 1; m.resize(); m.quality = 1; m.lighten(); },   // tests: no soft shadows, one pixel per pixel
    trace: (ms) => new Promise((done) => { const out = [], t0 = performance.now(); m.onFrame = (now) => { out.push({ t: now - t0, ...limbs() }); if (now - t0 >= ms) { m.onFrame = null; done(out); } }; }),
  };
  window.__mochiProps = {
    act: (spec, o) => m.propAct.run(spec, o || {}), acting: () => m.propAct.busy(),   // a prop used on another (Nov 7)
    hold: (recipe, o) => C.hold(recipe, o),
    summon: (x, o = {}) => (x && (x.recipe || x.parts) ? C.hold(x.recipe || x, { ms: 9000, ...o }) : { ok: false, errors: ["no recipe"] }),
    putAway: () => C.letGo(false),
    current: () => C.holding(),
    fire: () => C.fire(),
    paintProbe: () => C.acts.probe(),   // tests: where the brush meets the canvas
    paintAim: (x, y) => { if (C.acts.cur) C.acts.cur.aimAt = x == null ? null : [x, y]; },
    activityState: () => { const A = C.acts.cur; return A ? { kind: A.kind, trick: A.trick || null, el: Math.round(performance.now() - A.t0), finished: !!A.finished, drops: A.drops || 0 } : null; },   // tests
    activity: (spec) => { if (C.rider && C.rider.riding()) C.letGo(false); m.task = false; if (m.P.glasses) m.P.glasses.t = 0; return C.acts.start(spec); },   // (no "food job" glasses: he's really doing it) activityBusy: () => C.acts.busy(), stopActivity: () => C.acts.stop(),   // painting, juggling, party tricks (Nov 3)
    passenger: (who) => C.rider.board(who), unboard: () => C.rider.unboard(), inCar: () => C.rider.passenger(), driving: () => !!C.rider.trip,   // a friend in the back seat (Nov 3)
    pointAt: (x, y) => C.pointAt(x, y),   // a tap on the stage (client px): use the prop under it, or aim a held launcher there
    use: () => C.useProp(),
    study: (x, o) => C.studyProp(x, o),   // take it out and look at it (a globe before answering a geography question)
    atViewer: () => C.atViewer(),          // fire a held launcher out of the screen at whoever's watching
    cheer: () => C.cheer(),                // fire it up into the air
    keep: (ms) => C.keep(ms),
    // soft-toy throws: fight([{ from: "mochi"|"cocoa", at: "cocoa"|"mochi"|"viewer"|null }], { ball, shield })
    fight: (steps, o) => m.scuffle.fight(steps, o),
    friendStroll: (who) => m.friendStroll(who),   // "Mimi, walk around"
    peekFriend: (who, o) => m.peekFriend(who, o),       // heard their name: a peek round the edge of the screen
    piggyback: (who, o) => m.piggy.start(who, o || {}), piggybacking: () => m.piggy.busy(),   // a friend on his back (Nov 4)
    share: (who, recipe, o) => m.friendMoves.share(who, recipe, o || {}), sharing: () => m.friendMoves.sharing(),
    friendWear: (who, recipe) => m.friendMoves.wear(who, recipe), friendUnwear: (who, slot) => m.friendMoves.unwear(who, slot || null), friendWearing: (who) => m.friendMoves.wearing(who),   // dressing up (Nov 7)
    friendHold: (who, recipe, ms) => m.friendMoves.holdFor(who, recipe, ms),
    takeOff: (slot) => C.takeOff(slot, false), dropFriendProp: (who) => m.friendMoves.dropProp(who),   // he shares it with them (Nov 4): food to eat, things to hold
    carry: (who, recipe) => m.friendMoves.carry(who, recipe), handOver: (who) => m.friendMoves.handOver(who), carrying: (who) => !!m.friendMoves.carrying(who),   // a friend brings him something (a little scene)
    eat: (o) => C.eat(o || {}),                   // he eats (or drinks) what's in his hoof (or beside him: he picks it up)
    edible: (name) => C.edible(name || null), eatStyle: (name) => eatStyle(name || (C.prop ? C.prop.recipe.name : "")),
    waterFight: (f, o) => m.scuffle.waterFight(f, o),   // a water fight with Cocoa, both with water guns (Nov 4)
    waterFighting: () => !!m.scuffle.wf,
    shelf: (list) => m.shelf.set(list),       // his props on the bookcase: [{id, name, recipe, origin, …}]
    shelfAt: (x, y) => m.shelf.pick(x, y),    // the one under a tap (client px), or null
    story: (p) => shelfStory(p),              // where it came from, in his words
    throwAt: (x, y) => C.pointAt(x, y),
    aimAtFriend: (who) => C.aimAtFriend(who),
    // pulling props about: off his bookcase, his chips or the floor; let go over Mochi, Cocoa or Mimi to give it to
    // them, anywhere else to put it down (floor.js)
    dragBegin: (prop, x, y, o) => m.floor.begin(prop, x, y, o), dragMove: (x, y) => m.floor.move(x, y), dragEnd: (x, y) => m.floor.end(x, y),
    dragCancel: () => m.floor.cancel(), dragging: () => !!m.floor.drag, floorAt: (x, y) => m.floor.pick(x, y), floorTake: (item, who) => m.floor.take(item, who),
    floorRecent: (ms) => m.floor.recent(ms), floorClear: () => { m.floor.clearAll(); m.scenery.clear(); }, floorItems: () => m.floor.names(),
    scenery: (list) => m.scenery.add(list), sceneryClear: () => m.scenery.clear(), sceneryNames: () => m.scenery.names(),   // the story's scenery (Nov 5)
    // moving and turning by hand (Nov 3): a floor prop you've selected, or the one he holds or wears
    floorSelect: (item) => m.floor.select(item), floorSelected: () => { const it = m.floor.selected(); return it ? { name: it.prop.name, ry: it.ry, rz: it.rz, item: it } : null; },
    floorTurn: (deg, item) => m.floor.turn(item, deg), floorTip: (deg, item) => m.floor.tip(item, deg), floorNudge: (dx, dz, item) => m.floor.nudge(item, dx, dz),
    floorReset: (item) => m.floor.reset(item), floorRemove: (item) => m.floor.remove(item), floorScreen: (item) => m.floor.screenOf(item), floorRestore: (props) => m.floor.restore(props),
    heldInfo: (which) => { const H = C.heldInfo(which); return H && { name: H.name, slot: H.slot, worn: H.worn, ride: H.ride, launcher: H.launcher, heavy: H.heavy, archetype: H.recipe.archetype }; },
    heldRecipe: (which) => { const H = C.heldInfo(which); return H ? H.recipe : null; }, heldAdjust: (axis, deg, which) => C.adjustHeld(axis, deg, which), heldScreen: (which) => C.heldScreen(which),
    dragGive: (who) => m.floor.giveDragged(who),
    heldAt: (x, y) => { const h = C.propHit(x, y); return h ? (h === "worn" ? "worn" : "hand") : null; },   // "shoot Cocoa": aim the held launcher (or throw the ball) at a friend on stage
    guard: () => ({ ...m.scuffle.guard, blocks: { ...m.scuffle.guard.blocks } }),
    resetGuard: () => m.scuffle.resetGuard(),
    fighting: () => m.scuffle.busy(),
    screenOf: (who) => m.scuffle.screenOf(who),
    ride: () => C.rider.go(),                // on a bike, trike or board: ride across the stage and back
    teachUse: (name, move) => C.teachUse(name, move),   // the way you taught him to use a prop: {id, name, recipe, skill}
    uses: () => [...C.uses.keys()],
    currentRecipe: () => (C.prop && !C.prop.leaving ? C.prop.base : null),
    riding: () => !!C.rider.trip,
    heavy: () => HEAVY,                      // the big launcher's carry pose (for tuning)
  };
  // standing up, sitting down, going for a walk
  Object.assign(window.__mochi, { stand: () => C.stance.stand(), sit: () => C.stance.sit(), walk: (o) => C.stance.walk(o), stance: () => C.stance.state(),
    // pointing: "go there" / "look at that" at a screen point; speaking: the page feeds his voice level (0..1) every frame
    walkTo: (x, y) => { const p = m.stagePoint(x, y); return p ? C.stance.walkTo(p.x - m.actor.position.x) : false; },
    lookAt: (x, y, ms = 2600) => { const p = m.stagePoint(x, y); if (!p) return false; m.head.getWorldPosition(m._gp || (m._gp = new THREE.Vector3())); const d = p.clone().sub(m._gp), yaw = Math.atan2(d.x, Math.max(0.5, d.z + 7.6)), pitch = -Math.atan2(d.y, 7); m.gaze = { t0: performance.now(), until: performance.now() + ms, yaw: Math.max(-0.9, Math.min(0.9, yaw * 1.3)), pitch: Math.max(-0.5, Math.min(0.45, pitch)), lookX: Math.max(-1, Math.min(1, yaw * 2)), lookY: Math.max(-1, Math.min(1, -pitch * 2)) }; m.touch(); return true; },
    speaking: (level) => { m.voiceLevel = Math.max(0, Math.min(1, +level || 0)); m.voiceAt = performance.now(); },
    // the face for what he's saying, for ms: "sad", "sorry", "worried", "scared", "cross" (anything else: his own face)
    speakingTone: (tone, ms = 3000) => { const f = TALK_TONES[tone]; m.talkTone = f ? { face: f, until: performance.now() + Math.max(400, Math.min(20000, +ms || 3000)), linger: TONE_LINGER[tone] || 0 } : null; },
  });
}
if (typeof document !== "undefined") start();
