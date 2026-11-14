import { store } from '../store.js';

export function renderSettings(container) {
  const currentHours = (store.userState.objectifHebdoMinutes / 60).toFixed(1).replace('.0', '');

  container.innerHTML = `
    <div class="page-header">
      <h1>Données & Réglages</h1>
      <p>Configure ton rythme de travail et sauvegarde ta progression.</p>
    </div>

    <div class="card">
      <h2 style="font-size: 1.1rem; margin-bottom: 0.5rem;">Objectif hebdomadaire</h2>
      <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1rem;">
        Définis le volume horaire que tu vises chaque semaine (recommandé : 5h à 8h).
      </p>
      <div style="display: flex; gap: 0.75rem; align-items: center;">
        <input type="number" id="weekly-goal-input" class="input-control" style="max-width: 120px;" 
               min="1" max="40" step="0.5" value="${currentHours}">
        <span>heures / semaine</span>
        <button id="save-goal-btn" class="btn-primary">Enregistrer</button>
      </div>
      <p id="goal-feedback" style="color: var(--status-mastered); font-size: 0.85rem; margin-top: 0.5rem; display: none;">
        Objectif mis à jour !
      </p>
    </div>

    <div class="card">
      <h2 style="font-size: 1.1rem; margin-bottom: 0.5rem;">Sauvegarde et transfert (JSON)</h2>
      <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1rem;">
        Tes données sont stockées localement dans ce navigateur. Exporte régulièrement un fichier de sauvegarde pour éviter toute perte ou pour transférer ton avancement sur un autre appareil.
      </p>

      <div style="display: flex; flex-wrap: wrap; gap: 1rem; align-items: center;">
        <button id="btn-export" class="btn-primary">⬇️ Exporter ma sauvegarde (.json)</button>
        
        <label class="btn-secondary" style="display: inline-block;">
          ⬆️ Importer une sauvegarde
          <input type="file" id="input-import" accept=".json" style="display: none;">
        </label>
      </div>
      <p id="import-feedback" style="font-size: 0.85rem; margin-top: 0.75rem;"></p>
    </div>
  `;

  // Sauvegarde de l'objectif hebdo
  document.getElementById('save-goal-btn').addEventListener('click', () => {
    const hours = parseFloat(document.getElementById('weekly-goal-input').value);
    if (hours > 0) {
      store.setWeeklyGoal(Math.round(hours * 60));
      const fb = document.getElementById('goal-feedback');
      fb.style.display = 'block';
      setTimeout(() => fb.style.display = 'none', 2500);
    }
  });

  // Export JSON
  document.getElementById('btn-export').addEventListener('click', () => {
    store.exportData();
  });

  // Import JSON
  document.getElementById('input-import').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const feedback = document.getElementById('import-feedback');
      try {
        store.importData(event.target.result);
        feedback.style.color = 'var(--status-mastered)';
        feedback.textContent = 'Sauvegarde restaurée avec succès !';
      } catch (err) {
        feedback.style.color = 'var(--status-review)';
        feedback.textContent = 'Erreur : ' + err.message;
      }
    };
    reader.readAsText(file);
  });
}