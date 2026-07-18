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

function loadSlot(index) {
  const acc = accounts[index];
  if (!acc.username) return;
  const iframe = $('wv' + index);
  iframe.src = LOGIN_URL;
  iframe.onload = () => {
    try {
      setTimeout(() => {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow.document;
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
                  const currentUrl = iframe.contentWindow.location.href;
                  if (currentUrl.includes('/login')) {
                    setTimeout(() => {
                      try {
                        const doc2 = iframe.contentDocument || iframe.contentWindow.document;
                        const retryBtn = doc2.querySelector('button[type="submit"], button.auth-imgbtn, button.primary');
                        if (retryBtn) retryBtn.click();
                      } catch {}
                    }, 3000);
                  }
                } catch {}
              }, 2000);
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

$('accountsList').addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (btn) showEditForm(parseInt(btn.dataset.index));
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

loadAccounts();
renderPanels();
renderSidebar();
