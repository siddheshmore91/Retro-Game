/* ==========================================================================
   RetroPlay :: dailyspin.js
   Daily spin wheel (once per real calendar day) + the reward table.
   Daily LOGIN rewards themselves are granted automatically in
   storage.js -> touchDailyLogin(), called once when the player signs in.
   ========================================================================== */
(function (window) {
  'use strict';
  var RP = window.RP = window.RP || {};

  // 8 segments. Keep order in sync with the visual wedges drawn in app.js.
  var SEGMENTS = [
    { label: '50 pts',  type: 'points', value: 50,  weight: 24 },
    { label: '100 pts', type: 'points', value: 100, weight: 20 },
    { label: '20 pts',  type: 'points', value: 20,  weight: 22 },
    { label: '250 pts', type: 'points', value: 250, weight: 10 },
    { label: '75 pts',  type: 'points', value: 75,  weight: 16 },
    { label: 'JACKPOT 500', type: 'points', value: 500, weight: 4 },
    { label: '150 pts', type: 'points', value: 150, weight: 12 },
    { label: 'Try Again', type: 'none', value: 0, weight: 12 }
  ];

  function pickSegmentIndex() {
    var totalWeight = SEGMENTS.reduce(function (a, s) { return a + s.weight; }, 0);
    var r = Math.random() * totalWeight;
    for (var i = 0; i < SEGMENTS.length; i++) {
      r -= SEGMENTS[i].weight;
      if (r <= 0) return i;
    }
    return SEGMENTS.length - 1;
  }

  function canSpin() { return RP.Storage.canSpinToday(); }

  function spin() {
    if (!canSpin()) return { ok: false, reason: 'already-spun' };
    var idx = pickSegmentIndex();
    var seg = SEGMENTS[idx];
    RP.Storage.commitSpin();
    if (seg.type === 'points' && seg.value > 0) {
      RP.Storage.addPoints(seg.value, 'daily-spin');
    }
    RP.Achievements.check({ type: 'generic' });
    return { ok: true, index: idx, segment: seg };
  }

  RP.DailySpin = { SEGMENTS: SEGMENTS, canSpin: canSpin, spin: spin };

})(window);
