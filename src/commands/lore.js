const { getCurrentChapter, getChapterData, CHAPTERS } = require('../systems/loreSystem');

module.exports = {
    name: 'lore',
    async execute(msg, args, { userId }) {
        try {
            const currentChapter = await getCurrentChapter();
            const chapter = getChapterData(currentChapter);

            // !lore all — show all chapter teasers
            if (args[0] === 'all') {
                let text =
                    `╭══〘 📖 ARIA — STORY SO FAR 〙══╮\n` +
                    `┃◆ \n`;

                for (const c of CHAPTERS) {
                    const isActive  = c.id === currentChapter;
                    const isLocked  = c.id > currentChapter;
                    const marker    = isActive ? '⚡' : isLocked ? '🔒' : '✅';
                    text +=
                        `┃◆ ${marker} Chapter ${c.id}: *${c.title}*\n` +
                        `┃◆    "${c.subtitle}"\n` +
                        (!isLocked ? `┃◆    ${c.teaser.split('\n')[0]}\n` : `┃◆    [Locked]\n`) +
                        `┃◆ \n`;
                }

                text += `┃◆ Use !lore to read the current chapter.\n╰═══════════════════════════╯`;
                return msg.reply(text);
            }

            // Default — show current chapter full story
            const storyText = chapter.story.join('\n┃◆ ');

            return msg.reply(
                `╭══〘 📖 ARIA — CHAPTER ${chapter.id} 〙══╮\n` +
                `┃◆ \n` +
                `┃◆ *${chapter.title.toUpperCase()}*\n` +
                `┃◆ "${chapter.subtitle}"\n` +
                `┃◆ ━━━━━━━━━━━━━━━━━━━━\n` +
                `┃◆ \n` +
                `┃◆ ${storyText}\n` +
                `┃◆ \n` +
                `┃◆ ━━━━━━━━━━━━━━━━━━━━\n` +
                `┃◆ Use !lore all to see all chapters.\n` +
                `╰═══════════════════════════╯`
            );
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 📖 LORE 〙══╮\n┃◆ ❌ Could not load lore.\n╰═══════════════════════╯`);
        }
    }
};