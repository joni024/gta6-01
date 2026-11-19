// All sound is synthesised with WebAudio: no audio files, no network.
// Engine hum, sirens, gunfire, pickups, jingles and a laid-back synth loop.
export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    muted: false,
    engineNodes: null,
    sirenNodes: null,
    musicNodes: null,
    musicTimer: 0,
    musicStep: 0,
  };

  audio.ensure = () => {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      return true;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      audio.ctx = new Ctx();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = audio.muted ? 0 : 0.5;
      audio.master.connect(audio.ctx.destination);
      return true;
    } catch {
      return false;
    }
  };

  audio.toggleMute = () => {
    audio.muted = !audio.muted;
    if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.5;
    return audio.muted;
  };

  function tone({ type = 'sine', freq = 440, freqEnd = null, dur = 0.2, vol = 0.2, when = 0 }) {
    if (!audio.ctx) return;
    const t0 = audio.ctx.currentTime + when;
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise({ dur = 0.15, vol = 0.3, low = 400, high = 3000, when = 0 }) {
    if (!audio.ctx) return;
    const t0 = audio.ctx.currentTime + when;
    const len = Math.max(1, Math.floor(audio.ctx.sampleRate * dur));
    const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audio.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = (low + high) / 2;
    filter.Q.value = 0.7;
    const gain = audio.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audio.master);
    src.start(t0);
  }

  audio.shot = () => {
    noise({ dur: 0.12, vol: 0.5, low: 800, high: 4000 });
    tone({ type: 'square', freq: 160, freqEnd: 50, dur: 0.1, vol: 0.25 });
  };
  audio.punch = () => noise({ dur: 0.08, vol: 0.3, low: 200, high: 900 });
  audio.crash = () => {
    noise({ dur: 0.25, vol: 0.4, low: 100, high: 1200 });
    tone({ type: 'sine', freq: 90, freqEnd: 40, dur: 0.25, vol: 0.3 });
  };
  audio.pickup = () => {
    tone({ type: 'sine', freq: 660, dur: 0.09, vol: 0.2 });
    tone({ type: 'sine', freq: 990, dur: 0.14, vol: 0.2, when: 0.08 });
  };
  audio.cash = () => {
    tone({ type: 'triangle', freq: 880, dur: 0.08, vol: 0.2 });
    tone({ type: 'triangle', freq: 1174, dur: 0.08, vol: 0.2, when: 0.07 });
    tone({ type: 'triangle', freq: 1568, dur: 0.16, vol: 0.2, when: 0.14 });
  };
  audio.missionDone = () => {
    [523, 659, 784, 1046].forEach((f, i) => tone({ type: 'triangle', freq: f, dur: 0.18, vol: 0.22, when: i * 0.11 }));
  };
  audio.missionFail = () => {
    [392, 330, 262, 196].forEach((f, i) => tone({ type: 'sawtooth', freq: f, dur: 0.22, vol: 0.12, when: i * 0.13 }));
  };
  audio.sirenBlip = () => {
    tone({ type: 'square', freq: 880, dur: 0.12, vol: 0.08 });
    tone({ type: 'square', freq: 660, dur: 0.12, vol: 0.08, when: 0.12 });
  };
  audio.door = () => noise({ dur: 0.07, vol: 0.2, low: 300, high: 1500 });
  audio.explosion = () => {
    noise({ dur: 0.6, vol: 0.6, low: 60, high: 800 });
    tone({ type: 'sine', freq: 70, freqEnd: 30, dur: 0.5, vol: 0.5 });
  };

  // Continuous engine hum: pitch follows speed.
  audio.engine = (speedRatio, on) => {
    if (!audio.ctx) return;
    if (!on) {
      if (audio.engineNodes) {
        try { audio.engineNodes.gain.gain.value = 0; } catch { /* already stopped */ }
        audio.engineNodes = null;
      }
      return;
    }
    if (!audio.engineNodes) {
      const osc = audio.ctx.createOscillator();
      osc.type = 'sawtooth';
      const filter = audio.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;
      const gain = audio.ctx.createGain();
      gain.gain.value = 0.05;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(audio.master);
      osc.start();
      audio.engineNodes = { osc, filter, gain };
    }
    const n = audio.engineNodes;
    n.osc.frequency.setTargetAtTime(55 + speedRatio * 130, audio.ctx.currentTime, 0.08);
    n.filter.frequency.setTargetAtTime(300 + speedRatio * 900, audio.ctx.currentTime, 0.08);
    n.gain.gain.setTargetAtTime(0.04 + speedRatio * 0.05, audio.ctx.currentTime, 0.08);
  };

  // Two-tone police siren while any cop is near.
  audio.siren = (on) => {
    if (!audio.ctx) return;
    if (!on) {
      if (audio.sirenNodes) {
        try { audio.sirenNodes.osc.stop(); } catch { /* stopped */ }
        audio.sirenNodes = null;
      }
      return;
    }
    if (!audio.sirenNodes) {
      const osc = audio.ctx.createOscillator();
      osc.type = 'triangle';
      const gain = audio.ctx.createGain();
      gain.gain.value = 0.045;
      const lfo = audio.ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 1.4;
      const lfoGain = audio.ctx.createGain();
      lfoGain.gain.value = 160;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      osc.frequency.value = 820;
      osc.connect(gain);
      gain.connect(audio.master);
      osc.start();
      lfo.start();
      audio.sirenNodes = { osc, lfo, gain };
    }
  };

  // A slow, sunny synth loop: bass note + soft pad chords.
  const BASS = [110, 87.31, 98, 130.81]; // A2 F2 G2 C3
  const CHORDS = [[220, 261.63, 329.63], [174.61, 220, 261.63], [196, 246.94, 293.66], [261.63, 329.63, 392]];
  audio.musicTick = (dt, playing) => {
    if (!audio.ctx || !playing) return;
    audio.musicTimer -= dt;
    if (audio.musicTimer > 0) return;
    audio.musicTimer = 0.55;
    const step = audio.musicStep;
    audio.musicStep = (audio.musicStep + 1) % 32;
    const bar = Math.floor(step / 8) % 4;
    if (step % 8 === 0) {
      tone({ type: 'sine', freq: BASS[bar], dur: 1.6, vol: 0.1 });
      for (const f of CHORDS[bar]) tone({ type: 'triangle', freq: f, dur: 1.8, vol: 0.03 });
    }
    if (step % 2 === 0) {
      tone({ type: 'sine', freq: BASS[bar] * 2, dur: 0.12, vol: 0.04 });
    }
    if (step % 8 === 4) {
      tone({ type: 'triangle', freq: CHORDS[bar][1] * 2, dur: 0.3, vol: 0.035 });
    }
  };

  return audio;
}
