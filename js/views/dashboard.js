import { store } from '../store.js';

function formatHours(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`;
}

export function renderDashboard(container, rerenderMath) {
  const stats = store.getStats();
  const { dueNotions, dueExercises } = store.getDueReviews();
  const totalDue = dueNotions.length + dueExercises.length;
  const weeklyPercent = Math.min(100, Math.round((stats.weeklyMinutes / stats.weeklyGoal) * 100));

  const domainOptions = store.programme.domaines
    .map(d => `<option value="${d.id}">${d.titre}</option>`)
    .join('');

  const domainsHTML = stats.domainStats.map(d => `
    <div style="margin-bottom: 1rem;">
      <div style="display: flex; justify-content: space-between; font-size: 0.9rem; font-weight: 500;">
        <span>${d.titre}</span>
        <span>${d.mastered} / ${d.total} notions (${d.percent}%)</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill success" style="width: ${d.percent}%"></div>
      </div>
    </div>
  `).join('');

  const dueHTML = totalDue > 0
    ? `<ul class="notion-list" style="border-top: none;">
        ${dueNotions.map(item => `
          <li class="notion-item" style="padding-left: 0; padding-right: 0;" data-goto="programme">
            <div>
              <span class="chapter-domain-tag">Notion • ${item.domaineTitre}</span>
              <strong>${item.notion.titre}</strong>
            </div>
            <span class="badge badge-progress">À réviser</span>
          </li>
        `).join('')}
        ${dueExercises.map(item => `
          <li class="notion-item" style="padding-left: 0; padding-right: 0;" data-goto="exercices">
            <div>
              <span class="chapter-domain-tag">Exercice • ${item.exo.type}</span>
              <strong>${item.exo.titre}</strong>
            </div>
            <span class="badge badge-review">À refaire</span>
          </li>
        `).join('')}
      </ul>`
    : `<p style="color: var(--text-muted); font-size: 0.95rem;">Aucune révision programmée n'est en retard aujourd'hui. Tu peux avancer sur un nouveau chapitre !</p>`;

  container.innerHTML = `
    <div class="page-header">
      <h1>Tableau de bord</h1>
      <p>Suivi de ta préparation au CAPES externe 2027.</p>
    </div>

    <div class="kpi-grid">
      <div class="card kpi-card">
        <span class="kpi-label">Objectif cette semaine</span>
        <div class="kpi-value">${formatHours(stats.weeklyMinutes)} <span style="font-size: 1rem; font-weight: 400; color: var(--text-muted);">/ ${formatHours(stats.weeklyGoal)}</span></div>
        <div class="progress-track">
          <div class="progress-fill" style="width: ${weeklyPercent}%"></div>
        </div>
      </div>

      <div class="card kpi-card">
        <span class="kpi-label">Maîtrise du programme</span>
        <div class="kpi-value">${stats.globalPercent}%</div>
        <span class="kpi-sub">${stats.masteredNotions} maîtrisées • ${stats.progressNotions} en cours sur ${stats.totalNotions}</span>
      </div>

      <div class="card kpi-card">
        <span class="kpi-label">Révisions du jour</span>
        <div class="kpi-value">${totalDue}</div>
        <span class="kpi-sub">${stats.activeErrorsCount} erreur(s) active(s) dans le carnet</span>
      </div>
    </div>

    <div class="card">
      <h2 style="font-size: 1.1rem; margin-bottom: 0.25rem;">Enregistrer une séance de travail</h2>
      <p style="font-size: 0.85rem; color: var(--text-muted);">Note le temps passé à réviser ou faire des exercices aujourd'hui.</p>
      <form id="add-session-form" class="session-form">
        <select id="session-domain" class="select-control" required>
          ${domainOptions}
        </select>
        <select id="session-duration" class="select-control">
          <option value="30">30 min</option>
          <option value="45">45 min</option>
          <option value="60" selected>1h00</option>
          <option value="90">1h30</option>
          <option value="120">2h00</option>
        </select>
        <input type="text" id="session-note" class="input-control" placeholder="Ex: Fiche groupes + 2 exercices">
        <button type="submit" class="btn-primary">+ Ajouter</button>
      </form>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem;">
      <div class="card">
        <h2 style="font-size: 1.1rem; margin-bottom: 0.75rem;">📅 Révisions dues aujourd'hui (Répétition espacée)</h2>
        ${dueHTML}
      </div>

      <div class="card">
        <h2 style="font-size: 1.1rem; margin-bottom: 1rem;">Avancement par domaine</h2>
        ${domainsHTML}
      </div>
    </div>
  `;

  document.getElementById('add-session-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const domain = document.getElementById('session-domain').value;
    const duration = document.getElementById('session-duration').value;
    const note = document.getElementById('session-note').value.trim();

    store.addSession(duration, domain, note);
    renderDashboard(container, rerenderMath);
  });

  document.querySelectorAll('[data-goto]').forEach(el => {
    el.addEventListener('click', () => {
      window.location.hash = el.dataset.goto;
    });
  });

  rerenderMath();
}