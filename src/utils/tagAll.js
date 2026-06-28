const { getRaidGroup } = require('../engine/dungeon');

/**
 * Gets all participant JIDs from the given group (or raid group) for silent @mentions.
 * Everyone gets notified but no tag text appears in the message.
 */
async function tagAll(client, groupJid) {
    try {
        const targetGroup = groupJid || getRaidGroup();
        const metadata = await client.groupMetadata(targetGroup);
        const mentions = metadata.participants.map(p => p.id);
        return { mentions };
    } catch (e) {
        console.error('tagAll error:', e.message);
        return { mentions: [] };
    }
}

module.exports = { tagAll };