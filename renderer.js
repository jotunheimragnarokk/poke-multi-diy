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
      const current = savedAccounts[i] || { hasPassword: false };
      return {
        username: clearPasswords ? '' : username,
        password,
        keepPassword: !clearPasswords && !password && current.hasPassword
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
      webview.setZoomFactor(panel.classList.contains('expanded') ? 0.9 : 0.55);
      refreshPanelState(i);
      if (isLoginUrl(getWebviewUrl(webview))) scheduleAutoLogin(i, 500, false);
    });

    webview.addEventListener('did-navigate', () => refreshPanelState(i));
    webview.addEventListener('did-navigate-in-page', () => refreshPanelState(i));

    // Reaplica o zoom certo sempre que o painel expande/recolhe
    const applyZoom = () => {
      const factor = panel.classList.contains('expanded') ? 0.9 : 0.55;
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

  // "Layout": alterna entre grade 2x2 e coluna unica (1 conta por linha,
  // rolando verticalmente) -- util em telas menores ou pra focar em poucas contas.
  let stacked = false;
  toggleLayoutBtn.addEventListener('click', () => {
    stacked = !stacked;
    grid.classList.toggle('grid-stack', stacked);
    grid.classList.toggle('grid-4', !stacked);
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
})();
