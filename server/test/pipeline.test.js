// End-to-end against a fake LM Studio: tool calls, memory, action stripping, crisis, sulk, reuse.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer } from "../index.js";
import { stripActions } from "../brain.js";
import { isCrisis } from "../../shared/safety.js";

// A stand-in for LM Studio. Scripted: if the last user message mentions an umbrella, call request_prop; etc.
function fakeLLM() {
  const calls = [];
  return {
    calls,
    async fetch(url, init) {
      if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] }), { status: 200 });
      const body = JSON.parse(init.body); calls.push(body);
      const last = body.messages[body.messages.length - 1];
      const user = [...body.messages].reverse().find((m) => m.role === "user").content.toLowerCase();
      let message;
      // a thinking model that spends its whole budget reasoning: empty content, finish "length" (what Gemma 4 did on the M5)
      if (user.includes("boss")) {
        if (body.max_tokens < 1000) return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "", reasoning_content: "x".repeat(1500) }, finish_reason: "length" }], usage: { completion_tokens: body.max_tokens } }), { status: 200 });
        message = { role: "assistant", content: "<|channel>thought<channel|>*leans in* Ugh, bosses. What did they do?" };
      } else if (user.includes("cake")) {   // cut off mid-sentence
        if (body.max_tokens < 1000) return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "Now I'm hungry! What kind of cake is" }, finish_reason: "length" }] }), { status: 200 });
        message = { role: "assistant", content: "Now I'm hungry! What kind of cake is it?" };
      } else if (user.includes("silent")) return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "" }, finish_reason: "length" }] }), { status: 200 });
      else if (last.role === "tool") message = { role: "assistant", content: `*hops happily* ${last.content.includes("already have") ? "I've still got it! Here." : "Ooh, on it!"}` };
      else if (user.includes("umbrella")) message = { role: "assistant", content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "request_prop", arguments: JSON.stringify({ name: "umbrella", description: "tiny blue", importance: 0.7 }) } }] };
      else if (user.includes("interview")) message = { role: "assistant", content: null, tool_calls: [{ id: "c2", type: "function", function: { name: "remember", arguments: JSON.stringify({ text: "has a job interview", kind: "event", when: "2020-01-02", weight: 0.9 }) } }] };
      else if (user.includes("twirl")) message = { role: "assistant", content: null, tool_calls: [{ id: "c3", type: "function", function: { name: "perform", arguments: JSON.stringify({ move: "twirl", prop: "umbrella" }) } }] };
      else message = { role: "assistant", content: "*tilts head* Tell me more?" };
      return new Response(JSON.stringify({ choices: [{ message }] }), { status: 200 });
    },
  };
}

test("stripActions turns *asterisks* into moods", () => {
  const r = stripActions("*hops happily* Yay!  *does the umbrella twirl*");
  assert.equal(r.text, "Yay!");
  assert.deepEqual(r.actions.map((a) => a.kind + ":" + a.name), ["mood:happy", "move:umbrella twirl"]);
});

test("crisis rule: fires on real lines, not on jokes", () => {
  assert.equal(isCrisis("this cake is to die for"), false);
  assert.equal(isCrisis("i want to die for real"), true);
  assert.equal(isCrisis("thank you for always listening mochi. i just don't see the point in going on"), true);
  assert.equal(isCrisis("I can't go on stage tomorrow, so nervous"), false);
  assert.equal(isCrisis("even you'd be better off without me"), true);
});

test("chat pipeline: tools, memory, reuse, sulk, crisis", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-"));
  const llm = fakeLLM();
  const S = await createServer({ db: path.join(dir, "t.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl: llm.fetch, feelings: null });
  const post = async (p, body) => (await fetch(`http://127.0.0.1:${S.port}${p}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();
  try {
    const h = await (await fetch(`http://127.0.0.1:${S.port}/health`)).json();
    assert.equal(h.ok, true);

    // 1. prop request → queued on the workbench, in-character reply with the action stripped
    let r = await post("/api/chat", { text: "can you make an umbrella?", id: "1", rule: "thinking" });
    assert.equal(r.mood, "thinking");
    assert.equal(r.reply.queued.length, 1);
    assert.equal(r.reply.text, "Ooh, on it!");
    assert.equal(r.reply.actions[0].name, "happy");
    assert.equal(S.memory.queue()[0].status, "queued");

    // 2. the worker (day 3) finishes it; simulate: the prop lands in memory and the job is done
    const pid = S.memory.addProp({ name: "umbrella", archetype: "handheld_canopy", recipe: { archetype: "handheld_canopy", parts: {} }, origin: "the day you asked while it was storming" });
    S.memory.setJob(S.memory.queue()[0].id, { status: "done", result_id: pid });

    // 3. ask again in new words → reuse, nothing new queued
    r = await post("/api/chat", { text: "it's pouring, got an umbrella?", id: "2", rule: "thinking" });
    assert.equal(r.reply.queued.length, 0);
    assert.ok(r.reply.actions.some((a) => a.kind === "prop" && a.name === "umbrella"));
    assert.equal(S.memory.queue().filter((j) => j.status === "queued").length, 0);

    // 4. a dated fact → remembered, and (date in the past) shows up as a follow-up in the next context
    r = await post("/api/chat", { text: "I have an interview", id: "3", rule: "nod" });
    assert.equal(r.reply.remembered[0].text, "has a job interview");
    assert.equal(S.memory.followUps().length, 1);
    assert.match(S.brain.context(), /Follow up on/);

    // 5. a posed move + perform with the prop = the combination moment
    await post("/api/moves", { name: "twirl", recipe: { tracks: [] }, prop_archetype: "handheld_canopy" });
    r = await post("/api/chat", { text: "do your twirl!", id: "4", rule: "nod" });
    const mv = r.reply.actions.find((a) => a.kind === "move");
    assert.equal(mv.name, "twirl"); assert.equal(mv.prop.name, "umbrella");
    assert.ok(S.memory.moves()[0].skill > 0.15);

    // 6. sulk: three insults by word rules (no feelings model here), then "....." and forgive on the apology
    for (const i of [5, 6]) { r = await post("/api/chat", { text: "i hate you", id: String(i), rule: "sad" }); assert.equal(r.reply.sulking, undefined); }
    r = await post("/api/chat", { text: "you suck", id: "7", rule: "sad" });
    assert.equal(r.startSulk, true); assert.equal(r.reply.text, ".....");
    r = await post("/api/chat", { text: "sorry mochi", id: "8", rule: "love" });   // word rules: "sorry" → love → reset
    assert.equal(r.endSulk, true); assert.notEqual(r.reply.text, ".....");

    // 7. crisis: deterministic reply, no LLM call, no sulk, care mode on
    const n = llm.calls.length;
    r = await post("/api/chat", { text: "I don't want to be here anymore", id: "9", rule: "concerned" });
    assert.equal(r.crisis, true); assert.equal(r.mood, "concerned"); assert.match(r.reply.text, /988/);
    assert.equal(llm.calls.length, n);
    assert.equal(S.state.careUntil > Date.now(), true);
    r = await post("/api/chat", { text: "i hate you", id: "10", rule: "sad" });   // care mode: worried, not hurt
    assert.equal(r.mood, "concerned"); assert.equal(r.strikes, 0);

    // 7b. a reply lost to hidden reasoning is retried with more room; leaked thought tags are stripped
    S.state.careUntil = 0;
    r = await post("/api/chat", { text: "ugh my boss is the worst", id: "11", rule: "sad" });
    assert.equal(r.reply.text, "Ugh, bosses. What did they do?");
    assert.equal(r.reply.llm.retried, true); assert.equal(r.reply.llm.calls, 2); assert.equal(r.reply.llm.reasoningChars, 1500);
    assert.ok(r.reply.actions.some((a) => a.name === "concerned"));
    // a reply cut off mid-sentence is retried too
    r = await post("/api/chat", { text: "this cake is to die for", id: "13", rule: "happy" });
    assert.equal(r.crisis, false); assert.equal(r.reply.text, "Now I'm hungry! What kind of cake is it?"); assert.equal(r.reply.llm.retried, true);
    // every request asks for thinking off (reasoning_effort "none": per request, other apps on the model unaffected)
    assert.ok(llm.calls.length > 0 && llm.calls.every((b) => b.reasoning_effort === "none"));
    // still nothing after the retry: an error (oops face), never a blank "…" from Mochi
    r = await post("/api/chat", { text: "be silent", id: "12", rule: "nod" });
    assert.equal(r.reply.error, undefined); assert.equal(r.reply.fallback, true);   // a short line, never an error bubble
    assert.match(r.reply.text, /tangled/);

    // 8. scrapbook has the story
    const sb = S.memory.scrapbook().map((s) => s.entry).join("\n");
    assert.match(sb, /umbrella/); assert.match(sb, /twirl/);
  } finally { await S.close(); }
});

test("feelings runner is found from FEELINGS_DIR (<root>/export/feelings → <root>/serve/feelings.mjs)", async () => {
  const { loadFeelingsModel, makeReactor } = await import("../feelings.js");
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "feel-"));
  fs.mkdirSync(path.join(rootDir, "serve"), { recursive: true });
  fs.mkdirSync(path.join(rootDir, "export", "feelings"), { recursive: true });
  fs.writeFileSync(path.join(rootDir, "serve", "feelings.mjs"),
    `export async function loadFeelings(dir) { return async (t) => (/hate you/.test(t) ? { target: "mochi", intent: "insult", decision: "hurt", decision_p: 0.9, request: "none", ms: 1 } : /boss/.test(t) ? { target: "other", intent: "insult", decision: "concern", decision_p: 0.95, request: "none", ms: 1 } : { decision: "neutral", request: "none", ms: 1 }); }`);
  const model = await loadFeelingsModel(path.join(rootDir, "export", "feelings"), 2);
  assert.equal(typeof model, "function");
  const react = makeReactor(model), st = { strikes: 0, lastIncrease: 0, careUntil: 0, careModeMs: 1000 };
  assert.equal((await react("ugh i hate my boss", "sad", st)).mood, "concerned");   // the model overrules the word rule
  assert.equal(st.strikes, 0);
  const r = await react("i hate you", "sad", st);
  assert.equal(r.mood, "sad"); assert.equal(st.strikes, 1);
  assert.equal(await loadFeelingsModel(path.join(rootDir, "nope", "export", "feelings"), 2), null);   // missing → word rules
});

test("first reaction reaches the page over the WebSocket before the brain's reply", async () => {
  const { WebSocket } = await import("ws");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-ws-"));
  const slow = async (url, init) => {   // a brain that takes 600 ms, like Gemma on the M5 (1.5–10 s)
    if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] }), { status: 200 });
    await new Promise((r) => setTimeout(r, 600));
    return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "Oh no. What happened?" }, finish_reason: "stop" }] }), { status: 200 });
  };
  const feel = async (t) => ({ decision: /boss/.test(t) ? "concern" : /lol/.test(t) ? "laugh" : "neutral", request: "none", ms: 1 });
  const S = await createServer({ db: path.join(dir, "w.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl: slow, feelings: feel });
  try {
    const ws = new WebSocket(`ws://127.0.0.1:${S.port}/ws`);
    const got = [];
    await new Promise((ok) => ws.on("open", ok));
    ws.on("message", (raw) => { const m = JSON.parse(raw); if (m.type === "first") got.push({ ...m, at: Date.now() }); });
    const t0 = Date.now();
    const r = await (await fetch(`http://127.0.0.1:${S.port}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "ugh my boss is the worst", id: "w1", rule: "nod" }) })).json();
    const tReply = Date.now();
    assert.equal(got.length, 1); assert.equal(got[0].id, "w1"); assert.equal(got[0].mood, "concerned");
    assert.ok(got[0].at - t0 < 200, `first reaction took ${got[0].at - t0} ms`);
    assert.ok(tReply - got[0].at >= 400, "it arrived well before the reply");
    assert.equal(r.mood, "concerned");   // repeated in the HTTP response as a fallback
    ws.close();
  } finally { await S.close(); }
});

test("follow-ups use the local date, not UTC", async () => {
  const { openMemory } = await import("../memory.js");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-date-"));
  const M = openMemory(path.join(dir, "d.sqlite"));
  const d = new Date(), local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const tomorrow = new Date(d.getTime() + 864e5 - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  M.remember("event today", { when: local, weight: 0.9 }); M.remember("event tomorrow", { when: tomorrow, weight: 0.9 });
  assert.deepEqual(M.followUps().map((f) => f.text), ["event today"]);
  M.close();
});

test("the brain is told what's on the workbench", async () => {
  const { openMemory } = await import("../memory.js");
  const { makeBrain } = await import("../brain.js");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-bench-"));
  const M = openMemory(path.join(dir, "b.sqlite"));
  M.enqueue({ kind: "prop", request: "umbrella: tiny blue" });
  const ctx = makeBrain({ memory: M }).context();
  assert.match(ctx, /On your workbench list[^\n]*never promise a time[^\n]*umbrella \(prop\)/);
  assert.match(ctx, /MUST call request_prop/);
  M.close();
});

test("alarming news gets the shocked face; light or Mochi-directed messages don't", async () => {
  const { makeReactor } = await import("../feelings.js");
  const model = async (t) => ({ decision: /lol|haha/.test(t) ? "laugh" : /hate you|you suck/.test(t) ? "hurt" : /house|bricks/.test(t) ? "concern" : "neutral", request: /\?$/.test(t) ? "help" : "none", ms: 1 });   // as on the M5: the jet question read neutral/help
  const react = makeReactor(model), st = () => ({ strikes: 0, lastIncrease: 0, careUntil: 0, careModeMs: 1000 });
  for (const t of ["no it crashed and destroyed my house", "a ton of bricks fell on me", "did you hear about the jet crash near my place?"])
    assert.equal((await react(t, "nod", st())).mood, "shocked", t);
  assert.equal((await react("my inbox exploded lol", "happy", st())).mood, "laugh");
  assert.equal((await react("the movie had a plane crash in it", "nod", st())).mood, "nod");
  const noModel = makeReactor(null);
  assert.equal((await noModel("there was an explosion down my street", "nod", st())).mood, "shocked");
  assert.equal((await noModel("there was an explosion down my street lol", "happy", st())).mood, "happy");
});

test("the brain is told about Mimi and what his body just did", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-body-"));
  const bodies = [];
  const fetchImpl = async (url, init) => {
    if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] }), { status: 200 });
    bodies.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "This is Mimi!" }, finish_reason: "stop" }] }), { status: 200 });
  };
  const S = await createServer({ db: path.join(dir, "b.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: async () => ({ decision: "neutral", request: "help", ms: 1 }) });
  const post = async (body) => (await fetch(`http://127.0.0.1:${S.port}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();
  try {
    let r = await post({ text: "btw do you have a gf?", id: "g1", rule: "showoff" });
    assert.equal(r.mood, "showoff");
    let sys = bodies.at(-1).messages[0].content;
    assert.match(sys, /Mimi is your girlfriend/);
    assert.match(sys, /On screen just now: you proudly showed off your girlfriend Mimi/);
    r = await post({ text: "mochi wear a christmas hat", id: "g2", rule: "nod", costume: "christmas" });
    assert.match(bodies.at(-1).messages[0].content, /On screen just now: [^\n]*putting on your Santa hat/);
    r = await post({ text: "a ton of bricks fell on me", id: "g3", rule: "nod" });
    assert.equal(r.mood, "shocked");
    assert.match(bodies.at(-1).messages[0].content, /On screen just now: you gasped in shock/);
  } finally { await S.close(); }
});

test("asking for something he already has puts it on instead of queueing a copy", async () => {
  const { builtinProp, builtinMove } = await import("../brain.js");
  assert.equal(builtinProp("xmas hat").costume, "christmas");
  assert.equal(builtinProp("santa hat: red and fluffy").costume, "christmas");
  assert.equal(builtinProp("bunny ears").costume, "easter");
  assert.equal(builtinProp("umbrella: tiny blue"), null);
  assert.equal(builtinProp("hat"), null);   // a plain hat is a real craft request
  assert.equal(builtinMove("wave"), "hello"); assert.equal(builtinMove("umbrella twirl"), null);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-hat-"));
  let round = 0;
  const fetchImpl = async (url, init) => {
    if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] }), { status: 200 });
    const body = JSON.parse(init.body), last = body.messages.at(-1);
    const message = last.role === "tool" ? { role: "assistant", content: `Yep! ${last.content.includes("already have") ? "Here it is!" : "Making one!"}` }
      : { role: "assistant", content: null, tool_calls: [{ id: "h" + ++round, type: "function", function: { name: "request_prop", arguments: JSON.stringify({ name: "xmas hat" }) } }] };
    return new Response(JSON.stringify({ choices: [{ message, finish_reason: "stop" }] }), { status: 200 });
  };
  const S = await createServer({ db: path.join(dir, "h.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: null });
  try {
    const r = await (await fetch(`http://127.0.0.1:${S.port}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "do you have a xmas hat?", id: "x1", rule: "thinking", costume: "christmas" }) })).json();
    assert.equal(r.reply.queued.length, 0);
    assert.equal(S.memory.queue().length, 0);
    assert.ok(r.reply.actions.some((a) => a.kind === "costume" && a.name === "christmas"));
    assert.equal(r.reply.text, "Yep! Here it is!");
    const room = await (await fetch(`http://127.0.0.1:${S.port}/room`)).text();
    assert.match(room, /Mochi's workshop/);   // the room page (redesigned as his workshop on Nov 1)
  } finally { await S.close(); }
});

test("a teasing pout is sheepish, not tears; Mimi by name brings her in; a wordless reply gets words", async () => {
  const mood = (s) => stripActions(s).actions[0].name;
  assert.equal(mood("*pouts*"), "oops"); assert.equal(mood("*puffs out cheeks*"), "oops"); assert.equal(mood("*crosses arms*"), "oops");
  assert.equal(mood("*puffs out chest proudly*"), "proud"); assert.equal(mood("*sniffles*"), "sad"); assert.equal(mood("*tears up*"), "sad");
  const { makeReactor } = await import("../feelings.js");
  const st = () => ({ strikes: 0, lastIncrease: 0, careUntil: 0, careModeMs: 1000 });
  assert.equal((await makeReactor(async () => ({ decision: "neutral", request: "help", ms: 1 }))("where si mimi", "thinking", st())).mood, "showoff");
  assert.equal((await makeReactor(async () => ({ decision: "hurt", request: "none", ms: 1 }))("mimi is ugly and so are you", "sad", st())).mood, "sad");
  // wordless: the model answers only "*tilts head*" after a tool call; the retry supplies the words, the action stays
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-wordless-"));
  const fetchImpl = async (url, init) => {
    if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] }), { status: 200 });
    const b = JSON.parse(init.body), last = b.messages.at(-1);
    const message = /Now reply to them in words/.test(b.messages[0].content) ? { role: "assistant", content: "Ooh, a confetti blaster! Let me make one!" }
      : last.role === "tool" ? { role: "assistant", content: "*tilts head*" }
      : { role: "assistant", content: null, tool_calls: [{ id: "b1", type: "function", function: { name: "request_prop", arguments: JSON.stringify({ name: "confetti bazooka" }) } }] };
    return new Response(JSON.stringify({ choices: [{ message, finish_reason: "stop" }] }), { status: 200 });
  };
  const S = await createServer({ db: path.join(dir, "w.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: null });
  try {
    const r = await (await fetch(`http://127.0.0.1:${S.port}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "do you have a bazooka?", id: "z1", rule: "thinking" }) })).json();
    assert.equal(r.reply.text, "Ooh, a confetti blaster! Let me make one!");
    assert.ok(r.reply.actions.some((a) => a.name === "thinking"));
    assert.equal(r.reply.llm.retried, true); assert.equal(r.reply.queued.length, 1);
  } finally { await S.close(); }
});

test("an empty reply after a tool call: the tool's work stands and he says a line that fits his face", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-empty-"));
  const fetchImpl = async (url, init) => {   // what Gemma did on the M5: remember, then nothing, then nothing again
    if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] }), { status: 200 });
    const b = JSON.parse(init.body), last = b.messages.at(-1);
    const message = last.role === "user" && !/Now reply to them in words/.test(b.messages[0].content)
      ? { role: "assistant", content: null, tool_calls: [{ id: "r1", type: "function", function: { name: "remember", arguments: JSON.stringify({ text: "had a car crash into their house today", weight: 0.9 }) } }] }
      : { role: "assistant", content: "" };
    return new Response(JSON.stringify({ choices: [{ message, finish_reason: "stop" }] }), { status: 200 });
  };
  const S = await createServer({ db: path.join(dir, "e.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: async () => ({ decision: "concern", request: "none", ms: 1 }) });
  try {
    const r = await (await fetch(`http://127.0.0.1:${S.port}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "I had a car crash into my house today", id: "c1", rule: "shocked" }) })).json();
    assert.equal(r.mood, "shocked");
    assert.equal(r.reply.error, undefined);
    assert.match(r.reply.text, /are you okay/);
    assert.equal(r.reply.remembered[0].text, "had a car crash into their house today");
    assert.equal(S.memory.facts()[0].text, "had a car crash into their house today");
  } finally { await S.close(); }
});

test("props really appear: show and use tools, perform with a prop, and a backstop when he only says so", async () => {
  const { propIntent } = await import("../brain.js");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-props-"));
  const script = {   // user text → the model's answer (a tool call, or words only)
    "show me the map": { content: "Check it out! It's got everything on it." },
    "you got the launcher?": { content: "I sure do! It's ready to go whenever you are." },
    "go": { content: "Boom! Confetti everywhere!" },
    "hold up your map": { tool: ["show_prop", { prop: "map" }] },
    "shoot the bazooka over there": { tool: ["use_prop", { prop: "bazooka", aim: true }] },
    "show off the map": { tool: ["perform", { move: "showoff", prop: "map" }] },
    "do you have a xmas hat?": { content: "Yep! Here it is!" },
  };
  let system = "";
  const fetchImpl = async (url, init) => {
    if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] }), { status: 200 });
    const body = JSON.parse(init.body), last = body.messages.at(-1), user = [...body.messages].reverse().find((m) => m.role === "user").content;
    system = body.messages[0].content;
    const s = script[user] || { content: "Hm?" };
    const message = last.role === "tool" ? { role: "assistant", content: "Here!" } : s.tool ? { role: "assistant", content: null, tool_calls: [{ id: "t" + Math.random(), type: "function", function: { name: s.tool[0], arguments: JSON.stringify(s.tool[1]) } }] } : { role: "assistant", content: s.content };
    return new Response(JSON.stringify({ choices: [{ message, finish_reason: "stop" }] }), { status: 200 });
  };
  const S = await createServer({ db: path.join(dir, "p.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: null });
  const say = async (text, extra = {}) => (await (await fetch(`http://127.0.0.1:${S.port}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, id: String(Math.random()), ...extra }) })).json()).reply;
  const propOf = (r) => r.actions.find((a) => a.kind === "prop");
  try {
    const recipe = (name, archetype) => ({ name, archetype, parts: [{ shape: "box", size: [0.3, 0.4, 0.05], at: [0, 0.2, 0], color: "#fff3d6", material: "paper" }] });
    S.memory.addProp({ name: "Confetti Rocket Launcher", archetype: "launcher", recipe: { ...recipe("Confetti Rocket Launcher", "launcher"), ammo: "confetti", muzzle: [0.3, 0.2, 0] }, origin: "test", source: "user" });
    S.memory.addProp({ name: "colorful little paper map", archetype: "handheld_tool", recipe: recipe("colorful little paper map", "handheld_tool"), origin: "test", source: "user" });
    let r = await say("show me the map");
    assert.equal(propOf(r).use, "show"); assert.equal(propOf(r).name, "colorful little paper map"); assert.ok(propOf(r).recipe.parts.length, "the page gets the recipe to build it");
    r = await say("you got the launcher?");
    assert.equal(propOf(r).use, "show", "asked if he has it: he holds it up");
    r = await say("go");
    assert.equal(propOf(r).use, "fire"); assert.equal(propOf(r).archetype, "launcher");
    r = await say("hold up your map");
    assert.equal(propOf(r).use, "show");
    r = await say("shoot the bazooka over there", { holding: { name: "colorful little paper map", slot: "hand" } });
    assert.ok(!propOf(r), "the tap decides: no second fire from the reply");
    assert.match(system, /you have your colorful little paper map in your hoof/, "he knows what's in his hoof");
    r = await say("show off the map");
    assert.equal(propOf(r).use, "show"); assert.ok(r.actions.some((a) => a.kind === "mood" && a.name === "proud") && !r.actions.some((a) => a.name === "showoff"), "proud with the map, not Mimi");
    r = await say("do you have a xmas hat?");
    assert.ok(!propOf(r), "a bare 'here it is' about a hat doesn't pull out the map");
    assert.equal(propIntent({ text: "i gotta go now", spoken: "Bye!", props: [{ name: "Confetti Rocket Launcher", archetype: "launcher" }], recent: ["nice launcher"] }), null);
  } finally { await S.close(); }
});
