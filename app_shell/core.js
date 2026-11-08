/* SignHearing app core — shared by every learning module. Owned by the shell lead.
 *
 * Modules use ONLY this public API (window.SH). Do not read localStorage directly:
 * when a real backend arrives, only this file changes and every module keeps working.
 *
 *   SH.data            curriculum payload from the server (modules, lessons, signs; open content only)
 *   SH.t(key, vars)    UI string for the current page: SH.t('courses.signs', {n: 3})
 *   SH.url(path)       adds ?lang=vi|en to an internal link
 *   SH.lesson(id) / SH.sign(slug) / SH.signsOf(lessonId)
 *   SH.normalize(text) lower-case, no Vietnamese diacritics (for search)
 *   SH.auth.*          demo sign-in state used by the login and account screens
 *   SH.store.*         learner progress (see below); fires window event 'sh:store'
 */
(function () {
  'use strict';

  const readJson = (id) => {
    const el = document.getElementById(id);
    try { return el ? JSON.parse(el.textContent) : {}; } catch (error) { return {}; }
  };

  const data = readJson('sh-data');
  const strings = readJson('sh-i18n');
  const locale = document.documentElement.lang === 'en' ? 'en' : 'vi';

  /* ---------- demo authentication ---------- */
  const AUTH_KEY = 'signhearing:demo-auth';
  const AUTH_USER_KEY = 'signhearing:demo-user';
  const cookieValue = (name) => {
    const match = document.cookie.split('; ').find((item) => item.startsWith(name + '='));
    if (!match) return '';
    try { return decodeURIComponent(match.slice(name.length + 1)); } catch (error) { return ''; }
  };
  const authenticated = () => {
    try { if (window.localStorage.getItem(AUTH_KEY) === 'true') return true; } catch (error) { /* cookie fallback */ }
    return cookieValue('signhearing_demo_auth') === '1';
  };
  const authUsername = () => {
    try {
      const stored = window.localStorage.getItem(AUTH_USER_KEY);
      if (stored) return stored;
    } catch (error) { /* cookie fallback */ }
    return cookieValue('signhearing_demo_user');
  };
  if (!authenticated()) {
    const next = window.location.pathname + window.location.search + window.location.hash;
    window.location.replace('/login?lang=' + locale + '&next=' + encodeURIComponent(next));
    return;
  }
  document.body.classList.add('is-auth-ready');

  const t = (key, vars) => {
    let value = strings[key];
    if (value === undefined) {
      console.warn('[SH] missing string', key);
      return key;
    }
    Object.entries(vars || {}).forEach(([name, replacement]) => {
      value = value.split('{' + name + '}').join(String(replacement));
    });
    return value;
  };

  const url = (path) => path + (path.includes('?') ? '&' : '?') + 'lang=' + locale;
  const normalize = (text) => String(text || '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

  const lessons = new Map((data.lessons || []).map((l) => [String(l.id), l]));
  const signs = new Map((data.signs || []).map((s) => [s.slug, s]));

  /* ---------- progress store (localStorage, versioned) ---------- */
  const KEY = 'signhearing:v1';
  const empty = () => ({ lessons: {}, signs: {}, quiz: {}, practice: [], favorites: [], activity: null });
  let persistent = true;
  let state;
  try {
    state = Object.assign(empty(), JSON.parse(window.localStorage.getItem(KEY) || '{}'));
  } catch (error) {
    persistent = false;
    state = empty();
  }

  const save = (change) => {
    state.activity = Object.assign({ at: new Date().toISOString() }, change);
    if (persistent) {
      try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch (error) { persistent = false; }
    }
    window.dispatchEvent(new CustomEvent('sh:store', { detail: change }));
  };

  const LESSON_STATES = ['not_started', 'in_progress', 'completed'];

  const store = {
    persistent: () => persistent,

    lessonState: (id) => (state.lessons[id] && state.lessons[id].state) || 'not_started',
    setLessonState(id, value) {
      if (!LESSON_STATES.includes(value)) throw new Error('Unknown lesson state ' + value);
      const current = store.lessonState(id);
      if (current === 'completed' && value === 'in_progress') return; // never downgrade
      state.lessons[id] = { state: value, at: new Date().toISOString() };
      save({ type: 'lesson', id: String(id), state: value });
    },

    isSignSeen: (slug) => Boolean(state.signs[slug]),
    markSignSeen(slug) {
      if (state.signs[slug]) return;
      state.signs[slug] = { at: new Date().toISOString() };
      save({ type: 'sign', id: slug });
    },

    /* Quiz: the lesson is completed by the lesson module when score/total >= 0.8 (PRD rule). */
    quizResults: (lessonId) => (state.quiz[lessonId] || []).slice(),
    addQuizResult(lessonId, score, total) {
      (state.quiz[lessonId] = state.quiz[lessonId] || []).push({ score, total, at: new Date().toISOString() });
      save({ type: 'quiz', id: String(lessonId), score, total });
    },

    /* Self-practice (no AI): checklist = {handshape: true, location: false, ...} as ticked by the learner. */
    practiceLog: () => state.practice.slice(),
    addPractice(slug, checklist) {
      state.practice.push({ slug, checklist: Object.assign({}, checklist), at: new Date().toISOString() });
      if (state.practice.length > 500) state.practice.shift();
      save({ type: 'practice', id: slug });
    },

    isFavorite: (slug) => state.favorites.includes(slug),
    favorites: () => state.favorites.slice(),
    toggleFavorite(slug) {
      const on = !store.isFavorite(slug);
      state.favorites = on ? state.favorites.concat(slug) : state.favorites.filter((s) => s !== slug);
      save({ type: 'favorite', id: slug, on });
      return on;
    },

    summary() {
      const lessonValues = Object.values(state.lessons);
      return {
        lessonsCompleted: lessonValues.filter((l) => l.state === 'completed').length,
        lessonsInProgress: lessonValues.filter((l) => l.state === 'in_progress').length,
        lessonsOpen: (data.lessons || []).filter((l) => l.open).length,
        signsSeen: Object.keys(state.signs).length,
        practiceCount: state.practice.length,
        quizCount: Object.values(state.quiz).reduce((sum, list) => sum + list.length, 0),
        lastActivity: state.activity,
      };
    },

    export: () => JSON.parse(JSON.stringify(state)),
    reset() {
      state = empty();
      if (persistent) {
        try { window.localStorage.removeItem(KEY); } catch (error) { /* ignore */ }
      }
      window.dispatchEvent(new CustomEvent('sh:store', { detail: { type: 'reset' } }));
    },
  };

  const auth = Object.freeze({
    isAuthenticated: authenticated,
    username: authUsername,
    logout() {
      try {
        window.localStorage.removeItem(AUTH_KEY);
        window.localStorage.removeItem(AUTH_USER_KEY);
      } catch (error) { /* cookie cleanup still works */ }
      document.cookie = 'signhearing_demo_auth=; Path=/; Max-Age=0; SameSite=Lax';
      document.cookie = 'signhearing_demo_user=; Path=/; Max-Age=0; SameSite=Lax';
      window.location.replace('/login?lang=' + locale);
    },
  });

  window.SH = Object.freeze({
    data, locale, t, url, normalize, store, auth,
    lesson: (id) => lessons.get(String(id)) || null,
    sign: (slug) => signs.get(slug) || null,
    signsOf: (lessonId) => (data.signs || []).filter((s) => String(s.lesson) === String(lessonId)),
  });

  document.querySelectorAll('[data-shell-logout]').forEach(button => {
    button.addEventListener('click', () => auth.logout());
  });

  /* ---------- shell preferences ---------- */
  const sidebarToggle = document.querySelector('[data-sidebar-toggle]');
  if (sidebarToggle) {
    const SIDEBAR_KEY = 'signhearing:sidebar:collapsed';
    const page = document.body;
    let collapsed = false;
    try { collapsed = window.localStorage.getItem(SIDEBAR_KEY) === 'true'; } catch (error) { /* use default */ }

    const setSidebar = (next, savePreference) => {
      collapsed = Boolean(next);
      page.classList.toggle('is-sidebar-collapsed', collapsed);
      sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
      const label = collapsed ? sidebarToggle.dataset.labelExpand : sidebarToggle.dataset.labelCollapse;
      sidebarToggle.setAttribute('aria-label', label);
      sidebarToggle.setAttribute('title', label);
      if (savePreference) {
        try { window.localStorage.setItem(SIDEBAR_KEY, String(collapsed)); } catch (error) { /* preference is optional */ }
      }
    };

    document.documentElement.classList.add('has-sidebar-js');
    setSidebar(collapsed, false);
    sidebarToggle.addEventListener('click', () => setSidebar(!collapsed, true));
  }

  if (!persistent) {
    document.addEventListener('DOMContentLoaded', () => {
      const notice = document.querySelector('[data-runtime-notice]');
      if (notice) {
        notice.textContent = t('shell.storage.unavailable');
        notice.classList.add('sh-notice-warn');
        notice.hidden = false;
      }
    });
  }
})();
