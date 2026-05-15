// dash-navbar.js


window.initDashNavbarMenus = function () {
  // Nettoyage : retire les anciens listeners globaux pour éviter les doublons
  if (window._navbarMenuClickHandler) {
    document.removeEventListener('click', window._navbarMenuClickHandler);
  }
  // Menu déroulant album
  const menuIcon = document.getElementById('menu-icon');
  const menuDropdown = document.getElementById('menu-dropdown');
  if (menuIcon && menuDropdown) {
    menuIcon.addEventListener('click', function (e) {
      e.stopPropagation();
      menuDropdown.style.display = menuDropdown.style.display === 'block' ? 'none' : 'block';
      if (notifDropdown) notifDropdown.style.display = 'none';
    });
  }

  // Menu déroulant notifications
  const notifIcon = document.getElementById('notif-icon');
  const notifDropdown = document.getElementById('notif-dropdown');
  if (notifIcon && notifDropdown) {
    notifIcon.addEventListener('click', function (e) {
      e.stopPropagation();
      notifDropdown.style.display = notifDropdown.style.display === 'block' ? 'none' : 'block';
      if (menuDropdown) menuDropdown.style.display = 'none';
    });
  }

  // Fermer les menus si clic ailleurs
  window._navbarMenuClickHandler = function () {
    if (menuDropdown) menuDropdown.style.display = 'none';
    if (notifDropdown) notifDropdown.style.display = 'none';
  };
  document.addEventListener('click', window._navbarMenuClickHandler);

  // Simuler les 5 dernières notifications (à remplacer par appel API)
  const notifList = document.getElementById('notif-list');
  if (notifList) {
    const notifications = [
      { text: 'Nouvelle sortie publiée', date: '26/04/2026' },
      { text: 'Votre demande a été acceptée', date: '25/04/2026' },
      { text: 'Paiement reçu', date: '24/04/2026' },
      { text: 'Sortie en attente de validation', date: '23/04/2026' },
      { text: 'Profil mis à jour', date: '22/04/2026' }
    ];
    notifList.innerHTML = notifications.map(n => `<div class="notif-item"><span>${n.text}</span><br><small>${n.date}</small></div>`).join('');
  }
};
