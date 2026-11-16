import { store } from '../store.js';

let filterType = 'all';
let showResolved = false;

export function renderErrors(container, rerenderMath) {
  const errors = store.userState.erreurs;

  const filteredErrors = errors.filter(err => {
    if (!showResolved && err.resolved) return false;
    if (filterType !== 'all' && err.type !== filterType) return false;
    return true;
  });

  const domainOptions = store.programme.domaines
    .map(d => `<option value="${d.id}">${d.titre}</option>`)
    .join('');

  const listHTML = filteredErrors.map(err => {
    const domainObj = store.programme.domaines.find(d => d.id === err.domaineId);
    const exoObj = err.exoId ? store.exercices.find(e => e.id === err.exoId) : null;

    return `
      <div class="card" style="border-left: 4px solid ${err.resolved ? 'var(--status-mastered)' : 'var(--status-review)'}; opacity: ${err.resolved ? '0.75' : '1'};">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <span class="chapter-domain-tag">
              ${domainObj ? domainObj.titre : err.domaineId} • ${err.date}
              ${exoObj ? ` • Exo : ${exoObj.titre}` : ''}
            </span>
            <span class="badge ${err.resolved ? 'badge-mastered' : 'badge-review'}" style="display: inline-block; margin-top: 0.25rem;">
              ${err.type}
            </span>
          </div>

          <div style="display: flex; gap: 0.5rem;">
            <button class="btn-secondary btn-toggle-err" data-id="${err.id}" style="padding: 0.35rem 0.7rem; font-size: 0.8rem;">
              ${err.resolved ? '↩️ Rouvrir' : '✅ Marquer résolue'}
            </button>
            <button class="btn-secondary btn-del-err" data-id="${err.id}" style="padding: 0.35rem 0.6rem; font-size: 0.8rem; color: var(--status-review);">
              🗑️
            </button>
          </div>
        </div>

        <p style="margin-top: 0.75rem; white-space: pre-line;">${err.description}</p>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="page-header">
      <h1>Carnet d'erreurs</h1>
      <p>Capitalise sur tes blocages en exercices ou en annales pour ne plus perdre de points bêtement.</p>
    </div>

    <!-- Formulaire d'ajout manuel (utile quand tu travailles sur papier) -->
    <details class="card" style="cursor: pointer;">
      <summary style="font-weight: 600; color: var(--primary);">+ Ajouter une erreur manuellement (annales, brouillon...)</summary>
      <form id="manual-error-form" style="margin-top: 1rem; display: flex; flex-direction: column; gap: 0.75rem; cursor: default;">
        <div style="display: flex; flex-wrap: wrap; gap: 0.75rem;">
          <select id="manual-err-domain" class="select-control">
            ${domainOptions}
          </select>
          <select id="manual-err-type" class="select-control">
            <option value="Oubli de théorème / hypothèse">Oubli de théorème ou d'hypothèse</option>
            <option value="Raisonnement / Logique">Erreur de raisonnement / logique</option>
            <option value="Calcul">Erreur de calcul</option>
            <option value="Rédaction / Rigueur">Manque de rigueur dans la rédaction</option>
            <option value="Compréhension">Incompréhension de l'énoncé</option>
          </select>
        </div>
        <textarea id="manual-err-desc" class="notes-textarea" required
                  placeholder="Décris l'erreur commise et le réflexe à avoir la prochaine fois (tu peux utiliser $LaTeX$)..."></textarea>
        <div>
          <button type="submit" class="btn-primary">Enregistrer dans le carnet</button>
        </div>
      </form>
    </details>

    <!-- Filtres -->
    <div class="toolbar">
      <select id="filter-err-type" class="select-control">
        <option value="all" ${filterType === 'all' ? 'selected' : ''}>Tous les types d'erreurs</option>
        <option value="Oubli de théorème / hypothèse" ${filterType === 'Oubli de théorème / hypothèse' ? 'selected' : ''}>Oubli de théorème / hypothèse</option>
        <option value="Raisonnement / Logique" ${filterType === 'Raisonnement / Logique' ? 'selected' : ''}>Raisonnement / Logique</option>
        <option value="Calcul" ${filterType === 'Calcul' ? 'selected' : ''}>Calcul</option>
        <option value="Rédaction / Rigueur" ${filterType === 'Rédaction / Rigueur' ? 'selected' : ''}>Rédaction / Rigueur</option>
        <option value="Compréhension" ${filterType === 'Compréhension' ? 'selected' : ''}>Compréhension</option>
      </select>

      <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; cursor: pointer;">
        <input type="checkbox" id="toggle-show-resolved" ${showResolved ? 'checked' : ''}>
        Afficher les erreurs déjà résolues
      </label>
    </div>

    <div>
      ${listHTML || '<p style="color: var(--text-muted);">Aucune erreur active à afficher.</p>'}
    </div>
  `;

  document.getElementById('manual-error-form').addEventListener('submit', (e) => {
    e.preventDefault();
    store.addError({
      domaineId: document.getElementById('manual-err-domain').value,
      type: document.getElementById('manual-err-type').value,
      description: document.getElementById('manual-err-desc').value.trim()
    });
    renderErrors(container, rerenderMath);
  });

  document.getElementById('filter-err-type').addEventListener('change', (e) => {
    filterType = e.target.value;
    renderErrors(container, rerenderMath);
  });

  document.getElementById('toggle-show-resolved').addEventListener('change', (e) => {
    showResolved = e.target.checked;
    renderErrors(container, rerenderMath);
  });

  document.querySelectorAll('.btn-toggle-err').forEach(btn => {
    btn.addEventListener('click', () => {
      store.toggleErrorResolved(btn.dataset.id);
      renderErrors(container, rerenderMath);
    });
  });

  document.querySelectorAll('.btn-del-err').forEach(btn => {
    btn.addEventListener('click', () => {
      store.deleteError(btn.dataset.id);
      renderErrors(container, rerenderMath);
    });
  });

  rerenderMath();
}