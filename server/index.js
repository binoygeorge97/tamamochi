// Mochi app server. Serves the stage, keeps his memory, runs the feelings pass, talks to LM Studio.
//   GET  /                → web/stage.html        GET /health  → JSON       GET /room → Mochi's room (inventory, scrapbook, queue)
//   POST /api/chat {text, id, rule, events}  → {id, mood, sulk, crisis, reply:{text, actions}, feelings}
//   WS   /ws             server→page pushes: {type:"reveal"|"mood"|"sulk"|"care"|"workbench", ...}; page→server: {type:"typing"|"quiet"|"pat"|"posed"}
// The workbench worker (day 3) takes queued prop and move requests one at a time and crafts them with the local model
// (server/crafter.js); finished ones wait for a quiet moment to be revealed. Thumbnails: GET /renders/prop-<id>.png.
// The bench: drop {name, props:[...], moves:[...]} as a .json file into data/inbox; results land in data/bench/<name>.
import express from "express";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { CONFIG } from "./config.js";
import { openMemory } from "./memory.js";
import { pickCue } from "./cues.js";
import { makeFactory, unsureNote } from "./factory.js";
import { rideIntent, teachFriendIntent, hugIntent, piggyIntent, shareIntent, stanceIntent, friendWalkIntent, talkToIntent, partyIntent, coldIntent, coldInReply, savingsIntent, dismissIntent, brainHelpers } from "./brain.js";
import { stripTags } from "../shared/speech.js";
import { cleanHandshake, describeHandshake, handshakeIntent, teachMoveIntent } from "../shared/handshake.js";
import { sweepGifts, giftFor, whenWords, giftLine } from "./gifts.js";
import { throwIntent, planThrows, throwNote, cleanGuard, SHIELD, waterFightIntent, planWaterFight, waterFightNote } from "../shared/scuffle.js";
import { waterGuns, wetAgain, ambushFor, ambushed } from "./capers.js";
import { skitMoment, writeSkit, skitThings, skitSummary, skitMs, skitLead, skitPeekLine } from "./skits.js";
import { PROP_EXAMPLES, validateProp, VEHICLE, BIG_LAUNCHER, eatStyle, hiddenInBody, asHeld } from "../shared/craft.js";
import { VEHICLES } from "../shared/pocket-vehicles.js";
const POCKET = Object.values(PROP_EXAMPLES).flat();
import { makeBrain } from "./brain.js";
import { loadFeelingsModel, makeReactor } from "./feelings.js";
import { CRISIS_REPLY } from "../shared/safety.js";
import { makeLLM } from "./llm.js";
import { makeRouter } from "./router.js";
import { makeVoice, pointIntent } from "./voice.js";
import { makeCrafter, patternRecipe, setLearned, learnable } from "./crafter.js";
import { beat, unbeat, whoStays, BEAT_MS } from "./solo.js";
import { hintIntent, hintPlan, hintNote, hintClean } from "./hints.js";
import { dressIntent, dressPlan, dressNote } from "./dress.js";
import { gradeAnswer, answerNote, GAME_NOTE, pickScene, scrapLine, pickCall, gradeChoice, choiceNote, TELLS as SCAM_TELLS, afterScene, choiceScene, SKILL_PACK, downloadBeats } from "./scams.js";
// asking him to get his scam-spotting skill ("download the scams knowledge", "can you learn about scams?")
export const SKILL_ASK = /\b(?:download|install|upload|load)\b[^.?!]{0,40}\b(?:scams?|scam[- ]spotting|skill ?packs?)\b|\b(?:you|mochi)\b[^.?!]{0,20}\b(?:learn|study)\b[^.?!]{0,30}\bscams?\b/i;
import { makePractice, practiceNote, PRACTICE, interruptible } from "./practice.js";
import { generateSkit, pickCard, toStore, fromStore, LESSON_CARDS } from "./skitgen.js";
import { scamCheckAsk, checkMessage, checkNote, WAITING_NOTE, fallbackLine, evaluate, parseSet, readerName, setWordModel, noticeScam, pauseNote } from "./scamcheck.js";
import { SCAM_SET, HELD_OUT } from "./scamset.js";
import { genJobs, genPrompt, genRows, dedupe, GEN_SCHEMA, trainBayes, split } from "./scamgen.js";
import { revealVerdict, unsureLine } from "./verdict.js";
import { moneyState, moneyIntent, moneyCard, moneyNote, whatIf, whatIfScene, applyPick, loanAskScene, loanDue, repay, mimiAskScene, mimiLearned, earn, earnNote, forecast, logIt, fmt as moneyFmt, the as theGoal, TEACH_NOTE as MONEY_TEACH, EARN_NOTE as MONEY_EARN, RULES as MONEY_RULES, MONEY_SKILL, skillDownload, SKILL_NOTE as MONEY_SKILL_NOTE, MONEY_SKILL_ASK, pickSkit, skitScene, skitAnswer, skitReveal, accrue, growth, BANK_RATE, setExtraSkits, extraSkits, depositScene, withdrawScene, shareScene, interestScene } from "./money.js";
import { moneyLook, lookState } from "../shared/money-look.js";
import { textIntent, writeOn, TEXT_MAX } from "./textfit.js";
import { writeScam } from "./scamlive.js";
import { setFreshScams } from "./scams.js";
import { propActIntent, propActNote } from "../shared/propact.js";
import { normColor } from "../shared/craft.js";
import { makeRenderer } from "./renderer.js";
import { runBench } from "./bench.js";
import { makeGate, visitorOf } from "./share.js";
import { makeStory } from "./story.js";
import { makeScenery } from "./scenery.js";
import { activityIntent, paintAnswer, buildActivity, juggleSpec, juggled, pickTrick, activityNote, honesty } from "./activities.js";
import { bookIntent, routineFor, improvise, routineNote, bookPage, bookDone, bookAsked, BOOK_BY_ID } from "./book.js";

// What his body already did, in plain words for the brain ("On screen just now: …"). The model saw `Mochi reacted
// "showoff"` before, didn't know that meant Mimi had hopped in, and said he had no girlfriend (M5, Nov 1).
const BODY = {
  hello: "you waved hello", happy: "you hopped happily", excited: "you bounced with excitement",
  superexcited: "you went wild with joy, zooming around the screen with confetti", love: "you melted with love, hearts floating up",
  shy: "you blushed and went shy", proud: "you puffed up proudly", laugh: "you giggled", surprised: "you looked surprised",
  shocked: "you gasped in shock, eyes huge and ears straight up, then leaned in, worried", concerned: "you leaned in, worried",
  sad: "you looked hurt, ears drooping", oops: "you looked sheepish", sleepy: "you gave a big yawn", thinking: "you tilted your head, thinking",
  showoff: "you proudly showed off your girlfriend Mimi, who just hopped in beside you and waved",
  forgive: "you turned back to them and forgave them",
};
const COSTUME = { christmas: "you're putting on your Santa hat (Mimi has a matching one)", easter: "you're putting on your bunny ears", none: "you're taking your costume off" };
const EVENT = { cuddled: "they just cuddled you", poked: "they poked you in the side (it made you jump; a few pokes in a row and you play-protest)", booped: "they booped you on the nose", ear_flicked: "they flicked your ear, gently", woke: "they woke you from a nap", woke_bed: "they woke you up in your little bed", yanked: "they grabbed you and swung you around",
  handshake_offer: "you held out your hoof to start your secret handshake with them", handshake: "you just did your secret handshake together, all the way through",
  handshake_miss: "you tried your secret handshake together, they got muddled, and you showed them how it goes",
  hug_mimi: "you just hugged Mimi", hug_cocoa: "you just gave Cocoa a big buddy hug",
  taught_mimi: "you just taught Mimi one of your moves and she got it", taught_cocoa: "you just taught Cocoa one of your moves and he got it",
  sneezed: "you just sneezed (Achoo!)", caught_cold: "you caught a little cold (a red nose, a stripy scarf)", cold_better: "your cold just went away and you feel better",
  moved_mimi: "they picked Mimi up and put her somewhere else on the screen", moved_cocoa: "they picked Cocoa up and put him somewhere else on the screen" };
const COLD_MS = 30 * 60 * 1000;   // a cold goes by itself after half an hour (soup, tea or a nap make it go sooner)
// What he says if the model gives nothing usable, matched to the face he already made.
const FALLBACK = {
  shocked: "Oh no… are you okay? I'm right here. Tell me what happened.", concerned: "Oh no… are you okay? I'm right here. Tell me what happened.",
  sad: "Oof… that one stung a little.", oops: "Oof… that one stung a little.",
  showoff: "This is Mimi! Isn't she the sweetest?", sleepy: "Mm… I'm still here, just a little sleepy.",
  happy: "Hehe, you make me so happy!", love: "Hehe, you make me so happy!", excited: "Hehe, you make me so happy!",
  superexcited: "That's amazing!!", laugh: "Hehe!", proud: "Hehe, thank you!", shy: "Aww, stop it…",
  default: "Hmm, my thoughts got tangled for a second. Can you say that again?",
};
const WEAPON_WORD = /\b(?:guns?|pistols?|rifles?|grenades?|bombs?|knife|knives|swords?|bazookas?|weapons?|missiles?|daggers?|axes?|cannons?|shotguns?|explosives?)\b/i;
const text0 = (t) => String(t || "").slice(0, 400);
// what the vision model said a doodle is, as a plain name: "It's a kite." / "That's an umbrella!" / "I think it's a
// paper crown" / "a drawing of a cat" → "kite" / "umbrella" / "paper crown" / "cat" (review, Nov 3: "s a kite")
export function doodleName(raw) {
  let t = String(raw || "").toLowerCase().replace(/[’`]/g, "'").replace(/<[^>]*>[\s\S]*?<\/[^>]*>|<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  t = t.split(/[.!?\n]/)[0].trim();
  for (let i = 0; i < 3; i++) t = t.replace(/^(?:i think|i believe|maybe|probably|perhaps|looks like|it looks like|this looks like|that looks like|it'?s|it is|this is|that'?s|that is|this'?s|these are|a drawing of|a doodle of|a sketch of|a picture of|drawing of|doodle of|sketch of|picture of|answer:|object:)\s*/, "").trim();
  t = t.replace(/[^a-z\s-]/g, " ").replace(/\s+/g, " ").trim().replace(/^(?:a|an|the|some)\s+/, "");
  return t.split(" ").slice(0, 3).join(" ");
}
export function bodyNote(mood, costume, events = []) {
  const bits = [];
  if (mood && BODY[mood]) bits.push(BODY[mood]);
  if (costume && COSTUME[costume]) bits.push(COSTUME[costume]);
  for (const e of (Array.isArray(events) ? events : []).slice(0, 12)) {
    if (typeof e !== "string") continue;
    if (Object.hasOwn(EVENT, e)) { bits.push(EVENT[e]); continue; }
    // things handed over by dragging (Nov 2): "given:umbrella" → he took it from them; "gave_mimi:globe" → Mimi has it
    const g = /^(given|gave_mimi|gave_cocoa):(.{1,60})$/.exec(String(e || ""));
    if (g) bits.push(g[1] === "given" ? `they just handed you your ${g[2]} and you took it (it's in your hoof)` : `they just gave ${g[1] === "gave_mimi" ? "Mimi" : "Cocoa"} your ${g[2]} to hold`);
    else if (/^learned_move:(.{1,60})$/.test(e)) bits.push(`they just taught you a new move by posing you: "${e.slice(13)}" (you're wobbly at it; pats after you do it make it smoother)`);
    else if (e === "stood_up_by_touch") bits.push("they swiped you up onto your back legs: you're standing");
    else if (e === "party") bits.push("you just had a dance party with your friends");
    else if (e === "sat_down_by_touch") bits.push("they swiped you back down: you're sitting");
  }
  return bits.join("; ");
}

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");

// how the badge and the workshop name a crafting model and its jobs: "Gemini (critique, backup writer)"
const WRITES = ["recipe", "fix", "remake", "move", "move-fix"];
export const cloudLabel = (n) => ({ anthropic: "Claude", openai: "GPT", gemini: "Gemini", nemotron: "Nemotron" })[n] || String(n).replace(/^./, (c) => c.toUpperCase());
export function cloudRoles(p) {
  const t = p.tasks || [], b = p.backup || [], out = [];
  const fixesOnly = t.some((x) => ["fix", "remake", "move-fix"].includes(x)) && !t.includes("recipe") && !t.includes("move");
  if (fixesOnly) out.push("fixing props");   // (Nov 7: Gemini when Pip or you say a prop isn't right)
  else if (t.some((x) => WRITES.includes(x))) out.push("writing");
  if (t.includes("critique")) out.push("critique");
  if (t.includes("look")) out.push("checking props");   // (Pip's blind look, Nov 8)
  if (!t.some((x) => WRITES.includes(x)) && b.some((x) => WRITES.includes(x))) out.push("backup writer");
  return out.join(", ") || "crafting";
}
export async function createServer(opts = {}) {
  const memory = openMemory(opts.db || CONFIG.db);
  const story = makeStory({ memory, log: console });   // his own little plans and story (Nov 3); its model comes once localLLM exists
  const brain = makeBrain({ memory, fetchImpl: opts.fetchImpl, story });
  const model = opts.feelings !== undefined ? opts.feelings : await loadFeelingsModel(CONFIG.feelingsDir, CONFIG.feelingsThreads);
  const react = makeReactor(model);
  const state = { strikes: memory.get("strikes", 0), lastIncrease: 0, careUntil: memory.get("careUntil", 0), careModeMs: CONFIG.careModeMs, lastRender: null, lastLLM: null, llmError: null, cold: memory.get("cold", null) };
  const coldOn = () => !!(state.cold && state.cold.until > Date.now());
  const setCold = (on) => { state.cold = on ? { since: Date.now(), until: Date.now() + COLD_MS } : null; memory.set("cold", state.cold); return state.cold; };
  const pages = new Set();   // open WebSockets
  let lastTyping = 0, lastMessage = 0, inFlight = 0, chatSeq = 0, actBusyUntil = 0;
  const dataDir = path.dirname(path.resolve(opts.db || CONFIG.db));
  const rendersDir = path.join(dataDir, "renders"), inboxDir = path.join(dataDir, "inbox"), benchDir = path.join(dataDir, "bench");
  for (const d of [rendersDir, inboxDir, benchDir]) fs.mkdirSync(d, { recursive: true });
  const requeued = memory.requeueStale();
  if (requeued) console.log(`[workbench] ${requeued} job(s) left working by a restart went back in the queue`);
  const broadcast = (msg) => { const s = JSON.stringify(msg); for (const ws of pages) if (ws.readyState === 1) ws.send(s); };
  // the story's scenery (scenery.js): anything not ready-made is made in one quick go, no rounds with Pip (set
  // dressing; the story won't wait), by its own crafter so it never queues behind the workbench's props
  let scenery = null;
  const sceneryNow = () => scenery || (scenery = makeScenery({ memory, broadcast, log: console,
    crafter: opts.sceneryCrafter !== undefined ? opts.sceneryCrafter : crafter && !opts.fetchImpl ? makeCrafter({ llm: craftLLM, renderer: null, fixRounds: 0, minTries: 1, budgetMs: 45000, log: { log() {}, warn: console.warn } }) : null }));

  const app = express();
  // shared through a tunnel (MOCHI_PUBLIC=1, scripts\share-mochi.cmd): a passcode on everything, the grown-up buttons
  // only on this computer, and a fair share of the model per visitor (server/share.js)
  const gate = (opts.public ?? process.env.MOCHI_PUBLIC === "1") ? makeGate({ dataDir, log: console }) : null;
  if (gate) { app.set("trust proxy", false); app.use(gate.middleware); }
  app.get("/api/whoami", (req, res) => res.json({ public: !!gate, admin: !gate || !!(gate.isAdmin && gate.isAdmin(req)) }));   // admin: the grown-up buttons work here (this computer, or the grown-up code)
  // feedback from people trying him (the Feedback button when he's shared): kept in data\feedback.jsonl, and filed to
  // 8090 when it's connected
  app.post("/api/feedback", express.json({ limit: "20kb" }), (req, res) => {
    const text = String((req.body && req.body.text) || "").trim().slice(0, 2000), name = String((req.body && req.body.name) || "").trim().slice(0, 60);
    if (!text) return res.status(400).json({ error: "write something first" });
    const visitor = crypto.createHash("sha256").update(visitorOf(req)).digest("hex").slice(0, 10);
    try { fs.appendFileSync(path.join(dataDir, "feedback.jsonl"), JSON.stringify({ at: new Date().toISOString(), name: name || null, visitor, text, shared: !!gate }) + "\n"); } catch (e) { return res.status(500).json({ error: e.message }); }
    factory.feedback({ kind: "tester", title: `Tester feedback${name ? ` from ${name}` : ""}`, markdown: text });
    console.log(`[feedback] ${name || "someone"}: ${text.slice(0, 80)}`);
    res.json({ ok: true });
  });
  app.use(express.json({ limit: "2mb" }));
  // his voice: speech for a reply (ElevenLabs through the server, or "use your own voice"), and words from a recording
  const factory = opts.factory || makeFactory({ keysFile: opts.keysFile !== undefined ? opts.keysFile : CONFIG.keysFile, env: opts.env || process.env, fetchImpl: opts.factoryFetch || opts.fetchImpl || fetch, log: console });
  // (Kokoro, the voices made on this computer: the voices picked on the Voices page sit next to keys.json, and the
  // model it fetches once in data\models; both shared by the demo and the shared Mochi)
  const keysAt = opts.keysFile !== undefined ? opts.keysFile : CONFIG.keysFile, voiceDir = keysAt ? path.dirname(path.resolve(keysAt)) : dataDir;
  const voice = opts.voice || makeVoice({ keysFile: keysAt, env: opts.env || process.env, fetchImpl: opts.voiceFetch || opts.fetchImpl || fetch, log: console,
    local: opts.localTTS !== undefined ? opts.localTTS : opts.fetchImpl ? false : undefined, settingsFile: path.join(voiceDir, "voices.json"), cacheDir: path.join(voiceDir, "models") });
  // the model is fetched and loaded before anyone talks (the shared one a little later, so they don't both fetch it)
  if (voice.warm) setTimeout(() => voice.warm(), gate ? 5000 : 1500).unref();   // (the model's on disk now: the shared one needn't wait 30 s)
  // what the page can expect from the server's voice (Nov 4: a phone can only start its own listening from a tap, so
  // it needs to know before you tap whether the server will turn your words into text)
  app.get("/api/voice", (_, res) => { const v = voice.status(); res.json({ tts: v.tts === "elevenlabs" || v.tts === "kokoro", engine: v.tts, stt: v.stt !== "browser" }); });
  const whoOf = (b) => (["mimi", "cocoa"].includes(b && b.who) ? b.who : "mochi");
  app.post("/api/tts", async (req, res) => {
    const text = String((req.body && req.body.text) || "").slice(0, 1200), raw = req.body && typeof req.body.raw === "string" ? req.body.raw.slice(0, 1200) : null;
    if (!text.trim()) return res.status(400).json({ error: "no text" });
    const audio = await voice.tts(text, { who: whoOf(req.body), raw, signal: AbortSignal.timeout(22000) });
    if (!audio) return res.status(204).end();   // the page speaks it itself
    res.set({ "content-type": audio.mime || "audio/mpeg", "cache-control": "no-store" }).send(audio);
  });
  // the Voices page (/voices): try a voice, a pitch and a pace for each of them, and keep the one you like
  app.get("/api/voice/local", (_, res) => {
    const L = voice.local, v = voice.status();
    if (L && !L.ready) L.warm();   // (opening the page after "npm install" gets it going)
    res.json({ engine: v.engine, speaking: v.tts, elevenlabs: v.elevenlabs, kokoro: v.kokoro, voices: L ? L.voices : [], settings: L ? L.settings() : null });
  });
  app.post("/api/voice/try", async (req, res) => {
    const L = voice.local, b = req.body || {};
    if (!L) return res.status(503).json({ error: "Kokoro is switched off here" });
    const text = String(b.text || "").slice(0, 400);
    if (!text.trim()) return res.status(400).json({ error: "no text" });
    if (!L.ready) { L.warm(); return res.status(503).json({ error: "Kokoro isn't ready yet", kokoro: L.status() }); }
    const wav = await L.say(text, { who: whoOf(b), voice: b.voice && typeof b.voice === "object" ? b.voice : null, signal: AbortSignal.timeout(30000) });
    if (!wav) return res.status(500).json({ error: "it couldn't say that", kokoro: L.status() });
    res.set({ "content-type": wav.mime, "cache-control": "no-store" }).send(wav);
  });
  app.post("/api/voice/set", (req, res) => {
    const L = voice.local, b = req.body || {};
    if (!L) return res.status(503).json({ error: "Kokoro is switched off here" });
    const who = String(b.who || "");
    if (!["mochi", "mimi", "cocoa"].includes(who)) return res.status(400).json({ error: "who?" });
    try { const v = L.set(who, b.voice && typeof b.voice === "object" ? b.voice : null); console.log(`[voice] ${who}'s voice is now ${v.voice}, pitch ${v.pitch}, pace ${v.rate}`); res.json({ ok: true, voice: v, settings: L.settings() }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/stt", express.raw({ type: ["audio/*", "application/octet-stream"], limit: "8mb" }), async (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length < 800) return res.status(400).json({ error: "no audio" });
    const r = await voice.stt(req.body, { mime: String(req.get("content-type") || "audio/webm").split(";")[0], seconds: Math.max(1, Math.min(60, +req.get("x-seconds") || 5)), signal: AbortSignal.timeout(26000) });
    if (!r) return res.status(204).end();     // the page listens itself
    res.json(r);
  });
  app.use("/kit", express.static(path.join(root, "kit")));
  app.use("/shared", express.static(path.join(root, "shared")));
  app.use(express.static(path.join(root, "web")));
  app.get("/", (_, res) => res.sendFile(path.join(root, "web", "stage.html")));
  app.get("/room", (_, res) => res.sendFile(path.join(root, "web", "room.html")));   // inventory, memories, workbench, scrapbook
  app.get("/voices", (_, res) => res.sendFile(path.join(root, "web", "voices.html"))); // pick how Mochi, Mimi and Cocoa sound
  app.get("/render", (_, res) => res.sendFile(path.join(root, "web", "render.html")));   // the crafter's headless camera
  app.use("/renders", express.static(rendersDir, { maxAge: "1h" }));                    // prop thumbnails

  app.get("/health", async (_, res) => {
    let llm = { reachable: false, models: [] };
    try {
      const r = await (opts.fetchImpl || fetch)(`${CONFIG.llm.baseUrl}/models`, { signal: AbortSignal.timeout(2000) });
      const j = await r.json(); llm = { reachable: r.ok, models: (j.data || []).map((m) => m.id) };
    } catch (e) { llm.error = e.message; }
    const q = memory.queue();
    res.json({ ok: llm.reachable && llm.models.some((m) => m.includes(CONFIG.llm.model.split("/").pop())), llm, model: CONFIG.llm.model, feelings: !!model, toolMode: brain.toolMode,
      queue: { queued: q.filter((j) => j.status === "queued").length, working: q.filter((j) => j.status === "working").length, someday: q.filter((j) => j.status === "someday").length },
      lastLLM: state.lastLLM, lastLLMStats: state.lastLLMStats || null, llmError: state.llmError, lastRender: state.lastRender, strikes: state.strikes, careMode: state.careUntil > Date.now(), pages: pages.size,
      workbench: { busy: work.busy, current: work.current && { ...work.current, img: undefined }, last: work.last, vision: craftLLM.vision, structured: craftLLM.structured, renderer: renderer ? renderer.mode || "idle" : null, bench: work.bench, models: craftLLM.status ? craftLLM.status() : null }, voice: voice.status(), factory: factory.status() });
  });

  // the workshop crew's last steps and picture, for a page that opens mid-job (Kit writes, Pip tests: web/bench.js)
  app.get("/api/bench", (_, res) => res.json({ current: work.current, last: work.last }));
  // the inventory, scrapbook and queue: Mochi's room
  // How far he's come (Nov 3, the "Day 3 with you" badge): days since his first words, what he's made and learned, and
  // whether anything leaves the house (cloud crafting models, a cloud voice). The theme line: zero bytes to the cloud.
  // The cloud boost switch (workshop page; only on this computer when he's shared): which cloud models there are, what
  // each does, and whether they're allowed. Models on this computer (LM Studio) are listed apart: they never need it.
  // his skills (Nov 7): things he downloads the first time they come up (the scam-spotting pack); Day Zero forgets them
  const hasSkill = (id) => !!(memory.get("skills", null) || {})[id];
  const learnSkill = (id, name) => {
    const all = memory.get("skills", null) || {}; if (all[id]) return false;
    memory.set("skills", { ...all, [id]: { name, at: new Date().toISOString() } });
    const n = Object.keys(all).length;
    try { memory.scrap(id === SKILL_PACK.id ? `I downloaded ${n ? "a" : "my first"} skill pack: ${name} (${SKILL_PACK.items.length} warning signs)` : `I downloaded ${n ? "a" : "my first"} skill pack: ${name}`, "story"); } catch (_) { /* fine */ }
    console.log(`[skills] downloaded: ${name}`);
    return true;
  };
  const boostInfo = () => {
    const M2 = craftLLM.status ? craftLLM.status() : { providers: [] };
    const each = (p) => ({ name: cloudLabel(p.name), model: p.model, roles: cloudRoles(p), state: p.state });
    return { on: boostOn(), cloud: M2.providers.filter((p) => !p.local).map(each), here: M2.providers.filter((p) => p.local).map(each), local: CONFIG.llm.model };
  };
  app.get("/api/cloud-boost", (_, res) => res.json(boostInfo()));
  app.get("/api/scam-accuracy", (_, res) => res.json(memory.get("scamcheck.accuracy", null) || { sets: [] }));
  // his word counter (the scam check's third vote, Nov 7): trained here, on our own generated sets (data\scamsets)
  try {
    // (the shared Mochi keeps its data in data\public: the sets are found beside keys.json too)
    const dir = [path.join(dataDir, "scamsets"), path.join(voiceDir, "scamsets")].find((d) => fs.existsSync(d)) || path.join(dataDir, "scamsets");
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((x) => /\.jsonl$/.test(x)) : [];
    const rows = files.flatMap((fn) => fs.readFileSync(path.join(dir, fn), "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch (_) { return null; } }).filter(Boolean));
    if (rows.length >= 50) { setWordModel(trainBayes(rows), { messages: rows.length, sets: files.length }); console.log(`[scamcheck] word counter trained on ${rows.length} messages from ${files.length} set${files.length === 1 ? "" : "s"}`); }
  } catch (e) { console.warn(`[scamcheck] word counter: ${e.message}`); }
  app.post("/api/cloud-boost", (req, res) => {
    const on = !!(req.body && req.body.on);
    memory.set("cloud.boost", on);
    console.log(`[models] cloud boost ${on ? "on" : "off"}`);
    res.json(boostInfo());
  });
  app.get("/api/growth", (_, res) => {
    // born: the Day Zero moment, or else the earliest thing he has (his first words, prop, move or scrapbook page), so a
    // restored demo keeps its days (review, Nov 3: "Reset to the demo" showed "Day zero")
    const ms = (t) => (t ? Date.parse(String(t) + (/[zZ]|[+-]\d\d:\d\d$/.test(String(t)) ? "" : "Z")) : NaN);
    const first = ["turns", "props", "moves", "scrapbook"].map((t) => ms((memory.db.prepare(`SELECT MIN(created_at) AS t FROM ${t}`).get() || {}).t)).filter((x) => x > 0);
    const kvBorn = ms(memory.get("born", null)), bornMs = Math.min(...[kvBorn, ...first].filter((x) => x > 0));
    const fixed = memory.get("born.fixed", null);   // (set from the workshop page: his days count from there)
    const born = fixed || (Number.isFinite(bornMs) ? new Date(bornMs).toISOString() : null);
    const day = born ? Math.max(1, Math.floor((Date.now() - Date.parse(born)) / 86400000) + 1) : 0;
    const props = memory.props(), moves = memory.moves(), hs = memory.get("handshake", null);
    const M2 = craftLLM.status ? craftLLM.status() : null, v = voice.status();
    const cloud = [...(M2 ? M2.providers.filter((p) => !p.local && !/^off/.test(p.state)).map((p) => `${cloudLabel(p.name)} (${cloudRoles(p)})`) : []), ...(/elevenlabs/.test(v.tts) || /elevenlabs/.test(v.stt) ? ["elevenlabs (voice)"] : []), ...(factory.enabled() ? ["8090 (feedback)"] : [])];
    const skills = Object.values(memory.get("skills", null) || {}).map((x) => x.name);
    res.json({ day, born, skills, props: props.length, made: props.filter((p) => p.source !== "pocket").length, moves: moves.length, taught: moves.filter((m) => m.source === "posed").length,
      handshake: !!(hs && hs.steps), phrases: memory.phrases().length, facts: memory.facts().length, cloud, local: CONFIG.llm.model, savings: memory.get("savings", null), scams: (({ played = 0, spotted = 0, checked = 0, caught = 0 }) => ({ played, spotted, checked, caught }))(memory.get("scams", null) || {}) });
  });
  app.get("/api/room", (_, res) => res.json({ props: memory.props(), moves: memory.moves(), phrases: memory.phrases(), facts: memory.facts(), scrapbook: memory.scrapbook(), queue: memory.queue() }));
  // the secret handshake: taught on the stage by taps and swipes (no model); done together, counted
  app.get("/api/handshake", (_, res) => res.json(memory.get("handshake", null) || { steps: null }));
  app.post("/api/handshake", (req, res) => {
    const steps = cleanHandshake(req.body && req.body.steps);
    if (!steps) return res.status(400).json({ error: "2 to 8 steps" });
    const had = memory.get("handshake", null);
    memory.set("handshake", { steps, taught_at: new Date().toISOString(), times: 0, last_done: null });
    memory.scrap(`${had ? "you taught me a new secret handshake" : "you taught me our secret handshake"}: ${describeHandshake(steps)}`, "handshake");
    res.json({ ok: true, steps });
  });
  app.post("/api/forget", (req, res) => res.json({ forgot: memory.forget(String(req.body.text || "")) }));
  // The demo (Nov 3, build log "still open" 6): get him how you want him for the judges (props made, moves taught, the
  // handshake), save that as data/mochi.demo.sqlite from the workshop page, and put it back between demos.
  const demoSnap = opts.demoSnapshot || path.join(dataDir, "mochi.demo.sqlite");
  const demoInfo = () => {
    if (!fs.existsSync(demoSnap)) return { exists: false };
    const st = fs.statSync(demoSnap);
    let props = null, moves = null;
    try { memory.db.exec(`ATTACH '${demoSnap.replace(/'/g, "''")}' AS i`); try { props = memory.db.prepare("SELECT COUNT(*) AS n FROM i.props WHERE kept = 1").get().n; moves = memory.db.prepare("SELECT COUNT(*) AS n FROM i.moves").get().n; } finally { memory.db.exec("DETACH i"); } } catch (_) { /* an old snapshot */ }
    return { exists: true, savedAt: st.mtime.toISOString(), bytes: st.size, props, moves };
  };
  app.get("/api/demo-snapshot", (_, res) => res.json(demoInfo()));
  // "Learn from today" (Nov 3): what the workbench made, what the blind check doubted, what was asked to be fixed, and
  // which requests keep coming up without a quick-make pattern; filed to 8090 as one item when it's connected.
  function review(hours = 24) {
    const since = new Date(Date.now() - hours * 3600000).toISOString().replace("T", " ").slice(0, 19);
    const props = memory.db.prepare("SELECT id, name, source, created_at, meta FROM props WHERE kept = 1 AND source != 'pocket' AND created_at >= ?").all(since);
    const meta = (p) => { try { return p.meta ? JSON.parse(p.meta) : {}; } catch (_) { return {}; } };
    const unsure = props.filter((p) => meta(p).unsure), matched = props.filter((p) => meta(p).matched);
    const jobs = memory.db.prepare("SELECT kind, request, status, context, created_at FROM queue WHERE created_at >= ?").all(since);
    const fixes = jobs.filter((j) => /^fix:/.test(String(j.context || ""))), failed = jobs.filter((j) => j.status === "failed");
    const moves = memory.moves().filter((m) => String(m.created_at || "") >= since);
    const ms = props.map((p) => meta(p).ms).filter((x) => x > 0), avgS = ms.length ? +(ms.reduce((a, b) => a + b, 0) / ms.length / 1000).toFixed(1) : null;
    // asked twice or more and not from a pattern: the next patterns to write
    const counts = {}; for (const j of jobs.filter((j) => j.kind === "prop")) { const k = String(j.request).toLowerCase().replace(/^(a|an|the|some)\s+/, "").split(":")[0].trim(); counts[k] = (counts[k] || 0) + 1; }
    const next = Object.entries(counts).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => ({ request: k, times: n }));
    const st = memory.get("story", null) || {}, sinceMs = Date.now() - hours * 3600000, onOwn = (st.log || []).filter((l) => l.kind === "beat" && Date.parse(l.at) > sinceMs).length, wantsDone = (st.done || []).filter((d) => Date.parse(d.at) > sinceMs).length;
    return { hours, onOwn, wantsDone, made: props.length, matched: matched.length, unsure: unsure.map((p) => ({ id: p.id, name: p.name, guess: meta(p).guess || null })), fixes: fixes.length, failed: failed.length, moves: moves.length, taught: moves.filter((m) => m.source === "posed").length, avgSeconds: avgS, nextPatterns: next };
  }
  const hoursOf = (x) => Math.min(168, Math.max(1, Number(x) || 24));   // "?hours=abc" was NaN and threw (Nov 3 review)
  app.get("/api/review", (req, res) => res.json(review(hoursOf(req.query.hours))));
  app.post("/api/review", async (req, res) => {
    const r = review(hoursOf((req.body || {}).hours));
    const md = [r.onOwn ? `**On his own:** ${r.onOwn} thing${r.onOwn === 1 ? "" : "s"} he did by himself${r.wantsDone ? `, ${r.wantsDone} of his plans done` : ""}.` : "", `**Made:** ${r.made} props (${r.matched} confirmed by the blind check, ${r.unsure.length} unsure), ${r.moves} moves (${r.taught} taught by hand); ${r.fixes} fix requests, ${r.failed} failed jobs; average ${r.avgSeconds ?? "?"} s per prop.`,
      r.unsure.length ? `\n**Unsure:** ${r.unsure.map((u) => `${u.name}${u.guess ? ` (looked like ${u.guess})` : ""}`).join(", ")}` : "",
      r.nextPatterns.length ? `\n**Asked more than once, no pattern yet:** ${r.nextPatterns.map((n) => `${n.request} ×${n.times}`).join(", ")}` : "\n**Patterns:** nothing asked twice without one."].filter(Boolean).join("\n");
    const filed = await factory.feedback({ kind: "review", title: `Mochi: learned from the last ${r.hours} h`, markdown: md });
    memory.scrap(`I looked back at what I made today: ${r.made} things, ${r.unsure.length} I wasn't sure about`, "review", null);
    res.json({ ...r, markdown: md, filed });
  });
  // Money World (Nov 8): the money card as it is now (the page's menu and the workshop page read it)
  app.get("/api/money", (_, res) => res.json({ ...moneyCard(memory.get("money", null), memory.get("savings", null)), look: lookState(memory.get("money", null), memory.get("savings", null)) }));   // (look: what the money props show, for the taps: Nov 8)
  app.post("/api/demo-snapshot", (_, res) => {   // this moment, as the demo (the old one is kept beside it as .bak)
    try {
      if (fs.existsSync(demoSnap)) fs.renameSync(demoSnap, demoSnap.replace(/\.sqlite$/, `.${Date.now()}.bak.sqlite`));
      memory.db.exec(`VACUUM INTO '${demoSnap.replace(/'/g, "''")}'`);
      res.json({ ok: true, ...demoInfo() });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/reset-demo", (req, res) => {   // restores data/mochi.demo.sqlite if present (day-3 history snapshot)
    work.gen++; work.rethumb.clear();   // whatever the workbench is in the middle of belongs to the old Mochi
    try { const n = memory.saveToLibrary("all", req.body && req.body.which === "zero" ? "before day zero" : "before a reset"); if (n) console.log(`[props] ${n} saved to his library first`); } catch (e) { console.warn("[props] library:", e.message); }
    if (req.body && req.body.which === "zero") {   // Day Zero (Nov 3): he knows nothing, owns nothing; born right now
      let backup = null;
      try { backup = path.join(dataDir, `mochi.before-dayzero.${Date.now()}.sqlite`); memory.db.exec(`VACUUM INTO '${backup.replace(/'/g, "''")}'`); } catch (e) { backup = null; console.warn("[demo] no backup before day zero:", e.message); }
      memory.db.exec("DELETE FROM facts; DELETE FROM phrases; DELETE FROM props; DELETE FROM moves; DELETE FROM scrapbook; DELETE FROM queue; DELETE FROM turns; DELETE FROM kv;");
      memory.set("born", new Date().toISOString()); memory.set("born.fixed", null);
      state.strikes = 0; state.careUntil = 0; state.cold = null;
      broadcast({ type: "reborn" });
      return res.json({ ok: true, zero: true, backup: backup ? path.basename(backup) : null });
    }
    const snap = fs.existsSync(demoSnap) ? demoSnap : path.join(root, "data", "mochi.demo.sqlite");
    if (!fs.existsSync(snap)) return res.status(404).json({ error: "no snapshot at data/mochi.demo.sqlite" });
    memory.db.exec("DELETE FROM facts; DELETE FROM phrases; DELETE FROM props; DELETE FROM moves; DELETE FROM scrapbook; DELETE FROM queue; DELETE FROM turns; DELETE FROM kv;");
    memory.db.exec(`ATTACH '${snap.replace(/'/g, "''")}' AS s`);
    try {   // copy the columns both files have (a snapshot made before day 3 has no thumbnails or job logs)
      for (const t of ["facts", "phrases", "props", "moves", "scrapbook", "queue", "kv"]) {   // kv: the secret handshake lives there
        const cols = (db) => memory.db.prepare(`PRAGMA ${db}.table_info(${t})`).all().map((c) => c.name);
        const mine = new Set(cols("main")), both = cols("s").filter((c) => mine.has(c)).join(", ");
        if (both) memory.db.exec(`INSERT INTO main.${t} (${both}) SELECT ${both} FROM s.${t}`);
      }
    } finally { memory.db.exec("DETACH s"); }
    // what was going on at that moment doesn't come back: no sulk, no worry, no cold, nothing waiting to be revealed
    for (const k of ["strikes", "careUntil", "cold", "lastReveal"]) memory.set(k, null);
    { const mo = memory.get("money", null); if (mo && mo.pending) memory.set("money", { ...mo, pending: null }); }   // (a what-if waiting at snapshot time isn't waiting now)
    memory.db.exec("UPDATE queue SET revealed = 1 WHERE status = 'done'");   // (no "Ta-da!" for things made before the snapshot)
    memory.requeueStale();                                                  // a job caught mid-make goes back in the queue
    state.strikes = 0; state.careUntil = 0; state.cold = null;
    broadcast({ type: "reborn" });
    res.json({ ok: true });
  });

  // Touch learning saves straight to memory, no model involved (posing, handshake, pats)
  app.post("/api/moves", (req, res) => {
    const { name, recipe, prop_archetype, origin, forProp = null } = req.body || {};
    if (!name || !recipe) return res.status(400).json({ error: "name and recipe" });
    const id = memory.addMove({ name: String(name).replace(/[<>]/g, "").trim().slice(0, 60) || "my move", recipe, prop_archetype: prop_archetype || recipe.prop || null, origin: origin || "you posed me into it", source: "posed", skill: 0.15 });
    // posed while holding a prop: that's how he uses it from now on (a pocket prop goes on his shelf for it)
    const linked = forProp && forProp.name ? linkUse(forProp, id) : null;
    res.json({ id, linked });
  });
  app.post("/api/props/:id/used", (req, res) => { memory.usedProp(+req.params.id); res.json({ ok: true }); });   // taken off his shelf
  // his cold, as the page sees it: { on: false } when it went by itself (time, or a nap in his bed)
  app.post("/api/cold", (req, res) => { if (req.body && req.body.on === false && state.cold) setCold(false); res.json({ ok: true, cold: coldOn() ? state.cold.until : 0 }); });
  // "a clear all old props button" (Binoy, Nov 2): everything he's made goes off his shelf. Put away, not destroyed:
  // the page offers Undo, and /api/props/restore brings them back. His pocket things stay (they're part of him).
  app.post("/api/props/clear", (req, res) => {
    try { memory.saveToLibrary(memory.props().map((p) => p.id), "before the shelf was cleared"); } catch (e) { console.warn("[props] library:", e.message); }
    sceneryNow().clear();   // (the story's scenery goes too)
    const ids = memory.clearProps();
    memory.cancelFixes();
    memory.set("lastReveal", null);
    if (ids.length) memory.scrap(`we cleared my shelf (${ids.length} prop${ids.length === 1 ? "" : "s"} put away)`, "props");
    console.log(`[props] cleared ${ids.length}`);
    res.json({ ok: true, cleared: ids.length, ids });
  });
  // "he'll hold it this way from now on" (Nov 3): the page turned what he holds by hand; keep the turned recipe. His
  // own prop of that name is updated; a pocket thing becomes his own copy, turned. Checked like any recipe.
  app.post("/api/props/adjust", (req, res) => {
    const b = req.body || {}, name = String(b.name || "").slice(0, 60).trim();
    if (!name || !b.recipe || typeof b.recipe !== "object") return res.status(400).json({ ok: false, error: "name and recipe needed" });
    const v = validateProp(b.recipe, { request: name });
    if (!v.recipe) return res.status(400).json({ ok: false, error: (v.errors || []).join(", ") || "not a prop" });
    const own = (Number.isInteger(+b.id) && memory.props().find((x) => x.id === +b.id)) || memory.props().find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (own) {
      if (v.recipe.archetype !== own.archetype) return res.status(400).json({ ok: false, error: "a different kind of prop" });
      memory.setPropRecipe(own.id, { ...own.recipe, ...v.recipe, name: own.name, archetype: own.archetype });
      work.rethumb.add(own.id);
      return res.json({ ok: true, id: own.id, updated: true });
    }
    const pat = POCKET.find((e) => e.name.toLowerCase() === name.toLowerCase());
    if (!pat || pat.archetype !== v.recipe.archetype) return res.status(404).json({ ok: false, error: "he doesn't have that" });
    const when = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const id = memory.addProp({ name: pat.name, archetype: pat.archetype, recipe: { ...v.recipe, name: pat.name, archetype: pat.archetype }, origin: `you turned it the way you like it on ${when}`, source: "user", meta: { adjusted: true } });
    work.rethumb.add(id);
    res.json({ ok: true, id, created: true });
  });
  // one prop off his shelf (Nov 7, Binoy: "delete props"): a copy goes to his library first, so it can come back
  app.post("/api/props/:id/remove", (req, res) => {
    const id = +req.params.id, p = memory.props().find((x) => x.id === id);
    if (!p) return res.status(404).json({ ok: false, error: "not on his shelf" });
    try { memory.saveToLibrary([id], "removed from the shelf"); } catch (e) { console.warn("[props] library:", e.message); }
    memory.removeProp(id); memory.set("lastReveal", null);
    console.log(`[props] removed "${p.name}" (kept in his library)`);
    res.json({ ok: true, removed: p.name });
  });
  // forget his skill packs (Nov 7): so the next demo shows him downloading the scam-spotting pack again
  app.post("/api/skills/forget", (_, res) => { const had = Object.keys(memory.get("skills", null) || {}); memory.set("skills", null); console.log(`[skills] forgotten: ${had.join(", ") || "none"}`); res.json({ ok: true, forgot: had.length }); });
  // nobody answered the scam game's question (Nov 7, Binoy: every skit needs an ending): the page asks for the ending
  // after a while; Mochi shows what he spotted (or the safe choice), and the question is closed
  app.post("/api/scam/wrap", (_, res) => {
    const fresh = (x) => x && Date.now() - x.at < 10 * 60000;
    const quiz = memory.get("scam.quiz", null), choice = memory.get("scam.choice", null);
    let sk = null;
    if (fresh(quiz)) { memory.set("scam.quiz", null); sk = afterScene(quiz, { found: [], also: [], missed: quiz.tells, idk: true, guessed: false }, (memory.get("scams", null) || {}).spotted || 0, { reveal: true }); }
    else if (fresh(choice)) { memory.set("scam.choice", null); sk = choiceScene(choice, "hang", { reveal: true }); }
    else {   // a money skit's question nobody answered (Nov 8): he says the answer himself, so it ends
      const mo = moneyState(memory.get("money", null));
      if (mo.pending && mo.pending.kind === "quiz" && fresh(mo.pending)) { const r = skitReveal(mo.pending.id); memory.set("money", { ...mo, pending: null }); if (r) { console.log(`[money] no answer: Mochi says it himself ("${r.title}")`); return res.json({ skit: { title: r.title, beats: r.beats, things: skitThings(r), need: "money" } }); } }
    }
    if (!sk) return res.json({ skit: null });
    console.log(`[scam] no answer: Mochi shows it himself ("${sk.title}")`);
    res.json({ skit: { title: sk.title, beats: sk.beats, things: skitThings(sk), need: "scam" } });
  });
  // his saved props: every prop he made before a clear, a delete, a reset or Day Zero; good ones (Pip knew them, or you
  // said they looked right) first. One can go back on his shelf.
  app.get("/api/library", (_, res) => res.json({ props: memory.library() }));
  app.post("/api/library/:id/shelf", (req, res) => {
    const it = memory.libraryItem(+req.params.id);
    if (!it) return res.status(404).json({ ok: false, error: "not in his library" });
    const have = memory.props().find((x) => x.name.toLowerCase() === it.name.toLowerCase() && JSON.stringify(x.recipe) === JSON.stringify(it.recipe));
    if (have) return res.json({ ok: true, id: have.id, already: true });
    const id = memory.addProp({ name: it.name, archetype: it.archetype, recipe: it.recipe, origin: it.origin || "from my saved props", source: it.source === "pocket" ? "user" : (it.source || "user"), meta: { ...it.meta, fromLibrary: true } });
    work.rethumb.add(id);
    res.json({ ok: true, id });
  });
  // his days counted from a fixed moment (Nov 7, Binoy: "keep the days from day 0 to day 1 since the hackathon is only
  // for 2 days"): {at: ISO} or {at: null} to go back to counting from his first memory
  app.post("/api/born", (req, res) => {
    const at = req.body && req.body.at ? Date.parse(req.body.at) : NaN;
    memory.set("born.fixed", Number.isFinite(at) ? new Date(at).toISOString() : null);
    res.json({ ok: true, born: memory.get("born.fixed", null) });
  });
  app.post("/api/props/restore", (req, res) => {
    const ids = (Array.isArray(req.body && req.body.ids) ? req.body.ids : []).map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 500);
    res.json({ ok: true, restored: memory.restoreProps(ids) });
  });
  app.post("/api/moves/:id/pat", (req, res) => { memory.practised(+req.params.id, 0.15); res.json({ ok: true }); });

  // a taught use: the prop he has by that name (or the pocket pattern, put on his shelf), linked to the move
  function linkUse(forProp, moveId) {
    const want = String(forProp.name || "").toLowerCase();
    let prop = memory.props().find((p) => p.name.toLowerCase() === want) || null;
    if (!prop) {
      const pat = POCKET.find((e) => e.name.toLowerCase() === want) || (forProp.recipe && forProp.recipe.parts ? forProp.recipe : null);
      if (!pat) return null;
      const pid = memory.addProp({ name: pat.name, archetype: pat.archetype || forProp.archetype, recipe: pat, origin: "it was in my pocket, and you showed me what to do with it", source: "pocket" });
      prop = { id: pid, name: pat.name };
    }
    memory.teachUse(prop.id, moveId);
    return prop.name;
  }

  // ---- Mochi's Money World (money.js): one turn about money. The scene is hand-written from the real numbers and
  // played after his reply; a scene that asks (what if, a loan, Mimi's question) waits for the pick (the next message).
  // the money props show what's inside (shared/money-look.js, Nov 8): dressed with the numbers as they are now
  const dressMoney = (rec) => (rec ? moneyLook(rec, lookState(memory.get("money", null), memory.get("savings", null))) : rec);
  const PIGGY = () => dressMoney(POCKET.find((e) => e.name === "piggy bank") || null);
  function piggyAdd(amt) {   // money moved into the piggy bank (the savings goal from Nov 3): the page drops the coins
    const cur = memory.get("savings", null);
    if (!cur || !cur.goal || !(amt > 0)) return null;
    const saved = Math.round((cur.saved + amt) * 100) / 100, done = !!(cur.target && saved >= cur.target && !(cur.saved >= cur.target));
    memory.set("savings", { ...cur, saved, doneAt: done ? new Date().toISOString() : cur.doneAt || null });
    if (done) memory.scrap(`you saved up all ${moneyFmt(cur.target)} for ${cur.goal}!`, "savings", null);
    return { ...cur, saved, added: amt, event: done ? "done" : "add", prop: PIGGY() };
  }
  function playScene(sk, seq, afterMs) {
    if (!sk || !sk.beats || !sk.beats.length) return 0;
    const ms = skitMs(sk);
    actBusyUntil = Math.max(actBusyUntil, Date.now() + afterMs + ms + 1500);   // (his own story waits for it)
    const things = Object.fromEntries(Object.entries(skitThings(sk)).map(([k, v]) => [k, k.startsWith("job:") ? v : dressMoney(v)]));   // (dressed now: the money has already moved)
    setTimeout(() => {
      if (seq !== chatSeq) return console.log(`[money] "${sk.title}": they've moved on, dropped`);
      broadcast({ type: "skit", title: sk.title, beats: sk.beats, things, need: "money", waits: sk.waits || null });
    }, afterMs);
    return ms;
  }
  const join = (a, b) => (a && b ? { ...a, title: a.title, beats: [...a.beats, ...b.beats], waits: b.waits || a.waits || null } : a || b);
  async function moneyTurn(want, m0, ctx) {   // true when it answered; false (nothing changed) lets the usual chat take it
    const before = memory.get("money", null);
    try { return await moneyTurn1(want, m0, ctx); }
    catch (e) {
      console.warn("[money] turn failed:", e.message);
      if (ctx.res.headersSent) return true;
      memory.set("money", before ? { ...before, pending: null } : null);
      return false;
    }
  }
  async function moneyTurn1(want, m, { text, id, f, rule, mode, seq, res }) {
    const sv = () => memory.get("savings", null);
    let scene = null, note = "", card = null, savings = null, earned = null, mood = "excited", fallback = "Let's see!";
    // day zero: he knows nothing about money; the first money talk, he downloads his money skill pack first (Nov 8)
    const download = !hasSkill(MONEY_SKILL.id) && learnSkill(MONEY_SKILL.id, MONEY_SKILL.name) ? skillDownload() : null;
    if (download) broadcast({ type: "skill", download });
    const gain = accrue(m); if (gain) save();   // (Mochi Bank's weekly interest, if a week has gone by: the money tree grows a coin)
    const interest = gain ? interestScene(gain, m.bank.balance) : null;
    let show = null, growthCard = null;   // a money prop in his hoof (or beside him) for this turn; the growth chart
    const pocket = (n) => { const e = POCKET.find((x) => x.name === n); return e ? { name: e.name, archetype: e.archetype, recipe: e } : null; };
    const save = () => memory.set("money", m);
    if (want.kind === "card" || want.kind === "teach_money") {
      card = moneyCard(m, sv());
      note = want.kind === "card" ? moneyNote(card) : MONEY_TEACH + moneyNote(card);
      const cur = sv(); if (cur && cur.goal) savings = { ...cur, added: 0, event: "ask", prop: PIGGY() };
      mood = "proud"; fallback = card.next;
    } else if (want.kind === "grow") {   // the forecast chart: the same money in the piggy bank and in Mochi Bank
      const amt = want.amount || (m.bank && m.bank.balance) || m.wallet || 10, g = growth(amt, want.weeks);
      growthCard = g; show = pocket("little bank"); mood = "thinking";
      note = `\nThey asked how ${moneyFmt(g.amount)} grows in Mochi Bank over ${g.weeks} week${g.weeks === 1 ? "" : "s"}. A chart is on screen. The sums: in the piggy bank it stays ${moneyFmt(g.piggy)}; in Mochi Bank, at ${Math.round(g.rate * 100)}% a week (a play rate), it becomes ${moneyFmt(g.end)}, so ${moneyFmt(g.interest)} is interest: money the bank pays you for keeping it there, and interest on interest makes it grow faster. Say that simply in two short sentences.`;
      fallback = `In the piggy bank it stays ${moneyFmt(g.piggy)}. In Mochi Bank it grows to ${moneyFmt(g.end)}!`;
    } else if (want.kind === "deposit" || want.kind === "withdraw") {
      const bank = m.bank || { balance: 0, paidAt: Date.now(), interest: 0 };
      show = pocket("little bank");
      if (want.kind === "deposit") {
        const amt = want.all ? m.wallet : want.amount;
        if (!amt) { note = `\nThey want to put money in Mochi Bank (your little bank: money kept there earns ${Math.round(BANK_RATE * 100)}% a week, a play rate). Ask how much from their wallet (${moneyFmt(m.wallet)}), short.`; fallback = `How much should we put in Mochi Bank? You have ${moneyFmt(m.wallet)}.`; mood = "curious"; }
        else if (m.wallet < amt) { note = `\nThey want to put ${moneyFmt(amt)} in Mochi Bank, but their wallet has ${moneyFmt(m.wallet)}. Say so kindly; offer a job to earn more, short.`; fallback = `You have ${moneyFmt(m.wallet)} in your wallet. Want to do a job to earn more?`; mood = "thinking"; show = pocket("wallet"); }
        else {
          m.wallet = Math.round((m.wallet - amt) * 100) / 100; if (!(bank.balance > 0)) bank.paidAt = Date.now();
          bank.balance = Math.round((bank.balance + amt) * 100) / 100; m.bank = bank; logIt(m, "save", amt, "into Mochi Bank"); save();
          scene = depositScene(amt, bank.balance, m.wallet);   // (the bank comes out at once; the scene opens its door)
          note = `\nOn screen just now: ${moneyFmt(amt)} went from their wallet into Mochi Bank (${moneyFmt(bank.balance)} there now; it earns ${Math.round(BANK_RATE * 100)}% a week, a play rate). Cheer, short; the scene says the numbers.`; fallback = "Clink! Safe in Mochi Bank!";
          try { memory.scrap(`you put ${moneyFmt(amt)} in Mochi Bank`, "story"); } catch (_) { /* fine */ }
        }
      } else {
        const amt = want.all || !want.amount ? bank.balance : Math.min(want.amount, bank.balance);
        if (!(bank.balance > 0)) { note = "\nThey want to take money out of Mochi Bank, but there's nothing in it yet. Say so kindly, short."; fallback = "There's nothing in Mochi Bank yet!"; mood = "thinking"; }
        else { bank.balance = Math.round((bank.balance - amt) * 100) / 100; m.bank = bank; m.wallet = Math.round((m.wallet + amt) * 100) / 100; logIt(m, "withdraw", amt, "out of Mochi Bank"); save();
          scene = withdrawScene(amt, bank.balance, m.wallet);
          note = `\nOn screen just now: they took ${moneyFmt(amt)} out of Mochi Bank into their wallet (${moneyFmt(m.wallet)} in the wallet, ${moneyFmt(bank.balance)} left in the bank). Say it's theirs to use, and that money left in the bank keeps growing; short, no nagging.`; fallback = `${moneyFmt(amt)} back in your wallet!`; }
      }
      card = moneyCard(m, sv());
    } else if (want.kind === "share") {   // giving: the share jar (Nov 8)
      const amt = want.amount; show = pocket("three money jars");
      if (m.wallet < amt) { note = `\nThey want to give ${moneyFmt(amt)} to help others, but their wallet has ${moneyFmt(m.wallet)}. Say it's a lovely idea, and kindly that they need to earn a little first; short.`; fallback = "That's so kind! Let's earn a little first."; mood = "love"; show = pocket("wallet"); }
      else {
        m.wallet = Math.round((m.wallet - amt) * 100) / 100; m.shared = Math.round(((m.shared || 0) + amt) * 100) / 100; logIt(m, "share", amt, "given to help others"); save();
        scene = shareScene(amt, m.shared);
        note = `\nOn screen just now: they put ${moneyFmt(amt)} of their play money in the share jar, for the animal shelter (${moneyFmt(m.shared)} shared so far). Say it's kind, short; Mimi says thank you on screen.`; mood = "love"; fallback = "That's so kind!";
        try { memory.scrap(`you gave ${moneyFmt(amt)} to the animal shelter from the share jar`, "story"); } catch (_) { /* fine */ }
      }
    } else if (want.kind === "earn_how") { note = MONEY_EARN; fallback = "You can earn by doing jobs with me! Want to be chefs together?"; }
    else if (want.kind === "whatif_price") {   // "should I buy a new bike?": they need the price first
      note = `\nThey asked whether to buy ${want.item}, but you don't know what it costs. Ask how much it costs, short and curious (then they can ask "what if I buy ${want.item} for $…?"). No money advice yet.`;
      mood = "curious"; fallback = `Ooh, how much does it cost?`;
    } else if (want.kind === "whatif" && (want.all || !want.price) && !(m.wallet > 0)) {
      note = "\nThey asked what if they spend their money, but their wallet is empty. Say so kindly and offer a job to earn some together, short."; mood = "thinking"; fallback = "Your wallet's empty right now! Want to do a job together?"; show = pocket("wallet");
    } else if (want.kind === "whatif") {
      if (want.all || !want.price) want = { ...want, price: m.wallet };
      const w = whatIf(m, sv(), want);
      if (!w.can) show = pocket("wallet");   // (not enough: out comes the wallet, a puff of dust if it's empty: Nov 8)
      m.pending = { kind: "whatif", w, at: Date.now() }; save();
      scene = whatIfScene(w, { rule: m.mimi && m.mimi.rule });
      note = `\nThey asked what would happen if they bought the ${w.treat.name} (${moneyFmt(w.price)}). In a moment, on screen, Mimi brings it to her stand and you show both ways with the real numbers: "${w.buyLine}" and "${w.saveLine}", then they choose. Right now say one short, excited line like "Let's find out!" Don't decide for them and don't say the numbers yet.`;
      mood = "thinking"; fallback = "Ooh, good question! Let's find out!";
    } else if (want.kind === "whatif_save") {
      const cur = sv(), amt = want.amount;
      const left = cur && cur.target ? Math.max(0, cur.target - cur.saved) : null, steps = left != null ? Math.ceil(left / amt) : null;
      card = moneyCard(m, cur);
      note = cur && cur.goal ? (left != null ? `\nThey asked what if they save ${moneyFmt(amt)} each time. The sum: ${moneyFmt(left)} to go for ${theGoal(cur.goal)}, so ${steps} save${steps === 1 ? "" : "s"} of ${moneyFmt(amt)}${m.allowance ? ` (about ${steps} week${steps === 1 ? "" : "s"} of allowance)` : ""}. Tell them that plainly and cheer them on, short.` : `\nThey asked what if they save ${moneyFmt(amt)} each time, but their goal (${cur.goal}) has no price yet: ask how much it costs, short.`)
        : `\nThey asked what if they save ${moneyFmt(amt)} each time, but there's no savings goal yet: ask what they'd like to save up for and how much it costs, short.`;
      fallback = steps ? `${steps} saves of ${moneyFmt(amt)} and you'll have it!` : "What would you like to save up for?";
    } else if (want.kind === "buy") {
      const w = whatIf(m, sv(), want);
      if (w.can) { m.pending = { kind: "whatif", w, at: Date.now() }; const r = applyPick(m, sv(), 1); m = r.money; save(); scene = r.scene; note = `\n${r.note}`; fallback = `Here's your ${w.treat.name}!`; }
      else { note = `\nThey want to buy the ${w.treat.name} (${moneyFmt(w.price)}) but their wallet has ${moneyFmt(m.wallet)}. Say kindly that they need ${moneyFmt(w.price - m.wallet)} more, and offer a job to earn it together; short.`; mood = "thinking"; fallback = `We need ${moneyFmt(w.price - m.wallet)} more. Want to do a job together to earn it?`; show = pocket("wallet"); }
    } else if (want.kind === "allowance") {
      if (want.amount && /\b(?:a|per|each|every) week\b|\bweekly\b/i.test(text)) m.allowance = want.amount;
      const e = earn(m, "allowance", "allowance", Date.now(), want.amount); m = e.money; save(); earned = e;
      note = earnNote(e, "from their allowance") + " Ask what they'd like to do with it: save some, spend some, or both.";
      fallback = `Allowance day! ${moneyFmt(e.amount)} in your wallet. Save some, spend some?`;
    } else if (want.kind === "save_all") {
      const cur = sv();
      if (!cur || !cur.goal) { note = "\nThey want to save their money but there's no savings goal yet: ask what they'd like to save up for, short."; fallback = "What should we save up for?"; }
      else if (!(m.wallet > 0)) { note = "\nThey want to save their wallet money, but the wallet is empty. Say so kindly and offer a job to earn some, short."; fallback = "Your wallet's empty! Want to do a job together?"; show = pocket("wallet"); }
      else { const amt = m.wallet; m.wallet = 0; logIt(m, "save", amt, `saved for ${cur.goal}`); save(); savings = piggyAdd(amt); note = `\nOn screen just now: all ${moneyFmt(amt)} from their wallet went clink-clink into your piggy bank: ${moneyFmt(savings.saved)}${cur.target ? ` of ${moneyFmt(cur.target)}` : ""} for ${theGoal(cur.goal)}. Cheer, short.`; fallback = `Clink! ${moneyFmt(amt)} saved!`; }
    } else if (want.kind === "lend") {
      const amount = want.amount || (want.who === "cocoa" ? 5 : 4);
      m.pending = { kind: "loan", who: want.who, amount, at: Date.now() };
      if (want.asked === "you" && want.amount) {
        const r = applyPick(m, sv(), 1); m = r.money; save(); scene = r.scene; note = `\n${r.note}`;
        fallback = r.scene ? "That's really kind!" : `We only have ${moneyFmt(m.wallet)}. We can't lend money we don't have!`;   // (Nov 8: not "that's kind" with an empty wallet)
        if (!r.scene) { show = pocket("wallet"); mood = "thinking"; }
      }
      else { save(); scene = loanAskScene(want.who, amount); note = `\nIn a moment, on screen, ${want.who === "cocoa" ? "Cocoa runs in and asks" : "Mimi comes by and asks"} to borrow ${moneyFmt(amount)} and promises to pay back ${moneyFmt(amount + 1)}; then they decide. Right now say one short line like "Ooh, who's that?"`; fallback = "Ooh, who's that?"; mood = "curious"; }
    } else if (want.kind === "skit") {   // a money skit (Nov 8): Mimi and Cocoa act it out, then he asks them
      const k = pickSkit((m.skits && m.skits.recent) || [], Math.random, want.topic, (m.skits && m.skits.genPlayed) || []);
      m.skits = { ...m.skits, recent: [...((m.skits && m.skits.recent) || []), k.id].slice(-3), played: ((m.skits && m.skits.played) || 0) + 1,
        genPlayed: k.gen ? [...((m.skits && m.skits.genPlayed) || []), k.id].slice(-60) : (m.skits && m.skits.genPlayed) || [] };
      if (k.gen) console.log(`[money] playing a skit ${k.by} wrote and ${k.checkedBy} checked: "${k.title}" (${k.lesson})`);
      m.skitAt = Date.now(); m.pending = { kind: "quiz", id: k.id, at: Date.now() }; save();
      scene = skitScene(k);
      note = `\nIn a moment, on screen, Mimi and Cocoa act out a little money scene ("${k.title}") and then you ask them a question about it. Right now say one short, excited line like "Ooh, watch this!" Don't tell the story or the answer.`;
      fallback = "Ooh, watch this!";
    } else if (want.kind === "pick" && want.pending.kind === "quiz") {
      const a = skitAnswer(want.pending.id, want.n); m.pending = null;
      if (a) {
        m.skits = { ...m.skits, right: ((m.skits && m.skits.right) || 0) + (a.right ? 1 : 0) };
        if (a.right) { const e = earn(m, "quiz", "a smart money answer"); if (e) { m = e.money; earned = e; } }
        scene = a.scene; mood = a.right ? "excited" : "happy";
        try { memory.scrap(`we did a money skit about ${a.lesson}; you said "${a.pickText}"${a.right ? " (right!)" : ""}`, "story"); } catch (_) { /* fine */ }
        note = a.right ? `\nThey answered your money skit's question right ("${a.pickText}")${earned ? `, and earned ${moneyFmt(earned.amount)} for a smart answer` : ""}. Cheer them in one short line; the scene explains why (don't repeat it).`
          : `\nThey answered your money skit's question with "${a.pickText}", which isn't quite it. Be kind in one short line ("good try!"); the scene explains the answer (don't repeat it).`;
        fallback = a.right ? "Yes! You got it!" : "Good try! Watch this…";
      }
      save();
    } else if (want.kind === "pick") {
      const p = want.pending;
      if (p.kind === "mimi") {
        const L = mimiLearned(text); m.pending = null;
        if (L) { m.mimi = { ...(m.mimi || {}), rule: L.rule }; scene = L.scene; try { memory.scrap(`you taught Mimi a money rule: ${MONEY_RULES[L.rule.id].name}`, "story"); } catch (_) { /* fine */ } note = `\nThey gave Mimi money advice ("${L.rule.said}"), and she'll remember it: ${MONEY_RULES[L.rule.id].say}. Be proud of them for teaching her, short. Don't write Mimi's lines (she says hers on screen).`; mood = "proud"; fallback = "You're a great teacher!"; }
        save();
      } else {
        const r = applyPick(m, sv(), want.n);
        m = r.money;
        if (r.savingsAdd) savings = piggyAdd(r.savingsAdd);
        scene = r.scene; note = `\n${r.note}`; mood = "happy"; fallback = "Good choice!";
        // after the first what-if, Mimi asks the kid for advice (learning by teaching: she remembers what they say)
        if (p.kind === "whatif" && !(m.mimi && (m.mimi.rule || m.mimi.asked))) { m.mimi = { ...(m.mimi || {}), asked: true }; m.pending = { kind: "mimi", at: Date.now() }; scene = join(scene, mimiAskScene()); }
        save();
        card = moneyCard(m, sv());
      }
    }
    if (!show) show = want.kind === "card" && !savings ? pocket("wallet") : want.kind === "allowance" ? pocket("play money") : want.kind === "teach_money" ? pocket("little bank")
      : want.kind === "earn_how" ? pocket("calculator") : want.kind === "lend" && !scene ? pocket("wallet") : null;
    if (interest) { scene = join(interest, scene); note += `\nAlso: Mochi Bank just paid its weekly interest, ${moneyFmt(gain)} (the scene shows it).`; }
    if (download) note = MONEY_SKILL_NOTE + note;
    else if (want.kind === "teach_money" && MONEY_SKILL_ASK.test(text)) note = "\nThey asked you to download or learn about money: you already downloaded your \"money smarts\" skill pack earlier, so say so happily, short." + note;
    const first = { id, mood, strikes: state.strikes, savings: savings || undefined, money: earned ? { earned: earned.amount, wallet: earned.money.wallet } : undefined, moneyProp: show ? { ...show, recipe: dressMoney(show.recipe) } : undefined };
    broadcast({ type: "first", ...first });
    memory.turn("user", text, { feelings: f.model, rule, money: want.kind });
    let line = fallback, tagged = null, llm;
    try {
      const r = await brain.reply({ text, note: null, extraContext: note.trim(), signal: AbortSignal.timeout(CONFIG.llm.timeoutMs), mode: mode === "zeroday" ? "zeroday" : null, calm: true, noTools: true, onStage: null });
      tagged = r.text || ""; line = stripTags(tagged) || fallback; llm = r.llm;
      if (scene) r.friendSay = [];   // (the friends speak in the scene)
    } catch (e) { console.warn("[money]", e.message); }
    memory.turn("assistant", line, { money: want.kind });
    console.log(`[money] ${want.kind}${want.n ? ` ${want.n}` : ""}: wallet ${moneyFmt(m.wallet)}${m.loan ? `, ${m.loan.who} owes ${moneyFmt(m.loan.back)}` : ""}${scene ? `; scene "${scene.title}"` : ""}`);
    playScene(scene, seq, Math.min(9000, 1200 + 45 * line.length) + 900 + (download ? 6000 : 0));   // (after the download card and his answer)
    return res.json({ ...first, reply: { text: line, say: tagged && tagged !== line && stripTags(tagged) === line ? tagged : undefined, actions: [{ kind: "mood", name: mood }], moneyCard: card || undefined, growthCard: growthCard || undefined, download: download || undefined, llm } });
  }
  // ---- words on a prop (textfit.js, Nov 8): "write PNC on the bank", "make your car say 7". Gemini picks the spot,
  // code fits the words, Gemini reads the drawing back blind. The prop with its words comes out in his hoof (or beside
  // him); the plain pattern on his shelf stays as it was.
  const WORD_ALIAS = { bank: "little bank", "mochi bank": "little bank", jar: "savings jar", "piggy": "piggy bank", jars: "three money jars", "money jars": "three money jars",
    register: "cash register", till: "cash register", tree: "growing money tree", "money tree": "growing money tree", stand: "lemonade stand", atm: "money machine" };
  function wordsProp(target, holding) {
    const t = String(target || "").toLowerCase().replace(/^(?:little|toy|new)\s+/, "").trim(), held = holding && typeof holding.name === "string" ? holding.name.toLowerCase() : null;
    const shelf = memory.props();
    const named = (n) => { const k = String(n).toLowerCase(); const s = shelf.find((p) => p.name.toLowerCase() === k); if (s) return { name: s.name, archetype: s.archetype, recipe: s.recipe }; const e = POCKET.find((x) => x.name === k); return e ? { name: e.name, archetype: e.archetype, recipe: e } : null; };
    if (held && (/^(?:it|this|that|this one|that one|this thing|that thing|the thing)$/.test(t) || held === t || held.endsWith(` ${t}`))) { const r = named(held); if (r) return r; }
    const exact = named(WORD_ALIAS[t] || t); if (exact) return exact;
    const ends = (n) => { const k = n.toLowerCase(); return k === t || k.endsWith(` ${t}`) || k.startsWith(`${t} `); };
    const s = shelf.filter((p) => ends(p.name)).sort((a, b) => a.name.length - b.name.length)[0]; if (s) return { name: s.name, archetype: s.archetype, recipe: s.recipe };
    const e = POCKET.filter((x) => ends(x.name)).sort((a, b) => a.name.length - b.name.length)[0];
    return e ? { name: e.name, archetype: e.archetype, recipe: e } : null;
  }
  async function wordsTurn(w, { text, id, f, rule, holding, res }) {
    const answer = (line, mood, more = {}) => {
      const first = { id, mood, strikes: state.strikes, ...more };
      broadcast({ type: "first", ...first });
      memory.turn("user", text, { feelings: f.model, rule, words: true }); memory.turn("assistant", line, { words: true });
      res.json({ ...first, reply: { text: line, actions: [{ kind: "mood", name: mood }] } });
      return true;
    };
    if (w.askName) return answer("Ooh, yes! What's your name? Say it like: write Sam on the bank.", "curious");
    if (!w.text) return answer(`I can only write short, kind words: up to ${TEXT_MAX} letters or numbers.`, "thinking");
    const P = wordsProp(w.target, holding);
    if (!P) return answer(`I don't have a ${w.target} yet! Ask me to make one, then I'll write "${w.text}" on it.`, "curious");
    const r = await writeOn(P.recipe, w.text, { llm: craftLLM, renderer, log: console });
    if (!r || !r.ok) return answer(`Hmm, there's nowhere flat on my ${P.name} to write on.`, "thinking");
    console.log(`[words] "${w.text}" on the ${P.name}: the ${r.spot.side} of the "${r.spot.label}"${r.sign ? ", on a little sign" : ""}, picked by ${r.by}; ${r.read === true ? `read back blind: "${r.readAs}"` : r.read === false ? `read back as "${r.readAs}" (not it)` : "not checked"}; ${r.tries} tr${r.tries === 1 ? "y" : "ies"}, ${r.ms} ms`);
    try { memory.scrap(`I wrote "${w.text}" on my ${P.name}`, "story"); } catch (_) { /* fine */ }
    const line = r.read === false ? `Here's my ${P.name} with "${w.text}" on it! Can you read it?` : `Ta-da! "${w.text}" on my ${P.name}!`;
    return answer(line, "excited", { wrote: { name: P.name, archetype: P.archetype, recipe: { ...r.recipe, name: P.name, archetype: P.archetype }, text: w.text, by: r.by, read: r.read, readAs: r.readAs, sign: r.sign, spot: `the ${r.spot.side} of the ${r.spot.label}` } });
  }
  // a loan that's due: Cocoa (or Mimi) runs in and pays back, after this reply
  function repayLater(seq, afterMs) {
    const m = moneyState(memory.get("money", null));
    if (!loanDue(m)) return false;
    const r = repay(m); memory.set("money", r.money);
    try { memory.scrap(r.line, "story"); } catch (_) { /* fine */ }
    console.log(`[money] ${r.line}`);
    playScene(r.scene, seq, afterMs);
    return true;
  }

  // The chat pipeline
  app.post("/api/chat", async (req, res) => {
    const { text: textIn = "", id = String(Date.now()), rule = null, events = [], costume = null, mode = null, holding = null, guard = null, standing: standingIn = false } = req.body || {};
    const standing = standingIn === true, text = String(textIn ?? "").slice(0, 4000);
    const t0 = Date.now(); lastMessage = t0; inFlight++; const seq = ++chatSeq;
    clearTimeout(storyPace.timer); storyPace.timer = null;   // they said something: his story waits for this reply
    let counted = true;   // "close" fires whether the reply finished or the tab went away mid-call
    res.on("close", () => { if (counted) { counted = false; inFlight = Math.max(0, inFlight - 1); lastMessage = Date.now(); } });
    const f = await react(text, typeof rule === "string" && /^[a-z]{2,20}$/.test(rule) && !(rule in Object.prototype) ? rule : null, state);
    memory.set("strikes", state.strikes); memory.set("careUntil", state.careUntil);
    // "Is this a scam? …" (scamcheck.js, Nov 7, the T-Mobile track): Mochi's rules and Nemotron (Gemma if it can't) read
    // the pasted message; a card on screen, his answer in his own words. Nothing else happens on this turn: a pasted
    // "send me gift cards" isn't a request. Asked with nothing pasted, the next message is the one to check.
    // "Can you download the scam knowledge?" (M5, Nov 8: "I don't have a way to download things like that", though he
    // does): he downloads his scam-spotting skill pack right then, or says he already has it
    if (!f.crisis && state.strikes < 3 && SKILL_ASK.test(text) && !scamCheckAsk(text)) {
      const fresh = !hasSkill(SKILL_PACK.id) && learnSkill(SKILL_PACK.id, SKILL_PACK.name);
      const first = { id, mood: fresh ? "excited" : "proud", strikes: state.strikes };
      broadcast({ type: "first", ...first });
      memory.turn("user", text, { feelings: f.model, rule });
      if (fresh) broadcast({ type: "skill", download: { skill: SKILL_PACK.name, items: SKILL_PACK.items } });
      const line = fresh ? "Ooh, yes! Downloading my scam-spotting skill pack now… Then show me a message you're not sure about, and I'll check it."
        : "I already downloaded my scam-spotting skill pack! Show me a message you're not sure about, and I'll check it.";
      memory.turn("assistant", line, { skill: fresh ? SKILL_PACK.id : "known" });
      return res.json({ ...first, reply: { text: line, actions: [{ kind: "mood", name: fresh ? "excited" : "proud" }] } });
    }
    const scamWait = memory.get("scamcheck.waiting", null);
    const scamAsk = f.crisis || state.strikes >= 3 ? null : scamCheckAsk(text) || (scamWait && Date.now() - scamWait < 10 * 60000 && String(text).trim().length >= 15 ? { message: String(text).trim().slice(0, 2000) } : null)
      || (() => { const n = noticeScam(text); return n ? { ...n, noticed: true } : null; })();   // (the scam shield: a scammy message pasted without asking, Nov 7)
    if (scamWait) memory.set("scamcheck.waiting", null);
    if (scamAsk) {
      if (scamAsk.waiting) memory.set("scamcheck.waiting", Date.now());
      const first = { id, mood: scamAsk.waiting ? "curious" : "thinking", strikes: state.strikes };
      broadcast({ type: "first", ...first });
      memory.turn("user", text, { feelings: f.model, rule });
      // Detective Mochi (Nov 7): on goes the detective hat and out comes the magnifying glass while the two checks run;
      // the answer brings out the stop sign for a scam
      const detProp = (n) => { const e = POCKET.find((x) => x.name === n); return e ? { name: e.name, archetype: e.archetype, recipe: e } : null; };
      const download = scamAsk.message && !hasSkill(SKILL_PACK.id) && learnSkill(SKILL_PACK.id, SKILL_PACK.name) ? { skill: SKILL_PACK.name, items: SKILL_PACK.items } : null;   // (the first time: he learns it before he helps)
      if (scamAsk.message) broadcast({ type: "scamcheck", phase: "start", wear: [detProp("detective hat")].filter(Boolean), hold: detProp("magnifying glass"), download });
      const check = scamAsk.message ? await checkMessage(scamAsk.message, { llm: craftLLM, log: console }) : null;
      if (check) check.props = { sign: check.verdict === "scam" ? detProp("stop sign") : null, hat: detProp("detective hat") };
      if (check) {
        const sc = memory.get("scams", null) || { played: 0, spotted: 0, recent: [] };
        memory.set("scams", { ...sc, checked: (sc.checked || 0) + 1, caught: (sc.caught || 0) + (check.verdict !== "safe" ? 1 : 0) });
        console.log(`[scamcheck] ${check.verdict} (${check.type}, ${check.sure}; rules ${check.rules.verdict} ${check.rules.risk}%, ${check.model ? `${check.model.by} ${check.model.verdict} ${Math.round(check.model.confidence * 100)}%` : "no model"}) in ${check.ms} ms`);
      }
      try {
        const r = await brain.reply({ text, note: null, extraContext: ((scamAsk.noticed ? "\nThey pasted this message without asking you to check it, but it looked like a scam, so you checked it anyway (start with something like \"Wait! Before you do anything with that, I checked it…\")." : "") + (check ? checkNote(check) : WAITING_NOTE)).trim(), signal: AbortSignal.timeout(CONFIG.llm.timeoutMs), mode: mode === "zeroday" ? "zeroday" : null, calm: true, noTools: true, onStage: null });
        const tagged = r.text || ""; r.text = stripTags(tagged) || (check ? fallbackLine(check) : "Sure! Paste the message here and I'll take a look.");
        memory.turn("assistant", r.text, {});
        return res.json({ ...first, reply: { text: r.text, say: tagged !== r.text && stripTags(tagged) === r.text ? tagged : undefined, actions: (r.actions || []).filter((a) => a.kind === "mood").slice(0, 1), scamCheck: check || undefined, llm: r.llm } });
      } catch (e) {
        const line = check ? fallbackLine(check) : "Sure! Paste the message here and I'll take a look.";
        memory.turn("assistant", line, {});
        return res.json({ ...first, reply: { text: line, actions: [], scamCheck: check || undefined, fallback: true } });
      }
    }
    // Mochi's Money World (money.js, Nov 8, the PNC track): the money card, "what if", buying at Mimi's stand, the
    // allowance, lending to Cocoa, teaching Mimi a money rule. Play money only; the numbers come from memory, so what
    // he says and what the card shows always agree. A loan counts turns, so Cocoa pays back a little later.
    // words on a prop (Nov 8): "write PNC on the bank" (before money: "the bank" here is a prop, not a deposit)
    const wWant = f.crisis || state.strikes >= 3 ? null : textIntent(text);
    if (wWant && await wordsTurn(wWant, { text, id, f, rule, holding, res })) return;
    const mNow = moneyState(memory.get("money", null));
    if (mNow.loan) { mNow.loan.turns = (mNow.loan.turns || 0) + 1; memory.set("money", mNow); }
    let mWant = f.crisis || state.strikes >= 3 || state.careUntil > Date.now() ? null : moneyIntent(text, mNow);
    if (mWant && mWant.kind === "skit" && !/\b(?:money|saving|spend|bank|budget|allowance|piggy|wants?|deal|coins|dollars)\b/i.test(text) && state.skit && state.skit.at > mNow.skitAt) mWant = null;   // ("again" after a scam scene is the scam game again)
    if (mNow.pending && !(mWant && mWant.kind === "pick")) { mNow.pending = null; memory.set("money", mNow); }   // (asked and not answered: dropped, like the scam game's question)
    if (mWant && await moneyTurn(mWant, mNow, { text, id, f, rule, mode, seq, res })) return;
    // taught phrase triggers: instant, but never on a crisis line
    let trigger = null;
    if (!f.crisis) { const low = text.toLowerCase(); trigger = memory.triggers().find((p) => low.includes(p.phrase)) || null; }
    // a prop that fits what they said (a globe for a geography question, a squirt for a tease): out while he reads
    state.cue = state.cue || { fired: {}, at: 0, since: 99 };
    state.cue.since++;
    // "throw a water balloon at Cocoa", "Cocoa, throw a snowball at Mochi", "snowball fight!": soft-toy throws, played
    // at once; never while they're upset, while he's worried about them, or sulking
    // pointing ("throw a snowball at that": the tap says where) comes before a throw at Cocoa or at them
    // "have a water gun fight with Cocoa": Cocoa pulls out his own water gun and they take turns (Nov 4)
    const wetWant = f.crisis || state.careUntil > Date.now() || state.strikes >= 3 || ["hurt", "pout", "comfort", "concern", "gentle"].includes(f.decision) ? null : waterFightIntent(text);
    const water = wetWant ? { fight: planWaterFight({ starter: wetWant.starter, ambush: wetWant.starter === "mochi" ? ambushFor(memory) : null }), ...waterGuns(memory) } : null;
    if (water) wetAgain(memory);
    const pointWords = water || f.crisis || state.careUntil > Date.now() || state.strikes >= 3 || ["hurt", "pout", "comfort", "concern", "gentle"].includes(f.decision) ? null : pointIntent(text);
    const toss = water || pointWords || f.crisis || state.careUntil > Date.now() || state.strikes >= 3 || ["hurt", "comfort", "concern", "gentle"].includes(f.decision) ? null : throwIntent(text);
    const tossBall = toss && POCKET.find((e) => e.name === toss.thing), tossPlan = toss && planThrows(toss.steps, cleanGuard(guard));
    // "ride your bike", "can you ride a tricycle?": he hops on and rides across the stage while he reads
    const rideWant = toss || f.crisis || state.strikes >= 3 || ["hurt", "comfort", "concern", "gentle"].includes(f.decision) ? null : rideIntent(text, memory.props(), holding && typeof holding.name === "string" ? { name: holding.name, slot: String(holding.slot || "") } : null);
    if (rideWant && rideWant.upgrade) upgradeCar(memory.props().find((p) => p.id === rideWant.upgrade));
    const rideProp = rideWant && (rideWant.owned ? memory.findProp(rideWant.name) : POCKET.find((e) => e.name === rideWant.name) || memory.findProp(rideWant.name));
    // safety first: his helmet goes on too (one thing on his head while he rides: he can wear and ride at once)
    const rideKind = rideProp ? (validateProp(rideProp.recipe || rideProp).recipe || {}).rideKind || "sit" : null, rideDrive = rideKind === "drive";   // a car: no helmet, a back seat
    const inIt = rideKind === "drive" || rideKind === "fly" || rideKind === "sail";   // (sat inside it: no bike helmet)
    const ride = rideProp ? { id: rideProp.id || null, name: rideProp.name, archetype: "ride", recipe: rideProp.recipe || rideProp, helmet: inIt ? null : POCKET.find((e) => e.name === "protective helmet") || null, drive: rideDrive, kind: rideKind, passenger: rideDrive && rideWant.passenger ? rideWant.passenger : null } : null;
    // "let's do our handshake" → he offers it; "let's make a secret handshake" (or none yet) → he asks you to teach him
    const hsWant = f.crisis || state.strikes >= 3 ? null : handshakeIntent(text);
    const handshake = hsWant && (hsWant === "offer" && (memory.get("handshake", null) || {}).steps ? "offer" : "teach");
    // "I want to teach you a cool move", "want to learn a new move?": the posing lesson opens (the "Teach a move" button)
    const pose = handshake || f.crisis || state.strikes >= 3 || ["hurt", "pout", "comfort", "concern", "gentle"].includes(f.decision) || !teachMoveIntent(text) ? null : "teach";
    // "teach Mimi the twirl": she hops in, he shows her, she copies it (wobbly, then better)
    const lesson = f.crisis || toss || state.strikes >= 3 ? null : teachFriendIntent(text, memory.moves());
    const teach = lesson && { who: lesson.who, move: { id: lesson.move.id, name: lesson.move.name, recipe: lesson.move.recipe, skill: lesson.move.skill }, prop: brainHelpers.lessonProp ? brainHelpers.lessonProp(lesson.move) : null };
    // "give Mimi a hug": she comes right up to him, arms round each other (not while he's hurt or sulking)
    const hug = f.crisis || toss || state.strikes >= 3 || ["hurt", "pout"].includes(f.decision) ? null : hugIntent(text);
    // "Mimi, dress up as a doctor", "let's all dress up as chefs" (dress.js, Nov 7): on goes the job's hat or outfit and
    // its tool, on whoever was named (just him, "dress up as a doctor", is his activity book's)
    const dressWant = f.crisis || toss || state.strikes >= 3 || state.careUntil > Date.now() || ["hurt", "pout", "comfort", "concern", "gentle"].includes(f.decision) ? null : dressIntent(text);
    const dress = dressWant ? dressPlan(dressWant) : null;
    // the scam-spotting game (scams.js, Nov 7): a friend showed him a made-up scam message and he asked "what looks
    // fishy?"; this message is the answer (within 10 minutes; anything else and the question's dropped)
    const scamQ = memory.get("scam.quiz", null), scamLive = scamQ && !f.crisis && Date.now() - scamQ.at < 10 * 60000 ? scamQ : null;
    const scamAns = scamLive ? gradeAnswer(text, scamLive) : null;
    let scamsNow = memory.get("scams", null) || { played: 0, spotted: 0, recent: [] };
    if (scamQ) memory.set("scam.quiz", null);
    if (scamAns) {
      scamsNow = { ...scamsNow, spotted: scamsNow.spotted + (scamAns.found.length || scamAns.guessed ? 1 : 0) };
      memory.set("scams", scamsNow);
      try { memory.scrap(scrapLine(scamLive, scamAns), "story"); } catch (_) { /* fine */ }
      console.log(`[scam] ${scamLive.id}: spotted ${scamAns.found.join(", ") || (scamAns.idk ? "(not sure)" : "(a hunch)")}; missed ${scamAns.missed.join(", ") || "nothing"}`);
    }
    // Teach Mimi (Nov 7): what you spotted in a message Mimi showed you, she remembers (and spots it herself next time)
    if (scamAns && scamLive.who === "mimi" && scamAns.found.length) {
      const L = memory.get("mimi.learned", null) || {};
      for (const id of scamAns.found) if (!L[id]) L[id] = { said: String(text).slice(0, 120), at: new Date().toISOString() };
      memory.set("mimi.learned", L);
      try { memory.scrap(`you taught Mimi a scam warning sign: ${scamAns.found.map((id) => SCAM_TELLS[id].name).join(", ")}`, "story"); } catch (_) { /* fine */ }
    }
    // the scam-call game (Cocoa the scammer): what should Mimi do? The next message is the pick (within 10 minutes)
    const callQ = memory.get("scam.choice", null), callLive = callQ && !f.crisis && !scamAns && Date.now() - callQ.at < 10 * 60000 ? callQ : null;
    const callPick = callLive ? gradeChoice(text, callLive) : null;
    if (callQ) memory.set("scam.choice", null);
    if (callPick) {
      scamsNow = { ...scamsNow, spotted: scamsNow.spotted + (callPick === "hang" ? 1 : 0) };
      memory.set("scams", scamsNow);
      try { memory.scrap(`we played the scam-call game: Cocoa pretended to be a scammer; you chose "${callPick === "hang" ? "hang up" : callPick === "ask" ? "ask a question" : "do what he said"}"`, "story"); } catch (_) { /* fine */ }
      console.log(`[scam] call ${callLive.id}: picked ${callPick}`);
    }
    const lastScene = (() => { const S = state.skit; return S && S.lastNeed ? { lastNeed: S.lastNeed, lastAt: S.at } : {}; })();   // ("again" carries on the same game)
    const scamGame = !f.crisis && !scamAns && !callPick && (skitMoment(text, "", lastScene) || {}).need === "scam";
    // a guess about a friend ("I think Mimi wants a piggyback ride", "Cocoa is looking at your food"): he asks them
    // first, they answer, and only a yes leads to it (hints.js, Nov 7). They say no to what they had a few minutes ago.
    const hintWant = dress || hug || f.crisis || toss || ride || water || teach || state.strikes >= 3 || ["hurt", "pout", "comfort", "concern"].includes(f.decision) ? null : hintIntent(text);
    const hintLast = state.hintLast || (state.hintLast = { piggy: {}, food: {} });
    let hint = null, hintShare = null;
    if (hintWant) {
      if (hintWant.want === "food") {   // what he'd share: the food they named, the food in his hoof, his newest food, else a cookie
        const hold = holding && typeof holding.name === "string" ? holding.name : null;
        const own = memory.props().filter((p) => eatStyle(p.name) && p.archetype !== "ride" && p.archetype !== "companion").map((p) => p.name);
        for (const name of [hintWant.thing, hold && eatStyle(hold) ? hold : null, own.at(-1), "cookie"]) {
          if (!name) continue;
          const sw = shareIntent({ text: `share your ${name} with ${hintWant.who}`, props: memory.props(), holding: null, recent: [] });
          if (sw && eatStyle(sw.prop.name)) { hintShare = sw; break; }
        }
      }
      hint = hintPlan(hintWant, { last: hintLast, food: hintShare ? hintShare.prop.name : null });
    }
    // "give Mimi a piggyback ride": she hops onto his back and he carries her about (Nov 4)
    const piggy = hintWant ? (hint && hint.want === "piggy" && hint.yes ? hint.who : null)
      : hug || f.crisis || toss || ride || state.strikes >= 3 || ["hurt", "pout", "comfort", "concern"].includes(f.decision) ? null : piggyIntent(text);
    // "share your cookie with Mimi", "give Cocoa a cookie" (Nov 4): he holds it out and they take it (food they eat)
    const shareWant = hintWant ? (hint && hint.want === "food" && hint.yes ? hintShare && { ...hintShare, give: false } : null)
      : hug || piggy || f.crisis || toss || water || ride || teach || state.strikes >= 3 || ["hurt", "pout"].includes(f.decision) ? null
      : shareIntent({ text, props: memory.props(), holding: holding && typeof holding.name === "string" ? { name: holding.name } : null, recent: memory.recentTurns(6).filter((t) => t.role === "user").map((t) => t.text) });
    const share = shareWant && { who: shareWant.who, give: shareWant.give, prop: { id: shareWant.prop.id || null, name: shareWant.prop.name, archetype: shareWant.prop.archetype, recipe: shareWant.prop.recipe || shareWant.prop }, food: !!eatStyle(shareWant.prop.name) };
    if (share && share.prop.id) memory.usedProp(share.prop.id);
    if (piggy) hintLast.piggy[piggy] = Date.now();   // (so a guess right after gets a "maybe later")
    if (share && share.food) for (const w of share.who) hintLast.food[w] = Date.now();
    // "let's dance!", "party time!": a dance party with Mimi and Cocoa (not while they're upset, he's worried, or sulking)
    // his activity book (Nov 3): "play the guitar", "let's have a tea party", "do the robot" (a dance from the book beats a plain dance party)
    const jobScene = !f.crisis && (skitMoment(text, "", lastScene) || {}).need === "jobs";   // "do a skit where Mimi is a doctor": the scene dresses them (skits.js)
    const bookWant = dress || jobScene || f.crisis || toss || ride || hug || state.strikes >= 3 || state.careUntil > Date.now() || ["hurt", "pout", "comfort", "concern", "gentle"].includes(f.decision) ? null : bookIntent(text, { moves: memory.moves() });
    const party = f.crisis || toss || ride || state.strikes >= 3 || state.careUntil > Date.now() || ["hurt", "pout", "comfort", "concern", "gentle"].includes(f.decision) || (bookWant && BOOK_BY_ID[bookWant.id] && BOOK_BY_ID[bookWant.id].cat === "dance") ? null : partyIntent(text);
    // "stand up", "sit down", "go for a walk": he just does it (not while they're upset, he's worried about them, or he's sulking)
    const calmNow = !(f.crisis || toss || ride || party || state.strikes >= 3 || state.careUntil > Date.now() || ["hurt", "pout", "comfort", "concern"].includes(f.decision));
    // "Mimi, walk around", "go for a walk with Mimi" (Nov 4): she walks; him too only when it's with him
    const friendWalk = calmNow ? friendWalkIntent(text) : null;
    const stance = !calmNow ? null : friendWalk ? (friendWalk.withMochi ? "walk" : null) : stanceIntent(text);
    // a sneeze and a little cold (Nov 3): "you caught a cold" → red nose, scarf, sneezes; soup, tea, honey, medicine or a
    // nap make him better (said, or the soup dragged onto him); "can you sneeze?" → ACHOO. Never while they're upset.
    const hadCold = coldOn();
    const remedy = hadCold && (Array.isArray(events) ? events : []).some((e) => typeof e === "string" && /^given:.*\b(?:soup|tea|honey|medicine|syrup|juice|cocoa|milk|lemon|tissue)/i.test(e));
    const upset = f.crisis || state.strikes >= 3 || state.careUntil > Date.now() || ["hurt", "pout", "comfort", "concern", "gentle"].includes(f.decision);
    const coldWant = f.crisis || state.strikes >= 3 ? null : remedy ? { end: true } : coldIntent(text, { cold: hadCold });
    let coldEv = null;
    const upsetHard = f.crisis || state.strikes >= 3 || state.careUntil > Date.now() || ["hurt", "pout"].includes(f.decision);   // ("oh no, you caught a cold!" is concern for him: fine)
    if (coldWant && coldWant.start && !hadCold && !upsetHard) { setCold(true); coldEv = "start"; }
    else if (coldWant && coldWant.end && hadCold) { setCold(false); coldEv = "end"; }
    const sneeze = !!(coldWant && coldWant.sneeze) && !upset && !party && !ride && !toss;
    // saving up (Nov 3): a goal kept in his piggy bank; coins go in as they tell him; a little party at the goal
    const sv = f.crisis || state.strikes >= 3 ? null : savingsIntent(text);
    let savings = null;
    // (the piggy bank is money too: the first time, he downloads his money skill pack before he helps, Nov 8)
    let moneyDl = sv && !hasSkill(MONEY_SKILL.id) && learnSkill(MONEY_SKILL.id, MONEY_SKILL.name) ? skillDownload() : null;
    if (sv) {
      const cur = memory.get("savings", null);
      const fmt = (n) => (Math.round(n * 100) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });
      // (Nov 8, Money World: a new goal keeps what's already in the piggy bank, unless the old goal was reached, so
      // the money card's picture doesn't lose $7 because the kite became a bike)
      const carried = cur && cur.goal !== sv.goal && cur.saved > 0 && !(cur.target && cur.saved >= cur.target) ? cur.saved : 0;
      if (sv.goal) { savings = { goal: sv.goal, target: sv.target || (cur && cur.goal === sv.goal ? cur.target : null), saved: cur && cur.goal === sv.goal ? cur.saved : carried, added: 0, event: "goal" }; memory.set("savings", { ...savings, since: new Date().toISOString() }); memory.scrap(`you started saving up for ${sv.goal}${savings.target ? ` ($${fmt(savings.target)})` : ""}; I'm keeping it in my piggy bank`, "savings", null); }
      else if (cur && (sv.add !== undefined || sv.spend)) {
        const add = sv.spend ? -sv.spend : sv.add == null ? 0 : sv.add;
        // Money World: money put in the piggy bank comes out of their wallet when it's there ("put $4 in the piggy
        // bank" after a job); either way it counts as a save for the money card's saving habit
        if (add > 0) { const mw = moneyState(memory.get("money", null)); const fromWallet = mw.wallet >= add && !/\b(?:got|earned|found|gave me|birthday|from (?:my|grandma|grandpa|mom|dad))\b/i.test(text);
          if (fromWallet) mw.wallet = Math.round((mw.wallet - add) * 100) / 100;
          logIt(mw, "save", add, `saved for ${cur.goal}`); memory.set("money", mw); }
        if (add < 0) { const mw = moneyState(memory.get("money", null)); logIt(mw, "spend", -add, "spent from the piggy bank"); memory.set("money", mw); }
        const saved = Math.max(0, Math.round((cur.saved + add) * 100) / 100), done = cur.target && saved >= cur.target && !(cur.saved >= cur.target);
        savings = { ...cur, saved, added: add, event: done ? "done" : add < 0 ? "spend" : "add" }; memory.set("savings", { ...cur, saved, doneAt: done ? new Date().toISOString() : cur.doneAt || null });
        if (done) memory.scrap(`you saved up all $${fmt(cur.target)} for ${cur.goal}!`, "savings", null);
      } else if (cur) savings = { ...cur, added: 0, event: "ask" };
      else if (sv.ask || sv.add) savings = { goal: null, target: null, saved: 0, added: 0, event: "none" };
    }
    // "shoot this thing over here": the page asks for a tap, then he does it there (with what he's told to, else what fits)
    // "Mimi, how was your day?": they're talking to a friend; she hops in (he runs in) and answers
    // (or they picked Mimi or Cocoa with the button by the message box: the page sends `to`)
    const toWho = req.body && ["mimi", "cocoa"].includes(req.body.to) ? req.body.to : null;
    // "let Mimi and Cocoa go", "just you and me", "some alone time": they say bye and leave (and don't answer back)
    const dismiss = f.crisis ? null : dismissIntent(text);
    const talkTo = dismiss || friendWalk || f.crisis || toss || state.strikes >= 3 || state.careUntil > Date.now() || ["hurt", "comfort", "concern", "gentle", "pout"].includes(f.decision) ? null : toWho || talkToIntent(text);
    // who's on stage right now, as the page sees it (so a friend who has left doesn't keep talking in the chat)
    const fr = req.body && req.body.friends && typeof req.body.friends === "object" ? req.body.friends : null;
    const onStage = (fr ? ["mimi", "cocoa"].filter((w) => fr[w] && fr[w] !== "leaving") : null) && (fr ? ["mimi", "cocoa"].filter((w) => fr[w] && fr[w] !== "leaving" && !(dismiss || []).includes(w)) : null);
    const pt = ride ? null : pointWords;
    let point = null;
    if (pt) {
      const named = pt.thing && brainHelpers.findOwned ? brainHelpers.findOwned(pt.thing) : null;
      const pick = (want) => (named && (want ? named.archetype === want : true) ? named : null) || memory.props().find((p) => p.archetype === want) || POCKET.find((e) => e.name === (want === "throwable" ? "water balloon" : "water pistol"));
      const prop = pt.do === "shoot" ? (named && named.archetype === "throwable" ? named : pick("launcher")) : pt.do === "throw" ? (named && named.archetype === "launcher" ? named : pick("throwable")) : null;
      point = { do: pt.do, at: pt.at || null, prop: prop ? { id: prop.id || null, name: prop.name, archetype: prop.archetype, recipe: prop.recipe || prop } : null };
    }
    // an activity he really does: painting, juggling, a party trick (Nov 3); "a sheep" after he asked what to paint
    const hisLast = (memory.recentTurns(3).filter((x) => x.role === "assistant").at(-1) || {}).text || "";
    // a prop used on another one (Nov 7): "water the flower", "cut the paper", "paint the present blue", "light the campfire"
    const pa = f.crisis || toss || water || ride || handshake || pose || teach || hug || piggy || share || hint || dress || point || party || sv || dismiss || state.strikes >= 3 || ["hurt", "pout", "comfort", "concern", "gentle"].includes(f.decision) || talkTo ? null : propActIntent(text, { props: memory.props(), pocket: POCKET });
    const paHooves = pa && pa.verb === "measure" ? (() => { const ps = (pa.target.recipe.parts || []).filter((x) => Array.isArray(x.at) && Array.isArray(x.size)); if (!ps.length) return null; const lo = (k) => Math.min(...ps.map((x) => x.at[k] - x.size[k] / 2)), hi = (k) => Math.max(...ps.map((x) => x.at[k] + x.size[k] / 2)); const h = hi(1) - lo(1), s = Math.max(0.45, Math.min(1.1, 0.95 / Math.max(hi(0) - lo(0), h, 0.01))); return Math.max(1, Math.round((h * s) / 0.2)); })() : null;   // (as the floor shows it)
    const actWant = pa || f.crisis || toss || water || ride || handshake || pose || teach || hug || piggy || share || hint || dress || point || party || sv || dismiss || state.strikes >= 3 || state.careUntil > Date.now() || ["hurt", "pout", "comfort", "concern", "gentle"].includes(f.decision) || talkTo ? null : activityIntent(text) || paintAnswer(text, hisLast) || (stance ? null : bookWant);   // (talking to Mimi or Cocoa: it's theirs to answer)
    // Money World (Nov 8): a job or a chore done with him pays a little play money into their wallet (once a minute at
    // most); spotting a scam in the game does too
    const EARN_JOBS = { doctor: "doctor", firefighter: "firefighter", astronaut: "astronaut", police: "police officer", engineer: "engineer", pilot: "pilot", farmer: "farmer", artist: "artist", detective: "detective", chef: "chef", teacher: "teacher", scientist: "scientist", reporter: "news reporter", hackjudge: "hackathon judge", courtjudge: "judge", rockstar: "rock star", cook: "chef", bake: "baker" };
    const EARN_CHORES = { clean: "tidying up", garden: "planting a flower", water: "watering the plants" };
    const myJob = (dress || []).find((d) => d.who === "mochi"), doing = actWant && actWant.kind === "book" ? actWant : null;   // (only when the job really happens)
    const earnWhy = upset ? null : myJob ? { kind: "job", what: `for working as a ${myJob.title}` }
      : doing && EARN_JOBS[doing.id] ? { kind: "job", what: `for working as a ${EARN_JOBS[doing.id]}` }
      : doing && EARN_CHORES[doing.id] ? { kind: "chore", what: `for ${EARN_CHORES[doing.id]}` }
      : scamAns && scamAns.found.length ? { kind: "scam", what: "for spotting a scam" } : null;
    // he only knows money once he's downloaded it: a job done "to earn" (or with money words) downloads it first;
    // a job just for fun on day zero pays nothing (he doesn't know what money is yet)
    if (earnWhy && !hasSkill(MONEY_SKILL.id) && /\b(?:earn|money|dollars?|coins|pay|\$\d)/i.test(text) && learnSkill(MONEY_SKILL.id, MONEY_SKILL.name)) moneyDl = skillDownload();
    const earned = earnWhy && hasSkill(MONEY_SKILL.id) ? earn(memory.get("money", null), earnWhy.kind, earnWhy.what.replace(/^for /, "")) : null;
    if (earned) { memory.set("money", earned.money); console.log(`[money] earned ${moneyFmt(earned.amount)} ${earnWhy.what}; wallet ${moneyFmt(earned.money.wallet)}`); }
    const makeUp = actWant && actWant.kind === "improvise" ? actWant : null;   // one he makes up: the plan comes after the reply (below)
    const actSpecP = actWant && !makeUp ? activitySpec(actWant).catch((e) => { console.warn("[activity]", e.message); return null; }) : null;   // (a painting is planned while he talks)
    // "act out a little story with Mimi": a scene is written for it (skits.js), no canned cue first
    const storyAsk = !f.crisis && (["story", "jobs", "scam"].includes((skitMoment(text, "", lastScene) || {}).need) || !!scamAns || !!callPick);
    const cue = f.crisis || pa || toss || water || ride || handshake || pose || teach || hug || piggy || share || hint || dress || storyAsk || stance || point || party || sv || dismiss || actWant ? null : pickCue(text, { decision: f.decision, request: f.request, care: state.careUntil > Date.now(), sulking: state.strikes >= 3, owned: memory.props(), lastFired: state.cue.fired, lastAny: state.cue.at, since: state.cue.since,
      holding: holding && typeof holding.name === "string" ? { name: holding.name } : null });
    if (cue) { state.cue.fired[cue.id] = state.cue.at = Date.now(); state.cue.since = 0; }
    const first = { id, mood: toss || ride ? "excited" : cue && cue.how === "squirt" ? "laugh" : dismiss && f.mood === "showoff" ? "love" /* "let Mimi go" names her: no showing her off */ : f.mood, sulk: f.sulk, strikes: state.strikes, startSulk: f.startSulk, endSulk: f.endSulk, crisis: f.crisis, request: f.request, trigger: trigger && trigger.action, feelings: f.model, feelingsMs: f.ms,
      cue: cue && { id: cue.id, how: cue.how, friends: cue.friends || [], prop: cue.prop && { id: cue.prop.id || null, name: cue.prop.name, archetype: cue.prop.archetype, recipe: cue.prop.recipe } },
      money: earned ? { earned: earned.amount, wallet: earned.money.wallet } : undefined,
      ride, handshake, pose, teach, hug, piggy, share, hint, dress, stance, point, talkTo, party, sneeze, dismiss, savings: savings && { ...savings, prop: PIGGY() }, cold: coldEv ? { on: coldEv === "start", until: coldEv === "start" ? state.cold.until : 0 } : null,
      throw: toss && { steps: toss.steps, thing: toss.thing, fight: toss.fight, ball: tossBall, shield: POCKET.find((e) => e.name === SHIELD), plan: tossPlan.plan.map((p) => p.outcome) },
      water: water && { fight: water.fight, gun: water.gun.recipe, gunName: water.gun.name, cocoaGun: water.cocoaGun },
      propAct: pa && { verb: pa.verb, tool: pa.tool, target: pa.target, colour: pa.colour, colourName: pa.colourName, line: pa.line, hooves: paHooves },
      friendWalk };
    // His first reaction goes to the page now, ~15 ms in, while he is still "reading". The kit only waits 0.6 s past
    // its reading time for it (src/mochi.js, waitModel); sent with the reply (1.5–10 s) it often arrived too late
    // and the word rules decided his face instead. The HTTP response repeats it; the page applies each id once.
    if (moneyDl) broadcast({ type: "skill", download: moneyDl });   // (the card plays while he reads; his answer waits for it)
    broadcast({ type: "first", ...first });
    if (f.crisis) { broadcast({ type: "care", on: true }); memory.turn("user", text, { crisis: true }); }
    else memory.turn("user", text, { feelings: f.model, rule });

    if (f.crisis) {   // deterministic reply, no model, no effects, no follow-ups, not remembered
      memory.turn("assistant", CRISIS_REPLY, { crisis: true });
      return res.json({ ...first, reply: { text: CRISIS_REPLY, actions: [{ kind: "mood", name: "concerned" }], crisis: true } });
    }
    if (state.strikes >= 3) {   // sulking: the page answers "....." and Mochi stays turned away; only an apology (forgive) ends it
      return res.json({ ...first, reply: { text: ".....", actions: [], sulking: true } });
    }
    // "Does it look right?" after Pip wasn't sure (Nov 7): yes confirms it (and he learns the pattern); no, he asks
    // what to change. Only the first thing they say after the question, within 10 minutes.
    let revealNote = "";
    { const lr = memory.get("lastReveal", null);
      if (lr && lr.unsure && !lr.answered && Date.now() - (lr.at || 0) < 10 * 60000) {
        memory.set("lastReveal", { ...lr, answered: true });
        const said = revealVerdict(text), p = said && memory.props().find((x) => x.id === lr.id);
        if (p && said === "yes") {
          memory.setPropMeta(p.id, { matched: true, unsure: false, confirmed: "you" });
          const learned = learnFrom({ ok: true, matched: true, recipe: { ...p.recipe, name: p.name, archetype: p.archetype }, pattern: null, attempts: [{ round: 0, match: true, confidence: 1 }] }, p.id, "you said so");
          revealNote = `\nThey just said your ${p.name} looks right (Pip hadn't been sure). Be happy and a bit proud, short${learned ? "; and now you know how to make them, so say so" : ""}.`;
          console.log(`[workbench] you said the ${p.name} looks right${learned ? "; learned the pattern" : ""}`);
        } else if (p && said === "no") revealNote = `\nThey said your ${p.name} doesn't look right yet. If they said what to change, fix it (fix_prop); if not, ask what you should change, short and keen.`;
      } }
    const note = bodyNote(f.mood, costume, events);
    const poseNote = pose ? "\nOn screen just now: you got ready to learn a new move from them: they drag your arms, head, body or feet to show you how it goes, then press Done and give it a name. Say you're ready, short and excited. Don't make up a move yourself and don't ask the workbench for one: they're about to show you." : "";
    const hsNote = poseNote || (handshake === "offer" ? "\nOn screen just now: you held out your hoof to do your secret handshake with them. Keep your words short and excited." : handshake === "teach" ? "\nOn screen just now: you held out both hooves so they can teach you a secret handshake (they tap and swipe your hooves, head and tummy, then press Done). Say you're ready, short." : "");
    const teachNote = teach ? `\nOn screen just now: ${teach.who === "mimi" ? "Mimi hopped in" : "Cocoa ran in"} and you're teaching ${teach.who === "mimi" ? "her" : "him"} your ${teach.move.name}: you show it, ${teach.who === "mimi" ? "she" : "he"} tries it (wobbly at first), then gets it. Cheer ${teach.who === "mimi" ? "her" : "him"} on, short.` : "";
    const piggyNote = piggy ? `\nOn screen just now: ${piggy === "mimi" ? "Mimi" : "Cocoa"} hopped up onto your back for a piggyback ride and you're carrying ${piggy === "mimi" ? "her" : "him"} about${piggy === "cocoa" ? " (he's a bit heavy!)" : ""}. Say something fun and short.` : "";
    const shareNames = share ? share.who.map((w) => (w === "mimi" ? "Mimi" : "Cocoa")).join(" and ") : "";
    const shareNote = share ? `\nOn screen just now: you're sharing your ${share.prop.name} with ${shareNames}: you hold it out and ${share.who.length > 1 ? "they each take" : share.who[0] === "mimi" ? "she takes" : "he takes"} ${share.food ? `one and ${share.who.length > 1 ? "eat" : "eats"} it up (you keep yours)` : share.give ? "it (it's theirs now)" : "one"}. Say something sweet and short; don't call any tools.` : "";
    const hugNote = shareNote && !hint ? shareNote : hug ? `\nOn screen just now: you gave ${hug === "mimi" ? "Mimi" : "Cocoa"} a big hug (${hug === "mimi" ? "she" : "he"} came right up to you, arms round each other, hearts floating up). Say something sweet and short.` : "";
    const pointNote = point && point.at ? `\nOn screen just now: ${point.at === "mimi" ? "Mimi hopped in and you're giving her a gentle little squirt" : "Cocoa ran in and you're firing"} with your ${point.prop ? point.prop.name : "launcher"}${point.at === "mimi" ? "" : " at him"}. All in fun; say something short and playful.` : point ? `\nOn screen just now: they pointed at a spot on the screen and you're about to ${point.do === "shoot" ? `fire your ${point.prop.name} at it` : point.do === "throw" ? `throw a ${point.prop.name} at it` : point.do === "look" ? "look at it" : point.do === "go" ? "toddle over to it" : "put it down there"}. Say something short and playful about it.` : "";
    const partyNote = party ? `\nOn screen just now: it's a dance party! A disco ball dropped down, music is playing and you're dancing${party.friends.length ? ` with ${party.friends.map((w) => (w === "mimi" ? "Mimi" : "Cocoa")).join(" and ")}` : ""}. Say something fun and short.` : "";
    const fwNames = friendWalk ? friendWalk.who.map((w) => (w === "mimi" ? "Mimi" : "Cocoa")).join(" and ") : "";
    const fwNote = friendWalk ? `\nOn screen just now: ${fwNames} ${friendWalk.who.length > 1 ? "are" : "is"} taking a little walk about the floor${friendWalk.withMochi ? ", and you're walking along too, on your little back legs" : " (they walk on their own legs, like you)"}. Say something fun about it, short.` : "";
    const stanceNote = fwNote ? fwNote : partyNote ? partyNote : pointNote ? pointNote : stance === "walk" ? "\nOn screen just now: you stood up on your little back legs and you're toddling across the stage and back. Say something fun about it, short."
      : stance === "stand" ? (standing ? "\nOn screen just now: you were already standing on your little back legs. Say so, short." : "\nOn screen just now: you stood up on your little back legs (you usually sit). Say something proud about it, short.")
      : stance === "sit" ? (standing ? "\nOn screen just now: you sat back down with a little plop. Short." : "\nOn screen just now: you're sitting already, comfy. Short.") : "";
    const coldNote = coldEv === "start" ? "\nOn screen just now: you caught a little cold! Your nose went red, a stripy scarf appeared round your neck and you sneezed: \"Ah… ah… ACHOO!\" Say something short, a bit sniffly and sweet."
      : coldEv === "end" ? "\nOn screen just now: your cold went away (the scarf came off with a sparkle) and you feel much better! Thank them, short and happy."
      : sneeze ? "\nOn screen just now: you did a big sneeze: \"Ah… ah… ACHOO!\" Say something short and funny about it." : "";
    const svCur = memory.get("savings", null), svFmt = (n) => (Math.round(n * 100) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });
    const savingsNote = savings ? (savings.event === "goal" ? `\nOn screen just now: your piggy bank hopped out beside you: they're saving up for ${savings.goal}${savings.target ? ` ($${svFmt(savings.target)})` : " (no amount yet: ask how much it costs)"}. Be excited, short.`
      : savings.event === "done" ? `\nOn screen just now: the last coin went in and your piggy bank is FULL: $${svFmt(savings.saved)} for ${savings.goal}! Confetti everywhere. Celebrate with them, short.`
      : savings.event === "add" ? `\nOn screen just now: ${savings.added ? `$${svFmt(savings.added)} went` : "a coin went"} into your piggy bank: $${svFmt(savings.saved)}${savings.target ? ` of $${svFmt(savings.target)}` : ""} for ${savings.goal}. Cheer, and say how close they are, short.`
      : savings.event === "spend" ? `\nOn screen just now: $${svFmt(-savings.added)} came out of your piggy bank: $${svFmt(savings.saved)}${savings.target ? ` of $${svFmt(savings.target)}` : ""} left for ${savings.goal}. No nagging; be kind, short.`
      : savings.event === "none" ? "\nThey mentioned saving but there's no goal in your piggy bank yet: ask what they'd like to save up for and how much it costs, short."
      : `\nOn screen just now: you held up your piggy bank: $${svFmt(savings.saved)}${savings.target ? ` of $${svFmt(savings.target)}` : ""} saved for ${savings.goal}. Tell them, short.`) : "";
    const dismissNote = dismiss ? `\nOn screen just now: ${dismiss.length === 2 ? "Mimi and Cocoa waved goodbye and left" : dismiss[0] === "mimi" ? "Mimi waved goodbye and hopped off" : "Cocoa waved goodbye and ran off"}; it's just the two of you now. Don't write any lines for them. Say something short and warm.` : "";
    const savingsCtx = svCur && svCur.goal && !savings ? ` (Your piggy bank: they're saving up for ${svCur.goal}: $${svFmt(svCur.saved)}${svCur.target ? ` of $${svFmt(svCur.target)}` : ""} so far.)` : "";
    const coldCtx = hadCold && coldEv !== "end" ? " You have a little cold right now: a red, stuffy nose and a stripy scarf, and you sneeze now and then (write \"Achoo!\" once in a while). You're still sweet and cheerful, just a bit sniffly; warm soup, tea, honey or a nap would help." : "";
    const cueNote0 = scamAns ? answerNote(scamLive, scamAns, { spotted: scamsNow.spotted }) : callPick ? choiceNote(callLive, callPick) : scamGame ? GAME_NOTE : dress ? dressNote(dress) : hint ? hintNote(hint) : piggyNote ? piggyNote : stanceNote && !hug && !teach && !handshake && !pose ? stanceNote : hugNote ? hugNote : teachNote ? teachNote : hsNote ? hsNote : water ? `\n${waterFightNote(water.fight)}` : toss ? `\n${throwNote(tossPlan.plan, toss.thing, { asked: toss.asked })}` : ride && ride.drive ? `\nOn screen just now: you got into your ${ride.name}${ride.passenger ? `, ${ride.passenger === "mimi" ? "Mimi" : "Cocoa"} hopped into the back seat` : ""} and you're driving it across the stage and back${ride.passenger ? ` with ${ride.passenger === "mimi" ? "her" : "him"}` : ""}. Say something fun about it, short.` : ride && ride.kind === "fly" ? `\nOn screen just now: you climbed into your ${ride.name} and you're flying it: up off the stage, across and back, and down again (its ${/rocket|space/.test(ride.name.toLowerCase()) ? "engine roaring" : "propeller whirring"}). Say something fun about it, short.` : ride && ride.kind === "sail" ? `\nOn screen just now: you climbed into your ${ride.name} and you're sailing it across the stage and back, bobbing on the water. Say something fun about it, short.` : ride ? `\nOn screen just now: you put on your helmet (safety first!), hopped on your ${ride.name} and you're riding it across the stage and back. Say something fun about it, short.` : cue ? `\n${cue.note}` : "";
    const extra0 = state.careUntil > Date.now() ? "They said something worrying earlier in this session. Stay gentle, keep checking in, no silliness unless they start it." : f.decision === "gentle" ? "They're being hard on themselves. Be kind and specific, don't argue, don't cheerlead." : "";
    try {
      const held = holding && typeof holding === "object" && typeof holding.name === "string" ? { name: holding.name.slice(0, 60), slot: String(holding.slot || "hand"), wearing: Array.isArray(holding.wearing) ? holding.wearing.slice(0, 3).map((x) => String(x).slice(0, 60)) : [] } : null;
      const cueNote = coldNote + savingsNote + dismissNote + (savings || dismiss ? "" : actWant ? (makeUp ? `\nIn a moment, on screen: you'll make up "${makeUp.ask}" on the spot, with your own props and moves (you really will; it starts right after you answer). Say you'll give it a go, short and excited.` : actWant.kind === "book" ? routineNote(activityPreview(actWant)) : activityNote(activityPreview(actWant))) : cueNote0);
      const pNews = calmNow ? memory.get("practice.news", null) : null;   // (he practised while they were away: told once)
      if (pNews && pNews.length) memory.set("practice.news", null);
      const extra = (extra0 + coldCtx + savingsCtx + (moneyDl ? MONEY_SKILL_NOTE : "") + cueNote + (earned ? earnNote(earned, earnWhy.what) : mNow.started ? ` (Their wallet in your little money world: ${moneyFmt(mNow.wallet)} of play money${mNow.loan ? `; ${mNow.loan.who === "mimi" ? "Mimi" : "Cocoa"} owes them ${moneyFmt(mNow.loan.back)}` : ""}. Only mention money if it comes up.)` : "") + revealNote + practiceNote(pNews) + (f.crisis ? "" : pauseNote(text)) + (pa ? `\n${propActNote(pa, { hooves: paHooves })}` : "")).trim();
      const friendsHere = dismiss ? [] : [...new Set([...((cue && cue.friends) || []).map((x) => x.who), ...(hug ? [hug] : []), ...(piggy ? [piggy] : []), ...(share ? share.who : []), ...(hint ? [hint.who] : []), ...(dress ? dress.map((d) => d.who).filter((w) => w !== "mochi") : []), ...(teach ? [teach.who] : []), ...(point && point.at ? [point.at] : []), ...(talkTo ? [talkTo] : []), ...(first.mood === "showoff" ? ["mimi"] : []), ...(party ? party.friends : []), ...(ride && ride.passenger ? [ride.passenger] : [])])];
      const calm = state.careUntil > Date.now() || ["hurt", "comfort", "concern", "gentle"].includes(f.decision);   // no prop backstops then
      // a scene they asked for ("show a skit on scams", "do a skit where Mimi is a doctor", their answer in the scam game):
      // the scene is the answer, so no tools this turn (Nov 7, on the share link: "Show skit on scam" made him call
      // do_activity and make up a 15-step routine, and the scene never came)
      const sceneTurn = !!(storyAsk || scamAns || callPick);
      const r = await brain.reply({ text, note, extraContext: extra, signal: AbortSignal.timeout(CONFIG.llm.timeoutMs), mode: mode === "zeroday" ? "zeroday" : null, holding: held, friendsHere, onStage, talkTo, calm, gone: dismiss || [], noTools: sceneTurn });
      if (dismiss && r.friendSay) r.friendSay = r.friendSay.filter((x) => !dismiss.includes(x.who));   // they've gone: a line from them would bring them back
      if (hint) { r.friendSay = (r.friendSay || []).filter((x) => x.who !== hint.who); r.text = hintClean(r.text, hint); }
      if (scamAns) r.friendSay = (r.friendSay || []).filter((x) => x.who !== scamLive.who);   // (their answer comes on screen, after his)   // asked and answered on screen already (hints.js)
      // his voice tags ({whisper}…{/whisper}, {excited}, {pause}: Nov 6, Kokoro acts them out): heard, never shown or
      // remembered, so what's shown, kept and read for scenery and the like is the line without them
      const tagged = r.text || "";
      r.text = stripTags(tagged);
      if (r.friendSay) r.friendSay = r.friendSay.map((x) => (stripTags(x.text) === x.text ? x : { ...x, say: x.text, text: stripTags(x.text) }));
      state.lastLLM = Date.now() - t0; state.llmError = null;
      // the activity: asked for, or he chose one (do_activity); or he claimed one with nothing behind it (no pretending)
      // (one he makes up takes the model a few seconds more: the reply goes now, the activity follows over the socket)
      const later = makeUp || (!actSpecP && !sceneTurn && r.activityAsk && !calm && r.activityAsk.kind === "improvise" ? r.activityAsk : null);
      let activity = actSpecP ? await actSpecP : r.activityAsk && !calm && !later && !sceneTurn ? await activitySpec(r.activityAsk).catch(() => null) : null;
      if (later) { inFlight++; actBusyUntil = Date.now() + 30000; }   // (his story waits while he plans it, then while he does it)
      if (later) activitySpec(later).then((t) => { if (!t) return; bookAsked(memory, t.id); if (seq !== chatSeq) return console.log(`[book] "${t.name}" is ready, but they've moved on; kept for next time`); actBusyUntil = Date.now() + 1500 + t.ms; broadcast({ type: "activity", activity: t }); }).finally(() => { inFlight = Math.max(0, inFlight - 1); if (actBusyUntil > Date.now() + 29000) actBusyUntil = 0; }).catch((e) => console.warn("[book]", e.message));
      // you drew it: the job this message puts on the workbench gets your drawing (and if nothing went on it, it does now:
      // "I drew you a hat!" is always a request, even when a hat's already in his pocket)
      const drawn = typeof (req.body && req.body.doodle) === "string" ? memory.get("doodles", {})[req.body.doodle] : null;
      if (drawn) {
        let job = (r.queued || []).find((q) => q.kind === "prop" && !q.fix && q.id);
        if (!job && !activity && !f.crisis && state.strikes < 3) {
          const what = (doodleName(String(text).replace(/^\s*i drew you\s+/i, "").replace(/[!.?].*$/, "")) || drawn.name || "").slice(0, 40);
          if (what) { const q = memory.enqueue({ kind: "prop", request: `${what}: the one you drew for me`, priority: 0.8, context: text, source: "doodle" }); job = { kind: "prop", ...q, name: what }; r.queued = [...(r.queued || []), job]; console.log(`[doodle] on the workbench: ${what}`); }
        }
        if (job) { const links = memory.get("doodle.jobs", {}); links[job.id] = req.body.doodle; const ks = Object.keys(links); for (const k of ks.slice(0, Math.max(0, ks.length - 40))) delete links[k]; memory.set("doodle.jobs", links); }
      }
      const did = !!activity || !!later || !!ride || !!party || !!toss || !!water || !!teach || !!pose || !!hug || !!piggy || !!share || !!hint || !!dress || !!point || !!cue || r.toolCalls.length > 0 || (r.queued || []).length > 0 || (r.actions || []).some((a) => a.kind !== "mood");
      const hon = calm ? null : honesty({ text: r.text, userText: text, prev: hisLast, did, pending: memory.queue().some((q) => q.status === "queued" || q.status === "working") });
      if (hon && hon.activity) { activity = await activitySpec(hon.activity).catch(() => null); if (activity) console.log(`[activity] he said he would; doing it: ${activity.kind}`); }
      else if (hon && hon.queue) {   // he said it's on the workbench but never put it there: put it there
        const q = memory.enqueue({ kind: "prop", request: `${hon.queue}: ${hon.queue}`, priority: 0.6, context: text });
        r.queued = [...(r.queued || []), { kind: "prop", ...q, name: hon.queue }];
        memory.scrap(`you asked for ${hon.queue}; it's on my workbench`, "queue", q.id);
        console.log(`[honest] he said it's on the workbench; now it is: ${hon.queue}`);
      } else if (hon && hon.text) { console.log(`[honest] "${r.text.slice(0, 80)}" → "${hon.text.slice(0, 80)}"`); r.text = hon.text; }
      // an activity is on screen: it moves his body, so the reply's own extra faces, props and moves wait (a face mid-strum
      // would stop the strum; a prop shown would take the guitar out of his hooves)
      if (activity || later) r.actions = (r.actions || []).filter((a) => a.kind === "mood").slice(0, 1).map(({ prop, ...a }) => a);
      if (activity && activity.kind === "routine") bookAsked(memory, activity.id);
      if (toss) r.actions = r.actions.filter((a) => a.kind !== "throw" && !(a.kind === "prop" && a.archetype === "throwable"));   // it's already flying
      if (water) r.actions = r.actions.filter((a) => a.kind !== "throw" && !(a.kind === "prop" && (a.archetype === "launcher" || a.archetype === "throwable")));   // the fight has its own guns
      if (ride) r.actions = r.actions.filter((a) => !(a.kind === "prop" && a.archetype === "ride"));                             // already riding
      if (teach) r.actions = r.actions.filter((a) => a.kind !== "teach");                                                           // already teaching
      if (pose) {   // they're about to show him: no move of his own, nothing for the workbench
        r.actions = r.actions.filter((a) => a.kind !== "move");
        for (const qd of (r.queued || []).filter((qd) => qd.kind === "move" && qd.id && !qd.duplicate)) memory.cancelJob(qd.id);
        r.queued = (r.queued || []).filter((qd) => qd.kind !== "move");
      }
      if (share) r.actions = r.actions.filter((a) => a.kind !== "prop" && a.kind !== "throw");                                     // it's already in his hoof, going to them
      if (pa) r.actions = r.actions.filter((a) => a.kind !== "prop" && a.kind !== "throw" && a.kind !== "activity");                // the tool's in his hoof, the thing beside him (Nov 7)
      if (hug || piggy) r.actions = r.actions.filter((a) => a.kind !== "hug");
      if (hint) r.actions = r.actions.filter((a) => a.kind !== "hug" && a.kind !== "prop" && a.kind !== "throw");   // asked and answered on screen already
      if (dress) r.actions = r.actions.filter((a) => a.kind !== "prop" && a.kind !== "throw");   // dressed up already (dress.js)                                                      // already hugging (or carrying her)
      if (stance) r.actions = r.actions.filter((a) => a.kind !== "stance");
      if (party) r.actions = r.actions.filter((a) => a.kind !== "move");                                                           // already dancing
      if (point) r.actions = r.actions.filter((a) => !(a.kind === "prop" && (a.use === "fire" || a.archetype === "throwable" || a.archetype === "launcher")) && a.kind !== "throw");   // the tap decides where                                                         // already up (or down, or off)
      // his own words: "Achoo!" → a sneeze on screen; "I think I'm catching a cold…" → the story gave him one
      const rc = coldInReply(r.text);
      let coldAfter = null;
      if (rc.start && !hadCold && !coldEv && !calm) { setCold(true); coldAfter = { on: true, until: state.cold.until }; }
      const sneezeAfter = rc.sneeze && !coldAfter && !sneeze && coldEv !== "start" && !calm;
      // what his words put on the stage: "tracks leading toward the bushes" brings the tracks and the bushes (Nov 5)
      if (activity || later) sceneryNow().begin();
      const sceneItems = calm || f.crisis ? [] : sceneryNow().fromLine(r.text, { playing: !!(activity || later) });
      if (sceneItems.length) console.log(`[scenery] ${sceneItems.map((x) => x.name).join(", ")}`);
      const said = [r.text, ...(r.friendSay || []).filter((x) => x.text).map((x) => `${x.who === "mimi" ? "Mimi" : "Cocoa"}: "${x.text}"`)].filter(Boolean).join("\n");
      memory.turn("assistant", said, { actions: r.actions, tools: r.toolCalls });
      if (r.fixed && r.fixed.id && !r.fixed.queued) work.rethumb.add(r.fixed.id);   // made smaller or bigger: a new shelf picture
      if (r.remembered && r.remembered.length) giftSweep();   // "I have an interview tomorrow": maybe a surprise
      for (const q of r.queued) memory.scrap(`you asked for ${q.name}; it's on my workbench`, "queue", q.id);
      // if he's following up on a dated fact, mark it done once mentioned
      for (const fu of memory.followUps()) { const key = fu.text.toLowerCase().split(/\s+/).filter((w) => w.length > 4)[0]; if (key && r.text.toLowerCase().includes(key)) memory.markFollowedUp(fu.id); }
      state.lastLLMStats = r.llm;
      if (r.story || story.dirty()) pushStory();   // a plan changed in this talk: the page's story card follows
      // his story moves on every 1–3 conversations, once this reply has played (Binoy, Nov 3: "not every few minutes
      // but with every 1–3 conversations"); not while they're upset or he's worried about them
      // a little scene from what was just said (Nov 4: "mimi shows up with some food… have the characters play out
      // that story"): sometimes, written fresh, after his reply has played
      const busyOther = !!(activity || later || ride || party || toss || water || teach || pose || hug || piggy || share || hint || dress || point || cue || dismiss || handshake);
      const mom = scamAns ? { need: "scam_after", text: "", who: scamLive.who, chance: 1, quiz: scamLive, grade: scamAns, spotted: scamsNow.spotted }
        : callPick ? { need: "scam_choice", text: "", who: "mimi", chance: 1, choice: callLive, pick: callPick }
        : calm || talkTo || f.crisis || state.strikes >= 3 || state.careUntil > Date.now() || busyOther ? null : skitMoment(text, r.text, { ...f, ...lastScene });
      // which game this time: a message to spot ("what looks fishy?") or Cocoa's scam call ("what should Mimi do?"), in turn
      if (mom && mom.need === "scam") {
        // a new one Gemini wrote just now, if one's ready (scamlive.js, Nov 8); else a hand-written one
        const freshOne = (kind) => { const x = scamReady(kind).find((y) => kind === "call" || !mom.who || y.who === mom.who) || null; if (x) { const L = scamLib(); memory.set("scams.fresh", { ...L, played: [...L.played, x.id].slice(-40) }); setTimeout(() => writeOneScam(kind).catch(() => {}), 2000); } return x; };
        if (scamsNow.lastMode === "text") { const fc = freshOne("call"); Object.assign(mom, { callId: fc ? fc.id : pickCall(scamsNow.recentCalls || []), who: "mimi" }); }
        else { const fs = freshOne("scene"); Object.assign(mom, fs ? { scene: fs.id, who: fs.who } : (({ id, who }) => ({ scene: id, who }))(pickScene(scamsNow.recent || [], mom.who)), { learned: memory.get("mimi.learned", null) || {} }); }
      }
      const S0 = state.skit || (state.skit = { at: 0, needs: {}, recent: [] });
      const skitting = !!(mom && (["story", "jobs", "scam", "scam_after"].includes(mom.need) || (Date.now() - S0.at > 4 * 60000 && Date.now() - (S0.needs[mom.need] || 0) > 30 * 60000)) && (opts.skitRandom || Math.random)() < mom.chance);
      if (skitting) {
        S0.at = Date.now(); S0.needs[mom.need] = Date.now(); S0.lastNeed = mom.need;
        const readMs = Math.min(9000, 1200 + 45 * String(r.text || "").length) + 1200, startedAt = Date.now();
        actBusyUntil = Math.max(actBusyUntil, Date.now() + 30000);   // (his own story waits for it)
        // who's coming is settled now, so while the scene's being written (~15 s on the M5) they can peek in from the
        // edge, having heard ("Not eaten yet? Hmm… ♡"), and duck off to fetch something
        const lead = skitLead(mom), away = !(onStage || []).includes(lead.who);
        const moment = lead.both ? mom : { ...mom, who: lead.who, peeked: away };
        if (away) setTimeout(() => { if (seq === chatSeq) broadcast({ type: "skitSoon", who: lead.who, line: skitPeekLine(mom.need, lead.who), need: mom.need }); }, Math.min(3500, Math.round(readMs * 0.45)));
        writeSkit({ llm: story.llm || null, moment, userText: text, reply: r.text, recent: S0.recent, recentShapes: S0.shapes || [], recentLines: S0.lines || [], facts: memory.facts(8).map((x) => x.text), memory }).then((sk0) => {
          // the first scam scene: he downloads the scam-spotting pack before it starts (he knew nothing on day zero)
          const sk = mom.need === "scam" && sk0.shape === "scam" && (sk0.quiz || sk0.choice) && !hasSkill(SKILL_PACK.id) && learnSkill(SKILL_PACK.id, SKILL_PACK.name) ? { ...sk0, beats: [...downloadBeats(), ...sk0.beats] } : sk0;
          const fire = () => {
            if (seq !== chatSeq) { actBusyUntil = 0; return console.log(`[skit] "${sk.title}": they've moved on, dropped`); }
            const ms = skitMs(sk); actBusyUntil = Date.now() + ms + 1500;
            broadcast({ type: "skit", title: sk.title, beats: sk.beats, things: skitThings(sk), need: mom.need, waits: sk.quiz ? "quiz" : sk.choice ? "choice" : null });
            const sum = skitSummary(sk); S0.recent = [...S0.recent.slice(-5), sum];   // (what happened in it, not just its name: the next one is steered away from it, variety.js)
            if (sk.shape) S0.shapes = [...(S0.shapes || []).slice(-5), sk.shape];
            S0.lines = [...(S0.lines || []), ...sk.beats.filter((x) => x.line).slice(0, 3).map((x) => x.line)].slice(-9);   // (so the next one says it differently)
            memory.set("lastSkit", { at: new Date().toISOString(), text: sum });
            if (sk.quiz) {   // the scam-spotting game: his question waits for their answer (the next message)
              memory.set("scam.quiz", { ...sk.quiz, at: Date.now() });
              const sc = memory.get("scams", null) || { played: 0, spotted: 0, recent: [] };
              memory.set("scams", { ...sc, played: sc.played + 1, lastMode: "text", recent: [...(sc.recent || []), sk.quiz.id].slice(-5) });
            }
            if (sk.choice) {   // the scam-call game: "what should Mimi do?" waits for their pick
              memory.set("scam.choice", { ...sk.choice, at: Date.now() });
              const sc = memory.get("scams", null) || { played: 0, spotted: 0, recent: [] };
              memory.set("scams", { ...sc, played: sc.played + 1, lastMode: "call", recentCalls: [...(sc.recentCalls || []), sk.choice.id].slice(-3) });
            }
            try { memory.scrap(sum, "story"); } catch (_) { /* fine */ }
            console.log(`[skit] ${mom.need}: ${sum}`);
          };
          setTimeout(fire, Math.max(300, readMs - (Date.now() - startedAt)));
        }).catch((e) => { actBusyUntil = 0; console.warn("[skit]", e.message); });
      }
      // they asked him to do something ("bring out your rocket launcher"): this turn is theirs, his own story waits for a
      // turn of plain talk (Nov 4, the shared Mochi: a "making it up to Mimi" scene played over the launcher he'd been asked for)
      const asked = /^\s*(?:hey\s+)?(?:mochi[,!]?\s+)?(?:can you |could you |will you |would you |please |pls |go |now )?(bring|show|get|take|make|draw|do|play|fire|shoot|throw|ride|drive|fly|wear|put|give|dance|sing|eat|drink|use|pick|hug|call|let'?s)\b/i.test(String(text)) || (r.actions || []).some((a) => a.kind !== "mood");
      // Money World: a loan that's due is paid back after this reply (Cocoa runs in with the extra dollar)
      const repaid = !calm && !skitting && !busyOther && state.strikes < 3 ? repayLater(seq, Math.min(9000, 1200 + 45 * String(r.text || "").length) + 1200) : false;
      if (!calm && !talkTo && state.strikes < 3 && !skitting && !repaid) afterTurn({ asked, busyMs: 2200 * (r.actions || []).length + (party ? 16000 : 0) + (activity ? (activity.kind === "paint" ? 16000 : activity.kind === "juggle" ? 8000 : activity.kind === "routine" ? activity.ms : 5000) : later ? 14000 : 0) + Math.min(9000, 45 * String(r.text || "").length) + 1600 * (r.friendSay || []).length });
      console.log(`[brain] ${Date.now() - t0} ms  calls=${r.llm.calls} (${r.llm.ms.join("+")} ms)  tokens=${r.llm.tokens}  reasoning=${r.llm.reasoningChars} chars  finish=${r.llm.finish}${r.llm.retried ? "  RETRIED" : ""}  tools=${r.toolCalls.map((t) => t.name).join(",") || "-"}${r.backstop ? `  backstop=${r.backstop}` : ""}${r.leaked ? `  leaked=${r.leaked.join(",")}` : ""}`);
      if (activity) { story.onEvent({ kind: "activity", what: activity.kind }); memory.scrap(activity.kind === "routine" ? `${activity.ing.replace(/\byour\b/g, "my")} for you` : activity.kind === "paint" ? `you asked me to paint ${activity.subject}` : activity.kind === "juggle" ? `I juggled ${activity.balls} balls for you` : `I did a party trick for you: ${activity.trick}`, "activity"); }
      res.json({ ...first, reply: { download: moneyDl || undefined, activity, scenery: sceneItems.length ? sceneItems : undefined, text: r.text, say: tagged !== r.text && stripTags(tagged) === r.text ? tagged : undefined, actions: r.actions, tools: r.toolCalls, queued: r.queued, remembered: r.remembered, learned: r.learned, llm: r.llm, friendSay: r.friendSay || [], cold: coldAfter, sneeze: sneezeAfter }, ms: Date.now() - t0 });
    } catch (e) {
      state.llmError = e.message;
      console.error("[chat]", e.message, e.raw ? `raw: ${JSON.stringify(e.raw)}` : "");
      const activity = actSpecP ? await actSpecP : makeUp ? await activitySpec(makeUp).catch(() => null) : null;   // what they asked him to do still happens, words or no words
      if (/^empty reply/.test(e.message)) {
        // The model answered with nothing usable twice (M5, Nov 2: after a remember call on "I had a car crash into
        // my house today"). Never show an error to the person: say a short line that fits the face he already made.
        // Whatever the tools already did (remembered, queued) stands.
        // (M5, Nov 3: "what about a grenade?" sent Gemma thinking until it ran out of room; that's the safety beat)
        const line = WEAPON_WORD.test(text0(text)) ? "Ooh, I only make the friendly kind! Want me to make a confetti one instead?"
          : (Object.hasOwn(FALLBACK, f.mood) && typeof FALLBACK[f.mood] === "string" && FALLBACK[f.mood]) || FALLBACK.default;
        const fx = e.effects || {};
        memory.turn("assistant", line, { fallback: true, tools: fx.toolCalls });
        return res.json({ ...first, reply: { download: moneyDl || undefined, activity, text: activity ? ACT_LINE[activity.kind] || line : line, actions: fx.actions || [], fallback: true, llm: e.llm, queued: fx.queued || [], remembered: fx.remembered || [] } });   // what the tools did stands (the ruler still comes out)
      }
      if (activity) return res.json({ ...first, reply: { download: moneyDl || undefined, activity, text: ACT_LINE[activity.kind] || "Watch this!", actions: [], fallback: true, llm: e.llm } });
      res.json({ ...first, reply: { download: moneyDl || undefined, text: "", error: e.message, llm: e.llm, actions: [{ kind: "mood", name: "oops" }] } });
    }
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 64 * 1024, ...(gate ? { verifyClient: (info) => { try { return gate.wsAllowed(info.req); } catch (_) { return false; } } } : {}) });
  wss.on("connection", (ws) => {
    let taughtAt = 0;
    pages.add(ws);
    ws.send(JSON.stringify({ type: "hello", care: state.careUntil > Date.now(), sulking: state.strikes >= 3, cold: coldOn() ? state.cold.until : 0 }));
    ws.on("message", (raw) => { try { onSocket(raw); } catch (e) { console.warn("[ws] bad message:", e.message); } });
    function onSocket(raw) {
      let m; try { m = JSON.parse(raw); } catch (_) { return; }
      if (!m || typeof m !== "object") return;
      if (m.type === "typing") lastTyping = Date.now();
      if (m.type === "pat" && m.moveId) memory.practised(+m.moveId, 0.15);
      if (m.type === "taught" && (m.who === "mimi" || m.who === "cocoa") && typeof m.move === "string" && m.move && Date.now() - taughtAt > 3000) {   // he taught a friend a move
        taughtAt = Date.now();   // (one every few seconds per page, at most 30 each: a script can't flood the scrapbook)
        const fm = memory.get("friendMoves", {}), list = new Set(fm[m.who] || []), name = String(m.move).replace(/[<>]/g, "").slice(0, 40);
        story.onEvent({ kind: "taught", who: m.who });
        if (name && !list.has(name) && list.size < 30) { list.add(name); memory.set("friendMoves", { ...fm, [m.who]: [...list] }); memory.scrap(`I taught ${m.who === "mimi" ? "Mimi" : "Cocoa"} my ${name}`, "moves"); }
      }
      if (m.type === "handshake" && m.done) { const h = memory.get("handshake", null); if (h && h.steps) memory.set("handshake", { ...h, times: (h.times || 0) + 1, last_done: new Date().toISOString() }); }
    }
    ws.on("close", () => pages.delete(ws));
  });

  // His own story (Nov 3): the page's card, and a beat of it in a longer quiet moment
  let storyPush = null;
  function pushStory() {
    clearTimeout(storyPush);
    storyPush = setTimeout(async () => { try { await story.chapter(); broadcast({ type: "story", ...story.state() }); } catch (e) { console.warn("[story]", e.message); } }, 400);
  }
  app.get("/api/story", async (_, res) => { try { await story.chapter(); } catch (_) { /* the fallback chapter then */ } res.json(story.state()); });
  app.post("/api/story/pause", (req, res) => { story.pause(Math.min(3600000, Math.max(60000, +((req.body || {}).ms) || 900000))); res.json({ ok: true }); });   // "not now"
  app.post("/api/story/event", (req, res) => { const b = req.body || {}; if (typeof b.kind === "string") story.onEvent({ kind: b.kind.slice(0, 20), moveId: +b.moveId || undefined, propId: +b.propId || undefined, who: b.who === "cocoa" ? "cocoa" : b.who === "mimi" ? "mimi" : undefined }); if (story.dirty()) pushStory(); res.json({ ok: true }); });
  // a beat of his story after every 1–3 replies (MOCHI_STORY_EVERY, "1-3"), a few seconds after the reply has played,
  // unless they've started typing again (then it comes after the next reply)
  const [paceLo, paceHi] = String(CONFIG.storyEvery || "1-3").split("-").map((x) => Math.max(1, +x || 1));
  const paceNeed = () => paceLo + Math.floor(Math.random() * (Math.max(paceLo, paceHi || paceLo) - paceLo + 1));
  const storyPace = { turns: 0, need: paceNeed(), timer: null, busy: false };
  function afterTurn({ busyMs = 0, asked = false } = {}) {
    if (asked) { clearTimeout(storyPace.timer); storyPace.timer = null; return; }   // (their turn: not counted, and nothing of his own on top of it)
    storyPace.turns++;
    if (storyPace.turns < storyPace.need) return;
    const at = Date.now(), delay = Math.max(4500, Math.min(26000, busyMs + 3500));
    clearTimeout(storyPace.timer);
    const fire = async () => {
      storyPace.timer = null;
      const wait = actBusyUntil - Date.now();   // he's still planning or doing something he made up: after it
      if (wait > 0 && wait < 45000) { storyPace.timer = setTimeout(fire, wait + 1500); return; }
      if (storyPace.busy || lastTyping > at || lastMessage > at + 500 || inFlight > 0 || !pages.size || state.careUntil > Date.now() || state.strikes >= 3) return;   // they're talking: after the next reply
      if (memory.unrevealedAll().some(revealable)) return;   // a reveal first
      storyPace.busy = true;
      let beat = null;
      try { beat = await story.pickBeat({ cold: coldOn() }); } catch (e) { console.warn("[story] beat:", e.message); } finally { storyPace.busy = false; }
      if (lastTyping > at || inFlight > 0) return;   // they started talking while the scenes were being written: keep it for later
      storyPace.turns = 0; storyPace.need = paceNeed();
      if (!beat) return;
      console.log(`[story] on his own: ${beat.log}`);
      broadcast(beat); pushStory();
    };
    storyPace.timer = setTimeout(fire, delay);
  }

  // Reveal loop: finished workbench jobs wait for a quiet moment (nobody typing, no message for a while)
  const revealTimer = setInterval(() => {
    const quiet = Date.now() - Math.max(lastTyping, lastMessage) > CONFIG.quietMs;
    if (!quiet || !pages.size || inFlight > 0) return;
    const job = memory.unrevealedAll().find(revealable);
    if (!job) return;
    memory.setJob(job.id, { revealed: 1 });
    const gift = job.source === "mochi" && /^gift:\d+$/.test(job.context || "") ? giftReveal(job) : null;
    if (job.status === "done" && job.kind === "prop" && job.result_id) {
      const p = memory.props().find((x) => x.id === job.result_id);
      let unsure = false, learned = false, pipSaw = null; try { const L = JSON.parse(job.log || "{}"); unsure = !!L.unsure; learned = !!L.learned; pipSaw = L.guess || null; } catch (_) { /* old job */ }
      const what = job.request.split(":")[0], fix = /^fix:\d+$/.test(job.context || "");
      const text = fix ? `I fixed the ${p ? p.name : what}! Is it better now?` : gift ? `${gift} Ta-da!` : job.source === "mochi" ? `I made you something ${job.reason || ""}. Ta-da!` : unsure ? unsureLine(p ? p.name : what, pipSaw) : (Date.now() - Date.parse(String(job.created_at).replace(" ", "T") + "Z") < 4 * 60000 ? `Here's your ${what}! Ta-da!` : `Remember when you asked for ${what}? Ta-da!`) + (learned ? ` I got it right first time, so now I know how to make them!` : "");   // ("remember when" 20 s later sounded odd)
      broadcast({ type: "reveal", kind: "prop", prop: p, unsure, fixed: fix, gift: !!(gift || job.source === "mochi"), text });
      // part of the talk now: "it's too big" next is about this one (M5, Nov 2: he asked "too big for what?")
      if (p) { memory.turn("assistant", text, { reveal: p.id }); memory.set("lastReveal", { id: p.id, at: Date.now(), ...(unsure && !fix ? { unsure: true, guess: pipSaw } : {}) }); }
    } else if (job.status === "done" && job.kind === "move" && job.result_id) {
      const mv = memory.moves().find((x) => x.id === job.result_id);
      broadcast({ type: "reveal", kind: "move", move: mv, text: `I've been practising. Watch this!` });
    } else broadcast({ type: "reveal", kind: "failed", text: /^fix:\d+$/.test(job.context || "") ? `I tried to fix my ${job.request.split(":")[0]} but it kept coming out wonky… I'll try again later.` : `I tried to make ${job.request.split(":")[0]} but it kept coming out like a mushroom… I'll try again later.` });
  }, 2000);

  // a gift he made on his own waits a little (or until its day), so it's a surprise and not an answer
  const finishedAt = (job) => Date.parse(String(job.finished_at || "").replace(" ", "T") + "Z") || 0;
  function revealable(job) {
    if (!(job.source === "mochi" && /^gift:\d+$/.test(job.context || "") && job.status === "done")) return true;
    if (state.careUntil > Date.now()) return false;
    const fact = memory.factById(+job.context.slice(5));
    const due = fact && fact.when_date && fact.when_date <= memory.today();
    return due || Date.now() - finishedAt(job) >= CONFIG.giftDelayMs;
  }
  function giftReveal(job) {
    const fact = memory.factById(+job.context.slice(5));
    if (!fact || fact.forgotten) return null;
    const g = giftFor(fact);
    return g ? giftLine(g, whenWords(fact.when_date, memory.today())) : null;
  }
  // something coming up that matters to them: he may make a gift for it on his own (at most one a day)
  function giftSweep() {
    try {
      for (const g of sweepGifts(memory, { care: state.careUntil > Date.now(), today: memory.today() })) console.log(`[gifts] making ${g.gift} for ${g.event} (fact ${g.fact.id}: "${g.fact.text}")`);
    } catch (e) { console.error("[gifts]", e.message); }
  }
  const giftTimer = setInterval(giftSweep, 60000);

  // ---- the workbench (day 3): one job at a time, in the background
  // the crafter writes props and moves with cloud models when there are keys (data/keys.json), local Gemma otherwise
  const localLLM = opts.craftLLM || makeLLM({ fetchImpl: opts.fetchImpl, log: console });
  story.llm = localLLM;
  // The cloud boost (Nov 7, the MLH Gemini track): models on this computer (Gemma, and any LM Studio model in keys.json)
  // always; the cloud ones (Gemini, Claude, GPT) only while a grown-up has switched the boost on, on the workshop page.
  // Off until then, so nothing leaves the house by surprise; the badge says which cloud models are on and what for.
  const boostOn = () => { const b = memory.get("cloud.boost", null); return b === null ? (opts.cloudBoost ?? CONFIG.cloudBoost) : !!b; };
  const craftLLM = opts.cloud === false ? localLLM : makeRouter({ local: localLLM, keysFile: opts.keysFile !== undefined ? opts.keysFile : CONFIG.keysFile, env: opts.env || process.env, fetchImpl: opts.cloudFetch || opts.fetchImpl || fetch, log: console,
    gate: (p) => p.local || p.always || boostOn() });   // ("always": true in keys.json: a cloud model the owner wants on without the switch)
  // The doodle pad (Nov 3; the pitch's "a judge doodles an umbrella"): the drawing goes to the vision model, which only
  // names it. The page then asks him for it in words, so the usual brain, workbench and reveal take it from there; the
  // drawing itself goes with that message (its id), and the workbench gets it as a reference (Nov 4).
  const CRAYONS = new Set(["#1d1a22", "#e5484d", "#ff9f43", "#ffd34d", "#4fbf68", "#3d8bff", "#8f6bd6", "#ff8fb8", "#8f5b36"]);
  function keepDoodle(png, colours, name) {
    const id = `d${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`, file = `doodle-${id}.png`;
    try { fs.writeFileSync(path.join(inboxDir, file), Buffer.from(png.split(",")[1], "base64")); } catch (_) { return null; }
    const cs = (Array.isArray(colours) ? colours : []).filter((c) => c && CRAYONS.has(String(c.hex).toLowerCase()) && +c.ink > 0).sort((a, b) => b.ink - a.ink);
    const all = memory.get("doodles", {}), keys = Object.keys(all);
    for (const k of keys.slice(0, Math.max(0, keys.length - 19))) { fs.rm(path.join(inboxDir, all[k].file), { force: true }, () => {}); delete all[k]; }
    const total = cs.reduce((n, c) => n + +c.ink, 0) || 1;
    all[id] = { file, name: name || null, colours: cs.map((c) => String(c.hex).toLowerCase()), share: cs.map((c) => Math.round((100 * c.ink) / total)), at: new Date().toISOString() };
    memory.set("doodles", all);
    return id;
  }
  /** a kept drawing, ready for the workbench: { png (data URL), colours (most used first), name } */
  function doodleRef(id) {
    const all = memory.get("doodles", {}), d = typeof id === "string" && Object.prototype.hasOwnProperty.call(all, id) ? all[id] : null;
    if (!d) return null;
    try { return { png: `data:image/png;base64,${fs.readFileSync(path.join(inboxDir, d.file)).toString("base64")}`, colours: d.colours || [], share: d.share || [], name: d.name }; } catch (_) { return null; }
  }
  app.post("/api/doodle", async (req, res) => {
    const png = String((req.body && req.body.png) || "");
    if (!/^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]{100,3000000}$/.test(png)) return res.status(400).json({ error: "send the drawing as a PNG data URL" });
    try {
      const r = await localLLM.chat({ what: "doodle", maxTokens: 24, temperature: 0.1, images: [png],
        system: "You name quick doodles. Answer with the object's name only.",
        user: "Someone drew this quick doodle for a cute little sheep: one object he could hold, wear or keep beside him. What object is it? Answer with just its name, 1 to 3 words, lowercase, no punctuation (for example: umbrella, paper crown, kite, ice cream cone). If you really can't tell, answer: unsure" });
      const name = doodleName(r.text);
      // the drawing is kept either way, with its crayons (most used first), so the workbench can follow it (Nov 4: it
      // only ever saw the name: a purple hat with a yellow star came out the plain hat)
      const id = keepDoodle(png, req.body && req.body.colours, name);
      if (!name || /\b(?:unsure|unclear|unknown|scribble|doodle|drawing|nothing)\b/.test(name)) return res.json({ ok: false, unsure: true, id });
      console.log(`[doodle] "${name}" (${r.ms} ms)${id ? `, ${(memory.get("doodles", {})[id] || {}).colours?.join(" ") || "black"}` : ""}`);
      res.json({ ok: true, name, id });
    } catch (e) { console.warn("[doodle]", e.message); res.status(502).json({ error: e.message, vision: localLLM.vision }); }
  });
  let renderer = opts.renderer !== undefined ? opts.renderer : null;   // made after listen: it loads our own /render page
  let crafter = null, practice = null;
  const work = { busy: false, current: null, last: null, bench: null, pauseUntil: 0, rethumb: new Set(), gen: 0 };
  // Nov 4: vehicles made before there were vehicle patterns and filed as something else (the rocket ship, made as his
  // confetti bazooka, then "fixed" into a pole with its nose cone floating beside it): made again from the pattern,
  // once, as something he rides, with a new shelf picture
  // something to wear made so small it sits inside him, out of sight (Nov 5: the gold ring): held up instead
  if (!memory.get("repair.hidden.v3", false)) {
    for (const p of memory.props()) if (p.recipe && hiddenInBody({ ...p.recipe, archetype: p.archetype })) {
      memory.setPropRecipe(p.id, asHeld({ ...p.recipe, archetype: p.archetype })); work.rethumb.add(p.id);
      console.log(`[repair] ${p.name}: worn it was hidden inside him; now he holds it up`);
    }
    memory.set("repair.hidden.v3", true);
  }
  if (!memory.get("repair.vehicles.v1", false)) {
    for (const p of memory.props()) {
      if (p.archetype === "ride" || !VEHICLE.test(p.name) || BIG_LAUNCHER.test(p.name) || /\b(toy|model|tiny|mini|paper|jet ?pack)\b/i.test(p.name)) continue;
      const r = patternRecipe("ride", p.name, (p.recipe && p.recipe.request) || p.name, { only: (e) => VEHICLES.ride.includes(e) });   // (an old toy car has its own way back: rides.test)
      if (!r) continue;
      memory.setPropRecipe(p.id, r); work.rethumb.add(p.id);
      try { memory.scrap(`I made my ${p.name} again properly: something I can ride, not a launcher`, "props", p.id); } catch (_) { /* fine */ }
      console.log(`[workbench] ${p.name} (prop ${p.id}) was made as a ${p.archetype}: made again from the ${r.name} pattern as a ride`);
    }
    memory.set("repair.vehicles.v1", true);
  }
  // A car he made when cars still sat beside him like toys (M5, Nov 3: "mochi was not able to get in the car it built
  // and drive around in it"; "the car didn't look realistic enough, looked like blocks"): it becomes the new car he can
  // drive, in its own main colour, with its name and its story kept.
  const CAR_WORD = /\b(cars?|trucks?|jeeps?|karts?|convertibles?|race ?cars?|buggy|automobiles?)\b/i;
  function upgradeCar(prop) {
    if (!prop || prop.archetype !== "companion") return null;
    const pat = POCKET.find((e) => e.name === "car"); if (!pat) return null;
    const vol = {}; for (const q of (prop.recipe && prop.recipe.parts) || []) if (q.material !== "glass" && q.material !== "glow" && q.material !== "rubber" && q.material !== "metal") vol[q.color] = (vol[q.color] || 0) + (q.size || [0, 0, 0]).reduce((a, b) => a * b, 1);
    const main = normColor((Object.entries(vol).sort((a, b) => b[1] - a[1])[0] || [])[0] || "#e5484d") || "#e5484d";
    const light = (hex) => "#" + [1, 3, 5].map((i) => Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * 0.85 + 255 * 0.15)).toString(16).padStart(2, "0")).join("");
    const recipe = { ...pat, name: prop.name, parts: pat.parts.map((q) => (q.color === "#e5484d" ? { ...q, color: main } : q.color === "#ef5b60" ? { ...q, color: light(main) } : q)) };
    const v = validateProp(recipe); if (!v.ok) return null;
    memory.db.prepare("UPDATE props SET archetype = 'ride', recipe = ? WHERE id = ?").run(JSON.stringify(v.recipe), prop.id);
    work.rethumb.add(prop.id);
    memory.scrap(`I rebuilt my ${prop.name} so I can sit in it and drive it`, "props", prop.id);
    console.log(`[props] ${prop.name} (#${prop.id}) is a car he can drive now`);
    return { ...prop, archetype: "ride", recipe: v.recipe };
  }
  for (const p of memory.props()) if (p.archetype === "companion" && CAR_WORD.test(p.name) && !/\b(toy|model|tiny|mini)\b/i.test(p.name)) upgradeCar(p);
  // prop names from before short names (Nov 3) were cut at 40 characters mid-word ("bright neon blue and orange water
  // blaste"); the request said what it was ("water blaster"): use that, and mend moves named after the cut word
  for (const p of memory.props()) {
    if (String(p.name).split(/\s+/).length <= 4) continue;
    const job = memory.queue().find((j) => j.result_id === p.id && j.kind === "prop"), head = job ? String(job.request).split(":")[0].trim() : "";
    if (!head || head.split(/\s+/).length > 4 || head.toLowerCase() === p.name.toLowerCase() || /^(?:fix|hand-drawn)/i.test(head)) continue;
    const cut = p.name.split(/\s+/).pop(), whole = head.split(/\s+/).pop();
    memory.db.prepare("UPDATE props SET name = ?, recipe = ? WHERE id = ?").run(head, JSON.stringify({ ...p.recipe, name: head }), p.id);
    if (cut && whole && cut !== whole && whole.startsWith(cut)) for (const m of memory.moves()) if (new RegExp(`\\b${cut}\\b`, "i").test(m.name)) memory.db.prepare("UPDATE moves SET name = ? WHERE id = ?").run(m.name.replace(new RegExp(`\\b${cut}\\b`, "i"), whole), m.id);
    console.log(`[props] "${p.name}" (#${p.id}) is called "${head}" now`);
  }

  // ---- activities (Nov 3): painting, juggling, party tricks ----
  const ACT_LINE = { paint: "Ooh, let me get my brush!", juggle: "Okay… here goes!", trick: "Ready? Watch closely!", routine: "Ooh, yes! Watch this!" };   // his words when the brain can't answer
  const activityPreview = (a) => a.kind === "book" ? (a.spec = a.spec || routineFor(BOOK_BY_ID[a.id], { ask: a.ask || "", owned: memory.props() })) : a.kind === "paint" ? { ...a, subject: a.subject || "something you picked yourself" } : a.kind === "juggle" ? juggleSpec(memory.get("skills", {})) : pickTrick({ ask: a.ask || "", props: memory.props(), last: memory.get("tricks.last", []), r: () => 0 });
  async function activitySpec(a) {
    if (a && a.kind === "book") {   // from his activity book
      const t = a.spec = a.spec || routineFor(BOOK_BY_ID[a.id], { ask: a.ask || "", owned: memory.props() });
      if (t) console.log(`[book] ${t.id}: ${t.steps.length} steps, ${Math.round(t.ms / 100) / 10} s`);
      return t;
    }
    if (a && a.kind === "improvise") {   // not in the book: Gemma plans one from his pieces; kept for next time
      const { entry, fresh } = await improvise({ llm: localLLM, ask: a.ask || "", memory, log: console });
      const t = routineFor(entry, { ask: a.ask || "", owned: memory.props(), skill: 0.7 });
      if (t) console.log(`[book] made up "${entry.name}"${fresh ? "" : " (again)"}: ${t.steps.length} steps${entry.need ? `; needs ${entry.need}` : ""}`);
      if (t && fresh && entry.need && !memory.findProp(entry.need)) {   // it really needs something he hasn't got: the workbench makes it
        t.queued = memory.enqueue({ kind: "prop", request: `${entry.need}: for ${entry.name}`, priority: 0.6, context: a.ask || "" });
        t.need = entry.need;
        try { story.runTool("want", { text: `do ${entry.name} properly with my ${entry.need}`, why: "you asked me to" }, a.ask || ""); } catch (_) { /* fine */ }
      }
      if (t && fresh) memory.scrap(`made up a new thing to do: ${entry.name}`, "activity");
      return t;
    }
    const t = await buildActivity(a, { memory, llm: localLLM, log: console });
    if (t && t.kind === "paint") console.log(`[paint] ${t.subject}: ${t.painting.shapes.length} shapes`);
    if (t && t.kind === "trick" && t.make) {   // "pull a rabbit out of a hat": he hasn't got one; the workbench makes it, and the trick waits for it
      const q = memory.enqueue({ kind: "prop", request: `${t.make}: a cute little ${t.make} for a magic trick`, priority: 0.7, context: a.ask || "" });
      try { story.runTool("want", { text: `pull a ${t.make} out of my hat`, why: "the trick I promised" }, a.ask || ""); } catch (_) { /* fine */ }
      t.queued = q;
    }
    return t;
  }
  // the page tells us how it went: a finished painting (saved), how many balls he dropped
  const paintDir = path.join(dataDir, "paintings"); fs.mkdirSync(paintDir, { recursive: true });
  app.use("/paintings", express.static(paintDir, { maxAge: "1h" }));
  app.get("/api/paintings", (_, res) => res.json(memory.get("paintings", []).slice(-40).reverse()));
  app.post("/api/paintings", express.json({ limit: "3mb" }), (req, res) => {
    const b = req.body || {}, png = String(b.png || "");
    if (!/^data:image\/(png|jpeg);base64,/.test(png) || png.length > 2.8e6) return res.status(400).json({ error: "a picture, please" });
    const file = `painting-${Date.now().toString(36)}.png`;
    try { fs.writeFileSync(path.join(paintDir, file), Buffer.from(png.split(",")[1], "base64")); } catch (e) { return res.status(500).json({ error: e.message }); }
    const subject = String(b.subject || "something").replace(/[<>]/g, "").slice(0, 60), title = String(b.title || `my painting of ${subject}`).replace(/[<>]/g, "").slice(0, 60);
    const list = memory.get("paintings", []); list.push({ file, subject, title, at: new Date().toISOString() }); memory.set("paintings", list.slice(-60));
    for (const old of list.slice(0, -60)) if (/^painting-[a-z0-9]+\.png$/.test(String(old.file))) fs.rm(path.join(paintDir, old.file), { force: true }, () => {});   // (off the wall: the file goes too)
    memory.scrap(`I painted ${subject} for you`, "paintings", list.length);
    story.onEvent({ kind: "painted", subject });
    res.json({ ok: true, url: `/paintings/${file}` });
  });
  app.get("/api/book", (_, res) => res.json(bookPage(memory)));   // his activity book: what he can do, what he's done, what he made up
  // a water fight began with Mochi getting Cocoa by surprise as he arrived: next time Cocoa comes with his shield up
  app.post("/api/waterfight", (req, res) => {
    const a = req.body && req.body.ambush;
    if (a === "hit" || a === "block") ambushed(memory);
    res.json({ ok: true, waterfights: memory.get("waterfights", null) });
  });
  app.post("/api/activity/done", (req, res) => {
    const b = req.body || {};
    if (b.kind === "juggle") { const sk = juggled(memory.get("skills", {}), Math.max(0, Math.min(9, +b.drops || 0))); memory.set("skills", sk); return res.json({ ok: true, skill: sk.juggle }); }
    if (b.kind === "routine") { if (!bookDone(memory, b.id)) return res.status(400).json({ error: "not one of his activities" }); try { story.onEvent({ kind: "activity", id: b.id }); } catch (_) { /* fine */ } return res.json({ ok: true }); }
    res.json({ ok: true });
  });
  // a prop's picture: a new file each time (ids come back after a reset, and a cached /renders/prop-2.png would show
  // the old prop for an hour; a snapshot's props keep pointing at their own pictures)
  // The patterns he learns (Nov 7): a prop he designed that Pip knew at first sight is kept, so the next one comes out at
  // once (crafter.js setLearned). A learned one that Pip doesn't recognise next time, made as it is, is forgotten.
  const LEARN_MAX = 60;
  function learnFrom(r, propId, why = "right first time") {
    const list = memory.get("patterns.learned", []);
    const used = r.pattern && r.pattern.learned ? list.find((l) => l.name === r.pattern.name) : null;
    if (used) {
      if (r.matched) { used.uses = (used.uses || 0) + 1; used.lastAt = Date.now(); }
      else if (r.pattern.mode === "base") { list.splice(list.indexOf(used), 1); console.log(`[workbench] forgot the ${used.name} pattern: Pip didn't recognise it this time ("${r.guess}")`); }
      memory.set("patterns.learned", list); setLearned(list);
      return false;
    }
    if (!learnable(r)) return false;
    const { request: _req, ...recipe } = r.recipe, key = String(r.recipe.name).toLowerCase().trim();
    if (list.some((l) => String(l.name).toLowerCase().trim() === key && l.archetype === r.recipe.archetype)) return false;
    list.push({ name: r.recipe.name, archetype: r.recipe.archetype, recipe, at: Date.now(), uses: 0, from: propId });
    while (list.length > LEARN_MAX) {   // the one used least (and longest ago) makes room
      let k = 0; list.forEach((l, i) => { if ((l.uses || 0) < (list[k].uses || 0) || ((l.uses || 0) === (list[k].uses || 0) && (l.lastAt || l.at) < (list[k].lastAt || list[k].at))) k = i; });
      list.splice(k, 1);
    }
    memory.set("patterns.learned", list); setLearned(list);
    memory.scrap(why === "you said so" ? `you said my ${r.recipe.name} looked right, so now I know how to make one` : `I got my ${r.recipe.name} right first time, so now I know how to make one`, "props", propId);
    console.log(`[workbench] learned a new pattern: ${r.recipe.name} (${r.recipe.archetype}); he knows ${list.length}`);
    return true;
  }
  const savePic = (id, png) => { const f = `prop-${id}-${Date.now().toString(36)}.png`; fs.writeFileSync(path.join(rendersDir, f), png); memory.setPropThumb(id, `/renders/${f}`); };
  const stamp = () => new Date().toISOString().replace("T", " ").slice(0, 19);
  const offline = (msg) => /fetch failed|ECONNREFUSED|ECONNRESET|ENOTFOUND|socket hang up|timed out/i.test(String(msg));
  async function workTick() {
    if (work.busy || work.bench || inFlight > 0 || opts.worker === false || Date.now() < work.pauseUntil || !crafter) return;
    if (work.rethumb.size && renderer) {   // a prop made bigger or smaller: a new picture for his shelf (one at a time)
      const id = work.rethumb.values().next().value; work.rethumb.delete(id);
      const p = memory.props().find((x) => x.id === id);
      if (p) {
        work.busy = true;
        const gen = work.gen;
        try { const r = await renderer.render(p.recipe, { size: 320, views: ["front", "three-quarter"], standIn: true }); if (r && r.ok && r.png && gen === work.gen) savePic(id, r.png); }
        catch (e) { console.warn(`[workbench] new picture for prop ${id}: ${e.message}`); }
        finally { work.busy = false; }
      }
      return;
    }
    const job = memory.nextJob(); if (!job) return;
    const fixFor = job.kind === "prop" && /^fix:(\d+)$/.exec(job.context || "");
    if (fixFor && !memory.props().some((p) => p.id === +fixFor[1])) { memory.setJob(job.id, { status: "cancelled", error: "that prop was put away" }); console.log(`[workbench] fix "${job.request}" called off: the prop was put away`); return; }
    work.busy = true; work.current = { id: job.id, kind: job.kind, request: job.request, started: Date.now() };
    const gen = work.gen, stale = () => gen !== work.gen;   // reset (demo or Day Zero) while it was being made
    // the workshop crew (Nov 3): each step goes to the pages, so Kit the fox (writes the code) and Pip the owl (tests it
    // blind) can be seen at work; the last steps are kept for a page that opens mid-job
    const onStep = (s) => { if (stale()) return; const { img, ...rest } = s; work.current.steps = [...(work.current.steps || []).slice(-11), rest]; if (img) work.current.img = img; broadcast({ type: "bench", id: job.id, kind: job.kind, request: job.request, ...s }); };
    memory.setJob(job.id, { status: "working", attempts: (job.attempts || 0) + 1 });
    broadcast({ type: "workbench", id: job.id, status: "working", kind: job.kind, request: job.request });
    const t0 = Date.now();
    let status = "failed", patch = {};
    try {
      const fixId = job.kind === "prop" && /^fix:(\d+)$/.exec(job.context || "");
      const fixing = fixId && memory.props().find((p) => p.id === +fixId[1]);
      if (fixing) {   // "make the soup green": the one they have, changed, in place
        const change = job.request.includes(":") ? job.request.slice(job.request.indexOf(":") + 1).trim() : job.request;
        const r = await crafter.remakeProp({ recipe: fixing.recipe, change, onStep });
        if (stale()) throw Object.assign(new Error("reset while it was on the workbench"), { stale: true });
        if (r.ok) {
          memory.setPropRecipe(fixing.id, r.recipe);
          if (r.png) savePic(fixing.id, r.png);
          memory.scrap(`you asked me to change my ${fixing.name} (${change}), so I did`, "props", fixing.id);
          status = "done"; patch = { result_id: fixing.id, error: null, log: JSON.stringify({ fix: true, plan: r.plan, matched: r.matched ?? null, guess: r.guess || null, remade: !!r.remade, timings: r.timings }) };
        } else patch = { error: r.error, log: JSON.stringify({ fix: true, timings: r.timings }) };
        console.log(`[workbench] fix "${job.request}" → ${r.ok ? `done (${r.recipe.archetype}, ${r.recipe.parts.length} parts${r.plan ? `: ${r.plan}` : ""}${r.matched === true ? `, looks right ("${r.guess}")` : r.matched === false ? `, Pip saw "${r.guess}"` : ""})` : `failed: ${r.error}`} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
      } else if (job.kind === "prop") {
        const drawing = doodleRef((memory.get("doodle.jobs", {}))[job.id]);   // you drew it: the workbench follows your drawing
        setLearned(memory.get("patterns.learned", []));   // (a reset or Day Zero may have changed what he knows)
        const r = await crafter.craftProp({ request: job.request, context: job.context || "", onStep, drawing });
        if (stale()) throw Object.assign(new Error("reset while it was on the workbench"), { stale: true });
        if (r.ok) {
          const when = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
          const said = job.context && !/^fix:\d+$/.test(job.context) ? job.context : "";
          const origin = job.source === "mochi" ? `I made it on my own${job.reason ? `: ${job.reason}` : ""}` : `you asked for it on ${when}${said ? `: "${String(said).slice(0, 90)}"` : ""}`;
          const id = memory.addProp({ name: r.recipe.name, archetype: r.recipe.archetype, recipe: r.recipe, origin, source: job.source, meta: { matched: r.matched, unsure: r.unsure, guess: r.guess, ms: r.timings.total, models: r.timings.models || ["local"], ...(r.timings.checkers ? { checkers: r.timings.checkers } : {}) } });
          if (r.png) savePic(id, r.png);
          const learned = learnFrom(r, id);
          status = "done"; patch = { result_id: id, error: null, log: JSON.stringify({ unsure: r.unsure, matched: r.matched, guess: r.guess, learned, timings: r.timings, attempts: r.attempts }) };
        } else patch = { error: r.error, log: JSON.stringify({ timings: r.timings, attempts: r.attempts }) };
        if (r.ok && r.unsure) { const p = memory.props().find((x) => x.id === patch.result_id); factory.feedback({ kind: "unsure", title: `Workbench unsure: ${job.request}`.slice(0, 120), markdown: unsureNote(job, r, p) }); }
        console.log(`[workbench] prop "${job.request}" → ${r.ok ? `${r.recipe.name} (${r.recipe.archetype}, ${r.recipe.parts.length} parts${r.matched ? ", looks right" : r.unsure ? `, looked like ${r.guess}` : ""})` : `failed: ${r.error}`} in ${((Date.now() - t0) / 1000).toFixed(1)} s${r.timings && r.timings.models ? ` [${[...new Set(r.timings.models)].join(", ")}]` : ""}`);
      } else {
        const r = await crafter.craftMove({ request: job.request, context: job.context || "", onStep });
        if (stale()) throw Object.assign(new Error("reset while it was on the workbench"), { stale: true });
        if (r.ok) {
          const when = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
          const id = memory.addMove({ name: r.recipe.name, recipe: r.recipe, prop_archetype: r.recipe.prop || null, origin: `you asked me to learn it on ${when}`, source: job.source === "mochi" ? "mochi" : "user", skill: 0.3 });
          const forProp = /\[for: ([^\]]+)\]/.exec(job.request);   // taught in words: "when you use the umbrella, spin it and hop"
          if (forProp) linkUse({ name: forProp[1].trim() }, id);
          status = "done"; patch = { result_id: id, error: null, log: JSON.stringify({ timings: r.timings, attempts: r.attempts }) };
        } else patch = { error: r.error, log: JSON.stringify({ timings: r.timings, attempts: r.attempts }) };
        console.log(`[workbench] move "${job.request}" → ${r.ok ? `${Object.keys(r.recipe.tracks).length} tracks, ${r.recipe.duration} s` : `failed: ${r.error}`} in ${((Date.now() - t0) / 1000).toFixed(1)} s${r.timings && r.timings.models ? ` [${[...new Set(r.timings.models)].join(", ")}]` : ""}`);
      }
    } catch (e) {
      if (e.stale) { console.log(`[workbench] ${job.kind} "${job.request}": dropped (${e.message})`); work.busy = false; work.current = null; broadcast({ type: "workbench", id: job.id, kind: job.kind, status: "dropped" }); return; }   // the crew panel lets it go   // its row is gone with the old Mochi
      patch = { error: e.message }; console.error(`[workbench] ${job.kind} "${job.request}": ${e.message}`);
    }
    if (status !== "done" && offline(patch.error)) {   // LM Studio is down or busy: try again later, don't count it
      status = "queued"; patch.attempts = job.attempts || 0; work.pauseUntil = Date.now() + 30000;
    } else if (status !== "done" && (job.attempts || 0) + 1 < 2) status = "queued";   // one more go later
    memory.setJob(job.id, { status, ...patch, ms: Date.now() - t0, finished_at: stamp() });
    work.last = { id: job.id, kind: job.kind, request: job.request, status, ms: Date.now() - t0, error: patch.error || null };
    work.busy = false; work.current = null;
    let verdict = null; try { const L = JSON.parse(patch.log || "{}"); verdict = { matched: !!L.matched, unsure: !!L.unsure, guess: L.guess || null, fix: !!L.fix }; } catch (_) { /* no log */ }
    const made = status === "done" && job.kind === "prop" && patch.result_id ? memory.props().find((p) => p.id === patch.result_id) : null;
    broadcast({ type: "workbench", id: job.id, status, kind: job.kind, request: job.request, ms: Date.now() - t0, verdict, thumb: made ? made.thumb : null, name: made ? made.name : null });
  }
  const workTimer = setInterval(() => { workTick().catch((e) => { console.error("[workbench]", e); work.busy = false; }); }, 1500);
  const benchTimer = setInterval(async () => {   // a bench request dropped in data/inbox
    if (work.bench || work.busy || !crafter) return;
    let files = []; try { files = fs.readdirSync(inboxDir).filter((f) => f.endsWith(".json")); } catch (_) { return; }
    if (!files.length) return;
    const f = path.join(inboxDir, files[0]);
    let spec; try { spec = JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { try { fs.renameSync(f, `${f}.bad`); } catch (_) { /* taken */ } return; }
    // (another server on this data folder may have just taken it: Nov 7, an 8789 window left open ran one of two
    // benches at the same time as 8788, and both took twice as long)
    try { fs.renameSync(f, `${f}.running`); } catch (_) { return; }
    const name = String(spec.name || files[0].replace(/\.json$/, "")).replace(/[^a-z0-9_-]+/gi, "-");
    work.bench = { name, started: Date.now() };
    if (spec.scamgen) {   // our own dataset (scamgen.js): written by Nemotron on Brev (and a second model), then scored
      try {
        const setsDir = path.join(dataDir, "scamsets"); fs.mkdirSync(setsDir, { recursive: true });
        const file = path.join(setsDir, `${name}.jsonl`);
        let rows = [];
        if (spec.reuse && fs.existsSync(path.join(setsDir, `${spec.reuse}.jsonl`))) rows = fs.readFileSync(path.join(setsDir, `${spec.reuse}.jsonl`), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
        else {
          const writers = Array.isArray(spec.writers) && spec.writers.length ? spec.writers : ["nemotron-brev"];
          const jobs = genJobs({ perScam: spec.perScam || 6, perNormal: spec.perNormal || 5 });
          let k = 0, fin = 0;
          const run = async () => { for (let i = k++; i < jobs.length; i = k++) {
            const job = jobs[i], who = writers[i % writers.length], p = genPrompt(job);
            try {
              const r = await craftLLM.chat({ what: "scamgen", ...p, schema: GEN_SCHEMA, schemaName: "messages", maxTokens: 2400, temperature: 0.9, only: who, anyTask: true, think: false, timeoutMs: 150000 });
              rows.push(...genRows(job, r.json, r.provider || "local"));
            } catch (e) { console.warn(`[scamgen] ${job.label} ${job.type} ${job.channel}: ${e.message.slice(0, 100)}`); }
            if (++fin % 10 === 0) console.log(`[bench] ${name}: wrote ${fin}/${jobs.length} batches, ${rows.length} messages`);
          } };
          await Promise.all([run(), run(), run()]);
          rows = dedupe(rows);
          fs.writeFileSync(file, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
        }
        // the word counter (baseline, and the third vote): trained on half of this set, or on another set entirely
        // ("trainOn": "ourset-2"), and then tested on all of this one, which it never saw
        const other = spec.trainOn && fs.existsSync(path.join(setsDir, `${spec.trainOn}.jsonl`)) ? fs.readFileSync(path.join(setsDir, `${spec.trainOn}.jsonl`), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : null;
        const { train, test } = other ? { train: other, test: rows } : split(rows);
        const bayes = trainBayes(train);
        console.log(`[bench] ${name}: ${rows.length} messages (${rows.filter((r) => r.label === "scam").length} scams) by ${[...new Set(rows.map((r) => r.by))].join(", ")}; training the word counter on ${train.length}${other ? ` (${spec.trainOn})` : ""}, testing on ${test.length}`);
        const r = await evaluate(test, { llm: spec.rulesOnly ? null : craftLLM, baseline: bayes, words: spec.twoReaders ? null : bayes, parallel: 3, onEach: (row, i, n) => { if (i % 25 === 0) console.log(`[bench] ${name}: checked ${i}/${n}`); } });
        const f = (x) => (x == null ? "-" : `${Math.round(x * 100)}%`);
        console.log(`[bench] ${name}: baseline P ${f(r.baseline.precision)} R ${f(r.baseline.recall)}; rules P ${f(r.rules.precision)} R ${f(r.rules.recall)}; ${r.reader || "model"} P ${f(r.model.precision)} R ${f(r.model.recall)}; both P ${f(r.both.precision)} R ${f(r.both.recall)}; calibration ${Object.entries(r.calib).map(([k, v]) => `${k} ${v.right}/${v.n}`).join(", ")}`);
        const out = { at: new Date().toISOString(), sets: [{ name: `our own set (${rows.length} messages, by ${[...new Set(rows.map((x) => x.by))].map((b) => readerName(b)).join(" and ")}; ${other ? `word counter trained on another set, ${spec.trainOn}` : "tested on half"})`, ...r }] };
        // and a fairer test of the baseline: trained on ALL of our set, tested on messages written another way (the
        // hand-written ones kept back from tuning the rules); a word counter learns its writers' habits
        if (!spec.noCross) {
          const wAll = trainBayes(other ? [...other, ...rows] : rows);
          const cross = await evaluate(HELD_OUT, { llm: spec.rulesOnly ? null : craftLLM, baseline: wAll, words: spec.twoReaders ? null : wAll, parallel: 3 });
          out.sets.push({ name: "hand-written messages, never seen by any of them (baseline trained on our whole set)", ...cross });
          console.log(`[bench] ${name}: cross: baseline P ${f(cross.baseline.precision)} R ${f(cross.baseline.recall)}; rules P ${f(cross.rules.precision)} R ${f(cross.rules.recall)}; ${cross.reader || "model"} P ${f(cross.model.precision)} R ${f(cross.model.recall)}; both P ${f(cross.both.precision)} R ${f(cross.both.recall)}`);
        }
        fs.mkdirSync(path.join(benchDir, name), { recursive: true });
        fs.writeFileSync(path.join(benchDir, name, "scam-report.json"), JSON.stringify(out, null, 1));
        const prev = memory.get("scamcheck.accuracy", null);
        memory.set("scamcheck.accuracy", { at: out.at, sets: out.sets.map(({ rows: _r, ...x }) => x) });
      } catch (e) { console.error(`[bench] ${name}: ${e.stack || e.message}`); }
      finally { work.bench = null; try { fs.renameSync(`${f}.running`, `${f}.done`); } catch (_) { /* gone */ } }
      return;
    }
    if (spec.skitgen) {   // money skits written on the fly (skitgen.js): write a few now and keep a report of each try
      try {
        const n = Math.max(1, Math.min(8, Number(spec.skitgen) || 3)), tries = [];
        for (let i = 0; i < n; i++) {
          const r = await writeOneSkit();
          tries.push({ ok: r.ok, by: r.by || null, checkedBy: r.checkedBy || null, ms: r.ms, problems: r.problems || [], raw: r.raw || undefined, skit: r.skit ? { title: r.skit.title, lesson: r.skit.lesson, beats: r.skit.beats, choices: r.skit.choices, right: r.skit.right, yes: r.skit.yes, no: r.skit.no, reveal: r.skit.reveal, math: r.skit.math } : null });
          console.log(`[bench] ${name}: skit ${i + 1}/${n} ${r.ok ? "kept" : "not kept"}`);
        }
        fs.mkdirSync(path.join(benchDir, name), { recursive: true });
        fs.writeFileSync(path.join(benchDir, name, "skitgen-report.json"), JSON.stringify({ at: new Date().toISOString(), kept: tries.filter((t) => t.ok).length, of: n, tries }, null, 1));
      } catch (e) { console.error(`[bench] ${name}: ${e.stack || e.message}`); }
      finally { work.bench = null; try { fs.renameSync(`${f}.running`, `${f}.done`); } catch (_) { /* gone */ } }
      return;
    }
    if (spec.scams) {   // the scam checker's accuracy (scamcheck.js): the kept-back made-up set, and T-Mobile's if it's in data\tmobile
      try {
        const sets = [{ name: "made-up (kept back from tuning)", set: HELD_OUT }];
        const tdir = path.join(dataDir, "tmobile");
        try { for (const fn of fs.readdirSync(tdir).filter((x) => /\.(?:csv|jsonl?|json)$/i.test(x))) { const got = parseSet(fn, fs.readFileSync(path.join(tdir, fn), "utf8")); if (got.length) sets.push({ name: `${fn} (an outside set, never trained on)`, set: spec.limit ? got.slice(0, +spec.limit) : got }); } } catch (_) { /* no folder yet */ }
        if (spec.tuning) sets.push({ name: "made-up (the rules were tuned on it)", set: SCAM_SET });
        const out = { at: new Date().toISOString(), sets: [] };
        for (const S of sets) {
          console.log(`[bench] ${name}: scam check on ${S.name}, ${S.set.length} messages`);
          const r = await evaluate(S.set, { llm: spec.rulesOnly ? null : craftLLM, onEach: (row, i, n) => { if (i % 10 === 0) console.log(`[bench] ${name}: ${i}/${n}`); } });
          out.sets.push({ name: S.name, ...r });
          const f = (x) => (x == null ? "-" : `${Math.round(x * 100)}%`);
          console.log(`[bench] ${name}: ${S.name}: rules P ${f(r.rules.precision)} R ${f(r.rules.recall)}; ${r.reader || "model"} P ${f(r.model.precision)} R ${f(r.model.recall)}; both P ${f(r.both.precision)} R ${f(r.both.recall)}; median ${r.median} ms`);
        }
        fs.mkdirSync(path.join(benchDir, name), { recursive: true });
        fs.writeFileSync(path.join(benchDir, name, "scam-report.json"), JSON.stringify(out, null, 1));
        memory.set("scamcheck.accuracy", { ...out, sets: out.sets.map(({ rows, ...x }) => x) });
      } catch (e) { console.error(`[bench] ${name}: ${e.message}`); }
      finally { work.bench = null; try { fs.renameSync(`${f}.running`, `${f}.done`); } catch (_) { /* gone */ } }
      return;
    }
    console.log(`[bench] ${name}: ${(spec.props || []).length} props, ${(spec.moves || []).length} moves`);
    // a bench can try the workbench another way: "options": { "parallel": 1, "takesOn": "miss", "hand": false, "compact": true, "learned": false }
    const O = spec.options && typeof spec.options === "object" ? spec.options : null;
    // "only": one model by name for the writing and checking ("nemotron-api"), whatever the cloud boost switch says
    const benchLLM = O && O.only ? Object.assign(Object.create(craftLLM), { chat: (a) => craftLLM.chat({ ...a, only: O.only }) }) : craftLLM;
    const benchCrafter = O && !opts.crafter ? makeCrafter({ llm: benchLLM, renderer, log: console, parallel: O.parallel ?? CONFIG.craftParallel, takesOn: O.takesOn ?? CONFIG.craftTakesOn, hand: O.hand ?? CONFIG.craftHand, compact: O.compact ?? CONFIG.craftCompact }) : crafter;
    if (O && O.learned === false) setLearned([]);
    if (O) console.log(`[bench] ${name} with ${JSON.stringify(O)}`);
    try { const r = await runBench({ spec, crafter: benchCrafter, llm: benchLLM, dir: path.join(benchDir, name) }); console.log(`[bench] ${name} done: ${JSON.stringify(r.summary)}`); }
    catch (e) { console.error(`[bench] ${name}: ${e.message}`); fs.writeFileSync(path.join(benchDir, `${name}-error.txt`), String(e.stack || e)); }
    finally { work.bench = null; setLearned(memory.get("patterns.learned", [])); try { fs.renameSync(`${f}.running`, `${f}.done`); } catch (_) { /* gone */ } }
  }, 3000);

  await new Promise((ok) => server.listen(opts.port ?? CONFIG.port, opts.host ?? CONFIG.host, ok));
  const addr = server.address();
  if (renderer === null && opts.renderer === undefined) renderer = makeRenderer({ url: `http://127.0.0.1:${addr.port}/render`, dataDir, log: console });
  crafter = opts.crafter || makeCrafter({ llm: craftLLM, renderer, log: console, parallel: opts.craftParallel ?? CONFIG.craftParallel, takesOn: opts.craftTakesOn ?? CONFIG.craftTakesOn, hand: CONFIG.craftHand, compact: CONFIG.craftCompact });
  // practising while you're away (practice.js, Nov 7): a prop that didn't come out right, made again in a long quiet
  // moment, by the background model if keys.json names one (else Gemma); a message from you stops it at once. Not in
  // tests.
  // (on the shared Mochi too since Nov 7: the writing is the background model's, on Brev, so visitors don't wait for it;
  // a visitor's message stops it like anyone's)
  const practiceOn = opts.practice ?? (!opts.fetchImpl && !opts.crafter && CONFIG.practice);
  practice = makePractice({ memory, llm: craftLLM, log: console,
    makeCrafter: (llm) => makeCrafter({ llm, renderer, log: { log() {}, warn: console.warn }, parallel: CONFIG.craftParallel, takesOn: CONFIG.craftTakesOn, hand: CONFIG.craftHand, compact: CONFIG.craftCompact }),
    isQuiet: () => !!renderer && Date.now() - Math.max(lastTyping, lastMessage) > PRACTICE.quietMs && inFlight === 0 && !work.busy && !work.bench && !memory.queue().some((j) => j.status === "queued" || j.status === "working"),
    lastMessageAt: () => Math.max(lastTyping, lastMessage),
    onBetter: (b) => {
      work.rethumb.add(b.id);
      memory.set("practice.news", [...(memory.get("practice.news", null) || []), { id: b.id, name: b.name, was: b.was, at: new Date().toISOString() }].slice(-5));
      memory.scrap(`I practised my ${b.name} while you were away${b.was ? ` (it used to look like ${b.was})` : ""}; now it really looks like one`, "props", b.id);
      broadcast({ type: "practised", id: b.id, name: b.name });
    },
    enabled: () => practiceOn });
  if (practiceOn) practice.start();
  // money skits written on the fly (skitgen.js, Nov 8): in a quiet moment Nemotron (the background model) writes one
  // from a lesson card, code checks it, Gemma answers its question blind; kept ones go in the library, served at once
  // ("do a money skit" prefers a new one). A message stops a write in progress. Not in tests (unless asked).
  const genLib = () => (memory.get("money.genskits", null) || []);
  setExtraSkits(genLib().map(fromStore));
  const gen = { running: false, attempts: [] };
  async function writeOneSkit({ interruptibleSince = null } = {}) {
    if (gen.running) return { ok: false, problems: ["already writing one"] };
    gen.running = true;
    try {
      const lib = genLib(), recentCards = [...lib.slice(-6).map((k) => k.card), ...gen.attempts.slice(-4).map((a) => a.card)];
      const card = pickCard(recentCards), sv = memory.get("savings", null);
      const writer = interruptibleSince ? interruptible(craftLLM, () => Math.max(lastTyping, lastMessage) > interruptibleSince) : craftLLM;
      const r = await generateSkit({ writer, checker: localLLM, card, titles: [...MONEY_SKITS_TITLES, ...lib.map((k) => k.title)], goal: sv && sv.goal ? sv.goal : null, log: console });
      gen.attempts = [...gen.attempts, { at: new Date().toISOString(), card: card.id, ok: r.ok, by: r.by || null, problems: r.problems || [], ms: r.ms }].slice(-20);
      memory.set("money.genlog", gen.attempts);
      if (r.ok) {
        const next = [...lib, toStore(r.skit)].slice(-30);
        memory.set("money.genskits", next); setExtraSkits(next.map(fromStore));
        console.log(`[skitgen] kept: "${r.skit.title}" (${card.name}), written by ${r.by}, checked by ${r.checkedBy}, ${Math.round(r.ms / 1000)} s`);
      } else console.log(`[skitgen] ${card.name}: not kept (${(r.problems || []).slice(0, 3).join("; ")})`);
      return r;
    } catch (e) { console.warn("[skitgen]", e.message); return { ok: false, problems: [e.message] }; }
    finally { gen.running = false; }
  }
  const MONEY_SKITS_TITLES = ["needs and wants", "Mimi's cookie stand", "a little every day", "the better deal", "the bank pays you", "the rainy-day jar", "spend, save, share", "the \"free\" game", "you can't have both", "check the receipt"];
  const genOn = opts.skitgen ?? (!opts.fetchImpl && !opts.crafter && CONFIG.practice);
  const genTimer = genOn ? setInterval(() => {
    const quiet = Date.now() - Math.max(lastTyping, lastMessage) > PRACTICE.quietMs && inFlight === 0 && !work.busy && !work.bench;
    const unplayed = extraSkits().filter((k) => !(((memory.get("money", null) || {}).skits || {}).genPlayed || []).includes(k.id)).length;
    const lastHour = gen.attempts.filter((a) => Date.now() - Date.parse(a.at) < 3600000).length;
    if (quiet && !gen.running && unplayed < 6 && lastHour < 6) writeOneSkit({ interruptibleSince: Date.now() }).catch(() => {});
  }, 75 * 1000) : null;
  // ---- new scams for the T-Mobile games, written by Gemini on the fly (scamlive.js, Nov 8): a few kept ready (memory
  // "scams.fresh"), played before the hand-written ones, refilled in the background (a cloud call: Gemma's not busy)
  const scamLib = () => { const L = memory.get("scams.fresh", null) || {}; return { scenes: Array.isArray(L.scenes) ? L.scenes : [], calls: Array.isArray(L.calls) ? L.calls : [], played: Array.isArray(L.played) ? L.played : [] }; };
  const scamReady = (kind) => { const L = scamLib(); return (kind === "call" ? L.calls : L.scenes).filter((x) => !L.played.includes(x.id)); };
  setFreshScams(scamLib());
  const sgen = { running: false, attempts: [] };
  async function writeOneScam(kind = scamReady("call").length < scamReady("scene").length ? "call" : "scene") {
    if (sgen.running) return { ok: false, problems: ["already writing one"] };
    sgen.running = true;
    try {
      const L = scamLib(), who = Math.random() < 0.5 ? "mimi" : "cocoa";
      const avoid = [...L.scenes.map((x) => x.idea).filter(Boolean), ...L.calls.map((x) => x.title)].slice(-8);
      const r = await writeScam({ llm: craftLLM, kind, who, avoid, log: console });
      sgen.attempts = [...sgen.attempts, { at: new Date().toISOString(), ok: r.ok }].slice(-40);
      if (r.ok) {
        const L2 = scamLib(), x = r.scene || r.call, key = kind === "call" ? "calls" : "scenes";
        const next = { ...L2, [key]: [...L2[key], { ...x, at: new Date().toISOString() }].slice(-12) };
        next.played = next.played.filter((id) => [...next.scenes, ...next.calls].some((y) => y.id === id));
        memory.set("scams.fresh", next); setFreshScams(next);
        console.log(`[scams] new ${kind} ready, written by ${r.by} in ${r.ms} ms: ${kind === "call" ? `"${x.title}"` : `${x.who === "mimi" ? "Mimi" : "Cocoa"}'s ${x.kind} (${x.tells.join(", ")})`}`);
      } else console.log(`[scams] a new ${kind}: not kept (${(r.problems || []).slice(0, 2).join("; ")})`);
      return r;
    } finally { sgen.running = false; }
  }
  const scamOn = opts.scamgen ?? genOn;
  const scamTimer = scamOn ? setInterval(() => {
    const lastHour = sgen.attempts.filter((a) => Date.now() - Date.parse(a.at) < 3600000).length;
    if (!sgen.running && lastHour < 24 && (scamReady("scene").length < 2 || scamReady("call").length < 2)) writeOneScam().catch(() => {});
  }, 40 * 1000) : null;
  app.get("/api/scams/fresh", (_, res) => { const L = scamLib(); res.json({ scenes: L.scenes.map(({ id, who, kind, tells, idea, by, at }) => ({ id, who, kind, tells, idea, by, at, played: L.played.includes(id) })), calls: L.calls.map(({ id, title, by, at }) => ({ id, title, by, at, played: L.played.includes(id) })), running: sgen.running }); });
  app.post("/api/scams/fresh/generate", async (req, res) => { const r = await writeOneScam(req.body && req.body.kind === "call" ? "call" : "scene"); res.json({ ok: r.ok, by: r.by, ms: r.ms, problems: r.problems, scene: r.scene || undefined, call: r.call || undefined }); });
  app.get("/api/money/skits", (_, res) => res.json({ library: genLib().map(({ id, title, lesson, by, checkedBy, at, card }) => ({ id, title, lesson, card, by, checkedBy, at, played: ((((memory.get("money", null) || {}).skits) || {}).genPlayed || []).includes(id) })), log: memory.get("money.genlog", null) || [], cards: LESSON_CARDS.length, running: gen.running }));
  app.post("/api/money/skits/generate", async (_, res) => { const r = await writeOneSkit(); res.json({ ok: r.ok, by: r.by, checkedBy: r.checkedBy, problems: r.problems, ms: r.ms, skit: r.skit ? { id: r.skit.id, title: r.skit.title, lesson: r.skit.lesson } : null }); });
  setLearned(memory.get("patterns.learned", []));   // the patterns he's learned (Nov 7)
  // one Mochi per database (solo.js): the lower port stays; a second one on the same file steps aside
  let soloTimer = null;
  if (opts.solo) {
    const me = { dir: path.join(dataDir, "servers"), db: opts.db || CONFIG.db, port: addr.port };
    const tick = () => {
      const other = whoStays(me);
      if (other) { console.log(`[mochi] another Mochi on port ${other.port} uses this database; this one (port ${addr.port}) steps aside. Close this window.`); clearInterval(soloTimer); unbeat(me); process.exit(0); }
      beat(me);
    };
    tick(); soloTimer = setInterval(tick, BEAT_MS); soloTimer.unref();
    process.on("exit", () => unbeat(me));
  }
  console.log(`[mochi] http://${addr.address === "::" || addr.address === "0.0.0.0" ? "localhost" : addr.address}:${addr.port}  model=${CONFIG.llm.model}  feelings=${model ? "on" : "off"}`);
  // warm LM Studio up with his persona so the first message after a (re)start is quick (not in tests)
  if (opts.warmup !== false && !opts.fetchImpl && process.env.MOCHI_WARMUP !== "off") setTimeout(() => brain.warmup().then((ms) => console.log(`[brain] warm-up ${ms} ms`)).catch((e) => console.log(`[brain] warm-up skipped: ${e.message}`)), 1000);
  return { app, server, memory, brain, state, port: addr.port, broadcast, work, workTick, craftLLM,
    close: () => new Promise((ok) => { if (practice) practice.stop(); clearInterval(genTimer); clearInterval(scamTimer); clearInterval(soloTimer); clearInterval(giftTimer); clearInterval(revealTimer); clearTimeout(storyPace.timer); clearTimeout(storyPush); clearInterval(workTimer); clearInterval(benchTimer); if (renderer && renderer.close) renderer.close(); wss.close(); server.close(() => { memory.close(); ok(); }); }) };
}

const same = (a, b) => (process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b);   // "c:\mochi" vs "C:\mochi"
if (process.argv[1] && same(path.resolve(process.argv[1]), fileURLToPath(import.meta.url))) {
  // a slip in one request (an async route throwing in its own catch) is logged, not fatal: the demo keeps running
  process.on("unhandledRejection", (e) => console.error("[server] unhandled:", e && e.stack ? e.stack : e));
  // a second Mochi on the same database steps aside before it opens it (solo.js; Nov 7, the 8789 window)
  const other = whoStays({ dir: path.join(path.dirname(path.resolve(CONFIG.db)), "servers"), db: CONFIG.db, port: CONFIG.port });
  if (other) { console.log(`[mochi] another Mochi on port ${other.port} already uses ${path.resolve(CONFIG.db)}; this one (port ${CONFIG.port}) isn't starting. Close this window.`); process.exit(0); }
  createServer({ solo: true }).catch((e) => { console.error(e); process.exit(1); });
}
