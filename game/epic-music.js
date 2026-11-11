// Army Rush City's music: an epic battle score for every age of the city, played live by a small
// orchestra made with the Web Audio API (no sound files, nothing copied from another game).
// Strings, horns and trumpets, a choir, big war drums, plucked harps, lutes and zithers built
// string by string (Karplus-Strong), flutes with breath, and synths for the modern ages, all in
// a concert hall (a reverb). Each age has its own key, mode, tempo, tune and instruments:
// war drums and a bone flute in the Stone Age, an oud and a ney in Egypt, a guzheng, a dizi and
// gongs in China, a men's choir in the Viking Age, harpsichord and trumpets in the Renaissance,
// anvils in the Industrial Age, synths and huge "braams" for robots and the AI Empire...
//
// Two moods: "calm" (the start screen, the city between attacks) keeps the tune, the harmony
// and a few drums; "battle" brings in the full orchestra. The mood changes at the next bar, so
// the music never jumps. The game calls Sound.music("epic" + age) and sets EpicMusic.mood.
//
// EpicMusic.render(ac, out, age, mood, seconds) plays a stretch into any AudioContext (the
// preview script uses it with an OfflineAudioContext).
window.EpicMusic = (function () {
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const SCALES = {
    minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    phrygdom: [0, 1, 4, 5, 7, 8, 10], // the Egyptian sound: a minor second and a major third
    harmonic: [0, 2, 3, 5, 7, 8, 11],
    lydian: [0, 2, 4, 6, 7, 9, 11],
  };
  // "D2" -> 38
  function midi(n) {
    const m = /^([A-G])([#b]?)(\d)$/.exec(n);
    return 12 * (+m[3] + 1) + { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
  }

  // ---------- The ages ----------
  // key = the bass note, chords = the scale degree of each bar (4 bars, played twice),
  // tune = 4 bars of eighth notes: a scale degree (8 = an octave up, _5 = an octave down,
  // # = a half step up), "-" holds, "." rests. lead = [calm, battle] instrument.
  // arp = a figure on the chord in sixteenths (1 3 5 = the chord's notes, 8 = the root up high).
  // drums = { voice: 16 steps } for the battle, calmDrums for the calm mood: X loud, x, o soft.
  const AGES = [
    { // Stone Age: war drums, a men's chant, a didgeridoo drone and a bone flute.
      bpm: 88, key: "D2", scale: "minor", chords: [1, 1, 7, 1],
      tune: "1 - - 3 5 - 4 3 | 1 - - - _5 - - . | 7 - - 2 4 - 5 4 | 1 - - - - - . .",
      lead: ["flute", "horn"], pad: "chant", drone: true,
      drums: { taiko: "X..x..X.x.X.x...", tom: "....x.....x.x.xx", tek: "..o...o...o...o." },
      calmDrums: { dum: "x.....o...x.o...", tek: "....o.......o..." }, boom: true,
    },
    { // First Farmers: a harp, a wooden flute, frame drums and horns.
      bpm: 84, key: "E2", scale: "dorian", chords: [1, 4, 1, 7],
      tune: "1 - 3 5 8 - 7 5 | 6 - - 4 6 - 8 - | 5 - 3 5 7 - 5 3 | 2 - 4 - 7 - - -",
      lead: ["flute", "horns"], pad: "strings", arp: { inst: "harp", pat: "1.3.5.8.5.3.1.3.", calm: true },
      drums: { taiko: "X.....x.X...x...", dum: "..x...x...x..x.x", hat: "o.o.o.o.o.o.o.o." },
      calmDrums: { dum: "x.......o.......", hat: "..o...o...o...o." }, boom: true,
    },
    { // Egyptian Empire: an oud, a ney flute that slides, darbukas and a choir.
      bpm: 96, key: "D2", scale: "phrygdom", chords: [1, 2, 1, 7],
      tune: "5 - 6 5 3 - 2 1 | 2 - - 3 4 - 6 - | 5 - 6 8 7 - 6 5 | 4 - 3 2 _7 - - -",
      lead: ["ney", "horns"], pad: "strings", choir: "a", arp: { inst: "oud", pat: "1.18.1.35.3.1.5.", calm: true },
      drums: { taiko: "X.....x.X.....x.", dum: "x..tx.t.x..tx.tt", tek: "...x..x....x..xx" },
      calmDrums: { dum: "x.....x.x.......", tek: "...o..o....o..o." }, boom: true,
    },
    { // Ancient Greece: a lyre, heroic horns, strings and a choir.
      bpm: 100, key: "A1", scale: "dorian", chords: [1, 4, 7, 1],
      tune: "1 - 5 - 8 - 7 5 | 6 - 4 - 8 - - - | 7 - 6 5 4 - 2 - | 3 - 2 - 1 - - -",
      lead: ["strings", "horns"], pad: "strings", choir: "a", arp: { inst: "lyre", pat: "1358531813585318", calm: true },
      drums: { taiko: "X.......X...x...", tom: "....x.......x.x.", snare: "..o...o...o...o." },
      calmDrums: { dum: "x.......x.......", tek: "....o.......o..." }, boom: true,
    },
    { // Roman Empire: a marching army, trumpet fanfares, driving strings and a choir.
      bpm: 108, key: "C2", scale: "minor", chords: [1, 6, 3, 7],
      tune: "1 . 1 1 5 - 5 . | 6 - - 5 3 - - . | 5 . 5 5 7 - 8 . | 9 - - 7 4 - - -",
      lead: ["strings", "trumpet"], pad: "strings", choir: "a", arp: { inst: "spicc", pat: "1.1.1.1.1.1.5.5." },
      drums: { taiko: "X...x...X...x...", snare: "x.xxx.x.x.xxx.xx", timp: "X.......x......." },
      calmDrums: { snare: "o...o.o.o...o.o.", timp: "x..............." }, boom: true, swell: true,
    },
    { // Chinese Empire: a guzheng, a dizi flute, huge drums and gongs.
      bpm: 96, key: "G1", scale: "minor", chords: [1, 7, 6, 7],
      tune: "5 - 7 8 7 - 5 4 | 4 - 5 - 7 - - - | 8 - 7 5 3 - 4 3 | 4 - - 5 7 - - -",
      lead: ["dizi", "dizi"], lead2: "horns", pad: "strings", arp: { inst: "zheng", pat: "1.5.8.5.3.5.8.5.", calm: true },
      drums: { taiko: "X...X.x.X...X.xx", tom: "..x.....x.x.....", hat: "..x...x...x...x." },
      calmDrums: { dum: "x.......x.....o.", hat: "......o.......o." }, gong: true, boom: true,
    },
    { // Viking Age: a deep men's choir, a horn, a drone and slow, heavy drums.
      bpm: 80, key: "E2", scale: "minor", chords: [1, 1, 6, 7],
      tune: "1 - - - 5 - - 4 | 3 - - - 1 - - - | 3 - - 4 6 - 5 4 | 2 - - - 4 - 5 -",
      lead: ["choirLead", "horn"], pad: "chant", drone: true, arp: { inst: "lyre", pat: "1...5...8...5...", calm: true },
      drums: { taiko: "X.....x.X.......", tom: "........x...x.x.", dum: "..x...x...x...x." },
      calmDrums: { dum: "x.......x......." }, boom: true,
    },
    { // Middle Ages: a cathedral choir, war drums, timpani and horns.
      bpm: 104, key: "D2", scale: "dorian", chords: [1, 7, 4, 1],
      tune: "1 - 3 4 5 - 4 3 | 4 - 2 - _7 - - - | 6 - 5 4 8 - 6 - | 5 - 4 3 1 - - -",
      lead: ["choirLead", "horns"], lead2: "choirLead", pad: "strings", choir: "a", arp: { inst: "spicc", pat: "1.11.1.11.1.11.1" },
      drums: { taiko: "X.......X.......", snare: "x..x..x.x.x.xxxx", timp: "X...x...X...x..." },
      calmDrums: { snare: "o.......o.o.....", timp: "x.......o......." }, boom: true, swell: true,
    },
    { // Renaissance: a harpsichord, strings and trumpets.
      bpm: 112, key: "G1", scale: "harmonic", chords: [1, 4, 5, 1],
      tune: "5 - 3 1 5 - 8 - | 6 - 4 - 8 - 6 4 | 5 - 7 - 9 - 7 5 | 8 - - - - - . .",
      lead: ["strings", "trumpet"], pad: "strings", choir: "a", arp: { inst: "harpsichord", pat: "1358538513585385", calm: true },
      drums: { timp: "X...x...X...x.x.", snare: "..x...x...x.x.x.", taiko: "X.......X......." },
      calmDrums: { timp: "x.......o......." }, swell: true,
    },
    { // Age of Explorers: a galloping orchestra, horns, a harp and the sea.
      bpm: 100, key: "D2", scale: "minor", chords: [6, 7, 1, 1],
      tune: "3 - 1 - 6 - 5 3 | 4 - 2 - 7 - 6 5 | 5 - 3 5 8 - 9 - | 8 - - - - - . .",
      lead: ["flute", "horns"], pad: "strings", choir: "o", arp: { inst: "spicc", pat: "1.11.1.11.1.11.1" }, arp2: { inst: "harp", pat: "1.5.8.5.3.5.8.5.", calm: true },
      drums: { taiko: "X.....x.X.....x.", snare: "..x...x...x...xx", timp: "X..............." },
      calmDrums: { dum: "x.......x.......", hat: "..o...o...o...o." }, boom: true, swell: true,
    },
    { // Industrial Age: anvils and hammers, low strings that chug, brass.
      bpm: 110, key: "C2", scale: "harmonic", chords: [1, 1, 6, 5],
      tune: "1 . 1 3 5 . 3 1 | 2 - 3 - 1 - - - | 3 . 3 1 6 - 5 3 | 2 - _7 - _5 - - -",
      lead: ["strings", "horns"], pad: "strings", arp: { inst: "chug", pat: "1111111111111111" }, arp2: { inst: "harp", pat: "1.5.8.5.1.5.8.5.", calm: true },
      drums: { taiko: "X.....x.X.....x.", anvil: "....x.......x..x", timp: "X.......X......." },
      calmDrums: { anvil: "....o.......o...", dum: "x.......x......." }, boom: true, swell: true,
    },
    { // Railway Age: a train rhythm, trumpets and strings.
      bpm: 120, key: "A1", scale: "minor", chords: [1, 4, 6, 7],
      tune: "5 - - 5 8 - 7 5 | 6 - - 4 6 - 8 - | 8 - - 6 3 - 6 8 | 9 - - 7 4 - 5 -",
      lead: ["flute", "trumpet"], pad: "strings", arp: { inst: "spicc", pat: "1.11.1.11.1.11.1" },
      drums: { hat: "xoxoxoxoxoxoxoxo", snare: "....x.......x...", taiko: "X.....x.X.......", anvil: "...............x" },
      calmDrums: { hat: "o.o.o.o.o.o.o.o.", dum: "x.......x......." }, boom: true, swell: true,
    },
    { // Electric Age: a humming synth under the orchestra.
      bpm: 116, key: "E2", scale: "minor", chords: [1, 6, 3, 7],
      tune: "1 - 5 - 4 3 2 1 | 3 - - - 1 - _6 - | 5 - 7 - 9 - 7 5 | 4 - - - 2 - - -",
      lead: ["strings", "horns"], pad: "synth", choir: "a", arp: { inst: "synth", pat: "1358135813581358", calm: true }, bass: "pulse",
      drums: { taiko: "X.....x.X...x...", snare: "....x.......x...", hat: "..x...x...x...x." },
      calmDrums: { hat: "..o...o...o...o.", dum: "x.......x......." }, boom: true, swell: true,
    },
    { // Age of Cars: a driving beat, a pulsing bass, brass.
      bpm: 124, key: "G1", scale: "minor", chords: [1, 7, 6, 7],
      tune: "5 . 5 . 8 - 5 . | 4 - - 2 _7 - - . | 3 . 3 . 6 - 8 . | 7 - - 9 11 - - -",
      lead: ["strings", "horns"], pad: "strings", arp: { inst: "spicc", pat: "1.1.5.1.1.1.5.1." }, bass: "pulse",
      drums: { taiko: "X.....x.X.....x.", snare: "....X.......X...", hat: "x.x.x.x.x.x.x.x." },
      calmDrums: { hat: "o...o...o...o...", dum: "x.......x......." }, boom: true, swell: true,
    },
    { // Jet Age: fast strings, high trumpets, drum rolls.
      bpm: 132, key: "B1", scale: "minor", chords: [1, 3, 7, 6],
      tune: "8 - 5 - 1 - 3 5 | 7 - - 5 3 - - . | 9 - 7 - 4 - 2 4 | 3 - - - 1 - - -",
      lead: ["strings", "trumpet"], pad: "strings", choir: "a", arp: { inst: "spicc", pat: "1515151515151515" }, bass: "pulse",
      drums: { taiko: "X..x..x.X..x..x.", snare: "....x.......xxxx", hat: "x.x.x.x.x.x.x.x." },
      calmDrums: { hat: "o.o.o.o.o.o.o.o.", dum: "x.......x......." }, boom: true, swell: true,
    },
    { // Space Age: a choir and synths among the stars, slow and huge.
      bpm: 92, key: "D2", scale: "lydian", chords: [1, 2, 6, 5],
      tune: "1 - - - 5 - 3 - | 4 - - - 2 - - - | 3 - - - 6 - 8 - | 7 - - - 5 - - -",
      lead: ["strings", "horns"], lead2: "choirLead", pad: "synth", choir: "a", arp: { inst: "synth", pat: "1358538513585385", calm: true },
      drums: { taiko: "X.......x.....x.", tom: "........x.x....." },
      calmDrums: { dum: "x..............." }, boom: true, swell: true, braam: true,
    },
    { // Computer Age: fast synth arpeggios, strings and brass.
      bpm: 120, key: "F1", scale: "harmonic", chords: [1, 6, 4, 5],
      tune: "5 - 3 - 1 - 3 5 | 6 - - 8 6 - 3 - | 4 - 6 - 8 - 6 4 | 5 - 7 - 9 - - -",
      lead: ["synthLead", "horns"], lead2: "synthLead", pad: "synth", arp: { inst: "synth", pat: "1358135813581358", calm: true }, bass: "pulse",
      drums: { taiko: "X.....x.X.....x.", snare: "....x.......x...", hat: "xxxxxxxxxxxxxxxx" },
      calmDrums: { hat: "o.o.o.o.o.o.o.o.", dum: "x.......x......." }, boom: true, swell: true,
    },
    { // Internet Age: everything faster, a choir and braams.
      bpm: 128, key: "C#2", scale: "minor", chords: [1, 6, 4, 7],
      tune: "8 - 7 5 3 - 5 - | 6 - 8 - 10 - 8 6 | 4 - 6 8 11 - 8 - | 9 - - 7 4 - - -",
      lead: ["synthLead", "trumpet"], lead2: "synthLead", pad: "synth", choir: "a", arp: { inst: "synth", pat: "1358538513585385", calm: true }, bass: "pulse",
      drums: { taiko: "X..x..x.X..x..x.", snare: "....x.......x.x.", hat: "x.x.x.x.x.x.x.x." },
      calmDrums: { hat: "o.o.o.o.o.o.o.o.", dum: "x.......x......." }, boom: true, swell: true, braam: true,
    },
    { // Robot Age: metal hits, a growling bass and braams.
      bpm: 112, key: "A1", scale: "phrygian", chords: [1, 2, 1, 7],
      tune: "1 - - 2 1 - 5 - | 4 - - 2 6 - - - | 5 - 6 5 3 - 2 1 | 2 - - - _7 - - -",
      lead: ["synthLead", "horns"], pad: "synth", choir: "o", arp: { inst: "synth", pat: "1.1.8.1.1.1.5.1.", calm: true }, bass: "pulse",
      drums: { taiko: "X.....x.X.x.....", anvil: "....x.......x.x.", snare: "....x.......x..." },
      calmDrums: { anvil: "....o.......o...", dum: "x.......x......." }, boom: true, swell: true, braam: true,
    },
    { // AI Empire: a dark choir, huge braams, glitching synths, the biggest drums.
      bpm: 104, key: "D2", scale: "harmonic", chords: [1, 6, 4, 5],
      tune: "1 - 2 3 5 - 3 - | 6 - - 5 3 - 1 - | 4 - 6 - 8 - 6 4 | 9 - - 7 5 - - -",
      lead: ["choirLead", "horns"], lead2: "synthLead", pad: "synth", choir: "o", arp: { inst: "synth", pat: "1358853113588531", calm: true }, bass: "pulse",
      drums: { taiko: "X..x..X.x.X.x..x", tom: "....x.....x.x.xx", anvil: "....x.......x...", snare: "..............xx" },
      calmDrums: { dum: "x.....o.x.......", anvil: "....o..........." }, boom: true, swell: true, braam: true, gong: true,
    },
  ];

  // Turns the written tune into [step, semitones above the key + 2 octaves, length in steps].
  function parseTune(age) {
    const sc = SCALES[age.scale];
    const notes = [];
    age.tune.replace(/\|/g, " ").trim().split(/\s+/).forEach((tok, i) => {
      if (tok === "-") { if (notes.length && notes[notes.length - 1].open) notes[notes.length - 1].len += 2; return; }
      if (notes.length) notes[notes.length - 1].open = false;
      if (tok === ".") return;
      const m = /^(_?)(\d+)(#?)$/.exec(tok);
      const d = +m[2] - 1;
      const semi = sc[d % 7] + 12 * Math.floor(d / 7) - (m[1] ? 12 : 0) + (m[3] ? 1 : 0);
      notes.push({ at: i * 2, semi, len: 2, open: true });
    });
    return notes;
  }
  // The chord of a bar: its root, third and fifth in semitones above the key.
  function chordOf(age, bar) {
    const sc = SCALES[age.scale], d = age.chords[bar % age.chords.length] - 1;
    const tone = (k) => sc[(d + k) % 7] + 12 * Math.floor((d + k) / 7);
    return [tone(0), tone(2), tone(4)];
  }

  // ---------- The concert hall ----------

  const shared = new WeakMap(); // AudioContext -> its noise, its hall and its plucked strings
  function stuff(ac) {
    let s = shared.get(ac);
    if (s) return s;
    const sr = ac.sampleRate;
    const noise = ac.createBuffer(1, sr, sr);
    const nd = noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    // A big hall: two channels of noise dying away over 3 seconds, darker as it dies.
    const len = Math.floor(sr * 3.2);
    const hall = ac.createBuffer(2, len, sr);
    for (let c = 0; c < 2; c++) {
      const d = hall.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const k = i / len;
        const a = 0.25 + 0.7 * k; // the high end fades first
        lp += (Math.random() * 2 - 1 - lp) * (1 - a);
        d[i] = lp * Math.pow(1 - k, 2.6) * (i < sr * 0.012 ? i / (sr * 0.012) : 1);
      }
    }
    s = { noise, hall, strings: {} };
    shared.set(ac, s);
    return s;
  }

  // How loud each mood plays: the battle has many more instruments.
  const LEVEL = { calm: 1.5, battle: 0.62 };

  // Each tune gets its own little mixer: a dry path and three sends to the hall.
  function mixer(ac, out) {
    const s = stuff(ac);
    const tone = ac.createBiquadFilter();
    tone.type = "lowpass"; tone.frequency.value = 9000; tone.Q.value = 0.5;
    const body = ac.createBiquadFilter();
    body.type = "lowshelf"; body.frequency.value = 140; body.gain.value = 2;
    const level = ac.createGain(); level.gain.value = LEVEL.calm;
    tone.connect(body).connect(level).connect(out);
    const dry = ac.createGain(); dry.gain.value = 0.9; dry.connect(tone);
    const verb = ac.createConvolver(); verb.buffer = s.hall;
    const wet = ac.createGain(); wet.gain.value = 0.55;
    verb.connect(wet).connect(tone);
    const send = [0.12, 0.3, 0.6].map((v) => { const g = ac.createGain(); g.gain.value = v; g.connect(verb); return g; });
    // One slow wobble shared by all the long notes (a vibrato for every note would cost too much).
    const vib = [4.9, 5.4].map((rate) => {
      const l = ac.createOscillator(), d = ac.createGain();
      l.frequency.value = rate; d.gain.value = 9;
      l.connect(d); l.start();
      return d;
    });
    return { ac, s, dry, send, out, level, vib, buses: {} };
  }

  // ---------- The players ----------

  // A gain that rises, holds and dies away, sent to the hall; pan from -1 to 1.
  function amp(fx, t, vol, attack, hold, release, pan, room) {
    const ac = fx.ac;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.setValueAtTime(vol, t + attack + hold);
    g.gain.setTargetAtTime(0, t + attack + hold, release / 4);
    let node = g;
    if (pan && ac.createStereoPanner) {
      const p = ac.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      node = p;
    }
    node.connect(fx.dry);
    node.connect(fx.send[room == null ? 1 : room]);
    return { g, end: t + attack + hold + release + 0.05 };
  }
  // The same rise, hold and fade into a shared bus (cheaper: one filter for a whole section).
  function env(fx, t, vol, attack, hold, release, dest) {
    const g = fx.ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.setValueAtTime(vol, t + attack + hold);
    g.gain.setTargetAtTime(0, t + attack + hold, release / 4);
    g.connect(dest);
    return { g, end: t + attack + hold + release + 0.05 };
  }
  // A section's shared bus: made once, then every note of that section goes into it.
  function bus(fx, name, make) {
    if (!fx.buses[name]) fx.buses[name] = make();
    return fx.buses[name];
  }
  function toHall(fx, node, pan, room) {
    let out = node;
    if (pan && fx.ac.createStereoPanner) {
      const p = fx.ac.createStereoPanner();
      p.pan.value = pan;
      node.connect(p);
      out = p;
    }
    out.connect(fx.dry);
    out.connect(fx.send[room]);
  }
  function osc(fx, type, f, t, end, dest, detune) {
    const o = fx.ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (detune) o.detune.value = detune;
    o.connect(dest);
    o.start(t);
    o.stop(end);
    return o;
  }
  function filter(fx, type, f, q, dest) {
    const b = fx.ac.createBiquadFilter();
    b.type = type; b.frequency.value = f; b.Q.value = q || 0.7;
    b.connect(dest);
    return b;
  }
  function vibrato(fx, t, end, rate, cents, delay, targets) {
    const l = fx.ac.createOscillator(), d = fx.ac.createGain();
    l.frequency.value = rate;
    d.gain.setValueAtTime(0, t);
    d.gain.linearRampToValueAtTime(cents, t + (delay || 0.3));
    l.connect(d);
    targets.forEach((o) => d.connect(o.detune));
    l.start(t); l.stop(end);
  }
  function noiseSrc(fx, t, end, dest) {
    const n = fx.ac.createBufferSource();
    n.buffer = fx.s.noise; n.loop = true;
    n.connect(dest);
    n.start(t, Math.random() * 0.8); n.stop(end);
    return n;
  }

  // A string section: two desks of two players each, left and right, a little out of tune together.
  function strings(fx, m, t, dur, vol, o) {
    o = o || {};
    const f = mtof(m), attack = o.attack || 0.22, room = o.room == null ? 2 : o.room;
    const reg = f < 160 ? "lo" : f < 500 ? "mid" : "hi";
    [-0.45, 0.45].forEach((pan, k) => {
      const into = bus(fx, "str" + reg + k + room, () => {
        const lp = fx.ac.createBiquadFilter();
        lp.type = "lowpass"; lp.Q.value = 0.6;
        lp.frequency.value = { lo: 900, mid: 2200, hi: 4200 }[reg];
        toHall(fx, lp, pan, room);
        return lp;
      });
      const a = env(fx, t, vol / 2, attack, Math.max(0, dur - attack), o.release || 0.7, into);
      [osc(fx, "sawtooth", f, t, a.end, a.g, k ? 7 : -7), osc(fx, "sawtooth", f, t, a.end, a.g, k ? -3 : 4)].forEach((x) => fx.vib[k].connect(x.detune));
    });
  }
  // Short, bowed hard: the strings that drive the music.
  function spicc(fx, m, t, vol, low) {
    const f = mtof(m);
    const a = amp(fx, t, vol, 0.006, 0.05, 0.16, 0, 1);
    const lp = filter(fx, "lowpass", 3000, 1, a.g);
    lp.frequency.setValueAtTime(low ? 2200 : 3800, t);
    lp.frequency.exponentialRampToValueAtTime(low ? 500 : 900, t + 0.18);
    osc(fx, "sawtooth", f, t, a.end, lp, -6);
    osc(fx, "sawtooth", f, t, a.end, lp, 6);
  }
  // Horns: a warm swell that opens up, with a little scoop into the note.
  function horn(fx, m, t, dur, vol, bright) {
    const f = mtof(m), attack = bright ? 0.04 : 0.08;
    const a = amp(fx, t, vol, attack, Math.max(0, dur - attack), 0.35, 0, 2);
    const lp = filter(fx, "lowpass", f, bright ? 2.2 : 1.4, a.g);
    const top = Math.min(bright ? 5200 : 3000, f * (bright ? 7 : 4.5));
    lp.frequency.setValueAtTime(f * 1.2, t);
    lp.frequency.exponentialRampToValueAtTime(top, t + (bright ? 0.07 : 0.14));
    lp.frequency.exponentialRampToValueAtTime(top * 0.6, t + 0.4);
    const oscs = [-7, 7].map((d) => {
      const o = osc(fx, "sawtooth", f, t, a.end, lp, d);
      o.frequency.setValueAtTime(f * 0.985, t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
      return o;
    });
    vibrato(fx, t, a.end, 5.2, 7, 0.5, oscs);
  }
  // A choir: voices through the shapes of a vowel ("a" for ah, "o" for oh).
  const VOWELS = { a: [[750, 1], [1150, 0.55], [2700, 0.2]], o: [[420, 1], [800, 0.6], [2600, 0.12]] };
  function choir(fx, m, t, dur, vol, vowel, o) {
    o = o || {};
    vowel = vowel || "a";
    const f = mtof(m), attack = o.attack || 0.45;
    const into = bus(fx, "choir" + vowel, () => {
      const sum = fx.ac.createGain(), mix = fx.ac.createGain();
      VOWELS[vowel].forEach(([ff, g]) => {
        const bp = fx.ac.createBiquadFilter();
        bp.type = "bandpass"; bp.frequency.value = ff; bp.Q.value = 6;
        const gg = fx.ac.createGain(); gg.gain.value = g * 3.2;
        mix.connect(bp).connect(gg).connect(sum);
      });
      toHall(fx, sum, 0, 2);
      return mix;
    });
    const a = env(fx, t, vol, attack, Math.max(0, dur - attack), o.release || 0.9, into);
    [-11, 0, 12].forEach((d, i) => fx.vib[i % 2].connect(osc(fx, "sawtooth", f, t, a.end, a.g, d).detune));
  }
  // A flute: a soft tone, breath, and vibrato that comes in late. slide = it slides into the note.
  function flute(fx, m, t, dur, vol, slide, bright) {
    const f = mtof(m), attack = 0.06;
    const a = amp(fx, t, vol, attack, Math.max(0, dur - attack), 0.25, 0.1, 2);
    const oscs = [osc(fx, "sine", f, t, a.end, a.g), osc(fx, "triangle", f, t, a.end, a.g)];
    if (bright) oscs.push(osc(fx, "sine", f * 2, t, a.end, filter(fx, "lowpass", 8000, 0.5, a.g)));
    if (slide) oscs.forEach((o, i) => {
      const ff = f * (i === 2 ? 2 : 1);
      o.frequency.setValueAtTime(ff * 0.94, t);
      o.frequency.exponentialRampToValueAtTime(ff, t + 0.12);
    });
    const breathG = fx.ac.createGain(); breathG.gain.value = 0.5;
    breathG.connect(a.g);
    noiseSrc(fx, t, a.end, filter(fx, "bandpass", f * 1.02, 9, breathG));
    vibrato(fx, t, a.end, 5.4, 18, Math.min(0.4, dur * 0.6), oscs);
  }
  // A synth lead and a synth pad for the modern ages.
  function synthLead(fx, m, t, dur, vol) {
    const f = mtof(m);
    const a = amp(fx, t, vol, 0.01, Math.max(0, dur - 0.01), 0.3, 0, 2);
    const lp = filter(fx, "lowpass", Math.min(16000, f * 6), 4, a.g);
    lp.frequency.setValueAtTime(Math.min(16000, f * 10), t);
    lp.frequency.exponentialRampToValueAtTime(f * 3, t + 0.3);
    const oscs = [osc(fx, "sawtooth", f, t, a.end, lp, -10), osc(fx, "square", f, t, a.end, lp, 10)];
    vibrato(fx, t, a.end, 5.5, 10, 0.3, oscs);
  }
  function synthPad(fx, m, t, dur, vol) {
    const f = mtof(m);
    const a = amp(fx, t, vol, 0.6, Math.max(0, dur - 0.6), 1.2, 0, 2);
    const lp = filter(fx, "lowpass", f * 3, 2, a.g);
    const l = fx.ac.createOscillator(), d = fx.ac.createGain();
    l.frequency.value = 0.25; d.gain.value = f * 1.5;
    l.connect(d).connect(lp.frequency);
    l.start(t); l.stop(a.end);
    [-14, 0, 14].forEach((dt, i) => osc(fx, i === 1 ? "square" : "sawtooth", f, t, a.end, lp, dt));
  }
  // A synth arpeggio note: a short, bright blip.
  function blip(fx, m, t, vol) {
    const f = mtof(m);
    const a = amp(fx, t, vol, 0.004, 0.04, 0.18, 0, 2);
    const lp = filter(fx, "lowpass", Math.min(16000, f * 8), 6, a.g);
    lp.frequency.setValueAtTime(Math.min(16000, f * 12), t);
    lp.frequency.exponentialRampToValueAtTime(f * 2, t + 0.15);
    osc(fx, "sawtooth", f, t, a.end, lp, 5);
    osc(fx, "square", f * 2, t, a.end, lp, -5);
  }
  // A pulsing bass that pumps under the modern ages.
  function pulse(fx, m, t, vol) {
    const f = mtof(m);
    const a = amp(fx, t, vol, 0.008, 0.09, 0.12, 0, 0);
    const lp = filter(fx, "lowpass", 900, 3, a.g);
    lp.frequency.setValueAtTime(1400, t);
    lp.frequency.exponentialRampToValueAtTime(180, t + 0.18);
    osc(fx, "sawtooth", f, t, a.end, lp, -6);
    osc(fx, "sawtooth", f, t, a.end, lp, 6);
    osc(fx, "sine", f / 2, t, a.end, a.g);
  }
  // A "braam": a huge, growling brass chord that opens slowly (the sound of film trailers).
  let curve = null;
  function braam(fx, m, t, dur, vol) {
    const ac = fx.ac;
    if (!curve) {
      curve = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 3); }
    }
    const a = amp(fx, t, vol, 0.12, Math.max(0, dur - 0.12), 1.4, 0, 2);
    const lp = filter(fx, "lowpass", 200, 3, a.g);
    lp.frequency.setValueAtTime(160, t);
    lp.frequency.exponentialRampToValueAtTime(1800, t + dur * 0.7);
    const sh = ac.createWaveShaper(); sh.curve = curve; sh.connect(lp);
    const pre = ac.createGain(); pre.gain.value = 0.5; pre.connect(sh);
    [0, 7, 12].forEach((iv) => [-12, 12].forEach((d) => osc(fx, "sawtooth", mtof(m + iv), t, a.end, pre, d)));
  }
  // A drone: a low, buzzing note that breathes (a didgeridoo, a hurdy-gurdy).
  function drone(fx, m, t, dur, vol) {
    const f = mtof(m);
    const a = amp(fx, t, vol, 0.5, Math.max(0, dur - 0.5), 0.8, 0, 1);
    const bp = filter(fx, "bandpass", f * 4, 3, a.g);
    const l = fx.ac.createOscillator(), d = fx.ac.createGain();
    l.frequency.value = 0.7; d.gain.value = f * 2;
    l.connect(d).connect(bp.frequency);
    l.start(t); l.stop(a.end);
    osc(fx, "sawtooth", f, t, a.end, bp);
    osc(fx, "sine", f, t, a.end, a.g);
  }

  // Plucked strings, made string by string (Karplus-Strong) and kept for the next time.
  const PLUCKS = {
    harp: { bright: 0.35, decay: 0.9985, secs: 2.2, body: 0 },
    lyre: { bright: 0.5, decay: 0.998, secs: 1.8, body: 0 },
    oud: { bright: 0.75, decay: 0.996, secs: 1.2, body: 1 },
    zheng: { bright: 0.7, decay: 0.9985, secs: 2.0, body: 0, bend: true },
    harpsichord: { bright: 0.95, decay: 0.997, secs: 1.2, body: 0 },
  };
  function pluckBuffer(fx, f, kind) {
    const key = kind + Math.round(f * 10);
    if (fx.s.strings[key]) return fx.s.strings[key];
    const P = PLUCKS[kind], sr = fx.ac.sampleRate;
    const n = Math.floor(sr * P.secs), N = Math.max(2, Math.round(sr / f));
    const buf = fx.ac.createBuffer(1, n, sr), d = buf.getChannelData(0);
    // The pluck: a burst of noise, smoothed so softer strings sound rounder.
    let lp = 0;
    for (let i = 0; i < N; i++) { lp += (Math.random() * 2 - 1 - lp) * P.bright; d[i] = lp; }
    // Lower notes ring longer, like real strings.
    const decay = Math.pow(P.decay, 440 / Math.max(110, f) * 0.5 + 0.5);
    for (let i = N; i < n; i++) d[i] = decay * 0.5 * (d[i - N] + d[i - N + 1]);
    let peak = 0;
    for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(d[i]));
    for (let i = 0; i < n; i++) d[i] /= peak || 1;
    fx.s.strings[key] = buf;
    return buf;
  }
  function pluck(fx, m, t, vol, kind) {
    const f = mtof(m), P = PLUCKS[kind];
    const src = fx.ac.createBufferSource();
    src.buffer = pluckBuffer(fx, f, kind);
    const a = amp(fx, t, vol, 0.002, P.secs * 0.6, P.secs * 0.4, (Math.random() - 0.5) * 0.5, 2);
    let dest = a.g;
    if (P.body) { // the oud's round wooden body
      const pk = fx.ac.createBiquadFilter();
      pk.type = "peaking"; pk.frequency.value = 900; pk.Q.value = 2; pk.gain.value = 6;
      pk.connect(a.g);
      dest = pk;
    }
    if (P.bend) { // the guzheng player presses the string after plucking it
      src.playbackRate.setValueAtTime(1, t + 0.25);
      src.playbackRate.linearRampToValueAtTime(1.03, t + 0.45);
      src.playbackRate.linearRampToValueAtTime(1, t + 0.7);
    }
    src.connect(dest);
    src.start(t);
    src.stop(a.end);
  }

  // ---------- The drums ----------

  function drum(fx, kind, t, v, rootM) {
    const ac = fx.ac;
    if (kind !== "swell") v *= 0.5; // the drums drive the music, but must not bury the tune
    if (kind === "taiko" || kind === "tom" || kind === "dum") {
      // A big skin: a deep thump that drops in pitch, and the slap of the stick.
      const [f0, f1, dec, vol] = { taiko: [110, 42, 1.1, 0.75], tom: [190, 85, 0.5, 0.5], dum: [140, 75, 0.35, 0.45] }[kind];
      const a = amp(fx, t, vol * v, 0.003, 0.02, dec, 0, kind === "dum" ? 1 : 2);
      const o = osc(fx, "sine", f0, t, a.end, a.g);
      o.frequency.exponentialRampToValueAtTime(f1, t + dec * 0.4);
      const o2 = osc(fx, "triangle", f0 * 1.5, t, t + 0.15, filter(fx, "lowpass", 800, 0.7, a.g));
      o2.frequency.exponentialRampToValueAtTime(f1, t + 0.12);
      const s = amp(fx, t, vol * v * 0.35, 0.001, 0.005, 0.06, 0, 1);
      noiseSrc(fx, t, s.end, filter(fx, "lowpass", kind === "dum" ? 2500 : 1200, 0.7, s.g));
    } else if (kind === "tek") { // the rim of a hand drum
      const a = amp(fx, t, 0.22 * v, 0.001, 0.005, 0.06, 0.3, 1);
      noiseSrc(fx, t, a.end, filter(fx, "bandpass", 3200, 2, a.g));
      osc(fx, "triangle", 620, t, a.end, a.g);
    } else if (kind === "snare") { // a military side drum
      const a = amp(fx, t, 0.3 * v, 0.001, 0.01, 0.16, -0.15, 1);
      noiseSrc(fx, t, a.end, filter(fx, "bandpass", 2200, 0.8, a.g));
      const b = amp(fx, t, 0.22 * v, 0.001, 0.005, 0.07, -0.15, 1);
      const o = osc(fx, "triangle", 210, t, b.end, b.g);
      o.frequency.exponentialRampToValueAtTime(150, t + 0.07);
    } else if (kind === "hat") { // a shaker
      const a = amp(fx, t, 0.09 * v, 0.004, 0.01, 0.05, 0.35, 0);
      noiseSrc(fx, t, a.end, filter(fx, "highpass", 6500, 0.7, a.g));
    } else if (kind === "timp") { // timpani, tuned to the key
      const f = mtof(rootM);
      const a = amp(fx, t, 0.5 * v, 0.003, 0.05, 1.4, 0.2, 2);
      [[1, 1], [1.5, 0.4], [1.99, 0.25]].forEach(([k, g]) => {
        const gg = fx.ac.createGain(); gg.gain.value = g; gg.connect(a.g);
        const o = osc(fx, "sine", f * k * 1.02, t, a.end, gg);
        o.frequency.exponentialRampToValueAtTime(f * k, t + 0.1);
      });
      const s = amp(fx, t, 0.15 * v, 0.001, 0.005, 0.05, 0.2, 1);
      noiseSrc(fx, t, s.end, filter(fx, "lowpass", 1500, 0.7, s.g));
    } else if (kind === "anvil") { // a hammer on hot iron
      const a = amp(fx, t, 0.16 * v, 0.001, 0.005, 0.5, 0.25, 2);
      [1, 2.76, 5.4, 8.93].forEach((k, i) => {
        const gg = fx.ac.createGain(); gg.gain.value = 1 / (i + 1); gg.connect(a.g);
        osc(fx, "sine", 820 * k, t, a.end, gg);
      });
      const s = amp(fx, t, 0.2 * v, 0.001, 0.003, 0.03, 0.25, 1);
      noiseSrc(fx, t, s.end, filter(fx, "highpass", 3000, 0.7, s.g));
    } else if (kind === "boom") { // the hit at the start of a phrase
      const a = amp(fx, t, 0.6 * v, 0.002, 0.05, 2.2, 0, 2);
      const o = osc(fx, "sine", 75, t, a.end, a.g);
      o.frequency.exponentialRampToValueAtTime(30, t + 1.4);
      const s = amp(fx, t, 0.4 * v, 0.002, 0.03, 0.6, 0, 2);
      noiseSrc(fx, t, s.end, filter(fx, "lowpass", 500, 0.7, s.g));
      const c = amp(fx, t, 0.08 * v, 0.002, 0.05, 2.0, 0, 2); // and a cymbal
      noiseSrc(fx, t, c.end, filter(fx, "highpass", 5000, 0.5, c.g));
    } else if (kind === "gong") {
      const a = amp(fx, t, 0.3 * v, 0.02, 0.2, 4, 0, 2);
      [1, 1.47, 2.09, 2.56, 3.2].forEach((k, i) => {
        const gg = fx.ac.createGain(); gg.gain.value = 1 / (i + 1.5); gg.connect(a.g);
        const o = osc(fx, "sine", 98 * k, t, a.end, gg);
        o.frequency.exponentialRampToValueAtTime(98 * k * 0.98, t + 3);
      });
      const s = amp(fx, t, 0.06 * v, 0.3, 0.5, 3, 0, 2);
      noiseSrc(fx, t, s.end, filter(fx, "bandpass", 3500, 1, s.g));
    } else if (kind === "swell") { // a cymbal rising into the next phrase
      const g = ac.createGain(), len = v;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + len);
      g.gain.linearRampToValueAtTime(0, t + len + 0.02);
      g.connect(fx.dry); g.connect(fx.send[2]);
      noiseSrc(fx, t, t + len + 0.05, filter(fx, "highpass", 4500, 0.5, g));
    }
  }

  // ---------- The conductor ----------

  // Plays one sixteenth step of an age at time t. step counts from the start of the tune
  // (8 bars of 16 steps, then it starts again).
  function playStep(fx, age, step, t, battle) {
    const len = 60 / age.bpm / 4, s = step % 16, bar = Math.floor(step / 16) % 8;
    if (fx.battle !== battle) {
      fx.battle = battle;
      fx.level.gain.setTargetAtTime(LEVEL[battle ? "battle" : "calm"], t, 0.25);
    }
    const key = midi(age.key), ch = chordOf(age, bar);
    const beat = len * 4;
    if (!age.notes) age.notes = parseTune(age);

    // The harmony: a held chord at the start of each bar, and the bass.
    if (s === 0) {
      const lo = key + 12 + ch[0];
      // Close voicing between the key + 15 and + 29 semitones.
      const voice = ch.map((c) => { let m = key + 12 + c; while (m < key + 15) m += 12; while (m > key + 29) m -= 12; return m; });
      const pad = age.pad;
      const dur = beat * 4;
      if (pad === "strings") voice.forEach((m) => strings(fx, m, t, dur, battle ? 0.05 : 0.045));
      else if (pad === "synth") voice.forEach((m) => synthPad(fx, m, t, dur, battle ? 0.035 : 0.04));
      else if (pad === "chant") voice.forEach((m) => choir(fx, m - 12, t, dur, battle ? 0.06 : 0.05, "o"));
      if (age.choir && battle) voice.forEach((m, i) => choir(fx, m, t, dur, 0.04, age.choir, { pan: (i - 1) * 0.4 }));
      // The bass: low strings (and in battle, horns an octave up on the first beat).
      const bassM = ch[0] > 7 ? key + ch[0] - 12 : key + ch[0];
      if (age.bass !== "pulse" || !battle) strings(fx, bassM, t, dur, battle ? 0.11 : 0.08, { room: 1, attack: 0.08 });
      if (age.drone) drone(fx, key, t, dur, battle ? 0.07 : 0.06);
      if (battle && age.braam && bar % 4 === 0) braam(fx, bassM, t, beat * 6, 0.1);
      if (battle && !age.braam && bar % 2 === 0) horn(fx, lo, t, beat * 1.5, 0.05);
    }
    if (age.bass === "pulse" && battle && s % 2 === 0) {
      const bassM = ch[0] > 7 ? key + ch[0] - 12 : key + ch[0];
      pulse(fx, bassM + (s % 8 === 6 ? 12 : 0), t, 0.13);
    }

    // The figures that keep it moving.
    [age.arp, age.arp2].forEach((arp) => {
      if (!arp || (!battle && !arp.calm)) return;
      const c = arp.pat[s];
      if (!c || c === ".") return;
      const base = key + (arp.inst === "chug" ? 12 : 24);
      const m = base + { 1: ch[0], 3: ch[1], 5: ch[2], 8: ch[0] + 12 }[c];
      const quiet = battle ? 1 : 0.7;
      if (arp.inst === "spicc") spicc(fx, m, t, 0.07 * quiet);
      else if (arp.inst === "chug") spicc(fx, m, t, (s % 4 === 0 ? 0.11 : 0.07) * quiet, true);
      else if (arp.inst === "synth") blip(fx, m + 12, t, 0.035 * quiet);
      else pluck(fx, m + (arp.inst === "harpsichord" ? 12 : 0), t, 0.14 * quiet, arp.inst);
    });

    // The tune: the second time round, in battle, doubled an octave up.
    const half = Math.floor(bar / 4), at = (bar % 4) * 16 + s;
    age.notes.forEach((n) => {
      if (n.at !== at) return;
      const m = key + 24 + n.semi, dur = n.len * len * 0.98;
      const inst = age.lead[battle ? 1 : 0];
      lead(fx, inst, m, t, dur, battle);
      if (battle && half === 1) lead(fx, age.lead2 || "strings", m + 12, t, dur, true, 0.7);
      if (!battle && half === 1 && inst !== "strings") lead(fx, "strings", m, t, dur, false, 0.5);
    });

    // The drums.
    const kit = battle ? age.drums : age.calmDrums;
    Object.keys(kit || {}).forEach((k) => {
      const c = kit[k][s];
      if (!c || c === ".") return;
      const v = c === "X" ? 1 : c === "x" ? 0.7 : c === "t" ? 0.6 : 0.4;
      drum(fx, c === "t" ? "tek" : k, t, battle ? v : v * 0.8, key);
    });
    if (battle) {
      if (s === 0 && bar % 4 === 0 && age.boom) drum(fx, "boom", t, 1);
      if (s === 0 && bar === 0 && age.gong) drum(fx, "gong", t, 1);
      if (s === 0 && bar % 4 === 3 && age.swell) drum(fx, "swell", t, beat * 4);
      if (bar === 7 && s >= 12) drum(fx, "tom", t, 0.5 + (s - 12) * 0.15); // a drum fill into the top
    } else if (s === 0 && bar === 0 && age.gong) drum(fx, "gong", t, 0.6);
  }

  function lead(fx, inst, m, t, dur, battle, k) {
    k = k || 1;
    if (inst === "horns") { horn(fx, m, t, dur, 0.08 * k); horn(fx, m - 12, t, dur, 0.05 * k); }
    else if (inst === "horn") horn(fx, m - 12, t, dur, 0.11 * k);
    else if (inst === "trumpet") { horn(fx, m, t, dur, 0.08 * k, true); horn(fx, m - 12, t, dur, 0.04 * k); }
    else if (inst === "strings") strings(fx, m, t, dur, 0.12 * k, { attack: 0.08, release: 0.4 });
    else if (inst === "flute") flute(fx, m + 12, t, dur, 0.07 * k);
    else if (inst === "ney") flute(fx, m + 12, t, dur, 0.07 * k, true);
    else if (inst === "dizi") flute(fx, m + 12, t, dur, 0.06 * k, true, true);
    else if (inst === "choirLead") choir(fx, m, t, dur, 0.09 * k, "a", { attack: 0.12, release: 0.5 });
    else if (inst === "synthLead") synthLead(fx, m, t, dur, 0.05 * k);
  }

  // ---------- Playing ----------

  let mood = "calm";
  // Called by Sound every 40 ms while the tune is on.
  function player(n) {
    const age = AGES[n];
    return {
      play(p, ac) {
        if (!p.fx) { p.fx = mixer(ac, p.gain); p.battle = mood === "battle"; }
        const len = 60 / age.bpm / 4;
        while (p.next < ac.currentTime + 0.3) {
          if (p.step % 16 === 0) p.battle = mood === "battle"; // the mood changes at the next bar
          playStep(p.fx, age, p.step, p.next, p.battle);
          p.next += len;
          p.step = (p.step + 1) % (16 * 8);
        }
      },
    };
  }
  AGES.forEach((age, n) => { if (window.Sound && Sound.addTrack) Sound.addTrack("epic" + n, player(n)); });

  // Plays `seconds` of an age into out, starting now (for the preview script).
  function render(ac, out, n, m, seconds, from) {
    const age = AGES[n], fx = mixer(ac, out), len = 60 / age.bpm / 4;
    let t = from || 0.05;
    for (let step = 0; t < (from || 0) + seconds; step++, t += len) playStep(fx, age, step % 128, t, m === "battle");
    return t;
  }

  return {
    AGES,
    get mood() { return mood; },
    set mood(m) { mood = m === "battle" ? "battle" : "calm"; },
    render,
  };
})();
