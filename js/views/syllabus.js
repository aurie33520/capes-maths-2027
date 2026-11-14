import { store } from '../store.js';

const STATUS_LABELS = {
  todo: { label: 'À découvrir', class: 'badge-todo' },
  progress: { label: 'En cours', class: 'badge-progress' },
  review: { label: 'À revoir', class: 'badge-review' },
  mastered: { label: 'Maîtrisé', class: 'badge-mastered' }
};

// État local de la vue (filtres et notion ouverte)
let selectedDomain = 'all';
let searchQuery = '';
let activeNotionId = null;

export function renderSyllabus(container, rerenderMath) {
  // Si une notion est sélectionnée, on affiche sa fiche détaillée
  if (activeNotionId) {
    renderNotionDetail(container, activeNotionId, rerenderMath);
    return;
  }

  // Sinon, on affiche la liste filtrable des chapitres et notions
  const domaines = store.programme.domaines;

  const domainOptions = domaines.map(d => 
    `<option value="${d.id}" ${selectedDomain === d.id ? 'selected' : ''}>${d.titre}</option>`
  ).join('');

  let chaptersHTML = '';

  domaines.forEach(domaine => {
    if (selectedDomain !== 'all' && domaine.id !== selectedDomain) return;

    domaine.chapitres.forEach(chapitre => {
      // Filtrage par recherche textuelle
      const matchingNotions = chapitre.notions.filter(n => 
        n.titre.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chapitre.titre.toLowerCase().includes(searchQuery.toLowerCase())
      );

      if (matchingNotions.length === 0) return;

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

      chaptersHTML += `
        <div class="card chapter-card">
          <div class="chapter-header">
            <div>
              <span class="chapter-domain-tag">${domaine.titre}</span>
              ${chapitre.titre}
            </div>
            <small style="color: var(--text-muted)">${matchingNotions.length} notion(s)</small>
          </div>
          <ul class="notion-list">
            ${notionsListHTML}
          </ul>
        </div>
      `;
    });
  });

  container.innerHTML = `
    <div class="page-header">
      <h1>Programme officiel</h1>
      <p>Clique sur une notion pour ouvrir sa fiche et évaluer ta maîtrise.</p>
    </div>

    <div class="toolbar">
      <select id="filter-domain" class="select-control">
        <option value="all">Tous les domaines</option>
        ${domainOptions}
      </select>
      <input type="search" id="search-notion" class="input-control" 
             placeholder="Rechercher une notion ou un chapitre..." value="${searchQuery}">
    </div>

    <div id="chapters-container">
      ${chaptersHTML || '<p>Aucune notion ne correspond à ta recherche.</p>'}
    </div>
  `;

  // Écouteurs d'événements pour les filtres
  document.getElementById('filter-domain').addEventListener('change', (e) => {
    selectedDomain = e.target.value;
    renderSyllabus(container, rerenderMath);
  });

  const searchInput = document.getElementById('search-notion');
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderSyllabus(container, rerenderMath);
    // Remet le focus et le curseur à la fin après le re-rendu
    const newInput = document.getElementById('search-notion');
    newInput.focus();
    newInput.setSelectionRange(searchQuery.length, searchQuery.length);
  });

  // Clic sur une notion pour ouvrir sa fiche
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

  const renderList = (items) => {
    if (!items || items.length === 0) return '<p style="color:var(--text-muted)">Non renseigné.</p>';
    return `<ul>${items.map(item => `<li>${item}</li>`).join('')}</ul>`;
  };

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

      <div class="fiche-section">
        <h3>Méthodes & réflexes concours</h3>
        ${renderList(notion.methodes)}
      </div>

      <div class="fiche-section">
        <h3>Notes personnelles (sauvegarde automatique)</h3>
        <textarea id="notion-notes" class="notes-textarea" 
                  placeholder="Ajoute ici tes propres remarques, pièges à éviter, démonstrations clés...">${progress.notes}</textarea>
      </div>
    </div>
  `;

  // Bouton retour
  document.getElementById('btn-back-syllabus').addEventListener('click', () => {
    activeNotionId = null;
    renderSyllabus(container, rerenderMath);
  });

  // Changement de statut
  document.querySelectorAll('.status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      store.setNotionStatus(notion.id, btn.dataset.status);
      renderNotionDetail(container, notion.id, rerenderMath);
    });
  });

  // Sauvegarde des notes à la frappe
  document.getElementById('notion-notes').addEventListener('input', (e) => {
    store.setNotionNotes(notion.id, e.target.value);
  });

  rerenderMath();
}