/**
 * Generates the gold "VIP MEMBERSHIP" card image sent when the owner grants a
 * subscription — dark card, gold double border, benefits list. Rendered with
 * jimp (no external assets). Returns a JPEG buffer, or null on any failure so
 * the caller can fall back to text-only.
 */
async function generateVipCard({ nickname = 'HUNTER', bonusPotion = null, days = 30 } = {}) {
    try {
        const { Jimp, loadFont } = await import('jimp');
        const { SANS_64_WHITE, SANS_32_WHITE, SANS_16_WHITE } = await import('jimp/fonts');

        const W = 900, H = 640;
        const NAVY = 0x141420ff, GOLD = 0xd4af37ff, DIM = 0x2a2a3eff;
        const card = new Jimp({ width: W, height: H, color: NAVY });
        const bar = (w, h, c) => new Jimp({ width: w, height: h, color: c });

        // Double gold frame
        card.composite(bar(W, 10, GOLD), 0, 0);       card.composite(bar(W, 10, GOLD), 0, H - 10);
        card.composite(bar(10, H, GOLD), 0, 0);       card.composite(bar(10, H, GOLD), W - 10, 0);
        card.composite(bar(W - 44, 2, GOLD), 22, 22); card.composite(bar(W - 44, 2, GOLD), 22, H - 24);
        card.composite(bar(2, H - 44, GOLD), 22, 22); card.composite(bar(2, H - 44, GOLD), W - 24, 22);

        const f64 = await loadFont(SANS_64_WHITE);
        const f32 = await loadFont(SANS_32_WHITE);
        const f16 = await loadFont(SANS_16_WHITE);

        card.print({ font: f64, x: 60, y: 55, text: 'VIP  MEMBERSHIP' });
        card.composite(bar(W - 120, 4, GOLD), 60, 140);
        card.print({ font: f32, x: 60, y: 165, text: nickname.toUpperCase().slice(0, 24) });

        const perks = [
            '+ 1,000,000  GOLD',
            '+ 1,000,000  XP',
            '+ 6x  FATIGUE  POTION',
            '+ 2x  FRACTURE  POTION',
            bonusPotion ? `+ 1x  ${bonusPotion.toUpperCase()}` : '+ 1x  MYSTERY  POTION',
            '+ CUSTOM  CARD  IMAGE'
        ];
        let y = 235;
        for (const line of perks) {
            card.composite(bar(14, 14, GOLD), 60, y + 10);
            card.print({ font: f32, x: 92, y, text: line });
            y += 52;
        }

        card.composite(bar(W - 120, 2, DIM), 60, y + 6);
        card.print({ font: f16, x: 60, y: y + 22, text: `VALID ${days} DAYS  •  ARIA RPG` });

        return await card.getBuffer('image/jpeg');
    } catch (e) {
        console.error('[VIP] card render failed:', e.message);
        return null;
    }
}

module.exports = { generateVipCard };
