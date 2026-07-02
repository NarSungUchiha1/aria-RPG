/**
 * localBrain.js — ARIA's own neural network, running natively in Node.
 *
 * This is the from-scratch GPT trained in brain/ (Python), exported to ONNX,
 * and executed here with onnxruntime-node. No API, no credits, no internet.
 *
 * Exports:
 *   isReady()                     -> bool (model.onnx present & loaded)
 *   generate(userMsg, memories)   -> { text, confidence }  confidence in [0,1]
 *
 * Confidence = exp(mean log-prob of the tokens she chose). High when the
 * input resembles what she's been trained on; low on unfamiliar territory.
 * aiSystems.js uses this to decide whether to trust her or fall back to Groq.
 */

const path = require('path');
const fs = require('fs');

let ort = null;
try { ort = require('onnxruntime-node'); }
catch { console.warn('[BRAIN] onnxruntime-node not installed — local brain disabled'); }

const MODEL_PATH = path.join(__dirname, '..', '..', 'brain', 'model.onnx');
const META_PATH = path.join(__dirname, '..', '..', 'brain', 'model_meta.json');

// ── Byte-level tokenizer (mirror of brain/tokenizer.py) ──────────────────────
const USER = 256, BOT = 257, END = 258, MEM = 259;

function encode(text) { return Array.from(Buffer.from(text, 'utf-8')); }

function decode(ids) {
    const bytes = ids.filter(i => i < 256);
    return Buffer.from(bytes).toString('utf-8');
}

function encodePrompt(userMsg, memories = []) {
    const ids = [];
    for (const m of memories) ids.push(MEM, ...encode(m), END);
    ids.push(USER, ...encode(userMsg), END, BOT);
    return ids;
}

// ── Session ──────────────────────────────────────────────────────────────────
let session = null;
let meta = { block_size: 256, vocab_size: 260, params: 0, growth_sessions: 0 };
let loading = null;

async function load() {
    if (session || !ort) return session;
    if (!fs.existsSync(MODEL_PATH)) return null;
    if (!loading) {
        loading = (async () => {
            try { meta = JSON.parse(fs.readFileSync(META_PATH, 'utf-8')); } catch {}
            session = await ort.InferenceSession.create(MODEL_PATH, {
                executionProviders: ['cpu'],
                intraOpNumThreads: 2
            });
            console.log(`[BRAIN] loaded ${meta.params.toLocaleString()} params | growth sessions: ${meta.growth_sessions}`);
            return session;
        })().catch(e => { console.error('[BRAIN] load failed:', e.message); loading = null; return null; });
    }
    return loading;
}

function isReady() {
    return !!ort && fs.existsSync(MODEL_PATH);
}

async function forward(ids) {
    const t = new ort.Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [1, ids.length]);
    const out = await session.run({ idx: t });
    const logits = out.logits;                     // (1, T, V)
    const V = logits.dims[2];
    const last = logits.data.slice((ids.length - 1) * V, ids.length * V);
    return Float32Array.from(last);
}

function sample(logits, temperature, topK) {
    const V = logits.length;
    const scaled = new Float32Array(V);
    for (let i = 0; i < V; i++) scaled[i] = logits[i] / temperature;

    // top-k mask
    const idxs = Array.from({ length: V }, (_, i) => i).sort((a, b) => scaled[b] - scaled[a]);
    const keep = new Set(idxs.slice(0, topK));

    let max = -Infinity;
    for (const i of keep) if (scaled[i] > max) max = scaled[i];
    let z = 0;
    const probs = new Float32Array(V);
    for (const i of keep) { probs[i] = Math.exp(scaled[i] - max); z += probs[i]; }

    let r = Math.random() * z, chosen = idxs[0];
    for (const i of idxs.slice(0, topK)) { r -= probs[i]; if (r <= 0) { chosen = i; break; } }
    return { token: chosen, logProb: Math.log(probs[chosen] / z) };
}

/**
 * Generate a reply. Returns { text, confidence } or null if brain unavailable.
 */
async function generate(userMsg, memories = [], opts = {}) {
    const { maxNewTokens = 120, temperature = 0.8, topK = 40 } = opts;
    const s = await load();
    if (!s) return null;

    let ids = encodePrompt(String(userMsg).slice(0, 500), memories);
    // keep room to generate inside the context window
    if (ids.length > meta.block_size - 8) ids = ids.slice(-(meta.block_size - 8));

    const outIds = [];
    let logProbSum = 0;
    for (let step = 0; step < maxNewTokens; step++) {
        const ctx = ids.slice(-meta.block_size);
        const logits = await forward(ctx);
        const { token, logProb } = sample(logits, temperature, topK);
        if (token === END) break;
        ids.push(token);
        outIds.push(token);
        logProbSum += logProb;
    }

    if (!outIds.length) return { text: '', confidence: 0 };
    const confidence = Math.exp(logProbSum / outIds.length);   // geometric-mean prob
    return { text: decode(outIds).trim(), confidence };
}

module.exports = { isReady, generate, encode, decode, meta: () => meta };
