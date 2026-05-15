gsap.registerPlugin(ScrollTrigger);

document.addEventListener("DOMContentLoaded", () => {
  const title = document.querySelector(".main-title");
  const tagline = document.querySelector(".tagline");

  if (title) {
    gsap.fromTo(
      title,
      { opacity: 0, y: 28 },
      { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }
    );
  }

  if (tagline) {
    gsap.fromTo(
      tagline,
      { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: 0.8, delay: 0.2, ease: "power2.out" }
    );
  }

  document.querySelectorAll(".story-block").forEach((block, index) => {
    gsap.fromTo(
      block,
      { opacity: 0, y: 36 },
      {
        opacity: 1,
        y: 0,
        duration: 0.65,
        delay: index * 0.06,
        scrollTrigger: {
          trigger: block,
          start: "top 86%",
          toggleActions: "play none none none"
        }
      }
    );
  });

  document.querySelectorAll(".timeline-item").forEach((item, index) => {
    gsap.fromTo(
      item,
      { opacity: 0, x: index % 2 === 0 ? -30 : 30 },
      {
        opacity: 1,
        x: 0,
        duration: 0.55,
        scrollTrigger: {
          trigger: item,
          start: "top 88%",
          toggleActions: "play none none none"
        }
      }
    );
  });
});
