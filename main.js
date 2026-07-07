const { app, BrowserWindow, ipcMain, globalShortcut } = require("electron");
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "progress.json");

const DEFAULT_DATA = {
  connects: { count: 0, weekStart: null },
  applications: { count: 0, date: null },
  goals: { connectsWeekly: 100, applicationsDaily: 50 },
  history: [],
};

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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 220,
    height: 300,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "src", "index.html"));
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  mainWindow.webContents.on("did-finish-load", () => {
    globalShortcut.register("CommandOrControl+Shift+C", () => {
      mainWindow.webContents.send("hotkey", "connect");
    });
    globalShortcut.register("CommandOrControl+Shift+A", () => {
      mainWindow.webContents.send("hotkey", "apply");
    });
  });

  mainWindow.on("closed", () => {
    globalShortcut.unregisterAll();
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("will-quit", () => globalShortcut.unregisterAll());

ipcMain.handle("load-progress", () => readData());

ipcMain.handle("save-progress", (_event, data) => {
  writeData(data);
  return { ok: true };
});

ipcMain.handle("sync-github", () => {
  return new Promise((resolve) => {
    const repoRoot = __dirname;
    const relPath = "data/progress.json";

    execFile("git", ["add", relPath], { cwd: repoRoot }, (addErr) => {
      if (addErr) {
        resolve({ ok: false, message: addErr.message });
        return;
      }

      const d = new Date();
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      execFile(
        "git",
        ["commit", "-m", `progress: ${date}`],
        { cwd: repoRoot },
        (commitErr, _stdout, stderr) => {
          const nothing = stderr && stderr.includes("nothing to commit");
          if (commitErr && !nothing) {
            resolve({ ok: false, message: commitErr.message });
            return;
          }
          if (nothing) {
            resolve({ ok: true, message: "已是最新" });
            return;
          }

          execFile("git", ["push"], { cwd: repoRoot }, (pushErr, _o, pushErrOut) => {
            if (pushErr) {
              resolve({ ok: false, message: pushErrOut || pushErr.message });
              return;
            }
            resolve({ ok: true, message: "已同步 ✓" });
          });
        }
      );
    });
  });
});
