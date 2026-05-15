const puppeteer = require('puppeteer');

async function searchSpotify(artist, title, trackCount) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const query = encodeURIComponent(`${artist} ${title}`);
  await page.goto(`https://open.spotify.com/search/${query}`, { waitUntil: 'networkidle2' });
  // Clique sur l'album/single le plus pertinent
  const albumUrl = await page.evaluate(() => {
    const link = document.querySelector('a[href^="/album/"]');
    return link ? 'https://open.spotify.com' + link.getAttribute('href') : null;
  });
  let valid = false;
  if (albumUrl) {
    await page.goto(albumUrl, { waitUntil: 'networkidle2' });
    // Compte le nombre de pistes
    const count = await page.evaluate(() => {
      return document.querySelectorAll('[data-testid="tracklist-row"]').length;
    });
    valid = (count === trackCount);
  }
  await browser.close();
  return valid ? albumUrl : null;
}

async function searchDeezer(artist, title, trackCount) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const query = encodeURIComponent(`${artist} ${title}`);
  await page.goto(`https://www.deezer.com/search/${query}`, { waitUntil: 'networkidle2' });
  const albumUrl = await page.evaluate(() => {
    const link = document.querySelector('a[href^="/album/"]');
    return link ? 'https://www.deezer.com' + link.getAttribute('href') : null;
  });
  let valid = false;
  if (albumUrl) {
    await page.goto(albumUrl, { waitUntil: 'networkidle2' });
    const count = await page.evaluate(() => {
      return document.querySelectorAll('.datagrid-row-track').length;
    });
    valid = (count === trackCount);
  }
  await browser.close();
  return valid ? albumUrl : null;
}

async function searchAppleMusic(artist, title, trackCount) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const query = encodeURIComponent(`${artist} ${title}`);
  await page.goto(`https://music.apple.com/fr/search?term=${query}`, { waitUntil: 'networkidle2' });
  const albumUrl = await page.evaluate(() => {
    const link = document.querySelector('a[href*="/album/"]');
    return link ? link.href : null;
  });
  let valid = false;
  if (albumUrl) {
    await page.goto(albumUrl, { waitUntil: 'networkidle2' });
    const count = await page.evaluate(() => {
      return document.querySelectorAll('div.songs-list-row').length;
    });
    valid = (count === trackCount);
  }
  await browser.close();
  return valid ? albumUrl : null;
}

async function findReleaseLinks({ artist, title, trackCount }) {
  const [spotify, deezer, appleMusic] = await Promise.all([
    searchSpotify(artist, title, trackCount),
    searchDeezer(artist, title, trackCount),
    searchAppleMusic(artist, title, trackCount)
  ]);
  return { spotify, deezer, appleMusic };
}

// Exemple d'utilisation :
(async () => {
  const artist = 'Ton Artiste';
  const title = 'Nom de la Sortie';
  const trackCount = 1; // nombre de pistes
  const links = await findReleaseLinks({ artist, title, trackCount });
  console.log(links);
})();
