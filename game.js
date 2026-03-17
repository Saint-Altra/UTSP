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
  var PLAYER_H = STH * 3;                    // 144px
  var PLAYER_W = Math.floor(STW * 1.5);      // 72px — 1.5 tiles wide

  var player = {
    x:     STW * 4,
    y:     0,
    vy:    0,
    speed: 5,
    color: "#4f6ef7",
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
    { firstgid: 1,    src: "assets/Tiles.png",              img: null },
    { firstgid: 55,   src: "assets/Props-01.png",           img: null },
    { firstgid: 167,  src: "assets/Buildings.png",          img: null },
    { firstgid: 542,  src: "assets/Background%20Props.png", img: null },
    { firstgid: 711,  src: "assets/Base%20Color.png",       img: null },
    { firstgid: 1311, src: "assets/Frontal%20Fog.png",      img: null },
    { firstgid: 1320, src: "assets/Mid%20Fog.png",          img: null },
  ];

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

  /* ─── Parallax — very subtle ─────────────────────────── */
  var PAR_1BG  = 0.02;
  var PAR_2BG  = 0.05;
  var PAR_2BG2 = 0.08;

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
    var imgCols = Math.floor(ts.img.naturalWidth / TILE_W);
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

  /* Parallax: moves at a fraction of camera — very subtle */
  function drawParallax(data, factor) {
    if (!data) return;
    drawLayer(data, cam.x * factor, cam.y * factor);
  }

  /* ══════════════════════════════════════════════════════
     COLLISION
     Check if a world-pixel point lands on a solid ground tile
  ══════════════════════════════════════════════════════ */
  function isSolid(worldX, worldY) {
    if (!layers.ground) return false;
    var col = Math.floor(worldX / STW);
    var row = Math.floor(worldY / STH);
    if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) return false;
    return (layers.ground[row * MAP_COLS + col] & 0x1FFFFFFF) !== 0;
  }

  /* ══════════════════════════════════════════════════════
     PHYSICS — simple gravity + ground collision
  ══════════════════════════════════════════════════════ */
  var GRAVITY = 0.5;

  function updatePlayer() {
    /* Horizontal */
    var keys_obj = keys;
    if (keys_obj["ArrowLeft"]  || keys_obj["a"] || keys_obj["A"]) player.x -= player.speed;
    if (keys_obj["ArrowRight"] || keys_obj["d"] || keys_obj["D"]) player.x += player.speed;
    player.x = Math.max(0, Math.min(MAP_PX_W - PLAYER_W, player.x));

    /* Horizontal wall collision — check left and right edges at mid height */
    var midY = player.y + PLAYER_H * 0.5;
    if (isSolid(player.x, midY)) {
      player.x += player.speed;
    }
    if (isSolid(player.x + PLAYER_W, midY)) {
      player.x -= player.speed;
    }

    /* Gravity */
    player.vy += GRAVITY;
    player.y  += player.vy;

    /* Ground collision — check feet (bottom-left and bottom-right corners) */
    player.onGround = false;
    var feetY  = player.y + PLAYER_H;
    var leftX  = player.x + 4;
    var rightX = player.x + PLAYER_W - 4;

    if (isSolid(leftX, feetY) || isSolid(rightX, feetY)) {
      /* Snap to top of the tile the feet are in */
      var row    = Math.floor(feetY / STH);
      player.y   = row * STH - PLAYER_H;
      player.vy  = 0;
      player.onGround = true;
    }

    /* Ceiling collision */
    var headY = player.y;
    if (isSolid(leftX, headY) || isSolid(rightX, headY)) {
      var row2   = Math.floor(headY / STH);
      player.y   = (row2 + 1) * STH;
      player.vy  = 0;
    }

    /* Fallback — don't fall out of map */
    if (player.y + PLAYER_H > MAP_PX_H) {
      player.y  = MAP_PX_H - PLAYER_H;
      player.vy = 0;
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
     Draw order:
       bg, bg2 (fixed)
       1bg (parallax)
       ani (animated)
       2bg, 2bg2 (parallax)
       fade x2 (fixed)
       building, buildings2, buildings3 (fixed)
       ground (fixed)
       *** PLAYER ***   ← on top of ground, under nothing
       props, props2, props3 (fixed foreground — drawn AFTER player
                              only if you want them in front;
                              swap below if you want player in front)
  ══════════════════════════════════════════════════════ */
  function loop() {
    updatePlayer();
    updateCamera();

    /* Animated offset */
    aniOffset += ANI_SPEED;
    if (aniOffset > MAP_PX_W) aniOffset = 0;

    ctx.clearRect(0, 0, VIEW_W, VIEW_H);

    /* Background fixed */
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

    /* ── PLAYER — drawn here, on top of ground ── */
    var sx = Math.round(player.x - cam.x);
    var sy = Math.round(player.y - cam.y);
    ctx.fillStyle = player.color;
    ctx.fillRect(sx, sy, PLAYER_W, PLAYER_H);

    /* Props drawn AFTER player so they appear in front.
       If you want player in front of props, move the 3 lines above the player block. */
    drawLayer(layers.props,  cam.x, cam.y);
    drawLayer(layers.props2, cam.x, cam.y);
    drawLayer(layers.props3, cam.x, cam.y);

    requestAnimationFrame(loop);
  }

  /* ══════════════════════════════════════════════════════
     LOAD
  ══════════════════════════════════════════════════════ */
  function loadTilesets(onDone) {
    var loaded = 0;
    TILESETS.forEach(function (ts) {
      var img     = new Image();
      img.onload  = function () { loaded++; if (loaded === TILESETS.length) onDone(); };
      img.onerror = function () { loaded++; if (loaded === TILESETS.length) onDone(); };
      img.src     = ts.src;
      ts.img      = img;
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

        /* Place player on top of first solid ground tile found */
        if (layers.ground) {
          for (var row = MAP_ROWS - 1; row >= 0; row--) {
            var mid = Math.floor(MAP_COLS / 2);
            if ((layers.ground[row * MAP_COLS + mid] & 0x1FFFFFFF) !== 0) {
              player.y = row * STH - PLAYER_H;
              break;
            }
          }
        }

        onDone();
      })
      .catch(function (err) {
        console.error("map.json failed:", err);
        onDone();
      });
  }

  loadMap(function () {
    loadTilesets(function () {
      loop();
    });
  });

}());
