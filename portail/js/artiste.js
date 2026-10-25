import { auth } from "/assets/js/firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { api } from "/assets/js/api.js";

let uidConnecte = null;
let userPlan = "starter";
const allDeliveries = ["YouTube Content ID", "Meta Rights Manager", "SoundCloud Monetization", "SoundExchange", "Tracklib", "Hook", "LyricFind", "EVEN", "Roblox"];
const urlParams = new URLSearchParams(window.location.search);
const artistId = urlParams.get('id');

onAuthStateChanged(auth, async (user) => {
    if (user) {
        uidConnecte = user.uid;
        await verifierPlanUtilisateur(user.uid);
        injecterStructureSelonPlan();
        if (artistId) {
            chargerDetailsArtiste(user.uid, artistId);
        } else {
            alert("Aucun identifiant d'artiste spécifié.");
            window.location.href = "artistes.html";
        }
    } else {
        window.location.href = "login.html";
    }
});

async function verifierPlanUtilisateur(uid) {
    try {
        const userData = await api.get(`/api/users/${uid}`);
        if (userData && !userData.error) {
            const planName = (userData.planName || "").toLowerCase().trim();
            if (planName === "future légende" || planName === "future legende") userPlan = "future-legende";
            else if (planName === "starter") userPlan = "starter";
            else if (planName === "pro") userPlan = "pro";
            else if (planName === "label") userPlan = "label";
            else if (planName === "white-label") userPlan = "white-label";
        }
    } catch (err) {
        console.error("Erreur récupération plan:", err);
    }
}

function injecterStructureSelonPlan() {
    const labelFields = document.getElementById("label-fields");
    const wlOnlyFields = document.getElementById("wl-only-fields");
    const deliveryContainer = document.getElementById("delivery-checkboxes");

    deliveryContainer.innerHTML = "";
    let allowedDeliveries = [];

    if (userPlan === "starter" || userPlan === "pro") {
        allowedDeliveries = ["YouTube Content ID", "Meta Rights Manager", "SoundCloud Monetization", "SoundExchange", "Hook", "LyricFind", "EVEN", "Roblox"];
    } else {
        allowedDeliveries = allDeliveries;
    }
    if (userPlan === "label") {
        allowedDeliveries = allDeliveries;
        if (labelFields) labelFields.style.display = "block";
        if (wlOnlyFields) wlOnlyFields.style.display = "none";
    } else if (userPlan === "white-label") {
        allowedDeliveries = allDeliveries;
        if (labelFields) labelFields.style.display = "block";
        if (wlOnlyFields) wlOnlyFields.style.display = "block";
    }

    allowedDeliveries.forEach(del => {
        deliveryContainer.innerHTML += `
            <label><input type="checkbox" class="delivery-cb" value="${del}"> ${del}</label>
        `;
    });
}

async function chargerDetailsArtiste(uid, id) {
    try {
        const response = await api.get(`/api/users/${uid}/artists/${id}`);

        // Récupération sécurisée de l'objet artiste et de l'éditeur
        const artistData = response.artist || response;
        const editorData = response.editor || {};

        if (artistData && !artistData.error) {
            document.getElementById("artist-id").value = id;
            document.getElementById("artist-name").value = artistData.name || "";
            document.getElementById("artist-desc").value = artistData.biographie || artistData.description || "";

            // Réseaux & Plateformes (Mappage corrigé avec les champs de la BDD)
            document.getElementById("link-apple").value = artistData.linkApple || artistData.appleMusicId || artistData.apple_music_id || "";
            document.getElementById("link-spotify").value = artistData.linkSpotify || artistData.spotifyId || artistData.spotify_id || "";
            document.getElementById("link-amazon").value = artistData.linkAmazon || artistData.amazonUrl || artistData.amazon_url || "";
            document.getElementById("link-soundcloud").value = artistData.linkSoundcloud || artistData.soundcloudUrl || "";
            document.getElementById("link-website").value = artistData.linkWebsite || artistData.websiteUrl || artistData.website || "";
            document.getElementById("link-fb").value = artistData.linkFb || artistData.facebookUrl || artistData.facebook_url || "";
            document.getElementById("link-insta").value = artistData.linkInsta || artistData.instagramUrl || artistData.instagram_url || "";
            document.getElementById("link-tiktok").value = artistData.tiktokUrl || artistData.tiktok_url || "";
            document.getElementById("link-threads").value = artistData.threadsUrl || artistData.threads_url || "";
            document.getElementById("link-x").value = artistData.linkX || artistData.twitterUrl || "";
            document.getElementById("link-wiki").value = artistData.linkWiki || artistData.wikipediaUrl || "";
            document.getElementById("id-ddex").value = artistData.idDdex || "";
            document.getElementById("id-musicbrainz").value = artistData.idMusicbrainz || "";
            document.getElementById("id-allmusic").value = artistData.idAllmusic || "";
            document.getElementById("id-isni").value = artistData.idIsni || "";

            // Chargement des données de la table editeur
            if (editorData) {
                document.getElementById("genre-primary").value = editorData.primaryGenre || "";
                document.getElementById("genre-secondary").value = editorData.secondaryGenre || "";
                document.getElementById("default-language").value = editorData.defaultLanguage || "";
                document.getElementById("timezone").value = editorData.timezone || "";
                document.getElementById("release-time").value = editorData.releaseTime || "";
                document.getElementById("manual-platforms").value = editorData.manualPlatforms || "";
                document.getElementById("manual-territories").value = editorData.manualTerritories || "";

                if (userPlan === "label" || userPlan === "white-label") {
                    document.getElementById("line-copyright").value = editorData.lineCopyright || "";
                    document.getElementById("line-phonogram").value = editorData.linePhonogram || "";
                    if (userPlan === "white-label") {
                        document.getElementById("label-name").value = editorData.labelName || "";
                    }
                }

                document.getElementById("writers-container").innerHTML = "";
                if (editorData.writers) {
                    const parsedWriters = typeof editorData.writers === 'string' ? JSON.parse(editorData.writers) : editorData.writers;
                    if (Array.isArray(parsedWriters)) {
                        parsedWriters.forEach(w => ajouterEcrivainRow(w));
                    }
                }

                document.getElementById("credits-container").innerHTML = "";
                if (editorData.credits) {
                    const parsedCredits = typeof editorData.credits === 'string' ? JSON.parse(editorData.credits) : editorData.credits;
                    if (Array.isArray(parsedCredits)) {
                        parsedCredits.forEach(c => ajouterCreditRow(c));
                    }
                }

                const checkboxes = document.querySelectorAll(".delivery-cb");
                let parsedDeliveries = [];
                try {
                    parsedDeliveries = typeof editorData.deliveries === 'string' ? JSON.parse(editorData.deliveries) : (editorData.deliveries || []);
                } catch (e) { parsedDeliveries = []; }

                checkboxes.forEach(cb => {
                    if (Array.isArray(parsedDeliveries) && parsedDeliveries.includes(cb.value)) {
                        cb.checked = true;
                    }
                });
            }
        } else {
            alert("Artiste introuvable.");
            window.location.href = "artistes.html";
        }
    } catch (e) {
        console.error("Erreur chargement détails artiste :", e);
    }
}


window.ajouterEcrivainRow = function (valeurs = { nom: "", type: "Les deux" }) {
    const container = document.getElementById("writers-container");
    const div = document.createElement("div");
    div.className = "dynamic-row";
    div.innerHTML = `
                <input type="text" class="writer-name" placeholder="Nom de l'écrivain" style="flex:2; padding: 8px 15px; border: 1px solid #FC8FB0; border-radius: 50px; font-size: 14px; outline: none; background: #fff;" value="${valeurs.nom || ''}">
                <select class="writer-type" style="flex:1; padding: 8px 15px; border: 1px solid #FC8FB0; border-radius: 50px; font-size: 14px; outline: none; background: #fff;">
                    <option value="Compositeur" ${valeurs.type === 'Compositeur' ? 'selected' : ''}>Compositeur</option>
                    <option value="Parolier" ${valeurs.type === 'Parolier' ? 'selected' : ''}>Parolier</option>
                    <option value="Les deux" ${valeurs.type === 'Les deux' || valeurs.type === 'les deux' ? 'selected' : ''}>Les deux</option>
                </select>
                <button type="button" class="btn btn-danger" onclick="this.parentElement.remove()">X</button>
            `;
    container.appendChild(div);
};

window.ajouterCreditRow = function (valeurs = { nom: "", instrument: "", voix: "", utilite: "" }) {
    const container = document.getElementById("credits-container");
    const div = document.createElement("div");
    div.className = "dynamic-row";
    div.innerHTML = `
                <input type="text" class="credit-name" placeholder="Nom complet" style="flex:1.5; padding: 8px 15px; border: 1px solid #FC8FB0; border-radius: 50px; font-size: 14px; outline: none; background: #fff;" value="${valeurs.nom || ''}">
                <input type="text" class="credit-instrument" placeholder="Instrument" style="flex:1; padding: 8px 15px; border: 1px solid #FC8FB0; border-radius: 50px; font-size: 14px; outline: none; background: #fff;" value="${valeurs.instrument || ''}">
                <input type="text" class="credit-voice" placeholder="Voix" style="flex:1; padding: 8px 15px; border: 1px solid #FC8FB0; border-radius: 50px; font-size: 14px; outline: none; background: #fff;" value="${valeurs.voix || ''}">
                <input type="text" class="credit-utility" placeholder="Utilité" style="flex:1; padding: 8px 15px; border: 1px solid #FC8FB0; border-radius: 50px; font-size: 14px; outline: none; background: #fff;" value="${valeurs.utilite || ''}">
                <button type="button" class="btn btn-danger" onclick="this.parentElement.remove()">X</button>
            `;
    container.appendChild(div);
};


window.soumettreFormulaire = async function (e) {
    e.preventDefault();
    const uid = auth.currentUser.uid;
    const id = document.getElementById("artist-id").value;

    const writers = [];
    document.querySelectorAll(".writer-name").forEach((el, index) => {
        if (el.value.trim() !== "") {
            writers.push({
                nom: el.value.trim(),
                type: document.querySelectorAll(".writer-type")[index].value
            });
        }
    });

    const credits = [];
    document.querySelectorAll(".credit-name").forEach((el, index) => {
        if (el.value.trim() !== "") {
            credits.push({
                nom: el.value.trim(),
                instrument: document.querySelectorAll(".credit-instrument")[index].value.trim(),
                voix: document.querySelectorAll(".credit-voice")[index].value.trim(),
                utilite: document.querySelectorAll(".credit-utility")[index].value.trim()
            });
        }
    });

    const deliveries = [];
    document.querySelectorAll(".delivery-cb:checked").forEach(cb => deliveries.push(cb.value));

    // Payloads séparés
    const artistPayload = {
        biographie: document.getElementById("artist-desc").value.trim(),
        linkApple: document.getElementById("link-apple").value.trim(),
        linkSpotify: document.getElementById("link-spotify").value.trim(),
        linkAmazon: document.getElementById("link-amazon").value.trim(),
        linkSoundcloud: document.getElementById("link-soundcloud").value.trim(),
        linkWebsite: document.getElementById("link-website").value.trim(),
        linkFb: document.getElementById("link-fb").value.trim(),
        linkInsta: document.getElementById("link-insta").value.trim(),
        tiktokUrl: document.getElementById("link-tiktok").value.trim(),
        threadsUrl: document.getElementById("link-threads").value.trim(),
        linkX: document.getElementById("link-x").value.trim(),
        linkWiki: document.getElementById("link-wiki").value.trim(),
        idDdex: document.getElementById("id-ddex").value.trim(),
        idMusicbrainz: document.getElementById("id-musicbrainz").value.trim(),
        idAllmusic: document.getElementById("id-allmusic").value.trim(),
        idIsni: document.getElementById("id-isni").value.trim()
    };

    const editorPayload = {
        writers: JSON.stringify(writers),
        credits: JSON.stringify(credits),
        primaryGenre: document.getElementById("genre-primary").value.trim(),
        secondaryGenre: document.getElementById("genre-secondary").value.trim(),
        defaultLanguage: document.getElementById("default-language").value.trim(),
        timezone: document.getElementById("timezone").value.trim(),
        releaseTime: document.getElementById("release-time").value,
        manualPlatforms: document.getElementById("manual-platforms").value.trim(),
        manualTerritories: document.getElementById("manual-territories").value.trim(),
        deliveries: JSON.stringify(deliveries),
        labelName: (userPlan === "white-label") ? document.getElementById("label-name").value.trim() : "",
        lineCopyright: (userPlan === "label" || userPlan === "white-label") ? document.getElementById("line-copyright").value.trim() : "",
        linePhonogram: (userPlan === "label" || userPlan === "white-label") ? document.getElementById("line-phonogram").value.trim() : ""
    };

    try {
        // Mise à jour des informations artiste + création/mise à jour de l'éditeur
        await api.put(`/api/users/${uid}/artists/${id}`, artistPayload);
        await api.put(`/api/users/${uid}/artists/${id}/editor`, editorPayload);

        alert("Modifications enregistrées avec succès !");
        window.location.href = "artistes.html";
    } catch (error) {
        console.error("Erreur lors de la sauvegarde :", error);
        alert("Erreur lors de la sauvegarde.");
    }
};

