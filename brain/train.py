"""
train.py — Pretrain the model on everything in data/corpus/.
Drop any .txt files there: books (public domain), chat logs, your own writing,
seed dialogues. More data = smarter base model.

Usage:
    python train.py                      # small config, 3000 steps
    python train.py --size tiny --steps 200
    python train.py --resume             # continue from last checkpoint
"""
import argparse
import glob
import json
import os
import time

import torch

import tokenizer as tok
from model import GPT, Config, load_checkpoint, save_checkpoint

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
CKPT = os.path.join(os.path.dirname(__file__), "checkpoints", "model.pt")


def load_corpus() -> torch.Tensor:
    ids = []
    # plain text files
    for path in sorted(glob.glob(os.path.join(DATA_DIR, "corpus", "*.txt"))):
        with open(path, encoding="utf-8") as f:
            ids += tok.encode(f.read())
        ids.append(tok.END)
    # structured dialogue files: one {"user":..., "bot":...} per line
    for path in sorted(glob.glob(os.path.join(DATA_DIR, "corpus", "*.jsonl"))):
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                d = json.loads(line)
                ids += tok.encode_exchange(d["user"], d["bot"], d.get("mem"))
    if len(ids) < 1000:
        raise SystemExit("Not enough training data in data/corpus/. Add .txt or .jsonl files.")
    return torch.tensor(ids, dtype=torch.long)


def get_batch(data, block_size, batch_size, device):
    ix = torch.randint(len(data) - block_size - 1, (batch_size,))
    x = torch.stack([data[i:i + block_size] for i in ix])
    y = torch.stack([data[i + 1:i + 1 + block_size] for i in ix])
    return x.to(device), y.to(device)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--size", default="small", choices=["tiny", "small", "base"])
    ap.add_argument("--steps", type=int, default=3000)
    ap.add_argument("--batch", type=int, default=16)
    ap.add_argument("--lr", type=float, default=3e-4)
    ap.add_argument("--resume", action="store_true")
    args = ap.parse_args()

    device = "cuda" if torch.cuda.is_available() else "cpu"
    data = load_corpus()
    print(f"corpus: {len(data):,} tokens | device: {device}")

    if args.resume and os.path.exists(CKPT):
        model, extra = load_checkpoint(CKPT, device)
        print(f"resumed checkpoint ({model.num_params():,} params)")
    else:
        cfg = getattr(Config, args.size)()
        model = GPT(cfg).to(device)
        print(f"new {args.size} model: {model.num_params():,} params")

    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=0.1)
    model.train()
    t0 = time.time()
    for step in range(1, args.steps + 1):
        x, y = get_batch(data, model.cfg.block_size, args.batch, device)
        _, loss = model(x, y)
        opt.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        opt.step()
        if step % 100 == 0 or step == 1:
            tps = step * args.batch * model.cfg.block_size / (time.time() - t0)
            print(f"step {step:5d} | loss {loss.item():.4f} | {tps:,.0f} tok/s")
        if step % 500 == 0:
            save_checkpoint(model, CKPT, {"step": step})
    save_checkpoint(model, CKPT, {"step": args.steps})
    print(f"saved -> {CKPT}")


if __name__ == "__main__":
    main()
