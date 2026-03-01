// Synchronous theme init — loaded in <head> to prevent flash of wrong theme.
;(function () {
  var stored = localStorage.getItem('agentforge-theme')
  var prefersDark =
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches

  if (stored === 'dark' || (stored !== 'light' && prefersDark)) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
})()
