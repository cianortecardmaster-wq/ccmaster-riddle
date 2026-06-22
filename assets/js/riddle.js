const SESSION_KEY = 'ccmaster_riddle_session';
const TEMP_SESSION_KEY = 'ccmaster_riddle_session_temp';
const EXTRA_HINTS_KEY = 'ccmaster_riddle_extra_hints';
const TOTAL_RIDDLES = window.CCMasterSupabase?.totalRiddles || 100;
const supabaseClient = window.CCMasterSupabase?.client || null;

const navUser = document.querySelector('#navUser');
const navLogout = document.querySelector('#navLogout');
const investigatorInline = document.querySelector('#investigatorInline');
const themeToggle = document.querySelector('#themeToggle');
const answerForm = document.querySelector('#answerForm');
const answerInput = document.querySelector('#answerInput');
const answerMessage = document.querySelector('#answerMessage');
const nextCaseLink = document.querySelector('#nextCaseLink');
const frontImage = document.querySelector('#riddleImage');
const backImage = document.querySelector('#riddleImageBack');
const evidenceFrame = document.querySelector('#evidenceFrame');
const evidenceStack = document.querySelector('#evidenceStack');
const invertClueOverlay = document.querySelector('#invertClueOverlay');
const riddleHotspot = document.querySelector('#riddleHotspot');
const clickClue = document.querySelector('#clickClue');
const toolsToggle = document.querySelector('#toolsToggle');
const toolsSheet = document.querySelector('#toolsSheet');
let toolsClose = document.querySelector('#toolsClose');
const infoBox = document.querySelector('#infoBox');
const infoBoxTitle = document.querySelector('#infoBoxTitle');
const infoBoxContent = document.querySelector('#infoBoxContent');
const infoButtons = Array.from(document.querySelectorAll('[data-info]'));
const actionButtons = Array.from(document.querySelectorAll('[data-action]'));
const hasBackImage = Boolean(backImage);
const currentRiddleId = Number.parseInt(document.body.dataset.riddle || '0', 10);

function setNavUserLabel(element, nickname) {
  if (!element) return;

  element.textContent = '';

  const prefix = document.createElement('span');
  prefix.className = 'nav-user-prefix';
  prefix.textContent = 'Investigador:';

  const name = document.createElement('span');
  name.className = 'nav-user-name';
  name.textContent = nickname || 'Investigador';

  element.append(prefix, name);
}

function ensureToolsCloseButton() {
  if (!toolsSheet) return null;

  const header = toolsSheet.querySelector('.tools-sheet-header');
  if (!header) return null;

  const existing = toolsSheet.querySelector('#toolsClose');
  if (existing) return existing;

  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'toolsClose';
  button.className = 'tools-sheet-close';
  button.setAttribute('aria-label', 'Fechar ferramentas');
  button.title = 'Fechar ferramentas';
  button.textContent = '×';
  header.appendChild(button);
  return button;
}

toolsClose = ensureToolsCloseButton();

const state = {
  layerMode: 'normal',
  invert: false,
  mirror: false,
  rotate: 0,
  toolsOpen: false,
  activeInfo: null,
  session: null,
  clickClueVisible: false,
};

function readCachedSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY)) || JSON.parse(sessionStorage.getItem(TEMP_SESSION_KEY));
  } catch {
    return null;
  }
}

function saveSessionCache(sessionData) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
  sessionStorage.removeItem(TEMP_SESSION_KEY);
}

function clearSessionCache() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(TEMP_SESSION_KEY);
}

async function getProfile(user) {
  if (!supabaseClient || !user?.id) return null;

  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id, nickname')
    .eq('id', user.id)
    .maybeSingle();

  if (data && !error) return data;

  const fallbackNickname = user.user_metadata?.nickname || String(user.email || '').split('@')[0] || 'Investigador';
  const { data: created } = await supabaseClient
    .from('profiles')
    .upsert({ id: user.id, nickname: fallbackNickname }, { onConflict: 'id' })
    .select('id, nickname')
    .maybeSingle();

  return created || { id: user.id, nickname: fallbackNickname };
}

async function getSolvedStats(userId) {
  if (!supabaseClient || !userId) return { solvedCount: 0, currentRiddle: 1 };

  const { data } = await supabaseClient
    .from('progress')
    .select('riddle_id')
    .eq('user_id', userId)
    .eq('solved', true);

  const solvedIds = Array.isArray(data) ? data.map((row) => Number(row.riddle_id)).filter(Boolean) : [];
  const highestSolved = solvedIds.length ? Math.max(...solvedIds) : 0;

  return {
    solvedCount: solvedIds.length,
    currentRiddle: Math.min(highestSolved + 1, TOTAL_RIDDLES) || 1,
  };
}

async function syncSessionFromSupabase() {
  const cached = readCachedSession();
  if (cached) state.session = cached;

  if (!supabaseClient) {
    state.session = cached;
    return cached;
  }

  const { data: { session } } = await supabaseClient.auth.getSession();
  const user = session?.user;

  if (!user) {
    clearSessionCache();
    state.session = null;
    return null;
  }

  const profile = await getProfile(user);
  const stats = await getSolvedStats(user.id);
  const sessionData = {
    id: user.id,
    nickname: profile?.nickname || user.user_metadata?.nickname || 'Investigador',
    email: user.email,
    currentRiddle: stats.currentRiddle,
    solvedCount: stats.solvedCount,
  };

  saveSessionCache(sessionData);
  state.session = sessionData;
  return sessionData;
}

async function renderRiddleSession() {
  const session = await syncSessionFromSupabase();
  const nickname = session?.nickname || 'Visitante';

  if (!session) {
    if (navUser) navUser.hidden = true;
    if (navLogout) navLogout.hidden = true;
    if (investigatorInline) investigatorInline.textContent = nickname;
    return;
  }

  if (navUser) {
    setNavUserLabel(navUser, nickname);
    navUser.hidden = false;
  }

  if (investigatorInline) investigatorInline.textContent = nickname;
  if (navLogout) navLogout.hidden = false;
}

async function endRiddleSession() {
  if (supabaseClient) await supabaseClient.auth.signOut();
  clearSessionCache();
  state.session = null;
  await renderRiddleSession();
  if (answerMessage) {
    answerMessage.textContent = 'Sessão encerrada. Entre novamente pela página inicial.';
    answerMessage.className = 'answer-message';
  }
}

function normalizeAnswer(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function saveLocalProgress(riddleNumber) {
  const key = 'ccmaster_riddle_progress';
  let progress = [];

  try {
    progress = JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    progress = [];
  }

  if (!progress.includes(riddleNumber)) {
    progress.push(riddleNumber);
  }

  localStorage.setItem(key, JSON.stringify(progress));
}

function toggleTheme() {
  document.body.classList.toggle('light');
  localStorage.setItem('ccmaster_theme', document.body.classList.contains('light') ? 'light' : 'dark');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function describeSupabaseError(error, fallback) {
  if (!error) return fallback;

  const message = error.message || error.details || error.hint || '';
  return message ? `${fallback} Detalhe: ${message}` : fallback;
}

function setToolsOpen(open) {
  state.toolsOpen = open;
  if (!toolsSheet || !toolsToggle) return;

  toolsSheet.classList.toggle('is-open', open);
  toolsToggle.classList.toggle('is-open', open);
  toolsToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  toolsSheet.setAttribute('aria-hidden', open ? 'false' : 'true');
  document.body.classList.toggle('tools-sheet-open', open);
}

function getMetaDescription() {
  return document.body.dataset.metaDescription || 'Sem descrição cadastrada.';
}

function getMetaTitle() {
  return document.body.dataset.metaTitle || document.querySelector('#riddle-title')?.textContent?.trim() || 'Sem título';
}

function getMetaImageName() {
  return document.body.dataset.metaImage || frontImage?.getAttribute('src')?.split('/').pop() || 'imagem.png';
}

function getHintStore() {
  try {
    return JSON.parse(localStorage.getItem(EXTRA_HINTS_KEY)) || {};
  } catch {
    return {};
  }
}

function getCurrentHintCount() {
  const store = getHintStore();
  const current = Array.isArray(store[document.body.dataset.riddle || '000'])
    ? store[document.body.dataset.riddle || '000']
    : [];
  return current.length;
}

async function syncCloudHintUsage() {
  if (!supabaseClient || !state.session?.id || !currentRiddleId) return;

  const current = await getCurrentProgressRow(state.session.id);
  const hintsUsed = Math.max(Number(current?.hints_used || 0), getCurrentHintCount());
  const now = new Date().toISOString();

  try {
    await saveProgressRow(current, {
      user_id: state.session.id,
      riddle_id: currentRiddleId,
      solved: Boolean(current?.solved),
      solved_at: current?.solved_at || null,
      hints_used: hintsUsed,
      attempts_count: Number(current?.attempts_count || 0),
      updated_at: now,
    });

    window.CCMasterLeaderboard?.renderAll?.();
  } catch (error) {
    console.warn('Não foi possível sincronizar a dica extra no Supabase.', error);
  }
}

function markExtraHintAsUsed() {
  const riddleNumber = document.body.dataset.riddle || '000';
  const hint = (document.body.dataset.extraHint || '').trim();
  if (!hint) return;

  const store = getHintStore();
  const current = Array.isArray(store[riddleNumber]) ? store[riddleNumber] : [];

  if (!current.includes(hint)) {
    current.push(hint);
  }

  store[riddleNumber] = current;
  localStorage.setItem(EXTRA_HINTS_KEY, JSON.stringify(store));
  syncCloudHintUsage().catch(() => {});
}

function buildInfoContent(type) {
  if (type === 'metadata') {
    return {
      title: 'Investigar imagem',
      html: `
        <p><strong>Imagem:</strong> ${escapeHtml(getMetaImageName())}</p>
        <p><strong>Título:</strong> ${escapeHtml(getMetaTitle())}</p>
        <p><strong>Descrição:</strong> ${escapeHtml(getMetaDescription())}</p>
      `,
    };
  }

  if (type === 'trail') {
    const trailPath = document.body.dataset.trailPath || window.location.pathname || '/';
    return {
      title: 'Rastro',
      html: `<p>${escapeHtml(trailPath)}</p>`,
    };
  }

  if (type === 'extra') {
    const hint = (document.body.dataset.extraHint || '').trim();
    markExtraHintAsUsed();
    return {
      title: 'Extra',
      html: `<p>${escapeHtml(hint || 'Nenhuma dica extra foi cadastrada para este caso.')}</p>`,
    };
  }

  return { title: '', html: '' };
}

function renderInfoState() {
  infoButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.info === state.activeInfo);
  });
}

function toggleInfo(type) {
  if (!infoBox || !infoBoxTitle || !infoBoxContent) return;

  if (state.activeInfo === type) {
    state.activeInfo = null;
    infoBox.hidden = true;
    renderInfoState();
    return;
  }

  const content = buildInfoContent(type);
  state.activeInfo = type;
  infoBoxTitle.textContent = content.title;
  infoBoxContent.innerHTML = content.html;
  infoBox.hidden = false;
  renderInfoState();
}

function getRelationButtons() {
  return actionButtons.filter((button) => ['reveal', 'blend', 'isolate'].includes(button.dataset.action));
}

function syncActionButtons() {
  actionButtons.forEach((button) => {
    const action = button.dataset.action;
    let active = false;

    if (action === 'reveal') active = state.layerMode === 'reveal';
    if (action === 'blend') active = state.layerMode === 'blend';
    if (action === 'isolate') active = state.layerMode === 'isolate';
    if (action === 'invert') active = state.invert;
    if (action === 'mirror') active = state.mirror;

    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function applyImageState() {
  if (!frontImage || !evidenceStack) return;

  let frontOpacity = 1;
  let frontBlendMode = 'normal';

  if (state.layerMode === 'reveal' && hasBackImage) {
    frontOpacity = 0;
  }

  if (state.layerMode === 'blend' && hasBackImage) {
    frontOpacity = 0.96;
    frontBlendMode = 'multiply';
  }

  if (state.layerMode === 'isolate' && hasBackImage) {
    frontOpacity = 1;
    frontBlendMode = 'difference';
  }

  frontImage.style.opacity = String(frontOpacity);
  frontImage.style.mixBlendMode = frontBlendMode;

  const sharedTransform = `rotate(${state.rotate}deg) scaleX(${state.mirror ? -1 : 1})`;
  evidenceStack.style.transform = sharedTransform;
  evidenceStack.style.filter = state.invert ? 'invert(1)' : 'none';

  if (invertClueOverlay) {
    invertClueOverlay.style.transform = sharedTransform;
    invertClueOverlay.classList.toggle('is-visible', currentRiddleId === 3 && state.invert);
  }

  evidenceFrame?.classList.toggle('is-inverted', Boolean(state.invert));
  evidenceFrame?.setAttribute('data-layer-mode', state.layerMode);
  evidenceFrame?.classList.toggle('hotspot-ready', Boolean(riddleHotspot && ['blend', 'isolate'].includes(state.layerMode)));

  syncActionButtons();
}

function resetImageState() {
  state.layerMode = 'normal';
  state.invert = false;
  state.mirror = false;
  state.rotate = 0;
  applyImageState();
}

function toggleLayerMode(mode) {
  if (!hasBackImage) return;
  state.layerMode = state.layerMode === mode ? 'normal' : mode;
  applyImageState();
}

async function getCurrentProgressRow(userId) {
  if (!supabaseClient || !userId || !currentRiddleId) return null;

  const { data, error } = await supabaseClient
    .from('progress')
    .select('solved, solved_at, hints_used, attempts_count, updated_at')
    .eq('user_id', userId)
    .eq('riddle_id', currentRiddleId)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (error) {
    console.warn('Erro ao consultar progresso no Supabase.', error);
    return null;
  }

  return Array.isArray(data) ? (data[0] || null) : null;
}

async function saveProgressRow(current, payload) {
  const fields = 'solved, solved_at, hints_used, attempts_count, updated_at';

  if (current) {
    const { data, error } = await supabaseClient
      .from('progress')
      .update(payload)
      .eq('user_id', payload.user_id)
      .eq('riddle_id', payload.riddle_id)
      .select(fields);

    if (error) {
      throw new Error(describeSupabaseError(error, 'Não consegui atualizar seu progresso na nuvem.'));
    }

    return Array.isArray(data) ? (data[0] || null) : null;
  }

  const { data, error } = await supabaseClient
    .from('progress')
    .insert(payload)
    .select(fields);

  if (error) {
    throw new Error(describeSupabaseError(error, 'Não consegui salvar seu progresso na nuvem.'));
  }

  return Array.isArray(data) ? (data[0] || null) : null;
}

async function loadSolvedState() {
  const session = await syncSessionFromSupabase();
  if (!session || !supabaseClient || !currentRiddleId) return;

  const current = await getCurrentProgressRow(session.id);
  if (current?.solved) {
    if (answerMessage) {
      answerMessage.textContent = 'Este caso já foi registrado no seu progresso.';
      answerMessage.className = 'answer-message ok';
    }
    nextCaseLink?.classList.remove('hidden');
  }
}

async function registerCloudAttempt({ normalized, rawAnswer, isCorrect }) {
  const session = await syncSessionFromSupabase();

  if (!session || !supabaseClient) {
    throw new Error('Entre pela página inicial para registrar o progresso na nuvem.');
  }

  const current = await getCurrentProgressRow(session.id);
  const attemptsCount = Number(current?.attempts_count || 0) + 1;
  const hintsUsed = getCurrentHintCount();
  const now = new Date().toISOString();

  const { error: attemptError } = await supabaseClient.from('attempts').insert({
    user_id: session.id,
    riddle_id: currentRiddleId,
    answer_submitted: rawAnswer.slice(0, 180),
    correct: isCorrect,
  });

  if (attemptError) {
    console.warn('Tentativa não foi salva no histórico, mas o progresso ainda será registrado.', attemptError);
  }

  const wasAlreadySolved = Boolean(current?.solved);
  const payload = {
    user_id: session.id,
    riddle_id: currentRiddleId,
    solved: Boolean(isCorrect || wasAlreadySolved),
    solved_at: isCorrect ? (current?.solved_at || now) : (current?.solved_at || null),
    hints_used: Math.max(Number(current?.hints_used || 0), hintsUsed),
    attempts_count: attemptsCount,
    updated_at: now,
  };

  const savedProgress = await saveProgressRow(current, payload);

  if (isCorrect) {
    saveLocalProgress(document.body.dataset.riddle);
    const nextRiddle = Math.min(currentRiddleId + 1, TOTAL_RIDDLES);
    saveSessionCache({
      ...session,
      currentRiddle: nextRiddle,
      solvedCount: Number(session.solvedCount || 0) + (wasAlreadySolved ? 0 : 1),
    });
  }

  return { attemptsCount, normalized, savedProgress };
}


function revealClickClue() {
  if (!clickClue || !riddleHotspot) return;
  if (!['blend', 'isolate'].includes(state.layerMode)) return;

  const hint = (document.body.dataset.clickHint || '').trim();
  if (!hint) return;

  state.clickClueVisible = true;
  clickClue.textContent = hint;
  clickClue.hidden = false;
  clickClue.classList.add('is-visible');
}

riddleHotspot?.addEventListener('click', revealClickClue);

navLogout?.addEventListener('click', endRiddleSession);
themeToggle?.addEventListener('click', toggleTheme);

if (localStorage.getItem('ccmaster_theme') === 'light') {
  document.body.classList.add('light');
}

infoButtons.forEach((button) => {
  button.addEventListener('click', () => toggleInfo(button.dataset.info));
});

actionButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const action = button.dataset.action;

    if (action === 'reveal') toggleLayerMode('reveal');
    if (action === 'blend') toggleLayerMode('blend');
    if (action === 'isolate') toggleLayerMode('isolate');
    if (action === 'invert') {
      state.invert = !state.invert;
      applyImageState();
    }
    if (action === 'mirror') {
      state.mirror = !state.mirror;
      applyImageState();
    }
    if (action === 'rotate') {
      state.rotate = (state.rotate + 90) % 360;
      applyImageState();
    }
    if (action === 'reset') resetImageState();
  });
});

if (!hasBackImage) {
  getRelationButtons().forEach((button) => {
    button.disabled = true;
    button.title = 'Este caso não possui segunda camada.';
  });
}

toolsToggle?.addEventListener('click', () => {
  setToolsOpen(!state.toolsOpen);
});

toolsClose?.addEventListener('click', () => {
  setToolsOpen(false);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && state.toolsOpen) {
    setToolsOpen(false);
  }
});

setToolsOpen(false);

answerForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const expectedHash = answerForm.dataset.answerHash;
  const rawAnswer = answerInput.value.trim();
  const normalized = normalizeAnswer(rawAnswer);

  if (!expectedHash) {
    answerMessage.textContent = 'Este caso ainda não tem resposta configurada.';
    answerMessage.className = 'answer-message error';
    return;
  }

  if (!state.session) {
    await renderRiddleSession();
  }

  if (!state.session) {
    answerMessage.innerHTML = 'Entre pela <a href="/">Entrada</a> para registrar o progresso na nuvem.';
    answerMessage.className = 'answer-message error';
    return;
  }

  const answerHash = await sha256(normalized);
  const isCorrect = answerHash === expectedHash;

  try {
    await registerCloudAttempt({ normalized, rawAnswer, isCorrect });
  } catch (error) {
    answerMessage.textContent = error.message || 'Não foi possível registrar sua tentativa.';
    answerMessage.className = 'answer-message error';
    return;
  }

  if (isCorrect) {
    answerMessage.textContent = 'Resposta aceita. Progresso salvo na nuvem.';
    answerMessage.className = 'answer-message ok';
    nextCaseLink.classList.remove('hidden');
    await renderRiddleSession();
    await window.CCMasterLeaderboard?.renderAll?.();
  } else {
    answerMessage.textContent = 'Resposta recusada. Tentativa registrada.';
    answerMessage.className = 'answer-message error';
  }
});

if (supabaseClient) {
  supabaseClient.auth.onAuthStateChange(async () => {
    await renderRiddleSession();
    await loadSolvedState();
    await window.CCMasterLeaderboard?.renderAll?.();
  });
}

renderRiddleSession();
renderInfoState();
applyImageState();
setToolsOpen(false);
loadSolvedState();
window.CCMasterLeaderboard?.renderAll?.();
