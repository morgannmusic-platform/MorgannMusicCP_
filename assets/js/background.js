// Dynamic Background: large animated blob + small cursor-follow blob
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
        const mainBg = document.createElement('div');
        mainBg.className = 'dynamic-bg-main';
        document.body.insertBefore(mainBg, document.body.firstChild);

        const blobsContainer = document.createElement('div');
        blobsContainer.className = 'blobs-container';
        document.body.insertBefore(blobsContainer, document.body.firstChild);

        // Create the large ambient blob
        const blob = document.createElement('div');
        blob.className = 'floating-blob large-blob';
        blob.style.position = 'absolute';
        blob.style.pointerEvents = 'none';

        // Create a smaller blob that follows the pointer
        const cursorBlob = document.createElement('div');
        cursorBlob.className = 'floating-blob';
        cursorBlob.style.position = 'absolute';
        cursorBlob.style.pointerEvents = 'none';
        cursorBlob.style.width = '220px';
        cursorBlob.style.height = '220px';
        cursorBlob.style.opacity = '0.85';
        cursorBlob.style.left = '50%';
        cursorBlob.style.top = '50%';
        cursorBlob.style.transform = 'translate(-50%, -50%)';

        // Set initial size to 60% of the smallest viewport dimension
        const setSize = () => {
            const s = Math.floor(Math.min(window.innerWidth, window.innerHeight) * 0.6);
            blob.style.width = s + 'px';
            blob.style.height = s + 'px';
        };
        setSize();

        // Center initially
        blob.style.left = '50%';
        blob.style.top = '50%';
        blob.style.transform = 'translate(-50%, -50%)';

        // Animation timing
        blob.style.animationDuration = '30s';
        blob.style.animationDelay = '0s';

        blobsContainer.appendChild(blob);
        blobsContainer.appendChild(cursorBlob);

        // Start animation after placement to avoid jitter
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!reducedMotion) {
            setTimeout(() => blob.classList.add('start-anim'), 160);
        } else {
            // ensure no animation-related inline styles remain
            blob.style.animation = 'none';
        }

        // Smooth pointer-follow behavior for the small blob
        let targetX = window.innerWidth * 0.5;
        let targetY = window.innerHeight * 0.5;
        let currentX = targetX;
        let currentY = targetY;
        const lerp = 0.14;

        const updatePointerTarget = (x, y) => {
            targetX = x;
            targetY = y;
        };

        window.addEventListener('mousemove', (e) => {
            updatePointerTarget(e.clientX, e.clientY);
        });

        window.addEventListener('touchmove', (e) => {
            if (e.touches && e.touches[0]) {
                updatePointerTarget(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: true });

        const animateCursorBlob = () => {
            currentX += (targetX - currentX) * lerp;
            currentY += (targetY - currentY) * lerp;
            cursorBlob.style.left = currentX + 'px';
            cursorBlob.style.top = currentY + 'px';
            requestAnimationFrame(animateCursorBlob);
        };
        requestAnimationFrame(animateCursorBlob);

        // Handle resize without jumping (throttle)
        let rt;
        window.addEventListener('resize', () => {
            clearTimeout(rt);
            rt = setTimeout(() => {
                setSize();
                if (targetX > window.innerWidth) targetX = window.innerWidth * 0.5;
                if (targetY > window.innerHeight) targetY = window.innerHeight * 0.5;
            }, 120);
        });
    }, 100);
});
