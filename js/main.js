// ==============================
// اتصال همه چیز به هم: UI + شبکه + منطق بازی + رندر
// ==============================

const net = new Network();
let myRole = null; // 'player1' (میزبان) یا 'player2' (مهمان)
let state = null;

// وضعیت محلی UI (سینک نمی‌شه، فقط برای تعامل کاربر)
const ui = {
  selectedTankId: null,
  selectedAction: null, // 'move' | 'shoot'
  highlightCells: [],
  placementCells: [],
  placementIndex: 0,
  myPlacedTanks: [], // {typeKey, x, y}
  placementReady: false,
  opponentPlacementDone: false
};

const $ = id => document.getElementById(id);
const canvas = $('board');
const ctx = canvas.getContext('2d');

// ---------- انیمیشن (حرکت نرم تانک‌ها + جلوه شلیک) ----------
// موقعیت واقعی تانک‌ها روی state.tanks[].x/y هست (بدون واحد کسری)؛
// این آبجکت موقعیت «نمایشی» و لرپ‌شده رو نگه می‌داره تا حرکت روی صفحه نرم دیده بشه
let animPositions = {};
let shotEffects = [];
let treadPhase = 0;
let lastProcessedEffectTs = 0;
let lastFrameTime = null;

function animLoop(ts) {
  requestAnimationFrame(animLoop);
  if (!state || state.phase !== 'battle') { lastFrameTime = ts; return; }
  if (lastFrameTime === null) lastFrameTime = ts;
  const dt = Math.min(0.05, (ts - lastFrameTime) / 1000);
  lastFrameTime = ts;

  // اگه شلیک جدیدی توی state ثبت شده، جلوه گلوله رو بساز
  if (state.lastEffect && state.lastEffect.ts !== lastProcessedEffectTs) {
    lastProcessedEffectTs = state.lastEffect.ts;
    if (state.lastEffect.type === 'shoot') {
      shotEffects.push({
        fromX: state.lastEffect.fromX,
        fromY: state.lastEffect.fromY,
        toX: state.lastEffect.x,
        toY: state.lastEffect.y,
        start: performance.now(),
        duration: 300
      });
    }
  }
  shotEffects = shotEffects.filter(e => performance.now() - e.start < e.duration + 150);

  // لرپ نرم موقعیت هر تانک به سمت مختصات واقعیش (انیمیشن حرکت)
  const speed = 7; // خونه بر ثانیه
  let anyMoving = false;
  for (const tank of state.tanks) {
    if (!tank.alive) continue;
    let p = animPositions[tank.id];
    if (!p) { p = { x: tank.x, y: tank.y }; animPositions[tank.id] = p; }
    const dx = tank.x - p.x, dy = tank.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0.01) {
      anyMoving = true;
      const step = speed * dt;
      if (step >= dist) { p.x = tank.x; p.y = tank.y; }
      else { p.x += (dx / dist) * step; p.y += (dy / dist) * step; }
    }
  }
  if (anyMoving) treadPhase += dt * 40;

  ui.animPositions = animPositions;
  ui.shotEffects = shotEffects;
  ui.treadPhase = treadPhase;
  render(ctx, state, ui, myRole);
}
requestAnimationFrame(animLoop);

// ---------- ناوبری بین صفحات ----------
function showScreen(name) {
  ['screen-menu', 'screen-host-wait', 'screen-join', 'screen-battlefield', 'screen-over']
    .forEach(id => $(id).classList.add('hidden'));
  $(name).classList.remove('hidden');
}

// ---------- منو ----------
$('btn-host').addEventListener('click', () => {
  showScreen('screen-host-wait');
  $('host-id-box').textContent = 'در حال ساخت اتاق...';
  net.hostGame(id => {
    $('host-id-box').textContent = id;
  });
  net.onConnected = () => {
    myRole = 'player1';
    startInitAsHost();
  };
});

$('btn-join').addEventListener('click', () => {
  showScreen('screen-join');
});

$('btn-join-confirm').addEventListener('click', () => {
  const code = $('join-code-input').value.trim();
  if (!code) return;
  $('join-status').textContent = 'در حال اتصال...';
  net.joinGame(code);
  net.onConnected = () => {
    myRole = 'player2';
    $('join-status').textContent = 'متصل شد! منتظر شروع بازی...';
  };
  net.onError = () => {
    $('join-status').textContent = 'اتصال ناموفق بود، دوباره تلاش کن.';
  };
});

net.onMessage = msg => handleMessage(msg);

function handleMessage(msg) {
  if (msg.type === 'INIT') {
    state = {
      turn: 'player1',
      phase: 'placement',
      obstacles: msg.obstacles,
      tanks: []
    };
    beginPlacementPhase();
  } else if (msg.type === 'PLACEMENT') {
    // فقط میزبان این رو دریافت می‌کنه
    handlePlacementFromGuest(msg.tanks);
  } else if (msg.type === 'GAME_START') {
    state = msg.state;
    enterBattleUI();
    renderAll();
  } else if (msg.type === 'STATE_UPDATE') {
    state = msg.state;
    ui.selectedTankId = null;
    ui.selectedAction = null;
    ui.highlightCells = [];
    renderAll();
    checkGameOver();
  } else if (msg.type === 'ACTION_REQUEST') {
    // فقط میزبان این رو دریافت می‌کنه
    handleActionRequest(msg);
  } else if (msg.type === 'END_TURN_REQUEST') {
    endTurn(state);
    broadcastState();
  }
}

// ---------- شروع بازی توسط میزبان ----------
function startInitAsHost() {
  const obstacles = generateObstacles();
  state = { turn: 'player1', phase: 'placement', obstacles, tanks: [] };
  net.send({ type: 'INIT', obstacles });
  beginPlacementPhase();
}

// ---------- فاز چیدمان ----------
function beginPlacementPhase() {
  showScreen('screen-battlefield');
  $('placement-instruction').classList.remove('hidden');
  $('btn-placement-ready').classList.remove('hidden');
  $('turn-indicator').classList.add('hidden');
  $('side-panel').classList.add('hidden');
  ui.placementIndex = 0;
  ui.myPlacedTanks = [];
  ui.placementReady = false;
  ui.opponentPlacementDone = false;
  updatePlacementUI();
  drawPlacementBoard();
}

function updatePlacementUI() {
  if (ui.placementIndex >= ROSTER.length) {
    $('placement-instruction').textContent = 'همه تانک‌هات رو چیدی! منتظر بمون یا دکمه آماده رو بزن.';
    $('btn-placement-ready').classList.remove('hidden');
  } else {
    const typeKey = ROSTER[ui.placementIndex];
    const conf = TANK_TYPES[typeKey];
    $('placement-instruction').textContent =
      `${conf.icon} محل قرارگیری «${conf.name}» رو در نیمه خودت انتخاب کن (جون:${conf.hp} | دمیج:${conf.damage} | حرکت:${conf.move} | برد:${conf.range})`;
    $('btn-placement-ready').classList.add('hidden');
  }
}

function drawPlacementBoard() {
  const fakeState = { obstacles: state.obstacles, tanks: ui.myPlacedTanks.map((p, i) => ({
    id: 'tmp' + i, owner: myRole, type: p.typeKey, x: p.x, y: p.y, hp: TANK_TYPES[p.typeKey].hp, alive: true, used: false
  })) };
  ui.placementCells = ui.placementIndex < ROSTER.length
    ? getValidPlacementCells(fakeState, myRole, ui.myPlacedTanks)
    : [];
  ui.highlightCells = [];
  render(ctx, fakeState, ui, myRole);
}

canvas.addEventListener('click', e => {
  if (!state) return;
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / (rect.width / BOARD_SIZE));
  const y = Math.floor((e.clientY - rect.top) / (rect.height / BOARD_SIZE));

  if (state.phase === 'placement') {
    onPlacementClick(x, y);
  } else if (state.phase === 'battle') {
    onBattleClick(x, y);
  }
});

function onPlacementClick(x, y) {
  if (ui.placementIndex >= ROSTER.length) return;
  const valid = ui.placementCells.some(c => c.x === x && c.y === y);
  if (!valid) return;
  ui.myPlacedTanks.push({ typeKey: ROSTER[ui.placementIndex], x, y });
  ui.placementIndex++;
  updatePlacementUI();
  drawPlacementBoard();
}

$('btn-placement-ready').addEventListener('click', () => {
  ui.placementReady = true;
  $('placement-instruction').textContent = 'منتظر آماده شدن حریف...';
  $('btn-placement-ready').classList.add('hidden');
  if (myRole === 'player1') {
    handlePlacementFromGuest(null, true); // خود میزبان آماده شد
  } else {
    net.send({ type: 'PLACEMENT', tanks: ui.myPlacedTanks });
  }
});

// وضعیت روی میزبان برای هماهنگی دو چیدمان
let hostPlacements = { player1: null, player2: null };

function handlePlacementFromGuest(guestTanks, isSelfReady) {
  if (myRole !== 'player1') return;
  if (isSelfReady) {
    hostPlacements.player1 = ui.myPlacedTanks;
  } else {
    hostPlacements.player2 = guestTanks;
  }
  if (hostPlacements.player1 && hostPlacements.player2) {
    const p1Tanks = buildTanksFromPlacement('player1', hostPlacements.player1);
    const p2Tanks = buildTanksFromPlacement('player2', hostPlacements.player2);
    state.tanks = [...p1Tanks, ...p2Tanks];
    state.phase = 'battle';
    state.turn = 'player1';
    net.send({ type: 'GAME_START', state });
    enterBattleUI();
    renderAll();
  }
}

function enterBattleUI() {
  showScreen('screen-battlefield');
  $('placement-instruction').classList.add('hidden');
  $('btn-placement-ready').classList.add('hidden');
  $('turn-indicator').classList.remove('hidden');
  $('side-panel').classList.remove('hidden');
}

// ---------- فاز نبرد ----------
function isMyTurn() {
  return state && state.phase === 'battle' && state.turn === myRole;
}

function onBattleClick(x, y) {
  if (!isMyTurn()) return;

  if (!ui.selectedTankId) {
    const tank = getTankAt(state, x, y);
    if (tank && tank.owner === myRole && !tank.used) {
      ui.selectedTankId = tank.id;
      ui.selectedAction = null;
      ui.highlightCells = [];
      updateBattleActionButtons(tank);
      renderAll();
    }
    return;
  }

  // اگر تانک انتخاب شده و کاربر روی خونه هایلایت‌شده کلیک کنه
  if (ui.selectedAction) {
    const cell = ui.highlightCells.find(c => c.x === x && c.y === y);
    if (!cell) return;
    performAction(ui.selectedTankId, ui.selectedAction, x, y);
  }
}

function updateBattleActionButtons(tank) {
  $('battle-tank-info').textContent =
    `${TANK_TYPES[tank.type].icon} ${TANK_TYPES[tank.type].name} - جون: ${tank.hp}`;
  $('battle-actions').classList.remove('hidden');
}

$('btn-action-move').addEventListener('click', () => {
  if (!ui.selectedTankId) return;
  const tank = state.tanks.find(t => t.id === ui.selectedTankId);
  ui.selectedAction = 'move';
  ui.highlightCells = getValidMoveCells(state, tank);
  renderAll();
});

$('btn-action-shoot').addEventListener('click', () => {
  if (!ui.selectedTankId) return;
  const tank = state.tanks.find(t => t.id === ui.selectedTankId);
  ui.selectedAction = 'shoot';
  ui.highlightCells = getValidShootCells(state, tank);
  renderAll();
});

$('btn-action-cancel').addEventListener('click', () => {
  ui.selectedTankId = null;
  ui.selectedAction = null;
  ui.highlightCells = [];
  $('battle-actions').classList.add('hidden');
  renderAll();
});

$('btn-end-turn').addEventListener('click', () => {
  if (!isMyTurn()) return;
  ui.selectedTankId = null;
  ui.selectedAction = null;
  ui.highlightCells = [];
  $('battle-actions').classList.add('hidden');
  if (myRole === 'player1') {
    endTurn(state);
    broadcastState();
    renderAll();
  } else {
    net.send({ type: 'END_TURN_REQUEST' });
  }
});

function performAction(tankId, action, x, y) {
  if (myRole === 'player1') {
    applyLocalAction(tankId, action, x, y);
  } else {
    net.send({ type: 'ACTION_REQUEST', action, tankId, x, y });
    ui.selectedTankId = null;
    ui.selectedAction = null;
    ui.highlightCells = [];
    $('battle-actions').classList.add('hidden');
    renderAll();
  }
}

function applyLocalAction(tankId, action, x, y) {
  if (action === 'move') applyMove(state, tankId, x, y);
  else if (action === 'shoot') applyShoot(state, tankId, x, y);
  ui.selectedTankId = null;
  ui.selectedAction = null;
  ui.highlightCells = [];
  $('battle-actions').classList.add('hidden');
  broadcastState();
  renderAll();
  checkGameOver();
}

function handleActionRequest(msg) {
  if (myRole !== 'player1') return;
  if (state.turn !== 'player2') return;
  const tank = state.tanks.find(t => t.id === msg.tankId);
  if (!tank || tank.used || tank.owner !== 'player2') return;
  applyLocalAction(msg.tankId, msg.action, msg.x, msg.y);
}

function broadcastState() {
  net.send({ type: 'STATE_UPDATE', state });
}

function checkGameOver() {
  const winner = checkWinner(state);
  if (winner) {
    state.phase = 'gameover';
    showScreen('screen-over');
    $('over-text').textContent = winner === myRole ? '🎉 تو برنده شدی!' : '💥 حریف برنده شد!';
  }
}

// ---------- رندر عمومی ----------
function renderAll() {
  if (!state) return;
  $('turn-indicator').textContent = state.turn === myRole ? 'نوبت توئه!' : 'نوبت حریف...';
  $('turn-indicator').className = state.turn === myRole ? 'my-turn' : 'their-turn';
  // خود صفحه توسط animLoop به‌صورت پیوسته رسم می‌شه (برای انیمیشن نرم)
  renderTankList();
}

function renderTankList() {
  const list = $('my-tanks-list');
  list.innerHTML = '';
  if (!state) return;
  state.tanks.filter(t => t.owner === myRole).forEach(t => {
    const conf = TANK_TYPES[t.type];
    const li = document.createElement('li');
    li.className = t.alive ? (t.used ? 'used' : '') : 'dead';
    li.textContent = `${conf.icon} ${conf.name}: ${t.alive ? t.hp + '❤' : 'نابود شد'}`;
    list.appendChild(li);
  });
}

$('btn-restart').addEventListener('click', () => location.reload());
