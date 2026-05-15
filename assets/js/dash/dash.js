
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDSPUArpApBuK0Cn9VbeMtqk4JC-gqruJc",
  authDomain: "morgann-music-cp.firebaseapp.com",
  projectId: "morgann-music-cp",
  storageBucket: "morgann-music-cp.appspot.com",
  messagingSenderId: "666812685196",
  appId: "1:666812685196:web:fe3df6749ae768d68494a9"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const PRICE_TO_PLAN = {
  "price_1T03eDFhaOYWNNbbddL6iz7y": "Starter",
  "price_1T03z6FhaOYWNNbbNyjacrEv": "Pro",
  "price_1T042SFhaOYWNNbbs0OXpz8P": "Label",
};

const subStatus = document.getElementById("sub-status");
const subPill = document.getElementById("sub-pill");
const subPlan = document.getElementById("sub-plan");
const subState = document.getElementById("sub-state");
const subRenew = document.getElementById("sub-renew");

function fmtDate(ts) {
  if (!ts) return "—";
  const d =
    ts?.toDate?.() ? ts.toDate() :
    ts?.seconds ? new Date(ts.seconds * 1000) :
    new Date(ts);

  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });
}

function detectPlanFromSub(sub) {
  const priceId =
    sub?.price?.id ||
    sub?.items?.[0]?.price?.id ||
    sub?.items?.data?.[0]?.price?.id ||
    null;

  return {
    priceId,
    planName: priceId && PRICE_TO_PLAN[priceId] ? PRICE_TO_PLAN[priceId] : "Abonné",
  };
}

async function loadSubscription(uid) {
  const subsRef = collection(db, "customers", uid, "subscriptions");
  const q = query(subsRef, orderBy("created", "desc"), limit(10));
  const snap = await getDocs(q);

  const subs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (!subs.length) return null;

  const active = subs.find(s => ["active", "trialing"].includes(String(s.status || "").toLowerCase()));
  return active || subs[0];
}

const revenueData = Array(12).fill(0);
const moneyTotalEl = document.getElementById("money-total");
const refreshMoneyBtn = document.getElementById("btn-refresh-money");
const pathEl = document.getElementById("revenue-path");
const pointsEl = document.getElementById("revenue-points");

function euro(n) {
  const x = Number(n || 0);
  return x.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function renderMoney() {
  const total = revenueData.reduce((a, b) => a + b, 0);
  if (moneyTotalEl) moneyTotalEl.textContent = euro(total);
}

function renderChart(data) {
  if (!pathEl || !pointsEl) return;

  const W = 640, H = 220;
  const max = Math.max(1, ...data);
  const padX = 20, padYTop = 20, padYBottom = 18;
  const innerW = W - padX * 2;
  const innerH = H - padYTop - padYBottom;

  const toX = (i) => padX + (innerW * i) / (data.length - 1);
  const toY = (v) => padYTop + (innerH * (1 - v / max));

  let d = "";
  data.forEach((v, i) => {
    const x = toX(i), y = toY(v);
    d += (i === 0 ? "M " : " L ") + x.toFixed(2) + " " + y.toFixed(2);
  });
  pathEl.setAttribute("d", d);

  pointsEl.innerHTML = "";
  data.forEach((v, i) => {
    const cx = toX(i), cy = toY(v);
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("cx", cx);
    c.setAttribute("cy", cy);
    c.setAttribute("r", "4");
    c.setAttribute("class", "chart-point");
    pointsEl.appendChild(c);
  });
}

refreshMoneyBtn?.addEventListener("click", () => {
  renderMoney();
  renderChart(revenueData);
});

renderMoney();
renderChart(revenueData);

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    const here = window.location.href;
    window.location.href = "/login.html?redirect=" + encodeURIComponent(here);
    return;
  }

  subStatus.textContent = "Chargement de ton abonnement…";

  try {
    const sub = await loadSubscription(user.uid);

    if (!sub) {
      subStatus.textContent = "Aucun abonnement actif";
      subPill.textContent = "Gratuit";
      subPlan.textContent = "—";
      subState.textContent = "—";
      subRenew.textContent = "—";
      return;
    }

    const status = String(sub.status || "").toLowerCase();
    const { planName, priceId } = detectPlanFromSub(sub);

    subStatus.textContent = "Abonnement détecté ✅";
    subPill.textContent = planName;
    subPlan.textContent = planName + (priceId ? ` (${priceId})` : "");
    subState.textContent = sub.status || "—";
    subRenew.textContent = fmtDate(sub.current_period_end);

  } catch (e) {
    console.error("Subscription load error:", e);
    subStatus.textContent = "Erreur de lecture abonnement";
    subPill.textContent = "—";
    subPlan.textContent = "—";
    subState.textContent = "—";
    subRenew.textContent = "—";
  }
});