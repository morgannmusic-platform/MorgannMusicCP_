import { ensureFreshSession, loadNotifications } from "./firebase-rest.js";

const ALARM_NAME = "mmcp-notif-check";
const SEEN_KEY = "mmcpSeenNotificationIds";

async function getSeenSet() {
  const data = await chrome.storage.local.get(SEEN_KEY);
  const raw = Array.isArray(data?.[SEEN_KEY]) ? data[SEEN_KEY] : [];
  return new Set(raw);
}

async function setSeenSet(set) {
  const next = Array.from(set).slice(-200);
  await chrome.storage.local.set({ [SEEN_KEY]: next });
}

async function notifyNewItems() {
  let session = null;
  try {
    session = await ensureFreshSession();
  } catch {
    return;
  }
  if (!session) return;

  const notifications = await loadNotifications(session);
  if (!notifications.length) return;

  const seen = await getSeenSet();
  let changed = false;

  for (const notif of notifications) {
    if (notif.read) {
      if (!seen.has(notif.id)) {
        seen.add(notif.id);
        changed = true;
      }
      continue;
    }

    if (seen.has(notif.id)) continue;

    chrome.notifications.create(`mmcp-${notif.id}`, {
      type: "basic",
      iconUrl: "icon-128.png",
      title: notif.title || "MMCP",
      message: notif.message || "Nouvelle notification"
    });

    seen.add(notif.id);
    changed = true;
  }

  if (changed) {
    await setSeenSet(seen);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 3 });
  notifyNewItems();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 3 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  notifyNewItems();
});
