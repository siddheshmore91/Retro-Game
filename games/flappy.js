/* ==========================================================================
   RetroPlay :: games/flappy.js
   ========================================================================== */
(function (window) {
  'use strict';
  var RP = window.RP;

  RP.Games.register('flappy', function (container, opts) {
    var cheats = opts.cheats || {};
    var W = 360, H = 520;
    var GAP = 150;

    var cv = RP.Engine.makeCanvas(container, W, H);
    var ctx = cv.ctx;
    var touch = new RP.Engine.TouchPad(container, ['tap']);
    var input = new RP.Engine.Input();
    var particles = new RP.ParticleSystem();

    var bird, pipes, score, alive, spawnTimer, speed, bg1, bg2, started;

    function reset() {
      bird = { x: 90, y: H / 2, r: 14, vy: 0, rot: 0 };
      pipes = [];
      score = 0;
      alive = true;
      started = false;
      spawnTimer = 1.2;
      speed = (cheats.doublespeed ? 260 : 130) * (cheats.slowmo ? 0.7 : 1);
      bg1 = 0; bg2 = 0;
      if (opts.onScoreUpdate) opts.onScoreUpdate(0);
    }

    function flap() { bird.vy = -310; started = true; RP.Sound.jump(); }

    function flapPressed() {
      return input.consumePressed('Space') || input.consumePressed('ArrowUp') || touch.isDown('tap');
    }

    function spawnPipe() {
      var margin = 60;
      var gapY = margin + Math.random() * (H - margin * 2 - GAP - 70);
      pipes.push({ x: W + 30, gapY: gapY, passed: false, w: 56 });
    }

    function update(dt) {
      bg1 = (bg1 + dt * speed * 0.3) % W;
      bg2 = (bg2 + dt * speed * 0.6) % W;
      if (!alive) return;
      particles.update(dt);
      if (touch.isDown('tap') && !touch._held) { flap(); touch._held = true; }
      if (!touch.isDown('tap')) touch._held = false;
      if (flapPressed()) flap();
      if (!started) return;

      bird.vy += 720 * dt;
      bird.y += bird.vy * dt;
      bird.rot = RP.Engine.clamp(bird.vy / 500, -0.5, 1.1);

      if (bird.y - bird.r < 0) { bird.y = bird.r; bird.vy = 0; }
      if (bird.y + bird.r > H - 30 && !cheats.invincible) return die();

      spawnTimer -= dt;
      if (spawnTimer <= 0) { spawnPipe(); spawnTimer = RP.Engine.clamp(310 / speed, 1.0, 1.9); }

      for (var i = pipes.length - 1; i >= 0; i--) {
        var p = pipes[i];
        p.x -= speed * dt;
        if (p.x < -p.w) { pipes.splice(i, 1); continue; }
        if (!p.passed && p.x + p.w < bird.x) {
          p.passed = true;
          score += 1;
          RP.Sound.blip();
          if (opts.onScoreUpdate) opts.onScoreUpdate(score);
        }
        if (!cheats.invincible) {
          var birdBox = { x: bird.x - bird.r * 0.7, y: bird.y - bird.r * 0.7, w: bird.r * 1.4, h: bird.r * 1.4 };
          var top = { x: p.x, y: 0, w: p.w, h: p.gapY };
          var bot = { x: p.x, y: p.gapY + GAP, w: p.w, h: H - (p.gapY + GAP) };
          if (RP.Engine.rectsOverlap(birdBox, top) || RP.Engine.rectsOverlap(birdBox, bot)) return die();
        }
      }
    }

    function die() {
      alive = false;
      RP.Sound.hit();
      particles.emit(bird.x, bird.y, { count: 16, colors: ['#FFB930', '#fff'], speed: 110, life: 0.5 });
      if (opts.onGameOver) opts.onGameOver({ score: score, medal: medalFor(score) });
    }

    function medalFor(s) {
      if (s >= 40) return { name: 'Platinum', emoji: '🏆' };
      if (s >= 25) return { name: 'Gold', emoji: '🥇' };
      if (s >= 12) return { name: 'Silver', emoji: '🥈' };
      if (s >= 5) return { name: 'Bronze', emoji: '🥉' };
      return null;
    }

    function draw() {
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#7ec8ff'); g.addColorStop(1, '#bfe6ff');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (var c = 0; c < 3; c++) {
        var cx = ((c * 150 - bg1) % (W + 100)) - 50;
        ctx.beginPath(); ctx.ellipse(cx, 70 + c * 40, 30, 13, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = 'rgba(31,174,110,0.55)';
      for (var h = 0; h < 4; h++) {
        var hx = ((h * 140 - bg2) % (W + 140)) - 70;
        ctx.beginPath(); ctx.moveTo(hx, H - 30); ctx.lineTo(hx + 70, H - 110); ctx.lineTo(hx + 140, H - 30); ctx.closePath(); ctx.fill();
      }

      pipes.forEach(function (p) {
        ctx.fillStyle = '#1FAE6E';
        ctx.fillRect(p.x, 0, p.w, p.gapY);
        ctx.fillRect(p.x, p.gapY + GAP, p.w, H - (p.gapY + GAP));
        ctx.fillStyle = '#178f59';
        ctx.fillRect(p.x - 4, p.gapY - 18, p.w + 8, 18);
        ctx.fillRect(p.x - 4, p.gapY + GAP, p.w + 8, 18);
      });

      ctx.fillStyle = '#5B6178';
      ctx.fillRect(0, H - 30, W, 30);
      ctx.fillStyle = '#1FAE6E';
      ctx.fillRect(0, H - 34, W, 6);

      ctx.save();
      ctx.translate(bird.x, bird.y);
      ctx.rotate(bird.rot);
      ctx.fillStyle = '#FFB930';
      ctx.beginPath(); ctx.arc(0, 0, bird.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#E89B00';
      ctx.beginPath(); ctx.moveTo(bird.r - 2, 0); ctx.lineTo(bird.r + 10, -4); ctx.lineTo(bird.r + 10, 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(5, -5, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#16223a';
      ctx.beginPath(); ctx.arc(6, -5, 2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      particles.draw(ctx);

      if (!started && alive) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('TAP / SPACE TO FLAP', W / 2, H / 2 - 40);
        ctx.textAlign = 'left';
      }
      if (cheats.invincible) { ctx.fillStyle = 'rgba(0,255,65,0.85)'; ctx.font = '11px monospace'; ctx.fillText('INVINCIBLE', 8, 16); }
    }

    var loop = new RP.Engine.Loop(update, draw);
    cv.canvas.addEventListener('mousedown', flap);
    cv.canvas.addEventListener('touchstart', function (e) { e.preventDefault(); flap(); }, { passive: false });

    return {
      start: function () { reset(); loop.start(); },
      pause: function () { loop.pause(); },
      resume: function () { loop.resume(); },
      restart: function () { reset(); loop.resume(); if (!loop.running) loop.start(); },
      destroy: function () { loop.stop(); input.destroy(); touch.destroy(); }
    };
  });

})(window);
