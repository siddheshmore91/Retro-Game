/* ==========================================================================
   RetroPlay :: leaderboard.js

   HONESTY NOTE (also called out in the project report): this is a 100%
   static site with no backend/database, so there is no way to see real
   scores from other real players on other devices. To still deliver the
   "leaderboard" experience the brief asks for, we generate a deterministic
   set of sample competitor scores (seeded, so they don't reshuffle on every
   visit) and merge the player's real, locally-saved scores into that list.
   The UI labels this clearly as a local/offline leaderboard.
   ========================================================================== */
(function (window) {
  'use strict';
  var RP = window.RP = window.RP || {};

  var BOT_NAMES = [
    'pixel_pete', 'retrofan88', 'arcade_amy', 'joystick_jo', 'byte_buster',
    'neon_ninja', 'glitch_gary', 'turbo_tina', 'coin_collector', 'highscore_hal',
    '8bit_betty', 'lag_lord', 'speedrun_sam', 'combo_carl', 'quarter_muncher'
  ];

  function botScoresFor(gameId, seed) {
    var rand = RP.Engine.seededRandom(seed + hashStr(gameId));
    var baseline = {
      snake: 60, dino: 700, flappy: 25, mario: 1800, pacman: 900,
      breakout: 400, tetris: 8000, invaders: 1500, boss: 3
    }[gameId] || 200;

    var list = [];
    for (var i = 0; i < BOT_NAMES.length; i++) {
      var variance = 0.35 + rand() * 1.5; // some far below, some above baseline
      list.push({ name: BOT_NAMES[i], score: Math.round(baseline * variance) });
    }
    return list;
  }

  function hashStr(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) | 0; }
    return Math.abs(h) % 100000;
  }

  // returns sorted array of {name, score, isYou} for a single game
  function getBoard(gameId) {
    var s = RP.Storage.load();
    var board = botScoresFor(gameId, s.leaderboardSeed);
    var mine = RP.Storage.getGameScore(gameId);
    if (mine.best > 0) {
      board.push({ name: s.profile.name || 'You', score: mine.best, isYou: true });
    }
    board.sort(function (a, b) { return b.score - a.score; });
    return board.slice(0, 20);
  }

  // returns overall ranking by summed "points contribution" across all games
  function getOverallBoard() {
    var s = RP.Storage.load();
    var totals = {};
    BOT_NAMES.forEach(function (n) { totals[n] = 0; });
    RP.Data.GAMES.forEach(function (g) {
      botScoresFor(g.id, s.leaderboardSeed).forEach(function (b) {
        totals[b.name] += RP.Data.pointsForScore(g.id, b.score);
      });
    });
    var board = Object.keys(totals).map(function (n) { return { name: n, score: totals[n] }; });
    board.push({ name: s.profile.name || 'You', score: s.totalPointsEarned, isYou: true });
    board.sort(function (a, b) { return b.score - a.score; });
    return board.slice(0, 20);
  }

  RP.Leaderboard = { getBoard: getBoard, getOverallBoard: getOverallBoard };

})(window);
