"""
learn.py — The continual-learning core. This is what makes her *grow*.

Every conversation is logged to data/experience.jsonl by chat.py.
Running this script fine-tunes the model on those real conversations,
mixed with replay samples from the original corpus so she doesn't
catastrophically forget her base training (this replay trick is the
same idea used in serious continual-learning research).

Exchanges you marked with !good are weighted 3x. Exchanges marked
!bad are excluded entirely — so over time she literally learns to be
more like the version of herself you approve of.

Usage:
    python learn.py                 # fine-tune on accumulated experience
    python learn.py --epochs 3
"""
import argparse
import json
import os
import random

import torch

import tokenizer as tok
from model import load_checkpoint, save_checkpoint
from train import load_corpus, get_batch

BASE = os.path.dirname(__file__)
CKPT = os.path.join(BASE, "checkpoints", "model.pt")
EXP = os.path.join(BASE, "data", "experience.jsonl")


def load_experience():
    """Returns a list of token sequences, feedback-weighted."""
    seqs = []
    if not os.path.exists(EXP):
        return seqs
    with open(EXP, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            d = json.loads(line)
            if d.get("feedback") == "bad":
                continue
            weight = 3 if d.get("feedback") == "good" else 1
            ids = tok.encode_exchange(d["user"], d["bot"], d.get("mem"))
            seqs.extend([ids] * weight)
    return seqs


def batch_from_seqs(seqs, block_size, batch_size, device):
    xs, ys = [], []
    for _ in range(batch_size):
        ids = random.choice(seqs)
        ids = ids[: block_size + 1]
        pad = (block_size + 1) - len(ids)
        x = torch.tensor(ids[:-1] + [tok.END] * max(0, pad - 0), dtype=torch.long)[:block_size]
        y = torch.tensor(ids[1:] + [-1] * max(0, pad), dtype=torch.long)[:block_size]
        xs.append(x)
        ys.append(y)
    return torch.stack(xs).to(device), torch.stack(ys).to(device)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--epochs", type=int, default=2)
    ap.add_argument("--batch", type=int, default=8)
    ap.add_argument("--lr", type=float, default=5e-5)   # low LR: gentle adaptation
    ap.add_argument("--replay", type=float, default=0.3, help="fraction of steps drawn from base corpus")
    args = ap.parse_args()

    device = "cuda" if torch.cuda.is_available() else "cpu"
    seqs = load_experience()
    if not seqs:
        raise SystemExit("No experience yet. Talk to her first (python chat.py).")
    print(f"{len(seqs)} weighted experience sequences")

    model, extra = load_checkpoint(CKPT, device)
    corpus = load_corpus()
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr)
    model.train()

    steps = max(20, args.epochs * len(seqs) // args.batch)
    for step in range(1, steps + 1):
        if random.random() < args.replay:
            x, y = get_batch(corpus, model.cfg.block_size, args.batch, device)  # replay
        else:
            x, y = batch_from_seqs(seqs, model.cfg.block_size, args.batch, device)
        _, loss = model(x, y)
        opt.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        opt.step()
        if step % 10 == 0 or step == 1:
            print(f"learn step {step}/{steps} | loss {loss.item():.4f}")

    extra["learn_sessions"] = extra.get("learn_sessions", 0) + 1
    save_checkpoint(model, CKPT, extra)
    print(f"growth session #{extra['learn_sessions']} complete -> {CKPT}")


if __name__ == "__main__":
    main()
