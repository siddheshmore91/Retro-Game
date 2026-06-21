/* ==========================================================================
   RetroPlay :: games/invaders.js
   ========================================================================== */
(function (window) {
  'use strict';
  var RP = window.RP;

  RP.Games.register('invaders', function (container, opts) {
    var cheats = opts.cheats || {};
    var W = 480, H = 540;

    var cv = RP.Engine.makeCanvas(container, W, H);
    var ctx = cv.ctx;
    var touch = new RP.Engine.TouchPad(container, ['left', 'right', 'fire']);
    var input = new RP.Engine.Input();
    var particles = new RP.ParticleSystem();

    var player, enemies, bullets, enemyBullets, score, lives, alive, wave, dir, enemySpeed, fireTimer, boss, bossActive, shootCooldown;

    function reset() {
      player = { x: W / 2 - 16, y: H - 46, w: 32, h: 18 };
      bullets = []; enemyBullets = [];
      score = 0;
      lives = cheats.infinitelives ? 99 : 3;
      alive = true;
      wave = 1;
      boss = null; bossActive = false;
      shootCooldown = 0;
      spawnWave();
      if (opts.onScoreUpdate) opts.onScoreUpdate(0);
    }

    function spawnWave() {
      enemies = [];
      var rows = 4, cols = 8;
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
        enemies.push({ x: 40 + c * 44, y: 50 + r * 36, w: 28, h: 20, alive: true, row: r });
      }
      dir = 1;
      enemySpeed = (30 + wave * 6) * (cheats.doublespeed ? 1.8 : 1) * (cheats.slowmo ? 0.65 : 1);
      fireTimer = 1;
    }

    function spawnBoss() {
      bossActive = true;
      boss = { x: W / 2 - 60, y: 50, w: 120, h: 60, hp: 30 + wave * 10, maxHp: 30 + wave * 10, dir: 1, fireTimer: 1 };
    }

    function firePressed() { return input.consumePressed('Space') || (touch.isDown('fire') && !touch._fireHeld); }

    function update(dt) {
      if (!alive) return;
      particles.update(dt);

      var left = input.isDown('ArrowLeft') || input.isDown('a') || touch.isDown('left');
      var right = input.isDown('ArrowRight') || input.isDown('d') || touch.isDown('right');
      if (left) player.x -= 260 * dt;
      if (right) player.x += 260 * dt;
      player.x = RP.Engine.clamp(player.x, 0, W - player.w);

      shootCooldown -= dt;
      touch._fireHeld = touch.isDown('fire');
      if (firePressed() && shootCooldown <= 0) {
        bullets.push({ x: player.x + player.w / 2 - 2, y: player.y, w: 4, h: 12 });
        RP.Sound.laser();
        shootCooldown = 0.28;
      }

      bullets.forEach(function (b) { b.y -= 420 * dt; });
      bullets = bullets.filter(function (b) { return b.y > -20; });
      enemyBullets.forEach(function (b) { b.y += (180 * (cheats.slowmo ? 0.6 : 1)) * dt; });
      enemyBullets = enemyBullets.filter(function (b) { return b.y < H + 20; });

      if (!bossActive) {
        var edge = false;
        enemies.forEach(function (e) { if (e.alive && (e.x <= 4 || e.x + e.w >= W - 4)) edge = true; });
        var moveX = dir * enemySpeed * dt;
        enemies.forEach(function (e) {
          if (!e.alive) return;
          e.x += moveX;
          if (edge) e.y += 14;
        });
        if (edge) dir *= -1;

        fireTimer -= dt;
        if (fireTimer <= 0) {
          var shooters = enemies.filter(function (e) { return e.alive; });
          if (shooters.length) {
            var s = shooters[Math.floor(Math.random() * shooters.length)];
            enemyBullets.push({ x: s.x + s.w / 2 - 2, y: s.y + s.h, w: 4, h: 12 });
          }
          fireTimer = Math.max(0.25, 0.9 - wave * 0.05);
        }

        enemies.forEach(function (e) { if (e.alive && e.y + e.h >= player.y) { if (!cheats.godmode) gameOver(); } });

        if (!enemies.some(function (e) { return e.alive; })) {
          RP.Sound.levelup();
          if (wave % 3 === 0) { spawnBoss(); } else { wave++; spawnWave(); }
        }
      } else if (boss) {
        boss.x += boss.dir * 90 * dt * (cheats.slowmo ? 0.6 : 1);
        if (boss.x <= 0 || boss.x + boss.w >= W) boss.dir *= -1;
        boss.fireTimer -= dt;
        if (boss.fireTimer <= 0) {
          for (var i = -1; i <= 1; i++) enemyBullets.push({ x: boss.x + boss.w / 2 + i * 20 - 2, y: boss.y + boss.h, w: 4, h: 12 });
          boss.fireTimer = Math.max(0.4, 1.1 - wave * 0.05);
        }
      }

      // collisions: bullets vs enemies
      bullets.forEach(function (b) {
        if (b.hit) return;
        if (!bossActive) {
          enemies.forEach(function (e) {
            if (e.alive && !b.hit && RP.Engine.rectsOverlap(b, e)) {
              e.alive = false; b.hit = true;
              score += 20 * wave;
              RP.Sound.coin();
              particles.emit(e.x + e.w / 2, e.y + e.h / 2, { count: 10, colors: ['#1FAE6E', '#fff'], speed: 90, life: 0.4 });
              if (opts.onScoreUpdate) opts.onScoreUpdate(score);
            }
          });
        } else if (boss && !b.hit && RP.Engine.rectsOverlap(b, boss)) {
          b.hit = true;
          boss.hp -= 1;
          score += 5;
          particles.emit(b.x, b.y, { count: 4, colors: ['#fff'], speed: 60, life: 0.2 });
          if (boss.hp <= 0) {
            RP.Sound.explosion();
            particles.emit(boss.x + boss.w / 2, boss.y + boss.h / 2, { count: 30, colors: ['#FF0040', '#FFB930', '#fff'], speed: 160, life: 0.7 });
            score += 500;
            RP.Storage.bumpStat('bossesDefeated', 1);
            bossActive = false; boss = null;
            wave++; spawnWave();
            if (opts.onScoreUpdate) opts.onScoreUpdate(score);
          }
        }
      });
      bullets = bullets.filter(function (b) { return !b.hit; });

      if (!cheats.godmode) {
        enemyBullets.forEach(function (b) {
          if (!b.hit && RP.Engine.rectsOverlap(b, player)) { b.hit = true; loseLife(); }
        });
        enemyBullets = enemyBullets.filter(function (b) { return !b.hit; });
      }
    }

    function loseLife() {
      RP.Sound.hit();
      lives -= 1;
      particles.emit(player.x + player.w / 2, player.y, { count: 14, colors: ['#FF0040', '#fff'], speed: 100, life: 0.4 });
      if (lives <= 0 && !cheats.infinitelives) gameOver();
    }

    function gameOver() {
      alive = false;
      RP.Sound.gameover();
      if (opts.onGameOver) opts.onGameOver({ score: score, gameId: 'invaders' });
    }

    function draw() {
      ctx.fillStyle = '#070710';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (var s = 0; s < 40; s++) { ctx.globalAlpha = 0.3 + (s % 5) * 0.1; ctx.fillRect((s * 53) % W, (s * 97) % H, 2, 2); }
      ctx.globalAlpha = 1;

      ctx.fillStyle = '#fff'; ctx.font = '12px monospace';
      ctx.fillText('SCORE ' + score, 8, 16);
      ctx.fillText('WAVE ' + wave, W / 2 - 28, 16);
      ctx.fillText('LIVES ' + (cheats.infinitelives ? '∞' : lives), W - 90, 16);

      ctx.fillStyle = '#1FAE6E';
      RP.Engine.roundRect(ctx, player.x, player.y, player.w, player.h, 4); ctx.fill();
      ctx.fillRect(player.x + player.w / 2 - 3, player.y - 8, 6, 8);

      ctx.fillStyle = '#fff';
      bullets.forEach(function (b) { ctx.fillRect(b.x, b.y, b.w, b.h); });
      ctx.fillStyle = '#FF0040';
      enemyBullets.forEach(function (b) { ctx.fillRect(b.x, b.y, b.w, b.h); });

      var rowColors = ['#FF6FA8', '#FFB930', '#4B5BF6', '#1FAE6E'];
      enemies.forEach(function (e) {
        if (!e.alive) return;
        ctx.fillStyle = rowColors[e.row % rowColors.length];
        ctx.fillRect(e.x, e.y, e.w, e.h);
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(e.x + 5, e.y + 5, 4, 4);
        ctx.fillRect(e.x + e.w - 9, e.y + 5, 4, 4);
      });

      if (boss) {
        ctx.fillStyle = '#FF0040';
        RP.Engine.roundRect(ctx, boss.x, boss.y, boss.w, boss.h, 10); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillRect(boss.x + 16, boss.y + 16, 10, 10);
        ctx.fillRect(boss.x + boss.w - 26, boss.y + 16, 10, 10);
        var pct = boss.hp / boss.maxHp;
        ctx.fillStyle = '#222'; ctx.fillRect(W / 2 - 80, 30, 160, 8);
        ctx.fillStyle = pct > 0.3 ? '#1FAE6E' : '#FF0040'; ctx.fillRect(W / 2 - 80, 30, 160 * pct, 8);
        ctx.strokeStyle = '#fff'; ctx.strokeRect(W / 2 - 80, 30, 160, 8);
      }

      particles.draw(ctx);
      if (cheats.godmode) { ctx.fillStyle = 'rgba(255,185,48,0.9)'; ctx.font = '11px monospace'; ctx.fillText('GOD MODE', W / 2 - 35, H - 10); }
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
