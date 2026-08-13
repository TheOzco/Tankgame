// ==============================
// رندر صفحه بازی روی canvas
// شامل: بک‌گراند خاکی کارتونی، موانع، و تانک‌های واقعی (بدنه+برج+لوله) با چرخش
// موقعیت تانک‌ها می‌تونه از ui.animPositions خونده بشه (برای انیمیشن حرکت نرم)
// ==============================

const CELL = 50;
const CANVAS_SIZE = CELL * BOARD_SIZE;

let bgPattern = null;

function buildBackground() {
  const c = document.createElement('canvas');
  c.width = CANVAS_SIZE;
  c.height = CANVAS_SIZE;
  const g = c.getContext('2d');

  g.fillStyle = '#c2a86b';
  g.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  const blotchColors = ['#b89c5e', '#ad9052', '#c9b478', '#a88a4f'];
  for (let i = 0; i < 140; i++) {
    g.fillStyle = blotchColors[Math.floor(Math.random() * blotchColors.length)];
    g.globalAlpha = 0.35;
    const x = Math.random() * CANVAS_SIZE;
    const y = Math.random() * CANVAS_SIZE;
    const r = 6 + Math.random() * 22;
    g.beginPath();
    g.ellipse(x, y, r, r * 0.6, Math.random() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;

  g.strokeStyle = 'rgba(90,70,35,0.25)';
  g.lineWidth = 2;
  for (let i = 0; i < 18; i++) {
    g.beginPath();
    let x = Math.random() * CANVAS_SIZE;
    let y = Math.random() * CANVAS_SIZE;
    g.moveTo(x, y);
    for (let j = 0; j < 4; j++) {
      x += (Math.random() - 0.5) * 40;
      y += (Math.random() - 0.5) * 40;
      g.lineTo(x, y);
    }
    g.stroke();
  }

  bgPattern = c;
}

function drawGrid(ctx) {
  ctx.strokeStyle = 'rgba(60,45,20,0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= BOARD_SIZE; i++) {
    ctx.beginPath();
    ctx.moveTo(i * CELL, 0);
    ctx.lineTo(i * CELL, CANVAS_SIZE);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * CELL);
    ctx.lineTo(CANVAS_SIZE, i * CELL);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(180,40,40,0.55)';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 6]);
  ctx.beginPath();
  ctx.moveTo(0, 5 * CELL);
  ctx.lineTo(CANVAS_SIZE, 5 * CELL);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawBunker(ctx, x, y) {
  const px = x * CELL, py = y * CELL;
  ctx.fillStyle = '#8a7248';
  ctx.strokeStyle = '#5c4a2a';
  ctx.lineWidth = 1.5;
  const bags = [[6, 30, 18, 12], [22, 30, 18, 12], [14, 18, 18, 12]];
  for (const [ox, oy, w, h] of bags) {
    ctx.beginPath();
    ctx.ellipse(px + ox + w / 2, py + oy + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

function drawWire(ctx, x, y) {
  const px = x * CELL, py = y * CELL;
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 2;
  ctx.fillStyle = '#6b4a2a';
  ctx.fillRect(px + 8, py + 10, 4, 30);
  ctx.fillRect(px + 38, py + 10, 4, 30);
  ctx.beginPath();
  ctx.moveTo(px + 6, py + 18);
  for (let i = 0; i < 8; i++) {
    ctx.lineTo(px + 6 + i * 5.5, py + (i % 2 === 0 ? 14 : 24));
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(px + 6, py + 32);
  for (let i = 0; i < 8; i++) {
    ctx.lineTo(px + 6 + i * 5.5, py + (i % 2 === 0 ? 28 : 38));
  }
  ctx.stroke();
}

// زاویه لوله/بدنه بر اساس جهت رو به رو (facing: {dx,dy})
function facingAngle(facing) {
  if (!facing) return Math.PI / 2; // پیش‌فرض رو به پایین
  if (facing.dx === 1) return 0;
  if (facing.dx === -1) return Math.PI;
  if (facing.dy === 1) return Math.PI / 2;
  if (facing.dy === -1) return -Math.PI / 2;
  return Math.PI / 2;
}

// یک تانک واقعی (شاسی + شنی‌ها + برج + لوله) رو در مرکز (cx,cy) با چرخش مشخص رسم می‌کنه
function drawTankShape(ctx, cx, cy, angle, conf, hpRatio, isMine, used, treadPhase) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  const bodyW = 30, bodyH = 20;

  // سایه
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(1, 3, bodyW / 2 + 2, bodyH / 2 + 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // شنی‌ها (تسمه‌های چرخ‌دنده) با انیمیشن حرکت خط‌خطی
  ctx.fillStyle = '#2b2b2b';
  ctx.fillRect(-bodyW / 2 - 2, -bodyH / 2 - 5, bodyW + 4, 5);
  ctx.fillRect(-bodyW / 2 - 2, bodyH / 2, bodyW + 4, 5);
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1;
  for (let i = -bodyW / 2; i < bodyW / 2; i += 5) {
    const off = ((i + treadPhase) % 5 + 5) % 5 - bodyW / 2;
    ctx.beginPath();
    ctx.moveTo(off, -bodyH / 2 - 5);
    ctx.lineTo(off, -bodyH / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(off, bodyH / 2);
    ctx.lineTo(off, bodyH / 2 + 5);
    ctx.stroke();
  }

  // بدنه اصلی
  ctx.fillStyle = conf.color;
  ctx.strokeStyle = isMine ? '#ffd23f' : '#1c1c1c';
  ctx.lineWidth = isMine ? 3 : 1.5;
  ctx.beginPath();
  ctx.roundRect(-bodyW / 2, -bodyH / 2, bodyW, bodyH, 5);
  ctx.fill();
  ctx.stroke();

  // برج (کمی جلوتر از مرکز)
  ctx.fillStyle = shadeColor(conf.color, -15);
  ctx.strokeStyle = '#1c1c1c';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(1, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // لوله توپ
  ctx.fillStyle = '#2b2b2b';
  ctx.fillRect(6, -2.5, 20, 5);
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1;
  ctx.strokeRect(6, -2.5, 20, 5);

  ctx.restore();

  // نوار جون (بدون چرخش، همیشه افقی روی سر تانک)
  const barW = 34;
  ctx.fillStyle = '#2b2b2b';
  ctx.fillRect(cx - barW / 2, cy - CELL / 2 + 3, barW, 5);
  ctx.fillStyle = hpRatio > 0.5 ? '#4caf50' : (hpRatio > 0.25 ? '#ffb300' : '#e53935');
  ctx.fillRect(cx - barW / 2, cy - CELL / 2 + 3, barW * hpRatio, 5);

  if (used) {
    ctx.fillStyle = 'rgba(20,20,20,0.35)';
    ctx.beginPath();
    ctx.arc(cx, cy, CELL / 2 - 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function shadeColor(hex, percent) {
  const num = parseInt(hex.slice(1), 16);
  let r = (num >> 16) + percent;
  let g = ((num >> 8) & 0x00ff) + percent;
  let b = (num & 0x0000ff) + percent;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return '#' + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
}

function drawShotEffect(ctx, effect) {
  const now = performance.now();
  const t = Math.min(1, (now - effect.start) / effect.duration);
  const fx = effect.fromX * CELL + CELL / 2;
  const fy = effect.fromY * CELL + CELL / 2;
  const tx = effect.toX * CELL + CELL / 2;
  const ty = effect.toY * CELL + CELL / 2;
  const bx = fx + (tx - fx) * t;
  const by = fy + (ty - fy) * t;

  ctx.strokeStyle = 'rgba(255,180,40,0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(fx, fy);
  ctx.lineTo(bx, by);
  ctx.stroke();

  ctx.fillStyle = '#ffdd55';
  ctx.beginPath();
  ctx.arc(bx, by, 4, 0, Math.PI * 2);
  ctx.fill();

  if (t >= 1) {
    // انفجار کوچیک در لحظه برخورد
    ctx.fillStyle = 'rgba(255,120,40,0.6)';
    ctx.beginPath();
    ctx.arc(tx, ty, 10, 0, Math.PI * 2);
    ctx.fill();
  }
}

function render(ctx, state, ui, myRole) {
  if (!bgPattern) buildBackground();
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.drawImage(bgPattern, 0, 0);
  drawGrid(ctx);

  if (ui.highlightCells && ui.highlightCells.length) {
    for (const cell of ui.highlightCells) {
      ctx.fillStyle = cell.hasTarget ? 'rgba(220,40,40,0.35)' : 'rgba(255,215,0,0.35)';
      ctx.fillRect(cell.x * CELL + 2, cell.y * CELL + 2, CELL - 4, CELL - 4);
    }
  }
  if (ui.placementCells && ui.placementCells.length) {
    for (const cell of ui.placementCells) {
      ctx.fillStyle = 'rgba(80,180,255,0.25)';
      ctx.fillRect(cell.x * CELL + 2, cell.y * CELL + 2, CELL - 4, CELL - 4);
    }
  }

  for (const obs of state.obstacles) {
    if (obs.type === 'bunker') drawBunker(ctx, obs.x, obs.y);
    else drawWire(ctx, obs.x, obs.y);
  }

  const treadPhase = ui.treadPhase || 0;

  for (const tank of state.tanks) {
    if (!tank.alive) continue;
    const conf = TANK_TYPES[tank.type];
    const pos = (ui.animPositions && ui.animPositions[tank.id]) || { x: tank.x, y: tank.y };
    const cx = pos.x * CELL + CELL / 2;
    const cy = pos.y * CELL + CELL / 2;
    const angle = facingAngle(tank.facing);
    const isMine = tank.owner === myRole;
    drawTankShape(ctx, cx, cy, angle, conf, tank.hp / conf.hp, isMine, tank.used, treadPhase);

    if (ui.selectedTankId === tank.id) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(tank.x * CELL + 3, tank.y * CELL + 3, CELL - 6, CELL - 6);
      ctx.setLineDash([]);
    }
  }

  if (ui.shotEffects && ui.shotEffects.length) {
    for (const eff of ui.shotEffects) drawShotEffect(ctx, eff);
  }
}
