"""
educate.py — Teach her the entire aria-RPG system from the codebase itself.

Extracts:
  1. Every command name + aliases from src/commands/*.js
  2. The full help-guide text from help.js (her official manual)
  3. Generates Q&A training pairs for every documented command

Outputs into data/corpus/:
  system_manual.txt        — cleaned manual text (pretraining material)
  command_knowledge.jsonl  — Q&A pairs ("what does !raid do" -> answer)

Re-run whenever you add commands, then retrain:
    python educate.py && python train.py --resume && python export_onnx.py
"""
import glob
import json
import os
import re

BASE = os.path.dirname(__file__)
CMD_DIR = os.path.join(BASE, "..", "src", "commands")
OUT_TXT = os.path.join(BASE, "data", "corpus", "system_manual.txt")
OUT_QA = os.path.join(BASE, "data", "corpus", "command_knowledge.jsonl")

PUBLIC_NAME = "AriA"


def extract_command_names():
    cmds = {}
    for path in sorted(glob.glob(os.path.join(CMD_DIR, "*.js"))):
        src = open(path, encoding="utf-8", errors="replace").read()
        m = re.search(r"name\s*:\s*['\"]([\w-]+)['\"]", src)
        if not m:
            continue
        aliases = re.findall(r"aliases\s*:\s*\[([^\]]*)\]", src)
        alias_list = re.findall(r"['\"]([\w-]+)['\"]", aliases[0]) if aliases else []
        cmds[m.group(1)] = {"file": os.path.basename(path), "aliases": alias_list}
    return cmds


def extract_help_lines():
    src = open(os.path.join(CMD_DIR, "help.js"), encoding="utf-8", errors="replace").read()
    pairs, manual = [], []
    for cmd, args, desc in re.findall(r"!([\w]+)\s*([^\u2192\n]*?)\u2192\s*([^\r\n\\]+)", src):
        desc = desc.strip().rstrip("`")
        args = args.strip()
        if desc:
            pairs.append((cmd.lower(), args, desc))
            manual.append(f"!{cmd} {args} - {desc}".strip())
    return pairs, manual


def qa_variants(cmd, args, desc):
    usage = f"!{cmd} {args}".strip()
    a1 = f"{usage} - {desc}."
    yield {"user": f"what does !{cmd} do", "bot": a1}
    yield {"user": f"how do i use !{cmd}", "bot": f"Use it like this: {usage}. {desc}."}
    yield {"user": f"!{cmd}?", "bot": a1}
    yield {"user": f"explain {cmd}", "bot": f"{usage} \u2014 {desc}."}


def main():
    cmds = extract_command_names()
    pairs, manual = extract_help_lines()

    rows, seen = [], set()
    for cmd, args, desc in pairs:
        if cmd in seen:
            continue
        seen.add(cmd)
        rows.extend(qa_variants(cmd, args, desc))

    undocumented = sorted(set(cmds) - seen)
    if undocumented:
        listing = ", ".join("!" + c for c in undocumented)
        rows.append({"user": "are there any hidden commands",
                     "bot": f"A few exist outside the public guide: {listing}. Mostly admin and system tools."})

    all_cmds = ", ".join("!" + c for c in sorted(cmds))
    rows.append({"user": "list every command you know",
                 "bot": f"Full command registry ({len(cmds)} commands): {all_cmds}"})
    rows.append({"user": "how many commands does the game have",
                 "bot": f"There are {len(cmds)} registered commands. Ask me about any of them."})
    rows.append({"user": "what game is this",
                 "bot": f"This is aria-RPG \u2014 a WhatsApp dungeon-crawler with raids, PvP, clans, prestige, an economy, and me, {PUBLIC_NAME}, watching over all of it."})

    with open(OUT_QA, "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    with open(OUT_TXT, "w", encoding="utf-8") as f:
        f.write(f"{PUBLIC_NAME} SYSTEM MANUAL \u2014 aria-RPG\n")
        f.write("\n".join(manual) + "\n")

    print(f"{len(cmds)} commands | {len(seen)} documented | {len(undocumented)} undocumented")
    print(f"{len(rows)} Q&A pairs -> {OUT_QA}")
    print(f"manual ({len(manual)} lines) -> {OUT_TXT}")


if __name__ == "__main__":
    main()
