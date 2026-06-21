/* ==========================================================================
   RetroPlay :: achievements.js
   Central rules engine for unlocking achievements. Call
   RP.Achievements.check(context) after any meaningful event (game over,
   points changed, cheat purchased, login) — it re-evaluates every
   not-yet-unlocked achievement and returns the newly unlocked ones.
   ========================================================================== */
(function (window) {
  'use strict';
  var RP = window.RP = window.RP || {};

  // context: { type: 'gameover'|'login'|'cheat'|'generic', gameId, score, state }
  var RULES = {
    first_blood: function (ctx, s) { return s.stats.gamesPlayed >= 1; },
    century_club: function (ctx, s) { return ctx.type === 'gameover' && ctx.score >= 100; },
    high_roller: function (ctx, s) { return s.totalPointsEarned >= 1000; },
    point_baron: function (ctx, s) { return s.totalPointsEarned >= 5000; },
    all_rounder: function (ctx, s) { return s.stats.distinctGamesPlayed.length >= 9; },
    snake_charmer: function (ctx, s) { return (s.scores.snake && s.scores.snake.best >= 50); },
    dino_master: function (ctx, s) { return (s.scores.dino && s.scores.dino.best >= 500); },
    flappy_ace: function (ctx, s) { return (s.scores.flappy && s.scores.flappy.best >= 20); },
    brick_breaker: function (ctx, s) { return s.stats.levelsCleared >= 1 && ctx.gameId === 'breakout'; },
    tetris_master: function (ctx, s) { return s.stats.linesCleared >= 10; },
    ghost_hunter: function (ctx, s) { return s.stats.ghostsEaten >= 1; },
    galaxy_defender: function (ctx, s) { return s.stats.bossesDefeated >= 1 && ctx.gameId === 'invaders'; },
    boss_slayer: function (ctx, s) { return ctx.type === 'gameover' && ctx.gameId === 'boss' && ctx.won; },
    cheat_collector: function (ctx, s) { return Object.keys(s.cheats.owned).length >= 3; },
    streak_7: function (ctx, s) { return s.profile.streak >= 7; },
    big_spender: function (ctx, s) { return s.totalPointsSpent >= 2000; }
  };

  function check(ctx) {
    ctx = ctx || { type: 'generic' };
    var s = RP.Storage.load();
    var unlocked = [];
    RP.Data.ACHIEVEMENTS.forEach(function (a) {
      if (RP.Storage.hasAchievement(a.id)) return;
      var rule = RULES[a.id];
      if (rule && rule(ctx, s)) {
        if (RP.Storage.unlockAchievement(a.id)) {
          RP.Storage.addPoints(a.points, 'achievement:' + a.id);
          unlocked.push(a);
        }
      }
    });
    if (unlocked.length) {
      document.dispatchEvent(new CustomEvent('rp:achievements-unlocked', { detail: { achievements: unlocked } }));
    }
    return unlocked;
  }

  RP.Achievements = { check: check };

})(window);
