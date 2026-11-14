import { store } from '../store.js';

function formatHours(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`;
}

export function renderDashboard(container, rerenderMath) {
  const stats = store.getStats();
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

  const priorityHTML = stats.priorityNotions.length > 0
    ? `<ul class="notion-list" style="border-top: none;">
        ${stats.priorityNotions.map(item => `
          <li class="notion-item" style="padding-left: 0; padding-right: 0;" data-goto-notion="${item.notion.id}">
            <div>
              <span class="chapter-domain-tag">${item.domaineTitre} • ${item.chapitreTitre}</span>
              <strong>${item.notion.titre}</strong>
            </div>
            <span class="badge badge-review">À revoir</span>
          </li>
        `).join('')}
      </ul>`
    : `<p style="color: var(--text-muted); font-size: 0.95rem;">Aucune notion marquée "À revoir" pour le moment. Continue comme ça !</p>`;

  container.innerHTML = `
    <div class="page-header">
      <h1>Tableau de bord</h1>
      <p>Suivi de ta préparation au CAPES externe 2027.</p>
    </div>

    <!-- Indicateurs clés -->
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
        <span class="kpi-label">Temps cumulé total</span>
        <div class="kpi-value">${formatHours(stats.totalMinutesAllTime)}</div>
        <span class="kpi-sub">${store.userState.sessions.length} session(s) enregistrée(s)</span>
      </div>
    </div>

    <!-- Ajout rapide d'une session de travail -->
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

    <!-- Progression par domaine & Priorités -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem;">
      <div class="card">
        <h2 style="font-size: 1.1rem; margin-bottom: 1rem;">Avancement par domaine</h2>
        ${domainsHTML}
      </div>

      <div class="card">
        <h2 style="font-size: 1.1rem; margin-bottom: 0.75rem;">Notions prioritaires à revoir</h2>
        ${priorityHTML}
      </div>
    </div>
  `;

  // Événement d'ajout de session
  document.getElementById('add-session-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const domain = document.getElementById('session-domain').value;
    const duration = document.getElementById('session-duration').value;
    const note = document.getElementById('session-note').value.trim();

    store.addSession(duration, domain, note);
    renderDashboard(container, rerenderMath);
  });

  // Clic sur une notion prioritaire -> bascule vers l'onglet Programme
  document.querySelectorAll('[data-goto-notion]').forEach(el => {
    el.addEventListener('click', () => {
      window.location.hash = 'programme';
    });
  });

  rerenderMath();
}