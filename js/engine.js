/* ==========================================================================
   RetroPlay :: engine.js
   Shared utilities every game uses: responsive canvas, keyboard + touch
   input, a fixed-timestep game loop, and tiny pixel-grid sprite drawing
   helpers (procedural "sprites" — see note in pixelSprite below).
   ========================================================================== */
(function (window) {
  'use strict';
  var RP = window.RP = window.RP || {};

  // ---------------------------------------------------------------------
  // Canvas: creates a crisp, integer-scaled, responsive canvas
  // ---------------------------------------------------------------------
  function makeCanvas(container, w, h) {
    var wrap = document.createElement('div');
    wrap.className = 'rp-canvas-wrap';
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.className = 'rp-canvas';
    canvas.style.aspectRatio = w + ' / ' + h;
    wrap.appendChild(canvas);
    container.appendChild(wrap);
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return { canvas: canvas, ctx: ctx, wrap: wrap };
  }

  // ---------------------------------------------------------------------
  // Keyboard input
  // ---------------------------------------------------------------------
  function Input() {
    this.down = {};
    this._pressed = {};
    var self = this;
    this._onKeyDown = function (e) {
      var k = normalizeKey(e.key);
      if (!self.down[k]) self._pressed[k] = true;
      self.down[k] = true;
      if (self.preventDefaultFor && self.preventDefaultFor.indexOf(k) !== -1) e.preventDefault();
    };
    this._onKeyUp = function (e) {
      var k = normalizeKey(e.key);
      self.down[k] = false;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }
  function normalizeKey(k) {
    if (k === ' ') return 'Space';
    return k.length === 1 ? k.toLowerCase() : k;
  }
  Input.prototype.isDown = function (k) { return !!this.down[k]; };
  Input.prototype.consumePressed = function (k) {
    if (this._pressed[k]) { this._pressed[k] = false; return true; }
    return false;
  };
  Input.prototype.destroy = function () {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  };

  // ---------------------------------------------------------------------
  // Touch pad — builds a D-pad + configurable action buttons
  // ---------------------------------------------------------------------
  function TouchPad(container, buttons) {
    // buttons: array of {id, label, key} — `key` is the Input key it simulates
    this.input = { down: {} };
    var root = document.createElement('div');
    root.className = 'rp-touchpad';
    this.el = root;

    var self = this;
    function bind(el, key) {
      var press = function (e) { e.preventDefault(); self.input.down[key] = true; el.classList.add('active'); };
      var release = function (e) { if (e) e.preventDefault(); self.input.down[key] = false; el.classList.remove('active'); };
      el.addEventListener('touchstart', press, { passive: false });
      el.addEventListener('touchend', release, { passive: false });
      el.addEventListener('touchcancel', release, { passive: false });
      el.addEventListener('mousedown', press);
      el.addEventListener('mouseup', release);
      el.addEventListener('mouseleave', release);
    }

    var hasDpad = buttons.indexOf('up') !== -1 || buttons.indexOf('left') !== -1;
    if (hasDpad) {
      var dpad = document.createElement('div');
      dpad.className = 'rp-dpad';
      ['up', 'left', 'right', 'down'].forEach(function (dir) {
        if (buttons.indexOf(dir) === -1) return;
        var b = document.createElement('button');
        b.className = 'rp-dpad-btn rp-dpad-' + dir;
        b.type = 'button';
        b.setAttribute('aria-label', dir);
        b.innerHTML = ({ up: '▲', down: '▼', left: '◀', right: '▶' })[dir];
        bind(b, dir);
        dpad.appendChild(b);
      });
      root.appendChild(dpad);
    }

    var actionDefs = {
      action: { label: 'A', cls: 'rp-action-a' },
      jump: { label: '⬆ JUMP', cls: 'rp-action-jump' },
      fire: { label: '● FIRE', cls: 'rp-action-fire' },
      rotate: { label: '⟳', cls: 'rp-action-rotate' },
      drop: { label: '⬇ DROP', cls: 'rp-action-drop' },
      hold: { label: 'HOLD', cls: 'rp-action-hold' },
      attack: { label: '👊', cls: 'rp-action-attack' },
      block: { label: '🛡', cls: 'rp-action-block' },
      tap: { label: 'TAP', cls: 'rp-action-tap' }
    };
    var actionsWrap = document.createElement('div');
    actionsWrap.className = 'rp-actions';
    buttons.forEach(function (key) {
      if (['up', 'down', 'left', 'right'].indexOf(key) !== -1) return;
      var def = actionDefs[key] || { label: key.toUpperCase(), cls: '' };
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'rp-action-btn ' + def.cls;
      b.textContent = def.label;
      bind(b, key);
      actionsWrap.appendChild(b);
    });
    if (actionsWrap.children.length) root.appendChild(actionsWrap);

    container.appendChild(root);
  }
  TouchPad.prototype.isDown = function (k) { return !!this.input.down[k]; };
  TouchPad.prototype.destroy = function () { if (this.el && this.el.parentNode) this.el.parentNode.removeChild(this.el); };

  // ---------------------------------------------------------------------
  // Fixed-step game loop with pause support
  // ---------------------------------------------------------------------
  function Loop(update, draw) {
    this.update = update;
    this.draw = draw;
    this.running = false;
    this.paused = false;
    this._last = 0;
    this._raf = null;
    var self = this;
    this._tick = function (t) {
      if (!self.running) return;
      if (!self._last) self._last = t;
      var dt = Math.min(0.05, (t - self._last) / 1000);
      self._last = t;
      if (!self.paused) {
        self.update(dt);
      }
      self.draw();
      self._raf = requestAnimationFrame(self._tick);
    };
  }
  Loop.prototype.start = function () {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this._last = 0;
    this._raf = requestAnimationFrame(this._tick);
  };
  Loop.prototype.pause = function () { this.paused = true; };
  Loop.prototype.resume = function () { this.paused = false; this._last = 0; };
  Loop.prototype.stop = function () {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
  };

  // ---------------------------------------------------------------------
  // Procedural pixel-art sprite drawing.
  // A "sprite" is a small grid of color-index characters, e.g.:
  //   ['.gg.', 'gggg', '.gg.']  where '.' = transparent
  // This avoids any image files (no broken/missing asset risk) while still
  // delivering a genuine NES/SNES-style blocky pixel-art look. Combined
  // with ctx.imageSmoothingEnabled = false, edges stay crisp at any scale.
  // ---------------------------------------------------------------------
  function drawPixelSprite(ctx, rows, palette, x, y, pixelSize) {
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      for (var c = 0; c < row.length; c++) {
        var ch = row[c];
        if (ch === '.' || ch === ' ') continue;
        ctx.fillStyle = palette[ch] || ch;
        ctx.fillRect(Math.round(x + c * pixelSize), Math.round(y + r * pixelSize), pixelSize, pixelSize);
      }
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function seededRandom(seed) {
    var s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  RP.Engine = {
    makeCanvas: makeCanvas,
    Input: Input,
    TouchPad: TouchPad,
    Loop: Loop,
    drawPixelSprite: drawPixelSprite,
    roundRect: roundRect,
    clamp: clamp,
    rectsOverlap: rectsOverlap,
    seededRandom: seededRandom
  };

  // ---------------------------------------------------------------------
  // Game registry — each games/*.js file calls RP.Games.register(...)
  // ---------------------------------------------------------------------
  var registry = {};
  RP.Games = {
    register: function (id, factory) { registry[id] = factory; },
    get: function (id) { return registry[id]; },
    has: function (id) { return !!registry[id]; }
  };

})(window);
