gsap.registerPlugin(ScrollTrigger);

document.addEventListener('DOMContentLoaded', () => {

  // ── Hero ──────────────────────────────────────────────────────
  const eyebrow = document.querySelector('.ovn-eyebrow');
  const title   = document.querySelector('.main-title');
  const tagline = document.querySelector('.tagline');

  if (eyebrow) {
    gsap.fromTo(eyebrow,
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }
    );
  }

  if (title) {
    gsap.fromTo(title,
      { opacity: 0, y: 28 },
      { opacity: 1, y: 0, duration: 0.8, delay: 0.1, ease: 'power2.out' }
    );
  }

  if (tagline) {
    gsap.fromTo(tagline,
      { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: 0.8, delay: 0.25, ease: 'power2.out' }
    );
  }

  // ── Cartes — apparition au scroll ────────────────────────────
  document.querySelectorAll('.ovn-card').forEach((card, index) => {
    gsap.fromTo(card,
      { opacity: 0, y: 40 },
      {
        opacity: 1,
        y: 0,
        duration: 0.65,
        delay: index * 0.08,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: card,
          start: 'top 86%',
          toggleActions: 'play none none none'
        }
      }
    );
  });

  // ── Chiffres clés — compteur animé ───────────────────────────
  document.querySelectorAll('.ovn-stat-value').forEach((el) => {
    const raw = el.textContent.trim();
    const numeric = parseFloat(raw.replace(/[^0-9.]/g, ''));
    const suffix  = raw.replace(/[0-9.]/g, '');

    if (!isNaN(numeric)) {
      gsap.fromTo({ val: 0 },
        { val: numeric },
        {
          val: numeric,
          duration: 1.4,
          ease: 'power1.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 88%',
            toggleActions: 'play none none none'
          },
          onUpdate: function () {
            el.textContent = Math.round(this.targets()[0].val) + suffix;
          }
        }
      );
    } else {
      gsap.fromTo(el,
        { opacity: 0, y: 12 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 88%',
            toggleActions: 'play none none none'
          }
        }
      );
    }
  });

});
