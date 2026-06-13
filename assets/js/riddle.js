const SESSION_KEY = 'ccmaster_riddle_session';
const TEMP_SESSION_KEY = 'ccmaster_riddle_session_temp';
const USERS_KEY = 'ccmaster_riddle_users';
const HINTS_KEY = 'ccmaster_riddle_hint_usage';
const RANKING_KEY = 'ccmaster_riddle_rankings';

const navUser = document.querySelector('#navUser');
const navLogout = document.querySelector('#navLogout');
const image = document.querySelector('#riddleImage');
const frame = document.querySelector('#evidenceFrame');
const themeToggle = document.querySelector('#themeToggle');
const answerForm = document.querySelector('#answerForm');
const answerInput = document.querySelector('#answerInput');
const answerMessage = document.querySelector('#answerMessage');
const nextCaseLink = document.querySelector('#nextCaseLink');
const toolsToggle = document.querySelector('#toolsToggle');
const imageTools = document.querySelector('#imageTools');
const metadataButton = document.querySelector('#metadataButton');
const trailButton = document.querySelector('#trailButton');
const extraButton = document.querySelector('#extraButton');
const infoDialog = document.querySelector('#infoDialog');
const infoDialogTitle = document.querySelector('#infoDialogTitle');
const infoDialogContent = document.querySelector('#infoDialogContent');
const infoDialogClose = document.querySelector('#infoDialogClose');

const riddleNumber = document.body.dataset.riddle || '000';
const startedKey = `ccmaster_riddle_started_${riddleNumber}`;

const state = {
  reveal: false,
  fuse: false,
  isolate: false,
  invert: false,
  mirror: false,
  rotate: 0,
};

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value) || fallback;
  } catch {
    return fallback;
  }
}

function getRiddleSession() {
  return safeJsonParse(localStorage.getItem(SESSION_KEY), null) || safeJsonParse(sessionStorage.getItem(TEMP_SESSION_KEY), null);
}

function getInvestigatorKey() {
  const session = getRiddleSession();
  if (session?.id) return session.id;
  if (session?.email) return session.email;
  return 'visitante-local';
}

function renderRiddleSession() {
  const session = getRiddleSession();

  if (!session) {
    if (navUser) navUser.hidden = true;
    if (navLogout) navLogout.hidden = true;
    return;
  }

  if (navUser) {
    navUser.textContent = `Investigador: ${session.nickname}`;
    navUser.hidden = false;
  }

  if (navLogout) navLogout.hidden = false;
}

function endRiddleSession() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(TEMP_SESSION_KEY);
  renderRiddleSession();
}

function setActiveButton(action, active) {
  document.querySelectorAll(`[data-action="${action}"]`).forEach((button) => {
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function applyImageState() {
  if (!image || !frame) return;

  frame.classList.toggle('mode-reveal', state.reveal);
  frame.classList.toggle('mode-fuse', state.fuse);
  frame.classList.toggle('mode-isolate', state.isolate);
  image.style.setProperty('--invert', state.invert ? 1 : 0);
  image.style.setProperty('--mirror', state.mirror ? -1 : 1);
  image.style.setProperty('--rotate', `${state.rotate}deg`);

  setActiveButton('reveal', state.reveal);
  setActiveButton('fuse', state.fuse);
  setActiveButton('isolate', state.isolate);
  setActiveButton('invert', state.invert);
  setActiveButton('mirror', state.mirror);
}

function resetImage() {
  state.reveal = false;
  state.fuse = false;
  state.isolate = false;
  state.invert = false;
  state.mirror = false;
  state.rotate = 0;
  applyImageState();
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

function getHintUsage() {
  return safeJsonParse(localStorage.getItem(HINTS_KEY), {});
}

function saveHintUsage(usage) {
  localStorage.setItem(HINTS_KEY, JSON.stringify(usage));
}

function getUsedExtrasForCurrentRiddle() {
  const usage = getHintUsage();
  const userKey = getInvestigatorKey();
  return usage[userKey]?.[riddleNumber] || [];
}

function markExtraAsUsed() {
  const extraText = document.body.dataset.extraText || '';
  if (!extraText.trim()) return [];

  const usage = getHintUsage();
  const userKey = getInvestigatorKey();
  const extraId = document.body.dataset.extraId || `extra-${riddleNumber}`;
  const extraLabel = document.body.dataset.extraLabel || 'Extra';

  usage[userKey] = usage[userKey] || {};
  usage[userKey][riddleNumber] = usage[userKey][riddleNumber] || [];

  const alreadyUsed = usage[userKey][riddleNumber].some((item) => item.id === extraId);
  if (!alreadyUsed) {
    usage[userKey][riddleNumber].push({
      id: extraId,
      label: extraLabel,
      usedAt: new Date().toISOString(),
    });
    saveHintUsage(usage);
  }

  renderExtraButtonState();
  return usage[userKey][riddleNumber];
}

function renderExtraButtonState() {
  if (!extraButton) return;
  const used = getUsedExtrasForCurrentRiddle();
  extraButton.classList.toggle('is-used', used.length > 0);
  extraButton.textContent = used.length > 0 ? `Extra ✓` : 'Extra';
}

function saveProgress(riddleNumberValue) {
  const key = 'ccmaster_riddle_progress';
  const progress = safeJsonParse(localStorage.getItem(key), []);
  if (!progress.includes(riddleNumberValue)) {
    progress.push(riddleNumberValue);
  }
  localStorage.setItem(key, JSON.stringify(progress));
}

function updateUserProgress(riddleNumberValue) {
  const session = getRiddleSession();
  if (!session?.id) return;

  const users = safeJsonParse(localStorage.getItem(USERS_KEY), []);
  const user = users.find((candidate) => candidate.id === session.id);
  if (!user) return;

  user.progress = user.progress || { currentRiddle: 1, solved: [] };
  user.progress.solved = Array.isArray(user.progress.solved) ? user.progress.solved : [];

  if (!user.progress.solved.includes(riddleNumberValue)) {
    user.progress.solved.push(riddleNumberValue);
  }

  const next = Number(riddleNumberValue) + 1;
  user.progress.currentRiddle = Math.max(Number(user.progress.currentRiddle || 1), next);
  user.progress.lastAccess = new Date().toISOString();

  localStorage.setItem(USERS_KEY, JSON.stringify(users));

  const updatedSession = { ...session, currentRiddle: user.progress.currentRiddle };
  if (localStorage.getItem(SESSION_KEY)) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(updatedSession));
  } else if (sessionStorage.getItem(TEMP_SESSION_KEY)) {
    sessionStorage.setItem(TEMP_SESSION_KEY, JSON.stringify(updatedSession));
  }
}

function saveRankingEntry(riddleNumberValue) {
  const session = getRiddleSession();
  const userKey = getInvestigatorKey();
  const nickname = session?.nickname || 'Investigador local';
  const ranking = safeJsonParse(localStorage.getItem(RANKING_KEY), []);
  const startedAt = localStorage.getItem(startedKey);
  const elapsedSeconds = startedAt ? Math.max(0, Math.round((Date.now() - Number(startedAt)) / 1000)) : null;
  const extras = getUsedExtrasForCurrentRiddle();

  const entryIndex = ranking.findIndex((item) => item.riddle === riddleNumberValue && item.userKey === userKey);
  const entry = {
    userKey,
    nickname,
    riddle: riddleNumberValue,
    solvedAt: new Date().toISOString(),
    elapsedSeconds,
    extraCount: extras.length,
    extras: extras.map((item) => item.label || item.id),
  };

  if (entryIndex >= 0) {
    const oldEntry = ranking[entryIndex];
    ranking[entryIndex] = {
      ...oldEntry,
      ...entry,
      elapsedSeconds: oldEntry.elapsedSeconds ?? entry.elapsedSeconds,
      solvedAt: oldEntry.solvedAt || entry.solvedAt,
    };
  } else {
    ranking.push(entry);
  }

  localStorage.setItem(RANKING_KEY, JSON.stringify(ranking));
}

function toggleTheme() {
  document.body.classList.toggle('light');
  localStorage.setItem('ccmaster_theme', document.body.classList.contains('light') ? 'light' : 'dark');
}

function openInfoDialog(title, html) {
  if (!infoDialog || !infoDialogTitle || !infoDialogContent) return;
  infoDialogTitle.textContent = title;
  infoDialogContent.innerHTML = html;

  if (typeof infoDialog.showModal === 'function') {
    infoDialog.showModal();
  } else {
    infoDialog.setAttribute('open', 'open');
  }
}

function closeInfoDialog() {
  if (!infoDialog) return;
  if (typeof infoDialog.close === 'function') {
    infoDialog.close();
  } else {
    infoDialog.removeAttribute('open');
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function metadataHtml() {
  const imageName = document.body.dataset.imageName || 'imagem.png';
  const imageTitle = document.body.dataset.imageTitle || 'Sem título';
  const imageDescription = document.body.dataset.imageDescription || 'Sem descrição.';

  return `
    <dl class="info-list">
      <div><dt>Imagem</dt><dd>${escapeHtml(imageName)}</dd></div>
      <div><dt>Título</dt><dd>${escapeHtml(imageTitle)}</dd></div>
      <div><dt>Descrição</dt><dd>${escapeHtml(imageDescription)}</dd></div>
    </dl>
  `;
}

function trailHtml() {
  return `<p class="mono-line">${escapeHtml(window.location.pathname || '/')}</p>`;
}

function extraHtml() {
  const extraText = document.body.dataset.extraText || '';
  if (!extraText.trim()) {
    return '<p>Nenhuma dica extra foi configurada para este caso.</p>';
  }

  const extras = markExtraAsUsed();
  const usedLabels = extras.map((item) => item.label || item.id).join(', ');

  return `
    <p>${escapeHtml(extraText)}</p>
    <p class="tool-note">Dica registrada para este investigador.</p>
    <p class="tool-note">Usadas neste caso: ${extras.length}${usedLabels ? ` — ${escapeHtml(usedLabels)}` : ''}</p>
  `;
}

document.querySelectorAll('[data-action]').forEach((button) => {
  button.addEventListener('click', () => {
    const action = button.dataset.action;

    if (action === 'reveal') state.reveal = !state.reveal;
    if (action === 'fuse') {
      state.fuse = !state.fuse;
      if (state.fuse) state.isolate = false;
    }
    if (action === 'isolate') {
      state.isolate = !state.isolate;
      if (state.isolate) state.fuse = false;
    }
    if (action === 'invert') state.invert = !state.invert;
    if (action === 'mirror') state.mirror = !state.mirror;
    if (action === 'rotate') state.rotate = (state.rotate + 90) % 360;
    if (action === 'reset') resetImage();

    applyImageState();
  });
});

toolsToggle?.addEventListener('click', () => {
  const isOpen = imageTools?.classList.toggle('open');
  toolsToggle.setAttribute('aria-expanded', String(Boolean(isOpen)));
});

metadataButton?.addEventListener('click', () => openInfoDialog('Metadados da imagem', metadataHtml()));
trailButton?.addEventListener('click', () => openInfoDialog('Rastro', trailHtml()));
extraButton?.addEventListener('click', () => openInfoDialog('Dica extra', extraHtml()));
infoDialogClose?.addEventListener('click', closeInfoDialog);
infoDialog?.addEventListener('click', (event) => {
  if (event.target === infoDialog) closeInfoDialog();
});
navLogout?.addEventListener('click', endRiddleSession);
themeToggle?.addEventListener('click', toggleTheme);

if (!localStorage.getItem(startedKey)) {
  localStorage.setItem(startedKey, String(Date.now()));
}

if (localStorage.getItem('ccmaster_theme') === 'light') {
  document.body.classList.add('light');
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
    const currentRiddle = document.body.dataset.riddle;
    saveProgress(currentRiddle);
    updateUserProgress(currentRiddle);
    saveRankingEntry(currentRiddle);
    answerMessage.textContent = 'Resposta aceita. Caso registrado no seu progresso.';
    answerMessage.className = 'answer-message ok';
    nextCaseLink?.classList.remove('hidden');
  } else {
    answerMessage.textContent = 'Resposta recusada. Observe de novo.';
    answerMessage.className = 'answer-message error';
  }
});

renderRiddleSession();
renderExtraButtonState();
applyImageState();
