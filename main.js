const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const dataDir = () => path.join(app.getPath('userData'), 'notebooks');
const assetDir = () => path.join(dataDir(), 'assets');
const stateFile = () => path.join(dataDir(), 'library.json');

function ensure() {
  fs.mkdirSync(assetDir(), { recursive: true });
}

function atomicWrite(file, data) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 760,
    minHeight: 520,
    title: 'Cozy Notebook',
    backgroundColor: '#3b2f2a',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.loadFile('index.html');
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); }
  });
}

ipcMain.handle('state:get', () => {
  ensure();
  try { return fs.readFileSync(stateFile(), 'utf8'); } catch (e) { return null; }
});
ipcMain.handle('state:put', (_e, json) => {
  ensure();
  atomicWrite(stateFile(), json);
  return true;
});
ipcMain.handle('asset:all', () => {
  ensure();
  return fs.readdirSync(assetDir()).filter((f) => f.endsWith('.dat')).map((f) => [f.slice(0, -4), fs.readFileSync(path.join(assetDir(), f), 'utf8')]);
});
ipcMain.handle('asset:put', (_e, id, data) => {
  ensure();
  if (!/^[\w-]+$/.test(id)) throw new Error('bad id');
  atomicWrite(path.join(assetDir(), id + '.dat'), data);
  return true;
});
ipcMain.handle('asset:del', (_e, id) => {
  if (!/^[\w-]+$/.test(id)) return false;
  try { fs.unlinkSync(path.join(assetDir(), id + '.dat')); } catch (e) { /* ignore */ }
  return true;
});
ipcMain.handle('data:clear', () => {
  fs.rmSync(dataDir(), { recursive: true, force: true });
  return true;
});
ipcMain.handle('file:save', async (_e, name, text, filters) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: name, filters });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, text);
  return r.filePath;
});
ipcMain.handle('file:open', async (_e, filters) => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters });
  if (r.canceled || !r.filePaths[0]) return null;
  return fs.readFileSync(r.filePaths[0], 'utf8');
});
ipcMain.handle('print:pdf', async (_e, name) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: name, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
  if (r.canceled || !r.filePath) return null;
  const buf = await win.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true });
  fs.writeFileSync(r.filePath, buf);
  return r.filePath;
});
ipcMain.handle('app:info', () => ({ version: app.getVersion(), dataDir: dataDir() }));
ipcMain.handle('app:reveal', () => { ensure(); shell.openPath(dataDir()); });

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Notebook', submenu: [{ role: 'quit' }] },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'togglefullscreen' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'resetZoom' }, { role: 'toggleDevTools' }] },
  ]));
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
