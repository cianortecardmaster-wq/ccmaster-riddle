(function () {
  const SESSION_KEY = 'ccmaster_riddle_session';
  const TEMP_SESSION_KEY = 'ccmaster_riddle_session_temp';
  const LOCAL_PROGRESS_KEY = 'ccmaster_riddle_progress';
  const TOTAL_RIDDLES = window.CCMasterSupabase?.totalRiddles || 100;
  const supabaseClient = window.CCMasterSupabase?.client || null;

  const grid = document.querySelector('#dossieGrid');
  const status = document.querySelector('#dossieStatus');
  const navUser = document.querySelector('#navUser');
  const navLogout = document.querySelector('#navLogout');
  const themeToggle = document.querySelector('#themeToggle');

  function padCase(id) {
    return String(id).padStart(3, '0');
  }

  function riddleUrl(id) {
    return `/riddles/${padCase(id)}/`;
  }

  function readCachedSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY)) || JSON.parse(sessionStorage.getItem(TEMP_SESSION_KEY));
    } catch {
      return null;
    }
  }

  function clearSessionCache() {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(TEMP_SESSION_KEY);
  }

  function readLocalSolved() {
    try {
      const raw = JSON.parse(localStorage.getItem(LOCAL_PROGRESS_KEY)) || [];
      return raw
        .map((item) => Number.parseInt(String(item).replace(/\D/g, ''), 10))
        .filter((item) => Number.isFinite(item) && item > 0);
    } catch {
      return [];
    }
  }

  async function readCloudSolved(userId) {
    if (!supabaseClient || !userId) return [];

    const { data, error } = await supabaseClient
      .from('progress')
      .select('riddle_id')
      .eq('user_id', userId)
      .eq('solved', true);

    if (error || !Array.isArray(data)) return [];
    return data
      .map((row) => Number(row.riddle_id))
      .filter((item) => Number.isFinite(item) && item > 0);
  }

  async function getActiveSession() {
    const cached = readCachedSession();

    if (!supabaseClient) return cached;

    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      const user = session?.user;

      if (!user) return cached;

      return {
        ...(cached || {}),
        id: user.id,
        email: user.email,
        nickname: cached?.nickname || user.user_metadata?.nickname || String(user.email || '').split('@')[0] || 'Investigador',
      };
    } catch {
      return cached;
    }
  }

  function renderNav(session) {
    if (!session) {
      if (navUser) navUser.hidden = true;
      if (navLogout) navLogout.hidden = true;
      return;
    }

    if (navUser) {
      navUser.textContent = `Investigador: ${session.nickname || 'Investigador'}`;
      navUser.hidden = false;
    }

    if (navLogout) navLogout.hidden = false;
  }

  function renderCases(solvedIds) {
    if (!grid) return;

    const solved = new Set(solvedIds);
    const highestSolved = solved.size ? Math.max(...solved) : 0;
    const visibleMax = Math.max(3, Math.min(TOTAL_RIDDLES, highestSolved + 1));

    grid.innerHTML = '';

    for (let id = 1; id <= visibleMax; id += 1) {
      const isSolved = solved.has(id);
      const caseNumber = padCase(id);
      const article = document.createElement('article');
      article.className = `dossie-case ${isSolved ? 'is-open' : 'is-locked'}`;

      if (isSolved) {
        article.innerHTML = `
          <p class="dossie-case-kicker">Caso #${caseNumber}</p>
          <h2>Arquivo ${caseNumber}</h2>
          <p class="dossie-case-status">Resolvido. O caso continua disponível para revisão.</p>
          <a class="dossie-case-action" href="${riddleUrl(id)}">Abrir</a>
        `;
      } else {
        article.innerHTML = `
          <p class="dossie-case-kicker">Caso #${caseNumber}</p>
          <h2>Arquivo ${caseNumber}</h2>
          <p class="dossie-case-status">Lacrado. Este arquivo só abre depois que o caso for solucionado.</p>
          <span class="dossie-case-locked">Lacrado</span>
        `;
      }

      grid.appendChild(article);
    }

    if (status) {
      const total = solved.size;
      status.textContent = total
        ? `${total} caso${total === 1 ? '' : 's'} resolvido${total === 1 ? '' : 's'} no seu dossiê.`
        : 'Nenhum caso resolvido encontrado neste navegador. Entre pela página inicial para sincronizar seu progresso.';
    }
  }

  async function init() {
    if (localStorage.getItem('ccmaster_theme') === 'light') {
      document.body.classList.add('light');
    }

    const session = await getActiveSession();
    renderNav(session);

    const localSolved = readLocalSolved();
    const cloudSolved = await readCloudSolved(session?.id);
    const solved = Array.from(new Set([...localSolved, ...cloudSolved])).sort((a, b) => a - b);

    renderCases(solved);
  }

  themeToggle?.addEventListener('click', () => {
    document.body.classList.toggle('light');
    localStorage.setItem('ccmaster_theme', document.body.classList.contains('light') ? 'light' : 'dark');
  });

  navLogout?.addEventListener('click', async () => {
    if (supabaseClient) await supabaseClient.auth.signOut();
    clearSessionCache();
    window.location.href = '/';
  });

  init();
})();
