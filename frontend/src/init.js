(window).mxLoadResources = false;
(window).mxForceIncludes = false;
(window).mxResourceExtension = '.txt';
(window).mxLoadStylesheets = false;

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
    el.style.display = 'block';
    el.innerHTML += 'Unhandled Rejection: ' + (event.reason && event.reason.stack ? event.reason.stack : event.reason) + '\n\n';
  }
});
