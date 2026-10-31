import { auth } from "/assets/js/firebase.js";

// Corrige l'URL de base ici
const API_BASE_URL = "https://api.label.worker.mm-cp.uk";

async function getAuthHeaders(isFormData = false) {
    const user = auth.currentUser;
    let headers = {};

    if (user) {
        const token = await user.getIdToken();
        headers["Authorization"] = `Bearer ${token}`;
    }

    if (!isFormData) {
        headers["Content-Type"] = "application/json";
    }

    return headers;
}

export const api = {
    async get(endpoint) {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: "GET",
            headers
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `Route non trouvée (${response.status})`);
        }
        return response.json();
    },

    async post(endpoint, data) {
        const isFormData = data instanceof FormData;
        const headers = await getAuthHeaders(isFormData);

        const options = {
            method: "POST",
            headers
        };

        if (isFormData) {
            options.body = data;
        } else {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `Route non trouvée (${response.status})`);
        }
        return response.json();
    }
};