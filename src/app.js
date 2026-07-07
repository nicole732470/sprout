let state = null;
let toastTimer = null;

function localDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function mondayOf(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = d.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  d.setDate(d.getDate() + diff);
  return localDateStr(d);
}

function todayStr() {
  return localDateStr(new Date());
}

function ensurePeriods(data) {
  const weekStart = mondayOf(new Date());
  const today = todayStr();

  if (data.connects.weekStart !== weekStart) {
    if (data.connects.weekStart && data.connects.count > 0) {
      data.history.push({
        type: "connects",
        period: data.connects.weekStart,
        count: data.connects.count,
      });
    }
    data.connects = { count: 0, weekStart };
  }

  if (data.applications.date !== today) {
    if (data.applications.date && data.applications.count > 0) {
      data.history.push({
        type: "applications",
        period: data.applications.date,
        count: data.applications.count,
      });
    }
    data.applications = { count: 0, date: today };
  }

  if (data.history.length > 120) {
    data.history = data.history.slice(-120);
  }

  return data;
}

function growthStage(count, goal) {
  const p = Math.min(count / goal, 1);
  if (p <= 0) return "0";
  if (p < 0.15) return "1";
  if (p < 0.35) return "2";
  if (p < 0.55) return "3";
  if (p < 0.85) return "4";
  return "5";
}

function updateUI(lastAction) {
  const cGoal = state.goals.connectsWeekly;
  const aGoal = state.goals.applicationsDaily;
  const c = state.connects.count;
  const a = state.applications.count;

  document.getElementById("count-connect").textContent = `${c}/${cGoal}`;
  document.getElementById("count-apply").textContent = `${a}/${aGoal}`;
  document.getElementById("goals-line").textContent = `${cGoal}/周 · ${aGoal}/日`;

  document.getElementById("plant-connect").dataset.stage = growthStage(c, cGoal);
  document.getElementById("plant-apply").dataset.stage = growthStage(a, aGoal);

  document.getElementById("btn-connect").classList.toggle("done", c >= cGoal);
  document.getElementById("btn-apply").classList.toggle("done", a >= aGoal);

  document.getElementById("btn-undo-connect").disabled = c <= 0;
  document.getElementById("btn-undo-apply").disabled = a <= 0;

  const coach = SproutCoach.buildCoach(state, lastAction);
  document.getElementById("coach-main").textContent = coach.main;
  document.getElementById("coach-sub").textContent = coach.sub;
}

async function save() {
  await window.sproutAPI.saveProgress(state);
}

function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
}

function bump(el) {
  el.classList.remove("bump");
  void el.offsetWidth;
  el.classList.add("bump");
}

function sparks(btn, color) {
  const rect = btn.getBoundingClientRect();
  const w = document.getElementById("widget").getBoundingClientRect();
  for (let i = 0; i < 5; i++) {
    const s = document.createElement("div");
    s.className = "spark";
    s.style.background = color;
    s.style.left = `${rect.left - w.left + rect.width / 2}px`;
    s.style.top = `${rect.top - w.top + 30}px`;
    const a = (Math.PI * 2 * i) / 5;
    s.style.setProperty("--tx", `${Math.cos(a) * 18}px`);
    s.style.setProperty("--ty", `${Math.sin(a) * 18 - 10}px`);
    document.getElementById("widget").appendChild(s);
    setTimeout(() => s.remove(), 500);
  }
}

async function addConnect() {
  state.connects.count += 1;
  updateUI("connect");
  await save();
  const btn = document.getElementById("btn-connect");
  bump(btn);
  sparks(btn, "#c4a8e8");
}

async function addApply() {
  state.applications.count += 1;
  updateUI("apply");
  await save();
  const btn = document.getElementById("btn-apply");
  bump(btn);
  sparks(btn, "#f5c842");
}

async function undoConnect() {
  if (state.connects.count <= 0) return;
  state.connects.count -= 1;
  updateUI();
  await save();
  showToast("已撤销");
}

async function undoApply() {
  if (state.applications.count <= 0) return;
  state.applications.count -= 1;
  updateUI();
  await save();
  showToast("已撤销");
}

async function syncGithub() {
  const btn = document.getElementById("btn-sync");
  btn.classList.add("syncing");
  btn.disabled = true;
  try {
    const r = await window.sproutAPI.syncGithub();
    showToast(r.ok ? r.message : r.message.slice(0, 40));
  } finally {
    btn.classList.remove("syncing");
    btn.disabled = false;
  }
}

async function init() {
  let data = await window.sproutAPI.loadProgress();
  if (!data.goals) data.goals = { connectsWeekly: 100, applicationsDaily: 50 };
  if (!data.history) data.history = [];
  state = ensurePeriods(data);
  updateUI();
  await save();

  document.getElementById("btn-connect").addEventListener("click", addConnect);
  document.getElementById("btn-apply").addEventListener("click", addApply);
  document.getElementById("btn-undo-connect").addEventListener("click", undoConnect);
  document.getElementById("btn-undo-apply").addEventListener("click", undoApply);
  document.getElementById("btn-sync").addEventListener("click", syncGithub);

  window.sproutAPI.onHotkey((action) => {
    if (action === "connect") addConnect();
    if (action === "apply") addApply();
  });

  setInterval(() => updateUI(), 60000);
}

init();
