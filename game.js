(function () {
  "use strict";

  var canvas = document.getElementById("game-canvas");
  var ctx    = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  /* ─── Proportions ────────────────────────────────────── */
  var GROUND_RATIO = 0.85;
  var PLAYER_RATIO = 0.08;  // smaller — fits naturally in the map

  var groundY = 0;
  var playerH = 0;
  var playerW = 0;

  var player = {
    x:     0,
    y:     0,
    speed: 5,
    color: "#4f6ef7"
  };

  /* ─── Map constants ──────────────────────────────────── */
  var TILE_W    = 16;
  var TILE_H    = 16;
  var MAP_COLS  = 40;
  var MAP_ROWS  = 20;

  /* ─── Tileset image paths ────────────────────────────── */
  var TILESETS = [
    { firstgid: 1,    src: "assets/Tiles.png",              img: null },
    { firstgid: 55,   src: "assets/Props-01.png",           img: null },
    { firstgid: 167,  src: "assets/Buildings.png",          img: null },
    { firstgid: 542,  src: "assets/Background%20Props.png", img: null },
    { firstgid: 711,  src: "assets/Base%20Color.png",       img: null },
    { firstgid: 1311, src: "assets/Frontal%20Fog.png",      img: null },
    { firstgid: 1320, src: "assets/Mid%20Fog.png",          img: null },
  ];

  /* ─── Layer data ─────────────────────────────────────── */
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

  /* ─── Animated layer state ───────────────────────────── */
  var aniOffset = 0;
  var ANI_SPEED = 0.3;

  /* ─── Parallax factors ───────────────────────────────── */
  var PARALLAX_1BG  = 0.02;
  var PARALLAX_2BG  = 0.05;
  var PARALLAX_2BG2 = 0.08;

  /* ─── Scale: map fills canvas ────────────────────────── */
  var scaleX = 1;
  var scaleY = 1;

  /* ══════════════════════════════════════════════════════
     RESIZE
  ══════════════════════════════════════════════════════ */
  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.imageSmoothingEnabled = false;

    scaleX = canvas.width  / (MAP_COLS * TILE_W);
    scaleY = canvas.height / (MAP_ROWS * TILE_H);

    groundY = Math.floor(canvas.height * GROUND_RATIO);
    playerH = Math.floor(canvas.height * PLAYER_RATIO);
    playerW = Math.floor(playerH * 0.5);

    player.y = groundY - playerH;
    if (player.x === 0) player.x = Math.floor(canvas.width * 0.1);
  }
  window.addEventListener("resize", resize);
  resize();

  /* ══════════════════════════════════════════════════════
     TILESET HELPERS
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

  function drawTile(gid, px, py, tw, th) {
    var id = gid & 0x1FFFFFFF;
    if (id === 0) return;
    var ts = getTileset(id);
    if (!ts || !ts.img || !ts.img.complete) return;
    var localId = id - ts.firstgid;
    var imgCols = Math.floor(ts.img.naturalWidth / TILE_W);
    var srcX    = (localId % imgCols) * TILE_W;
    var srcY    = Math.floor(localId / imgCols) * TILE_H;
    ctx.drawImage(ts.img, srcX, srcY, TILE_W, TILE_H, px, py, tw, th);
  }

  /* ══════════════════════════════════════════════════════
     LAYER RENDERING
  ══════════════════════════════════════════════════════ */
  function drawLayer(data, offsetX) {
    if (!data) return;
    offsetX = offsetX || 0;
    var tw = scaleX * TILE_W;
    var th = scaleY * TILE_H;
    for (var i = 0; i < data.length; i++) {
      if (data[i] === 0) continue;
      var col = i % MAP_COLS;
      var row = Math.floor(i / MAP_COLS);
      drawTile(data[i], col * tw + offsetX, row * th, tw, th);
    }
  }

  function parallaxOffset(factor) {
    var center   = canvas.width * 0.5;
    var playerCX = player.x + playerW * 0.5;
    return (playerCX - center) * factor * -1;
  }

  /* ══════════════════════════════════════════════════════
     COLLISION
  ══════════════════════════════════════════════════════ */
  function isSolidAt(wx, wy) {
    if (!layers.ground) return false;
    var col = Math.floor(wx / (scaleX * TILE_W));
    var row = Math.floor(wy / (scaleY * TILE_H));
    if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) return true;
    return (layers.ground[row * MAP_COLS + col] & 0x1FFFFFFF) !== 0;
  }

  function resolveCollision() {
    var feetY  = player.y + playerH;
    var leftX  = player.x + 2;
    var rightX = player.x + playerW - 2;
    if (isSolidAt(leftX, feetY) || isSolidAt(rightX, feetY)) {
      var th   = scaleY * TILE_H;
      var row  = Math.floor(feetY / th);
      player.y = row * th - playerH;
    }
    var midY = player.y + playerH * 0.5;
    if (isSolidAt(player.x, midY)) {
      var tw  = scaleX * TILE_W;
      var col = Math.floor(player.x / tw);
      player.x = (col + 1) * tw;
    }
    if (isSolidAt(player.x + playerW, midY)) {
      var tw2  = scaleX * TILE_W;
      var col2 = Math.floor((player.x + playerW) / tw2);
      player.x = col2 * tw2 - playerW;
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
  ══════════════════════════════════════════════════════ */
  function loop() {

    if (keys["ArrowLeft"]  || keys["a"] || keys["A"]) player.x -= player.speed;
    if (keys["ArrowRight"] || keys["d"] || keys["D"]) player.x += player.speed;

    player.x = Math.max(0, Math.min(canvas.width - playerW, player.x));
    player.y = groundY - playerH;

    resolveCollision();

    aniOffset += ANI_SPEED;
    if (aniOffset > canvas.width) aniOffset = -canvas.width;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawLayer(layers.bg);
    drawLayer(layers.bg2);
    drawLayer(layers["1bg"],  parallaxOffset(PARALLAX_1BG));
    drawLayer(layers.ani,     aniOffset);
    drawLayer(layers.ani,     aniOffset - canvas.width);
    drawLayer(layers["2bg"],  parallaxOffset(PARALLAX_2BG));
    drawLayer(layers["2bg2"], parallaxOffset(PARALLAX_2BG2));
    for (var f = 0; f < layers.fade.length; f++) drawLayer(layers.fade[f]);
    drawLayer(layers.building);
    drawLayer(layers.buildings2);
    drawLayer(layers.buildings3);
    drawLayer(layers.ground);

    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, playerW, playerH);

    drawLayer(layers.props);
    drawLayer(layers.props2);
    drawLayer(layers.props3);

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
