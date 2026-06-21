/* ==========================================================================
   RetroPlay :: games/boss.js
   Best-of-3-rounds 1v1 brawler against an AI boss. "Blood effects" default
   to OFF and use red square particles only when explicitly enabled by the
   player via opts.bloodEffects — otherwise hits show neutral white/yellow
   impact sparks.
   ========================================================================== */
(function (window) {
  'use strict';
  var RP = window.RP;

  RP.Games.register('boss', function (container, opts) {
    var cheats = opts.cheats || {};
    var bloody = !!opts.bloodEffects;
    var W = 640, H = 300;
    var FLOOR = H - 40;

    var cv = RP.Engine.makeCanvas(container, W, H);
    var ctx = cv.ctx;
    var touch = new RP.Engine.TouchPad(container, ['left', 'right', 'attack', 'block']);
    var input = new RP.Engine.Input();
    var particles = new RP.ParticleSystem();

    var WEAPONS = [
      { id: 0, name: 'Fists',  dmg: 6,  range: 38, cd: 0.32, color: '#F2C09C' },
      { id: 1, name: 'Sword',  dmg: 14, range: 56, cd: 0.55, color: '#cfd6ff' },
      { id: 2, name: 'Hammer', dmg: 22, range: 50, cd: 0.9,  color: '#8a8a8a' }
    ];

    var player, boss, score, alive, weaponIdx, playerWins, bossWins, roundOver, roundMsg, roundMsgTimer, matchOver;

    function newFighter(x, facing) {
      return { x: x, y: FLOOR - 60, w: 34, h: 60, hp: 100, maxHp: 100, vx: 0, facing: facing, attackCd: 0, blocking: false, attacking: 0, hitFlash: 0 };
    }

    function reset() {
      player = newFighter(120, 1);
      boss = newFighter(W - 150, -1);
      boss.hp = boss.maxHp = 100 + 0; // could scale with later "wave" but kept simple per-round
      score = 0;
      alive = true;
      matchOver = false;
      weaponIdx = 0;
      playerWins = 0; bossWins = 0;
      roundOver = false; roundMsg = ''; roundMsgTimer = 0;
      if (opts.onScoreUpdate) opts.onScoreUpdate(0);
    }

    function startRound() {
      player.hp = player.maxHp; boss.hp = boss.maxHp;
      player.x = 120; boss.x = W - 150;
      roundOver = false;
    }

    function attackPressed() { return input.consumePressed('z') || input.consumePressed('Enter') || (touch.isDown('attack') && !touch._atkHeld); }
    function blockHeld() { return input.isDown('x') || touch.isDown('block'); }

    function update(dt) {
      if (!alive || matchOver) return;
      particles.update(dt);
      touch._atkHeld = touch.isDown('attack');
      if (roundMsgTimer > 0) { roundMsgTimer -= dt; return; }
      if (roundOver) return;

      if (input.consumePressed('1')) weaponIdx = 0;
      if (input.consumePressed('2')) weaponIdx = 1;
      if (input.consumePressed('3')) weaponIdx = 2;

      var left = input.isDown('ArrowLeft') || touch.isDown('left');
      var right = input.isDown('ArrowRight') || touch.isDown('right');
      player.blocking = blockHeld();
      if (!player.blocking) {
        if (left) { player.vx = -180; player.facing = -1; }
        else if (right) { player.vx = 180; player.facing = 1; }
        else player.vx = 0;
      } else player.vx = 0;
      player.x = RP.Engine.clamp(player.x + player.vx * dt, 20, W - 20);

      player.attackCd -= dt;
      if (player.attacking > 0) player.attacking -= dt;
      if (player.hitFlash > 0) player.hitFlash -= dt;
      if (attackPressed() && player.attackCd <= 0 && !player.blocking) {
        var w = WEAPONS[weaponIdx];
        player.attackCd = w.cd;
        player.attacking = 0.18;
        RP.Sound.hit();
        tryHit(player, boss, w.dmg, w.range);
      }

      // boss AI
      boss.attackCd -= dt;
      if (boss.attacking > 0) boss.attacking -= dt;
      if (boss.hitFlash > 0) boss.hitFlash -= dt;
      var dist = Math.abs(boss.x - player.x);
      boss.facing = boss.x > player.x ? -1 : 1;
      boss.blocking = false;
      if (dist > 60) {
        boss.x += (boss.facing) * -110 * dt; // move toward player (facing points away, so invert)
        boss.x = RP.Engine.clamp(boss.x, 20, W - 20);
      } else if (boss.attackCd <= 0) {
        if (Math.random() < 0.15) {
          boss.blocking = true;
        } else {
          boss.attackCd = 0.7 + Math.random() * 0.4;
          boss.attacking = 0.18;
          tryHit(boss, player, 8 + Math.random() * 6, 60);
        }
      }

      if (player.hp <= 0 && !roundOver) endRound(false);
      if (boss.hp <= 0 && !roundOver) endRound(true);
    }

    function tryHit(attacker, defender, dmg, range) {
      var dist = Math.abs(attacker.x - defender.x);
      if (dist > range) return;
      if (defender === player && cheats.godmode) { particles.emit(defender.x, defender.y + 20, { count: 6, colors: ['#FFB930'], speed: 60, life: 0.3 }); return; }
      if (defender.blocking) {
        RP.Sound.blip();
        particles.emit(defender.x, defender.y + 20, { count: 6, colors: ['#4B5BF6', '#fff'], speed: 50, life: 0.25 });
        return;
      }
      defender.hp -= dmg;
      defender.hitFlash = 0.15;
      if (defender === player && cheats.infinitelives) defender.hp = Math.max(1, defender.hp);
      defender.hp = Math.max(0, defender.hp);
      RP.Sound.hit();
      score += Math.round(dmg);
      if (opts.onScoreUpdate) opts.onScoreUpdate(score);
      var colors = bloody ? ['#E40026', '#A30019'] : ['#FFB930', '#fff'];
      particles.emit(defender.x, defender.y + 20, { count: bloody ? 16 : 10, colors: colors, speed: 110, life: 0.45, shape: bloody ? 'circle' : 'rect' });
    }

    function endRound(playerWon) {
      roundOver = true;
      if (playerWon) { playerWins++; roundMsg = 'ROUND WIN!'; RP.Sound.levelup(); }
      else { bossWins++; roundMsg = 'ROUND LOST'; RP.Sound.gameover(); }
      roundMsgTimer = 1.4;
      if (playerWins >= 2 || bossWins >= 2) {
        matchOver = true;
        var won = playerWins >= 2;
        roundMsg = won ? 'YOU WIN THE MATCH!' : 'BOSS WINS THE MATCH';
        score += won ? 300 : 0;
        if (opts.onScoreUpdate) opts.onScoreUpdate(score);
        setTimeout(function () {
          alive = false;
          if (opts.onGameOver) opts.onGameOver({ score: score, won: won, gameId: 'boss' });
        }, 1200);
      } else {
        setTimeout(function () { if (alive) startRound(); }, 1300);
      }
    }

    function drawFighter(f, isBoss) {
      ctx.save();
      ctx.translate(f.x, f.y);
      var flash = f.hitFlash > 0;
      ctx.fillStyle = flash ? '#fff' : (isBoss ? '#E84C3D' : (cheats.godmode ? '#FFB930' : '#4B5BF6'));
      var lean = f.attacking > 0 ? f.facing * 10 : 0;
      RP.Engine.roundRect(ctx, -f.w / 2 + lean, 10, f.w, f.h - 10, 6); ctx.fill();
      ctx.fillStyle = '#F2C09C';
      ctx.beginPath(); ctx.arc(0, 4, 11, 0, Math.PI * 2); ctx.fill();
      if (f.blocking) { ctx.fillStyle = 'rgba(75,91,246,0.35)'; ctx.beginPath(); ctx.arc(f.facing * 22, 20, 18, 0, Math.PI * 2); ctx.fill(); }
      if (f.attacking > 0 && !isBoss) {
        var w = WEAPONS[weaponIdx];
        ctx.fillStyle = w.color;
        ctx.fillRect(f.facing * 18, 16, f.facing * (w.range - 18), 6);
      } else if (f.attacking > 0 && isBoss) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(f.facing * 18, 16, f.facing * 40, 6);
      }
      ctx.restore();
    }

    function drawHealthBar(x, hp, maxHp, label, alignRight) {
      var bw = 220;
      var bx = alignRight ? W - bw - 16 : 16;
      ctx.fillStyle = '#222'; ctx.fillRect(bx, 16, bw, 14);
      var pct = hp / maxHp;
      ctx.fillStyle = pct > 0.3 ? '#1FAE6E' : '#FF0040';
      if (alignRight) ctx.fillRect(bx + bw * (1 - pct), 16, bw * pct, 14);
      else ctx.fillRect(bx, 16, bw * pct, 14);
      ctx.strokeStyle = '#fff'; ctx.strokeRect(bx, 16, bw, 14);
      ctx.fillStyle = '#fff'; ctx.font = '11px monospace';
      ctx.fillText(label, bx, 12);
    }

    function draw() {
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, FLOOR, W, H - FLOOR);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath(); ctx.moveTo(0, FLOOR); ctx.lineTo(W, FLOOR); ctx.stroke();

      drawHealthBar(16, player.hp, player.maxHp, 'YOU', false);
      drawHealthBar(W - 236, boss.hp, boss.maxHp, 'BOSS', true);

      ctx.fillStyle = '#fff'; ctx.font = '12px monospace'; ctx.textAlign = 'center';
      ctx.fillText('ROUNDS  YOU ' + playerWins + ' — ' + bossWins + ' BOSS', W / 2, 44);
      ctx.fillText('Weapon: ' + WEAPONS[weaponIdx].name + ' (press 1-3)', W / 2, 60);
      ctx.textAlign = 'left';

      drawFighter(player, false);
      drawFighter(boss, true);
      particles.draw(ctx);

      if (roundMsgTimer > 0) {
        ctx.fillStyle = '#FFB930'; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center';
        ctx.fillText(roundMsg, W / 2, H / 2);
        ctx.textAlign = 'left';
      }
      if (cheats.godmode) { ctx.fillStyle = 'rgba(255,185,48,0.85)'; ctx.font = '11px monospace'; ctx.fillText('GOD MODE', W / 2 - 35, H - 10); }
    }

    var loop = new RP.Engine.Loop(update, draw);

    return {
      start: function () { reset(); startRound(); loop.start(); },
      pause: function () { loop.pause(); },
      resume: function () { loop.resume(); },
      restart: function () { reset(); startRound(); loop.resume(); if (!loop.running) loop.start(); },
      destroy: function () { loop.stop(); input.destroy(); touch.destroy(); }
    };
  });

})(window);
