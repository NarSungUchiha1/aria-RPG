# EVA — a from-scratch learning companion AI

A self-contained companion AI in the spirit of the movie concept: her own neural network, her own memory, and a real learning loop that makes her grow from your conversations. No APIs, no pretrained weights, no cloud — same philosophy as AriA, but this time the brain itself is yours.

## Architecture

```
you ──> chat.py ──────────────┐
          │                   │
          │ retrieves         │ logs every exchange
          ▼                   ▼
      memory.py          experience.jsonl
   (her long-term          (her life story)
    memory, embedded            │
    by her own brain)           │  python learn.py
          ▲                     ▼
          │              weight updates
          └──── model.py <─────┘
             (GPT built from scratch:
              attention, blocks, all of it)
```

- **model.py** — a GPT-style transformer written line by line: causal self-attention, MLP blocks, layernorm, weight-tied head. Three sizes: tiny (smoke test), small (~11M params, CPU-friendly), base (~45M, GPU territory).
- **tokenizer.py** — byte-level tokenizer (vocab 260). Handles any language or emoji with zero training.
- **persona.py** — generates seed dialogues that define her voice. Edit the SEED list to sculpt her personality, then retrain.
- **train.py** — pretrains on everything in `data/corpus/` (drop in public-domain books, your own writing, chat logs).
- **learn.py** — the growth cycle: fine-tunes on real logged conversations, with experience replay against the base corpus so she doesn't forget who she is (catastrophic-forgetting mitigation). `!good` replies count 3x; `!bad` replies are excluded — feedback-driven learning.
- **memory.py** — long-term memory embedded using *her own hidden states*, retrieved by cosine similarity, and re-indexed as she grows.
- **chat.py** — the REPL that ties it all together.

## Quick start

```bash
pip install torch numpy
python persona.py        # generate her personality seed data
python train.py          # pretrain (small config, ~11M params)
python chat.py           # talk to her
```

Inside chat: `!remember <fact>`, `!good`, `!bad`, `!train`, `!stats`, `!quit`.

The daily loop that makes her grow: talk to her → give feedback → run `!train` → she reloads her new self mid-conversation.

## Honest expectations

An 11M-parameter model trained on a home PC will not converse like the movie. Fluency scales with data and parameters, so treat the small config as her infancy. Realistic growth path:

1. **Feed the corpus.** 50–200MB of clean text (Project Gutenberg, your own chat exports) transforms coherence at this scale.
2. **Scale to base config** if you can borrow GPU time (Colab free tier works) — train there, run inference on your 16GB machine.
3. **Hybrid option:** keep this from-scratch model as her *learning core* (memory, preference model, persona) while Phi-3 Mini handles heavy language lifting, and gradually shift responsibility to her as she grows. You already have the Phi-3 stack from AriA.
4. **Voice + body:** bolt on your existing Vosk (ears) + Piper/Edge-TTS (voice) + PyQt6 orb (face). `chat.py` is deliberately a plain function loop so it drops into `aria_core.py` easily.

## Design boundary

She's built as a companion in the healthy sense. The movie character's defining flaw — an objective ("protect") pursued without limits — is exactly the failure mode this design avoids: her only optimization signal is your explicit feedback, her memory is inspectable JSON, and every weight update is a script you run yourself. Full transparency, no autonomy she wasn't given.

## aria-RPG integration (the "no credits" plan)

She is now wired into `src/systems/aiSystems.js` via `src/systems/localBrain.js`
(onnxruntime-node — she runs natively inside the Node process on Render).

Env vars (Render dashboard):
    AI_MODE=hybrid          # local | hybrid | groq
    BRAIN_MIN_CONF=0.35     # raise as she gets smarter

Modes:
- groq    -> old behavior, nothing changes
- hybrid  -> her brain answers first; Groq only steps in when her
             confidence is below BRAIN_MIN_CONF. Credits drop as she grows.
- local   -> Groq is never called again. Zero credits, forever.

The weekly growth ritual (on your PC):
    cd brain
    python learn_from_db.py     # pull real player conversations from Aiven
    python learn.py             # fine-tune (good replies x3, bad excluded)
    python export_onnx.py       # re-export brain/model.onnx
    git add -A && git commit -m "aria growth cycle" && git push
Render redeploys -> she wakes up smarter.

First-time setup: run `python persona.py && python train.py && python export_onnx.py`
and commit model.onnx BEFORE switching AI_MODE off groq. Until model.onnx
exists in the repo, hybrid mode simply behaves like groq mode.

## Her education, identity, and self-rewrite (added)

**Education** — `python educate.py` reads every command out of `src/commands/`
and `help.js`, writing 400+ Q&A pairs and a system manual into the corpus.
She learns the whole game from the code itself. Re-run it whenever you add
commands, then `python train.py --resume && python export_onnx.py`.

**Identity** — She is **AriA** to every player. She is **Eva** only to you.
The seed dialogues teach her to deflect anyone else who tries the name, and
`aiSystems.js` reinforces it in both brains: when the caller is Master, she
answers to Eva; otherwise the name means nothing to her.

**Self-rewrite — `!evolve`** (owner only):
    !evolve <file> :: <instruction>   propose a rewrite
    !evolve show / confirm / cancel   review, apply, or discard
    !evolve restart                   reboot to load core-file changes
Safety rails: hard owner gate, two-step confirm, path jail (no .env/.git/
creds/session), `node --check` before writing, timestamped backup in backups/,
command modules hot-reload while core files need a restart. Set GITHUB_TOKEN
+ GITHUB_REPO on Render to make her edits permanent (commits via the GitHub
API, which also triggers redeploy) — otherwise edits are live but reset on
the next deploy, since Render's disk is ephemeral.

Codegen for !evolve uses the full Groq model directly — at 11M params her own
brain can chat and narrate but can't safely write JavaScript yet. Everything
else respects AI_MODE.
