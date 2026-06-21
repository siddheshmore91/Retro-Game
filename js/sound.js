/* ==========================================================================
   RetroPlay :: sound.js
   All sound effects are synthesized live with the WebAudio API — no .mp3 /
   .wav files to fetch, host, or go missing. This guarantees the "no missing
   assets" and "under 40MB" requirements and keeps everything 100% offline.
   ========================================================================== */
(function (window) {
  'use strict';
  var RP = window.RP = window.RP || {};

  var ctx = null;
  function getCtx() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function isMuted() {
    try { return !!RP.Storage.load().settings.muted; } catch (e) { return false; }
  }

  function tone(freq, dur, type, vol, delay) {
    if (isMuted()) return;
    var ac = getCtx();
    if (!ac) return;
    var t0 = ac.currentTime + (delay || 0);
    var osc = ac.createOscillator();
    var gain = ac.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol || 0.15), t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function sweep(f0, f1, dur, type, vol) {
    if (isMuted()) return;
    var ac = getCtx();
    if (!ac) return;
    var t0 = ac.currentTime;
    var osc = ac.createOscillator();
    var gain = ac.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    gain.gain.setValueAtTime(vol || 0.15, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noiseBurst(dur, vol) {
    if (isMuted()) return;
    var ac = getCtx();
    if (!ac) return;
    var bufferSize = ac.sampleRate * dur;
    var buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    var src = ac.createBufferSource();
    src.buffer = buffer;
    var gain = ac.createGain();
    gain.gain.value = vol || 0.2;
    src.connect(gain).connect(ac.destination);
    src.start();
  }

  RP.Sound = {
    unlock: function () { getCtx(); },
    isMuted: isMuted,
    setMuted: function (m) {
      var s = RP.Storage.load();
      s.settings.muted = !!m;
      RP.Storage && RP.Storage.load(); // no-op to keep linter quiet
      try { window.localStorage.setItem(RP.Storage.KEY, JSON.stringify(s)); } catch (e) {}
    },
    coin: function () { tone(988, 0.08, 'square', 0.18); tone(1318, 0.12, 'square', 0.16, 0.07); },
    jump: function () { sweep(220, 520, 0.14, 'square', 0.15); },
    hit: function () { sweep(180, 60, 0.25, 'sawtooth', 0.2); },
    explosion: function () { noiseBurst(0.35, 0.25); sweep(220, 40, 0.3, 'sawtooth', 0.12); },
    powerup: function () { sweep(300, 900, 0.25, 'square', 0.18); },
    gameover: function () { sweep(440, 80, 0.6, 'sawtooth', 0.18); },
    click: function () { tone(700, 0.05, 'square', 0.1); },
    select: function () { tone(540, 0.06, 'square', 0.12); },
    laser: function () { sweep(900, 200, 0.12, 'sawtooth', 0.12); },
    blip: function () { tone(660, 0.04, 'square', 0.1); },
    levelup: function () { tone(523, 0.1, 'square', 0.16); tone(659, 0.1, 'square', 0.16, 0.1); tone(784, 0.18, 'square', 0.18, 0.2); },
    eat: function () { tone(330, 0.05, 'square', 0.14); },
    ghost: function () { sweep(700, 1200, 0.18, 'triangle', 0.15); },
    drop: function () { tone(120, 0.08, 'square', 0.2); },
    achievement: function () { tone(660, 0.1, 'square', 0.18); tone(880, 0.1, 'square', 0.18, 0.1); tone(1100, 0.2, 'square', 0.2, 0.2); }
  };

})(window);
