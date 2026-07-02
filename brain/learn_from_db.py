"""
learn_from_db.py — Pull ARIA's real conversations from Aiven MySQL into
her training data. The players ARE her teachers.

Reads DB creds from the repo's .env (DB_HOST, DB_USER, DB_PASS, DB_NAME,
DB_PORT — same vars db.js uses). Pairs each player message with ARIA's
reply from aria_conversations and appends new pairs to data/experience.jsonl.

The weekly growth ritual (run on your PC, not on Render):
    pip install pymysql torch numpy onnx onnxscript
    python learn_from_db.py      # pull fresh conversations
    python learn.py              # fine-tune on them (+ replay)
    python export_onnx.py        # re-export her brain
    git add -A && git commit -m "aria growth cycle" && git push
Render redeploys and she wakes up smarter. No credits were harmed.
"""
import json
import os

import pymysql

BASE = os.path.dirname(__file__)
EXP = os.path.join(BASE, "data", "experience.jsonl")
STATE = os.path.join(BASE, "data", "db_sync_state.json")
ENV = os.path.join(BASE, "..", ".env")


def load_env():
    env = {}
    if os.path.exists(ENV):
        with open(ENV, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip().strip('"').strip("'")
    return {**env, **os.environ}


def main():
    env = load_env()
    conn = pymysql.connect(
        host=env["DB_HOST"], user=env["DB_USER"], password=env["DB_PASS"],
        database=env["DB_NAME"], port=int(env.get("DB_PORT", 16338)),
        ssl={"ssl": True},   # Aiven requires TLS
        charset="utf8mb4",
    )
    last_id = 0
    if os.path.exists(STATE):
        last_id = json.load(open(STATE)).get("last_id", 0)

    with conn.cursor() as cur:
        cur.execute(
            """SELECT id, player_id, role, content FROM aria_conversations
               WHERE id > %s ORDER BY player_id, id""",
            (last_id,),
        )
        rows = cur.fetchall()
    conn.close()

    # Pair consecutive user -> assistant messages per player
    pairs, max_id = [], last_id
    pending = {}  # player_id -> last user message
    for rid, pid, role, content in rows:
        max_id = max(max_id, rid)
        content = (content or "").strip()
        if not content or len(content) > 1500:
            continue
        if role == "user":
            pending[pid] = content
        elif role == "assistant" and pid in pending:
            pairs.append({"user": pending.pop(pid), "bot": content})

    with open(EXP, "a", encoding="utf-8") as f:
        for p in pairs:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")
    json.dump({"last_id": max_id}, open(STATE, "w"))
    print(f"pulled {len(pairs)} new exchanges (through row id {max_id}) -> {EXP}")
    print("next: python learn.py && python export_onnx.py && git push")


if __name__ == "__main__":
    main()
