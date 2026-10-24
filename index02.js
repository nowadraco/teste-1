document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'verificador-nomes-workspace-v1';

  // Usamos um proxy CORS para contornar o bloqueio nativo dos navegadores
  const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

  const PLATFORMS = [
    { 
      id: 'registrobr', 
      name: 'Domínio .com.br', 
      isDomain: true,
      url: (h) => `https://${encodeURIComponent(h)}.com.br` 
    },
    { 
      id: 'github', 
      name: 'GitHub', 
      apiUrl: (h) => `https://api.github.com/users/${encodeURIComponent(h)}`,
      url: (h) => `https://github.com/${encodeURIComponent(h)}` 
    },
    { 
      id: 'reddit', 
      name: 'Reddit', 
      url: (h) => `https://www.reddit.com/user/${encodeURIComponent(h)}` 
    },
    { 
      id: 'youtube', 
      name: 'YouTube', 
      url: (h) => `https://www.youtube.com/@${encodeURIComponent(h)}` 
    },
    { 
      id: 'tiktok', 
      name: 'TikTok', 
      url: (h) => `https://www.tiktok.com/@${encodeURIComponent(h)}` 
    },
    { 
      id: 'pinterest', 
      name: 'Pinterest', 
      url: (h) => `https://www.pinterest.com/${encodeURIComponent(h)}/` 
    },
    { 
      id: 'blogger', 
      name: 'Blogger', 
      url: (h) => `https://${encodeURIComponent(h)}.blogspot.com` 
    },
    { 
      id: 'wordpress', 
      name: 'WordPress', 
      url: (h) => `https://${encodeURIComponent(h)}.wordpress.com` 
    }
  ];

  const STATUS_LABELS = {
    unknown: 'A verificar',
    checking: 'Verificando...',
    available: 'Livre',
    taken: 'Ocupado'
  };

  const INITIAL_CANDIDATES = [
    { id: 'candidate-glitchhub', name: 'glitchhub' },
    { id: 'candidate-voxelhub', name: 'voxelhub' },
    { id: 'candidate-pixelcombo', name: 'pixelcombo' }
  ];

  let state = readWorkspace();

  // Seletores do DOM
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

  function readWorkspace() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          candidates: Array.isArray(parsed.candidates) ? parsed.candidates : INITIAL_CANDIDATES,
          selectedPlatforms: Array.isArray(parsed.selectedPlatforms) && parsed.selectedPlatforms.length
            ? parsed.selectedPlatforms
            : ['registrobr'],
          statuses: parsed.statuses && typeof parsed.statuses === 'object' ? parsed.statuses : {}
        };
      }
    } catch (e) {
      console.warn('Erro ao carregar localStorage', e);
    }
    return {
      candidates: INITIAL_CANDIDATES,
      selectedPlatforms: ['registrobr'],
      statuses: {}
    };
  }

  function saveWorkspace() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (storageStatusEl) storageStatusEl.textContent = 'Suas anotações ficam neste dispositivo';
    } catch {
      if (storageStatusEl) storageStatusEl.textContent = 'Armazenamento indisponível';
    }
  }

  function getStatusKey(candidateId, platformId) {
    return `${candidateId}::${platformId}`;
  }

  // --- MOTOR DE CHECAGEM AUTOMÁTICA (FETCH) ---

  // Checa disponibilidade no Registro.br
  async function testarRegistroBr(nome) {
    const apiUrl = `https://registro.br/v2/ajax/avail/raw/${encodeURIComponent(nome)}.com.br`;
    try {
      const resp = await fetch(CORS_PROXY + encodeURIComponent(apiUrl));
      if (!resp.ok) return 'unknown';
      const data = await resp.json();
      // status 0 = Disponível | 1 = Registrado | 2 = Em processo
      return data.status === 0 ? 'available' : 'taken';
    } catch {
      return 'unknown';
    }
  }

  // Checa disponibilidade em redes sociais
  async function testarRede(platform, nome) {
    if (platform.id === 'github') {
      try {
        const resp = await fetch(platform.apiUrl(nome));
        if (resp.status === 404) return 'available';
        if (resp.status === 200) return 'taken';
        return 'unknown';
      } catch {
        return 'unknown';
      }
    }

    // Para as demais redes usamos o proxy CORS
    const targetUrl = platform.url(nome);
    try {
      const resp = await fetch(CORS_PROXY + encodeURIComponent(targetUrl));
      if (resp.status === 404) return 'available';
      if (resp.status === 200) return 'taken';
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  // Executa o teste de um candidato em uma plataforma específica
  async function verificarAutomatico(candidate, platform) {
    const key = getStatusKey(candidate.id, platform.id);
    state.statuses[key] = 'checking';
    renderResults();

    let resultado = 'unknown';
    if (platform.isDomain) {
      resultado = await testarRegistroBr(candidate.name);
    } else {
      resultado = await testarRede(platform, candidate.name);
    }

    state.statuses[key] = resultado;
    saveWorkspace();
    renderResults();
  }

  // Dispara a checagem de todos os candidatos para a plataforma ativa
  async function verificarTodosAtivos() {
    const activePlatformId = state.selectedPlatforms[0];
    const platform = PLATFORMS.find((p) => p.id === activePlatformId);
    if (!platform) return;

    for (const candidate of state.candidates) {
      await verificarAutomatico(candidate, platform);
    }
  }

  // --- RENDERIZADORES ---

  function renderCandidates() {
    candidateCountEl.textContent = state.candidates.length.toString().padStart(2, '0');
    candidateListEl.innerHTML = '';

    if (!state.candidates.length) {
      candidateListEl.innerHTML = `<li class="empty-state">Lista vazia</li>`;
      return;
    }

    state.candidates.forEach((candidate) => {
      const li = document.createElement('li');
      li.className = 'candidate-chip';
      li.innerHTML = `
        <code>${escapeHtml(candidate.name)}</code>
        <button class="remove-button" type="button" aria-label="Remover">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      `;
      li.querySelector('.remove-button').addEventListener('click', () => {
        removeCandidate(candidate.id);
      });
      candidateListEl.appendChild(li);
    });
  }

  function renderPlatformsBar() {
    const count = state.selectedPlatforms.length;
    platformCountEl.textContent = `${count} selecionada${count === 1 ? '' : 's'}`;

    platformButtons.forEach((btn) => {
      const platformId = btn.getAttribute('data-testid')?.replace('button-platform-', '') || '';
      const isSelected = state.selectedPlatforms.includes(platformId);
      btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    });
  }

  function renderResults() {
    resultsContainerEl.innerHTML = '';
    const activePlatformId = state.selectedPlatforms[0];
    const activePlatform = PLATFORMS.find((p) => p.id === activePlatformId) || PLATFORMS[0];

    if (activeHeadingEl) {
      activeHeadingEl.textContent = activePlatform.name;
    }

    state.candidates.forEach((candidate, index) => {
      const url = activePlatform.url(candidate.name);
      const statusKey = getStatusKey(candidate.id, activePlatform.id);
      const currentStatus = state.statuses[statusKey] || 'unknown';

      const article = document.createElement('article');
      article.className = 'result-row';
      article.style.animationDelay = `${index * 40}ms`;

      article.innerHTML = `
        <div class="result-name">
          <code>${escapeHtml(candidate.name)}</code>
          <a class="profile-url" href="${url}" target="_blank" rel="noopener noreferrer">
            ${escapeHtml(url.replace(/^https:\/\//, ''))}
          </a>
        </div>
        <div class="result-status">
          <div class="status-label">Status Detectado</div>
          <div class="status-control">
            <span class="status-option ${currentStatus}">
              ${STATUS_LABELS[currentStatus] || 'A verificar'}
            </span>
            <button class="status-option check-btn" type="button" title="Consultar agora">
              🔄 Checar
            </button>
          </div>
        </div>
        <div class="result-action">
          <a class="open-profile" href="${url}" target="_blank" rel="noopener noreferrer">
            Abrir
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 7h10v10M7 17 17 7"/></svg>
          </a>
        </div>
      `;

      // Botão individual de checagem imediata
      article.querySelector('.check-btn').addEventListener('click', () => {
        verificarAutomatico(candidate, activePlatform);
      });

      resultsContainerEl.appendChild(article);
    });
  }

  // --- CONTROLES DE FORMULÁRIO ---

  addFormEl.addEventListener('submit', (e) => {
    e.preventDefault();
    const raw = candidateInputEl.value;
    const names = raw.split(/[\n,]+/).map((n) => n.trim().replace(/^@/, '')).filter(Boolean);

    const existing = new Set(state.candidates.map((c) => c.name.toLowerCase()));
    const added = [];

    names.forEach((name) => {
      const clean = name.toLowerCase();
      if (!existing.has(clean)) {
        existing.add(clean);
        added.push({ id: `c-${Date.now()}-${added.length}`, name });
      }
    });

    if (!added.length) {
      formErrorEl.textContent = 'Nome vazio ou já existente.';
      formErrorEl.style.display = 'block';
      return;
    }

    formErrorEl.style.display = 'none';
    state.candidates = [...state.candidates, ...added];
    candidateInputEl.value = '';

    saveWorkspace();
    renderCandidates();
    renderResults();

    // Auto-verifica os novos nomes adicionados para a plataforma ativa
    const activePlatform = PLATFORMS.find((p) => p.id === state.selectedPlatforms[0]);
    if (activePlatform) {
      added.forEach((candidate) => verificarAutomatico(candidate, activePlatform));
    }
  });

  function removeCandidate(id) {
    state.candidates = state.candidates.filter((c) => c.id !== id);
    saveWorkspace();
    renderCandidates();
    renderResults();
  }

  // Alterna a plataforma ativa e re-renderiza
  platformButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const platformId = btn.getAttribute('data-testid')?.replace('button-platform-', '');
      if (!platformId) return;
      state.selectedPlatforms = [platformId]; // Define como ativa
      saveWorkspace();
      renderPlatformsBar();
      renderResults();
      verificarTodosAtivos(); // Checa automaticamente a nova plataforma escolhida
    });
  });

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[m]));
  }

  // Inicialização
  renderCandidates();
  renderPlatformsBar();
  renderResults();
});