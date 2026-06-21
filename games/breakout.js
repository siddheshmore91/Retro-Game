/* ==========================================================================
   RetroPlay :: games/breakout.js
   ========================================================================== */
(function (window) {
  'use strict';
  var RP = window.RP;

  RP.Games.register('breakout', function (container, opts) {
    var cheats = opts.cheats || {};
    var W = 480, H = 560;
    var PADDLE_Y = H - 30;
    var ROWS = 6, COLS = 10, BRICK_W = 42, BRICK_H = 18, BRICK_GAP = 4, BRICK_TOP = 60;

    var cv = RP.Engine.makeCanvas(container, W, H);
    var ctx = cv.ctx;
    var touch = new RP.Engine.TouchPad(container, ['left', 'right']);
    var input = new RP.Engine.Input();
    var particles = new RP.ParticleSystem();

    var paddle, balls, bricks, powerups, score, lives, level, alive, baseSpeed;
    var colors = ['#FF6FA8', '#FFB930', '#4B5BF6', '#1FAE6E', '#E84C3D', '#9b6bff'];

    function reset() {
      paddle = { x: W / 2 - 45, y: PADDLE_Y, w: 90, h: 12, speedMult: 1 };
      score = 0;
      lives = cheats.infinitelives ? 99 : 3;
      level = 1;
      alive = true;
      baseSpeed = (cheats.doublespeed ? 420 : 230) * (cheats.slowmo ? 0.75 : 1);
      powerups = [];
      buildLevel();
      newBallOnPaddle();
      if (opts.onScoreUpdate) opts.onScoreUpdate(0);
    }

    function buildLevel() {
      bricks = [];
      var rows = Math.min(ROWS + level - 1, 9);
      var totalW = COLS * (BRICK_W + BRICK_GAP) - BRICK_GAP;
      var offsetX = (W - totalW) / 2;
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < COLS; c++) {
          if (level >= 2 && (r + c) % 7 === 0) continue; // gaps pattern on harder levels
          bricks.push({
            x: offsetX + c * (BRICK_W + BRICK_GAP), y: BRICK_TOP + r * (BRICK_H + BRICK_GAP),
            w: BRICK_W, h: BRICK_H, hp: 1 + (r < 2 ? 1 : 0),
            color: colors[r % colors.length], alive: true,
            power: Math.random() < 0.14 ? randomPower() : null
          });
        }
      }
    }

    function randomPower() {
      return ['wide', 'multi', 'slow', 'life'][Math.floor(Math.random() * 4)];
    }

    function newBallOnPaddle() {
      balls = [{ x: paddle.x + paddle.w / 2, y: paddle.y - 8, vx: 0, vy: 0, r: 7, stuck: true }];
    }

    function launchBalls() {
      balls.forEach(function (b) {
        if (b.stuck) {
          b.stuck = false;
          var ang = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
          b.vx = Math.cos(ang) * baseSpeed;
          b.vy = Math.sin(ang) * baseSpeed;
        }
      });
    }

    function update(dt) {
      if (!alive) return;
      particles.update(dt);
      var left = input.isDown('ArrowLeft') || input.isDown('a') || touch.isDown('left');
      var right = input.isDown('ArrowRight') || input.isDown('d') || touch.isDown('right');
      var pSpeed = 360 * paddle.speedMult;
      if (left) paddle.x -= pSpeed * dt;
      if (right) paddle.x += pSpeed * dt;
      paddle.x = RP.Engine.clamp(paddle.x, 0, W - paddle.w);

      if ((input.consumePressed('Space') || input.consumePressed('ArrowUp')) || (touch.isDown('left') && touch.isDown('right'))) launchBalls();
      if (balls.some(function (b) { return b.stuck; }) && (left || right)) { /* keep stuck ball glued, handled below */ }

      balls.forEach(function (b) {
        if (b.stuck) { b.x = paddle.x + paddle.w / 2; return; }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.x - b.r < 0) { b.x = b.r; b.vx *= -1; }
        if (b.x + b.r > W) { b.x = W - b.r; b.vx *= -1; }
        if (b.y - b.r < 0) { b.y = b.r; b.vy *= -1; }

        if (b.y + b.r > paddle.y && b.y + b.r < paddle.y + paddle.h + 10 && b.x > paddle.x && b.x < paddle.x + paddle.w && b.vy > 0) {
          var hitPos = (b.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
          var ang = -Math.PI / 2 + hitPos * 0.9;
          var spd = Math.hypot(b.vx, b.vy);
          b.vx = Math.cos(ang) * spd;
          b.vy = Math.sin(ang) * spd;
          RP.Sound.blip();
        }

        for (var i = 0; i < bricks.length; i++) {
          var br = bricks[i];
          if (!br.alive) continue;
          if (RP.Engine.rectsOverlap({ x: b.x - b.r, y: b.y - b.r, w: b.r * 2, h: b.r * 2 }, br)) {
            br.hp -= 1;
            var cx = b.x - (br.x + br.w / 2), cy = b.y - (br.y + br.h / 2);
            if (Math.abs(cx / br.w) > Math.abs(cy / br.h)) b.vx *= -1; else b.vy *= -1;
            if (br.hp <= 0) {
              br.alive = false;
              score += 10 * level;
              RP.Sound.coin();
              particles.emit(br.x + br.w / 2, br.y + br.h / 2, { count: 10, colors: [br.color, '#fff'], speed: 100, life: 0.4 });
              if (br.power) powerups.push({ x: br.x + br.w / 2, y: br.y + br.h / 2, type: br.power, vy: 110 });
              if (opts.onScoreUpdate) opts.onScoreUpdate(score);
            } else {
              RP.Sound.blip();
            }
            break;
          }
        }
      });

      // remove fallen balls
      for (var i = balls.length - 1; i >= 0; i--) {
        if (balls[i].y - balls[i].r > H) {
          if (cheats.invincible) { balls[i].stuck = true; balls[i].vy = 0; balls[i].vx = 0; continue; }
          balls.splice(i, 1);
        }
      }
      if (balls.length === 0) {
        lives -= 1;
        if (lives <= 0 && !cheats.infinitelives) return die();
        paddle.speedMult = 1; paddle.w = 90;
        newBallOnPaddle();
      }

      // powerups
      for (var p = powerups.length - 1; p >= 0; p--) {
        var pw = powerups[p];
        pw.y += pw.vy * dt;
        if (pw.y > H) { powerups.splice(p, 1); continue; }
        if (pw.y > paddle.y - 8 && pw.x > paddle.x - 10 && pw.x < paddle.x + paddle.w + 10) {
          applyPower(pw.type);
          powerups.splice(p, 1);
          RP.Sound.powerup();
        }
      }

      if (!bricks.some(function (b) { return b.alive; })) {
        RP.Sound.levelup();
        RP.Storage.bumpStat('levelsCleared', 1);
        score += 100;
        level += 1;
        buildLevel();
        newBallOnPaddle();
        if (opts.onScoreUpdate) opts.onScoreUpdate(score);
      }
    }

    function applyPower(type) {
      if (type === 'wide') { paddle.w = 140; }
      else if (type === 'slow') { balls.forEach(function (b) { b.vx *= 0.7; b.vy *= 0.7; }); }
      else if (type === 'life') { lives += 1; }
      else if (type === 'multi') {
        var base = balls[0];
        for (var i = 0; i < 2; i++) {
          var ang = Math.random() * Math.PI * 2;
          balls.push({ x: base.x, y: base.y, vx: Math.cos(ang) * baseSpeed, vy: -Math.abs(Math.sin(ang) * baseSpeed) - 50, r: 7, stuck: false });
        }
      }
    }

    function die() {
      alive = false;
      RP.Sound.gameover();
      if (opts.onGameOver) opts.onGameOver({ score: score, gameId: 'breakout' });
    }

    function draw() {
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = '#fff';
      ctx.font = '12px monospace';
      ctx.fillText('LEVEL ' + level, 10, 20);
      ctx.fillText('LIVES ' + (cheats.infinitelives ? '∞' : lives), W - 90, 20);

      bricks.forEach(function (b) {
        if (!b.alive) return;
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x, b.y, b.w, b.h);
        if (b.hp > 1) { ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(b.x, b.y, b.w, 4); }
        if (b.power) { ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.h / 2, 3, 0, Math.PI * 2); ctx.fill(); }
      });

      powerups.forEach(function (p) {
        ctx.fillStyle = { wide: '#4B5BF6', multi: '#FF6FA8', slow: '#1FAE6E', life: '#FFB930' }[p.type];
        RP.Engine.roundRect(ctx, p.x - 10, p.y - 8, 20, 16, 4); ctx.fill();
      });

      ctx.fillStyle = '#4B5BF6';
      RP.Engine.roundRect(ctx, paddle.x, paddle.y, paddle.w, paddle.h, 5); ctx.fill();

      ctx.fillStyle = '#fff';
      balls.forEach(function (b) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); });

      particles.draw(ctx);
      if (cheats.infinitelives) { ctx.fillStyle = 'rgba(255,111,168,0.85)'; ctx.font = '11px monospace'; ctx.fillText('INFINITE LIVES', W - 130, H - 10); }
    }

    var loop = new RP.Engine.Loop(update, draw);
    cv.canvas.addEventListener('mousedown', launchBalls);
    cv.canvas.addEventListener('touchstart', launchBalls, { passive: true });

    var mouseMoveHandler = function (e) {
      var rect = cv.canvas.getBoundingClientRect();
      var scale = W / rect.width;
      paddle.x = RP.Engine.clamp((e.clientX - rect.left) * scale - paddle.w / 2, 0, W - paddle.w);
    };
    cv.canvas.addEventListener('mousemove', mouseMoveHandler);
    cv.canvas.addEventListener('touchmove', function (e) {
      e.preventDefault();
      var t = e.touches[0];
      var rect = cv.canvas.getBoundingClientRect();
      var scale = W / rect.width;
      paddle.x = RP.Engine.clamp((t.clientX - rect.left) * scale - paddle.w / 2, 0, W - paddle.w);
    }, { passive: false });

    return {
      start: function () { reset(); loop.start(); },
      pause: function () { loop.pause(); },
      resume: function () { loop.resume(); },
      restart: function () { reset(); loop.resume(); if (!loop.running) loop.start(); },
      destroy: function () { loop.stop(); input.destroy(); touch.destroy(); cv.canvas.removeEventListener('mousemove', mouseMoveHandler); }
    };
  });

})(window);
