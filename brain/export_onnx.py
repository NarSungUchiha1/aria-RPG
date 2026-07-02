"""
export_onnx.py — Export the trained model to ONNX so Node.js can run her
natively via onnxruntime-node. No Python needed in production, no API credits.

    python export_onnx.py                  # -> brain/model.onnx
"""
import os

import torch

from model import load_checkpoint

BASE = os.path.dirname(__file__)
CKPT = os.path.join(BASE, "checkpoints", "model.pt")
OUT = os.path.join(BASE, "model.onnx")


class Wrapper(torch.nn.Module):
    """Logits-only forward for a clean ONNX graph."""
    def __init__(self, gpt):
        super().__init__()
        self.gpt = gpt

    def forward(self, idx):
        logits, _ = self.gpt(idx)
        return logits


def main():
    model, extra = load_checkpoint(CKPT, "cpu")
    model.eval()
    for m in model.modules():          # hard-disable dropout for a clean graph
        if isinstance(m, torch.nn.Dropout):
            m.p = 0.0
    wrapped = Wrapper(model)
    dummy = torch.randint(0, model.cfg.vocab_size, (1, 32), dtype=torch.long)
    torch.onnx.export(
        wrapped, dummy, OUT,
        input_names=["idx"], output_names=["logits"],
        dynamic_axes={"idx": {1: "seq"}, "logits": {1: "seq"}},
        opset_version=18,
    )
    meta = {
        "vocab_size": model.cfg.vocab_size,
        "block_size": model.cfg.block_size,
        "params": model.num_params(),
        "growth_sessions": extra.get("learn_sessions", 0),
    }
    import json
    with open(os.path.join(BASE, "model_meta.json"), "w") as f:
        json.dump(meta, f, indent=1)
    print(f"exported {model.num_params():,} params -> {OUT}")
    print(f"meta -> model_meta.json {meta}")


if __name__ == "__main__":
    main()
