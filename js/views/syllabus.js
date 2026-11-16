import { store } from '../store.js';

const STATUS_LABELS = {
  todo: { label: 'À découvrir', class: 'badge-todo' },
  progress: { label: 'En cours', class: 'badge-progress' },
  review: { label: 'À revoir', class: 'badge-review' },
  mastered: { label: 'Maîtrisé', class: 'badge-mastered' }
};

const EXO_STATUS = {
  todo: { label: 'Non fait', class: 'badge-todo' },
  failed: { label: 'À refaire', class: 'badge-review' },
  partial: { label: 'Partiel', class: 'badge-progress' },
  success: { label: 'Réussi', class: 'badge-mastered' }
};

// 'home' = vue par grands thèmes | 'all' = tous les chapitres regroupés | '<domaineId>' = un thème précis
let viewMode = 'home';
let searchQuery = '';
let activeNotionId = null;

function getDomainStats(domaine) {
  let totalNotions = 0;
  let masteredNotions = 0;

  domaine.chapitres.forEach(chap => {
    chap.notions.forEach(n => {
      totalNotions++;
      if (store.getNotionProgress(n.id).statut === 'mastered') {
        masteredNotions++;
      }
    });
  });

  const percent = totalNotions > 0 ? Math.round((masteredNotions / totalNotions) * 100) : 0;
  return {
    chaptersCount: domaine.chapitres.length,
    totalNotions,
    masteredNotions,
    percent
  };
}

export function renderSyllabus(container, rerenderMath) {
  // Ouverture directe demandée depuis un exercice
  if (store.pendingNavigation && store.pendingNavigation.type === 'notion') {
    activeNotionId = store.pendingNavigation.id;
    store.pendingNavigation = null;
  }

  if (activeNotionId) {
    renderNotionDetail(container, activeNotionId, rerenderMath);
    return;
  }

  const domaines = store.programme.domaines;
  const query = searchQuery.trim().toLowerCase();
  const isSearching = query.length > 0;

  // Barre d'outils (barre de recherche + boutons de bascule Thèmes / Tout voir)
  const toolbarHTML = `
    <div class="toolbar" style="display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center;">
      <input type="search" id="search-notion" class="input-control"
             style="flex: 1 1 260px;"
             placeholder="Rechercher une notion ou un chapitre..."
             value="${searchQuery.replace(/"/g, '&quot;')}">

      <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
        <button type="button" id="btn-mode-home"
                class="${viewMode === 'home' && !isSearching ? 'btn-primary' : 'btn-secondary'}"
                style="padding: 0.5rem 0.9rem; font-size: 0.9rem;">
          🗂️ Par grands thèmes
        </button>
        <button type="button" id="btn-mode-all"
                class="${viewMode === 'all' && !isSearching ? 'btn-primary' : 'btn-secondary'}"
                style="padding: 0.5rem 0.9rem; font-size: 0.9rem;">
          📚 Voir tous les chapitres
        </button>
      </div>
    </div>
  `;

  let contentHTML = '';

  // CAS 1 : Vue d'accueil épurée par grands thèmes (si pas de recherche en cours)
  if (viewMode === 'home' && !isSearching) {
    const cardsHTML = domaines.map(domaine => {
      const stats = getDomainStats(domaine);
      return `
        <div class="card domain-select-card" data-domain-id="${domaine.id}"
             style="cursor: pointer; display: flex; flex-direction: column; justify-content: space-between; transition: transform 0.15s ease, box-shadow 0.15s ease;">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
              <span class="chapter-domain-tag">${stats.chaptersCount} chapitre${stats.chaptersCount > 1 ? 's' : ''}</span>
              <span style="font-size: 0.85rem; font-weight: 600; color: var(--primary, #2563eb);">${stats.percent}%</span>
            </div>
            <h2 style="font-size: 1.25rem; margin-bottom: 0.4rem;">${domaine.titre}</h2>
            <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1rem;">
              ${stats.masteredNotions} / ${stats.totalNotions} notion${stats.totalNotions > 1 ? 's' : ''} maîtrisée${stats.masteredNotions > 1 ? 's' : ''}
            </p>
          </div>

          <div>
            <div style="width: 100%; height: 6px; background: var(--border, #e2e8f0); border-radius: 999px; overflow: hidden; margin-bottom: 0.75rem;">
              <div style="width: ${stats.percent}%; height: 100%; background: var(--primary, #2563eb);"></div>
            </div>
            <span style="font-size: 0.88rem; font-weight: 600; color: var(--primary, #2563eb);">
              Explorer ce thème →
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
    // CAS 2 : Affichage d'un thème spécifique OU de tous les chapitres regroupés par thème
    const targetDomaines = (viewMode !== 'home' && viewMode !== 'all' && !isSearching)
      ? domaines.filter(d => d.id === viewMode)
      : domaines;

    let sectionsHTML = '';

    targetDomaines.forEach(domaine => {
      let domainChaptersHTML = '';
      let matchingCount = 0;

      domaine.chapitres.forEach(chapitre => {
        const matchingNotions = chapitre.notions.filter(n =>
          !isSearching ||
          n.titre.toLowerCase().includes(query) ||
          chapitre.titre.toLowerCase().includes(query) ||
          domaine.titre.toLowerCase().includes(query)
        );

        if (matchingNotions.length === 0) return;
        matchingCount += matchingNotions.length;

        const notionsListHTML = matchingNotions.map(notion => {
          const progress = store.getNotionProgress(notion.id);
          const badge = STATUS_LABELS[progress.statut] || STATUS_LABELS.todo;

          return `
            <li class="notion-item" data-notion-id="${notion.id}">
              <span>${notion.titre}</span>
              <span class="badge ${badge.class}">${badge.label}</span>
            </li>
          `;
        }).join('');

        domainChaptersHTML += `
          <div class="card chapter-card" style="margin-bottom: 1rem;">
            <div class="chapter-header">
              <div>
                <strong>${chapitre.titre}</strong>
              </div>
              <small style="color: var(--text-muted)">${matchingNotions.length} notion(s)</small>
            </div>
            <ul class="notion-list">
              ${notionsListHTML}
            </ul>
          </div>
        `;
      });

      if (matchingCount === 0) return;

      const stats = getDomainStats(domaine);

      sectionsHTML += `
        <section style="margin-bottom: 2.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; padding-bottom: 0.5rem; margin-bottom: 1rem; border-bottom: 2px solid var(--primary, #2563eb);">
            <h2 style="font-size: 1.3rem; margin: 0; color: var(--text-main);">
              📂 ${domaine.titre}
            </h2>
            <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500;">
              ${stats.chaptersCount} chapitre(s) • ${stats.masteredNotions}/${stats.totalNotions} maîtrisée(s) (${stats.percent}%)
            </span>
          </div>
          ${domainChaptersHTML}
        </section>
      `;
    });

    const backBannerHTML = (viewMode !== 'home' && viewMode !== 'all' && !isSearching) ? `
      <div style="margin-bottom: 1rem;">
        <button type="button" class="btn-back" id="btn-back-themes" style="margin-bottom: 0;">
          ← Retour à tous les thèmes
        </button>
      </div>
    ` : '';

    contentHTML = `
      ${backBannerHTML}
      <div id="chapters-container">
        ${sectionsHTML || '<p style="color: var(--text-muted);">Aucune notion ne correspond à ta recherche.</p>'}
      </div>
    `;
  }

  container.innerHTML = `
    <div class="page-header">
      <h1>Programme officiel</h1>
      <p>Choisis un grand thème pour réviser sereinement, ou affiche tous les chapitres regroupés par domaine.</p>
    </div>

    ${toolbarHTML}

    ${contentHTML}
  `;

  // Événements de la barre d'outils
  const searchInput = document.getElementById('search-notion');
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderSyllabus(container, rerenderMath);
    const newInput = document.getElementById('search-notion');
    newInput.focus();
    newInput.setSelectionRange(searchQuery.length, searchQuery.length);
  });

  document.getElementById('btn-mode-home').addEventListener('click', () => {
    searchQuery = '';
    viewMode = 'home';
    renderSyllabus(container, rerenderMath);
  });

  document.getElementById('btn-mode-all').addEventListener('click', () => {
    searchQuery = '';
    viewMode = 'all';
    renderSyllabus(container, rerenderMath);
  });

  const btnBackThemes = document.getElementById('btn-back-themes');
  if (btnBackThemes) {
    btnBackThemes.addEventListener('click', () => {
      viewMode = 'home';
      renderSyllabus(container, rerenderMath);
    });
  }

  // Clic sur une grande carte de thème
  document.querySelectorAll('.domain-select-card').forEach(card => {
    card.addEventListener('click', () => {
      viewMode = card.dataset.domainId;
      renderSyllabus(container, rerenderMath);
    });
  });

  // Clic sur une notion
  document.querySelectorAll('.notion-item').forEach(item => {
    item.addEventListener('click', () => {
      activeNotionId = item.dataset.notionId;
      renderSyllabus(container, rerenderMath);
    });
  });

  rerenderMath();
}

function renderNotionDetail(container, notionId, rerenderMath) {
  const found = store.findNotionById(notionId);
  if (!found) {
    activeNotionId = null;
    renderSyllabus(container, rerenderMath);
    return;
  }

  const { notion, chapitre, domaine } = found;
  const progress = store.getNotionProgress(notion.id);
  const relatedExercises = store.getExercisesForNotion(notion.id);

  const renderList = (items) => {
    if (!items || items.length === 0) return '<p style="color:var(--text-muted)">Non renseigné.</p>';
    return `<ul>${items.map(item => `<li style="margin-bottom: 0.65rem;">${item}</li>`).join('')}</ul>`;
  };

  const examplesSection = (notion.exemples && notion.exemples.length > 0) ? `
    <div class="fiche-section">
      <h3>Exemples & Contre-exemples classiques</h3>
      ${renderList(notion.exemples)}
    </div>
  ` : '';

  const proofsSection = (notion.demonstrations && notion.demonstrations.length > 0) ? `
    <div class="fiche-section">
      <h3>Démonstrations exigibles / clés</h3>
      ${renderList(notion.demonstrations)}
    </div>
  ` : '';

  const relatedExercisesHTML = relatedExercises.length > 0 ? `
    <ul class="notion-list" style="margin-top: 0.5rem;">
      ${relatedExercises.map(exo => {
        const exoProg = store.getExerciseProgress(exo.id);
        const exoBadge = EXO_STATUS[exoProg.dernierStatut] || EXO_STATUS.todo;
        const stars = '★'.repeat(exo.difficulte) + '☆'.repeat(3 - exo.difficulte);
        return `
          <li class="notion-item related-exo-item" data-exo-id="${exo.id}" style="cursor: pointer;">
            <div>
              <strong>${exo.titre}</strong>
              <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 0.15rem;">
                Difficulté : ${stars} • ⏱️ ~${exo.dureeEstimeeMinutes} min • 🏷️ ${exo.type}
              </div>
            </div>
            <span class="badge ${exoBadge.class}">${exoBadge.label}</span>
          </li>
        `;
      }).join('')}
    </ul>
  ` : '<p style="color: var(--text-muted);">Aucun exercice associé pour le moment.</p>';

  container.innerHTML = `
    <button class="btn-back" id="btn-back-syllabus">← Retour au programme</button>

    <div class="card">
      <span class="chapter-domain-tag">${domaine.titre} • ${chapitre.titre}</span>
      <h1 style="font-size: 1.5rem; margin-top: 0.25rem;">${notion.titre}</h1>

      <div class="status-selector">
        ${Object.entries(STATUS_LABELS).map(([key, info]) => `
          <button class="status-btn ${progress.statut === key ? 'active' : ''}" data-status="${key}">
            ${info.label}
          </button>
        `).join('')}
      </div>

      <div class="fiche-section">
        <h3>Prérequis</h3>
        ${renderList(notion.prerequis)}
      </div>

      <div class="fiche-section">
        <h3>Définitions clés</h3>
        ${renderList(notion.definitions)}
      </div>

      <div class="fiche-section">
        <h3>Théorèmes et propriétés</h3>
        ${renderList(notion.theoremes)}
      </div>

      ${examplesSection}

      ${proofsSection}

      <div class="fiche-section">
        <h3>Méthodes & réflexes concours</h3>
        ${renderList(notion.methodes)}
      </div>

      <div class="fiche-section">
        <h3>Notes personnelles (sauvegarde automatique)</h3>
        <textarea id="notion-notes" class="notes-textarea" 
                  placeholder="Ajoute ici tes propres remarques, pièges à éviter, démonstrations clés...">${progress.notes}</textarea>
      </div>

      <div class="fiche-section" style="margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid var(--border);">
        <h3>✍️ Exercices associés (${relatedExercises.length})</h3>
        ${relatedExercisesHTML}
      </div>
    </div>
  `;

  document.getElementById('btn-back-syllabus').addEventListener('click', () => {
    activeNotionId = null;
    renderSyllabus(container, rerenderMath);
  });

  document.querySelectorAll('.status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      store.setNotionStatus(notion.id, btn.dataset.status);
      renderNotionDetail(container, notion.id, rerenderMath);
    });
  });

  document.getElementById('notion-notes').addEventListener('input', (e) => {
    store.setNotionNotes(notion.id, e.target.value);
  });

  document.querySelectorAll('.related-exo-item').forEach(item => {
    item.addEventListener('click', () => {
      store.pendingNavigation = { type: 'exercise', id: item.dataset.exoId };
      window.location.hash = 'exercices';
    });
  });

  rerenderMath();
}