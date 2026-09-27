export default {
  async fetch(request, env) {
    // Traitement immédiat des requêtes CORS preflight (OPTIONS)
    if (request.method === "OPTIONS") {
      return corsResponse(null, 204);
    }

    // Assurer l'existence des tables SQL requises dans D1 au premier démarrage
    if (env.DB) {
      try {
        await ensureTables(env.DB);
      } catch (e) {
        console.error("Initialisation D1:", e);
      }
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "");
    const method = request.method;

    try {
      // --- ROUTES PUBLIQUES STATIQUES ---
      if (method === "GET" && path === "/api/platforms") {
        return corsJson(LISTE_PLATFORMES);
      }
      if (method === "GET" && path === "/api/countries") {
        return corsJson(LISTE_PAYS);
      }
      if (method === "GET" && path === "/api/artists") {
        return await getAllArtists(env);
      }
      if (method === "GET" && path === "/api/feats") {
        return await getAllFeats(env);
      }
      if (method === "GET" && path === "/api/releases") {
        return await getAllReleases(env, url);
      }
      if (method === "GET" && path === "/api/reviews") {
        return await getAllReviews(env);
      }
      if (method === "GET" && path === "/api/versions") {
        return await getAllVersions(env);
      }
      if (method === "POST" && path === "/api/messages") {
        return await createMessage(env, request);
      }

      if (method === "GET" && path.startsWith("/api/files/")) {
        const key = decodeURIComponent(path.replace("/api/files/", ""));
        return await serveFile(env, key);
      }

      if (method === "GET" && path.match(/^\/api\/releases\/\d+$/)) {
        const releaseId = path.split("/").pop();
        return await getPublicRelease(env, releaseId);
      }

      // --- AUTHENTIFICATION ---
      const userId = await extractUserId(request);
      if (!userId) {
        return corsJson({ error: "Authentification requise" }, 401);
      }
      const isAdminUser = await isAdmin(env, userId);

      // --- ME / PROFIL ---
      if (method === "GET" && path === "/api/me") {
        return await getMe(env, userId);
      }

      // --- ROUTES ADMINISTRATEUR ---
      if (method === "GET" && path === "/api/admin/users") {
        return await listUsers(env, userId, isAdminUser);
      }
      if (method === "GET" && path === "/api/admin/messages") {
        return await getAllMessages(env, userId, isAdminUser);
      }
      if (method === "GET" && path === "/api/admin/withdrawals") {
        return await getAllWithdrawals(env, userId, isAdminUser);
      }
      if (method === "PATCH" && path.match(/^\/api\/admin\/withdrawals\/\d+$/)) {
        return await patchWithdrawal(env, userId, path, request, isAdminUser);
      }
      if (method === "POST" && path === "/api/admin/versions") {
        return await createVersion(env, request, userId, isAdminUser);
      }
      if (method === "PATCH" && path.match(/^\/api\/admin\/versions\/\d+$/)) {
        return await patchVersion(env, path, request, userId, isAdminUser);
      }
      if (method === "GET" && path.match(/^\/api\/admin\/releases\/\d+$/)) {
        return await getAdminRelease(env, path, isAdminUser);
      }
      if ((method === "PATCH" || method === "PUT") && path.match(/^\/api\/admin\/releases\/\d+$/)) {
        return await adminPatchRelease(env, userId, request);
      }
      if (method === "GET" && path.match(/^\/api\/admin\/settings\/[^/]+$/)) {
        return await getSetting(env, path, isAdminUser);
      }
      if (method === "POST" && path.match(/^\/api\/admin\/settings\/[^/]+$/)) {
        return await upsertSetting(env, path, request, isAdminUser);
      }
      if (method === "POST" && path.match(/^\/api\/admin\/users\/[^/]+\/notifications$/)) {
        return await createNotification(env, userId, path, request, isAdminUser);
      }
      if (method === "GET" && path.match(/^\/api\/admin\/users\/[^/]+\/finances$/)) {
        return await getFinances(env, userId, path, isAdminUser);
      }
      if (method === "POST" && path.match(/^\/api\/admin\/users\/[^/]+\/finances$/)) {
        return await createFinance(env, userId, path, request, isAdminUser);
      }
      if (method === "PATCH" && path.match(/^\/api\/admin\/users\/[^/]+\/finances\/\d+$/)) {
        return await patchFinance(env, userId, path, request, isAdminUser);
      }
      if (method === "DELETE" && path.match(/^\/api\/admin\/users\/[^/]+\/finances\/\d+$/)) {
        return await deleteFinance(env, userId, path, isAdminUser);
      }

      // --- FEATS ---
      if (method === "POST" && path === "/api/feats") {
        return await createFeat(env, userId, request);
      }

      // --- USERS ---
      const userMatch = path.match(/^\/api\/users\/([^/]+)$/);
      if (userMatch) {
        const uid = userMatch[1];
        const isSelf = uid === userId;
        if (!isSelf && !isAdminUser) {
          return corsJson({ error: "Accès non autorisé" }, 403);
        }
        if (method === "GET") return await getUser(env, uid);
        if (method === "PUT") return await upsertUser(env, uid, request);
        if (method === "PATCH") return await patchUser(env, uid, request);
      }

      // --- BIBLIOTHÈQUE SONORE / USER TRACKS (/api/users/:uid/tracks) ---
      const userTracksMatch = path.match(/^\/api\/users\/([^/]+)\/tracks$/);
      if (userTracksMatch) {
        const uid = userTracksMatch[1];
        const isSelf = uid === userId;
        if (!isSelf && !isAdminUser) return corsJson({ error: "Accès non autorisé" }, 403);
        if (method === "GET") return await getUserTracks(env, uid);
        if (method === "POST") return await createOrUpdateUserTrack(env, uid, request);
      }

      const userTrackMatch = path.match(/^\/api\/users\/([^/]+)\/tracks\/(.+)$/);
      if (userTrackMatch) {
        const uid = userTrackMatch[1];
        const trackId = decodeURIComponent(userTrackMatch[2]);
        const isSelf = uid === userId;
        if (!isSelf && !isAdminUser) return corsJson({ error: "Accès non autorisé" }, 403);
        if (method === "DELETE") return await deleteUserTrack(env, uid, trackId);
      }

      // --- STATISTIQUES DE STREAMING / PLAYS (/api/users/:uid/plays) ---
      const userPlaysMatch = path.match(/^\/api\/users\/([^/]+)\/plays$/);
      if (userPlaysMatch) {
        const uid = userPlaysMatch[1];
        const isSelf = uid === userId;
        if (!isSelf && !isAdminUser) return corsJson({ error: "Accès non autorisé" }, 403);
        if (method === "GET") return await getUserPlays(env, uid);
        if (method === "POST") return await recordUserPlay(env, uid, request);
      }

      // --- ARTISTES ---
      const userArtistsMatch = path.match(/^\/api\/users\/([^/]+)\/artists$/);
      if (userArtistsMatch) {
        const uid = userArtistsMatch[1];
        const isSelf = uid === userId;
        if (!isSelf && !isAdminUser) return corsJson({ error: "Accès non autorisé" }, 403);
        if (method === "GET") return await getUserArtists(env, uid);
        if (method === "POST") return await createArtist(env, uid, request);
      }

      const userArtistMatch = path.match(/^\/api\/users\/([^/]+)\/artists\/(\d+)$/);
      if (userArtistMatch) {
        const uid = userArtistMatch[1];
        const artistId = userArtistMatch[2];
        const isSelf = uid === userId;
        if (!isSelf && !isAdminUser) return corsJson({ error: "Accès non autorisé" }, 403);
        if (method === "PATCH" || method === "PUT") return await patchArtist(env, uid, artistId, request);
        if (method === "DELETE") return await deleteArtist(env, uid, artistId);
      }

      // --- SORTIES / RELEASES ---
      const userReleasesMatch = path.match(/^\/api\/users\/([^/]+)\/releases$/);
      if (userReleasesMatch) {
        const uid = userReleasesMatch[1];
        const isSelf = uid === userId;
        if (!isSelf && !isAdminUser) return corsJson({ error: "Accès non autorisé" }, 403);
        if (method === "GET") return await getUserReleases(env, uid);
        if (method === "POST") return await createRelease(env, uid, request);
      }

      const userReleaseMatch = path.match(/^\/api\/users\/([^/]+)\/releases\/(\d+)$/);
      if (userReleaseMatch) {
        const uid = userReleaseMatch[1];
        const releaseId = userReleaseMatch[2];
        const isSelf = uid === userId;
        if (!isSelf && !isAdminUser) return corsJson({ error: "Accès non autorisé" }, 403);
        if (method === "PATCH" || method === "PUT") return await patchRelease(env, uid, releaseId, request);
        if (method === "GET") return await getRelease(env, uid, releaseId);
        if (method === "DELETE") return await deleteRelease(env, uid, releaseId);
      }

      // --- REVIEWS ---
      if (method === "POST" && path === "/api/reviews") {
        return await upsertReview(env, request);
      }

      // --- UPLOADS (/api/upload et /api/upload/:type) ---
      if ((path === "/api/upload" || path.startsWith("/api/upload/")) && method === "POST") {
        const type = path.startsWith("/api/upload/") ? path.replace("/api/upload/", "") : "file";
        return await uploadFile(env, userId, type, request);
      }

      return corsJson({ error: "Route non trouvée" }, 404);

    } catch (err) {
      console.error("Worker error:", err);
      return corsJson({ error: `Erreur interne: ${err.message}` }, 500);
    }
  }
};

const LISTE_PLATFORMES = [
  "7Digital", "ACRCloud", "Alibaba", "AliGenie", "Amazon Music", "Anghami", "AGEDI", "Akazoo", "Apple Music", "ITunes",
  "AMI Entertainment", "Audible Magic - Fulfillment360", "Audible Magic - Rights360", "Audiomack", "Ambients App", "AWA", "Boomplay", "Beatsource", "BMAT", "Claro Música",
  "ClickNClear", "Deezer", "Dubset", "DISCO", "Google Play", "Curve", "Gaana", "Gracenote", "FLO", "Hungama",
  "IHeart", "IMI Mobile", "Jaxsta", "JioSaavn", "Discogs", "JOOX", "Kanjian", "KDigital Media", "KKBOX", "LINE Music",
  "Mixcloud", "Medianet", "MoodAgent", "MusicToday", "MELON", "NetEase Cloud Music", "Pandora", "Peloton", "PEX", "Play Network",
  "Pretzel Rocks", "Qobuz", "Qub Musique", "Rebelation", "Rockbot", "Roxi", "Resso", "Rhapsody", "Napster", "Rakuten",
  "Shazam", "Rakuten Music", "Slacker Radio", "Snapchat", "Spinlet", "Soundtrack Your Brand", "Sirius XM", "Soundtrack By Twitch", "Twitch", "Spotify",
  "Tencent", "Tidal", "Styngr", "Tesla Music", "TouchTunes", "Jazzed", "MyMelo", "Fan Label", "Soundhound", "Soundmouse",
  "Kuaishou", "Supernatural", "Grandpad", "Traxsource", "Triller", "TikTok", "Trackdrip", "United Media Agency (UMA)", "Yandex", "VEVO",
  "YouTube Music", "Zvooq", "EMusic", "Beat.no", "Clone Digital", "Music Reports", "Mythical Games", "JPay", "Adaptr", "Pinterest",
  "Samsung Music", "Bandcamp", "VKontakte", "Qishui Music", "Kwai", "Canva", "Musixmatch", "Soda Music"
];

const LISTE_PAYS = [
  "Afghanistan", "Aland Islands", "Albania", "Algeria", "American Samoa", "Andorra", "Angola", "Anguilla", "Antarctica", "Antigua And Barbuda",
  "Argentina", "Armenia", "Aruba", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium",
  "Belize", "Benin", "Bermuda", "Bhutan", "Bolivia", "Bosnia And Herzegovina", "Botswana", "Brazil", "Brunei Darussalam", "Bulgaria", "Burkina Faso",
  "Burundi", "Cambodia", "Cameroon", "Canada", "Cape Verde", "Cayman Islands", "Central African Republic", "Chad", "Chile", "China", "Colombia",
  "Comoros", "Congo", "Costa Rica", "Cote D'Ivoire", "Croatia", "Cuba", "Cyprus", "Czech Republic", "Denmark", "Djibouti", "Dominica", "Dominican Republic",
  "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Ethiopia", "Fiji", "Finland", "France", "French Guiana", "French Polynesia",
  "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Gibraltar", "Greece", "Greenland", "Grenada", "Guadeloupe", "Guatemala", "Guinea", "Haiti",
  "Holy See (Vatican City State)", "Honduras", "Hong Kong", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy",
  "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Korea", "Kuwait", "Kyrgyzstan", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya",
  "Liechtenstein", "Lithuania", "Luxembourg", "Macao", "Macedonia", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Martinique",
  "Mauritania", "Mauritius", "Mayotte", "Mexico", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia",
  "Nepal", "Netherlands", "New Caledonia", "New Zealand", "Nicaragua", "Niger", "Nigeria", "Norway", "Oman", "Pakistan", "Panama", "Papua New Guinea",
  "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Puerto Rico", "Qatar", "Reunion", "Romania", "Russian Federation", "Rwanda", "Saint Barthelemy",
  "Saint Lucia", "Samoa", "San Marino", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia",
  "South Africa", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syrian Arab Republic", "Taiwan", "Tajikistan", "Tanzania",
  "Thailand", "Togo", "Trinidad And Tobago", "Tunisia", "Turkey", "Turkmenistan", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom",
  "United States", "Uruguay", "Uzbekistan", "Vanuatu", "Venezuela", "Viet Nam", "Yemen", "Zambia", "Zimbabwe"
];

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  };
}

function corsResponse(body, status = 200) {
  return new Response(body, { status, headers: corsHeaders() });
}

function corsJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

/**
 * Garantit la création automatique des tables D1 si elles n'existent pas
 */
async function ensureTables(db) {
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS releases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_uid TEXT NOT NULL,
        title TEXT NOT NULL,
        type TEXT DEFAULT 'Single',
        artist_name TEXT,
        cover_url TEXT,
        status TEXT DEFAULT 'brouillon',
        release_date TEXT,
        original_release_date TEXT,
        preorder_date TEXT,
        timezone TEXT,
        exact_time TEXT,
        primary_genre TEXT,
        secondary_genre TEXT,
        language TEXT,
        is_instrumental INTEGER DEFAULT 0,
        label_name TEXT,
        copyright_line_c TEXT,
        copyright_line_p TEXT,
        std_copyright TEXT,
        manual_platforms INTEGER DEFAULT 0,
        selected_platforms TEXT,
        additional_deliveries TEXT,
        version_line TEXT,
        licence_type TEXT DEFAULT 'Copyright',
        upc TEXT,
        territories TEXT,
        tracks TEXT,
        feats TEXT,
        apple_motion_11 TEXT,
        apple_motion_34 TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS user_tracks (
        id TEXT PRIMARY KEY,
        user_uid TEXT NOT NULL,
        title TEXT NOT NULL,
        file_url TEXT,
        version TEXT,
        is_ai_generated INTEGER DEFAULT 0,
        language TEXT,
        isrc TEXT,
        iswc TEXT,
        writers TEXT,
        apple_credits TEXT,
        lyrics_text TEXT,
        lyric_type TEXT,
        atmos_url TEXT,
        inst_url TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS user_plays (
        id TEXT PRIMARY KEY,
        user_uid TEXT NOT NULL,
        release_id TEXT,
        track_id TEXT,
        platform TEXT,
        country TEXT,
        play_count INTEGER DEFAULT 0,
        period_date TEXT,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        uid TEXT PRIMARY KEY,
        first_name TEXT,
        last_name TEXT,
        full_name TEXT,
        artist_name TEXT,
        email TEXT,
        address TEXT,
        city TEXT,
        postal_code TEXT,
        iban TEXT,
        photo_url TEXT,
        role TEXT DEFAULT 'user',
        auth_method TEXT DEFAULT 'password',
        plan_name TEXT DEFAULT 'starter',
        subscription_status TEXT,
        theme TEXT DEFAULT 'normal-auto',
        totp_enabled INTEGER DEFAULT 0,
        totp_secret TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS artists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_uid TEXT NOT NULL,
        name TEXT NOT NULL,
        primary_genre TEXT,
        feat TEXT,
        toolost_artist_id TEXT,
        spotify_id TEXT,
        apple_music_id TEXT,
        audiomack_id TEXT,
        even_artist_id TEXT,
        facebook_url TEXT,
        instagram_url TEXT,
        youtube_url TEXT,
        photo TEXT,
        contact_email TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
  ]);
}

async function extractUserId(request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  try {
    const token = authHeader.split("Bearer ")[1];
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.sub || payload.user_id || payload.uid || null;
  } catch {
    return null;
  }
}

async function isAdmin(env, uid) {
  const row = await env.DB.prepare("SELECT role FROM users WHERE uid = ?").bind(uid).first();
  return row && row.role === "admin";
}

async function getUser(env, uid) {
  const row = await env.DB.prepare("SELECT * FROM users WHERE uid = ?").bind(uid).first();
  if (!row) return corsJson({ uid, planName: "starter", role: "user" });
  return corsJson(formatUserRow(row));
}

async function getMe(env, uid) {
  const row = await env.DB.prepare("SELECT * FROM users WHERE uid = ?").bind(uid).first();
  if (!row) return corsJson({ user: { uid, planName: "starter", role: "user" } });
  return corsJson({ user: formatUserRow(row) });
}

async function listUsers(env, userId, isAdminUser) {
  if (!isAdminUser) return corsJson({ error: "Accès non autorisé" }, 403);
  const { results } = await env.DB.prepare("SELECT * FROM users ORDER BY created_at DESC").all();
  return corsJson(results.map(formatUserRow));
}

async function upsertUser(env, uid, request) {
  const data = await request.json();
  const now = new Date().toISOString();

  await env.DB.prepare(`
    INSERT INTO users (uid, first_name, last_name, full_name, artist_name, email, address, city, postal_code, iban, photo_url, role, auth_method, plan_name, subscription_status, theme, totp_enabled, totp_secret, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(uid) DO UPDATE SET
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      full_name = excluded.full_name,
      artist_name = excluded.artist_name,
      email = excluded.email,
      address = excluded.address,
      city = excluded.city,
      postal_code = excluded.postal_code,
      iban = excluded.iban,
      photo_url = excluded.photo_url,
      role = excluded.role,
      auth_method = excluded.auth_method,
      plan_name = excluded.plan_name,
      subscription_status = excluded.subscription_status,
      theme = excluded.theme,
      totp_enabled = excluded.totp_enabled,
      totp_secret = excluded.totp_secret,
      updated_at = excluded.updated_at
  `).bind(
    uid,
    data.firstName || null,
    data.lastName || null,
    data.fullName || (data.firstName && data.lastName ? `${data.firstName} ${data.lastName}`.trim() : null),
    data.artistName || null,
    data.email || null,
    data.address || null,
    data.city || null,
    data.postalCode || null,
    data.iban || null,
    data.photoURL || null,
    data.role || "user",
    data.authMethod || "password",
    data.planName || "starter",
    data.subscriptionStatus || null,
    data.theme || "normal-auto",
    data.totpEnabled ? 1 : 0,
    data.totpSecret || null,
    data.createdAt || now,
    now
  ).run();

  return corsJson({ success: true });
}

async function patchUser(env, uid, request) {
  const data = await request.json();
  const now = new Date().toISOString();

  const fieldMap = {
    firstName: "first_name",
    lastName: "last_name",
    fullName: "full_name",
    artistName: "artist_name",
    email: "email",
    address: "address",
    city: "city",
    postalCode: "postal_code",
    iban: "iban",
    photoURL: "photo_url",
    role: "role",
    authMethod: "auth_method",
    planName: "plan_name",
    subscriptionStatus: "subscription_status",
    theme: "theme",
    totpEnabled: "totp_enabled",
    totpSecret: "totp_secret",
  };

  const sets = [];
  const values = [];

  for (const [key, column] of Object.entries(fieldMap)) {
    if (data[key] !== undefined) {
      sets.push(`${column} = ?`);
      values.push(key === "totpEnabled" ? (data[key] ? 1 : 0) : data[key]);
    }
  }

  if (sets.length === 0) return corsJson({ error: "Aucun champ à mettre à jour" }, 400);

  sets.push("updated_at = ?");
  values.push(now, uid);

  await env.DB.prepare(`UPDATE users SET ${sets.join(", ")} WHERE uid = ?`).bind(...values).run();
  return corsJson({ success: true });
}

function formatUserRow(row) {
  if (!row) return null;
  return {
    uid: row.uid,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: row.full_name,
    artistName: row.artist_name,
    email: row.email,
    address: row.address,
    city: row.city,
    postalCode: row.postal_code,
    iban: row.iban,
    photoURL: row.photo_url,
    role: row.role,
    authMethod: row.auth_method,
    planName: row.plan_name || "starter",
    subscriptionStatus: row.subscription_status,
    theme: row.theme,
    totpEnabled: !!row.totp_enabled,
    totpSecret: row.totp_secret,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getUserTracks(env, uid) {
  const { results } = await env.DB.prepare("SELECT * FROM user_tracks WHERE user_uid = ? ORDER BY created_at DESC").bind(uid).all();
  return corsJson(results || []);
}

async function createOrUpdateUserTrack(env, uid, request) {
  const data = await request.json();
  const id = data.id || `track_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  await env.DB.prepare(`
    INSERT INTO user_tracks (
      id, user_uid, title, file_url, version, is_ai_generated, language,
      isrc, iswc, writers, apple_credits, lyrics_text, lyric_type, atmos_url, inst_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      file_url = excluded.file_url,
      version = excluded.version,
      is_ai_generated = excluded.is_ai_generated,
      language = excluded.language,
      isrc = excluded.isrc,
      iswc = excluded.iswc,
      writers = excluded.writers,
      apple_credits = excluded.apple_credits,
      lyrics_text = excluded.lyrics_text,
      lyric_type = excluded.lyric_type,
      atmos_url = excluded.atmos_url,
      inst_url = excluded.inst_url
  `).bind(
    id, uid, data.title || "Titre inconnu", data.fileUrl || "", data.version || "",
    data.isAiGenerated ? 1 : 0, data.language || "Français", data.isrc || "", data.iswc || "",
    data.writers || "", data.appleCredits || "", data.lyricsText || "", data.lyricType || "Clean",
    data.atmosUrl || null, data.instUrl || null
  ).run();

  return corsJson({ success: true, id }, 201);
}

async function deleteUserTrack(env, uid, trackId) {
  await env.DB.prepare("DELETE FROM user_tracks WHERE id = ? AND user_uid = ?").bind(trackId, uid).run();
  return corsJson({ success: true });
}

async function getUserPlays(env, uid) {
  const { results } = await env.DB.prepare("SELECT * FROM user_plays WHERE user_uid = ? ORDER BY updated_at DESC").bind(uid).all();
  return corsJson(results || []);
}

async function recordUserPlay(env, uid, request) {
  const body = await request.json();
  const id = `play_${Date.now()}`;
  await env.DB.prepare(`
    INSERT INTO user_plays (id, user_uid, release_id, track_id, platform, country, play_count, period_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, uid, body.releaseId || "", body.trackId || "", body.platform || "Spotify",
    body.country || "France", body.playCount || 0, body.periodDate || new Date().toISOString().split("T")[0]
  ).run();

  return corsJson({ success: true, id }, 201);
}

async function getAllArtists(env) {
  const { results } = await env.DB.prepare("SELECT * FROM artists ORDER BY name ASC").all();
  return corsJson(results.map(formatArtistRow));
}

async function getAllFeats(env) {
  const { results } = await env.DB.prepare("SELECT * FROM artists WHERE feat IS NOT NULL AND feat != '' ORDER BY name ASC").all();
  return corsJson(results.map(formatArtistRow));
}

async function getUserArtists(env, uid) {
  const { results } = await env.DB.prepare("SELECT * FROM artists WHERE user_uid = ? ORDER BY name ASC").bind(uid).all();
  return corsJson(results.map(formatArtistRow));
}

async function createArtist(env, uid, request) {
  const data = await request.json();
  const now = new Date().toISOString();

  const res = await env.DB.prepare(`
    INSERT INTO artists (user_uid, name, primary_genre, feat, toolost_artist_id, spotify_id, apple_music_id, audiomack_id, even_artist_id, facebook_url, instagram_url, youtube_url, photo, contact_email, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    uid,
    data.name,
    data.primaryGenre || null,
    data.feat || null,
    data.toolostArtistId || null,
    data.spotifyId || null,
    data.appleMusicId || null,
    data.audiomackId || null,
    data.evenArtistId || null,
    data.facebookUrl || null,
    data.instagramUrl || null,
    data.youtubeUrl || null,
    data.photo || null,
    data.contactEmail || null,
    now
  ).run();

  return corsJson({ id: res.meta.last_row_id, success: true }, 201);
}

async function createFeat(env, uid, request) {
  const data = await request.json();
  const now = new Date().toISOString();

  const links = data.links || {};
  const res = await env.DB.prepare(`
    INSERT INTO artists (user_uid, name, feat, apple_music_id, spotify_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    uid,
    data.name,
    "feat",
    links.apple || data.appleMusicId || null,
    links.spotify || data.spotifyId || null,
    now
  ).run();

  return corsJson({ id: res.meta.last_row_id, name: data.name, success: true }, 201);
}

async function patchArtist(env, uid, artistId, request) {
  const data = await request.json();

  await env.DB.prepare(`
    UPDATE artists SET
      name = COALESCE(?, name),
      primary_genre = COALESCE(?, primary_genre),
      spotify_id = COALESCE(?, spotify_id),
      apple_music_id = COALESCE(?, apple_music_id),
      photo = COALESCE(?, photo)
    WHERE id = ? AND (user_uid = ? OR ? = 1)
  `).bind(
    data.name || null,
    data.primaryGenre || null,
    data.spotifyId || null,
    data.appleMusicId || null,
    data.photo || null,
    artistId,
    uid,
    (await isAdmin(env, uid)) ? 1 : 0
  ).run();

  return corsJson({ success: true });
}

async function deleteArtist(env, uid, artistId) {
  await env.DB.prepare("DELETE FROM artists WHERE id = ? AND user_uid = ?").bind(artistId, uid).run();
  return corsJson({ success: true });
}

function formatArtistRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userUid: row.user_uid,
    name: row.name,
    primaryGenre: row.primary_genre,
    feat: row.feat,
    toolostArtistId: row.toolost_artist_id,
    spotifyId: row.spotify_id,
    appleMusicId: row.apple_music_id,
    audiomackId: row.audiomack_id,
    evenArtistId: row.even_artist_id,
    facebookUrl: row.facebook_url,
    instagramUrl: row.instagram_url,
    youtubeUrl: row.youtube_url,
    photo: row.photo,
    contactEmail: row.contact_email,
    createdAt: row.created_at,
  };
}

async function getAllReleases(env, url) {
  const status = url.searchParams.get("status");
  let query = "SELECT * FROM releases";
  const params = [];

  if (status) {
    query += " WHERE status = ?";
    params.push(status);
  }
  query += " ORDER BY created_at DESC";

  const { results } = await env.DB.prepare(query).bind(...params).all();
  return corsJson(results.map(formatReleaseRow));
}

async function getUserReleases(env, uid) {
  const { results } = await env.DB.prepare("SELECT * FROM releases WHERE user_uid = ? ORDER BY created_at DESC").bind(uid).all();
  return corsJson(results.map(formatReleaseRow));
}

async function getRelease(env, uid, releaseId) {
  const row = await env.DB.prepare("SELECT * FROM releases WHERE id = ? AND user_uid = ?").bind(releaseId, uid).first();
  if (!row) return corsJson({ error: "Sortie non trouvée" }, 404);
  return corsJson(formatReleaseRow(row));
}

async function getPublicRelease(env, releaseId) {
  const row = await env.DB.prepare("SELECT * FROM releases WHERE id = ?").bind(releaseId).first();
  if (!row) return corsJson({ error: "Sortie non trouvée" }, 404);
  return corsJson(formatReleaseRow(row));
}

async function getAdminRelease(env, path, isAdminUser) {
  if (!isAdminUser) return corsJson({ error: "Accès non autorisé" }, 403);
  const releaseId = path.split("/").pop();
  const row = await env.DB.prepare("SELECT * FROM releases WHERE id = ?").bind(releaseId).first();
  if (!row) return corsJson({ error: "Sortie non trouvée" }, 404);
  return corsJson(formatReleaseRow(row));
}

async function createRelease(env, uid, request) {
  const data = await request.json();
  const now = new Date().toISOString();

  const formattedTerritories = typeof data.territories === "object"
    ? JSON.stringify(data.territories)
    : (data.territories || "Tous les pays (Monde entier)");

  const res = await env.DB.prepare(`
    INSERT INTO releases (
      user_uid, title, type, artist_name, cover_url, status,
      release_date, original_release_date, preorder_date, timezone, exact_time,
      primary_genre, secondary_genre, language, is_instrumental,
      label_name, copyright_line_c, copyright_line_p, std_copyright,
      manual_platforms, selected_platforms, additional_deliveries,
      version_line, licence_type, upc, territories, tracks, feats,
      apple_motion_11, apple_motion_34, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?
    )
  `).bind(
    uid,
    data.title || "",
    data.type || "Single",
    data.artistName || "",
    data.coverUrl || "",
    data.status || "brouillon",
    data.releaseDate || "",
    data.originalReleaseDate || "",
    data.preorderDate || "",
    data.timezone || "",
    data.exactTime || "",
    data.primaryGenre || "",
    data.secondaryGenre || "",
    data.language || "",
    data.isInstrumental ? 1 : 0,
    data.labelName || "",
    data.copyrightLineC || "",
    data.copyrightLineP || "",
    data.stdCopyright || "",
    data.manualPlatforms ? 1 : 0,
    JSON.stringify(data.selectedPlatforms || []),
    JSON.stringify(data.additionalDeliveries || []),
    data.versionLine || "",
    data.licenceType || "Copyright",
    data.upc || "",
    formattedTerritories,
    JSON.stringify(data.tracks || []),
    JSON.stringify(data.feats || []),
    data.appleMotion11 || null,
    data.appleMotion34 || null,
    now,
    now
  ).run();

  return corsJson({ id: res.meta.last_row_id, success: true }, 201);
}

async function patchRelease(env, uid, releaseId, request) {
  const data = await request.json();
  const now = new Date().toISOString();

  const row = await env.DB.prepare("SELECT * FROM releases WHERE id = ? AND user_uid = ?").bind(releaseId, uid).first();
  if (!row) return corsJson({ error: "Sortie non trouvée ou non autorisée" }, 404);

  let formattedTerritories = null;
  if (data.territories !== undefined) {
    formattedTerritories = typeof data.territories === "object"
      ? JSON.stringify(data.territories)
      : data.territories;
  }

  await env.DB.prepare(`
    UPDATE releases SET
      title = COALESCE(?, title),
      type = COALESCE(?, type),
      artist_name = COALESCE(?, artist_name),
      cover_url = COALESCE(?, cover_url),
      status = COALESCE(?, status),
      release_date = COALESCE(?, release_date),
      original_release_date = COALESCE(?, original_release_date),
      preorder_date = COALESCE(?, preorder_date),
      timezone = COALESCE(?, timezone),
      exact_time = COALESCE(?, exact_time),
      primary_genre = COALESCE(?, primary_genre),
      secondary_genre = COALESCE(?, secondary_genre),
      language = COALESCE(?, language),
      is_instrumental = COALESCE(?, is_instrumental),
      label_name = COALESCE(?, label_name),
      copyright_line_c = COALESCE(?, copyright_line_c),
      copyright_line_p = COALESCE(?, copyright_line_p),
      std_copyright = COALESCE(?, std_copyright),
      manual_platforms = COALESCE(?, manual_platforms),
      selected_platforms = COALESCE(?, selected_platforms),
      additional_deliveries = COALESCE(?, additional_deliveries),
      version_line = COALESCE(?, version_line),
      licence_type = COALESCE(?, licence_type),
      upc = COALESCE(?, upc),
      territories = COALESCE(?, territories),
      tracks = COALESCE(?, tracks),
      feats = COALESCE(?, feats),
      apple_motion_11 = COALESCE(?, apple_motion_11),
      apple_motion_34 = COALESCE(?, apple_motion_34),
      updated_at = ?
    WHERE id = ? AND user_uid = ?
  `).bind(
    data.title !== undefined ? data.title : null,
    data.type !== undefined ? data.type : null,
    data.artistName !== undefined ? data.artistName : null,
    data.coverUrl !== undefined ? data.coverUrl : null,
    data.status !== undefined ? data.status : null,
    data.releaseDate !== undefined ? data.releaseDate : null,
    data.originalReleaseDate !== undefined ? data.originalReleaseDate : null,
    data.preorderDate !== undefined ? data.preorderDate : null,
    data.timezone !== undefined ? data.timezone : null,
    data.exactTime !== undefined ? data.exactTime : null,
    data.primaryGenre !== undefined ? data.primaryGenre : null,
    data.secondaryGenre !== undefined ? data.secondaryGenre : null,
    data.language !== undefined ? data.language : null,
    data.isInstrumental !== undefined ? (data.isInstrumental ? 1 : 0) : null,
    data.labelName !== undefined ? data.labelName : null,
    data.copyrightLineC !== undefined ? data.copyrightLineC : null,
    data.copyrightLineP !== undefined ? data.copyrightLineP : null,
    data.stdCopyright !== undefined ? data.stdCopyright : null,
    data.manualPlatforms !== undefined ? (data.manualPlatforms ? 1 : 0) : null,
    data.selectedPlatforms !== undefined ? JSON.stringify(data.selectedPlatforms) : null,
    data.additionalDeliveries !== undefined ? JSON.stringify(data.additionalDeliveries) : null,
    data.versionLine !== undefined ? data.versionLine : null,
    data.licenceType !== undefined ? data.licenceType : null,
    data.upc !== undefined ? data.upc : null,
    formattedTerritories,
    data.tracks !== undefined ? JSON.stringify(data.tracks) : null,
    data.feats !== undefined ? JSON.stringify(data.feats) : null,
    data.appleMotion11 !== undefined ? data.appleMotion11 : null,
    data.appleMotion34 !== undefined ? data.appleMotion34 : null,
    now,
    releaseId,
    uid
  ).run();

  return corsJson({ id: releaseId, success: true });
}

async function adminPatchRelease(env, userId, request) {
  if (!(await isAdmin(env, userId))) return corsJson({ error: "Accès non autorisé" }, 403);
  const data = await request.json();
  const releaseId = data.id;

  if (!releaseId) return corsJson({ error: "ID de sortie manquant" }, 400);

  await env.DB.prepare(`
    UPDATE releases SET
      status = COALESCE(?, status),
      upc = COALESCE(?, upc),
      updated_at = ?
    WHERE id = ?
  `).bind(
    data.status || null,
    data.upc || null,
    new Date().toISOString(),
    releaseId
  ).run();

  return corsJson({ success: true });
}

async function deleteRelease(env, uid, releaseId) {
  await env.DB.prepare("DELETE FROM releases WHERE id = ? AND user_uid = ?").bind(releaseId, uid).run();
  return corsJson({ success: true });
}

function formatReleaseRow(row) {
  if (!row) return null;

  let selectedPlatforms = [];
  try { selectedPlatforms = JSON.parse(row.selected_platforms || "[]"); } catch (e) { }

  let additionalDeliveries = [];
  try { additionalDeliveries = JSON.parse(row.additional_deliveries || "[]"); } catch (e) { }

  let tracks = [];
  try { tracks = JSON.parse(row.tracks || "[]"); } catch (e) { }

  let feats = [];
  try { feats = JSON.parse(row.feats || "[]"); } catch (e) { }

  let territories = row.territories || "Tous les pays (Monde entier)";
  try {
    if (typeof territories === "string" && (territories.startsWith("[") || territories.startsWith("{"))) {
      territories = JSON.parse(territories);
    }
  } catch (e) { }

  return {
    id: row.id,
    userUid: row.user_uid,
    title: row.title || "",
    type: row.type || "Single",
    artistName: row.artist_name || "",
    coverUrl: row.cover_url || "",
    status: row.status || "brouillon",
    releaseDate: row.release_date || "",
    originalReleaseDate: row.original_release_date || "",
    preorderDate: row.preorder_date || "",
    timezone: row.timezone || "",
    exactTime: row.exact_time || "",
    primaryGenre: row.primary_genre || "",
    secondaryGenre: row.secondary_genre || "",
    language: row.language || "",
    isInstrumental: Boolean(row.is_instrumental),
    labelName: row.label_name || "",
    copyrightLineC: row.copyright_line_c || "",
    copyrightLineP: row.copyright_line_p || "",
    stdCopyright: row.std_copyright || "",
    manualPlatforms: Boolean(row.manual_platforms),
    selectedPlatforms,
    additionalDeliveries,
    versionLine: row.version_line || "",
    licenceType: row.licence_type || "Copyright",
    upc: row.upc || "",
    territories,
    tracks,
    feats,
    appleMotion11: row.apple_motion_11 || null,
    appleMotion34: row.apple_motion_34 || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function uploadFile(env, userId, type, request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file) {
      return corsJson({ error: "Aucun fichier fourni" }, 400);
    }

    const filename = file.name || "upload";
    const ext = filename.split(".").pop();
    const key = `${type}/${userId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;

    const bucket = env.STORAGE || env.BUCKET || env.MEDIA_BUCKET;
    if (bucket) {
      await bucket.put(key, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type || "application/octet-stream" },
      });
    } else if (env.FILES_KV) {
      await env.FILES_KV.put(key, await file.arrayBuffer());
    } else {
      return corsJson({ error: "Stockage R2 non configuré sur le worker" }, 500);
    }

    const url = `/api/files/${encodeURIComponent(key)}`;
    return corsJson({ key, url, success: true });
  } catch (err) {
    return corsJson({ error: `Erreur de téléversement: ${err.message}` }, 500);
  }
}

async function serveFile(env, key) {
  try {
    const bucket = env.STORAGE || env.BUCKET || env.MEDIA_BUCKET;
    if (bucket) {
      const object = await bucket.get(key);
      if (!object) return new Response("Fichier non trouvé", { status: 404 });
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      headers.set("Access-Control-Allow-Origin", "*");
      return new Response(object.body, { headers });
    }
    if (env.FILES_KV) {
      const value = await env.FILES_KV.get(key, "arrayBuffer");
      if (!value) return new Response("Fichier non trouvé", { status: 404 });
      return new Response(value, { headers: { "Access-Control-Allow-Origin": "*" } });
    }
    return new Response("Stockage non disponible", { status: 500 });
  } catch (err) {
    return new Response(`Erreur: ${err.message}`, { status: 500 });
  }
}

async function getAllReviews(env) {
  const { results } = await env.DB.prepare("SELECT * FROM reviews ORDER BY created_at DESC").all();
  return corsJson(results);
}

async function upsertReview(env, request) {
  const data = await request.json();
  const now = new Date().toISOString();
  await env.DB.prepare(`
    INSERT INTO reviews (user_uid, author_name, rating, comment, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(data.userUid, data.authorName, data.rating, data.comment, now).run();
  return corsJson({ success: true });
}

async function getAllVersions(env) {
  const { results } = await env.DB.prepare("SELECT * FROM app_versions ORDER BY version_code DESC").all();
  return corsJson(results);
}

async function createVersion(env, request, userId, isAdminUser) {
  if (!isAdminUser) return corsJson({ error: "Accès non autorisé" }, 403);
  const data = await request.json();
  const res = await env.DB.prepare(`
    INSERT INTO app_versions (version_name, version_code, release_notes, created_at)
    VALUES (?, ?, ?, ?)
  `).bind(data.versionName, data.versionCode, data.releaseNotes, new Date().toISOString()).run();
  return corsJson({ id: res.meta.last_row_id, success: true });
}

async function patchVersion(env, path, request, userId, isAdminUser) {
  if (!isAdminUser) return corsJson({ error: "Accès non autorisé" }, 403);
  const versionId = path.split("/").pop();
  const data = await request.json();
  await env.DB.prepare(`
    UPDATE app_versions SET version_name = COALESCE(?, version_name), release_notes = COALESCE(?, release_notes) WHERE id = ?
  `).bind(data.versionName || null, data.releaseNotes || null, versionId).run();
  return corsJson({ success: true });
}

async function createMessage(env, request) {
  const data = await request.json();
  await env.DB.prepare(`
    INSERT INTO messages (name, email, subject, message, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(data.name, data.email, data.subject, data.message, new Date().toISOString()).run();
  return corsJson({ success: true });
}

async function getAllMessages(env, userId, isAdminUser) {
  if (!isAdminUser) return corsJson({ error: "Accès non autorisé" }, 403);
  const { results } = await env.DB.prepare("SELECT * FROM messages ORDER BY created_at DESC").all();
  return corsJson(results);
}

async function getAllWithdrawals(env, userId, isAdminUser) {
  if (!isAdminUser) return corsJson({ error: "Accès non autorisé" }, 403);
  const { results } = await env.DB.prepare("SELECT * FROM withdrawals ORDER BY created_at DESC").all();
  return corsJson(results);
}

async function patchWithdrawal(env, userId, path, request, isAdminUser) {
  if (!isAdminUser) return corsJson({ error: "Accès non autorisé" }, 403);
  const id = path.split("/").pop();
  const data = await request.json();
  await env.DB.prepare("UPDATE withdrawals SET status = ? WHERE id = ?").bind(data.status, id).run();
  return corsJson({ success: true });
}

async function getSetting(env, path, isAdminUser) {
  if (!isAdminUser) return corsJson({ error: "Accès non autorisé" }, 403);
  const key = path.split("/").pop();
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first();
  return corsJson({ value: row ? row.value : null });
}

async function upsertSetting(env, path, request, isAdminUser) {
  if (!isAdminUser) return corsJson({ error: "Accès non autorisé" }, 403);
  const key = path.split("/").pop();
  const data = await request.json();
  await env.DB.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).bind(key, typeof data.value === "object" ? JSON.stringify(data.value) : data.value).run();
  return corsJson({ success: true });
}

async function createNotification(env, userId, path, request, isAdminUser) {
  if (!isAdminUser) return corsJson({ error: "Accès non autorisé" }, 403);
  const targetUid = path.split("/")[4];
  const data = await request.json();
  await env.DB.prepare(`
    INSERT INTO notifications (user_uid, title, message, created_at)
    VALUES (?, ?, ?, ?)
  `).bind(targetUid, data.title, data.message, new Date().toISOString()).run();
  return corsJson({ success: true });
}

async function getFinances(env, userId, path, isAdminUser) {
  const targetUid = path.split("/")[4];
  if (targetUid !== userId && !isAdminUser) return corsJson({ error: "Accès non autorisé" }, 403);
  const { results } = await env.DB.prepare("SELECT * FROM finances WHERE user_uid = ? ORDER BY date DESC").bind(targetUid).all();
  return corsJson(results);
}

async function createFinance(env, userId, path, request, isAdminUser) {
  if (!isAdminUser) return corsJson({ error: "Accès non autorisé" }, 403);
  const targetUid = path.split("/")[4];
  const data = await request.json();
  await env.DB.prepare(`
    INSERT INTO finances (user_uid, amount, description, type, date)
    VALUES (?, ?, ?, ?, ?)
  `).bind(targetUid, data.amount, data.description, data.type || "royalty", data.date || new Date().toISOString()).run();
  return corsJson({ success: true });
}

async function patchFinance(env, userId, path, request, isAdminUser) {
  if (!isAdminUser) return corsJson({ error: "Accès non autorisé" }, 403);
  const id = path.split("/").pop();
  const data = await request.json();
  await env.DB.prepare(`
    UPDATE finances SET amount = COALESCE(?, amount), description = COALESCE(?, description) WHERE id = ?
  `).bind(data.amount || null, data.description || null, id).run();
  return corsJson({ success: true });
}

async function deleteFinance(env, userId, path, isAdminUser) {
  if (!isAdminUser) return corsJson({ error: "Accès non autorisé" }, 403);
  const id = path.split("/").pop();
  await env.DB.prepare("DELETE FROM finances WHERE id = ?").bind(id).run();
  return corsJson({ success: true });
}