(function () {
  "use strict";

  var canvas = document.getElementById("game-canvas");
  var ctx    = canvas.getContext("2d");

  /* ─── Street Fighter III proportions ────────────────────
     Characters are about 1/3 of screen height, wide stance.
     Ground sits at ~85% down the screen.
  ──────────────────────────────────────────────────────── */
  var GROUND_RATIO = 0.85;
  var PLAYER_RATIO = 0.33;  // player height = 33% of screen height

  var groundY = 0;
  var playerH = 0;
  var playerW = 0;

  var player = {
    x:     0,
    y:     0,
    speed: 5,
    color: "#4f6ef7"
  };

  /* ─── Resize ─────────────────────────────────────────── */
  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    groundY = Math.floor(canvas.height * GROUND_RATIO);
    playerH = Math.floor(canvas.height * PLAYER_RATIO);
    playerW = Math.floor(playerH * 0.5);   // SF3 chars are tall and not too wide

    player.y = groundY - playerH;

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

    if (keys["ArrowLeft"]  || keys["a"] || keys["A"]) player.x -= player.speed;
    if (keys["ArrowRight"] || keys["d"] || keys["D"]) player.x += player.speed;

    player.x = Math.max(0, Math.min(canvas.width - playerW, player.x));
    player.y = groundY - playerH;

    /* ── Draw ── */
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Sky
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Ground fill
    ctx.fillStyle = "#2a2a4a";
    ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);

    // Ground top edge
    ctx.fillStyle = "#3a3a6a";
    ctx.fillRect(0, groundY, canvas.width, 3);

    // Player
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, playerW, playerH);

    requestAnimationFrame(loop);
  }

  loop();

}());
