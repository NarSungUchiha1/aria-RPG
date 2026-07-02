"""
chat.py — Talk to her.

Commands inside the chat:
    !remember <fact>   store a long-term memory
    !good              mark her last reply as good (weighted 3x in training)
    !bad               mark her last reply as bad (excluded from training)
    !train             run a growth cycle right now (fine-tune on experience)
    !stats             model + memory stats
    !quit              exit

Everything you say is logged to data/experience.jsonl — that log IS her
life experience, and learn.py turns it into weight updates.
"""
import json
import os
import subprocess
import sys

import torch

import tokenizer as tok
from memory import MemoryStore
from model import load_checkpoint

BASE = os.path.dirname(__file__)
CKPT = os.path.join(BASE, "checkpoints", "model.pt")
EXP = os.path.join(BASE, "data", "experience.jsonl")


def log_exchange(user, bot, feedback=None):
    with open(EXP, "a", encoding="utf-8") as f:
        f.write(json.dumps({"user": user, "bot": bot, "feedback": feedback}, ensure_ascii=False) + "\n")


def set_last_feedback(value):
    if not os.path.exists(EXP):
        return
    with open(EXP, encoding="utf-8") as f:
        lines = [l for l in f.read().splitlines() if l.strip()]
    if not lines:
        return
    d = json.loads(lines[-1])
    d["feedback"] = value
    lines[-1] = json.dumps(d, ensure_ascii=False)
    with open(EXP, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def main():
    device = "cuda" if torch.cuda.is_available() else "cpu"
    if not os.path.exists(CKPT):
        raise SystemExit("No checkpoint. Run: python persona.py && python train.py")
    model, extra = load_checkpoint(CKPT, device)
    mem = MemoryStore()
    print(f"loaded {model.num_params():,} params | {len(mem)} memories | growth sessions: {extra.get('learn_sessions', 0)}")
    print("she's listening. (!quit to exit)\n")

    while True:
        try:
            user = input("you > ").strip()
        except (EOFError, KeyboardInterrupt):
            break
        if not user:
            continue

        if user == "!quit":
            break
        if user.startswith("!remember "):
            mem.add(model, user[len("!remember "):], device)
            print(f"  [stored — {len(mem)} memories]")
            continue
        if user == "!good":
            set_last_feedback("good")
            print("  [she'll learn from that one — 3x weight]")
            continue
        if user == "!bad":
            set_last_feedback("bad")
            print("  [noted — that reply won't be reinforced]")
            continue
        if user == "!train":
            print("  [growth cycle starting...]")
            subprocess.run([sys.executable, os.path.join(BASE, "learn.py")])
            model, extra = load_checkpoint(CKPT, device)
            mem.reindex(model, device)
            print("  [reloaded her new self]")
            continue
        if user == "!stats":
            print(f"  params: {model.num_params():,} | memories: {len(mem)} | growth sessions: {extra.get('learn_sessions', 0)}")
            continue

        memories = mem.search(model, user, k=3, device=device)
        ids = tok.encode_prompt(user, memories)
        x = torch.tensor([ids], dtype=torch.long, device=device)
        out = model.generate(x, max_new_tokens=180, temperature=0.8, top_k=40, stop_token=tok.END)
        reply_ids = out[0].tolist()[len(ids):]
        reply = tok.decode([i for i in reply_ids if i != tok.END]).strip()
        print(f"her > {reply}\n")
        log_exchange(user, reply)


if __name__ == "__main__":
    main()
