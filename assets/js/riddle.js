const SESSION_KEY = 'ccmaster_riddle_session';
const TEMP_SESSION_KEY = 'ccmaster_riddle_session_temp';
const EXTRA_HINTS_KEY = 'ccmaster_riddle_extra_hints';
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
const toolsToggle = document.querySelector('#toolsToggle');
const toolsSheet = document.querySelector('#toolsSheet');
const infoBox = document.querySelector('#infoBox');
const infoBoxTitle = document.querySelector('#infoBoxTitle');
const infoBoxContent = document.querySelector('#infoBoxContent');
const infoButtons = Array.from(document.querySelectorAll('[data-info]'));
const actionButtons = Array.from(document.querySelectorAll('[data-action]'));
const hasBackImage = Boolean(backImage);

const state = {
  layerMode: 'normal',
  invert: false,
  mirror: false,
  rotate: 0,
  toolsOpen: false,
  activeInfo: null,
};

function getRiddleSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY)) || JSON.parse(sessionStorage.getItem(TEMP_SESSION_KEY));
  } catch {
    return null;
  }
}

function renderRiddleSession() {
  const session = getRiddleSession();
  const nickname = session?.nickname || 'Visitante';

  if (!session) {
    if (navUser) navUser.hidden = true;
    if (navLogout) navLogout.hidden = true;
    if (investigatorInline) investigatorInline.textContent = nickname;
    return;
  }

  if (navUser) {
    navUser.textContent = `Investigador: ${nickname}`;
    navUser.hidden = false;
  }

  if (investigatorInline) investigatorInline.textContent = nickname;
  if (navLogout) navLogout.hidden = false;
}

function endRiddleSession() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(TEMP_SESSION_KEY);
  renderRiddleSession();
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

function saveProgress(riddleNumber) {
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

function setToolsOpen(open) {
  state.toolsOpen = open;
  if (!toolsSheet || !toolsToggle) return;
  toolsSheet.classList.toggle('is-open', open);
  toolsToggle.classList.toggle('is-open', open);
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

function buildInfoContent(type) {
  if (type === 'metadata') {
    return {
      title: 'Metadados',
      html: `
        <p><strong>Imagem:</strong> ${escapeHtml(getMetaImageName())}</p>
        <p><strong>Título:</strong> ${escapeHtml(getMetaTitle())}</p>
        <p><strong>Descrição:</strong> ${escapeHtml(getMetaDescription())}</p>
      `,
    };
  }

  if (type === 'trail') {
    return {
      title: 'Rastro',
      html: `<p>${escapeHtml(window.location.pathname || '/')}</p>`,
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

function getHintStore() {
  try {
    return JSON.parse(localStorage.getItem(EXTRA_HINTS_KEY)) || {};
  } catch {
    return {};
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
  evidenceStack.style.transform = `rotate(${state.rotate}deg) scaleX(${state.mirror ? -1 : 1})`;
  evidenceStack.style.filter = state.invert ? 'invert(1)' : 'none';
  evidenceFrame?.setAttribute('data-layer-mode', state.layerMode);

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

answerForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const expectedHash = answerForm.dataset.answerHash;
  const normalized = normalizeAnswer(answerInput.value);
  const answerHash = await sha256(normalized);

  if (!expectedHash) {
    answerMessage.textContent = 'Este caso ainda não tem resposta configurada.';
    answerMessage.className = 'answer-message error';
    return;
  }

  if (answerHash === expectedHash) {
    const riddleNumber = document.body.dataset.riddle;
    saveProgress(riddleNumber);
    answerMessage.textContent = 'Resposta aceita. Caso registrado no seu progresso.';
    answerMessage.className = 'answer-message ok';
    nextCaseLink.classList.remove('hidden');
  } else {
    answerMessage.textContent = 'Resposta recusada. Observe de novo.';
    answerMessage.className = 'answer-message error';
  }
});

renderRiddleSession();
renderInfoState();
applyImageState();
setToolsOpen(false);
