gsap.registerPlugin(ScrollTrigger);

document.addEventListener("DOMContentLoaded", () => {
  // 1. ANIMATIONS D'ENTRÉE (Titres, Sous-titres, etc.)
  const revealOnScroll = (selector, distance = 30, delay = 0) => {
    const el = document.querySelector(selector);
    if (el) {
      gsap.fromTo(el,
        { opacity: 0, y: distance },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          delay: delay,
          ease: "power2.out",
          scrollTrigger: {
            trigger: el,
            start: "top bottom-=50",
            toggleActions: "play none none none"
          }
        }
      );
    }
  };

  revealOnScroll(".main-title", 30);
  revealOnScroll(".subtitle", 20, 0.1);
  revealOnScroll(".tagline", 15, 0.2);

  // Feature Cards
  const featureCards = document.querySelectorAll(".feature-card");
  if (featureCards.length) {
    featureCards.forEach((card) => {
      gsap.fromTo(card,
        { opacity: 0, y: 28 },
        {
          opacity: 1,
          y: 0,
          duration: 0.65,
          ease: "power2.out",
          scrollTrigger: {
            trigger: card,
            start: "top bottom-=50",
            toggleActions: "play none none none"
          },
          onComplete: () => gsap.set(card, { clearProps: "all" })
        }
      );
    });
  }

  // 2. SECTION PLATEFORMES (Tracks infinies)
  gsap.to(".platforms-section", {
    opacity: 1,
    duration: 1,
    scrollTrigger: {
      trigger: ".platforms-section",
      start: "top 80%"
    }
  });

  // Track 1 vers la gauche
  gsap.to(".track-1", {
    xPercent: -50,
    ease: "none",
    duration: 25,
    repeat: -1
  });

  // Track 2 vers la droite
  gsap.fromTo(".track-2", { xPercent: -50 }, {
    xPercent: 0,
    ease: "none",
    duration: 25,
    repeat: -1
  });

  // 3. TIMELINE
  document.querySelectorAll(".timeline-item").forEach((item) => {
    const isLeft = item.getAttribute("data-side") === "left";
    gsap.fromTo(item,
      { opacity: 0, x: isLeft ? -60 : 60 },
      {
        opacity: 1,
        x: 0,
        duration: 0.6,
        ease: "power2.out",
        scrollTrigger: {
          trigger: item,
          start: "top 80%",
          toggleActions: "play none none none"
        }
      }
    );
  });

  // 4. GESTION DU POPUP FEATURES
  const featuresPopup = document.getElementById("features-popup");
  const closePopupBtn = document.querySelector(".close-features-popup");
  const fonctionnalitesSection = document.querySelector(".fonctionnalites");

  if (fonctionnalitesSection) fonctionnalitesSection.classList.add("loaded");

  const showPopup = (featureNum, featureText) => {
    if (!featuresPopup) return;
    
    document.getElementById("popup-feature-number").innerText = featureNum;
    document.getElementById("popup-feature-text").innerText = featureText;
    
    featuresPopup.style.display = "flex"; // Utilise Flex pour centrer
    gsap.fromTo(featuresPopup.querySelector('.features-popup-content'),
      { scale: 0.85, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.35, ease: "power2.out" }
    );
  };

  const hidePopup = () => {
    gsap.to(featuresPopup.querySelector('.features-popup-content'), {
      scale: 0.85, opacity: 0, duration: 0.22, ease: "power2.in",
      onComplete: () => { featuresPopup.style.display = "none"; }
    });
  };

  document.querySelectorAll(".cover.clickable").forEach(cover => {
    cover.addEventListener("click", (e) => {
      e.stopPropagation();
      showPopup(cover.getAttribute("data-feature"), cover.getAttribute("data-description"));
    });
  });

  if (closePopupBtn) closePopupBtn.addEventListener('click', hidePopup);
  window.addEventListener('click', (e) => { if (e.target === featuresPopup) hidePopup(); });

  // 5. DARK/LIGHT MODE IMAGE
  const plateformesImg = document.getElementById("plateformes");
  if (plateformesImg) {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateImg = () => {
      plateformesImg.src = mediaQuery.matches ? "/assets/img/pls.png" : "/assets/img/5.png";
    };
    updateImg();
    mediaQuery.addEventListener("change", updateImg);
  }

  // 6. DEV POPUP (localStorage)
  const devPopup = document.getElementById("dev-popup");
  if (devPopup && localStorage.getItem("dev_popup_seen") === "true") {
    devPopup.style.display = "none";
  } else if (devPopup) {
    document.getElementById("enter-site")?.addEventListener("click", () => {
      localStorage.setItem("dev_popup_seen", "true");
      devPopup.style.display = "none";
    });
    document.getElementById("quit-site")?.addEventListener("click", () => {
      document.body.innerHTML = `<div style="height:100vh;display:flex;justify-content:center;align-items:center;background:#0e0e0e;color:white;font-family:sans-serif;text-align:center;"><div><h1>👋 Merci de votre visite</h1><p>Vous pouvez fermer cet onglet.</p></div></div>`;
    });
  }
});

// 7. NAVBAR SCROLL (Optimisé)
window.addEventListener("scroll", () => {
  const navbar = document.getElementById("navbar");
  if (navbar) {
    window.scrollY > 50 ? navbar.classList.add("scrolled") : navbar.classList.remove("scrolled");
  }
}, { passive: true });
