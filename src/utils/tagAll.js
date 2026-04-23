const { RAID_GROUP } = require('../engine/dungeon');

/**
 * Gets all participant JIDs from the raid group for @mentions.
 * Returns { mentions: [...jids], tagText: "@num1 @num2 ..." }
 */
async function tagAll(client) {
    try {
        const metadata  = await client.groupMetadata(RAID_GROUP);
        const mentions  = metadata.participants.map(p => p.id);
        const tagText   = mentions.map(jid => `@${jid.split('@')[0]}`).join(' ');
        return { mentions, tagText };
    } catch (e) {
        console.error('tagAll error:', e.message);
        return { mentions: [], tagText: '' };
    }
}

module.exports = { tagAll };