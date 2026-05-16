/* =========================
   ACCOUNT.JS (VERSION CLEAN)
   ========================= */

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signOut,
  getIdTokenResult,
  updateProfile,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithPopup
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-storage.js";

import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-functions.js";
import {
  browserNotificationsSupported,
  getBrowserNotificationPermission,
  describeBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  showBrowserNotification
} from "/assets/js/browser-notifications.js";

/* ========= CONFIG ========= */

const REQUIRED_PROFILE_VERSION = 2;

const firebaseConfig = {
  apiKey: "AIzaSyDSPUArpApBuK0Cn9VbeMtqk4JC-gqruJc",
  authDomain: "morgann-music-cp.firebaseapp.com",
  projectId: "morgann-music-cp",
  storageBucket: "morgann-music-cp.firebasestorage.app",
  messagingSenderId: "666812685196",
  appId: "1:666812685196:web:fe3df6749ae768d68494a9"
};

/* ========= INIT ========= */

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app, "europe-west1");
const totpGetStatusCallable = httpsCallable(functions, "totpGetStatus");
const totpBeginEnrollmentCallable = httpsCallable(functions, "totpBeginEnrollment");
const totpConfirmEnrollmentCallable = httpsCallable(functions, "totpConfirmEnrollmentV2");
const totpDisableCallable = httpsCallable(functions, "totpDisableV2");

/* ========= UI ========= */

const $ = (id) => document.getElementById(id);

const avatarImg = $("account-avatar");
const avatarFile = $("avatar-file");

const displayNameInput = $("display-name");
const firstNameInput = $("first-name");
const lastNameInput = $("last-name");
const artistNameInput = $("artist-name");
const phoneInput = $("phone");
const countryInput = $("country");
const cityInput = $("city");
const postalCodeInput = $("postal-code");
const addressLineInput = $("address-line");
const emailInput = $("email");

const currentPasswordInput = $("current-password");   // pour changement email
const currentPasswordInput2 = $("current-password2"); // pour changement mot de passe

const reauthBoxEmail = $("reauth-password-box");
const reauthBoxPass = $("reauth-password-box2");

const newPass1 = $("new-password");
const newPass2 = $("new-password2");

const btnSaveProfile = $("btnSaveProfile");
const btnSaveEmail = $("btnSaveEmail");
const btnSavePassword = $("btnSavePassword");
const marketingEnabledInput = $("pref-marketing-enabled");
const marketingNewsInput = $("pref-marketing-news");
const marketingReleasesInput = $("pref-marketing-releases");
const transactionalEnabledInput = $("pref-transactional-enabled");
const securityLoginEmailEnabledInput = $("pref-security-login-email-enabled");
const securityEmail2faEnabledInput = $("security-email-2fa-enabled");
const marketingSubprefs = $("marketing-subprefs");
const btnSaveEmailPrefs = $("btnSaveEmailPrefs");
const btnSaveSecurityEmail2fa = $("btnSaveSecurityEmail2fa");
const browserNotifStatusAccount = $("browserNotifStatusAccount");
const btnEnableBrowserNotifications = $("btnEnableBrowserNotifications");
const btnTestBrowserNotifications = $("btnTestBrowserNotifications");
const payoutIbanInput = $("payout-iban");
const payoutHolderInput = $("payout-holder");
const payoutBankInput = $("payout-bank");
const btnSavePayout = $("btnSavePayout");
const totpStatus = $("totp-status");
const btnEnableTotp = $("btnEnableTotp");
const totpSetupBox = $("totp-setup-box");
const totpManualKey = $("totp-manual-key");
const btnCopyTotpKey = $("btnCopyTotpKey");
const totpSetupCode = $("totp-setup-code");
const btnConfirmTotp = $("btnConfirmTotp");
const totpDisableBox = $("totp-disable-box");
const totpDisableCode = $("totp-disable-code");
const btnDisableTotp = $("btnDisableTotp");

const btnChangeAvatar = $("btnChangeAvatar");
const btnRemoveAvatar = $("btnRemoveAvatar");

const btnReauthGoogle = $("btnReauthGoogle");
const btnChangeCard = $("btnChangeCard");
const btnViewInvoices = $("btnViewInvoices");
const btnCancelSub = $("btnCancelSub");
const btnLogout = $("btnLogout");

const statusLine = $("status-line");
const subPlanEl = $("sub-plan");
const subStatusBadgeEl = $("sub-status-badge");
const subCardEl = $("sub-card");
const subNoneEl = $("sub-none");
const subRenewalLineEl = $("sub-renewal-line");
const subCancelLineEl = $("sub-cancel-line");
const sectionProfil = $("profil");
const sectionAbonnement = $("abonnement");
const sectionPaiement = $("paiement");
const sectionEmails = $("emails");
const sectionSecurite = $("securite");
const adminBadgeEl = $("adminBadge");
const vipBadgeEl = $("vipBadge");
const artistBadgeEl = $("artistBadge");
const testBadgeEl = $("testBadge");
const btnDisableTestRole = $("btnDisableTestRole");
const profileUpdateBanner = $("profile-update-banner");

/* ========= HELPERS ========= */

function setStatus(msg, ok = true) {
  if (!statusLine) {
    if (!ok) alert(String(msg || "Erreur"));
    return;
  }
  statusLine.textContent = msg;
  statusLine.style.opacity = "0.95";
  statusLine.style.color = ok ? "" : "#dc2626";
}

function setSectionLoading(sectionEl, loading) {
  if (!sectionEl) return;
  sectionEl.classList.toggle("is-loading", !!loading);
}

function initAccountTabs() {
  const tabButtons = Array.from(document.querySelectorAll(".account-nav .tab-link[data-target]"));
  const accountForm = $("account-form");
  if (!tabButtons.length || !accountForm) return;

  const sectionIds = tabButtons.map((btn) => clean(btn.dataset.target));
  const sections = sectionIds
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  const activateTab = (nextId, syncHash = true) => {
    const targetId = sectionIds.includes(nextId) ? nextId : sectionIds[0];

    tabButtons.forEach((btn) => {
      const isActive = clean(btn.dataset.target) === targetId;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    sections.forEach((sectionEl) => {
      const isActive = sectionEl.id === targetId;
      sectionEl.classList.toggle("is-active", isActive);
      sectionEl.hidden = !isActive;
    });

    accountForm.dataset.activeTab = targetId;

    if (syncHash) {
      const newHash = `#${targetId}`;
      if (window.location.hash !== newHash) {
        history.replaceState(null, "", newHash);
      }
    }
  };

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      activateTab(clean(btn.dataset.target));
    });
  });

  const hashTarget = clean((window.location.hash || "").replace(/^#/, ""));
  activateTab(hashTarget || sectionIds[0], false);
}

function isPasswordProvider(user) {
  return user?.providerData?.some(p => p.providerId === "password");
}
function isGoogleProvider(user) {
  return user?.providerData?.some(p => p.providerId === "google.com");
}

function clean(s) {
  return String(s || "").trim();
}

function renderAccountBrowserNotificationStatus() {
  const permission = getBrowserNotificationPermission();

  if (browserNotifStatusAccount) {
    browserNotifStatusAccount.textContent = describeBrowserNotificationPermission(permission);
  }

  if (btnEnableBrowserNotifications) {
    btnEnableBrowserNotifications.disabled = !browserNotificationsSupported() || permission === "granted";
    btnEnableBrowserNotifications.textContent = permission === "granted"
      ? "Notifications déjà actives"
      : "Activer les notifications navigateur";
  }

  if (btnTestBrowserNotifications) {
    btnTestBrowserNotifications.disabled = permission !== "granted";
  }
}

async function enableAccountBrowserNotifications() {
  if (!browserNotificationsSupported()) {
    setStatus("Les notifications navigateur ne sont pas disponibles sur cet appareil.", false);
    return;
  }

  const permission = await requestBrowserNotificationPermission();
  renderAccountBrowserNotificationStatus();

  if (permission === "granted") {
    showBrowserNotification({
      title: "Notifications activées",
      body: "Ton compte est prêt à recevoir les messages MMCP dans le navigateur.",
      url: "/dash/notifications.html"
    });
    setStatus("Notifications navigateur activées ✅");
    return;
  }

  setStatus("Autorisation navigateur non accordée.", false);
}

function testAccountBrowserNotifications() {
  renderAccountBrowserNotificationStatus();

  if (getBrowserNotificationPermission() !== "granted") {
    setStatus("Active d’abord les notifications navigateur.", false);
    return;
  }

  showBrowserNotification({
    title: "Test MMCP",
    body: "Le navigateur est bien configuré pour recevoir les notifications.",
    url: "/dash/notifications.html"
  });
  setStatus("Notification de test envoyée ✅");
}

function splitDisplayName(value) {
  const raw = clean(value);
  if (!raw) return { firstName: "", lastName: "" };
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] || "", lastName: "" };
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ")
  };
}

function buildProfilePayloadFromInputs() {
  const firstName = clean(firstNameInput?.value);
  const lastName = clean(lastNameInput?.value);
  const artistName = clean(artistNameInput?.value);
  const phone = clean(phoneInput?.value);
  const country = clean(countryInput?.value);
  const city = clean(cityInput?.value);
  const postalCode = clean(postalCodeInput?.value);
  const addressLine = clean(addressLineInput?.value);
  const displayName = clean(displayNameInput?.value) || `${firstName} ${lastName}`.trim();

  return {
    firstName,
    lastName,
    displayName,
    artistName,
    phone,
    country,
    city,
    postalCode,
    addressLine
  };
}

function isProfileComplete(data, user) {
  const source = data || {};
  const firstName = clean(source.firstName);
  const lastName = clean(source.lastName);
  const phone = clean(source.phone);
  const country = clean(source.country);
  const city = clean(source.city);
  const profileVersion = Number(source.profileVersion || 0);
  const hasEmail = !!clean(source.email || user?.email);
  return !!(firstName && lastName && phone && country && city && hasEmail && profileVersion >= REQUIRED_PROFILE_VERSION);
}

async function upsertUserDoc(user, payload) {
  const userRef = await resolveCurrentUserDocRef(user);
  const basePayload = {
    uid: user.uid,
    email: clean(user.email || payload?.email || "") || null,
    updatedAt: serverTimestamp(),
    ...payload
  };

  if (!userRef) {
    await setDoc(doc(db, "users", user.uid), {
      ...basePayload,
      createdAt: serverTimestamp()
    }, { merge: true });
    return;
  }

  await updateDoc(userRef, basePayload);
}

function normalizeRoleValue(value) {
  return clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function collectRoleValues(data) {
  if (!data || typeof data !== "object") return [];
  return [
    normalizeRoleValue(data.role),
    normalizeRoleValue(data.userRole),
    normalizeRoleValue(data.accountType),
    normalizeRoleValue(data.status),
    normalizeRoleValue(data.plan),
    normalizeRoleValue(data.subscription),
    normalizeRoleValue(data.subscriptionPlan)
  ].filter(Boolean);
}

function normalizeIban(value) {
  return clean(value).replace(/\s+/g, "").toUpperCase();
}

function isValidIban(value) {
  const iban = normalizeIban(value);
  return /^[A-Z]{2}[0-9A-Z]{13,32}$/.test(iban);
}

function maskIban(value) {
  const iban = normalizeIban(value);
  if (!iban) return "";
  if (iban.length <= 8) return iban;
  return `${iban.slice(0, 4)}••••••${iban.slice(-4)}`;
}

function isAdminUserData(data){
  if (!data || typeof data !== "object") return false;
  const values = collectRoleValues(data);
  return (
    data.isAdmin === true ||
    data.admin === true ||
    values.includes("admin") ||
    values.includes("administrator") ||
    values.includes("staff")
  );
}

function isVipUserData(data){
  if (!data || typeof data !== "object") return false;
  const values = collectRoleValues(data);
  return (
    data.vip === true ||
    data.isVip === true ||
    values.includes("vip")
  );
}

function isArtistUserData(data){
  if (!data || typeof data !== "object") return false;
  const values = collectRoleValues(data);
  const artistValues = ["artist", "artiste", "artiste signe", "signed artist", "signed"];
  return data.isArtist === true
    || data.artist === true
    || values.some((value) => artistValues.includes(value));
}

function isTestUserData(data){
  if (!data || typeof data !== "object") return false;
  const values = collectRoleValues(data);
  const testValues = ["teste", "test", "artiste test", "test artist", "teste artist"];
  return values.some((value) => testValues.includes(value));
}

async function getUserProfileData(user){
  if (!user) return null;

  try {
    const byUid = await getDoc(doc(db, "users", user.uid));
    if (byUid.exists()) return byUid.data();
  } catch (e) {
    console.warn("users/{uid} inaccessible:", e);
  }

  const candidateQueries = [];

  if (user.uid) {
    candidateQueries.push(query(collection(db, "users"), where("uid", "==", user.uid), limit(1)));
    candidateQueries.push(query(collection(db, "users"), where("ownerUid", "==", user.uid), limit(1)));
  }

  if (user.email) {
    const email = user.email.trim();
    const emailLower = email.toLowerCase();
    candidateQueries.push(query(collection(db, "users"), where("email", "==", email), limit(1)));
    if (emailLower !== email) {
      candidateQueries.push(query(collection(db, "users"), where("email", "==", emailLower), limit(1)));
    }
  }

  for (const qy of candidateQueries) {
    try {
      const snap = await getDocs(qy);
      if (!snap.empty) return snap.docs[0].data();
    } catch (e) {
      console.warn("users query inaccessible:", e);
    }
  }

  return null;
}

async function resolveCurrentUserDocRef(user) {
  if (!user?.uid) return null;

  try {
    const byUidRef = doc(db, "users", user.uid);
    const byUidSnap = await getDoc(byUidRef);
    if (byUidSnap.exists()) return byUidRef;
  } catch (e) {
    console.warn("users/{uid} inaccessible:", e);
  }

  if (user.email) {
    try {
      const byEmail = await getDocs(query(collection(db, "users"), where("email", "==", user.email), limit(1)));
      if (!byEmail.empty) return byEmail.docs[0].ref;
    } catch (e) {
      console.warn("users by email inaccessible:", e);
    }
  }

  return null;
}

async function ensureRecentLoginForSensitiveAction(user, { password } = {}) {
  if (isPasswordProvider(user)) {
    if (!password) throw new Error("Mot de passe actuel requis.");
    const cred = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, cred);
    return;
  }

  if (isGoogleProvider(user)) {
    const provider = new GoogleAuthProvider();
    await reauthenticateWithPopup(user, provider);
    return;
  }

  throw new Error("Re-validation nécessaire mais provider non géré ici.");
}

// Convertit une clé de plan (users/{uid}.plan) en libellé lisible
function planNameFromKey(planKey) {
  const map = {
    "starter-monthly": "Starter",
    "starter-annual":  "Starter",
    "pro-monthly":     "Pro",
    "pro-annual":      "Pro",
    "label-monthly":   "Label",
    "label-annual":    "Label",
    "under18-monthly": "Future Légende (-18)",
    "under18":         "Future Légende (-18)",
  };
  return map[planKey] || planKey;
}

function normalizeTotpCode(value) {
  return clean(value).replace(/\s+/g, "").replace(/[^0-9]/g, "").slice(0, 8);
}

function normalizeEmailPreferences(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const marketing = src.marketing && typeof src.marketing === "object" ? src.marketing : {};
  const topics = marketing.topics && typeof marketing.topics === "object" ? marketing.topics : {};
  const transactional = src.transactional && typeof src.transactional === "object" ? src.transactional : {};
  const security = src.security && typeof src.security === "object" ? src.security : {};
  const loginEmail = security.loginEmail && typeof security.loginEmail === "object" ? security.loginEmail : {};
  const email2fa = security.email2fa && typeof security.email2fa === "object" ? security.email2fa : {};

  return {
    marketing: {
      enabled: marketing.enabled === true,
      topics: {
        news: topics.news !== false,
        releases: topics.releases !== false
      }
    },
    transactional: {
      enabled: transactional.enabled !== false
    },
    security: {
      loginEmail: {
        enabled: loginEmail.enabled === true
      },
      email2fa: {
        enabled: email2fa.enabled === true
      }
    }
  };
}

function getEmailPreferencesFromUi() {
  return {
    marketing: {
      enabled: !!marketingEnabledInput?.checked,
      topics: {
        news: !!marketingNewsInput?.checked,
        releases: !!marketingReleasesInput?.checked
      }
    },
    transactional: {
      enabled: !!transactionalEnabledInput?.checked
    },
    security: {
      loginEmail: {
        enabled: !!securityLoginEmailEnabledInput?.checked
      },
      email2fa: {
        enabled: !!securityEmail2faEnabledInput?.checked
      }
    }
  };
}

function setEmailPreferencesToUi(prefs) {
  const normalized = normalizeEmailPreferences(prefs);
  if (marketingEnabledInput) marketingEnabledInput.checked = !!normalized.marketing.enabled;
  if (marketingNewsInput) marketingNewsInput.checked = !!normalized.marketing.topics.news;
  if (marketingReleasesInput) marketingReleasesInput.checked = !!normalized.marketing.topics.releases;
  if (transactionalEnabledInput) transactionalEnabledInput.checked = !!normalized.transactional.enabled;
  if (securityLoginEmailEnabledInput) securityLoginEmailEnabledInput.checked = !!normalized.security.loginEmail.enabled;
  if (securityEmail2faEnabledInput) securityEmail2faEnabledInput.checked = !!normalized.security.email2fa.enabled;
  syncMarketingSubPrefsUi();
}

function syncMarketingSubPrefsUi() {
  const open = !!marketingEnabledInput?.checked;
  if (marketingSubprefs) {
    marketingSubprefs.classList.toggle("is-open", open);
    marketingSubprefs.setAttribute("aria-hidden", open ? "false" : "true");
  }
}

async function sendMarketingWelcomeEmails(user, prefs, previousPrefs) {
  if (!user?.email) return;

  const now = normalizeEmailPreferences(prefs);
  const prev = normalizeEmailPreferences(previousPrefs);
  if (!now.marketing.enabled) return;

  const shouldSendNews = now.marketing.topics.news && (!prev.marketing.enabled || !prev.marketing.topics.news);
  const shouldSendReleases = now.marketing.topics.releases && (!prev.marketing.enabled || !prev.marketing.topics.releases);
  if (!shouldSendNews && !shouldSendReleases) return;

  const token = await user.getIdToken();
  const displayName = clean(user.displayName) || "Artiste";

  const jobs = [];
  if (shouldSendNews) {
    jobs.push(fetch("/api/email/brevo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        toEmail: user.email,
        artistName: displayName,
        subject: "Bienvenue sur les nouveautés Morgann Music CP",
        body: "Merci d'avoir activé les nouveautés MMCP. Tu recevras nos nouveautés importantes directement par email.",
        mailCategory: "marketing",
        transactionType: "marketing_welcome_news"
      })
    }));
  }

  if (shouldSendReleases) {
    jobs.push(fetch("/api/email/brevo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        toEmail: user.email,
        artistName: displayName,
        subject: "Bienvenue sur les nouvelles sorties",
        body: "Merci d'avoir activé la newsletter Nouvelles sorties. Tu recevras automatiquement les emails de nouvelles sorties.",
        mailCategory: "marketing",
        transactionType: "marketing_welcome_releases"
      })
    }));
  }

  await Promise.allSettled(jobs);
}

async function withTimeout(promise, ms, fallbackMessage = "Délai dépassé") {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(fallbackMessage)), ms);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function renderTotpUi(statusData) {
  const enabled = !!statusData?.enabled;
  const pending = !!statusData?.pendingEnrollment;

  if (totpStatus) {
    if (enabled) totpStatus.textContent = "2FA actif ✅ (code demandé à chaque connexion).";
    else if (pending) totpStatus.textContent = "Activation 2FA en attente de confirmation.";
    else totpStatus.textContent = "2FA inactif.";
  }

  if (btnEnableTotp) btnEnableTotp.style.display = enabled ? "none" : "";
  if (totpDisableBox) totpDisableBox.style.display = enabled ? "" : "none";
  if (btnDisableTotp) btnDisableTotp.style.display = enabled ? "" : "none";
}

async function refreshTotpStatus() {
  if (totpStatus) totpStatus.textContent = "Chargement du statut 2FA…";
  try {
    const res = await withTimeout(
      totpGetStatusCallable(),
      8000,
      "Le service 2FA ne répond pas pour le moment."
    );
    renderTotpUi(res?.data || {});
  } catch (e) {
    console.error("totp status error", e);
    renderTotpUi({ enabled: false, pendingEnrollment: false });
    if (totpStatus) totpStatus.textContent = "2FA indisponible temporairement (réessaie dans quelques secondes).";
  }
}

/* ========= AUTH GUARD + INIT UI ========= */

let currentUser = null;
let currentStripeCustomerId = null;
let currentSubId = null;
let currentUserPlanDoc = null;
let currentEmailPrefs = normalizeEmailPreferences(null);

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    const here = window.location.href;
    window.location.href = "/login.html?redirect=" + encodeURIComponent(here);
    return;
  }

  setSectionLoading(sectionProfil, true);
  setSectionLoading(sectionAbonnement, true);
  setSectionLoading(sectionPaiement, true);
  setSectionLoading(sectionEmails, true);
  initAccountTabs();
  setSectionLoading(sectionSecurite, true);
  renderAccountBrowserNotificationStatus();
  setStatus("Chargement des informations du compte…");

  currentUser = user;

  const params = new URLSearchParams(window.location.search);
  const forcedProfileUpdate = params.get("requiredProfileUpdate") === "1";
  if (forcedProfileUpdate) {
    if (profileUpdateBanner) profileUpdateBanner.style.display = "block";
    setStatus("Mise à jour requise : complète ton profil pour continuer ✅");
  }

  if (displayNameInput) displayNameInput.value = user.displayName || "";
  if (emailInput) emailInput.value = user.email || "";
  if (avatarImg) avatarImg.src = user.photoURL || "/assets/img/default-avatar.png";

  const needPasswordBoxes = isPasswordProvider(user);
  if (reauthBoxEmail) reauthBoxEmail.style.display = needPasswordBoxes ? "" : "none";
  if (reauthBoxPass) reauthBoxPass.style.display = needPasswordBoxes ? "" : "none";
  if (btnReauthGoogle) btnReauthGoogle.style.display = (!needPasswordBoxes && isGoogleProvider(user)) ? "" : "none";

  let hasVipStatus = false;
  let hasTestStatus = false;
  let userPlanFromDoc = null; // plan stocké dans users/{uid}.plan (PaymentIntent)
  try {
    const data = await getUserProfileData(user);
    userPlanFromDoc = data?.plan || null;
    const fallbackSplitName = splitDisplayName(user.displayName || "");
    const firstName = clean(data?.firstName || fallbackSplitName.firstName);
    const lastName = clean(data?.lastName || fallbackSplitName.lastName);
    const phone = clean(data?.phone || "");
    const country = clean(data?.country || "");
    const city = clean(data?.city || "");
    const postalCode = clean(data?.postalCode || "");
    const addressLine = clean(data?.addressLine || "");
    const artistName = clean(data?.artistName || "");

    if (firstNameInput) firstNameInput.value = firstName;
    if (lastNameInput) lastNameInput.value = lastName;
    if (phoneInput) phoneInput.value = phone;
    if (countryInput) countryInput.value = country;
    if (cityInput) cityInput.value = city;
    if (postalCodeInput) postalCodeInput.value = postalCode;
    if (addressLineInput) addressLineInput.value = addressLine;
    if (artistNameInput) artistNameInput.value = artistName;
    if (displayNameInput) displayNameInput.value = clean(data?.displayName || user.displayName || "");

    currentEmailPrefs = normalizeEmailPreferences(data?.emailPreferences);
    setEmailPreferencesToUi(currentEmailPrefs);

    if (payoutIbanInput) payoutIbanInput.value = clean(data?.payoutIban || "");
    if (payoutHolderInput) payoutHolderInput.value = clean(data?.payoutHolder || "");
    if (payoutBankInput) payoutBankInput.value = clean(data?.payoutBank || "");

    const needsUpdate = !isProfileComplete(data, user);
    if (profileUpdateBanner) profileUpdateBanner.style.display = needsUpdate ? "block" : "none";

    let isAdmin = isAdminUserData(data);
    let isVip = isVipUserData(data);
    let isArtist = isArtistUserData(data);
    let isTest = isTestUserData(data);

    try {
      const token = await getIdTokenResult(user);
      if (token?.claims?.admin === true) isAdmin = true;
      if (token?.claims?.vip === true) isVip = true;
      if (String(token?.claims?.role || "").toLowerCase() === "artist") isArtist = true;
      if (String(token?.claims?.role || "").toLowerCase() === "teste") isTest = true;
    } catch (e) {
      console.warn("claims non accessibles:", e);
    }

    hasVipStatus = isVip;
    hasTestStatus = isTest;

    if (adminBadgeEl) adminBadgeEl.style.display = isAdmin ? "inline-block" : "none";
    if (vipBadgeEl) vipBadgeEl.style.display = isVip ? "inline-block" : "none";
    if (artistBadgeEl) artistBadgeEl.style.display = isArtist ? "inline-block" : "none";
    if (testBadgeEl) testBadgeEl.style.display = isTest ? "inline-block" : "none";
    if (btnDisableTestRole) btnDisableTestRole.style.display = isTest ? "" : "none";

    if (!data && !isVip && !isAdmin && !isArtist && !isTest) {
      setStatus("Compte chargé ✅ (profil VIP non trouvé côté app)");
    }
  } catch (e) {
    console.error("Erreur lecture role admin:", e);
    if (adminBadgeEl) adminBadgeEl.style.display = "none";
    if (vipBadgeEl) vipBadgeEl.style.display = "none";
    if (artistBadgeEl) artistBadgeEl.style.display = "none";
    if (testBadgeEl) testBadgeEl.style.display = "none";
    if (btnDisableTestRole) btnDisableTestRole.style.display = "none";
  } finally {
    setSectionLoading(sectionProfil, false);
    setSectionLoading(sectionPaiement, false);
    setSectionLoading(sectionEmails, false);
  }

  try {
    if (hasTestStatus) {
      if (subPlanEl) subPlanEl.textContent = "Test";
      if (subStatusBadgeEl) { subStatusBadgeEl.textContent = "Mode test"; subStatusBadgeEl.dataset.status = "test"; }
      if (subCardEl) subCardEl.style.display = "";
      if (subNoneEl) subNoneEl.style.display = "none";
    } else {
      if (userPlanFromDoc) {
        // Plan payé via PaymentIntent, stocké dans users/{uid}.plan
        currentUserPlanDoc = userPlanFromDoc;
        if (subPlanEl) subPlanEl.textContent = planNameFromKey(userPlanFromDoc);
        if (subStatusBadgeEl) { subStatusBadgeEl.textContent = "Actif"; subStatusBadgeEl.dataset.status = "active"; }
        if (subRenewalLineEl) subRenewalLineEl.style.display = "none";
        if (subCancelLineEl) subCancelLineEl.style.display = "none";
        if (subCardEl) subCardEl.style.display = "";
        if (subNoneEl) subNoneEl.style.display = "none";
      } else {
        if (subCardEl) subCardEl.style.display = "none";
        if (subNoneEl) subNoneEl.style.display = "";
      }
    }
  } catch (e) {
    console.error("Erreur lecture abonnement:", e);
    if (subCardEl) subCardEl.style.display = "none";
    if (subNoneEl) subNoneEl.style.display = "";
  } finally {
    setSectionLoading(sectionAbonnement, false);
  }

  await refreshTotpStatus();
  setSectionLoading(sectionSecurite, false);
  renderAccountBrowserNotificationStatus();
  if (!forcedProfileUpdate) {
    setStatus(hasVipStatus ? "Compte chargé ✅ · Statut VIP actif (accès complet)" : "Compte chargé ✅");
  }
});

/* ========= ACTIONS ========= */

btnSaveProfile?.addEventListener("click", async () => {
  if (!currentUser) return;

  const payload = buildProfilePayloadFromInputs();

  if (!payload.firstName || !payload.lastName) {
    return setStatus("Prénom et nom sont obligatoires.", false);
  }
  if (!payload.phone || !payload.country || !payload.city) {
    return setStatus("Téléphone, pays et ville sont obligatoires.", false);
  }

  try {
    await updateProfile(currentUser, { displayName: payload.displayName || null });
    await upsertUserDoc(currentUser, {
      ...payload,
      profileVersion: REQUIRED_PROFILE_VERSION,
      profileUpdateRequired: false
    });

    if (profileUpdateBanner) profileUpdateBanner.style.display = "none";
    setStatus("Profil mis à jour ✅");
  } catch (e) {
    console.error(e);
    setStatus(e?.message || String(e), false);
  }
});

btnSaveEmail?.addEventListener("click", async () => {
  if (!currentUser) return;

  const newEmail = clean(emailInput?.value);
  if (!newEmail) return setStatus("Entre une adresse email.", false);

  try {
    setStatus("Re-validation…");
    if (isPasswordProvider(currentUser)) {
      await ensureRecentLoginForSensitiveAction(currentUser, { password: currentPasswordInput?.value });
    } else {
      await ensureRecentLoginForSensitiveAction(currentUser);
    }

    await updateEmail(currentUser, newEmail);
    await upsertUserDoc(currentUser, { email: newEmail });
    setStatus("Email modifié ✅");
  } catch (e) {
    console.error(e);
    setStatus(e?.message || String(e), false);
  }
});

btnSavePassword?.addEventListener("click", async () => {
  if (!currentUser) return;

  const p1 = newPass1?.value || "";
  const p2 = newPass2?.value || "";
  if (!p1 || p1.length < 6) return setStatus("Mot de passe trop court (min 6).", false);
  if (p1 !== p2) return setStatus("Les mots de passe ne correspondent pas.", false);

  try {
    setStatus("Re-validation…");
    if (isPasswordProvider(currentUser)) {
      await ensureRecentLoginForSensitiveAction(currentUser, { password: currentPasswordInput2?.value });
    } else {
      await ensureRecentLoginForSensitiveAction(currentUser);
    }

    await updatePassword(currentUser, p1);

    if (newPass1) newPass1.value = "";
    if (newPass2) newPass2.value = "";
    if (currentPasswordInput2) currentPasswordInput2.value = "";

    setStatus("Mot de passe modifié ✅");
  } catch (e) {
    console.error(e);
    setStatus(e?.message || String(e), false);
  }
});

btnSavePayout?.addEventListener("click", async () => {
  if (!currentUser) return;

  const iban = normalizeIban(payoutIbanInput?.value);
  const payoutHolder = clean(payoutHolderInput?.value);
  const payoutBank = clean(payoutBankInput?.value);
  if (!iban) return setStatus("IBAN obligatoire.", false);
  if (!isValidIban(iban)) return setStatus("IBAN invalide.", false);
  if (!payoutHolder) return setStatus("Titulaire du compte obligatoire.", false);

  try {
    await upsertUserDoc(currentUser, {
      payoutIban: iban,
      payoutHolder,
      payoutBank,
      payoutIbanMasked: maskIban(iban),
      payoutUpdatedAt: serverTimestamp(),
      profileVersion: REQUIRED_PROFILE_VERSION
    });

    if (payoutIbanInput) payoutIbanInput.value = iban;
    setStatus("Informations bancaires enregistrées ✅");
  } catch (e) {
    console.error(e);
    setStatus(e?.message || String(e), false);
  }
});

marketingEnabledInput?.addEventListener("change", syncMarketingSubPrefsUi);

btnSaveEmailPrefs?.addEventListener("click", async () => {
  if (!currentUser) return;
  const nextPrefs = getEmailPreferencesFromUi();

  if (nextPrefs.marketing.enabled && !nextPrefs.marketing.topics.news && !nextPrefs.marketing.topics.releases) {
    return setStatus("Active au moins une sous-catégorie marketing.", false);
  }

  try {
    setStatus("Enregistrement des préférences email…");
    await upsertUserDoc(currentUser, {
      emailPreferences: nextPrefs,
      emailPreferencesUpdatedAt: serverTimestamp()
    });

    await sendMarketingWelcomeEmails(currentUser, nextPrefs, currentEmailPrefs);
    currentEmailPrefs = normalizeEmailPreferences(nextPrefs);
    setStatus("Préférences email mises à jour ✅");
  } catch (e) {
    console.error(e);
    setStatus(e?.message || String(e), false);
  }
});

btnSaveSecurityEmail2fa?.addEventListener("click", async () => {
  if (!currentUser) return;

  try {
    setStatus("Enregistrement de l'option 2FA email…");
    const nextPrefs = normalizeEmailPreferences({
      ...currentEmailPrefs,
      security: {
        ...(currentEmailPrefs.security || {}),
        loginEmail: {
          enabled: !!currentEmailPrefs?.security?.loginEmail?.enabled
        },
        email2fa: {
          enabled: !!securityEmail2faEnabledInput?.checked
        }
      }
    });

    await upsertUserDoc(currentUser, {
      emailPreferences: nextPrefs,
      emailPreferencesUpdatedAt: serverTimestamp()
    });

    currentEmailPrefs = normalizeEmailPreferences(nextPrefs);
    setEmailPreferencesToUi(currentEmailPrefs);
    setStatus("Option 2FA email mise à jour ✅");
  } catch (e) {
    console.error(e);
    setStatus(e?.message || String(e), false);
  }
});

btnEnableBrowserNotifications?.addEventListener("click", enableAccountBrowserNotifications);
btnTestBrowserNotifications?.addEventListener("click", testAccountBrowserNotifications);

btnReauthGoogle?.addEventListener("click", async () => {
  if (!currentUser) return;
  try {
    setStatus("Validation Google…");
    await ensureRecentLoginForSensitiveAction(currentUser);
    setStatus("OK ✅ Tu peux modifier email/mot de passe maintenant.");
  } catch (e) {
    console.error(e);
    setStatus(e?.message || String(e), false);
  }
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) renderAccountBrowserNotificationStatus();
});

btnChangeAvatar?.addEventListener("click", () => {
  avatarFile?.click();
});

avatarFile?.addEventListener("change", async () => {
  if (!currentUser) return;

  const file = avatarFile.files?.[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) return setStatus("Fichier invalide (image uniquement).", false);
  if (file.size > 25 * 1024 * 1024) return setStatus("Image trop lourde (max 25 Mo).", false);

  try {
    setStatus("Upload de la photo…");

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const avatarRef = ref(storage, `avatars/${currentUser.uid}/avatar.${ext}`);

    await uploadBytes(avatarRef, file, { contentType: file.type });
    const url = await getDownloadURL(avatarRef);

    await updateProfile(currentUser, { photoURL: url });
    if (avatarImg) avatarImg.src = url;

    setStatus("Photo mise à jour ✅");
  } catch (e) {
    console.error(e);
    setStatus(e?.message || String(e), false);
  } finally {
    if (avatarFile) avatarFile.value = "";
  }
});

btnRemoveAvatar?.addEventListener("click", async () => {
  if (!currentUser) return;

  try {
    setStatus("Suppression de la photo…");

    const candidates = ["jpg", "jpeg", "png", "webp"];
    await Promise.allSettled(
      candidates.map(ext => deleteObject(ref(storage, `avatars/${currentUser.uid}/avatar.${ext}`)))
    );

    await updateProfile(currentUser, { photoURL: null });
    if (avatarImg) avatarImg.src = "/assets/img/default-avatar.png";

    setStatus("Photo supprimée ✅");
  } catch (e) {
    console.error(e);
    setStatus(e?.message || String(e), false);
  }
});

btnChangeCard?.addEventListener("click", () => {
  if (!currentSubId && !currentUserPlanDoc) {
    setStatus("Aucun abonnement actif.", false);
    return;
  }
  if (!currentSubId && currentUserPlanDoc) {
    // Utilisateur PaymentIntent : pas de carte stockée → rediriger vers buy.html
    window.location.href = "/buy.html";
    return;
  }
  // Abonnement Stripe : ouvrir le modal de changement de carte
  const modal = document.getElementById("modal-change-card");
  if (modal) {
    modal.style.display = "flex";
    initStripeCardElement();
  }
});

btnViewInvoices?.addEventListener("click", async () => {
  const modal = document.getElementById("modal-invoices");
  if (!modal || !currentUser) return;
  modal.style.display = "flex";
  const list = document.getElementById("invoices-list");
  if (!list) return;
  list.innerHTML = '<p style="opacity:0.6;text-align:center;">Chargement…</p>';
  try {
    const snap = await getDocs(
      query(
        collection(db, "customers", currentUser.uid, "payments"),
        orderBy("created", "desc"),
        limit(20)
      )
    );
    if (snap.empty) {
      list.innerHTML = '<p style="opacity:0.6;text-align:center;">Aucune facture trouvée.</p>';
    } else {
      list.innerHTML = "";
      snap.docs.forEach(d => {
        const data = d.data();
        const amountCents = data.amount ?? (data.amount_received ?? 0);
        const amount = (amountCents / 100).toFixed(2).replace(".", ",");
        const created = data.created?.toDate ? data.created.toDate() : (data.created ? new Date(data.created * 1000) : null);
        const dateStr = created ? created.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "—";
        const status = String(data.status || "").toLowerCase();
        const statusLabel = { succeeded: "Payé ✅", pending: "En attente ⏳", failed: "Échoué ❌" }[status] || data.status || "—";
        const row = document.createElement("div");
        row.className = "invoice-row";
        row.innerHTML = `<span class="inv-date">${dateStr}</span><span class="inv-amount">${amount} €</span><span class="inv-status">${statusLabel}</span>`;
        list.appendChild(row);
      });
    }
  } catch (e) {
    list.innerHTML = `<p style="color:#dc2626;text-align:center;">Erreur : ${e.message || "impossible de charger les factures."}</p>`;
  }
});

btnCancelSub?.addEventListener("click", () => {
  if (!currentSubId && !currentUserPlanDoc) {
    setStatus("Aucun abonnement actif à résilier.", false);
    return;
  }
  const modal = document.getElementById("modal-cancel-sub");
  if (modal) modal.style.display = "flex";
});

// Confirmation de résiliation
document.getElementById("modal-cancel-confirm")?.addEventListener("click", async () => {
  const modal = document.getElementById("modal-cancel-sub");
  if (modal) modal.style.display = "none";
  try {
    setStatus("Résiliation en cours…");
    if (!currentSubId && currentUserPlanDoc) {
      // Utilisateur PaymentIntent : effacer le plan dans Firestore
      const userRef = await resolveCurrentUserDocRef(currentUser);
      if (!userRef) throw new Error("Profil introuvable.");
      await updateDoc(userRef, { plan: null, planCancelledAt: serverTimestamp() });
      currentUserPlanDoc = null;
      if (subCardEl) subCardEl.style.display = "none";
      if (subNoneEl) subNoneEl.style.display = "";
      setStatus("Abonnement résilié ✅ · Accès coupé immédiatement.");
    } else if (currentSubId) {
      // Abonnement Stripe : appeler l'endpoint de résiliation
      const res = await fetch("https://pay.mm-cp.uk/cancel-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: currentSubId })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setStatus("Abonnement résilié ✅");
      window.location.reload();
    }
  } catch (e) {
    setStatus(e.message || "Erreur lors de la résiliation — contacte support@mm-cp.uk", false);
  }
});

// Confirmation changement de carte (Stripe sub)
document.getElementById("modal-card-confirm")?.addEventListener("click", async () => {
  if (!currentStripeCustomerId) {
    setStatus("Identifiant client Stripe introuvable.", false);
    return;
  }
  const btn = document.getElementById("modal-card-confirm");
  const errorEl = document.getElementById("card-element-error");
  if (btn) btn.disabled = true;
  if (errorEl) errorEl.textContent = "";
  try {
    const stripe = window.Stripe("pk_test_51Sqie3FhaOYWNNbbkEzm71AEisKngfDFIAB7N4a5g2gOQpGFxaGRDAK19py9fE49NNPLSXQwfLbsoCgT4MpMvGpM00TkvPHrpm");
    const cardElement = window._stripeCardElement;
    if (!cardElement) throw new Error("Formulaire carte non initialisé.");
    const { paymentMethod, error } = await stripe.createPaymentMethod({ type: "card", card: cardElement });
    if (error) throw new Error(error.message);
    const res = await fetch("https://pay.mm-cp.uk/update-payment-method", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: currentStripeCustomerId, paymentMethodId: paymentMethod.id })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    const modal = document.getElementById("modal-change-card");
    if (modal) modal.style.display = "none";
    setStatus("Carte mise à jour ✅");
  } catch (e) {
    if (errorEl) errorEl.textContent = e.message || "Erreur lors de la mise à jour.";
    if (btn) btn.disabled = false;
  }
});

// Fermeture générique des modaux
document.querySelectorAll("[data-modal-close]").forEach(btn => {
  btn.addEventListener("click", () => {
    const id = btn.dataset.modalClose;
    const modal = document.getElementById(id);
    if (modal) modal.style.display = "none";
  });
});

// Initialisation du CardElement Stripe dans le modal changement de carte
function initStripeCardElement() {
  if (!window.Stripe) return;
  const container = document.getElementById("card-element-container");
  if (!container) return;
  if (window._stripeCardElement) {
    try { window._stripeCardElement.unmount(); } catch (_) {}
    window._stripeCardElement = null;
  }
  const stripe = window.Stripe("pk_test_51Sqie3FhaOYWNNbbkEzm71AEisKngfDFIAB7N4a5g2gOQpGFxaGRDAK19py9fE49NNPLSXQwfLbsoCgT4MpMvGpM00TkvPHrpm");
  const elements = stripe.elements();
  const cardElement = elements.create("card", {
    style: {
      base: {
        fontFamily: "Poppins, sans-serif",
        fontSize: "16px",
        color: "#2a2a2a",
        "::placeholder": { color: "#aaa" }
      }
    }
  });
  cardElement.mount(container);
  window._stripeCardElement = cardElement;
}

btnDisableTestRole?.addEventListener("click", async () => {
  if (!currentUser) return;
  const ok = window.confirm("Confirmer la désactivation du mode test ?");
  if (!ok) return;

  try {
    setStatus("Désactivation du mode test…");
    btnDisableTestRole.disabled = true;

    const userRef = await resolveCurrentUserDocRef(currentUser);
    if (!userRef) throw new Error("Profil utilisateur introuvable.");

    await updateDoc(userRef, {
      role: "user",
      userRole: "user",
      accountType: "user",
      status: "active",
      plan: "user",
      vip: false,
      isVip: false,
      isArtist: false,
      artist: false,
      updatedAt: serverTimestamp()
    });

    setStatus("Mode test désactivé ✅");
    window.location.reload();
  } catch (e) {
    console.error(e);
    setStatus(e?.message || String(e), false);
  } finally {
    btnDisableTestRole.disabled = false;
  }
});

btnLogout?.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } finally {
    window.location.href = "/login.html";
  }
});

btnEnableTotp?.addEventListener("click", async () => {
  try {
    setStatus("Préparation du 2FA…");
    const res = await withTimeout(
      totpBeginEnrollmentCallable(),
      12000,
      "Le service 2FA ne répond pas pour le moment."
    );
    const manualKey = clean(res?.data?.manualKey);

    if (!manualKey) throw new Error("Réponse 2FA invalide.");

    if (totpManualKey) totpManualKey.textContent = manualKey;
    if (totpSetupBox) totpSetupBox.style.display = "block";
    if (totpSetupCode) totpSetupCode.value = "";

    setStatus("Clé générée ✅ Ajoute-la dans ton app d’authentification puis confirme avec un code.");
    await refreshTotpStatus();
  } catch (e) {
    console.error(e);
    setStatus(e?.message || String(e), false);
  }
});

btnCopyTotpKey?.addEventListener("click", async () => {
  const key = clean(totpManualKey?.textContent);
  if (!key || key === "—") return setStatus("Aucune clé à copier.", false);

  try {
    await navigator.clipboard.writeText(key);
    setStatus("Clé 2FA copiée ✅");
  } catch (e) {
    console.error(e);
    setStatus("Impossible de copier la clé automatiquement.", false);
  }
});

async function confirmTotpActivation() {
  const token = normalizeTotpCode(totpSetupCode?.value);
  if (token.length < 6) return setStatus("Code 2FA invalide.", false);

  try {
    if (btnConfirmTotp) btnConfirmTotp.disabled = true;
    setStatus("Validation du code 2FA…");
    await withTimeout(
      totpConfirmEnrollmentCallable({ token }),
      12000,
      "Le service 2FA ne répond pas pour le moment."
    );
    if (totpSetupBox) totpSetupBox.style.display = "none";
    if (totpSetupCode) totpSetupCode.value = "";
    setStatus("2FA activé ✅");
    await refreshTotpStatus();
  } catch (e) {
    console.error(e);
    setStatus(e?.message || String(e), false);
  } finally {
    if (btnConfirmTotp) btnConfirmTotp.disabled = false;
  }
}

btnConfirmTotp?.addEventListener("click", confirmTotpActivation);
totpSetupCode?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  confirmTotpActivation();
});

btnDisableTotp?.addEventListener("click", async () => {
  const token = normalizeTotpCode(totpDisableCode?.value);
  if (token.length < 6) return setStatus("Code 2FA requis pour désactiver.", false);

  try {
    await withTimeout(
      totpDisableCallable({ token }),
      12000,
      "Le service 2FA ne répond pas pour le moment."
    );
    if (totpDisableCode) totpDisableCode.value = "";
    if (totpSetupBox) totpSetupBox.style.display = "none";
    setStatus("2FA désactivé ✅");
    await refreshTotpStatus();
  } catch (e) {
    console.error(e);
    setStatus(e?.message || String(e), false);
  }
});