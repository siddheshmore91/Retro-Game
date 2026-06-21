/* ==========================================================================
   RetroPlay :: games/mario.js
   Original side-scrolling platformer (not a reproduction of any
   copyrighted character, level, or art) with its own pixel-block hero.
   ========================================================================== */
(function (window) {
  'use strict';
  var RP = window.RP;

  RP.Games.register('mario', function (container, opts) {
    var cheats = opts.cheats || {};
    var W = 640, H = 360;
    var GRAVITY = 1500;
    var GROUND_Y = H - 40;

    var cv = RP.Engine.makeCanvas(container, W, H);
    var ctx = cv.ctx;
    var touch = new RP.Engine.TouchPad(container, ['left', 'right', 'jump']);
    var input = new RP.Engine.Input();
    var particles = new RP.ParticleSystem();

    var player, platforms, coins, enemies, flagX, camX, score, lives, alive, levelNum, levelMsg, levelMsgTimer;

    function buildLevel(n) {
      var rand = RP.Engine.seededRandom(1000 + n * 77);
      platforms = [];
      coins = [];
      enemies = [];
      var x = 0;
      // ground segments with occasional pits
      while (x < 3200) {
        var segLen = 220 + Math.floor(rand() * 260);
        var pit = x > 300 && rand() < 0.22;
        if (!pit) {
          platforms.push({ x: x, y: GROUND_Y, w: segLen, h: H - GROUND_Y, ground: true });
          if (rand() < 0.55) enemies.push({ x: x + segLen * 0.4, y: GROUND_Y - 24, w: 24, h: 24, dir: 1, range: [x + 20, x + segLen - 20], alive: true });
          if (rand() < 0.5) {
            var py = GROUND_Y - 90 - rand() * 50;
            platforms.push({ x: x + segLen * 0.3, y: py, w: 90, h: 16, ground: false });
            for (var ci = 0; ci < 3; ci++) coins.push({ x: x + segLen * 0.3 + 20 + ci * 22, y: py - 22, taken: false });
          }
          for (var cj = 0; cj < 2; cj++) if (rand() < 0.7) coins.push({ x: x + 40 + cj * 80, y: GROUND_Y - 40, taken: false });
        }
        x += segLen + (pit ? 70 + rand() * 30 : 0);
      }
      flagX = x + 40;
      platforms.push({ x: flagX - 10, y: GROUND_Y, w: 400, h: H - GROUND_Y, ground: true });
    }

    function reset() {
      levelNum = levelNum || 1;
      buildLevel(levelNum);
      player = { x: 30, y: GROUND_Y - 32, w: 22, h: 32, vx: 0, vy: 0, onGround: false, jumps: 0, facing: 1, won: false };
      camX = 0;
      score = 0;
      lives = cheats.infinitelives ? 99 : 3;
      alive = true;
      levelMsg = ''; levelMsgTimer = 0;
      if (opts.onScoreUpdate) opts.onScoreUpdate(0);
    }

    function jumpPressed() { return input.consumePressed('Space') || input.consumePressed('ArrowUp') || input.consumePressed('w') || (touch.isDown('jump') && !touch._jumpHeld); }
    function jumpHeld() { return input.isDown('Space') || input.isDown('ArrowUp') || touch.isDown('jump'); }

    var maxJumps = function () { return cheats.infinitejump ? 999 : 2; };

    function update(dt) {
      if (!alive) return;
      particles.update(dt);
      touch._jumpHeld = touch.isDown('jump');
      if (levelMsgTimer > 0) levelMsgTimer -= dt;

      var left = input.isDown('ArrowLeft') || input.isDown('a') || touch.isDown('left');
      var right = input.isDown('ArrowRight') || input.isDown('d') || touch.isDown('right');

      var accel = 900;
      if (left) { player.vx -= accel * dt; player.facing = -1; }
      if (right) { player.vx += accel * dt; player.facing = 1; }
      if (!left && !right) player.vx *= Math.pow(0.001, dt);
      player.vx = RP.Engine.clamp(player.vx, -260, 260);

      if (cheats.flymode) {
        if (jumpHeld()) player.vy = -240; else player.vy += GRAVITY * 0.5 * dt;
      } else {
        if (jumpPressed() && (player.onGround || player.jumps < maxJumps())) {
          player.vy = -480;
          player.jumps++;
          player.onGround = false;
          RP.Sound.jump();
        }
        player.vy += GRAVITY * dt;
      }

      player.x += player.vx * dt;
      player.y += player.vy * dt;

      player.onGround = false;
      var pbox = function (py) { return { x: player.x + 3, y: py, w: player.w - 6, h: player.h }; };
      platforms.forEach(function (p) {
        var box = pbox(player.y);
        if (!RP.Engine.rectsOverlap(box, p)) return;
        var prevBottom = player.y + player.h - player.vy * dt;
        if (player.vy >= 0 && prevBottom <= p.y + 4) {
          player.y = p.y - player.h; player.vy = 0; player.onGround = true; player.jumps = 0;
        } else if (player.vy < 0 && player.y >= p.y + p.h - 6) {
          player.y = p.y + p.h; player.vy = 0;
        } else {
          if (player.x < p.x) player.x = p.x - player.w; else player.x = p.x + p.w;
          player.vx = 0;
        }
      });

      if (player.y > H + 60) { return loseLife(); }
      player.x = Math.max(0, player.x);
      camX = RP.Engine.clamp(player.x - W * 0.35, 0, Math.max(0, flagX + 200 - W));

      enemies.forEach(function (e) {
        if (!e.alive) return;
        e.x += e.dir * 50 * dt;
        if (e.x < e.range[0] || e.x > e.range[1]) e.dir *= -1;
        var ebox = { x: e.x, y: e.y, w: e.w, h: e.h };
        var pbox2 = { x: player.x + 3, y: player.y, w: player.w - 6, h: player.h };
        if (RP.Engine.rectsOverlap(pbox2, ebox)) {
          if (player.vy > 80 && player.y + player.h - ebox.y < 16) {
            e.alive = false;
            player.vy = -300;
            score += 50;
            RP.Sound.hit();
            particles.emit(e.x + e.w / 2, e.y + e.h / 2, { count: 10, colors: ['#E84C3D', '#fff'], speed: 90, life: 0.4 });
            if (opts.onScoreUpdate) opts.onScoreUpdate(score);
          } else if (!cheats.godmode) {
            loseLife();
          }
        }
      });

      coins.forEach(function (c) {
        if (c.taken) return;
        var cbox = { x: c.x - 8, y: c.y - 8, w: 16, h: 16 };
        if (RP.Engine.rectsOverlap({ x: player.x, y: player.y, w: player.w, h: player.h }, cbox)) {
          c.taken = true; score += 10;
          RP.Sound.coin();
          particles.emit(c.x, c.y, { count: 6, colors: ['#FFB930'], speed: 70, life: 0.35 });
          if (opts.onScoreUpdate) opts.onScoreUpdate(score);
        }
      });

      if (!player.won && player.x > flagX) {
        player.won = true;
        score += 200;
        RP.Sound.levelup();
        levelMsg = 'LEVEL ' + levelNum + ' CLEAR! +200';
        levelMsgTimer = 1.6;
        if (opts.onScoreUpdate) opts.onScoreUpdate(score);
        setTimeout(function () { levelNum++; reset(); }, 1500);
      }
    }

    function loseLife() {
      lives -= 1;
      RP.Sound.hit();
      particles.emit(player.x, player.y, { count: 14, colors: ['#E84C3D', '#fff'], speed: 100, life: 0.4 });
      if (lives <= 0 && !cheats.infinitelives) return gameOver();
      player.x = Math.max(0, camX + 30); player.y = GROUND_Y - 32; player.vx = 0; player.vy = 0;
    }

    function gameOver() {
      alive = false;
      RP.Sound.gameover();
      if (opts.onGameOver) opts.onGameOver({ score: score, gameId: 'mario' });
    }

    function draw() {
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#6fb3ff'); g.addColorStop(1, '#cfe8ff');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      for (var i = 0; i < 6; i++) {
        var cx = ((i * 220 - camX * 0.2) % (W + 200)) - 100;
        ctx.beginPath(); ctx.ellipse(cx, 50 + (i % 3) * 20, 30, 12, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = 'rgba(31,174,110,0.5)';
      for (var h = 0; h < 8; h++) {
        var hx = ((h * 180 - camX * 0.45) % (W + 200)) - 100;
        ctx.beginPath(); ctx.arc(hx, GROUND_Y + 10, 70, Math.PI, 0); ctx.fill();
      }

      ctx.save();
      ctx.translate(-camX, 0);

      platforms.forEach(function (p) {
        if (p.x + p.w < camX - 40 || p.x > camX + W + 40) return;
        ctx.fillStyle = p.ground ? '#8a5a2b' : '#b87333';
        ctx.fillRect(p.x, p.y, p.w, p.h > 30 ? Math.min(p.h, 400) : p.h);
        ctx.fillStyle = '#1FAE6E';
        ctx.fillRect(p.x, p.y, p.w, 8);
      });

      coins.forEach(function (c) {
        if (c.taken || c.x < camX - 30 || c.x > camX + W + 30) return;
        ctx.fillStyle = '#FFB930';
        ctx.beginPath(); ctx.arc(c.x, c.y, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#E89B00';
        ctx.beginPath(); ctx.arc(c.x, c.y, 4, 0, Math.PI * 2); ctx.fill();
      });

      enemies.forEach(function (e) {
        if (!e.alive || e.x < camX - 30 || e.x > camX + W + 30) return;
        ctx.fillStyle = '#E84C3D';
        RP.Engine.roundRect(ctx, e.x, e.y, e.w, e.h, 5); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillRect(e.x + 4, e.y + 6, 4, 4); ctx.fillRect(e.x + e.w - 8, e.y + 6, 4, 4);
      });

      // flag
      ctx.fillStyle = '#5B6178';
      ctx.fillRect(flagX, GROUND_Y - 140, 4, 140);
      ctx.fillStyle = '#1FAE6E';
      ctx.beginPath(); ctx.moveTo(flagX + 4, GROUND_Y - 140); ctx.lineTo(flagX + 34, GROUND_Y - 128); ctx.lineTo(flagX + 4, GROUND_Y - 116); ctx.fill();

      // player (procedural pixel hero)
      ctx.save();
      ctx.translate(player.x + player.w / 2, player.y);
      ctx.scale(player.facing, 1);
      ctx.fillStyle = cheats.godmode ? '#FFB930' : '#E84C3D';
      ctx.fillRect(-player.w / 2, 10, player.w, player.h - 10);
      ctx.fillStyle = '#F2C09C';
      ctx.fillRect(-player.w / 2 + 2, 0, player.w - 4, 12);
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(player.w / 2 - 8, 2, 4, 3);
      ctx.restore();

      ctx.restore();

      particles.draw(ctx);

      ctx.fillStyle = '#fff'; ctx.font = '12px monospace';
      ctx.fillText('LIVES ' + (cheats.infinitelives ? '∞' : lives), 8, 18);
      ctx.fillText('LEVEL ' + levelNum, W - 80, 18);
      if (cheats.flymode) { ctx.fillStyle = 'rgba(75,91,246,0.85)'; ctx.fillText('FLY MODE', W / 2 - 35, 18); }
      if (levelMsgTimer > 0) {
        ctx.fillStyle = '#FFB930'; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center';
        ctx.fillText(levelMsg, W / 2, H / 2);
        ctx.textAlign = 'left';
      }
    }

    var loop = new RP.Engine.Loop(update, draw);

    return {
      start: function () { levelNum = 1; reset(); loop.start(); },
      pause: function () { loop.pause(); },
      resume: function () { loop.resume(); },
      restart: function () { levelNum = 1; reset(); loop.resume(); if (!loop.running) loop.start(); },
      destroy: function () { loop.stop(); input.destroy(); touch.destroy(); }
    };
  });

})(window);
