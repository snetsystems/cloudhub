(window).mxLoadResources = false;
(window).mxForceIncludes = false;
(window).mxResourceExtension = '.txt';
(window).mxLoadStylesheets = false;

// A development aid for failures that happen before React can render, which
// otherwise leave nothing but a blank page: both handlers paint into the
// #error-overlay div in index.html, which covers the whole viewport.
//
// It stays out of released builds. `make assets` runs `vite build`, where
// import.meta.env.DEV is the literal false and everything below is dropped
// from the bundle -- worth keeping that way, since the overlay puts a stack
// trace in front of whoever is using the page. `yarn start` and
// `yarn dev-build` both run in development mode and keep it.
if (import.meta.env.DEV) {
  window.onerror = function(msg, url, line, col, error) {
    var el = document.getElementById('error-overlay');
    if (el) {
      el.style.display = 'block';
      el.innerHTML += 'Error: ' + msg + '\nURL: ' + url + '\nLine: ' + line + ':' + col + '\n' + (error && error.stack ? error.stack : '') + '\n\n';
    }
  };
  window.addEventListener("unhandledrejection", function(event) {
    var el = document.getElementById('error-overlay');
    if (el) {
      var reason = event.reason;
      var reasonText = '';
      if (reason && reason.stack) {
        reasonText = reason.stack;
      } else if (typeof reason === 'object') {
        try {
          reasonText = JSON.stringify(reason, null, 2);
        } catch (e) {
          reasonText = String(reason);
        }
      } else {
        reasonText = String(reason);
      }
      el.style.display = 'block';
      el.innerHTML += 'Unhandled Rejection: ' + reasonText + '\n\n';
    }
  });
}
