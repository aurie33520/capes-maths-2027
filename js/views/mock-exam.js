import { store } from '../store.js';

// États possibles de la vue : 'config' | 'exam' | 'review'
let examPhase = 'config';
let currentExam = {
  durationMinutes: 60,
  exercises: [],
  evaluations: {}, // { [exoId]: 'success' | 'partial' | 'failed' }
  elapsedSeconds: 0,
  sessionLogged: false
};

let countdownInterval = null;

function clearExamTimer() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

function formatCountdown(remainingSeconds) {
  const isNegative = remainingSeconds < 0;
  const abs = Math.abs(remainingSeconds);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60).toString().padStart(2, '0');
  const s = (abs % 60).toString().padStart(2, '0');
  const prefix = isNegative ? '-' : '';
  return h > 0 ? `${prefix}${h}h${m}:${s}` : `${prefix}${m}:${s}`;
}

// Algorithme de sélection aléatoire pondérée des exercices
function generateExerciseSelection({ count, selectedDomains, prioritizeWeak }) {
  let pool = store.exercices.filter(exo => selectedDomains.includes(exo.domaineId));

  if (pool.length === 0) return [];

  // Mélange aléatoire (Fisher-Yates)
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  if (prioritizeWeak) {
    // Trie pour mettre en avant 'failed', puis 'partial', puis 'todo', et 'success' en dernier
    const priorityScore = { failed: 1, partial: 2, todo: 3, success: 4 };
    shuffled.sort((a, b) => {
      const statA = store.getExerciseProgress(a.id).dernierStatut;
      const statB = store.getExerciseProgress(b.id).dernierStatut;
      return (priorityScore[statA] || 3) - (priorityScore[statB] || 3);
    });
  }

  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export function renderMockExam(container, rerenderMath) {
  clearExamTimer();

  if (examPhase === 'exam') {
    renderActiveExam(container, rerenderMath);
  } else if (examPhase === 'review') {
    renderExamReview(container, rerenderMath);
  } else {
    renderExamConfig(container, rerenderMath);
  }
}

// --- PHASE 1 : CONFIGURATION DU SUJET ---
function renderExamConfig(container, rerenderMath) {

    const domaines = store.programme.domaines;

  const domainCheckboxes = domaines.map(d => {
    const countInDomain = store.exercices.filter(e => e.domaineId === d.id).length;
    return `
      <label style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; border: 1px solid var(--border); border-radius: 8px; cursor: pointer;">
        <input type="checkbox" name="exam-domain" value="${d.id}" checked>
        <span>${d.titre} <small style="color: var(--text-muted);">(${countInDomain} exo(s))</small></span>
      </label>
    `;
  }).join('');

  container.innerHTML = `
    <div class="page-header">
      <h1>Générateur de sujets blancs</h1>
      <p>Compose une épreuve sur mesure en conditions réelles (chronomètre et corrections masquées).</p>
    </div>

    <div class="card">
      <form id="exam-config-form" style="display: flex; flex-direction: column; gap: 1.25rem;">
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
          <div>
            <label style="display: block; font-weight: 600; margin-bottom: 0.4rem;">Durée de l'épreuve</label>
            <select id="exam-duration" class="select-control" style="width: 100%;">
              <option value="30">30 minutes (Sprint)</option>
              <option value="60" selected>1 heure (Entraînement court)</option>
              <option value="120">2 heures (Demi-épreuve)</option>
              <option value="240">4 heures (Format CAPES)</option>
            </select>
          </div>

          <div>
            <label style="display: block; font-weight: 600; margin-bottom: 0.4rem;">Nombre d'exercices</label>
            <select id="exam-count" class="select-control" style="width: 100%;">
              <option value="2" selected>2 exercices</option>
              <option value="3">3 exercices</option>
              <option value="4">4 exercices</option>
              <option value="5">5 exercices</option>
            </select>
          </div>
        </div>

        <div>
          <label style="display: block; font-weight: 600; margin-bottom: 0.5rem;">Domaines à inclure</label>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.5rem;">
            ${domainCheckboxes}
          </div>
        </div>

        <label style="display: flex; align-items: center; gap: 0.6rem; cursor: pointer; font-weight: 500;">
          <input type="checkbox" id="exam-prioritize-weak" checked>
          Prioriser mes lacunes (exercices non faits ou à refaire en premier)
        </label>

        <div id="exam-config-error" style="color: var(--status-review); font-size: 0.9rem; display: none;"></div>

        <div>
          <button type="submit" class="btn-primary">🚀 Générer et démarrer l'épreuve</button>
        </div>
      </form>
    </div>
  `;

  document.getElementById('exam-config-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const duration = Number(document.getElementById('exam-duration').value);
    const count = Number(document.getElementById('exam-count').value);
    const prioritizeWeak = document.getElementById('exam-prioritize-weak').checked;
    const selectedDomains = Array.from(document.querySelectorAll('input[name="exam-domain"]:checked'))
      .map(cb => cb.value);

    const errorBox = document.getElementById('exam-config-error');
    if (selectedDomains.length === 0) {
      errorBox.textContent = 'Sélectionne au moins un domaine.';
      errorBox.style.display = 'block';
      return;
    }

    const selectedExos = generateExerciseSelection({ count, selectedDomains, prioritizeWeak });
    if (selectedExos.length === 0) {
      errorBox.textContent = 'Aucun exercice disponible dans les domaines sélectionnés.';
      errorBox.style.display = 'block';
      return;
    }

    currentExam = {
      durationMinutes: duration,
      exercises: selectedExos,
      evaluations: {},
      elapsedSeconds: 0,
      sessionLogged: false
    };
    examPhase = 'exam';
    renderMockExam(container, rerenderMath);
  });
}

// --- PHASE 2 : MODE EXAMEN (SANS INDICES NI CORRECTIONS) ---
function renderActiveExam(container, rerenderMath) {
  const totalSeconds = currentExam.durationMinutes * 60;

  const exercisesHTML = currentExam.exercises.map((exo, index) => {
    const domainObj = store.programme.domaines.find(d => d.id === exo.domaineId);
    const stars = '★'.repeat(exo.difficulte) + '☆'.repeat(3 - exo.difficulte);

    return `
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <span class="chapter-domain-tag">Exercice ${index + 1} • ${domainObj ? domainObj.titre : exo.domaineId}</span>
          <span style="font-size: 0.85rem; color: var(--text-muted);">Difficulté : ${stars} • ~${exo.dureeEstimeeMinutes} min</span>
        </div>
        <h2 style="font-size: 1.2rem; margin-bottom: 0.75rem;">${exo.titre}</h2>
        <div class="exo-statement" style="margin-bottom: 0;">
          ${exo.enonce}
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="card" style="position: sticky; top: 0.5rem; z-index: 50; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; border-color: var(--primary);">
      <div>
        <strong>Mode Examen en cours</strong>
        <span style="display: block; font-size: 0.8rem; color: var(--text-muted);">${currentExam.exercises.length} exercice(s) • Corrections verrouillées</span>
      </div>

      <div style="display: flex; align-items: center; gap: 1rem;">
        <div class="timer-bar" style="font-size: 1.1rem;">
          ⏳ <span id="exam-countdown">${formatCountdown(totalSeconds - currentExam.elapsedSeconds)}</span>
        </div>
        <button id="btn-finish-exam" class="btn-primary">Terminer et corriger</button>
      </div>
    </div>

    ${exercisesHTML}
  `;

  countdownInterval = setInterval(() => {
    currentExam.elapsedSeconds++;
    const remaining = totalSeconds - currentExam.elapsedSeconds;
    const display = document.getElementById('exam-countdown');
    if (display) {
      display.textContent = formatCountdown(remaining);
      if (remaining <= 300) display.style.color = 'var(--status-review)'; // Alerte rouge les 5 dernières minutes
    }
  }, 1000);

  document.getElementById('btn-finish-exam').addEventListener('click', () => {
    clearExamTimer();
    examPhase = 'review';
    renderMockExam(container, rerenderMath);
  });

  rerenderMath();
}

// --- PHASE 3 : CORRECTION ET BILAN ---
function renderExamReview(container, rerenderMath) {
  const actualMinutes = Math.max(1, Math.round(currentExam.elapsedSeconds / 60));
  const totalExos = currentExam.exercises.length;
  const evaluatedCount = Object.keys(currentExam.evaluations).length;
  const successCount = Object.values(currentExam.evaluations).filter(v => v === 'success').length;

  const reviewCardsHTML = currentExam.exercises.map((exo, idx) => {
    const evalStatus = currentExam.evaluations[exo.id] || null;

    return `
      <div class="card">
        <span class="chapter-domain-tag">Exercice ${idx + 1}</span>
        <h2 style="font-size: 1.2rem; margin-bottom: 0.5rem;">${exo.titre}</h2>
        
        <div class="exo-statement">
          ${exo.enonce}
        </div>

        <div class="correction-box">
          <h3 style="color: #047857; margin-bottom: 0.5rem;">Correction détaillée</h3>
          <div>${exo.correction}</div>
        </div>

        <div style="margin-top: 1rem; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem;">
          <span style="font-weight: 600; font-size: 0.9rem;">Auto-évaluation :</span>
          <div style="display: flex; gap: 0.5rem;">
            <button class="status-btn ${evalStatus === 'failed' ? 'active' : ''}" data-status="review" data-exo-eval="${exo.id}" data-val="failed">❌ Échoué</button>
            <button class="status-btn ${evalStatus === 'partial' ? 'active' : ''}" data-status="progress" data-exo-eval="${exo.id}" data-val="partial">⚠️ Partiel</button>
            <button class="status-btn ${evalStatus === 'success' ? 'active' : ''}" data-status="mastered" data-exo-eval="${exo.id}" data-val="success">✅ Réussi</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="page-header">
      <h1>Correction & Bilan du sujet blanc</h1>
      <p>Temps passé : <strong>${actualMinutes} min</strong> • Exercices évalués : <strong>${evaluatedCount}/${totalExos}</strong> (${successCount} réussi(s))</p>
    </div>

    <div class="card" style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem; background: var(--primary-light); border-color: var(--primary);">
      <div>
        <strong>Enregistrer ce sujet dans ton temps de travail hebdomadaire ?</strong>
        <p style="font-size: 0.85rem; color: var(--text-muted);">Ajoute automatiquement ${actualMinutes} min à ton compteur de la semaine.</p>
      </div>
      ${currentExam.sessionLogged
        ? `<span class="badge badge-mastered">✅ Séance enregistrée</span>`
        : `<button id="btn-log-exam-time" class="btn-primary">+ Ajouter ${actualMinutes} min au suivi</button>`
      }
    </div>

    ${reviewCardsHTML}

    <div style="margin-top: 1.5rem; margin-bottom: 2rem;">
      <button id="btn-new-exam" class="btn-secondary">← Configurer un nouveau sujet blanc</button>
    </div>
  `;

  // Auto-évaluation d'un exercice (met à jour le store et la répétition espacée)
  document.querySelectorAll('[data-exo-eval]').forEach(btn => {
    btn.addEventListener('click', () => {
      const exoId = btn.dataset.exoEval;
      const val = btn.dataset.val;
      currentExam.evaluations[exoId] = val;
      store.setExerciseResult(exoId, val);
      renderExamReview(container, rerenderMath);
    });
  });

  // Enregistrement du temps de travail
  const btnLog = document.getElementById('btn-log-exam-time');
  if (btnLog) {
    btnLog.addEventListener('click', () => {
      const firstDomain = currentExam.exercises[0]?.domaineId || 'algebre';
      store.addSession(actualMinutes, firstDomain, `Sujet blanc (${totalExos} exercices)`);
      currentExam.sessionLogged = true;
      renderExamReview(container, rerenderMath);
    });
  }

  document.getElementById('btn-new-exam').addEventListener('click', () => {
    examPhase = 'config';
    renderMockExam(container, rerenderMath);
  });

  rerenderMath();
}