import { store } from './store.js';
import { renderSyllabus } from './views/syllabus.js';
import { renderDashboard } from './views/dashboard.js';
import { renderSettings } from './views/settings.js';
import { renderExercises } from './views/exercises.js';
import { renderErrors } from './views/errors.js';
import { renderMockExam } from './views/mock-exam.js';


const placeholderViews = {
  dashboard: (container) => {
    container.innerHTML = `
      <div class="page-header">
        <h1>Tableau de bord</h1>
        <p>Vue d'ensemble de ta préparation au CAPES 2027.</p>
      </div>
      <p>Nous construirons les statistiques à l'étape suivante !</p>
    `;
  },
  exercices: (container) => {
    container.innerHTML = `
      <div class="page-header">
        <h1>Banque d'exercices</h1>
        <p>Entraînement ciblé par chapitre et difficulté.</p>
      </div>
      <p>La liste des exercices apparaîtra ici.</p>
    `;
  },
  parametres: (container) => {
    container.innerHTML = `
      <div class="page-header">
        <h1>Données & Réglages</h1>
        <p>Sauvegarde locale et export JSON.</p>
      </div>
      <p>Les boutons d'export/import apparaîtront ici.</p>
    `;
  }
};

function renderMath(container) {
  if (window.renderMathInElement) {
    renderMathInElement(container, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false }
      ]
    });
  }
}

function router() {
  const hash = window.location.hash.slice(1) || 'dashboard';
  const viewContainer = document.getElementById('app-view');

  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.route === hash);
  });

  const mathCallback = () => renderMath(viewContainer);

  switch (hash) {
    case 'programme':
      renderSyllabus(viewContainer, mathCallback);
      break;
    case 'exercices':
      renderExercises(viewContainer, mathCallback);
      break;
    case 'parametres':
      renderSettings(viewContainer);
      break;
    case 'erreurs':
      renderErrors(viewContainer, mathCallback);
      break;
    case 'sujets':
      renderMockExam(viewContainer, mathCallback);
      break;
    case 'dashboard':
    default:
      renderDashboard(viewContainer, mathCallback);
      break;
  }
}

async function bootstrap() {
  await store.init();
  router();
}

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', bootstrap);