const GAME_URL = 'https://poke.idleworld.online';
const LOGIN_URL = 'https://poke.idleworld.online/login';
const PLAY_URL = 'https://poke.idleworld.online/play';
const ACCOUNTS_KEY = 'poke_multi_accounts';
const SLOT_COUNT = 4;

let accounts = [];
let editingIndex = -1;
let analyzerInterval = null;
let analyzerCountdown = 15;

const $ = id => document.getElementById(id);

function loadAccounts() {
  try { accounts = JSON.parse(localStorage.getItem(ACCOUNTS_KEY)) || []; }
  catch { accounts = []; }
  while (accounts.length < SLOT_COUNT) accounts.push({ slot: accounts.length + 1, username: '', password: '' });
}

function saveAccounts() {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function renderPanels() {
  for (let i = 0; i < SLOT_COUNT; i++) {
    const panel = document.querySelectorAll('.panel')[i];
    const iframe = $('wv' + i);
    const label = panel.querySelector('.panel-label');
    const acc = accounts[i];
    label.textContent = acc.username ? `Conta ${i + 1} (${acc.username})` : `Conta ${i + 1}`;

    if (!acc.username) {
      iframe.srcdoc = `<body style="margin:0;background:#0a0e17;display:flex;align-items:center;justify-content:center;height:100vh;color:#3d4a60;font-family:sans-serif;font-size:14px;text-align:center">
        <div><div style="font-size:40px;margin-bottom:12px">🎮</div>Conta ${i + 1}<br/>Clique em ⚙ Contas para adicionar</div></body>`;
    }
  }
}

function renderSidebar() {
  const list = $('accountsList');
  list.innerHTML = accounts.map((acc, i) => `
    <div class="sidebar-account">
      <div class="sidebar-account-info">
        <div class="sidebar-account-name">${acc.username || 'Vazio'}</div>
        <div class="sidebar-account-slot">Slot ${i + 1}</div>
      </div>
      <button class="icon-btn" data-action="edit" data-index="${i}">✏️</button>
    </div>`).join('');
}

function tryClickPlayInThisTab(doc) {
  try {
    const btns = doc.querySelectorAll('button');
    for (const b of btns) {
      if (b.textContent.toLowerCase().includes('play in this tab')) {
        b.click();
        return true;
      }
    }
  } catch {}
  return false;
}

function startAccountInUseWatch(iframe, maxTime) {
  const startTime = Date.now();
  const check = () => {
    if (Date.now() - startTime > maxTime) return;
    try {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      if (tryClickPlayInThisTab(doc)) return;
    } catch {}
    setTimeout(check, 2000);
  };
  setTimeout(check, 2000);
}

function loadSlot(index) {
  const acc = accounts[index];
  if (!acc.username) return;
  const iframe = $('wv' + index);

  iframe.src = LOGIN_URL;
  iframe.onload = () => {
    startAccountInUseWatch(iframe, 20000);
    try {
      setTimeout(() => {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow.document;

          tryClickPlayInThisTab(doc);

          const userField = doc.querySelector('input[type="text"], input[name="username"], input[placeholder*="user" i], input[placeholder*="login" i], input[placeholder*="email" i]');
          const passField = doc.querySelector('input[type="password"]');
          const submitBtn = doc.querySelector('button[type="submit"], button.auth-imgbtn, button.primary');

          if (userField && acc.username) {
            const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
            nativeSetter.call(userField, acc.username);
            userField.dispatchEvent(new Event('input', { bubbles: true }));
            userField.dispatchEvent(new Event('change', { bubbles: true }));
          }
          if (passField && acc.password) {
            const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
            nativeSetter.call(passField, acc.password);
            passField.dispatchEvent(new Event('input', { bubbles: true }));
            passField.dispatchEvent(new Event('change', { bubbles: true }));
          }
          if (submitBtn) {
            setTimeout(() => {
              submitBtn.click();
              setTimeout(() => {
                try {
                  const doc2 = iframe.contentDocument || iframe.contentWindow.document;
                  tryClickPlayInThisTab(doc2);
                  try {
                    const currentUrl = iframe.contentWindow.location.href;
                    if (currentUrl.includes('/login')) {
                      setTimeout(() => {
                        try {
                          const doc3 = iframe.contentDocument || iframe.contentWindow.document;
                          tryClickPlayInThisTab(doc3);
                          const retryBtn = doc3.querySelector('button[type="submit"], button.auth-imgbtn, button.primary');
                          if (retryBtn) retryBtn.click();
                        } catch {}
                      }, 3000);
                    }
                  } catch {}
                } catch {}
              }, 2500);
            }, 800);
          }
        } catch {}
      }, 1500);
    } catch {}
  };
}

function enterAll() {
  for (let i = 0; i < SLOT_COUNT; i++) {
    const acc = accounts[i];
    if (acc.username) {
      setTimeout(() => loadSlot(i), i * 1000);
    }
  }
}

function muteAll() {
  for (let i = 0; i < SLOT_COUNT; i++) {
    try {
      const iframe = $('wv' + i);
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const audios = doc.querySelectorAll('audio, video');
      audios.forEach(a => { a.muted = true; a.volume = 0; });
    } catch {}
  }
}

function toggleAccounts() {
  $('accountsSidebar').classList.toggle('hidden');
}

function showAddForm() {
  editingIndex = -1;
  $('modalTitle').textContent = 'Nova Conta';
  $('inputSlot').value = '';
  $('inputSlot').classList.remove('hidden');
  $('inputUsername').value = '';
  $('inputPassword').value = '';
  $('inputVip').checked = false;
  $('btnDelete').classList.add('hidden');
  $('accountModal').classList.remove('hidden');
  $('inputSlot').focus();
}

function showEditForm(index) {
  editingIndex = index;
  const acc = accounts[index];
  $('modalTitle').textContent = 'Editar Conta';
  $('inputSlot').value = acc.slot || (index + 1);
  $('inputSlot').classList.add('hidden');
  $('inputUsername').value = acc.username || '';
  $('inputPassword').value = acc.password || '';
  $('inputVip').checked = acc.isVip || false;
  $('btnDelete').classList.remove('hidden');
  $('accountModal').classList.remove('hidden');
  $('inputUsername').focus();
}

function hideModal() {
  $('accountModal').classList.add('hidden');
  editingIndex = -1;
}

function saveAccount() {
  const slot = parseInt($('inputSlot').value) || (editingIndex >= 0 ? editingIndex : accounts.findIndex(a => !a.username));
  const username = $('inputUsername').value.trim();
  const password = $('inputPassword').value.trim();
  const isVip = $('inputVip').checked;
  if (!username) { $('inputUsername').focus(); return; }
  const idx = editingIndex >= 0 ? editingIndex : Math.max(0, Math.min(slot - 1, SLOT_COUNT - 1));
  const current = accounts[idx] || {};
  accounts[idx] = { slot: idx + 1, username, password, isVip, huntConfig: current.huntConfig || null, catchConfig: current.catchConfig || null };
  saveAccounts();
  hideModal();
  renderPanels();
  renderSidebar();
}

function deleteAccount() {
  if (editingIndex >= 0) {
    accounts[editingIndex] = { slot: editingIndex + 1, username: '', password: '' };
    saveAccounts();
    hideModal();
    renderPanels();
    renderSidebar();
  }
}

function openAnalyzer() {
  $('analyzerOverlay').classList.remove('hidden');
  analyzerCountdown = 15;
  refreshAnalyzer();
  startAnalyzerTimer();
}

function closeAnalyzer() {
  $('analyzerOverlay').classList.add('hidden');
  if (analyzerInterval) { clearInterval(analyzerInterval); analyzerInterval = null; }
}

function startAnalyzerTimer() {
  if (analyzerInterval) clearInterval(analyzerInterval);
  analyzerCountdown = 15;
  $('analyzerTimer').textContent = `atualizando em ${analyzerCountdown}s`;
  analyzerInterval = setInterval(() => {
    analyzerCountdown--;
    if (analyzerCountdown <= 0) { refreshAnalyzer(); analyzerCountdown = 15; }
    $('analyzerTimer').textContent = `atualizando em ${analyzerCountdown}s`;
  }, 1000);
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function buildStatRow(label, value, cls) {
  return `<div class="analyzer-stat-row"><span class="analyzer-stat-label">${escapeHtml(label)}</span><span class="analyzer-stat-value ${cls||''}">${escapeHtml(value)}</span></div>`;
}

function parseNumber(str) {
  if (!str) return 0;
  return parseFloat(String(str).replace(/[^0-9.,]/gi, '').replace(/\./g, '').replace(',', '.')) || 0;
}

function formatMoney(n) { return Number(n).toLocaleString('pt-BR'); }

async function extractFromIframe(index) {
  const iframe = $('wv' + index);
  try {
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    const url = iframe.contentWindow.location.href;
    if (!url.includes('/play') && !url.includes('/game')) {
      return { debug: 'URL: ' + url + ' (nao esta no jogo)' };
    }

    const allEls = [...doc.querySelectorAll('*')];
    let analyzerPanel = null;
    let bestSize = Infinity;
    for (const el of allEls) {
      try {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        if (rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none') {
          const t = el.innerText || '';
          if (t.includes('Hunt Analyzer') && t.includes('Derrotados')) {
            const size = rect.width * rect.height;
            if (size > 0 && size < bestSize) { bestSize = size; analyzerPanel = el; }
          }
        }
      } catch {}
    }

    if (!analyzerPanel) return { debug: 'PAINEL NAO ENCONTRADO' };

    const panelText = analyzerPanel.innerText || '';
    const clean = panelText.replace(/\s+/g, ' ');
    const huntSection = clean.match(/Hunt Analyzer[\s\S]*$/i);
    const huntText = huntSection ? huntSection[0] : clean;

    const result = { hunts: {}, drops: [] };
    const findNumBefore = (label) => {
      const idx = huntText.toLowerCase().indexOf(label.toLowerCase());
      if (idx === -1) return '';
      const before = huntText.substring(Math.max(0, idx - 150), idx);
      const m = before.match(/(\d[\d.,]*)\s*$/);
      return m ? m[1] : '';
    };
    const findDollarBefore = (label) => {
      const idx = huntText.toLowerCase().indexOf(label.toLowerCase());
      if (idx === -1) return '';
      const before = huntText.substring(Math.max(0, idx - 150), idx);
      const m = before.match(/\$([\d.,]+)\s*$/);
      return m ? m[1] : '';
    };
    const findNegDollarBefore = (label) => {
      const idx = huntText.toLowerCase().indexOf(label.toLowerCase());
      if (idx === -1) return '';
      const before = huntText.substring(Math.max(0, idx - 150), idx);
      const m = before.match(/-\$([\d.,]+)\s*$/);
      return m ? m[1] : '';
    };
    const findPosDollarBefore = (label) => {
      const idx = huntText.toLowerCase().indexOf(label.toLowerCase());
      if (idx === -1) return '';
      const before = huntText.substring(Math.max(0, idx - 150), idx);
      const m = before.match(/\+\$([\d.,]+)\s*$/);
      return m ? m[1] : '';
    };
    const findTimeBefore = (label) => {
      const idx = huntText.toLowerCase().indexOf(label.toLowerCase());
      if (idx === -1) return '';
      const before = huntText.substring(Math.max(0, idx - 150), idx);
      const m = before.match(/(\d+m\s*\d+s)/i) || before.match(/(\d+h\s*\d+m)/i);
      return m ? m[1] : '';
    };

    result.hunts.kills = findNumBefore('Derrotados') || (huntText.match(/(\d[\d.,]*)\s+Derrotados/i)||[])[1] || '';
    result.hunts.time = findTimeBefore('Tempo na hunt') || (huntText.match(/(\d+m\s*\d+s)/i)||[])[1] || (huntText.match(/(\d+h\s*\d+m)/i)||[])[1] || '';
    result.hunts.xp = findNumBefore('XP ganha') || '';
    result.hunts.captures = findNumBefore('Capturados') || '';
    result.hunts.loot = findDollarBefore('Loot') || '';
    result.hunts.supply = findNegDollarBefore('Supply') || '';
    result.hunts.balance = findPosDollarBefore('Saldo') || '';
    result.hunts.goldPerHour = (huntText.match(/\$([\d.,]+)\/h/)||[])[1] || '';
    result.hunts.xpPerHour = (huntText.match(/([\d.,]*)\s*XP\/h/i)||[])[1] || '';
    result.hunts.killsPerHour = (huntText.match(/(\d+)\/h\b/)||[])[1] || '';

    const dropsMatch = huntText.match(/DROPS\s+DA\s+SESS[ÃA]O([\s\S]*?)$/i);
    if (dropsMatch) {
      const dropRe = /([A-Za-z][A-Za-z\s]+?)\s*[×xX]\s*(\d[\d.,]*)\s*\$([\d.,]+)/g;
      let dm;
      while ((dm = dropRe.exec(dropsMatch[1])) !== null) {
        result.drops.push({ name: dm[1].trim(), qty: dm[2].trim(), value: dm[3].trim() });
      }
    }

    result.debug = panelText.substring(0, 400);
    return result;
  } catch (e) {
    return { debug: 'ERRO: ' + String(e) };
  }
}

async function refreshAnalyzer() {
  const allData = [];
  for (let i = 0; i < SLOT_COUNT; i++) {
    allData.push(await extractFromIframe(i));
  }

  $('analyzerAccounts').innerHTML = allData.map((data, i) => {
    const acc = accounts[i] || {};
    const isLoggedIn = data && !data.debug?.includes('ERRO') && !data.debug?.includes('NAO ENCONTRADO');
    const h = data?.hunts || {};
    const rows = [];
    if (h.kills) rows.push(buildStatRow('⚔ Derrotados', h.kills, ''));
    if (h.time) rows.push(buildStatRow('⏱ Tempo Hunt', h.time, ''));
    if (h.xp) rows.push(buildStatRow('✦ XP Ganha', h.xp, 'xp'));
    if (h.captures) rows.push(buildStatRow('◉ Capturados', h.captures, ''));
    if (h.loot) rows.push(buildStatRow('$ Loot', '$' + h.loot, 'gold'));
    if (h.supply) rows.push(buildStatRow('$ Supply', '-$' + h.supply, 'supply'));
    if (h.balance) rows.push(buildStatRow('$ Saldo', '+$' + h.balance, 'gold'));
    if (h.goldPerHour) rows.push(buildStatRow('$/h', '$' + h.goldPerHour + '/h', 'gold'));
    if (h.xpPerHour) rows.push(buildStatRow('XP/h', h.xpPerHour + ' XP/h', 'xp'));
    if (h.killsPerHour) rows.push(buildStatRow('Kills/h', h.killsPerHour + '/h', ''));

    if (data.drops && data.drops.length > 0) {
      rows.push(buildStatRow('─ Drops ─', '', ''));
      for (const d of data.drops.slice(0, 6)) {
        rows.push(buildStatRow(d.name, '×' + d.qty + '  $' + d.value, 'gold'));
      }
    }

    if (rows.length <= 0) {
      const dbg = data.debug ? data.debug.substring(0, 200) : 'nenhum dado';
      rows.push(buildStatRow('Debug', dbg, ''));
    }

    const bodyHtml = `<div class="analyzer-account-body">${rows.join('')}</div>`;
    return `<div class="analyzer-account-card">
      <div class="analyzer-account-header">
        <span class="analyzer-account-name">Conta ${i + 1}${acc.username ? ' (' + escapeHtml(acc.username) + ')' : ''}</span>
        <span class="analyzer-account-status ${isLoggedIn ? 'logged' : 'offline'}">${isLoggedIn ? 'online' : 'offline'}</span>
      </div>
      ${bodyHtml}
    </div>`;
  }).join('');

  let totalLoot = 0, totalSupply = 0, totalBalance = 0, totalXP = 0, totalCaptures = 0, totalKills = 0, onlineCount = 0;
  for (const data of allData) {
    if (!data || data.debug) continue;
    onlineCount++;
    const h = data.hunts || {};
    if (h.kills) totalKills += parseNumber(h.kills);
    if (h.xp) totalXP += parseNumber(h.xp);
    if (h.captures) totalCaptures += parseNumber(h.captures);
    if (h.loot) totalLoot += parseNumber(h.loot);
    if (h.supply) totalSupply += parseNumber(h.supply);
    if (h.balance) totalBalance += parseNumber(h.balance);
  }

  $('analyzerTotal').innerHTML = `<h3>Total (${onlineCount} contas online)</h3>
    <div class="analyzer-total-grid">
      <div class="analyzer-total-item"><span class="analyzer-total-label">Saldo Total</span><span class="analyzer-total-value gold">+$${formatMoney(totalBalance)}</span></div>
      <div class="analyzer-total-item"><span class="analyzer-total-label">Loot Total</span><span class="analyzer-total-value gold">$${formatMoney(totalLoot)}</span></div>
      <div class="analyzer-total-item"><span class="analyzer-total-label">XP Total</span><span class="analyzer-total-value xp">${formatMoney(totalXP)}</span></div>
      <div class="analyzer-total-item"><span class="analyzer-total-label">Derrotados</span><span class="analyzer-total-value">${formatMoney(totalKills)}</span></div>
      <div class="analyzer-total-item"><span class="analyzer-total-label">Capturados</span><span class="analyzer-total-value">${totalCaptures}</span></div>
      <div class="analyzer-total-item"><span class="analyzer-total-label">Supply Total</span><span class="analyzer-total-value supply">-$${formatMoney(totalSupply)}</span></div>
    </div>`;
}

$('btnEnterAll').addEventListener('click', enterAll);
$('btnMuteAll').addEventListener('click', muteAll);

let mobileLayoutCount = 4;
function applyMobileLayout(count) {
  mobileLayoutCount = count;
  const panelsEl = $('panels');
  panelsEl.className = 'panels panels-' + count;
  panelsEl.querySelectorAll('.panel').forEach((p, idx) => {
    p.style.display = idx < count ? '' : 'none';
  });
  $('btnLayout').textContent = '⬜ ' + count + ' tela' + (count > 1 ? 's' : '');
}
applyMobileLayout(4);
$('btnLayout').addEventListener('click', () => {
  mobileLayoutCount = mobileLayoutCount % 4 + 1;
  applyMobileLayout(mobileLayoutCount);
});

$('btnToggleAccounts').addEventListener('click', toggleAccounts);
$('btnCloseSidebar').addEventListener('click', () => $('accountsSidebar').classList.add('hidden'));
$('btnAddAccount').addEventListener('click', showAddForm);
$('btnSave').addEventListener('click', saveAccount);
$('btnCancel').addEventListener('click', hideModal);
$('btnDelete').addEventListener('click', deleteAccount);
$('btnAnalyzer').addEventListener('click', openAnalyzer);
$('closeAnalyzer').addEventListener('click', closeAnalyzer);
$('refreshAnalyzer').addEventListener('click', () => { analyzerCountdown = 15; refreshAnalyzer(); });
$('analyzerOverlay').addEventListener('click', e => { if (e.target === $('analyzerOverlay')) closeAnalyzer(); });
$('btnBot').addEventListener('click', openBot);
$('closeBot').addEventListener('click', closeBot);
$('refreshBot').addEventListener('click', refreshBot);
$('botOverlay').addEventListener('click', e => { if (e.target === $('botOverlay')) closeBot(); });

$('accountsList').addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (btn) showEditForm(parseInt(btn.dataset.index));
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

let botSelectedAccount = 0;
let botConfigs = {};
let mobileCreatures = [];
let mobileCreaturesMap = {};

function getTokenFromIframe(index) {
  try {
    const iframe = $('wv' + index);
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    const win = iframe.contentWindow;
    const keys = ['token', 'auth_token', 'access_token', 'jwt'];
    for (const key of keys) {
      let val = win.localStorage.getItem(key);
      if (val) return val;
      val = win.sessionStorage.getItem(key);
      if (val) return val;
    }
    for (let i = 0; i < win.localStorage.length; i++) {
      const k = win.localStorage.key(i);
      const v = win.localStorage.getItem(k);
      if (v && v.includes('.') && v.split('.').length === 3) return v;
    }
    for (let i = 0; i < win.sessionStorage.length; i++) {
      const k = win.sessionStorage.key(i);
      const v = win.sessionStorage.getItem(k);
      if (v && v.includes('.') && v.split('.').length === 3) return v;
    }
  } catch {}
  return null;
}

async function fetchMobileCreatures() {
  try {
    const resp = await fetch('https://poke.idleworld.online/game/creatures.json');
    if (!resp.ok) return [];
    const data = await resp.json();
    const raw = data.creatures || data;
    const arr = Array.isArray(raw) ? raw : Object.values(raw);
    const list = [];
    const map = {};
    for (const c of arr) {
      if (!c || typeof c !== 'object') continue;
      const name = c.name || '';
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const types = [c.type1, c.type2].filter(Boolean).map(t => t.charAt(0) + t.slice(1).toLowerCase());
      const huntLevel = c.huntLevel || 0;
      const pokeId = c.pokeId || c.id || 0;
      const entry = { id: pokeId, name, slug, types, huntLevel };
      list.push(entry);
      map[slug] = entry;
    }
    list.sort((a, b) => a.name.localeCompare(b.name));
    mobileCreatures = list;
    mobileCreaturesMap = map;
    return list;
  } catch { return []; }
}

async function fetchMobileHuntConfig(slug) {
  try {
    const resp = await fetch('https://poke.idleworld.online/api/game/hunt-config?slug=' + encodeURIComponent(slug));
    if (!resp.ok) return null;
    return await resp.json();
  } catch { return null; }
}

async function fetchMobileMapMarkers() {
  try {
    const resp = await fetch('https://poke.idleworld.online/game/map-markers');
    if (!resp.ok) return null;
    return await resp.json();
  } catch { return null; }
}

async function getBotConfig(index) {
  const token = getTokenFromIframe(index);
  if (!token) return null;
  try {
    const resp = await fetch('https://poke.idleworld.online/api/game/auto-helper', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch { return null; }
}

async function setBotConfig(index, partial) {
  const token = getTokenFromIframe(index);
  if (!token) return null;
  try {
    const resp = await fetch('https://poke.idleworld.online/api/game/auto-helper', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(partial)
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch { return null; }
}

function openBot() {
  $('botOverlay').classList.remove('hidden');
  renderBotTabs();
  if (accounts[botSelectedAccount].username) loadBotAccount(botSelectedAccount);
}

function closeBot() {
  $('botOverlay').classList.add('hidden');
}

function renderBotTabs() {
  const tabs = $('botAccountTabs');
  tabs.innerHTML = accounts.map((acc, i) => {
    const hasConfig = botConfigs[i] !== undefined;
    const statusClass = hasConfig ? 'online' : 'offline';
    const statusText = hasConfig ? '●' : '○';
    return `<div class="bot-tab ${i === botSelectedAccount ? 'active' : ''}" data-bot-index="${i}">
      ${acc.username || 'Slot ' + (i+1)}
      <span class="bot-tab-status ${statusClass}">${statusText}</span>
    </div>`;
  }).join('');

  tabs.querySelectorAll('.bot-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const idx = parseInt(tab.dataset.botIndex);
      botSelectedAccount = idx;
      renderBotTabs();
      if (accounts[idx].username) loadBotAccount(idx);
    });
  });
}

async function loadBotAccount(index) {
  const content = $('botContent');
  content.innerHTML = '<div class="bot-status loading">Carregando configurações...</div>';

  const config = await getBotConfig(index);
  if (!config) {
    content.innerHTML = '<div class="bot-status error">Não foi possível conectar. Verifique se a conta está logada.</div>';
    return;
  }

  botConfigs[index] = config;
  renderBotConfig(index, config);
}

function renderBotConfig(index, config) {
  const content = $('botContent');

  const ballsHtml = (config.balls || []).map(b =>
    `<div class="bot-ball-option ${config.autoCatchBallId === b.id ? 'selected' : ''}" data-ball-id="${b.id}" data-ball-type="catch">
      <img src="https://poke.idleworld.online${b.iconUrl}" alt="${b.name}"/>
      <span>${b.name}</span>
      <span class="bot-ball-qty">×${b.quantity}</span>
    </div>`
  ).join('');

  const shinyBallsHtml = (config.balls || []).map(b =>
    `<div class="bot-ball-option ${config.autoCatchShinyBallId === b.id ? 'selected' : ''}" data-ball-id="${b.id}" data-ball-type="shiny">
      <img src="https://poke.idleworld.online${b.iconUrl}" alt="${b.name}"/>
      <span>${b.name}</span>
      <span class="bot-ball-qty">×${b.quantity}</span>
    </div>`
  ).join('');

  const potionsHtml = (config.potions || []).map(p =>
    `<div class="bot-potion-row">
      <div class="bot-potion-info">
        <div class="bot-potion-name">${p.name} (×${p.quantity})</div>
        <div class="bot-potion-heal">Cura: ${p.healAmount} HP</div>
      </div>
      <div class="toggle ${config.autoPotionItemId === p.id ? 'on' : ''}" data-potion-id="${p.id}"></div>
    </div>`
  ).join('');

  content.innerHTML = `
    <div id="botStatusMsg"></div>

    <div class="bot-section">
      <div class="bot-section-title">⚔ Auto Catch</div>
      <div class="bot-row">
        <span class="bot-row-label">Ativar Auto Catch</span>
        <div class="toggle ${config.autoCatch ? 'on' : ''}" data-field="autoCatch"></div>
      </div>
      <div class="bot-row" style="flex-direction:column;align-items:stretch;gap:8px">
        <span class="bot-row-label">Pokéball para Catch</span>
        <div class="bot-balls-grid">${ballsHtml}</div>
      </div>
      <div class="bot-row">
        <span class="bot-row-label">Filtrar por nome</span>
        <input class="bot-select" style="max-width:160px" type="text" data-field="autoCatchNames" value="${config.autoCatchNames || ''}" placeholder="ex: pikachu, charizard"/>
      </div>
    </div>

    <div class="bot-section">
      <div class="bot-section-title">✨ Auto Shiny</div>
      <div class="bot-row">
        <span class="bot-row-label">Ativar Auto Shiny</span>
        <div class="toggle ${config.autoCatchShiny ? 'on' : ''}" data-field="autoCatchShiny"></div>
      </div>
      <div class="bot-row" style="flex-direction:column;align-items:stretch;gap:8px">
        <span class="bot-row-label">Pokéball para Shiny</span>
        <div class="bot-balls-grid">${shinyBallsHtml}</div>
      </div>
    </div>

    <div class="bot-section">
      <div class="bot-section-title">💚 Auto Potion</div>
      <div class="bot-row">
        <span class="bot-row-label">Ativar Auto Potion</span>
        <div class="toggle ${config.autoPotion ? 'on' : ''}" data-field="autoPotion"></div>
      </div>
      <div class="bot-row">
        <span class="bot-row-label">Threshold HP (%)</span>
        <input class="bot-select" style="max-width:60px" type="number" data-field="autoPotionThreshold" value="${config.autoPotionThreshold}" min="1" max="100"/>
      </div>
      <div style="margin-top:8px">${potionsHtml}</div>
    </div>

    <div class="bot-section">
      <div class="bot-section-title">💀 Auto Revive</div>
      <div class="bot-row">
        <span class="bot-row-label">Ativar Auto Revive</span>
        <div class="toggle ${config.autoRevive ? 'on' : ''}" data-field="autoRevive"></div>
      </div>
      <div class="bot-row">
        <span class="bot-row-label">Revives disponíveis</span>
        <span style="color:#e7ecf5;font-size:12px;font-weight:600">${config.reviveCount || 0}</span>
      </div>
    </div>
  `;

  content.querySelectorAll('.toggle[data-field]').forEach(toggle => {
    toggle.addEventListener('click', async () => {
      const field = toggle.dataset.field;
      const newVal = !toggle.classList.contains('on');
      toggle.classList.toggle('on');
      showBotStatus('Salvando...', 'loading');
      const result = await setBotConfig(index, { [field]: newVal });
      if (result) {
        botConfigs[index] = result;
        showBotStatus('Salvo!', 'success');
      } else {
        showBotStatus('Erro ao salvar', 'error');
        toggle.classList.toggle('on');
      }
    });
  });

  content.querySelectorAll('.toggle[data-potion-id]').forEach(toggle => {
    toggle.addEventListener('click', async () => {
      const potionId = parseInt(toggle.dataset.potionId);
      showBotStatus('Salvando...', 'loading');
      const result = await setBotConfig(index, { autoPotionItemId: potionId });
      if (result) {
        botConfigs[index] = result;
        renderBotConfig(index, result);
        showBotStatus('Salvo!', 'success');
      } else {
        showBotStatus('Erro ao salvar', 'error');
      }
    });
  });

  content.querySelectorAll('.bot-ball-option').forEach(opt => {
    opt.addEventListener('click', async () => {
      const ballId = parseInt(opt.dataset.ballId);
      const type = opt.dataset.ballType;
      const field = type === 'shiny' ? 'autoCatchShinyBallId' : 'autoCatchBallId';
      showBotStatus('Salvando...', 'loading');
      const result = await setBotConfig(index, { [field]: ballId });
      if (result) {
        botConfigs[index] = result;
        renderBotConfig(index, result);
        showBotStatus('Salvo!', 'success');
      } else {
        showBotStatus('Erro ao salvar', 'error');
      }
    });
  });

  content.querySelectorAll('input[data-field]').forEach(input => {
    let debounce = null;
    input.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(async () => {
        const field = input.dataset.field;
        const val = input.type === 'number' ? parseInt(input.value) || 0 : input.value;
        showBotStatus('Salvando...', 'loading');
        const result = await setBotConfig(index, { [field]: val });
        if (result) {
          botConfigs[index] = result;
          showBotStatus('Salvo!', 'success');
        } else {
          showBotStatus('Erro ao salvar', 'error');
        }
      }, 800);
    });
  });
}

function showBotStatus(msg, type) {
  const el = $('botStatusMsg');
  if (!el) return;
  el.innerHTML = `<div class="bot-status ${type}">${msg}</div>`;
  if (type === 'success') setTimeout(() => { if (el.innerHTML.includes(msg)) el.innerHTML = ''; }, 2000);
}

async function refreshBot() {
  if (accounts[botSelectedAccount].username) {
    loadBotAccount(botSelectedAccount);
  }
}

loadAccounts();
renderPanels();
renderSidebar();

/* ===== Auto Hunt Loop (PWA) ===== */
let mobileHuntState = [];
let mobileHuntIntervals = [];
let mobileHuntCounts = [];
const mobileHuntRegions = ['Kanto', 'Johto', 'Outland', 'Orre', 'Nightmare'];
const mobileHuntTypes = ['AÇO', 'ÁGUA', 'DRAGÃO', 'ELÉTRICO', 'FADA', 'FANTASMA', 'FOGO', 'GELO', 'INSETO', 'LUTADOR', 'NORMAL', 'PEDRA', 'PLANTA', 'PSÍQUICO', 'SOMBRIO', 'TERRA', 'VENENO', 'VOADOR'];
let mobileMapMarkersCache = null;

function mobileGetMapStateScript() {
  return `(function() {
    var mapTitle = document.querySelector('.map-title');
    var isOpen = !!(mapTitle && mapTitle.getBoundingClientRect().width > 0);
    return { isOpen: isOpen };
  })()`;
}

function mobileOpenMapScript() {
  return `(function() {
    var mapTitle = document.querySelector('.map-title');
    if (mapTitle && mapTitle.getBoundingClientRect().width > 0) return 'already_open';

    var btn = document.querySelector('button[data-guide="dock-map"]');
    if (btn) { btn.click(); return 'clicked_data_guide'; }

    var btns2 = document.querySelectorAll('button[title="Mapa"]');
    for (var i = 0; i < btns2.length; i++) {
      var r = btns2[i].getBoundingClientRect();
      if (r.width > 0 && r.height > 0) { btns2[i].click(); return 'clicked_title_mapa'; }
    }

    var allBtns = document.querySelectorAll('button.dock-btn');
    for (var j = 0; j < allBtns.length; j++) {
      var img = allBtns[j].querySelector('img');
      if (img && img.src && img.src.indexOf('map') !== -1) {
        allBtns[j].click();
        return 'clicked_dock_img';
      }
    }

    return 'not_found_all_methods';
  })()`;
}

function mobileClickHuntMarkerScript(slug, pokemonName) {
  return `(function() {
    var mapTitle = document.querySelector('.map-title');
    if (!mapTitle || mapTitle.getBoundingClientRect().width === 0) return { ok: false, reason: 'map_not_open' };

    var btn = document.querySelector('button.hunt-marker[data-guide="hunt-${slug}"]');
    if (btn) { btn.scrollIntoView({ block: 'center', inline: 'center' }); btn.click(); return { ok: true, method: 'data-guide' }; }

    var targetName = '${(pokemonName || slug).toLowerCase()}';
    var markers = document.querySelectorAll('button.hunt-marker');
    for (var i = 0; i < markers.length; i++) {
      var nameEl = markers[i].querySelector('.hunt-name');
      if (nameEl && nameEl.textContent.trim().toLowerCase() === targetName) {
        markers[i].scrollIntoView({ block: 'center', inline: 'center' });
        markers[i].click();
        return { ok: true, method: 'hunt-name' };
      }
    }

    var allEls = document.querySelectorAll('div, span, button, a, li, p');
    for (var j = 0; j < allEls.length; j++) {
      var el = allEls[j];
      var text = (el.innerText || el.textContent || '').trim().toLowerCase();
      if (text === targetName || text.indexOf(targetName) !== -1) {
        var rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && rect.y > 100) {
          el.click();
          return { ok: true, method: 'text' };
        }
      }
    }

    return { ok: false, reason: 'marker_not_found', markersFound: markers.length };
  })()`;
}

function mobileCloseMapScript() {
  return `(function() {
    var btns = document.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      var text = (btns[i].innerText || '').trim();
      if (text === '×' || text === 'x' || text === 'X') {
        var rect = btns[i].getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) { btns[i].click(); return true; }
      }
    }
    return false;
  })()`;
}

function mobileSelectRegionScript(regionName) {
  return `(function() {
    var btns = document.querySelectorAll('button.map-area');
    for (var i = 0; i < btns.length; i++) {
      var name = btns[i].querySelector('.map-area-name');
      if (name && name.innerText.trim().toLowerCase() === '${regionName.toLowerCase()}') {
        btns[i].click(); return 'selected';
      }
    }
    return 'not_found';
  })()`;
}

function mobileTypeFilterScript(typeName) {
  return `(function() {
    var btns = document.querySelectorAll('button.pp-type.map-type-p');
    for (var i = 0; i < btns.length; i++) {
      if (btns[i].innerText.trim().toUpperCase() === '${typeName.toUpperCase()}') {
        btns[i].click(); return 'toggled';
      }
    }
    return 'not_found';
  })()`;
}

function mobileSearchPokemonScript(pokemonName, slug) {
  return `(function() {
    var mapTitle = document.querySelector('.map-title');
    if (!mapTitle || mapTitle.getBoundingClientRect().width === 0) return { ok: false, reason: 'map_not_open' };

    var slug = '${slug}';
    var btn = document.querySelector('button.hunt-marker[data-guide="hunt-' + slug + '"]');
    if (btn) {
      btn.scrollIntoView({ block: 'center', inline: 'center' });
      btn.click();
      return { ok: true, method: 'data-guide', slug: slug };
    }

    var targetName = '${pokemonName.toLowerCase()}';
    var markers = document.querySelectorAll('button.hunt-marker');
    for (var i = 0; i < markers.length; i++) {
      var nameEl = markers[i].querySelector('.hunt-name');
      if (nameEl && nameEl.textContent.trim().toLowerCase() === targetName) {
        markers[i].scrollIntoView({ block: 'center', inline: 'center' });
        markers[i].click();
        return { ok: true, method: 'hunt-name', name: nameEl.textContent.trim() };
      }
    }

    var allEls = document.querySelectorAll('div, span, button, a, li, p');
    for (var j = 0; j < allEls.length; j++) {
      var el = allEls[j];
      var text = (el.innerText || el.textContent || '').trim().toLowerCase();
      if (text === targetName || text.indexOf(targetName) !== -1) {
        var rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && rect.y > 100) {
          el.click();
          return { ok: true, method: 'text', name: text.substring(0, 40) };
        }
      }
    }

    return { ok: false, reason: 'marker_not_found', markersFound: markers.length };
  })()`;
}

async function openAutoHuntPwa() {
  $('autoHuntOverlay').classList.remove('hidden');
  await renderMobileAutoHuntConfig();
  renderMobileAutoHuntStatus();
}

function closeAutoHuntPwa() {
  $('autoHuntOverlay').classList.add('hidden');
}

async function renderMobileAutoHuntConfig() {
  const configEl = $('autoHuntConfig');
  configEl.innerHTML = '<div style="color:#8b98af;font-size:11px;padding:8px">Carregando lista de pokemon...</div>';

  if (mobileCreatures.length === 0) {
    await fetchMobileCreatures();
  }

  const regionOptions = mobileHuntRegions.map(r => `<option value="${r}">${r}</option>`).join('');
  const typeOptions = mobileHuntTypes.map(t => `<option value="${t}">${t}</option>`).join('');
  const anyRunning = mobileHuntState.some(s => s && s !== 'idle' && s !== 'stopped');

  let html = `<h3>Configuracao da Hunt</h3>`;

  accounts.forEach((a, i) => {
    if (!a.username) return;
    const cfg = a.huntConfig || {};
    const isRunning = mobileHuntState[i] && mobileHuntState[i] !== 'idle' && mobileHuntState[i] !== 'stopped';
    const selectedPokemon = cfg.pokemon || '';
    const selectedRegion = cfg.region || '';
    const selectedType = cfg.type || '';
    const delay = cfg.delay ?? 30;

    html += `
    <div style="background:#0c1018;border:1px solid #1a2333;border-radius:8px;padding:12px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <input type="checkbox" class="mobile-hunt-account-check" value="${i}" id="mHuntEnabled${i}" ${isRunning ? 'checked' : ''}/>
        <label for="mHuntEnabled${i}" style="color:#e8a83c;font-weight:700;font-size:13px;cursor:pointer">
          ${escapeHtml(a.username)} — Conta ${i+1}
        </label>
        ${isRunning ? '<span style="color:#2ecc71;font-size:10px;margin-left:auto">&#9679; caçando</span>' : ''}
      </div>
      <div class="auto-hunt-row">
        <label>Pokemon:</label>
        <div style="display:flex;flex-direction:column;gap:4px;flex:1">
          <input class="auto-hunt-input m-hunt-search" type="text" placeholder="Buscar pokemon..." style="width:100%" data-idx="${i}"/>
          <select class="auto-hunt-select m-hunt-pokemon" size="4" style="width:100%;min-height:60px" data-idx="${i}">
            ${mobileCreatures.map(p => `<option value="${p.slug}" ${p.slug === selectedPokemon ? 'selected' : ''}>${p.name} (Lv ${p.huntLevel || '?'})</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="auto-hunt-row">
        <label>Regiao:</label>
        <select class="auto-hunt-select m-hunt-region" data-idx="${i}">
          <option value="">Todas</option>${regionOptions.replace(new RegExp(`value="${selectedRegion}"`), `value="${selectedRegion}" selected`)}
        </select>
      </div>
      <div class="auto-hunt-row">
        <label>Tipo:</label>
        <select class="auto-hunt-select m-hunt-type" data-idx="${i}">
          <option value="">Todos</option>${typeOptions.replace(new RegExp(`value="${selectedType}"`), `value="${selectedType}" selected`)}
        </select>
      </div>
      <div class="auto-hunt-row">
        <label>Delay (s):</label>
        <input class="auto-hunt-input m-hunt-delay" type="number" value="${delay}" min="5" max="300" style="max-width:60px" data-idx="${i}"/>
      </div>
      <div class="auto-hunt-row">
        <button class="auto-hunt-btn m-hunt-start-btn" data-idx="${i}" style="${isRunning ? 'display:none' : ''}">▶ Iniciar</button>
        <button class="auto-hunt-btn stop m-hunt-stop-btn" data-idx="${i}" style="${isRunning ? '' : 'display:none'}">■ Parar</button>
      </div>
    </div>`;
  });

  if (!accounts.some(a => a.username)) {
    html += `<div style="color:#5c6b83;font-size:12px;text-align:center;padding:20px">Nenhuma conta configurada.</div>`;
  }

  configEl.innerHTML = html;

  document.querySelectorAll('.m-hunt-search').forEach(searchInput => {
    const idx = searchInput.dataset.idx;
    const pokemonSelect = document.querySelector(`.m-hunt-pokemon[data-idx="${idx}"]`);
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase().trim();
      const options = pokemonSelect.options;
      let firstMatch = null;
      for (let j = 0; j < options.length; j++) {
        const opt = options[j];
        const match = !q || opt.text.toLowerCase().includes(q) || opt.value.includes(q);
        opt.hidden = !match;
        opt.style.display = match ? '' : 'none';
        if (match && !firstMatch) firstMatch = opt;
      }
      if (firstMatch) {
        pokemonSelect.value = firstMatch.value;
        pokemonSelect.dispatchEvent(new Event('change'));
      }
    });
  });

  document.querySelectorAll('.m-hunt-pokemon').forEach(pokemonSelect => {
    const idx = pokemonSelect.dataset.idx;
    pokemonSelect.addEventListener('change', () => {
      const slug = pokemonSelect.value;
      const creature = mobileCreaturesMap[slug];
      if (creature && creature.types && creature.types.length > 0) {
        const typeSelect = document.querySelector(`.m-hunt-type[data-idx="${idx}"]`);
        if (typeSelect) {
          const primaryType = creature.types[0].toUpperCase();
          for (const opt of typeSelect.options) {
            if (opt.value.toUpperCase() === primaryType) {
              typeSelect.value = opt.value;
              break;
            }
          }
        }
      }
      saveMobileHuntConfig(parseInt(idx));
    });
  });

  document.querySelectorAll('.m-hunt-pokemon, .m-hunt-region, .m-hunt-type, .m-hunt-delay').forEach(el => {
    el.addEventListener('change', () => saveMobileHuntConfig(parseInt(el.dataset.idx)));
  });

  document.querySelectorAll('.m-hunt-start-btn').forEach(btn => {
    btn.addEventListener('click', () => startMobileAutoHuntForAccount(parseInt(btn.dataset.idx)));
  });

  document.querySelectorAll('.m-hunt-stop-btn').forEach(btn => {
    btn.addEventListener('click', () => stopMobileAutoHuntForAccount(parseInt(btn.dataset.idx)));
  });
}

function saveMobileHuntConfig(idx) {
  const pokemonSelect = document.querySelector(`.m-hunt-pokemon[data-idx="${idx}"]`);
  const cfg = {
    pokemon: pokemonSelect ? pokemonSelect.value : '',
    region: document.querySelector(`.m-hunt-region[data-idx="${idx}"]`)?.value || '',
    type: document.querySelector(`.m-hunt-type[data-idx="${idx}"]`)?.value || '',
    delay: parseInt(document.querySelector(`.m-hunt-delay[data-idx="${idx}"]`)?.value) || 30
  };
  savedAccounts[idx].huntConfig = cfg;
  saveAccounts();
}

function renderMobileAutoHuntStatus() {
  const statusEl = $('autoHuntStatus');
  statusEl.innerHTML = accounts.map((acc, i) => {
    const running = mobileHuntState[i] && mobileHuntState[i] !== 'idle' && mobileHuntState[i] !== 'stopped' && mobileHuntState[i] !== 'not_logged';
    const count = mobileHuntCounts[i] || 0;
    const stateText = mobileHuntState[i] || 'idle';
    return `<div class="analyzer-account-card">
      <div class="analyzer-account-header">
        <span class="analyzer-account-name">Conta ${i + 1}${acc.username ? ' (' + escapeHtml(acc.username) + ')' : ''}</span>
        <span class="analyzer-account-status ${running ? 'logged' : 'offline'}">${running ? 'caçando' : 'parado'}</span>
      </div>
      <div class="analyzer-account-body">
        <div class="analyzer-stat-row"><span class="analyzer-stat-label">Hunts feitas</span><span class="analyzer-stat-value gold">${count}</span></div>
        <div class="analyzer-stat-row"><span class="analyzer-stat-label">Estado</span><span class="analyzer-stat-value">${escapeHtml(stateText)}</span></div>
      </div>
    </div>`;
  }).join('');
}

async function startMobileAutoHuntForAccount(idx) {
  if (!mobileMapMarkersCache) {
    mobileMapMarkersCache = await fetchMobileMapMarkers();
  }
  const markers = mobileMapMarkersCache;
  const mapSize = (markers && markers.map) || { w: 1788, h: 3364 };

  const cfg = savedAccounts[idx].huntConfig || {};
  const slug = cfg.pokemon || '';
  const region = cfg.region || '';
  const type = cfg.type || '';
  const delay = cfg.delay || 30;

  if (!slug) { mobileHuntState[idx] = 'sem pokemon configurado'; renderMobileAutoHuntStatus(); renderMobileAutoHuntConfig(); return; }

  const creature = mobileCreaturesMap[slug] || {};
  const pokemonName = creature.name || slug;
  const pokemonSlug = creature.slug || slug;

  let marker = null;
  if (markers && markers.hunts) {
    marker = markers.hunts.find(h => h.slug === pokemonSlug || h.name.toLowerCase() === pokemonName.toLowerCase());
  }
  if (!marker && markers && markers.hunts) {
    marker = markers.hunts.find(h => h.slug && h.slug.includes(pokemonSlug));
  }

  mobileHuntState[idx] = 'running';
  mobileHuntCounts[idx] = 0;
  runMobileHuntLoop(idx, pokemonSlug, pokemonName, region, type, delay, marker, mapSize);
  renderMobileAutoHuntStatus();
  renderMobileAutoHuntConfig();
}

function stopMobileAutoHuntForAccount(idx) {
  if (mobileHuntIntervals[idx]) { clearTimeout(mobileHuntIntervals[idx]); mobileHuntIntervals[idx] = null; }
  mobileHuntState[idx] = 'stopped';
  renderMobileAutoHuntStatus();
  renderMobileAutoHuntConfig();
}

async function runMobileHuntLoop(index, slug, pokemonName, region, type, delay, marker, mapSize) {
  if (mobileHuntState[index] !== 'running') return;

  const cfg = savedAccounts[index].huntConfig || {};
  const newSlug = cfg.pokemon || '';
  const newRegion = cfg.region || '';
  const newType = cfg.type || '';
  const newDelay = cfg.delay || 30;

  if (newSlug && (newSlug !== slug || newRegion !== region || newType !== type)) {
    const creature = mobileCreaturesMap[newSlug] || {};
    const newName = creature.name || newSlug;
    let newMarker = null;
    if (mobileMapMarkersCache && mobileMapMarkersCache.hunts) {
      newMarker = mobileMapMarkersCache.hunts.find(h => h.slug === newSlug || h.name.toLowerCase() === newName.toLowerCase());
    }
    if (!newMarker && mobileMapMarkersCache && mobileMapMarkersCache.hunts) {
      newMarker = mobileMapMarkersCache.hunts.find(h => h.slug && h.slug.includes(newSlug));
    }
    slug = newSlug;
    pokemonName = newName;
    region = newRegion;
    type = newType;
    marker = newMarker;
  }
  delay = newDelay;

  const iframe = $('wv' + index);

  try {
    mobileHuntState[index] = 'opening map';
    renderMobileAutoHuntStatus();

    const mapState = await iframe.contentWindow.eval(mobileGetMapStateScript());
    if (!mapState || !mapState.isOpen) {
      await iframe.contentWindow.eval(mobileOpenMapScript());
      await new Promise(r => setTimeout(r, 1500));
    }

    if (region) {
      mobileHuntState[index] = 'selecting region: ' + region;
      renderMobileAutoHuntStatus();
      await iframe.contentWindow.eval(mobileSelectRegionScript(region));
      await new Promise(r => setTimeout(r, 1000));
    }

    if (type) {
      mobileHuntState[index] = 'filtering type: ' + type;
      renderMobileAutoHuntStatus();
      await iframe.contentWindow.eval(mobileTypeFilterScript(type));
      await new Promise(r => setTimeout(r, 1000));
    }

    mobileHuntState[index] = 'clicking: ' + pokemonName;
    renderMobileAutoHuntStatus();

    const clicked = await iframe.contentWindow.eval(mobileSearchPokemonScript(pokemonName, slug));

    if (clicked && clicked.ok) {
      mobileHuntState[index] = 'hunting: ' + pokemonName + ' (' + clicked.method + ')';
      renderMobileAutoHuntStatus();
      await new Promise(r => setTimeout(r, 3000));
      await iframe.contentWindow.eval(mobileCloseMapScript());
      mobileHuntCounts[index] = (mobileHuntCounts[index] || 0) + 1;
    } else {
      mobileHuntState[index] = pokemonName + ' not found (' + (clicked?.reason || 'unknown') + '), retrying...';
      renderMobileAutoHuntStatus();
      await iframe.contentWindow.eval(mobileCloseMapScript());
    }

  } catch (e) {
    mobileHuntState[index] = 'error: ' + String(e).substring(0, 60);
    renderMobileAutoHuntStatus();
  }

  renderMobileAutoHuntStatus();

  if (mobileHuntState[index] !== 'stopped') {
    mobileHuntIntervals[index] = setTimeout(() => {
      if (mobileHuntState[index] !== 'stopped') {
        mobileHuntState[index] = 'running';
        runMobileHuntLoop(index, slug, pokemonName, region, type, delay, marker, mapSize);
      }
    }, 60000 + delay * 1000);
  }
}

$('btnAutoHunt').addEventListener('click', openAutoHuntPwa);
$('closeAutoHunt').addEventListener('click', closeAutoHuntPwa);
$('autoHuntOverlay').addEventListener('click', e => { if (e.target === $('autoHuntOverlay')) closeAutoHuntPwa(); });

/* ===== Auto Catch (PWA) ===== */
function mobileGetCaptureStateScript() {
  return `(function() {
    var throwBtns = [];
    function findInNode(root) {
      if (!root) return;
      var btns = root.querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) {
        var text = (btns[i].innerText || btns[i].textContent || '').trim().toLowerCase();
        if (text === 'lançar' || text === 'lancar' || text === 'throw' || text.indexOf('lan') === 0) {
          var r = btns[i].getBoundingClientRect();
          if (r.width > 0 && r.height > 0) throwBtns.push(btns[i]);
        }
        if (btns[i].className && btns[i].className.indexOf('cap-throw') !== -1) {
          var r2 = btns[i].getBoundingClientRect();
          if (r2.width > 0 && r2.height > 0) throwBtns.push(btns[i]);
        }
      }
    }
    findInNode(document);
    var allEls = document.querySelectorAll('*');
    for (var s = 0; s < allEls.length; s++) {
      if (allEls[s].shadowRoot) findInNode(allEls[s].shadowRoot);
    }
    var frames = document.querySelectorAll('iframe');
    for (var f = 0; f < frames.length; f++) {
      try { findInNode(frames[f].contentDocument); } catch(e) {}
    }
    if (throwBtns.length === 0) {
      var allBtns = document.querySelectorAll('button');
      var btnSamples = [];
      for (var j = 0; j < Math.min(allBtns.length, 20); j++) {
        var t = (allBtns[j].innerText || allBtns[j].textContent || '').trim().substring(0, 40);
        var cn = allBtns[j].className || '';
        btnSamples.push(t + ' [' + cn.substring(0, 50) + ']');
      }
      var shadowCount = 0;
      for (var sc = 0; sc < allEls.length; sc++) { if (allEls[sc].shadowRoot) shadowCount++; }
      return { active: false, debug: 'no_throw_buttons', totalButtons: allBtns.length, shadows: shadowCount, iframes: frames.length, samples: btnSamples };
    }
    var balls = 0;
    var countEl = document.querySelector('.cap-chip-n');
    if (countEl) balls = parseInt((countEl.innerText || countEl.textContent || '').replace(/[^0-9]/g, '')) || 0;
    var wildCount = 0;
    var countEl2 = document.querySelector('.cap-count');
    if (countEl2) { var m = (countEl2.innerText || '').match(/(\\d+)/); if (m) wildCount = parseInt(m[1]); }
    var names = [];
    var nameEls = document.querySelectorAll('.cap-name');
    for (var k = 0; k < nameEls.length; k++) names.push(nameEls[k].textContent.trim());
    return { active: true, wildCount: wildCount, balls: balls, canThrow: throwBtns.length, names: names };
  })()`;
}

function mobileThrowAllBallsScript() {
  return `(function() {
    var thrown = 0;
    function clickThrowBtns(root) {
      if (!root) return 0;
      var count = 0;
      var btns = root.querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) {
        var text = (btns[i].innerText || btns[i].textContent || '').trim().toLowerCase();
        var isThrow = text === 'lançar' || text === 'lancar' || text === 'throw' || text.indexOf('lan') === 0;
        var isCapThrow = btns[i].className && btns[i].className.indexOf('cap-throw') !== -1;
        if (isThrow || isCapThrow) {
          var r = btns[i].getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            var cx = r.x + r.width/2;
            var cy = r.y + r.height/2;
            btns[i].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, clientX: cx, clientY: cy }));
            btns[i].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy }));
            btns[i].dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1, clientX: cx, clientY: cy }));
            btns[i].dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy }));
            btns[i].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy }));
            btns[i].click();
            count++;
          }
        }
      }
      return count;
    }
    thrown += clickThrowBtns(document);
    if (thrown === 0) {
      var allEls = document.querySelectorAll('*');
      for (var s = 0; s < allEls.length; s++) {
        if (allEls[s].shadowRoot) thrown += clickThrowBtns(allEls[s].shadowRoot);
      }
    }
    if (thrown === 0) {
      var frames = document.querySelectorAll('iframe');
      for (var f = 0; f < frames.length; f++) {
        try { thrown += clickThrowBtns(frames[f].contentDocument); } catch(e) {}
      }
    }
    return { thrown: thrown };
  })()`;
}

function mobileGoHomeScript() {
  return `(function() {
    var btn = document.querySelector('button[data-guide="dock-home"]');
    if (btn) { btn.click(); return 'clicked_home'; }
    return 'not_found';
  })()`;
}

function mobileOpenMarketScript() {
  return `(function() {
    var btn = document.querySelector('button.market-cta');
    if (btn) { btn.click(); return 'clicked_market'; }
    return 'not_found';
  })()`;
}

function mobileTalkToNpcScript() {
  return `(function() {
    var fieldPlates = document.querySelectorAll('.field-plate');
    for (var i = 0; i < fieldPlates.length; i++) {
      var btn = fieldPlates[i].querySelector('button.npc-plate-btn');
      if (!btn) continue;
      var r = btn.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      var canvas = fieldPlates[i].querySelector('.field-name canvas');
      if (canvas && canvas.getAttribute('width') === '33') {
        btn.click();
        return 'clicked_mark_npc';
      }
    }
    var allBtns = document.querySelectorAll('button.npc-plate-btn');
    for (var j = 0; j < allBtns.length; j++) {
      var r2 = allBtns[j].getBoundingClientRect();
      if (r2.width > 0 && r2.height > 0) { allBtns[j].click(); return 'clicked_first_npc'; }
    }
    return 'not_found';
  })()`;
}

function mobileOpenNpcShopScript() {
  return `(function() {
    var btn = document.querySelector('button.npc-dlg-btn');
    if (btn) { btn.click(); return 'clicked_open_shop'; }
    return 'not_found';
  })()`;
}

function mobileClickSellTabScript() {
  return `(function() {
    var btns = document.querySelectorAll('button.mk-tab');
    for (var i = 0; i < btns.length; i++) {
      var text = (btns[i].innerText || btns[i].textContent || '').trim().toLowerCase();
      if (text.indexOf('vender') !== -1) {
        var r = btns[i].getBoundingClientRect();
        if (r.width > 0 && r.height > 0) { btns[i].click(); return 'clicked_sell_tab'; }
      }
    }
    return 'not_found';
  })()`;
}

function mobileSelectAllLootScript() {
  return `(function() {
    var btn = document.querySelector('button.mk-selall');
    if (btn) { btn.click(); return 'clicked_select_all'; }
    return 'not_found';
  })()`;
}

function mobileClickSellButtonScript() {
  return `(function() {
    var btn = document.querySelector('button.mk-sell');
    if (btn) { btn.click(); return 'clicked_sell'; }
    return 'not_found';
  })()`;
}

function mobileConfirmSellScript() {
  return `(function() {
    var btns = document.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      var text = (btns[i].innerText || btns[i].textContent || '').trim().toLowerCase();
      if (text === 'confirmar' || text === 'confirm' || text === 'sim' || text === 'ok' || text === 'aceitar') {
        var r = btns[i].getBoundingClientRect();
        if (r.width > 0 && r.height > 0) { btns[i].click(); return 'confirmed'; }
      }
    }
    return 'no_confirm';
  })()`;
}

function mobileClickBuyTabScript() {
  return `(function() {
    var btns = document.querySelectorAll('button.mk-tab');
    for (var i = 0; i < btns.length; i++) {
      var text = (btns[i].innerText || btns[i].textContent || '').trim().toLowerCase();
      if (text.indexOf('comprar') !== -1) {
        var r = btns[i].getBoundingClientRect();
        if (r.width > 0 && r.height > 0) { btns[i].click(); return 'clicked_buy_tab'; }
      }
    }
    return 'not_found';
  })()`;
}

function mobileSetBuyQtyScript(qty) {
  return `(function() {
    var input = document.querySelector('input.mk-qty');
    if (input) {
      var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(input, ${qty});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return 'set_qty_${qty}';
    }
    return 'not_found';
  })()`;
}

function mobileBuyPokeballScript(ballType) {
  return `(function() {
    var rows = document.querySelectorAll('.mk-row');
    var targetIndex = ${ballType || 0};
    var idx = 0;
    for (var i = 0; i < rows.length; i++) {
      var buyBtn = rows[i].querySelector('button.mk-buy');
      if (!buyBtn) continue;
      if (idx === targetIndex) {
        var r = buyBtn.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) { buyBtn.click(); return 'bought_ball_type_' + targetIndex; }
      }
      idx++;
    }
    return 'not_found';
  })()`;
}

function mobileCloseAnyModalScript() {
  return `(function() {
    var xBtn = document.querySelector('.cfg-x, button[aria-label="Fechar"]');
    if (xBtn) { xBtn.click(); return 'closed'; }
    return 'none';
  })()`;
}

const mobileCatchState = [];
const mobileCatchIntervals = [];
const mobileCatchCounts = [];
const mobileCatchBallCounts = [];

async function openAutoCatchPwa() {
  $('autoCatchOverlay').classList.remove('hidden');
  renderMobileAutoCatchConfig();
  renderMobileAutoCatchStatus();
}

function closeAutoCatchPwa() {
  $('autoCatchOverlay').classList.add('hidden');
}

function renderMobileAutoCatchConfig() {
  const accounts = savedAccounts || [];
  const ballTypes = [
    { value: 0, label: 'Poke Ball ($5)' },
    { value: 1, label: 'Great Ball ($20)' },
    { value: 2, label: 'Super Ball ($50)' },
    { value: 3, label: 'Ultra Ball ($130)' }
  ];
  const anyRunning = mobileCatchState.some(s => s && s !== 'idle' && s !== 'stopped');

  let html = `<h3>Configuracao do Auto Catch</h3>`;

  accounts.forEach((a, i) => {
    if (!a.username) return;
    const cfg = a.catchConfig || {};
    const isRunning = mobileCatchState[i] && mobileCatchState[i] !== 'idle' && mobileCatchState[i] !== 'stopped';
    const isVip = a.isVip;
    const ballType = cfg.ballType ?? 0;
    const ballQty = cfg.ballQty ?? 100;
    const delay = cfg.delay ?? 3;
    const autoBuy = cfg.autoBuy !== false;
    const autoSell = cfg.autoSell !== false;

    html += `
    <div style="background:#0c1018;border:1px solid #1a2333;border-radius:8px;padding:12px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <input type="checkbox" class="mobile-catch-account-check" value="${i}" id="mCatchEnabled${i}" ${isRunning ? 'checked' : ''}/>
        <label for="mCatchEnabled${i}" style="color:#e8a83c;font-weight:700;font-size:13px;cursor:pointer">
          ${escapeHtml(a.username)} — Conta ${i+1} ${isVip ? '<span style="color:#f39c12;font-size:10px;border:1px solid #f39c12;padding:1px 4px;border-radius:3px;margin-left:4px">VIP</span>' : ''}
        </label>
        ${isRunning ? '<span style="color:#2ecc71;font-size:10px;margin-left:auto">&#9679; ativo</span>' : ''}
      </div>
      ${!isVip ? `
      <div class="auto-hunt-row">
        <label>Delay (s):</label>
        <input class="auto-hunt-input m-catch-delay" type="number" value="${delay}" min="1" max="30" style="max-width:60px" data-idx="${i}"/>
      </div>
      <div class="auto-hunt-row">
        <label>Tipo:</label>
        <select class="auto-hunt-select m-catch-ball-type" data-idx="${i}">
          ${ballTypes.map(bt => `<option value="${bt.value}" ${bt.value === ballType ? 'selected' : ''}>${bt.label}</option>`).join('')}
        </select>
      </div>
      <div class="auto-hunt-row">
        <label>Qtd:</label>
        <input class="auto-hunt-input m-catch-ball-qty" type="number" value="${ballQty}" min="1" max="1000" style="max-width:60px" data-idx="${i}"/>
      </div>
      ` : ''}
      <div class="auto-hunt-row">
        <label>Auto Buy:</label>
        <label style="min-width:auto;color:#e7ecf5;font-weight:400;display:flex;align-items:center;gap:6px">
          <input type="checkbox" class="m-catch-auto-buy" ${autoBuy ? 'checked' : ''} data-idx="${i}"/> Sim
        </label>
      </div>
      <div class="auto-hunt-row">
        <label>Auto Sell:</label>
        <label style="min-width:auto;color:#e7ecf5;font-weight:400;display:flex;align-items:center;gap:6px">
          <input type="checkbox" class="m-catch-auto-sell" ${autoSell ? 'checked' : ''} data-idx="${i}"/> Sim
        </label>
      </div>
      <div class="auto-hunt-row">
        <button class="auto-hunt-btn m-catch-start-btn" data-idx="${i}" style="${isRunning ? 'display:none' : ''}">▶ Iniciar</button>
        <button class="auto-hunt-btn stop m-catch-stop-btn" data-idx="${i}" style="${isRunning ? '' : 'display:none'}">■ Parar</button>
      </div>
    </div>`;
  });

  if (!accounts.some(a => a.username)) {
    html += `<div style="color:#5c6b83;font-size:12px;text-align:center;padding:20px">Nenhuma conta configurada.</div>`;
  }

  $('autoCatchConfig').innerHTML = html;

  document.querySelectorAll('.m-catch-ball-type, .m-catch-delay, .m-catch-ball-qty, .m-catch-auto-buy, .m-catch-auto-sell').forEach(el => {
    el.addEventListener('change', () => saveMobileCatchConfig(parseInt(el.dataset.idx)));
  });

  document.querySelectorAll('.m-catch-start-btn').forEach(btn => {
    btn.addEventListener('click', () => startMobileAutoCatchForAccount(parseInt(btn.dataset.idx)));
  });

  document.querySelectorAll('.m-catch-stop-btn').forEach(btn => {
    btn.addEventListener('click', () => stopMobileAutoCatchForAccount(parseInt(btn.dataset.idx)));
  });
}

function saveMobileCatchConfig(idx) {
  const cfg = {
    ballType: parseInt(document.querySelector(`.m-catch-ball-type[data-idx="${idx}"]`).value) || 0,
    ballQty: parseInt(document.querySelector(`.m-catch-ball-qty[data-idx="${idx}"]`).value) || 100,
    delay: parseInt(document.querySelector(`.m-catch-delay[data-idx="${idx}"]`).value) || 3,
    autoBuy: document.querySelector(`.m-catch-auto-buy[data-idx="${idx}"]`).checked,
    autoSell: document.querySelector(`.m-catch-auto-sell[data-idx="${idx}"]`).checked
  };
  savedAccounts[idx].catchConfig = cfg;
  saveAccounts();
}

function renderMobileAutoCatchStatus() {
  const accounts = savedAccounts || [];
  $('autoCatchStatus').innerHTML = accounts.map((acc, i) => {
    const state = mobileCatchState[i] || 'idle';
    const isStopped = state === 'idle' || state === 'stopped' || state === 'not_logged';
    const count = mobileCatchCounts[i] || 0;
    const balls = mobileCatchBallCounts[i] || 0;
    return `<div class="analyzer-account-card">
      <div class="analyzer-account-header">
        <span class="analyzer-account-name">Conta ${i+1}${acc.username ? ' ('+escapeHtml(acc.username)+')' : ''}</span>
        <span class="analyzer-account-status ${isStopped?'offline':'logged'}">${isStopped?'parado':'capturando'}</span>
      </div>
      <div class="analyzer-account-body">
        <div class="analyzer-stat-row"><span class="analyzer-stat-label">Capturas</span><span class="analyzer-stat-value gold">${count}</span></div>
        <div class="analyzer-stat-row"><span class="analyzer-stat-label">Pokebolas</span><span class="analyzer-stat-value">${balls}</span></div>
        <div class="analyzer-stat-row"><span class="analyzer-stat-label">Estado</span><span class="analyzer-stat-value">${escapeHtml(state)}</span></div>
      </div>
    </div>`;
  }).join('');
}

async function startMobileAutoCatchForAccount(idx) {
  const cfg = savedAccounts[idx].catchConfig || {};
  const delay = cfg.delay || 3;
  const ballType = cfg.ballType ?? 0;
  const ballQty = cfg.ballQty ?? 100;
  const autoBuy = cfg.autoBuy !== false;
  const autoSell = cfg.autoSell !== false;

  mobileCatchState[idx] = 'running';
  mobileCatchCounts[idx] = 0;
  mobileCatchBallCounts[idx] = 0;
  runMobileCatchLoop(idx, delay, autoBuy, autoSell, ballType, ballQty);
  renderMobileAutoCatchStatus();
  renderMobileAutoCatchConfig();
}

function stopMobileAutoCatchForAccount(idx) {
  if (mobileCatchIntervals[idx]) { clearTimeout(mobileCatchIntervals[idx]); mobileCatchIntervals[idx] = null; }
  mobileCatchState[idx] = 'stopped';
  renderMobileAutoCatchStatus();
  renderMobileAutoCatchConfig();
}

async function runMobileCatchLoop(index, delay, autoBuy, autoSell, ballType, ballQty) {
  const state = mobileCatchState[index];
  if (state === 'stopped' || state === 'not_logged') return;

  const cfg = savedAccounts[index].catchConfig || {};
  delay = cfg.delay || 3;
  ballType = cfg.ballType ?? 0;
  ballQty = cfg.ballQty ?? 100;
  autoBuy = cfg.autoBuy !== false;
  autoSell = cfg.autoSell !== false;

  const iframe = activeIframes[index];
  if (!iframe) return;

  try {
    mobileCatchState[index] = 'checking';
    renderMobileAutoCatchStatus();

    const capState = await iframe.contentWindow.eval(mobileGetCaptureStateScript());

    if (!capState || !capState.active) {
      mobileCatchState[index] = 'aguardando pokemon...';
      renderMobileAutoCatchStatus();
      mobileCatchIntervals[index] = setTimeout(() => runMobileCatchLoop(index, delay, autoBuy, autoSell, ballType, ballQty), 5000);
      return;
    }

    mobileCatchBallCounts[index] = capState.balls;

    if (capState.balls <= 0) {
      mobileCatchState[index] = 'sem pokebolas! voltando pra cidade...';
      renderMobileAutoCatchStatus();

      await iframe.contentWindow.eval(mobileGoHomeScript());
      await new Promise(r => setTimeout(r, 4000));

      if (autoSell) {
        mobileCatchState[index] = 'abrindo mercado...';
        renderMobileAutoCatchStatus();
        await iframe.contentWindow.eval(mobileOpenMarketScript());
        await new Promise(r => setTimeout(r, 3000));

        mobileCatchState[index] = 'conversando com Mark...';
        renderMobileAutoCatchStatus();
        await iframe.contentWindow.eval(mobileTalkToNpcScript());
        await new Promise(r => setTimeout(r, 2000));

        mobileCatchState[index] = 'abrindo loja...';
        renderMobileAutoCatchStatus();
        await iframe.contentWindow.eval(mobileOpenNpcShopScript());
        await new Promise(r => setTimeout(r, 2000));

        mobileCatchState[index] = 'abrindo aba vender...';
        renderMobileAutoCatchStatus();
        await iframe.contentWindow.eval(mobileClickSellTabScript());
        await new Promise(r => setTimeout(r, 1000));

        mobileCatchState[index] = 'selecionando tudo...';
        renderMobileAutoCatchStatus();
        await iframe.contentWindow.eval(mobileSelectAllLootScript());
        await new Promise(r => setTimeout(r, 1000));

        mobileCatchState[index] = 'vendendo loot...';
        renderMobileAutoCatchStatus();
        await iframe.contentWindow.eval(mobileClickSellButtonScript());
        await new Promise(r => setTimeout(r, 2000));
        await iframe.contentWindow.eval(mobileConfirmSellScript());
        await new Promise(r => setTimeout(r, 1500));
      }
      if (autoBuy) {
        mobileCatchState[index] = 'abrindo aba comprar...';
        renderMobileAutoCatchStatus();
        await iframe.contentWindow.eval(mobileClickBuyTabScript());
        await new Promise(r => setTimeout(r, 1000));

        mobileCatchState[index] = 'configurando quantidade...';
        renderMobileAutoCatchStatus();
        await iframe.contentWindow.eval(mobileSetBuyQtyScript(ballQty));
        await new Promise(r => setTimeout(r, 1000));

        mobileCatchState[index] = 'comprando pokebolas...';
        renderMobileAutoCatchStatus();
        await iframe.contentWindow.eval(mobileBuyPokeballScript(ballType));
        await new Promise(r => setTimeout(r, 2000));

        await iframe.contentWindow.eval(mobileCloseAnyModalScript());
        await new Promise(r => setTimeout(r, 1000));
      }
      const huntCfg = savedAccounts[index].huntConfig || {};
      if (huntCfg.pokemon) {
        mobileCatchState[index] = 'voltando pra caça...';
        renderMobileAutoCatchStatus();
        await iframe.contentWindow.eval(mobileOpenMapScript());
        await new Promise(r => setTimeout(r, 2500));
        if (huntCfg.region) {
          await iframe.contentWindow.eval(mobileSelectRegionScript(huntCfg.region));
          await new Promise(r => setTimeout(r, 1500));
        }
        if (huntCfg.type) {
          await iframe.contentWindow.eval(mobileTypeFilterScript(huntCfg.type));
          await new Promise(r => setTimeout(r, 1500));
        }
        const markerResult = await iframe.contentWindow.eval(mobileClickHuntMarkerScript(huntCfg.pokemon, huntCfg.pokemon));
        if (markerResult && markerResult.ok) {
          await new Promise(r => setTimeout(r, 3000));
          await iframe.contentWindow.eval(mobileCloseMapScript());
          await new Promise(r => setTimeout(r, 1500));
        } else {
          mobileCatchState[index] = 'marker nao encontrado, tentando novamente...';
          renderMobileAutoCatchStatus();
          await iframe.contentWindow.eval(mobileCloseMapScript());
          await new Promise(r => setTimeout(r, 2000));
        }
      }
      mobileCatchState[index] = 'running';
      renderMobileAutoCatchStatus();
      mobileCatchIntervals[index] = setTimeout(() => runMobileCatchLoop(index, delay, autoBuy, autoSell, ballType, ballQty), 3000);
      return;
    }

    if (capState.canThrow > 0) {
      mobileCatchState[index] = 'throwing: ' + capState.names.join(', ') + ' (' + capState.balls + ' bolas)';
      renderMobileAutoCatchStatus();
      const throwResult = await iframe.contentWindow.eval(mobileThrowAllBallsScript());
      if (throwResult && throwResult.thrown > 0) {
        mobileCatchCounts[index] = (mobileCatchCounts[index] || 0) + throwResult.thrown;
      }
      mobileCatchBallCounts[index] = Math.max(0, capState.balls - (throwResult ? throwResult.thrown : 0));
    } else {
      mobileCatchState[index] = 'no throw buttons';
      renderMobileAutoCatchStatus();
    }

  } catch (e) {
    mobileCatchState[index] = 'aguardando pokemon...';
    renderMobileAutoCatchStatus();
  }

  renderMobileAutoCatchStatus();

  if (mobileCatchState[index] !== 'stopped') {
    mobileCatchIntervals[index] = setTimeout(() => runMobileCatchLoop(index, delay, autoBuy, autoSell, ballType, ballQty), delay * 1000);
  }
}

$('btnAutoCatch').addEventListener('click', openAutoCatchPwa);
$('closeAutoCatch').addEventListener('click', closeAutoCatchPwa);
$('autoCatchOverlay').addEventListener('click', e => { if (e.target === $('autoCatchOverlay')) closeAutoCatchPwa(); });
