const { app, BrowserWindow, ipcMain, Menu, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');

// URL do jogo. Troque aqui se quiser apontar para outro site/jogo.
const GAME_URL = 'https://poke.idleworld.online/';
const LOGIN_URL = 'https://poke.idleworld.online/login';
const ACCOUNT_COUNT = 4;

const configPath = path.join(app.getPath('userData'), 'config.json');

function loadConfig() {
  try {
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return normalizeConfig(cfg);
  } catch {
    return normalizeConfig({});
  }
}

function normalizeConfig(cfg) {
  const muted = Array.isArray(cfg.muted) && cfg.muted.length === ACCOUNT_COUNT
    ? cfg.muted.map(Boolean)
    : Array(ACCOUNT_COUNT).fill(false);

  const accounts = Array.from({ length: ACCOUNT_COUNT }, (_item, index) => {
    const saved = Array.isArray(cfg.accounts) ? cfg.accounts[index] : null;
    return {
      username: saved && typeof saved.username === 'string' ? saved.username : '',
      password: saved && typeof saved.password === 'string' ? saved.password : ''
    };
  });

  return { muted, accounts };
}

function encryptPassword(password) {
  if (!password) return '';
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Criptografia local indisponivel neste Windows.');
  }
  return safeStorage.encryptString(password).toString('base64');
}

function decryptPassword(encrypted) {
  if (!encrypted || !safeStorage.isEncryptionAvailable()) return '';
  try {
    return safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
  } catch {
    return '';
  }
}

function getPublicConfig() {
  const cfg = loadConfig();
  return {
    muted: cfg.muted,
    accounts: cfg.accounts.map(account => ({
      username: account.username,
      hasPassword: !!account.password
    }))
  };
}

function getLoginAccounts() {
  return loadConfig().accounts.map(account => ({
    username: account.username,
    password: decryptPassword(account.password)
  }));
}

function saveConfig(cfg) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
  } catch (e) {
    console.error('Falha ao salvar config:', e);
  }
}

let mainWindow;

// Remove o menu padrao do Electron (File, Edit, View, Window, Help)
Menu.setApplicationMenu(null);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    backgroundColor: '#080b11',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true, // habilita a tag <webview>
      sandbox: false
    }
  });

  mainWindow.loadFile('index.html');
}

// IPC: fornece config inicial para o renderer (URL do jogo, nro de contas, etc)
ipcMain.handle('get-app-config', () => {
  return {
    gameUrl: GAME_URL,
    loginUrl: LOGIN_URL,
    accountCount: ACCOUNT_COUNT,
    saved: getPublicConfig()
  };
});

ipcMain.handle('save-app-state', (_evt, state) => {
  const current = loadConfig();
  saveConfig({
    ...current,
    muted: Array.isArray(state.muted) ? state.muted : current.muted
  });
  return true;
});

ipcMain.handle('get-login-accounts', () => {
  return getLoginAccounts();
});

ipcMain.handle('save-login-accounts', (_evt, accounts) => {
  const current = loadConfig();
  const nextAccounts = Array.from({ length: ACCOUNT_COUNT }, (_item, index) => {
    const incoming = Array.isArray(accounts) ? accounts[index] : null;
    const currentAccount = current.accounts[index] || { username: '', password: '' };
    const username = incoming && typeof incoming.username === 'string'
      ? incoming.username.trim()
      : '';
    const password = incoming && typeof incoming.password === 'string'
      ? incoming.password
      : '';
    const keepPassword = incoming && incoming.keepPassword && currentAccount.password;

    return {
      username,
      password: keepPassword ? currentAccount.password : encryptPassword(password)
    };
  });

  saveConfig({ ...current, accounts: nextAccounts });
  return getPublicConfig().accounts;
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
