const state = { mode: 'idle', remaining: 45 * 60, duration: 45 * 60, completed: 0, goal: 6, snoozes: 1, interval: null, endAt: null, waterMl: 0, waterDate: null, waterReminderEnabled: true, waterReminderMinutes: 60, nextWaterReminderAt: null };
const activities = [
  ['01', '走到窗边，看向远处', '让眼睛和颈部一起离开屏幕', '60 秒'],
  ['02', '肩膀绕环 10 次', '放松肩颈，动作缓慢即可', '45 秒'],
  ['03', '坐姿收下巴 8 次', '轻轻向后收下巴，颈部保持放松', '40 秒'],
  ['04', '脚踝画圈', '双脚不离地，左右各绕 10 圈', '45 秒'],
  ['05', '肩胛骨轻轻后夹', '双臂自然下垂，肩膀向后向下', '30 秒'],
  ['06', '手腕与手指伸展', '掌心向外轻推，左右手各停 15 秒', '1 分钟'],
  ['07', '原地踮脚', '扶着桌边，缓慢踮起再放下 12 次', '45 秒'],
  ['08', '看向远处并深呼吸', '视线离开屏幕，做 4 次缓慢呼吸', '1 分钟']
];
const $ = (id) => document.getElementById(id);
const fmt = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`;
const readStoredJson = (key, fallback) => { try { const raw = localStorage.getItem(key); const parsed = raw ? JSON.parse(raw) : fallback; return parsed && typeof parsed === 'object' ? parsed : fallback; } catch { return fallback; } };
const storageKey = 'stand-up-today';
const timerStorageKey = 'stand-up-active-timer';
const waterStorageKey = 'water-today';
const waterSettingsKey = 'water-reminder-settings';
const WATER_GOAL_ML = 2000;
const WATER_CUP_ML = 200;
const WATER_CUPS = WATER_GOAL_ML / WATER_CUP_ML;
const WATER_INTERVALS = [1, 30, 45, 60, 90, 120];

function loadProgress() { const saved = JSON.parse(localStorage.getItem(storageKey) || '{}'); if (saved.date === new Date().toDateString()) state.completed = saved.completed || 0; }
function persistProgress() { localStorage.setItem(storageKey, JSON.stringify({date:new Date().toDateString(), completed:state.completed})); }
function persistTimer() {
  localStorage.setItem(timerStorageKey, JSON.stringify({
    mode: state.mode, duration: state.duration, remaining: state.remaining,
    endAt: state.endAt, snoozes: state.snoozes
  }));
}
function updateDashboard() {
  $('countdown').textContent = fmt(state.remaining);
  $('ringProgress').style.strokeDashoffset = 603.19 * (1 - state.remaining / state.duration);
  $('completedCount').textContent = state.completed;
  $('goalText').textContent = `${state.completed} / ${state.goal}`;
  $('goalProgress').style.width = `${Math.min(100, state.completed / state.goal * 100)}%`;
  $('streakLabel').textContent = state.completed >= state.goal ? '今日达成' : `还差 ${Math.max(0, state.goal - state.completed)} 次`;
}
function tick() { state.remaining = Math.max(0, Math.ceil((state.endAt - Date.now()) / 1000)); updateDashboard(); if (state.remaining <= 0) startBreak(); }
function beginTimer() { state.mode = 'working'; state.endAt = Date.now() + state.remaining * 1000; $('mainTimerButton').textContent = '暂停'; $('sessionLabel').textContent = '正在专注'; $('timerMessage').textContent = '保持当前节奏'; persistTimer(); state.interval = setInterval(tick, 1000); }
function pauseTimer() { state.remaining = Math.max(0, Math.ceil((state.endAt - Date.now()) / 1000)); clearInterval(state.interval); state.endAt = null; state.mode = 'paused'; $('mainTimerButton').textContent = '继续'; $('sessionLabel').textContent = '已暂停'; updateDashboard(); persistTimer(); }
function chime() { if (!$('soundToggle').checked) return; const ctx = new AudioContext(); [0, .17].forEach((offset, i) => { const osc=ctx.createOscillator(), gain=ctx.createGain(); osc.frequency.value = i ? 660 : 523; gain.gain.setValueAtTime(.22,ctx.currentTime+offset); gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+offset+.35); osc.connect(gain).connect(ctx.destination); osc.start(ctx.currentTime+offset); osc.stop(ctx.currentTime+offset+.36); }); }
function startBreak() { clearInterval(state.interval); localStorage.removeItem(timerStorageKey); state.mode = 'break'; state.endAt = null; state.remaining = Number($('breakDuration').value) * 60; const activity = activities[Math.floor(Math.random() * activities.length)]; $('breakTitle').textContent = activity[1]; $('breakInstruction').textContent = activity[2]; $('breakCountdown').textContent = fmt(state.remaining); $('breakDialog').showModal(); chime(); navigator.vibrate?.([180, 80, 180]); if (Notification.permission === 'granted') new Notification('该起来活动了', { body:`试试：${activity[1]}` }); state.interval = setInterval(() => { state.remaining--; $('breakCountdown').textContent = fmt(Math.max(0,state.remaining)); if (state.remaining <= 0) clearInterval(state.interval); }, 1000); }
function completeBreak() { clearInterval(state.interval); $('breakDialog').close(); state.completed++; persistProgress(); resetTimer(); $('suggestionTitle').textContent = state.completed >= state.goal ? '今天的目标完成了' : '做得好，准备下一轮'; $('suggestionText').textContent = state.completed >= state.goal ? '保持轻松节奏，身体会记得这份照顾。' : '回到工作前，先喝一口水，再开始。'; updateDashboard(); }
function resetTimer() { clearInterval(state.interval); localStorage.removeItem(timerStorageKey); state.duration = Number($('workDuration').value) * 60; state.remaining = state.duration; state.endAt = null; state.mode = 'idle'; $('mainTimerButton').textContent = '开始这一轮'; $('sessionLabel').textContent = '本轮专注'; $('timerMessage').textContent = '距离下一次活动'; updateDashboard(); }
function restoreTimer() {
  const saved = JSON.parse(localStorage.getItem(timerStorageKey) || 'null');
  if (!saved || !['working', 'paused'].includes(saved.mode)) return;
  state.mode = saved.mode; state.duration = saved.duration; state.remaining = saved.remaining; state.endAt = saved.endAt; state.snoozes = saved.snoozes ?? 1;
  $('workDuration').value = String(state.duration / 60);
  if (state.mode === 'working') {
    state.remaining = Math.max(0, Math.ceil((state.endAt - Date.now()) / 1000));
    if (state.remaining <= 0) return startBreak();
    $('mainTimerButton').textContent = '暂停'; $('sessionLabel').textContent = '正在专注'; $('timerMessage').textContent = '保持当前节奏'; state.interval = setInterval(tick, 1000);
  } else { $('mainTimerButton').textContent = '继续'; $('sessionLabel').textContent = '已暂停'; }
  updateDashboard();
}
function loadWater() { state.waterDate = new Date().toDateString(); const saved = readStoredJson(waterStorageKey, {}); if (saved.date === state.waterDate) state.waterMl = Math.min(WATER_GOAL_ML, Math.max(0, Number(saved.ml) || 0)); }
function persistWater() { localStorage.setItem(waterStorageKey, JSON.stringify({ date: state.waterDate || new Date().toDateString(), ml: state.waterMl })); }
function ensureWaterDay() {
  const today = new Date().toDateString();
  if (state.waterDate === today) return false;
  state.waterDate = today;
  state.waterMl = 0;
  persistWater();
  updateWater();
  restartWaterReminderCountdown();
  return true;
}
function loadWaterSettings() {
  const saved = readStoredJson(waterSettingsKey, {});
  state.waterReminderEnabled = saved.enabled !== false;
  state.waterReminderMinutes = WATER_INTERVALS.includes(Number(saved.minutes)) ? Number(saved.minutes) : 60;
  $('waterReminderToggle').checked = state.waterReminderEnabled;
  $('waterReminderInterval').value = String(state.waterReminderMinutes);
}
function persistWaterSettings() { localStorage.setItem(waterSettingsKey, JSON.stringify({ enabled: state.waterReminderEnabled, minutes: state.waterReminderMinutes })); }
function renderCups() {
  const grid = $('cupGrid');
  if (grid.children.length !== WATER_CUPS) grid.innerHTML = Array.from({ length: WATER_CUPS }, () => '<span class="cup"><i></i></span>').join('');
  const filled = Math.min(WATER_CUPS, Math.floor(state.waterMl / WATER_CUP_ML));
  Array.from(grid.children).forEach((cup, index) => cup.classList.toggle('is-filled', index < filled));
}
function updateWater() {
  const cups = Math.min(WATER_CUPS, Math.floor(state.waterMl / WATER_CUP_ML));
  const reached = state.waterMl >= WATER_GOAL_ML;
  $('waterAmount').textContent = (state.waterMl / 1000).toFixed(1);
  $('waterCupLabel').textContent = `${cups} / ${WATER_CUPS} 杯`;
  $('waterProgress').style.width = `${Math.min(100, state.waterMl / WATER_GOAL_ML * 100)}%`;
  $('waterStatus').textContent = reached ? '今天的水喝够了 ✓' : `还差 ${WATER_CUPS - cups} 杯`;
  $('waterCard').classList.toggle('is-complete', reached);
  $('drinkButton').disabled = reached;
  $('drinkButton').textContent = reached ? '今日已达标 ✓' : '+ 喝水 200ml';
  $('undoDrinkButton').disabled = state.waterMl <= 0;
  renderCups();
}
function drinkWater() {
  ensureWaterDay();
  if (state.waterMl >= WATER_GOAL_ML) return;
  state.waterMl = Math.min(WATER_GOAL_ML, state.waterMl + WATER_CUP_ML);
  persistWater();
  updateWater();
  if (state.waterMl >= WATER_GOAL_ML) { state.nextWaterReminderAt = null; hideWaterToast(); updateWaterReminderStatus(); }
  else restartWaterReminderCountdown();
}
function undoDrink() {
  ensureWaterDay();
  if (state.waterMl <= 0) return;
  state.waterMl = Math.max(0, state.waterMl - WATER_CUP_ML);
  persistWater();
  updateWater();
  if (state.waterMl < WATER_GOAL_ML) restartWaterReminderCountdown();
}
function updateWaterReminderStatus() {
  const status = $('waterReminderStatus');
  if (!state.waterReminderEnabled) { status.textContent = '喝水提醒已关闭'; return; }
  if (state.waterMl >= WATER_GOAL_ML) { status.textContent = '今日已达标，喝水提醒暂停'; return; }
  if (state.nextWaterReminderAt == null) { status.textContent = '下次喝水提醒准备中'; return; }
  if (state.nextWaterReminderAt <= Date.now() && $('breakDialog').open) { status.textContent = '休息结束后提醒喝水'; return; }
  status.textContent = `下次喝水提醒 ${fmt(Math.max(0, Math.ceil((state.nextWaterReminderAt - Date.now()) / 1000)))}`;
}
function restartWaterReminderCountdown() {
  state.nextWaterReminderAt = state.waterReminderEnabled && state.waterMl < WATER_GOAL_ML ? Date.now() + state.waterReminderMinutes * 60000 : null;
  updateWaterReminderStatus();
}
function showWaterReminder() {
  $('waterToast').hidden = false;
  const announcer = $('waterAnnouncer');
  announcer.textContent = '';
  setTimeout(() => { announcer.textContent = '该喝水了，来一杯 200ml，慢慢喝。'; }, 50);
  chime();
  navigator.vibrate?.([120, 60, 120]);
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification('该喝水了', { body: '来一杯 200ml，慢慢喝。' });
}
function hideWaterToast() { $('waterToast').hidden = true; $('waterAnnouncer').textContent = ''; }
function waterReminderTick() {
  ensureWaterDay();
  if (!state.waterReminderEnabled || state.waterMl >= WATER_GOAL_ML) { updateWaterReminderStatus(); return; }
  if (state.nextWaterReminderAt == null) { restartWaterReminderCountdown(); return; }
  if (Date.now() >= state.nextWaterReminderAt) {
    if ($('breakDialog').open) { updateWaterReminderStatus(); return; }
    state.nextWaterReminderAt = Date.now() + state.waterReminderMinutes * 60000;
    showWaterReminder();
  }
  updateWaterReminderStatus();
}
function renderActivities() { $('activityList').innerHTML = activities.map(([n,t,d,time]) => `<article class="activity"><span class="activity-number">${n}</span><div><h3>${t}</h3><p>${d}</p></div><span class="activity-time">${time}</span></article>`).join(''); }
$('mainTimerButton').addEventListener('click', () => state.mode === 'working' ? pauseTimer() : beginTimer());
$('resetButton').addEventListener('click', resetTimer);
$('workDuration').addEventListener('change', resetTimer);
$('dailyGoal').addEventListener('change', (e) => { state.goal = Number(e.target.value); updateDashboard(); });
$('notificationButton').addEventListener('click', async () => { if (!('Notification' in window)) return $('notificationStatus').textContent = '当前浏览器不支持'; const result = await Notification.requestPermission(); $('notificationStatus').textContent = result === 'granted' ? '系统通知已开启' : '通知未开启'; });
$('completeBreakButton').addEventListener('click', completeBreak);
$('snoozeButton').addEventListener('click', () => { if (state.snoozes <= 0) return; clearInterval(state.interval); $('breakDialog').close(); state.snoozes--; $('snoozeCount').textContent = state.snoozes ? `(剩 ${state.snoozes} 次)` : '(已用完)'; state.duration=300; state.remaining=300; state.endAt=Date.now()+300000; state.mode='working'; $('sessionLabel').textContent='延后活动中'; $('timerMessage').textContent='5 分钟后提醒'; $('mainTimerButton').textContent='暂停'; persistTimer(); updateDashboard(); state.interval=setInterval(tick,1000); });
$('drinkButton').addEventListener('click', drinkWater);
$('undoDrinkButton').addEventListener('click', undoDrink);
$('toastDrinkButton').addEventListener('click', () => { drinkWater(); hideWaterToast(); });
$('toastCloseButton').addEventListener('click', hideWaterToast);
$('waterReminderToggle').addEventListener('change', (e) => { state.waterReminderEnabled = e.target.checked; persistWaterSettings(); restartWaterReminderCountdown(); if (!state.waterReminderEnabled) hideWaterToast(); });
$('waterReminderInterval').addEventListener('change', (e) => { state.waterReminderMinutes = Number(e.target.value); persistWaterSettings(); restartWaterReminderCountdown(); });
loadProgress(); loadWater(); loadWaterSettings(); renderActivities(); updateDashboard(); updateWater(); restoreTimer(); restartWaterReminderCountdown(); setInterval(waterReminderTick, 1000);
