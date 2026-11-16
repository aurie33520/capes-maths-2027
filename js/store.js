const STORAGE_KEY = 'capes_maths_2027_state';

const defaultUserState = {
  version: '1.1',
  objectifHebdoMinutes: 360,
  sessions: [],
  maitriseNotions: {},      // { [notionId]: { statut, notes, updatedAt, intervalDays, nextReviewDate } }
  historiqueExercices: {},  // { [exoId]: { tentatives, dernierStatut, date, intervalDays, nextReviewDate } }
  erreurs: []               // [{ id, date, exoId, notionId, domaineId, type, description, resolved }]
};

// Calcul de la prochaine date de révision (Répétition espacée simplifiée type SM-2)
function computeNextReview(status, currentInterval = 0) {
  let nextInterval = 1;
  if (status === 'review' || status === 'failed') {
    nextInterval = 1; // Revoir dès demain
  } else if (status === 'progress' || status === 'partial') {
    nextInterval = 3; // Revoir dans 3 jours
  } else if (status === 'mastered' || status === 'success') {
    if (currentInterval <= 1) nextInterval = 7;
    else if (currentInterval <= 7) nextInterval = 15;
    else nextInterval = Math.min(60, Math.round(currentInterval * 2));
  }

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + nextInterval);
  return {
    intervalDays: nextInterval,
    nextReviewDate: nextDate.toISOString().split('T')[0]
  };
}

class Store {
    constructor() {
    this.programme = { domaines: [] };
    this.exercices = [];
    this.userState = this.loadUserState();
    this.pendingNavigation = null; // Permet d'ouvrir directement une notion ou un exercice depuis une autre vue
  }

  async init() {
    try {
      const [progRes, exoRes] = await Promise.all([
        fetch('./data/programme.json'),
        fetch('./data/exercices.json')
      ]);
      if (!progRes.ok) throw new Error('Erreur chargement programme.json');
      if (!exoRes.ok) throw new Error('Erreur chargement exercices.json');
      
      this.programme = await progRes.json();
      const exoData = await exoRes.json();
      this.exercices = exoData.exercices || [];
    } catch (error) {
      console.error('Impossible de charger les données :', error);
    }
  }

  loadUserState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return structuredClone(defaultUserState);
    try {
      const parsed = JSON.parse(saved);
      return {
        ...structuredClone(defaultUserState),
        ...parsed,
        erreurs: Array.isArray(parsed.erreurs) ? parsed.erreurs : []
      };
    } catch {
      return structuredClone(defaultUserState);
    }
  }

  saveUserState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.userState));
  }

  // --- GESTION DES NOTIONS ---

  getNotionProgress(notionId) {
    return this.userState.maitriseNotions[notionId] || {
      statut: 'todo',
      notes: '',
      updatedAt: null,
      intervalDays: 0,
      nextReviewDate: null
    };
  }

  setNotionStatus(notionId, statut) {
    const current = this.getNotionProgress(notionId);
    const schedule = statut === 'todo'
      ? { intervalDays: 0, nextReviewDate: null }
      : computeNextReview(statut, current.intervalDays);

    this.userState.maitriseNotions[notionId] = {
      ...current,
      statut,
      updatedAt: new Date().toISOString(),
      ...schedule
    };
    this.saveUserState();
  }

  setNotionNotes(notionId, notes) {
    const current = this.getNotionProgress(notionId);
    this.userState.maitriseNotions[notionId] = {
      ...current,
      notes,
      updatedAt: new Date().toISOString()
    };
    this.saveUserState();
  }

  findNotionById(notionId) {
    for (const domaine of this.programme.domaines) {
      for (const chapitre of domaine.chapitres) {
        const notion = chapitre.notions.find(n => n.id === notionId);
        if (notion) {
          return { notion, chapitre, domaine };
        }
      }
    }
    return null;
  }

  findChapitreById(chapitreId) {
    for (const domaine of this.programme.domaines) {
      const chapitre = domaine.chapitres.find(c => c.id === chapitreId);
      if (chapitre) {
        return { chapitre, domaine };
      }
    }
    return null;
  }

  getNotionsForExercise(exo) {
    if (!exo || !Array.isArray(exo.notionIds)) return [];
    return exo.notionIds
      .map(id => this.findNotionById(id))
      .filter(Boolean);
  }

  getExercisesForNotion(notionId) {
    return this.exercices.filter(
      exo => Array.isArray(exo.notionIds) && exo.notionIds.includes(notionId)
    );
  }


  // --- GESTION DES EXERCICES ---

  getExerciseProgress(exoId) {
    return this.userState.historiqueExercices[exoId] || {
      tentatives: 0,
      dernierStatut: 'todo',
      date: null,
      intervalDays: 0,
      nextReviewDate: null
    };
  }

  setExerciseResult(exoId, statut) {
    const current = this.getExerciseProgress(exoId);
    const schedule = computeNextReview(statut, current.intervalDays);

    this.userState.historiqueExercices[exoId] = {
      tentatives: current.tentatives + 1,
      dernierStatut: statut,
      date: new Date().toISOString(),
      ...schedule
    };
    this.saveUserState();
  }

  // --- CARNET D'ERREURS ---

  addError({ exoId = null, notionId = null, domaineId = 'algebre', type, description }) {
    const today = new Date().toISOString().split('T')[0];
    this.userState.erreurs.unshift({
      id: Date.now().toString(),
      date: today,
      exoId,
      notionId,
      domaineId,
      type,
      description,
      resolved: false
    });
    this.saveUserState();
  }

  toggleErrorResolved(errorId) {
    const err = this.userState.erreurs.find(e => e.id === errorId);
    if (err) {
      err.resolved = !err.resolved;
      this.saveUserState();
    }
  }

  deleteError(errorId) {
    this.userState.erreurs = this.userState.erreurs.filter(e => e.id !== errorId);
    this.saveUserState();
  }

  // --- RÉPÉTITION ESPACÉE : RÉVISIONS DUES AUJOURD'HUI ---

  getDueReviews() {
    const today = new Date().toISOString().split('T')[0];
    const dueNotions = [];
    const dueExercises = [];

    for (const domaine of this.programme.domaines) {
      for (const chapitre of domaine.chapitres) {
        for (const notion of chapitre.notions) {
          const prog = this.getNotionProgress(notion.id);
          if (prog.nextReviewDate && prog.nextReviewDate <= today) {
            dueNotions.push({ notion, chapitreTitre: chapitre.titre, domaineTitre: domaine.titre, prog });
          }
        }
      }
    }

    for (const exo of this.exercices) {
      const prog = this.getExerciseProgress(exo.id);
      if (prog.nextReviewDate && prog.nextReviewDate <= today) {
        dueExercises.push({ exo, prog });
      }
    }

    return { dueNotions, dueExercises };
  }

  // --- GESTION DU TEMPS DE TRAVAIL ---

  addSession(dureeMinutes, domaineId, note = '') {
    const today = new Date().toISOString().split('T')[0];
    this.userState.sessions.unshift({
      id: Date.now().toString(),
      date: today,
      dureeMinutes: Number(dureeMinutes),
      domaineId,
      note
    });
    this.saveUserState();
  }

  setWeeklyGoal(minutes) {
    this.userState.objectifHebdoMinutes = Number(minutes);
    this.saveUserState();
  }

  getWeeklyMinutes() {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diffToMonday);
    monday.setHours(0, 0, 0, 0);

    return this.userState.sessions
      .filter(s => new Date(s.date) >= monday)
      .reduce((acc, s) => acc + s.dureeMinutes, 0);
  }

  // --- CALCUL DES STATISTIQUES ---

  getStats() {
    let totalNotions = 0;
    let masteredNotions = 0;
    let progressNotions = 0;
    const priorityNotions = [];
    const domainStats = [];

    for (const domaine of this.programme.domaines) {
      let domTotal = 0;
      let domMastered = 0;

      for (const chapitre of domaine.chapitres) {
        for (const notion of chapitre.notions) {
          totalNotions++;
          domTotal++;
          const status = this.getNotionProgress(notion.id).statut;

          if (status === 'mastered') {
            masteredNotions++;
            domMastered++;
          } else if (status === 'progress') {
            progressNotions++;
          } else if (status === 'review') {
            priorityNotions.push({
              notion,
              chapitreTitre: chapitre.titre,
              domaineTitre: domaine.titre
            });
          }
        }
      }

      domainStats.push({
        id: domaine.id,
        titre: domaine.titre,
        total: domTotal,
        mastered: domMastered,
        percent: domTotal > 0 ? Math.round((domMastered / domTotal) * 100) : 0
      });
    }

    const totalMinutesAllTime = this.userState.sessions.reduce((acc, s) => acc + s.dureeMinutes, 0);
    const activeErrorsCount = this.userState.erreurs.filter(e => !e.resolved).length;

    return {
      totalNotions,
      masteredNotions,
      progressNotions,
      globalPercent: totalNotions > 0 ? Math.round((masteredNotions / totalNotions) * 100) : 0,
      domainStats,
      priorityNotions,
      weeklyMinutes: this.getWeeklyMinutes(),
      weeklyGoal: this.userState.objectifHebdoMinutes,
      totalMinutesAllTime,
      activeErrorsCount
    };
  }

  // --- EXPORT / IMPORT JSON ---

  exportData() {
    const dataStr = JSON.stringify(this.userState, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const dateStr = new Date().toISOString().split('T')[0];
    const a = document.createElement('a');
    a.href = url;
    a.download = `capes-maths-sauvegarde-${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importData(jsonString) {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object' || !parsed.maitriseNotions) {
      throw new Error('Format de fichier invalide.');
    }
    this.userState = {
      ...structuredClone(defaultUserState),
      ...parsed,
      erreurs: Array.isArray(parsed.erreurs) ? parsed.erreurs : []
    };
    this.saveUserState();
  }
}

export const store = new Store();