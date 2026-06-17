const SESSION_KEY = 'ccmaster_riddle_session';
const TEMP_SESSION_KEY = 'ccmaster_riddle_session_temp';
const TOTAL_RIDDLES = window.CCMasterSupabase?.totalRiddles || 100;
const supabaseClient = window.CCMasterSupabase?.client || null;

const $ = (selector) => document.querySelector(selector);

const authCard = $('#authCard');
const authCardTitle = $('#authCardTitle');
const authCardHelper = $('#authCardHelper');
const authControls = $('#authControls');
const authForm = $('#authForm');
const tabLogin = $('#tabLogin');
const tabRegister = $('#tabRegister');
const submitLogin = $('#submitLogin');
const submitRegister = $('#submitRegister');
const forgotPassword = $('#forgotPassword');
const googleLogin = $('#googleLogin');
const nicknameField = $('#nicknameField');
const nicknameInput = $('#nickname');
const emailInput = $('#email');
const emailField = emailInput?.closest('.field');
const passwordInput = $('#password');
const rememberDevice = $('#rememberDevice');
const formMessage = $('#formMessage');
const showPass = $('#showPass');
const loggedPanel = $('#loggedPanel');
const loggedName = $('#loggedName');
const loggedProgress = $('#loggedProgress');
const continueBtn = $('#continueBtn');
const logoutBtn = $('#logoutBtn');
const navUser = $('#navUser');
const navLogout = $('#navLogout');
const themeToggle = $('#themeToggle');
const rankingBody = $('#rankingBody');
const emptyRanking = $('#emptyRanking');


const INTRO_MODAL_KEY = 'ccmaster_intro_modal_seen_v1';
const introModal = $('#introModal');
const introDismissBtn = $('#introDismissBtn');
const introRulesBtn = $('#introRulesBtn');
let introLastFocus = null;

function hideIntroModal(saveChoice = true) {
  if (!introModal) return;
  if (saveChoice) localStorage.setItem(INTRO_MODAL_KEY, '1');
  introModal.hidden = true;
  document.body.classList.remove('intro-modal-open');
  introLastFocus?.focus?.();
}

function showIntroModal() {
  if (!introModal) return;
  const alreadySeen = localStorage.getItem(INTRO_MODAL_KEY) === '1';
  const forceIntro = new URLSearchParams(window.location.search).get('intro') === '1';

  if (alreadySeen && !forceIntro) return;

  introLastFocus = document.activeElement;
  introModal.hidden = false;
  document.body.classList.add('intro-modal-open');
  introDismissBtn?.focus();
}

introDismissBtn?.addEventListener('click', () => hideIntroModal(true));
introRulesBtn?.addEventListener('click', () => localStorage.setItem(INTRO_MODAL_KEY, '1'));

introModal?.addEventListener('click', (event) => {
  if (event.target?.matches?.('[data-intro-close]')) {
    hideIntroModal(true);
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && introModal && !introModal.hidden) {
    hideIntroModal(true);
  }
});

let currentMode = 'login';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function setMessage(text, type = 'normal') {
  if (!formMessage) return;
  formMessage.textContent = text;
  formMessage.classList.toggle('error', type === 'error');
  formMessage.classList.toggle('ok', type === 'ok');
}

function setBusy(isBusy) {
  [submitLogin, submitRegister, forgotPassword, googleLogin].forEach((button) => {
    if (button) button.disabled = isBusy;
  });
}

function setMode(mode) {
  currentMode = mode;
  const isRegister = mode === 'register';
  const isReset = mode === 'reset';

  tabLogin?.classList.toggle('active', mode === 'login' || isReset);
  tabLogin?.setAttribute('aria-selected', String(mode === 'login' || isReset));
  tabRegister?.classList.toggle('active', isRegister);
  tabRegister?.setAttribute('aria-selected', String(isRegister));

  if (nicknameField) nicknameField.style.display = isRegister ? 'block' : 'none';
  if (emailField) emailField.style.display = isReset ? 'none' : 'block';
  if (nicknameInput) nicknameInput.required = isRegister;
  if (emailInput) emailInput.required = !isReset;
  if (passwordInput) {
    passwordInput.required = true;
    passwordInput.placeholder = isReset ? 'Digite a nova senha' : 'Digite sua senha';
  }

  if (submitLogin) submitLogin.textContent = isReset ? 'Salvar nova senha' : 'Entrar';
  if (submitRegister) submitRegister.hidden = isReset;
  if (forgotPassword) forgotPassword.hidden = isRegister || isReset;

  if (!isReset) setMessage('');
}

function riddleUrl(number) {
  return `/riddles/${String(number || 1).padStart(3, '0')}/`;
}

function saveSessionCache(sessionData) {
  const payload = JSON.stringify(sessionData);
  localStorage.setItem(SESSION_KEY, payload);
  sessionStorage.removeItem(TEMP_SESSION_KEY);
}

function clearSessionCache() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(TEMP_SESSION_KEY);
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY)) || JSON.parse(sessionStorage.getItem(TEMP_SESSION_KEY));
  } catch {
    return null;
  }
}

async function getProfile(user) {
  if (!supabaseClient || !user?.id) return null;

  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id, nickname')
    .eq('id', user.id)
    .maybeSingle();

  if (data && !error) return data;

  const fallbackNickname = user.user_metadata?.nickname || normalizeEmail(user.email).split('@')[0] || 'Investigador';
  const { data: created } = await supabaseClient
    .from('profiles')
    .upsert({ id: user.id, nickname: fallbackNickname }, { onConflict: 'id' })
    .select('id, nickname')
    .maybeSingle();

  return created || { id: user.id, nickname: fallbackNickname };
}

async function getProgressStats(userId) {
  if (!supabaseClient || !userId) {
    return { solvedCount: 0, currentRiddle: 1, lastSolvedAt: null };
  }

  const { data } = await supabaseClient
    .from('progress')
    .select('riddle_id, solved_at')
    .eq('user_id', userId)
    .eq('solved', true);

  const solved = Array.isArray(data) ? data : [];
  const solvedIds = solved.map((item) => Number(item.riddle_id)).filter(Boolean);
  const highestSolved = solvedIds.length ? Math.max(...solvedIds) : 0;
  const currentRiddle = Math.min(highestSolved + 1, TOTAL_RIDDLES);
  const lastSolvedAt = solved
    .map((item) => item.solved_at)
    .filter(Boolean)
    .sort()
    .at(-1) || null;

  return {
    solvedCount: solvedIds.length,
    currentRiddle: currentRiddle || 1,
    lastSolvedAt,
  };
}

async function syncSessionFromSupabase() {
  if (!supabaseClient) {
    clearSessionCache();
    return null;
  }

  const { data: { session } } = await supabaseClient.auth.getSession();
  const user = session?.user;

  if (!user) {
    clearSessionCache();
    return null;
  }

  const profile = await getProfile(user);
  const stats = await getProgressStats(user.id);
  const sessionData = {
    id: user.id,
    nickname: profile?.nickname || user.user_metadata?.nickname || 'Investigador',
    email: user.email,
    currentRiddle: stats.currentRiddle,
    solvedCount: stats.solvedCount,
    lastSolvedAt: stats.lastSolvedAt,
  };

  saveSessionCache(sessionData);
  return sessionData;
}

async function renderSession() {
  const session = await syncSessionFromSupabase();

  if (!session) {
    document.body.classList.remove('is-logged-in');
    if (authControls) authControls.hidden = false;
    if (authCard) authCard.setAttribute('aria-label', 'Cadastro e login');
    if (authCardTitle) authCardTitle.textContent = 'Identificação do Investigador';
    if (authCardHelper) authCardHelper.textContent = 'Entre ou cadastre-se para salvar seu progresso na nuvem.';
    if (loggedPanel) loggedPanel.hidden = true;
    if (loggedProgress) loggedProgress.textContent = 'Progresso sincronizado na nuvem.';
    if (navUser) {
      navUser.hidden = true;
      navUser.textContent = '';
    }
    if (navLogout) navLogout.hidden = true;
    return;
  }

  document.body.classList.add('is-logged-in');
  const current = session.currentRiddle || 1;
  const solvedCount = session.solvedCount || 0;

  if (authControls) authControls.hidden = true;
  if (authCard) authCard.setAttribute('aria-label', 'Área do investigador');
  if (authCardTitle) authCardTitle.textContent = 'Área do Investigador';
  if (authCardHelper) authCardHelper.textContent = 'Identidade confirmada. Escolha seu próximo passo.';

  if (loggedName) {
    loggedName.textContent = session.nickname || 'Investigador';
  }

  if (loggedProgress) {
    loggedProgress.textContent = `${solvedCount}/${TOTAL_RIDDLES} riddles resolvidos`;
  }

  if (continueBtn) {
    continueBtn.href = riddleUrl(current);
    continueBtn.textContent = current > 1 ? `IR PARA O RIDDLE ${String(current).padStart(3, '0')}` : 'IR PARA O RIDDLE';
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

function formatDate(value) {
  if (!value) return 'sem registro';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'sem registro';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function renderRanking() {
  if (window.CCMasterLeaderboard?.renderAll) {
    await window.CCMasterLeaderboard.renderAll();
  }
}

function animateCounters() {
  const online = $('#onlineCount');
  if (!online) return;

  const base = 42;
  const variation = Math.floor(Math.random() * 7);
  online.textContent = String(base + variation).padStart(3, '0');
}

async function loginWithGoogle() {
  if (!supabaseClient) {
    setMessage('Supabase não carregou. Recarregue a página.', 'error');
    return;
  }

  setBusy(true);
  setMessage('Redirecionando para o Google...', 'ok');

  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/`,
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account',
      },
    },
  });

  setBusy(false);

  if (error) {
    setMessage(error.message || 'Não foi possível entrar com Google.', 'error');
  }
}

async function registerUser() {
  if (!supabaseClient) {
    setMessage('Supabase não carregou. Recarregue a página.', 'error');
    return;
  }

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

  if (password.length < 8) {
    setMessage('Use uma senha com pelo menos 8 caracteres.', 'error');
    return;
  }

  setBusy(true);
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: { nickname },
      emailRedirectTo: `${window.location.origin}/`,
    },
  });
  setBusy(false);

  if (error) {
    setMessage(error.message || 'Não foi possível cadastrar.', 'error');
    return;
  }

  if (data?.session) {
    await renderSession();
    await renderRanking();
    setMessage(`Cadastro concluído. Bem-vindo, ${nickname}.`, 'ok');
    return;
  }

  setMessage('Cadastro recebido. Confirme seu e-mail para entrar na investigação.', 'ok');
  setMode('login');
}

async function loginUser() {
  if (!supabaseClient) {
    setMessage('Supabase não carregou. Recarregue a página.', 'error');
    return;
  }

  const email = normalizeEmail(emailInput.value);
  const password = passwordInput.value;

  if (!email || !password) {
    setMessage('Preencha e-mail e senha para entrar.', 'error');
    return;
  }

  setBusy(true);
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  setBusy(false);

  if (error) {
    setMessage('E-mail ou senha incorretos, ou e-mail ainda não confirmado.', 'error');
    return;
  }

  const session = await syncSessionFromSupabase();
  await renderSession();
  await renderRanking();
  setMessage(`Investigador conectado: ${session?.nickname || 'Investigador'}.`, 'ok');
}

async function requestPasswordReset() {
  if (!supabaseClient) {
    setMessage('Supabase não carregou. Recarregue a página.', 'error');
    return;
  }

  const email = normalizeEmail(emailInput.value);
  if (!email) {
    setMessage('Digite seu e-mail para receber o link de recuperação.', 'error');
    emailInput?.focus();
    return;
  }

  setBusy(true);
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/?reset=1`,
  });
  setBusy(false);

  if (error) {
    setMessage(error.message || 'Não foi possível enviar o e-mail de recuperação.', 'error');
    return;
  }

  setMessage('Enviamos um link de recuperação para seu e-mail.', 'ok');
}

async function updateRecoveredPassword() {
  if (!supabaseClient) return;
  const password = passwordInput.value;

  if (password.length < 8) {
    setMessage('A nova senha precisa ter pelo menos 8 caracteres.', 'error');
    return;
  }

  setBusy(true);
  const { error } = await supabaseClient.auth.updateUser({ password });
  setBusy(false);

  if (error) {
    setMessage(error.message || 'Não foi possível alterar a senha.', 'error');
    return;
  }

  setMessage('Senha alterada. Você já pode continuar a investigação.', 'ok');
  setMode('login');
  await renderSession();
}

async function endSession() {
  if (supabaseClient) await supabaseClient.auth.signOut();
  clearSessionCache();
  await renderSession();
  await renderRanking();
  setMessage('Sessão encerrada.');
}

tabLogin?.addEventListener('click', () => setMode('login'));
tabRegister?.addEventListener('click', () => setMode('register'));
submitRegister?.addEventListener('click', async () => {
  setMode('register');
  await registerUser();
});
googleLogin?.addEventListener('click', loginWithGoogle);
forgotPassword?.addEventListener('click', requestPasswordReset);

authForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (currentMode === 'register') {
    await registerUser();
  } else if (currentMode === 'reset') {
    await updateRecoveredPassword();
  } else {
    await loginUser();
  }
});

showPass?.addEventListener('click', () => {
  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';
  showPass.classList.toggle('is-visible', isPassword);
  showPass.setAttribute('aria-label', isPassword ? 'Ocultar senha' : 'Mostrar senha');
});

logoutBtn?.addEventListener('click', endSession);
navLogout?.addEventListener('click', endSession);
themeToggle?.addEventListener('click', toggleTheme);

if (supabaseClient) {
  supabaseClient.auth.onAuthStateChange(async (event) => {
    if (event === 'PASSWORD_RECOVERY') {
      setMode('reset');
      setMessage('Digite sua nova senha para concluir a recuperação.', 'ok');
      passwordInput?.focus();
      return;
    }

    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'SIGNED_OUT') {
      await renderSession();
      await renderRanking();
    }
  });
}

setMode(new URLSearchParams(window.location.search).get('reset') === '1' ? 'reset' : 'login');
initTheme();
showIntroModal();
renderSession();
renderRanking();
animateCounters();
setInterval(animateCounters, 8000);
