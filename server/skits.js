// Little scenes from the conversation (Nov 4, Binoy: "I want some of the actions to follow a story (that is not the
// same every time). like if I tell mochi if he has eaten something and he is like 'no not yet' and then mimi shows up
// with some food and she is like 'I thought I'd get you some food' and mochi is surprised cause it was unexpected but
// happy and thanks mimi and maybe even tells the user how sweet mimi is… it would be nice if the local llm could create
// a story like that and then have the characters play out that story").
//
// A moment in the talk (he hasn't eaten, he's sleepy, it's cold, he or you are down, he's bored, you've good news, a
// birthday, he misses a friend, or you just ask for a story) sometimes gets a scene: Gemma writes a short one, fresh
// each time (who comes, what they bring, how it goes, told what the last few were so it doesn't repeat them), and the
// page acts it out beat by beat with the kit: a friend arriving with something, handing it over, him eating it,
// faces, hugs, a dance, a word to you. A hand-written one (a few to pick from) stands in when the model is down.
//
// Beat shape: { who: "mochi"|"mimi"|"cocoa", do: DO, with?: THING, how?: FEEL, line?: string }
//   arrive     who (a friend) comes by on their own, carrying `with` if given
//   call       mochi calls who2 (`line` is what he calls) and they come
//   say        mochi says line (to his friends)
//   aside      mochi says line to you, the person watching ("Isn't Mimi the sweetest?")
//   friend_say who (a friend) says line
//   give       who (a friend) hands mochi what they brought (`with`); he holds it, or puts it on if it's to wear
//   eat        mochi eats or drinks what he's holding
//   use        mochi uses what he's holding (twirls the umbrella, plays the guitar, pops the popper)
//   feel       who shows a feeling: how = surprised, happy, love, shy, laugh, excited, proud, sleepy, thinking, sad
//   hug        who (a friend) and mochi hug
//   dance      who dances (mochi: everyone does)
//   piggyback  who (a friend) hops on his back and he carries them about (Nov 4)
//   leave      who (a friend) goes home
//   dress      who dresses up for a job: with = a job (shared/jobs.js: doctor, police, chef…): its hat or outfit and
//              its tool go on (Nov 7, Binoy: "maybe they could even use it in a skit")
import { stripActions } from "./brain.js";
import { PROP_EXAMPLES } from "../shared/craft.js";
import { momentOfDay, spice, tooLike, seedNow, wobble } from "./variety.js";
import { JOBS, JOB_IDS, jobOf, jobsIn, outfit } from "../shared/jobs.js";
import { scamGameAsk, scamScene, afterScene, callScene, choiceScene } from "./scams.js";

const POCKET = Object.values(PROP_EXAMPLES).flat();
export const DO = ["arrive", "call", "say", "aside", "friend_say", "give", "eat", "use", "feel", "hug", "dance", "piggyback", "leave", "dress"];
export const FEEL = ["surprised", "happy", "love", "shy", "laugh", "excited", "proud", "sleepy", "thinking", "sad"];
// what a friend can bring (the workshop's own patterns, so they're ready at once)
export const THINGS = {
  food: ["cupcake", "bowl of soup", "cookie", "apple", "pizza slice", "popcorn", "ice cream cone"],
  drink: ["cup of tea", "hot cocoa"],
  cosy: ["scarf", "sweater", "nightcap", "little teddy bear"],
  cheer: ["potted sunflower", "flower crown", "little teddy bear", "present", "guitar", "star wand", "book"],
  party: ["birthday cake", "party hat", "confetti popper", "present"],
  play: ["foam ball", "soccer ball", "guitar", "toy drum", "book"],
  rain: ["little blue umbrella"],
};
const ALL_THINGS = [...new Set(Object.values(THINGS).flat())];
export const EDIBLE = new Set([...THINGS.food, ...THINGS.drink]);
const Name = (w) => (w === "mimi" ? "Mimi" : "Cocoa");
const FRIENDS = `Mimi is his girlfriend: sweet and caring, a big pink bow, thinks of others; now and then she says "eep!" or "hehe" or adds a ♡. Cocoa is his best buddy: a brown sheep with a teal bandana, sporty, goofy and loyal, shows he cares by being silly; now and then he says "dude" or "bro".`;
// a shape for each scene, so they don't all go the same way (Gemma, left to itself, wrote eight scenes in a row as
// "Cocoa turns up with a thing, 'You scared me!', he gives it, Mochi eats it, Mimi turns up, 'Cocoa is such a good
// friend!'"); the last few used are skipped
export const SHAPES = [
  { id: "plain", text: "the friend turns up out of the blue with just the right thing; Mochi is surprised, then happy, thanks them, and tells the person watching how sweet that was" },
  { id: "call", text: "Mochi calls a friend over himself (a call beat), and they come running" },
  { id: "shy", text: "the friend is a little shy about their surprise and isn't sure he'll like it; he loves it, and they go all happy and bashful" },
  { id: "both", text: "both friends turn up one after the other, each trying to help in their own way, and it ends with them all together" },
  { id: "mixup", text: "there's a tiny mix-up first (they bring the wrong thing, or both bring the same thing, or they think he's asleep), then it works out and everyone laughs" },
  { id: "share", text: "Mochi shares the moment with the friend: they eat or play together, and he says something sweet to them" },
  { id: "piggy", text: "it ends with a piggyback ride (a piggyback beat)" },
  { id: "dance", text: "it ends with everyone dancing" },
  { id: "bye", text: "the friend can only stay a moment and goes home at the end (a leave beat), and Mochi tells the person watching how kind that was" },
  { id: "cool", text: "the friend acts like it's no big deal, but Mochi can tell how much they care, and says so to the person watching" },
];
export function pickShape(recentShapes = [], rnd = Math.random, need = "") {
  const avoid = new Set(recentShapes.slice(-3)), ok = SHAPES.filter((x) => !avoid.has(x.id) && !(need === "sad_you" && x.id === "mixup") && !((need === "good_news" || need === "birthday") && (x.id === "shy" || x.id === "bye")));
  return pick(ok.length ? ok : SHAPES, rnd);
}

/* ---------- the moments ---------- */
const T = (s) => String(s || "").toLowerCase().replace(/[’`]/g, "'");
const NOT_YET = /\b(not yet|nope|no,? i haven'?t|haven'?t (eaten|had)|i forgot( to eat)?|nothing yet|not really|no\b.{0,30}\b(hungry|tummy|starving|rumbl))/;
const MOMENTS = [
  // the scam-spotting game (Nov 7, scams.js): "play the scam game", "teach me about scams"; always hand-written
  { need: "scam", chance: 1, test: (t) => scamGameAsk(t) },
  // pretend jobs (Nov 7): "do a skit where Mimi is a doctor", "let's play pretend: Cocoa's a police officer", "put on a
  // play about firefighters": the scene has them dress up and play the part
  { need: "jobs", chance: 1, test: (t) => jobsIn(t).length > 0 && /\b(?:skit|scene|story|play pretend|pretend|act (?:it )?out|put on a (?:show|play)|role ?play|play (?:a game of )?(?:doctors?|hospital|police|cops|firefighters?|restaurant|school|detectives?|astronauts?|farm)\b)/.test(t) && /\b(?:mimi|cocoa|friends|everyone|all|together|skit|scene|story|play)\b/.test(t) },
  { need: "story", chance: 1, test: (t) => /\b(tell|show|act out|make up|play out|do|have|want|watch|see|start|put on)\b.{0,20}\b(a |me a |us a |another |one more )?(little |short |new |fun )?(story|skit|scene|play)\b/.test(t) || /\bwhat('s| are| is) (mimi|cocoa|your friends) (up to|doing)\b/.test(t)
    || (t.length <= 60 && /\bskits?\b/.test(t)) },   // (Nov 7: "Have a skit" on the share link wasn't heard as one)
  { need: "hungry", test: (t, r) => (/\b(have|did) (you|u) (eat|eaten|had (any(thing)? to eat|lunch|dinner|breakfast|a snack|food|something))\b|\b(are|r) (you|u) hungry\b|\banything to eat\b/.test(t) && NOT_YET.test(r)) || /\b(i'?m|so|getting|a bit|kinda) (hungry|starving|peckish)\b|\btummy('s| is)? (rumbl|grumbl)/.test(r) },
  { need: "thirsty", test: (t, r) => /\b(i'?m|so|a bit|kinda) thirsty\b/.test(r) || (/\b(are|r) (you|u) thirsty\b/.test(t) && !/\bno\b/.test(r.slice(0, 20))) },
  { need: "tired", test: (t, r) => (/\b(are|r) (you|u) (tired|sleepy)\b/.test(t) && /\b(yes|yeah|a (little|bit)|kinda|so|very|sleepy|yawn)/.test(r)) || /\b(i'?m|so|a bit|kinda|getting) (tired|sleepy)\b|\*?yawn/.test(r) },
  { need: "cold", test: (t, r) => /\b(it'?s|so|really|freezing|getting) (cold|chilly|freezing)\b|\bsnow(ing)?\b/.test(t) || /\bbrr+\b|\b(i'?m|so) (cold|chilly)\b/.test(r) },
  { need: "rain", test: (t) => /\b(it'?s|is) (raining|pouring)\b|\brainy\b/.test(t) },
  { need: "sad_him", test: (t, r, f) => f.mood === "sad" && /\b(i'?m|feeling|feel) (a (bit|little) )?(sad|lonely|down|blue)\b|\bi miss\b/.test(r) },
  { need: "sad_you", test: (t, r, f) => !f.crisis && /\b(i'?m|i feel|feeling) (so |really |a bit |kinda )?(sad|down|lonely|stressed|tired|exhausted|blue|bummed)\b|\b(had|having) a (really |very |super |pretty |kinda )?(bad|rough|long|hard|tough|awful) day\b|\b(my day|today) (was|has been) (bad|rough|awful|terrible|hard)\b/.test(t) },
  { need: "bored", test: (t, r) => (/\b(are|r) (you|u) bored\b/.test(t) && /\b(yes|yeah|a (little|bit)|kinda|so)/.test(r)) || /\b(i'?m|i am|so) bored\b/.test(r) || /\b(i'?m|i am) (so |really )?bored\b/.test(t) },
  { need: "good_news", test: (t, r, f) => !f.crisis && /\b(i (got|passed|won|aced|finished|made it|did it)|got (the|a) (job|promotion|offer|a)|i'?m (engaged|getting married)|good news)\b/.test(t) && !/\b(didn'?t|not|no)\b.{0,8}\b(got|pass|win)/.test(t) },
  { need: "birthday", test: (t) => /\b(my|it'?s my|today is my) (birthday|bday)\b|\bhappy birthday\b/.test(t) },
  { need: "miss", test: (t) => /\b(do you miss|where('s| is)|have you seen|what about|how('s| is)) (mimi|cocoa)\b/.test(t) },
];
const NEED_TEXT = {
  scam: "they asked for the scam-spotting game",
  scam_after: "they answered what looked fishy in the scam-spotting game",
  scam_choice: "they chose what Mimi should do on the scam call",
  jobs: "they asked for a pretend-play scene where the friends dress up for jobs and play the part",
  story: "they asked for a little story with his friends",
  hungry: "Mochi just told them he hasn't eaten yet (or he's hungry)",
  thirsty: "Mochi is thirsty",
  tired: "Mochi is sleepy and tired",
  cold: "it's cold and Mochi is chilly",
  rain: "it's raining outside",
  sad_him: "Mochi is feeling a bit sad or lonely",
  sad_you: "the person watching is having a hard time (sad, stressed or tired); the friends come to cheer them up, gently",
  bored: "Mochi is bored",
  good_news: "the person watching just shared good news; the friends come to celebrate them",
  birthday: "it's a birthday; the friends come to celebrate",
  miss: "they just asked about a friend; that friend shows up",
};
const NEED_THINGS = { hungry: [...THINGS.food, ...THINGS.drink], thirsty: THINGS.drink, tired: ["nightcap", "cup of tea", "hot cocoa", "little teddy bear"], cold: ["scarf", "sweater", "hot cocoa", "cup of tea"], rain: THINGS.rain, sad_him: THINGS.cheer.concat(["cupcake", "hot cocoa"]), sad_you: THINGS.cheer.concat(["cupcake", "cookie"]), bored: THINGS.play, good_news: THINGS.party, birthday: THINGS.party, miss: ["potted sunflower", "cookie", "present", "flower crown"], story: ALL_THINGS };

// "again", "another one", "have a skit" right after a scam game (within 10 minutes): the scam game again (Nov 7)
const AGAIN = /^(?:(?:ok(?:ay)?|yes|yeah|sure|more|cool|wow)[,!.]?\s*)*(?:(?:can (?:we|you) |let'?s |please |pls )?(?:do|play|have|show|try|watch)?\s*(?:it|that|this)?\s*(?:again|another(?: one)?|one more(?: time)?|the next one|more)|(?:have|do|show|want|another|one more|a) (?:(?:a|another|one more) )?(?:skit|scene|one|game))\b/;
/** a moment in what was just said that a scene could follow: { need, text, who? } or null.
 * f.lastNeed / f.lastAt: the last scene's moment and when (index.js), so "again" carries on the same game */
export function skitMoment(userText, reply, f = {}) {
  const t = T(userText), r = T(stripActions(String(reply || "")).text);
  if (f.lastNeed && /^scam/.test(f.lastNeed) && Date.now() - (f.lastAt || 0) < 10 * 60000 && t.length <= 60 && (AGAIN.test(t) || /^(?:have|do|show|play) (?:a |another )?skit\b/.test(t)) && !/\b(?:mimi|cocoa) (?:is|as) a\b/.test(t))
    return { need: "scam", text: NEED_TEXT.scam, who: /\bmimi\b/.test(t) ? "mimi" : /\bcocoa\b/.test(t) ? "cocoa" : null, chance: 1 };
  for (const M of MOMENTS) {
    if (!M.test(t, r, f)) continue;
    const named = /\bmimi\b/.test(t) ? "mimi" : /\bcocoa\b/.test(t) ? "cocoa" : null;
    return { need: M.need, text: NEED_TEXT[M.need], who: named, chance: M.chance ?? 0.7, ...(M.need === "jobs" ? { jobs: [...new Set(jobsIn(t).map((j) => j.id))] } : {}) };
  }
  return null;
}

/** Who comes (decided before the scene's written, so they can peek in while it is: "Not eaten yet? Hmm… ♡", then
 * off to fetch something): the friend named, or one of them; both for a celebration (Mimi peeks). */
export function skitLead(moment, rnd = Math.random) {
  if (moment.who) return { who: moment.who, both: false };
  if (moment.need === "good_news" || moment.need === "birthday") return { who: "mimi", both: true };
  return { who: rnd() < 0.55 ? "mimi" : "cocoa", both: false };
}
const PEEK = {
  scam: { mimi: ["Mochi! Wait, my phone just buzzed… ♡", "Ooh, Mochi, I got a message! One sec! ♡"], cocoa: ["Bro! Hold up, my phone's going off…", "Dude, wait, I got a message!"] },
  jobs: { mimi: ["Dress-up time? Ooh, wait for me! ♡", "Pretend jobs? I'll get my things! ♡"], cocoa: ["Dress-up? Hold on, bro, I'm getting my gear!", "Pretend jobs? Be right back, dude!"] },
  hungry: { mimi: ["Not eaten yet? Hmm… ♡", "No food yet?! Oh, I know… ♡"], cocoa: ["No food?! Hold on, bro…", "Hungry, dude? Say no more…"] },
  thirsty: { mimi: ["Thirsty? Wait right there~ ♡"], cocoa: ["Thirsty? I got you, bro…"] },
  tired: { mimi: ["Sleepy Mochi… I have an idea ♡"], cocoa: ["Tired, dude? Hang on…"] },
  cold: { mimi: ["Brr, poor Mochi! One sec~ ♡"], cocoa: ["Cold? Not on my watch, bro…"] },
  rain: { mimi: ["Rain?! Oh, I know just the thing ♡"], cocoa: ["Rain? Hold up, dude…"] },
  sad_him: { mimi: ["Aww, Mochi… wait for me ♡"], cocoa: ["Bro's sad? Not for long…"] },
  sad_you: { mimi: ["Oh no… I'll be right there ♡"], cocoa: ["Hard day? Cheer squad, assemble…"] },
  bored: { mimi: ["Bored? Ooh, I have an idea ♡"], cocoa: ["Bored?! Hold that thought, dude…"] },
  good_news: { mimi: ["Wait, good news?! Cocoaaa! ♡"], cocoa: ["Good news?! Party time…"] },
  birthday: { mimi: ["A birthday?! Cocoaaa! ♡"], cocoa: ["Birthday?! Hold up…"] },
  miss: { mimi: ["Hm? Someone missed me? ♡"], cocoa: ["Did someone say Cocoa?"] },
  story: { mimi: ["A story? Ooh, me too! ♡"], cocoa: ["A story? Count me in, dude…"] },
};
/** what they say peeking in: they heard, and they're off to do something about it */
export function skitPeekLine(need, who, rnd = Math.random) {
  const L = (PEEK[need] || {})[who] || (who === "mimi" ? ["Hmm… I have an idea! ♡"] : ["Ooh, hold on, dude…"]);
  return pick(L, rnd);
}

/* ---------- writing one ---------- */
export const SKIT_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    title: { type: "string" },
    beats: { type: "array", minItems: 4, maxItems: 10, items: { type: "object", additionalProperties: false,
      properties: { who: { type: "string", enum: ["mochi", "mimi", "cocoa"] }, do: { type: "string", enum: DO }, with: { type: "string", enum: [...ALL_THINGS, ...JOB_IDS, ""] }, how: { type: "string", enum: [...FEEL, ""] }, line: { type: "string" } },
      required: ["who", "do", "with", "how", "line"] } },
  },
  required: ["title", "beats"],
};

const pick = (a, rnd = Math.random) => a[Math.floor(rnd() * a.length)];

/** hand-written scenes, a few per moment, for when the model can't write one */
export function fallbackSkit(moment, { rnd = Math.random } = {}) {
  const need = moment.need, who = moment.who || (rnd() < 0.55 ? "mimi" : "cocoa"), N = Name(who), mimi = who === "mimi";
  const thing = pick(NEED_THINGS[need] || THINGS.cheer, rnd), eat = EDIBLE.has(thing);
  const bring = (line, thanks, aside, { then = [], end = "hug" } = {}) => [
    { who, do: "arrive", with: thing, line: "" },
    { who, do: "friend_say", line },
    { who: "mochi", do: "feel", how: "surprised", line: "" },
    { who, do: "give", with: thing, line: "" },
    { who: "mochi", do: "say", line: thanks },
    ...(eat ? [{ who: "mochi", do: "eat", line: "" }] : []),
    ...then,
    { who: "mochi", do: "feel", how: "happy", line: "" },
    ...(aside ? [{ who: "mochi", do: "aside", line: aside }] : []),
    ...(end === "hug" ? [{ who, do: "hug", line: "" }] : end === "piggyback" ? [{ who, do: "piggyback", line: mimi ? "Hehe, carry me! ♡" : "Giddy-up, bro!" }] : []),
  ];
  const variants = {
    hungry: [
      () => bring(mimi ? `I had a feeling you hadn't eaten… so I brought you a ${thing}! ♡` : `Dude! Heard your tummy from across the street. ${thing[0].toUpperCase() + thing.slice(1)}?`, mimi ? "Mimi! For me? You're the best!" : "Cocoa! You read my mind, bro!", mimi ? "Isn't Mimi the sweetest?" : "Best buddy ever, right?"),
      () => [{ who: "mochi", do: "feel", how: "sad", line: "" }, { who: "mochi", do: "say", line: "My tummy's rumbling…" }, ...bring(mimi ? `Knock knock! Snack delivery~ ♡` : `Snack patrol, reporting for duty!`, "No way! Thank you!", mimi ? "She always knows. ♡" : "Cocoa's the best, I'm telling you.")],
    ],
    thirsty: [() => bring(mimi ? `You looked thirsty… here's a ${thing}! ♡` : `One ${thing}, extra cosy, dude.`, "Ooh, just what I needed!", "Friends who bring you drinks are the best kind.")],
    tired: [() => bring(mimi ? `Sleepy? I brought you something cosy ♡` : `Yo, nap time gear, bro.`, "Aww… thank you…", "I'm so lucky, aren't I?")],
    cold: [() => bring(mimi ? `Brr! Here, this will keep you warm ♡` : `Dude, you're shivering! Take this.`, "So warm! Thank you!", `${N} always looks out for me.`)],
    rain: [() => bring(mimi ? `I didn't want you to get wet! ♡` : `Rain? Got you covered, bro.`, "Aww, you came all this way!", "Rain's not so bad with friends.")],
    sad_him: [() => bring(mimi ? `Hey you… I brought you a little something ♡` : `Bro. Sad face? Not on my watch.`, "You came just for me?", "I feel better already.")],
    sad_you: [() => [{ who, do: "arrive", with: thing, line: "" }, { who, do: "friend_say", line: mimi ? "We heard someone's having a hard day… ♡" : "Yo! Cheer-up squad, reporting in!" }, { who: "mochi", do: "feel", how: "happy", line: "" }, { who, do: "give", with: thing, line: "" }, { who: "mochi", do: "aside", line: `This is for you! From ${N} and me.` }, { who, do: "dance", line: "" }, { who: "mochi", do: "aside", line: "We're right here. Feel better soon, okay?" }]],
    bored: [
      () => bring(mimi ? `Boooored? Not anymore! ♡` : `Bored? Let's play, dude!`, "Yes! Let's go!", "Never a dull day with these two.", { then: [{ who: "mochi", do: "use", line: "" }] }),
      () => [{ who, do: "arrive", with: "", line: "" }, { who, do: "friend_say", line: mimi ? "Mochi! Piggyback ride, pleeease? ♡" : "Bro. Piggyback. Now. It's important." }, { who: "mochi", do: "feel", how: "laugh", line: "" }, { who: "mochi", do: "say", line: mimi ? "Okay, hop on! Hold tight!" : "Oof… okay, okay, hop on!" }, { who, do: "piggyback", line: "" }, { who: "mochi", do: "aside", line: mimi ? "Best way to not be bored. ♡" : "Cocoa's heavier than he looks…" }],
    ],
    good_news: [() => [{ who: "mimi", do: "arrive", with: "party hat", line: "" }, { who: "cocoa", do: "arrive", with: "", line: "" }, { who: "cocoa", do: "friend_say", line: "We heard the news! Party time, dude!" }, { who: "mimi", do: "friend_say", line: "Congratulations!! ♡" }, { who: "mimi", do: "give", with: "party hat", line: "" }, { who: "mochi", do: "feel", how: "excited", line: "" }, { who: "mochi", do: "dance", line: "" }, { who: "mochi", do: "aside", line: "We're so proud of you!" }]],
    birthday: [() => [{ who: "mimi", do: "arrive", with: "birthday cake", line: "" }, { who: "cocoa", do: "arrive", with: "party hat", line: "" }, { who: "mimi", do: "friend_say", line: "Surprise! Happy birthday! ♡" }, { who: "cocoa", do: "give", with: "party hat", line: "" }, { who: "mochi", do: "feel", how: "excited", line: "" }, { who: "mimi", do: "give", with: "birthday cake", line: "" }, { who: "mochi", do: "dance", line: "" }, { who: "mochi", do: "aside", line: "Happy birthday! Make a wish!" }]],
    miss: [() => [{ who, do: "arrive", with: "", line: "" }, { who, do: "friend_say", line: mimi ? "Did somebody say my name? ♡" : "Somebody call for the Cocoa?" }, { who: "mochi", do: "feel", how: "surprised", line: "" }, { who: "mochi", do: "say", line: `${N}! We were just talking about you!` }, { who, do: "hug", line: "" }, { who: "mochi", do: "aside", line: mimi ? "See? She's the best. ♡" : "Told you he's awesome." }]],
    jobs: [() => {   // a check-up at Dr. Mimi's (or whichever job they named, played the same way)
      const job = (moment.jobs || [])[0] || "doctor", J = JOBS[job], pro = mimi ? "mimi" : "cocoa", other = mimi ? "cocoa" : "mimi";
      const call = { doctor: "Dr.", police: "Officer", firefighter: "Firefighter", chef: "Chef", pilot: "Captain", detective: "Detective", judge: "Judge", teacher: "Teacher", scientist: "Professor" }[job] || "";
      const open = { doctor: "Next patient, please!", police: "Halt! Snack inspection!", firefighter: "Nee-naw! Who needs rescuing?", chef: "Welcome to my kitchen!", pilot: "Welcome aboard, everyone!", detective: "Hmm… I sense a mystery.", engineer: "Hard hats on! Let's build!", farmer: "Howdy! The crops are growing!", artist: "Hold still, I'm painting you!", astronaut: "Three, two, one… blast off!", teacher: "Class is in session!", scientist: "Time for an experiment!", judge: "Order in the court!" }[job] || "Ready for work!";
      const ask = { doctor: "Doc, I ate twelve cookies… my tummy's funny.", police: "Uh oh… I only took ONE cookie, officer!", firefighter: "Help! My cocoa is too hot!", chef: "One extra-fluffy pancake, please!", pilot: "Are we there yet?", detective: "Somebody took my sandwich!", engineer: "Can you fix my wobbly chair?", farmer: "Can I help water the carrots?", artist: "Do I look fluffy enough?", astronaut: "Can I come to the moon too?", teacher: "Ooh, ooh, I know the answer!", scientist: "Will it go boom?", judge: "Your Honor, I'm innocent!" }[job] || "Can you help me?";
      const fix = { doctor: "Hmm… you need a hug and no more cookies today!", police: "Case closed: cookies for everyone!", firefighter: "Whoosh! All cooled down!", chef: "One pancake, with a cherry on top!", pilot: "Buckle up, we're landing!", detective: "The crumbs lead to… Mochi!", engineer: "Fixed! Good as new!", farmer: "Of course! Grab a can!", artist: "Voilà! A masterpiece!", astronaut: "There's room for two!", teacher: "Gold star for you!", scientist: "Only a tiny one! Hehe!", judge: "Not guilty! Hugs for all!" }[job] || "All better!";
      return [
        { who: pro, do: "arrive", with: "", line: "" }, { who: pro, do: "dress", with: job, line: "" },
        { who: pro, do: "friend_say", line: `${call ? `${call} ${Name(pro)} here! ` : ""}${open}`.slice(0, 70) },
        { who: other, do: "arrive", with: "", line: "" }, { who: other, do: "friend_say", line: ask },
        { who: pro, do: "friend_say", line: fix }, { who: "mochi", do: "feel", how: "laugh", line: "" },
        { who: "mochi", do: "aside", line: `${Name(pro)} makes a great ${J.name}!` }, { who: other, do: "hug", line: "" },
      ];
    }],
    story: [() => bring(mimi ? `Surprise! I made you a ${thing}! ♡` : `Dude, look what I found!`, "For me? Thank you!", `${N} is full of surprises.`)],
  };
  const beats = pick(variants[need] || variants.story, rnd)();
  const title = { jobs: `${Name(mimi ? "mimi" : "cocoa")} the ${JOBS[(moment.jobs || [])[0] || "doctor"].name}`, hungry: `${N} brings a snack`, thirsty: `${N} brings a drink`, tired: `${N} tucks him in`, cold: `${N} keeps him warm`, rain: `${N} and the umbrella`, sad_him: `${N} cheers him up`, sad_you: "the cheer-up squad", bored: `${N} comes to play`, good_news: "a surprise party", birthday: "a birthday surprise", miss: `${N} drops by`, story: `${N}'s surprise` }[need] || "a little scene";
  return { ...clean({ title, beats }, moment), from: "hand-written" };
}

/** keep a written scene to what the stage can play: friends arrive before they act, gifts before they're eaten */
export function clean(skit, moment = {}) {
  const here = new Set(moment.here || []), carrying = {}, out = [];
  let holding = null;
  for (const b0 of (skit.beats || []).slice(0, 10)) {
    const b = { who: ["mochi", "mimi", "cocoa"].includes(b0.who) ? b0.who : "mochi", do: DO.includes(b0.do) ? b0.do : "say", with: b0.do === "dress" ? jobOf(b0.with) || "" : ALL_THINGS.includes(b0.with) ? b0.with : "", how: FEEL.includes(b0.how) ? b0.how : "", line: stripActions(String(b0.line || "")).text.replace(/^["“]|["”]$/g, "").replace(/\s+/g, " ").trim().slice(0, 90) };
    const fl = /^(mimi|cocoa|mochi)\s*:\s*(.+)$/i.exec(b.line); if (fl) { b.who = fl[1].toLowerCase(); b.line = fl[2].replace(/^["“]|["”]$/g, ""); if (b.who !== "mochi" && (b.do === "say" || b.do === "aside")) b.do = "friend_say"; if (b.who === "mochi" && b.do === "friend_say") b.do = "say"; }
    if (b.do === "friend_say" && b.who === "mochi") b.do = "say";
    if ((b.do === "say" || b.do === "aside") && b.who !== "mochi") b.do = "friend_say";
    if (b.do === "dress" && !b.with) continue;   // (a job the stage has: shared/jobs.js)
    if (["arrive", "give", "leave", "piggyback"].includes(b.do) && b.who === "mochi") { if (b.do === "give") continue; b.who = moment.who || "mimi"; }
    if (b.do === "hug" && b.who === "mochi") b.who = [...here][0] || moment.who || "mimi";
    if ((b.do === "eat" || b.do === "use") && b.who !== "mochi") b.who = "mochi";
    if (["say", "aside", "friend_say", "call"].includes(b.do) && !b.line) continue;
    const f = b.who !== "mochi" ? b.who : b.do === "call" ? (/\bcocoa\b/i.test(b.line) ? "cocoa" : "mimi") : null;
    if (b.do === "call") { b.who2 = f; b.who = "mochi"; if (here.has(f)) continue; here.add(f); out.push(b); continue; }
    if (f && b.do !== "arrive" && !here.has(f) && b.do !== "leave") { out.push({ who: f, do: "arrive", with: b.do === "give" ? b.with : "", how: "", line: "" }); here.add(f); if (b.do === "give" && b.with) carrying[f] = b.with; }
    if (b.do === "arrive") { if (here.has(b.who)) { if (b.with && !carrying[b.who]) carrying[b.who] = b.with; continue; } here.add(b.who); if (b.with) carrying[b.who] = b.with; }
    if (b.do === "give") { b.with = b.with || carrying[b.who] || ""; if (!b.with) continue; carrying[b.who] = null; holding = b.with; }
    // "Yum!" with a cupcake in his hoof and no eat beat for it (as Gemma writes them): he eats it as he says it
    if (b.who === "mochi" && ["say", "aside", "feel"].includes(b.do) && holding && EDIBLE.has(holding) && /\b(yum+|yummy|mmm+|nom|tasty|delicious)\b/i.test(b.line)) { out.push({ who: "mochi", do: "eat", with: holding, how: "", line: "" }); holding = null; }
    if (b.do === "eat" && !(holding && EDIBLE.has(holding))) { out.push({ who: "mochi", do: "feel", with: "", how: "happy", line: b.line }); continue; }
    if (b.do === "eat") { b.with = holding; holding = null; }
    if (b.do === "use" && !holding) continue;
    if (b.do === "use") b.with = holding;
    if (b.do === "feel" && !b.how) b.how = "happy";
    if (b.do === "leave") { if (!here.has(b.who)) continue; here.delete(b.who); }
    out.push(b);
  }
  // words on an action beat (Gemma puts them everywhere: "Yo, did I hear someone's tummy rumbling?" on an arrive) get a
  // beat of their own, so the stage says them: as they arrive, before handing it over, after eating; and a friend's
  // line that calls themselves by name ("You're the best, Cocoa!" on Cocoa's hug) is his
  const sp = [];
  for (const b of out) {
    const own = b.who !== "mochi" && b.line && new RegExp(`\\b${b.who}\\b`, "i").test(b.line) && !new RegExp(`\\b(i'?m|i am|it'?s|me,?)\\s+${b.who}\\b|\\b${b.who}\\b,?\\s+(is\\s+)?here\\b|\\b${b.who}\\b,?\\s+(to the rescue|reporting|on duty|at your service)|\\b(dr\\.?|doctor|officer|chef|captain|detective|judge|professor|farmer|nurse|engineer|pilot|artist|astronaut)\\s+${b.who}\\b`, "i").test(b.line);   // ("Officer Cocoa, reporting!": a job title, theirs: Nov 7)
    const words = (line, w) => ({ who: w, do: w === "mochi" ? "say" : "friend_say", with: "", how: "", line });
    if (own && ["friend_say", "hug", "dance", "feel", "piggyback", "leave"].includes(b.do)) { const line = b.line; if (b.do === "friend_say") { sp.push(words(line, "mochi")); continue; } sp.push({ ...b, line: "" }, words(line, "mochi")); continue; }
    if (!b.line || !["arrive", "give", "eat", "use", "dress"].includes(b.do)) { sp.push(b); continue; }
    const w = own ? "mochi" : b.who, line = b.line;
    if (b.do === "give") sp.push(words(line, w), { ...b, line: "" });
    else sp.push({ ...b, line: "" }, words(line, w));
  }
  out.length = 0; out.push(...sp);
  if (moment.who && moment.peeked && !out.some((b) => b.who === moment.who)) {   // they peeked in, so they come
    const a = out.findIndex((b) => b.do === "arrive");
    out.splice(a >= 0 ? a + 1 : 0, 0, { who: moment.who, do: "arrive", with: "", how: "", line: "" });
  }
  // something brought and never handed over: it's handed over before the end
  for (const [f, w] of Object.entries(carrying)) if (w && here.has(f)) {   // (after the first thing they say, or as they arrive)
    // (where they came in: arriving, or called over; the bench had Cocoa called, then "arrive" with the confetti, and the
    // hand-over landed before the call)
    const a = out.findIndex((b) => (b.do === "arrive" && b.who === f) || (b.do === "call" && b.who2 === f)); if (a < 0) continue;
    const sayI = out.findIndex((b, i) => i > a && b.who === f && b.do === "friend_say");
    out.splice(sayI >= 0 ? sayI + 1 : a + 1, 0, { who: f, do: "give", with: w, how: "", line: "" });
  }
  return { title: String(skit.title || "a little scene").replace(/^["“]|["”]$/g, "").slice(0, 60), beats: out.slice(0, 12) };
}

/** ask the model for a scene for this moment; a hand-written one if it can't */
export async function writeSkit({ llm, moment, userText = "", reply = "", recent = [], recentShapes = [], recentLines = [], facts = [], memory = null, log = console, rnd = Math.random }) {
  const fb = () => fallbackSkit(moment, { rnd });
  // the scam-spotting game is always hand-written (scams.js), so what he teaches is right
  if (moment.need === "scam") return { ...(moment.callId ? callScene(moment.callId) : scamScene(moment.scene, moment.who, { learned: moment.learned || {} })), from: "hand-written", shape: "scam" };
  if (moment.need === "scam_choice") return { ...choiceScene(moment.choice, moment.pick), from: "hand-written", shape: "scam" };
  if (moment.need === "scam_after") return { ...afterScene(moment.quiz, moment.grade, moment.spotted || 0), from: "hand-written", shape: "scam" };
  if (!llm) return fb();
  const jobsAsked = (moment.jobs || []).map((j) => JOBS[j].name);
  const shape = moment.need === "jobs" ? { id: "jobs", text: `pretend jobs: the friends dress up (dress beats, with = the job) as ${jobsAsked.join(" and ") || "a doctor or a police officer"}${moment.who ? `, ${Name(moment.who)} first` : ""}, then play the part, simply and kindly (a check-up at the doctor's, a traffic stop for a speeding snail, a cooking show); it ends with everyone laughing or hugging` } : pickShape(recentShapes, rnd, moment.need);
  const things = NEED_THINGS[moment.need] || ALL_THINGS;
  const who = moment.who ? `${Name(moment.who)}${moment.peeked ? ` (${moment.who === "mimi" ? "she" : "he"} peeked in a moment ago, heard, and went to get something)` : ""}` : (moment.need === "good_news" || moment.need === "birthday" ? "both of them" : rnd() < 0.5 ? "Mimi" : "Cocoa");
  // fresh each time (variety.js): the real day, a twist not used lately; like a recent one anyway, once more
  for (let attempt = 0; attempt < 2; attempt++) try {
    const twist = spice(memory, "skit", rnd);
    const r = await llm.chat({ what: "skit", maxTokens: 650, temperature: wobble(attempt ? 1.05 : 0.9, rnd), seed: seedNow() + attempt, schema: SKIT_SCHEMA, schemaName: "skit",
      system: `You write tiny stage scenes for Mochi, a small cheerful chibi sheep who lives on someone's screen, and his two friends. ${FRIENDS} The scene follows from what just happened in the chat. It's warm and a little surprising: usually a friend turns up to help or cheer, Mochi is surprised and happy and thanks them, and he may turn to the person watching to say something about his friend; you'll be given a shape for this one. Write 5 to 9 beats a child would enjoy, in plain words, each line under 70 characters and in the speaker's own voice (no stage directions, no names in front of lines). Words go on say, aside, friend_say and call beats; leave line empty on the others. Vary how they talk: don't open lines the same way, use "eep", "hehe", "dude" and "bro" once at most, and don't reuse lines from earlier scenes. Beat types:
- arrive: a friend (who) comes by on their own; with = what they carry (from the list) or empty
- call: Mochi calls a friend over (who = mochi, line = what he calls out)
- say: Mochi talks to his friends; aside: Mochi talks to the person watching
- friend_say: a friend (who) talks
- give: a friend (who) hands Mochi what they carry (with); eat: Mochi eats or drinks what he was given; use: Mochi uses it
- feel: someone (who) shows a feeling (how)
- hug: a friend (who) and Mochi hug; dance: someone dances; piggyback: a friend (who) hops on Mochi's back and he carries them about; leave: a friend goes home
- dress: someone (who: mochi, mimi or cocoa) dresses up for a job; with = one of ${JOB_IDS.join(", ")}; its hat or outfit and its tool go on, then they can play the part
Things a friend can bring: ${things.join(", ")}. Keep with and how empty when they don't apply. Make it different from the recent scenes. Give it a short title.`,
      user: `What just happened: ${moment.text}.\nThey said: "${String(userText).slice(0, 200)}"\nMochi answered: "${stripActions(String(reply)).text.slice(0, 240)}"\nWho comes first: ${who}.\nThe shape this time: ${shape.text}.${recent.length ? `\nRecent scenes (do something else this time): ${recent.slice(-4).join("; ")}.` : ""}${recentLines.length ? `\nLines already used (say it differently): ${recentLines.slice(-6).map((l) => `"${l}"`).join(", ")}.` : ""}${facts.length ? `\nAbout the person watching: ${facts.slice(0, 3).join("; ")}.` : ""}\n${momentOfDay()}\nA little twist to work in, if it fits: ${twist}.` });
    const j = r.json || (r.text ? JSON.parse(String(r.text).replace(/^```json|```$/g, "")) : null);
    const sk = clean({ title: j && j.title, beats: j && Array.isArray(j.beats) ? j.beats : [] }, moment);
    if (sk.beats.length >= 4 && sk.beats.some((b) => b.who !== "mochi")) {
      if (attempt === 0 && tooLike(`${sk.title}: ${sk.beats.map((b) => b.line).filter(Boolean).join(" / ")}`, recent)) { log.log && log.log(`[skit] "${sk.title}" came out like a recent one; another go`); continue; }
      return { ...sk, from: "model", shape: shape.id };
    }
    log.warn && log.warn("[skit] the model's scene was too thin; using a hand-written one");
    break;
  } catch (e) { log.warn && log.warn("[skit]", e.message); break; }
  return fb();
}

/** the recipes the page needs for what's brought (and for a dress beat, the job's outfit: { job, title, wear, hold }) */
export function skitThings(skit) {
  const names = [...new Set(skit.beats.filter((b) => b.do !== "dress").map((b) => b.with).filter(Boolean))], out = {};
  for (const n of names) { const e = POCKET.find((x) => x.name === n); if (e) out[n] = e; }
  const rec = (n) => { const e = POCKET.find((x) => x.name === n); return e ? { name: e.name, archetype: e.archetype, recipe: e } : null; };
  for (const id of new Set(skit.beats.filter((b) => b.do === "dress").map((b) => b.with))) { const o = outfit(id); if (o) out[`job:${id}`] = { job: id, title: JOBS[id].name, wear: o.wear.map(rec).filter(Boolean), hold: o.hold ? rec(o.hold) : null }; }
  return out;
}
/** one line about it, for the scrapbook and for what he remembers */
export function skitSummary(skit) {
  const parts = [], said = new Set();
  for (const b of skit.beats) {
    if (b.do === "arrive") parts.push(`${Name(b.who)} came by${b.with ? ` with a ${b.with}` : ""}`);
    else if (b.do === "call") parts.push(`I called ${Name(b.who2)} over`);
    else if (b.do === "give") parts.push(`${Name(b.who)} gave me the ${b.with}`);
    else if (b.do === "eat") parts.push(`I ${/tea|cocoa/.test(b.with || "") ? "drank" : "ate"} the ${b.with}`);
    else if (b.do === "hug") parts.push(`${Name(b.who)} and I hugged`);
    else if (b.do === "piggyback") parts.push(`I gave ${Name(b.who)} a piggyback ride`);
    else if (b.do === "dance") parts.push(`${b.who === "mochi" ? "we all" : Name(b.who)} danced`);
    else if (b.do === "leave") parts.push(`${Name(b.who)} went home`);
    else if (b.do === "dress") parts.push(`${b.who === "mochi" ? "I" : Name(b.who)} dressed up as a ${(JOBS[b.with] || {}).name || b.with}`);
    else if (b.do === "aside" && !said.has("aside")) { said.add("aside"); parts.push(`I told you "${b.line}"`); }
  }
  return `${skit.title}: ${parts.join(", ")}`.slice(0, 240);
}
/** about how long the page takes to play it (ms) */
export function skitMs(skit) {
  const read = (s) => 900 + 48 * String(s || "").length;
  return skit.beats.reduce((t, b) => t + ({ arrive: 3200, call: 4200, dress: 2600, give: 1900, eat: 3800, use: 2600, feel: 1300, hug: 3800, dance: 3200, piggyback: 9000, leave: 1800 }[b.do] || 0) + (b.line ? read(b.line) : 0), 600);
}
