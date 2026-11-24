// Royalty-free background music generated in the browser (no files, no API),
// plus helpers to trim an uploaded song to the video length.
const CHIME_TIMES = [3.0, 4.8, 7.6];
const VIDEO_SECONDS = 16;
const SR = 44100;
const SA = 146.83; // D3
const hz = (semi) => SA * Math.pow(2, semi / 12);
export function musicStyleFor(event) {
    return event === "haldi" || event === "mehndi" || event === "sangeet" ? "festive" : "calm";
}
function envGain(ctx, dest, at, peak, decay, attack = 0.006) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    g.connect(dest);
    return g;
}
function pluck(ctx, dest, f, at, vol, pan) {
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    p.connect(dest);
    const partials = [["sine", 1, 1], ["triangle", 1.003, 0.35], ["sine", 2, 0.22], ["sine", 3.01, 0.08], ["sine", 4.2, 0.03]];
    for (const [type, mult, v] of partials) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = f * mult;
        const g = envGain(ctx, p, at, vol * v, 1.8 / Math.sqrt(mult));
        o.connect(g);
        o.start(at);
        o.stop(at + 2);
    }
}
function tanpura(ctx, dest, f, at, vol) {
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1500;
    lp.Q.value = 4;
    lp.connect(dest);
    for (const det of [-4, 4]) {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = f;
        o.detune.value = det;
        const g = envGain(ctx, lp, at, vol, 3.6, 0.04);
        o.connect(g);
        o.start(at);
        o.stop(at + 3.8);
    }
}
function bell(ctx, dest, at, vol) {
    for (const [m, v] of [[1, 1], [2.76, 0.45], [5.4, 0.2]]) {
        const o = ctx.createOscillator();
        o.frequency.value = 1760 * m;
        const g = envGain(ctx, dest, at, vol * v, 3.2 / m, 0.002);
        o.connect(g);
        o.start(at);
        o.stop(at + 3.4);
    }
}
function drum(ctx, dest, noise, at, kind, vol) {
    if (kind === "dha") {
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(120, at);
        o.frequency.exponentialRampToValueAtTime(52, at + 0.18);
        const g = envGain(ctx, dest, at, vol, 0.4, 0.003);
        o.connect(g);
        o.start(at);
        o.stop(at + 0.45);
    }
    const n = ctx.createBufferSource();
    n.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = kind === "na" ? 2400 : 900;
    bp.Q.value = 1.2;
    n.connect(bp);
    bp.connect(envGain(ctx, dest, at, vol * (kind === "na" ? 0.5 : 0.25), 0.09, 0.002));
    n.start(at);
    n.stop(at + 0.12);
}
export async function generateMusic(style, seconds = VIDEO_SECONDS) {
    const ctx = new OfflineAudioContext(2, Math.ceil(SR * seconds), SR);
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, 0);
    master.gain.exponentialRampToValueAtTime(0.9, 1.2);
    master.gain.setValueAtTime(0.9, seconds - 1.6);
    master.gain.linearRampToValueAtTime(0.0001, seconds);
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp);
    comp.connect(ctx.destination);
    // reverb-ish echo
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.32;
    const fb = ctx.createGain();
    fb.gain.value = 0.28;
    const wet = ctx.createGain();
    wet.gain.value = 0.3;
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(wet);
    wet.connect(master);
    const bus = ctx.createGain();
    bus.connect(master);
    bus.connect(delay);
    // drone
    const cycle = [-5, 0, 0, -12];
    for (let t = 0, i = 0; t < seconds; t += 1.2, i++)
        tanpura(ctx, master, hz(cycle[i % 4]), t, 0.05);
    const beat = style === "festive" ? 0.25 : 0.5;
    const melody = style === "festive"
        ? [12, 14, 16, 14, 12, 9, 12, null, 9, 12, 14, 12, 9, 7, 9, null, 7, 9, 12, 9, 7, 4, 7, null, 4, 7, 9, 7, 4, 2, 0, null]
        : [7, 9, 12, null, 14, 12, 9, 7, 9, null, 7, 4, 2, 4, 7, null, 12, 14, 16, 14, 12, 9, 12, null, 9, 7, 4, 2, 0, null, null, null];
    const start = style === "festive" ? 2.4 : 1.6;
    let i = 0;
    for (let t = start; t < seconds - 1; t += beat, i++) {
        const n = melody[i % melody.length];
        if (n === null)
            continue;
        pluck(ctx, bus, hz(n + 12), t, 0.16, i % 2 ? 0.25 : -0.25);
        if (style === "calm" && i % 4 === 0)
            pluck(ctx, bus, hz(n), t, 0.06, 0);
    }
    for (const c of CHIME_TIMES)
        bell(ctx, bus, c, 0.04);
    if (style === "festive") {
        const noise = ctx.createBuffer(1, SR * 0.2, SR);
        const d = noise.getChannelData(0);
        for (let k = 0; k < d.length; k++)
            d[k] = Math.random() * 2 - 1;
        const pattern = ["dha", null, "na", "dha", null, "na", "dha", "na"];
        let j = 0;
        for (let t = 2.4; t < seconds - 0.8; t += 0.25, j++) {
            const k = pattern[j % 8];
            if (k)
                drum(ctx, master, noise, t, k, 0.55);
        }
    }
    return ctx.startRendering();
}
/** Decode an uploaded song and trim it (with fades) to the video length. */
/** seconds = length of the song segment to keep; null keeps everything from the offset to the end of the song. */
export async function prepareUploadedMusic(file, offset = 0, seconds = VIDEO_SECONDS) {
    const data = await file.arrayBuffer();
    const decoder = new OfflineAudioContext(2, SR, SR);
    const decoded = await decoder.decodeAudioData(data);
    const start = Math.max(0, Math.min(offset, Math.max(0, decoded.duration - 1)));
    if (!Number.isFinite(seconds) || seconds <= 0) seconds = Math.max(1, decoded.duration - start);
    seconds = Math.max(1, Math.min(seconds, decoded.duration - start));
    const ctx = new OfflineAudioContext(2, Math.ceil(SR * seconds), SR);
    const src = ctx.createBufferSource();
    src.buffer = decoded;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, 0);
    g.gain.exponentialRampToValueAtTime(1, 0.8);
    g.gain.setValueAtTime(1, seconds - 1.5);
    g.gain.linearRampToValueAtTime(0.0001, seconds);
    src.connect(g);
    g.connect(ctx.destination);
    src.start(0, start);
    return ctx.startRendering();
}

/** Match the selected soundtrack to the complete reel, looping when needed. */
export async function musicForDuration(buffer, seconds) {
    if (!buffer || !Number.isFinite(seconds) || seconds <= 0) return null;
    const ctx = new OfflineAudioContext(buffer.numberOfChannels, Math.ceil(buffer.sampleRate * seconds), buffer.sampleRate);
    const source = ctx.createBufferSource();
    source.buffer = buffer; source.loop = true; source.connect(ctx.destination);
    source.start(0); source.stop(seconds);
    return ctx.startRendering();
}
