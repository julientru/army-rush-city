// Retro sounds and music for the Army Rush games (and Hong Kong Ferries, Math Rocket, Wobbly Tower, Deep Sea Adventure and Candy Shop), in the style of the old strategy games:
// war drums, horns and a galloping lute for the battle, a calm flute tune for the town,
// short fanfares for good news. Everything is made on the fly with the Web Audio API,
// so there are no sound files and nothing is copied from another game.
//
// A game calls Sound.play("boom") for an effect, Sound.music("battle" | "town" | "harbour" | "space" | "deep" | "nest" | "shop" | null) as often
// as it likes (only a change does something), and puts Sound.button() in its HUD. A game can add its own
// tunes with Sound.addTrack (Army Rush City's epic music for each age is in games/armycity/epic-music.js).
// Every page opens with the sound off (🔇); a tap on the button turns it on (🔊) until the page is left.
// Like a video site, sound that was turned on plays even when the phone is on silent (see mediaChannel).
// Browsers only allow sound after a tap or a key, so nothing plays before the first one.
window.Sound = (function () {
  const ICONS = { on: "🔊", off: "🔇" };
  const LABELS = { on: "Sound and music on", off: "Sound off" };
  const t = (s) => (window.I18n ? I18n.t(s) : s);

  if (window.I18n) {
    I18n.add({
      fr: {
        "Sound and music on": "Sons et musique activés",
        "Sound off": "Son coupé",
      },
      "zh-HK": {
        "Sound and music on": "聲效同音樂開咗",
        "Sound off": "冇聲",
      },
    });
  }

  let mode = "off";

  let ac = null;              // the AudioContext, made at the first tap
  let sfxBus, musicBus, noiseBuf;
  let voices = 0;             // sounds playing now, so a big battle never turns into noise
  const lastPlayed = {};      // name -> time, so one effect does not repeat too fast
  const buttons = [];

  // ---------- Notes ----------

  // "C#4" -> Hz.
  function hz(note) {
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(note);
    const semi = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
    return 440 * Math.pow(2, (12 * (+m[3] + 1) + semi - 69) / 12);
  }

  // ---------- Building blocks ----------

  // iPhones mute web page sound when the silent switch is on, but not videos or music.
  // So, once the sound is turned on, the page asks to be a "playback" page (Safari 16.4+),
  // and for older iPhones it keeps a silent <audio> loop going, which does the same.
  let keepAlive = null;
  function silence() {
    const n = 4000, b = new Uint8Array(44 + n), v = new DataView(b.buffer); // half a second of 8 kHz, 8-bit WAV
    const ascii = (at, text) => { for (let i = 0; i < text.length; i++) b[at + i] = text.charCodeAt(i); };
    ascii(0, "RIFF"); v.setUint32(4, 36 + n, true); ascii(8, "WAVEfmt ");
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
    ascii(36, "data"); v.setUint32(40, n, true);
    b.fill(128, 44);
    return URL.createObjectURL(new Blob([b], { type: "audio/wav" }));
  }
  function mediaChannel(on) {
    if (navigator.audioSession) {
      try { navigator.audioSession.type = on ? "playback" : "auto"; } catch (e) { /* older browser */ }
    }
    if (on) {
      if (!keepAlive) {
        keepAlive = new Audio(silence());
        keepAlive.loop = true;
        keepAlive.setAttribute("playsinline", "");
      }
      const p = keepAlive.play();
      if (p) p.catch(() => { /* not allowed yet: the next tap tries again */ });
    } else if (keepAlive) {
      keepAlive.pause();
    }
  }

  function unlock() {
    if (mode !== "on") return; // no audio at all until the sound is turned on
    if (!document.hidden && (!keepAlive || keepAlive.paused)) mediaChannel(true);
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 6;
      comp.connect(ac.destination);
      const master = ac.createGain();
      master.gain.value = 1;
      master.connect(comp);
      sfxBus = ac.createGain();
      sfxBus.gain.value = 0.9;
      sfxBus.connect(master);
      musicBus = ac.createGain();
      musicBus.gain.value = 0.7;
      musicBus.connect(master);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state === "suspended" && !document.hidden) ac.resume();
    syncMusic();
  }

  // A gain that rises in `attack` seconds and fades out by `end`.
  function env(t0, vol, attack, end, out) {
    const gn = ac.createGain();
    gn.gain.setValueAtTime(0.0001, t0);
    gn.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    gn.gain.exponentialRampToValueAtTime(0.0001, end);
    gn.connect(out);
    return gn;
  }

  function track(src, end) {
    voices++;
    src.onended = () => { voices--; };
    src.stop(end + 0.05);
  }

  // One oscillator note. f2 slides the pitch, cut puts it through a low-pass filter, vib wobbles it.
  function tone(o) {
    const t0 = o.t, end = t0 + o.dur;
    const out = env(t0, o.vol, o.attack || 0.005, end, o.bus || sfxBus);
    let dest = out;
    if (o.cut) {
      const f = ac.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.setValueAtTime(o.cut, t0);
      if (o.cut2) f.frequency.exponentialRampToValueAtTime(o.cut2, end);
      f.Q.value = o.q || 1;
      f.connect(out);
      dest = f;
    }
    const osc = ac.createOscillator();
    osc.type = o.type || "square";
    osc.frequency.setValueAtTime(o.f, t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, end);
    if (o.detune) osc.detune.value = o.detune;
    if (o.vib) {
      const lfo = ac.createOscillator(), depth = ac.createGain();
      lfo.frequency.value = 5.5;
      depth.gain.value = o.f * o.vib;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(t0);
      lfo.stop(end + 0.05);
    }
    osc.connect(dest);
    osc.start(t0);
    track(osc, end);
  }

  // A burst of noise through a filter: whooshes, drums, explosions.
  function noise(o) {
    const t0 = o.t, end = t0 + o.dur;
    const out = env(t0, o.vol, o.attack || 0.003, end, o.bus || sfxBus);
    const f = ac.createBiquadFilter();
    f.type = o.filter || "lowpass";
    f.frequency.setValueAtTime(o.f, t0);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, end);
    f.Q.value = o.q || 1;
    f.connect(out);
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    src.connect(f);
    src.start(t0, Math.random() * 0.5);
    track(src, end);
  }

  // A brass note: two detuned saws whose filter opens as the note swells.
  function brass(f, t0, dur, vol, bus) {
    [-7, 7].forEach((d) => tone({ type: "sawtooth", f, t: t0, dur, vol: vol / 2, attack: Math.min(0.08, dur / 3),
      cut: 500, cut2: 1800, detune: d, bus }));
  }

  // A plucked string: bright at first, then dull.
  function pluck(f, t0, dur, vol, bus) {
    tone({ type: "sawtooth", f, t: t0, dur, vol, attack: 0.003, cut: f * 6, cut2: f * 1.2, bus });
    tone({ type: "triangle", f: f * 2, t: t0, dur: dur * 0.6, vol: vol * 0.3, bus });
  }

  // ---------- Sound effects ----------

  // name -> [shortest gap in seconds, how to play it at time t].
  const SFX = {
    // Your army's weapons.
    stone: [0.09, (t0) => noise({ t: t0, dur: 0.12, vol: 0.25, filter: "bandpass", f: 900, f2: 2500, q: 2 })],
    axe: [0.09, (t0) => noise({ t: t0, dur: 0.16, vol: 0.28, filter: "bandpass", f: 500, f2: 1800, q: 3 })],
    arrow: [0.09, (t0) => {
      tone({ type: "triangle", f: 520, f2: 380, t: t0, dur: 0.12, vol: 0.25 });
      noise({ t: t0, dur: 0.1, vol: 0.12, filter: "highpass", f: 3000 });
    }],
    dart: [0.08, (t0) => tone({ type: "square", f: 950, f2: 260, t: t0, dur: 0.09, vol: 0.12 })],
    pellet: [0.07, (t0) => {
      noise({ t: t0, dur: 0.05, vol: 0.25, filter: "bandpass", f: 1800, q: 1.5 });
      tone({ type: "square", f: 300, f2: 120, t: t0, dur: 0.04, vol: 0.08 });
    }],
    ball: [0.12, (t0) => {
      tone({ type: "sine", f: 140, f2: 40, t: t0, dur: 0.3, vol: 0.55 });
      noise({ t: t0, dur: 0.3, vol: 0.35, f: 1200, f2: 150 });
    }],
    shell: [0.12, (t0) => {
      tone({ type: "sine", f: 110, f2: 35, t: t0, dur: 0.35, vol: 0.6 });
      noise({ t: t0, dur: 0.35, vol: 0.4, f: 1500, f2: 120 });
    }],
    missile: [0.12, (t0) => noise({ t: t0, dur: 0.45, vol: 0.3, filter: "bandpass", f: 300, f2: 2400, q: 1.2, attack: 0.05 })],
    plane: [0.15, (t0) => tone({ type: "sawtooth", f: 90, f2: 140, t: t0, dur: 0.4, vol: 0.18, attack: 0.08, cut: 700 })],
    laser: [0.08, (t0) => {
      tone({ type: "square", f: 1800, f2: 300, t: t0, dur: 0.18, vol: 0.1 });
      tone({ type: "sine", f: 2400, f2: 600, t: t0, dur: 0.18, vol: 0.12 });
    }],
    bomb: [0.3, (t0) => tone({ type: "sine", f: 1400, f2: 350, t: t0, dur: 0.7, vol: 0.18 })],

    // Hits and knock-outs: cartoon sounds, nobody really gets hurt.
    hit: [0.06, (t0) => noise({ t: t0, dur: 0.06, vol: 0.18, f: 700 })],
    boing: [0.05, (t0) => {
      tone({ type: "sine", f: 220, f2: 700, t: t0, dur: 0.22, vol: 0.3, vib: 0.08 });
      noise({ t: t0, dur: 0.18, vol: 0.12, filter: "bandpass", f: 600, f2: 200 });
    }],
    bigboing: [0.1, (t0) => {
      tone({ type: "sine", f: 110, f2: 420, t: t0, dur: 0.45, vol: 0.45, vib: 0.1 });
      tone({ type: "triangle", f: 55, f2: 40, t: t0, dur: 0.4, vol: 0.4 });
    }],
    boom: [0.08, (t0) => {
      noise({ t: t0, dur: 0.4, vol: 0.45, f: 1800, f2: 100 });
      tone({ type: "sine", f: 90, f2: 30, t: t0, dur: 0.35, vol: 0.45 });
    }],
    kaboom: [0.2, (t0) => {
      noise({ t: t0, dur: 1.4, vol: 0.7, f: 2500, f2: 60 });
      tone({ type: "sine", f: 70, f2: 22, t: t0, dur: 1.1, vol: 0.7 });
      noise({ t: t0 + 0.12, dur: 0.9, vol: 0.3, filter: "bandpass", f: 400, f2: 80 });
    }],

    // Boxes and walls.
    box: [0.1, (t0) => ["C5", "E5", "G5", "C6"].forEach((n, i) =>
      tone({ type: "square", f: hz(n), t: t0 + i * 0.07, dur: i === 3 ? 0.3 : 0.09, vol: 0.14 }))],
    crumble: [0.1, (t0) => {
      noise({ t: t0, dur: 0.5, vol: 0.4, f: 900, f2: 120 });
      for (let i = 0; i < 4; i++) noise({ t: t0 + 0.05 + i * 0.08, dur: 0.05, vol: 0.25, filter: "bandpass", f: 400 + i * 150, q: 4 });
    }],
    miss: [0.3, (t0) => {
      tone({ type: "triangle", f: hz("E4"), t: t0, dur: 0.25, vol: 0.25 });
      tone({ type: "triangle", f: hz("C4"), f2: hz("A3"), t: t0 + 0.26, dur: 0.45, vol: 0.25, vib: 0.03 });
    }],
    crash: [0.3, (t0) => {
      noise({ t: t0, dur: 1, vol: 0.6, f: 1500, f2: 80 });
      [0, 0.12, 0.27].forEach((d) => tone({ type: "sine", f: 100, f2: 40, t: t0 + d, dur: 0.25, vol: 0.4 }));
    }],
    hurt: [0.15, (t0) => {
      tone({ type: "square", f: 240, f2: 90, t: t0, dur: 0.2, vol: 0.18 });
      tone({ type: "sawtooth", f: 160, f2: 70, t: t0, dur: 0.2, vol: 0.12 });
    }],
    throw: [0.18, (t0) => noise({ t: t0, dur: 0.14, vol: 0.08, filter: "bandpass", f: 1500, f2: 500, q: 2 })],

    // The war horn at the start of each wave: one short blast and one long.
    horn: [1, (t0) => {
      brass(hz("A2"), t0, 0.32, 0.4);
      brass(hz("E3"), t0, 0.32, 0.25);
      brass(hz("A2"), t0 + 0.4, 1.1, 0.45);
      brass(hz("E3"), t0 + 0.4, 1.1, 0.3);
      tone({ type: "sine", f: 80, f2: 40, t: t0, dur: 0.3, vol: 0.4 });
      tone({ type: "sine", f: 80, f2: 40, t: t0 + 0.4, dur: 0.4, vol: 0.4 });
    }],
    // Victory: a royal fanfare with drums.
    win: [2, (t0) => {
      [["G4", 0, 0.14], ["G4", 0.16, 0.14], ["G4", 0.32, 0.14], ["C5", 0.48, 0.5], ["G4", 1, 0.2], ["C5", 1.2, 0.2], ["E5", 1.4, 0.2], ["G5", 1.6, 1.2]]
        .forEach(([n, d, len]) => { brass(hz(n), t0 + d, len, 0.35); brass(hz(n) / 2, t0 + d, len, 0.15); });
      [0, 0.16, 0.32, 0.48, 1.6].forEach((d) => drum("tom", t0 + d, 0.6, sfxBus));
      noise({ t: t0 + 1.6, dur: 1.4, vol: 0.2, filter: "highpass", f: 5000 });
    }],
    // Defeat: a slow sad tune going down.
    lose: [2, (t0) => {
      [["A4", 0], ["G4", 0.45], ["F4", 0.9], ["E4", 1.35]].forEach(([n, d]) => tone({ type: "triangle", f: hz(n), t: t0 + d, dur: 0.42, vol: 0.28, vib: 0.02 }));
      brass(hz("D3"), t0 + 1.8, 1.6, 0.35);
      brass(hz("A2"), t0 + 1.8, 1.6, 0.2);
      [0, 0.9, 1.8].forEach((d) => drum("kick", t0 + d, 0.7, sfxBus));
    }],

    // The city.
    ageup: [1, (t0) => {
      [["C4", 0], ["E4", 0.12], ["G4", 0.24], ["C5", 0.36]].forEach(([n, d]) => brass(hz(n), t0 + d, d === 0.36 ? 0.9 : 0.12, 0.3));
      noise({ t: t0 + 0.36, dur: 1, vol: 0.18, filter: "highpass", f: 5000 });
      drum("tom", t0 + 0.36, 0.6, sfxBus);
    }],
    build: [0.25, (t0) => [0, 0.14, 0.28].forEach((d) => {
      tone({ type: "triangle", f: 700, f2: 450, t: t0 + d, dur: 0.07, vol: 0.3 });
      noise({ t: t0 + d, dur: 0.05, vol: 0.2, filter: "bandpass", f: 2200, q: 3 });
    })],
    research: [0.5, (t0) => ["E5", "G5", "B5", "E6", "G6"].forEach((n, i) =>
      tone({ type: "sine", f: hz(n), t: t0 + i * 0.06, dur: 0.35, vol: 0.15 }))],
    recruit: [0.4, (t0) => { brass(hz("D4"), t0, 0.12, 0.25); brass(hz("A4"), t0 + 0.14, 0.3, 0.25); }],
    click: [0.04, (t0) => tone({ type: "square", f: 1200, f2: 800, t: t0, dur: 0.03, vol: 0.06 })],
    // Legoworld: a brick clicks on, a brick comes off.
    snap: [0.05, (t0) => {
      tone({ type: "square", f: 1900, f2: 1300, t: t0, dur: 0.025, vol: 0.07 });
      noise({ t: t0 + 0.02, dur: 0.03, vol: 0.12, filter: "bandpass", f: 3200, q: 4 });
    }],
    pop: [0.05, (t0) => tone({ type: "triangle", f: 400, f2: 900, t: t0, dur: 0.08, vol: 0.14 })],

    // Hong Kong Ferries.
    shiphorn: [0.8, (t0) => {
      brass(hz("F2"), t0, 0.9, 0.35);
      brass(hz("C3"), t0, 0.9, 0.22);
      tone({ type: "sine", f: hz("F2"), t: t0, dur: 0.9, vol: 0.3, attack: 0.08 });
    }],
    dock: [0.2, (t0) => {
      tone({ type: "sine", f: hz("E6"), t: t0, dur: 0.35, vol: 0.18 });
      tone({ type: "sine", f: hz("C6"), t: t0 + 0.14, dur: 0.45, vol: 0.18 });
    }],
    hop: [0.05, (t0) => tone({ type: "triangle", f: 520, f2: 880, t: t0, dur: 0.08, vol: 0.12 })],

    // Wobbly Tower.
    turn: [0.05, (t0) => {
      tone({ type: "square", f: 1300, f2: 900, t: t0, dur: 0.03, vol: 0.07 });
      tone({ type: "square", f: 1100, f2: 800, t: t0 + 0.05, dur: 0.03, vol: 0.06 });
    }],
    drop: [0.2, (t0) => tone({ type: "sine", f: 900, f2: 260, t: t0, dur: 0.35, vol: 0.18, vib: 0.04 })],
    thud: [0.09, (t0) => {
      tone({ type: "sine", f: 170, f2: 60, t: t0, dur: 0.14, vol: 0.4 });
      noise({ t: t0, dur: 0.07, vol: 0.15, f: 600 });
    }],
    splash: [0.3, (t0) => {
      noise({ t: t0, dur: 0.7, vol: 0.4, filter: "bandpass", f: 1500, f2: 300, q: 0.8 });
      [0.1, 0.2, 0.32].forEach((d, i) => tone({ type: "sine", f: 500 + i * 180, f2: 1100 + i * 200, t: t0 + d, dur: 0.07, vol: 0.12 }));
    }],

    // Math Rocket.
    right: [0.1, (t0) => {
      tone({ type: "triangle", f: hz("E6"), t: t0, dur: 0.12, vol: 0.18 });
      tone({ type: "triangle", f: hz("A6"), t: t0 + 0.08, dur: 0.22, vol: 0.18 });
    }],
    wrong: [0.3, (t0) => tone({ type: "square", f: 220, f2: 150, t: t0, dur: 0.3, vol: 0.1, cut: 900 })],
    tick: [0.4, (t0) => tone({ type: "sine", f: 1500, t: t0, dur: 0.04, vol: 0.08 })],
    launch: [1, (t0) => {
      noise({ t: t0, dur: 0.9, vol: 0.22, filter: "lowpass", f: 300, f2: 2600, q: 1, attack: 0.1 });
      tone({ type: "sawtooth", f: 80, f2: 400, t: t0, dur: 0.9, vol: 0.1, cut: 900 });
    }],

    // Deep Sea Adventure.
    bubble: [0.12, (t0) => [0, 0.09, 0.2].forEach((d, i) =>
      tone({ type: "sine", f: 300 + i * 120, f2: 900 + i * 200, t: t0 + d, dur: 0.08, vol: 0.16 }))],
    dice: [0.3, (t0) => [0, 0.07, 0.15, 0.21, 0.3].forEach((d, i) =>
      noise({ t: t0 + d, dur: 0.04, vol: 0.22, filter: "bandpass", f: 1800 + (i % 2) * 900, q: 4 }))],
    treasure: [0.3, (t0) => ["G5", "B5", "D6", "G6"].forEach((n, i) =>
      tone({ type: "sine", f: hz(n), t: t0 + i * 0.06, dur: 0.4, vol: 0.14 }))],
    // A diver jumping in uses Wobbly Tower's "splash".

    // Candy Shop: a coin dropped on the counter, a note, and the till's "ka-ching".
    coin: [0.05, (t0) => {
      tone({ type: "sine", f: 2400, t: t0, dur: 0.12, vol: 0.12 });
      tone({ type: "sine", f: 3600, t: t0 + 0.02, dur: 0.18, vol: 0.08 });
    }],
    note: [0.05, (t0) => noise({ t: t0, dur: 0.12, vol: 0.12, filter: "bandpass", f: 3000, f2: 1800, q: 1.5 })],
    till: [0.6, (t0) => {
      noise({ t: t0, dur: 0.08, vol: 0.2, filter: "bandpass", f: 1500, q: 2 });
      ["E6", "G6", "C7"].forEach((n, i) => tone({ type: "sine", f: hz(n), t: t0 + 0.08 + i * 0.07, dur: 0.5, vol: 0.13 }));
    }],
  };

  function play(name) {
    if (mode === "off" || !ac || ac.state !== "running") return;
    const s = SFX[name];
    if (!s) return;
    const now = ac.currentTime;
    if (now - (lastPlayed[name] || -9) < s[0]) return;
    if (voices > 40 && name !== "win" && name !== "lose") return;
    lastPlayed[name] = now;
    s[1](now + 0.005);
  }

  // A plain note of `f` Hz for `secs` seconds, for games with their own tunes (Copy Me).
  function beep(f, secs) {
    if (mode === "off" || !ac || ac.state !== "running") return;
    tone({ type: "triangle", f, t: ac.currentTime + 0.005, dur: secs, vol: 0.35 });
  }

  // ---------- Music ----------

  function drum(kind, t0, vol, bus) {
    bus = bus || musicBus;
    if (kind === "kick") tone({ type: "sine", f: 130, f2: 42, t: t0, dur: 0.3, vol: vol, bus });
    else if (kind === "tom") {
      tone({ type: "sine", f: 180, f2: 80, t: t0, dur: 0.35, vol: vol, bus });
      noise({ t: t0, dur: 0.12, vol: vol * 0.3, f: 800, bus });
    } else if (kind === "snare") {
      noise({ t: t0, dur: 0.16, vol: vol, filter: "bandpass", f: 1800, q: 0.8, bus });
      tone({ type: "triangle", f: 200, f2: 150, t: t0, dur: 0.08, vol: vol * 0.5, bus });
    } else if (kind === "hat") noise({ t: t0, dur: 0.04, vol: vol, filter: "highpass", f: 7000, bus });
  }

  // A tune: bpm, 16 steps a bar, and per bar its chord (root and the other notes, low to high),
  // the melody ([step, note, length in steps]) and the low counter tune, if any.
  // Battle: D minor, a galloping march with drums and a brass tune, like an army on the move.
  const BATTLE = {
    bpm: 132,
    lead: "brass",
    bars: [
      { chord: ["D2", "D3", "A3", "F4"], tune: [[0, "D5", 6], [6, "E5", 2], [8, "F5", 4], [12, "E5", 4]] },
      { chord: ["Bb1", "Bb2", "F3", "D4"], tune: [[0, "D5", 8], [8, "Bb4", 8]] },
      { chord: ["C2", "C3", "G3", "E4"], tune: [[0, "C5", 6], [6, "D5", 2], [8, "E5", 4], [12, "G5", 4]] },
      { chord: ["A1", "A2", "E3", "C#4"], tune: [[0, "E5", 12], [12, "C#5", 4]] },
      { chord: ["D2", "D3", "A3", "F4"], tune: [[0, "F5", 6], [6, "G5", 2], [8, "A5", 4], [12, "F5", 4]] },
      { chord: ["Bb1", "Bb2", "F3", "D4"], tune: [[0, "D5", 6], [6, "F5", 2], [8, "G5", 8]] },
      { chord: ["C2", "C3", "G3", "E4"], tune: [[0, "E5", 4], [4, "G5", 4], [8, "F5", 4], [12, "E5", 4]] },
      { chord: ["A1", "A2", "E3", "C#4"], tune: [[0, "C#5", 4], [4, "E5", 4], [8, "A4", 8]], fill: true },
      // The quieter middle: drums, strings and a low horn.
      { chord: ["G1", "G2", "D3", "Bb3"], low: [[0, "G3", 16]] },
      { chord: ["D2", "D3", "A3", "F4"], low: [[0, "F3", 16]] },
      { chord: ["G1", "G2", "D3", "Bb3"], low: [[0, "G3", 8], [8, "Bb3", 8]] },
      { chord: ["A1", "A2", "E3", "C#4"], low: [[0, "A3", 16]] },
      { chord: ["G1", "G2", "D3", "Bb3"], low: [[0, "Bb3", 16]] },
      { chord: ["D2", "D3", "A3", "F4"], low: [[0, "A3", 16]] },
      { chord: ["Bb1", "Bb2", "F3", "D4"], low: [[0, "F3", 8], [8, "D3", 8]] },
      { chord: ["A1", "A2", "E3", "C#4"], low: [[0, "E3", 8], [8, "C#3", 8]], fill: true },
    ],
    // Gallop: one 8th and two 16ths, on the chord notes.
    pattern: [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15],
    step(bar, s, t0, len) {
      const ch = bar.chord;
      if (s % 8 === 0) tone({ type: "sawtooth", f: hz(ch[0]), t: t0, dur: len * 8, vol: 0.32, cut: 380, bus: musicBus });
      if (this.pattern.includes(s)) pluck(hz(ch[1 + (s % 4 === 0 ? 0 : s % 2 ? 2 : 1)]), t0, len * 1.6, 0.11, musicBus);
      // War drums: big hits on 1 and the "and" of 2, snare on 2 and 4, a roll at the end of a phrase.
      if (s === 0 || s === 6 || s === 8) drum("kick", t0, 0.6);
      if (s === 3 || s === 11) drum("tom", t0, 0.3);
      if (s === 4 || s === 12) drum("snare", t0, 0.28);
      if (s % 2 === 0) drum("hat", t0, 0.05);
      if (bar.fill && s >= 12) drum("tom", t0, 0.35 + (s - 12) * 0.05);
    },
  };

  // Town: G major with a touch of the old modes, a flute over a lute and a soft hand drum.
  const TOWN = {
    bpm: 96,
    lead: "flute",
    bars: [
      { chord: ["G2", "G3", "B3", "D4"], tune: [[0, "G4", 4], [4, "B4", 4], [8, "D5", 8]] },
      { chord: ["F2", "F3", "A3", "C4"], tune: [[0, "C5", 4], [4, "A4", 4], [8, "F4", 8]] },
      { chord: ["C2", "C3", "E3", "G3"], tune: [[0, "E5", 4], [4, "D5", 2], [6, "C5", 2], [8, "G4", 8]] },
      { chord: ["G2", "G3", "B3", "D4"], tune: [[0, "B4", 6], [6, "A4", 2], [8, "G4", 8]] },
      { chord: ["E2", "E3", "G3", "B3"], tune: [[0, "G5", 4], [4, "E5", 4], [8, "B4", 8]] },
      { chord: ["C2", "C3", "E3", "G3"], tune: [[0, "C5", 4], [4, "E5", 4], [8, "G5", 8]] },
      { chord: ["D2", "D3", "F#3", "A3"], tune: [[0, "F#5", 4], [4, "E5", 4], [8, "D5", 4], [12, "A4", 4]] },
      { chord: ["D2", "D3", "F#3", "A3"], tune: [[0, "D5", 12]] },
    ],
    step(bar, s, t0, len) {
      const ch = bar.chord;
      if (s === 0) tone({ type: "triangle", f: hz(ch[0]), t: t0, dur: len * 15, vol: 0.3, bus: musicBus });
      // Lute: up and down the chord in 8ths.
      if (s % 2 === 0) pluck(hz(ch[[1, 2, 3, 2][(s / 2) % 4]]) * (s >= 8 && s % 4 === 0 ? 2 : 1), t0, len * 3, 0.09, musicBus);
      if (s === 0 || s === 10) drum("tom", t0, 0.18);
      if (s === 6 || s === 14) drum("hat", t0, 0.04);
    },
  };

  // Harbour (Hong Kong Ferries): a light pentatonic tune on a flute, gently rocking like the sea.
  const HARBOUR = {
    bpm: 88,
    lead: "flute",
    bars: [
      { chord: ["C2", "C3", "G3", "E4"], tune: [[0, "E5", 4], [4, "G5", 4], [8, "A5", 6], [14, "G5", 2]] },
      { chord: ["A1", "A2", "E3", "C4"], tune: [[0, "E5", 4], [4, "D5", 4], [8, "C5", 8]] },
      { chord: ["F2", "F3", "C4", "A4"], tune: [[0, "D5", 4], [4, "E5", 4], [8, "G5", 4], [12, "E5", 4]] },
      { chord: ["G2", "G3", "D4", "B3"], tune: [[0, "D5", 12]] },
      { chord: ["C2", "C3", "G3", "E4"], tune: [[0, "G5", 4], [4, "A5", 4], [8, "C6", 6], [14, "A5", 2]] },
      { chord: ["A1", "A2", "E3", "C4"], tune: [[0, "G5", 4], [4, "E5", 4], [8, "D5", 8]] },
      { chord: ["F2", "F3", "C4", "A4"], tune: [[0, "C5", 4], [4, "D5", 4], [8, "E5", 4], [12, "D5", 4]] },
      { chord: ["C2", "C3", "G3", "E4"], tune: [[0, "C5", 12]] },
    ],
    step(bar, s, t0, len) {
      const ch = bar.chord;
      if (s === 0) tone({ type: "triangle", f: hz(ch[0]), t: t0, dur: len * 15, vol: 0.26, bus: musicBus });
      // A soft harp going up and down the chord, like small waves.
      if (s % 4 === 0) pluck(hz(ch[[1, 2, 3, 2][(s / 4) % 4]]), t0, len * 4, 0.08, musicBus);
      if (s === 8) drum("hat", t0, 0.03);
    },
  };

  // Space (Math Rocket): a bouncy, twinkly tune going up and down the chord, like stars blinking.
  const SPACE = {
    bpm: 108,
    lead: "flute",
    bars: [
      { chord: ["C2", "C4", "E4", "G4"], tune: [[0, "G5", 2], [2, "E5", 2], [4, "C5", 2], [6, "E5", 2], [8, "G5", 4], [12, "C6", 4]] },
      { chord: ["F2", "C4", "F4", "A4"], tune: [[0, "A5", 2], [2, "F5", 2], [4, "C5", 2], [6, "F5", 2], [8, "A5", 4], [12, "C6", 4]] },
      { chord: ["G2", "D4", "G4", "B4"], tune: [[0, "B5", 2], [2, "G5", 2], [4, "D5", 2], [6, "G5", 2], [8, "B5", 4], [12, "D6", 4]] },
      { chord: ["C2", "C4", "E4", "G4"], tune: [[0, "C6", 8], [8, "G5", 8]] },
      { chord: ["A1", "C4", "E4", "A4"], tune: [[0, "E5", 2], [2, "A5", 2], [4, "C6", 2], [6, "A5", 2], [8, "E5", 4], [12, "A5", 4]] },
      { chord: ["F2", "C4", "F4", "A4"], tune: [[0, "F5", 2], [2, "A5", 2], [4, "C6", 2], [6, "A5", 2], [8, "F5", 4], [12, "C6", 4]] },
      { chord: ["G2", "D4", "G4", "B4"], tune: [[0, "D6", 4], [4, "B5", 4], [8, "G5", 4], [12, "B5", 4]] },
      { chord: ["C2", "C4", "E4", "G4"], tune: [[0, "C6", 12]] },
    ],
    step(bar, s, t0, len) {
      const ch = bar.chord;
      if (s === 0 || s === 8) tone({ type: "triangle", f: hz(ch[0]), t: t0, dur: len * 7, vol: 0.24, bus: musicBus });
      // Little bells on the off-beats.
      if (s % 4 === 2) pluck(hz(ch[1 + (s / 2 + 1) % 3]) * 2, t0, len * 2, 0.05, musicBus);
      if (s === 4 || s === 12) drum("hat", t0, 0.03);
    },
  };

  // Deep sea (Deep Sea Adventure): a slow, dreamy tune in A minor, with bubbles of harp.
  const DEEP = {
    bpm: 72,
    lead: "flute",
    bars: [
      { chord: ["A1", "A2", "E3", "C4"], tune: [[0, "A4", 6], [6, "C5", 2], [8, "E5", 8]] },
      { chord: ["F1", "F2", "C3", "A3"], tune: [[0, "D5", 6], [6, "C5", 2], [8, "A4", 8]] },
      { chord: ["G1", "G2", "D3", "B3"], tune: [[0, "B4", 6], [6, "D5", 2], [8, "G5", 6], [14, "E5", 2]] },
      { chord: ["E1", "E2", "B2", "G#3"], tune: [[0, "E5", 12]] },
      { chord: ["A1", "A2", "E3", "C4"], tune: [[0, "E5", 6], [6, "D5", 2], [8, "C5", 8]] },
      { chord: ["D2", "D3", "A3", "F4"], tune: [[0, "F5", 6], [6, "E5", 2], [8, "D5", 8]] },
      { chord: ["E1", "E2", "B2", "G#3"], tune: [[0, "B4", 4], [4, "C5", 4], [8, "D5", 4], [12, "B4", 4]] },
      { chord: ["A1", "A2", "E3", "C4"], tune: [[0, "A4", 12]] },
    ],
    step(bar, s, t0, len) {
      const ch = bar.chord;
      if (s === 0) tone({ type: "sine", f: hz(ch[1]), t: t0, dur: len * 15, vol: 0.3, attack: 0.3, bus: musicBus });
      if (s % 4 === 2) pluck(hz(ch[[1, 2, 3, 2][(s >> 2) % 4]]) * 2, t0, len * 4, 0.06, musicBus);
    },
  };

  // Nest (Times Table Eggs): a happy, hopping tune in G, with a marimba bouncing under it.
  const NEST = {
    bpm: 112,
    lead: "flute",
    bars: [
      { chord: ["G2", "G3", "B3", "D4"], tune: [[0, "D5", 2], [2, "G5", 2], [4, "B5", 4], [8, "A5", 2], [10, "G5", 2], [12, "D5", 4]] },
      { chord: ["C3", "C4", "E4", "G4"], tune: [[0, "E5", 2], [2, "G5", 2], [4, "C6", 4], [8, "B5", 2], [10, "A5", 2], [12, "G5", 4]] },
      { chord: ["D3", "D4", "F#4", "A4"], tune: [[0, "F#5", 2], [2, "A5", 2], [4, "D6", 4], [8, "C6", 2], [10, "A5", 2], [12, "F#5", 4]] },
      { chord: ["G2", "G3", "B3", "D4"], tune: [[0, "G5", 8], [8, "D5", 4], [12, "B4", 4]] },
      { chord: ["E2", "E3", "G3", "B3"], tune: [[0, "B5", 2], [2, "A5", 2], [4, "G5", 4], [8, "E5", 4], [12, "G5", 4]] },
      { chord: ["C3", "C4", "E4", "G4"], tune: [[0, "C6", 2], [2, "B5", 2], [4, "A5", 4], [8, "G5", 4], [12, "E5", 4]] },
      { chord: ["D3", "D4", "F#4", "A4"], tune: [[0, "D5", 4], [4, "F#5", 4], [8, "A5", 4], [12, "C6", 4]] },
      { chord: ["G2", "G3", "B3", "D4"], tune: [[0, "B5", 4], [4, "G5", 8]] },
    ],
    step(bar, s, t0, len) {
      const ch = bar.chord;
      if (s % 8 === 0) tone({ type: "triangle", f: hz(ch[0]), t: t0, dur: len * 3, vol: 0.28, bus: musicBus });
      if (s % 8 === 4) tone({ type: "triangle", f: hz(ch[2]) / 2, t: t0, dur: len * 2, vol: 0.2, bus: musicBus });
      // A marimba hopping up the chord, like a frog on the stones.
      if (s % 2 === 0) tone({ type: "sine", f: hz(ch[1 + (s / 2) % 3]) * 2, t: t0, dur: len * 1.5, vol: 0.07, attack: 0.002, bus: musicBus });
      if (s === 4 || s === 12) drum("hat", t0, 0.03);
    },
  };

  // Shop (Candy Shop): a sweet little tune in F with a music-box bell, like a shop's radio.
  const SHOP = {
    bpm: 100,
    lead: "flute",
    bars: [
      { chord: ["F2", "A3", "C4", "F4"], tune: [[0, "C5", 2], [2, "F5", 2], [4, "A5", 4], [8, "G5", 2], [10, "F5", 2], [12, "A5", 4]] },
      { chord: ["D2", "A3", "D4", "F4"], tune: [[0, "D5", 2], [2, "F5", 2], [4, "A5", 4], [8, "C6", 4], [12, "A5", 4]] },
      { chord: ["Bb1", "Bb3", "D4", "F4"], tune: [[0, "Bb5", 4], [4, "A5", 2], [6, "G5", 2], [8, "F5", 4], [12, "D5", 4]] },
      { chord: ["C2", "G3", "C4", "E4"], tune: [[0, "E5", 4], [4, "G5", 4], [8, "C5", 8]] },
      { chord: ["F2", "A3", "C4", "F4"], tune: [[0, "A5", 2], [2, "C6", 2], [4, "A5", 4], [8, "F5", 2], [10, "G5", 2], [12, "A5", 4]] },
      { chord: ["Bb1", "Bb3", "D4", "F4"], tune: [[0, "D6", 4], [4, "C6", 2], [6, "Bb5", 2], [8, "A5", 4], [12, "G5", 4]] },
      { chord: ["C2", "G3", "C4", "E4"], tune: [[0, "G5", 2], [2, "A5", 2], [4, "Bb5", 4], [8, "E5", 4], [12, "G5", 4]] },
      { chord: ["F2", "A3", "C4", "F4"], tune: [[0, "F5", 12]] },
    ],
    step(bar, s, t0, len) {
      const ch = bar.chord;
      if (s % 8 === 0) tone({ type: "triangle", f: hz(ch[0]), t: t0, dur: len * 3, vol: 0.26, bus: musicBus });
      if (s % 8 === 4) tone({ type: "triangle", f: hz(ch[1]) / 2, t: t0, dur: len * 2, vol: 0.18, bus: musicBus });
      // A music-box bell going round the chord.
      if (s % 2 === 1) tone({ type: "sine", f: hz(ch[1 + ((s - 1) / 2) % 3]) * 2, t: t0, dur: len * 2, vol: 0.05, attack: 0.002, bus: musicBus });
      if (s === 4 || s === 12) drum("hat", t0, 0.03);
    },
  };

  const TRACKS = { battle: BATTLE, town: TOWN, harbour: HARBOUR, space: SPACE, deep: DEEP, nest: NEST, shop: SHOP };
  let wanted = null;   // the tune the game asks for
  let playing = null;  // { name, song, gain, step, next }
  let timer = null;

  function lead(song, note, t0, dur) {
    if (song.lead === "brass") brass(hz(note), t0, dur, 0.3, musicBus);
    else tone({ type: "triangle", f: hz(note), t: t0, dur, vol: 0.26, attack: 0.04, vib: 0.012, bus: musicBus });
  }

  function schedule() {
    const p = playing;
    if (!p || ac.state !== "running") return;
    const len = 60 / p.song.bpm / 4;
    if (p.next < ac.currentTime) p.next = ac.currentTime + 0.05; // after a pause, start again from now
    if (p.song.play) { p.song.play(p, ac); return; } // a tune with its own player (see addTrack)
    const saved = musicBus;
    musicBus = p.gain; // every note of this tune goes through its own fader
    while (p.next < ac.currentTime + 0.2) {
      const bar = p.song.bars[Math.floor(p.step / 16)];
      const s = p.step % 16;
      p.song.step(bar, s, p.next, len);
      (bar.tune || []).forEach(([at, n, l]) => { if (at === s) lead(p.song, n, p.next, l * len * 0.95); });
      (bar.low || []).forEach(([at, n, l]) => { if (at === s) brass(hz(n), p.next, l * len * 0.95, 0.22, musicBus); });
      p.next += len;
      p.step = (p.step + 1) % (p.song.bars.length * 16);
    }
    musicBus = saved;
  }

  function stopTune() {
    if (!playing) return;
    const gn = playing.gain;
    gn.gain.setTargetAtTime(0, ac.currentTime, 0.15);
    setTimeout(() => gn.disconnect(), 1500);
    playing = null;
  }

  // Start, change or stop the tune to match what the game wants and the 🔊 button.
  function syncMusic() {
    if (!ac) return;
    const name = mode === "on" ? wanted : null;
    if ((playing && playing.name) === name) return;
    stopTune();
    if (name && TRACKS[name]) {
      const gain = ac.createGain();
      gain.gain.setValueAtTime(0.0001, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(1, ac.currentTime + 0.6);
      gain.connect(musicBus);
      playing = { name, song: TRACKS[name], gain, step: 0, next: ac.currentTime + 0.1 };
    }
    if (playing && !timer) timer = setInterval(schedule, 40);
    if (!playing && timer) { clearInterval(timer); timer = null; }
    if (playing) schedule();
  }

  function music(name) {
    if (name === wanted) return;
    wanted = name;
    syncMusic();
  }

  // ---------- The 🔊 button ----------

  function paint(btn) {
    btn.textContent = ICONS[mode];
    btn.setAttribute("aria-label", t(LABELS[mode]));
    btn.title = t(LABELS[mode]);
    btn.setAttribute("aria-pressed", mode === "on");
  }

  function setMode(m) {
    mode = m;
    mediaChannel(m === "on");
    buttons.forEach(paint);
    syncMusic();
  }

  function button() {
    const btn = document.createElement("button");
    btn.className = "btn sound-toggle";
    btn.type = "button";
    paint(btn);
    // A tap on the button must not start the battle behind it.
    btn.addEventListener("pointerdown", (e) => e.stopPropagation());
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      setMode(mode === "on" ? "off" : "on");
      unlock();
      play("click");
      btn.blur();
    });
    buttons.push(btn);
    return btn;
  }

  // The first tap or key anywhere turns the sound on (the browser's rule).
  ["pointerdown", "touchend", "keydown"].forEach((ev) => window.addEventListener(ev, unlock, true));
  // Quiet when the page is hidden (another app, the phone locked).
  document.addEventListener("visibilitychange", () => {
    if (mode === "on") mediaChannel(!document.hidden);
    if (!ac) return;
    if (document.hidden) ac.suspend();
    else ac.resume();
  });

  return {
    play, music, button, beep,
    // A game can bring its own tunes: song.play(p, ac) is called every 40 ms while the tune is on,
    // and plays its notes ahead into p.gain (the tune's fader), keeping its place in p.next and p.step.
    addTrack(name, song) { TRACKS[name] = song; },
    get mode() { return mode; },
    // The sound of each weapon's shot, by its kind (see WEAPONS in the games).
    shot(kind) { play(SFX[kind] ? kind : "dart"); },
    // For the test script.
    get state() { return ac ? ac.state : "locked"; },
    get tune() { return playing && playing.name; },
    get channel() { return !!keepAlive && !keepAlive.paused; },
    setMode,
  };
})();
