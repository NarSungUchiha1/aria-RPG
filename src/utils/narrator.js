// Randomly select a narration template and fill in variables
function narrate(type, vars) {
    const templates = narrationTemplates[type];
    if (!templates || templates.length === 0) return '';
    const template = templates[Math.floor(Math.random() * templates.length)];
    return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] || `{${key}}`);
}

const narrationTemplates = {
    // PvP / Dungeon attack
    attack: [
        "{attacker} lunges forward, {weapon} cutting through the air. The blow strikes {target} with a resounding crack, dealing {damage} damage!",
        "With a fierce battle cry, {attacker} swings {weapon} at {target}. The impact sends shockwaves through the arena! {damage} damage!",
        "{attacker} feints left, then delivers a crushing blow to {target}. The hit lands solidly for {damage} damage!",
        "A swift strike from {attacker} catches {target} off guard. {damage} damage dealt!",
        "{attacker} channels their strength into a powerful blow, slamming {weapon} against {target}. {damage} damage!"
    ],

    // Skill used (damage)
    skillDamage: [
        "{attacker} focuses their energy and unleashes {move}! A brilliant surge of power engulfs {target}, causing {damage} damage!",
        "The air crackles as {attacker} invokes {move}. {target} is caught in the blast, suffering {damage} damage!",
        "{attacker} weaves arcane sigils, casting {move}. The spell slams into {target} with devastating force! {damage} damage!",
        "With a flick of the wrist, {attacker} releases {move}. {target} reels from the impact, taking {damage} damage!",
        "{attacker} roars and executes {move}! The attack leaves {target} staggered, dealing {damage} damage!"
    ],

    // Heal
    heal: [
        "{healer} murmurs a soothing incantation. A warm light envelops {target}, mending wounds and restoring {heal} HP.",
        "Golden energy flows from {healer} to {target}, closing gashes and easing pain. {heal} HP recovered!",
        "{healer} places a gentle hand on {target}, channeling life-giving magic. {heal} HP restored.",
        "A soft hum fills the air as {healer} heals {target}. Vitality surges back! +{heal} HP.",
        "{healer} invokes an ancient blessing, bathing {target} in restorative light. {heal} HP regained."
    ],

    // Buff
    buff: [
        "{caster} bestows {move} upon {target}. Their {stat} surges with newfound strength! (+{value} for {duration} turns)",
        "Empowering energy surrounds {target} as {caster} casts {move}. {stat} increased by {value} for {duration} turns.",
        "{caster} whispers words of power, and {target}'s {stat} rises dramatically! +{value} for {duration} turns.",
        "A shimmering aura envelops {target}. {caster}'s {move} has enhanced their {stat} by {value}!",
        "{caster} taps into hidden reserves, granting {target} a boost to {stat}. +{value} for {duration} turns."
    ],

    // Debuff
    debuff: [
        "{caster} afflicts {target} with {move}, sapping their {stat}. (-{value} for {duration} turns)",
        "Dark tendrils wrap around {target} as {caster} casts {move}. {stat} is reduced by {value}!",
        "{caster} hexes {target}, weakening their {stat} by {value} for {duration} turns.",
        "A curse falls upon {target}. {caster}'s {move} diminishes their {stat}!",
        "{caster} gestures sharply, and {target}'s {stat} withers. -{value} for {duration} turns."
    ],

    // Shield
    shield: [
        "{caster} weaves a shimmering barrier around {target}. It will absorb {value} damage for {duration} turns.",
        "A protective dome forms around {target}, courtesy of {caster}'s {move}. Absorbs {value} damage.",
        "{caster} erects a magical shield. {target} is protected from {value} damage!",
        "Glowing runes encircle {target}. {caster}'s {move} grants a {value} HP shield.",
        "{caster} invokes a guardian spirit to shield {target}. Damage absorption: {value}."
    ],

    // Cleanse
    cleanse: [
        "{caster} purifies {target}, dispelling all harmful effects. They feel refreshed!",
        "A wave of cleansing light washes over {target}, removing debuffs.",
        "{caster} channels pure energy, stripping away afflictions from {target}.",
        "With a gentle touch, {caster} cleanses {target} of all maladies.",
        "Holy fire burns away the corruption on {target}. They are cleansed!"
    ],

    // Evasion (dodge)
    evasion: [
        "{target} twists aside with uncanny agility, turning a deadly blow into a mere graze! Damage halved.",
        "{target} anticipates the strike and rolls away, lessening the impact. Damage reduced!",
        "With a sudden burst of speed, {target} evades the brunt of the attack.",
        "{target} ducks under the swing, avoiding the worst of it.",
        "A last‑second sidestep saves {target} from a direct hit. Damage halved!"
    ],

    // Enemy retaliation
    retaliation: [
        "⚡ {enemy} snarls and retaliates with {move}, dealing {damage} damage!",
        "{enemy} counters with a vicious {move}! {damage} damage taken.",
        "Enraged, {enemy} lashes out with {move}, striking for {damage} damage!",
        "{enemy} recovers quickly and hits back with {move}! {damage} damage.",
        "A brutal {move} from {enemy} catches you off guard. {damage} damage!"
    ],

    // Defense absorption
    defenseBlock: [
        "🛡️ {target}'s sturdy armor absorbs {blocked} damage.",
        "The blow glances off {target}'s thick hide. {blocked} damage mitigated.",
        "{target}'s defenses hold firm, reducing the hit by {blocked}.",
        "Armor plates deflect part of the strike. {blocked} damage blocked.",
        "A well‑timed block negates {blocked} damage."
    ],

    // Shield absorption
    shieldBlock: [
        "🛡️ Your shimmering shield absorbs {absorbed} damage!",
        "The magical barrier flickers, absorbing {absorbed} damage.",
        "Your protective shield takes the brunt of the hit. {absorbed} damage soaked.",
        "The attack is partially negated by your shield. {absorbed} damage absorbed.",
        "A burst of light signals your shield absorbing {absorbed} damage."
    ],

    // Enemy defeated
    enemyDefeat: [
        "With a final, shuddering cry, {enemy} collapses into the dust, its spirit fading into the shadows.",
        "{enemy} lets out a last wail before crumbling into nothingness.",
        "The life fades from {enemy}'s eyes as it falls to the ground, defeated.",
        "{enemy} staggers and then crumples, vanquished at last.",
        "A decisive blow sends {enemy} crashing down. Victory!"
    ],

    // Dungeon stage advance
    stageAdvance: [
        "The stone door grinds open, revealing a deeper darkness. The air grows colder, and new threats stir in the shadows.",
        "You push forward, the dungeon's oppressive aura intensifying. New enemies emerge from the gloom.",
        "The path ahead clears, but the stench of danger grows stronger. You advance to the next stage.",
        "With the current threat eliminated, you step through a hidden passage into the unknown.",
        "A heavy portcullis rises, beckoning you deeper into the dungeon's heart."
    ],

    // Dungeon cleared
    dungeonClear: [
        "The chamber falls silent. {boss} lies vanquished, its reign of terror ended. You have conquered the dungeon!",
        "As {boss} breathes its last, the dungeon's malevolent energy dissipates. You stand victorious!",
        "The final blow lands, and {boss} crumbles. The dungeon is no more. You are a legend!",
        "With {boss} defeated, the dungeon's curse is lifted. You emerge as a true hero.",
        "The echoes of battle fade. {boss} is slain, and the dungeon's treasures are yours!"
    ],

    // PvP victory
    pvpVictory: [
        "💀 {winner} stands triumphant over {loser}! The crowd (if there was one) goes wild!",
        "{winner} delivers the final blow! {loser} falls, defeated. Glory to the victor!",
        "The duel ends with {winner} as the undisputed champion. {loser} will need time to recover.",
        "{winner} outmaneuvers {loser} and claims victory! A masterful performance!",
        "With a decisive strike, {winner} ends the duel. {loser} has been bested!"
    ],

    // PvP turn start
    pvpTurn: [
        "It's {player}'s turn! What will they do?",
        "{player} steps forward, ready to act.",
        "The momentum shifts to {player}.",
        "{player} seizes the initiative!",
        "All eyes on {player}. Make your move!"
    ]
};

module.exports = { narrate };