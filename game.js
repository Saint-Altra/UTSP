/* ═══════════════════════════════════════════════════════════
   PORTFOLIO WORLD — game.js
   Handles: loading, game loop, tile map, player, NPCs,
            collision, interaction, camera, input (KB + touch)
═══════════════════════════════════════════════════════════ */

"use strict";

/* ─── Constants ─────────────────────────────────────────── */
const TILE   = 48;          // px per tile (world grid unit)
const SCALE  = 2;           // sprite render scale
const SPEED  = 2.8;         // player pixels/frame
const INTERACT_DIST = 64;   // px — how close to trigger prompt

/* ─── Canvas setup ──────────────────────────────────────── */
const canvas = document.getElementById("game-canvas");
const ctx    = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

/* ─── DOM refs ──────────────────────────────────────────── */
const loadingScreen   = document.getElementById("loading-screen");
const loadingBar      = document.getElementById("loading-bar");
const interactPrompt  = document.getElementById("interact-prompt");
const modalOverlay    = document.getElementById("modal-overlay");
const modalClose      = document.getElementById("modal-close");


/* ══════════════════════════════════════════════════════════
   TILE MAP
   0 = grass  1 = stone path  2 = wall/tree (solid)
   3 = flower  4 = water (solid)
   Edit this grid to redesign the level layout.
   Each row = one row of tiles; map is MAP_COLS × MAP_ROWS.
══════════════════════════════════════════════════════════ */
const MAP_COLS = 30;
const MAP_ROWS = 22;

// prettier-ignore
const TILE_MAP = [
  2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,
  2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,
  2,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,0,0,0,2,
  2,0,0,2,0,0,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,2,0,0,0,2,
  2,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,2,
  2,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,3,0,2,
  2,0,3,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,2,
  2,0,0,0,0,0,0,0,0,1,1,1,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,2,
  2,0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,2,
  2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,
  2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,
  2,0,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,0,2,
  2,0,0,0,0,0,0,0,0,1,1,1,1,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,2,
  2,0,0,0,2,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,2,0,0,0,0,0,2,
  2,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,2,
  2,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,3,0,0,2,
  2,0,0,0,0,0,3,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,2,
  2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,
  2,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,2,
  2,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,2,
  2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,
  2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,
];

/* Tile types that block movement */
const SOLID_TILES = new Set([2, 4]);


/* ══════════════════════════════════════════════════════════
   PROCEDURAL SPRITE RENDERER
   Draws pixel-art sprites onto offscreen canvases using
   simple color data — no external image files needed.
   Swap these out with real PNGs later if you want.
══════════════════════════════════════════════════════════ */

/**
 * Draw a 2-color pixel sprite from a bit-mask string.
 * '1' = primary color, '0' = transparent, '2' = secondary
 */
function makeSprite(w, h, pixels, c1, c2 = "transparent") {
  const oc  = document.createElement("canvas");
  oc.width  = w;
  oc.height = h;
  const ox  = oc.getContext("2d");
  ox.imageSmoothingEnabled = false;
  for (let i = 0; i < pixels.length; i++) {
    const ch = pixels[i];
    if (ch === "1") ox.fillStyle = c1;
    else if (ch === "2") ox.fillStyle = c2;
    else continue;
    ox.fillRect((i % w) * 1, Math.floor(i / w) * 1, 1, 1);
  }
  return oc;
}

/* ─── Player sprite (8×12, 2 frames per direction) ───────── */
// rows: head, body, legs — very minimal pixel silhouette
const PLAYER_PIXELS_DOWN = [
  "00011100",
  "00111110",
  "00111110",
  "00011100",
  "01111110",
  "11111111",
  "11111111",
  "01111110",
  "00100100",
  "00100100",
  "01100110",
  "01100110",
];
const PLAYER_PIXELS_UP = [
  "00011100",
  "00111110",
  "00111110",
  "00011100",
  "01111110",
  "11111111",
  "11111111",
  "01111110",
  "00100100",
  "00100100",
  "01100110",
  "01100110",
];

function buildPlayerSprites(bodyColor, skinColor) {
  const frames = {};
  const dirs = ["down","up","left","right"];
  dirs.forEach(d => {
    frames[d] = [
      makeSprite(8, 12, PLAYER_PIXELS_DOWN.join(""), bodyColor, skinColor),
      makeSprite(8, 12, PLAYER_PIXELS_DOWN.join(""), bodyColor, skinColor),
    ];
  });
  return frames;
}

/* ─── NPC sprite builder ─────────────────────────────────── */
function buildNpcSprite(color, hatColor) {
  // Simple 8×12 NPC silhouette with hat
  const pixels = [
    "01111110",
    "11111111",
    "11111111",
    "00111100",
    "00111100",
    "01111110",
    "11111111",
    "11111111",
    "01111110",
    "00100100",
    "01100110",
    "01100110",
  ].join("");
  return makeSprite(8, 12, pixels, color, hatColor);
}

/* ─── Tile sprites ────────────────────────────────────────── */
function buildTileSprites() {
  const grass = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = TILE;
    const x = c.getContext("2d");
    x.fillStyle = "#3a7d44";
    x.fillRect(0, 0, TILE, TILE);
    x.fillStyle = "#348a3e";
    for (let i = 0; i < 6; i++) {
      const gx = Math.floor(Math.random() * TILE);
      const gy = Math.floor(Math.random() * TILE);
      x.fillRect(gx, gy, 2, 3);
    }
    return c;
  })();

  const path = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = TILE;
    const x = c.getContext("2d");
    x.fillStyle = "#b8976a";
    x.fillRect(0, 0, TILE, TILE);
    x.fillStyle = "#a8875a";
    x.fillRect(1, 1, TILE - 2, TILE - 2);
    return c;
  })();

  const wall = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = TILE;
    const x = c.getContext("2d");
    // tree trunk
    x.fillStyle = "#5a3e28";
    x.fillRect(18, 30, 12, 18);
    // tree canopy
    x.fillStyle = "#2d6a4f";
    x.beginPath();
    x.arc(24, 22, 18, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = "#40916c";
    x.beginPath();
    x.arc(20, 18, 12, 0, Math.PI * 2);
    x.fill();
    return c;
  })();

  const flower = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = TILE;
    const x = c.getContext("2d");
    x.fillStyle = "#3a7d44";
    x.fillRect(0, 0, TILE, TILE);
    // petals
    const colors = ["#ff6b9d","#ffd166","#06d6a0","#a29bfe","#fd79a8"];
    const col = colors[Math.floor(Math.random() * colors.length)];
    x.fillStyle = col;
    x.beginPath();
    x.arc(24, 24, 6, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = "#fff";
    x.beginPath();
    x.arc(24, 24, 3, 0, Math.PI * 2);
    x.fill();
    return c;
  })();

  return { grass, path, wall, flower };
}


/* ══════════════════════════════════════════════════════════
   CAMERA
══════════════════════════════════════════════════════════ */
const camera = { x: 0, y: 0, w: 0, h: 0 };

function updateCamera(playerX, playerY) {
  const worldW = MAP_COLS * TILE;
  const worldH = MAP_ROWS * TILE;
  camera.x = Math.max(0, Math.min(playerX - camera.w / 2, worldW - camera.w));
  camera.y = Math.max(0, Math.min(playerY - camera.h / 2, worldH - camera.h));
}


/* ══════════════════════════════════════════════════════════
   PLAYER
══════════════════════════════════════════════════════════ */
const player = {
  x: 7 * TILE, y: 10 * TILE,   // world position (top-left of sprite)
  w: 8 * SCALE, h: 12 * SCALE,
  dir: "down",
  frame: 0,
  frameTimer: 0,
  sprites: null,
  moving: false,
};

function initPlayer() {
  player.sprites = buildPlayerSprites("#4f6ef7", "#f4c88f");
}

function movePlayer(dx, dy) {
  if (dx === 0 && dy === 0) { player.moving = false; return; }
  player.moving = true;

  // Direction
  if      (dy < 0) player.dir = "up";
  else if (dy > 0) player.dir = "down";
  else if (dx < 0) player.dir = "left";
  else             player.dir = "right";

  // Normalize diagonal
  if (dx !== 0 && dy !== 0) {
    dx *= 0.707;
    dy *= 0.707;
  }

  const nx = player.x + dx * SPEED;
  const ny = player.y + dy * SPEED;

  if (!collidesWithMap(nx, player.y, player.w, player.h)) player.x = nx;
  if (!collidesWithMap(player.x, ny, player.w, player.h)) player.y = ny;

  // Animate
  player.frameTimer++;
  if (player.frameTimer > 10) { player.frameTimer = 0; player.frame ^= 1; }
}

function drawPlayer() {
  const sprites = player.sprites[player.dir];
  const sprite  = sprites[player.frame];
  const sx = Math.round(player.x - camera.x);
  const sy = Math.round(player.y - camera.y);
  ctx.drawImage(sprite, sx, sy, player.w, player.h);

  // Name tag
  ctx.fillStyle    = "rgba(0,0,0,0.55)";
  ctx.fillRect(sx - 10, sy - 16, player.w + 20, 13);
  ctx.fillStyle    = "#fff";
  ctx.font         = "7px 'Press Start 2P'";
  ctx.textAlign    = "center";
  ctx.fillText("YOU", sx + player.w / 2, sy - 6);
}


/* ══════════════════════════════════════════════════════════
   COLLISION
══════════════════════════════════════════════════════════ */
function collidesWithMap(wx, wy, w, h) {
  const margin = 4;
  const corners = [
    { x: wx + margin,     y: wy + margin },
    { x: wx + w - margin, y: wy + margin },
    { x: wx + margin,     y: wy + h - margin },
    { x: wx + w - margin, y: wy + h - margin },
  ];
  return corners.some(({ x, y }) => {
    const col = Math.floor(x / TILE);
    const row = Math.floor(y / TILE);
    if (col < 0 || row < 0 || col >= MAP_COLS || row >= MAP_ROWS) return true;
    return SOLID_TILES.has(TILE_MAP[row * MAP_COLS + col]);
  });
}


/* ══════════════════════════════════════════════════════════
   TILEMAP RENDERING
══════════════════════════════════════════════════════════ */
let tileSprites = null;

function drawTileMap() {
  const startCol = Math.max(0, Math.floor(camera.x / TILE));
  const endCol   = Math.min(MAP_COLS, startCol + Math.ceil(camera.w / TILE) + 1);
  const startRow = Math.max(0, Math.floor(camera.y / TILE));
  const endRow   = Math.min(MAP_ROWS, startRow + Math.ceil(camera.h / TILE) + 1);

  for (let r = startRow; r < endRow; r++) {
    for (let c = startCol; c < endCol; c++) {
      const tile = TILE_MAP[r * MAP_COLS + c];
      const sx   = c * TILE - camera.x;
      const sy   = r * TILE - camera.y;
      let sprite;
      switch (tile) {
        case 1:  sprite = tileSprites.path;   break;
        case 2:  sprite = tileSprites.wall;   break;
        case 3:  sprite = tileSprites.flower; break;
        default: sprite = tileSprites.grass;  break;
      }
      ctx.drawImage(sprite, sx, sy, TILE, TILE);
    }
  }
}


/* ══════════════════════════════════════════════════════════
   NPCs
   Positions reference TILE_MAP above.
   id matches portfolio folder: portfolios/npc1, etc.
══════════════════════════════════════════════════════════ */
let NPC_LIST = [];

function initNpcs() {
  // Load from npc-config.js (window.NPC_CONFIG) if available
  if (window.NPC_CONFIG && Array.isArray(window.NPC_CONFIG)) {
    NPC_LIST = window.NPC_CONFIG.map(cfg => ({
      ...cfg,
      sprite: buildNpcSprite(cfg.color || "#e76f51", cfg.hatColor || "#264653"),
      w: 8 * SCALE,
      h: 12 * SCALE,
    }));
    return;
  }

  // Fallback: placeholder NPCs so the game isn't empty
  const defaults = [
    { id:"npc1", name:"Alex",    x:11*TILE, y:5*TILE,  color:"#e76f51", hatColor:"#264653" },
    { id:"npc2", name:"Jordan",  x:15*TILE, y:5*TILE,  color:"#2a9d8f", hatColor:"#e9c46a" },
    { id:"npc3", name:"Sam",     x:11*TILE, y:14*TILE, color:"#e9c46a", hatColor:"#e76f51" },
    { id:"npc4", name:"Casey",   x:15*TILE, y:14*TILE, color:"#a8dadc", hatColor:"#457b9d" },
    { id:"npc5", name:"Morgan",  x: 4*TILE, y: 9*TILE, color:"#f4a261", hatColor:"#2d6a4f" },
    { id:"npc6", name:"Riley",   x:24*TILE, y: 9*TILE, color:"#a29bfe", hatColor:"#6c5ce7" },
    { id:"npc7", name:"Quinn",   x: 4*TILE, y:16*TILE, color:"#fd79a8", hatColor:"#b2bec3" },
    { id:"npc8", name:"Avery",   x:24*TILE, y:16*TILE, color:"#55efc4", hatColor:"#00b894" },
  ];

  NPC_LIST = defaults.map(cfg => ({
    ...cfg,
    sprite: buildNpcSprite(cfg.color, cfg.hatColor),
    w: 8 * SCALE,
    h: 12 * SCALE,
    portfolioData: null,
  }));
}

function drawNpcs() {
  NPC_LIST.forEach(npc => {
    const sx = Math.round(npc.x - camera.x);
    const sy = Math.round(npc.y - camera.y);

    // Skip if off-screen
    if (sx < -npc.w || sx > camera.w || sy < -npc.h || sy > camera.h) return;

    // Sprite
    ctx.drawImage(npc.sprite, sx, sy, npc.w, npc.h);

    // Name tag
    const label = npc.name;
    const tw    = ctx.measureText(label).width + 12;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(sx + npc.w / 2 - tw / 2, sy - 17, tw, 13);
    ctx.fillStyle = "#fff";
    ctx.font      = "7px 'Press Start 2P'";
    ctx.textAlign = "center";
    ctx.fillText(label, sx + npc.w / 2, sy - 7);

    // Interaction indicator above head when nearby
    if (npc._nearby) {
      ctx.fillStyle = npc.color || "#f7c948";
      ctx.font      = "10px 'Press Start 2P'";
      ctx.fillText("!", sx + npc.w / 2, sy - 24);
    }
  });
}

/* ─── Find closest NPC within interact range ─────────────── */
let nearestNpc = null;

function checkNpcProximity() {
  const px = player.x + player.w / 2;
  const py = player.y + player.h / 2;
  let closest = null;
  let closestDist = Infinity;

  NPC_LIST.forEach(npc => {
    const nx = npc.x + npc.w / 2;
    const ny = npc.y + npc.h / 2;
    const dist = Math.hypot(px - nx, py - ny);
    npc._nearby = dist < INTERACT_DIST;
    if (dist < INTERACT_DIST && dist < closestDist) {
      closestDist = dist;
      closest = npc;
    }
  });

  nearestNpc = closest;
  interactPrompt.classList.toggle("hidden", !closest);
}


/* ══════════════════════════════════════════════════════════
   PORTFOLIO MODAL  (open / close)
══════════════════════════════════════════════════════════ */
let modalOpen = false;

function openPortfolio(npc) {
  modalOpen = true;
  // portfolio-template.js renders the modal content
  if (window.renderPortfolio) {
    window.renderPortfolio(npc);
  } else {
    // Minimal fallback if template not loaded yet
    document.getElementById("modal-npc-name").textContent = npc.name;
    document.getElementById("modal-npc-role").textContent = npc.role || "???";
    document.getElementById("about-bio").textContent      = npc.bio  || "No data loaded yet.";
  }
  modalOverlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closePortfolio() {
  modalOpen = false;
  modalOverlay.classList.add("hidden");
  document.body.style.overflow = "";
}

modalClose.addEventListener("click", closePortfolio);
modalOverlay.addEventListener("click", e => {
  if (e.target === modalOverlay) closePortfolio();
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && modalOpen) closePortfolio();
});


/* ══════════════════════════════════════════════════════════
   INPUT
══════════════════════════════════════════════════════════ */
const keys = {};

document.addEventListener("keydown", e => {
  keys[e.key] = true;
  if ((e.key === "e" || e.key === "E") && !modalOpen && nearestNpc) {
    openPortfolio(nearestNpc);
  }
});
document.addEventListener("keyup", e => { keys[e.key] = false; });

/* Canvas click → open nearest NPC */
canvas.addEventListener("click", e => {
  if (modalOpen) return;
  const rect   = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  const cx     = (e.clientX - rect.left) * scaleX + camera.x;
  const cy     = (e.clientY - rect.top)  * scaleY + camera.y;

  let clicked = null;
  let minDist = Infinity;
  NPC_LIST.forEach(npc => {
    const nx   = npc.x + npc.w / 2;
    const ny   = npc.y + npc.h / 2;
    const dist = Math.hypot(cx - nx, cy - ny);
    if (dist < INTERACT_DIST * 1.5 && dist < minDist) {
      minDist = dist;
      clicked = npc;
    }
  });
  if (clicked) openPortfolio(clicked);
});

/* ─── D-pad (mobile) ─────────────────────────────────────── */
const dpadState = { up:false, down:false, left:false, right:false };
function bindDpad(id, dir) {
  const btn = document.getElementById(id);
  const on  = () => { dpadState[dir] = true; };
  const off = () => { dpadState[dir] = false; };
  btn.addEventListener("pointerdown", on);
  btn.addEventListener("pointerup",   off);
  btn.addEventListener("pointerout",  off);
}
bindDpad("btn-up",    "up");
bindDpad("btn-down",  "down");
bindDpad("btn-left",  "left");
bindDpad("btn-right", "right");
document.getElementById("btn-interact").addEventListener("click", () => {
  if (!modalOpen && nearestNpc) openPortfolio(nearestNpc);
});

function getDpadInput() {
  let dx = 0, dy = 0;
  if (dpadState.up)    dy = -1;
  if (dpadState.down)  dy =  1;
  if (dpadState.left)  dx = -1;
  if (dpadState.right) dx =  1;
  return { dx, dy };
}


/* ══════════════════════════════════════════════════════════
   RESIZE
══════════════════════════════════════════════════════════ */
function resizeCanvas() {
  canvas.width  = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  camera.w      = canvas.width;
  camera.h      = canvas.height;
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener("resize", resizeCanvas);


/* ══════════════════════════════════════════════════════════
   GAME LOOP
══════════════════════════════════════════════════════════ */
function gameLoop() {
  /* Input → movement */
  if (!modalOpen) {
    let dx = 0, dy = 0;
    if (keys["ArrowUp"]    || keys["w"] || keys["W"]) dy = -1;
    if (keys["ArrowDown"]  || keys["s"] || keys["S"]) dy =  1;
    if (keys["ArrowLeft"]  || keys["a"] || keys["A"]) dx = -1;
    if (keys["ArrowRight"] || keys["d"] || keys["D"]) dx =  1;

    const dpad = getDpadInput();
    dx += dpad.dx;
    dy += dpad.dy;

    movePlayer(dx, dy);
    updateCamera(player.x + player.w / 2, player.y + player.h / 2);
    checkNpcProximity();
  }

  /* Clear */
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  /* Draw world */
  drawTileMap();
  drawNpcs();
  drawPlayer();

  requestAnimationFrame(gameLoop);
}


/* ══════════════════════════════════════════════════════════
   LOADING & INIT
══════════════════════════════════════════════════════════ */
function simulateLoading(onDone) {
  let progress = 0;
  const steps  = [
    "Loading tiles…",
    "Spawning NPCs…",
    "Setting up world…",
    "Almost ready…",
  ];
  const hint = document.querySelector(".loading-hint");
  const interval = setInterval(() => {
    progress += Math.random() * 18 + 5;
    if (progress >= 100) { progress = 100; clearInterval(interval); onDone(); }
    loadingBar.style.width = progress + "%";
    const idx = Math.floor((progress / 100) * steps.length);
    if (hint && steps[idx]) hint.textContent = steps[idx];
  }, 120);
}

function init() {
  resizeCanvas();
  tileSprites = buildTileSprites();
  initPlayer();
  initNpcs();

  simulateLoading(() => {
    loadingScreen.style.transition = "opacity 0.5s";
    loadingScreen.style.opacity    = "0";
    setTimeout(() => loadingScreen.classList.add("hidden"), 500);
    requestAnimationFrame(gameLoop);
  });
}

window.addEventListener("load", init);
