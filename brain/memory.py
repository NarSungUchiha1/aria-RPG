"""
memory.py — Long-term memory, from scratch.

Facts are embedded using the model's OWN hidden states (mean-pooled final
layer), so the memory system needs no external embedding model. Retrieval
is cosine similarity. Memories persist in data/memory.json + memory.npy.

As the model retrains and improves, you can re-embed all memories with
`MemoryStore.reindex(model)` so retrieval improves with her.
"""
import json
import os

import numpy as np
import torch

import tokenizer as tok

BASE = os.path.dirname(__file__)
META = os.path.join(BASE, "data", "memory.json")
VECS = os.path.join(BASE, "data", "memory.npy")


@torch.no_grad()
def embed(model, text: str, device="cpu") -> np.ndarray:
    ids = tok.encode(text)[-model.cfg.block_size:]
    x = torch.tensor([ids], dtype=torch.long, device=device)
    h = model(x, return_hidden=True)          # (1, T, C)
    v = h.mean(dim=1).squeeze(0).cpu().numpy()
    n = np.linalg.norm(v)
    return v / n if n > 0 else v


class MemoryStore:
    def __init__(self):
        self.texts: list[str] = []
        self.vecs: np.ndarray | None = None
        self._load()

    def _load(self):
        if os.path.exists(META):
            with open(META, encoding="utf-8") as f:
                self.texts = json.load(f)
        if os.path.exists(VECS) and self.texts:
            self.vecs = np.load(VECS)

    def _save(self):
        with open(META, "w", encoding="utf-8") as f:
            json.dump(self.texts, f, ensure_ascii=False, indent=1)
        if self.vecs is not None:
            np.save(VECS, self.vecs)

    def add(self, model, text: str, device="cpu"):
        v = embed(model, text, device)[None, :]
        self.vecs = v if self.vecs is None else np.vstack([self.vecs, v])
        self.texts.append(text)
        self._save()

    def search(self, model, query: str, k: int = 3, min_sim: float = 0.15, device="cpu"):
        if self.vecs is None or not self.texts:
            return []
        q = embed(model, query, device)
        sims = self.vecs @ q
        idx = np.argsort(-sims)[:k]
        return [self.texts[i] for i in idx if sims[i] >= min_sim]

    def reindex(self, model, device="cpu"):
        """Re-embed everything after the model has grown."""
        if not self.texts:
            return
        self.vecs = np.vstack([embed(model, t, device)[None, :] for t in self.texts])
        self._save()

    def __len__(self):
        return len(self.texts)
