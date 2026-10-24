document.addEventListener('DOMContentLoaded', () => {
  const addFormEl = document.getElementById('add-candidate-form');
  const candidateInputEl = document.getElementById('candidate-names');
  const resultsContainerEl = document.getElementById('results-container');
  const activeHeadingEl = document.getElementById('platform-heading');

  if (activeHeadingEl) {
    activeHeadingEl.textContent = "Verificação Conectada ao Python";
  }

  addFormEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const raw = candidateInputEl.value;
    const nomes = raw.split(/[\n,]+/).map(n => n.trim().replace(/^@/, '')).filter(Boolean);

    if (!nomes.length) return;

    candidateInputEl.value = '';

    for (const nome of nomes) {
      // Cria o card na tela com status de carregamento
      const card = document.createElement('div');
      card.className = 'result-row';
      card.id = `card-${nome}`;
      card.innerHTML = `
        <div class="result-name">
          <code>${nome}</code>
          <span style="font-size: 0.8rem; color: #8b94a5;">Consultando via Python...</span>
        </div>
        <div class="result-status">
          <span class="status-option checking">⏳ Verificando no backend...</span>
        </div>
      `;
      resultsContainerEl.prepend(card);

      try {
        // Chama o servidor Python local!
        const resposta = await fetch(`http://127.0.0.1:5000/verificar?nome=${encodeURIComponent(nome)}`);
        const dados = await resposta.json();
        
        // Exibe o resultado na tela
        const statusComBr = dados.resultados["Domínio .com.br"];
        const labelStatus = statusComBr === 'available' ? 'LIVRE (.com.br)' : 'OCUPADO (.com.br)';
        const classeStatus = statusComBr === 'available' ? 'available' : 'taken';

        card.innerHTML = `
          <div class="result-name">
            <code>${dados.nome}</code>
            <div style="font-size: 0.75rem; color: #8b94a5; margin-top: 4px;">
              GitHub: <strong>${dados.resultados.GitHub}</strong> | 
              YouTube: <strong>${dados.resultados.YouTube}</strong> | 
              Reddit: <strong>${dados.resultados.Reddit}</strong>
            </div>
          </div>
          <div class="result-status">
            <span class="status-option ${classeStatus}">${labelStatus}</span>
          </div>
          <div class="result-action">
            <a class="open-profile" href="https://${dados.nome}.com.br" target="_blank">Visitar</a>
          </div>
        `;
      } catch (err) {
        card.querySelector('.result-status').innerHTML = `
          <span class="status-option taken">⛔ Inicie o Python: python3 server.py</span>
        `;
      }
    }
  });
});