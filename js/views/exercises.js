import { store } from '../store.js';

const EXO_STATUS = {
  todo: { label: 'Non fait', class: 'badge-todo' },
  failed: { label: 'À refaire', class: 'badge-review' },
  partial: { label: 'Partiel', class: 'badge-progress' },
  success: { label: 'Réussi', class: 'badge-mastered' }
};

let filterDomain = 'all';
let filterDifficulty = 'all';
let filterStatus = 'all';
let activeExerciseId = null;

// Variables pour le chronomètre
let timerInterval = null;
let secondsElapsed = 0;
let isTimerRunning = false;

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  isTimerRunning = false;
}

function formatTimer(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function renderExercises(container, rerenderMath) {
  stopTimer();

  if (activeExerciseId) {
    renderExerciseDetail(container, activeExerciseId, rerenderMath);
    return;
  }

  const domainOptions = store.programme.domaines
    .map(d => `<option value="${d.id}" ${filterDomain === d.id ? 'selected' : ''}>${d.titre}</option>`)
    .join('');

  const filteredExos = store.exercices.filter(exo => {
    const progress = store.getExerciseProgress(exo.id);
    if (filterDomain !== 'all' && exo.domaineId !== filterDomain) return false;
    if (filterDifficulty !== 'all' && exo.difficulte !== Number(filterDifficulty)) return false;
    if (filterStatus !== 'all' && progress.dernierStatut !== filterStatus) return false;
    return true;
  });

  const listHTML = filteredExos.map(exo => {
    const progress = store.getExerciseProgress(exo.id);
    const badge = EXO_STATUS[progress.dernierStatut] || EXO_STATUS.todo;
    const stars = '★'.repeat(exo.difficulte) + '☆'.repeat(3 - exo.difficulte);
    const domainObj = store.programme.domaines.find(d => d.id === exo.domaineId);

    return `
      <div class="card exo-card" data-exo-id="${exo.id}">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;">
          <div>
            <span class="chapter-domain-tag">${domainObj ? domainObj.titre : exo.domaineId}</span>
            <h3 style="font-size: 1.1rem;">${exo.titre}</h3>
          </div>
          <span class="badge ${badge.class}">${badge.label}</span>
        </div>
        <div class="exo-meta">
          <span>Difficulté : <strong>${stars}</strong></span>
          <span>⏱️ ~${exo.dureeEstimeeMinutes} min</span>
          <span>🏷️ ${exo.type}</span>
          ${progress.tentatives > 0 ? `<span>Tentatives : ${progress.tentatives}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="page-header">
      <h1>Banque d'exercices</h1>
      <p>Entraîne-toi sur des exercices ciblés et auto-évalue ta rédaction.</p>
    </div>

    <div class="toolbar">
      <select id="exo-filter-domain" class="select-control">
        <option value="all">Tous les domaines</option>
        ${domainOptions}
      </select>

      <select id="exo-filter-diff" class="select-control">
        <option value="all">Toutes difficultés</option>
        <option value="1" ${filterDifficulty === '1' ? 'selected' : ''}>★☆☆ (Facile / Cours)</option>
        <option value="2" ${filterDifficulty === '2' ? 'selected' : ''}>★★☆ (Standard CAPES)</option>
        <option value="3" ${filterDifficulty === '3' ? 'selected' : ''}>★★★ (Approfondissement)</option>
      </select>

      <select id="exo-filter-status" class="select-control">
        <option value="all">Tous les statuts</option>
        <option value="todo" ${filterStatus === 'todo' ? 'selected' : ''}>Non faits</option>
        <option value="failed" ${filterStatus === 'failed' ? 'selected' : ''}>À refaire</option>
        <option value="partial" ${filterStatus === 'partial' ? 'selected' : ''}>Partiels</option>
        <option value="success" ${filterStatus === 'success' ? 'selected' : ''}>Réussis</option>
      </select>
    </div>

    <div>
      ${listHTML || '<p style="color: var(--text-muted);">Aucun exercice ne correspond à ces filtres.</p>'}
    </div>
  `;

  document.getElementById('exo-filter-domain').addEventListener('change', (e) => {
    filterDomain = e.target.value;
    renderExercises(container, rerenderMath);
  });

  document.getElementById('exo-filter-diff').addEventListener('change', (e) => {
    filterDifficulty = e.target.value;
    renderExercises(container, rerenderMath);
  });

  document.getElementById('exo-filter-status').addEventListener('change', (e) => {
    filterStatus = e.target.value;
    renderExercises(container, rerenderMath);
  });

  document.querySelectorAll('.exo-card').forEach(card => {
    card.addEventListener('click', () => {
      activeExerciseId = card.dataset.exoId;
      secondsElapsed = 0;
      renderExercises(container, rerenderMath);
    });
  });

  rerenderMath();
}

function renderExerciseDetail(container, exoId, rerenderMath) {
  const exo = store.exercices.find(e => e.id === exoId);
  if (!exo) {
    activeExerciseId = null;
    renderExercises(container, rerenderMath);
    return;
  }

  let revealedHints = 0;
  let showCorrection = false;
  const progress = store.getExerciseProgress(exo.id);

  function updateDetailView() {
    const hintsHTML = exo.indices
      .slice(0, revealedHints)
      .map((hint, idx) => `<div class="hint-box"><strong>Indice ${idx + 1} :</strong> ${hint}</div>`)
      .join('');

    const hasMoreHints = revealedHints < exo.indices.length;

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1rem;">
        <button class="btn-back" id="btn-back-exos" style="margin-bottom: 0;">← Retour aux exercices</button>
        
        <div class="timer-bar">
          <span>⏱️ <span id="timer-display">${formatTimer(secondsElapsed)}</span></span>
          <button id="btn-timer-toggle" class="btn-secondary" style="padding: 0.25rem 0.6rem; font-size: 0.8rem;">
            ${isTimerRunning ? 'Pause' : 'Démarrer'}
          </button>
          <button id="btn-timer-reset" class="btn-secondary" style="padding: 0.25rem 0.6rem; font-size: 0.8rem;">↺</button>
        </div>
      </div>

      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span class="chapter-domain-tag">${exo.type} • Durée conseillée : ${exo.dureeEstimeeMinutes} min</span>
          <span class="badge ${EXO_STATUS[progress.dernierStatut].class}">${EXO_STATUS[progress.dernierStatut].label}</span>
        </div>
        <h1 style="font-size: 1.4rem; margin-top: 0.25rem;">${exo.titre}</h1>

        <div class="exo-statement">
          ${exo.enonce}
        </div>

        <!-- Zone des indices progressifs -->
        <div id="hints-area">
          ${hintsHTML}
        </div>

        <div style="display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1rem;">
          ${hasMoreHints ? `
            <button id="btn-next-hint" class="btn-secondary">
              💡 Afficher un indice (${revealedHints}/${exo.indices.length})
            </button>
          ` : ''}

          ${!showCorrection ? `
            <button id="btn-show-corr" class="btn-primary">
              📖 Afficher la correction détaillée
            </button>
          ` : ''}
        </div>

        ${showCorrection ? `
          <div class="correction-box">
            <h3 style="color: #047857; margin-bottom: 0.5rem;">Correction détaillée</h3>
            <div>${exo.correction}</div>
          </div>

          <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--border);">
            <p style="font-weight: 600; margin-bottom: 0.75rem;">Comment s'est passée ta résolution ?</p>
            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
              <button class="status-btn" data-eval="failed" style="border-color: var(--status-review); color: var(--status-review);">❌ Échoué / À refaire</button>
              <button class="status-btn" data-eval="partial" style="border-color: var(--status-progress); color: #b45309;">⚠️ Partiel</button>
              <button class="status-btn" data-eval="success" style="border-color: var(--status-mastered); color: #047857;">✅ Réussi</button>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    // Bouton retour
    document.getElementById('btn-back-exos').addEventListener('click', () => {
      stopTimer();
      activeExerciseId = null;
      renderExercises(container, rerenderMath);
    });

    // Contrôles du chronomètre
    document.getElementById('btn-timer-toggle').addEventListener('click', () => {
      if (isTimerRunning) {
        stopTimer();
      } else {
        isTimerRunning = true;
        timerInterval = setInterval(() => {
          secondsElapsed++;
          const display = document.getElementById('timer-display');
          if (display) display.textContent = formatTimer(secondsElapsed);
        }, 1000);
      }
      updateDetailView();
    });

    document.getElementById('btn-timer-reset').addEventListener('click', () => {
      stopTimer();
      secondsElapsed = 0;
      updateDetailView();
    });

    // Indices & Correction
    const btnHint = document.getElementById('btn-next-hint');
    if (btnHint) {
      btnHint.addEventListener('click', () => {
        revealedHints++;
        updateDetailView();
      });
    }

    const btnCorr = document.getElementById('btn-show-corr');
    if (btnCorr) {
      btnCorr.addEventListener('click', () => {
        stopTimer();
        showCorrection = true;
        updateDetailView();
      });
    }

    // Boutons d'auto-évaluation
    document.querySelectorAll('[data-eval]').forEach(btn => {
      btn.addEventListener('click', () => {
        store.setExerciseResult(exo.id, btn.dataset.eval);
        activeExerciseId = null;
        renderExercises(container, rerenderMath);
      });
    });

    rerenderMath();
  }

  updateDetailView();
}