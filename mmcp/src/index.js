export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return corsResponse(null, 204);
    }

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
      if (method === "GET" && (path === "/api/releases" || path === "/api/admin/releases")) {
        return await getAllReleases(env, url);
      }
      if (method === "GET" && path === "/api/reviews") {
        return await getAllReviews(env);
      }

      // Routes versions publiques et sécurisées
      if (method === "GET" && path === "/api/versions") {
        return await getAllVersions(env);
      }
      if (method === "POST" && path === "/api/versions") {
        return await createVersionSafe(env, request);
      }

      const versionMatch = path.match(/^\/api\/versions\/(\d+)$/);
      if (versionMatch) {
        const versionId = versionMatch[1];
        if (method === "PUT" || method === "PATCH") {
          return await patchVersionSafe(env, versionId, request);
        }
      }

      if (method === "POST" && (path === "/api/messages" || path === "/api/admin/messages")) {
        return await createMessage(env, request);
      }

      if (path === "/api/support/tickets") {
        if (method === "POST") return await createSupportTicket(env, request);
        if (method === "GET") return await getSupportTickets(env, request);
      }

      const ticketMessagesMatch = path.match(/^\/api\/support\/tickets\/(\d+)\/messages$/);
      if (ticketMessagesMatch) {
        const ticketId = ticketMessagesMatch[1];
        if (method === "POST") return await addTicketMessage(env, ticketId, request);
      }

      const ticketUpdateMatch = path.match(/^\/api\/support\/tickets\/(\d+)$/);
      if (ticketUpdateMatch) {
        const ticketId = ticketUpdateMatch[1];
        if (method === "PUT" || method === "PATCH") return await updateTicketStatus(env, ticketId, request);
      }

      if (method === "GET" && path.startsWith("/api/files/")) {
        const key = decodeURIComponent(path.replace("/api/files/", ""));
        return await serveFile(env, key);
      }

      if (method === "GET" && path.match(/^\/api\/releases\/\d+$/)) {
        const releaseId = path.split("/").pop();
        return await getPublicRelease(env, releaseId);
      }

      if (method === "POST" && path === "/api/reviews") {
        return await upsertReview(env, request);
      }

      const reviewMatch = path.match(/^\/api\/reviews\/(\d+)$/);
      if (reviewMatch) {
        const reviewId = reviewMatch[1];
        if (method === "PUT" || method === "PATCH") {
          return await updateReview(env, reviewId, request);
        }
      }

      if (path === "/api/withdrawals") {
        if (method === "GET") return await getWithdrawalsSafe(env, request);
        if (method === "POST") return await createWithdrawalSafe(env, request);
      }

      const userPayoutsMatch = path.match(/^\/api\/users\/([^/]+)\/payouts$/);
      if (userPayoutsMatch) {
        const uid = userPayoutsMatch[1];
        if (method === "GET") return await getUserPayoutsSafe(env, uid, request);
        if (method === "POST") return await createUserPayoutSafe(env, uid, request);
      }

      const userFinancesMatch = path.match(/^\/api\/users\/([^/]+)\/finances$/);
      if (userFinancesMatch) {
        const uid = userFinancesMatch[1];
        if (method === "GET") return await getUserFinancesSafe(env, uid, request);
        if (method === "POST") {
          const userId = await extractUserId(request);
          const isAdminUser = userId ? await isAdmin(env, userId) : true;
          return await createUserFinance(env, uid, request, isAdminUser);
        }
      }

      const userId = await extractUserId(request);
      if (!userId) {
        return corsJson({ error: "Authentification requise" }, 401);
      }
      const isAdminUser = await isAdmin(env, userId);

      if (method === "GET" && (path === "/api/admin/messages" || path === "/api/messages")) {
        return await getAllMessages(env, userId, isAdminUser);
      }

      if (method === "GET" && path === "/api/me") {
        return await getMe(env, userId);
      }

      if (method === "GET" && (path === "/api/admin/users" || path === "/api/users")) {
        return await listUsers(env, userId, isAdminUser);
      }
      if (method === "GET" && (path === "/api/admin/withdrawals" || path === "/api/withdrawals")) {
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

      if (method === "POST" && path === "/api/feats") {
        return await createFeat(env, userId, request);
      }

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

      const userFinanceItemMatch = path.match(/^\/api\/users\/([^/]+)\/finances\/([^/]+)$/);
      if (userFinanceItemMatch) {
        const uid = userFinanceItemMatch[1];
        const financeId = userFinanceItemMatch[2];
        if (!isAdminUser && uid !== userId) return corsJson({ error: "Accès non autorisé" }, 403);
        if (method === "PATCH" || method === "PUT") return await patchUserFinance(env, uid, financeId, request, isAdminUser);
        if (method === "DELETE") return await deleteUserFinance(env, uid, financeId, isAdminUser);
      }

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

      const userPlaysMatch = path.match(/^\/api\/users\/([^/]+)\/plays$/);
      if (userPlaysMatch) {
        const uid = userPlaysMatch[1];
        const isSelf = uid === userId;
        if (!isSelf && !isAdminUser) return corsJson({ error: "Accès non autorisé" }, 403);
        if (method === "GET") return await getUserPlays(env, uid);
        if (method === "POST") return await recordUserPlay(env, uid, request);
      }

      const userArtistsMatch = path.match(/^\/api\/users\/([^/]+)\/artists$/);
      if (userArtistsMatch) {
        const uid = userArtistsMatch[1];
        const isSelf = uid === userId;
        if (!isSelf && !isAdminUser) return corsJson({ error: "Accès non autorisé" }, 403);
        if (method === "GET") return await getUserArtists(env, uid);
        if (method === "POST") return await createArtist(env, uid, request);
      }

      const userArtistMatch = path.match(/^\/api\/users\/([^/]+)\/artists\/([^/]+)$/);
      if (userArtistMatch) {
        const uid = userArtistMatch[1];
        const artistId = userArtistMatch[2];
        const isSelf = uid === userId;
        if (!isSelf && !isAdminUser) return corsJson({ error: "Accès non autorisé" }, 403);
        if (method === "GET") return await getArtist(env, uid, artistId);
        if (method === "PATCH" || method === "PUT") return await patchArtist(env, uid, artistId, request);
        if (method === "DELETE") return await deleteArtist(env, uid, artistId);
      }

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

      const generalReleaseMatch = path.match(/^\/api\/releases\/(\d+)$/);
      if (generalReleaseMatch) {
        const releaseId = generalReleaseMatch[1];
        if (method === "GET") return await getPublicRelease(env, releaseId);
        if (method === "PATCH" || method === "PUT") {
          return await patchRelease(env, userId, releaseId, request);
        }
      }

      if (path === "/api/upload" && method === "POST") {
        return await uploadFile(env, userId, "file", request);
      }
      if (method === "POST" && path === "/api/upload/chunk") {
        return await uploadChunk(env, userId, request);
      }
      if (method === "POST" && path === "/api/upload/chunk/complete") {
        return await completeChunkUpload(env, userId, request);
      }
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

function getBucket(env, type = "file") {
  const isAudioUpload = ["track", "atmos", "inst", "motion", "cover", "pochette"].includes(type);
  if (isAudioUpload) {
    return env.STORAGE || env.BUCKET || env.MEDIA_BUCKET || env.R2 || null;
  }
  return env.BUCKET || env.MEDIA_BUCKET || env.STORAGE || env.R2 || null;
}

function getContentType(ext) {
  const map = {
    wav: "audio/wav",
    mp3: "audio/mpeg",
    flac: "audio/flac",
    m4a: "audio/mp4",
    caf: "audio/x-caf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    mp4: "video/mp4",
    mov: "video/quicktime",
  };
  return map[ext.toLowerCase()] || "application/octet-stream";
}

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
        animated_cover_url TEXT,
        release_url TEXT,
        spotify_url TEXT,
        apple_url TEXT,
        show_on_mmcp_catalog INTEGER DEFAULT 1,
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
        role TEXT DEFAULT 'admin',
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
        genre TEXT,
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
        banner_url TEXT,
        birthdate TEXT,
        birthplace TEXT,
        contact_email TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_uid TEXT,
        artist_name TEXT NOT NULL,
        rating INTEGER DEFAULT 5,
        comment TEXT,
        message TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS app_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version TEXT,
        description TEXT,
        version_name TEXT,
        release_notes TEXT,
        date TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT,
        subject TEXT,
        message TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS support_tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uid TEXT NOT NULL,
        user_name TEXT,
        section TEXT NOT NULL,
        payload TEXT,
        messages TEXT,
        status TEXT DEFAULT 'ouvert',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS withdrawals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_uid TEXT,
        user_email TEXT,
        amount REAL NOT NULL,
        iban TEXT,
        status TEXT DEFAULT 'demandé',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS finances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_uid TEXT NOT NULL,
        amount REAL NOT NULL,
        period TEXT,
        release_id TEXT,
        release_title TEXT,
        artist_name TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
  ]);

  try {
    await db.prepare("ALTER TABLE support_tickets ADD COLUMN messages TEXT").run();
  } catch (e) {
    // Column already exists or table freshly created
  }
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
  if (!uid) return false;
  const row = await env.DB.prepare("SELECT role FROM users WHERE uid = ?").bind(uid).first();
  if (row) {
    return row.role === "admin";
  }

  const now = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO users (uid, role, plan_name, created_at, updated_at) VALUES (?, 'admin', 'pro', ?, ?) ON CONFLICT(uid) DO UPDATE SET role = 'admin'`).bind(uid, now, now).run();

  return true;
}

async function createSupportTicket(env, request) {
  try {
    const data = await request.json();
    const now = new Date().toISOString();
    const uid = data.uid || "anonymous";
    const userName = data.userName || "Artiste";
    const section = data.section || "general";
    const payload = JSON.stringify(data.payload || data || {});
    const initialMessages = JSON.stringify([]);

    const res = await env.DB.prepare(`
      INSERT INTO support_tickets (uid, user_name, section, payload, messages, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'ouvert', ?)
    `).bind(uid, userName, section, payload, initialMessages, now).run();

    return corsJson({ id: res.meta.last_row_id, success: true }, 201);
  } catch (err) {
    return corsJson({ error: err.message }, 500);
  }
}

async function getSupportTickets(env, request) {
  try {
    const { results } = await env.DB.prepare("SELECT * FROM support_tickets ORDER BY created_at DESC").all();
    return corsJson(results.map(row => ({
      ...row,
      payload: (() => { try { return JSON.parse(row.payload); } catch (e) { return {}; } })(),
      messages: (() => { try { return JSON.parse(row.messages || "[]"); } catch (e) { return []; } })()
    })));
  } catch (err) {
    return corsJson([], 200);
  }
}

async function addTicketMessage(env, ticketId, request) {
  try {
    const data = await request.json();
    const text = data.text || data.message || "";
    const sender = data.sender || "user";
    const createdAt = data.createdAt || new Date().toISOString();

    const row = await env.DB.prepare("SELECT messages FROM support_tickets WHERE id = ?").bind(ticketId).first();
    if (!row) return corsJson({ error: "Ticket non trouvé" }, 404);

    let messages = [];
    try {
      messages = JSON.parse(row.messages || "[]");
    } catch (e) {
      messages = [];
    }

    messages.push({ text, sender, created_at: createdAt });

    await env.DB.prepare("UPDATE support_tickets SET messages = ? WHERE id = ?").bind(JSON.stringify(messages), ticketId).run();

    return corsJson({ success: true, messages });
  } catch (err) {
    return corsJson({ error: err.message }, 500);
  }
}

async function updateTicketStatus(env, ticketId, request) {
  try {
    const data = await request.json();
    const status = data.status;
    if (!status) return corsJson({ error: "Statut manquant" }, 400);

    await env.DB.prepare("UPDATE support_tickets SET status = ? WHERE id = ?").bind(status, ticketId).run();

    return corsJson({ success: true });
  } catch (err) {
    return corsJson({ error: err.message }, 500);
  }
}

async function getUserPayoutsSafe(env, uid, request) {
  try {
    const { results } = await env.DB.prepare("SELECT * FROM withdrawals WHERE user_uid = ? ORDER BY created_at DESC").bind(uid).all();
    if (results && results.length > 0) {
      return corsJson(results.map(r => ({ id: String(r.id), title: `Versement #${r.id} - ${r.amount} € (${r.created_at.split('T')[0]})`, ...r })));
    }
    return corsJson([
      { id: "mock_payout_1", title: "Versement #1 - 45,20 € (01/2026)" },
      { id: "mock_payout_2", title: "Versement #2 - 120,00 € (02/2026)" }
    ]);
  } catch (err) {
    return corsJson([
      { id: "mock_payout_1", title: "Versement #1 - 45,20 € (01/2026)" },
      { id: "mock_payout_2", title: "Versement #2 - 120,00 € (02/2026)" }
    ]);
  }
}

async function createUserPayoutSafe(env, uid, request) {
  try {
    const data = await request.json();
    const now = new Date().toISOString();
    const amount = Number(data.amount || 0);
    const iban = data.iban || "";
    const res = await env.DB.prepare(`
      INSERT INTO withdrawals (user_uid, amount, iban, status, created_at)
      VALUES (?, ?, ?, 'demandé', ?)
    `).bind(uid, amount, iban, now).run();
    return corsJson({ id: res.meta.last_row_id, success: true }, 201);
  } catch (err) {
    return corsJson({ error: err.message }, 500);
  }
}

async function getUser(env, uid) {
  const row = await env.DB.prepare("SELECT * FROM users WHERE uid = ?").bind(uid).first();
  if (!row) return corsJson({ uid, planName: "starter", role: "admin" });
  return corsJson(formatUserRow(row));
}

async function getMe(env, uid) {
  let row = await env.DB.prepare("SELECT * FROM users WHERE uid = ?").bind(uid).first();
  if (!row) {
    const now = new Date().toISOString();
    await env.DB.prepare(`INSERT INTO users (uid, role, plan_name, created_at, updated_at) VALUES (?, 'admin', 'pro', ?, ?)`).bind(uid, now, now).run();
    row = await env.DB.prepare("SELECT * FROM users WHERE uid = ?").bind(uid).first();
  }
  return corsJson({ user: formatUserRow(row) });
}

async function listUsers(env, userId, isAdminUser) {
  const { results } = await env.DB.prepare("SELECT * FROM users ORDER BY created_at DESC").all();
  return corsJson(results.map(formatUserRow));
}

async function getUserFinancesSafe(env, uid, request) {
  try {
    let { results } = await env.DB.prepare("SELECT * FROM finances WHERE user_uid = ? ORDER BY created_at DESC").bind(uid).all();
    if (!results || results.length === 0) {
      const allFinances = await env.DB.prepare("SELECT * FROM finances ORDER BY created_at DESC").all();
      results = allFinances.results || [];
    }
    return corsJson(results);
  } catch (err) {
    return corsJson([], 200);
  }
}

async function createUserFinance(env, uid, request, isAdminUser) {
  if (!isAdminUser) return corsJson({ error: "Accès non autorisé" }, 403);
  const data = await request.json();
  const now = data.createdAt || new Date().toISOString();

  const res = await env.DB.prepare(`
    INSERT INTO finances (user_uid, amount, period, release_id, release_title, artist_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    uid,
    Number(data.amount || 0),
    data.period || "",
    data.releaseId || "",
    data.releaseTitle || "",
    data.artistName || "",
    now
  ).run();

  return corsJson({ id: res.meta.last_row_id, success: true }, 201);
}

async function getWithdrawalsSafe(env, request) {
  try {
    const { results } = await env.DB.prepare("SELECT * FROM withdrawals ORDER BY created_at DESC").all();
    return corsJson(results || []);
  } catch (err) {
    return corsJson([], 200);
  }
}

async function createWithdrawalSafe(env, request) {
  try {
    const data = await request.json();
    const now = new Date().toISOString();
    const userId = data.userId || data.user_uid || "anonymous";
    const userEmail = data.userEmail || data.user_email || "";
    const amount = Number(data.amount || 0);
    const iban = data.iban || "";

    if (amount <= 0) {
      return corsJson({ error: "Montant invalide" }, 400);
    }

    const res = await env.DB.prepare(`
      INSERT INTO withdrawals (user_uid, user_email, amount, iban, status, created_at)
      VALUES (?, ?, ?, ?, 'demandé', ?)
    `).bind(
      userId,
      userEmail,
      amount,
      iban,
      now
    ).run();

    return corsJson({ id: res.meta.last_row_id, success: true }, 201);
  } catch (err) {
    return corsJson({ error: err.message }, 500);
  }
}

async function patchUserFinance(env, uid, financeId, request, isAdminUser) {
  if (!isAdminUser) return corsJson({ error: "Accès non autorisé" }, 403);
  const data = await request.json();

  await env.DB.prepare(`
    UPDATE finances 
    SET amount = COALESCE(?, amount),
        period = COALESCE(?, period),
        release_id = COALESCE(?, release_id),
        release_title = COALESCE(?, release_title),
        artist_name = COALESCE(?, artist_name)
    WHERE id = ? AND user_uid = ?
  `).bind(
    data.amount !== undefined ? Number(data.amount) : null,
    data.period !== undefined ? data.period : null,
    data.releaseId !== undefined ? data.releaseId : null,
    data.releaseTitle !== undefined ? data.releaseTitle : null,
    data.artistName !== undefined ? data.artistName : null,
    financeId,
    uid
  ).run();

  return corsJson({ success: true });
}

async function deleteUserFinance(env, uid, financeId, isAdminUser) {
  if (!isAdminUser) return corsJson({ error: "Accès non autorisé" }, 403);
  await env.DB.prepare("DELETE FROM finances WHERE id = ? AND user_uid = ?").bind(financeId, uid).run();
  return corsJson({ success: true });
}

async function upsertUser(env, uid, request) {
  const data = await request.json();
  const now = new Date().toISOString();

  await env.DB.prepare(`INSERT INTO users (uid, first_name, last_name, full_name, artist_name, email, address, city, postal_code, iban, photo_url, role, auth_method, plan_name, subscription_status, theme, totp_enabled, totp_secret, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(uid) DO UPDATE SET first_name = excluded.first_name, last_name = excluded.last_name, full_name = excluded.full_name, artist_name = excluded.artist_name, email = excluded.email, address = excluded.address, city = excluded.city, postal_code = excluded.postal_code, iban = excluded.iban, photo_url = excluded.photo_url, role = excluded.role, auth_method = excluded.auth_method, plan_name = excluded.plan_name, subscription_status = excluded.subscription_status, theme = excluded.theme, totp_enabled = excluded.totp_enabled, totp_secret = excluded.totp_secret, updated_at = excluded.updated_at`).bind(
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
    data.role || "admin",
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
    role: row.role || "admin",
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

  await env.DB.prepare(`INSERT INTO user_tracks ( id, user_uid, title, file_url, version, is_ai_generated, language, isrc, iswc, writers, apple_credits, lyrics_text, lyric_type, atmos_url, inst_url ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET title = excluded.title, file_url = excluded.file_url, version = excluded.version, is_ai_generated = excluded.is_ai_generated, language = excluded.language, isrc = excluded.isrc, iswc = excluded.iswc, writers = excluded.writers, apple_credits = excluded.apple_credits, lyrics_text = excluded.lyrics_text, lyric_type = excluded.lyric_type, atmos_url = excluded.atmos_url, inst_url = excluded.inst_url`).bind(
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
  await env.DB.prepare(`INSERT INTO user_plays (id, user_uid, release_id, track_id, platform, country, play_count, period_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    id, uid, body.releaseId || "", body.trackId || "", body.platform || "Spotify",
    body.country || "France", body.playCount || 0, body.periodDate || new Date().toISOString().split("T")[0]
  ).run();

  return corsJson({ success: true, id }, 201);
}

async function getAllArtists(env) {
  const { results } = await env.DB.prepare("SELECT * FROM artists ORDER BY name ASC").all();
  return corsJson({ artists: results.map(formatArtistRow) });
}

async function getAllFeats(env) {
  const { results } = await env.DB.prepare("SELECT * FROM artists WHERE feat IS NOT NULL AND feat != '' ORDER BY name ASC").all();
  return corsJson({ feats: results.map(formatArtistRow) });
}

async function getUserArtists(env, uid) {
  const { results } = await env.DB.prepare("SELECT * FROM artists WHERE user_uid = ? ORDER BY name ASC").bind(uid).all();
  return corsJson(results.map(formatArtistRow));
}

async function getArtist(env, uid, artistId) {
  const row = await env.DB.prepare("SELECT * FROM artists WHERE id = ? AND user_uid = ?").bind(artistId, uid).first();
  if (!row) return corsJson({ error: "Artiste non trouvé" }, 404);
  return corsJson(formatArtistRow(row));
}

async function createArtist(env, uid, request) {
  const data = await request.json();
  const now = new Date().toISOString();

  const res = await env.DB.prepare(`INSERT INTO artists ( user_uid, name, primary_genre, genre, feat, toolost_artist_id, spotify_id, apple_music_id, audiomack_id, even_artist_id, facebook_url, instagram_url, youtube_url, photo, banner_url, birthdate, birthplace, contact_email, uploader_option, writers, credits, secondary_genre, default_language, timezone, release_time, manual_platforms, manual_territories, line_copyright, line_phonogram, label_name, deliveries, description, link_yt_chan, link_yt_music, link_apple, link_spotify, link_amazon, link_soundcloud, link_website, link_fb, link_insta, link_x, link_yt_social, link_wiki, id_ddex, id_musicbrainz, id_allmusic, id_isni, created_at ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    uid,
    data.name || "",
    data.primaryGenre || data.genre || null,
    data.genre || data.primaryGenre || null,
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
    data.bannerUrl || null,
    data.birthdate || null,
    data.birthplace || null,
    data.contactEmail || null,
    data.uploaderOption || null,
    typeof data.writers === 'object' ? JSON.stringify(data.writers) : (data.writers || null),
    typeof data.credits === 'object' ? JSON.stringify(data.credits) : (data.credits || null),
    data.secondaryGenre || null,
    data.defaultLanguage || null,
    data.timezone || null,
    data.releaseTime || null,
    data.manualPlatforms || null,
    data.manualTerritories || null,
    data.lineCopyright || null,
    data.linePhonogram || null,
    data.labelName || null,
    typeof data.deliveries === 'object' ? JSON.stringify(data.deliveries) : (data.deliveries || null),
    data.description || null,
    data.linkYtChan || null,
    data.linkYtMusic || null,
    data.linkApple || null,
    data.linkSpotify || null,
    data.linkAmazon || null,
    data.linkSoundcloud || null,
    data.linkWebsite || null,
    data.linkFb || null,
    data.linkInsta || null,
    data.linkX || null,
    data.linkYtSocial || null,
    data.linkWiki || null,
    data.idDdex || null,
    data.idMusicbrainz || null,
    data.idAllmusic || null,
    data.idIsni || null,
    now
  ).run();

  return corsJson({ id: res.meta.last_row_id, success: true }, 201);
}

async function createFeat(env, uid, request) {
  const data = await request.json();
  const now = new Date().toISOString();

  const links = data.links || {};
  const res = await env.DB.prepare(`INSERT INTO artists (user_uid, name, feat, apple_music_id, spotify_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`).bind(
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

  await env.DB.prepare(`UPDATE artists SET name = COALESCE(?, name), primary_genre = COALESCE(?, primary_genre), genre = COALESCE(?, genre), spotify_id = COALESCE(?, spotify_id), apple_music_id = COALESCE(?, apple_music_id), photo = COALESCE(?, photo), banner_url = COALESCE(?, banner_url), birthdate = COALESCE(?, birthdate), birthplace = COALESCE(?, birthplace), uploader_option = COALESCE(?, uploader_option), writers = COALESCE(?, writers), credits = COALESCE(?, credits), secondary_genre = COALESCE(?, secondary_genre), default_language = COALESCE(?, default_language), timezone = COALESCE(?, timezone), release_time = COALESCE(?, release_time), manual_platforms = COALESCE(?, manual_platforms), manual_territories = COALESCE(?, manual_territories), line_copyright = COALESCE(?, line_copyright), line_phonogram = COALESCE(?, line_phonogram), label_name = COALESCE(?, label_name), deliveries = COALESCE(?, deliveries), description = COALESCE(?, description), link_yt_chan = COALESCE(?, link_yt_chan), link_yt_music = COALESCE(?, link_yt_music), link_apple = COALESCE(?, link_apple), link_spotify = COALESCE(?, link_spotify), link_amazon = COALESCE(?, link_amazon), link_soundcloud = COALESCE(?, link_soundcloud), link_website = COALESCE(?, link_website), link_fb = COALESCE(?, link_fb), link_insta = COALESCE(?, link_insta), link_x = COALESCE(?, link_x), link_yt_social = COALESCE(?, link_yt_social), link_wiki = COALESCE(?, link_wiki), id_ddex = COALESCE(?, id_ddex), id_musicbrainz = COALESCE(?, id_musicbrainz), id_allmusic = COALESCE(?, id_allmusic), id_isni = COALESCE(?, id_isni) WHERE id = ? AND (user_uid = ? OR ? = 1)`).bind(
    data.name !== undefined ? data.name : null,
    data.primaryGenre !== undefined ? (data.primaryGenre || data.genre) : null,
    data.genre !== undefined ? (data.genre || data.primaryGenre) : null,
    data.spotifyId !== undefined ? data.spotifyId : null,
    data.appleMusicId !== undefined ? data.appleMusicId : null,
    data.photo !== undefined ? data.photo : null,
    data.bannerUrl !== undefined ? data.bannerUrl : null,
    data.birthdate !== undefined ? data.birthdate : null,
    data.birthplace !== undefined ? data.birthplace : null,
    data.uploaderOption !== undefined ? data.uploaderOption : null,
    data.writers !== undefined ? (typeof data.writers === 'object' ? JSON.stringify(data.writers) : data.writers) : null,
    data.credits !== undefined ? (typeof data.credits === 'object' ? JSON.stringify(data.credits) : data.credits) : null,
    data.secondaryGenre !== undefined ? data.secondaryGenre : null,
    data.defaultLanguage !== undefined ? data.defaultLanguage : null,
    data.timezone !== undefined ? data.timezone : null,
    data.releaseTime !== undefined ? data.releaseTime : null,
    data.manualPlatforms !== undefined ? data.manualPlatforms : null,
    data.manualTerritories !== undefined ? data.manualTerritories : null,
    data.lineCopyright !== undefined ? data.lineCopyright : null,
    data.linePhonogram !== undefined ? data.linePhonogram : null,
    data.labelName !== undefined ? data.labelName : null,
    data.deliveries !== undefined ? (typeof data.deliveries === 'object' ? JSON.stringify(data.deliveries) : data.deliveries) : null,
    data.description !== undefined ? data.description : null,
    data.linkYtChan !== undefined ? data.linkYtChan : null,
    data.linkYtMusic !== undefined ? data.linkYtMusic : null,
    data.linkApple !== undefined ? data.linkApple : null,
    data.linkSpotify !== undefined ? data.linkSpotify : null,
    data.linkAmazon !== undefined ? data.linkAmazon : null,
    data.linkSoundcloud !== undefined ? data.linkSoundcloud : null,
    data.linkWebsite !== undefined ? data.linkWebsite : null,
    data.linkFb !== undefined ? data.linkFb : null,
    data.linkInsta !== undefined ? data.linkInsta : null,
    data.linkX !== undefined ? data.linkX : null,
    data.linkYtSocial !== undefined ? data.linkYtSocial : null,
    data.linkWiki !== undefined ? data.linkWiki : null,
    data.idDdex !== undefined ? data.idDdex : null,
    data.idMusicbrainz !== undefined ? data.idMusicbrainz : null,
    data.idAllmusic !== undefined ? data.idAllmusic : null,
    data.idIsni !== undefined ? data.idIsni : null,
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
    primaryGenre: row.primary_genre || row.genre,
    genre: row.genre || row.primary_genre,
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
    bannerUrl: row.banner_url,
    birthdate: row.birthdate,
    birthplace: row.birthplace,
    contactEmail: row.contact_email,
    uploaderOption: row.uploader_option,
    writers: row.writers,
    credits: row.credits,
    secondaryGenre: row.secondary_genre,
    defaultLanguage: row.default_language,
    timezone: row.timezone,
    releaseTime: row.release_time,
    manualPlatforms: row.manual_platforms,
    manualTerritories: row.manual_territories,
    lineCopyright: row.line_copyright,
    linePhonogram: row.line_phonogram,
    labelName: row.label_name,
    deliveries: row.deliveries,
    description: row.description,
    linkYtChan: row.link_yt_chan,
    linkYtMusic: row.link_yt_music,
    linkApple: row.link_apple,
    linkSpotify: row.link_spotify,
    linkAmazon: row.link_amazon,
    linkSoundcloud: row.link_soundcloud,
    linkWebsite: row.link_website,
    linkFb: row.link_fb,
    linkInsta: row.link_insta,
    linkX: row.link_x,
    linkYtSocial: row.link_yt_social,
    linkWiki: row.link_wiki,
    idDdex: row.id_ddex,
    idMusicbrainz: row.id_musicbrainz,
    idAllmusic: row.id_allmusic,
    idIsni: row.id_isni,
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
  return corsJson({ releases: results.map(formatReleaseRow) });
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

  const res = await env.DB.prepare(`INSERT INTO releases ( user_uid, title, type, artist_name, cover_url, status, release_date, original_release_date, preorder_date, timezone, exact_time, primary_genre, secondary_genre, language, is_instrumental, label_name, copyright_line_c, copyright_line_p, std_copyright, manual_platforms, selected_platforms, additional_deliveries, version_line, licence_type, upc, territories, tracks, feats, apple_motion_11, apple_motion_34, animated_cover_url, release_url, spotify_url, apple_url, show_on_mmcp_catalog, created_at, updated_at ) VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? )`).bind(
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
    data.animatedCoverUrl || null,
    data.releaseUrl || null,
    data.spotifyUrl || null,
    data.appleUrl || null,
    data.showOnMmcpCatalog !== false ? 1 : 0,
    now,
    now
  ).run();

  return corsJson({ id: res.meta.last_row_id, success: true }, 201);
}

async function patchRelease(env, uid, releaseId, request) {
  const data = await request.json();
  const now = new Date().toISOString();

  let formattedTerritories = null;
  if (data.territories !== undefined) {
    formattedTerritories = typeof data.territories === "object"
      ? JSON.stringify(data.territories)
      : data.territories;
  }

  await env.DB.prepare(`UPDATE releases SET title = COALESCE(?, title), type = COALESCE(?, type), artist_name = COALESCE(?, artist_name), cover_url = COALESCE(?, cover_url), status = COALESCE(?, status), release_date = COALESCE(?, release_date), original_release_date = COALESCE(?, original_release_date), preorder_date = COALESCE(?, preorder_date), timezone = COALESCE(?, timezone), exact_time = COALESCE(?, exact_time), primary_genre = COALESCE(?, primary_genre), secondary_genre = COALESCE(?, secondary_genre), language = COALESCE(?, language), is_instrumental = COALESCE(?, is_instrumental), label_name = COALESCE(?, label_name), copyright_line_c = COALESCE(?, copyright_line_c), copyright_line_p = COALESCE(?, copyright_line_p), std_copyright = COALESCE(?, std_copyright), manual_platforms = COALESCE(?, manual_platforms), selected_platforms = COALESCE(?, selected_platforms), additional_deliveries = COALESCE(?, additional_deliveries), version_line = COALESCE(?, version_line), licence_type = COALESCE(?, licence_type), upc = COALESCE(?, upc), territories = COALESCE(?, territories), tracks = COALESCE(?, tracks), feats = COALESCE(?, feats), apple_motion_11 = COALESCE(?, apple_motion_11), apple_motion_34 = COALESCE(?, apple_motion_34), animated_cover_url = COALESCE(?, animated_cover_url), release_url = COALESCE(?, release_url), spotify_url = COALESCE(?, spotify_url), apple_url = COALESCE(?, apple_url), show_on_mmcp_catalog = COALESCE(?, show_on_mmcp_catalog), updated_at = ? WHERE id = ?`).bind(
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
    data.animatedCoverUrl !== undefined ? data.animatedCoverUrl : null,
    data.releaseUrl !== undefined ? data.releaseUrl : null,
    data.spotifyUrl !== undefined ? data.spotifyUrl : null,
    data.appleUrl !== undefined ? data.appleUrl : null,
    data.showOnMmcpCatalog !== undefined ? (data.showOnMmcpCatalog ? 1 : 0) : null,
    now,
    releaseId
  ).run();

  return corsJson({ id: releaseId, success: true });
}

async function adminPatchRelease(env, userId, request) {
  const data = await request.json();
  const releaseId = data.id;

  if (!releaseId) return corsJson({ error: "ID de sortie manquant" }, 400);

  await env.DB.prepare(`UPDATE releases SET status = COALESCE(?, status), upc = COALESCE(?, upc), updated_at = ? WHERE id = ?`).bind(
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
    userId: row.user_uid,
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
    std_copyright: row.std_copyright || "",
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
    animatedCoverUrl: row.animated_cover_url || null,
    releaseUrl: row.release_url || null,
    spotifyUrl: row.spotify_url || null,
    appleUrl: row.apple_url || null,
    showOnMmcpCatalog: row.show_on_mmcp_catalog !== 0,
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

    const bucket = getBucket(env, type);

    if (bucket) {
      await bucket.put(key, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type || getContentType(ext) },
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

async function uploadChunk(env, userId, request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const chunkIndex = Number(formData.get("chunkIndex"));
    const totalChunks = Number(formData.get("totalChunks"));
    const uploadId = String(formData.get("uploadId") || "");
    const type = String(formData.get("type") || "track");

    if (!file || !uploadId) {
      return corsJson({ error: "Chunk invalide" }, 400);
    }

    const bucket = getBucket(env, type);
    if (!bucket) {
      return corsJson({ error: "Stockage R2 non configuré sur le worker" }, 500);
    }

    const chunkKey = `uploads/chunks/${userId}/${type}/${uploadId}/${chunkIndex}.part`;
    await bucket.put(chunkKey, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
    });

    return corsJson({ success: true, chunkIndex, totalChunks, uploadId, key: chunkKey });
  } catch (err) {
    return corsJson({ error: `Erreur d'envoi de chunk: ${err.message}` }, 500);
  }
}

async function completeChunkUpload(env, userId, request) {
  try {
    const formData = await request.formData();
    const uploadId = String(formData.get("uploadId") || "");
    const type = String(formData.get("type") || "track");
    const originalFileName = String(formData.get("originalFileName") || "upload.bin");

    const bucket = getBucket(env, type);
    if (!bucket) {
      return corsJson({ error: "Stockage R2 non configuré sur le worker" }, 500);
    }

    const prefix = `uploads/chunks/${userId}/${type}/${uploadId}/`;
    const listing = await bucket.list({ prefix });
    const chunks = (listing.objects || []).sort((a, b) => {
      const aIndex = Number((a.key.split("/").pop() || "0").replace(/\.part$/, ""));
      const bIndex = Number((b.key.split("/").pop() || "0").replace(/\.part$/, ""));
      return aIndex - bIndex;
    });

    if (!chunks.length) {
      return corsJson({ error: "Aucun chunk trouvé pour reconstitution" }, 400);
    }

    const ext = originalFileName.split(".").pop() || "bin";
    const finalKey = `${type}/${userId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
    const contentType = getContentType(ext);

    if (typeof bucket.createMultipartUpload === "function") {
      const multipart = await bucket.createMultipartUpload(finalKey, {
        httpMetadata: { contentType },
      });

      const uploadedParts = [];

      for (let index = 0; index < chunks.length; index++) {
        const chunk = chunks[index];
        const object = await bucket.get(chunk.key);
        if (!object || !object.body) {
          throw new Error(`Chunk ${index} introuvable lors de la reconstitution`);
        }

        const partData = await object.arrayBuffer();
        const partNumber = index + 1;
        const uploadedPart = await multipart.uploadPart(partNumber, partData);
        const etag = uploadedPart?.etag ?? uploadedPart?.ETag ?? uploadedPart;
        uploadedParts.push({ partNumber, etag: String(etag) });
      }

      await multipart.complete(uploadedParts);
    } else {
      let totalLength = 0;
      const buffers = [];
      for (const chunk of chunks) {
        const obj = await bucket.get(chunk.key);
        if (!obj) continue;
        const buf = await obj.arrayBuffer();
        buffers.push(new Uint8Array(buf));
        totalLength += buf.byteLength;
      }
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const buf of buffers) {
        combined.set(buf, offset);
        offset += buf.byteLength;
      }
      await bucket.put(finalKey, combined.buffer, {
        httpMetadata: { contentType },
      });
    }

    for (const chunk of chunks) {
      await bucket.delete(chunk.key);
    }

    const url = `/api/files/${encodeURIComponent(finalKey)}`;
    return corsJson({ key: finalKey, url, success: true, uploadId });
  } catch (err) {
    return corsJson({ error: `Erreur de reconstitution: ${err.message}` }, 500);
  }
}

async function serveFile(env, key) {
  try {
    const isAudioKey = /^(track|atmos|inst|motion|cover|pochette)\//.test(key);
    const bucket = isAudioKey ? (env.STORAGE || env.BUCKET || env.MEDIA_BUCKET || env.R2) : (env.BUCKET || env.MEDIA_BUCKET || env.STORAGE || env.R2);

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
  try {
    const data = await request.json();
    const now = new Date().toISOString();

    const userUid = data.userUid || data.user_uid || "anonymous";
    const artistName = data.artistName || data.artist_name || "";
    const rating = Number(data.rating) || 5;
    const comment = data.comment || data.message || "";

    await env.DB.prepare(`
      INSERT INTO reviews (user_uid, artist_name, rating, comment, message, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(userUid, artistName, rating, comment, comment, now, now).run();

    return corsJson({ success: true });
  } catch (err) {
    console.error("Erreur upsertReview:", err);
    return corsJson({ error: err.message }, 500);
  }
}

async function updateReview(env, reviewId, request) {
  try {
    const data = await request.json();
    const now = new Date().toISOString();

    const rating = Number(data.rating) || 5;
    const comment = data.comment || data.message || "";

    await env.DB.prepare(`
      UPDATE reviews 
      SET rating = ?, comment = ?, message = ?, updated_at = ?
      WHERE id = ?
    `).bind(rating, comment, comment, now, reviewId).run();

    return corsJson({ success: true });
  } catch (err) {
    console.error("Erreur updateReview:", err);
    return corsJson({ error: err.message }, 500);
  }
}

async function getAllVersions(env) {
  try {
    const { results } = await env.DB.prepare("SELECT * FROM app_versions ORDER BY id DESC").all();
    return corsJson(results.map(row => ({
      id: row.id,
      version: row.version || row.version_name || "",
      description: row.description || row.release_notes || "",
      date: row.date || row.created_at || ""
    })));
  } catch (err) {
    return corsJson([]);
  }
}

async function createVersionSafe(env, request) {
  try {
    const data = await request.json();
    const now = new Date().toISOString();
    const version = data.version || data.versionName || "";
    const description = data.description || data.releaseNotes || "";
    const dateStr = data.date || now;

    const res = await env.DB.prepare(`
      INSERT INTO app_versions (version, description, version_name, release_notes, date, created_at) 
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(version, description, version, description, dateStr, now).run();

    return corsJson({ id: res.meta.last_row_id, success: true }, 201);
  } catch (err) {
    return corsJson({ error: err.message }, 500);
  }
}

async function patchVersionSafe(env, versionId, request) {
  try {
    const data = await request.json();
    const version = data.version !== undefined ? data.version : (data.versionName !== undefined ? data.versionName : null);
    const description = data.description !== undefined ? data.description : (data.releaseNotes !== undefined ? data.releaseNotes : null);

    await env.DB.prepare(`
      UPDATE app_versions 
      SET version = COALESCE(?, version),
          description = COALESCE(?, description),
          version_name = COALESCE(?, version_name),
          release_notes = COALESCE(?, release_notes)
      WHERE id = ?
    `).bind(version, description, version, description, versionId).run();

    return corsJson({ success: true });
  } catch (err) {
    return corsJson({ error: err.message }, 500);
  }
}

async function createMessage(env, request) {
  const data = await request.json();
  try {
    await env.DB.prepare(`INSERT INTO messages (name, email, subject, message, created_at) VALUES (?, ?, ?, ?, ?)`).bind(
      data.name || null,
      data.email,
      data.subject || "Contact direct",
      data.message,
      new Date().toISOString()
    ).run();
  } catch (e) {
    console.error("Erreur insertion message D1:", e);
    return corsJson({ error: e.message }, 500);
  }
  return corsJson({ success: true });
}

async function getAllMessages(env, userId, isAdminUser) {
  try {
    const { results } = await env.DB.prepare("SELECT * FROM messages ORDER BY created_at DESC").all();
    return corsJson(results);
  } catch {
    return corsJson([]);
  }
}

async function getAllWithdrawals(env, userId, isAdminUser) {
  try {
    const { results } = await env.DB.prepare("SELECT * FROM withdrawals ORDER BY created_at DESC").all();
    return corsJson(results);
  } catch {
    return corsJson([]);
  }
}

async function patchWithdrawal(env, userId, path, request, isAdminUser) {
  const id = path.split("/").pop();
  const data = await request.json();
  try {
    await env.DB.prepare("UPDATE withdrawals SET status = ? WHERE id = ?").bind(data.status, id).run();
  } catch (e) { }
  return corsJson({ success: true });
}