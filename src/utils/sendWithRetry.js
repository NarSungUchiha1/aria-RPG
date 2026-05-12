/**
 * Sends a WhatsApp message with automatic retries on connection failure.
 * Waits between attempts to give the connection time to recover.
 */
async function sendWithRetry(client, jid, content, retries = 5, delay = 8000) {
    for (let i = 0; i < retries; i++) {
        try {
            await client.sendMessage(jid, content);
            return true;
        } catch (e) {
            if (i < retries - 1) {
                console.log(`📨 Send failed (${e.message}) — retry ${i + 1}/${retries} in ${delay / 1000}s`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }
    console.error('📨 Message failed after all retries.');
    return false;
}

module.exports = { sendWithRetry };