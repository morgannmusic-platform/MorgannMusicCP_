const logos = [
    'Amazonmusic.logo.png', 'Google_Play_2022_logo.svg.png', 'Shazam_logo.svg.png',
    'Spotify_logo_with_text.svg.png', 'TIDAL_Music_AB.png', 'TikTok-Logo-650x366.png',
    'Twitch-Logo.png', 'akazoo-logo.png', 'Tesla-Embleme.png'
];

function initMarquee() {
    const track = document.getElementById('marquee-distrib');
    if (!track) return;

    [...logos, ...logos].forEach(name => {
        const item = document.createElement('div');
        item.className = 'marquee-item';
        const img = document.createElement('img');
        img.src = '/assets/img/plateformes/' + encodeURIComponent(name);
        img.style.height = "38px";
        item.appendChild(img);
        track.appendChild(item);
    });
    track.classList.add('loaded');
}

document.addEventListener('DOMContentLoaded', () => {
    initMarquee();

    if (typeof gsap !== "undefined") {
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reducedMotion) return;

        gsap.fromTo(".distrib-hero",
            { opacity: 0, y: 30 },
            { opacity: 1, y: 0, duration: 1.2, ease: "power4.out" }
        );

        gsap.utils.toArray(".step-card").forEach((card, index) => {
            gsap.fromTo(card,
                { opacity: 0, y: 50 },
                {
                    opacity: 1,
                    y: 0,
                    duration: 0.8,
                    delay: index * 0.1,
                    ease: "power3.out",
                    scrollTrigger: {
                        trigger: card,
                        start: "top 85%",
                        toggleActions: "play none none reverse"
                    }
                }
            );
        });
    }
});
