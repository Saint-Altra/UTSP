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

  /* ─── Tile + map size ────────────────────────────────── */
  var TILE_W   = 16;
  var TILE_H   = 16;
  var SCALE    = 3;          // render each tile at 3x → 48×48px
  var STW      = TILE_W * SCALE;  // scaled tile width  = 48
  var STH      = TILE_H * SCALE;  // scaled tile height = 48
  var MAP_COLS = 40;
  var MAP_ROWS = 20;
  var MAP_PX_W = MAP_COLS * STW;  // 1920px
  var MAP_PX_H = MAP_ROWS * STH;  // 960px

  /* ─── Player ─────────────────────────────────────────── */
  /* About 2 tiles tall at 3x scale = 96px, which is ~13% of 720 */
  var PLAYER_H = STH * 2;
  var PLAYER_W = Math.floor(PLAYER_H * 0.5);

  var player = {
    x:     STW * 4,                      // start a few tiles in
    y:     0,
    speed: 4,
    color: "#4f6ef7"
  };

  /* Ground Y in world space — row 17 is where ground tiles start */
  var GROUND_ROW = 17;
  var groundWorldY = GROUND_ROW * STH - PLAYER_H;

  player.y = groundWorldY;

  /* ─── Camera ─────────────────────────────────────────── */
  var cam = { x: 0, y: 0 };

  function updateCamera() {
    /* Center camera on player */
    cam.x = player.x + PLAYER_W / 2 - VIEW_W / 2;
    cam.y = player.y + PLAYER_H / 2 - VIEW_H / 2;
    /* Clamp to map bounds */
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

  /* ─── Parallax ───────────────────────────────────────── */
  /* How much each layer shifts relative to camera movement */
  var PAR_1BG  = 0.1;   // furthest — moves least
  var PAR_2BG  = 0.3;
  var PAR_2BG2 = 0.5;

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
     offsetX is in world pixels (camera already applied outside)
  ══════════════════════════════════════════════════════ */
  function drawLayer(data, camOffsetX, camOffsetY) {
    if (!data) return;
    camOffsetX = camOffsetX || 0;
    camOffsetY = camOffsetY || 0;

    for (var i = 0; i < data.length; i++) {
      if (data[i] === 0) continue;
      var col   = i % MAP_COLS;
      var row   = Math.floor(i / MAP_COLS);
      var worldX = col * STW;
      var worldY = row * STH;
      var screenX = worldX - camOffsetX;
      var screenY = worldY - camOffsetY;

      /* Skip tiles outside viewport */
      if (screenX + STW < 0 || screenX > VIEW_W) continue;
      if (screenY + STH < 0 || screenY > VIEW_H) continue;

      drawTile(data[i], screenX, screenY);
    }
  }

  /* Parallax: layer moves at a fraction of camera speed */
  function drawParallax(data, factor) {
    if (!data) return;
    var offsetX = cam.x * factor;
    var offsetY = cam.y * factor;
    drawLayer(data, offsetX, offsetY);
  }

  /* ══════════════════════════════════════════════════════
     COLLISION (ground layer)
  ══════════════════════════════════════════════════════ */
  function isSolidAt(worldX, worldY) {
    if (!layers.ground) return false;
    var col = Math.floor(worldX / STW);
    var row = Math.floor(worldY / STH);
    if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) return true;
    return (layers.ground[row * MAP_COLS + col] & 0x1FFFFFFF) !== 0;
  }

  /* ══════════════════════════════════════════════════════
     INPUT
  ══════════════════════════════════════════════════════ */
  var keys = {};
  document.addEventListener("keydown", function (e) { keys[e.key] = true; });
  document.addEventListener("keyup",   function (e) { keys[e.key] = false; });

  /* ══════════════════════════════════════════════════════
     GAME LOOP
  ══════════════════════════════════════════════════════ */
  function loop() {

    /* Movement */
    if (keys["ArrowLeft"]  || keys["a"] || keys["A"]) player.x -= player.speed;
    if (keys["ArrowRight"] || keys["d"] || keys["D"]) player.x += player.speed;

    /* Clamp player to map */
    player.x = Math.max(0, Math.min(MAP_PX_W - PLAYER_W, player.x));
    player.y = groundWorldY;

    /* Camera */
    updateCamera();

    /* Animated layer offset */
    aniOffset += ANI_SPEED;
    if (aniOffset > MAP_PX_W) aniOffset = 0;

    /* ── Draw ── */
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);

    /* Fixed layers — scroll 1:1 with camera */
    drawLayer(layers.bg,         cam.x, cam.y);
    drawLayer(layers.bg2,        cam.x, cam.y);

    /* Parallax — scroll slower than camera */
    drawParallax(layers["1bg"],  PAR_1BG);
    
    /* Animated — slides independently + camera */
    if (layers.ani) {
      drawLayer(layers.ani, cam.x - aniOffset, cam.y);
      /* second copy for seamless loop */
      drawLayer(layers.ani, cam.x - aniOffset + MAP_PX_W, cam.y);
    }

    drawParallax(layers["2bg"],  PAR_2BG);
    drawParallax(layers["2bg2"], PAR_2BG2);

    /* Fixed layers */
    for (var f = 0; f < layers.fade.length; f++) {
      drawLayer(layers.fade[f], cam.x, cam.y);
    }
    drawLayer(layers.building,   cam.x, cam.y);
    drawLayer(layers.buildings2, cam.x, cam.y);
    drawLayer(layers.buildings3, cam.x, cam.y);
    drawLayer(layers.ground,     cam.x, cam.y);

    /* Player */
    var screenX = player.x - cam.x;
    var screenY = player.y - cam.y;
    ctx.fillStyle = player.color;
    ctx.fillRect(screenX, screenY, PLAYER_W, PLAYER_H);

    /* Foreground props */
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
        onDone();
      })
      .catch(function (err) {
        console.error("Failed to load map.json:", err);
        onDone();
      });
  }

  loadMap(function () {
    loadTilesets(function () {
      loop();
    });
  });

}());
