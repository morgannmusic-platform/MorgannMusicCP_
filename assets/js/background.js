// Dynamic Background: single large blob that moves smoothly
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
        const mainBg = document.createElement('div');
        mainBg.className = 'dynamic-bg-main';
        document.body.insertBefore(mainBg, document.body.firstChild);

        const blobsContainer = document.createElement('div');
        blobsContainer.className = 'blobs-container';
        document.body.insertBefore(blobsContainer, document.body.firstChild);

        // Create a single large blob
        const blob = document.createElement('div');
        blob.className = 'floating-blob large-blob';
        blob.style.position = 'absolute';
        blob.style.pointerEvents = 'none';

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

        // Start animation after placement to avoid jitter
        setTimeout(() => blob.classList.add('start-anim'), 160);

        // Handle resize without jumping (throttle)
        let rt;
        window.addEventListener('resize', () => {
            clearTimeout(rt);
            rt = setTimeout(() => {
                setSize();
            }, 120);
        });
    }, 100);
});

