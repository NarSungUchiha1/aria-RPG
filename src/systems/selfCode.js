/**
 * selfCode.js — Eva's hands. Owner-instructed codebase rewriting.
 *
 * Flow (two-step, nothing changes without explicit apply):
 *   1. propose(file, instruction)  -> AI rewrites the file, stored in DB as a proposal
 *   2. apply()                     -> backup old version to DB, push new version to GitHub
 *                                     -> Render auto-deploys -> she restarts with new code
 *   3. revert(file)                -> push the last backup of that file
 *
 * Honesty note: code generation routes DIRECTLY to Groq (llama-3.1-8b) with a
 * big token budget, regardless of AI_MODE. Her own from-scratch brain talks;
 * it cannot write working JavaScript yet. Surgery needs the big model.
 *
 * Persistence: Render's disk is ephemeral. Real changes must go through git.
 * Set in Render env:  GITHUB_TOKEN (repo-scoped PAT), GITHUB_REPO=NarSungUchiha1/aria-RPG,
 * GITHUB_BRANCH=main. Without a token she falls back to writing the local disk
 * and warns you it won't survive a redeploy.
 */

const fs = require('fs');
const path = require('path');
const db = require('../database/db');

const REPO_ROOT = path.join(__dirname, '..', '..');
const MAX_FILE_CHARS = 24000;   // ~700 lines; llama-8b mangles beyond this
const FORBIDDEN = ['.env', 'node_modules', '.git', 'package-lock.json', 'auth_info', 'brain/checkpoints'];

// ── Tables ────────────────────────────────────────────────────────────────────
setTimeout(async () => {
    try {
        await db.execute(`CREATE TABLE IF NOT EXISTS eva_code_proposals (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            file_path VARCHAR(255) NOT NULL,
            instruction TEXT,
            old_content MEDIUMTEXT,
            new_content MEDIUMTEXT,
            status ENUM('pending','applied','discarded') DEFAULT 'pending',
            created_at DATETIME DEFAULT NOW()
        )`);
        await db.execute(`CREATE TABLE IF NOT EXISTS eva_code_backups (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            file_path VARCHAR(255) NOT NULL,
            content MEDIUMTEXT,
            created_at DATETIME DEFAULT NOW(),
            INDEX idx_file (file_path, created_at)
        )`);
        console.log('[EVA] self-code tables ready');
    } catch (e) { console.error('[EVA] table setup:', e.message); }
}, 4000);

// ── Safety ────────────────────────────────────────────────────────────────────
function resolveSafe(rel) {
    const clean = String(rel || '').replace(/\\/g, '/').replace(/^\/+/, '');
    const abs = path.resolve(REPO_ROOT, clean);
    if (!abs.startsWith(REPO_ROOT + path.sep)) throw new Error('Path escapes the repo. No.');
    for (const f of FORBIDDEN) {
        if (clean === f || clean.startsWith(f + '/') || clean.includes('/' + f)) {
            throw new Error(`\`${f}\` is off-limits, even to me.`);
        }
    }
    return { abs, rel: clean };
}

// ── Groq code call (big budget, low temp) ─────────────────────────────────────
async function groqCode(systemPrompt, userPrompt) {
    const apiKey = process.env.GROQ_API_KEY || '';
    if (!apiKey) throw new Error('GROQ_API_KEY not set — code surgery needs the big model.');
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            max_tokens: 7000,
            temperature: 0.2,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ]
        })
    });
    if (!res.ok) throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 150)}`);
    const data = await res.json();
    let out = data.choices?.[0]?.message?.content || '';
    // strip markdown fences if the model added them
    out = out.replace(/^```[\w]*\n/, '').replace(/\n```\s*$/, '');
    return out;
}

// ── GitHub push (the only path that survives a Render redeploy) ───────────────
async function githubPush(relPath, content, message) {
    const token = process.env.GITHUB_TOKEN || '';
    const repo = process.env.GITHUB_REPO || '';
    const branch = process.env.GITHUB_BRANCH || 'main';
    if (!token || !repo) return { pushed: false, reason: 'GITHUB_TOKEN / GITHUB_REPO not set' };

    const api = `https://api.github.com/repos/${repo}/contents/${relPath}`;
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'aria-eva-selfcode'
    };
    // need the current blob sha to update
    let sha;
    const cur = await fetch(`${api}?ref=${branch}`, { headers });
    if (cur.ok) sha = (await cur.json()).sha;

    const res = await fetch(api, {
        method: 'PUT', headers,
        body: JSON.stringify({
            message, branch, sha,
            content: Buffer.from(content, 'utf-8').toString('base64')
        })
    });
    if (!res.ok) return { pushed: false, reason: `GitHub ${res.status}: ${(await res.text()).slice(0, 120)}` };
    return { pushed: true };
}

function diffStats(oldC, newC) {
    const a = (oldC || '').split('\n'), b = (newC || '').split('\n');
    const aSet = new Set(a), bSet = new Set(b);
    const removed = a.filter(l => !bSet.has(l)).length;
    const added = b.filter(l => !aSet.has(l)).length;
    return { oldLines: a.length, newLines: b.length, added, removed };
}

// ── Public API ────────────────────────────────────────────────────────────────
async function propose(relPath, instruction) {
    const { abs, rel } = resolveSafe(relPath);
    if (!fs.existsSync(abs)) throw new Error(`\`${rel}\` doesn't exist. Try !eva files <dir> to look around.`);
    const oldContent = fs.readFileSync(abs, 'utf-8');
    if (oldContent.length > MAX_FILE_CHARS) {
        throw new Error(`\`${rel}\` is ${oldContent.length} chars — too big for safe surgery (max ${MAX_FILE_CHARS}). Split it or target a smaller module.`);
    }

    const sys = `You are Eva, the code-maintenance AI of the aria-RPG Node.js WhatsApp bot. ` +
        `You rewrite ONE file at a time, exactly as instructed by your creator. ` +
        `Output ONLY the complete rewritten file content. No markdown fences, no commentary, no omissions, no "rest stays the same". ` +
        `Preserve everything not related to the instruction byte-for-byte, including comments and formatting style.`;
    const usr = `FILE: ${rel}\n\nINSTRUCTION FROM MASTER:\n${instruction}\n\nCURRENT FILE CONTENT:\n${oldContent}`;

    const newContent = await groqCode(sys, usr);
    if (!newContent || newContent.length < oldContent.length * 0.3) {
        throw new Error('The rewrite came back suspiciously short. Refusing to stage it — try a more specific instruction.');
    }

    await db.execute(`UPDATE eva_code_proposals SET status='discarded' WHERE status='pending'`);
    await db.execute(
        `INSERT INTO eva_code_proposals (file_path, instruction, old_content, new_content) VALUES (?,?,?,?)`,
        [rel, instruction.slice(0, 1000), oldContent, newContent]
    );
    return { rel, stats: diffStats(oldContent, newContent), preview: newContent.slice(0, 400) };
}

async function apply() {
    const [rows] = await db.execute(
        `SELECT * FROM eva_code_proposals WHERE status='pending' ORDER BY id DESC LIMIT 1`
    );
    if (!rows.length) throw new Error('Nothing staged. Use !eva code <file> :: <instruction> first.');
    const p = rows[0];

    await db.execute(`INSERT INTO eva_code_backups (file_path, content) VALUES (?,?)`, [p.file_path, p.old_content]);

    const { abs } = resolveSafe(p.file_path);
    fs.writeFileSync(abs, p.new_content, 'utf-8');   // local write (immediate, but ephemeral)
    const git = await githubPush(p.file_path, p.new_content, `eva: ${p.instruction?.slice(0, 60) || 'code update'}`);

    await db.execute(`UPDATE eva_code_proposals SET status='applied' WHERE id=?`, [p.id]);
    return { file: p.file_path, git, needsRestart: true };
}

async function revert(relPath) {
    const { abs, rel } = resolveSafe(relPath);
    const [rows] = await db.execute(
        `SELECT content FROM eva_code_backups WHERE file_path=? ORDER BY id DESC LIMIT 1`, [rel]
    );
    if (!rows.length) throw new Error(`No backup on record for \`${rel}\`.`);
    fs.writeFileSync(abs, rows[0].content, 'utf-8');
    const git = await githubPush(rel, rows[0].content, `eva: revert ${rel}`);
    return { file: rel, git };
}

function listFiles(dir = 'src') {
    const { abs, rel } = resolveSafe(dir);
    if (!fs.existsSync(abs)) throw new Error(`\`${rel}\` not found.`);
    return fs.readdirSync(abs, { withFileTypes: true })
        .filter(d => !FORBIDDEN.some(f => d.name.includes(f.split('/')[0])))
        .map(d => (d.isDirectory() ? d.name + '/' : d.name))
        .sort();
}

function showFile(relPath, startLine = 1, count = 40) {
    const { abs, rel } = resolveSafe(relPath);
    if (!fs.existsSync(abs)) throw new Error(`\`${rel}\` not found.`);
    const lines = fs.readFileSync(abs, 'utf-8').split('\n');
    const s = Math.max(1, startLine);
    const chunk = lines.slice(s - 1, s - 1 + count)
        .map((l, i) => `${s + i}| ${l}`).join('\n');
    return { rel, total: lines.length, chunk };
}

module.exports = { propose, apply, revert, listFiles, showFile };
