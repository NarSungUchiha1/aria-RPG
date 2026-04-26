const { getCurrentChapter, setChapter, getChapterData, CHAPTERS } = require('../systems/loreSystem');
const { RAID_GROUP } = require('../engine/dungeon');
const { tagAll } = require('../utils/tagAll');

module.exports = {
    name: 'chapter',
    async execute(msg, args, { isAdmin, client }) {
        if (!isAdmin) return msg.reply(
            `══〘 📖 CHAPTER 〙══╮\n┃◆ ❌ Admin only.\n╰═══════════════════════╯`
        );

        const current = await getCurrentChapter();

        // !chapter — show current
        if (!args[0]) {
            const chapter = getChapterData(current);
            return msg.reply(
                `══〘 📖 CHAPTER 〙══╮\n` +
                `┃◆ Current: Chapter ${current} — *${chapter.title}*\n` +
                `┃◆ "${chapter.subtitle}"\n` +
                `┃◆ \n` +
                `┃◆ !chapter next → advance to next chapter\n` +
                `┃◆ !chapter <1-4> → jump to specific chapter\n` +
                `╰═══════════════════════╯`
            );
        }

        let newChapter;
        if (args[0] === 'next') {
            newChapter = Math.min(current + 1, CHAPTERS.length);
        } else {
            newChapter = parseInt(args[0]);
        }

        if (isNaN(newChapter) || newChapter < 1 || newChapter > CHAPTERS.length) return msg.reply(
            `══〘 📖 CHAPTER 〙══╮\n┃◆ ❌ Valid chapters: 1-${CHAPTERS.length}\n╰═══════════════════════╯`
        );

        if (newChapter === current) return msg.reply(
            `══〘 📖 CHAPTER 〙══╮\n┃◆ ❌ Already on Chapter ${current}.\n╰═══════════════════════╯`
        );

        await setChapter(newChapter);
        const chapter = getChapterData(newChapter);
        const storyText = chapter.story.join('\n┃◆ ');

        await msg.reply(
            `══〘 📖 CHAPTER 〙══╮\n┃◆ ✅ Advanced to Chapter ${newChapter}.\n┃◆ Announcement sent to group.\n╰═══════════════════════╯`
        );

        // ✅ Dramatic chapter announcement to GC
        const { mentions } = await tagAll(client);

        await client.sendMessage(RAID_GROUP, {
            text:
                `╭══〘 📖 ARIA — NEW CHAPTER 〙══╮\n` +
                `┃◆ \n` +
                `┃◆ ════ CHAPTER ${chapter.id} ════\n` +
                `┃◆ \n` +
                `┃◆ *${chapter.title.toUpperCase()}*\n` +
                `┃◆ "${chapter.subtitle}"\n` +
                `┃◆ \n` +
                `┃◆ ━━━━━━━━━━━━━━━━━━━━\n` +
                `┃◆ \n` +
                `┃◆ ${storyText}\n` +
                `┃◆ \n` +
                `┃◆ ━━━━━━━━━━━━━━━━━━━━\n` +
                `┃◆ \n` +
                `┃◆ The story continues.\n` +
                `┃◆ Use !lore to read from the beginning.\n` +
                `┃◆ \n` +
                `╰═══════════════════════════╯`,
            mentions
        });
    }
};