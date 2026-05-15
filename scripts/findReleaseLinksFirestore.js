const puppeteer = require('puppeteer');
const admin = require('firebase-admin');
const path = require('path');
const readline = require('readline');

// Chemin vers ton fichier de credentials Firebase service account
const serviceAccount = require(path.resolve(__dirname, '../serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function searchSpotify(artist, title, trackCount) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const query = encodeURIComponent(`${artist} ${title}`);
  await page.goto(`https://open.spotify.com/search/${query}`, { waitUntil: 'networkidle2' });
  const albumUrl = await page.evaluate(() => {
    const link = document.querySelector('a[href^="/album/"]');
    return link ? 'https://open.spotify.com' + link.getAttribute('href') : null;
  });
  let valid = false;
  if (albumUrl) {
    await page.goto(albumUrl, { waitUntil: 'networkidle2' });
    const count = await page.evaluate(() => document.querySelectorAll('[data-testid="tracklist-row"]').length);
    valid = (count === Number(trackCount));
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
    const count = await page.evaluate(() => document.querySelectorAll('.datagrid-row-track').length);
    valid = (count === Number(trackCount));
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
    const count = await page.evaluate(() => document.querySelectorAll('div.songs-list-row').length);
    valid = (count === Number(trackCount));
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

async function updateFirestore({ artist, title, trackCount, docId }) {
  const links = await findReleaseLinks({ artist, title, trackCount });
  await db.collection('sorties').doc(docId).update({
    spotify: links.spotify,
    deezer: links.deezer,
    appleMusic: links.appleMusic
  });
  console.log('Liens mis à jour dans Firestore :', links);
}

// CLI interactive
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Artiste ? ', (artist) => {
  rl.question('Titre ? ', (title) => {
    rl.question('Nombre de pistes ? ', (trackCount) => {
      rl.question('ID Firestore du document sortie ? ', (docId) => {
        updateFirestore({ artist, title, trackCount: Number(trackCount), docId })
          .then(() => process.exit(0))
          .catch((err) => { console.error(err); process.exit(1); });
      });
    });
  });
});
