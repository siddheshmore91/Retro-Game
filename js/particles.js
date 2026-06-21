/* ==========================================================================
   RetroPlay :: particles.js
   A small, dependency-free particle system shared by every game (sparks,
   coin bursts, explosions, trails). Each game owns one instance.
   ========================================================================== */
(function (window) {
  'use strict';
  var RP = window.RP = window.RP || {};

  function ParticleSystem() {
    this.list = [];
  }

  ParticleSystem.prototype.emit = function (x, y, opts) {
    opts = opts || {};
    var count = opts.count || 10;
    var colors = opts.colors || ['#ffffff'];
    var enabled = true;
    try { enabled = RP.Storage.load().settings.particles !== false; } catch (e) {}
    if (!enabled) return;
    for (var i = 0; i < count; i++) {
      var angle = opts.angle !== undefined ? opts.angle + (Math.random() - 0.5) * (opts.spread || Math.PI * 2)
                                            : Math.random() * Math.PI * 2;
      var speed = (opts.speed || 80) * (0.5 + Math.random());
      this.list.push({
        x: x, y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: opts.life || 0.6,
        age: 0,
        size: (opts.size || 3) * (0.7 + Math.random() * 0.6),
        color: colors[Math.floor(Math.random() * colors.length)],
        gravity: opts.gravity !== undefined ? opts.gravity : 220,
        shape: opts.shape || 'rect'
      });
    }
  };

  ParticleSystem.prototype.update = function (dt) {
    for (var i = this.list.length - 1; i >= 0; i--) {
      var p = this.list[i];
      p.age += dt;
      if (p.age >= p.life) { this.list.splice(i, 1); continue; }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  };

  ParticleSystem.prototype.draw = function (ctx) {
    for (var i = 0; i < this.list.length; i++) {
      var p = this.list[i];
      var t = 1 - p.age / p.life;
      ctx.globalAlpha = Math.max(0, t);
      ctx.fillStyle = p.color;
      var s = p.size * (0.5 + t * 0.5);
      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, s / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      }
    }
    ctx.globalAlpha = 1;
  };

  ParticleSystem.prototype.clear = function () { this.list.length = 0; };

  RP.ParticleSystem = ParticleSystem;

})(window);
