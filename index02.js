document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'verificador-nomes-workspace-v1';
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
    checking: 'Consultando...',
    available: 'Livre',
    taken: 'Ocupado'
  };

  const INITIAL_CANDIDATES = [
    { id: 'candidate-glitchhub', name: 'glitchhub' },
    { id: 'candidate-voxelhub', name: 'voxelhub' },
    { id: 'candidate-pixelcombo', name: 'pixelcombo' }
  ];

  let state = readWorkspace();
  let emExecucao = false;

  // Seletores do DOM
  const candidateListEl = document.getElementById('candidate-list');
  const candidateCountEl = document.querySelector('[data-testid="text-candidate-count"]');
  const addFormEl = document.getElementById('add-candidate-form');
  const candidateInputEl = document.getElementById('candidate-names');
  const formErrorEl = document.querySelector('[data-testid="status-add-error"]');
  const platformGridEl = document.querySelector('.platform-grid');
  const platformCountEl = document.querySelector('[data-testid="text-platform-count"]');
  const activeHeadingEl = document.getElementById('platform-heading');
  const resultsContainerEl = document.getElementById('results-container');
  const storageStatusEl = document.getElementById('storage-status-text');

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

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
      console.warn('Erro ao ler LocalStorage', e);
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
      if (storageStatusEl) storageStatusEl.textContent = 'Armazenamento local indisponível';
    }
  }

  function getStatusKey(candidateId, platformId) {
    return `${candidateId}::${platformId}`;
  }

  // --- REQUISIÇÕES ---

  async function testarRegistroBr(nome) {
    const apiUrl = `https://registro.br/v2/ajax/avail/raw/${encodeURIComponent(nome)}.com.br`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const resp = await fetch(CORS_PROXY + encodeURIComponent(apiUrl), { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!resp.ok) return 'unknown';
      const data = await resp.json();
      return data.status === 0 ? 'available' : 'taken';
    } catch {
      return 'unknown';
    }
  }

  async function testarRede(platform, nome) {
    if (platform.id === 'github') {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const resp = await fetch(platform.apiUrl(nome), { signal: controller.signal });
        clearTimeout(timeoutId);

        if (resp.status === 404) return 'available';
        if (resp.status === 200) return 'taken';
        return 'unknown';
      } catch {
        return 'unknown';
      }
    }

    const targetUrl = platform.url(nome);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);
      const resp = await fetch(CORS_PROXY + encodeURIComponent(targetUrl), { signal: controller.signal });
      clearTimeout(timeoutId);

      if (resp.status === 404) return 'available';
      if (resp.status === 200) return 'taken';
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  // Atualiza apenas a pílula do item no DOM sem recriar toda a página
  function atualizarStatusVisual(candidateId, platformId, status) {
    const badge = document.querySelector(`[data-status-badge="${candidateId}-${platformId}"]`);
    if (badge) {
      badge.className = `status-option ${status}`;
      badge.textContent = STATUS_LABELS[status] || status;
    }
  }

  // Checa 1 item individual
  async function verificarItem(candidate, platform) {
    const key = getStatusKey(candidate.id, platform.id);
    state.statuses[key] = 'checking';
    atualizarStatusVisual(candidate.id, platform.id, 'checking');

    let resultado = 'unknown';
    if (platform.isDomain) {
      resultado = await testarRegistroBr(candidate.name);
    } else {
      resultado = await testarRede(platform, candidate.name);
    }

    state.statuses[key] = resultado;
    atualizarStatusVisual(candidate.id, platform.id, resultado);
    saveWorkspace();
  }

  // Fila sequencial: 1 por 1 com intervalo para não tomar bloqueio
  async function verificarFilaSequencial() {
    if (emExecucao) return;
    emExecucao = true;

    const btnExecutar = document.getElementById('btn-executar-todos');
    if (btnExecutar) {
      btnExecutar.disabled = true;
      btnExecutar.textContent = '⏳ Analisando lista...';
    }

    const activePlatformId = state.selectedPlatforms[0];
    const platform = PLATFORMS.find((p) => p.id === activePlatformId) || PLATFORMS[0];

    for (const candidate of state.candidates) {
      await verificarItem(candidate, platform);
      await sleep(400); // Pausa estratégica para respeitar limites de requisição
    }

    if (btnExecutar) {
      btnExecutar.disabled = false;
      btnExecutar.textContent = '⚡ Verificar toda a lista';
    }
    emExecucao = false;
  }

  // --- RENDERIZAÇÃO ---

  function renderCandidates() {
    candidateCountEl.textContent = state.candidates.length.toString().padStart(2, '0');
    candidateListEl.innerHTML = '';

    if (!state.candidates.length) {
      candidateListEl.innerHTML = `
        <li class="empty-state" style="padding: 18px 10px;">
          <p style="font-size: 0.8rem; color: var(--text-subtle);">Nenhum nome adicionado</p>
        </li>
      `;
      return;
    }

    state.candidates.forEach((candidate) => {
      const li = document.createElement('li');
      li.className = 'candidate-chip';
      li.innerHTML = `
        <code>${escapeHtml(candidate.name)}</code>
        <button class="remove-button" type="button" aria-label="Remover ${escapeHtml(candidate.name)}" title="Remover">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      `;
      li.querySelector('.remove-button').addEventListener('click', () => {
        removeCandidate(candidate.id);
      });
      candidateListEl.appendChild(li);
    });
  }

  function renderPlatformsGrid() {
    platformGridEl.innerHTML = '';
    const activeId = state.selectedPlatforms[0] || 'registrobr';

    PLATFORMS.forEach((p) => {
      const isSelected = p.id === activeId;
      const btn = document.createElement('button');
      btn.className = 'platform-button';
      btn.type = 'button';
      btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
      btn.innerHTML = `<span class="platform-dot" aria-hidden="true"></span>${escapeHtml(p.name)}`;

      btn.addEventListener('click', () => {
        if (emExecucao) return;
        state.selectedPlatforms = [p.id];
        saveWorkspace();
        renderPlatformsGrid();
        renderResults();
        verificarFilaSequencial();
      });

      platformGridEl.appendChild(btn);
    });

    platformCountEl.textContent = '1 ativa';
  }

  function renderResults() {
    resultsContainerEl.innerHTML = '';
    const activePlatformId = state.selectedPlatforms[0] || 'registrobr';
    const activePlatform = PLATFORMS.find((p) => p.id === activePlatformId) || PLATFORMS[0];

    if (activeHeadingEl) {
      activeHeadingEl.textContent = activePlatform.name;
    }

    if (!state.candidates.length) {
      resultsContainerEl.innerHTML = `
        <div class="empty-state">
          <h3>Sua lista está vazia</h3>
          <p>Adicione um ou mais nomes ao lado para verificar.</p>
        </div>
      `;
      return;
    }

    state.candidates.forEach((candidate, index) => {
      const url = activePlatform.url(candidate.name);
      const statusKey = getStatusKey(candidate.id, activePlatform.id);
      const currentStatus = state.statuses[statusKey] || 'unknown';

      const article = document.createElement('article');
      article.className = 'result-row';
      article.style.animationDelay = `${index * 30}ms`;

      article.innerHTML = `
        <div class="result-name">
          <code>${escapeHtml(candidate.name)}</code>
          <a class="profile-url" href="${url}" target="_blank" rel="noopener noreferrer">
            ${escapeHtml(url.replace(/^https:\/\//, ''))}
          </a>
        </div>
        <div class="result-status">
          <div class="status-label">Resultado</div>
          <div class="status-control">
            <span class="status-option ${currentStatus}" data-status-badge="${candidate.id}-${activePlatform.id}">
              ${STATUS_LABELS[currentStatus] || currentStatus}
            </span>
            <button class="status-option check-btn" type="button" title="Consultar apenas este nome">
              🔄
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

      article.querySelector('.check-btn').addEventListener('click', () => {
        if (!emExecucao) {
          verificarItem(candidate, activePlatform);
        }
      });

      resultsContainerEl.appendChild(article);
    });
  }

  // --- FORMULÁRIO ---

  addFormEl.addEventListener('submit', async (e) => {
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
      formErrorEl.textContent = 'Nenhum nome novo informado.';
      formErrorEl.style.display = 'block';
      return;
    }

    formErrorEl.style.display = 'none';
    state.candidates = [...state.candidates, ...added];
    candidateInputEl.value = '';

    saveWorkspace();
    renderCandidates();
    renderResults();

    // Dispara a checagem sequencial automática
    verificarFilaSequencial();
  });

  function removeCandidate(id) {
    if (emExecucao) return;
    state.candidates = state.candidates.filter((c) => c.id !== id);
    saveWorkspace();
    renderCandidates();
    renderResults();
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[m]));
  }

  // Vincula o botão de disparo manual
  const btnExecutar = document.getElementById('btn-executar-todos');
  if (btnExecutar) {
    btnExecutar.addEventListener('click', () => {
      verificarFilaSequencial();
    });
  }

  // Inicialização
  renderCandidates();
  renderPlatformsGrid();
  renderResults();
  
  // Roda uma verificação inicial da lista carregada
  verificarFilaSequencial();
});
