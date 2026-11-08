const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// helper for dictionary file location – use a fixed name that's unlikely to collide
// le fichier s'appelle désormais « DicoManon.json »
function dictionaryPath() {
  return path.join(app.getPath('userData'), 'DicoManon.json');
}

// register IPC handlers right away (before windows are created)
ipcMain.handle('read-dictionary', async () => {
  const file = dictionaryPath();
  try {
    if (fs.existsSync(file)) {
      const data = await fs.promises.readFile(file, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('échec de la lecture du fichier DicoManon.json', e);
  }
  return null;
});

ipcMain.handle('write-dictionary', async (event, arr) => {
  const file = dictionaryPath();
  try {
    await fs.promises.writeFile(file, JSON.stringify(arr, null, 2), 'utf-8');
    return { ok: true };
  } catch (e) {
    console.error('échec de l’écriture du fichier DicoManon.json', e);
    return { ok: false, error: e.message };
  }
});


function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    show: false, // don't show until ready to avoid white flash
    backgroundColor: '#121212',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadFile('index.html');
  win.once('ready-to-show', () => {
    win.show();
  });
  // win.webContents.openDevTools();
}

app.whenReady().then(() => {
  // intercept favicon requests to avoid file:///favicon.ico error
  const { session } = require('electron');
  const fs = require('fs');
  const path = require('path');

  // other initialization (no need to re-register IPC handlers now)

  // listen for close requests from renderer
  ipcMain.on('close-window', (event) => {
    // close all windows and quit the app
    BrowserWindow.getAllWindows().forEach(w => w.close());
    app.quit();
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});