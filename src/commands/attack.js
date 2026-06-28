const db = require('../database/db');
const { getAllMoves, getMoveCooldown, setMoveCooldown } = require('../systems/skillSystem');

let pvpSystem;
try {
    pvpSystem = require('../systems/pvpsystem');
} catch (e) {
    pvpSystem = { isPlayerInDuel: () => false, handlePvPSkill: () => ({ error: 'PvP system unavailable' }) };
}
const { isPlayerInDuel, handlePvPSkill } = pvpSystem;

module.exports = {
    name: 'attack',
    async execute(msg, args, { userId }) {
        if (!isPlayerInDuel(userId)) return msg.reply(
            `══〘 ⚔️ ATTACK 〙══╮\n┃◆ ❌ You are not in a duel.\n┃◆ Use !skill in dungeons.\n╰═══════════════════════╯`
        );
        if (args.length < 1) return msg.reply(
            `══〘 ⚔️ ATTACK 〙══╮\n┃◆ ❌ Use: !attack <move> [@target1] [@target2] ...\n╰═══════════════════════╯`
        );

        try {
            const [playerRows] = await db.execute("SELECT * FROM players WHERE id=?", [userId]);
            if (!playerRows.length) return msg.reply(
                `══〘 ⚔️ ATTACK 〙══╮\n┃◆ ❌ Not registered.\n╰═══════════════════════╯`
            );
            const player = playerRows[0];
            const [items] = await db.execute("SELECT * FROM inventory WHERE player_id=? AND equipped=1", [userId]);
            const moves = getAllMoves(player, items);

            // ── Move name: match longest prefix that isn't a @mention ────────────
            const nonMentionArgs = args.filter(a => !a.startsWith('@'));
            let move = null;
            for (let i = nonMentionArgs.length; i > 0; i--) {
                const testName = nonMentionArgs.slice(0, i).join(' ');
                const found = moves.find(m => m.name.toLowerCase() === testName.toLowerCase());
                if (found) { move = found; break; }
            }
            if (!move) return msg.reply(
                `══〘 ⚔️ ATTACK 〙══╮\n┃◆ ❌ Unknown move: "${nonMentionArgs.join(' ')}"\n┃◆ Use !moveset to see your moves.\n╰═══════════════════════╯`
            );

            const cd = getMoveCooldown(userId, move.name);
            if (cd > 0) return msg.reply(
                `══〘 ⚔️ ATTACK 〙══╮\n┃◆ ⏳ ${move.name} on cooldown (${Math.ceil(cd / 1000)}s)\n╰═══════════════════════╯`
            );

            // ── Target IDs from @mentions (WhatsApp mentionedIds) ─────────────
            const mentionedTargets = (msg.mentionedIds || [])
                .map(id => id.replace(/@c\.us$/i, '').split('@')[0])
                .filter(id => id && id !== String(userId));

            // null = auto single target; array = multi-target (even single explicit)
            const targetIds = mentionedTargets.length ? mentionedTargets : null;

            const result = await handlePvPSkill(userId, move, targetIds);
            if (result.error) return msg.reply(
                `══〘 ⚔️ ATTACK 〙══╮\n┃◆ ❌ ${result.error}\n╰═══════════════════════╯`
            );
            if (result.success) setMoveCooldown(userId, move.name, move.cooldown || 2, player.rank);
        } catch (err) {
            console.error('Attack command error:', err);
            msg.reply(`══〘 ⚔️ ATTACK 〙══╮\n┃◆ ❌ Attack failed.\n╰═══════════════════════╯`);
        }
    }
};