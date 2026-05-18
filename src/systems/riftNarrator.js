/**
 * RIFT NARRATOR
 * Uses the Anthropic API to generate dynamic Explorer narratives.
 * Falls back to static strings if API fails.
 */

const STATIC_ENTRY = [
    'The air shifts as you step through. Something old notices.',
    'The void here is quiet. That is worse than noise.',
    'You feel the rift close behind you. Not all the way.',
    'The deeper you go the more the silence has weight.',
    'Your footsteps echo in directions that do not exist.',
    'Something moved at the edge of your vision. You decide not to look.',
    'The void tastes like the moment before something breaks.',
    'You have been here before. You have never been here before.'
];

const STATIC_RETURN = [
    'You step back through. Something almost followed.',
    'The rift collapses behind you. You do not look back.',
    'You are not entirely sure you left everything in there.',
    'The materials feel heavier than they should.',
    'You made it back. The void files this away for later.'
];

const STATIC_DEATH = [
    'The rift collapsed. You did not make it out.',
    'Something in the deep noticed you. You did not return.',
    'The void took more than your materials this time.',
    'You went too far. The rift sealed behind you.',
    'Whatever found you in there — you never saw it coming.',
    'The fracture was too unstable. You were inside when it closed.',
    'The void keeps what it catches. Today it caught you.'
];

const STATIC_WOUND = [
    'You made it back. Something followed you to the edge.',
    'The rift tried to keep you. You fought your way out.',
    'You survived. The cost was your HP.',
    'Something touched you on the way back. You are still counting the damage.'
];

async function narrateRift(type, context = {}) {
    try {
        const { rank, role, nickname, drops, survivalRate, isPrestige } = context;

        const prompts = {
            entry: `You are the narrator for a dark void RPG. An Explorer named "${nickname || 'the Explorer'}" at rank ${rank || 'F'}${isPrestige ? ' (Prestige)' : ''} is entering a void rift. Write ONE short atmospheric sentence (max 15 words) describing their entry into the rift. Dark, mysterious tone. No quotation marks.`,

            return: `You are the narrator for a dark void RPG. An Explorer named "${nickname || 'the Explorer'}" at rank ${rank || 'F'} has returned from a void rift with materials: ${drops ? Object.keys(drops).join(', ') : 'various items'}. Write ONE short atmospheric sentence (max 15 words) about their return. Dark, mysterious tone. No quotation marks.`,

            death: `You are the narrator for a dark void RPG. An Explorer named "${nickname || 'the Explorer'}" at rank ${rank || 'F'} did not survive the void rift. Their survival chance was ${survivalRate || 50}%. Write ONE short dark sentence (max 15 words) about their fate. Grim, final tone. No quotation marks.`,

            wound: `You are the narrator for a dark void RPG. An Explorer named "${nickname || 'the Explorer'}" at rank ${rank || 'F'} survived the void rift but was wounded. Write ONE short atmospheric sentence (max 15 words) about their wounded return. Dark tone. No quotation marks.`,

            nothing: `You are the narrator for a dark void RPG. An Explorer entered a void rift and found nothing of value. Write ONE short sentence (max 15 words) about returning empty-handed from the void. Bleak tone. No quotation marks.`
        };

        const prompt = prompts[type] || prompts.entry;

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 60,
                messages: [{ role: 'user', content: prompt }]
            })
        });

        const data = await response.json();
        const text = data?.content?.[0]?.text?.trim();
        if (text && text.length > 5) return text;
    } catch (e) {
        console.error('Rift narrator error:', e.message);
    }

    // Fallback to static
    const fallbacks = {
        entry:  STATIC_ENTRY,
        return: STATIC_RETURN,
        death:  STATIC_DEATH,
        wound:  STATIC_WOUND,
        nothing: STATIC_RETURN
    };
    const pool = fallbacks[type] || STATIC_ENTRY;
    return pool[Math.floor(Math.random() * pool.length)];
}

module.exports = { narrateRift, STATIC_ENTRY, STATIC_RETURN, STATIC_DEATH, STATIC_WOUND };