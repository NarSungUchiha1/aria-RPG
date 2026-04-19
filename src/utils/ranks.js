const order = ["F","E","D","C","B","A","S"];
function getNextRank(rank) {
    const i = order.indexOf(String(rank).toUpperCase());
    return order[i+1] || "S";
}
module.exports = { getNextRank };