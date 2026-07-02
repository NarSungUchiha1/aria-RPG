"""
tokenizer.py — Byte-level tokenizer, built from scratch.
Vocab = 256 raw bytes + 4 special tokens. Handles any language,
emoji, or code with zero training and zero unknown-token problems.
"""

USER = 256   # <|user|>
BOT = 257    # <|bot|>
END = 258    # <|end|>   end of a message
MEM = 259    # <|mem|>   retrieved memory / persona context

VOCAB_SIZE = 260
SPECIAL = {USER: "<|user|>", BOT: "<|bot|>", END: "<|end|>", MEM: "<|mem|>"}


def encode(text: str) -> list[int]:
    return list(text.encode("utf-8"))


def decode(ids: list[int]) -> str:
    out, buf = [], []
    for i in ids:
        if i < 256:
            buf.append(i)
        else:
            if buf:
                out.append(bytes(buf).decode("utf-8", errors="replace"))
                buf = []
            out.append(SPECIAL.get(i, ""))
    if buf:
        out.append(bytes(buf).decode("utf-8", errors="replace"))
    return "".join(out)


def encode_exchange(user_msg: str, bot_msg: str, mems: list[str] | None = None) -> list[int]:
    """One training example: [<|mem|>ctx<|end|>]* <|user|> ... <|end|> <|bot|> ... <|end|>
    Training with mems teaches conditional behavior (e.g. identity depends on speaker)."""
    ids = []
    for m in mems or []:
        ids += [MEM] + encode(m) + [END]
    return ids + [USER] + encode(user_msg) + [END] + [BOT] + encode(bot_msg) + [END]


def encode_prompt(user_msg: str, memories: list[str] | None = None) -> list[int]:
    """Inference-time prompt. Memories are injected before the user turn."""
    ids = []
    for m in memories or []:
        ids += [MEM] + encode(m) + [END]
    ids += [USER] + encode(user_msg) + [END] + [BOT]
    return ids
