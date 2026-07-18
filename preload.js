const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pokeMultiAPI', {
  getConfig: () => ipcRenderer.invoke('get-app-config'),
  saveState: (state) => ipcRenderer.invoke('save-app-state', state),
  getLoginAccounts: () => ipcRenderer.invoke('get-login-accounts'),
  saveLoginAccounts: (accounts) => ipcRenderer.invoke('save-login-accounts', accounts)
});
