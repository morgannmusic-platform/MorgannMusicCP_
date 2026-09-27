// ==========================================================
// Morgann Music CP — Client API Centralisé
// Remplace tous les imports Firestore dans le frontend
// Utilise le Worker Cloudflare comme backend
// ==========================================================

import { auth } from "/assets/js/firebase.js";

// URL de base du Worker API — à adapter si tu utilises un domaine personnalisé
const API_BASE = "https://mon-site-api.morgann-rachedi.workers.dev";

/**
 * Récupère le token Firebase Auth de l'utilisateur connecté.
 * Retourne null si pas d'utilisateur connecté.
 */
async function getAuthToken() {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
}

/**
 * Effectue une requête vers l'API Worker.
 * Ajoute automatiquement le token Firebase Auth si disponible.
 */
async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = { ...(options.headers || {}) };

  // Ajouter le token d'auth si disponible
  const token = await getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Si le body est un objet et pas un FormData, on sérialise en JSON
  if (options.body && typeof options.body === "object" && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }

  const controller = new AbortController();
  const timeoutMs = path.startsWith("/api/upload/") ? 300000 : 30000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, headers, signal: controller.signal });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(errorData.error || `Erreur ${response.status}`);
    }

    // Certaines réponses peuvent ne pas avoir de body JSON
    const contentType = response.headers.get("Content-Type") || "";
    if (contentType.includes("application/json")) {
      return await response.json();
    }
    return null;
  } catch (error) {
    if (error?.name === "AbortError") {
      console.error("API timeout:", url);
      throw new Error("Le serveur a mis trop de temps à répondre. Vérifie ta connexion et réessaie.");
    }
    console.error("API error:", { path, error });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * API Client — méthodes principales
 */
export const api = {
  /**
   * GET request
   * @param {string} path - ex: "/api/users/abc123"
   */
  async get(path) {
    return apiFetch(path, { method: "GET" });
  },

  /**
   * POST request
   * @param {string} path
   * @param {Object} data
   */
  async post(path, data) {
    return apiFetch(path, { method: "POST", body: data });
  },

  /**
   * PUT request (create or full replace)
   * @param {string} path
   * @param {Object} data
   */
  async put(path, data) {
    return apiFetch(path, { method: "PUT", body: data });
  },

  /**
   * PATCH request (partial update)
   * @param {string} path
   * @param {Object} data
   */
  async patch(path, data) {
    return apiFetch(path, { method: "PATCH", body: data });
  },

  /**
   * Upload un fichier vers R2 via le Worker.
   * @param {string} type - "avatar", "pochette", "banner"
   * @param {File} file - L'objet File à uploader
   * @returns {Promise<{success: boolean, key: string, url: string}>}
   */
  async uploadFile(type, file) {
    const formData = new FormData();
    formData.append("file", file);
    return apiFetch(`/api/upload/${type}`, {
      method: "POST",
      body: formData,
    });
  },

  /**
   * Construit l'URL complète pour servir un fichier R2.
   * @param {string} key - Clé du fichier dans R2
   * @returns {string}
   */
  fileUrl(key) {
    if (!key) return "";
    // Si c'est déjà une URL complète (migration), la retourner telle quelle
    if (key.startsWith("http://") || key.startsWith("https://")) return key;
    return `${API_BASE}/api/files/${encodeURIComponent(key)}`;
  },

  /** L'URL de base, exposée pour usage externe si nécessaire */
  BASE_URL: API_BASE,
};
