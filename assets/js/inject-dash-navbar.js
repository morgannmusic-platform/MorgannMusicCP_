// Injecte la navbar dash dans #navbar-inject sur toutes les pages du dash
fetch('/dash/navbar.html')
  .then(r => r.text())
  .then(html => {
    document.getElementById('navbar-inject').innerHTML = html;
    // Charger dynamiquement dash-navbar.js après l'injection
    const script = document.createElement('script');
    script.src = '/assets/js/dash-navbar.js';
    script.onload = function() {
      if (window.initDashNavbarMenus) window.initDashNavbarMenus();
    };
    document.body.appendChild(script);
  });
