/* ==========================================================================
   RetroPlay :: games/dino.js
   ========================================================================== */
(function (window) {
  'use strict';
  var RP = window.RP;

  RP.Games.register('dino', function (container, opts) {
    var cheats = opts.cheats || {};
    var W = 640, H = 220;
    var GROUND_Y = H - 36;

    var cv = RP.Engine.makeCanvas(container, W, H);
    var ctx = cv.ctx;
    var touch = new RP.Engine.TouchPad(container, ['jump']);
    var input = new RP.Engine.Input();
    var particles = new RP.ParticleSystem();

    var dino, obstacles, speed, score, alive, spawnTimer, dayPhase, jumpsUsed, flying;

    function reset() {
      dino = { x: 60, y: GROUND_Y - 38, w: 34, h: 38, vy: 0, ducking: false, onGround: true };
      obstacles = [];
      speed = (cheats.doublespeed ? 480 : 240) * (cheats.slowmo ? 0.7 : 1);
      score = 0;
      alive = true;
      spawnTimer = 1;
      dayPhase = 0;
      jumpsUsed = 0;
      flying = false;
      if (opts.onScoreUpdate) opts.onScoreUpdate(0);
    }

    function jumpPressed() { return input.consumePressed('Space') || input.consumePressed('ArrowUp') || input.consumePressed('w') || touch.isDown('jump'); }
    function jumpHeld() { return input.isDown('Space') || input.isDown('ArrowUp') || touch.isDown('jump'); }
    function duckHeld() { return input.isDown('ArrowDown') || input.isDown('s'); }

    function spawnObstacle() {
      var bird = Math.random() < 0.32 && score > 150;
      if (bird) {
        var heights = [GROUND_Y - 30, GROUND_Y - 60, GROUND_Y - 90];
        obstacles.push({ type: 'bird', x: W + 20, y: heights[Math.floor(Math.random() * heights.length)], w: 30, h: 20, frame: 0 });
      } else {
        var wide = Math.random() < 0.4;
        obstacles.push({ type: 'cactus', x: W + 20, y: GROUND_Y - (wide ? 34 : 30), w: wide ? 34 : 18, h: wide ? 34 : 30 });
      }
    }

    function update(dt) {
      if (!alive) return;
      particles.update(dt);
      dayPhase += dt * 0.02;
      score += dt * 12;
      if (opts.onScoreUpdate) opts.onScoreUpdate(Math.floor(score));
      speed += dt * 4; // gradual ramp

      // jump handling
      var canJump = dino.onGround || (cheats.infinitejump && jumpsUsed < 6) || (cheats.flymode);
      if (cheats.flymode) {
        if (jumpHeld()) { dino.vy = -220; flying = true; }
        else { dino.vy += 700 * dt; flying = false; }
      } else {
        if (jumpPressed() && canJump) {
          dino.vy = -430;
          dino.onGround = false;
          jumpsUsed++;
          RP.Sound.jump();
        }
        dino.vy += 1500 * dt;
      }
      dino.y += dino.vy * dt;
      if (dino.y > GROUND_Y - dino.h) {
        dino.y = GROUND_Y - dino.h;
        dino.vy = 0;
        dino.onGround = true;
        jumpsUsed = 0;
      }
      if (dino.y < 4) dino.y = 4;
      dino.ducking = duckHeld() && dino.onGround && !cheats.flymode;
      dino.h = dino.ducking ? 22 : 38;

      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawnObstacle();
        spawnTimer = RP.Engine.clamp(1.3 - speed / 900, 0.55, 1.3) * (cheats.slowmo ? 1.3 : 1);
      }

      for (var i = obstacles.length - 1; i >= 0; i--) {
        var o = obstacles[i];
        o.x -= speed * dt;
        if (o.type === 'bird') o.frame += dt * 10;
        if (o.x < -40) { obstacles.splice(i, 1); continue; }
        var dinoBox = { x: dino.x + 4, y: dino.y + 4, w: dino.w - 8, h: dino.h - 6 };
        var obBox = { x: o.x, y: o.y - o.h, w: o.w, h: o.h };
        if (!cheats.godmode && RP.Engine.rectsOverlap(dinoBox, obBox)) {
          return die();
        }
      }
    }

    function die() {
      alive = false;
      RP.Sound.hit();
      particles.emit(dino.x + dino.w / 2, dino.y + dino.h / 2, { count: 18, colors: ['#5B6178', '#fff'], speed: 120, life: 0.5 });
      if (opts.onGameOver) opts.onGameOver({ score: Math.floor(score) });
    }

    function isNight() { return Math.sin(dayPhase) > 0.3; }

    function draw() {
      var night = isNight();
      ctx.fillStyle = night ? '#0a0a14' : '#cfe8ff';
      ctx.fillRect(0, 0, W, H);

      if (night) {
        ctx.fillStyle = '#fff';
        for (var s = 0; s < 22; s++) {
          var sx = (s * 67 + dayPhase * 6) % W;
          var sy = (s * 41) % (GROUND_Y - 20);
          ctx.globalAlpha = 0.4 + 0.4 * Math.sin(s + dayPhase * 3);
          ctx.fillRect(sx, sy, 2, 2);
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#e8e8f0';
        ctx.beginPath(); ctx.arc(W - 60, 36, 16, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.8;
        for (var c = 0; c < 4; c++) {
          var cx = ((c * 180 + dayPhase * 20) % (W + 100)) - 50;
          ctx.beginPath(); ctx.ellipse(cx, 30 + c * 14, 22, 9, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      ctx.strokeStyle = night ? '#3a3a55' : '#16223a';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, GROUND_Y); ctx.lineTo(W, GROUND_Y); ctx.stroke();
      ctx.fillStyle = night ? 'rgba(255,255,255,0.15)' : 'rgba(22,34,58,0.3)';
      for (var d = 0; d < W; d += 24) { ctx.fillRect((d - (score * 5) % 24), GROUND_Y + 4, 10, 2); }

      // dino
      ctx.fillStyle = night ? '#dfe3ff' : '#16223a';
      RP.Engine.roundRect(ctx, dino.x, dino.y, dino.w, dino.h, 5);
      ctx.fill();
      ctx.fillStyle = night ? '#0a0a14' : '#cfe8ff';
      ctx.fillRect(dino.x + dino.w - 14, dino.y + 6, 4, 4);

      obstacles.forEach(function (o) {
        if (o.type === 'cactus') {
          ctx.fillStyle = night ? '#3fae6e' : '#1FAE6E';
          ctx.fillRect(o.x, o.y - o.h, o.w, o.h);
        } else {
          ctx.fillStyle = night ? '#cfd2ff' : '#4B5BF6';
          var flap = Math.sin(o.frame) > 0 ? 6 : -6;
          ctx.beginPath();
          ctx.moveTo(o.x, o.y - o.h / 2);
          ctx.lineTo(o.x + o.w / 2, o.y - o.h / 2 + flap);
          ctx.lineTo(o.x + o.w, o.y - o.h / 2);
          ctx.lineTo(o.x + o.w / 2, o.y - o.h / 2 - flap);
          ctx.closePath();
          ctx.fill();
        }
      });

      particles.draw(ctx);

      if (cheats.godmode) { ctx.fillStyle = 'rgba(255,185,48,0.8)'; ctx.font = '11px monospace'; ctx.fillText('GOD MODE', 8, 16); }
      if (cheats.flymode) { ctx.fillStyle = 'rgba(75,91,246,0.8)'; ctx.font = '11px monospace'; ctx.fillText('FLY MODE', W - 80, 16); }
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
