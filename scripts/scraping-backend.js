const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');

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

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.post('/find-links', async (req, res) => {
  try {
    const { artist, title, trackCount } = req.body;
    if (!artist || !title || !trackCount) return res.status(400).json({ error: 'artist, title, trackCount requis' });
    const links = await findReleaseLinks({ artist, title, trackCount });
    res.json(links);
  } catch (e) {
    res.status(500).json({ error: e.message || e });
  }
});

const PORT = 3333;
app.listen(PORT, () => {
  console.log('Scraping backend running on http://localhost:' + PORT);
});
