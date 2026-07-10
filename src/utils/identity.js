/**
 * SINGLE source of truth for WhatsApp identity handling.
 *
 * Every player can appear under several forms:
 *   '123@s.whatsapp.net', '123:5@s.whatsapp.net' (device), '123@lid',
 *   '123@c.us', '123alid' (malformed), bare '123', tester '123_test'
 * Previously normalizeId was copy-pasted in 3 files and had drifted
 * (pvpsystem's copy didn't strip the ':device' suffix) — a recurring
 * source of identity bugs. Change identity behavior ONLY here.
 */

// Canonical DB id: digits (or digits_test) — strips server suffix and device part.
function normalizeId(id) {
    if (!id) return '';
    return id.toString()
        .replace(/@s\.whatsapp\.net|@g\.us|@lid|@c\.us/g, '')
        .split(':')[0]
        .split('@')[0]
        .trim();
}

function normalizeIds(ids) {
    return Array.isArray(ids) ? ids.map(normalizeId) : [];
}

// Digits only — for comparing ids that may carry '+', spaces, or suffixes.
function digitsOnly(id) {
    return String(id || '').replace(/\D/g, '');
}

// Reply/route to the EXACT address WhatsApp gave us. Most users now arrive as
// opaque @lid ids (15-digit LIDs, NOT phone numbers). Converting a LID to
// '<lid>@s.whatsapp.net' addresses a phone number that doesn't exist, so the
// command runs but the reply is delivered to a ghost — the long-standing "DM
// commands work but you never see the reply" bug. Preserve @lid; only repair
// the malformed '<digits>alid' variant back to @lid.
function normalizeDMJid(jid) {
    if (!jid) return jid;
    const str = String(jid).trim();
    if (str.endsWith('@g.us') || str.endsWith('@s.whatsapp.net') || str.endsWith('@lid')) return str;
    const malformedLid = str.match(/^(\d+)alid$/);
    if (malformedLid) return `${malformedLid[1]}@lid`;
    return str;
}

// ── Owner recognition — only one person is Master, ever ──────────────────────
// OWNER_ID may hold MULTIPLE ids (comma/space separated): phone number AND
// WhatsApp LID, since groups identify the owner by an opaque LID.
const OWNER_IDS = (process.env.OWNER_ID || '').split(/[\s,]+/).map(digitsOnly).filter(Boolean);

function isOwner(userId) {
    const uid = digitsOnly(userId);
    return !!uid && OWNER_IDS.includes(uid);
}

function isAdminId(userId, admins = []) {
    const uid = digitsOnly(userId);
    return admins.some(a => digitsOnly(a) === uid);
}

module.exports = { normalizeId, normalizeIds, digitsOnly, normalizeDMJid, isOwner, isAdminId, OWNER_IDS };
