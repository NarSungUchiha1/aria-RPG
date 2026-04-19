async function tagUser(client, userId) {
    try {
        return await client.getContactById(userId);
    } catch {
        return null;
    }
}
module.exports = { tagUser };