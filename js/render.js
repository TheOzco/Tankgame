// ==============================
// رندر صفحه بازی روی canvas
// ==============================

const CELL = 50;
const CANVAS_SIZE = CELL * BOARD_SIZE;

let bgPattern = null;

function buildBackground() {
  // یک بار یک بک‌گراند خاکی کارتونی رندوم می‌سازیم و کش می‌کنیم
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

  // چند ترک/شیار به زمین اضافه می‌کنیم
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
  // خط وسط میدون که نیمه‌ها رو جدا می‌کنه
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
  // دو تیر چوبی
  ctx.fillStyle = '#6b4a2a';
  ctx.fillRect(px + 8, py + 10, 4, 30);
  ctx.fillRect(px + 38, py + 10, 4, 30);
  // سیم زیگزاگ
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

function drawTank(ctx, tank, isMine) {
  const conf = TANK_TYPES[tank.type];
  const px = tank.x * CELL, py = tank.y * CELL;
  const cx = px + CELL / 2, cy = py + CELL / 2;

  // بدنه
  ctx.fillStyle = conf.color;
  ctx.strokeStyle = isMine ? '#ffd23f' : '#222';
  ctx.lineWidth = isMine ? 3 : 2;
  ctx.beginPath();
  ctx.roundRect(px + 7, py + 10, CELL - 14, CELL - 20, 6);
  ctx.fill();
  ctx.stroke();

  // برج تانک
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fill();

  // آیکن نوع
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(conf.icon, cx, cy - 12);

  // نوار جون
  const maxHp = conf.hp;
  const barW = CELL - 16;
  ctx.fillStyle = '#2b2b2b';
  ctx.fillRect(px + 8, py + CELL - 9, barW, 5);
  ctx.fillStyle = tank.hp > maxHp / 2 ? '#4caf50' : (tank.hp > 1 ? '#ffb300' : '#e53935');
  ctx.fillRect(px + 8, py + CELL - 9, barW * (tank.hp / maxHp), 5);

  if (tank.used) {
    ctx.fillStyle = 'rgba(20,20,20,0.35)';
    ctx.beginPath();
    ctx.roundRect(px + 7, py + 10, CELL - 14, CELL - 20, 6);
    ctx.fill();
  }
}

function render(ctx, state, ui, myRole) {
  if (!bgPattern) buildBackground();
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.drawImage(bgPattern, 0, 0);
  drawGrid(ctx);

  // هایلایت خونه‌های قابل انتخاب
  if (ui.highlightCells && ui.highlightCells.length) {
    for (const cell of ui.highlightCells) {
      ctx.fillStyle = cell.hasTarget ? 'rgba(220,40,40,0.35)' : 'rgba(255,215,0,0.35)';
      ctx.fillRect(cell.x * CELL + 2, cell.y * CELL + 2, CELL - 4, CELL - 4);
    }
  }
  // هایلایت خونه‌های چیدمان مجاز
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

  for (const tank of state.tanks) {
    if (!tank.alive) continue;
    drawTank(ctx, tank, tank.owner === myRole);
    if (ui.selectedTankId === tank.id) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.strokeRect(tank.x * CELL + 3, tank.y * CELL + 3, CELL - 6, CELL - 6);
    }
  }
}
