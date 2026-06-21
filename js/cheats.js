/* ==========================================================================
   RetroPlay :: cheats.js
   Thin business-logic layer over RP.Storage for the Cheat Shop and the
   per-game "active cheats" picker shown before a round starts.
   ========================================================================== */
(function (window) {
  'use strict';
  var RP = window.RP = window.RP || {};

  function all() { return RP.Data.CHEATS; }

  function forGame(gameId) {
    return RP.Data.CHEATS.filter(function (c) { return c.games.indexOf(gameId) !== -1; });
  }

  function ownedForGame(gameId) {
    return forGame(gameId).filter(function (c) { return RP.Storage.ownsCheat(c.id); });
  }

  function purchase(cheatId) {
    var cheat = RP.Data.cheatById(cheatId);
    if (!cheat) return { ok: false, reason: 'unknown-cheat' };
    var result = RP.Storage.buyCheat(cheatId, cheat.cost);
    if (result.ok) {
      RP.Sound.powerup();
      RP.Achievements.check({ type: 'cheat' });
      document.dispatchEvent(new CustomEvent('rp:cheat-purchased', { detail: { cheat: cheat } }));
    }
    return result;
  }

  // Builds a quick-lookup object the game code can check, e.g. cheats.godmode === true
  function activeFlags(gameId) {
    var active = RP.Storage.getActiveCheats(gameId);
    var flags = {};
    active.forEach(function (id) { flags[id] = true; });
    return flags;
  }

  RP.Cheats = {
    all: all,
    forGame: forGame,
    ownedForGame: ownedForGame,
    purchase: purchase,
    activeFlags: activeFlags
  };

})(window);
