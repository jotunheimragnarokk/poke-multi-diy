(async function () {
  const { gameUrl, loginUrl, accountCount, saved } = await window.pokeMultiAPI.getConfig();

  const grid = document.getElementById('grid');
  const template = document.getElementById('panel-template');
  const backBtn = document.getElementById('backToGrid');
  const reloadAllBtn = document.getElementById('reloadAll');
  const enterAllBtn = document.getElementById('enterAll');
  const muteAllBtn = document.getElementById('muteAll');
  const toggleLayoutBtn = document.getElementById('toggleLayout');
  const accountsInfoBtn = document.getElementById('accountsInfo');
  const accountsModal = document.getElementById('accountsModal');
  const closeAccountsModalBtn = document.getElementById('closeAccountsModal');
  const accountsForm = document.getElementById('accountsForm');
  const saveAccountsBtn = document.getElementById('saveAccounts');
  const clearAccountsBtn = document.getElementById('clearAccounts');

  const mutedState = saved.muted && saved.muted.length === accountCount
    ? saved.muted
    : Array(accountCount).fill(false);

  function persist() {
    window.pokeMultiAPI.saveState({ muted: mutedState });
  }

  const panelZoomResets = [];
  const webviews = [];
  const muteButtons = [];
  const panelStates = [];
  const autoLoginTimers = [];
  let savedAccounts = Array.isArray(saved.accounts)
    ? saved.accounts
    : Array(accountCount).fill(null).map(() => ({ username: '', hasPassword: false }));

  function buildAccountsForm() {
    accountsForm.innerHTML = '';
    for (let i = 0; i < accountCount; i++) {
      const account = savedAccounts[i] || { username: '', hasPassword: false };
      const card = document.createElement('section');
      card.className = 'account-card';
      card.innerHTML = `
        <h3>Conta ${i + 1}</h3>
        <label>
          Login
          <input class="account-user" type="text" autocomplete="username" value="${escapeHtml(account.username || '')}" placeholder="usuario ou email" />
        </label>
        <label>
          Senha
          <input class="account-pass" type="password" autocomplete="current-password" placeholder="${account.hasPassword ? 'senha ja salva' : 'senha'}" />
        </label>
        <label style="display:flex;align-items:center;gap:8px;margin-top:8px;cursor:pointer">
          <input class="account-vip" type="checkbox" ${account.isVip ? 'checked' : ''}/>
          <span style="color:#e8a83c;font-weight:600">Conta VIP</span>
        </label>
        <div class="password-hint">${account.hasPassword ? 'Senha salva. Deixe em branco para manter.' : 'Sem senha salva.'}</div>
      `;
      accountsForm.appendChild(card);
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function openAccountsModal() {
    buildAccountsForm();
    accountsModal.classList.remove('hidden');
  }

  function closeAccountsModal() {
    accountsModal.classList.add('hidden');
  }

  async function saveAccountsFromForm(clearPasswords) {
    const cards = [...accountsForm.querySelectorAll('.account-card')];
    const accounts = cards.map((card, i) => {
      const username = card.querySelector('.account-user').value;
      const password = clearPasswords ? '' : card.querySelector('.account-pass').value;
      const isVip = card.querySelector('.account-vip').checked;
      const current = savedAccounts[i] || { hasPassword: false };
      return {
        username: clearPasswords ? '' : username,
        password,
        keepPassword: !clearPasswords && !password && current.hasPassword,
        isVip,
        huntConfig: current.huntConfig || null,
        catchConfig: current.catchConfig || null
      };
    });

    savedAccounts = await window.pokeMultiAPI.saveLoginAccounts(accounts);
    closeAccountsModal();
    if (!clearPasswords) enterAllAccounts();
  }

  async function attemptAutoLogin(index, openLoginIfNeeded) {
    const webview = webviews[index];
    const currentUrl = getWebviewUrl(webview);
    if (isLoggedGameUrl(currentUrl)) {
      setPanelState(index, 'pronto');
      return;
    }
    if (!isLoginUrl(currentUrl) && !openLoginIfNeeded) {
      setPanelState(index, 'pronto');
      return;
    }

    const account = (await window.pokeMultiAPI.getLoginAccounts())[index];
    if (!account || !account.username || !account.password) return;

    const credentials = JSON.stringify(account);
    setPanelState(index, 'preenchendo login');
    try {
      const filled = await webview.executeJavaScript(`
        (() => {
          const account = ${credentials};
          const nativeValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          const visible = el => {
            if (!el || el.disabled || el.readOnly) return false;
            const rect = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
          };
          const inputs = [...document.querySelectorAll('input')].filter(visible);
          const passwordInput = inputs.find(input => input.type === 'password');
          if (!passwordInput) return false;

          const userInput = inputs.find(input => {
            const type = (input.type || 'text').toLowerCase();
            const name = [input.name, input.id, input.placeholder, input.autocomplete].join(' ').toLowerCase();
            return input !== passwordInput && ['text', 'email', 'search', 'tel', ''].includes(type)
              && /(user|usuario|login|email|mail|account|conta)/.test(name);
          }) || inputs.find(input => input !== passwordInput && ['text', 'email', ''].includes((input.type || 'text').toLowerCase()));
          if (!userInput) return false;

          const setValue = (input, value) => {
            input.focus();
            nativeValueSetter.call(input, value);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.blur();
          };
          if (!userInput.value) setValue(userInput, account.username);
          if (!passwordInput.value) setValue(passwordInput, account.password);

          const findSubmit = () => {
            const direct = document.querySelector('button.auth-imgbtn.primary, button[aria-label="Log in"], button[type="submit"]');
            if (direct && visible(direct)) return direct;

            const buttons = [...document.querySelectorAll('button, input[type="submit"]')].filter(visible);
            return buttons.find(button => {
              const label = [button.innerText, button.textContent, button.value, button.getAttribute('aria-label'), button.title]
                .join(' ')
                .toLowerCase();
              return button.type === 'submit' || /(log in|login|entrar)/.test(label);
            });
          };

          const submit = findSubmit();

          if (!submit) return 'filled';
          const isBlocked = button => button.disabled || button.getAttribute('aria-disabled') === 'true';
          const press = button => {
            button.scrollIntoView({ block: 'center', inline: 'center' });
            button.focus();
            for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
              button.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
            }
            button.click();
            if (button.form && !button.disabled) button.form.requestSubmit(button);
          };

          if (isBlocked(submit)) {
            clearInterval(window.__pokeMultiAutoSubmit);
            window.__pokeMultiAutoSubmit = setInterval(() => {
              const nextSubmit = findSubmit();
              if (nextSubmit && !isBlocked(nextSubmit)) {
                clearInterval(window.__pokeMultiAutoSubmit);
                press(nextSubmit);
              }
            }, 700);
            return 'captcha';
          }
          press(submit);
          return 'submitted';
        })();
      `, true);
      if (filled === 'captcha') {
        setPanelState(index, 'aguardando captcha');
        scheduleAutoLogin(index, 1000, false);
      } else if (filled === 'submitted') {
        setPanelState(index, 'entrando');
        scheduleCheckAfterSubmit(index);
      } else if (filled === 'filled') {
        setPanelState(index, 'aguardando captcha');
        scheduleAutoLogin(index, 1000, false);
      } else if (!filled && openLoginIfNeeded) {
        const opened = await openLoginScreen(webview);
        if (opened) scheduleAutoLogin(index, 1800, false);
      }
    } catch {
      // A pagina pode estar carregando ou bloquear script; tenta de novo no proximo dom-ready.
    }
  }

  function scheduleCheckAfterSubmit(index) {
    clearTimeout(autoLoginTimers[index]);
    autoLoginTimers[index] = setTimeout(() => checkLoginResult(index), 3500);
  }

  async function checkLoginResult(index) {
    const webview = webviews[index];
    const currentUrl = getWebviewUrl(webview);

    if (isLoggedGameUrl(currentUrl)) {
      setPanelState(index, 'pronto');
      return;
    }

    if (!isLoginUrl(currentUrl)) {
      setPanelState(index, 'pronto');
      return;
    }

    try {
      const hasError = await webview.executeJavaScript(`
        (() => {
          const msg = document.querySelector('.form-msg');
          if (msg && msg.textContent.trim().length > 0) return true;
          return false;
        })();
      `, true);

      if (hasError) {
        await webview.executeJavaScript(`
          (() => {
            const nativeValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            const visible = el => {
              if (!el || el.disabled || el.readOnly) return false;
              const rect = el.getBoundingClientRect();
              const style = getComputedStyle(el);
              return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
            };
            const inputs = [...document.querySelectorAll('input')].filter(visible);
            inputs.forEach(input => {
              nativeValueSetter.call(input, '');
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
            });
            const msg = document.querySelector('.form-msg');
            if (msg) msg.textContent = '';
          })();
        `, true);

        setPanelState(index, 'erro, tentando novamente');
        scheduleAutoLogin(index, 5000, false);
      } else {
        setPanelState(index, 'entrando');
        scheduleCheckAfterSubmit(index);
      }
    } catch {
      scheduleCheckAfterSubmit(index);
    }
  }

  function scheduleAutoLogin(index, delay, openLoginIfNeeded) {
    clearTimeout(autoLoginTimers[index]);
    autoLoginTimers[index] = setTimeout(() => attemptAutoLogin(index, openLoginIfNeeded), delay);
  }

  function setPanelState(index, text) {
    if (panelStates[index]) panelStates[index].textContent = text;
  }

  function getWebviewUrl(webview) {
    try { return webview.getURL(); } catch { return ''; }
  }

  function getPathname(url) {
    try { return new URL(url).pathname.replace(/\/$/, '') || '/'; } catch { return ''; }
  }

  function isLoginUrl(url) {
    return getPathname(url) === '/login';
  }

  function isLoggedGameUrl(url) {
    const pathname = getPathname(url);
    return !!pathname && !['/', '/login', '/register', '/forgot-password'].includes(pathname);
  }

  function refreshPanelState(index) {
    const url = getWebviewUrl(webviews[index]);
    if (isLoggedGameUrl(url)) {
      clearTimeout(autoLoginTimers[index]);
      setPanelState(index, 'pronto');
    } else if (!isLoginUrl(url)) {
      setPanelState(index, 'pronto');
    }
  }

  async function openLoginScreen(webview) {
    try {
      webview.loadURL(loginUrl);
      return true;
    } catch {
      // Ignora: pode estar navegando ou recarregando.
      return false;
    }
  }

  function enterAllAccounts() {
    webviews.forEach((wv, i) => {
      if (isLoggedGameUrl(getWebviewUrl(wv))) {
        setPanelState(i, 'pronto');
        return;
      }

      try { wv.loadURL(loginUrl); } catch { wv.reload(); }
      scheduleAutoLogin(i, 2500, false);
    });
  }

  for (let i = 0; i < accountCount; i++) {
    const node = template.content.cloneNode(true);
    const panel = node.querySelector('.panel');
    const webview = node.querySelector('.game-view');
    const numberEl = node.querySelector('.panel-number');
    const muteBtn = node.querySelector('.mute-btn');
    const reloadBtn = node.querySelector('.reload-btn');
    const expandBtn = node.querySelector('.expand-btn');
    const panelState = node.querySelector('.panel-state');

    panel.dataset.index = i;
    numberEl.textContent = i + 1;
    panelStates.push(panelState);

    // "persist:" cria uma sessao separada e salva localmente (login/cookies isolados por conta)
    webview.setAttribute('partition', `persist:conta${i + 1}`);
    webview.setAttribute('src', gameUrl);

    webview.addEventListener('dom-ready', () => {
      const isMuted = !!mutedState[i];
      webview.setAudioMuted(isMuted);
      muteBtn.classList.toggle('muted', isMuted);
      muteBtn.textContent = isMuted ? '\u{1F507}' : '\u{1F50A}';

      // Esconde as barras de rolagem do site (a rolagem continua funcionando,
      // so a barra visual some).
      webview.insertCSS(`
        ::-webkit-scrollbar { display: none; }
        html, body { scrollbar-width: none; -ms-overflow-style: none; }
      `).catch(() => {});

      // Zoom reduzido: o jogo foi feito para tela cheia, entao em um painel
      // pequeno os elementos se sobrepoem. Reduzindo o zoom, o layout do
      // jogo "encolhe" proporcionalmente e para de se sobrepor.
      webview.setZoomFactor(panel.classList.contains('expanded') ? 0.9 : (layoutCount === 1 ? 0.75 : layoutCount === 2 ? 0.6 : 0.55));
      refreshPanelState(i);
      if (isLoginUrl(getWebviewUrl(webview))) scheduleAutoLogin(i, 500, false);
    });

    webview.addEventListener('did-navigate', () => refreshPanelState(i));
    webview.addEventListener('did-navigate-in-page', () => refreshPanelState(i));

    // Reaplica o zoom certo sempre que o painel expande/recolhe
    const applyZoom = () => {
      const factor = panel.classList.contains('expanded') ? 0.9 : (layoutCount === 1 ? 0.75 : layoutCount === 2 ? 0.6 : 0.55);
      try { webview.setZoomFactor(factor); } catch { /* webview ainda carregando */ }
    };

    panelZoomResets.push(applyZoom);
    webviews.push(webview);
    muteButtons.push(muteBtn);

    muteBtn.addEventListener('click', () => {
      const newMuted = !mutedState[i];
      mutedState[i] = newMuted;
      webview.setAudioMuted(newMuted);
      muteBtn.classList.toggle('muted', newMuted);
      muteBtn.textContent = newMuted ? '\u{1F507}' : '\u{1F50A}';
      persist();
    });

    reloadBtn.addEventListener('click', () => {
      webview.reload();
    });

    expandBtn.addEventListener('click', () => {
      const isExpanded = panel.classList.contains('expanded');
      if (isExpanded) {
        panel.classList.remove('expanded');
        grid.classList.remove('has-expanded');
        backBtn.classList.add('hidden');
      } else {
        document.querySelectorAll('.panel.expanded').forEach(p => p.classList.remove('expanded'));
        panel.classList.add('expanded');
        grid.classList.add('has-expanded');
        backBtn.classList.remove('hidden');
      }
      applyZoom();
    });

    grid.appendChild(node);
  }

  backBtn.addEventListener('click', () => {
    document.querySelectorAll('.panel.expanded').forEach(p => p.classList.remove('expanded'));
    grid.classList.remove('has-expanded');
    backBtn.classList.add('hidden');
    panelZoomResets.forEach(fn => fn());
  });

  reloadAllBtn.addEventListener('click', () => {
    webviews.forEach(wv => wv.reload());
  });

  // "Entrar em todas": carrega o jogo e tenta preencher login/senha salvos
  // caso alguma sessao esteja na tela de login.
  enterAllBtn.addEventListener('click', enterAllAccounts);

  // "Sem som": muta ou desmuta todas as contas de uma vez.
  let allMuted = false;
  muteAllBtn.addEventListener('click', () => {
    allMuted = !allMuted;
    webviews.forEach((wv, i) => {
      mutedState[i] = allMuted;
      wv.setAudioMuted(allMuted);
      muteButtons[i].classList.toggle('muted', allMuted);
      muteButtons[i].textContent = allMuted ? '\u{1F507}' : '\u{1F50A}';
    });
    muteAllBtn.textContent = allMuted ? '\u{1F50A} Reativar som' : '\u{1F507} Sem som';
    persist();
  });

  let layoutCount = 4;
  function applyLayout(count) {
    layoutCount = count;
    grid.className = 'grid grid-' + count;
    const panels = grid.querySelectorAll('.panel');
    panels.forEach((p, idx) => {
      p.style.display = idx < count ? '' : 'none';
    });
    const hasExpanded = document.querySelectorAll('.panel.expanded').length > 0;
    const zoomFactor = hasExpanded ? 0.9 : (count === 1 ? 0.75 : count === 2 ? 0.6 : 0.55);
    webviews.forEach((wv, idx) => {
      if (idx < count) {
        try { wv.setZoomFactor(zoomFactor); } catch {}
      }
    });
    toggleLayoutBtn.textContent = '⬜ ' + count + ' tela' + (count > 1 ? 's' : '');
  }
  applyLayout(4);
  toggleLayoutBtn.addEventListener('click', () => {
    layoutCount = layoutCount % 4 + 1;
    applyLayout(layoutCount);
  });

  accountsInfoBtn.addEventListener('click', openAccountsModal);
  closeAccountsModalBtn.addEventListener('click', closeAccountsModal);
  accountsModal.addEventListener('click', event => {
    if (event.target === accountsModal) closeAccountsModal();
  });
  saveAccountsBtn.addEventListener('click', () => saveAccountsFromForm(false));
  clearAccountsBtn.addEventListener('click', () => saveAccountsFromForm(true));

  /* ===== Hunt Analyzer ===== */
  const analyzerOverlay = document.getElementById('analyzerOverlay');
  const openAnalyzerBtn = document.getElementById('openAnalyzer');
  const closeAnalyzerBtn = document.getElementById('closeAnalyzer');
  const refreshAnalyzerBtn = document.getElementById('refreshAnalyzer');
  const analyzerAccounts = document.getElementById('analyzerAccounts');
  const analyzerTotal = document.getElementById('analyzerTotal');
  const analyzerTimer = document.getElementById('analyzerTimer');
  let analyzerInterval = null;
  let analyzerCountdown = 5;

  function openAnalyzer() {
    analyzerOverlay.classList.remove('hidden');
    analyzerCountdown = 15;
    refreshAnalyzer();
    startAnalyzerTimer();
  }

  function closeAnalyzer() {
    analyzerOverlay.classList.add('hidden');
    stopAnalyzerTimer();
  }

  function startAnalyzerTimer() {
    stopAnalyzerTimer();
    analyzerCountdown = 15;
    analyzerTimer.textContent = `atualizando em ${analyzerCountdown}s`;
    analyzerInterval = setInterval(() => {
      analyzerCountdown--;
      if (analyzerCountdown <= 0) {
        refreshAnalyzer();
        analyzerCountdown = 15;
      }
      analyzerTimer.textContent = `atualizando em ${analyzerCountdown}s`;
    }, 1000);
  }

  function stopAnalyzerTimer() {
    if (analyzerInterval) { clearInterval(analyzerInterval); analyzerInterval = null; }
  }

  openAnalyzerBtn.addEventListener('click', openAnalyzer);
  closeAnalyzerBtn.addEventListener('click', closeAnalyzer);
  analyzerOverlay.addEventListener('click', e => { if (e.target === analyzerOverlay) closeAnalyzer(); });
  refreshAnalyzerBtn.addEventListener('click', () => { analyzerCountdown = 5; refreshAnalyzer(); });

  const EXTRACT_HUNT_DATA = `
    (async () => {
      const result = { hunts: {}, drops: [], debug: '' };
      try {
        const wait = ms => new Promise(r => setTimeout(r, ms));
        const visible = el => {
          if (!el) return false;
          const rect = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          return rect.width > 0 && rect.height > 0
            && style.visibility !== 'hidden'
            && style.display !== 'none'
            && style.opacity !== '0';
        };

        let analyzerPanel = null;
        let bestSize = Infinity;
        const allEls = [...document.querySelectorAll('*')];
        for (const el of allEls) {
          if (!visible(el)) continue;
          const t = el.innerText || '';
          if (t.includes('Hunt Analyzer') && t.includes('Derrotados')) {
            const rect = el.getBoundingClientRect();
            const size = rect.width * rect.height;
            if (size > 0 && size < bestSize) {
              bestSize = size;
              analyzerPanel = el;
            }
          }
        }

        if (!analyzerPanel) {
          const allEls2 = [...document.querySelectorAll('*')];
          for (const el of allEls2) {
            if (!visible(el)) continue;
            const t = el.innerText || '';
            if (t.includes('Hunt Analyzer') && (t.includes('Derrotados') || t.includes('Loot'))) {
              analyzerPanel = el;
              break;
            }
          }
        }

        if (!analyzerPanel) {
          result.debug = 'PAINEL NAO ENCONTRADO';
          return result;
        }

        const panelText = analyzerPanel.innerText || '';
        result.debug = panelText.substring(0, 800);

        const clean = panelText.replace(/\\s+/g, ' ');

        const nearLabel = (before, after, regex) => {
          const labelIdx = clean.toLowerCase().indexOf(after.toLowerCase());
          if (labelIdx === -1) return '';
          const searchStart = Math.max(0, labelIdx - 150);
          const chunk = clean.substring(searchStart, labelIdx);
          const m = chunk.match(regex);
          return m ? (m[1] || m[0]).trim() : '';
        };

        const huntSection = clean.match(/Hunt Analyzer[\\s\\S]*$/i);
        const huntText = huntSection ? huntSection[0] : clean;

        result.hunts.kills =
          huntText.match(/(\\d[\\d.,]*)\\s*Derrotados/i)?.[1] ||
          nearLabel('', 'Derrotados', /(\\d[\\d.,]*)\\s*$/i) || '';

        result.hunts.time =
          huntText.match(/(\\d+h\\s*\\d+m)\\s*(?:Tempo|$)/i)?.[1] ||
          huntText.match(/(\\d+m\\s*\\d+s)/i)?.[1] ||
          nearLabel('', 'Tempo na hunt', /(\\d+h\\s*\\d+m)/i) ||
          nearLabel('', 'Tempo na hunt', /(\\d+m\\s*\\d+s)/i) || '';

        result.hunts.xp =
          nearLabel('', 'XP ganha', /(\\d[\\d.,]*)\\s*$/i) ||
          huntText.match(/(\\d[\\d.,]*)\\s*XP\\s*ganha/i)?.[1] || '';

        result.hunts.captures =
          nearLabel('', 'Capturados', /(\\d+)\\s*$/i) ||
          huntText.match(/(\\d+)\\s*Capturados/i)?.[1] || '';

        result.hunts.loot =
          nearLabel('', 'Loot', /\\$(\\d[\\d.,]*)\\s*$/i) ||
          huntText.match(/\\$(\\d[\\d.,]*)\\s*.*?Loot/i)?.[1] || '';

        result.hunts.supply =
          nearLabel('', 'Supply', /-\\$(\\d[\\d.,]*)\\s*$/i) ||
          huntText.match(/-\\$(\\d[\\d.,]*)\\s*.*?Supply/i)?.[1] || '';

        result.hunts.balance =
          nearLabel('', 'Saldo', /\\+\\$(\\d[\\d.,]*)\\s*$/i) ||
          huntText.match(/\\+\\$(\\d[\\d.,]*)/i)?.[1] || '';

        result.hunts.goldPerHour =
          huntText.match(/\\$([\\d.,]+)\\/h/i)?.[1] || '';
        result.hunts.xpPerHour =
          huntText.match(/(\\d[\\d.,]*)\\s*XP\\/h/i)?.[1] || '';
        result.hunts.killsPerHour =
          huntText.match(/(\\d+)\\/?h\\b/i)?.[1] || '';

        const dropsMatch = huntText.match(/DROPS\\s+DA\\s+SESS[ÃA]O([\\s\\S]*?)$/i);
        if (dropsMatch) {
          const dropsText = dropsMatch[1];
          const dropRe = /([A-Za-z][A-Za-z\\s]+?)\\s*[×xX]\\s*(\\d[\\d.,]*)\\s*\\$([\\d.,]+)/g;
          let dm;
          while ((dm = dropRe.exec(dropsText)) !== null) {
            result.drops.push({ name: dm[1].trim(), qty: dm[2].trim(), value: dm[3].trim() });
          }
        }

      } catch (e) { result.error = String(e); }
      return result;
    })`;

  async function extractDataFromWebview(index) {
    const webview = webviews[index];
    const currentUrl = getWebviewUrl(webview);
    if (!isLoggedGameUrl(currentUrl)) {
      return { hunts: {}, drops: [], debug: 'URL: ' + currentUrl + ' (nao e pagina de jogo)' };
    }

    try {
      return await webview.executeJavaScript(`(${EXTRACT_HUNT_DATA})()`, true);
    } catch (e) {
      return { hunts: {}, drops: [], debug: 'ERRO: ' + String(e) };
    }
  }

  function escapeHtmlSimple(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function buildStatRow(label, value, cssClass) {
    return `<div class="analyzer-stat-row">
      <span class="analyzer-stat-label">${escapeHtmlSimple(label)}</span>
      <span class="analyzer-stat-value ${cssClass || ''}">${escapeHtmlSimple(value)}</span>
    </div>`;
  }

  function renderAnalyzerAccount(index, data) {
    const account = savedAccounts[index] || {};
    const hasData = data && !data.debug?.includes('URL:') && !data.debug?.includes('ERRO');
    const isLoggedIn = !!data;
    const statusClass = isLoggedIn ? (hasData ? 'logged' : 'logged') : 'offline';
    const statusText = isLoggedIn ? 'online' : 'offline';

    let bodyHtml = '';
    if (!isLoggedIn) {
      bodyHtml = '<div class="analyzer-account-body loading">Conta nao conectada</div>';
    } else {
      const rows = [];
      if (data.playerName) rows.push(buildStatRow('Trainer', data.playerName, 'pokemon'));

      const h = data.hunts || {};
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
        rows.push(buildStatRow('─ Drops da Sessão ─', '', ''));
        for (const d of data.drops.slice(0, 8)) {
          rows.push(buildStatRow(d.name, '×' + d.qty + '  $' + d.value, 'gold'));
        }
      }

      if (rows.length <= 1) {
        const dbg = data.debug ? data.debug.substring(0, 300) : 'nenhum dado visivel';
        rows.push(buildStatRow('Debug', dbg, ''));
      }

      bodyHtml = `<div class="analyzer-account-body">${rows.join('')}</div>`;
    }

    return `<div class="analyzer-account-card">
      <div class="analyzer-account-header">
        <span class="analyzer-account-name">Conta ${index + 1}${account.username ? ' (' + escapeHtmlSimple(account.username) + ')' : ''}</span>
        <span class="analyzer-account-status ${statusClass}">${statusText}</span>
      </div>
      ${bodyHtml}
      ${data && data.debug ? '<div class="analyzer-raw-text">' + escapeHtmlSimple(data.debug.substring(0, 600)) + '</div>' : ''}
    </div>`;
  }

  function renderAnalyzerTotal(allData) {
    let totalLoot = 0, totalSupply = 0, totalBalance = 0;
    let totalXP = 0, totalCaptures = 0, totalKills = 0;
    let onlineCount = 0;

    for (const data of allData) {
      if (!data) continue;
      onlineCount++;
      const h = data.hunts || {};
      if (h.kills) totalKills += parseNumber(h.kills);
      if (h.xp) totalXP += parseNumber(h.xp);
      if (h.captures) totalCaptures += parseNumber(h.captures);
      if (h.loot) totalLoot += parseNumber(h.loot);
      if (h.supply) totalSupply += parseNumber(h.supply);
      if (h.balance) totalBalance += parseNumber(h.balance);
    }

    return `<h3>Total (${onlineCount} contas online)</h3>
    <div class="analyzer-total-grid">
      <div class="analyzer-total-item">
        <span class="analyzer-total-label">Saldo Total</span>
        <span class="analyzer-total-value gold">+$${formatMoney(totalBalance)}</span>
      </div>
      <div class="analyzer-total-item">
        <span class="analyzer-total-label">Loot Total</span>
        <span class="analyzer-total-value gold">$${formatMoney(totalLoot)}</span>
      </div>
      <div class="analyzer-total-item">
        <span class="analyzer-total-label">XP Total</span>
        <span class="analyzer-total-value xp">${formatMoney(totalXP)}</span>
      </div>
      <div class="analyzer-total-item">
        <span class="analyzer-total-label">Derrotados</span>
        <span class="analyzer-total-value">${formatMoney(totalKills)}</span>
      </div>
      <div class="analyzer-total-item">
        <span class="analyzer-total-label">Capturados</span>
        <span class="analyzer-total-value pokemon">${totalCaptures}</span>
      </div>
      <div class="analyzer-total-item">
        <span class="analyzer-total-label">Supply Total</span>
        <span class="analyzer-total-value supply">-$${formatMoney(totalSupply)}</span>
      </div>
    </div>`;
  }

  function formatMoney(n) {
    return Number(n).toLocaleString('pt-BR');
  }

  function parseNumber(str) {
    if (!str) return 0;
    const s = String(str).replace(/[^0-9.,]/gi, '').replace(/\./g, '').replace(',', '.');
    return parseFloat(s) || 0;
  }

  async function refreshAnalyzer() {
    const allData = [];
    for (let i = 0; i < accountCount; i++) {
      allData.push(await extractDataFromWebview(i));
      if (i < accountCount - 1) await new Promise(r => setTimeout(r, 2500));
    }
    analyzerAccounts.innerHTML = allData.map((d, i) => renderAnalyzerAccount(i, d)).join('');
    analyzerTotal.innerHTML = renderAnalyzerTotal(allData);
  }

  /* ===== Auto Catch Loop ===== */
  const autoCatchState = [];
  const autoCatchIntervals = [];

  function clickHuntMarkerScript(slug, pokemonName) {
    return `
      (function() {
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
  const autoCatchCounts = [];
  const autoCatchBallCounts = [];

  function getCaptureStateScript() {
    return `
      (function() {
        var panel = document.querySelector('.cap-panel');
        if (!panel) return { active: false, debug: 'no_cap_panel' };

        var panelHtml = panel.innerHTML.substring(0, 200);
        var throwBtns = panel.querySelectorAll('button.cap-throw');
        if (throwBtns.length === 0) {
          var allBtnsInPanel = panel.querySelectorAll('button');
          var btnTexts = [];
          for (var b = 0; b < allBtnsInPanel.length; b++) {
            btnTexts.push((allBtnsInPanel[b].innerText || '').trim().substring(0, 20) + ' [' + (allBtnsInPanel[b].className || '').substring(0, 30) + ']');
          }
          return { active: false, debug: 'panel_found_no_throw', panelBtns: btnTexts, html: panelHtml };
        }

        var balls = 0;
        var countEl = panel.querySelector('.cap-chip-n');
        if (countEl) balls = parseInt((countEl.innerText || countEl.textContent || '').replace(/[^0-9]/g, '')) || 0;

        var wildCount = 0;
        var countEl2 = panel.querySelector('.cap-count');
        if (countEl2) {
          var m = (countEl2.innerText || '').match(/(\\d+)/);
          if (m) wildCount = parseInt(m[1]);
        }

        var names = [];
        var nameEls = panel.querySelectorAll('.cap-name');
        for (var k = 0; k < nameEls.length; k++) names.push(nameEls[k].innerText.trim());

        return { active: true, wildCount: wildCount, balls: balls, canThrow: throwBtns.length, names: names };
      })()`;
  }

  function throwAllBallsScript() {
    return `
      (function() {
        var thrown = 0;

        function clickBtn(btn) {
          var r = btn.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return false;
          var cx = r.x + r.width/2;
          var cy = r.y + r.height/2;
          btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, clientX: cx, clientY: cy }));
          btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy }));
          btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1, clientX: cx, clientY: cy }));
          btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy }));
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy }));
          btn.click();
          return true;
        }

        var panel = document.querySelector('.cap-panel');
        if (panel) {
          var btns = panel.querySelectorAll('button');
          for (var i = 0; i < btns.length; i++) {
            var text = (btns[i].innerText || btns[i].textContent || '').trim().toLowerCase();
            var isThrow = text === 'lançar' || text === 'lancar' || text === 'throw' || text.indexOf('lan') === 0;
            var isCapThrow = (btns[i].className || '').indexOf('cap-throw') !== -1;
            if (isThrow || isCapThrow) {
              if (clickBtn(btns[i])) thrown++;
            }
          }
        }

        if (thrown === 0) {
          var allBtns = document.querySelectorAll('button');
          for (var j = 0; j < allBtns.length; j++) {
            var text2 = (allBtns[j].innerText || allBtns[j].textContent || '').trim().toLowerCase();
            var isThrow2 = text2 === 'lançar' || text2 === 'lancar' || text2 === 'throw' || text2.indexOf('lan') === 0;
            var isCapThrow2 = (allBtns[j].className || '').indexOf('cap-throw') !== -1;
            if (isThrow2 || isCapThrow2) {
              if (clickBtn(allBtns[j])) thrown++;
            }
          }
        }

        return { thrown: thrown };
      })()`;
  }

  function goHomeScript() {
    return `
      (function() {
        var btn = document.querySelector('button[data-guide="dock-home"]');
        if (btn) { btn.click(); return 'clicked_home'; }
        return 'not_found';
      })()`;
  }

  function openMarketScript() {
    return `
      (function() {
        var btn = document.querySelector('button.market-cta');
        if (btn) { btn.click(); return 'clicked_market'; }
        return 'not_found';
      })()`;
  }

  function talkToNpcScript() {
    return `
      (function() {
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

  function openNpcShopScript() {
    return `
      (function() {
        var btn = document.querySelector('button.npc-dlg-btn');
        if (btn) { btn.click(); return 'clicked_open_shop'; }
        return 'not_found';
      })()`;
  }

  function clickSellTabScript() {
    return `
      (function() {
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

  function selectAllLootScript() {
    return `
      (function() {
        var btn = document.querySelector('button.mk-selall');
        if (btn) { btn.click(); return 'clicked_select_all'; }
        return 'not_found';
      })()`;
  }

  function clickSellButtonScript() {
    return `
      (function() {
        var btn = document.querySelector('button.mk-sell');
        if (btn) { btn.click(); return 'clicked_sell'; }
        return 'not_found';
      })()`;
  }

  function confirmSellScript() {
    return `
      (function() {
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

  function clickBuyTabScript() {
    return `
      (function() {
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

  function setBuyQtyScript(qty) {
    return `
      (function() {
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

  function buyPokeballScript(ballType) {
    return `
      (function() {
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


  function closeAnyModalScript() {
    return `
      (function() {
        var xBtn = document.querySelector('.cfg-x, button[aria-label="Fechar"]');
        if (xBtn) { xBtn.click(); return 'closed'; }
        return 'none';
      })()`;
  }

  function openShopFromCapScript() {
    return `
      (function() {
        var link = document.querySelector('.cap-shop-link');
        if (link) { link.click(); return 'clicked_shop_link'; }
        return 'not_found';
      })()`;
  }

  function buyPokeballsScript() {
    return `
      (function() {
        var btns = document.querySelectorAll('button');
        var bought = 0;
        for (var i = 0; i < btns.length; i++) {
          var text = (btns[i].innerText || '').trim().toLowerCase();
          if (text.indexOf('comprar') !== -1 || text.indexOf('buy') !== -1) {
            var r = btns[i].getBoundingClientRect();
            if (r.width > 0 && r.height > 0) {
              btns[i].click();
              bought++;
              break;
            }
          }
        }
        return { bought: bought };
      })()`;
  }

  function closeAnyModalScript() {
    return `
      (function() {
        var xBtn = document.querySelector('.cfg-x, button[aria-label="Fechar"]');
        if (xBtn) { xBtn.click(); return 'closed'; }
        return 'none';
      })()`;
  }

  /* ===== Auto Hunt Loop ===== */
  const autoHuntOverlay = document.getElementById('autoHuntOverlay');
  const openAutoHuntBtn = document.getElementById('openAutoHunt');
  const closeAutoHuntBtn = document.getElementById('closeAutoHunt');
  const autoHuntConfig = document.getElementById('autoHuntConfig');
  const autoHuntStatus = document.getElementById('autoHuntStatus');
  const autoHuntState = [];
  const autoHuntIntervals = [];
  const autoHuntCounts = [];
  let autoHuntCreatures = [];
  let autoHuntCreaturesMap = {};
  const autoHuntRegions = ['Kanto', 'Johto', 'Outland', 'Orre', 'Nightmare'];
  const autoHuntTypes = ['AÇO', 'ÁGUA', 'DRAGÃO', 'ELÉTRICO', 'FADA', 'FANTASMA', 'FOGO', 'GELO', 'INSETO', 'LUTADOR', 'NORMAL', 'PEDRA', 'PLANTA', 'PSÍQUICO', 'SOMBRIO', 'TERRA', 'VENENO', 'VOADOR'];
  let mapMarkersCache = null;

  let creaturesDebug = '';

  async function fetchCreaturesList() {
    try {
      creaturesDebug = 'buscando creatures.json...';
      const resp = await fetch('https://poke.idleworld.online/game/creatures.json');
      creaturesDebug = 'HTTP ' + resp.status;
      if (!resp.ok) return [];
      const data = await resp.json();
      const raw = data.creatures || data;
      const arr = Array.isArray(raw) ? raw : Object.values(raw);
      creaturesDebug = 'total=' + arr.length;
      if (arr.length > 0) {
        creaturesDebug += ' | ex: ' + JSON.stringify(arr[0]).substring(0, 120);
      }
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
        map[name.toLowerCase()] = entry;
      }
      list.sort((a, b) => a.name.localeCompare(b.name));
      autoHuntCreatures = list;
      autoHuntCreaturesMap = map;
      creaturesDebug += ' -> ' + list.length + ' pokemon carregados';
      return list;
    } catch (e) {
      creaturesDebug = 'ERRO: ' + String(e).substring(0, 100);
      return [];
    }
  }

  async function fetchMapMarkers() {
    try {
      const resp = await fetch('https://poke.idleworld.online/game/map-markers');
      if (!resp.ok) return null;
      return await resp.json();
    } catch { return null; }
  }

  async function fetchHuntConfig(slug) {
    try {
      const resp = await fetch('https://poke.idleworld.online/api/game/hunt-config?slug=' + encodeURIComponent(slug));
      if (!resp.ok) return null;
      return await resp.json();
    } catch { return null; }
  }

  function getMapIconScript() {
    return `
      (function() {
        var btns = document.querySelectorAll('button');
        for (var i = 0; i < btns.length; i++) {
          var rect = btns[i].getBoundingClientRect();
          if (rect.width > 28 && rect.width < 40 && rect.height > 28 && rect.height < 40 && rect.y < 35 && rect.y > 10) {
            var text = (btns[i].innerText || '').trim();
            if (!text || text.length <= 2) {
              return { x: Math.round(rect.x + rect.width/2), y: Math.round(rect.y + rect.height/2), idx: i };
            }
          }
        }
        return null;
      })()`;
  }

  function getCloseMapScript() {
    return `
      (function() {
        var btns = document.querySelectorAll('button');
        for (var i = 0; i < btns.length; i++) {
          var text = (btns[i].innerText || '').trim();
          if (text === '×' || text === 'x' || text === 'X') {
            var rect = btns[i].getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              btns[i].click();
              return true;
            }
          }
        }
        return false;
      })()`;
  }

  function getMapStateScript() {
    return `
      (function() {
        var mapTitle = document.querySelector('.map-title');
        var mapAreas = document.querySelector('.map-areas');
        var mapFilters = document.querySelector('.map-filters');
        var isOpen = !!(mapTitle && mapTitle.getBoundingClientRect().width > 0);
        var region = '';
        if (mapAreas) {
          var active = mapAreas.querySelector('.map-area.on');
          if (active) region = (active.innerText || '').trim();
        }
        return { isOpen: isOpen, region: region };
      })()`;
  }

  function openMapScript() {
    return `
      (function() {
        var mapTitle = document.querySelector('.map-title');
        if (mapTitle && mapTitle.getBoundingClientRect().width > 0) return 'already_open';

        var btn = document.querySelector('button[data-guide="dock-map"]');
        if (btn) { btn.click(); return 'clicked_data_guide'; }

        var btns = document.querySelectorAll('button[title="Mapa"]');
        for (var i = 0; i < btns.length; i++) {
          var r = btns[i].getBoundingClientRect();
          if (r.width > 0 && r.height > 0) { btns[i].click(); return 'clicked_title_mapa'; }
        }

        var allBtns = document.querySelectorAll('button.dock-btn');
        for (var j = 0; j < allBtns.length; j++) {
          var img = allBtns[j].querySelector('img');
          if (img && img.src && img.src.indexOf('map') !== -1) {
            allBtns[j].click();
            return 'clicked_dock_img';
          }
        }

        var navBtns = document.querySelectorAll('nav button, .game-dock button');
        for (var k = 0; k < navBtns.length; k++) {
          var title = navBtns[k].getAttribute('title') || '';
          if (title.toLowerCase().indexOf('mapa') !== -1) {
            navBtns[k].click();
            return 'clicked_nav_title';
          }
        }

        return 'not_found_all_methods';
      })()`;
  }

  function selectRegionScript(regionName) {
    return `
      (function() {
        var btns = document.querySelectorAll('button.map-area');
        for (var i = 0; i < btns.length; i++) {
          var name = btns[i].querySelector('.map-area-name');
          if (name && name.innerText.trim().toLowerCase() === '${regionName.toLowerCase()}') {
            btns[i].click();
            return 'selected';
          }
        }
        return 'not_found';
      })()`;
  }

  function typeFilterScript(typeName) {
    return `
      (function() {
        var btns = document.querySelectorAll('button.pp-type.map-type-p');
        for (var i = 0; i < btns.length; i++) {
          if (btns[i].innerText.trim().toUpperCase() === '${typeName.toUpperCase()}') {
            btns[i].click();
            return 'toggled';
          }
        }
        return 'not_found';
      })()`;
  }

  function isHuntingScript() {
    return `
      (function() {
        var mapTitle = document.querySelector('.map-title');
        var mapOpen = mapTitle && mapTitle.getBoundingClientRect().width > 0;
        var hud = document.querySelector('.field-hud');
        var npcBtns = document.querySelectorAll('.npc-plate-btn');
        var hasNpc = false;
        for (var i = 0; i < npcBtns.length; i++) {
          var r = npcBtns[i].getBoundingClientRect();
          if (r.width > 0 && r.height > 0) { hasNpc = true; break; }
        }
        var party = document.querySelector('.phud-party');
        var partyText = party ? party.innerText : '';
        return { mapOpen: mapOpen, hasNpc: hasNpc, partyText: partyText.substring(0, 100) };
      })()`;
  }

  async function renderAutoHuntConfig() {
    autoHuntConfig.innerHTML = '<div class="auto-hunt-row" style="color:#8b98af;font-size:11px">Carregando lista de pokemon...</div>';

    if (autoHuntCreatures.length === 0) {
      await fetchCreaturesList();
    }

    const regionOptions = autoHuntRegions.map(r => `<option value="${r}">${r}</option>`).join('');
    const typeOptions = autoHuntTypes.map(t => `<option value="${t}">${t}</option>`).join('');
    const anyRunning = autoHuntState.some(s => s && s !== 'idle' && s !== 'stopped');

    let html = `<h3>Configuracao da Hunt</h3>`;

    savedAccounts.forEach((a, i) => {
      if (!a.username) return;
      const cfg = a.huntConfig || {};
      const isRunning = autoHuntState[i] && autoHuntState[i] !== 'idle' && autoHuntState[i] !== 'stopped';
      const selectedPokemon = cfg.pokemon || '';
      const selectedRegion = cfg.region || '';
      const selectedType = cfg.type || '';
      const delay = cfg.delay ?? 30;

      html += `
      <div style="background:#0c1018;border:1px solid #1a2333;border-radius:8px;padding:12px;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <input type="checkbox" class="hunt-account-check" value="${i}" id="huntEnabled${i}" ${isRunning ? 'checked' : ''}/>
          <label for="huntEnabled${i}" style="color:#e8a83c;font-weight:700;font-size:13px;cursor:pointer">
            ${escapeHtmlSimple(a.username)} — Conta ${i + 1}
          </label>
          ${isRunning ? '<span style="color:#2ecc71;font-size:10px;margin-left:auto">&#9679; caçando</span>' : ''}
        </div>
        <div class="auto-hunt-row">
          <label>Pokemon:</label>
          <div style="display:flex;flex-direction:column;gap:4px;flex:1">
            <input class="auto-hunt-input hunt-search" type="text" placeholder="Buscar pokemon..." style="width:100%" data-idx="${i}"/>
            <select class="auto-hunt-select hunt-pokemon" size="4" style="width:100%;min-height:60px" data-idx="${i}">
              ${autoHuntCreatures.map(p => `<option value="${p.slug}" ${p.slug === selectedPokemon ? 'selected' : ''}>${p.name} (Lv ${p.huntLevel || '?'})</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="auto-hunt-row">
          <label>Regiao:</label>
          <select class="auto-hunt-select hunt-region" data-idx="${i}">
            <option value="">Todas</option>${regionOptions.replace(/value="/g, `value="`).replace(/<option value="${selectedRegion}"/, `<option value="${selectedRegion}" selected`)}
          </select>
        </div>
        <div class="auto-hunt-row">
          <label>Tipo:</label>
          <select class="auto-hunt-select hunt-type" data-idx="${i}">
            <option value="">Todos</option>${typeOptions.replace(/value="/g, `value="`).replace(/<option value="${selectedType}"/, `<option value="${selectedType}" selected`)}
          </select>
        </div>
        <div class="auto-hunt-row">
          <label>Delay (s):</label>
          <input class="auto-hunt-input hunt-delay" type="number" value="${delay}" min="5" max="300" style="max-width:60px" data-idx="${i}"/>
        </div>
        <div class="auto-hunt-row">
          <button class="auto-hunt-btn hunt-start-btn" data-idx="${i}" style="${isRunning ? 'display:none' : ''}">&#9654; Iniciar</button>
          <button class="auto-hunt-btn stop hunt-stop-btn" data-idx="${i}" style="${isRunning ? '' : 'display:none'}">&#9632; Parar</button>
        </div>
      </div>`;
    });

    if (!savedAccounts.some(a => a.username)) {
      html += `<div style="color:#5c6b83;font-size:12px;text-align:center;padding:20px">Nenhuma conta configurada.</div>`;
    }

    autoHuntConfig.innerHTML = html;

    document.querySelectorAll('.hunt-search').forEach(searchInput => {
      const idx = searchInput.dataset.idx;
      const pokemonSelect = document.querySelector(`.hunt-pokemon[data-idx="${idx}"]`);
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

    document.querySelectorAll('.hunt-pokemon').forEach(pokemonSelect => {
      const idx = pokemonSelect.dataset.idx;
      pokemonSelect.addEventListener('change', () => {
        const slug = pokemonSelect.value;
        const creature = autoHuntCreaturesMap[slug];
        if (creature && creature.types && creature.types.length > 0) {
          const typeSelect = document.querySelector(`.hunt-type[data-idx="${idx}"]`);
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
        saveHuntConfigForAccount(parseInt(idx));
      });
    });

    document.querySelectorAll('.hunt-pokemon, .hunt-region, .hunt-type, .hunt-delay').forEach(el => {
      el.addEventListener('change', () => saveHuntConfigForAccount(parseInt(el.dataset.idx)));
    });

    document.querySelectorAll('.hunt-start-btn').forEach(btn => {
      btn.addEventListener('click', () => startAutoHuntForAccount(parseInt(btn.dataset.idx)));
    });

    document.querySelectorAll('.hunt-stop-btn').forEach(btn => {
      btn.addEventListener('click', () => stopAutoHuntForAccount(parseInt(btn.dataset.idx)));
    });
  }

  function saveHuntConfigForAccount(idx) {
    const pokemonSelect = document.querySelector(`.hunt-pokemon[data-idx="${idx}"]`);
    const cfg = {
      pokemon: pokemonSelect ? pokemonSelect.value : '',
      region: document.querySelector(`.hunt-region[data-idx="${idx}"]`)?.value || '',
      type: document.querySelector(`.hunt-type[data-idx="${idx}"]`)?.value || '',
      delay: parseInt(document.querySelector(`.hunt-delay[data-idx="${idx}"]`)?.value) || 30
    };
    savedAccounts[idx].huntConfig = cfg;
    window.pokeMultiAPI.saveLoginAccounts(savedAccounts.map(a => ({
      username: a.username,
      password: '',
      keepPassword: true,
      huntConfig: a.huntConfig || null,
      catchConfig: a.catchConfig || null
    })));
  }

  function renderAutoHuntStatus() {
    autoHuntStatus.innerHTML = savedAccounts.map((acc, i) => {
      const running = autoHuntState[i] && autoHuntState[i] !== 'idle' && autoHuntState[i] !== 'stopped' && autoHuntState[i] !== 'not_logged';
      const statusClass = running ? 'logged' : 'offline';
      const statusText = running ? 'caçando' : 'parado';
      const count = autoHuntCounts[i] || 0;
      const stateText = autoHuntState[i] || 'idle';

      return `<div class="analyzer-account-card">
        <div class="analyzer-account-header">
          <span class="analyzer-account-name">Conta ${i + 1}${acc.username ? ' (' + escapeHtmlSimple(acc.username) + ')' : ''}</span>
          <span class="analyzer-account-status ${statusClass}">${statusText}</span>
        </div>
        <div class="analyzer-account-body">
          <div class="analyzer-stat-row"><span class="analyzer-stat-label">Hunts feitas</span><span class="analyzer-stat-value gold">${count}</span></div>
          <div class="analyzer-stat-row"><span class="analyzer-stat-label">Estado</span><span class="analyzer-stat-value">${escapeHtmlSimple(stateText)}</span></div>
        </div>
      </div>`;
    }).join('');
  }

  async function startAutoHuntForAccount(idx) {
    if (!mapMarkersCache) {
      mapMarkersCache = await fetchMapMarkers();
    }
    const markers = mapMarkersCache;
    const mapSize = (markers && markers.map) || { w: 1788, h: 3364 };

    const cfg = savedAccounts[idx].huntConfig || {};
    const slug = cfg.pokemon || '';
    const region = cfg.region || '';
    const type = cfg.type || '';
    const delay = cfg.delay || 30;

    if (!slug) { autoHuntState[idx] = 'sem pokemon configurado'; renderAutoHuntStatus(); return; }

    const creature = autoHuntCreaturesMap[slug] || {};
    const pokemonName = creature.name || slug;
    const pokemonSlug = creature.slug || slug;

    let marker = null;
    if (markers && markers.hunts) {
      marker = markers.hunts.find(h => h.slug === pokemonSlug || h.name.toLowerCase() === pokemonName.toLowerCase());
    }
    if (!marker && markers && markers.hunts) {
      marker = markers.hunts.find(h => h.slug && h.slug.includes(pokemonSlug));
    }

    autoHuntState[idx] = 'running';
    autoHuntCounts[idx] = 0;
    runHuntLoop(idx, pokemonSlug, pokemonName, region, type, delay, marker, mapSize);
    renderAutoHuntStatus();
    renderAutoHuntConfig();
  }

  function stopAutoHuntForAccount(idx) {
    if (autoHuntIntervals[idx]) {
      clearTimeout(autoHuntIntervals[idx]);
      autoHuntIntervals[idx] = null;
    }
    autoHuntState[idx] = 'stopped';
    renderAutoHuntStatus();
    renderAutoHuntConfig();
  }

  async function runHuntLoop(index, slug, pokemonName, region, type, delay, marker, mapSize) {
    if (autoHuntState[index] !== 'running') return;

    const cfg = savedAccounts[index].huntConfig || {};
    const newSlug = cfg.pokemon || '';
    const newRegion = cfg.region || '';
    const newType = cfg.type || '';
    const newDelay = cfg.delay || 30;

    if (newSlug && (newSlug !== slug || newRegion !== region || newType !== type)) {
      const creature = autoHuntCreaturesMap[newSlug] || {};
      const newName = creature.name || newSlug;
      let newMarker = null;
      if (mapMarkersCache && mapMarkersCache.hunts) {
        newMarker = mapMarkersCache.hunts.find(h => h.slug === newSlug || h.name.toLowerCase() === newName.toLowerCase());
      }
      if (!newMarker && mapMarkersCache && mapMarkersCache.hunts) {
        newMarker = mapMarkersCache.hunts.find(h => h.slug && h.slug.includes(newSlug));
      }
      slug = newSlug;
      pokemonName = newName;
      region = newRegion;
      type = newType;
      marker = newMarker;
    }
    delay = newDelay;

    const webview = webviews[index];
    const currentUrl = getWebviewUrl(webview);
    if (!isLoggedGameUrl(currentUrl)) {
      autoHuntState[index] = 'not_logged';
      renderAutoHuntStatus();
      return;
    }

    try {
      autoHuntState[index] = 'opening map';
      renderAutoHuntStatus();

      const mapState = await webview.executeJavaScript(getMapStateScript(), true);
      let mapOpenResult = 'already_open';
      if (!mapState || !mapState.isOpen) {
        mapOpenResult = await webview.executeJavaScript(openMapScript(), true);
        await new Promise(r => setTimeout(r, 1500));
      }

      autoHuntState[index] = 'map: ' + mapOpenResult + (region ? ' → ' + region : '');
      renderAutoHuntStatus();

      if (region) {
        autoHuntState[index] = 'selecting region: ' + region;
        renderAutoHuntStatus();
        await webview.executeJavaScript(selectRegionScript(region), true);
        await new Promise(r => setTimeout(r, 1000));
      }

      if (type) {
        autoHuntState[index] = 'filtering type: ' + type;
        renderAutoHuntStatus();
        await webview.executeJavaScript(typeFilterScript(type), true);
        await new Promise(r => setTimeout(r, 1000));
      }

      autoHuntState[index] = 'clicking: ' + pokemonName;
      renderAutoHuntStatus();

      const clickResult = await webview.executeJavaScript(`
        (function() {
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
        })()
      `, true);

      if (clickResult && clickResult.ok) {
        autoHuntState[index] = 'hunting: ' + pokemonName + ' (' + clickResult.method + ')';
        renderAutoHuntStatus();
        await new Promise(r => setTimeout(r, 3000));
        await webview.executeJavaScript(getCloseMapScript(), true);
        autoHuntCounts[index] = (autoHuntCounts[index] || 0) + 1;
      } else {
        var debugInfo = '';
        if (clickResult) {
          debugInfo = clickResult.reason || '';
          if (clickResult.candidates) debugInfo += ' candidates:' + clickResult.candidates.length;
          if (clickResult.mapEl) debugInfo += ' mapEl:' + clickResult.mapEl.tag + ' ' + clickResult.mapEl.w + 'x' + clickResult.mapEl.h;
          if (clickResult.target) debugInfo += ' target:' + clickResult.target;
        }
        autoHuntState[index] = pokemonName + ' FAIL: ' + debugInfo.substring(0, 80);
        renderAutoHuntStatus();
        await webview.executeJavaScript(getCloseMapScript(), true);
      }

    } catch (e) {
      autoHuntState[index] = 'error: ' + String(e).substring(0, 60);
      renderAutoHuntStatus();
    }

    renderAutoHuntStatus();

    if (autoHuntState[index] !== 'stopped') {
      const huntTime = 60000;
      autoHuntIntervals[index] = setTimeout(() => {
        if (autoHuntState[index] !== 'stopped') {
          autoHuntState[index] = 'running';
          runHuntLoop(index, slug, pokemonName, region, type, delay, marker, mapSize);
        }
      }, huntTime + delay * 1000);
    }
  }

  openAutoHuntBtn.addEventListener('click', () => {
    autoHuntOverlay.classList.remove('hidden');
    renderAutoHuntConfig();
    renderAutoHuntStatus();
  });
  closeAutoHuntBtn.addEventListener('click', () => autoHuntOverlay.classList.add('hidden'));
  autoHuntOverlay.addEventListener('click', e => { if (e.target === autoHuntOverlay) autoHuntOverlay.classList.add('hidden'); });

  /* ===== Auto Catch ===== */
  const autoCatchOverlay = document.getElementById('autoCatchOverlay');
  const openAutoCatchBtn = document.getElementById('openAutoCatch');
  const closeAutoCatchBtn = document.getElementById('closeAutoCatch');
  const autoCatchConfig = document.getElementById('autoCatchConfig');
  const autoCatchStatus = document.getElementById('autoCatchStatus');

  function renderAutoCatchConfig() {
    const ballTypes = [
      { value: 0, label: 'Poke Ball ($5)' },
      { value: 1, label: 'Great Ball ($20)' },
      { value: 2, label: 'Super Ball ($50)' },
      { value: 3, label: 'Ultra Ball ($130)' }
    ];
    const anyRunning = autoCatchState.some(s => s && s !== 'idle' && s !== 'stopped');

    let html = `<h3>Configuracao do Auto Catch</h3>`;

    savedAccounts.forEach((a, i) => {
      if (!a.username) return;
      const cfg = a.catchConfig || {};
      const isRunning = autoCatchState[i] && autoCatchState[i] !== 'idle' && autoCatchState[i] !== 'stopped';
      const isVip = a.isVip;
      const ballType = cfg.ballType ?? 0;
      const ballQty = cfg.ballQty ?? 100;
      const delay = cfg.delay ?? 3;
      const autoBuy = cfg.autoBuy !== false;
      const autoSell = cfg.autoSell !== false;

      html += `
      <div style="background:#0c1018;border:1px solid #1a2333;border-radius:8px;padding:12px;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <input type="checkbox" class="catch-account-check" value="${i}" id="catchEnabled${i}" ${isRunning ? 'checked' : ''}/>
          <label for="catchEnabled${i}" style="color:#e8a83c;font-weight:700;font-size:13px;cursor:pointer">
            ${escapeHtmlSimple(a.username)} — Conta ${i + 1} ${isVip ? '<span style="color:#f39c12;font-size:10px;border:1px solid #f39c12;padding:1px 4px;border-radius:3px;margin-left:4px">VIP</span>' : ''}
          </label>
          ${isRunning ? '<span style="color:#2ecc71;font-size:10px;margin-left:auto">&#9679; ativo</span>' : ''}
        </div>
        ${!isVip ? `
        <div class="auto-hunt-row">
          <label>Delay (s):</label>
          <input class="auto-hunt-input catch-delay" type="number" value="${delay}" min="1" max="30" style="max-width:60px" data-idx="${i}"/>
        </div>
        <div class="auto-hunt-row">
          <label>Tipo:</label>
          <select class="auto-hunt-select catch-ball-type" data-idx="${i}">
            ${ballTypes.map(bt => `<option value="${bt.value}" ${bt.value === ballType ? 'selected' : ''}>${bt.label}</option>`).join('')}
          </select>
        </div>
        <div class="auto-hunt-row">
          <label>Qtd:</label>
          <input class="auto-hunt-input catch-ball-qty" type="number" value="${ballQty}" min="1" max="1000" style="max-width:60px" data-idx="${i}"/>
        </div>
        ` : ''}
        <div class="auto-hunt-row">
          <label>Auto Buy:</label>
          <div class="toggle-row">
            <input type="checkbox" class="catch-auto-buy" id="catchBuy${i}" ${autoBuy ? 'checked' : ''} data-idx="${i}"/>
            <label for="catchBuy${i}" style="min-width:auto;color:#e7ecf5;font-weight:400">Sim</label>
          </div>
        </div>
        <div class="auto-hunt-row">
          <label>Auto Sell:</label>
          <div class="toggle-row">
            <input type="checkbox" class="catch-auto-sell" id="catchSell${i}" ${autoSell ? 'checked' : ''} data-idx="${i}"/>
            <label for="catchSell${i}" style="min-width:auto;color:#e7ecf5;font-weight:400">Sim</label>
          </div>
        </div>
        <div class="auto-hunt-row">
          <button class="auto-hunt-btn catch-start-btn" data-idx="${i}" style="${isRunning ? 'display:none' : ''}">&#9654; Iniciar</button>
          <button class="auto-hunt-btn stop catch-stop-btn" data-idx="${i}" style="${isRunning ? '' : 'display:none'}">&#9632; Parar</button>
        </div>
      </div>`;
    });

    if (!savedAccounts.some(a => a.username)) {
      html += `<div style="color:#5c6b83;font-size:12px;text-align:center;padding:20px">Nenhuma conta configurada. Abra o gerenciador de contas.</div>`;
    }

    autoCatchConfig.innerHTML = html;

    document.querySelectorAll('.catch-ball-type, .catch-delay, .catch-ball-qty, .catch-auto-buy, .catch-auto-sell').forEach(el => {
      el.addEventListener('change', () => saveCatchConfigForAccount(parseInt(el.dataset.idx)));
    });

    document.querySelectorAll('.catch-start-btn').forEach(btn => {
      btn.addEventListener('click', () => startAutoCatchForAccount(parseInt(btn.dataset.idx)));
    });

    document.querySelectorAll('.catch-stop-btn').forEach(btn => {
      btn.addEventListener('click', () => stopAutoCatchForAccount(parseInt(btn.dataset.idx)));
    });
  }

  function saveCatchConfigForAccount(idx) {
    const cfg = {
      ballType: parseInt(document.querySelector(`.catch-ball-type[data-idx="${idx}"]`).value) || 0,
      ballQty: parseInt(document.querySelector(`.catch-ball-qty[data-idx="${idx}"]`).value) || 100,
      delay: parseInt(document.querySelector(`.catch-delay[data-idx="${idx}"]`).value) || 3,
      autoBuy: document.querySelector(`.catch-auto-buy[data-idx="${idx}"]`).checked,
      autoSell: document.querySelector(`.catch-auto-sell[data-idx="${idx}"]`).checked
    };
    savedAccounts[idx].catchConfig = cfg;
    window.pokeMultiAPI.saveLoginAccounts(savedAccounts.map(a => ({
      username: a.username,
      password: '',
      keepPassword: true,
      huntConfig: a.huntConfig || null,
      catchConfig: a.catchConfig || null
    })));
  }

  function renderAutoCatchStatus() {
    autoCatchStatus.innerHTML = savedAccounts.map((acc, i) => {
      const state = autoCatchState[i] || 'idle';
      const isStopped = state === 'idle' || state === 'stopped' || state === 'not_logged';
      const statusClass = isStopped ? 'offline' : 'logged';
      const statusText = isStopped ? 'parado' : 'capturando';
      const count = autoCatchCounts[i] || 0;
      const balls = autoCatchBallCounts[i] || 0;

      return `<div class="analyzer-account-card">
        <div class="analyzer-account-header">
          <span class="analyzer-account-name">Conta ${i + 1}${acc.username ? ' (' + escapeHtmlSimple(acc.username) + ')' : ''}</span>
          <span class="analyzer-account-status ${statusClass}">${statusText}</span>
        </div>
        <div class="analyzer-account-body">
          <div class="analyzer-stat-row"><span class="analyzer-stat-label">Capturas feitas</span><span class="analyzer-stat-value gold">${count}</span></div>
          <div class="analyzer-stat-row"><span class="analyzer-stat-label">Pokebolas</span><span class="analyzer-stat-value">${balls}</span></div>
          <div class="analyzer-stat-row"><span class="analyzer-stat-label">Estado</span><span class="analyzer-stat-value">${escapeHtmlSimple(state)}</span></div>
        </div>
      </div>`;
    }).join('');
  }

  async function startAutoCatchForAccount(idx) {
    const cfg = savedAccounts[idx].catchConfig || {};
    const delay = cfg.delay || 3;
    const ballType = cfg.ballType ?? 0;
    const ballQty = cfg.ballQty ?? 100;
    const autoBuy = cfg.autoBuy !== false;
    const autoSell = cfg.autoSell !== false;

    autoCatchState[idx] = 'running';
    autoCatchCounts[idx] = 0;
    autoCatchBallCounts[idx] = 0;
    runCatchLoop(idx, delay, autoBuy, autoSell, ballType, ballQty);
    renderAutoCatchStatus();
    renderAutoCatchConfig();
  }

  function stopAutoCatchForAccount(idx) {
    if (autoCatchIntervals[idx]) {
      clearTimeout(autoCatchIntervals[idx]);
      autoCatchIntervals[idx] = null;
    }
    autoCatchState[idx] = 'stopped';
    renderAutoCatchStatus();
    renderAutoCatchConfig();
  }

  async function runCatchLoop(index, delay, autoBuy, autoSell, ballType, ballQty) {
    if (autoCatchState[index] === 'stopped' || autoCatchState[index] === 'not_logged') return;

    const cfg = savedAccounts[index].catchConfig || {};
    delay = cfg.delay || 3;
    ballType = cfg.ballType ?? 0;
    ballQty = cfg.ballQty ?? 100;
    autoBuy = cfg.autoBuy !== false;
    autoSell = cfg.autoSell !== false;

    const webview = webviews[index];
    const currentUrl = getWebviewUrl(webview);
    if (!isLoggedGameUrl(currentUrl)) {
      autoCatchState[index] = 'not_logged';
      renderAutoCatchStatus();
      return;
    }

    try {
      autoCatchState[index] = 'checking capture panel';
      renderAutoCatchStatus();

      const capState = await webview.executeJavaScript(getCaptureStateScript(), true);

      if (!capState || !capState.active) {
        autoCatchState[index] = 'aguardando pokemon...';
        renderAutoCatchStatus();
        autoCatchIntervals[index] = setTimeout(() => runCatchLoop(index, delay, autoBuy, autoSell, ballType, ballQty), 5000);
        return;
      }

      autoCatchBallCounts[index] = capState.balls;

      if (capState.balls <= 0) {
        autoCatchState[index] = 'sem pokebolas! voltando pra cidade...';
        renderAutoCatchStatus();

        await webview.executeJavaScript(goHomeScript(), true);
        await new Promise(r => setTimeout(r, 4000));

        if (autoSell) {
          autoCatchState[index] = 'abrindo mercado...';
          renderAutoCatchStatus();
          await webview.executeJavaScript(openMarketScript(), true);
          await new Promise(r => setTimeout(r, 3000));

          autoCatchState[index] = 'conversando com Mark...';
          renderAutoCatchStatus();
          await webview.executeJavaScript(talkToNpcScript(), true);
          await new Promise(r => setTimeout(r, 2000));

          autoCatchState[index] = 'abrindo loja...';
          renderAutoCatchStatus();
          await webview.executeJavaScript(openNpcShopScript(), true);
          await new Promise(r => setTimeout(r, 2000));

          autoCatchState[index] = 'abindo aba vender...';
          renderAutoCatchStatus();
          await webview.executeJavaScript(clickSellTabScript(), true);
          await new Promise(r => setTimeout(r, 1000));

          autoCatchState[index] = 'selecionando tudo...';
          renderAutoCatchStatus();
          await webview.executeJavaScript(selectAllLootScript(), true);
          await new Promise(r => setTimeout(r, 1000));

          autoCatchState[index] = 'vendendo loot...';
          renderAutoCatchStatus();
          await webview.executeJavaScript(clickSellButtonScript(), true);
          await new Promise(r => setTimeout(r, 2000));
          await webview.executeJavaScript(confirmSellScript(), true);
          await new Promise(r => setTimeout(r, 1500));
        }

        if (autoBuy) {
          autoCatchState[index] = 'abrindo aba comprar...';
          renderAutoCatchStatus();
          await webview.executeJavaScript(clickBuyTabScript(), true);
          await new Promise(r => setTimeout(r, 1000));

          autoCatchState[index] = 'configurando quantidade...';
          renderAutoCatchStatus();
          await webview.executeJavaScript(setBuyQtyScript(ballQty), true);
          await new Promise(r => setTimeout(r, 1000));

          autoCatchState[index] = 'comprando pokebolas...';
          renderAutoCatchStatus();
          await webview.executeJavaScript(buyPokeballScript(ballType), true);
          await new Promise(r => setTimeout(r, 2000));

          await webview.executeJavaScript(closeAnyModalScript(), true);
          await new Promise(r => setTimeout(r, 1000));
        }

        const huntCfg = savedAccounts[index].huntConfig || {};
        if (huntCfg.pokemon) {
          autoCatchState[index] = 'voltando pra caça...';
          renderAutoCatchStatus();
          await webview.executeJavaScript(openMapScript(), true);
          await new Promise(r => setTimeout(r, 2500));
          if (huntCfg.region) {
            await webview.executeJavaScript(selectRegionScript(huntCfg.region), true);
            await new Promise(r => setTimeout(r, 1500));
          }
          if (huntCfg.type) {
            await webview.executeJavaScript(typeFilterScript(huntCfg.type), true);
            await new Promise(r => setTimeout(r, 1500));
          }
          const markerResult = await webview.executeJavaScript(clickHuntMarkerScript(huntCfg.pokemon, huntCfg.pokemon), true);
          if (markerResult && markerResult.ok) {
            await new Promise(r => setTimeout(r, 3000));
            await webview.executeJavaScript(getCloseMapScript(), true);
            await new Promise(r => setTimeout(r, 1500));
          } else {
            autoCatchState[index] = 'marker nao encontrado, tentando novamente...';
            renderAutoCatchStatus();
            await webview.executeJavaScript(getCloseMapScript(), true);
            await new Promise(r => setTimeout(r, 2000));
          }
        }

        autoCatchState[index] = 'running';
        renderAutoCatchStatus();
        autoCatchIntervals[index] = setTimeout(() => runCatchLoop(index, delay, autoBuy, autoSell, ballType, ballQty), 3000);
        return;
      }


      if (capState.canThrow > 0) {
        autoCatchState[index] = 'throwing at ' + capState.names.join(', ') + ' (' + capState.balls + ' bolas)';
        renderAutoCatchStatus();

        const throwResult = await webview.executeJavaScript(throwAllBallsScript(), true);
        if (throwResult && throwResult.thrown > 0) {
          autoCatchCounts[index] = (autoCatchCounts[index] || 0) + throwResult.thrown;
        }
        autoCatchBallCounts[index] = Math.max(0, capState.balls - (throwResult ? throwResult.thrown : 0));
      } else {
        autoCatchState[index] = 'no throw buttons available';
        renderAutoCatchStatus();
      }

    } catch (e) {
      autoCatchState[index] = 'aguardando pokemon...';
      renderAutoCatchStatus();
    }

    renderAutoCatchStatus();

    if (autoCatchState[index] !== 'stopped') {
      autoCatchIntervals[index] = setTimeout(() => {
        if (autoCatchState[index] !== 'stopped') runCatchLoop(index, delay, autoBuy, autoSell, ballType, ballQty);
      }, delay * 1000);
    }
  }

  openAutoCatchBtn.addEventListener('click', () => {
    autoCatchOverlay.classList.remove('hidden');
    renderAutoCatchConfig();
    renderAutoCatchStatus();
  });
  closeAutoCatchBtn.addEventListener('click', () => autoCatchOverlay.classList.add('hidden'));
  autoCatchOverlay.addEventListener('click', e => { if (e.target === autoCatchOverlay) autoCatchOverlay.classList.add('hidden'); });
})();
