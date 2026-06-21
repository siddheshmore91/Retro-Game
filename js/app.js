/* ==========================================================================
   RetroPlay :: app.js
   The whole "app" (everything past the marketing landing page) is a single
   page that swaps view contents based on location.hash. No server, no
   build step, no router library — just DOM.
   ========================================================================== */
(function (window) {
  'use strict';
  var RP = window.RP;
  var D = RP.Data, S = RP.Storage;

  var appRoot, currentGame = null, currentGameId = null;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function fmt(n) { return Math.round(n).toLocaleString(); }

  // ---------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------
  function init() {
    appRoot = document.getElementById('app-root');
    window.addEventListener('hashchange', route);
    document.addEventListener('rp:points-changed', refreshHeaderPoints);
    document.addEventListener('rp:achievements-unlocked', function (e) { showAchievementToast(e.detail.achievements); });

    $('#cta-play-now') && $('#cta-play-now').addEventListener('click', goPlay);
    $('#cta-play-now-2') && $('#cta-play-now-2').addEventListener('click', goPlay);
    $('#cta-final') && $('#cta-final').addEventListener('click', goPlay);
    $('#nav-login') && $('#nav-login').addEventListener('click', goPlay);
    $('#nav-signup') && $('#nav-signup').addEventListener('click', goPlay);

    if (S.isLoggedIn()) {
      S.touchDailyLogin();
      buildHeaderBar();
    }
    route();
  }

  function goPlay(e) {
    if (e) e.preventDefault();
    RP.Sound.unlock();
    if (!S.isLoggedIn()) { showAuthModal(); return; }
    window.location.hash = '#/hub';
  }

  // ---------------------------------------------------------------------
  // Auth modal
  // ---------------------------------------------------------------------
  function showAuthModal() {
    var overlay = el('div', 'rp-modal-overlay');
    overlay.innerHTML =
      '<div class="rp-modal rp-auth-modal">' +
      '  <div class="rp-modal-eyebrow">🕹️ RetroPlay</div>' +
      '  <h2>Pick a player name</h2>' +
      '  <p class="rp-modal-sub">No email, no password — your progress saves to this browser.</p>' +
      '  <input id="rp-name-input" class="rp-input" maxlength="18" placeholder="e.g. PixelPilot" autofocus />' +
      '  <button id="rp-name-submit" class="rp-btn rp-btn-primary rp-btn-block">▶ Start Playing</button>' +
      '  <button id="rp-guest-submit" class="rp-btn rp-btn-ghost rp-btn-block">Continue as Guest</button>' +
      '</div>';
    document.body.appendChild(overlay);
    var input = $('#rp-name-input', overlay);
    input.focus();
    function submit(isGuest) {
      var name = isGuest ? '' : input.value.trim();
      S.setPlayer(name, isGuest || !name);
      RP.Achievements.check({ type: 'login' });
      overlay.remove();
      buildHeaderBar();
      window.location.hash = '#/hub';
    }
    $('#rp-name-submit', overlay).addEventListener('click', function () { submit(false); });
    $('#rp-guest-submit', overlay).addEventListener('click', function () { submit(true); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(false); });
  }

  // ---------------------------------------------------------------------
  // Header bar (shown once logged in, fixed at very top of app views)
  // ---------------------------------------------------------------------
  function buildHeaderBar() {
    if (document.getElementById('rp-appbar')) return refreshHeaderPoints();
    var bar = el('div', 'rp-appbar');
    bar.id = 'rp-appbar';
    bar.innerHTML =
      '<div class="rp-appbar-inner">' +
      '  <a href="#/hub" class="rp-appbar-logo">🕹️ RetroPlay</a>' +
      '  <nav class="rp-appbar-nav">' +
      '    <a href="#/hub">Games</a><a href="#/cheats">Cheat Shop</a><a href="#/leaderboard">Leaderboard</a>' +
      '    <a href="#/achievements">Achievements</a><a href="#/rewards">Rewards</a><a href="#/profile">Profile</a>' +
      '  </nav>' +
      '  <div class="rp-appbar-points" id="rp-points-display">⭐ <span>0</span></div>' +
      '  <button class="rp-appbar-burger" id="rp-burger">☰</button>' +
      '</div>';
    document.body.insertBefore(bar, document.body.firstChild);
    $('#rp-burger').addEventListener('click', function () { $('.rp-appbar-nav').classList.toggle('open'); });
    document.body.classList.add('rp-has-appbar');
    refreshHeaderPoints();
  }
  function refreshHeaderPoints() {
    var disp = document.getElementById('rp-points-display');
    if (disp) disp.querySelector('span').textContent = fmt(S.getPoints());
  }

  function showAchievementToast(achievements) {
    achievements.forEach(function (a, i) {
      setTimeout(function () {
        var t = el('div', 'rp-toast');
        t.innerHTML = '<b>' + a.emoji + ' Achievement Unlocked</b><div>' + a.name + ' · +' + a.points + ' pts</div>';
        document.body.appendChild(t);
        RP.Sound.achievement();
        requestAnimationFrame(function () { t.classList.add('show'); });
        setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 400); }, 3200);
      }, i * 400);
    });
  }

  // ---------------------------------------------------------------------
  // Router
  // ---------------------------------------------------------------------
  function route() {
    var hash = window.location.hash || '';
    if (!hash || hash === '#') {
      // back to the marketing landing page
      if (appRoot) appRoot.style.display = 'none';
      var marketing = document.getElementById('marketing-root');
      if (marketing) marketing.style.display = '';
      return;
    }
    if (!S.isLoggedIn()) { showAuthModal(); return; }
    buildHeaderBar();
    if (currentGame) { currentGame.destroy(); currentGame = null; currentGameId = null; }
    appRoot.innerHTML = '';
    appRoot.style.display = 'block';
    document.getElementById('marketing-root') && (document.getElementById('marketing-root').style.display = 'none');

    if (hash.indexOf('#/game/') === 0) renderGamePlayer(hash.replace('#/game/', ''));
    else if (hash === '#/cheats') renderCheatShop();
    else if (hash === '#/leaderboard') renderLeaderboard();
    else if (hash === '#/achievements') renderAchievements();
    else if (hash === '#/rewards') renderRewards();
    else if (hash === '#/profile') renderProfile();
    else renderHub();
    window.scrollTo(0, 0);
  }

  // ---------------------------------------------------------------------
  // Hub — game grid
  // ---------------------------------------------------------------------
  function renderHub() {
    var p = S.getProfile();
    var wrap = el('div', 'rp-page rp-hub');
    var greetingHour = new Date().getHours();
    var greet = greetingHour < 12 ? 'Good morning' : greetingHour < 18 ? 'Good afternoon' : 'Good evening';
    wrap.innerHTML =
      '<div class="rp-hub-head">' +
      '  <h1>' + greet + ', ' + escapeHtml(p.name) + '</h1>' +
      '  <p>You have <b>' + fmt(S.getPoints()) + ' points</b> and a ' + (p.streak || 1) + '-day login streak. Pick a game.</p>' +
      '</div>' +
      '<div class="rp-game-tiles" id="rp-game-tiles"></div>';
    appRoot.appendChild(wrap);
    var tiles = $('#rp-game-tiles', wrap);
    D.GAMES.forEach(function (g) {
      var rec = S.getGameScore(g.id);
      var tile = el('a', 'rp-game-tile');
      tile.href = '#/game/' + g.id;
      tile.style.setProperty('--accent', g.color);
      tile.innerHTML =
        '<div class="rp-tile-emoji">' + g.emoji + '</div>' +
        '<h3>' + g.title + '</h3>' +
        '<p>' + g.tagline + '</p>' +
        '<div class="rp-tile-foot"><span>Best: ' + fmt(rec.best) + '</span><span class="rp-tile-play">PLAY ▶</span></div>';
      tiles.appendChild(tile);
    });
  }

  function escapeHtml(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  // ---------------------------------------------------------------------
  // Game Player
  // ---------------------------------------------------------------------
  function renderGamePlayer(gameId) {
    var game = D.gameById(gameId);
    if (!game || !RP.Games.has(gameId)) { window.location.hash = '#/hub'; return; }
    currentGameId = gameId;
    var rec = S.getGameScore(gameId);
    var owned = RP.Cheats.ownedForGame(gameId);

    var wrap = el('div', 'rp-page rp-player');
    wrap.innerHTML =
      '<div class="rp-player-head">' +
      '  <a href="#/hub" class="rp-back">‹ Back to Games</a>' +
      '  <h1>' + game.emoji + ' ' + game.title + '</h1>' +
      '  <div class="rp-hud">' +
      '    <div class="rp-hud-stat">SCORE <b id="rp-hud-score">0</b></div>' +
      '    <div class="rp-hud-stat">BEST <b id="rp-hud-best">' + fmt(rec.best) + '</b></div>' +
      '    <button id="rp-btn-pause" class="rp-btn rp-btn-ghost">⏸ Pause</button>' +
      '    <button id="rp-btn-restart" class="rp-btn rp-btn-ghost">↻ Restart</button>' +
      '    <button id="rp-btn-mute" class="rp-btn rp-btn-ghost">' + (RP.Sound.isMuted() ? '🔇' : '🔊') + '</button>' +
      '  </div>' +
      '</div>' +
      '<div class="rp-player-body">' +
      '  <div class="rp-stage-col">' +
      '    <div class="rp-cheat-bar" id="rp-cheat-bar"></div>' +
      '    <div class="rp-stage" id="rp-stage"></div>' +
      '    <div class="rp-instructions"><b>⌨ Keyboard:</b> ' + game.keyboard + ' &nbsp; <b>📱 Touch:</b> ' + game.touch + '</div>' +
      '  </div>' +
      '</div>';
    appRoot.appendChild(wrap);

    var cheatBar = $('#rp-cheat-bar', wrap);
    var blockField = null;
    if (owned.length) {
      var label = el('span', 'rp-cheat-bar-label', 'Active cheats:');
      cheatBar.appendChild(label);
      owned.forEach(function (c) {
        var active = S.getActiveCheats(gameId).indexOf(c.id) !== -1;
        var chip = el('button', 'rp-cheat-chip' + (active ? ' active' : ''), c.emoji + ' ' + c.name);
        chip.title = c.desc;
        chip.addEventListener('click', function () {
          var nowActive = !chip.classList.contains('active');
          S.setCheatActive(gameId, c.id, nowActive);
          chip.classList.toggle('active', nowActive);
          RP.Sound.select();
        });
        cheatBar.appendChild(chip);
      });
    } else {
      cheatBar.appendChild(el('span', 'rp-cheat-bar-label', 'No cheats owned for this game yet — visit the '));
      var link = el('a', '', 'Cheat Shop'); link.href = '#/cheats'; cheatBar.appendChild(link);
    }
    if (gameId === 'boss') {
      var bloodToggle = el('label', 'rp-blood-toggle');
      var checked = !!S.load().settings.bloodEffects;
      bloodToggle.innerHTML = '<input type="checkbox" id="rp-blood-cb" ' + (checked ? 'checked' : '') + '> Blood effects';
      cheatBar.appendChild(bloodToggle);
    }

    var stage = $('#rp-stage', wrap);
    var cheatsFlags = RP.Cheats.activeFlags(gameId);
    var gameOpts = {
      cheats: cheatsFlags,
      bloodEffects: !!S.load().settings.bloodEffects,
      onScoreUpdate: function (s) { var n = $('#rp-hud-score'); if (n) n.textContent = fmt(s); },
      onGameOver: function (result) { handleGameOver(gameId, result); }
    };

    function launch() {
      stage.innerHTML = '';
      currentGame = RP.Games.get(gameId)(stage, gameOpts);
      currentGame.start();
    }
    launch();

    var bloodCb = document.getElementById('rp-blood-cb');
    if (bloodCb) bloodCb.addEventListener('change', function () {
      var s = S.load(); s.settings.bloodEffects = bloodCb.checked;
      gameOpts.bloodEffects = bloodCb.checked;
      try { window.localStorage.setItem(S.KEY, JSON.stringify(s)); } catch (e) {}
    });

    var paused = false;
    $('#rp-btn-pause', wrap).addEventListener('click', function () {
      paused = !paused;
      if (paused) { currentGame.pause(); this.textContent = '▶ Resume'; } else { currentGame.resume(); this.textContent = '⏸ Pause'; }
    });
    $('#rp-btn-restart', wrap).addEventListener('click', function () {
      paused = false;
      $('#rp-btn-pause', wrap).textContent = '⏸ Pause';
      var overlay = document.getElementById('rp-gameover-overlay'); if (overlay) overlay.remove();
      currentGame.restart();
    });
    $('#rp-btn-mute', wrap).addEventListener('click', function () {
      var muted = !RP.Sound.isMuted();
      RP.Sound.setMuted(muted);
      this.textContent = muted ? '🔇' : '🔊';
    });
  }

  function handleGameOver(gameId, result) {
    var score = Math.round(result.score || 0);
    var cheatsFlags = RP.Cheats.activeFlags(gameId);
    var basePoints = D.pointsForScore(gameId, score);
    var points = cheatsFlags.scoremultiplier ? basePoints * 2 : basePoints;

    var playRes = S.recordPlay(gameId, score);
    S.addPoints(points, 'play:' + gameId);
    var newAchievements = RP.Achievements.check({ type: 'gameover', gameId: gameId, score: score, won: result.won });

    var stage = $('#rp-stage');
    var overlay = el('div', 'rp-overlay');
    overlay.id = 'rp-gameover-overlay';
    var medalHtml = result.medal ? '<div class="rp-medal">' + result.medal.emoji + ' ' + result.medal.name + ' medal</div>' : '';
    var wonHtml = result.won !== undefined ? '<div class="rp-medal">' + (result.won ? '🏆 You won the match!' : '💀 The boss won this time.') + '</div>' : '';
    overlay.innerHTML =
      '<div class="rp-overlay-card">' +
      '  <h2>' + (result.won === false ? 'DEFEAT' : 'GAME OVER') + '</h2>' +
      '  <div class="rp-overlay-score">' + fmt(score) + ' <span>points scored</span></div>' +
      (playRes.isNewBest ? '<div class="rp-newbest">🏅 New personal best!</div>' : '') +
      medalHtml + wonHtml +
      '  <div class="rp-overlay-points">+' + fmt(points) + ' RetroPlay points earned' + (cheatsFlags.scoremultiplier ? ' (x2 active)' : '') + '</div>' +
      (newAchievements.length ? '<div class="rp-overlay-ach">' + newAchievements.map(function (a) { return a.emoji + ' ' + a.name; }).join(' &nbsp;·&nbsp; ') + '</div>' : '') +
      '  <div class="rp-overlay-actions">' +
      '    <button class="rp-btn rp-btn-primary" id="rp-btn-again">↻ Play Again</button>' +
      '    <a class="rp-btn rp-btn-ghost" href="#/cheats">🛒 Cheat Shop</a>' +
      '    <a class="rp-btn rp-btn-ghost" href="#/hub">🏠 Back to Games</a>' +
      '  </div>' +
      '</div>';
    stage.appendChild(overlay);
    requestAnimationFrame(function () { overlay.classList.add('show'); });
    var bestEl = $('#rp-hud-best'); if (bestEl) bestEl.textContent = fmt(playRes.best);
    $('#rp-btn-again', overlay).addEventListener('click', function () {
      overlay.remove();
      currentGame.restart();
    });
  }

  // ---------------------------------------------------------------------
  // Cheat Shop
  // ---------------------------------------------------------------------
  function renderCheatShop() {
    var wrap = el('div', 'rp-page rp-cheats');
    wrap.innerHTML =
      '<div class="rp-page-head"><h1>🛒 Cheat Shop</h1><p>Spend points on permanent, per-game cheats. You have <b id="rp-shop-points">' + fmt(S.getPoints()) + '</b> points.</p></div>' +
      '<div class="rp-cheat-grid" id="rp-cheat-grid"></div>';
    appRoot.appendChild(wrap);
    var grid = $('#rp-cheat-grid', wrap);

    function redraw() {
      grid.innerHTML = '';
      D.CHEATS.forEach(function (c) {
        var owned = S.ownsCheat(c.id);
        var card = el('div', 'rp-cheat-card' + (owned ? ' owned' : ''));
        var gameNames = c.games.map(function (gid) { var g = D.gameById(gid); return g ? g.emoji : ''; }).join(' ');
        card.innerHTML =
          '<div class="rp-cheat-card-emoji">' + c.emoji + '</div>' +
          '<h3>' + c.name + '</h3>' +
          '<p>' + c.desc + '</p>' +
          '<div class="rp-cheat-card-games">' + gameNames + '</div>' +
          '<div class="rp-cheat-card-foot">' +
          (owned ? '<span class="rp-owned-badge">✓ Owned</span>' : '<button class="rp-btn rp-btn-gold rp-buy-btn">Buy — ' + c.cost + ' pts</button>') +
          '</div>';
        if (!owned) {
          var btn = $('.rp-buy-btn', card);
          btn.disabled = S.getPoints() < c.cost;
          btn.addEventListener('click', function () {
            var res = RP.Cheats.purchase(c.id);
            if (res.ok) { redraw(); $('#rp-shop-points').textContent = fmt(S.getPoints()); }
          });
        }
        grid.appendChild(card);
      });
    }
    redraw();
  }

  // ---------------------------------------------------------------------
  // Leaderboard
  // ---------------------------------------------------------------------
  function renderLeaderboard() {
    var wrap = el('div', 'rp-page rp-leaderboard');
    wrap.innerHTML =
      '<div class="rp-page-head"><h1>🏆 Leaderboard</h1>' +
      '<p>This is a <b>local, on-device leaderboard</b>: since RetroPlay has no backend or server, these sample competitor scores are generated locally and stay consistent for you — your own scores are 100% real.</p></div>' +
      '<div class="rp-lb-tabs" id="rp-lb-tabs"></div>' +
      '<div class="rp-lb-board" id="rp-lb-board"></div>';
    appRoot.appendChild(wrap);
    var tabs = $('#rp-lb-tabs', wrap);
    var board = $('#rp-lb-board', wrap);

    var options = [{ id: 'overall', title: '⭐ Overall' }].concat(D.GAMES.map(function (g) { return { id: g.id, title: g.emoji + ' ' + g.title }; }));
    var active = 'overall';

    function redraw() {
      tabs.innerHTML = '';
      options.forEach(function (o) {
        var t = el('button', 'rp-lb-tab' + (o.id === active ? ' active' : ''), o.title);
        t.addEventListener('click', function () { active = o.id; redraw(); });
        tabs.appendChild(t);
      });
      var list = active === 'overall' ? RP.Leaderboard.getOverallBoard() : RP.Leaderboard.getBoard(active);
      board.innerHTML = '<ol class="rp-lb-list">' + list.map(function (row, i) {
        var medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1) + '.';
        return '<li class="rp-lb-row' + (row.isYou ? ' you' : '') + '"><span class="rp-lb-rank">' + medal + '</span><span class="rp-lb-name">' + escapeHtml(row.name) + (row.isYou ? ' (you)' : '') + '</span><span class="rp-lb-score">' + fmt(row.score) + '</span></li>';
      }).join('') + '</ol>';
    }
    redraw();
  }

  // ---------------------------------------------------------------------
  // Achievements
  // ---------------------------------------------------------------------
  function renderAchievements() {
    var wrap = el('div', 'rp-page rp-achievements');
    var unlockedCount = D.ACHIEVEMENTS.filter(function (a) { return S.hasAchievement(a.id); }).length;
    wrap.innerHTML =
      '<div class="rp-page-head"><h1>🏅 Achievements</h1><p>' + unlockedCount + ' / ' + D.ACHIEVEMENTS.length + ' unlocked</p></div>' +
      '<div class="rp-ach-grid" id="rp-ach-grid"></div>';
    appRoot.appendChild(wrap);
    var grid = $('#rp-ach-grid', wrap);
    D.ACHIEVEMENTS.forEach(function (a) {
      var unlocked = S.hasAchievement(a.id);
      var card = el('div', 'rp-ach-card' + (unlocked ? ' unlocked' : ''));
      card.innerHTML = '<div class="rp-ach-emoji">' + (unlocked ? a.emoji : '🔒') + '</div><h4>' + a.name + '</h4><p>' + a.desc + '</p><div class="rp-ach-points">+' + a.points + ' pts</div>';
      grid.appendChild(card);
    });
  }

  // ---------------------------------------------------------------------
  // Rewards (daily login recap + spin wheel + referral)
  // ---------------------------------------------------------------------
  function renderRewards() {
    var p = S.getProfile();
    var wrap = el('div', 'rp-page rp-rewards');
    wrap.innerHTML =
      '<div class="rp-page-head"><h1>🎁 Rewards</h1><p>Daily logins, the spin wheel, and referrals — all saved to this browser.</p></div>' +
      '<div class="rp-rewards-grid">' +
      '  <div class="rp-card">' +
      '    <h3>🔥 Login Streak</h3>' +
      '    <div class="rp-streak-num">' + (p.streak || 1) + ' <span>day' + ((p.streak || 1) === 1 ? '' : 's') + '</span></div>' +
      '    <p>Come back daily — rewards grow with your streak (capped at +100/day).</p>' +
      '  </div>' +
      '  <div class="rp-card rp-spin-card">' +
      '    <h3>🎡 Daily Spin</h3>' +
      '    <div id="rp-wheel-wrap"></div>' +
      '    <button id="rp-spin-btn" class="rp-btn rp-btn-gold rp-btn-block">' + (RP.DailySpin.canSpin() ? 'SPIN NOW' : 'Come back tomorrow') + '</button>' +
      '  </div>' +
      '  <div class="rp-card">' +
      '    <h3>👥 Referral</h3>' +
      '    <p>Share your code. When a friend enters it on <em>their</em> RetroPlay (any device/browser), you each get the bonus once.</p>' +
      '    <div class="rp-referral-code">' + p.referralCode + '</div>' +
      '    <button id="rp-copy-ref" class="rp-btn rp-btn-ghost rp-btn-block">📋 Copy Code</button>' +
      '    <div class="rp-referral-redeem">' +
      '      <input id="rp-ref-input" class="rp-input" placeholder="Enter a friend\'s code" ' + (p.redeemedReferral ? 'disabled' : '') + '>' +
      '      <button id="rp-ref-submit" class="rp-btn rp-btn-primary" ' + (p.redeemedReferral ? 'disabled' : '') + '>Redeem</button>' +
      '    </div>' +
      (p.redeemedReferral ? '<p class="rp-small-note">✓ Referral already redeemed on this account.</p>' : '') +
      '  </div>' +
      '</div>';
    appRoot.appendChild(wrap);

    drawWheel($('#rp-wheel-wrap', wrap));
    $('#rp-spin-btn', wrap).addEventListener('click', function () {
      if (!RP.DailySpin.canSpin()) return;
      var btn = this;
      btn.disabled = true;
      animateSpin(function () {
        var res = RP.DailySpin.spin();
        btn.textContent = 'Come back tomorrow';
        if (res.ok) {
          RP.Sound.achievement();
          var note = el('div', 'rp-spin-result', res.segment.type === 'points' && res.segment.value > 0 ? ('🎉 You won ' + res.segment.value + ' points!') : 'No luck this time — try tomorrow!');
          $('.rp-spin-card', wrap).appendChild(note);
        }
      });
    });
    $('#rp-copy-ref', wrap).addEventListener('click', function () {
      var code = p.referralCode;
      var done = function () { this.textContent = '✓ Copied!'; setTimeout(function () { $('#rp-copy-ref').textContent = '📋 Copy Code'; }, 1500); }.bind(this);
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(code).then(done).catch(done); } else { done(); }
    });
    $('#rp-ref-submit', wrap).addEventListener('click', function () {
      var val = $('#rp-ref-input', wrap).value;
      var res = S.redeemReferral(val);
      var msgEl = el('p', 'rp-small-note', res.ok ? ('✓ +' + res.reward + ' points redeemed!') : 'Could not redeem: ' + res.reason);
      $('.rp-referral-redeem', wrap).after(msgEl);
      if (res.ok) { $('#rp-ref-input', wrap).disabled = true; $('#rp-ref-submit', wrap).disabled = true; }
    });
  }

  function drawWheel(container) {
    var segs = RP.DailySpin.SEGMENTS;
    var size = 200, r = 96, cx = size / 2, cy = size / 2;
    var colors = ['#4B5BF6', '#FFB930', '#1FAE6E', '#FF6FA8', '#9b6bff', '#E84C3D', '#3a7bd5', '#5B6178'];
    var svgParts = ['<svg id="rp-wheel-svg" viewBox="0 0 ' + size + ' ' + size + '" width="200" height="200">'];
    var anglePer = (Math.PI * 2) / segs.length;
    segs.forEach(function (s, i) {
      var a0 = i * anglePer - Math.PI / 2, a1 = a0 + anglePer;
      var x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
      var x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
      svgParts.push('<path d="M' + cx + ',' + cy + ' L' + x0 + ',' + y0 + ' A' + r + ',' + r + ' 0 0,1 ' + x1 + ',' + y1 + ' Z" fill="' + colors[i % colors.length] + '" stroke="#0a0a0f" stroke-width="2"/>');
      var midA = a0 + anglePer / 2;
      var tx = cx + r * 0.62 * Math.cos(midA), ty = cy + r * 0.62 * Math.sin(midA);
      svgParts.push('<text x="' + tx + '" y="' + ty + '" font-size="9" fill="#fff" font-family="monospace" text-anchor="middle" transform="rotate(' + (midA * 180 / Math.PI + 90) + ' ' + tx + ' ' + ty + ')">' + s.label + '</text>');
    });
    svgParts.push('<circle cx="' + cx + '" cy="' + cy + '" r="10" fill="#0a0a0f" stroke="#fff" stroke-width="2"/></svg>');
    container.innerHTML = '<div class="rp-wheel-pointer">▼</div>' + svgParts.join('');
  }

  function animateSpin(done) {
    var svg = document.getElementById('rp-wheel-svg');
    if (!svg) return done();
    var spins = 4 + Math.random() * 2;
    var deg = spins * 360 + Math.random() * 360;
    svg.style.transition = 'transform 3s cubic-bezier(.17,.67,.21,1)';
    svg.style.transform = 'rotate(' + deg + 'deg)';
    setTimeout(done, 3050);
  }

  // ---------------------------------------------------------------------
  // Profile
  // ---------------------------------------------------------------------
  function renderProfile() {
    var p = S.getProfile();
    var s = S.load();
    var wrap = el('div', 'rp-page rp-profile');
    wrap.innerHTML =
      '<div class="rp-page-head"><h1>👤 Profile</h1></div>' +
      '<div class="rp-rewards-grid">' +
      '  <div class="rp-card">' +
      '    <h3>Player</h3>' +
      '    <input id="rp-profile-name" class="rp-input" value="' + escapeHtml(p.name) + '" maxlength="18">' +
      '    <button id="rp-profile-save" class="rp-btn rp-btn-primary rp-btn-block">Save Name</button>' +
      '    <p class="rp-small-note">Account type: ' + (p.isGuest ? 'Guest' : 'Named player') + ' · Member since ' + new Date(p.createdAt).toLocaleDateString() + '</p>' +
      '  </div>' +
      '  <div class="rp-card">' +
      '    <h3>Stats</h3>' +
      '    <ul class="rp-stat-list">' +
      '      <li>Games played: <b>' + s.stats.gamesPlayed + '</b></li>' +
      '      <li>Total points earned: <b>' + fmt(s.totalPointsEarned) + '</b></li>' +
      '      <li>Total points spent: <b>' + fmt(s.totalPointsSpent) + '</b></li>' +
      '      <li>Cheats owned: <b>' + Object.keys(s.cheats.owned).length + '</b></li>' +
      '      <li>Achievements: <b>' + Object.keys(s.achievements).length + ' / ' + D.ACHIEVEMENTS.length + '</b></li>' +
      '    </ul>' +
      '  </div>' +
      '  <div class="rp-card">' +
      '    <h3>Save Data</h3>' +
      '    <p>Everything lives in this browser\'s localStorage. Back it up or move it to another browser:</p>' +
      '    <button id="rp-export" class="rp-btn rp-btn-ghost rp-btn-block">⬇ Export Save (.json)</button>' +
      '    <input type="file" id="rp-import-file" accept="application/json" style="display:none">' +
      '    <button id="rp-import" class="rp-btn rp-btn-ghost rp-btn-block">⬆ Import Save</button>' +
      '    <button id="rp-reset" class="rp-btn rp-btn-danger rp-btn-block">⚠ Reset All Progress</button>' +
      '  </div>' +
      '</div>';
    appRoot.appendChild(wrap);

    $('#rp-profile-save', wrap).addEventListener('click', function () {
      S.setPlayer($('#rp-profile-name', wrap).value, p.isGuest);
      buildHeaderBar();
      this.textContent = '✓ Saved';
      setTimeout(function () { $('#rp-profile-save').textContent = 'Save Name'; }, 1200);
    });
    $('#rp-export', wrap).addEventListener('click', function () {
      var blob = new Blob([S.exportSave()], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'retroplay-save.json';
      a.click();
    });
    $('#rp-import', wrap).addEventListener('click', function () { $('#rp-import-file', wrap).click(); });
    $('#rp-import-file', wrap).addEventListener('change', function (e) {
      var file = e.target.files[0]; if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        if (S.importSave(reader.result)) { window.location.hash = ''; window.location.reload(); }
        else alert('That file could not be read as a RetroPlay save.');
      };
      reader.readAsText(file);
    });
    $('#rp-reset', wrap).addEventListener('click', function () {
      if (confirm('This permanently deletes all RetroPlay progress in this browser. Continue?')) {
        S.resetAll();
        window.location.hash = '';
        window.location.reload();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);

})(window);
