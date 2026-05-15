const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
    if (!navbar) return;
    window.scrollY > 30
        ? navbar.classList.add('scrolled')
        : navbar.classList.remove('scrolled');
});

document.querySelectorAll(".timeline-item").forEach(item => {
                    const side = item.getAttribute("data-side");
                    gsap.to(item, {
                        opacity: 1,
                        x: 0,
                        duration: 1,
                        startAt: {
                            x: side === "left" ? -100 : 100
                        },
                        scrollTrigger: {
                            trigger: item,
                            start: "top 80%",
                            toggleActions: "play none none reverse"
                        }
                    });
                });

                    


const logo = document.getElementById('logo-dynamique');

const logoClair = "/assets/img/logo.svg";
const logoSombre = "/assets/img/logo2.png";

const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

function setLogoBasedOnScheme() {
    if (!logo) return;
    if (mediaQuery.matches) {
        logo.src = logoSombre;
    } else {
        logo.src = logoClair;
    }
}

setLogoBasedOnScheme();

mediaQuery.addEventListener('change', setLogoBasedOnScheme);
