const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("sproutAPI", {
  loadProgress: () => ipcRenderer.invoke("load-progress"),
  saveProgress: (data) => ipcRenderer.invoke("save-progress", data),
  syncGithub: () => ipcRenderer.invoke("sync-github"),
  onHotkey: (cb) => ipcRenderer.on("hotkey", (_e, action) => cb(action)),
});
