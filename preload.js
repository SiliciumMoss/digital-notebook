const { contextBridge, ipcRenderer } = require('electron');
const inv = (c) => (...a) => ipcRenderer.invoke(c, ...a);
contextBridge.exposeInMainWorld('native', {
  getState: inv('state:get'),
  putState: inv('state:put'),
  allAssets: inv('asset:all'),
  putAsset: inv('asset:put'),
  delAsset: inv('asset:del'),
  clearAll: inv('data:clear'),
  saveFile: inv('file:save'),
  openFile: inv('file:open'),
  printPdf: inv('print:pdf'),
  info: inv('app:info'),
  reveal: inv('app:reveal'),
});
