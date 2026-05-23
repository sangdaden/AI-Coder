/* global THREE */

function showLoadError() {
  const err = document.getElementById("load-error");
  if (err) err.hidden = false;
}

function initGame() {
const ARENA_SIZE = 40;
const WALL_HEIGHT = 6;
const PLAYER_SPEED = 14;
const TURN_SPEED = 2.4;
const PLAYER_MAX_HP = 100;
const ENEMY_MAX_HP = 130;
const PLAYER_SHOT_DAMAGE = 16;
const ENEMY_SHOT_DAMAGE = 24;
const FIRE_COOLDOWN = 0.38;
const ENEMY_FIRE_COOLDOWN = 0.48;
const ENEMY_BURST_COOLDOWN = 0.22;
const ENEMY_SPEED = 10.5;
const ENEMY_STRAFE_SPEED = 6;
const ENEMY_SIGHT_RANGE = 38;
const ENEMY_SHOOT_RANGE = 30;
const ENEMY_AIM_SPREAD = 0.12;
const ENEMY_CHASE_MIN_DIST = 3.5;

const canvas = document.getElementById("game");
const overlay = document.getElementById("overlay");
const hud = document.getElementById("hud");
const startBtn = document.getElementById("start-btn");
const playerHpEl = document.getElementById("player-hp");
const enemyHpEl = document.getElementById("enemy-hp");
const playerHpText = document.getElementById("player-hp-text");
const enemyHpText = document.getElementById("enemy-hp-text");
const weaponStatusEl = document.getElementById("weapon-status");
const reloadFillEl = document.getElementById("reload-fill");
const matchTimerEl = document.getElementById("match-timer");
const enemyAlertEl = document.getElementById("enemy-alert");
const enemyStateEl = document.getElementById("enemy-state");
const enemyRangeEl = document.getElementById("enemy-range");
const hitsCountEl = document.getElementById("hits-count");
const hitMarkerEl = document.getElementById("hit-marker");
const damageVignetteEl = document.getElementById("damage-vignette");
const messageEl = document.getElementById("message");
const minimapCanvas = document.getElementById("minimap");
const minimapCtx = minimapCanvas ? minimapCanvas.getContext("2d") : null;

const keys = { up: false, down: false, left: false, right: false, space: false };
let spacePressed = false;
let gameActive = false;
let gameOver = false;
let matchTime = 0;
let hitsLanded = 0;
let damageFlash = 0;
let hitMarkerFlash = 0;
let enemyStrafeDir = 1;
let enemyStrafeTimer = 0;
let enemyBurstShots = 0;

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c1018);
scene.fog = new THREE.Fog(0x0c1018, 25, 55);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  120
);
camera.position.set(0, 1.7, ARENA_SIZE * 0.35);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const ambient = new THREE.AmbientLight(0x404868, 0.55);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xfff0d8, 1.1);
sun.position.set(12, 24, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 60;
sun.shadow.camera.left = -30;
sun.shadow.camera.right = 30;
sun.shadow.camera.top = 30;
sun.shadow.camera.bottom = -30;
scene.add(sun);

const floorGeo = new THREE.PlaneGeometry(ARENA_SIZE, ARENA_SIZE);
const floorMat = new THREE.MeshStandardMaterial({
  color: 0x1a2438,
  roughness: 0.85,
  metalness: 0.15,
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(ARENA_SIZE, 20, 0x2a4060, 0x1a2a40);
grid.position.y = 0.02;
scene.add(grid);

const wallMat = new THREE.MeshStandardMaterial({
  color: 0x2a3850,
  roughness: 0.7,
  metalness: 0.2,
});
const accentMat = new THREE.MeshStandardMaterial({
  color: 0x4a6898,
  emissive: 0x1a2840,
  roughness: 0.5,
});

const obstacles = [];
const half = ARENA_SIZE / 2 - 0.5;

function addWall(x, z, w, d) {
  const geo = new THREE.BoxGeometry(w, WALL_HEIGHT, d);
  const mesh = new THREE.Mesh(geo, wallMat);
  mesh.position.set(x, WALL_HEIGHT / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  obstacles.push(mesh);

  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.1, 0.3, d + 0.1),
    accentMat
  );
  trim.position.set(x, WALL_HEIGHT, z);
  scene.add(trim);
}

addWall(0, -half, ARENA_SIZE, 1);
addWall(0, half, ARENA_SIZE, 1);
addWall(-half, 0, 1, ARENA_SIZE);
addWall(half, 0, 1, ARENA_SIZE);

addWall(-8, -8, 6, 2);
addWall(8, 8, 2, 6);
addWall(-10, 10, 4, 4);
addWall(10, -6, 5, 3);
addWall(0, 0, 3, 8);

const pillars = [
  [-12, 12],
  [12, -12],
  [-12, -12],
  [12, 12],
];
for (const [x, z] of pillars) {
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.4, WALL_HEIGHT, 8),
    accentMat
  );
  pillar.position.set(x, WALL_HEIGHT / 2, z);
  pillar.castShadow = true;
  pillar.receiveShadow = true;
  scene.add(pillar);
  obstacles.push(pillar);
}

const gunGroup = new THREE.Group();
const gunBody = new THREE.Mesh(
  new THREE.BoxGeometry(0.12, 0.12, 0.5),
  new THREE.MeshStandardMaterial({ color: 0x333840, metalness: 0.8, roughness: 0.3 })
);
gunBody.position.set(0.22, -0.18, -0.35);
const gunBarrel = new THREE.Mesh(
  new THREE.CylinderGeometry(0.04, 0.04, 0.35, 8),
  new THREE.MeshStandardMaterial({ color: 0x1a1e24, metalness: 0.9, roughness: 0.2 })
);
gunBarrel.rotation.x = Math.PI / 2;
gunBarrel.position.set(0.22, -0.16, -0.62);
gunGroup.add(gunBody, gunBarrel);
camera.add(gunGroup);
scene.add(camera);

let playerHp = PLAYER_MAX_HP;
let playerCooldown = 0;
let yaw = 0;

function buildEnemyBot() {
  const bot = new THREE.Group();
  const hitParts = [];

  const suitMat = new THREE.MeshStandardMaterial({
    color: 0x1a1014,
    roughness: 0.9,
    metalness: 0.05,
  });
  const armorMat = new THREE.MeshStandardMaterial({
    color: 0x3a4458,
    roughness: 0.32,
    metalness: 0.88,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xdd3311,
    emissive: 0x661100,
    emissiveIntensity: 0.85,
    roughness: 0.45,
    metalness: 0.35,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x060a10,
    roughness: 0.15,
    metalness: 0.95,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xff2244,
    emissive: 0xff0022,
    emissiveIntensity: 2.2,
  });
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x14181e,
    metalness: 0.95,
    roughness: 0.12,
  });

  function part(mesh, hittable = false) {
    mesh.castShadow = true;
    if (hittable) hitParts.push(mesh);
    return mesh;
  }

  const enemyBody = part(
    new THREE.Mesh(new THREE.CapsuleGeometry(0.48, 0.95, 6, 12), suitMat),
    true
  );
  enemyBody.position.y = 1.02;

  const chestPlate = part(
    new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.78, 0.48), armorMat),
    true
  );
  chestPlate.position.set(0, 1.38, 0.06);

  const chestMark = part(
    new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.06), accentMat)
  );
  chestMark.position.set(0, 1.42, 0.32);

  const belt = part(new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.14, 0.5), armorMat));
  belt.position.set(0, 0.92, 0.04);

  const enemyHead = part(
    new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.58, 0.78), armorMat),
    true
  );
  enemyHead.position.y = 2.18;

  const helmetRidge = part(
    new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.88), accentMat)
  );
  helmetRidge.position.set(0, 2.48, 0);

  const jawGuard = part(
    new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.18, 0.5), armorMat)
  );
  jawGuard.position.set(0, 1.92, 0.12);

  const visor = part(new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.2, 0.1), visorMat));
  visor.position.set(0, 2.12, 0.4);

  const eyeL = part(new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), eyeMat));
  eyeL.position.set(-0.17, 2.12, 0.38);
  const eyeR = part(new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), eyeMat));
  eyeR.position.set(0.17, 2.12, 0.38);

  const pauldronGeo = new THREE.BoxGeometry(0.38, 0.3, 0.44);
  const pauldronL = part(new THREE.Mesh(pauldronGeo, armorMat));
  pauldronL.position.set(-0.64, 1.75, 0);
  pauldronL.rotation.z = 0.22;
  const pauldronR = part(new THREE.Mesh(pauldronGeo, armorMat));
  pauldronR.position.set(0.64, 1.75, 0);
  pauldronR.rotation.z = -0.22;

  const stripeL = part(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.24, 0.46), accentMat));
  stripeL.position.set(-0.64, 1.75, 0.04);
  const stripeR = part(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.24, 0.46), accentMat));
  stripeR.position.set(0.64, 1.75, 0.04);

  const legL = part(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.68, 0.34), suitMat));
  legL.position.set(-0.24, 0.4, 0);
  const legR = part(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.68, 0.34), suitMat));
  legR.position.set(0.24, 0.4, 0);

  const bootL = part(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.42), armorMat));
  bootL.position.set(-0.24, 0.11, 0.05);
  const bootR = part(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.42), armorMat));
  bootR.position.set(0.24, 0.11, 0.05);

  const backpack = part(new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.72, 0.38), armorMat));
  backpack.position.set(0, 1.32, -0.38);

  const tankL = part(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.45, 8), accentMat));
  tankL.rotation.x = Math.PI / 2;
  tankL.position.set(-0.18, 1.35, -0.52);
  const tankR = part(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.45, 8), accentMat));
  tankR.rotation.x = Math.PI / 2;
  tankR.position.set(0.18, 1.35, -0.52);

  const antenna = part(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 6), accentMat));
  antenna.position.set(0, 1.92, -0.58);
  const antennaTip = part(new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), eyeMat));
  antennaTip.position.set(0, 2.22, -0.58);

  const rifle = new THREE.Group();
  const rifleBody = part(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.14, 0.58), darkMetalMat));
  const rifleBarrel = part(
    new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.5, 8), darkMetalMat)
  );
  rifleBarrel.rotation.x = Math.PI / 2;
  rifleBarrel.position.set(0, 0.03, 0.48);
  const rifleGrip = part(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.2, 0.11), suitMat));
  rifleGrip.position.set(0, -0.14, -0.06);
  const rifleSight = part(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.1), accentMat));
  rifleSight.position.set(0, 0.12, 0.08);
  const rifleMuzzle = part(new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), accentMat));
  rifleMuzzle.position.set(0, 0.03, 0.76);
  rifle.add(rifleBody, rifleBarrel, rifleGrip, rifleSight, rifleMuzzle);
  rifle.position.set(0.45, 1.22, 0.38);
  rifle.rotation.y = -0.2;

  const enemyTarget = new THREE.Object3D();
  enemyTarget.position.y = 1.5;

  bot.add(
    enemyBody,
    chestPlate,
    chestMark,
    belt,
    enemyHead,
    helmetRidge,
    jawGuard,
    visor,
    eyeL,
    eyeR,
    pauldronL,
    pauldronR,
    stripeL,
    stripeR,
    legL,
    legR,
    bootL,
    bootR,
    backpack,
    tankL,
    tankR,
    antenna,
    antennaTip,
    rifle,
    enemyTarget
  );

  return {
    enemy: bot,
    enemyBody,
    enemyHead,
    enemyTarget,
    rifle,
    hitParts,
    eyeL,
    eyeR,
    antennaTip,
  };
}

const enemyBot = buildEnemyBot();
const enemy = enemyBot.enemy;
const enemyBody = enemyBot.enemyBody;
const enemyHead = enemyBot.enemyHead;
const enemyTarget = enemyBot.enemyTarget;
const enemyRifle = enemyBot.rifle;
const enemyHitParts = enemyBot.hitParts;
const enemyGlowParts = [enemyBot.eyeL, enemyBot.eyeR, enemyBot.antennaTip];
enemy.position.set(0, 0, -ARENA_SIZE * 0.3);
scene.add(enemy);

let enemyHp = ENEMY_MAX_HP;
let enemyCooldown = 0;
let enemyState = "patrol";
let patrolAngle = 0;
let enemyYaw = 0;
const lastKnownPlayerPos = new THREE.Vector3();
let huntTimer = 0;

const muzzleFlashGeo = new THREE.SphereGeometry(0.15, 8, 8);
const muzzleFlashMat = new THREE.MeshBasicMaterial({
  color: 0xffee88,
  transparent: true,
  opacity: 0,
});
const muzzleFlash = new THREE.Mesh(muzzleFlashGeo, muzzleFlashMat);
muzzleFlash.position.set(0.22, -0.16, -0.75);
gunGroup.add(muzzleFlash);

const tracerMat = new THREE.LineBasicMaterial({
  color: 0xffee66,
  transparent: true,
  opacity: 0.85,
});
const tracers = [];

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function updateHpBars() {
  const playerPct = (playerHp / PLAYER_MAX_HP) * 100;
  const enemyPct = (enemyHp / ENEMY_MAX_HP) * 100;
  playerHpEl.style.width = `${playerPct}%`;
  enemyHpEl.style.width = `${enemyPct}%`;
  if (playerHpText) {
    playerHpText.textContent = `${Math.ceil(playerHp)} / ${PLAYER_MAX_HP}`;
  }
  if (enemyHpText) {
    enemyHpText.textContent = `${Math.ceil(enemyHp)} / ${ENEMY_MAX_HP}`;
  }
  playerHpEl.classList.toggle("low", playerPct <= 30);
  enemyHpEl.classList.toggle("low", enemyPct <= 30);
}

function updateWeaponHud() {
  if (!reloadFillEl || !weaponStatusEl) return;
  const ready = playerCooldown <= 0;
  const pct = ready ? 1 : 1 - playerCooldown / FIRE_COOLDOWN;
  reloadFillEl.style.transform = `scaleX(${pct})`;
  reloadFillEl.classList.toggle("cooling", !ready);
  weaponStatusEl.textContent = ready ? "READY — SPACE" : "RELOADING…";
  weaponStatusEl.classList.toggle("ready", ready);
  weaponStatusEl.classList.toggle("cooling", !ready);
}

function setEnemyStateLabel(state) {
  if (!enemyStateEl) return;
  const labels = {
    patrol: "SCANNING",
    engage: "ENGAGING",
    hunt: "HUNTING",
    fire: "FIRING",
  };
  enemyStateEl.textContent = labels[state] || "SCANNING";
  enemyStateEl.className = "pill-value";
  if (state === "patrol") enemyStateEl.classList.add("state-scan");
  else if (state === "hunt") enemyStateEl.classList.add("state-hunt");
  else enemyStateEl.classList.add("state-fire");
}

function showHitMarker() {
  hitMarkerFlash = 0.22;
  if (hitMarkerEl) {
    hitMarkerEl.classList.remove("show");
    void hitMarkerEl.offsetWidth;
    hitMarkerEl.classList.add("show");
  }
}

function flashPlayerDamage() {
  damageFlash = 0.35;
  if (damageVignetteEl) damageVignetteEl.classList.add("hit");
}

function drawMinimap() {
  if (!minimapCtx || !minimapCanvas) return;
  const size = minimapCanvas.width;
  const halfSize = size / 2;
  const scale = size / ARENA_SIZE;

  minimapCtx.fillStyle = "rgba(6, 10, 18, 0.92)";
  minimapCtx.fillRect(0, 0, size, size);

  minimapCtx.strokeStyle = "rgba(80, 120, 180, 0.35)";
  minimapCtx.lineWidth = 1;
  minimapCtx.strokeRect(4, 4, size - 8, size - 8);

  minimapCtx.fillStyle = "rgba(60, 90, 130, 0.25)";
  for (const box of obstacles) {
    const bx = halfSize + box.position.x * scale;
    const bz = halfSize + box.position.z * scale;
    minimapCtx.fillRect(bx - 3, bz - 3, 6, 6);
  }

  const ex = halfSize + enemy.position.x * scale;
  const ez = halfSize + enemy.position.z * scale;
  minimapCtx.fillStyle = "#ff5544";
  minimapCtx.beginPath();
  minimapCtx.arc(ex, ez, 5, 0, Math.PI * 2);
  minimapCtx.fill();

  const px = halfSize + camera.position.x * scale;
  const pz = halfSize + camera.position.z * scale;
  minimapCtx.fillStyle = "#6ef0a8";
  minimapCtx.beginPath();
  minimapCtx.arc(px, pz, 4, 0, Math.PI * 2);
  minimapCtx.fill();

  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  minimapCtx.strokeStyle = "#6ef0a8";
  minimapCtx.lineWidth = 2;
  minimapCtx.beginPath();
  minimapCtx.moveTo(px, pz);
  minimapCtx.lineTo(px - dir.x * 10, pz - dir.z * 10);
  minimapCtx.stroke();
}

function updateHud(dt) {
  updateWeaponHud();

  if (matchTimerEl && gameActive && !gameOver) {
    matchTimerEl.textContent = formatTime(matchTime);
  }

  if (hitsCountEl) hitsCountEl.textContent = String(hitsLanded);

  const dist = camera.position.distanceTo(enemy.position);
  if (enemyRangeEl) {
    enemyRangeEl.textContent = gameActive ? `${Math.round(dist)}m` : "—";
  }

  const eyeFrom = enemy.position.clone();
  eyeFrom.y = 1.5;
  const eyeTo = camera.position.clone();
  eyeTo.y = 1.5;
  const canSee =
    dist < ENEMY_SIGHT_RANGE && lineOfSight(eyeFrom, eyeTo);

  if (enemyAlertEl) {
    enemyAlertEl.classList.toggle("hidden", !canSee || !gameActive || gameOver);
  }

  if (enemyStateEl && gameActive) {
    if (enemyCooldown > ENEMY_FIRE_COOLDOWN - 0.15) setEnemyStateLabel("fire");
    else if (enemyState === "engage") setEnemyStateLabel("engage");
    else if (enemyState === "hunt") setEnemyStateLabel("hunt");
    else setEnemyStateLabel("patrol");
  }

  if (damageFlash > 0) {
    damageFlash -= dt;
    if (damageFlash <= 0 && damageVignetteEl) {
      damageVignetteEl.classList.remove("hit");
    }
  }

  if (hitMarkerFlash > 0) hitMarkerFlash -= dt;

  drawMinimap();
}

function showMessage(text, className) {
  messageEl.textContent = text;
  messageEl.className = `show ${className}`;
}

function hideMessage() {
  messageEl.className = "";
  messageEl.textContent = "";
}

function resetGame() {
  playerHp = PLAYER_MAX_HP;
  enemyHp = ENEMY_MAX_HP;
  playerCooldown = 0;
  enemyCooldown = 0;
  gameOver = false;
  matchTime = 0;
  hitsLanded = 0;
  damageFlash = 0;
  enemyStrafeDir = 1;
  enemyStrafeTimer = 0;
  enemyBurstShots = 0;
  yaw = 0;
  camera.position.set(0, 1.7, ARENA_SIZE * 0.35);
  camera.rotation.set(0, 0, 0);
  enemy.position.set(0, 0, -ARENA_SIZE * 0.3);
  enemyState = "patrol";
  patrolAngle = 0;
  hideMessage();
  updateHpBars();
  updateWeaponHud();
  setEnemyStateLabel("patrol");
  if (damageVignetteEl) damageVignetteEl.classList.remove("hit");
  if (enemyAlertEl) enemyAlertEl.classList.add("hidden");
  if (matchTimerEl) matchTimerEl.textContent = "00:00";
  if (hitsCountEl) hitsCountEl.textContent = "0";
}

function endGame(won) {
  gameOver = true;
  showMessage(won ? "Victory!" : "Defeated", won ? "win" : "lose");
  setTimeout(() => {
    overlay.classList.remove("hidden");
    hud.classList.add("hidden");
    gameActive = false;
    resetGame();
  }, 2500);
}

function clampToArena(pos, radius = 0.6) {
  const limit = half - radius;
  pos.x = THREE.MathUtils.clamp(pos.x, -limit, limit);
  pos.z = THREE.MathUtils.clamp(pos.z, -limit, limit);
}

function collidesCircle(x, z, r) {
  for (const box of obstacles) {
    box.geometry.computeBoundingBox();
    const b = box.geometry.boundingBox.clone();
    b.applyMatrix4(box.matrixWorld);
    const closestX = THREE.MathUtils.clamp(x, b.min.x, b.max.x);
    const closestZ = THREE.MathUtils.clamp(z, b.min.z, b.max.z);
    const dx = x - closestX;
    const dz = z - closestZ;
    if (dx * dx + dz * dz < r * r) return true;
  }
  return false;
}

function moveWithCollision(pos, dx, dz, radius = 0.5) {
  const nextX = pos.x + dx;
  const nextZ = pos.z + dz;
  if (!collidesCircle(nextX, pos.z, radius)) pos.x = nextX;
  if (!collidesCircle(pos.x, nextZ, radius)) pos.z = nextZ;
  clampToArena(pos, radius);
}

function spawnTracer(from, to, color = 0xffee66) {
  const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
  const mat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.9,
  });
  const line = new THREE.Line(geo, mat);
  scene.add(line);
  tracers.push({ line, life: 0.08 });
}

function updateTracers(dt) {
  for (let i = tracers.length - 1; i >= 0; i--) {
    tracers[i].life -= dt;
    if (tracers[i].life <= 0) {
      scene.remove(tracers[i].line);
      tracers[i].line.geometry.dispose();
      tracers[i].line.material.dispose();
      tracers.splice(i, 1);
    }
  }
}

function flashMuzzle() {
  muzzleFlashMat.opacity = 1;
  setTimeout(() => {
    muzzleFlashMat.opacity = 0;
  }, 50);
}

let enemyHitFlash = 0;

function flashEnemyHit() {
  enemyHitFlash = 0.2;
}

function updateEnemyVisuals(dt, time) {
  if (enemyHitFlash > 0) enemyHitFlash -= dt;

  const engaged = enemyState === "engage";
  const hitBoost = enemyHitFlash > 0 ? 2.5 : 1;
  const pulse = (1.4 + Math.sin(time * 6) * 0.6) * hitBoost * (engaged ? 1.25 : 1);

  for (const eye of enemyGlowParts) {
    if (eye.material) eye.material.emissiveIntensity = pulse;
  }

  const bob = gameActive && !gameOver ? Math.sin(time * 3) * 0.04 : 0;
  enemy.position.y = bob;
}

function playerShoot() {
  if (playerCooldown > 0 || gameOver) return;

  playerCooldown = FIRE_COOLDOWN;
  updateWeaponHud();
  flashMuzzle();

  const origin = new THREE.Vector3();
  camera.getWorldPosition(origin);
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);

  raycaster.set(origin, dir);
  const hits = raycaster.intersectObjects([...enemyHitParts, ...obstacles], false);

  let end = origin.clone().add(dir.multiplyScalar(50));
  if (hits.length > 0) {
    end = hits[0].point.clone();
    if (enemyHitParts.includes(hits[0].object)) {
      enemyHp = Math.max(0, enemyHp - PLAYER_SHOT_DAMAGE);
      hitsLanded += 1;
      updateHpBars();
      flashEnemyHit();
      showHitMarker();
      if (enemyHp <= 0) endGame(true);
    }
  }

  const muzzle = new THREE.Vector3(0.22, -0.16, -0.75);
  muzzle.applyMatrix4(gunGroup.matrixWorld);
  spawnTracer(muzzle, end);

  gunGroup.position.z = 0.06;
  setTimeout(() => {
    gunGroup.position.z = 0;
  }, 60);
}

function enemyShoot() {
  if (enemyCooldown > 0 || gameOver) return;

  enemyBurstShots += 1;
  enemyCooldown =
    enemyBurstShots < 2 && Math.random() < 0.55
      ? ENEMY_BURST_COOLDOWN
      : ENEMY_FIRE_COOLDOWN;
  if (enemyBurstShots >= 2) enemyBurstShots = 0;

  const origin = enemyTarget.getWorldPosition(new THREE.Vector3());
  const target = camera.position.clone();
  target.y = 1.5;
  target.x += (Math.random() - 0.5) * ENEMY_AIM_SPREAD;
  target.y += (Math.random() - 0.5) * ENEMY_AIM_SPREAD * 0.5;
  target.z += (Math.random() - 0.5) * ENEMY_AIM_SPREAD;
  const dir = target.clone().sub(origin).normalize();

  raycaster.set(origin, dir);
  const hits = raycaster.intersectObjects(obstacles, false);

  let end = origin.clone().add(dir.clone().multiplyScalar(40));
  let hitPlayer = true;

  if (hits.length > 0 && hits[0].distance < origin.distanceTo(target)) {
    end = hits[0].point.clone();
    hitPlayer = false;
  }

  spawnTracer(origin, end, 0xff6644);

  enemyRifle.position.z = 0.48;
  setTimeout(() => {
    enemyRifle.position.z = 0.38;
  }, 80);

  if (hitPlayer) {
    playerHp = Math.max(0, playerHp - ENEMY_SHOT_DAMAGE);
    updateHpBars();
    flashPlayerDamage();
    if (playerHp <= 0) endGame(false);
  }
}

function lineOfSight(from, to) {
  const dir = to.clone().sub(from).normalize();
  const dist = from.distanceTo(to);
  raycaster.set(from, dir);
  const hits = raycaster.intersectObjects(obstacles, false);
  return hits.length === 0 || hits[0].distance > dist - 0.5;
}

function updateEnemy(dt) {
  if (gameOver) return;

  const playerPos = camera.position;
  const enemyPos = enemy.position;
  const toPlayer = new THREE.Vector3().subVectors(playerPos, enemyPos);
  toPlayer.y = 0;
  const dist = toPlayer.length();

  const eyeFrom = enemyPos.clone();
  eyeFrom.y = 1.5;
  const eyeTo = playerPos.clone();
  eyeTo.y = 1.5;
  const canSee = dist < ENEMY_SIGHT_RANGE && lineOfSight(eyeFrom, eyeTo);

  if (canSee) {
    enemyState = "engage";
    huntTimer = 4;
    lastKnownPlayerPos.copy(playerPos);

    enemyYaw = Math.atan2(toPlayer.x, toPlayer.z);
    enemy.rotation.y = enemyYaw;

    const toNorm = toPlayer.clone().normalize();
    const strafe = new THREE.Vector3(-toNorm.z, 0, toNorm.x).multiplyScalar(
      enemyStrafeDir
    );

    enemyStrafeTimer -= dt;
    if (enemyStrafeTimer <= 0) {
      enemyStrafeDir *= Math.random() < 0.5 ? -1 : 1;
      enemyStrafeTimer = 0.8 + Math.random() * 1.2;
    }

    if (dist > ENEMY_CHASE_MIN_DIST) {
      const chase = toNorm.clone().multiplyScalar(ENEMY_SPEED * dt);
      moveWithCollision(enemyPos, chase.x, chase.z, 0.55);
    }

    const strafeMove = strafe.multiplyScalar(ENEMY_STRAFE_SPEED * dt);
    moveWithCollision(enemyPos, strafeMove.x, strafeMove.z, 0.55);

    if (dist < ENEMY_SHOOT_RANGE && enemyCooldown <= 0) {
      enemyShoot();
    }
  } else if (huntTimer > 0) {
    enemyState = "hunt";
    huntTimer -= dt;
    const toLast = new THREE.Vector3().subVectors(lastKnownPlayerPos, enemyPos);
    toLast.y = 0;
    if (toLast.length() > 1.5) {
      enemyYaw = Math.atan2(toLast.x, toLast.z);
      enemy.rotation.y = enemyYaw;
      const huntMove = toLast.normalize().multiplyScalar(ENEMY_SPEED * 1.1 * dt);
      moveWithCollision(enemyPos, huntMove.x, huntMove.z, 0.55);
    }
    if (
      toLast.length() < ENEMY_SHOOT_RANGE &&
      enemyCooldown <= 0 &&
      lineOfSight(eyeFrom, eyeTo)
    ) {
      enemyShoot();
    }
  } else {
    enemyState = "patrol";
    patrolAngle += dt * 1.1;
    enemyYaw = patrolAngle;
    enemy.rotation.y = enemyYaw;
    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), enemyYaw);
    const move = forward.multiplyScalar(ENEMY_SPEED * 0.75 * dt);
    moveWithCollision(enemyPos, move.x, move.z, 0.55);

    const toCenter = new THREE.Vector3(-enemyPos.x, 0, -enemyPos.z);
    if (toCenter.length() > 8) {
      const centerPull = toCenter.normalize().multiplyScalar(ENEMY_SPEED * 0.3 * dt);
      moveWithCollision(enemyPos, centerPull.x, centerPull.z, 0.55);
    }

    if (Math.random() < 0.006) patrolAngle += (Math.random() - 0.5) * 2.5;
  }
}

function updatePlayer(dt) {
  if (gameOver) return;

  if (keys.left) yaw += TURN_SPEED * dt;
  if (keys.right) yaw -= TURN_SPEED * dt;
  camera.rotation.y = yaw;

  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  let moveX = 0;
  let moveZ = 0;

  if (keys.up) {
    moveX += forward.x * PLAYER_SPEED * dt;
    moveZ += forward.z * PLAYER_SPEED * dt;
  }
  if (keys.down) {
    moveX -= forward.x * PLAYER_SPEED * dt;
    moveZ -= forward.z * PLAYER_SPEED * dt;
  }

  moveWithCollision(camera.position, moveX, moveZ, 0.45);

  if (keys.space && !spacePressed) {
    spacePressed = true;
    playerShoot();
  }
  if (!keys.space) spacePressed = false;

  if (playerCooldown > 0) playerCooldown -= dt;
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (gameActive && !gameOver) {
    matchTime += dt;
    updatePlayer(dt);
    updateEnemy(dt);
    if (enemyCooldown > 0) enemyCooldown -= dt;
  }

  updateTracers(dt);
  updateEnemyVisuals(dt, clock.elapsedTime);
  if (gameActive) updateHud(dt);

  const breathe = Math.sin(clock.elapsedTime * 2) * 0.008;
  gunGroup.position.y = -0.18 + breathe;

  renderer.render(scene, camera);
}

window.addEventListener("keydown", (e) => {
  switch (e.code) {
    case "ArrowUp":
      keys.up = true;
      e.preventDefault();
      break;
    case "ArrowDown":
      keys.down = true;
      e.preventDefault();
      break;
    case "ArrowLeft":
      keys.left = true;
      e.preventDefault();
      break;
    case "ArrowRight":
      keys.right = true;
      e.preventDefault();
      break;
    case "Space":
      keys.space = true;
      e.preventDefault();
      break;
    default:
      break;
  }
});

window.addEventListener("keyup", (e) => {
  switch (e.code) {
    case "ArrowUp":
      keys.up = false;
      break;
    case "ArrowDown":
      keys.down = false;
      break;
    case "ArrowLeft":
      keys.left = false;
      break;
    case "ArrowRight":
      keys.right = false;
      break;
    case "Space":
      keys.space = false;
      spacePressed = false;
      break;
    default:
      break;
  }
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function startGame() {
  overlay.classList.add("hidden");
  hud.classList.remove("hidden");
  resetGame();
  gameActive = true;
  clock.getDelta();
}

if (startBtn) {
  startBtn.addEventListener("click", startGame);
}
updateHpBars();
animate();

}

if (typeof THREE === "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", showLoadError);
  } else {
    showLoadError();
  }
} else {
  initGame();
}
