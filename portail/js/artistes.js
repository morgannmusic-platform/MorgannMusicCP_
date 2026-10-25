import { auth } from "/assets/js/firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { api } from "/assets/js/api.js";

let uidConnecte = null;
let userPlan = "starter";
let maxArtistsAllowed = 1;

onAuthStateChanged(auth, async (user) => {
    if (user) {
        uidConnecte = user.uid;
        await verifierPlanEtLimites(user.uid);
        chargerArtistes(user.uid);
    } else {
        window.location.href = "login.html";
    }
});

document.getElementById('btn-generate-ai').addEventListener('click', async () => {
    const loadingDiv = document.getElementById('litual-loading');
    const resultsDiv = document.getElementById('litual-results');
    const btnGenerate = document.getElementById('btn-generate-ai');

    let firstName = "";
    try {
        if (uidConnecte) {
            const userData = await api.get(`/api/users/${uidConnecte}`);
            if (userData && !userData.error) {
                firstName = userData.firstName || "";
            }
        }
    } catch (e) {
        console.error("Erreur récupération prénom:", e);
    }

    const mode = document.querySelector('input[name="ai-mode"]:checked').value;
    let prompt = "Génère exactement 10 propositions de noms d'artistes musicaux originaux. Ne met pas de vrai prenom de personne dans tes proposition, invente les.";

    if (mode === "with-name" && firstName) {
        prompt += `Inclus obligatoirement le prénom "${firstName}" tel quel dans toutes tes propositions. `;
    } else if (mode === "derive-name" && firstName) {
        prompt += `Crée des variantes, anagrammes ou jeux de mots originaux à partir du prénom "${firstName}". `;
    }

    prompt += "Réponds UNIQUEMENT sous la forme d'une liste brute séparée par des virgules, sans numérotation, sans texte avant ou après, et sans guillemets. Exemple: Nom Un, Nom Deux, Nom Trois";

    resultsDiv.innerHTML = "";
    loadingDiv.style.display = "flex";
    btnGenerate.disabled = true;

    try {
        const response = await fetch("https://api.ia.litual.dev.mm-cp.uk/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: prompt })
        });

        if (!response.ok) throw new Error("Erreur serveur IA");

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let completeText = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");

            for (let line of lines) {
                let cleanLine = line.trim();
                if (cleanLine.startsWith("data: ")) {
                    cleanLine = cleanLine.replace("data: ", "").trim();
                }

                if (cleanLine && cleanLine !== "[DONE]") {
                    try {
                        const parsed = JSON.parse(cleanLine);
                        if (parsed.response) completeText += parsed.response;
                        else if (parsed.text) completeText += parsed.text;
                        else if (parsed.token) completeText += parsed.token;
                    } catch {
                        if (!cleanLine.startsWith("{") && !cleanLine.includes('"usage"')) {
                            completeText += " " + cleanLine;
                        }
                    }
                }
            }
        }

        const names = completeText
            .replace(/[\n\r]/g, ' ')
            .split(',')
            .map(name => {
                let clean = name.split('{')[0];
                return clean.trim().replace(/^["'-]|["'-]$/g, '');
            })
            .filter(name => {
                const lower = name.toLowerCase();
                return (
                    name.length > 1 &&
                    !name.includes(':') &&
                    !lower.includes('token') &&
                    !lower.includes('prompt')
                );
            });

        resultsDiv.innerHTML = "";
        if (names.length === 0) {
            resultsDiv.innerHTML = `<span style="color:orange; font-size:12px;">L'IA a répondu dans un format instable. Réessayez.</span>`;
        } else {
            names.forEach(name => {
                const pill = document.createElement('div');
                pill.className = 'artist-pill';
                pill.textContent = name;

                pill.addEventListener('click', () => {
                    const inputName = document.getElementById('artist-name');
                    if (inputName) {
                        inputName.value = name;
                    }
                });
                resultsDiv.appendChild(pill);
            });
        }
    } catch (error) {
        console.error("Erreur IA:", error);
        resultsDiv.innerHTML = `<span style="color:red; font-size:12px;">Erreur lors de la génération.</span>`;
    } finally {
        loadingDiv.style.display = "none";
        btnGenerate.disabled = false;
    }
});

async function verifierPlanEtLimites(uid) {
    try {
        const userData = await api.get(`/api/users/${uid}`);
        if (userData && !userData.error) {
            const planName = (userData.planName || "").toLowerCase().trim();

            if (planName === "future légende" || planName === "future legende") {
                userPlan = "future-legende";
            } else if (planName === "starter") {
                userPlan = "starter";
            } else if (planName === "pro") {
                userPlan = "pro";
            } else if (planName === "label") {
                userPlan = "label";
            } else if (planName === "white-label") {
                userPlan = "white-label";
            } else {
                userPlan = "starter";
            }
        }
    } catch (err) {
        console.error("Erreur récupération plan D1:", err);
    }

    if (userPlan === "future-legende" || userPlan === "starter") {
        maxArtistsAllowed = 1;
    } else if (userPlan === "pro") {
        maxArtistsAllowed = 2;
    } else if (userPlan === "label" || userPlan === "white-label") {
        maxArtistsAllowed = Infinity;
    } else {
        maxArtistsAllowed = 1;
    }
}

async function chargerArtistes(uid) {
    const listContainer = document.getElementById("artist-list");
    listContainer.innerHTML = "";

    try {
        const artistsList = await api.get(`/api/users/${uid}/artists`);
        const snapshot = Array.isArray(artistsList) ? artistsList : [];

        document.getElementById("artist-count").innerText = `(${snapshot.length} / ${maxArtistsAllowed === Infinity ? 'Illimité' : maxArtistsAllowed})`;

        snapshot.forEach((artist) => {
            const card = document.createElement("div");
            card.className = "artist-card";
            card.onclick = () => {
                window.location.href = `artiste.html?id=${artist.id}`;
            };

            const photoUrl = artist.photo ? api.fileUrl(artist.photo) : "/assets/img/icons/pdp.png";

            card.innerHTML = `
                        <img src="${photoUrl}" alt="${artist.name}">
                        <h3>${artist.name}</h3>
                        <p style="font-size:12px; color:#777;">${artist.primaryGenre || 'Aucun genre'}</p>
                    `;
            listContainer.appendChild(card);
        });
    } catch (err) {
        console.error("Erreur chargement artistes D1:", err);
    }
}

window.ouvrirModalAjout = async function () {
    try {
        const currentUserId = auth.currentUser ? auth.currentUser.uid : uidConnecte;
        if (!currentUserId) return;

        const artistsList = await api.get(`/api/users/${currentUserId}/artists`);
        const count = Array.isArray(artistsList) ? artistsList.length : 0;

        if (count >= maxArtistsAllowed) {
            alert("Vous avez atteint la limite d'artistes pour votre plan.");
            return;
        }

        document.getElementById("artist-form").reset();
        document.getElementById("litual-results").innerHTML = "";
        document.getElementById("artist-modal").style.display = "flex";
    } catch (e) {
        console.error("Erreur ouverture modal ajout :", e);
    }
}

window.soumettreFormulaire = async function (e) {
    e.preventDefault();
    const uid = auth.currentUser.uid;
    const artistName = document.getElementById("artist-name").value.trim();

    if (!artistName) return;

    const artistPayload = {
        name: artistName
    };

    try {
        const response = await api.post(`/api/users/${uid}/artists`, artistPayload);
        fermerModal();
        if (response && response.id) {
            window.location.href = `artiste.html?id=${response.id}`;
        } else {
            chargerArtistes(uid);
        }
    } catch (error) {
        console.error("Erreur lors de la création :", error);
    }
}

window.fermerModal = function () {
    document.getElementById("artist-modal").style.display = "none";
}


document.addEventListener("DOMContentLoaded", () => {
    const currentPath = window.location.pathname.split("/").pop();
    const navLinks = document.querySelectorAll(".responsive-nav a");

    navLinks.forEach(link => {
        const linkPath = link.getAttribute("href").split("/").pop();
        if (currentPath === linkPath) {
            link.classList.add("active");
        } else {
            link.classList.remove("active");
        }
    });
});
