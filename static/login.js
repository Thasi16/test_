(function () {
  'use strict';

  const AUTH_KEY = 'signhearing:demo-auth';
  const USER_KEY = 'signhearing:demo-user';
  const form = document.getElementById('login-form');
  const transition = document.querySelector('[data-login-transition]');
  const mascot = transition && transition.querySelector('.login-transition-mascot');
  const transitionUser = transition && transition.querySelector('[data-transition-user]');
  const error = form && form.querySelector('[data-login-error]');
  if (!form || !transition || !mascot || !error) return;

  const locale = document.documentElement.lang === 'en' ? 'en' : 'vi';
  const incomingNext = new URLSearchParams(window.location.search).get('next');
  if (incomingNext) {
    document.querySelectorAll('.language-switch a').forEach(link => {
      const target = new URL(link.href);
      target.searchParams.set('next', incomingNext);
      link.href = target.toString();
    });
  }
  const destination = () => {
    const candidate = incomingNext;
    if (candidate) {
      try {
        const parsed = new URL(candidate, window.location.origin);
        if (parsed.origin === window.location.origin && /^\/app(?:\/|$)/.test(parsed.pathname)) {
          parsed.searchParams.set('lang', locale);
          return parsed.pathname + parsed.search + parsed.hash;
        }
      } catch (ignored) { /* use the learning-area default */ }
    }
    return '/app?lang=' + locale;
  };

  form.addEventListener('submit', event => {
    event.preventDefault();
    const username = form.elements.username.value.trim();
    const password = form.elements.password.value;
    if (!username || !password) {
      error.textContent = form.dataset.requiredMessage;
      error.hidden = false;
      (!username ? form.elements.username : form.elements.password).focus();
      return;
    }

    error.hidden = true;
    try {
      window.localStorage.setItem(AUTH_KEY, 'true');
      window.localStorage.setItem(USER_KEY, username.slice(0, 80));
    } catch (ignored) { /* cookie fallback below */ }
    document.cookie = 'signhearing_demo_auth=1; Path=/; Max-Age=31536000; SameSite=Lax';
    document.cookie = 'signhearing_demo_user=' + encodeURIComponent(username.slice(0, 80)) + '; Path=/; Max-Age=31536000; SameSite=Lax';

    Array.from(form.elements).forEach(control => { control.disabled = true; });
    if (transitionUser) {
      const safeUsername = username.slice(0, 80);
      transitionUser.textContent = locale === 'vi'
        ? 'Xin chào, ' + safeUsername + '!'
        : 'Welcome, ' + safeUsername + '!';
    }
    transition.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-authenticating');
    window.setTimeout(() => document.body.classList.add('is-auth-welcoming'), 1150);

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      window.location.replace(destination());
    };
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    mascot.addEventListener('animationend', finish, {once:true});
    window.setTimeout(finish, reduced ? 700 : 3200);
  });
})();
