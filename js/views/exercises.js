import { store } from '../store.js';

const EXO_STATUS = {
  todo: { label: 'Non fait', class: 'badge-todo' },
  failed: { label: 'À refaire', class: 'badge-review' },
  partial: { label: 'Partiel', class: 'badge-progress' },
  success: { label: 'Réussi', class: 'badge-mastered' }
};

// 'home' = vue par grands thèmes | 'all' = tous les exercices regroupés | '<domaineId>' = un thème précis
let viewMode = 'home';
let filterDifficulty = 'all';
let filterStatus = 'all';
let searchQuery = '';
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

function getDomainExerciseStats(domaineId) {
  const domainExos = store.exercices.filter(e => e.domaineId === domaineId);
  const totalExos = domainExos.length;
  const successExos = domainExos.filter(
    e => store.getExerciseProgress(e.id).dernierStatut === 'success'
  ).length;
  const percent = totalExos > 0 ? Math.round((successExos / totalExos) * 100) : 0;

  return { totalExos, successExos, percent };
}

function renderExerciseCard(exo) {
  const progress = store.getExerciseProgress(exo.id);
  const badge = EXO_STATUS[progress.dernierStatut] || EXO_STATUS.todo;
  const stars = '★'.repeat(exo.difficulte) + '☆'.repeat(3 - exo.difficulte);
  const notionsInfo = store.getNotionsForExercise(exo);

  // Si l'exercice mobilise plusieurs leçons, on les indique en complément
  const extraLessons = notionsInfo.length > 1
    ? notionsInfo.slice(1).map(n => n.notion.titre).join(' • ')
    : '';

  return `
    <div class="card exo-card" data-exo-id="${exo.id}" style="margin-bottom: 0.75rem;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;">
        <div>
          <h4 style="font-size: 1.05rem; margin: 0;">${exo.titre}</h4>
          ${extraLessons ? `
            <p style="font-size: 0.82rem; color: var(--text-muted); margin-top: 0.3rem;">
              🔗 Mobilise aussi : ${extraLessons}
            </p>
          ` : ''}
        </div>
        <span class="badge ${badge.class}">${badge.label}</span>
      </div>
      <div class="exo-meta" style="margin-top: 0.65rem;">
        <span>Difficulté : <strong>${stars}</strong></span>
        <span>⏱️ ~${exo.dureeEstimeeMinutes} min</span>
        <span>🏷️ ${exo.type}</span>
        ${progress.tentatives > 0 ? `<span>Tentatives : ${progress.tentatives}</span>` : ''}
      </div>
    </div>
  `;
}

function renderDomainGroupedByLessons(domaine, matchingExos, stats) {
  const placedExoIds = new Set();
  let chaptersHTML = '';

  // Parcours dans l'ordre officiel du programme : Chapitre -> Leçon (Notion)
  domaine.chapitres.forEach(chapitre => {
    let lessonsHTML = '';

    chapitre.notions.forEach(notion => {
      // On rattache chaque exercice à sa leçon principale (notionIds[0]) pour éviter les doublons
      const lessonExos = matchingExos
        .filter(exo => Array.isArray(exo.notionIds) && exo.notionIds[0] === notion.id)
        .sort((a, b) => a.difficulte - b.difficulte);

      if (lessonExos.length === 0) return;

      lessonExos.forEach(exo => placedExoIds.add(exo.id));

      lessonsHTML += `
        <div style="margin-bottom: 1.25rem; padding-left: 0.75rem; border-left: 3px solid var(--border, #cbd5e1);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.6rem;">
            <div style="font-weight: 600; font-size: 0.98rem; color: var(--primary, #2563eb);">
              📖 Leçon : ${notion.titre}
            </div>
            <button type="button" class="btn-secondary btn-go-notion-inline" data-notion-id="${notion.id}"
                    style="padding: 0.2rem 0.6rem; font-size: 0.8rem;">
              Voir le cours →
            </button>
          </div>
          ${lessonExos.map(renderExerciseCard).join('')}
        </div>
      `;
    });

    // Exercices rattachés au chapitre mais dont la notion n'a pas été trouvée
    const chapterRemainingExos = matchingExos
      .filter(exo => !placedExoIds.has(exo.id) && exo.chapitreId === chapitre.id)
      .sort((a, b) => a.difficulte - b.difficulte);

    if (chapterRemainingExos.length > 0) {
      chapterRemainingExos.forEach(exo => placedExoIds.add(exo.id));
      lessonsHTML += `
        <div style="margin-bottom: 1.25rem;">
          ${chapterRemainingExos.map(renderExerciseCard).join('')}
        </div>
      `;
    }

    if (!lessonsHTML) return;

    chaptersHTML += `
      <div style="margin-bottom: 1.75rem;">
        <h3 style="font-size: 1.12rem; margin-bottom: 0.85rem; color: var(--text-main); display: flex; align-items: center; gap: 0.4rem;">
          <span>📑 Chapitre : ${chapitre.titre}</span>
        </h3>
        ${lessonsHTML}
      </div>
    `;
  });

  // Filet de sécurité : exercices du domaine non rattachés à un chapitre connu
  const orphanExos = matchingExos
    .filter(exo => !placedExoIds.has(exo.id))
    .sort((a, b) => a.difficulte - b.difficulte);

  if (orphanExos.length > 0) {
    chaptersHTML += `
      <div style="margin-bottom: 1.75rem;">
        <h3 style="font-size: 1.12rem; margin-bottom: 0.85rem; color: var(--text-main);">
          📑 Autres exercices du thème
        </h3>
        ${orphanExos.map(renderExerciseCard).join('')}
      </div>
    `;
  }

  return `
    <section style="margin-bottom: 2.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; padding-bottom: 0.5rem; margin-bottom: 1.25rem; border-bottom: 2px solid var(--primary, #2563eb);">
        <h2 style="font-size: 1.35rem; margin: 0; color: var(--text-main);">
          📂 ${domaine.titre}
        </h2>
        <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500;">
          ${matchingExos.length} exercice(s) affiché(s) • ${stats.successExos}/${stats.totalExos} réussi(s) (${stats.percent}%)
        </span>
      </div>
      ${chaptersHTML}
    </section>
  `;
}

export function renderExercises(container, rerenderMath) {
  stopTimer();

  // Ouverture directe demandée depuis une fiche de cours
  if (store.pendingNavigation && store.pendingNavigation.type === 'exercise') {
    activeExerciseId = store.pendingNavigation.id;
    secondsElapsed = 0;
    store.pendingNavigation = null;
  }

  if (activeExerciseId) {
    renderExerciseDetail(container, activeExerciseId, rerenderMath);
    return;
  }

  const domaines = store.programme.domaines;
  const query = searchQuery.trim().toLowerCase();
  const hasActiveFilters = query.length > 0 || filterDifficulty !== 'all' || filterStatus !== 'all';

  // Barre d'outils (Recherche + Bascule Thèmes / Tout voir + Filtres Difficulté/Statut)
  const toolbarHTML = `
    <div class="toolbar" style="display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center;">
      <input type="search" id="exo-search-input" class="input-control"
             style="flex: 1 1 240px;"
             placeholder="Rechercher un exercice, une leçon, un chapitre..."
             value="${searchQuery.replace(/"/g, '&quot;')}">

      <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
        <button type="button" id="btn-exo-mode-home"
                class="${viewMode === 'home' && !hasActiveFilters ? 'btn-primary' : 'btn-secondary'}"
                style="padding: 0.5rem 0.9rem; font-size: 0.9rem;">
          🗂️ Par grands thèmes
        </button>
        <button type="button" id="btn-exo-mode-all"
                class="${viewMode === 'all' && !hasActiveFilters ? 'btn-primary' : 'btn-secondary'}"
                style="padding: 0.5rem 0.9rem; font-size: 0.9rem;">
          ✍️ Voir tous les exercices
        </button>
      </div>

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
  `;

  let contentHTML = '';

  // CAS 1 : Vue d'accueil épurée par grands thèmes (si aucun filtre ni recherche actif)
  if (viewMode === 'home' && !hasActiveFilters) {
    const cardsHTML = domaines.map(domaine => {
      const stats = getDomainExerciseStats(domaine.id);
      return `
        <div class="card domain-exo-select-card" data-domain-id="${domaine.id}"
             style="cursor: pointer; display: flex; flex-direction: column; justify-content: space-between; transition: transform 0.15s ease, box-shadow 0.15s ease;">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
              <span class="chapter-domain-tag">${stats.totalExos} exercice${stats.totalExos > 1 ? 's' : ''}</span>
              <span style="font-size: 0.85rem; font-weight: 600; color: var(--primary, #2563eb);">${stats.percent}%</span>
            </div>
            <h2 style="font-size: 1.25rem; margin-bottom: 0.4rem;">${domaine.titre}</h2>
            <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1rem;">
              ${stats.successExos} / ${stats.totalExos} exercice${stats.totalExos > 1 ? 's' : ''} réussi${stats.successExos > 1 ? 's' : ''}
            </p>
          </div>

          <div>
            <div style="width: 100%; height: 6px; background: var(--border, #e2e8f0); border-radius: 999px; overflow: hidden; margin-bottom: 0.75rem;">
              <div style="width: ${stats.percent}%; height: 100%; background: var(--primary, #2563eb);"></div>
            </div>
            <span style="font-size: 0.88rem; font-weight: 600; color: var(--primary, #2563eb);">
              S'entraîner sur ce thème →
            </span>
          </div>
        </div>
      `;
    }).join('');

    contentHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; margin-top: 0.5rem;">
        ${cardsHTML}
      </div>
    `;
  } else {
    // CAS 2 : Affichage d'un thème spécifique OU de tous les exercices regroupés par thème > chapitre > leçon
    const targetDomaines = (viewMode !== 'home' && viewMode !== 'all' && !hasActiveFilters)
      ? domaines.filter(d => d.id === viewMode)
      : domaines;

    let sectionsHTML = '';

    targetDomaines.forEach(domaine => {
      const matchingExos = store.exercices.filter(exo => {
        if (exo.domaineId !== domaine.id) return false;

        const progress = store.getExerciseProgress(exo.id);
        if (filterDifficulty !== 'all' && exo.difficulte !== Number(filterDifficulty)) return false;
        if (filterStatus !== 'all' && progress.dernierStatut !== filterStatus) return false;

        if (query) {
          const chapInfo = store.findChapitreById(exo.chapitreId);
          const notionsInfo = store.getNotionsForExercise(exo);
          const searchableText = [
            exo.titre,
            exo.enonce,
            exo.type,
            domaine.titre,
            chapInfo ? chapInfo.chapitre.titre : '',
            ...notionsInfo.map(item => item.notion.titre)
          ].join(' ').toLowerCase();

          if (!searchableText.includes(query)) return false;
        }

        return true;
      });

      if (matchingExos.length === 0) return;

      const stats = getDomainExerciseStats(domaine.id);
      sectionsHTML += renderDomainGroupedByLessons(domaine, matchingExos, stats);
    });

    const backBannerHTML = (viewMode !== 'home' && viewMode !== 'all' && !hasActiveFilters) ? `
      <div style="margin-bottom: 1rem;">
        <button type="button" class="btn-back" id="btn-back-exo-themes" style="margin-bottom: 0;">
          ← Retour à tous les thèmes
        </button>
      </div>
    ` : '';

    contentHTML = `
      ${backBannerHTML}
      <div>
        ${sectionsHTML || '<p style="color: var(--text-muted);">Aucun exercice ne correspond à ces filtres.</p>'}
      </div>
    `;
  }

  container.innerHTML = `
    <div class="page-header">
      <h1>Banque d'exercices</h1>
      <p>Choisis un grand thème pour t'entraîner par leçon, ou affiche tous les exercices regroupés par domaine (${store.exercices.length} au total).</p>
    </div>

    ${toolbarHTML}

    ${contentHTML}
  `;

  // Événements de la barre d'outils
  const searchInput = document.getElementById('exo-search-input');
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderExercises(container, rerenderMath);
    const newInput = document.getElementById('exo-search-input');
    newInput.focus();
    newInput.setSelectionRange(searchQuery.length, searchQuery.length);
  });

  document.getElementById('btn-exo-mode-home').addEventListener('click', () => {
    searchQuery = '';
    filterDifficulty = 'all';
    filterStatus = 'all';
    viewMode = 'home';
    renderExercises(container, rerenderMath);
  });

  document.getElementById('btn-exo-mode-all').addEventListener('click', () => {
    searchQuery = '';
    filterDifficulty = 'all';
    filterStatus = 'all';
    viewMode = 'all';
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

  const btnBackThemes = document.getElementById('btn-back-exo-themes');
  if (btnBackThemes) {
    btnBackThemes.addEventListener('click', () => {
      viewMode = 'home';
      renderExercises(container, rerenderMath);
    });
  }

  // Clic sur une grande carte de thème
  document.querySelectorAll('.domain-exo-select-card').forEach(card => {
    card.addEventListener('click', () => {
      viewMode = card.dataset.domainId;
      renderExercises(container, rerenderMath);
    });
  });

  // Clic sur le bouton "Voir le cours" depuis l'en-tête d'une leçon
  document.querySelectorAll('.btn-go-notion-inline').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      store.pendingNavigation = { type: 'notion', id: btn.dataset.notionId };
      window.location.hash = 'programme';
    });
  });

  // Clic sur un exercice
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
  const notionsInfo = store.getNotionsForExercise(exo);
  const chapInfo = store.findChapitreById(exo.chapitreId);

  function updateDetailView() {
    const hintsHTML = exo.indices
      .slice(0, revealedHints)
      .map((hint, idx) => `<div class="hint-box"><strong>Indice ${idx + 1} :</strong> ${hint}</div>`)
      .join('');

    const hasMoreHints = revealedHints < exo.indices.length;

    const lessonButtonsHTML = notionsInfo.length > 0 ? `
      <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--border);">
        <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500;">📚 Leçon(s) associée(s) :</span>
        ${notionsInfo.map(item => `
          <button type="button" class="btn-secondary btn-go-notion" data-notion-id="${item.notion.id}" style="padding: 0.3rem 0.7rem; font-size: 0.85rem;">
            📖 ${item.notion.titre}
          </button>
        `).join('')}
      </div>
    ` : '';

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
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
          <span class="chapter-domain-tag">
            ${chapInfo ? `${chapInfo.chapitre.titre} • ` : ''}${exo.type} • Durée conseillée : ${exo.dureeEstimeeMinutes} min
          </span>
          <span class="badge ${EXO_STATUS[progress.dernierStatut].class}">${EXO_STATUS[progress.dernierStatut].label}</span>
        </div>
        <h1 style="font-size: 1.4rem; margin-top: 0.25rem;">${exo.titre}</h1>

        ${lessonButtonsHTML}

        <div class="exo-statement" style="margin-top: 1rem;">
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

    // Boutons d'accès direct aux leçons associées
    document.querySelectorAll('.btn-go-notion').forEach(btn => {
      btn.addEventListener('click', () => {
        stopTimer();
        store.pendingNavigation = { type: 'notion', id: btn.dataset.notionId };
        window.location.hash = 'programme';
      });
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