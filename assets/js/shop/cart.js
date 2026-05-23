import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { collection, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-functions.js";
import { auth, db, functions, euro, ensureLoggedInRedirect, showShopDevWarning } from "/assets/js/shop/firebase-client.js";

const statusEl = document.getElementById("status");
const cartList = document.getElementById("cartList");
const cartSummary = document.getElementById("cartSummary");
const cartTotalEl = document.getElementById("cartTotal");
const payBtn = document.getElementById("payBtn");

let currentUser = null;
let currentItems = [];
let unsubscribeCart = null;

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

async function updateQuantity(prodId, quantity) {
  if (!currentUser) return;
  if (quantity <= 0) {
    await deleteDoc(doc(db, "users", currentUser.uid, "cart", prodId));
    return;
  }
  await updateDoc(doc(db, "users", currentUser.uid, "cart", prodId), {
    quantity,
    updatedAt: serverTimestamp()
  });
}

function render() {
  if (!currentItems.length) {
    statusEl.textContent = "Ton panier est vide.";
    cartList.innerHTML = "";
    cartSummary.style.display = "none";
    return;
  }

  statusEl.textContent = `${currentItems.length} prod(s) dans le panier`;
  cartList.innerHTML = currentItems.map((item) => `
    <article class="cart-item panel">
      <img src="${esc(item.imageUrl || "/default-avatar.png")}" alt="${esc(item.titre)}">
      <div>
        <h3 class="cart-title">${esc(item.titre || "Prod")}</h3>
        <p class="shop-muted" style="margin:0 0 8px;">${esc(euro(item.prix || 0))}</p>
        <div class="qty-row">
          <button class="qty-btn" data-minus="${esc(item.prodId)}">-</button>
          <strong>${Math.max(1, Number(item.quantity || 1))}</strong>
          <button class="qty-btn" data-plus="${esc(item.prodId)}">+</button>
          <button class="btn-remove" data-remove="${esc(item.prodId)}">Retirer</button>
        </div>
      </div>
      <strong class="cart-total-line">${esc(euro((Number(item.prix || 0) * Math.max(1, Number(item.quantity || 1)))))}</strong>
    </article>
  `).join("");

  const total = currentItems.reduce((sum, item) => sum + (Number(item.prix || 0) * Math.max(1, Number(item.quantity || 1))), 0);
  cartTotalEl.textContent = `Total: ${euro(total)}`;
  cartSummary.style.display = "flex";

  cartList.querySelectorAll("[data-minus]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const item = currentItems.find((i) => i.prodId === btn.dataset.minus);
      if (!item) return;
      await updateQuantity(item.prodId, Math.max(1, Number(item.quantity || 1) - 1));
    });
  });

  cartList.querySelectorAll("[data-plus]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const item = currentItems.find((i) => i.prodId === btn.dataset.plus);
      if (!item) return;
      await updateQuantity(item.prodId, Math.max(1, Number(item.quantity || 1) + 1));
    });
  });

  cartList.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await deleteDoc(doc(db, "users", currentUser.uid, "cart", btn.dataset.remove));
    });
  });
}

async function checkoutCart() {
  const createCheckout = httpsCallable(functions, "createCheckoutSession");
  const successUrl = `${window.location.origin}/contracts/checkout-success.html?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${window.location.origin}/shop/cart.html?checkout=cancel`;

  const items = currentItems.map((item) => ({
    prodId: item.prodId,
    quantity: Math.max(1, Number(item.quantity || 1))
  }));

  const result = await createCheckout({ items, successUrl, cancelUrl });
  const url = result?.data?.url;
  if (!url) throw new Error("URL checkout introuvable");
  window.location.href = url;
}

function startCartListener(user) {
  if (unsubscribeCart) unsubscribeCart();

  unsubscribeCart = onSnapshot(collection(db, "users", user.uid, "cart"), (snap) => {
    currentItems = snap.docs.map((d) => ({
      prodId: d.id,
      ...d.data()
    }));
    currentItems.sort((a, b) => String(a.titre || "").localeCompare(String(b.titre || ""), "fr", { sensitivity: "base" }));
    render();
  }, (error) => {
    statusEl.textContent = `Erreur panier: ${error.message || error}`;
  });
}

payBtn?.addEventListener("click", async () => {
  if (!currentItems.length) return;
  try {
    await checkoutCart();
  } catch (error) {
    statusEl.textContent = `Erreur checkout: ${error.message || error}`;
  }
});

onAuthStateChanged(auth, (user) => {
  currentUser = user || null;
  if (!currentUser) {
    ensureLoggedInRedirect(window.location.href);
    return;
  }
  startCartListener(currentUser);
});
