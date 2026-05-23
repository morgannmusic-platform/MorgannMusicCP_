import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-functions.js";
import { auth, db, functions, euro, ensureLoggedInRedirect, showShopDevWarning } from "/assets/js/shop/firebase-client.js";

const statusEl = document.getElementById("status");
const detailEl = document.getElementById("detail");

let currentUser = null;
let prod = null;

showShopDevWarning();

function esc(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function injectNavbar() {
  return;
}

async function addToCart() {
  if (!currentUser) {
    ensureLoggedInRedirect(window.location.href);
    return;
  }
  const ref = doc(db, "users", currentUser.uid, "cart", prod.id);
  const previous = await getDoc(ref);
  const quantity = previous.exists() ? Math.max(1, Number(previous.data().quantity || 1)) + 1 : 1;

  await setDoc(ref, {
    prodId: prod.id,
    titre: prod.titre,
    prix: Number(prod.prix || 0),
    imageUrl: prod.imageUrl || "",
    stripe_price_id: prod.stripe_price_id || "",
    quantity,
    updatedAt: serverTimestamp()
  }, { merge: true });

  statusEl.textContent = `Ajouté au panier: ${prod.titre}`;
}

async function buyNow() {
  if (!currentUser) {
    ensureLoggedInRedirect(window.location.href);
    return;
  }
  const createCheckout = httpsCallable(functions, "createCheckoutSession");
  const successUrl = `${window.location.origin}/contracts/checkout-success.html?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = window.location.href;

  const result = await createCheckout({
    items: [{ prodId: prod.id, quantity: 1 }],
    successUrl,
    cancelUrl
  });

  const url = result?.data?.url;
  if (!url) throw new Error("URL checkout introuvable");
  window.location.href = url;
}

function renderProd() {
  detailEl.innerHTML = `
    <div>
      <img class="detail-cover" src="${esc(prod.imageUrl || "/default-avatar.png")}" alt="${esc(prod.titre)}">
    </div>
    <div>
      <h1 class="prod-title">${esc(prod.titre)}</h1>
      <p class="prod-price">${esc(euro(prod.prix))}</p>
      <audio class="audio-preview" controls preload="metadata" src="${esc(prod.audioUrl || "")}"></audio>
      <ul class="detail-meta-list">
        <li>BPM: ${prod.bpm || "—"}</li>
        <li>Genre: ${esc(prod.genre || "—")}</li>
        <li>Tags: ${esc(Array.isArray(prod.tags) ? prod.tags.join(", ") : "—")}</li>
      </ul>
      <div class="actions" style="margin-top:18px;">
        <button id="buyBtn" class="btn-buy">Acheter</button>
        <button id="cartBtn" class="btn-cart">Ajouter au panier</button>
      </div>
    </div>
  `;
  detailEl.style.display = "grid";

  document.getElementById("buyBtn")?.addEventListener("click", async () => {
    try {
      await buyNow();
    } catch (error) {
      statusEl.textContent = `Erreur checkout: ${error.message || error}`;
    }
  });

  document.getElementById("cartBtn")?.addEventListener("click", async () => {
    try {
      await addToCart();
    } catch (error) {
      statusEl.textContent = `Erreur panier: ${error.message || error}`;
    }
  });
}

async function loadProd() {
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) {
    statusEl.textContent = "Prod introuvable.";
    return;
  }

  const snap = await getDoc(doc(db, "prods", id));
  if (!snap.exists()) {
    statusEl.textContent = "Prod introuvable.";
    return;
  }

  prod = { id: snap.id, ...snap.data() };
  statusEl.textContent = "";
  renderProd();
}

onAuthStateChanged(auth, (user) => {
  currentUser = user || null;
});

await loadProd();
