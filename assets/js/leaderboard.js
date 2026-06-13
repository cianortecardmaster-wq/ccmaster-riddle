(function () {
  const supabaseClient = window.CCMasterSupabase?.client || null;
  const TOTAL_RIDDLES = Number(window.CCMasterSupabase?.totalRiddles || 100);

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function getPercent(solvedCount) {
    if (!TOTAL_RIDDLES) return 0;
    return Math.max(0, Math.min(100, Math.round((toNumber(solvedCount) / TOTAL_RIDDLES) * 100)));
  }

  function formatDate(value) {
    if (!value) return 'Ainda não avançou';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Ainda não avançou';
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function normalizeEntry(entry, index) {
    const solvedCount = toNumber(entry.solved_count ?? entry.solvedCount);
    const hintsUsed = toNumber(entry.total_hints_used ?? entry.hints_used ?? entry.hintsUsed);

    return {
      position: index + 1,
      userId: entry.user_id || entry.id || '',
      nickname: String(entry.nickname || entry.apelido || 'Investigador'),
      solvedCount,
      hintsUsed,
      lastSolvedAt: entry.last_solved_at || entry.lastSolvedAt || null,
      percent: getPercent(solvedCount),
    };
  }

  async function fetchLeaderboard() {
    if (!supabaseClient) {
      throw new Error('Supabase não carregou. Recarregue a página.');
    }

    const { data, error } = await supabaseClient.rpc('get_public_leaderboard');

    if (error) {
      throw error;
    }

    return (Array.isArray(data) ? data : [])
      .map(normalizeEntry)
      .sort((a, b) => {
        if (b.solvedCount !== a.solvedCount) return b.solvedCount - a.solvedCount;
        if (a.hintsUsed !== b.hintsUsed) return a.hintsUsed - b.hintsUsed;
        const aTime = a.lastSolvedAt ? new Date(a.lastSolvedAt).getTime() : Number.POSITIVE_INFINITY;
        const bTime = b.lastSolvedAt ? new Date(b.lastSolvedAt).getTime() : Number.POSITIVE_INFINITY;
        if (aTime !== bTime) return aTime - bTime;
        return a.nickname.localeCompare(b.nickname, 'pt-BR');
      })
      .map((entry, index) => ({ ...entry, position: index + 1 }));
  }

  function renderTopElement(element, ranking) {
    const limit = Number(element.dataset.limit || 3);
    const emptyText = element.dataset.empty || 'Ainda não há investigadores no ranking.';
    const entries = ranking.slice(0, Math.max(1, limit));

    if (!entries.length) {
      element.innerHTML = `<p class="ranking-empty">${escapeHtml(emptyText)}</p>`;
      return;
    }

    element.innerHTML = `
      <ol class="leaderboard-list leaderboard-top-list">
        ${entries.map((entry) => `
          <li class="leaderboard-row leaderboard-row-${entry.position}">
            <span class="leaderboard-position">${entry.position}º</span>
            <span class="leaderboard-player">
              <strong>${escapeHtml(entry.nickname)}</strong>
              <small>${entry.solvedCount}/${TOTAL_RIDDLES} casos • ${entry.hintsUsed} dicas extras</small>
            </span>
            <span class="leaderboard-percent">${entry.percent}%</span>
          </li>
        `).join('')}
      </ol>
    `;
  }

  function renderFullElement(element, ranking) {
    const emptyText = element.dataset.empty || 'Ainda não há investigadores competindo.';

    if (!ranking.length) {
      element.innerHTML = `<p class="ranking-empty">${escapeHtml(emptyText)}</p>`;
      return;
    }

    element.innerHTML = `
      <div class="ranking-table-wrap leaderboard-full-wrap">
        <table class="ranking-table leaderboard-full-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Investigador</th>
              <th>Progresso</th>
              <th>%</th>
              <th>Dicas extras</th>
              <th>Último avanço</th>
            </tr>
          </thead>
          <tbody>
            ${ranking.map((entry) => `
              <tr>
                <td>${entry.position}º</td>
                <td>${escapeHtml(entry.nickname)}</td>
                <td>
                  <span class="leaderboard-progress-text">${entry.solvedCount}/${TOTAL_RIDDLES} casos</span>
                  <span class="leaderboard-progress-bar" style="--progress:${entry.percent}%"><i></i></span>
                </td>
                <td><strong>${entry.percent}%</strong></td>
                <td>${entry.hintsUsed}</td>
                <td>${escapeHtml(formatDate(entry.lastSolvedAt))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderLoading() {
    document.querySelectorAll('[data-leaderboard]').forEach((element) => {
      element.innerHTML = '<p class="ranking-empty">Carregando ranking...</p>';
    });
  }

  function renderError(error) {
    const message = error?.message || 'Não foi possível carregar o ranking agora.';
    document.querySelectorAll('[data-leaderboard]').forEach((element) => {
      element.innerHTML = `<p class="ranking-empty">${escapeHtml(message)}</p>`;
    });
  }

  async function renderAll() {
    const targets = Array.from(document.querySelectorAll('[data-leaderboard]'));
    if (!targets.length) return [];

    renderLoading();

    try {
      const ranking = await fetchLeaderboard();
      targets.forEach((element) => {
        if (element.dataset.leaderboard === 'full') {
          renderFullElement(element, ranking);
        } else {
          renderTopElement(element, ranking);
        }
      });
      return ranking;
    } catch (error) {
      renderError(error);
      return [];
    }
  }

  window.CCMasterLeaderboard = {
    fetchLeaderboard,
    renderAll,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderAll);
  } else {
    renderAll();
  }

  if (supabaseClient) {
    supabaseClient.auth.onAuthStateChange(() => {
      window.setTimeout(renderAll, 0);
    });
  }
})();
