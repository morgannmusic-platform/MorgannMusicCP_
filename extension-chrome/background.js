const API_BASE = "https://api.worker.mm-cp.uk";

chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create("checkNotifs", { periodInMinutes: 1 });

    if (chrome.contextMenus) {
        chrome.contextMenus.create({
            id: "open-mmcp",
            title: "Ouvrir Morgann Music CP",
            contexts: ["all"]
        });
    }
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "checkNotifs") {
        checkNotifs();
    }
});

async function checkNotifs() {
    chrome.storage.local.get(["userSession", "lastNotifId"], async (res) => {
        const session = res.userSession;
        if (!session || !session.uid) return;

        try {
            const resp = await fetch(`${API_BASE}/api/users/${session.uid}/notifications`, {
                headers: { "Authorization": `Bearer ${session.token}` }
            });

            if (!resp.ok) return;

            const data = await resp.json();
            let notifs = Array.isArray(data) ? data : (data.notifications || []);

            if (!notifs.length) return;

            const unreadNotifs = notifs.filter((n) => !n.isRead && !n.read);
            const unreadCount = unreadNotifs.length;

            chrome.action.setBadgeText({ text: unreadCount > 0 ? String(unreadCount) : "" });
            chrome.action.setBadgeBackgroundColor({ color: "#FC8FB0" });

            if (unreadNotifs.length > 0) {
                const latestNotif = unreadNotifs[0];

                if (latestNotif.id && latestNotif.id !== res.lastNotifId) {
                    chrome.storage.local.set({ lastNotifId: latestNotif.id });

                    chrome.notifications.create(String(latestNotif.id), {
                        type: "basic",
                        iconUrl: "icon-128.png",
                        title: latestNotif.title || "Nouvelle notification MM-CP",
                        message: latestNotif.message || "Tu as reçu un nouveau message.",
                        priority: 2
                    });
                }
            }
        } catch (e) {
            console.error("[background] Erreur checkNotifs :", e);
        }
    });
}

chrome.notifications.onClicked.addListener(() => {
    chrome.tabs.create({ url: "https://mm-cp.uk/portail/notifications.html" });
});
