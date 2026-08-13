// ==============================
// منطق خالص بازی (بدون شبکه و بدون رندر)
// ==============================

const BOARD_SIZE = 10;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function inBounds(x, y) {
  return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
}

function cellKey(x, y) {
  return x + ',' + y;
}

function getObstacleAt(state, x, y) {
  return state.obstacles.find(o => o.x === x && o.y === y);
}

function getTankAt(state, x, y) {
  return state.tanks.find(t => t.alive && t.x === x && t.y === y);
}

// موانع رندوم می‌سازه؛ دو ردیف نزدیک به هر بازیکن رو خالی نگه می‌داره
// تا چیدمان اولیه همیشه امکان‌پذیر باشه
function generateObstacles() {
  const obstacles = [];
  const used = new Set();
  const count = 14;
  const types = ['bunker', 'wire'];
  let attempts = 0;
  while (obstacles.length < count && attempts < 1000) {
    attempts++;
    const x = Math.floor(Math.random() * BOARD_SIZE);
    const y = Math.floor(Math.random() * BOARD_SIZE);
    if (y <= 1 || y >= 8) continue;
    const key = cellKey(x, y);
    if (used.has(key)) continue;
    used.add(key);
    const type = types[Math.floor(Math.random() * types.length)];
    obstacles.push({ x, y, type });
  }
  return obstacles;
}

function getValidPlacementCells(state, owner, placedSoFar) {
  const rows = owner === 'player1' ? [0, 1, 2, 3, 4] : [5, 6, 7, 8, 9];
  const cells = [];
  for (const y of rows) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (getObstacleAt(state, x, y)) continue;
      if (getTankAt(state, x, y)) continue;
      if (placedSoFar && placedSoFar.some(t => t.x === x && t.y === y)) continue;
      cells.push({ x, y });
    }
  }
  return cells;
}

// خونه‌هایی که یک تانک می‌تونه بهشون حرکت کنه (فقط خط راست افقی/عمودی)
function getValidMoveCells(state, tank) {
  const results = [];
  for (const [dx, dy] of DIRS) {
    for (let step = 1; step <= tank.move; step++) {
      const x = tank.x + dx * step;
      const y = tank.y + dy * step;
      if (!inBounds(x, y)) break;
      if (getObstacleAt(state, x, y)) break;
      if (getTankAt(state, x, y)) break;
      results.push({ x, y });
    }
  }
  return results;
}

// خونه‌هایی که یک تانک می‌تونه بهشون شلیک کنه
function getValidShootCells(state, tank) {
  const results = [];
  for (const [dx, dy] of DIRS) {
    for (let step = 1; step <= tank.range; step++) {
      const x = tank.x + dx * step;
      const y = tank.y + dy * step;
      if (!inBounds(x, y)) break;
      const obs = getObstacleAt(state, x, y);
      if (obs && obs.type === 'bunker') break; // سنگر جلوی دید رو می‌گیره
      const target = getTankAt(state, x, y);
      if (target) {
        results.push({ x, y, hasTarget: true });
        break; // نمیشه از روی یه تانک، تانک پشتش رو زد
      }
      results.push({ x, y, hasTarget: false }); // سیم خاردار جلوی شلیک رو نمی‌گیره
    }
  }
  return results;
}

function applyMove(state, tankId, x, y) {
  const tank = state.tanks.find(t => t.id === tankId);
  tank.x = x;
  tank.y = y;
  tank.used = true;
}

function applyShoot(state, tankId, x, y) {
  const tank = state.tanks.find(t => t.id === tankId);
  const target = getTankAt(state, x, y);
  tank.used = true;
  if (target) {
    target.hp -= tank.damage;
    if (target.hp <= 0) {
      target.hp = 0;
      target.alive = false;
    }
  }
  return target || null;
}

function checkWinner(state) {
  const p1Alive = state.tanks.some(t => t.owner === 'player1' && t.alive);
  const p2Alive = state.tanks.some(t => t.owner === 'player2' && t.alive);
  if (!p1Alive) return 'player2';
  if (!p2Alive) return 'player1';
  return null;
}

function endTurn(state) {
  state.turn = state.turn === 'player1' ? 'player2' : 'player1';
  state.tanks.forEach(t => { t.used = false; });
}

function buildTanksFromPlacement(owner, placedList) {
  return placedList.map((p, idx) => ({
    id: owner + '_' + p.typeKey + '_' + idx,
    owner,
    type: p.typeKey,
    x: p.x,
    y: p.y,
    hp: TANK_TYPES[p.typeKey].hp,
    alive: true,
    used: false
  }));
}
