/* ==========================================================================
   RetroPlay :: data.js
   Static catalog data: games, cheats, achievements.

   IMPORTANT ENGINEERING NOTE:
   This data is also mirrored at /data/games.json and /data/cheats.json for
   human-readability and editing convenience. It is embedded here as plain
   JS objects (not fetched at runtime) because Chrome/Edge block fetch()
   and XHR against local files opened with the file:// protocol (CORS).
   Since this project's #1 requirement is "must run by double-clicking
   index.html, no server", we cannot rely on fetch() for core data. If you
   later host this on a real web server, you can switch DATA loading back
   to fetch(data/games.json) safely if you prefer a single source of truth.
   ========================================================================== */
(function (window) {
  'use strict';
  var RP = window.RP = window.RP || {};

  var GAMES = [
    { id: 'snake',    title: 'Snake',           emoji: '🐍', color: '#1FAE6E', tagline: 'Classic grid, grow without crashing.',
      keyboard: 'Arrow keys / WASD to steer.', touch: 'Swipe or use the on-screen D-pad.' },
    { id: 'dino',     title: 'Chrome Dino',     emoji: '🦕', color: '#5B6178', tagline: 'Endless runner — jump the cacti, duck the birds.',
      keyboard: 'Space / Up to jump, Down to duck.', touch: 'Tap to jump, hold-swipe down to duck.' },
    { id: 'flappy',   title: 'Flappy Bird',     emoji: '🐦', color: '#4B5BF6', tagline: 'Tap to fly through the gaps.',
      keyboard: 'Space / Up Arrow to flap.', touch: 'Tap anywhere to flap.' },
    { id: 'mario',    title: 'Mario Clone',     emoji: '🍄', color: '#E84C3D', tagline: 'Side-scrolling platformer with coins & enemies.',
      keyboard: 'Arrows/WASD to move, Space to jump.', touch: 'D-pad + jump button.' },
    { id: 'pacman',   title: 'Pac-Man Clone',   emoji: '👻', color: '#FFB930', tagline: 'Eat dots, dodge ghosts, grab power pellets.',
      keyboard: 'Arrow keys / WASD to move.', touch: 'On-screen D-pad.' },
    { id: 'breakout', title: 'Breakout',        emoji: '🧱', color: '#FF6FA8', tagline: 'Bounce, break, clear every level.',
      keyboard: 'Left/Right or A/D to move paddle.', touch: 'Drag left/right on screen.' },
    { id: 'tetris',   title: 'Tetris',          emoji: '🟦', color: '#4B5BF6', tagline: 'Stack the falling blocks, clear lines.',
      keyboard: 'Arrows to move/rotate, Space to hard-drop, C to hold.', touch: 'D-pad + rotate/drop buttons.' },
    { id: 'invaders', title: 'Space Invaders',  emoji: '👾', color: '#1FAE6E', tagline: 'Defend Earth from the swarm — and the boss.',
      keyboard: 'Left/Right to move, Space to fire.', touch: 'D-pad + fire button.' },
    { id: 'boss',     title: 'Beat The Boss',   emoji: '👊', color: '#FF0040', tagline: 'Weapon-based boss battles, best of 3 rounds.',
      keyboard: 'Arrows to move, Z to attack, X to block, 1-3 to switch weapon.', touch: 'D-pad + attack/block buttons.' }
  ];

  var CHEATS = [
    { id: 'godmode',        name: 'God Mode',        emoji: '⚡', cost: 500, games: ['dino', 'mario', 'boss', 'invaders', 'pacman'],
      desc: 'Become immune to damage and hazards for the whole run.' },
    { id: 'flymode',         name: 'Fly Mode',        emoji: '🪽', cost: 700, games: ['mario', 'dino'],
      desc: 'Hold jump to float freely instead of falling.' },
    { id: 'infinitejump',   name: 'Infinite Jump',   emoji: '🦘', cost: 300, games: ['mario', 'dino'],
      desc: 'Jump again in mid-air, as many times as you want.' },
    { id: 'infinitelives',  name: 'Infinite Lives',  emoji: '💗', cost: 400, games: ['mario', 'pacman', 'breakout', 'invaders', 'boss'],
      desc: 'Lives never run out — you simply respawn.' },
    { id: 'magnetfood',     name: 'Magnet Food',     emoji: '🧲', cost: 250, games: ['snake'],
      desc: 'Nearby food drifts toward your snake automatically.' },
    { id: 'doublespeed',    name: 'Double Speed',     emoji: '⏩', cost: 200, games: ['snake', 'dino', 'flappy', 'breakout', 'invaders', 'tetris'],
      desc: 'Everything moves twice as fast — for double the points.' },
    { id: 'invincible',     name: 'Invincible',      emoji: '🛡️', cost: 350, games: ['snake', 'breakout', 'flappy'],
      desc: 'Pass through walls/obstacles without losing.' },
    { id: 'scoremultiplier', name: 'Score x2',        emoji: '✖️2', cost: 600, games: ['snake', 'dino', 'flappy', 'mario', 'pacman', 'breakout', 'tetris', 'invaders', 'boss'],
      desc: 'Every point you earn this run is doubled.' },
    { id: 'slowmo',          name: 'Slow-Mo',         emoji: '🐢', cost: 300, games: ['dino', 'flappy', 'breakout', 'invaders', 'pacman'],
      desc: 'Obstacles and enemies move 30% slower.' }
  ];

  var ACHIEVEMENTS = [
    { id: 'first_blood',   name: 'First Blood',      emoji: '🎮', points: 50,  desc: 'Play your first game.' },
    { id: 'century_club',  name: 'Century Club',      emoji: '💯', points: 100, desc: 'Score 100+ points in any single game.' },
    { id: 'high_roller',   name: 'High Roller',       emoji: '💰', points: 100, desc: 'Earn 1,000 total points.' },
    { id: 'point_baron',   name: 'Point Baron',       emoji: '👑', points: 250, desc: 'Earn 5,000 total points.' },
    { id: 'all_rounder',   name: 'All-Rounder',       emoji: '🕹️', points: 300, desc: 'Play all 9 games at least once.' },
    { id: 'snake_charmer', name: 'Snake Charmer',     emoji: '🐍', points: 80,  desc: 'Score 50+ in Snake.' },
    { id: 'dino_master',   name: 'Dino Master',       emoji: '🦕', points: 80,  desc: 'Score 500+ in Chrome Dino.' },
    { id: 'flappy_ace',    name: 'Flappy Ace',        emoji: '🐦', points: 80,  desc: 'Score 20+ in Flappy Bird.' },
    { id: 'brick_breaker', name: 'Brick Breaker',     emoji: '🧱', points: 100, desc: 'Clear a full level in Breakout.' },
    { id: 'tetris_master', name: 'Line Master',       emoji: '🟦', points: 100, desc: 'Clear 10+ lines in one Tetris game.' },
    { id: 'ghost_hunter',  name: 'Ghost Hunter',      emoji: '👻', points: 120, desc: 'Eat a ghost after a power pellet in Pac-Man.' },
    { id: 'galaxy_defender', name: 'Galaxy Defender', emoji: '👾', points: 150, desc: 'Defeat the boss wave in Space Invaders.' },
    { id: 'boss_slayer',   name: 'Boss Slayer',       emoji: '👊', points: 150, desc: 'Win a fight in Beat The Boss.' },
    { id: 'cheat_collector', name: 'Cheat Collector', emoji: '🛒', points: 100, desc: 'Own 3 different cheats at once.' },
    { id: 'streak_7',      name: 'Dedicated',         emoji: '🔥', points: 200, desc: 'Log in 7 days in a row.' },
    { id: 'big_spender',   name: 'Big Spender',       emoji: '🪙', points: 100, desc: 'Spend 2,000 points total on cheats.' }
  ];

  // points formula per game — tuned so an average run earns 20-120 pts
  function pointsForScore(gameId, score) {
    var table = {
      snake: 2, dino: 0.4, flappy: 8, mario: 1.2, pacman: 1.5,
      breakout: 1, tetris: 0.5, invaders: 1, boss: 15
    };
    var mult = table[gameId] || 1;
    return Math.max(5, Math.round(score * mult));
  }

  RP.Data = {
    GAMES: GAMES,
    CHEATS: CHEATS,
    ACHIEVEMENTS: ACHIEVEMENTS,
    pointsForScore: pointsForScore,
    gameById: function (id) {
      for (var i = 0; i < GAMES.length; i++) if (GAMES[i].id === id) return GAMES[i];
      return null;
    },
    cheatById: function (id) {
      for (var i = 0; i < CHEATS.length; i++) if (CHEATS[i].id === id) return CHEATS[i];
      return null;
    }
  };

})(window);
