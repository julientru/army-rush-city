// Army Rush in 2D: the battle drawn from above on a canvas, the field standing up on the screen.
// The battle itself is in army.js; this only draws it. ArmyViews["2d"](core) is called the first
// time the 2D view is picked (see `core` in army.js).
window.ArmyViews = window.ArmyViews || {};
window.ArmyViews["2d"] = function (core) {
  const { W, H, WALL_Y, SQUAD_Y, WEAPONS, ENEMIES, stage, city, squadSpots, fmt, t } = core;
  let g, time; // the battle and the clock, read again each time it draws

  const canvas = document.createElement("canvas");
  canvas.className = "view view-2d";
  canvas.hidden = true;
  stage.prepend(canvas);
  const ctx = canvas.getContext("2d");
  // The units are pictures of the 3D models (sprites2d.js), or simple shapes without 3D.
  const sprites = window.ArmySprites ? window.ArmySprites() : null;

  // ---------- Drawing helpers ----------

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function circle(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function eyes(x, y, size, gap, seed, dizzy) {
    [-1, 1].forEach((side) => {
      const ex = x + side * gap;
      circle(ex, y, size, "#fff");
      ctx.strokeStyle = "#2b2d42";
      ctx.lineWidth = Math.max(1, size * 0.15);
      ctx.beginPath(); ctx.arc(ex, y, size, 0, Math.PI * 2); ctx.stroke();
      if (dizzy) {
        // Swirly dizzy eyes.
        ctx.beginPath();
        for (let a = 0; a < Math.PI * 4; a += 0.3) {
          const rad = (a / (Math.PI * 4)) * size * 0.8;
          ctx.lineTo(ex + Math.cos(a + time * 10) * rad, y + Math.sin(a + time * 10) * rad);
        }
        ctx.stroke();
      } else {
        // Googly pupils that jiggle around.
        const jx = Math.sin(time * 9 + seed + side) * size * 0.25;
        const jy = Math.cos(time * 7 + seed) * size * 0.2 + size * 0.25;
        circle(ex + jx, y + jy, size * 0.45, "#2b2d42");
      }
    });
  }

  function crown(x, y, s) {
    ctx.fillStyle = "#ffd93d";
    ctx.strokeStyle = "#e09f00";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - s, y);
    ctx.lineTo(x - s, y - s * 0.9);
    ctx.lineTo(x - s * 0.5, y - s * 0.4);
    ctx.lineTo(x, y - s * 1.1);
    ctx.lineTo(x + s * 0.5, y - s * 0.4);
    ctx.lineTo(x + s, y - s * 0.9);
    ctx.lineTo(x + s, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    circle(x, y - s * 0.35, s * 0.15, "#ff6b6b");
  }

  function mustache(x, y, s) {
    ctx.strokeStyle = "#3d2b1f";
    ctx.lineWidth = s * 0.25;
    ctx.lineCap = "round";
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + side * s * 0.6, y + s * 0.3, x + side * s, y - s * 0.2 + Math.sin(time * 6) * s * 0.1);
      ctx.stroke();
    });
    ctx.lineCap = "butt";
  }

  // ---------- Enemies ----------

  function drawPerson(T, e, dizzy) {
    const r = T.r;
    const phase = time * 8 + e.seed;
    const hit = e.flash > 0;
    // Legs march.
    ctx.fillStyle = "#3d405b";
    [-1, 1].forEach((side) => {
      const lift = Math.sin(phase + (side > 0 ? Math.PI : 0)) * r * 0.15;
      ctx.beginPath();
      ctx.ellipse(side * r * 0.4, r * 0.85 + lift, r * 0.22, r * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    // Arm + prop, with a silly swing.
    // Arm swings, with a big wind-up when throwing.
    const swing = e.throwT > 0 ? 1.4 - e.throwT * 6 : Math.sin(time * 4 + e.seed) * 0.6;
    ctx.save();
    ctx.translate(r * 0.85, -r * 0.1);
    ctx.rotate(-0.6 + swing);
    ctx.strokeStyle = T.color;
    ctx.lineWidth = r * 0.25;
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -r * 0.6); ctx.stroke();
    ctx.lineCap = "butt";
    if (T.prop === "stone") circle(0, -r * 0.75, r * 0.28, "#8d99ae");
    if (T.prop === "club") {
      ctx.strokeStyle = "#8b5a2b"; ctx.lineWidth = r * 0.2;
      ctx.beginPath(); ctx.moveTo(0, -r * 0.5); ctx.lineTo(0, -r * 1.2); ctx.stroke();
      circle(0, -r * 1.25, r * 0.25, "#a0522d");
    }
    if (T.prop === "stick") {
      ctx.strokeStyle = "#8b5a2b"; ctx.lineWidth = r * 0.12;
      ctx.beginPath(); ctx.moveTo(0, -r * 0.4); ctx.lineTo(0, -r * 1.4); ctx.stroke();
      ctx.fillStyle = "#ff6b6b";
      ctx.beginPath(); ctx.moveTo(0, -r * 1.4); ctx.lineTo(r * 0.6, -r * 1.25); ctx.lineTo(0, -r * 1.1); ctx.fill();
    }
    ctx.restore();
    // Body.
    circle(0, 0, r, hit ? "#fff" : T.color);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.beginPath(); ctx.ellipse(0, r * 0.35, r * 0.55, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    // Face.
    eyes(0, -r * 0.2, r * 0.28, r * 0.36, e.seed, dizzy);
    ctx.fillStyle = "#2b2d42";
    ctx.strokeStyle = "#2b2d42";
    ctx.lineWidth = Math.max(2, r * 0.08);
    const my = r * 0.35;
    if (hit || dizzy || T.mouth === "o") {
      ctx.beginPath(); ctx.ellipse(0, my, r * 0.15, r * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    } else if (T.mouth === "tongue") {
      ctx.beginPath(); ctx.arc(0, my - r * 0.08, r * 0.25, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
      ctx.fillStyle = "#ff8fab";
      ctx.beginPath(); ctx.ellipse(r * 0.08, my + r * 0.2, r * 0.1, r * 0.13 + Math.sin(time * 10) * r * 0.03, 0, 0, Math.PI * 2); ctx.fill();
    } else if (T.mouth === "teeth") {
      ctx.fillStyle = "#2b2d42";
      rr(-r * 0.32, my - r * 0.1, r * 0.64, r * 0.26, r * 0.1); ctx.fill();
      ctx.fillStyle = "#fff";
      for (let i = 0; i < 4; i++) ctx.fillRect(-r * 0.28 + i * r * 0.15, my - r * 0.1, r * 0.1, r * 0.1);
    } else {
      ctx.beginPath(); ctx.arc(0, my - r * 0.1, r * 0.25, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    }
    if (T.mustache) mustache(0, my - r * 0.12, r * 0.4);
    // Hats.
    if (T.hat === "helmet") {
      ctx.fillStyle = "#6b705c";
      ctx.beginPath(); ctx.arc(0, -r * 0.55, r * 0.75, Math.PI, 0); ctx.fill();
      ctx.fillRect(-r * 0.9, -r * 0.6, r * 1.8, r * 0.14);
    } else if (T.hat === "bandana") {
      ctx.fillStyle = "#e63946";
      ctx.fillRect(-r * 0.85, -r * 0.75, r * 1.7, r * 0.25);
      ctx.beginPath(); ctx.moveTo(-r * 0.8, -r * 0.65); ctx.lineTo(-r * 1.3, -r * 0.4 + Math.sin(time * 8) * 3); ctx.lineTo(-r * 1.2, -r * 0.85); ctx.fill();
    } else if (T.hat === "crown") {
      crown(0, -r * 0.8, r * 0.5);
    }
    // A tiny cannon rolling in front.
    if (T.prop === "cannon") {
      circle(-r * 0.75, r * 0.95, r * 0.25, "#6c584c");
      circle(r * 0.75, r * 0.95, r * 0.25, "#6c584c");
      ctx.fillStyle = "#495057";
      rr(-r * 0.6, r * 0.5, r * 1.2, r * 0.6, r * 0.25); ctx.fill();
      rr(-r * 0.22, r * 0.8, r * 0.44, r * 0.7, r * 0.15); ctx.fill();
    }
  }

  function drawTank(T, e, dizzy) {
    const r = T.r;
    const hit = e.flash > 0;
    const body = hit ? "#fff" : T.color;
    const roll = (time * T.speed) % 10;
    // Treads with moving bumps.
    [-1, 1].forEach((side) => {
      ctx.fillStyle = "#3d405b";
      rr(side * r * 0.75 - r * 0.25, -r * 0.95, r * 0.5, r * 1.9, r * 0.2); ctx.fill();
      ctx.fillStyle = "#6c757d";
      for (let y = -r * 0.9 + roll * (r / 20); y < r * 0.9; y += r * 0.3) {
        ctx.fillRect(side * r * 0.75 - r * 0.2, y, r * 0.4, r * 0.08);
      }
    });
    // Hull.
    ctx.fillStyle = body;
    rr(-r * 0.6, -r * 0.8, r * 1.2, r * 1.6, r * 0.25); ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    rr(-r * 0.5, r * 0.2, r, r * 0.5, r * 0.15); ctx.fill();
    // Barrel points at you and wiggles.
    ctx.save();
    ctx.rotate(Math.sin(time * 3 + e.seed) * 0.25);
    ctx.fillStyle = hit ? "#fff" : "#495057";
    rr(-r * 0.12, 0, r * 0.24, r * 1.2, r * 0.08); ctx.fill();
    circle(0, r * 1.2, r * 0.16, "#2b2d42");
    ctx.restore();
    // Turret with a face.
    circle(0, -r * 0.1, r * 0.55, hit ? "#fff" : shade(T.color));
    eyes(0, -r * 0.2, r * 0.18, r * 0.24, e.seed, dizzy);
    ctx.strokeStyle = "#2b2d42";
    ctx.lineWidth = Math.max(2, r * 0.06);
    ctx.beginPath(); ctx.arc(0, r * 0.08, r * 0.16, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    if (T.mustache) mustache(0, r * 0.08, r * 0.3);
    if (T.crown) crown(0, -r * 0.55, r * 0.35);
  }

  function shade(hex) {
    const n = parseInt(hex.slice(1), 16);
    const c = (v) => Math.max(0, Math.round(v * 0.82));
    return "rgb(" + c(n >> 16) + "," + c((n >> 8) & 255) + "," + c(n & 255) + ")";
  }

  // A unit's picture: its feet on (x, y). fade: 0..1 as a knocked-out one sinks away.
  function drawSprite(pic, x, y, scale, fade) {
    const k = scale || 1;
    if (fade) ctx.globalAlpha = Math.max(0, 1 - fade * fade);
    ctx.drawImage(pic.img, x - pic.x * k, y - pic.y * k + (fade || 0) * 10, pic.w * k, pic.h * k);
    ctx.globalAlpha = 1;
  }

  function drawEnemy(e, dizzy) {
    const T = ENEMIES[e.type];
    if (sprites) {
      const set = sprites.enemy(e.type, T, e.wave);
      let pic;
      if (dizzy) pic = set.down;
      else if (e.flash > 0) pic = set.flash;
      else pic = set.walk[Math.floor(((time + e.seed) * 9 / (2 * Math.PI)) * set.walk.length) % set.walk.length];
      let y = e.y + T.r * 0.55;
      if (e.atWall && !dizzy) y += Math.abs(Math.sin(e.bash * 6)) * T.r * 0.05;
      drawSprite(pic, e.x, y, 1.15, dizzy ? e.fade : 0);
      return;
    }
    ctx.save();
    ctx.translate(e.x, e.y);
    if (!dizzy) {
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.beginPath(); ctx.ellipse(0, T.r * 1.05, T.r * 0.9, T.r * 0.25, 0, 0, Math.PI * 2); ctx.fill();
      // Bob while marching, squash when hit.
      if (e.atWall) ctx.translate(0, Math.abs(Math.sin(e.bash * 10)) * T.r * 0.2);
      else ctx.translate(0, T.tank ? 0 : -Math.abs(Math.sin(time * 8 + e.seed)) * T.r * 0.12);
      const sq = e.flash > 0 ? 0.18 : 0;
      ctx.scale(1 + sq, 1 - sq);
    } else {
      ctx.rotate(e.rot);
    }
    if (T.tank) drawTank(T, e, dizzy); else drawPerson(T, e, dizzy);
    ctx.restore();
  }

  function lifeBar(x, y, w, ratio, shown) {
    ctx.fillStyle = "#2b2d42";
    rr(x - w / 2 - 2, y - 2, w + 4, 10, 5); ctx.fill();
    ctx.fillStyle = "#fff3b0";
    rr(x - w / 2, y, w * Math.max(0, shown), 6, 3); ctx.fill();
    ctx.fillStyle = ratio > 0.5 ? "#6bcb77" : ratio > 0.25 ? "#ffd93d" : "#ff6b6b";
    if (ratio > 0) { rr(x - w / 2, y, w * ratio, 6, 3); ctx.fill(); }
  }

  // ---------- Your army ----------

  function drawSoldier(x, y, hero, kick, tier) {
    if (sprites) {
      const set = sprites.friend(tier, hero);
      const pic = set.walk[Math.floor(((time + x * 0.01) * 9 / (2 * Math.PI)) * set.walk.length) % set.walk.length];
      return drawSprite(pic, x, y + 14 + (kick || 0) * 2, 0.8);
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1.3, 1.3);
    const bob = Math.abs(Math.sin(time * 9 + x * 0.1)) * 2;
    ctx.translate(0, -bob + (kick || 0) * 2);
    // Seen from behind: backpack, body, helmet. The hero wears a red cape.
    if (hero) {
      ctx.fillStyle = "#ff6b6b";
      ctx.beginPath(); ctx.moveTo(-9, -4); ctx.lineTo(9, -4); ctx.lineTo(12 + Math.sin(time * 10) * 2, 14); ctx.lineTo(-12, 14); ctx.fill();
    }
    circle(0, 0, hero ? 11 : 9, "#4d96ff");
    ctx.fillStyle = "#7b5e3b";
    rr(-5, -2, 10, 9, 3); ctx.fill();
    circle(0, -8, hero ? 8 : 7, "#2a9d8f");
    ctx.fillStyle = "#21867a";
    ctx.fillRect(hero ? -9 : -8, -9, hero ? 18 : 16, 3);
    weaponIcon(tier, 10, -6, 9);
    ctx.restore();
  }

  // One unit of your army: a soldier holding the weapon, or the machine itself.
  function drawUnit(x, y, hero, kick, tier) {
    if (!WEAPONS[tier].vehicle) return drawSoldier(x, y, hero, kick, tier);
    const bob = Math.sin(time * 6 + x * 0.1) * 2;
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.beginPath(); ctx.ellipse(x, y + 16, 18, 5, 0, 0, Math.PI * 2); ctx.fill();
    weaponIcon(tier, x, y - 2 + bob + kick * 3, 20);
  }

  // Small drawings for each weapon: used in hands, on doors, and as the bullets.
  function weaponIcon(tier, x, y, s, spin) {
    ctx.save();
    ctx.translate(x, y);
    if (spin) ctx.rotate(spin);
    switch (tier) {
      case 0: circle(0, 0, s * 0.55, "#77736b"); circle(-s * 0.15, -s * 0.15, s * 0.18, "#5f5b54"); break;
      case 1:
        ctx.fillStyle = "#8b5a2b"; ctx.fillRect(-s * 0.1, -s * 0.9, s * 0.2, s * 1.8);
        ctx.fillStyle = "#77736b";
        ctx.beginPath(); ctx.moveTo(0, -s * 0.9); ctx.quadraticCurveTo(s * 0.9, -s * 0.8, s * 0.7, -s * 0.1); ctx.lineTo(0, -s * 0.3); ctx.fill();
        break;
      case 2:
        ctx.strokeStyle = "#8b5a2b"; ctx.lineWidth = s * 0.18;
        ctx.beginPath(); ctx.arc(-s * 0.3, 0, s * 0.9, -1.2, 1.2); ctx.stroke();
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-s * 0.3 + Math.cos(-1.2) * s * 0.9, Math.sin(-1.2) * s * 0.9);
        ctx.lineTo(-s * 0.3 + Math.cos(1.2) * s * 0.9, Math.sin(1.2) * s * 0.9); ctx.stroke();
        break;
      case 3: case 4: {
        const one = (ox) => {
          ctx.fillStyle = "#2a2c2e"; rr(ox - s * 0.25, -s * 0.9, s * 0.5, s * 1.3, s * 0.15); ctx.fill();
          ctx.fillStyle = "#45484b"; ctx.fillRect(ox - s * 0.25, -s * 1.05, s * 0.5, s * 0.25);
          ctx.fillStyle = "#3b2f22"; ctx.fillRect(ox - s * 0.2, s * 0.2, s * 0.4, s * 0.6);
        };
        if (tier === 3) one(0); else { one(-s * 0.35); one(s * 0.35); }
        break;
      }
      case 5:
        circle(-s * 0.5, s * 0.5, s * 0.35, "#6c584c"); circle(s * 0.5, s * 0.5, s * 0.35, "#6c584c");
        ctx.fillStyle = "#343a40"; rr(-s * 0.35, -s, s * 0.7, s * 1.5, s * 0.3); ctx.fill();
        break;
      case 6:
        ctx.fillStyle = "#2a2c2e";
        for (let i = -1; i <= 1; i++) ctx.fillRect(i * s * 0.3 - s * 0.1, -s, s * 0.2, s * 1.4);
        ctx.fillStyle = "#3c3f39"; rr(-s * 0.55, s * 0.1, s * 1.1, s * 0.6, s * 0.2); ctx.fill();
        break;
      case 7:
        ctx.fillStyle = "#3d405b"; ctx.fillRect(-s * 0.8, -s * 0.6, s * 0.3, s * 1.3); ctx.fillRect(s * 0.5, -s * 0.6, s * 0.3, s * 1.3);
        ctx.fillStyle = "#5a6b3a"; rr(-s * 0.55, -s * 0.5, s * 1.1, s * 1.1, s * 0.2); ctx.fill();
        ctx.fillStyle = "#4b5a2c"; ctx.fillRect(-s * 0.1, -s * 1.1, s * 0.2, s * 0.8);
        circle(0, 0, s * 0.35, "#4b5a2c");
        break;
      case 8:
        ctx.fillStyle = "#5a6b3a"; rr(-s * 0.25, -s * 0.7, s * 0.5, s * 1.3, s * 0.25); ctx.fill();
        ctx.fillStyle = "#3c3f39"; ctx.beginPath(); ctx.moveTo(-s * 0.25, -s * 0.55); ctx.lineTo(0, -s * 1.1); ctx.lineTo(s * 0.25, -s * 0.55); ctx.fill();
        ctx.fillStyle = "#3c3f39"; ctx.beginPath(); ctx.moveTo(-s * 0.25, s * 0.3); ctx.lineTo(-s * 0.55, s * 0.7); ctx.lineTo(-s * 0.25, s * 0.6); ctx.fill();
        ctx.beginPath(); ctx.moveTo(s * 0.25, s * 0.3); ctx.lineTo(s * 0.55, s * 0.7); ctx.lineTo(s * 0.25, s * 0.6); ctx.fill();
        break;
      case 9:
        ctx.fillStyle = "#7d8580"; rr(-s * 0.18, -s, s * 0.36, s * 1.9, s * 0.18); ctx.fill();
        ctx.fillStyle = "#6b7560";
        ctx.beginPath(); ctx.moveTo(0, -s * 0.3); ctx.lineTo(-s, s * 0.1); ctx.lineTo(-s, s * 0.3); ctx.lineTo(s, s * 0.3); ctx.lineTo(s, s * 0.1); ctx.fill();
        ctx.fillRect(-s * 0.4, s * 0.7, s * 0.8, s * 0.18);
        circle(0, -s * 0.65, s * 0.12, "#90e0ef");
        break;
      case 10:
        ctx.fillStyle = "#1f3550"; ctx.fillRect(-s * 1.1, -s * 0.3, s * 0.7, s * 0.6); ctx.fillRect(s * 0.4, -s * 0.3, s * 0.7, s * 0.6);
        ctx.fillStyle = "#6e7275"; rr(-s * 0.4, -s * 0.45, s * 0.8, s * 0.9, s * 0.2); ctx.fill();
        circle(0, -s * 0.6, s * 0.2, "#ff6b6b");
        break;
      case 11:
        circle(0, 0, s * 0.8, "#2b2d42");
        ctx.fillStyle = "#ffd93d";
        for (let i = 0; i < 3; i++) {
          const a = time * 3 + i * (Math.PI * 2 / 3);
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, s * 0.6, a, a + 0.8); ctx.fill();
        }
        circle(0, 0, s * 0.15, "#ffd93d");
        ctx.strokeStyle = "#e09f00"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, -s * 0.8); ctx.quadraticCurveTo(s * 0.3, -s * 1.2, s * 0.1, -s * 1.4); ctx.stroke();
        circle(s * 0.1, -s * 1.4, 2 + Math.random() * 2, "#ff9f1c");
        break;
    }
    ctx.restore();
  }

  function drawBullet(b) {
    const kind = b.kind;
    if (kind === "stone") return weaponIcon(0, b.x, b.y, 7);
    if (kind === "axe") return weaponIcon(1, b.x, b.y, 10, b.age * 18);
    if (kind === "arrow") {
      ctx.strokeStyle = "#8b5a2b"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x, b.y + 22); ctx.stroke();
      ctx.fillStyle = "#adb5bd"; ctx.beginPath(); ctx.moveTo(b.x - 5, b.y + 2); ctx.lineTo(b.x, b.y - 7); ctx.lineTo(b.x + 5, b.y + 2); ctx.fill();
      ctx.fillStyle = "#d8d2c4"; ctx.fillRect(b.x - 4, b.y + 18, 8, 5);
      return;
    }
    if (kind === "dart") {
      ctx.fillStyle = "#ffd27a"; rr(b.x - 1.5, b.y - 7, 3, 14, 1.5); ctx.fill();
      return;
    }
    if (kind === "pellet") { ctx.fillStyle = "#ffd93d"; rr(b.x - 2.5, b.y - 7, 5, 14, 2.5); ctx.fill(); return; }
    if (kind === "ball") { circle(b.x, b.y, 10, "#2b2d42"); circle(b.x - 3, b.y - 3, 3, "#6c757d"); return; }
    if (kind === "shell") { ctx.fillStyle = "#b08d3c"; rr(b.x - 6, b.y - 12, 12, 22, 6); ctx.fill(); return; }
    if (kind === "missile") {
      circle(b.x, b.y + 16, 5 + Math.random() * 3, "#ff9f1c");
      return weaponIcon(8, b.x, b.y, 12);
    }
    if (kind === "plane") return weaponIcon(9, b.x, b.y, 16);
    if (kind === "laser") {
      ctx.strokeStyle = "rgba(0, 220, 255, 0.5)"; ctx.lineWidth = 12;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x, b.y + 70); ctx.stroke();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x, b.y + 70); ctx.stroke();
      return;
    }
    if (kind === "bomb") return weaponIcon(11, b.x, b.y, 18, Math.sin(b.age * 10) * 0.3);
  }

  // ---------- Doors ----------

  function drawDoor(p, d) {
    const x = d.x0, y = p.y, w = d.x1 - d.x0, h = p.h;
    ctx.save();
    ctx.globalAlpha = d.fade ? Math.max(0, 1 - d.fade * 2) : 1;
    const shake = d.flash ? (Math.random() - 0.5) * 4 : 0;
    ctx.translate(shake, 0);
    const weapon = d.kind === "weapon";
    if (d.kind === "barrier") {
      drawBarrier(d, x, y, w, h);
      ctx.restore();
      return;
    }
    // Frame + panel.
    ctx.fillStyle = "#3a3d40";
    rr(x - 6, y - 6, w + 12, h + 12, 6); ctx.fill();
    const colors = { weapon: "#c9a84a", army: "#8fa7ad", wall: "#b59d7a", shield: "#97a6bd" };
    ctx.fillStyle = d.flash ? "#fff" : colors[d.kind];
    rr(x, y, w, h, 8); ctx.fill();
    circle(x + w - 12, y + h / 2 - 6, 4, "#3a3d40");
    if (d.broken) {
      ctx.fillStyle = "#2b2d42";
      ctx.font = "bold 22px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(t("OPEN!"), x + w / 2, y + h / 2 + 8);
      ctx.restore();
      return;
    }
    // What is behind the door.
    ctx.textAlign = "center";
    ctx.fillStyle = "#2b2d42";
    if (weapon) {
      weaponIcon(d.tier, x + 34, y + 34, 20);
      ctx.font = "bold 20px " + core.FONT;
      ctx.textAlign = "left";
      wrapText(WEAPONS[d.tier].name, x + 64, y + 30, w - 84);
    } else if (d.kind === "army") {
      drawUnit(x + 32, y + 38, false, 0, g.tier);
      ctx.font = "bold 34px " + core.FONT;
      ctx.fillStyle = "#2b2d42";
      ctx.textAlign = "left";
      ctx.fillText("+" + d.amount, x + 62, y + 48);
    } else {
      ctx.font = "34px sans-serif";
      ctx.fillStyle = "#000";
      ctx.fillText(d.kind === "wall" ? "🧱" : "🛡️", x + 32, y + 46);
      ctx.font = "bold 20px " + core.FONT;
      ctx.textAlign = "left";
      wrapText(t(d.kind === "wall" ? "Bigger wall" : "Shield"), x + 64, y + 30, w - 84);
    }
    // How much it still needs.
    const left = Math.max(0, d.hp / d.maxHp);
    lifeBar(x + w / 2 - 18, y + h - 15, w - 56, left, left);
    ctx.font = "bold 15px sans-serif";
    ctx.textAlign = "right";
    ctx.fillStyle = "#2b2d42";
    ctx.fillText(fmt(Math.max(0, d.hp)), x + w - 6, y + h - 6);
    ctx.restore();
  }

  // A tough grey wall where a box is missing: it blocks your shots until you smash it.
  function drawBarrier(d, x, y, w, h) {
    ctx.fillStyle = d.flash ? "#fff" : "#8d99ae";
    rr(x - 4, y, w + 8, h, 6); ctx.fill();
    ctx.strokeStyle = "#5c677d"; ctx.lineWidth = 2;
    for (let row = 0; row < 4; row++) {
      const by = y + row * (h / 4);
      ctx.beginPath(); ctx.moveTo(x - 4, by); ctx.lineTo(x + w + 4, by); ctx.stroke();
      for (let bx = x + (row % 2 ? 20 : 0); bx < x + w; bx += 40) {
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by + h / 4); ctx.stroke();
      }
    }
    const left = Math.max(0, d.hp / d.maxHp);
    lifeBar(x + w / 2 - 18, y + h - 15, w - 56, left, left);
    ctx.font = "bold 15px sans-serif";
    ctx.textAlign = "right";
    ctx.fillStyle = "#fff";
    ctx.fillText(fmt(Math.max(0, d.hp)), x + w - 6, y + h - 6);
  }

  // Breaks between words, or between any two characters for Chinese (no spaces).
  function wrapText(text, x, y, maxW) {
    const sep = text.includes(" ") ? " " : "";
    const words = sep ? text.split(" ") : Array.from(text);
    let line = "";
    words.forEach((word) => {
      const test = line ? line + sep + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, y);
        line = word;
        y += 19;
      } else {
        line = test;
      }
    });
    ctx.fillText(line, x, y);
  }

  // ---------- Scene ----------

  function drawField() {
    const v = view;
    // A meadow all around, and the field reaches past the edges of the screen, as in the 3D view.
    ctx.fillStyle = "#5b6146";
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    const top = Math.min(0, v.y0), bottom = Math.max(H, v.y1);
    ctx.fillStyle = "#6f7a52";
    ctx.fillRect(-20, top, W + 40, bottom - top);
    // Stripes scroll toward you, like the army is running up.
    ctx.fillStyle = "#77825a";
    const off = (time * 40) % 80;
    for (let y = off - 80 * Math.ceil((off - top) / 80); y < bottom; y += 80) ctx.fillRect(-20, y, W + 40, 40);
    if (v.x0 < 0 || v.x1 > W) drawSides();
    // Stones and dark patches of earth.
    for (let i = 0; i < 10; i++) {
      const fx = (i * 97) % W + 10;
      const fy = ((i * 173 + time * 40) % (H + 40)) - 20;
      ctx.fillStyle = i % 2 ? "#6b675e" : "#4d4a3a";
      ctx.beginPath(); ctx.ellipse(fx, fy, i % 2 ? 6 : 16, i % 2 ? 4 : 8, 0, 0, Math.PI * 2); ctx.fill();
    }
    // Sandbag wall: it gets cracks as it gets hurt, and only rubble is left once it breaks.
    const health = g.wall / g.wallMax;
    for (let x = 0, i = 0; x < W + 30; x += 34, i++) {
      if (g.wall <= 0) {
        circle(x + 6, WALL_Y + 4, 6, "#8c7b5a");
        circle(x + 20, WALL_Y + 6, 4, "#6f6249");
        continue;
      }
      ctx.fillStyle = "#8c7b5a";
      rr(x - 4, WALL_Y - 8, 34, 16, 6); ctx.fill();
      ctx.strokeStyle = "#5e533d"; ctx.lineWidth = 2; ctx.stroke();
      if (health < 0.7 && (i * 7) % 3 === 0 || health < 0.35 && i % 2) {
        ctx.beginPath(); ctx.moveTo(x + 6, WALL_Y - 6); ctx.lineTo(x + 12, WALL_Y); ctx.lineTo(x + 8, WALL_Y + 6); ctx.stroke();
      }
    }
    if (g.wall > 0) {
      ctx.font = "16px sans-serif"; ctx.textAlign = "left"; ctx.fillStyle = "#000";
      ctx.fillText("🧱", 8, WALL_Y + 6);
      lifeBar(W / 2 - 50, WALL_Y - 3, W - 160, health, health);
    }
  }

  // Beside the field, as in the 3D view: a fence, a row of trees and streaks of wind, all
  // rolling toward you.
  function drawSides() {
    const v = view;
    const top = Math.min(0, v.y0) - 120, bottom = Math.max(H, v.y1) + 120;
    [-1, 1].forEach((side) => {
      const edge = side < 0 ? 0 : W;
      // Fence: posts with a rail.
      const px = edge + side * 18;
      ctx.fillStyle = "#5c5f60";
      ctx.fillRect(px - 1, top, 2, bottom - top);
      ctx.fillStyle = "#4a3f30";
      for (let y = top + (time * 40) % 60; y < bottom; y += 60) { rr(px - 3, y - 3, 6, 6, 1); ctx.fill(); }
      // Wind streaks.
      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      for (let i = 0; i < 7; i++) {
        const x = edge + side * (6 + ((i * 29) % 50));
        const y = top + ((i * 157 + time * 104) % (bottom - top));
        ctx.fillRect(x - 1, y, 2, 60 + (i % 3) * 30);
      }
      // Trees: one row near the fence, and a few further out. Tree n always looks the same.
      for (let row = 0; row < 2; row++) {
        const gap = row ? 210 : 140;
        const shift = time * 40 + (side > 0 ? gap / 2 : 0) + row * 50;
        for (let n = Math.floor((top - shift) / gap); n * gap + shift < bottom + 80; n++) {
          const k = ((n * 7 + row * 3 + (side > 0 ? 5 : 0)) % 10 + 10) % 10;
          const x = edge + side * (row ? 190 + k * 11 : 70 + ((k * 53) % 60));
          if (side < 0 ? x < v.x0 - 60 : x > v.x1 + 60) continue;
          drawTree(x, n * gap + shift, 0.8 + ((k * 37) % 10) / 20, k % 3 ? "#3f4d33" : "#36442c");
        }
      }
    });
  }

  function drawTree(x, y, s, color) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
    ctx.beginPath(); ctx.ellipse(x, y + 2, 22 * s, 8 * s, 0, 0, Math.PI * 2); ctx.fill();
    // A dark pine.
    ctx.fillStyle = "#3d3226";
    ctx.fillRect(x - 3 * s, y - 20 * s, 6 * s, 22 * s);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(x - 24 * s, y - 14 * s); ctx.lineTo(x, y - 70 * s); ctx.lineTo(x + 24 * s, y - 14 * s); ctx.fill();
    ctx.fillStyle = "#46553a";
    ctx.beginPath(); ctx.moveTo(x - 17 * s, y - 44 * s); ctx.lineTo(x, y - 92 * s); ctx.lineTo(x + 17 * s, y - 44 * s); ctx.fill();
  }

  // On a tall screen the field runs on into the haze above it, so the enemies fade in from far away.
  function drawHaze() {
    const v = view;
    if (v.y0 >= 0) return;
    const fade = Math.min(90, -v.y0);
    const grad = ctx.createLinearGradient(0, -fade, 0, 0);
    grad.addColorStop(0, "rgba(154, 165, 173, 1)");
    grad.addColorStop(1, "rgba(154, 165, 173, 0)");
    ctx.fillStyle = "#9aa5ad";
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, -fade - v.y0);
    ctx.fillStyle = grad;
    ctx.fillRect(v.x0, -fade, v.x1 - v.x0, fade);
  }

  // A tower from your city, standing on the wall with your weapon on top.
  function drawTower(s) {
    const x = s.x, y = s.y;
    ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
    ctx.beginPath(); ctx.ellipse(x, y + 10, 18, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#adb5bd"; rr(x - 13, y - 34, 26, 44, 4); ctx.fill();
    ctx.strokeStyle = "#6c757d"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "#adb5bd";
    for (let k = 0; k < 3; k++) ctx.fillRect(x - 13 + k * 10, y - 40, 6, 7);
    ctx.fillStyle = "#2b2d42"; rr(x - 4, y - 22, 8, 12, 4); ctx.fill();
    weaponIcon(s.tier, x, y - 48, 9);
    lifeBar(x, y - 66, 30, s.hp / s.max, s.hp / s.max); // its own life: the enemy goes for it first
  }

  // Your life gauge along the bottom.
  function drawLife() {
    ctx.font = "16px sans-serif"; ctx.textAlign = "left"; ctx.fillStyle = "#000";
    ctx.fillText("❤️", 8, H - 6);
    const r = Math.max(0, g.life / 100);
    lifeBar(W / 2 - 50, H - 18, W - 160, r, r);
  }

  function drawShield() {
    if (g.shield <= 0 || (g.shield < 2 && Math.floor(time * 8) % 2)) return;
    const top = (g.wall > 0 ? WALL_Y : SQUAD_Y) - 40;
    ctx.fillStyle = "rgba(144, 224, 239, 0.35)";
    ctx.strokeStyle = "rgba(77, 150, 255, 0.8)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, top + 40);
    ctx.quadraticCurveTo(W / 2, top - 20, W, top + 40);
    ctx.lineTo(W, top + 48); ctx.lineTo(0, top + 48);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  }

  // Things the enemy throws at you.
  function drawShot(s) {
    if (s.kind === "stone" || s.kind === "rock") {
      const r = s.kind === "rock" ? 10 : 6;
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.age * 8);
      circle(0, 0, r, "#77736b"); circle(-r * 0.3, -r * 0.3, r * 0.4, "#5f5b54");
      ctx.restore();
    } else if (s.kind === "cork") {
      ctx.fillStyle = "#3a2a1e"; ctx.fillRect(s.x - 1, s.y - 9, 2, 14);
      ctx.fillStyle = "#9ea3a8"; ctx.beginPath(); ctx.moveTo(s.x - 2.5, s.y + 4); ctx.lineTo(s.x + 2.5, s.y + 4); ctx.lineTo(s.x, s.y + 9); ctx.fill();
    } else if (s.kind === "ball") {
      circle(s.x, s.y, 8, "#2b2d42"); circle(s.x - 2, s.y - 2, 2.5, "#6c757d");
    } else {
      const big = s.kind === "bigshell";
      circle(s.x, s.y - (big ? 14 : 10), 4 + Math.random() * 3, "#ff9f1c");
      ctx.fillStyle = big ? "#5e1212" : "#4a4d50";
      rr(s.x - (big ? 7 : 5), s.y - (big ? 10 : 7), big ? 14 : 10, big ? 22 : 16, big ? 7 : 5); ctx.fill();
    }
  }

  // Things that fly (h above the grass) are drawn that much higher up the screen. Words fly less
  // high than in 3D, so they stay close to what they are about.
  function drawFx(only) {
    g.fx.forEach((f) => {
      if (only && f.type !== only) return;
      const k = f.t / f.life;
      const y = f.y - (f.h || 0) * (f.type === "text" ? 0.5 : 1);
      ctx.globalAlpha = Math.max(0, 1 - k);
      if (f.type === "puff") circle(f.x, y, f.r * (1 + k), f.color || "#77736b");
      else if (f.type === "star") circle(f.x, y, 2.5, f.color);
      else if (f.type === "pow") circle(f.x, y, 3 + k * 5, "#ffb347");
      else if (f.type === "boom") {
        circle(f.x, y, f.r * (0.4 + k * 0.8), "#ff9f1c");
        circle(f.x, y, f.r * (0.25 + k * 0.6), "#ffd93d");
        circle(f.x, y, f.r * k * 0.4, "#fff");
      } else if (f.type === "confetti") {
        ctx.save(); ctx.translate(f.x, y); ctx.rotate(f.rot + f.t * 8);
        ctx.fillStyle = f.color; ctx.fillRect(-5, -3, 10, 6); ctx.restore();
      } else if (f.type === "text") {
        ctx.font = "bold " + Math.round(f.size) + "px " + core.FONT;
        ctx.textAlign = "center";
        ctx.lineWidth = 5; ctx.strokeStyle = "#2b2d42";
        ctx.strokeText(f.text, f.x, y);
        ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, y);
      }
    });
    ctx.globalAlpha = 1;
  }

  function star(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rad = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fill();
  }


  function draw() {
    ctx.setTransform(view.k, 0, 0, view.k, view.ox, view.oy);
    ctx.save();
    if (g.shake > 0) ctx.translate((Math.random() - 0.5) * 12 * g.shake, (Math.random() - 0.5) * 12 * g.shake);
    drawField();
    city.towerSpots().forEach(drawTower);

    g.doors.forEach((p) => p.list.forEach((d) => drawDoor(p, d)));

    // Enemies, the ones in front drawn last.
    const sorted = g.enemies.slice().sort((a, b) => a.y - b.y);
    sorted.forEach((e) => drawEnemy(e));
    sorted.forEach((e) => {
      const T = ENEMIES[e.type];
      const bw = Math.max(36, T.r * 1.8);
      const boss = T.r >= 40;
      // Keep the life bar on screen, even while a big boss is still walking in.
      const by = Math.max(boss ? 22 : 4, e.y - T.r - (sprites ? T.r * 0.7 : T.hat === "crown" || T.crown ? T.r * 0.6 : 0) - 16);
      lifeBar(e.x, by, bw, e.hp / e.maxHp, e.shownHp / e.maxHp);
      if (boss) {
        ctx.font = "bold 15px " + core.FONT; ctx.textAlign = "center";
        ctx.lineWidth = 4; ctx.strokeStyle = "#1b1c1e";
        ctx.strokeText(T.name, e.x, by - 6);
        ctx.fillStyle = "#f1e9d8"; ctx.fillText(T.name, e.x, by - 6);
      }
    });

    g.bullets.forEach((b) => {
      if (!b.vx) return drawBullet(b);
      // Tower shots (and shots aimed in FPS) fly at an angle.
      ctx.save();
      ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vx, -b.vy)); ctx.translate(-b.x, -b.y);
      drawBullet(b);
      ctx.restore();
    });
    g.shots.forEach(drawShot);

    squadSpots().forEach((s) => drawUnit(s.x, s.y, s.i === 0, g.kick > 0 ? 1 : 0, g.tier));
    drawShield();
    drawLife();

    // Knocked out: up in the air, and back down with a puff.
    g.tumblers.forEach((t) => drawEnemy({ type: t.type, wave: t.wave, x: t.x, y: t.y - t.h, rot: t.rot, seed: t.seed, flash: 0, fade: t.t / t.life }, true));

    drawFx();
    drawHaze();
    ctx.restore();
  }

  // ---------- Fitting the field on the screen ----------

  // The canvas fills the whole screen. The field (W x H) is as big as it can be: on a tall screen
  // it stands just above the ⬅️ ➡️ buttons, under the top bar; on a wide one it fills the height.
  // k is screen pixels per field unit, and x0..x1, y0..y1 is the part of the world on screen.
  const view = { k: 1, ox: 0, oy: 0, x0: 0, y0: 0, x1: W, y1: H };
  const TOP = 56, BOTTOM = 84;
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    let s, top;
    if (w / W < h / H) {
      s = Math.min(w / W, (h - TOP - BOTTOM) / H);
      top = Math.max(TOP, h - BOTTOM - H * s);
    } else {
      s = h / H;
      top = 0;
    }
    view.k = s * dpr;
    view.ox = ((w - W * s) / 2) * dpr;
    view.oy = top * dpr;
    view.x0 = -view.ox / view.k;
    view.y0 = -view.oy / view.k;
    view.x1 = (canvas.width - view.ox) / view.k;
    view.y1 = (canvas.height - view.oy) / view.k;
  }
  if (window.ResizeObserver) new ResizeObserver(() => { if (!canvas.hidden) resize(); }).observe(stage);
  else window.addEventListener("resize", () => { if (!canvas.hidden) resize(); });

  return {
    show() { canvas.hidden = false; resize(); },
    hide() { canvas.hidden = true; },
    render() {
      g = core.g;
      time = core.time;
      draw();
    },
    // Where your finger is across the field: your army goes there.
    fieldX(e) {
      const rect = canvas.getBoundingClientRect();
      return (((e.clientX - rect.left) / rect.width) * canvas.width - view.ox) / view.k;
    },
  };
};
