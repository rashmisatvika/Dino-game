// Offline Dino Game (canvas) with synthesized sounds, mobile/tap + keyboard, localStorage high-score.
// Assets expected:
//  - assets/dino-run1.svg
//  - assets/dino-run2.svg
//  - assets/cactus.svg

(() => {
  // Identify HTML elements
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const startBtn = document.getElementById('startBtn');
  const overlay = document.getElementById('overlay');
  const scoreEl = document.getElementById('score');
  const hsEl = document.getElementById('highscore');
  const finalScoreEl = document.getElementById('finalScore');
  const muteBtn = document.getElementById('muteBtn');

  // Set canvas logical size (responsive handled via CSS)
  const W = 800;
  const H = 200;
  canvas.width = W;
  canvas.height = H;

  // Game state
  let running = false;
  let lastTime = 0;
  let speed = 300; // pixels/sec base speed (obstacle speed)
  let spawnTimer = 0;
  let spawnInterval = 1500; // ms
  let obstacles = [];
  let groundY = H - 30;
  let score = 0;
  let highscore = parseInt(localStorage.getItem('dino_highscore') || 0, 10) || 0;
  hsEl.textContent = 'High: ' + highscore;
  let muted = (localStorage.getItem('dino_muted') === '1');
  updateMuteButton();

  // Dino state
  const dino = {
    x: 60,
    y: groundY,
    vy: 0,
    width: 44,
    height: 44,
    gravity: 1400,
    jumpForce: -520,
    onGround: true,
    frame: 0,
    frameTimer: 0
  };

  // Assets
  const ASSET_PATH = 'assets/';
  const dinoImgs = [
    loadImage(ASSET_PATH + 'dino-run1.svg'),
    loadImage(ASSET_PATH + 'dino-run2.svg')
  ];
  const cactusImg = loadImage(ASSET_PATH + 'cactus.svg');

  let assetsLoaded = 0;
  const totalAssets = dinoImgs.length + 1;
  dinoImgs.concat([cactusImg]).forEach(img => {
    img.onload = () => {
      assetsLoaded++;
      // all loaded
    };
    img.onerror = () => {
      console.warn('Asset failed to load:', img.src);
      assetsLoaded++;
    };
  });

  // Audio (WebAudio synthesized)
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audioCtx = AudioCtx ? new AudioCtx() : null;

  function playJumpSound() {
    if (muted || !audioCtx) return;
    const ctx = audioCtx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 600;
    g.gain.value = 0;
    o.connect(g);
    g.connect(ctx.destination);
    const now = ctx.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.18, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    o.start(now);
    o.stop(now + 0.3);
  }

  function playHitSound() {
    if (muted || !audioCtx) return;
    const ctx = audioCtx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = 150;
    g.gain.value = 0;
    o.connect(g);
    g.connect(ctx.destination);
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.2, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    o.start(now);
    o.stop(now + 0.6);
  }

  function playPointSound() {
    if (muted || !audioCtx) return;
    const ctx = audioCtx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 900;
    g.gain.value = 0;
    o.connect(g);
    g.connect(ctx.destination);
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.12, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    o.start(now);
    o.stop(now + 0.2);
  }

  function updateMuteButton() {
    muteBtn.textContent = muted ? '🔇' : '🔊';
  }

  muteBtn.addEventListener('click', () => {
    muted = !muted;
    localStorage.setItem('dino_muted', muted ? '1' : '0');
    updateMuteButton();
    // Resume audio context on first user gesture if necessary
    if (audioCtx && audioCtx.state === 'suspended' && !muted) audioCtx.resume();
  });

  // Input
  function tryJump() {
    if (!running) return startGame();
    if (dino.onGround) {
      dino.vy = dino.jumpForce;
      dino.onGround = false;
      playJumpSound();
    }
    // resume audio context for first interaction
    if (audioCtx && audioCtx.state === 'suspended' && !muted) audioCtx.resume();
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      tryJump();
    } else if (e.code === 'KeyR' && !running) {
      startGame();
    }
  });

  // Touch support
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    tryJump();
  }, {passive:false});
  canvas.addEventListener('mousedown', (e) => {
    e.preventDefault();
    tryJump();
  });

  // Start/Restart
  startBtn.addEventListener('click', startGame);

  function startGame() {
    // Reset state
    obstacles = [];
    score = 0;
    speed = 300;
    spawnInterval = 1500;
    dino.y = groundY - dino.height;
    dino.vy = 0;
    dino.onGround = true;
    dino.frame = 0;
    dino.frameTimer = 0;
    running = true;
    overlay.classList.add('hidden');
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function endGame() {
    running = false;
    overlay.classList.remove('hidden');
    finalScoreEl.classList.remove('hidden');
    finalScoreEl.textContent = 'Score: ' + Math.floor(score);
    playHitSound();
    if (Math.floor(score) > highscore) {
      highscore = Math.floor(score);
      localStorage.setItem('dino_highscore', String(highscore));
      hsEl.textContent = 'High: ' + highscore;
      finalScoreEl.textContent += '  — New High!';
    }
  }

  // Obstacles
  function spawnObstacle() {
    const baseW = 24;
    const baseH = 34;
    // randomize size
    const scale = 0.9 + Math.random() * 1.2;
    const w = Math.round(baseW * scale);
    const h = Math.round(baseH * scale);
    obstacles.push({
      x: W + 20,
      y: groundY - h,
      w,
      h
    });
  }

  // Collision detection (AABB)
  function collide(a, b) {
    return !(a.x + a.w < b.x || a.x > b.x + b.w || a.y + a.h < b.y || a.y > b.y + b.h);
  }

  // Main loop
  function loop(ts) {
    const dt = Math.min(40, ts - lastTime);
    lastTime = ts;
    update(dt / 1000);
    draw();
    if (running) requestAnimationFrame(loop);
  }

  function update(dt) {
    // update dino physics
    dino.vy += dino.gravity * dt;
    dino.y += dino.vy * dt;
    if (dino.y >= groundY - dino.height) {
      dino.y = groundY - dino.height;
      dino.vy = 0;
      dino.onGround = true;
    }

    // update running frame when on ground
    if (dino.onGround) {
      dino.frameTimer += dt * 1000;
      if (dino.frameTimer > 120) {
        dino.frame = (dino.frame + 1) % dinoImgs.length;
        dino.frameTimer = 0;
      }
    } else {
      dino.frame = 0; // single frame in air
    }

    // move obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
      obstacles[i].x -= speed * dt;
      if (obstacles[i].x + obstacles[i].w < -50) obstacles.splice(i, 1);
    }

    // spawn
    spawnTimer += dt * 1000;
    if (spawnTimer >= spawnInterval) {
      spawnTimer = 0;
      spawnInterval = 900 + Math.random() * 1200 - Math.min(700, score * 3); // gradually shorter
      spawnInterval = Math.max(650, spawnInterval);
      spawnObstacle();
    }

    // collision check
    const playerBox = { x: dino.x + 6, y: dino.y + 6, w: dino.width - 12, h: dino.height - 6 };
    for (let ob of obstacles) {
      const obBox = { x: ob.x, y: ob.y, w: ob.w, h: ob.h };
      if (collide(playerBox, obBox)) {
        endGame();
        return;
      }
    }

    // score & difficulty
    score += dt * 60; // scale so it increases roughly like frames
    if (Math.floor(score) % 100 === 0 && Math.floor(score) !== 0) {
      // play point sound at milestones; ensure it does not spam
      if (!playPointSound._last || (performance.now() - playPointSound._last) > 900) {
        playPointSound();
        playPointSound._last = performance.now();
      }
    }
    // ramp speed slowly
    speed += dt * 6; // subtle increase
    scoreEl.textContent = Math.floor(score);
  }

  // Draw
  function draw() {
    // clear
    ctx.clearRect(0, 0, W, H);
    // sky/background
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, groundY);
    // ground
    ctx.fillStyle = '#e9e9e9';
    ctx.fillRect(0, groundY, W, H - groundY);
    // drawing repeating ground line for motion feel
    const patternY = groundY + 14;
    ctx.strokeStyle = '#d1d1d1';
    ctx.lineWidth = 2;
    for (let x = 0; x < W; x += 24) {
      const off = ((performance.now() / 6) % 24);
      ctx.beginPath();
      ctx.moveTo(x - off, patternY);
      ctx.lineTo(x - off + 12, patternY);
      ctx.stroke();
    }

    // draw dino
    const img = dinoImgs[dino.frame].complete ? dinoImgs[dino.frame] : null;
    if (img) {
      const drawX = dino.x;
      const drawY = Math.round(dino.y);
      const drawW = dino.width;
      const drawH = dino.height;
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
    } else {
      // fallback box
      ctx.fillStyle = '#222';
      ctx.fillRect(dino.x, Math.round(dino.y), dino.width, dino.height);
    }

    // draw obstacles
    for (let ob of obstacles) {
      if (cactusImg.complete) {
        ctx.drawImage(cactusImg, ob.x, ob.y, ob.w, ob.h);
      } else {
        ctx.fillStyle = '#6a6a6a';
        ctx.fillRect(ob.x, ob.y, ob.w, ob.h);
      }
    }

    // debug hitbox (comment out if not needed)
    // ctx.strokeStyle = 'rgba(255,0,0,0.6)';
    // ctx.strokeRect(dino.x+6, dino.y+6, dino.width-12, dino.height-6);
  }

  // Utilities
  function loadImage(src) {
    const img = new Image();
    img.src = src;
    return img;
  }

  // Initial overlay content
  overlay.classList.remove('hidden');
  finalScoreEl.classList.add('hidden');

  // Show a small "loading" until assets loaded (optional)
  let waitStart = performance.now();
  const waitInt = setInterval(() => {
    if (assetsLoaded >= totalAssets || performance.now() - waitStart > 2000) {
      clearInterval(waitInt);
      // show overlay ready text (already visible)
    }
  }, 100);

  // Ensure user gesture to resume audio context when necessary
  document.addEventListener('click', () => {
    if (audioCtx && audioCtx.state === 'suspended' && !muted) audioCtx.resume();
  }, {once:true});

})();