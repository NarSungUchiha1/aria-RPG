module.exports = function getUserId(msg) {
    const raw = msg.author || msg.from || "";
    return raw.replace(/@c\.us|@g\.us|@lid/g, "").split("@")[0];
};