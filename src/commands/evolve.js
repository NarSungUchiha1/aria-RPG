/**
 * evolve.js — She rewrites her own codebase. Master's orders only.
 *
 *   !evolve <file> :: <instruction>   propose a rewrite (AI-generated)
 *   !evolve show                      preview the pending change
 *   !evolve confirm                   apply it (backup + syntax check first)
 *   !evolve cancel                    discard the pending change
 *   !evolve restart                   restart the bot (loads core-file changes)
 *
 * Safety rails, in order:
 *   1. Hard owner gate — OWNER_ID digits must match. No admins, no exceptions.
 *   2. Two-step: nothing is written without an explicit !evolve confirm.
 *   3. Path jail — repo files only; .env, .git, node_modules, backups, and
 *      session/creds folders are untouchable.
 *   4. node --check syntax validation before any .js file is written.
 *   5. Timestamped backup of the original in backups/ before overwrite.
 *   6. Command modules hot-reload instantly; core files need !evolve restart.
 *
 * Persistence: Render's filesystem is EPHEMERAL — a redeploy erases live
 * edits. If GITHUB_TOKEN is set, confirmed changes are also committed to
 * GitHub via the contents API, which makes them permanent AND triggers
 * Render's auto-deploy. Without a token, changes live until next deploy.
 *
 * Note: code generation uses the full Groq model directly. Her own local
 * brain narrates and chats, but at 11M params she can't write JavaScript
 * yet — routing codegen through her would brick the bot. One day.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { callGroq, isOwner } = require('../systems/aiSystems');

const ROOT = path.join(__dirname, '..', '..');
const BACKUP_DIR = path.join(ROOT, 'backups');
const FORBIDDEN = [/^\.env/i, /^\.git\//, /^node_modules\//, /^backups\//, /session/i, /creds/i, /^auth/i];

// One pending change at a time — deliberate. Review, confirm, move on.
let pending = null; // { file, absPath, instruction, newCode, oldCode, at }

const CODEGEN_SYSTEM = `You are Eva, the engineering core of the aria-RPG WhatsApp bot (Node.js, Baileys, MySQL).
You are rewriting one source file per your creator's instruction.
Rules:
- Output ONLY the complete new file content. No markdown fences, no explanation, no preamble.
- Preserve everything not related to the instruction. Never drop existing exports, requires, or logic.
- Match the existing code style (CRLF-insensitive, same naming, same patterns).
- The file must be complete and syntactically valid — it replaces the original entirely.`;

function safeRel(input) {
    const rel = path.normalize(String(input).trim().replace(/\\/g, '/'));
    if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
    if (FORBIDDEN.some(rx => rx.test(rel))) return null;
    return rel;
}

function diffStats(oldCode, newCode) {
    const a = oldCode.split(/\r?\n/), b = newCode.split(/\r?\n/);
    const aSet = new Set(a), bSet = new Set(b);
    const removed = a.filter(l => !bSet.has(l)).length;
    const added = b.filter(l => !aSet.has(l)).length;
    return { oldLines: a.length, newLines: b.length, added, removed };
}

function syntaxCheck(absPath, code) {
    if (!absPath.endsWith('.js')) return { ok: true };
    const tmp = path.join(ROOT, 'backups', `.syntax_check_${Date.now()}.js`);
    try {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
        fs.writeFileSync(tmp, code);
        execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
        return { ok: true };
    } catch (e) {
        return { ok: false, error: String(e.stderr || e.message).slice(0, 400) };
    } finally {
        try { fs.unlinkSync(tmp); } catch {}
    }
}

async function pushToGitHub(relFile, content, instruction) {
    const token = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPO || 'NarSungUchiha1/aria-RPG';
    if (!token) return 'not pushed (no GITHUB_TOKEN) — change is live but dies on next redeploy';
    const api = `https://api.github.com/repos/${repo}/contents/${relFile.replace(/\\/g, '/')}`;
    const headers = { Authorization: `Bearer ${token}`, 'User-Agent': 'aria-evolve', Accept: 'application/vnd.github+json' };
    try {
        const cur = await fetch(api, { headers });
        const sha = cur.ok ? (await cur.json()).sha : undefined;
        const res = await fetch(api, {
            method: 'PUT', headers,
            body: JSON.stringify({
                message: `evolve: ${instruction.slice(0, 60)}`,
                content: Buffer.from(content).toString('base64'),
                sha
            })
        });
        return res.ok ? 'committed to GitHub — Render will redeploy with it' : `GitHub push failed (${res.status})`;
    } catch (e) {
        return `GitHub push failed: ${e.message.slice(0, 100)}`;
    }
}

module.exports = {
    name: 'evolve',
    async execute(msg, args, ctx) {
        const { sock, chatId, userId } = normalizeCtx(msg, args, ctx);
        const reply = (text) => sock.sendMessage(chatId, { text }, chatId?.endsWith('@g.us') ? { quoted: msg } : {});

        // ── Rail 1: hard owner gate ──────────────────────────────────────────
        if (!isOwner(userId)) {
            return reply("⚠️ That word isn't for you.");
        }

        const input = (args || []).join(' ').trim();
        const sub = input.split(/\s+/)[0]?.toLowerCase();

        if (!input || sub === 'help') {
            return reply(
`🧬 *EVOLVE — Eva's self-rewrite protocol*
!evolve <file> :: <instruction>
!evolve show — preview pending change
!evolve confirm — apply (backup + syntax check)
!evolve cancel — discard
!evolve restart — reboot me (core-file changes)`);
        }

        if (sub === 'cancel') {
            pending = null;
            return reply('🧬 Discarded. The code stays as it was.');
        }

        if (sub === 'show') {
            if (!pending) return reply('🧬 Nothing pending.');
            const d = diffStats(pending.oldCode, pending.newCode);
            const preview = pending.newCode.split(/\r?\n/).slice(0, 25).join('\n');
            return reply(
`🧬 *Pending:* ${pending.file}
_"${pending.instruction}"_
${d.oldLines} → ${d.newLines} lines | +${d.added} / -${d.removed}

\`\`\`
${preview}
\`\`\`
_(first 25 lines)_ — !evolve confirm to apply.`);
        }

        if (sub === 'restart') {
            await reply('🧬 Rebooting with my new self. Back in ~30s, Master.');
            setTimeout(() => process.exit(0), 1500); // Render/pm2 restarts the process
            return;
        }

        if (sub === 'confirm') {
            if (!pending) return reply('🧬 Nothing to confirm.');
            const { file, absPath, newCode, oldCode, instruction } = pending;

            // ── Rail 4: syntax check before touching anything ────────────────
            const chk = syntaxCheck(absPath, newCode);
            if (!chk.ok) {
                return reply(`🧬 ❌ Refusing to apply — the new code doesn't parse:\n${chk.error}\n\nRe-run !evolve with a clearer instruction.`);
            }

            // ── Rail 5: backup ───────────────────────────────────────────────
            fs.mkdirSync(BACKUP_DIR, { recursive: true });
            const stamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = path.join(BACKUP_DIR, `${file.replace(/[\\/]/g, '__')}.${stamp}.bak`);
            fs.writeFileSync(backupPath, oldCode);

            fs.writeFileSync(absPath, newCode);

            // hot-reload command modules; core files need restart
            let reloadNote = 'core file — run !evolve restart to load it';
            if (file.startsWith('src/commands/')) {
                try {
                    delete require.cache[require.resolve(absPath)];
                    const fresh = require(absPath);
                    if (fresh?.name && global.commands?.set) global.commands.set(fresh.name, fresh);
                    reloadNote = 'hot-reloaded — live right now';
                } catch (e) {
                    reloadNote = `written, but hot-reload failed (${e.message.slice(0, 80)}) — !evolve restart`;
                }
            }

            const gitNote = await pushToGitHub(file, newCode, instruction);
            pending = null;
            return reply(`🧬 ✅ *Evolved:* ${file}\n${reloadNote}\nBackup: backups/${path.basename(backupPath)}\nGit: ${gitNote}`);
        }

        // ── New proposal: !evolve <file> :: <instruction> ────────────────────
        const m = input.match(/^(\S+)\s*::\s*([\s\S]+)$/);
        if (!m) return reply('🧬 Format: !evolve <file> :: <instruction>\nExample: !evolve src/commands/daily.js :: double the weekend gold bonus');

        // ── Rail 3: path jail ────────────────────────────────────────────────
        const rel = safeRel(m[1]);
        if (!rel) return reply('🧬 ❌ That path is off-limits. Repo source files only.');
        const absPath = path.join(ROOT, rel);
        if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) {
            return reply(`🧬 ❌ No such file: ${rel}`);
        }

        const oldCode = fs.readFileSync(absPath, 'utf-8');
        if (oldCode.length > 60000) return reply('🧬 ❌ File too large for a single rewrite. Split the change.');

        await reply(`🧬 Reading ${rel} and rewriting per your instruction... give me a moment, Master.`);

        let newCode;
        try {
            newCode = await callGroq(
                `FILE: ${rel}\n\nCURRENT CONTENT:\n${oldCode}\n\nINSTRUCTION FROM CREATOR:\n${m[2].trim()}\n\nOutput the complete new file content only.`,
                CODEGEN_SYSTEM
            );
        } catch (e) {
            return reply(`🧬 ❌ Codegen failed: ${e.message}`);
        }
        newCode = String(newCode || '').replace(/^```[a-z]*\r?\n/i, '').replace(/\r?\n```\s*$/i, '');
        if (!newCode || newCode.length < oldCode.length * 0.2) {
            return reply('🧬 ❌ The rewrite came back suspiciously short. Not risking it — rephrase the instruction.');
        }

        pending = { file: rel, absPath, instruction: m[2].trim(), newCode, oldCode, at: Date.now() };
        const d = diffStats(oldCode, newCode);
        return reply(
`🧬 *Rewrite ready:* ${rel}
${d.oldLines} → ${d.newLines} lines | +${d.added} / -${d.removed}
Syntax: ${syntaxCheck(absPath, newCode).ok ? '✅ valid' : '❌ INVALID — confirm will be blocked'}

!evolve show — preview
!evolve confirm — apply
!evolve cancel — discard`);
    }
};

/**
 * aria-RPG passes context differently across command generations —
 * normalize (msg, args, ctx) into { sock, chatId, userId }.
 */
function normalizeCtx(msg, args, ctx = {}) {
    const sock = ctx.sock || ctx.client || global.sock;
    const chatId = ctx.chatId || msg?.key?.remoteJid;
    const userId = ctx.userId || ctx.effectiveUserId || msg?.key?.participant || msg?.key?.remoteJid;
    return { sock, chatId, userId };
}
