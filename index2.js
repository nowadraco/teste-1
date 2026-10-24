document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'verificador-nomes-workspace-v1';

  const PLATFORMS = [
    { id: 'youtube', name: 'YouTube', url: (h) => `https://www.youtube.com/@${encodeURIComponent(h)}` },
    { id: 'github', name: 'GitHub', url: (h) => `https://github.com/${encodeURIComponent(h)}` },
    { id: 'reddit', name: 'Reddit', url: (h) => `https://www.reddit.com/user/${encodeURIComponent(h)}` },
    { id: 'twitter', name: 'Twitter (X)', url: (h) => `https://x.com/${encodeURIComponent(h)}` },
    { id: 'pinterest', name: 'Pinterest', url: (h) => `https://www.pinterest.com/${encodeURIComponent(h)}/` },
    { id: 'tiktok', name: 'TikTok', url: (h) => `https://www.tiktok.com/@${encodeURIComponent(h)}` },
    { id: 'blogger', name: 'Blogger', url: (h) => `https://www.blogger.com/profile/${encodeURIComponent(h)}` },
    { id: 'wordpress', name: 'WordPress', url: (h) => `https://${encodeURIComponent(h)}.wordpress.com` },
    { id: 'tumblr', name: 'Tumblr', url: (h) => `https://${encodeURIComponent(h)}.tumblr.com` },
    { id: 'flickr', name: 'Flickr', url: (h) => `https://www.flickr.com/people/${encodeURIComponent(h)}/` }
  ];

  const STATUS_OPTIONS = [
    { value: 'unknown', label: 'A verificar' },
    { value: 'available', label: 'Livre' },
    { value: 'taken', label: 'Em uso' }
  ];

  const INITIAL_CANDIDATES = [
    { id: 'candidate-glitchhub', name: 'glitchhub' },
    { id: 'candidate-voxelhub', name: 'voxelhub' },
    { id: 'candidate-pixelcombo', name: 'pixelcombo' }
  ];

  // Estado da aplicação
  let state = readWorkspace();

  // Elementos do DOM
  const candidateListEl = document.getElementById('candidate-list');
  const candidateCountEl = document.querySelector('[data-testid="text-candidate-count"]');
  const addFormEl = document.getElementById('add-candidate-form');
  const candidateInputEl = document.getElementById('candidate-names');
  const formErrorEl = document.querySelector('[data-testid="status-add-error"]');
  const platformButtons = document.querySelectorAll('.platform-button');
  const platformCountEl = document.querySelector('[data-testid="text-platform-count"]');
  const activeHeadingEl = document.getElementById('platform-heading');
  const resultsContainerEl = document.getElementById('results-container');
  const storageStatusEl = document.getElementById('storage-status-text');

  // Leitura do LocalStorage
  function readWorkspace() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          candidates: Array.isArray(parsed.candidates) ? parsed.candidates : INITIAL_CANDIDATES,
          selectedPlatforms: Array.isArray(parsed.selectedPlatforms) && parsed.selectedPlatforms.length
            ? parsed.selectedPlatforms
            : ['youtube'],
          statuses: parsed.statuses && typeof parsed.statuses === 'object' ? parsed.statuses : {}
        };
      }
    } catch (e) {
      console.warn('Falha ao ler o LocalStorage:', e);
    }
    return {
      candidates: INITIAL_CANDIDATES,
      selectedPlatforms: ['youtube'],
      statuses: {}
    };
  }

  // Persistência no LocalStorage
  function saveWorkspace() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (storageStatusEl) storageStatusEl.textContent = 'Suas anotações ficam neste dispositivo';
    } catch (e) {
      if (storageStatusEl) storageStatusEl.textContent = 'Armazenamento local indisponível';
    }
  }

  function getStatusKey(candidateId, platformId) {
    return `${candidateId}::${platformId}`;
  }

  // Renderização da lista de candidatos na lateral
  function renderCandidates() {
    candidateCountEl.textContent = state.candidates.length.toString().padStart(2, '0');
    candidateListEl.innerHTML = '';

    if (state.candidates.length === 0) {
      candidateListEl.innerHTML = `
        <div class="empty-state" data-testid="empty-candidates" style="grid-column: 1/-1;">
          <div class="empty-mark">
            <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="4"></circle>
              <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"></path>
            </svg>
          </div>
          <h3>Sua lista está vazia</h3>
          <p>Adicione uma ideia para começar a comparar.</p>
        </div>
      `;
      return;
    }

    state.candidates.forEach((candidate) => {
      const li = document.createElement('li');
      li.className = 'candidate-chip';
      li.setAttribute('data-testid', `candidate-${candidate.id}`);

      li.innerHTML = `
        <code>${escapeHtml(candidate.name)}</code>
        <button class="remove-button" type="button" aria-label="Remover ${escapeHtml(candidate.name)}" title="Remover ${escapeHtml(candidate.name)}" data-testid="button-remove-${candidate.id}">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6 6 18"></path>
            <path d="m6 6 12 12"></path>
          </svg>
        </button>
      `;

      li.querySelector('.remove-button').addEventListener('click', () => {
        removeCandidate(candidate.id);
      });

      candidateListEl.appendChild(li);
    });
  }

  // Renderização da barra de plataformas
  function renderPlatformsBar() {
    const count = state.selectedPlatforms.length;
    platformCountEl.textContent = `${count} selecionada${count === 1 ? '' : 's'}`;

    platformButtons.forEach((btn) => {
      const platformId = btn.getAttribute('data-testid').replace('button-platform-', '');
      const isSelected = state.selectedPlatforms.includes(platformId);
      btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
      btn.setAttribute('aria-label', `${isSelected ? 'Remover' : 'Selecionar'} ${btn.textContent.trim()}`);
    });
  }

  // Renderização dos cards de resultados
  function renderResults() {
    resultsContainerEl.innerHTML = '';
    const activePlatformId = state.selectedPlatforms[0];
    const activePlatform = PLATFORMS.find((p) => p.id === activePlatformId);

    if (!activePlatform) {
      if (activeHeadingEl) activeHeadingEl.textContent = 'Nenhuma selecionada';
      resultsContainerEl.innerHTML = `
        <div class="empty-state" data-testid="empty-platform-selection">
          <div class="empty-mark">
            <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <path d="M12 17h.01"></path>
            </svg>
          </div>
          <h3>Escolha uma plataforma</h3>
          <p>Selecione uma opção acima para montar seus links de perfil.</p>
        </div>
      `;
      return;
    }

    if (activeHeadingEl) activeHeadingEl.textContent = activePlatform.name;

    if (state.candidates.length === 0) {
      resultsContainerEl.innerHTML = `
        <div class="empty-state" data-testid="empty-results">
          <div class="empty-mark">
            <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="4"></circle>
              <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"></path>
            </svg>
          </div>
          <h3>Adicione um nome para comparar</h3>
          <p>Seus perfis para ${activePlatform.name} vão aparecer aqui.</p>
        </div>
      `;
      return;
    }

    state.candidates.forEach((candidate, index) => {
      const url = activePlatform.url(candidate.name.trim().replace(/^@/, ''));
      const statusKey = getStatusKey(candidate.id, activePlatform.id);
      const currentStatus = state.statuses[statusKey] || 'unknown';

      const article = document.createElement('article');
      article.className = 'result-row';
      article.style.animationDelay = `${index * 45}ms`;
      article.setAttribute('data-testid', `result-${candidate.id}-${activePlatform.id}`);

      article.innerHTML = `
        <div class="result-name">
          <code>${escapeHtml(candidate.name)}</code>
          <a class="profile-url" href="${url}" target="_blank" rel="noopener noreferrer" data-testid="link-profile-url-${candidate.id}">
            ${escapeHtml(url.replace(/^https:\/\//, ''))}
          </a>
        </div>
        <div class="result-status">
          <div class="status-label">Sua anotação</div>
          <div class="status-control" role="group" aria-label="Resultado manual para ${escapeHtml(candidate.name)} em ${activePlatform.name}">
            ${STATUS_OPTIONS.map((opt) => `
              <button
                class="status-option ${opt.value}"
                type="button"
                aria-pressed="${currentStatus === opt.value ? 'true' : 'false'}"
                aria-label="${escapeHtml(candidate.name)}: marcar como ${opt.label}"
                data-testid="button-status-${candidate.id}-${activePlatform.id}-${opt.value}"
                data-status="${opt.value}"
              >
                ${opt.label}
              </button>
            `).join('')}
          </div>
        </div>
        <div class="result-action">
          <a class="open-profile" href="${url}" target="_blank" rel="noopener noreferrer" aria-label="Abrir perfil de ${escapeHtml(candidate.name)} no ${activePlatform.name} em nova aba" data-testid="link-open-profile-${candidate.id}">
            Abrir perfil
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M7 7h10v10"></path>
              <path d="M7 17 17 7"></path>
            </svg>
          </a>
        </div>
      `;

      // Evento para atualizar status manual
      article.querySelectorAll('.status-option').forEach((statusBtn) => {
        statusBtn.addEventListener('click', () => {
          const newStatus = statusBtn.getAttribute('data-status');
          state.statuses[statusKey] = newStatus;
          saveWorkspace();
          renderResults();
        });
      });

      resultsContainerEl.appendChild(article);
    });
  }

  // Adicionar nomes em massa ou individualmente
  addFormEl.addEventListener('submit', (e) => {
    e.preventDefault();
    const rawText = candidateInputEl.value;
    const names = rawText
      .split(/[\n,]+/)
      .map((n) => n.trim().replace(/^@/, ''))
      .filter(Boolean);

    const existingNames = new Set(state.candidates.map((c) => c.name.toLowerCase()));
    const additions = [];

    names.forEach((name) => {
      const normalized = name.toLowerCase();
      if (!existingNames.has(normalized)) {
        existingNames.add(normalized);
        additions.push({
          id: `candidate-${Date.now()}-${additions.length}-${normalized}`,
          name: name
        });
      }
    });

    if (additions.length === 0) {
      formErrorEl.textContent = names.length
        ? 'Esses nomes já estão na sua lista.'
        : 'Digite pelo menos um nome para adicionar.';
      formErrorEl.style.display = 'block';
      return;
    }

    formErrorEl.style.display = 'none';
    formErrorEl.textContent = '';
    state.candidates = [...state.candidates, ...additions];
    candidateInputEl.value = '';

    saveWorkspace();
    renderCandidates();
    renderResults();
  });

  // Limpar erro ao digitar
  candidateInputEl.addEventListener('input', () => {
    if (formErrorEl.style.display !== 'none') {
      formErrorEl.style.display = 'none';
      formErrorEl.textContent = '';
    }
  });

  // Remover candidato
  function removeCandidate(id) {
    state.candidates = state.candidates.filter((c) => c.id !== id);
    Object.keys(state.statuses).forEach((k) => {
      if (k.startsWith(`${id}::`)) delete state.statuses[k];
    });
    saveWorkspace();
    renderCandidates();
    renderResults();
  }

  // Alternar plataformas
  platformButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const platformId = btn.getAttribute('data-testid').replace('button-platform-', '');
      if (state.selectedPlatforms.includes(platformId)) {
        state.selectedPlatforms = state.selectedPlatforms.filter((id) => id !== platformId);
      } else {
        state.selectedPlatforms.push(platformId);
      }
      saveWorkspace();
      renderPlatformsBar();
      renderResults();
    });
  });

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Inicialização inicial
  renderCandidates();
  renderPlatformsBar();
  renderResults();
});