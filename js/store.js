const STORAGE_KEY = 'capes_maths_2027_state';

const defaultUserState = {
  version: '1.0',
  objectifHebdoMinutes: 360,
  sessions: [],
  maitriseNotions: {},
  historiqueExercices: {} // { [exoId]: { tentatives: 1, dernierStatut: 'success'|'partial'|'failed', date: 'ISO' } }
};

class Store {
  constructor() {
    this.programme = { domaines: [] };
    this.exercices = [];
    this.userState = this.loadUserState();
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
      return { ...structuredClone(defaultUserState), ...JSON.parse(saved) };
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
      updatedAt: null
    };
  }

  setNotionStatus(notionId, statut) {
    const current = this.getNotionProgress(notionId);
    this.userState.maitriseNotions[notionId] = {
      ...current,
      statut,
      updatedAt: new Date().toISOString()
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

  // --- GESTION DES EXERCICES ---

  getExerciseProgress(exoId) {
    return this.userState.historiqueExercices[exoId] || {
      tentatives: 0,
      dernierStatut: 'todo',
      date: null
    };
  }

  setExerciseResult(exoId, statut) {
    const current = this.getExerciseProgress(exoId);
    this.userState.historiqueExercices[exoId] = {
      tentatives: current.tentatives + 1,
      dernierStatut: statut,
      date: new Date().toISOString()
    };
    this.saveUserState();
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

    return {
      totalNotions,
      masteredNotions,
      progressNotions,
      globalPercent: totalNotions > 0 ? Math.round((masteredNotions / totalNotions) * 100) : 0,
      domainStats,
      priorityNotions,
      weeklyMinutes: this.getWeeklyMinutes(),
      weeklyGoal: this.userState.objectifHebdoMinutes,
      totalMinutesAllTime
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
    this.userState = { ...structuredClone(defaultUserState), ...parsed };
    this.saveUserState();
  }
}

export const store = new Store();