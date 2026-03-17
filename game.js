(function () {
  "use strict";

  var canvas = document.getElementById("game-canvas");
  var ctx    = canvas.getContext("2d");

  /* ─── Fixed canvas resolution ────────────────────────── */
  var VIEW_W = 1280;
  var VIEW_H = 720;
  canvas.width  = VIEW_W;
  canvas.height = VIEW_H;
  ctx.imageSmoothingEnabled = false;

  /* ─── Tile + map ─────────────────────────────────────── */
  var TILE_W   = 16;
  var TILE_H   = 16;
  var SCALE    = 3;
  var STW      = TILE_W * SCALE;   // 48px
  var STH      = TILE_H * SCALE;   // 48px
  var MAP_COLS = 40;
  var MAP_ROWS = 20;
  var MAP_PX_W = MAP_COLS * STW;   // 1920
  var MAP_PX_H = MAP_ROWS * STH;   // 960

  /* ─── Player — exactly 3 tiles tall ─────────────────── */
  var PLAYER_H = STH * 3;          // 144px
  var PLAYER_W = Math.floor(STW * 1.5);  // 72px

  var player = {
    x:        STW * 4,
    y:        0,
    vy:       0,
    speed:    5,
    color:    "#4f6ef7",
    onGround: false,
  };

  /* ─── Camera ─────────────────────────────────────────── */
  var cam = { x: 0, y: 0 };

  function updateCamera() {
    cam.x = player.x + PLAYER_W / 2 - VIEW_W / 2;
    cam.y = player.y + PLAYER_H / 2 - VIEW_H / 2;
    cam.x = Math.max(0, Math.min(MAP_PX_W - VIEW_W, cam.x));
    cam.y = Math.max(0, Math.min(MAP_PX_H - VIEW_H, cam.y));
  }

  /* ─── Tilesets ───────────────────────────────────────── */
  var TILESETS = [
    { firstgid: 1,    src: "assets/Tiles.png",              img: null, cols: 6 },
    { firstgid: 55,   src: "assets/Props-01.png",           img: null, cols: null },
    { firstgid: 167,  src: "assets/Buildings.png",          img: null, cols: null },
    { firstgid: 542,  src: "assets/Background%20Props.png", img: null, cols: null },
    { firstgid: 711,  src: "assets/Base%20Color.png",       img: null, cols: null },
    { firstgid: 1311, src: "assets/Frontal%20Fog.png",      img: null, cols: null },
    { firstgid: 1320, src: "assets/Mid%20Fog.png",          img: null, cols: null },
  ];

  /* ─── Pixel-perfect collision data ──────────────────────
     Built once at load from Tiles.png.
     solidPixels[tileLocalId][pixelIndex] = true/false
     pixelIndex = py * TILE_W + px  (within the 16x16 tile)
  ──────────────────────────────────────────────────────── */
  var solidPixels = {};   // keyed by local tile id (0-based)
  var TILES_COLS  = 6;
  var TILES_ROWS  = 9;

  function buildCollisionData(tilesImg) {
    /* Draw Tiles.png onto an offscreen canvas to read pixels */
    var oc  = document.createElement("canvas");
    oc.width  = TILES_COLS * TILE_W;   // 96
    oc.height = TILES_ROWS * TILE_H;   // 144
    var ox  = oc.getContext("2d");
    ox.drawImage(tilesImg, 0, 0);

    var imgData = ox.getImageData(0, 0, oc.width, oc.height);
    var pixels  = imgData.data;   // RGBA flat array

    var totalTiles = TILES_COLS * TILES_ROWS;   // 54
    for (var t = 0; t < totalTiles; t++) {
      var tileCol = t % TILES_COLS;
      var tileRow = Math.floor(t / TILES_COLS);
      var solid   = new Uint8Array(TILE_W * TILE_H);

      for (var py = 0; py < TILE_H; py++) {
        for (var px = 0; px < TILE_W; px++) {
          /* pixel position in the full spritesheet */
          var sheetX = tileCol * TILE_W + px;
          var sheetY = tileRow * TILE_H + py;
          var idx    = (sheetY * oc.width + sheetX) * 4;
          /* alpha channel — if > 0 the pixel is solid */
          solid[py * TILE_W + px] = pixels[idx + 3] > 0 ? 1 : 0;
        }
      }
      solidPixels[t] = solid;
    }
  }

  /* ─── Check a single world pixel against ground layer ── */
  function isSolidPixel(worldX, worldY) {
    if (!layers.ground) return false;

    /* Which tile are we in? */
    var col = Math.floor(worldX / STW);
    var row = Math.floor(worldY / STH);
    if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) return false;

    var gid = layers.ground[row * MAP_COLS + col] & 0x1FFFFFFF;
    if (gid === 0) return false;

    /* Only ground tiles (firstgid 1, tileset Tiles.png) have pixel collision */
    var ts = getTileset(gid);
    if (!ts || ts.firstgid !== 1) {
      /* Non-Tiles.png tile — treat whole tile as solid */
      return true;
    }

    var localId = gid - 1;   // 0-based
    var solid   = solidPixels[localId];
    if (!solid) return false;

    /* Where within this tile (in world pixels) are we? */
    var tileOriginX = col * STW;
    var tileOriginY = row * STH;

    /* Map world pixel → tile pixel (accounting for 3x scale) */
    var tpx = Math.floor((worldX - tileOriginX) / SCALE);
    var tpy = Math.floor((worldY - tileOriginY) / SCALE);

    tpx = Math.max(0, Math.min(TILE_W - 1, tpx));
    tpy = Math.max(0, Math.min(TILE_H - 1, tpy));

    return solid[tpy * TILE_W + tpx] === 1;
  }

  /* ─── Layers ─────────────────────────────────────────── */
  var layers = {
    bg:         null,
    bg2:        null,
    "1bg":      null,
    ani:        null,
    "2bg":      null,
    "2bg2":     null,
    fade:       [],
    building:   null,
    buildings2: null,
    buildings3: null,
    ground:     null,
    props:      null,
    props2:     null,
    props3:     null,
  };

  /* ─── Animated layer ─────────────────────────────────── */
  var aniOffset = 0;
  var ANI_SPEED = 0.4;

  /* ─── Parallax ───────────────────────────────────────── */
  var PAR_1BG  = 0.15;
  var PAR_2BG  = 0.35;
  var PAR_2BG2 = 0.55;

  /* ══════════════════════════════════════════════════════
     TILE DRAWING
  ══════════════════════════════════════════════════════ */
  function getTileset(gid) {
    var id = gid & 0x1FFFFFFF;
    if (id === 0) return null;
    var ts = null;
    for (var i = 0; i < TILESETS.length; i++) {
      if (TILESETS[i].firstgid <= id) ts = TILESETS[i];
      else break;
    }
    return ts;
  }

  function drawTile(gid, px, py) {
    var id = gid & 0x1FFFFFFF;
    if (id === 0) return;
    var ts = getTileset(id);
    if (!ts || !ts.img || !ts.img.complete) return;
    var localId = id - ts.firstgid;
    var imgCols = ts.cols || Math.floor(ts.img.naturalWidth / TILE_W);
    var srcX    = (localId % imgCols) * TILE_W;
    var srcY    = Math.floor(localId / imgCols) * TILE_H;
    ctx.drawImage(ts.img, srcX, srcY, TILE_W, TILE_H, px, py, STW, STH);
  }

  /* ══════════════════════════════════════════════════════
     LAYER RENDERING
  ══════════════════════════════════════════════════════ */
  function drawLayer(data, offsetX, offsetY) {
    if (!data) return;
    offsetX = offsetX || 0;
    offsetY = offsetY || 0;
    for (var i = 0; i < data.length; i++) {
      if (data[i] === 0) continue;
      var col     = i % MAP_COLS;
      var row     = Math.floor(i / MAP_COLS);
      var screenX = col * STW - offsetX;
      var screenY = row * STH - offsetY;
      if (screenX + STW < 0 || screenX > VIEW_W) continue;
      if (screenY + STH < 0 || screenY > VIEW_H) continue;
      drawTile(data[i], screenX, screenY);
    }
  }

  function drawParallax(data, factor) {
    if (!data) return;
    drawLayer(data, cam.x * factor, cam.y * factor);
  }

  /* ══════════════════════════════════════════════════════
     PHYSICS
  ══════════════════════════════════════════════════════ */
  var GRAVITY = 0.6;

  function updatePlayer() {
    /* Horizontal */
    if (keys["ArrowLeft"]  || keys["a"] || keys["A"]) player.x -= player.speed;
    if (keys["ArrowRight"] || keys["d"] || keys["D"]) player.x += player.speed;
    player.x = Math.max(0, Math.min(MAP_PX_W - PLAYER_W, player.x));

    /* Gravity */
    player.vy += GRAVITY;
    player.y  += player.vy;
    player.onGround = false;

    /* ── Feet collision — check 3 points across the bottom ──
       Step upward pixel by pixel until no collision,
       then snap. This handles slopes naturally.           */
    var leftX  = player.x + 4;
    var midX   = player.x + PLAYER_W / 2;
    var rightX = player.x + PLAYER_W - 4;
    var feetY  = player.y + PLAYER_H;

    if (
      isSolidPixel(leftX,  feetY) ||
      isSolidPixel(midX,   feetY) ||
      isSolidPixel(rightX, feetY)
    ) {
      /* Walk up one pixel at a time until feet are free */
      while (
        player.vy >= 0 && (
          isSolidPixel(leftX,  player.y + PLAYER_H) ||
          isSolidPixel(midX,   player.y + PLAYER_H) ||
          isSolidPixel(rightX, player.y + PLAYER_H)
        )
      ) {
        player.y--;
      }
      player.vy      = 0;
      player.onGround = true;
    }

    /* ── Ceiling collision ── */
    var headY = player.y;
    if (
      isSolidPixel(leftX,  headY) ||
      isSolidPixel(midX,   headY) ||
      isSolidPixel(rightX, headY)
    ) {
      while (
        isSolidPixel(leftX,  player.y) ||
        isSolidPixel(midX,   player.y) ||
        isSolidPixel(rightX, player.y)
      ) {
        player.y++;
      }
      player.vy = 0;
    }

    /* Don't fall out of map */
    if (player.y + PLAYER_H > MAP_PX_H) {
      player.y   = MAP_PX_H - PLAYER_H;
      player.vy  = 0;
      player.onGround = true;
    }
  }

  /* ══════════════════════════════════════════════════════
     INPUT
  ══════════════════════════════════════════════════════ */
  var keys = {};
  document.addEventListener("keydown", function (e) { keys[e.key] = true; });
  document.addEventListener("keyup",   function (e) { keys[e.key] = false; });

  /* ══════════════════════════════════════════════════════
     GAME LOOP
     Player is drawn LAST — on top of absolutely everything
  ══════════════════════════════════════════════════════ */
  function loop() {
    updatePlayer();
    updateCamera();

    aniOffset += ANI_SPEED;
    if (aniOffset > MAP_PX_W) aniOffset = 0;

    ctx.clearRect(0, 0, VIEW_W, VIEW_H);

    /* Backgrounds */
    drawLayer(layers.bg,  cam.x, cam.y);
    drawLayer(layers.bg2, cam.x, cam.y);

    /* Parallax */
    drawParallax(layers["1bg"],  PAR_1BG);

    /* Animated */
    if (layers.ani) {
      drawLayer(layers.ani, cam.x - aniOffset,            cam.y);
      drawLayer(layers.ani, cam.x - aniOffset + MAP_PX_W, cam.y);
    }

    drawParallax(layers["2bg"],  PAR_2BG);
    drawParallax(layers["2bg2"], PAR_2BG2);

    /* Fade */
    for (var f = 0; f < layers.fade.length; f++) {
      drawLayer(layers.fade[f], cam.x, cam.y);
    }

    /* Buildings */
    drawLayer(layers.building,   cam.x, cam.y);
    drawLayer(layers.buildings2, cam.x, cam.y);
    drawLayer(layers.buildings3, cam.x, cam.y);

    /* Ground */
    drawLayer(layers.ground, cam.x, cam.y);

    /* Props */
    drawLayer(layers.props,  cam.x, cam.y);
    drawLayer(layers.props2, cam.x, cam.y);
    drawLayer(layers.props3, cam.x, cam.y);

    /* ── PLAYER LAST — on top of everything ── */
    var sx = Math.round(player.x - cam.x);
    var sy = Math.round(player.y - cam.y);
    ctx.fillStyle = player.color;
    ctx.fillRect(sx, sy, PLAYER_W, PLAYER_H);

    requestAnimationFrame(loop);
  }

  /* ══════════════════════════════════════════════════════
     LOAD
  ══════════════════════════════════════════════════════ */
  function loadTilesets(onDone) {
    var loaded = 0;
    TILESETS.forEach(function (ts) {
      var img     = new Image();
      img.onload  = function () {
        if (!ts.cols) ts.cols = Math.floor(img.naturalWidth / TILE_W);
        /* Build pixel collision data from Tiles.png only */
        if (ts.firstgid === 1) buildCollisionData(img);
        loaded++;
        if (loaded === TILESETS.length) onDone();
      };
      img.onerror = function () {
        loaded++;
        if (loaded === TILESETS.length) onDone();
      };
      img.src = ts.src;
      ts.img  = img;
    });
  }

  function loadMap(onDone) {
    fetch("map.json")
      .then(function (r) { return r.json(); })
      .then(function (map) {
        map.layers.forEach(function (layer) {
          if (layer.type !== "tilelayer") return;
          var name = layer.name.toLowerCase();
          if      (name === "bg")         layers.bg         = layer.data;
          else if (name === "bg2")        layers.bg2        = layer.data;
          else if (name === "1bg")        layers["1bg"]     = layer.data;
          else if (name === "ani")        layers.ani        = layer.data;
          else if (name === "2bg")        layers["2bg"]     = layer.data;
          else if (name === "2bg2")       layers["2bg2"]    = layer.data;
          else if (name === "fade")       layers.fade.push(layer.data);
          else if (name === "building")   layers.building   = layer.data;
          else if (name === "buildings2") layers.buildings2 = layer.data;
          else if (name === "buildings3") layers.buildings3 = layer.data;
          else if (name === "ground")     layers.ground     = layer.data;
          else if (name === "props")      layers.props      = layer.data;
          else if (name === "props2")     layers.props2     = layer.data;
          else if (name === "props3")     layers.props3     = layer.data;
        });
        onDone();
      })
      .catch(function (err) {
        console.error("map.json failed:", err);
        onDone();
      });
  }

  /* Start by loading map first, then tilesets */
  loadMap(function () {
    loadTilesets(function () {
      /* Place player on first solid ground pixel found at center column */
      var midCol = Math.floor(MAP_COLS / 2);
      var placed = false;
      for (var row = 0; row < MAP_ROWS && !placed; row++) {
        var gid = layers.ground ? (layers.ground[row * MAP_COLS + midCol] & 0x1FFFFFFF) : 0;
        if (gid !== 0) {
          player.y = row * STH - PLAYER_H;
          placed = true;
        }
      }
      if (!placed) player.y = MAP_PX_H - PLAYER_H - STH;
      loop();
    });
  });

}());
