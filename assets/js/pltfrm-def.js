// On génère le tableau direct de 1.png à 18.png
const logos = Array.from({ length: 18 }, (_, i) => `${i + 1}.png`);

function addLogosTo(trackId) {
    const track = document.getElementById(trackId);
    if (!track) return [];
    const imgs = [];
    for (let rep = 0; rep < 2; rep++) {
        logos.forEach(name => {
            const item = document.createElement('div');
            item.className = 'marquee-item';
            const img = document.createElement('img');
            img.src = '/assets/img/plateformes/' + encodeURIComponent(name);
            img.alt = '';
            img.setAttribute('role', 'presentation');
            img.setAttribute('draggable', 'false');
            item.appendChild(img);
            track.appendChild(item);
            imgs.push(img);
        });
    }
    return imgs;
}

document.addEventListener('DOMContentLoaded', () => {
    const imgs1 = addLogosTo('marquee1');
    const imgs2 = addLogosTo('marquee2');
    const allImgs = imgs1.concat(imgs2);
    const loadPromises = allImgs.map(img => new Promise(resolve => {
        if (img.complete && img.naturalWidth !== 0) return resolve();
        img.addEventListener('load', resolve);
        img.addEventListener('error', resolve);
    }));

    Promise.all(loadPromises).then(() => {
        document.getElementById('marquee1')?.classList.add('loaded');
        document.getElementById('marquee2')?.classList.add('loaded');
    });
});