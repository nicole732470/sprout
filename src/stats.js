const SproutStats = (() => {
  function localDateStr(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function mondayOf(date = new Date()) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const weekday = d.getDay();
    const diff = weekday === 0 ? -6 : 1 - weekday;
    d.setDate(d.getDate() + diff);
    return localDateStr(d);
  }

  function weekEndLabel(weekStart) {
    const d = new Date(weekStart + "T12:00:00");
    d.setDate(d.getDate() + 6);
    return localDateStr(d).slice(5);
  }

  function upsertToday(state) {
    if (!state.daily) state.daily = [];
    const today = localDateStr();
    let row = state.daily.find((d) => d.date === today);
    if (!row) {
      row = { date: today, connects: 0, applications: 0 };
      state.daily.push(row);
    }
    // Applications: daily total for today. Connects: daily increment only (weekly total lives in state.connects).
    row.applications = state.applications.count;
    state.daily.sort((a, b) => a.date.localeCompare(b.date));
    if (state.daily.length > 90) state.daily = state.daily.slice(-90);
    return state;
  }

  function addDaily(state, field, delta = 1) {
    if (!state.daily) state.daily = [];
    const today = localDateStr();
    let row = state.daily.find((d) => d.date === today);
    if (!row) {
      row = { date: today, connects: 0, applications: 0 };
      state.daily.push(row);
    }
    row[field] = Math.max(0, (row[field] || 0) + delta);
    return state;
  }

  function weeklyConnectRows(state) {
    const rows = (state.history || [])
      .filter((h) => h.type === "connects")
      .map((h) => ({ weekStart: h.period, total: h.count }));
    const current = state.connects?.weekStart
      ? { weekStart: state.connects.weekStart, total: state.connects.count || 0, current: true }
      : null;
    const merged = [...rows];
    if (current) {
      const idx = merged.findIndex((r) => r.weekStart === current.weekStart);
      if (idx >= 0) merged[idx] = { ...merged[idx], total: current.total, current: true };
      else merged.push(current);
    }
    return merged.slice(-8);
  }

  function buildChartSvg(state, goals) {
    const daily = (state.daily || []).slice(-14);
    const weekly = weeklyConnectRows(state);
    const W = 720;
    const H = 280;
    const pad = { t: 28, r: 20, b: 28, l: 36 };
    const gap = 16;
    const panelH = (H - pad.t - pad.b - gap) / 2;
    const panelW = W - pad.l - pad.r;

    if (!daily.length && !weekly.length) {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"></svg>`;
    }

    function yAt(value, max, top) {
      return top + panelH - (value / max) * panelH;
    }

    function xAt(i, n, left) {
      return left + (i / Math.max(n - 1, 1)) * panelW;
    }

    const appMax = Math.max(goals.applicationsDaily, ...daily.map((d) => d.applications), 1);
    const connDayMax = Math.max(20, ...daily.map((d) => d.connects), 1);
    const connWeekMax = Math.max(goals.connectsWeekly, ...weekly.map((w) => w.total), 1);

    const top1 = pad.t;
    const top2 = pad.t + panelH + gap;

    const appPts = daily
      .map((d, i) => `${xAt(i, daily.length, pad.l).toFixed(1)},${yAt(d.applications, appMax, top1).toFixed(1)}`)
      .join(" ");
    const appGoalY = yAt(goals.applicationsDaily, appMax, top1).toFixed(1);

    const connDayPts = daily
      .map((d, i) => `${xAt(i, daily.length, pad.l).toFixed(1)},${yAt(d.connects, connDayMax, top2).toFixed(1)}`)
      .join(" ");

    const weekBarW = Math.min(48, panelW / Math.max(weekly.length, 1) - 8);
    const weekBars = weekly
      .map((w, i) => {
        const cx = pad.l + (i + 0.5) * (panelW / weekly.length);
        const bh = (w.total / connWeekMax) * panelH;
        const x = cx - weekBarW / 2;
        const y = top2 + panelH - bh;
        const fill = w.current ? "#f59e0b" : "#fcd34d";
        return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${weekBarW}" height="${bh.toFixed(1)}" rx="3" fill="${fill}" opacity="0.9"/>`;
      })
      .join("");

    const dayLabels = daily
      .map((d, i) => {
        if (daily.length > 10 && i % 2 !== 0 && i !== daily.length - 1) return "";
        const x = xAt(i, daily.length, pad.l);
        return `<text x="${x}" y="${top1 + panelH + 14}" font-size="10" fill="#94a3b8" text-anchor="middle">${d.date.slice(5)}</text>`;
      })
      .join("");

    const weekLabels = weekly
      .map((w, i) => {
        const cx = pad.l + (i + 0.5) * (panelW / weekly.length);
        return `<text x="${cx}" y="${H - 6}" font-size="10" fill="#94a3b8" text-anchor="middle">${w.weekStart.slice(5)}</text>`;
      })
      .join("");

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#f8fafc" rx="8"/>
  <text x="${pad.l}" y="18" font-size="12" font-weight="600" fill="#334155">APPLY — daily (goal ${goals.applicationsDaily})</text>
  <line x1="${pad.l}" y1="${top1 + panelH}" x2="${W - pad.r}" y2="${top1 + panelH}" stroke="#e2e8f0" stroke-width="1"/>
  <line x1="${pad.l}" y1="${appGoalY}" x2="${W - pad.r}" y2="${appGoalY}" stroke="#f59e0b" stroke-width="1" stroke-dasharray="4 3" opacity="0.55"/>
  ${daily.length ? `<polyline points="${appPts}" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>` : ""}
  ${daily.length ? daily.map((d, i) => `<circle cx="${xAt(i, daily.length, pad.l)}" cy="${yAt(d.applications, appMax, top1)}" r="3.5" fill="#ef4444"/>`).join("") : ""}
  ${dayLabels}
  <text x="${pad.l}" y="${top2 - 8}" font-size="12" font-weight="600" fill="#334155">CONNECT — daily adds (left) · weekly total (right)</text>
  <line x1="${pad.l}" y1="${top2 + panelH}" x2="${W - pad.r}" y2="${top2 + panelH}" stroke="#e2e8f0" stroke-width="1"/>
  ${daily.length ? `<polyline points="${connDayPts}" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="5 3"/>` : ""}
  ${weekBars}
  <line x1="${pad.l + panelW * 0.55}" y1="${top2}" x2="${pad.l + panelW * 0.55}" y2="${top2 + panelH}" stroke="#e2e8f0" stroke-width="1"/>
  ${weekLabels}
  <text x="${W - pad.r}" y="18" font-size="10" fill="#ef4444" text-anchor="end">Apply / day</text>
  <text x="${W - pad.r}" y="${top2 - 8}" font-size="10" fill="#8b5cf6" text-anchor="end">Connect / day</text>
  <text x="${W - pad.r}" y="${top2 + 4}" font-size="10" fill="#f59e0b" text-anchor="end">Connect / week</text>
</svg>`;
  }

  function buildReport(state) {
    const daily = state.daily || [];
    const last7 = daily.slice(-7);
    const totalApps = last7.reduce((s, d) => s + d.applications, 0);
    const totalConnDaily = last7.reduce((s, d) => s + d.connects, 0);
    const avgApps = last7.length ? (totalApps / last7.length).toFixed(1) : "0";

    return {
      generatedAt: new Date().toISOString(),
      goals: state.goals,
      periods: {
        connect: {
          type: "weekly",
          weekStart: state.connects?.weekStart,
          weekEnd: state.connects?.weekStart ? weekEndLabel(state.connects.weekStart) : null,
          count: state.connects?.count || 0,
          goal: state.goals.connectsWeekly,
        },
        apply: {
          type: "daily",
          date: state.applications?.date,
          count: state.applications?.count || 0,
          goal: state.goals.applicationsDaily,
        },
      },
      summary: {
        last7Days: {
          applications: totalApps,
          connectsDailyAdds: totalConnDaily,
          avgApplicationsPerDay: avgApps,
        },
      },
      weeklyConnects: weeklyConnectRows(state),
      daily: daily.slice(-30),
    };
  }

  function buildStatsMarkdown(report) {
    const p = report.periods;
    const weekLabel = p.connect.weekStart
      ? `${p.connect.weekStart} → ${p.connect.weekEnd}`
      : "—";
    return `# Super Mario Stats

_Auto-updated ${report.generatedAt.slice(0, 16).replace("T", " ")} UTC_

## Current period

| Track | Period | Progress |
|-------|--------|----------|
| **CONNECT** | Week ${weekLabel} | **${p.connect.count} / ${p.connect.goal}** |
| **APPLY** | ${p.apply.date || "—"} | **${p.apply.count} / ${p.apply.goal}** |

CONNECT resets every **Monday**. APPLY resets every **midnight**.

## Last 7 days

| Metric | Total |
|--------|-------|
| Applications | ${report.summary.last7Days.applications} |
| Connect adds (daily) | ${report.summary.last7Days.connectsDailyAdds} |
| Avg applications / day | ${report.summary.last7Days.avgApplicationsPerDay} |

## Trends

![Super Mario trends](chart.svg)
`;
  }

  return {
    upsertToday,
    addDaily,
    buildChartSvg,
    buildReport,
    buildStatsMarkdown,
    localDateStr,
    mondayOf,
    weekEndLabel,
  };
})();

window.SproutStats = SproutStats;
