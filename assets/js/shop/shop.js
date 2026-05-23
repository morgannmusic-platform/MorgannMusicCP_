import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { collection, getDocs, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-functions.js";
import { auth, db, functions, euro, ensureLoggedInRedirect, showShopDevWarning } from "/assets/js/shop/firebase-client.js";

const grid = document.getElementById("prodsGrid");
const statusEl = document.getElementById("status");

let currentUser = null;

showShopDevWarning();

async function injectNavbar() {
  return;
}

function esc(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function addToCart(prod) {
  if (!currentUser) {
    ensureLoggedInRedirect(window.location.href);
    return;
  }
  const ref = doc(db, "users", currentUser.uid, "cart", prod.id);
  const existing = await getDoc(ref);
  const quantity = existing.exists() ? Math.max(1, Number(existing.data().quantity || 1)) + 1 : 1;

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

async function buyNow(prod) {
  if (!currentUser) {
    ensureLoggedInRedirect(window.location.href);
    return;
  }

  const createCheckout = httpsCallable(functions, "createCheckoutSession");
  const successUrl = `${window.location.origin}/contracts/checkout-success.html?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${window.location.origin}/shop/prod.html?id=${encodeURIComponent(prod.id)}&checkout=cancel`;

  const result = await createCheckout({
    items: [{ prodId: prod.id, quantity: 1 }],
    successUrl,
    cancelUrl
  });

  const url = result?.data?.url;
  if (!url) throw new Error("URL checkout introuvable");
  window.location.href = url;
}

function cardTemplate(prod) {
  return `
    <article class="prod-card">
      <a href="/shop/prod.html?id=${encodeURIComponent(prod.id)}">
        <img class="prod-cover" src="${esc(prod.imageUrl || "/default-avatar.png")}" alt="${esc(prod.titre)}">
      </a>
      <a class="prod-title-link" href="/shop/prod.html?id=${encodeURIComponent(prod.id)}"><h2 class="prod-title">${esc(prod.titre)}</h2></a>
      <p class="prod-meta">Licence instantanée • Fichier WAV/MP3</p>
      <p class="prod-price">${esc(euro(prod.prix))}</p>
      <audio class="audio-preview" controls preload="none" src="${esc(prod.audioUrl || "")}"></audio>
      <div class="actions">
        <button class="btn-buy" data-buy="${esc(prod.id)}">Acheter</button>
        <button class="btn-cart" data-cart="${esc(prod.id)}">Ajouter au panier</button>
      </div>
    </article>
  `;
}

async function loadProds() {
  const snap = await getDocs(collection(db, "prods"));
  const prods = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  if (!prods.length) {
    statusEl.textContent = "Aucune prod disponible pour le moment.";
    grid.innerHTML = "";
    return;
  }

  prods.sort((a, b) => String(a.titre || "").localeCompare(String(b.titre || ""), "fr", { sensitivity: "base" }));
  statusEl.textContent = `${prods.length} prods disponibles`;
  grid.innerHTML = prods.map(cardTemplate).join("");

  grid.querySelectorAll("[data-cart]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const prod = prods.find((p) => p.id === btn.dataset.cart);
      if (!prod) return;
      try {
        await addToCart(prod);
      } catch (error) {
        statusEl.textContent = `Erreur panier: ${error.message || error}`;
      }
    });
  });

  grid.querySelectorAll("[data-buy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const prod = prods.find((p) => p.id === btn.dataset.buy);
      if (!prod) return;
      try {
        await buyNow(prod);
      } catch (error) {
        statusEl.textContent = `Erreur checkout: ${error.message || error}`;
      }
    });
  });
}

onAuthStateChanged(auth, (user) => {
  currentUser = user || null;
});

await loadProds();
