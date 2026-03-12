(function () {
  "use strict";

  var canvas = document.getElementById("game-canvas");
  var ctx    = canvas.getContext("2d");

  /* ─── Player ─────────────────────────────────────────── */
  var player = {
    x:     100,
    y:     300,
    w:     32,
    h:     48,
    speed: 3,
    color: "#4f6ef7"
  };

  /* ─── Input ──────────────────────────────────────────── */
  var keys = {};
  document.addEventListener("keydown", function (e) { keys[e.key] = true; });
  document.addEventListener("keyup",   function (e) { keys[e.key] = false; });

  /* ─── Resize ─────────────────────────────────────────── */
  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resize);
  resize();

  /* ─── Game loop ──────────────────────────────────────── */
  function loop() {
    // Left / right movement
    if (keys["ArrowLeft"]  || keys["a"] || keys["A"]) player.x -= player.speed;
    if (keys["ArrowRight"] || keys["d"] || keys["D"]) player.x += player.speed;

    // Keep player inside canvas
    player.x = Math.max(0, Math.min(canvas.width - player.w, player.x));

    // Clear screen
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Ground
    ctx.fillStyle = "#2a2a4a";
    ctx.fillRect(0, canvas.height - 60, canvas.width, 60);

    // Player rectangle
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.w, player.h);

    requestAnimationFrame(loop);
  }

  loop();

}());
