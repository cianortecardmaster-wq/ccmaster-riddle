const STORAGE_KEY = 'ccmaster_riddle_users';
const SESSION_KEY = 'ccmaster_riddle_session';
const TEMP_SESSION_KEY = 'ccmaster_riddle_session_temp';
const EXTRA_HINTS_KEY = 'ccmaster_riddle_extra_hints';

const navUser = document.querySelector('#navUser');
const navLogout = document.querySelector('#navLogout');
const caseInvestigator = document.querySelector('#caseInvestigator');
const image = document.querySelector('#riddleImage');
const frame = document.querySelector('#evidenceFrame');
const themeToggle = document.querySelector('#themeToggle');
const answerForm = document.querySelector('#answerForm');
const answerInput = document.querySelector('#answerInput');
const answerMessage = document.querySelector('#answerMessage');
const nextCaseLink = document.querySelector('#nextCaseLink');
const toolsPanel = document.querySelector('#toolsPanel');
const metadataBtn = document.querySelector('#metadataBtn');
const trailBtn = document.querySelector('#trailBtn');
const extraHintBtn = document.querySelector('#extraHintBtn');
const caseInfoBox = document.querySelector('#caseInfoBox');
const caseInfoTitle = document.querySelector('#caseInfoTitle');
const caseInfoContent = document.querySelector('#caseInfoContent');
const caseInfoClose = document.querySelector('#caseInfoClose');

const state = {
  revealed: false,
  blend: 'normal',
  invert: false,
  mirror: 1,
  rotate: 0,
  toolsOpen: false,
};

function getRiddleSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY)) || JSON.parse(sessionStorage.getItem(TEMP_SESSION_KEY));
  } catch {
    return null;
  }
}

function setStoredSession(session) {
  if (localStorage.getItem(SESSION_KEY)) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else if (sessionStorage.getItem(TEMP_SESSION_KEY)) {
    sessionStorage.setItem(TEMP_SESSION_KEY, JSON.stringify(session));
  }
}

function renderRiddleSession() {
  const session = getRiddleSession();
  const label = session?.nickname ? `Investigador: ${session.nickname}` : 'Investigador: visitante';

  if (caseInvestigator) caseInvestigator.textContent = label;

  if (!session) {
    if (navUser) navUser.hidden = true;
    if (navLogout) navLogout.hidden = true;
    return;
  }

  if (navUser) {
    navUser.textContent = label;
    navUser.hidden = false;
  }

  if (navLogout) navLogout.hidden = false;
}

function endRiddleSession() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(TEMP_SESSION_KEY);
  renderRiddleSession();
}

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

function saveExtraHints(hints) {
  localStorage.setItem(EXTRA_HINTS_KEY, JSON.stringify(hints));
}

function currentRiddleNumber() {
  return document.body.dataset.riddle || '000';
}

function currentHintId() {
  return extraHintBtn?.dataset.extraId || `riddle-${currentRiddleNumber()}-extra`;
}

function sessionIdentity() {
  const session = getRiddleSession();
  return {
    userId: session?.id || 'visitante-local',
    nickname: session?.nickname || 'Visitante',
  };
}

function currentUserHintsForRiddle(riddleNumber = currentRiddleNumber()) {
  const { userId } = sessionIdentity();
  return getExtraHints().filter((hint) => hint.userId === userId && hint.riddleNumber === riddleNumber);
}

function hasUsedCurrentExtraHint() {
  const { userId } = sessionIdentity();
  const riddleNumber = currentRiddleNumber();
  const hintId = currentHintId();
  return getExtraHints().some((hint) => hint.userId === userId && hint.riddleNumber === riddleNumber && hint.hintId === hintId);
}

function markExtraButtonState() {
  if (!extraHintBtn) return;
  const used = hasUsedCurrentExtraHint();
  extraHintBtn.classList.toggle('used', used);
  extraHintBtn.textContent = used ? 'Extra ✓' : 'Extra';
}

function saveCurrentExtraHint() {
  if (!extraHintBtn) return;

  const { userId, nickname } = sessionIdentity();
  const riddleNumber = currentRiddleNumber();
  const hintId = currentHintId();
  const hints = getExtraHints();
  const alreadySaved = hints.some((hint) => hint.userId === userId && hint.riddleNumber === riddleNumber && hint.hintId === hintId);

  if (!alreadySaved) {
    hints.push({
      userId,
      nickname,
      riddleNumber,
      hintId,
      hintTitle: extraHintBtn.dataset.extraTitle || 'Extra',
      caseTitle: document.querySelector('#riddle-title')?.textContent?.trim() || `Caso ${riddleNumber}`,
      path: window.location.pathname,
      usedAt: new Date().toISOString(),
    });
    saveExtraHints(hints);
  }

  markExtraButtonState();
}

function updateActiveToolButtons() {
  document.querySelectorAll('[data-action]').forEach((button) => {
    const action = button.dataset.action;
    const active =
      (action === 'reveal' && state.revealed) ||
      (action === 'fuse' && state.blend === 'fuse') ||
      (action === 'isolate' && state.blend === 'isolate') ||
      (action === 'negative' && state.invert) ||
      (action === 'mirror' && state.mirror === -1);

    button.classList.toggle('active', active);
  });
}

function applyImageState() {
  if (!frame) return;

  const frontOpacity = state.revealed ? 0 : state.blend === 'normal' ? 1 : 0.74;

  frame.style.setProperty('--front-opacity', String(frontOpacity));
  frame.style.setProperty('--invert', state.invert ? '1' : '0');
  frame.style.setProperty('--mirror', String(state.mirror));
  frame.style.setProperty('--rotate', `${state.rotate}deg`);

  frame.classList.toggle('mode-fuse', state.blend === 'fuse');
  frame.classList.toggle('mode-isolate', state.blend === 'isolate');
  frame.classList.toggle('mode-revealed', state.revealed);

  updateActiveToolButtons();
}

function resetImage() {
  state.revealed = false;
  state.blend = 'normal';
  state.invert = false;
  state.mirror = 1;
  state.rotate = 0;
  applyImageState();
}

function setToolsOpen(open) {
  state.toolsOpen = Boolean(open);
  toolsPanel?.classList.toggle('open', state.toolsOpen);
  document.body.classList.toggle('tools-open', state.toolsOpen);
  document.querySelectorAll('[data-tools-toggle]').forEach((button) => {
    button.setAttribute('aria-expanded', String(state.toolsOpen));
    button.textContent = state.toolsOpen ? 'Ferramentas ▲' : 'Ferramentas';
  });
}

function setInfoContent(title, rows) {
  if (!caseInfoBox || !caseInfoTitle || !caseInfoContent) return;

  caseInfoTitle.textContent = title;
  caseInfoContent.replaceChildren();

  rows.forEach((row) => {
    const item = document.createElement(row.label ? 'p' : 'div');
    item.className = row.label ? 'case-info-row' : 'case-info-message';

    if (row.label) {
      const strong = document.createElement('strong');
      strong.textContent = `${row.label}: `;
      const span = document.createElement('span');
      span.textContent = row.value || '—';
      item.append(strong, span);
    } else {
      item.textContent = row.value || '';
    }

    caseInfoContent.append(item);
  });

  caseInfoBox.hidden = false;
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

function nextRiddleNumberFromHref(href) {
  const match = String(href || '').match(/\/riddles\/(\d+)\/?/);
  return match ? Number(match[1]) : null;
}

function saveProgress(riddleNumber) {
  const key = 'ccmaster_riddle_progress';
  let progress = [];
  try {
    progress = JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    progress = [];
  }

  if (!progress.includes(riddleNumber)) progress.push(riddleNumber);
  localStorage.setItem(key, JSON.stringify(progress));

  const session = getRiddleSession();
  if (!session?.id) return;

  const users = getUsers();
  const user = users.find((candidate) => candidate.id === session.id);
  if (!user) return;

  const usedHints = currentUserHintsForRiddle(riddleNumber);
  user.progress = user.progress || { currentRiddle: 1, solved: [] };
  const solved = Array.isArray(user.progress.solved) ? user.progress.solved : [];
  let entry = solved.find((item) => (typeof item === 'string' ? item === riddleNumber : item.riddleNumber === riddleNumber));

  if (!entry || typeof entry === 'string') {
    entry = {
      riddleNumber,
      solvedAt: new Date().toISOString(),
      extraHints: [],
    };
    user.progress.solved = solved.filter((item) => !(typeof item === 'string' && item === riddleNumber));
    user.progress.solved.push(entry);
  }

  entry.extraHints = usedHints.map((hint) => ({
    hintId: hint.hintId,
    hintTitle: hint.hintTitle,
    usedAt: hint.usedAt,
  }));
  entry.extraHintCount = entry.extraHints.length;
  entry.path = window.location.pathname;

  const next = nextRiddleNumberFromHref(answerForm?.dataset.next) || Number(riddleNumber) + 1;
  user.progress.currentRiddle = Math.max(Number(user.progress.currentRiddle || 1), next);
  user.progress.lastAccess = new Date().toISOString();
  saveUsers(users);

  session.currentRiddle = user.progress.currentRiddle;
  setStoredSession(session);
}

function toggleTheme() {
  const isLight = document.body.classList.toggle('light');
  if (themeToggle) themeToggle.textContent = isLight ? '☾' : '☼';
  localStorage.setItem('ccmaster_theme', isLight ? 'light' : 'dark');
}

navLogout?.addEventListener('click', endRiddleSession);
themeToggle?.addEventListener('click', toggleTheme);
caseInfoClose?.addEventListener('click', () => {
  if (caseInfoBox) caseInfoBox.hidden = true;
});

document.querySelectorAll('[data-tools-toggle]').forEach((button) => {
  button.addEventListener('click', () => setToolsOpen(!state.toolsOpen));
});

document.querySelectorAll('[data-action]').forEach((button) => {
  button.addEventListener('click', () => {
    const action = button.dataset.action;

    if (action === 'reveal') state.revealed = !state.revealed;
    if (action === 'fuse') state.blend = state.blend === 'fuse' ? 'normal' : 'fuse';
    if (action === 'isolate') state.blend = state.blend === 'isolate' ? 'normal' : 'isolate';
    if (action === 'negative') state.invert = !state.invert;
    if (action === 'mirror') state.mirror = state.mirror === 1 ? -1 : 1;
    if (action === 'rotate') state.rotate = (state.rotate + 90) % 360;
    if (action === 'reset') resetImage();

    applyImageState();
  });
});

metadataBtn?.addEventListener('click', () => {
  setInfoContent('Metadados da imagem', [
    { label: 'Imagem', value: metadataBtn.dataset.imageName },
    { label: 'Título', value: metadataBtn.dataset.imageTitle },
    { label: 'Descrição', value: metadataBtn.dataset.imageDescription },
  ]);
});

trailBtn?.addEventListener('click', () => {
  setInfoContent('Rastro', [
    { value: window.location.pathname || '/' },
  ]);
});

extraHintBtn?.addEventListener('click', () => {
  saveCurrentExtraHint();
  setInfoContent(extraHintBtn.dataset.extraTitle || 'Dica extra usada', [
    { value: extraHintBtn.dataset.extraText || 'Este caso ainda não tem dica extra configurada.' },
  ]);
});

if (localStorage.getItem('ccmaster_theme') === 'light') {
  document.body.classList.add('light');
  if (themeToggle) themeToggle.textContent = '☾';
}

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
    const riddleNumber = currentRiddleNumber();
    const usedHints = currentUserHintsForRiddle(riddleNumber);
    saveProgress(riddleNumber);
    answerMessage.textContent = usedHints.length
      ? `Resposta aceita. Registro salvo com ${usedHints.length} dica extra usada.`
      : 'Resposta aceita. Registro salvo sem dica extra.';
    answerMessage.className = 'answer-message ok';
    nextCaseLink?.classList.remove('hidden');
  } else {
    answerMessage.textContent = 'Resposta recusada. Observe de novo.';
    answerMessage.className = 'answer-message error';
  }
});

renderRiddleSession();
markExtraButtonState();
applyImageState();
