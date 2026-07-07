function localDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function weekDaysLeft() {
  const d = new Date().getDay();
  return d === 0 ? 1 : 8 - d;
}

function hoursLeftToday() {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return Math.max((end - now) / 3600000, 0.5);
}

function avgRecent(history, type, n = 7) {
  const rows = history.filter((h) => h.type === type).slice(-n);
  if (!rows.length) return null;
  return rows.reduce((s, r) => s + r.count, 0) / rows.length;
}

function streakDays(history) {
  const apps = history
    .filter((h) => h.type === "applications" && h.count >= 1)
    .map((h) => h.period)
    .sort()
    .reverse();
  if (!apps.length) return 0;

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 60; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = localDateStr(d);
    if (apps.includes(key)) streak++;
    else if (i > 0) break;
  }
  return streak;
}

function paceStatus(count, goal, timeFraction) {
  const expected = goal * timeFraction;
  const ratio = count / Math.max(expected, 0.01);
  if (count >= goal) return "done";
  if (ratio >= 0.9) return "on-track";
  if (ratio >= 0.6) return "ok";
  return "behind";
}

function weekTimeFraction() {
  const d = new Date().getDay();
  const day = d === 0 ? 7 : d;
  return day / 7;
}

function dayTimeFraction() {
  const now = new Date();
  return (now.getHours() * 60 + now.getMinutes()) / 1440;
}

const ENCOURAGE = {
  connect: ["人脉 +1，种子发芽了", "又连上一个！", "Connect 记录 ✓"],
  apply: ["简历飞出去啦", "又投一份 PM！", "投递 +1 ✓"],
  done: ["今天/本周目标达成！🎉", "花开满了，太棒了", "你做到了！"],
  morning: ["早上好，先浇一盆水", "新的一天，从第一颗种子开始"],
  evening: ["傍晚了，再浇几盆？", "趁天黑前再冲一波"],
  streak: (n) => [`连续 ${n} 天有投递，厉害`, `坚持 ${n} 天了，继续保持`],
};

function random(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildCoach(state, lastAction) {
  const cGoal = state.goals.connectsWeekly;
  const aGoal = state.goals.applicationsDaily;
  const c = state.connects.count;
  const a = state.applications.count;
  const cLeft = Math.max(cGoal - c, 0);
  const aLeft = Math.max(aGoal - a, 0);
  const cDone = c >= cGoal;
  const aDone = a >= aGoal;

  if (lastAction === "connect") return { main: random(ENCOURAGE.connect), sub: "" };
  if (lastAction === "apply") return { main: random(ENCOURAGE.apply), sub: "" };

  if (cDone && aDone) {
    return { main: random(ENCOURAGE.done), sub: "本周 Connect 和今日投递都完成了" };
  }

  const hour = new Date().getHours();
  const streak = streakDays(state.history);
  const subs = [];

  if (!aDone) {
    const hrs = hoursLeftToday();
    const perHour = Math.ceil(aLeft / hrs);
    const status = paceStatus(a, aGoal, dayTimeFraction());
    if (status === "behind") {
      subs.push(`投递还差 ${aLeft}，建议接下来每小时约 ${perHour} 个`);
    } else if (status === "on-track") {
      subs.push(`投递节奏不错，还差 ${aLeft} 个`);
    } else if (status === "done") {
      subs.push("今日投递目标已达成");
    } else {
      subs.push(`今日还差 ${aLeft} 份投递`);
    }
  }

  if (!cDone) {
    const days = weekDaysLeft();
    const perDay = Math.ceil(cLeft / days);
    const status = paceStatus(c, cGoal, weekTimeFraction());
    if (status === "behind") {
      subs.push(`Connect 还差 ${cLeft}，本周每天约 ${perDay} 个`);
    } else {
      subs.push(`Connect 本周还差 ${cLeft}`);
    }
  }

  if (streak >= 2) subs.push(random(ENCOURAGE.streak(streak)));

  const avgApp = avgRecent(state.history, "applications");
  if (avgApp && a > avgApp * 0.8 && !aDone) {
    subs.push("今天比平时更积极");
  }

  let main;
  if (c === 0 && a === 0) {
    main = hour < 12 ? random(ENCOURAGE.morning) : "点花盆记录，看着它长大";
  } else if (hour >= 20 && (!aDone || !cDone)) {
    main = random(ENCOURAGE.evening);
  } else if (aDone && !cDone) {
    main = "投递完成了，去浇 Connect 那盆";
  } else if (cDone && !aDone) {
    main = "Connect 达标了，投递继续加油";
  } else {
    const msgs = [
      "每次点击，植物都会长高一点",
      "慢慢来，持续浇灌就好",
      "小步积累，终会看到花开",
    ];
    main = random(msgs);
  }

  return { main, sub: subs[0] || "" };
}

window.SproutCoach = {
  buildCoach,
  weekDaysLeft,
  hoursLeftToday,
};
