const firebaseConfig = {
  apiKey: "AIzaSyDSPUArpApBuK0Cn9VbeMtqk4JC-gqruJc",
  projectId: "morgann-music-cp"
};

const STORAGE_KEY = "mmcpSession";

function nowMs() {
  return Date.now();
}

function toJsonSafe(value) {
  if (value === null || value === undefined) return null;

  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("booleanValue" in value) return Boolean(value.booleanValue);
  if ("timestampValue" in value) return value.timestampValue;
  if ("nullValue" in value) return null;
  if ("mapValue" in value) {
    const fields = value.mapValue.fields || {};
    const out = {};
    for (const [k, v] of Object.entries(fields)) out[k] = toJsonSafe(v);
    return out;
  }
  if ("arrayValue" in value) {
    const values = value.arrayValue.values || [];
    return values.map(toJsonSafe);
  }

  return value;
}

function decodeFirestoreDocument(document) {
  const fields = document?.fields || {};
  const data = {};
  for (const [k, v] of Object.entries(fields)) {
    data[k] = toJsonSafe(v);
  }
  data.id = String(document?.name || "").split("/").pop() || "";
  return data;
}

function normalizeForSort(item) {
  const src = item.updatedAt || item.createdAt || item.date || null;
  if (!src) return 0;
  const t = Date.parse(String(src));
  return Number.isFinite(t) ? t : 0;
}

async function apiPost(url, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || json?.error || "Request failed";
    throw new Error(String(msg));
  }
  return json;
}

async function saveSession(session) {
  await chrome.storage.local.set({ [STORAGE_KEY]: session });
}

export async function getSession() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return data?.[STORAGE_KEY] || null;
}

export async function clearSession() {
  await chrome.storage.local.remove(STORAGE_KEY);
}

export async function signIn(email, password) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`;
  const resp = await apiPost(url, { email, password, returnSecureToken: true });

  const session = {
    email: resp.email,
    uid: resp.localId,
    idToken: resp.idToken,
    refreshToken: resp.refreshToken,
    expiresAtMs: nowMs() + Number(resp.expiresIn || 3600) * 1000
  };

  await saveSession(session);
  return session;
}

export async function ensureFreshSession() {
  const existing = await getSession();
  if (!existing) return null;

  if (existing.expiresAtMs > nowMs() + 30 * 1000) {
    return existing;
  }

  const url = `https://securetoken.googleapis.com/v1/token?key=${firebaseConfig.apiKey}`;
  const body = `grant_type=refresh_token&refresh_token=${encodeURIComponent(existing.refreshToken)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    await clearSession();
    const msg = json?.error?.message || "Session refresh failed";
    throw new Error(String(msg));
  }

  const refreshed = {
    ...existing,
    uid: json.user_id || existing.uid,
    idToken: json.id_token,
    refreshToken: json.refresh_token || existing.refreshToken,
    expiresAtMs: nowMs() + Number(json.expires_in || 3600) * 1000
  };

  await saveSession(refreshed);
  return refreshed;
}

async function runFirestoreQuery(session, collectionId, fieldPath, equalToValue, limit = 20) {
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents:runQuery`;

  const body = {
    structuredQuery: {
      from: [{ collectionId }],
      where: {
        fieldFilter: {
          field: { fieldPath },
          op: "EQUAL",
          value: { stringValue: equalToValue }
        }
      },
      limit
    }
  };

  const rows = await apiPost(url, body, session.idToken);
  const docs = rows
    .filter((row) => row && row.document)
    .map((row) => decodeFirestoreDocument(row.document));

  docs.sort((a, b) => normalizeForSort(b) - normalizeForSort(a));
  return docs;
}

export async function loadReleases(session) {
  const items = await runFirestoreQuery(session, "releases", "ownerUid", session.uid, 25);
  return items.map((item) => ({
    id: item.id,
    title: item.title || "Sortie sans titre",
    artistName: item.artistName || "Artiste",
    statusUser: item.statusUser || item.statusAdmin || item.status || "En cours",
    releaseDate: item?.schedule?.releaseDate || item.releaseDate || "Date non definie",
    createdAt: item.createdAt || null
  }));
}

export async function loadNotifications(session) {
  const items = await runFirestoreQuery(session, "notifications", "userUid", session.uid, 30);
  return items.map((item) => ({
    id: item.id,
    title: item.releaseTitle || "Notification MMCP",
    message: item.message || item.type || "Nouvelle mise a jour",
    read: item.read === true,
    createdAt: item.createdAt || null
  }));
}
