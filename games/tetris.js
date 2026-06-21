/* ==========================================================================
   RetroPlay :: games/tetris.js
   ========================================================================== */
(function (window) {
  'use strict';
  var RP = window.RP;

  RP.Games.register('tetris', function (container, opts) {
    var cheats = opts.cheats || {};
    var COLS = 10, ROWS = 20, CELL = 22;
    var FIELD_W = COLS * CELL, FIELD_H = ROWS * CELL;
    var SIDE_W = 110;
    var W = FIELD_W + SIDE_W, H = FIELD_H;

    var cv = RP.Engine.makeCanvas(container, W, H);
    var ctx = cv.ctx;
    var touch = new RP.Engine.TouchPad(container, ['left', 'right', 'down', 'rotate', 'drop', 'hold']);
    var input = new RP.Engine.Input();
    var particles = new RP.ParticleSystem();

    var SHAPES = {
      I: { color: '#4B5BF6', cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
      O: { color: '#FFB930', cells: [[1, 0], [2, 0], [1, 1], [2, 1]] },
      T: { color: '#9b6bff', cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
      S: { color: '#1FAE6E', cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
      Z: { color: '#E84C3D', cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
      J: { color: '#3a7bd5', cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
      L: { color: '#FF6FA8', cells: [[2, 0], [0, 1], [1, 1], [2, 1]] }
    };
    var KEYS = Object.keys(SHAPES);

    var grid, current, hold, holdUsed, nextQueue, score, lines, level, alive, dropTimer, dropInterval, gameOverFlag;

    function newBag() {
      var bag = KEYS.slice();
      for (var i = bag.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = bag[i]; bag[i] = bag[j]; bag[j] = t; }
      return bag;
    }

    function spawnPiece(type) {
      return { type: type, cells: SHAPES[type].cells.map(function (c) { return c.slice(); }), x: 3, y: -1, rot: 0 };
    }

    function reset() {
      grid = [];
      for (var r = 0; r < ROWS; r++) grid.push(new Array(COLS).fill(null));
      nextQueue = newBag();
      current = spawnPiece(nextQueue.shift());
      if (nextQueue.length < 4) nextQueue = nextQueue.concat(newBag());
      hold = null;
      holdUsed = false;
      score = 0;
      lines = 0;
      level = 1;
      alive = true;
      gameOverFlag = false;
      dropTimer = 0;
      dropInterval = baseInterval();
      if (opts.onScoreUpdate) opts.onScoreUpdate(0);
    }

    function baseInterval() {
      var t = Math.max(0.1, 0.85 - (level - 1) * 0.07);
      if (cheats.doublespeed) t *= 0.55;
      if (cheats.slowmo) t *= 1.4;
      return t;
    }

    function cellsAbs(piece) { return piece.cells.map(function (c) { return { x: piece.x + c[0], y: piece.y + c[1] }; }); }

    function valid(piece) {
      return cellsAbs(piece).every(function (c) {
        if (c.x < 0 || c.x >= COLS || c.y >= ROWS) return false;
        if (c.y < 0) return true;
        return !grid[c.y][c.x];
      });
    }

    function rotate(piece) {
      if (piece.type === 'O') return piece;
      var cx = 1, cy = 1;
      var rotated = piece.cells.map(function (c) {
        var x = c[0] - cx, y = c[1] - cy;
        return [cx + y, cy - x];
      });
      var test = { type: piece.type, cells: rotated, x: piece.x, y: piece.y, rot: piece.rot };
      var kicks = [0, -1, 1, -2, 2];
      for (var i = 0; i < kicks.length; i++) {
        var k = Object.assign({}, test, { x: test.x + kicks[i] });
        if (valid(k)) return k;
      }
      return piece;
    }

    function lockPiece() {
      cellsAbs(current).forEach(function (c) {
        if (c.y >= 0) grid[c.y][c.x] = SHAPES[current.type].color;
      });
      RP.Sound.drop();
      clearLines();
      holdUsed = false;
      current = spawnPiece(nextQueue.shift());
      if (nextQueue.length < 4) nextQueue = nextQueue.concat(newBag());
      if (!valid(current)) { current.y = -2; if (!valid(current)) gameOver(); }
    }

    function clearLines() {
      var cleared = 0;
      for (var r = ROWS - 1; r >= 0; r--) {
        if (grid[r].every(function (c) { return c; })) {
          grid.splice(r, 1);
          grid.unshift(new Array(COLS).fill(null));
          cleared++;
          r++;
        }
      }
      if (cleared > 0) {
        var points = [0, 100, 300, 500, 800][cleared] * level;
        score += points;
        lines += cleared;
        RP.Storage.bumpStat('linesCleared', cleared);
        RP.Sound.levelup();
        particles.emit(FIELD_W / 2, FIELD_H / 2, { count: 20, colors: ['#fff', '#FFB930'], speed: 140, life: 0.5 });
        level = 1 + Math.floor(lines / 10);
        dropInterval = baseInterval();
        if (opts.onScoreUpdate) opts.onScoreUpdate(score);
      }
    }

    function ghostPiece() {
      var g = { type: current.type, cells: current.cells.map(function (c) { return c.slice(); }), x: current.x, y: current.y };
      while (valid(Object.assign({}, g, { y: g.y + 1 }))) g.y += 1;
      return g;
    }

    function hardDrop() {
      var g = ghostPiece();
      score += (g.y - current.y) * 2;
      current.y = g.y;
      lockPiece();
      RP.Sound.hit();
    }

    function doHold() {
      if (holdUsed) return;
      holdUsed = true;
      var t = current.type;
      if (hold) { current = spawnPiece(hold); } else { current = spawnPiece(nextQueue.shift()); if (nextQueue.length < 4) nextQueue = nextQueue.concat(newBag()); }
      hold = t;
    }

    function gameOver() {
      alive = false;
      RP.Sound.gameover();
      if (opts.onGameOver) opts.onGameOver({ score: score, lines: lines });
    }

    var moveTimer = 0;
    function update(dt) {
      if (!alive) return;
      particles.update(dt);

      var left = input.consumePressed('ArrowLeft') || input.consumePressed('a');
      var right = input.consumePressed('ArrowRight') || input.consumePressed('d');
      var down = input.isDown('ArrowDown') || input.isDown('s') || touch.isDown('down');
      var rotKey = input.consumePressed('ArrowUp') || input.consumePressed('w') || touch.isDown('rotate') && !touch._rotHeld;
      var dropKey = input.consumePressed('Space') || (touch.isDown('drop') && !touch._dropHeld);
      var holdKey = input.consumePressed('c') || (touch.isDown('hold') && !touch._holdHeld);

      touch._rotHeld = touch.isDown('rotate');
      touch._dropHeld = touch.isDown('drop');
      touch._holdHeld = touch.isDown('hold');

      moveTimer -= dt;
      if ((touch.isDown('left') || left) && moveTimer <= 0) { var t1 = Object.assign({}, current, { x: current.x - 1 }); if (valid(t1)) current = t1; moveTimer = left ? 0 : 0.12; }
      if ((touch.isDown('right') || right) && moveTimer <= 0) { var t2 = Object.assign({}, current, { x: current.x + 1 }); if (valid(t2)) current = t2; moveTimer = right ? 0 : 0.12; }
      if (rotKey) current = rotate(current);
      if (dropKey) { hardDrop(); return; }
      if (holdKey) doHold();

      dropTimer += dt;
      var interval = down ? Math.min(dropInterval, 0.05) : dropInterval;
      if (dropTimer >= interval) {
        dropTimer = 0;
        var moved = Object.assign({}, current, { y: current.y + 1 });
        if (valid(moved)) current = moved; else lockPiece();
      }
    }

    function draw() {
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      for (var c = 0; c <= COLS; c++) { ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, FIELD_H); ctx.stroke(); }
      for (var r = 0; r <= ROWS; r++) { ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(FIELD_W, r * CELL); ctx.stroke(); }

      for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) {
        if (grid[r][c]) { ctx.fillStyle = grid[r][c]; ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2); }
      }

      if (alive) {
        var ghost = ghostPiece();
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ghost.cells.forEach(function (cc) {
          var x = ghost.x + cc[0], y = ghost.y + cc[1];
          if (y >= 0) ctx.fillRect(x * CELL + 2, y * CELL + 2, CELL - 4, CELL - 4);
        });

        ctx.fillStyle = SHAPES[current.type].color;
        cellsAbs(current).forEach(function (cc) { if (cc.y >= 0) ctx.fillRect(cc.x * CELL + 1, cc.y * CELL + 1, CELL - 2, CELL - 2); });
      }

      // side panel
      ctx.fillStyle = '#12121e';
      ctx.fillRect(FIELD_W, 0, SIDE_W, H);
      ctx.fillStyle = '#fff';
      ctx.font = '11px monospace';
      ctx.fillText('SCORE', FIELD_W + 10, 20);
      ctx.font = 'bold 16px monospace';
      ctx.fillText(String(score), FIELD_W + 10, 38);
      ctx.font = '11px monospace';
      ctx.fillText('LINES ' + lines, FIELD_W + 10, 56);
      ctx.fillText('LEVEL ' + level, FIELD_W + 10, 70);

      ctx.fillText('HOLD', FIELD_W + 10, 96);
      drawMini(hold, FIELD_W + 15, 102);

      ctx.fillText('NEXT', FIELD_W + 10, 168);
      for (var n = 0; n < 3; n++) drawMini(nextQueue[n], FIELD_W + 15, 176 + n * 56);

      particles.draw(ctx);
    }

    function drawMini(type, px, py) {
      if (!type) return;
      var shape = SHAPES[type];
      ctx.fillStyle = shape.color;
      shape.cells.forEach(function (c) { ctx.fillRect(px + c[0] * 12, py + c[1] * 12, 10, 10); });
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
