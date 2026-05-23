

                gsap.to(".cover", {
                    opacity: 1,
                    y: 0,
                    duration: 1.5,
                    stagger: 0.2,
                    ease: "power2.out",
                    scrollTrigger: {
                        trigger: ".grid-covers",
                        start: "top 80%",
                        end: "bottom 50%",
                        scrub: 1
                    }
                });


    // Gestion navbar désactivée sur les pages sans navbar


    // ScrollTrigger navbar désactivé sur les pages sans navbar





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

                

    // Deuxième gestionnaire de scroll navbar désactivé sur les pages sans navbar
        


 





    const image = document.getElementById('plateformes');
    const imageClair = "/assets/img/5.png";
    const imageSombre = "/assets/img/pls.png";

    function setImageBasedOnScheme() {
        if (!image) return;
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            image.src = imageSombre;
        } else {
            image.src = imageClair;
        }
    }

    if (image) {
        setImageBasedOnScheme();
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener("change", setImageBasedOnScheme);
    }



    const logo = document.getElementById("logo-dynamique");
    const logoClair = "/assets/img/logo.svg";
    const logoSombre = "/assets/img/logo2.png";

    function setLogoBasedOnScheme() {
        if (!logo) return;
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            logo.src = logoSombre;
        } else {
            logo.src = logoClair;
        }
    }

    if (logo) {
        setLogoBasedOnScheme();
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener("change", setLogoBasedOnScheme);
    }
    const modal = document.getElementById("pochetteModal");
    const closeModal = document.querySelector(".close-modal");
    if (modal && closeModal) {
        document.querySelectorAll(".cover").forEach(cover => {
            cover.addEventListener("click", () => {
                const mTitle = document.getElementById("m-title");
                const mArtist = document.getElementById("m-artist");
                const container = document.getElementById("modal-media-container");
                const tracklist = document.getElementById("m-tracks");
                if (mTitle) mTitle.innerText = cover.getAttribute("data-title");
                if (mArtist) mArtist.innerText = cover.getAttribute("data-artist");
                if (container) {
                    container.innerHTML = cover.getAttribute("data-type") === "video" ?
                        `<video autoplay loop muted playsinline><source src="${cover.getAttribute("data-src")}" type="video/mp4"></video>` :
                        `<img src="${cover.getAttribute("data-src")}">`;
                }
                if (tracklist) tracklist.innerHTML = "";
                // ...existing code...
            });
        });
        }
        // ...existing code...
        // Les blocs JS sont maintenant correctement fermés.
                window.onclick = (e) => {
                    if (e.target == modal) closeModal.onclick();
                };


                const authLinks = document.getElementById("auth-links");
                const userLinks = document.getElementById("user-links");
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


document.addEventListener("DOMContentLoaded", function () {

    const popup = document.getElementById("dev-popup");
    const enter = document.getElementById("enter-site");
    const quit = document.getElementById("quit-site");

    const alreadySeen = localStorage.getItem("dev_popup_seen");

    if (alreadySeen === "true") {
        popup.style.display = "none";
        return;
    }

    enter.addEventListener("click", function () {
        localStorage.setItem("dev_popup_seen", "true");
        popup.style.display = "none";
    });

    quit.addEventListener("click", function () {
        document.body.innerHTML = `
            <div style="
                height:100vh;
                display:flex;
                justify-content:center;
                align-items:center;
                background:#0e0e0e;
                color:white;
                font-family:sans-serif;
                text-align:center;
            ">
                <div>
                    <h1>👋 Merci de votre visite</h1>
                    <p>Vous pouvez fermer cet onglet.</p>
                </div>
            </div>
        `;
    });

});
