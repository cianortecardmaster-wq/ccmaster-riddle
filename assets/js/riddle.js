
const SESSION_KEY = 'ccmaster_riddle_session';
const TEMP_SESSION_KEY = 'ccmaster_riddle_session_temp';
const navUser = document.querySelector('#navUser');
const navLogout = document.querySelector('#navLogout');

function getRiddleSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY)) || JSON.parse(sessionStorage.getItem(TEMP_SESSION_KEY));
  } catch {
    return null;
  }
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

navLogout?.addEventListener('click', endRiddleSession);

const image = document.querySelector('#riddleImage');
const frame = document.querySelector('#evidenceFrame');
const themeToggle = document.querySelector('#themeToggle');
const themeTogglePanel = document.querySelector('#themeTogglePanel');
const answerForm = document.querySelector('#answerForm');
const answerInput = document.querySelector('#answerInput');
const answerMessage = document.querySelector('#answerMessage');
const nextCaseLink = document.querySelector('#nextCaseLink');
const opacityRange = document.querySelector('#opacityRange');

const state = {
  zoom: 1,
  brightness: 1,
  contrast: 1,
  invert: 0,
  mirror: 1,
  rotate: 0,
  opacity: 1,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function applyImageState() {
  if (!image) return;
  image.style.setProperty('--zoom', state.zoom.toFixed(2));
  image.style.setProperty('--brightness', state.brightness.toFixed(2));
  image.style.setProperty('--contrast', state.contrast.toFixed(2));
  image.style.setProperty('--invert', state.invert);
  image.style.setProperty('--mirror', state.mirror);
  image.style.setProperty('--rotate', `${state.rotate}deg`);
  image.style.setProperty('--opacity', state.opacity.toFixed(2));
  if (opacityRange) opacityRange.value = String(Math.round(state.opacity * 100));
}

function resetImage() {
  state.zoom = 1;
  state.brightness = 1;
  state.contrast = 1;
  state.invert = 0;
  state.mirror = 1;
  state.rotate = 0;
  state.opacity = 1;
  frame?.classList.remove('noise-on');
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

document.querySelectorAll('[data-action]').forEach((button) => {
  button.addEventListener('click', () => {
    const action = button.dataset.action;

    if (action === 'zoom-in') state.zoom = clamp(state.zoom + 0.15, 0.5, 3);
    if (action === 'zoom-out') state.zoom = clamp(state.zoom - 0.15, 0.5, 3);
    if (action === 'brightness-up') state.brightness = clamp(state.brightness + 0.15, 0.25, 3);
    if (action === 'brightness-down') state.brightness = clamp(state.brightness - 0.15, 0.25, 3);
    if (action === 'contrast-up') state.contrast = clamp(state.contrast + 0.2, 0.25, 4);
    if (action === 'contrast-down') state.contrast = clamp(state.contrast - 0.2, 0.25, 4);
    if (action === 'invert') state.invert = state.invert ? 0 : 1;
    if (action === 'mirror') state.mirror = state.mirror === 1 ? -1 : 1;
    if (action === 'rotate-left') state.rotate -= 90;
    if (action === 'rotate-right') state.rotate += 90;
    if (action === 'noise') frame?.classList.toggle('noise-on');
    if (action === 'reset') resetImage();

    applyImageState();
  });
});

opacityRange?.addEventListener('input', (event) => {
  state.opacity = clamp(Number(event.target.value) / 100, 0, 1);
  applyImageState();
});

themeToggle?.addEventListener('click', toggleTheme);
themeTogglePanel?.addEventListener('click', toggleTheme);

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

applyImageState();
