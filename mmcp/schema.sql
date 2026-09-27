-- ============================================
-- Schéma D1 — Morgann Music CP
-- Migration depuis Firestore
-- ============================================

-- Utilisateurs (remplace la collection "users")
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
    plan_name TEXT,
    subscription_status TEXT,
    theme TEXT DEFAULT 'normal-auto',
    totp_enabled INTEGER DEFAULT 0,
    totp_secret TEXT,
    created_at TEXT,
    updated_at TEXT
);

-- Artistes (remplace la sous-collection "users/{uid}/artists")
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
    created_at TEXT,
    FOREIGN KEY (user_uid) REFERENCES users(uid)
);

-- Sorties / Releases (remplace "users/{uid}/releases")
CREATE TABLE IF NOT EXISTS releases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_uid TEXT NOT NULL,
    artist_name TEXT,
    title TEXT,
    type TEXT,
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
    territories TEXT,
    tracks TEXT,
    feats TEXT,
    apple_motion_11 TEXT,
    apple_motion_34 TEXT,
    cover_url TEXT,
    status TEXT,
    show_on_mmcp_catalog INTEGER DEFAULT 0,
    upc TEXT,
    isrc TEXT,
    data JSON,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (user_uid) REFERENCES users(uid)
);

-- Avis (remplace la collection "reviews")
CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    artist_name TEXT NOT NULL,
    rating INTEGER,
    message TEXT,
    updated_at TEXT
);

-- Messages de contact (remplace "messages")
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT
);

-- Versions (remplace "versions")
CREATE TABLE IF NOT EXISTS versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version TEXT NOT NULL,
    description TEXT,
    date TEXT
);

-- Retraits / Withdrawals
CREATE TABLE IF NOT EXISTS withdrawals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_uid TEXT NOT NULL,
    user_email TEXT,
    amount REAL NOT NULL,
    iban TEXT,
    status TEXT DEFAULT 'demandé',
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (user_uid) REFERENCES users(uid)
);

-- Finances / Revenus administratifs
CREATE TABLE IF NOT EXISTS finances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_uid TEXT NOT NULL,
    amount REAL NOT NULL,
    period TEXT,
    release_id INTEGER,
    release_title TEXT,
    artist_name TEXT,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (user_uid) REFERENCES users(uid)
);

-- Notifications utilisateur
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_uid TEXT NOT NULL,
    titre TEXT,
    notif TEXT,
    read INTEGER DEFAULT 0,
    created_at TEXT,
    FOREIGN KEY (user_uid) REFERENCES users(uid)
);

-- Paramètres généraux
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value JSON,
    updated_at TEXT
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_artists_user_uid ON artists(user_uid);
CREATE INDEX IF NOT EXISTS idx_artists_name ON artists(name);
CREATE INDEX IF NOT EXISTS idx_releases_user_uid ON releases(user_uid);
CREATE INDEX IF NOT EXISTS idx_releases_artist_name ON releases(artist_name);
CREATE INDEX IF NOT EXISTS idx_releases_status ON releases(status);
CREATE INDEX IF NOT EXISTS idx_releases_catalog ON releases(show_on_mmcp_catalog);
CREATE INDEX IF NOT EXISTS idx_reviews_artist ON reviews(artist_name);
CREATE INDEX IF NOT EXISTS idx_versions_date ON versions(date DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_uid ON withdrawals(user_uid);
CREATE INDEX IF NOT EXISTS idx_finances_user_uid ON finances(user_uid);
CREATE INDEX IF NOT EXISTS idx_notifications_user_uid ON notifications(user_uid);