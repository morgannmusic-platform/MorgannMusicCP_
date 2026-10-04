document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById('stickersBg');
    const images = [
        '/assets/img/minor-form/1.png',
        '/assets/img/minor-form/2.png',
        '/assets/img/minor-form/3.png',
        '/assets/img/minor-form/4.png',
        '/assets/img/minor-form/5.png'
    ];

    const totalStickers = 15;
    const placedRects = [];
    const isMobile = window.innerWidth <= 768;
    const stickerSize = isMobile ? 100 : 160;
    const padding = 20;

    for (let i = 0; i < totalStickers; i++) {
        const imgPath = images[i % images.length];
        let placed = false;
        let attempts = 0;

        while (!placed && attempts < 100) {
            attempts++;
            const left = Math.random() * (window.innerWidth - stickerSize - padding * 2) + padding;
            const top = Math.random() * (window.innerHeight - stickerSize - padding * 2) + padding;

            const newRect = {
                left: left,
                top: top,
                right: left + stickerSize + padding,
                bottom: top + stickerSize + padding
            };

            const overlaps = placedRects.some(r => !(
                newRect.right < r.left ||
                newRect.left > r.right ||
                newRect.bottom < r.top ||
                newRect.top > r.bottom
            ));

            if (!overlaps) {
                placedRects.push(newRect);
                placed = true;

                const img = document.createElement('img');
                img.src = imgPath;
                img.className = 'sticker';
                img.style.left = `${left}px`;
                img.style.top = `${top}px`;

                const rot = (Math.random() * 40 - 20).toFixed(1);
                const delay = (Math.random() * 2).toFixed(1);
                img.style.setProperty('--rot', `${rot}deg`);
                img.style.animationDelay = `${delay}s`;

                container.appendChild(img);
            }
        }
    }

    if (typeof gsap !== "undefined") {
        gsap.from(".hero-legende > *", { opacity: 0, y: 30, duration: 0.8, stagger: 0.15, ease: "back.out(1.7)" });
        gsap.from(".card-main", { opacity: 0, scale: 0.9, duration: 0.8, delay: 0.4, ease: "power3.out" });
        gsap.from(".sticker", { opacity: 0, scale: 0.3, duration: 0.8, stagger: 0.05, delay: 0.2, ease: "back.out(1.5)" });
    }
});
