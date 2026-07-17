/**
 * Worker-thread body for resonance/VIP image widening.
 *
 * jimp is pure JS — decoding + resizing a phone photo blocks the CPU for tens
 * of seconds on a 0.1-CPU host. Run on the MAIN thread that froze the event
 * loop, starved the WhatsApp keepalive, and dropped the connection (408) mid
 * !vipimage. In a worker the event loop stays free and the socket stays alive.
 */
const { parentPort, workerData } = require('node:worker_threads');

(async () => {
    try {
        const { Jimp } = await import('jimp');
        const input = workerData.base64;
        const orig = await Jimp.read(Buffer.from(input, 'base64'));
        if (orig.height > 600) orig.resize({ w: Math.round(orig.width * 600 / orig.height), h: 600 });
        const ow = orig.width, oh = orig.height;
        const targetW = Math.round(oh * 1.6);
        if (ow >= targetW) { parentPort.postMessage({ ok: true, base64: input }); return; }

        // Cheap blur: shrink → small blur → scale up (soft look, tiny cost).
        const bg = orig.clone();
        bg.resize({ w: Math.max(1, Math.round(targetW / 4)), h: Math.max(1, Math.round(oh / 4)) });
        bg.blur(3);
        bg.resize({ w: targetW, h: oh });
        bg.composite(orig, Math.round((targetW - ow) / 2), 0);

        let out = await bg.getBuffer('image/jpeg');
        if (out.toString('base64').length > 700000) {
            bg.resize({ w: Math.round(bg.width * 0.75), h: Math.round(bg.height * 0.75) });
            out = await bg.getBuffer('image/jpeg');
        }
        parentPort.postMessage({ ok: true, base64: out.toString('base64') });
    } catch (e) {
        parentPort.postMessage({ ok: false, error: e.message });
    }
})();
