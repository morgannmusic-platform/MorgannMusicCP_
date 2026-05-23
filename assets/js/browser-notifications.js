const DEFAULT_TITLE = "Morgann Music CP";
const DEFAULT_BODY = "Nouvelle notification";
const DEFAULT_URL = "/dash/notifications.html";
const ICON_URL = "/assets/img/android-chrome-192x192.png";
const BADGE_URL = "/assets/img/android-chrome-192x192.png";
const SEEN_IDS_STORAGE_KEY = "mmcpBrowserNotificationSeenIds";
const MAX_SEEN_IDS = 120;

function clean(value) {
  return String(value || "").trim();
}

function readSeenIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SEEN_IDS_STORAGE_KEY) || "[]");
    return Array.isArray(parsed)
      ? parsed.map((value) => clean(value)).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function writeSeenIds(ids) {
  try {
    localStorage.setItem(SEEN_IDS_STORAGE_KEY, JSON.stringify(ids.slice(-MAX_SEEN_IDS)));
  } catch {}
}

function buildNotificationUrl(rawUrl, releaseId) {
  const directUrl = clean(rawUrl);
  if (directUrl) return directUrl;

  const safeReleaseId = clean(releaseId);
  if (safeReleaseId) {
    return `/dash/release.html?id=${encodeURIComponent(safeReleaseId)}`;
  }

  return DEFAULT_URL;
}

export function browserNotificationsSupported() {
  return typeof window !== "undefined" && typeof Notification !== "undefined";
}

export function getBrowserNotificationPermission() {
  if (!browserNotificationsSupported()) return "unsupported";
  return Notification.permission;
}

export function describeBrowserNotificationPermission(permission = getBrowserNotificationPermission()) {
  if (permission === "granted") {
    return "Notifications navigateur actives sur cet appareil.";
  }
  if (permission === "denied") {
    return "Autorisation refusée dans le navigateur. Modifie-la dans les réglages du site pour réactiver les notifications.";
  }
  if (permission === "default") {
    return "Autorisation non encore accordée. Active-la pour recevoir les notifications MMCP dans ton navigateur.";
  }
  return "Les notifications navigateur ne sont pas disponibles sur ce navigateur.";
}

export async function requestBrowserNotificationPermission() {
  if (!browserNotificationsSupported()) return "unsupported";

  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export function hasSeenBrowserNotification(id) {
  const safeId = clean(id);
  if (!safeId) return false;
  return readSeenIds().includes(safeId);
}

export function rememberBrowserNotificationSeen(id) {
  const safeId = clean(id);
  if (!safeId) return;

  const next = readSeenIds().filter((value) => value !== safeId);
  next.push(safeId);
  writeSeenIds(next);
}

export function showBrowserNotification({ id = "", title = "", body = "", url = "", tag = "" } = {}) {
  if (getBrowserNotificationPermission() !== "granted") return false;

  const safeTitle = clean(title) || DEFAULT_TITLE;
  const safeBody = clean(body) || DEFAULT_BODY;
  const safeId = clean(id);
  const safeUrl = clean(url) || DEFAULT_URL;

  try {
    const notification = new Notification(safeTitle, {
      body: safeBody,
      icon: ICON_URL,
      badge: BADGE_URL,
      tag: clean(tag) || (safeId ? `mmcp-browser-${safeId}` : undefined),
      data: {
        id: safeId || null,
        url: safeUrl
      }
    });

    notification.onclick = () => {
      try {
        notification.close();
      } catch {}

      try {
        window.focus();
      } catch {}

      if (safeUrl) {
        window.location.href = safeUrl;
      }
    };

    return true;
  } catch {
    return false;
  }
}

export function showBrowserNotificationFromRecord(record) {
  const id = clean(record?.id);
  const isBrowserNotification = record?.browserNotification === true || clean(record?.type) === "admin_browser_notification";

  if (!isBrowserNotification || !id || hasSeenBrowserNotification(id)) {
    return false;
  }

  const shown = showBrowserNotification({
    id,
    title: clean(record?.browserTitle || record?.title) || DEFAULT_TITLE,
    body: clean(record?.browserBody || record?.message) || DEFAULT_BODY,
    url: buildNotificationUrl(record?.browserUrl, record?.releaseId)
  });

  if (shown) {
    rememberBrowserNotificationSeen(id);
  }

  return shown;
}