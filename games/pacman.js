/* ==========================================================================
   RetroPlay :: games/pacman.js
   Maze is an original layout (NOT a reproduction of any copyrighted
   arcade maze) — an outer-loop corridor plus a grid of small pillar
   obstacles, generated so full connectivity is guaranteed by construction.
   ========================================================================== */
(function (window) {
  'use strict';
  var RP = window.RP;

  RP.Games.register('pacman', function (container, opts) {
    var cheats = opts.cheats || {};
    var COLS = 19, ROWS = 17, CELL = 24;
    var W = COLS * CELL, H = ROWS * CELL + 24;

    var cv = RP.Engine.makeCanvas(container, W, H);
    var ctx = cv.ctx;
    var touch = new RP.Engine.TouchPad(container, ['up', 'down', 'left', 'right']);
    var input = new RP.Engine.Input();
    var particles = new RP.ParticleSystem();

    function buildMaze() {
      var m = [];
      for (var r = 0; r < ROWS; r++) {
        var row = [];
        for (var c = 0; c < COLS; c++) {
          var border = r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1;
          row.push(border ? '#' : '.');
        }
        m.push(row);
      }
      // pillars (don't touch the outer-loop corridor rows/cols 1 & ROWS-2 / COLS-2)
      [3, 7, 11].forEach(function (r) {
        [3, 7, 11, 15].forEach(function (c) {
          if (c + 1 <= COLS - 3) { m[r][c] = '#'; m[r][c + 1] = '#'; m[r + 1][c] = '#'; m[r + 1][c + 1] = '#'; }
        });
      });
      // ghost house
      for (var gr = 7; gr <= 9; gr++) for (var gc = 8; gc <= 10; gc++) m[gr][gc] = ' ';
      m[6][9] = ' ';
      // power pellets at four corners
      [[2, 2], [2, COLS - 3], [ROWS - 3, 2], [ROWS - 3, COLS - 3]].forEach(function (p) { m[p[0]][p[1]] = 'o'; });
      return m;
    }

    var maze, dotsLeft, score, lives, alive, level, frightTimer, ghostCombo, paused;
    var player, ghosts, queuedDir;
    var GHOST_COLORS = ['#FF6FA8', '#4B5BF6', '#FFB930', '#1FAE6E'];

    function cellFree(r, c) { return maze[r] && maze[r][c] && maze[r][c] !== '#'; }

    function reset() {
      maze = buildMaze();
      dotsLeft = 0;
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) if (maze[r][c] === '.' || maze[r][c] === 'o') dotsLeft++;
      score = 0;
      lives = cheats.infinitelives ? 99 : 3;
      level = 1;
      alive = true;
      paused = false;
      frightTimer = 0;
      ghostCombo = 0;
      player = { r: 13, c: 9, x: 9 * CELL, y: 13 * CELL, dir: { r: 0, c: 0 }, nextDir: { r: 0, c: 0 }, mouth: 0 };
      ghosts = GHOST_COLORS.map(function (color, i) {
        return { r: 8, c: 8 + i % 3, x: (8 + i % 3) * CELL, y: 8 * CELL, dir: { r: -1, c: 0 }, color: color, frightened: false, eaten: false, id: i };
      });
      queuedDir = { r: 0, c: 0 };
      if (opts.onScoreUpdate) opts.onScoreUpdate(0);
    }

    function tryDir(entity, dir) {
      var nr = entity.r + dir.r, nc = entity.c + dir.c;
      nc = (nc + COLS) % COLS;
      return cellFree(nr, nc);
    }

    function atCellCenter(entity) {
      return Math.abs(entity.x - entity.c * CELL) < 2 && Math.abs(entity.y - entity.r * CELL) < 2;
    }

    function update(dt) {
      if (!alive || paused) return;
      particles.update(dt);
      player.mouth += dt * 10;

      if (input.isDown('ArrowUp') || input.isDown('w') || touch.isDown('up')) queuedDir = { r: -1, c: 0 };
      else if (input.isDown('ArrowDown') || input.isDown('s') || touch.isDown('down')) queuedDir = { r: 1, c: 0 };
      else if (input.isDown('ArrowLeft') || input.isDown('a') || touch.isDown('left')) queuedDir = { r: 0, c: -1 };
      else if (input.isDown('ArrowRight') || input.isDown('d') || touch.isDown('right')) queuedDir = { r: 0, c: 1 };

      var pSpeed = (cheats.slowmo ? 90 : 120) * CELL / 24;

      if (atCellCenter(player)) {
        player.r = Math.round(player.y / CELL); player.c = Math.round(player.x / CELL);
        player.x = player.c * CELL; player.y = player.r * CELL;
        if (tryDir(player, queuedDir)) player.dir = queuedDir;
        if (!tryDir(player, player.dir)) player.dir = { r: 0, c: 0 };
      }
      player.x += player.dir.c * pSpeed * dt;
      player.y += player.dir.r * pSpeed * dt;
      player.c = (Math.round(player.x / CELL) + COLS) % COLS;
      player.x = ((player.x % (COLS * CELL)) + COLS * CELL) % (COLS * CELL);

      var pr = Math.round(player.y / CELL), pc = Math.round(player.x / CELL) % COLS;
      if (atCellCenter(player) && maze[pr] && (maze[pr][pc] === '.' || maze[pr][pc] === 'o')) {
        if (maze[pr][pc] === 'o') {
          frightTimer = 6;
          ghostCombo = 0;
          ghosts.forEach(function (g) { if (!g.eaten) g.frightened = true; });
          RP.Sound.powerup();
        } else { RP.Sound.eat(); }
        score += maze[pr][pc] === 'o' ? 50 : 10;
        maze[pr][pc] = ' ';
        dotsLeft--;
        if (opts.onScoreUpdate) opts.onScoreUpdate(score);
        if (dotsLeft <= 0) { level++; nextLevel(); }
      }

      if (frightTimer > 0) { frightTimer -= dt; if (frightTimer <= 0) ghosts.forEach(function (g) { g.frightened = false; }); }

      var gSpeed = ((cheats.slowmo ? 75 : 100) + level * 4) * CELL / 24;
      ghosts.forEach(function (g) {
        if (g.eaten) {
          gSpeed = 220;
          moveGhostToward(g, 9, 8, gSpeed, dt);
          if (Math.abs(g.x - 9 * CELL) < 3 && Math.abs(g.y - 8 * CELL) < 3) { g.eaten = false; g.frightened = false; }
          return;
        }
        var speed = g.frightened ? gSpeed * 0.6 : gSpeed;
        if (atCellCenter(g)) {
          g.r = Math.round(g.y / CELL); g.c = Math.round(g.x / CELL);
          g.x = g.c * CELL; g.y = g.r * CELL;
          chooseGhostDir(g);
        }
        g.x += g.dir.c * speed * dt;
        g.y += g.dir.r * speed * dt;
      });

      ghosts.forEach(function (g) {
        if (g.eaten) return;
        var dist = Math.hypot(g.x - player.x, g.y - player.y);
        if (dist < CELL * 0.6) {
          if (g.frightened) {
            g.eaten = true;
            ghostCombo++;
            var pts = 200 * Math.pow(2, Math.min(ghostCombo - 1, 3));
            score += pts;
            RP.Storage.bumpStat('ghostsEaten', 1);
            RP.Sound.ghost();
            particles.emit(g.x, g.y, { count: 14, colors: ['#fff', g.color], speed: 100, life: 0.4 });
            if (opts.onScoreUpdate) opts.onScoreUpdate(score);
          } else if (!cheats.godmode) {
            loseLife();
          }
        }
      });
    }

    function nextLevel() {
      maze = buildMaze();
      dotsLeft = 0;
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) if (maze[r][c] === '.' || maze[r][c] === 'o') dotsLeft++;
      RP.Sound.levelup();
      player.r = 13; player.c = 9; player.x = 9 * CELL; player.y = 13 * CELL; player.dir = { r: 0, c: 0 };
    }

    function moveGhostToward(g, tr, tc, speed, dt) {
      if (atCellCenter(g)) {
        g.r = Math.round(g.y / CELL); g.c = Math.round(g.x / CELL);
        var best = null, bestDist = Infinity;
        dirs().forEach(function (d) {
          if (!tryDir(g, d)) return;
          if (d.r === -g.dir.r && d.c === -g.dir.c) return;
          var nr = g.r + d.r, nc = g.c + d.c;
          var dist = Math.hypot(nr - tr, nc - tc);
          if (dist < bestDist) { bestDist = dist; best = d; }
        });
        g.dir = best || g.dir;
      }
      g.x += g.dir.c * speed * dt;
      g.y += g.dir.r * speed * dt;
    }

    function dirs() { return [{ r: -1, c: 0 }, { r: 1, c: 0 }, { r: 0, c: -1 }, { r: 0, c: 1 }]; }

    function chooseGhostDir(g) {
      var options = dirs().filter(function (d) { return tryDir(g, d) && !(d.r === -g.dir.r && d.c === -g.dir.c); });
      if (!options.length) options = dirs().filter(function (d) { return tryDir(g, d); });
      if (!options.length) return;
      if (g.frightened || Math.random() < 0.25) {
        g.dir = options[Math.floor(Math.random() * options.length)];
        return;
      }
      var best = options[0], bestDist = Infinity;
      options.forEach(function (d) {
        var nr = g.r + d.r, nc = g.c + d.c;
        var dist = Math.hypot(nr - player.r, nc - player.c);
        if (dist < bestDist) { bestDist = dist; best = d; }
      });
      g.dir = best;
    }

    function loseLife() {
      RP.Sound.hit();
      lives -= 1;
      particles.emit(player.x, player.y, { count: 16, colors: ['#FFB930', '#fff'], speed: 100, life: 0.5 });
      if (lives <= 0 && !cheats.infinitelives) return gameOver();
      player.r = 13; player.c = 9; player.x = 9 * CELL; player.y = 13 * CELL; player.dir = { r: 0, c: 0 };
      ghosts.forEach(function (g, i) { g.r = 8; g.c = 8 + i % 3; g.x = g.c * CELL; g.y = 8 * CELL; g.frightened = false; g.eaten = false; });
    }

    function gameOver() {
      alive = false;
      RP.Sound.gameover();
      if (opts.onGameOver) opts.onGameOver({ score: score, gameId: 'pacman' });
    }

    function draw() {
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      ctx.font = '12px monospace';
      ctx.fillText('SCORE ' + score, 8, 16);
      ctx.fillText('LIVES ' + (cheats.infinitelives ? '∞' : lives), W - 90, 16);

      var top = 24;
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
        var ch = maze[r][c];
        var x = c * CELL, y = top + r * CELL;
        if (ch === '#') { ctx.fillStyle = '#1d2a55'; ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2); }
        else if (ch === '.') { ctx.fillStyle = '#FFB930'; ctx.beginPath(); ctx.arc(x + CELL / 2, y + CELL / 2, 2, 0, Math.PI * 2); ctx.fill(); }
        else if (ch === 'o') { ctx.fillStyle = '#FFB930'; ctx.beginPath(); ctx.arc(x + CELL / 2, y + CELL / 2, 5 + Math.sin(player.mouth) * 1.5, 0, Math.PI * 2); ctx.fill(); }
      }

      // player
      ctx.save();
      ctx.translate(player.x + CELL / 2, top + player.y + CELL / 2);
      var angle = player.dir.c === -1 ? Math.PI : player.dir.r === -1 ? -Math.PI / 2 : player.dir.r === 1 ? Math.PI / 2 : 0;
      ctx.rotate(angle);
      var mouthOpen = Math.abs(Math.sin(player.mouth)) * 0.7 + 0.1;
      ctx.fillStyle = '#FFB930';
      ctx.beginPath();
      ctx.arc(0, 0, CELL / 2 - 2, mouthOpen, Math.PI * 2 - mouthOpen);
      ctx.lineTo(0, 0);
      ctx.fill();
      ctx.restore();

      ghosts.forEach(function (g) {
        ctx.fillStyle = g.eaten ? 'rgba(255,255,255,0.3)' : (g.frightened ? (frightTimer < 2 && Math.floor(frightTimer * 6) % 2 ? '#fff' : '#4B5BF6') : g.color);
        var gx = g.x + CELL / 2, gy = top + g.y + CELL / 2;
        ctx.beginPath();
        ctx.arc(gx, gy - 2, CELL / 2 - 3, Math.PI, 0);
        ctx.lineTo(gx + CELL / 2 - 3, gy + CELL / 2 - 4);
        for (var w = 0; w < 4; w++) ctx.lineTo(gx + CELL / 2 - 3 - (w + 1) * (CELL - 6) / 4, gy + (w % 2 === 0 ? CELL / 2 - 4 : CELL / 2 - 8));
        ctx.closePath();
        ctx.fill();
        if (!g.eaten) {
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(gx - 4, gy - 4, 3, 0, Math.PI * 2); ctx.arc(gx + 4, gy - 4, 3, 0, Math.PI * 2); ctx.fill();
        }
      });

      particles.draw(ctx);
      if (cheats.godmode) { ctx.fillStyle = 'rgba(255,185,48,0.9)'; ctx.font = '11px monospace'; ctx.fillText('GOD MODE', W / 2 - 35, 16); }
    }

    var loop = new RP.Engine.Loop(update, draw);

    return {
      start: function () { reset(); loop.start(); },
      pause: function () { loop.pause(); },
      resume: function () { loop.resume(); },
      restart: function () { reset(); loop.resume(); if (!loop.running) loop.start(); },
      destroy: function () { loop.stop(); input.destroy(); touch.destroy(); }
    };
  });

})(window);
