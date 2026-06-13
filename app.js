const STORAGE_KEY = 'ccmaster_riddle_users';
const SESSION_KEY = 'ccmaster_riddle_session';
const TEMP_SESSION_KEY = 'ccmaster_riddle_session_temp';

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
    continueBtn.textContent = current > 1 ? 'CONTINUAR O CASO' : 'ENTRAR NO CASO';
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
animateCounters();
setInterval(animateCounters, 8000);

/*
  IMPORTANTE:
  Este cadastro usa localStorage/sessionStorage apenas para protótipo estático no GitHub/Cloudflare Pages.
  Para salvar progresso real entre dispositivos, o ideal é trocar esta camada por Firebase Auth + Firestore
  ou Supabase Auth + Database.
*/
