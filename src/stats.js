const SproutStats = (() => {
  function localDateStr(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function upsertToday(state) {
    if (!state.daily) state.daily = [];
    const today = localDateStr();
    let row = state.daily.find((d) => d.date === today);
    if (!row) {
      row = { date: today, connects: 0, applications: 0 };
      state.daily.push(row);
    }
    row.applications = state.applications.count;
    row.connects = state.connects.count;
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

  function buildChartSvg(daily, goals) {
    const days = daily.slice(-14);
    if (!days.length) return "<svg xmlns='http://www.w3.org/2000/svg' width='190' height='80'></svg>";

    const W = 190;
    const H = 80;
    const pad = { t: 8, r: 6, b: 16, l: 6 };
    const iw = W - pad.l - pad.r;
    const ih = H - pad.t - pad.b;

    const maxY = Math.max(
      goals.applicationsDaily,
      goals.connectsWeekly / 5,
      ...days.map((d) => Math.max(d.applications, d.connects))
    );

    function pts(key, scale) {
      return days.map((d, i) => {
        const x = pad.l + (i / Math.max(days.length - 1, 1)) * iw;
        const y = pad.t + ih - (d[key] / scale) * ih;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      });
    }

    const appPts = pts("applications", maxY).join(" ");
    const connPts = pts("connects", maxY).join(" ");

    const labels = days
      .filter((_, i) => i % 2 === 0 || i === days.length - 1)
      .map((d, i, arr) => {
        const idx = days.indexOf(d);
        const x = pad.l + (idx / Math.max(days.length - 1, 1)) * iw;
        const label = d.date.slice(5);
        return `<text x="${x}" y="${H - 2}" font-size="6" fill="#999" text-anchor="middle">${label}</text>`;
      })
      .join("");

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <line x1="${pad.l}" y1="${pad.t + ih}" x2="${W - pad.r}" y2="${pad.t + ih}" stroke="#e8e4de" stroke-width="0.5"/>
  <polyline points="${appPts}" fill="none" stroke="#d89020" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  <polyline points="${connPts}" fill="none" stroke="#9b7ec8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3 2"/>
  ${labels}
  <text x="${W - 4}" y="8" font-size="6" fill="#d89020" text-anchor="end">投递</text>
  <text x="${W - 4}" y="16" font-size="6" fill="#9b7ec8" text-anchor="end">Connect</text>
</svg>`;
  }

  function buildReport(state) {
    const daily = state.daily || [];
    const last7 = daily.slice(-7);
    const totalApps = last7.reduce((s, d) => s + d.applications, 0);
    const totalConn = last7.reduce((s, d) => s + d.connects, 0);
    const avgApps = last7.length ? (totalApps / last7.length).toFixed(1) : "0";

    return {
      generatedAt: new Date().toISOString(),
      goals: state.goals,
      summary: {
        last7Days: { applications: totalApps, connects: totalConn, avgApplicationsPerDay: avgApps },
      },
      daily: daily.slice(-30),
    };
  }

  return { upsertToday, addDaily, buildChartSvg, buildReport, localDateStr };
})();

window.SproutStats = SproutStats;
