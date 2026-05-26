const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreNode = document.getElementById("score");
const livesNode = document.getElementById("lives");
const powerNode = document.getElementById("power");
const startScreen = document.getElementById("startScreen");
const gameOverScreen = document.getElementById("gameOverScreen");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");
const pauseButton = document.getElementById("pauseButton");
const finalScoreNode = document.getElementById("finalScore");
const bestScoreNode = document.getElementById("bestScore");
const energyValueNode = document.getElementById("energyValue");
const energyFillNode = document.getElementById("energyFill");
const skillButton = document.getElementById("skillButton");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const ENERGY_MAX = 100;
const storageKey = "starwing-best-score";

const keys = new Set();
const pointer = { active: false, x: WIDTH / 2, y: HEIGHT - 110 };

let state = "start";
let lastTime = 0;
let score = 0;
let bestScore = Number(localStorage.getItem(storageKey) || 0);
let elapsed = 0;
let shake = 0;
let flash = 0;
let spawnTimer = 0;
let powerTimer = 0;
let healTimer = 0;
let enemyShotTimer = 0;
let waveTimer = 0;
let lastStage = 0;

const player = {
  x: WIDTH / 2,
  y: HEIGHT - 96,
  radius: 17,
  speed: 360,
  lives: 3,
  power: 1,
  energy: 0,
  cooldown: 0,
  invincible: 0,
};

let bullets = [];
let enemyBullets = [];
let enemies = [];
let powerups = [];
let particles = [];
let floatingTexts = [];
let empWaves = [];
let lightningBolts = [];
let stars = [];

const enemyTypes = {
  scout: { hp: 1, score: 10, energy: 6, radius: 18, speed: 132, color: "#ff5a7a" },
  brute: { hp: 4, score: 36, energy: 15, radius: 25, speed: 92, color: "#ff9f43" },
  gunner: { hp: 2, score: 48, energy: 12, radius: 21, speed: 110, color: "#b985ff" },
  striker: { hp: 1, score: 28, energy: 9, radius: 16, speed: 245, color: "#ff3d4f" },
};

function resetStars() {
  stars = Array.from({ length: 110 }, () => ({
    x: Math.random() * WIDTH,
    y: Math.random() * HEIGHT,
    size: Math.random() * 1.8 + 0.4,
    speed: Math.random() * 80 + 40,
    alpha: Math.random() * 0.65 + 0.25,
  }));
}

function resetGame() {
  score = 0;
  elapsed = 0;
  shake = 0;
  flash = 0;
  spawnTimer = 0.55;
  powerTimer = 8;
  healTimer = 18;
  enemyShotTimer = 5.5;
  waveTimer = 12;
  lastStage = 0;
  Object.assign(player, {
    x: WIDTH / 2,
    y: HEIGHT - 96,
    lives: 3,
    power: 1,
    energy: 0,
    cooldown: 0,
    invincible: 1.4,
  });
  bullets = [];
  enemyBullets = [];
  enemies = [];
  powerups = [];
  particles = [];
  floatingTexts = [];
  empWaves = [];
  lightningBolts = [];
  resetStars();
  spawnOpeningWave();
  updateHud();
}

function startGame() {
  resetGame();
  state = "playing";
  startScreen.classList.add("hidden");
  gameOverScreen.classList.add("hidden");
  pauseButton.textContent = "Ⅱ";
}

function endGame() {
  state = "gameover";
  bestScore = Math.max(bestScore, score);
  localStorage.setItem(storageKey, String(bestScore));
  finalScoreNode.textContent = score;
  bestScoreNode.textContent = bestScore;
  gameOverScreen.classList.remove("hidden");
}

function updateHud() {
  scoreNode.textContent = score;
  livesNode.textContent = player.lives;
  powerNode.textContent = player.power;
  const energyPercent = Math.round((player.energy / ENERGY_MAX) * 100);
  energyValueNode.textContent = `${energyPercent}%`;
  energyFillNode.style.width = `${energyPercent}%`;
  const ready = player.energy >= ENERGY_MAX && state === "playing";
  skillButton.disabled = !ready;
  skillButton.classList.toggle("ready", ready);
}

function difficulty() {
  return 1 + Math.min(elapsed / 28 + score / 720, 5.6);
}

function stageLevel() {
  if (elapsed >= 105) return 5;
  if (elapsed >= 75) return 4;
  if (elapsed >= 44) return 3;
  if (elapsed >= 20) return 2;
  if (elapsed >= 8) return 1;
  return 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function spawnOpeningWave() {
  const positions = [
    { x: WIDTH * 0.26, y: 96, type: "scout" },
    { x: WIDTH * 0.5, y: 54, type: "brute" },
    { x: WIDTH * 0.74, y: 124, type: "scout" },
  ];
  positions.forEach((item) => spawnEnemy(item));
}

function spawnEnemy(options = {}) {
  const level = difficulty();
  const roll = Math.random();
  let type = options.type || "scout";
  if (!options.type && elapsed > 10 && roll > 0.68) type = "brute";
  if (!options.type && elapsed > 14 && roll > 0.44) type = "gunner";
  if (!options.type && elapsed > 24 && roll > 0.55) type = "striker";

  const config = enemyTypes[type];
  enemies.push({
    type,
    x: options.x ?? randomBetween(config.radius + 16, WIDTH - config.radius - 16),
    y: options.y ?? -config.radius - 12,
    radius: config.radius,
    hp: config.hp,
    maxHp: config.hp,
    speed: (options.speed ?? config.speed) * randomBetween(0.88, 1.14) * Math.min(level, 3.15),
    vx: options.vx ?? randomBetween(-18, 18),
    wobble: randomBetween(0, Math.PI * 2),
    color: config.color,
    score: config.score,
    energy: config.energy,
    shotCooldown: randomBetween(0.45, 1.25),
    hitFlash: 0,
  });
}

function spawnFormation() {
  const level = stageLevel();
  const baseY = -32;
  const patterns = [
    [
      { x: WIDTH * 0.25, y: baseY, type: "scout" },
      { x: WIDTH * 0.5, y: baseY - 34, type: "scout" },
      { x: WIDTH * 0.75, y: baseY, type: "scout" },
    ],
    [
      { x: WIDTH * 0.22, y: baseY, type: "scout", vx: 18 },
      { x: WIDTH * 0.5, y: baseY - 46, type: "gunner" },
      { x: WIDTH * 0.78, y: baseY, type: "scout", vx: -18 },
    ],
    [
      { x: WIDTH * 0.18, y: baseY, type: "striker", vx: 36 },
      { x: WIDTH * 0.38, y: baseY - 34, type: "scout" },
      { x: WIDTH * 0.62, y: baseY - 34, type: "scout" },
      { x: WIDTH * 0.82, y: baseY, type: "striker", vx: -36 },
    ],
    [
      { x: WIDTH * 0.18, y: baseY, type: "striker", vx: 54 },
      { x: WIDTH * 0.36, y: baseY - 42, type: "gunner" },
      { x: WIDTH * 0.64, y: baseY - 42, type: "gunner" },
      { x: WIDTH * 0.82, y: baseY, type: "striker", vx: -54 },
      { x: WIDTH * 0.5, y: baseY - 86, type: "brute" },
    ],
    [
      { x: WIDTH * 0.12, y: baseY, type: "striker", vx: 62 },
      { x: WIDTH * 0.3, y: baseY - 34, type: "gunner" },
      { x: WIDTH * 0.5, y: baseY - 82, type: "brute" },
      { x: WIDTH * 0.7, y: baseY - 34, type: "gunner" },
      { x: WIDTH * 0.88, y: baseY, type: "striker", vx: -62 },
      { x: WIDTH * 0.5, y: baseY - 136, type: "gunner" },
    ],
  ];
  const formation = patterns[Math.min(level, patterns.length - 1)];
  formation.forEach((item) => spawnEnemy(item));
  addText(level >= 3 ? "高压编队" : "敌机编队", WIDTH / 2, 96, "#ffd166");
}

function firePlayerBullet() {
  const spread = player.power >= 4 ? 0.24 : 0.16;
  const patterns = [
    [0],
    [-0.08, 0.08],
    [-spread, 0, spread],
    [-0.28, -0.1, 0.1, 0.28],
    [-0.32, -0.16, 0, 0.16, 0.32],
  ][player.power - 1];

  patterns.forEach((angle, index) => {
    bullets.push({
      x: player.x + (index - (patterns.length - 1) / 2) * 7,
      y: player.y - 24,
      vx: Math.sin(angle) * 210,
      vy: -500 * Math.cos(angle),
      radius: 5,
      damage: 1,
    });
  });
}

function shootEnemy(enemy) {
  const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
  const speed = enemy.type === "gunner" ? 230 : 190;
  const spread = difficulty() > 3.6 ? [-0.34, -0.16, 0, 0.16, 0.34] : difficulty() > 2.1 ? [-0.18, 0, 0.18] : [0];
  spread.forEach((offset) => {
    enemyBullets.push({
      x: enemy.x,
      y: enemy.y + enemy.radius * 0.5,
      vx: Math.cos(angle + offset) * speed,
      vy: Math.sin(angle + offset) * speed,
      radius: enemy.type === "brute" ? 7 : 6,
    });
  });
}

function gainEnergy(amount) {
  if (state !== "playing") return;
  const wasReady = player.energy >= ENERGY_MAX;
  player.energy = Math.min(ENERGY_MAX, player.energy + amount);
  if (!wasReady && player.energy >= ENERGY_MAX) {
    addText("电磁必杀就绪", WIDTH / 2, HEIGHT - 128, "#9ffcff");
  }
}

function createLightningPath(startX, startY, endX, endY, segments = 10, jag = 26) {
  const points = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const wave = Math.sin(t * Math.PI);
    points.push({
      x: startX + (endX - startX) * t + randomBetween(-jag, jag) * wave,
      y: startY + (endY - startY) * t + randomBetween(-jag, jag) * wave,
    });
  }
  return points;
}

function addLightning(startX, startY, endX, endY, color = "#9ffcff", width = 4) {
  lightningBolts.push({
    points: createLightningPath(startX, startY, endX, endY, 11, 34),
    life: 0.52,
    maxLife: 0.52,
    color,
    width,
  });
}

function releaseEmp() {
  if (state !== "playing" || player.energy < ENERGY_MAX) return;
  player.energy = 0;
  shake = 24;
  flash = 0.38;
  empWaves.push({ x: player.x, y: player.y, radius: 18, life: 0.9, maxLife: 0.9 });

  for (let i = 0; i < 18; i += 1) {
    const edge = i % 4;
    const target = {
      x: edge === 0 ? randomBetween(0, WIDTH) : edge === 1 ? WIDTH + 24 : edge === 2 ? randomBetween(0, WIDTH) : -24,
      y: edge === 0 ? -24 : edge === 1 ? randomBetween(0, HEIGHT) : edge === 2 ? HEIGHT + 24 : randomBetween(0, HEIGHT),
    };
    addLightning(player.x, player.y - 12, target.x, target.y, i % 3 === 0 ? "#ffd166" : "#9ffcff", i % 3 === 0 ? 5 : 3.5);
  }

  enemyBullets = [];
  enemies.forEach((enemy) => {
    if (enemy.dead) return;
    addLightning(player.x, player.y - 12, enemy.x, enemy.y, "#f7fbff", 4.5);
    enemy.hp -= 6;
    enemy.hitFlash = 0.22;
    if (enemy.hp <= 0) {
      enemy.dead = true;
      score += enemy.score;
      addExplosion(enemy.x, enemy.y, enemy.color, enemy.type === "brute" ? 34 : 22);
      addText(`+${enemy.score}`, enemy.x, enemy.y, "#9ffcff");
    }
  });

  addExplosion(player.x, player.y, "#9ffcff", 38);
  addText("电磁风暴", WIDTH / 2, HEIGHT / 2, "#f7fbff");
  updateHud();
}

function spawnPowerup(kind) {
  powerups.push({
    kind,
    x: randomBetween(36, WIDTH - 36),
    y: -30,
    radius: 15,
    speed: kind === "heal" ? 96 : 112,
    spin: 0,
  });
}

function addExplosion(x, y, color, amount = 18) {
  for (let i = 0; i < amount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = randomBetween(70, 270);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: randomBetween(0.34, 0.74),
      maxLife: 0.74,
      size: randomBetween(2, 5),
      color,
    });
  }
}

function addText(text, x, y, color = "#f7fbff") {
  floatingTexts.push({ text, x, y, color, life: 0.8, vy: -42 });
}

function damagePlayer() {
  if (player.invincible > 0 || state !== "playing") return;
  player.lives -= 1;
  if (player.power > 1) {
    player.power -= 1;
    addText("-火力", player.x, player.y - 34, "#ff8ea3");
  }
  player.invincible = 1.25;
  shake = 14;
  flash = 0.22;
  addExplosion(player.x, player.y, "#56d8ff", 20);
  updateHud();
  if (player.lives <= 0) {
    addExplosion(player.x, player.y, "#ffd166", 44);
    endGame();
  }
}

function update(dt) {
  if (state !== "playing") {
    updateBackground(dt);
    updateParticles(dt);
    return;
  }

  elapsed += dt;
  updateBackground(dt);

  const currentStage = stageLevel();
  if (currentStage > lastStage) {
    lastStage = currentStage;
    const labels = ["", "敌机开始反击", "火力升级", "高速突袭", "弹幕压制", "极限空域"];
    addText(labels[currentStage], WIDTH / 2, 122, "#ff8ea3");
    shake = Math.max(shake, 7);
  }

  spawnTimer -= dt;
  const nextSpawn = Math.max(0.12, 0.62 - difficulty() * 0.092);
  if (spawnTimer <= 0) {
    spawnEnemy();
    if (difficulty() > 2.2 && Math.random() < 0.34) spawnEnemy({ y: -66 });
    if (difficulty() > 4 && Math.random() < 0.18) spawnEnemy({ y: -110, type: "striker" });
    spawnTimer = randomBetween(nextSpawn * 0.48, nextSpawn * 0.98);
  }

  waveTimer -= dt;
  if (waveTimer <= 0) {
    spawnFormation();
    waveTimer = Math.max(5.4, randomBetween(12, 18) - difficulty() * 1.85);
  }

  enemyShotTimer -= dt;
  if (enemyShotTimer <= 0) {
    enemies
      .filter((enemy) => !enemy.dead && enemy.y > 45 && enemy.y < HEIGHT * 0.62 && enemy.type !== "scout")
      .slice(0, 3)
      .forEach((enemy) => shootEnemy(enemy));
    enemyShotTimer = Math.max(0.82, randomBetween(2.4, 3.7) - difficulty() * 0.34);
  }

  powerTimer -= dt;
  healTimer -= dt;
  if (powerTimer <= 0) {
    spawnPowerup("power");
    powerTimer = randomBetween(10, 15);
  }
  if (healTimer <= 0) {
    spawnPowerup("heal");
    healTimer = randomBetween(22, 30);
  }

  movePlayer(dt);
  player.cooldown -= dt;
  player.invincible = Math.max(0, player.invincible - dt);
  if (player.cooldown <= 0) {
    firePlayerBullet();
    player.cooldown = Math.max(0.09, 0.19 - player.power * 0.012);
  }

  bullets.forEach((bullet) => {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
  });

  enemyBullets.forEach((bullet) => {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
  });

  enemies.forEach((enemy) => {
    enemy.y += enemy.speed * dt;
    enemy.wobble += dt * 3;
    enemy.x += enemy.vx * dt;
    if (enemy.type !== "scout") enemy.x += Math.sin(enemy.wobble) * 38 * dt;
    if (enemy.type === "striker" && enemy.y < HEIGHT * 0.62) {
      enemy.x += Math.sign(player.x - enemy.x) * 52 * dt;
    }
    enemy.x = clamp(enemy.x, enemy.radius, WIDTH - enemy.radius);
    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);

    if (enemy.type === "gunner" || enemy.type === "striker" || (enemy.type === "brute" && elapsed > 24)) {
      enemy.shotCooldown -= dt;
      if (enemy.shotCooldown <= 0 && enemy.y > 35 && enemy.y < HEIGHT * 0.72) {
        shootEnemy(enemy);
        enemy.shotCooldown = randomBetween(0.7, 1.55) / Math.min(difficulty(), 3.8);
      }
    }
  });

  powerups.forEach((item) => {
    item.y += item.speed * dt;
    item.spin += dt * 5;
  });

  checkCollisions();
  cleanup();
  updateParticles(dt);
  updateHud();
  shake = Math.max(0, shake - dt * 46);
  flash = Math.max(0, flash - dt);
}

function updateBackground(dt) {
  stars.forEach((star) => {
    star.y += star.speed * dt * (state === "playing" ? difficulty() * 0.55 : 0.5);
    if (star.y > HEIGHT + 6) {
      star.y = -6;
      star.x = Math.random() * WIDTH;
    }
  });
}

function movePlayer(dt) {
  let dx = 0;
  let dy = 0;
  if (keys.has("ArrowLeft") || keys.has("KeyA")) dx -= 1;
  if (keys.has("ArrowRight") || keys.has("KeyD")) dx += 1;
  if (keys.has("ArrowUp") || keys.has("KeyW")) dy -= 1;
  if (keys.has("ArrowDown") || keys.has("KeyS")) dy += 1;

  if (pointer.active) {
    player.x += (pointer.x - player.x) * Math.min(1, dt * 15);
    player.y += (pointer.y - player.y) * Math.min(1, dt * 15);
  } else if (dx || dy) {
    const length = Math.hypot(dx, dy) || 1;
    player.x += (dx / length) * player.speed * dt;
    player.y += (dy / length) * player.speed * dt;
  }

  player.x = clamp(player.x, 25, WIDTH - 25);
  player.y = clamp(player.y, 86, HEIGHT - 36);
}

function checkCollisions() {
  bullets.forEach((bullet) => {
    enemies.forEach((enemy) => {
      if (bullet.dead || enemy.dead) return;
      if (distance(bullet, enemy) < bullet.radius + enemy.radius) {
        bullet.dead = true;
        enemy.hp -= bullet.damage;
        enemy.hitFlash = 0.08;
        addExplosion(bullet.x, bullet.y, "#56d8ff", 3);
        if (enemy.hp <= 0) {
          enemy.dead = true;
          score += enemy.score;
          gainEnergy(enemy.energy);
          addExplosion(enemy.x, enemy.y, enemy.color, enemy.type === "brute" ? 30 : 18);
          addText(`+${enemy.score}`, enemy.x, enemy.y, "#ffd166");
          if (Math.random() < 0.065) spawnPowerup(Math.random() < 0.72 ? "power" : "heal");
        }
      }
    });
  });

  enemies.forEach((enemy) => {
    if (!enemy.dead && distance(player, enemy) < player.radius + enemy.radius * 0.72) {
      enemy.dead = true;
      addExplosion(enemy.x, enemy.y, enemy.color, 16);
      damagePlayer();
    }
  });

  enemyBullets.forEach((bullet) => {
    if (!bullet.dead && distance(player, bullet) < player.radius + bullet.radius) {
      bullet.dead = true;
      damagePlayer();
    }
  });

  powerups.forEach((item) => {
    if (item.dead || distance(player, item) >= player.radius + item.radius + 5) return;
    item.dead = true;
    addExplosion(item.x, item.y, item.kind === "heal" ? "#7df59a" : "#ffd166", 12);
    if (item.kind === "heal") {
      player.lives = Math.min(5, player.lives + 1);
      addText("+生命", player.x, player.y - 28, "#7df59a");
    } else {
      player.power = Math.min(5, player.power + 1);
      addText("+火力", player.x, player.y - 28, "#ffd166");
    }
  });
}

function cleanup() {
  bullets = bullets.filter((bullet) => !bullet.dead && bullet.y > -30 && bullet.x > -40 && bullet.x < WIDTH + 40);
  enemyBullets = enemyBullets.filter(
    (bullet) => !bullet.dead && bullet.y < HEIGHT + 40 && bullet.x > -50 && bullet.x < WIDTH + 50,
  );
  enemies = enemies.filter((enemy) => !enemy.dead && enemy.y < HEIGHT + 70);
  powerups = powerups.filter((item) => !item.dead && item.y < HEIGHT + 40);
}

function updateParticles(dt) {
  particles.forEach((particle) => {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 0.98;
    particle.vy *= 0.98;
    particle.life -= dt;
  });
  particles = particles.filter((particle) => particle.life > 0);

  floatingTexts.forEach((text) => {
    text.y += text.vy * dt;
    text.life -= dt;
  });
  floatingTexts = floatingTexts.filter((text) => text.life > 0);

  empWaves.forEach((wave) => {
    wave.radius += 1320 * dt;
    wave.life -= dt;
  });
  empWaves = empWaves.filter((wave) => wave.life > 0);

  lightningBolts.forEach((bolt) => {
    bolt.life -= dt;
    if (bolt.life > 0 && Math.random() < 0.55) {
      const first = bolt.points[0];
      const last = bolt.points[bolt.points.length - 1];
      bolt.points = createLightningPath(first.x, first.y, last.x, last.y, 11, 34);
    }
  });
  lightningBolts = lightningBolts.filter((bolt) => bolt.life > 0);
}

function render() {
  ctx.save();
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  if (shake > 0) {
    ctx.translate(randomBetween(-shake, shake), randomBetween(-shake, shake));
  }

  drawBackground();
  drawPowerups();
  drawBullets();
  drawEnemies();
  drawPlayer();
  drawParticles();
  drawEmpEffects();
  drawFloatingTexts();

  if (flash > 0) {
    ctx.fillStyle = `rgba(255, 90, 122, ${flash})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  ctx.restore();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, "#050a18");
  gradient.addColorStop(0.54, "#101827");
  gradient.addColorStop(1, "#07111f");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  stars.forEach((star) => {
    ctx.globalAlpha = star.alpha;
    ctx.fillStyle = "#dff7ff";
    ctx.fillRect(star.x, star.y, star.size, star.size * 3.2);
  });
  ctx.globalAlpha = 1;
}

function drawPlayer() {
  const blink = player.invincible > 0 && Math.floor(player.invincible * 14) % 2 === 0;
  if (blink) return;

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.shadowBlur = 20;
  ctx.shadowColor = "#56d8ff";

  const bodyGradient = ctx.createLinearGradient(0, -30, 0, 24);
  bodyGradient.addColorStop(0, "#e8fbff");
  bodyGradient.addColorStop(0.34, "#56d8ff");
  bodyGradient.addColorStop(1, "#2277ff");
  const wingGradient = ctx.createLinearGradient(-22, -6, 22, 18);
  wingGradient.addColorStop(0, "#1f6dff");
  wingGradient.addColorStop(0.5, "#94f2ff");
  wingGradient.addColorStop(1, "#1f6dff");

  ctx.fillStyle = wingGradient;
  ctx.beginPath();
  ctx.moveTo(-5, -4);
  ctx.lineTo(-30, 20);
  ctx.lineTo(-14, 24);
  ctx.lineTo(0, 9);
  ctx.lineTo(14, 24);
  ctx.lineTo(30, 20);
  ctx.lineTo(5, -4);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(8, 18, 34, 0.28)";
  ctx.beginPath();
  ctx.moveTo(-18, 18);
  ctx.lineTo(-29, 22);
  ctx.lineTo(-19, 26);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(18, 18);
  ctx.lineTo(29, 22);
  ctx.lineTo(19, 26);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = bodyGradient;
  ctx.beginPath();
  ctx.moveTo(0, -34);
  ctx.bezierCurveTo(12, -14, 12, 12, 0, 29);
  ctx.bezierCurveTo(-12, 12, -12, -14, 0, -34);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 1.4;
  ctx.stroke();

  const cockpit = ctx.createLinearGradient(0, -24, 0, -2);
  cockpit.addColorStop(0, "#f7fbff");
  cockpit.addColorStop(0.52, "#74dfff");
  cockpit.addColorStop(1, "#12385f");
  ctx.fillStyle = cockpit;
  ctx.beginPath();
  ctx.ellipse(0, -14, 6, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#dffbff";
  ctx.globalAlpha = 0.82;
  ctx.beginPath();
  ctx.ellipse(-2, -18, 2, 5, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#ffd166";
  ctx.beginPath();
  ctx.moveTo(-7, 25);
  ctx.lineTo(0, 42 + Math.sin(elapsed * 28) * 4);
  ctx.lineTo(7, 25);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ff7a5c";
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.moveTo(-4, 27);
  ctx.lineTo(0, 37 + Math.sin(elapsed * 34) * 3);
  ctx.lineTo(4, 27);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawEnemies() {
  enemies.forEach((enemy) => {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.shadowBlur = 16;
    ctx.shadowColor = enemy.color;
    ctx.fillStyle = enemy.hitFlash > 0 ? "#ffffff" : enemy.color;

    if (enemy.type === "brute") {
      drawBomberEnemy(enemy.radius);
    } else if (enemy.type === "gunner") {
      drawFighterEnemy(enemy.radius, true, enemy.wobble);
    } else {
      drawFighterEnemy(enemy.radius, false, enemy.wobble);
    }

    if (enemy.maxHp > 1) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fillRect(-enemy.radius, -enemy.radius - 11, enemy.radius * 2, 4);
      ctx.fillStyle = "#7df59a";
      ctx.fillRect(-enemy.radius, -enemy.radius - 11, enemy.radius * 2 * (enemy.hp / enemy.maxHp), 4);
    }
    ctx.restore();
  });
}

function drawFighterEnemy(radius, hasCannon, wobble) {
  ctx.rotate(Math.sin(wobble) * 0.05);
  const mainColor = ctx.fillStyle;
  const body = ctx.createLinearGradient(0, -radius * 1.45, 0, radius * 1.2);
  body.addColorStop(0, "#ffe7ef");
  body.addColorStop(0.26, mainColor);
  body.addColorStop(1, "#6d1834");
  const wings = ctx.createLinearGradient(-radius * 1.25, 0, radius * 1.25, 0);
  wings.addColorStop(0, "#7a1738");
  wings.addColorStop(0.5, mainColor);
  wings.addColorStop(1, "#7a1738");

  ctx.fillStyle = wings;
  ctx.beginPath();
  ctx.moveTo(-radius * 0.24, -radius * 0.2);
  ctx.lineTo(-radius * 1.34, radius * 0.24);
  ctx.lineTo(-radius * 0.92, radius * 0.58);
  ctx.lineTo(-radius * 0.18, radius * 0.3);
  ctx.lineTo(radius * 0.18, radius * 0.3);
  ctx.lineTo(radius * 0.92, radius * 0.58);
  ctx.lineTo(radius * 1.34, radius * 0.24);
  ctx.lineTo(radius * 0.24, -radius * 0.2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(0, radius * 1.25);
  ctx.bezierCurveTo(radius * 0.34, radius * 0.54, radius * 0.28, -radius * 0.9, 0, -radius * 1.5);
  ctx.bezierCurveTo(-radius * 0.28, -radius * 0.9, -radius * 0.34, radius * 0.54, 0, radius * 1.25);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.36)";
  ctx.lineWidth = 1.1;
  ctx.stroke();

  ctx.fillStyle = "rgba(6, 17, 29, 0.48)";
  ctx.beginPath();
  ctx.ellipse(0, -radius * 0.5, radius * 0.2, radius * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.42)";
  ctx.beginPath();
  ctx.ellipse(-radius * 0.05, -radius * 0.58, radius * 0.06, radius * 0.16, 0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
  ctx.fillRect(-radius * 0.76, radius * 0.38, radius * 0.3, radius * 0.14);
  ctx.fillRect(radius * 0.46, radius * 0.38, radius * 0.3, radius * 0.14);

  ctx.fillStyle = "rgba(10, 16, 32, 0.45)";
  ctx.beginPath();
  ctx.moveTo(-radius * 0.12, radius * 0.72);
  ctx.lineTo(-radius * 0.54, radius * 1.04);
  ctx.lineTo(-radius * 0.22, radius * 1.12);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(radius * 0.12, radius * 0.72);
  ctx.lineTo(radius * 0.54, radius * 1.04);
  ctx.lineTo(radius * 0.22, radius * 1.12);
  ctx.closePath();
  ctx.fill();

  if (hasCannon) {
    ctx.fillStyle = "#0a1020";
    ctx.fillRect(-radius * 0.16, radius * 0.42, radius * 0.32, radius * 0.82);
    ctx.fillStyle = "#ffd166";
    ctx.fillRect(-radius * 0.08, radius * 1.08, radius * 0.16, radius * 0.26);
  }
}

function drawBomberEnemy(radius) {
  const mainColor = ctx.fillStyle;
  const body = ctx.createLinearGradient(0, -radius * 1.35, 0, radius * 1.2);
  body.addColorStop(0, "#ffe6bd");
  body.addColorStop(0.38, mainColor);
  body.addColorStop(1, "#87470d");
  const wings = ctx.createLinearGradient(-radius * 1.25, 0, radius * 1.25, 0);
  wings.addColorStop(0, "#8d4c11");
  wings.addColorStop(0.5, "#ffb35f");
  wings.addColorStop(1, "#8d4c11");

  ctx.fillStyle = wings;
  ctx.beginPath();
  ctx.moveTo(-radius * 0.3, -radius * 0.34);
  ctx.lineTo(-radius * 1.34, -radius * 0.02);
  ctx.lineTo(-radius * 1.16, radius * 0.44);
  ctx.lineTo(-radius * 0.28, radius * 0.28);
  ctx.lineTo(radius * 0.28, radius * 0.28);
  ctx.lineTo(radius * 1.16, radius * 0.44);
  ctx.lineTo(radius * 1.34, -radius * 0.02);
  ctx.lineTo(radius * 0.3, -radius * 0.34);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(0, -radius * 1.35);
  ctx.bezierCurveTo(radius * 0.42, -radius * 0.78, radius * 0.44, radius * 0.56, 0, radius * 1.28);
  ctx.bezierCurveTo(-radius * 0.44, radius * 0.56, -radius * 0.42, -radius * 0.78, 0, -radius * 1.35);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.32)";
  ctx.lineWidth = 1.1;
  ctx.stroke();

  ctx.fillStyle = "rgba(6, 17, 29, 0.48)";
  ctx.beginPath();
  ctx.ellipse(0, -radius * 0.46, radius * 0.24, radius * 0.48, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.42)";
  ctx.beginPath();
  ctx.ellipse(-radius * 0.05, -radius * 0.58, radius * 0.07, radius * 0.17, 0.15, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.fillRect(-radius * 0.7, -radius * 0.1, radius * 0.4, radius * 0.16);
  ctx.fillRect(radius * 0.3, -radius * 0.1, radius * 0.4, radius * 0.16);

  ctx.fillStyle = "rgba(10, 16, 32, 0.46)";
  ctx.beginPath();
  ctx.moveTo(-radius * 0.12, radius * 0.72);
  ctx.lineTo(-radius * 0.58, radius * 1.06);
  ctx.lineTo(-radius * 0.26, radius * 1.18);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(radius * 0.12, radius * 0.72);
  ctx.lineTo(radius * 0.58, radius * 1.06);
  ctx.lineTo(radius * 0.26, radius * 1.18);
  ctx.closePath();
  ctx.fill();
}

function drawBullets() {
  ctx.save();
  ctx.shadowBlur = 12;
  ctx.shadowColor = "#56d8ff";
  ctx.fillStyle = "#b9f3ff";
  bullets.forEach((bullet) => {
    ctx.beginPath();
    ctx.roundRect(bullet.x - 3, bullet.y - 13, 6, 18, 4);
    ctx.fill();
  });

  ctx.shadowColor = "#ff5a7a";
  ctx.fillStyle = "#ff8ea3";
  enemyBullets.forEach((bullet) => {
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawPowerups() {
  powerups.forEach((item) => {
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.spin);
    ctx.shadowBlur = 14;
    ctx.shadowColor = item.kind === "heal" ? "#7df59a" : "#ffd166";
    ctx.fillStyle = item.kind === "heal" ? "#7df59a" : "#ffd166";
    ctx.beginPath();
    ctx.roundRect(-14, -14, 28, 28, 7);
    ctx.fill();
    ctx.fillStyle = "#07111f";
    ctx.font = "800 18px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(item.kind === "heal" ? "+" : "P", 0, 1);
    ctx.restore();
  });
}

function drawParticles() {
  particles.forEach((particle) => {
    const alpha = clamp(particle.life / particle.maxLife, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawEmpEffects() {
  empWaves.forEach((wave) => {
    const alpha = clamp(wave.life / wave.maxLife, 0, 1);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineWidth = 10 * alpha;
    ctx.strokeStyle = `rgba(159, 252, 255, ${0.82 * alpha})`;
    ctx.shadowBlur = 28;
    ctx.shadowColor = "#56d8ff";
    ctx.beginPath();
    ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = 2;
    ctx.strokeStyle = `rgba(255, 209, 102, ${0.62 * alpha})`;
    ctx.beginPath();
    ctx.arc(wave.x, wave.y, wave.radius * 0.72, 0, Math.PI * 2);
    ctx.stroke();

    const pulse = ctx.createRadialGradient(wave.x, wave.y, 0, wave.x, wave.y, wave.radius);
    pulse.addColorStop(0, `rgba(159, 252, 255, ${0.2 * alpha})`);
    pulse.addColorStop(0.45, `rgba(86, 216, 255, ${0.08 * alpha})`);
    pulse.addColorStop(1, "rgba(86, 216, 255, 0)");
    ctx.fillStyle = pulse;
    ctx.beginPath();
    ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  lightningBolts.forEach((bolt) => {
    const alpha = clamp(bolt.life / bolt.maxLife, 0, 1);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowBlur = 22;
    ctx.shadowColor = bolt.color;

    ctx.strokeStyle = `rgba(86, 216, 255, ${0.28 * alpha})`;
    ctx.lineWidth = bolt.width * 3.1;
    strokeLightning(bolt.points);

    ctx.strokeStyle = `rgba(247, 251, 255, ${0.9 * alpha})`;
    ctx.lineWidth = bolt.width;
    strokeLightning(bolt.points);

    ctx.strokeStyle = `rgba(255, 209, 102, ${0.6 * alpha})`;
    ctx.lineWidth = Math.max(1, bolt.width * 0.42);
    strokeLightning(bolt.points);
    ctx.restore();
  });
}

function strokeLightning(points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
}

function drawFloatingTexts() {
  floatingTexts.forEach((item) => {
    ctx.globalAlpha = clamp(item.life / 0.8, 0, 1);
    ctx.fillStyle = item.color;
    ctx.font = "800 18px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(item.text, item.x, item.y);
  });
  ctx.globalAlpha = 1;
}

function loop(timestamp) {
  const dt = Math.min(0.033, (timestamp - lastTime) / 1000 || 0);
  lastTime = timestamp;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
  };
}

window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  if (event.code === "Space") togglePause();
  if (event.code === "KeyX" || event.code === "ShiftLeft" || event.code === "ShiftRight") {
    releaseEmp();
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

canvas.addEventListener("pointerdown", (event) => {
  pointer.active = true;
  Object.assign(pointer, canvasPoint(event));
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
  if (!pointer.active) return;
  Object.assign(pointer, canvasPoint(event));
});

canvas.addEventListener("pointerup", () => {
  pointer.active = false;
});

canvas.addEventListener("pointercancel", () => {
  pointer.active = false;
});

function togglePause() {
  if (state === "playing") {
    state = "paused";
    pauseButton.textContent = "▶";
  } else if (state === "paused") {
    state = "playing";
    pauseButton.textContent = "Ⅱ";
    lastTime = performance.now();
  }
}

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);
pauseButton.addEventListener("click", togglePause);
skillButton.addEventListener("click", releaseEmp);

resetStars();
updateHud();
bestScoreNode.textContent = bestScore;
requestAnimationFrame(loop);
