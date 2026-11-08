(function(){'use strict';
  const SH = window.SH;
  const root = document.querySelector('.m-account .account-page');
  if (!SH || !root) return;
  const message = root.querySelector('[data-plan-message]');
  const accountName = root.querySelector('[data-account-name]');
  const username = SH.auth && SH.auth.username();
  if (accountName && username) accountName.textContent = username;
  const logout = root.querySelector('[data-account-logout]');
  if (logout && SH.auth) logout.addEventListener('click', () => SH.auth.logout());
  root.addEventListener('click', event => {
    const button = event.target.closest('[data-plan-choice]');
    if (!button) return;
    message.textContent = SH.t('account.plan.unavailable', {plan:button.dataset.planChoice});
    message.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',block:'nearest'});
  });
})();
