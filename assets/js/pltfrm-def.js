const logos = [
    'Amazonmusic.logo.png',
    'Google_Play_2022_logo.svg.png',
    'Shazam_logo.svg.png',
    'Spotify_logo_with_text.svg.png',
    'TIDAL_Music_AB.png',
    'TikTok-Logo-650x366.png',
    'og__ckjrh2mu8b2a_image avec arrière-plan supprimé.png',
    'Twitch-Logo.png',
    'akazoo-logo.png',
    'ali-baba-music-logo-1605371086.jpg.png',
    '604203b036a4e80a5e8c1f47_Vevo Logo - Artwork.png',
    'Tesla-Embleme.png',
    '5563.1412784896.png',
    '1200x680 avec arrière-plan supprimé.png'
];

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
