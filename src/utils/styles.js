function stylize(text) {
    return `*${text}*`;
}

function rankBadge(rank) {
    return `[${rank}]`;
}

function roleIcon(role) {
    const icons = { Tank:'🛡️', Assassin:'🗡️', Mage:'🔮', Healer:'💊', Berserker:'🔥' };
    return icons[role] || '❓';
}

module.exports = { stylize, rankBadge, roleIcon };