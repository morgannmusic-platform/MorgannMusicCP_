    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
        if (!navbar) return;
        window.scrollY > 30
            ? navbar.classList.add('scrolled')
            : navbar.classList.remove('scrolled');
    });

    const menuToggle = document.getElementById('menu-toggle');
    const navLinks = document.getElementById('nav-links');
    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });
    }

    const authLinks = document.getElementById("auth-links");
    const userLinks = document.getElementById("user-links") || document.getElementById("user-menu");

    if (authLinks && userLinks) {
        if (localStorage.getItem("userConnected") === "true") {
            authLinks.style.display = "none";
            userLinks.style.display = "block";
        } else {
            authLinks.style.display = "block";
            userLinks.style.display = "none";
        }
    }

    function logout() {
        localStorage.removeItem("userConnected");
        location.reload();
    }




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
