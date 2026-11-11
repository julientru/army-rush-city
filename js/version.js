// The game's version, kept here only. Army Rush City is full screen, so its <body> carries data-no-footer
// and the "© Julien Tru - Version x.y.z" footer other pages get is not shown.
var APP_VERSION = "1.0.1";

(function () {
  if (document.body.hasAttribute("data-no-footer")) return;
  var footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = '<span class="copyleft">&copy;</span> Julien Tru - Version ' + APP_VERSION;
  document.body.appendChild(footer);
})();
