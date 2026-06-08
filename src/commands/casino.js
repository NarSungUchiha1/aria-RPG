const db = require('../database/db');

const MIN_BET    = 1000;
const MAX_BET    = 50000;
const DAILY_LIMIT = 5;

// ── Helpers ───────────────────────────────────────────────────────────────────
function clamp(n) { return Math.max(MIN_BET, Math.min(MAX_BET, Math.floor(n))); }
function betValid(n) { return n >= MIN_BET && n <= MAX_BET; }

async function ensureTables() {
    await db.execute(`CREATE TABLE IF NOT EXISTS casino_tries (
        player_id VARCHAR(60), game VARCHAR(20), try_date DATE, tries INT DEFAULT 0,
        PRIMARY KEY (player_id, game, try_date)
    )`).catch(() => {});
    await db.execute(`CREATE TABLE IF NOT EXISTS casino_blackjack (
        player_id VARCHAR(60) PRIMARY KEY,
        hand TEXT, dealer_hand TEXT, bet INT, started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`).catch(() => {});
}

async function checkGold(userId) {
    const [r] = await db.execute('SELECT gold FROM currency WHERE player_id=?', [userId]);
    return Number(r[0]?.gold || 0);
}
async function addGold(userId, amount) {
    await db.execute('UPDATE currency SET gold = GREATEST(0, gold + ?) WHERE player_id=?', [amount, userId]);
}

async function triesLeft(userId, game) {
    await ensureTables();
    const today = new Date().toISOString().split('T')[0];
    const [r] = await db.execute(
        'SELECT tries FROM casino_tries WHERE player_id=? AND game=? AND try_date=?',
        [userId, game, today]
    );
    return DAILY_LIMIT - Number(r[0]?.tries || 0);
}

async function useTry(userId, game) {
    await ensureTables();
    const today = new Date().toISOString().split('T')[0];
    const left = await triesLeft(userId, game);
    if (left <= 0) return false;
    await db.execute(
        `INSERT INTO casino_tries (player_id, game, try_date, tries) VALUES (?,?,?,1)
         ON DUPLICATE KEY UPDATE tries = tries + 1`,
        [userId, game, today]
    );
    return true;
}

// ── Cards ─────────────────────────────────────────────────────────────────────
const DECK = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
function draw() { return DECK[Math.floor(Math.random() * DECK.length)]; }
function cardVal(c) {
    if (['J','Q','K'].includes(c)) return 10;
    if (c === 'A') return 11;
    return parseInt(c);
}
function handTotal(hand) {
    let total = hand.reduce((s,c) => s + cardVal(c), 0);
    let aces  = hand.filter(c => c === 'A').length;
    while (total > 21 && aces-- > 0) total -= 10;
    return total;
}
function warVal(c) {
    if (c === 'A') return 14;
    if (c === 'K') return 13;
    if (c === 'Q') return 12;
    if (c === 'J') return 11;
    return parseInt(c);
}

// ── Blackjack DB ──────────────────────────────────────────────────────────────
async function bjGet(userId) {
    await ensureTables();
    const [r] = await db.execute('SELECT * FROM casino_blackjack WHERE player_id=?', [userId]);
    if (!r.length) return null;
    return { hand: JSON.parse(r[0].hand), dealerHand: JSON.parse(r[0].dealer_hand), bet: r[0].bet };
}
async function bjSave(userId, hand, dealerHand, bet) {
    await ensureTables();
    await db.execute(
        `INSERT INTO casino_blackjack (player_id, hand, dealer_hand, bet)
         VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE hand=?, dealer_hand=?, bet=?`,
        [userId, JSON.stringify(hand), JSON.stringify(dealerHand), bet,
                 JSON.stringify(hand), JSON.stringify(dealerHand), bet]
    );
}
async function bjDelete(userId) {
    await db.execute('DELETE FROM casino_blackjack WHERE player_id=?', [userId]);
}

// ── Slots ─────────────────────────────────────────────────────────────────────
const REELS = ['💎','🔥','⭐','🌙','🍀'];
function spin() { return [0,1,2].map(() => REELS[Math.floor(Math.random() * REELS.length)]); }
function slotPayout(r, bet) {
    const k = r.join('');
    const payouts = { '💎💎💎':10, '🔥🔥🔥':5, '⭐⭐⭐':4, '🌙🌙🌙':3, '🍀🍀🍀':3 };
    if (payouts[k] !== undefined) return bet * payouts[k];
    if (r[0]===r[1] || r[1]===r[2] || r[0]===r[2]) return Math.floor(bet * 1.8);
    return 0;
}

// ── Main command ──────────────────────────────────────────────────────────────
module.exports = {
    name: 'casino',
    aliases: ['dice','slots','coinflip','blackjack','bj','hit','stand','roulette','war','highlow'],
    async execute(msg, args, { userId }) {
        await ensureTables();
        const CASINO_GC = process.env.CASINO_GC_JID || '';
        if (CASINO_GC && msg.from !== CASINO_GC && msg.from.endsWith('@g.us')) {
            return msg.reply('🎰 Casino commands only work in the Casino group.');
        }
        const cmd  = (msg.body || '').split(' ')[0].replace('!','').toLowerCase();
        const bet  = clamp(parseInt(args[0]) || 0);

        const [pRow] = await db.execute('SELECT nickname FROM players WHERE id=?', [userId]);
        if (!pRow.length) return msg.reply('❌ Not registered.');
        const nick = pRow[0].nickname;

        const limitMsg = (game) =>
            `══〘 🎰 CASINO 〙══╮\n┃◆ ❌ Daily limit reached (${DAILY_LIMIT}/day).\n┃◆ Come back tomorrow.\n╰═══════════════════════╯`;

        // ── !casino ──────────────────────────────────────────────────────────
        if (cmd === 'casino') return msg.reply(
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
            `┃◆ Type any command without a bet\n` +
            `┃◆ to see how the game works.\n` +
            `┃◆\n` +
            `┃◆ Min: ${MIN_BET.toLocaleString()}G  Max: ${MAX_BET.toLocaleString()}G\n` +
            `┃◆ Limit: ${DAILY_LIMIT} tries per game per day\n` +
            `╚═══════════════════════════╝`
        );

        // ── Game intros (no bet given) ────────────────────────────────────────
        if (!bet && !['hit','stand'].includes(cmd)) {
            const intros = {
                dice:      `╔══〘 🎲 DICE 〙══╗\n┃◆\n┃◆ Roll 2 dice vs the house.\n┃◆ Higher total wins.\n┃◆ Ties go to the house.\n┃◆ Win = 2× bet\n┃◆\n┃◆ !dice <bet>\n╚═══════════════════════════╝`,
                slots:     `╔══〘 🎰 SLOTS 〙══╗\n┃◆\n┃◆ Spin 3 reels. Match to win.\n┃◆ 💎💎💎 = 10×  🔥🔥🔥 = 5×\n┃◆ ⭐⭐⭐ = 4×   🌙🌙🌙 = 3×\n┃◆ 🍀🍀🍀 = 3×\n┃◆ Two of a kind = 1.8×\n┃◆\n┃◆ !slots <bet>\n╚═══════════════════════════╝`,
                coinflip:  `╔══〘 🪙 COIN FLIP 〙══╗\n┃◆\n┃◆ 50/50. Heads or tails.\n┃◆ Win = 2× bet\n┃◆\n┃◆ !coinflip <bet> h\n┃◆ !coinflip <bet> t\n╚═══════════════════════════╝`,
                blackjack: `╔══〘 🃏 BLACKJACK 〙══╗\n┃◆\n┃◆ Get closer to 21 than dealer.\n┃◆ Over 21 = bust.\n┃◆ Max 5 cards then auto-stand.\n┃◆\n┃◆ Win = 2×  Blackjack = 2.5×\n┃◆ J/Q/K = 10  Ace = 11 or 1\n┃◆\n┃◆ !blackjack <bet>\n┃◆ !hit — draw  !stand — hold\n╚═══════════════════════════╝`,
                roulette:  `╔══〘 🎯 ROULETTE 〙══╗\n┃◆\n┃◆ red/black/odd/even = 2×\n┃◆ Exact number 0-36 = 35×\n┃◆\n┃◆ !roulette <bet> red\n┃◆ !roulette <bet> 17\n╚═══════════════════════════╝`,
                war:       `╔══〘 ⚔️ WAR 〙══╗\n┃◆\n┃◆ Draw one card each.\n┃◆ Higher card wins.\n┃◆ Tie = bet returned.\n┃◆ Win = 2× bet\n┃◆\n┃◆ !war <bet>\n╚═══════════════════════════╝`,
                highlow:   `╔══〘 📈 HIGH/LOW 〙══╗\n┃◆\n┃◆ See one card, guess if\n┃◆ the next is higher or lower.\n┃◆ Win = 1.8× bet\n┃◆\n┃◆ !highlow <bet> h\n┃◆ !highlow <bet> l\n╚═══════════════════════════╝`,
            };
            return msg.reply(intros[cmd] || intros['blackjack']);
        }

        // ── !dice ─────────────────────────────────────────────────────────────
        if (cmd === 'dice') {
            if (!betValid(bet)) return msg.reply(`❌ Bet must be between ${MIN_BET.toLocaleString()}G and ${MAX_BET.toLocaleString()}G.`);
            const gold = await checkGold(userId);
            if (gold < bet) return msg.reply(`❌ Not enough gold. You have ${gold.toLocaleString()}G.`);
            if (!await useTry(userId, 'dice')) return msg.reply(limitMsg());

            const you   = Math.ceil(Math.random()*6) + Math.ceil(Math.random()*6);
            const house = Math.ceil(Math.random()*6) + Math.ceil(Math.random()*6);
            const won   = you > house;
            const tie   = you === house;
            await addGold(userId, won ? bet : -bet); // tie = house wins

            return msg.reply(
                `╔══〘 🎲 DICE 〙══╗\n` +
                `┃◆\n` +
                `┃◆ *${nick}* rolled: *${you}*\n` +
                `┃◆ House rolled:  *${house}*\n` +
                `┃◆\n` +
                (tie ? `┃◆ 🤝 Tie — house wins. -${bet.toLocaleString()}G\n` :
                 won ? `┃◆ ✅ You win! +${bet.toLocaleString()}G\n` :
                       `┃◆ ❌ House wins. -${bet.toLocaleString()}G\n`) +
                `┃◆ Tries left today: ${await triesLeft(userId,'dice')}\n` +
                `╚═══════════════════════════╝`
            );
        }

        // ── !slots ────────────────────────────────────────────────────────────
        if (cmd === 'slots') {
            if (!betValid(bet)) return msg.reply(`❌ Bet must be between ${MIN_BET.toLocaleString()}G and ${MAX_BET.toLocaleString()}G.`);
            const gold = await checkGold(userId);
            if (gold < bet) return msg.reply(`❌ Not enough gold.`);
            if (!await useTry(userId, 'slots')) return msg.reply(limitMsg());

            await addGold(userId, -bet);
            const reels   = spin();
            const payout  = slotPayout(reels, bet);
            if (payout > 0) await addGold(userId, payout);

            const isJP = reels.join('') === '💎💎💎';
            return msg.reply(
                `╔══〘 🎰 SLOTS 〙══╗\n` +
                `┃◆\n` +
                `┃◆  ${reels[0]} │ ${reels[1]} │ ${reels[2]}\n` +
                `┃◆\n` +
                (isJP       ? `┃◆ 💎 JACKPOT! +${payout.toLocaleString()}G\n` :
                 payout > 0 ? `┃◆ ✅ +${payout.toLocaleString()}G\n` :
                              `┃◆ ❌ No match. -${bet.toLocaleString()}G\n`) +
                `┃◆ Tries left today: ${await triesLeft(userId,'slots')}\n` +
                `╚═══════════════════════════╝`
            );
        }

        // ── !coinflip ─────────────────────────────────────────────────────────
        if (cmd === 'coinflip') {
            if (!betValid(bet)) return msg.reply(`❌ Bet must be between ${MIN_BET.toLocaleString()}G and ${MAX_BET.toLocaleString()}G.`);
            const gold = await checkGold(userId);
            if (gold < bet) return msg.reply(`❌ Not enough gold.`);
            if (!await useTry(userId, 'coinflip')) return msg.reply(limitMsg());

            const guess  = args[1]?.toLowerCase()?.startsWith('t') ? 'tails' : 'heads';
            const result = Math.random() < 0.5 ? 'heads' : 'tails';
            const won    = guess === result;
            await addGold(userId, won ? bet : -bet);

            return msg.reply(
                `╔══〘 🪙 COIN FLIP 〙══╗\n` +
                `┃◆\n` +
                `┃◆ You chose: *${guess}*\n` +
                `┃◆ Result:    *${result}*\n` +
                `┃◆\n` +
                (won ? `┃◆ ✅ +${bet.toLocaleString()}G\n` : `┃◆ ❌ -${bet.toLocaleString()}G\n`) +
                `┃◆ Tries left today: ${await triesLeft(userId,'coinflip')}\n` +
                `╚═══════════════════════════╝`
            );
        }

        // ── !blackjack — start ────────────────────────────────────────────────
        if (cmd === 'blackjack' || cmd === 'bj') {
            const existing = await bjGet(userId);
            if (existing) return msg.reply('❌ Finish your current game first — !hit or !stand');

            const gold = await checkGold(userId);
            if (gold < bet) return msg.reply(`❌ Not enough gold.`);
            if (!await useTry(userId, 'blackjack')) return msg.reply(limitMsg());

            await addGold(userId, -bet);

            // Deal: player gets 2, dealer gets 2 (one hidden)
            const hand       = [draw(), draw()];
            const dealerHand = [draw(), draw()];
            await bjSave(userId, hand, dealerHand, bet);

            const total = handTotal(hand);

            // Blackjack on deal
            if (total === 21) {
                await bjDelete(userId);
                const payout = Math.floor(bet * 2.5);
                await addGold(userId, payout);
                return msg.reply(
                    `╔══〘 🃏 BLACKJACK! 〙══╗\n` +
                    `┃◆\n` +
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
                `┃◆ Your hand:    ${hand.join(' ')} = ${total}\n` +
                `┃◆ Dealer shows: ${dealerHand[0]} 🂠\n` +
                `┃◆ Cards: ${hand.length}/5\n` +
                `┃◆ Bet: ${bet.toLocaleString()}G\n` +
                `┃◆\n` +
                `┃◆ !hit — draw  !stand — hold\n` +
                `╚═══════════════════════════╝`
            );
        }

        // ── !hit ──────────────────────────────────────────────────────────────
        if (cmd === 'hit') {
            const game = await bjGet(userId);
            if (!game) return msg.reply('❌ No active game. Start with !blackjack <bet>');

            game.hand.push(draw());
            const total = handTotal(game.hand);
            await bjSave(userId, game.hand, game.dealerHand, game.bet);

            // Bust
            if (total > 21) {
                await bjDelete(userId);
                return msg.reply(
                    `╔══〘 🃏 BUST 〙══╗\n` +
                    `┃◆\n` +
                    `┃◆ Your hand: ${game.hand.join(' ')} = ${total}\n` +
                    `┃◆\n` +
                    `┃◆ ❌ Bust! -${game.bet.toLocaleString()}G\n` +
                    `╚═══════════════════════════╝`
                );
            }

            // 5 card limit — auto stand
            if (game.hand.length >= 5) {
                while (handTotal(game.dealerHand) < 16) game.dealerHand.push(draw());
                const dTotal = handTotal(game.dealerHand);
                const bust   = dTotal > 21;
                const won    = bust || total > dTotal;
                const tie    = !bust && total === dTotal;
                const payout = tie ? game.bet : won ? game.bet * 2 : 0;
                if (payout > 0) await addGold(userId, payout);
                await bjDelete(userId);

                return msg.reply(
                    `╔══〘 🃏 5 CARDS — AUTO STAND 〙══╗\n` +
                    `┃◆\n` +
                    `┃◆ Your hand: ${game.hand.join(' ')} = ${total}\n` +
                    `┃◆ Dealer:   ${game.dealerHand.join(' ')} = ${dTotal}${bust ? ' BUST' : ''}\n` +
                    `┃◆\n` +
                    (tie  ? `┃◆ 🤝 Tie — bet returned.\n` :
                     won  ? `┃◆ ✅ You win! +${game.bet.toLocaleString()}G\n` :
                            `┃◆ ❌ Dealer wins. -${game.bet.toLocaleString()}G\n`) +
                    `╚═══════════════════════════╝`
                );
            }

            return msg.reply(
                `╔══〘 🃏 HIT 〙══╗\n` +
                `┃◆\n` +
                `┃◆ Your hand:    ${game.hand.join(' ')} = ${total}\n` +
                `┃◆ Dealer shows: ${game.dealerHand[0]} 🂠\n` +
                `┃◆ Cards: ${game.hand.length}/5\n` +
                `┃◆\n` +
                `┃◆ !hit — draw  !stand — hold\n` +
                `╚═══════════════════════════╝`
            );
        }

        // ── !stand ────────────────────────────────────────────────────────────
        if (cmd === 'stand') {
            const game = await bjGet(userId);
            if (!game) return msg.reply('❌ No active game. Start with !blackjack <bet>');

            await bjDelete(userId);

            const playerTotal = handTotal(game.hand);

            // Dealer draws using the SAME dealerHand stored in DB
            while (handTotal(game.dealerHand) < 16) game.dealerHand.push(draw());
            const dealerTotal = handTotal(game.dealerHand);

            const bust   = dealerTotal > 21;
            const won    = bust || playerTotal > dealerTotal;
            const tie    = !bust && playerTotal === dealerTotal;
            const payout = tie ? game.bet : won ? game.bet * 2 : 0;
            if (payout > 0) await addGold(userId, payout);

            return msg.reply(
                `╔══〘 🃏 STAND 〙══╗\n` +
                `┃◆\n` +
                `┃◆ Your hand: ${game.hand.join(' ')} = ${playerTotal}\n` +
                `┃◆ Dealer:   ${game.dealerHand.join(' ')} = ${dealerTotal}${bust ? ' BUST' : ''}\n` +
                `┃◆\n` +
                (tie  ? `┃◆ 🤝 Tie — bet returned.\n` :
                 won  ? `┃◆ ✅ You win! +${game.bet.toLocaleString()}G\n` :
                        `┃◆ ❌ Dealer wins. -${game.bet.toLocaleString()}G\n`) +
                `╚═══════════════════════════╝`
            );
        }

        // ── !roulette ─────────────────────────────────────────────────────────
        if (cmd === 'roulette') {
            const choice = args[1]?.toLowerCase();
            if (!choice) return msg.reply('❌ !roulette <bet> <red/black/odd/even/0-36>');
            if (!betValid(bet)) return msg.reply(`❌ Bet must be between ${MIN_BET.toLocaleString()}G and ${MAX_BET.toLocaleString()}G.`);
            const gold = await checkGold(userId);
            if (gold < bet) return msg.reply(`❌ Not enough gold.`);
            if (!await useTry(userId, 'roulette')) return msg.reply(limitMsg());

            const spin    = Math.floor(Math.random() * 37);
            const redNums = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
            const isRed   = redNums.has(spin);
            const isBlack = spin > 0 && !isRed;
            const color   = spin === 0 ? '🟢' : isRed ? '🔴' : '⚫';

            let won = false, payout = 0;
            const num = parseInt(choice);
            if (!isNaN(num) && num >= 0 && num <= 36) {
                won = spin === num; payout = won ? bet * 35 : 0;
            } else if (choice === 'red')   { won = isRed;                        payout = won ? bet*2 : 0; }
            else if (choice === 'black')   { won = isBlack;                       payout = won ? bet*2 : 0; }
            else if (choice === 'odd')     { won = spin>0 && spin%2===1;          payout = won ? bet*2 : 0; }
            else if (choice === 'even')    { won = spin>0 && spin%2===0;          payout = won ? bet*2 : 0; }
            else return msg.reply('❌ Choose: red black odd even or a number 0-36');

            await addGold(userId, won ? payout - bet : -bet);

            return msg.reply(
                `╔══〘 🎯 ROULETTE 〙══╗\n` +
                `┃◆\n` +
                `┃◆ Ball lands: ${color} *${spin}*\n` +
                `┃◆ Your bet:   *${choice}*\n` +
                `┃◆\n` +
                (won ? `┃◆ ✅ +${(payout-bet).toLocaleString()}G\n` : `┃◆ ❌ -${bet.toLocaleString()}G\n`) +
                `┃◆ Tries left today: ${await triesLeft(userId,'roulette')}\n` +
                `╚═══════════════════════════╝`
            );
        }

        // ── !war ──────────────────────────────────────────────────────────────
        if (cmd === 'war') {
            if (!betValid(bet)) return msg.reply(`❌ Bet must be between ${MIN_BET.toLocaleString()}G and ${MAX_BET.toLocaleString()}G.`);
            const gold = await checkGold(userId);
            if (gold < bet) return msg.reply(`❌ Not enough gold.`);
            if (!await useTry(userId, 'war')) return msg.reply(limitMsg());

            const yourCard   = draw();
            const dealerCard = draw();
            const yv = warVal(yourCard), dv = warVal(dealerCard);
            const tie = yv === dv, won = yv > dv;
            await addGold(userId, won ? bet : -bet); // tie = house wins

            return msg.reply(
                `╔══〘 ⚔️ WAR 〙══╗\n` +
                `┃◆\n` +
                `┃◆ Your card:   *${yourCard}* (${yv})\n` +
                `┃◆ Dealer card: *${dealerCard}* (${dv})\n` +
                `┃◆\n` +
                (tie  ? `┃◆ 🤝 Tie — bet returned.\n` :
                 won  ? `┃◆ ✅ +${bet.toLocaleString()}G\n` :
                        `┃◆ ❌ -${bet.toLocaleString()}G\n`) +
                `┃◆ Tries left today: ${await triesLeft(userId,'war')}\n` +
                `╚═══════════════════════════╝`
            );
        }

        // ── !highlow ──────────────────────────────────────────────────────────
        if (cmd === 'highlow') {
            const gold  = await checkGold(userId);
            if (gold < bet) return msg.reply(`❌ Not enough gold.`);
            if (!await useTry(userId, 'highlow')) return msg.reply(limitMsg());

            const guess  = args[1]?.toLowerCase()?.startsWith('l') ? 'lower' : 'higher';
            const first  = draw();
            const second = draw();
            const fv = warVal(first), sv = warVal(second);
            const tie = fv === sv;
            const won = !tie && (guess === 'higher' ? sv > fv : sv < fv);
            const profit = Math.floor(bet * 0.8);
            await addGold(userId, tie ? 0 : won ? profit : -bet);

            return msg.reply(
                `╔══〘 📈 HIGH / LOW 〙══╗\n` +
                `┃◆\n` +
                `┃◆ First card:  *${first}* (${fv})\n` +
                `┃◆ Your guess:  *${guess}*\n` +
                `┃◆ Next card:   *${second}* (${sv})\n` +
                `┃◆\n` +
                (tie  ? `┃◆ 🤝 Same card — bet returned.\n` :
                 won  ? `┃◆ ✅ +${profit.toLocaleString()}G\n` :
                        `┃◆ ❌ -${bet.toLocaleString()}G\n`) +
                `┃◆ Tries left today: ${await triesLeft(userId,'highlow')}\n` +
                `╚═══════════════════════════╝`
            );
        }
    }
};