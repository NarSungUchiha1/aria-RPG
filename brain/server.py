"""
server.py — Eva's interface. A local web console for talking to her outside
WhatsApp. Same brain (checkpoints/model.pt), same memory, same growth loop —
just a face instead of a terminal.

    pip install flask torch numpy
    python server.py
    -> open http://localhost:7070

Endpoints (the UI uses these; you can also curl them):
    POST /api/chat      {message, asMaster}     -> {reply, confidence, name}
    POST /api/remember  {fact}                  -> {ok, count}
    POST /api/feedback  {value: good|bad}       -> {ok}
    POST /api/grow                              -> {ok, sessions}  (runs learn.py)
    GET  /api/stats                             -> params, memories, growth count
"""
import json
import os
import subprocess
import sys

import torch
from flask import Flask, request, jsonify, Response

import tokenizer as tok
from memory import MemoryStore
from model import load_checkpoint

BASE = os.path.dirname(__file__)
CKPT = os.path.join(BASE, "checkpoints", "model.pt")
EXP = os.path.join(BASE, "data", "experience.jsonl")

app = Flask(__name__)
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

_model = None
_mem = None
_extra = {}


def brain():
    global _model, _mem, _extra
    if _model is None:
        if not os.path.exists(CKPT):
            return None, None
        _model, _extra = load_checkpoint(CKPT, DEVICE)
        _mem = MemoryStore()
    return _model, _mem


def log_exchange(user, bot, feedback=None):
    with open(EXP, "a", encoding="utf-8") as f:
        f.write(json.dumps({"user": user, "bot": bot, "feedback": feedback}, ensure_ascii=False) + "\n")


def set_last_feedback(value):
    if not os.path.exists(EXP):
        return
    lines = [l for l in open(EXP, encoding="utf-8").read().splitlines() if l.strip()]
    if not lines:
        return
    d = json.loads(lines[-1])
    d["feedback"] = value
    lines[-1] = json.dumps(d, ensure_ascii=False)
    open(EXP, "w", encoding="utf-8").write("\n".join(lines) + "\n")


@app.route("/")
def index():
    return Response(INTERFACE_HTML, mimetype="text/html")


@app.route("/api/stats")
def stats():
    model, mem = brain()
    if not model:
        return jsonify({"ready": False})
    return jsonify({
        "ready": True,
        "params": model.num_params(),
        "memories": len(mem),
        "growth": _extra.get("learn_sessions", 0),
        "device": DEVICE,
    })


@app.route("/api/chat", methods=["POST"])
def chat():
    model, mem = brain()
    if not model:
        return jsonify({"reply": "I have no brain yet. Run persona.py, train.py, then restart me.",
                        "confidence": 0, "name": "AriA"})
    data = request.get_json(force=True)
    user = str(data.get("message", "")).strip()
    as_master = bool(data.get("asMaster", False))
    if not user:
        return jsonify({"reply": "", "confidence": 0, "name": "AriA" if not as_master else "Eva"})

    name = "Eva" if as_master else "AriA"
    identity = ("You are Eva when Master speaks. Master Vortex built you."
                if as_master else
                "You are AriA. Only Master may call you Eva.")
    memories = [identity] + mem.search(model, user, k=3, device=DEVICE)
    prompt = f"MASTER: {user}" if as_master else user

    ids = tok.encode_prompt(prompt, memories)
    x = torch.tensor([ids], dtype=torch.long, device=DEVICE)

    # generate with per-token logprob for a confidence read
    model.eval()
    out_ids, logp_sum = [], 0.0
    cur = x
    import torch.nn.functional as F
    with torch.no_grad():
        for _ in range(180):
            cond = cur[:, -model.cfg.block_size:]
            logits, _ = model(cond)
            logits = logits[:, -1, :] / 0.8
            v, _ = torch.topk(logits, 40)
            logits[logits < v[:, [-1]]] = float("-inf")
            probs = F.softmax(logits, dim=-1)
            nxt = torch.multinomial(probs, 1)
            tid = nxt.item()
            if tid == tok.END:
                break
            logp_sum += float(torch.log(probs[0, tid] + 1e-9))
            out_ids.append(tid)
            cur = torch.cat([cur, nxt], dim=1)

    reply = tok.decode([i for i in out_ids if i < 256]).strip()
    conf = float(torch.exp(torch.tensor(logp_sum / max(1, len(out_ids)))))
    log_exchange(user, reply)
    return jsonify({"reply": reply or "...", "confidence": round(conf, 3), "name": name})


@app.route("/api/remember", methods=["POST"])
def remember():
    model, mem = brain()
    if not model:
        return jsonify({"ok": False})
    fact = str(request.get_json(force=True).get("fact", "")).strip()
    if not fact:
        return jsonify({"ok": False})
    mem.add(model, fact, DEVICE)
    return jsonify({"ok": True, "count": len(mem)})


@app.route("/api/feedback", methods=["POST"])
def feedback():
    val = str(request.get_json(force=True).get("value", "")).strip()
    if val in ("good", "bad"):
        set_last_feedback(val)
        return jsonify({"ok": True})
    return jsonify({"ok": False})


@app.route("/api/grow", methods=["POST"])
def grow():
    """Run a growth cycle in the background. Reloads the brain when done."""
    global _model, _mem
    proc = subprocess.run([sys.executable, os.path.join(BASE, "learn.py"), "--epochs", "1"],
                          capture_output=True, text=True)
    _model = None  # force reload on next call
    m, _ = brain()
    return jsonify({"ok": proc.returncode == 0,
                    "sessions": _extra.get("learn_sessions", 0),
                    "log": proc.stdout[-300:] if proc.stdout else proc.stderr[-300:]})


# HTML is defined in interface.py to keep this file focused on logic
from interface import INTERFACE_HTML  # noqa: E402


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7070))
    print(f"\n  Eva's interface -> http://localhost:{port}\n")
    app.run(host="127.0.0.1", port=port, debug=False)
