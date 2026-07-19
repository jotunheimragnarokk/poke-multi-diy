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
  if (!username) { $('inputUsername').focus(); return; }
  const idx = editingIndex >= 0 ? editingIndex : Math.max(0, Math.min(slot - 1, SLOT_COUNT - 1));
  accounts[idx] = { slot: idx + 1, username, password };
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
