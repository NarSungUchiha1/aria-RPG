const { RAID_GROUP } = require('../engine/dungeon');

/**
 * Gets all participant JIDs from the raid group for silent @mentions.
 * Everyone gets notified but no tag text appears in the message.
 */
async function tagAll(client) {
    try {
        const metadata = await client.groupMetadata(RAID_GROUP);
        const mentions = metadata.participants.map(p => p.id);
        return { mentions };
    } catch (e) {
        console.error('tagAll error:', e.message);
        return { mentions: [] };
    }
}

module.exports = { tagAll };