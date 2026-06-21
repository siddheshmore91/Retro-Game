/* ==========================================================================
   RetroPlay :: games/snake.js
   ========================================================================== */
(function (window) {
  'use strict';
  var RP = window.RP;

  RP.Games.register('snake', function (container, opts) {
    var cheats = opts.cheats || {};
    var COLS = 22, ROWS = 22, CELL = 20;
    var W = COLS * CELL, H = ROWS * CELL;

    var cv = RP.Engine.makeCanvas(container, W, H);
    var ctx = cv.ctx;
    var touch = new RP.Engine.TouchPad(container, ['up', 'down', 'left', 'right']);
    var input = new RP.Engine.Input();
    var particles = new RP.ParticleSystem();

    var skins = [{ id: 'green', head: '#1FAE6E', body: '#28d889' }];
    if (RP.Storage.hasAchievement('snake_charmer')) skins.push({ id: 'pink', head: '#FF6FA8', body: '#ff9cc5' });
    if (RP.Storage.hasAchievement('high_roller')) skins.push({ id: 'gold', head: '#FFB930', body: '#ffd066' });
    var skinIndex = 0;

    var snake, dir, nextDir, food, foodPulse, score, alive, tickAcc, tickInterval, foodAnim;

    function reset() {
      snake = [{ x: 10, y: 11 }, { x: 9, y: 11 }, { x: 8, y: 11 }];
      dir = { x: 1, y: 0 };
      nextDir = dir;
      score = 0;
      alive = true;
      tickAcc = 0;
      tickInterval = cheats.doublespeed ? 0.065 : 0.13;
      placeFood();
      if (opts.onScoreUpdate) opts.onScoreUpdate(0);
    }

    function placeFood() {
      var ok = false, fx, fy;
      while (!ok) {
        fx = Math.floor(Math.random() * COLS);
        fy = Math.floor(Math.random() * ROWS);
        ok = !snake.some(function (s) { return s.x === fx && s.y === fy; });
      }
      food = { x: fx, y: fy };
    }

    function setDir(x, y) {
      if (dir.x === -x && dir.y === -y) return; // no instant reverse
      nextDir = { x: x, y: y };
    }

    function handleInput() {
      if (input.isDown('ArrowUp') || input.isDown('w') || touch.isDown('up')) setDir(0, -1);
      else if (input.isDown('ArrowDown') || input.isDown('s') || touch.isDown('down')) setDir(0, 1);
      else if (input.isDown('ArrowLeft') || input.isDown('a') || touch.isDown('left')) setDir(-1, 0);
      else if (input.isDown('ArrowRight') || input.isDown('d') || touch.isDown('right')) setDir(1, 0);
    }

    function update(dt) {
      handleInput();
      if (!alive) return;
      foodPulse = (foodPulse || 0) + dt * 6;
      particles.update(dt);

      if (cheats.magnetfood) {
        var head = snake[0];
        var dist = Math.abs(head.x - food.x) + Math.abs(head.y - food.y);
        if (dist <= 5 && dist > 0) {
          tickAcc += 0; // no-op, magnet uses its own slower cadence below
          foodAnim = (foodAnim || 0) + dt;
          if (foodAnim > 0.18) {
            foodAnim = 0;
            if (food.x !== head.x) food.x += food.x > head.x ? -1 : 1;
            else if (food.y !== head.y) food.y += food.y > head.y ? -1 : 1;
          }
        }
      }

      tickAcc += dt;
      if (tickAcc < tickInterval) return;
      tickAcc = 0;

      dir = nextDir;
      var newHead = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

      if (newHead.x < 0 || newHead.x >= COLS || newHead.y < 0 || newHead.y >= ROWS) {
        if (cheats.invincible) {
          newHead.x = (newHead.x + COLS) % COLS;
          newHead.y = (newHead.y + ROWS) % ROWS;
        } else {
          return die();
        }
      }
      if (!cheats.invincible && snake.some(function (s) { return s.x === newHead.x && s.y === newHead.y; })) {
        return die();
      }

      snake.unshift(newHead);
      if (newHead.x === food.x && newHead.y === food.y) {
        score += 10;
        RP.Sound.eat();
        particles.emit(newHead.x * CELL + CELL / 2, newHead.y * CELL + CELL / 2, { count: 12, colors: ['#ffb930', '#ffe08a'], speed: 90, life: 0.4 });
        if (opts.onScoreUpdate) opts.onScoreUpdate(score);
        placeFood();
        tickInterval = Math.max(0.05, tickInterval - 0.0015);
      } else {
        snake.pop();
      }
    }

    function die() {
      alive = false;
      RP.Sound.hit();
      particles.emit(snake[0].x * CELL + CELL / 2, snake[0].y * CELL + CELL / 2, { count: 22, colors: ['#ff0040', '#ff7a8c'], speed: 140, life: 0.6 });
      if (opts.onGameOver) opts.onGameOver({ score: score });
    }

    function draw() {
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(0,255,65,0.06)';
      for (var gx = 0; gx <= COLS; gx++) { ctx.beginPath(); ctx.moveTo(gx * CELL, 0); ctx.lineTo(gx * CELL, H); ctx.stroke(); }
      for (var gy = 0; gy <= ROWS; gy++) { ctx.beginPath(); ctx.moveTo(0, gy * CELL); ctx.lineTo(W, gy * CELL); ctx.stroke(); }

      var skin = skins[skinIndex % skins.length];
      snake.forEach(function (s, i) {
        ctx.fillStyle = i === 0 ? skin.head : skin.body;
        roundedCell(s.x, s.y, i === 0 ? 6 : 4);
      });

      var pulse = 2 + Math.sin(foodPulse || 0) * 2;
      ctx.fillStyle = '#FF6FA8';
      ctx.beginPath();
      ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL / 2 - 3 + pulse * 0.3, 0, Math.PI * 2);
      ctx.fill();

      particles.draw(ctx);

      if (cheats.invincible) { ctx.fillStyle = 'rgba(0,255,65,0.5)'; ctx.font = '11px monospace'; ctx.fillText('INVINCIBLE', 8, 16); }
      if (cheats.magnetfood) { ctx.fillStyle = 'rgba(255,185,48,0.7)'; ctx.font = '11px monospace'; ctx.fillText('MAGNET', W - 70, 16); }
    }

    function roundedCell(gx, gy, r) {
      RP.Engine.roundRect(ctx, gx * CELL + 1, gy * CELL + 1, CELL - 2, CELL - 2, r);
      ctx.fill();
    }

    var loop = new RP.Engine.Loop(update, draw);

    var swipeStart = null;
    cv.canvas.addEventListener('touchstart', function (e) { var t = e.touches[0]; swipeStart = { x: t.clientX, y: t.clientY }; }, { passive: true });
    cv.canvas.addEventListener('touchend', function (e) {
      if (!swipeStart) return;
      var t = e.changedTouches[0];
      var dx = t.clientX - swipeStart.x, dy = t.clientY - swipeStart.y;
      if (Math.abs(dx) > Math.abs(dy)) { if (Math.abs(dx) > 20) setDir(dx > 0 ? 1 : -1, 0); }
      else { if (Math.abs(dy) > 20) setDir(0, dy > 0 ? 1 : -1); }
      swipeStart = null;
    }, { passive: true });

    return {
      start: function () { reset(); loop.start(); },
      pause: function () { loop.pause(); },
      resume: function () { loop.resume(); },
      restart: function () { reset(); loop.resume(); if (!loop.running) loop.start(); },
      destroy: function () { loop.stop(); input.destroy(); touch.destroy(); }
    };
  });

})(window);
