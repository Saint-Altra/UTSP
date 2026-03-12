(function () {
  "use strict";

  var canvas = document.getElementById("game-canvas");
  var ctx    = canvas.getContext("2d");

  /* ─── Sizes (relative to screen) ────────────────────────
     Standard 2D platformer proportions:
     - Ground sits at ~78% down the screen
     - Player height is ~1/8 of screen height (like Mario)
     - Player width is about half the player height
  ──────────────────────────────────────────────────────── */
  var GROUND_RATIO  = 0.78;   // ground line at 78% of screen height
  var PLAYER_RATIO  = 0.11;   // player height = 11% of screen height

  var groundY  = 0;   // set on resize
  var playerH  = 0;
  var playerW  = 0;

  var player = {
    x:     0,
    y:     0,
    speed: 4,
    color: "#4f6ef7"
  };

  /* ─── Resize — recalculate proportions ───────────────── */
  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    groundY  = Math.floor(canvas.height * GROUND_RATIO);
    playerH  = Math.floor(canvas.height * PLAYER_RATIO);
    playerW  = Math.floor(playerH * 0.55);

    // Snap player to ground
    player.y = groundY - playerH;

    // First load: center player
    if (player.x === 0) player.x = Math.floor(canvas.width * 0.1);
  }

  window.addEventListener("resize", resize);
  resize();

  /* ─── Input ──────────────────────────────────────────── */
  var keys = {};
  document.addEventListener("keydown", function (e) { keys[e.key] = true; });
  document.addEventListener("keyup",   function (e) { keys[e.key] = false; });

  /* ─── Game loop ──────────────────────────────────────── */
  function loop() {

    // Movement — left/right only
    if (keys["ArrowLeft"]  || keys["a"] || keys["A"]) player.x -= player.speed;
    if (keys["ArrowRight"] || keys["d"] || keys["D"]) player.x += player.speed;

    // Keep player inside canvas
    player.x = Math.max(0, Math.min(canvas.width - playerW, player.x));

    // Always stick to ground
    player.y = groundY - playerH;

    /* ── Draw ── */
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Sky background
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Ground fill (below ground line)
    ctx.fillStyle = "#2a2a4a";
    ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);

    // Ground top edge line
    ctx.fillStyle = "#3a3a6a";
    ctx.fillRect(0, groundY, canvas.width, 3);

    // Player rectangle
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, playerW, playerH);

    requestAnimationFrame(loop);
  }

  loop();

}());
