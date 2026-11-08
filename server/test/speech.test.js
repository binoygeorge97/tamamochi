// How a line is said (Nov 6): the acting (speed, loudness, pitch, pauses, piece by piece) and the words the speech
// model would get wrong.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSpeech, speakable, stripTags, toneOf, PRESETS } from "../../shared/speech.js";

test("words the speech model gets wrong: his name, SHOUTING, Mmm, Shh, Grr, stretched words, ~", () => {
  assert.equal(speakable("Hi, I'm Mochi!").text, "Hi, I'm Moe-chee!");
  assert.equal(speakable("Tamamochi").text, "Tama-moe-chee");
  const w = speakable("WOW that is BIG");
  assert.equal(w.text, "wow that is big"); assert.equal(w.loud, 2);
  assert.equal(speakable("I watch TV, OK?").text, "I watch TV, OK?", "acronyms stay as they are");
  assert.equal(speakable("Mmm, yummy! Shh. Grrr! Hmph.").text, "Hmm, yummy! Shush. Gurr! Humph.");
  const s = speakable("Sooo good, pleeease, yaaay, gooood");
  assert.equal(s.text, "So good, please, yay, good"); assert.equal(s.long, 4);
  assert.equal(speakable("Nice to meet you~ ♡ 😊 :)").text, "Nice to meet you");
  assert.equal(speakable("Zzz").text, "");
  assert.equal(speakable("Mm-hmm, me & you...").text, "Uh-huh, me and you…");
});

test("tags come out of what's shown", () => {
  assert.equal(stripTags("{whisper}Psst…{/whisper} {loud}BOO!{/} {rate=0.8}slow{/rate}"), "Psst… BOO! slow");
  assert.equal(stripTags("No tags here."), "No tags here.");
});

test("each sentence's own tone: sad slower, softer, lower; excited quicker, louder, higher; a plain '!' a little lift", () => {
  const [plain] = parseSpeech("I like apples.");
  assert.deepEqual([plain.rate, plain.vol, plain.pitch], [1, 1, 0]);
  const segs = parseSpeech("Oh no… I'm so sorry you lost your cat. Yay, cookies! Here you go!");
  assert.equal(segs.length, 4);
  assert.equal(segs[0].text, "Oh no…"); assert.equal(segs[0].pause, 300, "a real pause after the dots");
  assert.ok(segs[1].rate < 1 && segs[1].vol < 1 && segs[1].pitch < 0, "sad");
  assert.ok(segs[2].rate > 1.1 && segs[2].vol > 1.1 && segs[2].pitch > 1, "excited");
  assert.deepEqual([segs[3].rate, segs[3].vol, segs[3].pitch], [PRESETS.lift.rate, PRESETS.lift.vol, PRESETS.lift.pitch]);
  assert.equal(segs.at(-1).pause, 0);
  assert.equal(toneOf("I'm not sad at all"), null, "'not sad' isn't sad");
});

test("mid-sentence: a stage direction colours the rest of its sentence, an aside is soft, tags are exact", () => {
  let s = parseSpeech("I have a secret *whispers* it's a cookie. Want some?");
  assert.equal(s[0].text, "I have a secret"); assert.ok(s[0].pause >= 80);
  assert.equal(s[1].text, "it's a cookie."); assert.equal(s[1].vol, PRESETS.whisper.vol);
  assert.equal(s[2].text, "Want some?"); assert.equal(s[2].vol, 1, "the whisper ends with its sentence");
  s = parseSpeech("I found a clue (psst, it's behind the bush) and it's shiny.");
  assert.deepEqual(s.map((x) => x.text), ["I found a clue", "psst, it's behind the bush", "and it's shiny."]);
  assert.ok(s[1].vol < 0.8 && s[0].vol === 1 && s[2].vol === 1);
  s = parseSpeech("{whisper}Come closer...{/whisper} {loud}BOO!{/loud} {pause}{excited}Got you!");
  assert.deepEqual(s.map((x) => x.text), ["Come closer…", "boo!", "Got you!"]);
  assert.ok(s[0].vol < 0.5 && s[1].vol > 1.5 && s[1].pause >= 400 && s[2].pitch > 1);
  s = parseSpeech("{rate=0.7}Slowly{/rate} then {pitch=+3}up");
  assert.equal(s[0].rate, 0.7); assert.equal(s[1].text, "then"); assert.equal(s[2].pitch, 3);
  // a stage direction at the very end: the sentence before it, once ("I miss you" is sad already)
  s = parseSpeech("I miss you. *sniffles*");
  assert.equal(s.length, 1); assert.equal(s[0].vol, PRESETS.sad.vol);
  s = parseSpeech("That was the plan. *sighs*");
  assert.ok(s[0].rate < 1 && s[0].vol < 1);
});

test("pieces said the same way are one piece (the model phrases whole sentences better)", () => {
  assert.equal(parseSpeech("One. Two. Three. Four.").length, 1);
  const long = Array.from({ length: 12 }, (_, i) => `This is sentence number ${i + 1}.`).join(" ");
  const s = parseSpeech(long);
  assert.ok(s.length >= 2 && s.every((x) => x.text.length < 240), "not one huge piece (the model cuts off long ones)");
  assert.deepEqual(parseSpeech("*waves* [hops]"), []);
  assert.deepEqual(parseSpeech(""), []);
});
