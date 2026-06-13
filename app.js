const STORAGE_KEY = 'ccmaster_riddle_users';
const SESSION_KEY = 'ccmaster_riddle_session';
const TEMP_SESSION_KEY = 'ccmaster_riddle_session_temp';
const EXTRA_HINTS_KEY = 'ccmaster_riddle_extra_hints';

const $ = (selector) => document.querySelector(selector);

const authForm = $('#authForm');
const tabLogin = $('#tabLogin');
const tabRegister = $('#tabRegister');
const submitLogin = $('#submitLogin');
const submitRegister = $('#submitRegister');
const nicknameField = $('#nicknameField');
const nicknameInput = $('#nickname');
const emailInput = $('#email');
const passwordInput = $('#password');
const rememberDevice = $('#rememberDevice');
const formMessage = $('#formMessage');
const showPass = $('#showPass');
const loggedPanel = $('#loggedPanel');
const loggedName = $('#loggedName');
const continueBtn = $('#continueBtn');
const logoutBtn = $('#logoutBtn');
const navUser = $('#navUser');
const navLogout = $('#navLogout');
const themeToggle = $('#themeToggle');
const rankingList = $('#rankingList');

let currentMode = 'login';

function getUsers() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}


function getExtraHints() {
  try {
    return JSON.parse(localStorage.getItem(EXTRA_HINTS_KEY)) || [];
  } catch {
    return [];
  }
}

function normalizeSolvedEntries(solved) {
  if (!Array.isArray(solved)) return [];
  return solved.map((entry) => {
    if (typeof entry === 'string') {
      return { riddleNumber: entry, extraHintCount: 0, extraHints: [] };
    }
    return {
      riddleNumber: entry.riddleNumber,
      solvedAt: entry.solvedAt,
      extraHintCount: Number(entry.extraHintCount || entry.extraHints?.length || 0),
      extraHints: Array.isArray(entry.extraHints) ? entry.extraHints : [],
    };
  }).filter((entry) => entry.riddleNumber);
}

function renderRanking() {
  if (!rankingList) return;

  const users = getUsers();
  const hints = getExtraHints();
  const rows = users.map((user) => {
    const solved = normalizeSolvedEntries(user.progress?.solved);
    const userHints = hints.filter((hint) => hint.userId === user.id);
    const solvedHintCount = solved.reduce((total, entry) => total + Number(entry.extraHintCount || 0), 0);
    const totalHintCount = Math.max(solvedHintCount, userHints.length);
    const hintNames = userHints.length
      ? userHints.map((hint) => `Caso ${hint.riddleNumber} — ${hint.hintTitle || hint.hintId}`)
      : solved.flatMap((entry) => (entry.extraHints || []).map((hint) => `Caso ${entry.riddleNumber} — ${hint.hintTitle || hint.hintId}`));

    return {
      nickname: user.nickname || 'Investigador',
      solvedCount: solved.length,
      hintCount: totalHintCount,
      hintNames: [...new Set(hintNames)],
      lastAccess: user.progress?.lastAccess || user.createdAt || '',
    };
  }).filter((row) => row.solvedCount > 0 || row.hintCount > 0)
    .sort((a, b) => {
      if (b.solvedCount !== a.solvedCount) return b.solvedCount - a.solvedCount;
      if (a.hintCount !== b.hintCount) return a.hintCount - b.hintCount;
      return String(b.lastAccess).localeCompare(String(a.lastAccess));
    });

  rankingList.replaceChildren();

  if (!rows.length) {
    const empty = document.createElement('p');
    empty.className = 'ranking-empty';
    empty.textContent = 'Nenhum caso resolvido neste navegador ainda.';
    rankingList.append(empty);
    return;
  }

  rows.forEach((row, index) => {
    const card = document.createElement('article');
    card.className = 'ranking-row';

    const place = document.createElement('strong');
    place.textContent = `${index + 1}. ${row.nickname}`;

    const meta = document.createElement('span');
    meta.textContent = `${row.solvedCount} caso${row.solvedCount === 1 ? '' : 's'} resolvido${row.solvedCount === 1 ? '' : 's'} • ${row.hintCount} dica${row.hintCount === 1 ? '' : 's'} extra${row.hintCount === 1 ? '' : 's'}`;

    const details = document.createElement('small');
    details.textContent = row.hintNames.length ? `Usou: ${row.hintNames.join(', ')}` : 'Sem dicas extras registradas.';

    card.append(place, meta, details);
    rankingList.append(card);
  });
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function setMessage(text, type = 'normal') {
  if (!formMessage) return;
  formMessage.textContent = text;
  formMessage.classList.toggle('error', type === 'error');
}

function setMode(mode) {
  currentMode = mode;
  const isRegister = mode === 'register';

  tabLogin?.classList.toggle('active', !isRegister);
  tabLogin?.setAttribute('aria-selected', String(!isRegister));
  tabRegister?.classList.toggle('active', isRegister);
  tabRegister?.setAttribute('aria-selected', String(isRegister));

  if (nicknameField) nicknameField.style.display = isRegister ? 'block' : 'none';
  if (nicknameInput) nicknameInput.required = isRegister;
  setMessage('');
}

function makeSession(user) {
  return {
    id: user.id,
    nickname: user.nickname,
    email: user.email,
    currentRiddle: user.progress?.currentRiddle || 1
  };
}

function startSession(user) {
  const session = makeSession(user);
  const shouldRemember = Boolean(rememberDevice?.checked);

  if (shouldRemember) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    sessionStorage.removeItem(TEMP_SESSION_KEY);
  } else {
    sessionStorage.setItem(TEMP_SESSION_KEY, JSON.stringify(session));
    localStorage.removeItem(SESSION_KEY);
  }

  renderSession();
  renderRanking();
}

function registerUser() {
  const nickname = nicknameInput.value.trim();
  const email = normalizeEmail(emailInput.value);
  const password = passwordInput.value;

  if (nickname.length < 2) {
    setMessage('Escolha um apelido com pelo menos 2 caracteres.', 'error');
    return;
  }

  if (!email || !password) {
    setMessage('Preencha e-mail e senha para cadastrar.', 'error');
    return;
  }

  const users = getUsers();
  const exists = users.some((user) => user.email === email);

  if (exists) {
    setMessage('Este e-mail já foi cadastrado. Use Entrar.', 'error');
    return;
  }

  const user = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    nickname,
    email,
    password,
    progress: {
      currentRiddle: 1,
      solved: [],
      lastAccess: new Date().toISOString()
    },
    createdAt: new Date().toISOString()
  };

  users.push(user);
  saveUsers(users);
  startSession(user);
  setMessage(`Cadastro concluído. Bem-vindo, ${nickname}.`);
}

function loginUser() {
  const email = normalizeEmail(emailInput.value);
  const password = passwordInput.value;
  const users = getUsers();
  const user = users.find((candidate) => candidate.email === email && candidate.password === password);

  if (!user) {
    setMessage('E-mail ou senha incorretos.', 'error');
    return;
  }

  user.progress = user.progress || { currentRiddle: 1, solved: [] };
  user.progress.lastAccess = new Date().toISOString();
  saveUsers(users);
  startSession(user);
  setMessage(`Investigador conectado: ${user.nickname}.`);
}

function endSession() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(TEMP_SESSION_KEY);
  renderSession();
  renderRanking();
  setMessage('Sessão encerrada.');
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY)) || JSON.parse(sessionStorage.getItem(TEMP_SESSION_KEY));
  } catch {
    return null;
  }
}

function riddleUrl(number) {
  return `/riddles/${String(number || 1).padStart(3, '0')}/`;
}

function renderSession() {
  const session = getSession();

  if (!session) {
    if (loggedPanel) loggedPanel.hidden = true;
    if (navUser) {
      navUser.hidden = true;
      navUser.textContent = '';
    }
    if (navLogout) navLogout.hidden = true;
    return;
  }

  const current = session.currentRiddle || 1;

  if (loggedName) {
    loggedName.textContent = `${session.nickname} — Riddle ${String(current).padStart(3, '0')}`;
  }

  if (continueBtn) {
    continueBtn.href = riddleUrl(current);
    continueBtn.textContent = current > 1 ? 'Continuar' : 'Começar';
  }

  if (loggedPanel) loggedPanel.hidden = false;

  if (navUser) {
    navUser.textContent = `Investigador: ${session.nickname}`;
    navUser.hidden = false;
  }

  if (navLogout) navLogout.hidden = false;
}

function initTheme() {
  const savedTheme = localStorage.getItem('ccmaster_theme');
  if (savedTheme === 'light') {
    document.body.classList.add('light');
    if (themeToggle) themeToggle.textContent = '☾';
  }
}

function toggleTheme() {
  const isLight = document.body.classList.toggle('light');
  if (themeToggle) themeToggle.textContent = isLight ? '☾' : '☼';
  localStorage.setItem('ccmaster_theme', isLight ? 'light' : 'dark');
}

function animateCounters() {
  const online = $('#onlineCount');
  if (!online) return;

  const base = 42;
  const variation = Math.floor(Math.random() * 7);
  online.textContent = String(base + variation).padStart(3, '0');
}

tabLogin?.addEventListener('click', () => setMode('login'));
tabRegister?.addEventListener('click', () => setMode('register'));
submitRegister?.addEventListener('click', () => {
  setMode('register');
  registerUser();
});

authForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (currentMode === 'register') {
    registerUser();
  } else {
    loginUser();
  }
});

showPass?.addEventListener('click', () => {
  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';
  showPass.textContent = isPassword ? '●' : '◌';
});

logoutBtn?.addEventListener('click', endSession);
navLogout?.addEventListener('click', endSession);
themeToggle?.addEventListener('click', toggleTheme);

setMode('login');
initTheme();
renderSession();
renderRanking();
animateCounters();
setInterval(animateCounters, 8000);

/*
  IMPORTANTE:
  Este cadastro usa localStorage/sessionStorage apenas para protótipo estático no GitHub/Cloudflare Pages.
  Para salvar progresso real entre dispositivos, o ideal é trocar esta camada por Firebase Auth + Firestore
  ou Supabase Auth + Database.
*/
