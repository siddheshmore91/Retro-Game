/* ==========================================================================
   RetroPlay :: storage.js
   Single source of truth for all persistence. Everything lives in ONE
   localStorage key as a JSON blob (RP.Storage.KEY) so we never spam the
   storage quota with dozens of keys and so import/export-as-file (Profile
   screen) is a single round trip.

   No backend. No database. No cookies. 100% client-side.
   ========================================================================== */
(function (window) {
  'use strict';

  var RP = window.RP = window.RP || {};

  var KEY = 'retroplay_save_v1';

  function uid(len) {
    len = len || 6;
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var out = '';
    for (var i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  function defaultState() {
    return {
      version: 1,
      profile: {
        name: '',
        isGuest: true,
        createdAt: Date.now(),
        referralCode: 'RP-' + uid(5),
        redeemedReferral: false,
        loginDates: [],   // array of 'YYYY-MM-DD'
        streak: 0,
        lastLoginDate: null
      },
      points: 150,           // starter points so the cheat shop isn't empty on day 1
      totalPointsEarned: 150,
      totalPointsSpent: 0,
      scores: {},             // gameId -> { best:0, plays:0, lastScore:0, totalScore:0 }
      achievements: {},        // achievementId -> timestamp unlocked
      cheats: {
        owned: {},             // cheatId -> timestamp purchased
        active: {}              // gameId -> [cheatId,...]
      },
      stats: {
        gamesPlayed: 0,
        distinctGamesPlayed: [],
        ghostsEaten: 0,
        linesCleared: 0,
        bossesDefeated: 0,
        levelsCleared: 0
      },
      spin: { lastSpinDate: null, totalSpins: 0 },
      settings: { muted: false, particles: true, bloodEffects: false },
      leaderboardSeed: Math.floor(Math.random() * 1000000)
    };
  }

  var _state = null;

  function load() {
    if (_state) return _state;
    try {
      var raw = window.localStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        // shallow-merge with defaults so new fields added in updates don't crash old saves
        _state = mergeDeep(defaultState(), parsed);
      } else {
        _state = defaultState();
      }
    } catch (e) {
      console.warn('[RetroPlay] save data unreadable, starting fresh', e);
      _state = defaultState();
    }
    return _state;
  }

  function mergeDeep(base, override) {
    if (typeof override !== 'object' || override === null) return base;
    var out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    for (var k in override) {
      if (!override.hasOwnProperty(k)) continue;
      if (base && typeof base[k] === 'object' && base[k] !== null && !Array.isArray(base[k]) &&
          typeof override[k] === 'object' && override[k] !== null && !Array.isArray(override[k])) {
        out[k] = mergeDeep(base[k], override[k]);
      } else if (override[k] !== undefined) {
        out[k] = override[k];
      }
    }
    return out;
  }

  var saveTimer = null;
  function persist() {
    // debounce writes slightly so rapid game-loop calls don't thrash localStorage
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try {
        window.localStorage.setItem(KEY, JSON.stringify(_state));
      } catch (e) {
        console.error('[RetroPlay] could not save (storage full or disabled)', e);
      }
      saveTimer = null;
    }, 120);
  }
  function persistNow() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    try { window.localStorage.setItem(KEY, JSON.stringify(_state)); } catch (e) { /* ignore */ }
  }

  // ---- Profile ----------------------------------------------------------
  function getProfile() { return load().profile; }

  function setPlayer(name, isGuest) {
    var s = load();
    s.profile.name = (name || '').trim().slice(0, 18) || ('Guest' + uid(4));
    s.profile.isGuest = !!isGuest;
    touchDailyLogin();
    persistNow();
    return s.profile;
  }

  function isLoggedIn() {
    return !!load().profile.name;
  }

  function todayStr(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // Returns {isNewDay, streak, reward} so the UI can show a "Daily Login" toast
  function touchDailyLogin() {
    var s = load();
    var today = todayStr();
    if (s.profile.lastLoginDate === today) {
      return { isNewDay: false, streak: s.profile.streak };
    }
    var yesterday = todayStr(new Date(Date.now() - 86400000));
    if (s.profile.lastLoginDate === yesterday) {
      s.profile.streak = (s.profile.streak || 0) + 1;
    } else {
      s.profile.streak = 1;
    }
    s.profile.lastLoginDate = today;
    s.profile.loginDates.push(today);
    if (s.profile.loginDates.length > 60) s.profile.loginDates.shift();
    var reward = 20 + Math.min(s.profile.streak, 10) * 10; // grows with streak, caps at +100
    addPoints(reward, 'daily-login');
    persistNow();
    return { isNewDay: true, streak: s.profile.streak, reward: reward };
  }

  // ---- Points -------------------------------------------------------------
  function getPoints() { return load().points; }

  function addPoints(n, reason) {
    if (!n) return getPoints();
    var s = load();
    n = Math.round(n);
    s.points = Math.max(0, s.points + n);
    if (n > 0) s.totalPointsEarned += n;
    persist();
    document.dispatchEvent(new CustomEvent('rp:points-changed', { detail: { delta: n, total: s.points, reason: reason } }));
    return s.points;
  }

  function spendPoints(n, reason) {
    var s = load();
    if (s.points < n) return false;
    s.points -= n;
    s.totalPointsSpent += n;
    persist();
    document.dispatchEvent(new CustomEvent('rp:points-changed', { detail: { delta: -n, total: s.points, reason: reason } }));
    return true;
  }

  // ---- Scores ---------------------------------------------------------------
  function getGameScore(gameId) {
    var s = load();
    return s.scores[gameId] || { best: 0, plays: 0, lastScore: 0, totalScore: 0 };
  }

  function recordPlay(gameId, score) {
    var s = load();
    if (!s.scores[gameId]) s.scores[gameId] = { best: 0, plays: 0, lastScore: 0, totalScore: 0 };
    var rec = s.scores[gameId];
    rec.plays += 1;
    rec.lastScore = score;
    rec.totalScore += score;
    var isNewBest = score > rec.best;
    if (isNewBest) rec.best = score;

    s.stats.gamesPlayed += 1;
    if (s.stats.distinctGamesPlayed.indexOf(gameId) === -1) s.stats.distinctGamesPlayed.push(gameId);

    persistNow();
    return { best: rec.best, isNewBest: isNewBest, plays: rec.plays };
  }

  function bumpStat(key, n) {
    var s = load();
    n = n === undefined ? 1 : n;
    s.stats[key] = (s.stats[key] || 0) + n;
    persist();
    return s.stats[key];
  }

  // ---- Achievements -----------------------------------------------------
  function unlockAchievement(id) {
    var s = load();
    if (s.achievements[id]) return false; // already unlocked
    s.achievements[id] = Date.now();
    persistNow();
    return true;
  }
  function hasAchievement(id) { return !!load().achievements[id]; }

  // ---- Cheats -------------------------------------------------------------
  function ownsCheat(id) { return !!load().cheats.owned[id]; }
  function buyCheat(id, cost) {
    var s = load();
    if (s.cheats.owned[id]) return { ok: false, reason: 'already-owned' };
    if (!spendPoints(cost, 'cheat:' + id)) return { ok: false, reason: 'not-enough-points' };
    s.cheats.owned[id] = Date.now();
    persistNow();
    return { ok: true };
  }
  function getActiveCheats(gameId) {
    var s = load();
    return (s.cheats.active[gameId] || []).filter(function (id) { return s.cheats.owned[id]; });
  }
  function setCheatActive(gameId, cheatId, active) {
    var s = load();
    if (!s.cheats.active[gameId]) s.cheats.active[gameId] = [];
    var idx = s.cheats.active[gameId].indexOf(cheatId);
    if (active && idx === -1) s.cheats.active[gameId].push(cheatId);
    if (!active && idx !== -1) s.cheats.active[gameId].splice(idx, 1);
    persistNow();
  }

  // ---- Spin wheel ---------------------------------------------------------
  function canSpinToday() {
    return load().spin.lastSpinDate !== todayStr();
  }
  function commitSpin() {
    var s = load();
    s.spin.lastSpinDate = todayStr();
    s.spin.totalSpins += 1;
    persistNow();
  }

  // ---- Referral -----------------------------------------------------------
  function redeemReferral(code) {
    var s = load();
    if (s.profile.redeemedReferral) return { ok: false, reason: 'already-redeemed' };
    code = (code || '').trim().toUpperCase();
    if (!code) return { ok: false, reason: 'empty' };
    if (code === s.profile.referralCode) return { ok: false, reason: 'self' };
    if (!/^RP-[A-Z0-9]{4,6}$/.test(code)) return { ok: false, reason: 'invalid-format' };
    s.profile.redeemedReferral = true;
    persistNow();
    addPoints(500, 'referral-redeemed');
    return { ok: true, reward: 500 };
  }

  // ---- Reset / Export / Import ---------------------------------------------
  function resetAll() {
    _state = defaultState();
    persistNow();
  }
  function exportSave() {
    return JSON.stringify(load(), null, 2);
  }
  function importSave(jsonStr) {
    try {
      var parsed = JSON.parse(jsonStr);
      _state = mergeDeep(defaultState(), parsed);
      persistNow();
      return true;
    } catch (e) {
      return false;
    }
  }

  RP.Storage = {
    KEY: KEY,
    load: load,
    getProfile: getProfile,
    setPlayer: setPlayer,
    isLoggedIn: isLoggedIn,
    touchDailyLogin: touchDailyLogin,
    getPoints: getPoints,
    addPoints: addPoints,
    spendPoints: spendPoints,
    getGameScore: getGameScore,
    recordPlay: recordPlay,
    bumpStat: bumpStat,
    unlockAchievement: unlockAchievement,
    hasAchievement: hasAchievement,
    ownsCheat: ownsCheat,
    buyCheat: buyCheat,
    getActiveCheats: getActiveCheats,
    setCheatActive: setCheatActive,
    canSpinToday: canSpinToday,
    commitSpin: commitSpin,
    redeemReferral: redeemReferral,
    resetAll: resetAll,
    exportSave: exportSave,
    importSave: importSave,
    todayStr: todayStr
  };

})(window);
