# Tamamochi: born on day zero

A 3D companion you teach with your own hands. Mochi starts knowing nothing. He grows from what you make together (props he builds and uses, moves you pose, a secret handshake), and with his friends Mimi and Cocoa he teaches kids to spot scams and handle money.

Built at HackUTD 2026.

## Try it live

**https://tamamochi.work**

If the domain doesn't open yet, use the direct link: https://stamps-formed-mixing-within.trycloudflare.com

It needs a passcode, which is in our Devpost submission (or ask us at our table). Mochi runs on our own computer during the event, so if the link doesn't open, the computer is restarting: try again in a minute.

Things to try:

- "Make me an umbrella", then "use it"
- "Is this text a scam? Your package can't be delivered. Pay a $1.99 fee at parcel-help.live/pay"
- "Play the scam-spotting game"
- Menu → Teach a move: drag his arms, then pat him
- "Help me save $20 for a kite", then "What if I buy a cupcake?"
- "How's my money?" and "Do a money skit"

## What it does

**He learns from you.** Ask for something or draw it and he builds it at his workbench: a model writes a small 3D recipe, it's rendered, and a second look checks the picture without being told what was asked. He keeps it on his shelf and remembers who asked and why. You can pose him to teach a move, and teach him a handshake.

**He spots scams, and teaches you to (T-Mobile track).** Paste a message and Mochi puts on his detective hat:

- **Three checks vote:** hand-written rules, a word counter trained on our own message set, and NVIDIA Nemotron. Two of three decide.
- **Honest confidence:** "pretty sure", "fairly sure" or "not sure". On messages he had never seen, when he said "pretty sure" he was right 323 of 327 times.
- **Warning signs in your message's own words**, the link taken apart ("the real website is verify-account.top"), and clear next steps, like forwarding to 7726.
- **Privacy shield:** names, phone numbers, codes, emails and card numbers are replaced with [NAME], [PHONE], [CODE] before anything leaves the computer, and the card shows exactly what was sent.
- **Learning by playing:** a scam-spotting game, skits where Cocoa in a silly disguise phones Mimi pretending to be the bank and you choose what she does, and Mimi remembers what you teach her.

**He learns about money, and teaches it (PNC track).** On day zero he knows nothing about money; the first money question downloads a "money smarts" skill pack. Then:

- **The whole picture:** "How's my money?" shows his wallet, piggy bank and goal, Mochi Bank, what Cocoa owes him and what he's shared, with three health signs (saving habit, spend and save balance, goal progress), a forecast from his real saves, what's coming up, and one next move.
- **What-if:** "What if I buy a cupcake?" plays both futures at Mimi's stand with the real numbers, then you choose and it really happens. "What if I keep $10 in the bank for 10 weeks?" draws the chart: $16.29 in the bank, still $10 in the piggy bank.
- **Earning, lending, teaching:** jobs and chores pay play money, Cocoa borrows and pays back, and Mimi asks for advice and remembers the rule you give her.
- **Money skits:** 10 hand-written ones (needs and wants, interest, rainy-day funds, free trials, receipts…), plus new ones NVIDIA Nemotron writes from our lesson cards while he's idle. Code checks the arithmetic and Gemma answers each question blind before a skit is kept.
- **Numbers come from code, not the model,** so his words and the card agree. It's play money, the 5% a week interest is a play rate so kids can see it grow, and it isn't financial advice.

**He has feelings.** A small model we trained ourselves (RoBERTa, 15 ms a message) reads who a message is aimed at, so "I hate my boss" makes him worried for you, not hurt.

## How it's built

| Part | What runs it | Where |
| --- | --- | --- |
| Stage | three.js in the browser, works on a phone | the browser |
| Brain (his chat) | Gemma 4 26B in LM Studio | my own computer, running locally |
| Feelings | fine-tuned RoBERTa, ONNX | our computer |
| Voice | Kokoro text-to-speech on the CPU | our computer |
| Memory | SQLite | our computer |
| Scam reader, prop practice, money skits | **NVIDIA Nemotron 3 Nano** (30B-A3B, FP8) on vLLM | an NVIDIA Brev L40S GPU |
| Prop fixer | Gemini Flash | Google |
| Safety | a fixed crisis rule that runs before any model | our computer |

Your conversation stays on our computer. The cloud helpers only see prop requests and, for a scam check, the message with personal details hidden. The badge on his stage names every cloud service in use.

## Scam check accuracy

Measured on 408 messages Mochi had never seen. T-Mobile asked teams to make their own data, so we generated our sets with several models, trained the word counter on one set and tested on another.

| Check | Precision | Recall |
| --- | --- | --- |
| Rules alone | 91% | 87% |
| Word counter alone | 94% | 98% |
| Nemotron alone | 86% | 95% |
| **All three, two of three decide** | **94%** | **97%** |

On our 48 hand-written test messages, the three together caught every scam with no false alarms.

**A second, outside test:** 500 messages written by ChatGPT (270 scams across all nine types, 230 normal, 200 of them marked subtle), never used for training. All three together caught 98% of the scams (at least 29 of 30 in every type), and 93% of their alarms were real scams. When Mochi said "pretty sure", he was right 307 of 308 times; "fairly sure", 168 of 192.

## Where to look in the code

| File | What's in it |
| --- | --- |
| `server/scamcheck.js` | The scam check: rules, link X-ray, privacy shield, the three-way vote, confidence |
| `server/scamgen.js`, `server/scamset.js` | How we generated our message sets; the hand-written test messages |
| `server/scams.js` | The scam-spotting game, the scam-call skits, Teach Mimi |
| `server/money.js` | Money World: wallet, piggy bank, Mochi Bank, the money card, what-ifs, lending, money skits |
| `server/skitgen.js` | Nemotron writes new money skits; code and Gemma check them |
| `shared/pocket-money.js` | 18 money props (wallet, little bank, three money jars, lemonade stand…) |
| `server/router.js` | Which model does which job (Gemma, Nemotron, Gemini) |
| `server/practice.js` | Nemotron remaking props in the background while Mochi is idle |
| `server/crafter.js`, `shared/craft.js` | The prop workbench: recipe language, render, blind check, fixes |
| `server/brain.js` | His chat with Gemma |
| `shared/safety.js` | The crisis rule that runs first |
| `kit/src/` | His 3D body, his friends and the stage |
| `web/stage.html` | The page you talk to him on |

Not in this repo: the feelings model weights (about 500 MB), our generated message sets, Mochi's memory, and any keys.

## Run it yourself

You need Node 22.13 or newer and [LM Studio](https://lmstudio.ai) serving `google/gemma-4-26b-a4b` on its default port.

```
cd kit && npm install && npm run build
cd ../server && npm install && npm start
```

Then open http://localhost:8787. He runs without any keys. To add the cloud helpers, copy `data/keys.example.json` to `data/keys.json` and fill it in; that file is ignored by git and never sent to the page. Tests: `cd server && npm test`.
