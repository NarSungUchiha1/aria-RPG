/**
 * CASINO — Gold gambling games
 * Only works in the Casino GC (set CASINO_GC_JID in env)
 * 
 * !casino         — see all games
 * !dice <bet>     — roll dice vs house (2d6)
 * !slots <bet>    — slot machine (3 reels)
 * !coinflip <bet> [heads/tails] — 50/50
 * !blackjack <bet> — draw cards vs house, closest to 21 wins
 */

const db = require('../database/db');

const CASINO_GC = process.env.CASINO_GC_JID || '';
const MIN_BET = 1000;
const MAX_BET = 50000;
const DAILY_LIMIT = 5; // tries per game per day

function clamp(bet) { return Math.max(MIN_BET, Math.min(MAX_BET, Math.floor(bet))); }

// ── Daily try limit — DB backed ──────────────────────────────────────────────
async function ensureCasinoTable() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS casino_tries (
            player_id  VARCHAR(60) NOT NULL,
            game       VARCHAR(20) NOT NULL,
            try_date   DATE NOT NULL,
            tries      INT NOT NULL DEFAULT 0,
            PRIMARY KEY (player_id, game, try_date)
        )
    `).catch(() => {});
}

async function checkAndIncrementTry(userId, game) {
    await ensureCasinoTable();
    const today = new Date().toISOString().split('T')[0];
    // Upsert — increment tries
    await db.execute(
        `INSERT INTO casino_tries (player_id, game, try_date, tries)
         VALUES (?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE tries = tries + 1`,
        [userId, game, today]
    );
    // Check if over limit AFTER incrementing
    const [rows] = await db.execute(
        'SELECT tries FROM casino_tries WHERE player_id=? AND game=? AND try_date=?',
        [userId, game, today]
    );
    return Number(rows[0]?.tries || 1) <= DAILY_LIMIT;
}

async function getTriesLeft(userId, game) {
    await ensureCasinoTable();
    const today = new Date().toISOString().split('T')[0];
    const [rows] = await db.execute(
        'SELECT tries FROM casino_tries WHERE player_id=? AND game=? AND try_date=?',
        [userId, game, today]
    );
    return Math.max(0, DAILY_LIMIT - Number(rows[0]?.tries || 0));
}

// ── Slot machine ──────────────────────────────────────────────────────────────
// Only 5 symbols — better chance of matching
const REELS = ['💎', '🔥', '⭐', '🌙', '🍀'];
const SLOT_PAYOUTS = {
    '💎💎💎': 10,  // jackpot — 1/125 chance
    '🔥🔥🔥': 5,
    '⭐⭐⭐': 4,
    '🌙🌙🌙': 3,
    '🍀🍀🍀': 3,
};

function spinSlots() {
    return [0,1,2].map(() => REELS[Math.floor(Math.random() * REELS.length)]);
}

function slotPayout(reels, bet) {
    const key = reels.join('');
    const mult = SLOT_PAYOUTS[key];
    if (mult !== undefined) return mult === 0 ? 0 : bet * mult;
    // Two of a kind = 1.8x (medium difficulty)
    if (reels[0]===reels[1] || reels[1]===reels[2] || reels[0]===reels[2]) return Math.floor(bet * 1.8);
    return 0; // no match
}

// ── Blackjack ─────────────────────────────────────────────────────────────────
const CARDS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
function cardValue(c) {
    if (['J','Q','K'].includes(c)) return 10;
    if (c === 'A') return 11;
    return parseInt(c);
}
function handTotal(hand) {
    let total = hand.reduce((s, c) => s + cardValue(c), 0);
    let aces = hand.filter(c => c === 'A').length;
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return total;
}
function drawCard() { return CARDS[Math.floor(Math.random() * CARDS.length)]; }

// Active blackjack games — DB backed
async function ensureBjTable() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS casino_blackjack (
            player_id   VARCHAR(60) PRIMARY KEY,
            hand        TEXT NOT NULL,
            dealer_hand TEXT NOT NULL,
            bet         INT NOT NULL,
            jid         VARCHAR(100),
            started_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `).catch(() => {});
}

async function getBjGame(userId) {
    await ensureBjTable();
    const [rows] = await db.execute('SELECT * FROM casino_blackjack WHERE player_id=?', [userId]);
    if (!rows.length) return null;
    return {
        hand: JSON.parse(rows[0].hand),
        dealerHand: JSON.parse(rows[0].dealer_hand),
        bet: rows[0].bet,
        jid: rows[0].jid
    };
}

async function saveBjGame(userId, game) {
    await ensureBjTable();
    await db.execute(
        `INSERT INTO casino_blackjack (player_id, hand, dealer_hand, bet, jid)
         VALUES (?,?,?,?,?)
         ON DUPLICATE KEY UPDATE hand=?, dealer_hand=?, bet=?, jid=?`,
        [userId, JSON.stringify(game.hand), JSON.stringify(game.dealerHand), game.bet, game.jid,
         JSON.stringify(game.hand), JSON.stringify(game.dealerHand), game.bet, game.jid]
    );
}

async function deleteBjGame(userId) {
    await ensureBjTable();
    await db.execute('DELETE FROM casino_blackjack WHERE player_id=?', [userId]);
}

async function checkGold(userId) {
    const [rows] = await db.execute('SELECT gold FROM currency WHERE player_id=?', [userId]);
    return Number(rows[0]?.gold || 0);
}
async function addGold(userId, amount) {
    await db.execute('UPDATE currency SET gold = GREATEST(0, gold + ?) WHERE player_id=?', [amount, userId]);
}

module.exports = {
    name: 'casino',
    aliases: ['dice', 'slots', 'coinflip', 'blackjack', 'bj', 'hit', 'stand', 'roulette', 'war', 'highlow'],
    async execute(msg, args, { userId, client }) {
        const jid = msg.from;
        const cmd = msg.body?.split(' ')[0]?.replace('!','').toLowerCase();

        // Restrict to casino GC or DMs only
        if (CASINO_GC && jid !== CASINO_GC && jid.endsWith('@g.us')) {
            return msg.reply('🎰 The casino is over in the Casino group.');
        }

        const [pRows] = await db.execute('SELECT nickname FROM players WHERE id=?', [userId]);
        if (!pRows.length) return msg.reply('❌ Not registered.');
        const nick = pRows[0].nickname;

        // ── !casino — game list ────────────────────────────────────────────
        if (cmd === 'casino') {
            return msg.reply(
                `╔══〘 🎰 ARIA CASINO 〙══╗\n` +
                `┃◆\n` +
                `┃◆ 🎲 *!dice <bet>*\n` +
                `┃◆ 🎰 *!slots <bet>*\n` +
                `┃◆ 🪙 *!coinflip <bet> [h/t]*\n` +
                `┃◆ 🃏 *!blackjack <bet>*\n` +
                `┃◆ 🎯 *!roulette <bet> <choice>*\n` +
                `┃◆ ⚔️ *!war <bet>*\n` +
                `┃◆ 📈 *!highlow <bet> [h/l]*\n` +
                `┃◆\n` +
                `┃◆ Min: ${MIN_BET.toLocaleString()}G  Max: ${MAX_BET.toLocaleString()}G\n` +
                `┃◆ Limit: ${DAILY_LIMIT} tries/game/day\n` +
                `╚═══════════════════════════╝`
            );
        }

        // ── No args on individual games — show game intro ──────────────────
        if (!args[0] && !['hit','stand','bj','blackjack'].includes(cmd)) {
            const intros = {
                dice:      `╔══〘 🎲 DICE 〙══╗\n┃◆\n┃◆ Roll 2 dice against the house.\n┃◆ Higher total wins.\n┃◆ Win = double your bet.\n┃◆ Tie = bet returned.\n┃◆ House rolls with a +2 bonus.\n┃◆\n┃◆ !dice <bet>\n╚═══════════════════════════╝`,
                slots:     `╔══〘 🎰 SLOTS 〙══╗\n┃◆\n┃◆ Spin 3 reels. Match to win.\n┃◆ Symbols: 💎 🔥 ⭐ 🌙 🍀\n┃◆\n┃◆ 💎💎💎 = 10× JACKPOT\n┃◆ 🔥🔥🔥 = 5×\n┃◆ ⭐⭐⭐ = 4×\n┃◆ 🌙🌙🌙 = 3×\n┃◆ 🍀🍀🍀 = 3×\n┃◆ Two of a kind = 1.5×\n┃◆ No match = lose bet\n┃◆\n┃◆ !slots <bet>\n╚═══════════════════════════╝`,
                coinflip:  `╔══〘 🪙 COIN FLIP 〙══╗\n┃◆\n┃◆ 50/50. Heads or tails.\n┃◆ Win = double your bet.\n┃◆ Lose = lose your bet.\n┃◆\n┃◆ !coinflip <bet> h — bet heads\n┃◆ !coinflip <bet> t — bet tails\n┃◆ (default: heads)\n╚═══════════════════════════╝`,
                blackjack: `╔══〘 🃏 BLACKJACK 〙══╗\n┃◆\n┃◆ Get closer to 21 than the dealer.\n┃◆ Go over 21 = bust, you lose.\n┃◆\n┃◆ Win = 2× your bet\n┃◆ Blackjack (21 on deal) = 2.5×\n┃◆ Tie = bet returned\n┃◆\n┃◆ Dealer draws until 17+.\n┃◆ Card values:\n┃◆ 2-10 = face value\n┃◆ J Q K = 10  |  A = 11 or 1\n┃◆\n┃◆ !blackjack <bet> — start\n┃◆ !hit — draw a card\n┃◆ !stand — hold your hand\n╚═══════════════════════════╝`,
                roulette:  `╔══〘 🎯 ROULETTE 〙══╗\n┃◆\n┃◆ Bet on where the ball lands.\n┃◆\n┃◆ red / black = 2×\n┃◆ odd / even = 2×\n┃◆ 1-18 / 19-36 = 2×\n┃◆ exact number (0-36) = 35×\n┃◆\n┃◆ !roulette <bet> red\n┃◆ !roulette <bet> black\n┃◆ !roulette <bet> 17\n╚═══════════════════════════╝`,
                war:       `╔══〘 ⚔️ WAR 〙══╗\n┃◆\n┃◆ You and the dealer each draw one card.\n┃◆ Higher card wins. Tie = bet returned.\n┃◆\n┃◆ Win = 2× your bet\n┃◆ Card values: 2-10 face, J=11 Q=12 K=13 A=14\n┃◆\n┃◆ !war <bet>\n╚═══════════════════════════╝`,
                highlow:   `╔══〘 📈 HIGH / LOW 〙══╗\n┃◆\n┃◆ A card is drawn. Guess if the\n┃◆ next card is higher or lower.\n┃◆\n┃◆ Win = 1.8× your bet\n┃◆ Tie = bet returned\n┃◆\n┃◆ !highlow <bet> h — bet higher\n┃◆ !highlow <bet> l — bet lower\n╚═══════════════════════════╝`,
            };
            const intro = intros[cmd] || intros['blackjack'];
            return msg.reply(intro);
        }

        // ── !dice <bet> ────────────────────────────────────────────────────
        if (cmd === 'dice') {
            const bet = clamp(parseInt(args[0]) || 0);
            if (!bet) return msg.reply('❌ !dice <amount>');
            const gold = await checkGold(userId);
            if (gold < bet) return msg.reply(`❌ Not enough gold. You have ${gold.toLocaleString()}G.`);

            if (!await checkAndIncrementTry(userId, 'dice')) return msg.reply(
                `══〘 🎲 DICE 〙══╮\n┃◆ ❌ Daily limit reached (${DAILY_LIMIT} tries).\n┃◆ Come back tomorrow.\n╰═══════════════════════╯`
            );

            // Medium difficulty — same 2d6 each, house wins ties (gives ~47% player win rate)
            const you   = Math.ceil(Math.random() * 6) + Math.ceil(Math.random() * 6);
            const house = Math.ceil(Math.random() * 6) + Math.ceil(Math.random() * 6);
            const won   = you > house;
            const tie   = you === house;
            const delta = tie ? 0 : won ? bet : -bet;
            await addGold(userId, delta);

            return msg.reply(
                `╔══〘 🎲 DICE 〙══╗\n` +
                `┃◆ *${nick}* rolled: ${you}\n` +
                `┃◆ House rolled: ${house}\n` +
                `┃◆\n` +
                (tie ? `┃◆ 🤝 Tie — bet returned.\n` : won
                    ? `┃◆ ✅ You win! +${bet.toLocaleString()}G\n`
                    : `┃◆ ❌ House wins. -${bet.toLocaleString()}G\n`) +
                `┃◆ Tries left today: ${await getTriesLeft(userId, 'dice')}\n` +
                `╚═══════════════════════════╝`
            );
        }

        // ── !slots <bet> ───────────────────────────────────────────────────
        if (cmd === 'slots') {
            const bet = clamp(parseInt(args[0]) || 0);
            if (!bet) return msg.reply('❌ !slots <amount>');
            const gold = await checkGold(userId);
            if (gold < bet) return msg.reply(`❌ Not enough gold. You have ${gold.toLocaleString()}G.`);

            if (!await checkAndIncrementTry(userId, 'slots')) return msg.reply(
                `══〘 🎰 SLOTS 〙══╮\n┃◆ ❌ Daily limit reached (${DAILY_LIMIT} tries).\n┃◆ Come back tomorrow.\n╰═══════════════════════╯`
            );

            await addGold(userId, -bet);
            const reels = spinSlots();
            const payout = slotPayout(reels, bet);
            if (payout > 0) await addGold(userId, payout);

            const isJackpot = reels.join('') === '💎💎💎';
            const isDead    = reels.join('') === '💀💀💀';

            return msg.reply(
                `╔══〘 🎰 SLOTS 〙══╗\n` +
                `┃◆\n` +
                `┃◆  ${reels[0]} │ ${reels[1]} │ ${reels[2]}\n` +
                `┃◆\n` +
                (isJackpot ? `┃◆ 💎 JACKPOT! +${payout.toLocaleString()}G!\n` :
                 isDead    ? `┃◆ 💀 VOID DRAIN. Lost everything.\n` :
                 payout > 0 ? `┃◆ ✅ +${payout.toLocaleString()}G\n` :
                              `┃◆ ❌ No match. -${bet.toLocaleString()}G\n`) +
                `╚═══════════════════════════╝`
            );
        }

        // ── !coinflip <bet> [h/t] ──────────────────────────────────────────
        if (cmd === 'coinflip') {
            const bet = clamp(parseInt(args[0]) || 0);
            if (!bet) return msg.reply('❌ !coinflip <amount> [h/t]');
            const gold = await checkGold(userId);
            if (gold < bet) return msg.reply(`❌ Not enough gold.`);

            if (!await checkAndIncrementTry(userId, 'coinflip')) return msg.reply(
                `══〘 🪙 COIN FLIP 〙══╮\n┃◆ ❌ Daily limit reached (${DAILY_LIMIT} tries).\n┃◆ Come back tomorrow.\n╰═══════════════════════╯`
            );

            const guess  = args[1]?.toLowerCase()?.startsWith('t') ? 'tails' : 'heads';
            const result = Math.random() < 0.5 ? 'heads' : 'tails';
            const won    = guess === result;
            await addGold(userId, won ? bet : -bet);

            return msg.reply(
                `╔══〘 🪙 COIN FLIP 〙══╗\n` +
                `┃◆ You chose: *${guess}*\n` +
                `┃◆ Result: *${result}*\n` +
                `┃◆\n` +
                (won ? `┃◆ ✅ +${bet.toLocaleString()}G\n` : `┃◆ ❌ -${bet.toLocaleString()}G\n`) +
                `╚═══════════════════════════╝`
            );
        }

        // ── !blackjack <bet> ───────────────────────────────────────────────
        if (cmd === 'blackjack' || cmd === 'bj') {
            const existingGame = await getBjGame(userId);
            if (existingGame) return msg.reply('❌ Finish your current game first. !hit or !stand');
            if (!await checkAndIncrementTry(userId, 'blackjack')) return msg.reply(
                `══〘 🃏 BLACKJACK 〙══╮\n┃◆ ❌ Daily limit reached (${DAILY_LIMIT} tries).\n┃◆ Come back tomorrow.\n╰═══════════════════════╯`
            );
            const bet = clamp(parseInt(args[0]) || 0);
            if (!bet) return msg.reply('❌ !blackjack <amount>');
            const gold = await checkGold(userId);
            if (gold < bet) return msg.reply(`❌ Not enough gold.`);
            await addGold(userId, -bet);

            const hand = [drawCard(), drawCard()];
            const dealerHand = [drawCard(), drawCard()];
            await saveBjGame(userId, { hand, dealerHand, bet, jid });

            const total = handTotal(hand);
            if (total === 21) {
                // Blackjack!
                const payout = Math.floor(bet * 2.5);
                await addGold(userId, payout);
                await deleteBjGame(userId);
                return msg.reply(
                    `╔══〘 🃏 BLACKJACK! 〙══╗\n` +
                    `┃◆ Your hand: ${hand.join(' ')} = 21\n` +
                    `┃◆\n` +
                    `┃◆ 🎉 BLACKJACK — 2.5× payout!\n` +
                    `┃◆ +${payout.toLocaleString()}G\n` +
                    `╚═══════════════════════════╝`
                );
            }

            return msg.reply(
                `╔══〘 🃏 BLACKJACK 〙══╗\n` +
                `┃◆\n` +
                `┃◆ Your hand:   ${hand.join(' ')} = ${total}\n` +
                `┃◆ Dealer shows: ${dealerHand[0]} 🂠 (hidden)\n` +
                `┃◆\n` +
                `┃◆ !hit — draw a card\n` +
                `┃◆ !stand — hold your hand\n` +
                `┃◆ Bet: ${bet.toLocaleString()}G\n` +
                `╚═══════════════════════════╝`
            );
        }

        // ── !hit ───────────────────────────────────────────────────────────
        if (cmd === 'hit') {
            const game = await getBjGame(userId);
            if (!game) return msg.reply('❌ No active blackjack game. !blackjack <bet> to start.');
            game.hand.push(drawCard());
            const total = handTotal(game.hand);

            if (total > 21) {
                await deleteBjGame(userId);
                return msg.reply(
                    `╔══〘 🃏 BUST 〙══╗\n` +
                    `┃◆ Your hand: ${game.hand.join(' ')} = ${total}\n` +
                    `┃◆ ❌ Bust! -${game.bet.toLocaleString()}G\n` +
                    `╚═══════════════════════════╝`
                );
            }

            return msg.reply(
                `╔══〘 🃏 HIT 〙══╗\n` +
                `┃◆\n` +
                `┃◆ Your hand:    ${game.hand.join(' ')} = ${total}\n` +
                `┃◆ Dealer shows: ${game.dealerHand[0]} 🂠 (hidden)\n` +
                `┃◆\n` +
                `┃◆ !hit — draw again\n` +
                `┃◆ !stand — hold\n` +
                `╚═══════════════════════════╝`
            );
        }

        // ── !roulette <bet> <choice> ──────────────────────────────────────────
        if (cmd === 'roulette') {
            const bet = clamp(parseInt(args[0]) || 0);
            const choice = args[1]?.toLowerCase();
            if (!bet || !choice) return msg.reply('❌ !roulette <bet> <red/black/odd/even/0-36>');
            const gold = await checkGold(userId);
            if (gold < bet) return msg.reply(`❌ Not enough gold.`);
            if (!await checkAndIncrementTry(userId, 'roulette')) return msg.reply(
                `══〘 🎯 ROULETTE 〙══╮\n┃◆ ❌ Daily limit (${DAILY_LIMIT} tries) reached.\n╰═══════════════════════╯`
            );

            const spin = Math.floor(Math.random() * 37); // 0-36
            const isRed = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(spin);
            const isBlack = spin > 0 && !isRed;

            let won = false, payout = 0;
            const numChoice = parseInt(choice);
            if (!isNaN(numChoice) && numChoice >= 0 && numChoice <= 36) {
                won = spin === numChoice;
                payout = won ? bet * 35 : 0;
            } else if (choice === 'red')   { won = isRed;          payout = won ? bet * 2 : 0; }
            else if (choice === 'black')   { won = isBlack;         payout = won ? bet * 2 : 0; }
            else if (choice === 'odd')     { won = spin > 0 && spin % 2 === 1; payout = won ? bet * 2 : 0; }
            else if (choice === 'even')    { won = spin > 0 && spin % 2 === 0; payout = won ? bet * 2 : 0; }
            else if (choice === '1-18')    { won = spin >= 1 && spin <= 18; payout = won ? bet * 2 : 0; }
            else if (choice === '19-36')   { won = spin >= 19 && spin <= 36; payout = won ? bet * 2 : 0; }
            else return msg.reply('❌ Invalid choice. Use: red black odd even 1-18 19-36 or a number 0-36');

            await addGold(userId, won ? payout - bet : -bet);
            const color = spin === 0 ? '🟢' : isRed ? '🔴' : '⚫';

            return msg.reply(
                `╔══〘 🎯 ROULETTE 〙══╗\n` +
                `┃◆\n` +
                `┃◆ The ball lands on... ${color} *${spin}*\n` +
                `┃◆ Your bet: *${choice}*\n` +
                `┃◆\n` +
                (won ? `┃◆ ✅ +${payout.toLocaleString()}G\n` : `┃◆ ❌ -${bet.toLocaleString()}G\n`) +
                `╚═══════════════════════════╝`
            );
        }

        // ── !war <bet> ────────────────────────────────────────────────────────
        if (cmd === 'war') {
            const bet = clamp(parseInt(args[0]) || 0);
            if (!bet) return msg.reply('❌ !war <bet>');
            const gold = await checkGold(userId);
            if (gold < bet) return msg.reply(`❌ Not enough gold.`);
            if (!await checkAndIncrementTry(userId, 'war')) return msg.reply(
                `══〘 ⚔️ WAR 〙══╮\n┃◆ ❌ Daily limit (${DAILY_LIMIT} tries) reached.\n╰═══════════════════════╯`
            );

            const warValue = c => { if(c==='A') return 14; if(c==='K') return 13; if(c==='Q') return 12; if(c==='J') return 11; return parseInt(c); };
            const yourCard   = drawCard();
            const dealerCard = drawCard();
            const youVal     = warValue(yourCard);
            const dealVal    = warValue(dealerCard);
            const tie        = youVal === dealVal;
            const won        = youVal > dealVal;

            await addGold(userId, tie ? 0 : won ? bet : -bet);

            return msg.reply(
                `╔══〘 ⚔️ WAR 〙══╗\n` +
                `┃◆\n` +
                `┃◆ Your card:   *${yourCard}* (${youVal})\n` +
                `┃◆ Dealer card: *${dealerCard}* (${dealVal})\n` +
                `┃◆\n` +
                (tie  ? `┃◆ 🤝 Tie! Bet returned.\n` :
                 won  ? `┃◆ ✅ You win! +${bet.toLocaleString()}G\n` :
                        `┃◆ ❌ Dealer wins. -${bet.toLocaleString()}G\n`) +
                `╚═══════════════════════════╝`
            );
        }

        // ── !highlow <bet> [h/l] ──────────────────────────────────────────────
        if (cmd === 'highlow') {
            const bet    = clamp(parseInt(args[0]) || 0);
            const guess  = args[1]?.toLowerCase()?.startsWith('l') ? 'lower' : 'higher';
            if (!bet) return msg.reply('❌ !highlow <bet> [h/l]');
            const gold = await checkGold(userId);
            if (gold < bet) return msg.reply(`❌ Not enough gold.`);
            if (!await checkAndIncrementTry(userId, 'highlow')) return msg.reply(
                `══〘 📈 HIGH/LOW 〙══╮\n┃◆ ❌ Daily limit (${DAILY_LIMIT} tries) reached.\n╰═══════════════════════╯`
            );

            const hlVal = c => { if(c==='A') return 14; if(c==='K') return 13; if(c==='Q') return 12; if(c==='J') return 11; return parseInt(c); };
            const first  = drawCard();
            const second = drawCard();
            const fVal   = hlVal(first);
            const sVal   = hlVal(second);
            const tie    = fVal === sVal;
            const won    = tie ? false : (guess === 'higher' ? sVal > fVal : sVal < fVal);
            const payout = Math.floor(bet * 1.8);

            await addGold(userId, tie ? 0 : won ? payout - bet : -bet);

            return msg.reply(
                `╔══〘 📈 HIGH / LOW 〙══╗\n` +
                `┃◆\n` +
                `┃◆ First card:  *${first}* (${fVal})\n` +
                `┃◆ Your guess:  *${guess}*\n` +
                `┃◆ Next card:   *${second}* (${sVal})\n` +
                `┃◆\n` +
                (tie  ? `┃◆ 🤝 Same card! Bet returned.\n` :
                 won  ? `┃◆ ✅ Correct! +${(payout-bet).toLocaleString()}G\n` :
                        `┃◆ ❌ Wrong. -${bet.toLocaleString()}G\n`) +
                `╚═══════════════════════════╝`
            );
        }

        // ── !stand ─────────────────────────────────────────────────────────
        if (cmd === 'stand') {
            const game = await getBjGame(userId);
            if (!game) return msg.reply('❌ No active blackjack game. !blackjack <bet> to start.');
            await deleteBjGame(userId);

            const playerTotal = handTotal(game.hand);
            // Dealer draws until 16+ (medium difficulty — slightly favors player)
            while (handTotal(game.dealerHand) < 16) game.dealerHand.push(drawCard());
            const dealerTotal = handTotal(game.dealerHand);

            const bust     = dealerTotal > 21;
            const youWin   = bust || playerTotal > dealerTotal;
            const tie      = !bust && playerTotal === dealerTotal;
            const payout   = tie ? game.bet : youWin ? game.bet * 2 : 0;
            if (payout > 0) await addGold(userId, payout);

            return msg.reply(
                `╔══〘 🃏 BLACKJACK RESULT 〙══╗\n` +
                `┃◆ Your hand: ${game.hand.join(' ')} = ${playerTotal}\n` +
                `┃◆ Dealer: ${game.dealerHand.join(' ')} = ${dealerTotal}${bust ? ' (BUST)' : ''}\n` +
                `┃◆\n` +
                (tie ? `┃◆ 🤝 Tie — bet returned.\n` :
                 youWin ? `┃◆ ✅ You win! +${game.bet.toLocaleString()}G\n` :
                          `┃◆ ❌ Dealer wins. -${game.bet.toLocaleString()}G\n`) +
                `╚═══════════════════════════╝`
            );
        }
    }
};