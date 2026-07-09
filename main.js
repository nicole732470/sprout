const { app, BrowserWindow, ipcMain, globalShortcut, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");

function getRepoRoot() {
  if (process.env.MARIO_REPO && fs.existsSync(process.env.MARIO_REPO)) {
    return process.env.MARIO_REPO;
  }
  if (process.env.SPROUT_REPO && fs.existsSync(process.env.SPROUT_REPO)) {
    return process.env.SPROUT_REPO;
  }
  if (!app.isPackaged) return __dirname;
  const candidates = [
    path.join(app.getPath("home"), "Desktop", "APPLY", "super-mario"),
    path.join(app.getPath("home"), "Desktop", "APPLY", "sprout"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, ".git"))) return candidate;
  }
  return app.getPath("userData");
}

const REPO_ROOT = getRepoRoot();
const APP_ROOT = app.isPackaged ? app.getAppPath() : __dirname;
const DATA_DIR = path.join(REPO_ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "progress.json");
const STATS_FILE = path.join(DATA_DIR, "stats.json");
const CHART_FILE = path.join(DATA_DIR, "chart.svg");
const STATS_MD_FILE = path.join(DATA_DIR, "STATS.md");

const DEFAULT_DATA = {
  connects: { count: 0, weekStart: null },
  applications: { count: 0, date: null },
  goals: { connectsWeekly: 100, applicationsDaily: 50 },
  history: [],
  daily: [],
};

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  function ensureDataFile() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2));
    }
  }

  function readData() {
    ensureDataFile();
    try {
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    } catch {
      return structuredClone(DEFAULT_DATA);
    }
  }

  function writeData(data) {
    ensureDataFile();
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  }

  let mainWindow;
  let dragOffset = null;

  function createWindow() {
    if (mainWindow) return;

    mainWindow = new BrowserWindow({
      width: 214,
      height: 168,
      show: true,
      frame: false,
      transparent: true,
      resizable: false,
      alwaysOnTop: true,
      hasShadow: false,
      webPreferences: {
        preload: path.join(APP_ROOT, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    mainWindow.loadFile(path.join(APP_ROOT, "src", "index.html"));
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    mainWindow.on("closed", () => {
      mainWindow = null;
      globalShortcut.unregisterAll();
    });
  }

  function registerShortcuts() {
    globalShortcut.unregisterAll();
    if (!mainWindow) return;

    globalShortcut.register("CommandOrControl+Shift+C", () => {
      mainWindow.webContents.send("hotkey", "connect");
    });
    globalShortcut.register("CommandOrControl+Shift+A", () => {
      mainWindow.webContents.send("hotkey", "apply");
    });
    globalShortcut.register("CommandOrControl+Shift+S", () => {
      mainWindow.webContents.send("hotkey", "sync");
    });
    globalShortcut.register("CommandOrControl+Shift+Q", () => {
      app.quit();
    });
    globalShortcut.register("CommandOrControl+Shift+R", () => {
      mainWindow.webContents.send("hotkey", "reset");
    });
  }

  app.whenReady().then(() => {
    createWindow();
    mainWindow.webContents.on("did-finish-load", registerShortcuts);
  });

  app.on("second-instance", () => {
    if (!mainWindow) {
      createWindow();
      return;
    }
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.on("window-all-closed", () => {
    app.quit();
  });

  app.on("activate", () => {
    if (!mainWindow) createWindow();
  });

  app.on("will-quit", () => globalShortcut.unregisterAll());

  ipcMain.on("drag-start", (event, pos) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    const [x, y] = win.getPosition();
    dragOffset = { x: pos.screenX - x, y: pos.screenY - y };
  });

  ipcMain.on("drag-move", (event, pos) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || !dragOffset) return;
    win.setPosition(pos.screenX - dragOffset.x, pos.screenY - dragOffset.y);
  });

  ipcMain.on("drag-end", () => {
    dragOffset = null;
  });

  ipcMain.handle("quit-app", () => {
    app.quit();
    return { ok: true };
  });

  ipcMain.handle("show-context-menu", () => {
    if (!mainWindow) return;
    const menu = Menu.buildFromTemplate([
      {
        label: "Reset counts to 0",
        accelerator: "Cmd+Shift+R",
        click: () => mainWindow.webContents.send("hotkey", "reset"),
      },
      { type: "separator" },
      {
        label: "Quit Super Mario",
        accelerator: "Cmd+Shift+Q",
        click: () => app.quit(),
      },
    ]);
    menu.popup({ window: mainWindow });
  });

  ipcMain.handle("load-progress", () => readData());

  ipcMain.handle("save-progress", (_event, data) => {
    writeData(data);
    return { ok: true };
  });

  ipcMain.handle("save-stats", (_event, { svg, report, markdown }) => {
    ensureDataFile();
    fs.writeFileSync(CHART_FILE, svg);
    fs.writeFileSync(STATS_FILE, JSON.stringify(report, null, 2));
    if (markdown) fs.writeFileSync(STATS_MD_FILE, markdown);
    return { ok: true };
  });

  ipcMain.handle("sync-github", () => {
    return new Promise((resolve) => {
      const repoRoot = REPO_ROOT;
      const files = ["data/progress.json", "data/stats.json", "data/chart.svg", "data/STATS.md"];

      execFile("git", ["add", ...files], { cwd: repoRoot }, (addErr) => {
        if (addErr) {
          resolve({ ok: false, message: addErr.message });
          return;
        }

        const d = new Date();
        const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        execFile(
          "git",
          ["commit", "-m", `stats: ${date}`],
          { cwd: repoRoot },
          (commitErr, _stdout, stderr) => {
            const nothing = stderr && stderr.includes("nothing to commit");
            if (commitErr && !nothing) {
              resolve({ ok: false, message: commitErr.message });
              return;
            }
            if (nothing) {
              resolve({ ok: true, message: "Already up to date" });
              return;
            }

            execFile("git", ["push"], { cwd: repoRoot }, (pushErr, _o, pushErrOut) => {
              if (pushErr) {
                resolve({ ok: false, message: pushErrOut || pushErr.message });
                return;
              }
              resolve({ ok: true, message: "Synced" });
            });
          }
        );
      });
    });
  });
}
