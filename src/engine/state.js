const state = {
    users: {}
};

function getUser(id) {
    if (!state.users[id]) {
        state.users[id] = {
            xp: 0,
            level: 1,
            gold: 0,
            hp: 100,
            inventory: [],
            dungeon: null
        };
    }
    return state.users[id];
}

module.exports = { state, getUser };