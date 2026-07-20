const GAME_URL = 'https://poke.idleworld.online';
const LOGIN_URL = 'https://poke.idleworld.online/login';
const ACCOUNTS_KEY = 'poke_multi_accounts';
const SLOT_COUNT = 4;

let accounts = [];
let editingIndex = -1;

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

$('btnEnterAll').addEventListener('click', enterAll);
$('btnMuteAll').addEventListener('click', muteAll);
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
$('accountModal').addEventListener('click', e => { if (e.target === $('accountModal')) hideModal(); });
$('accountsList').addEventListener('click', e => {
  const btn = e.target.closest('[data-action="edit"]');
  if (btn) showEditForm(parseInt(btn.dataset.index));
});

loadAccounts();
renderPanels();
renderSidebar();
applyMobileLayout(4);
