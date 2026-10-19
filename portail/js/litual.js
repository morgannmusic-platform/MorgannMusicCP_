import { auth } from "/assets/js/firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { api } from "/assets/js/api.js";

const state = {
    user: null,
    profile: {},
    artists: [],
    releases: [],
    tracks: [],
    plays: [],
    tracklists: [],
    events: [],
    freeboard: [],
    payouts: [],
    withdrawals: [],
    reviews: [],
    supportTickets: [],
    conversations: [],
    activeConversationId: null,
    pendingPrompt: null,
    pendingProfileUpdate: null,
    pendingSuggestedUpdate: null,
};

const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const chatForm = document.getElementById("chat-form");
const sendButton = document.getElementById("send-button");
const conversationList = document.getElementById("conversation-list");
const currentConversationTitle = document.getElementById("current-conversation-title");
const conversationNameBadge = document.getElementById("conversation-name-badge");
const renameButton = document.getElementById("rename-conversation");
const newConversationButton = document.getElementById("new-conversation");
const historyToggle = document.getElementById("history-toggle");
const conversationSidebar = document.getElementById("conversation-sidebar");

function getConversationTitle(conversation = {}) {
    return String(conversation.title || "Nouvelle conversation").trim() || "Nouvelle conversation";
}

function generateConversationTitle(input = "") {
    const normalized = String(input || "")
        .replace(/https?:\/\/\S+/gi, " ")
        .replace(/[#*_]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    if (!normalized) return "Nouvelle conversation";
    const words = normalized.split(" ").filter(Boolean).slice(0, 5);
    return words.join(" ") || "Nouvelle conversation";
}

function sanitizeLinkTarget(value) {
    if (value == null) return "#";
    let href = String(value).trim().replace(/&amp;/g, "&");
    if (!href) return "#";
    if (href.startsWith("javascript:")) return "#";
    if (!/^(https?:|mailto:|tel:|\/|\.\/|#)/i.test(href)) {
        href = `/${href.replace(/^\/+/, "")}`;
    }
    return href;
}

function escapeHtml(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function normalizeAiMarkdown(rawText = "") {
    let text = String(rawText || "");
    text = text.replace(/\[\s*BOUTON\s*:\s*([^\]]+?)\s*\]\s*\(\s*([^\)]+?)\s*\)/gi, (_, label, href) => {
        return `[BOUTON:${String(label).trim()}](${sanitizeLinkTarget(href)})`;
    });
    text = text.replace(/\[\s*([^\]]+?)\s*\]\s*\(\s*([^\)]+?)\s*\)/g, (_, label, href) => {
        const cleanLabel = String(label).trim().replace(/^BOUTON\s*:/i, "").trim() || "Découvrir";
        return `[BOUTON:${cleanLabel}](${sanitizeLinkTarget(href)})`;
    });
    text = text.replace(/(https?:\/\/[^\s)]+|\/[A-Za-z0-9_./?&=-]+)/gi, (match) => {
        return `[BOUTON:Découvrir](${sanitizeLinkTarget(match)})`;
    });
    return text;
}

function formatInlineMarkdown(value = "") {
    let text = escapeHtml(String(value || ""));
    text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
    text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    text = text.replace(/_([^_]+)_/g, "<em>$1</em>");
    text = text.replace(/~~([^~]+)~~/g, "<del>$1</del>");
    text = text.replace(/\n/g, "<br>");
    return text;
}

function normalizeProfileFieldName(value = "") {
    const map = {
        first_name: "firstName",
        last_name: "lastName",
        full_name: "fullName",
        artist_name: "artistName",
        postal_code: "postalCode",
        photo_url: "photoURL",
        auth_method: "authMethod",
        plan_name: "planName",
        subscription_status: "subscriptionStatus",
        totp_enabled: "totpEnabled",
        totp_secret: "totpSecret",
        email_address: "email",
        nom_artiste: "artistName",
        ville: "city",
        adresse: "address",
        prenom: "firstName",
        nom: "lastName",
        date_sortie: "dateSortie",
        date_de_sortie: "dateSortie",
        sortie_date: "dateSortie",
        dateSortie: "dateSortie",
        release_date: "dateSortie",
        releaseDate: "dateSortie",
        sortiedate: "dateSortie",
        date: "date",
    };

    const raw = String(value || "").trim();
    if (!raw) return "";
    return map[raw] || raw;
}

function getHumanFieldLabel(field = "", entity = "user") {
    const map = {
        firstName: "prénom",
        lastName: "nom",
        fullName: "nom complet",
        artistName: "nom d’artiste",
        email: "e-mail",
        city: "ville",
        address: "adresse",
        phone: "téléphone",
        planName: "plan",
        bio: "biographie",
        description: "description",
        country: "pays",
        website: "site web",
        instagram: "Instagram",
        spotify: "Spotify",
        youtube: "YouTube",
        tiktok: "TikTok",
        status: "statut",
        title: "titre",
        primaryGenre: "genre principal",
        releaseDate: "date de sortie",
        dateSortie: "date de sortie",
        date: "date"
    };

    const normalized = normalizeProfileFieldName(field || "");
    const label = map[normalized] || normalized || "champ";
    return String(label).replace(/_/g, " ").trim();
}

function stripActionPayloadBlocks(text = "") {
    return String(text || "")
        .replace(/(?:^|\n)\s*(?:__)?MMCP(?:[_-]?)ACTION(?:[_-]?)\s*(?:[:=]\s*)?[\s\S]*?(?=(?:\n\s*(?:[A-ZÀ-Ö]|[-*] |\d+\.)|\n{2,}|$))/gi, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function buildConversationHistoryContext(activeConversationId) {
    const others = state.conversations
        .filter((conversation) => String(conversation.id) !== String(activeConversationId))
        .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))
        .slice(0, 3);

    const entries = [];
    others.forEach((conversation) => {
        const messages = Array.isArray(conversation.messages) ? conversation.messages.slice(-8) : [];
        if (!messages.length) return;

        entries.push({
            role: "user",
            content: `Historique conversation : ${getConversationTitle(conversation)}\n${messages.map((message) => `${message.role === "assistant" ? "Assistant" : "Utilisateur"}: ${stripActionPayloadBlocks(message.content || "")}`).join("\n")}`
        });
    });

    return entries;
}

const USER_EDITABLE_FIELDS = new Set([
    "firstName",
    "lastName",
    "fullName",
    "artistName",
    "email",
    "city",
    "address",
    "phone",
    "planName",
    "bio",
    "description",
    "country",
    "website",
    "instagram",
    "spotify",
    "youtube",
    "tiktok",
    "status",
    "label",
    "genre",
    "primaryGenre",
    "type",
    "title",
    "releaseDate",
    "date",
    "dateSortie",
    "date_sortie",
    "sortieDate",
    "release_date",
    "date_de_sortie",
    "cover",
    "thumbnail",
    "publicDescription",
    "descriptionFr",
    "descriptionEn"
]);

const BLOCKED_UPDATE_FIELDS = new Set([
    "revenus",
    "revenue",
    "revenu",
    "payouts",
    "payout",
    "withdrawals",
    "withdrawal",
    "withdrawalAmount",
    "amount",
    "total",
    "sold",
    "balance",
    "bank",
    "iban",
    "artistName",
    "nomArtiste",
    "stageName",
    "nom_d_artiste",
    "nameArtist"
]);

function isAllowedFieldForUpdate(entity, field) {
    const normalized = String(field || "").trim();
    if (!normalized) return false;
    if (BLOCKED_UPDATE_FIELDS.has(normalized) || BLOCKED_UPDATE_FIELDS.has(normalized.toLowerCase())) return false;
    if (entity === "user") return USER_EDITABLE_FIELDS.has(normalized);
    if (entity === "artist") return USER_EDITABLE_FIELDS.has(normalized) && !BLOCKED_UPDATE_FIELDS.has(normalized.toLowerCase()) && normalized !== "artistName" && normalized !== "nomArtiste";
    if (entity === "release") return USER_EDITABLE_FIELDS.has(normalized) && !BLOCKED_UPDATE_FIELDS.has(normalized.toLowerCase()) && normalized !== "artistName" && normalized !== "nomArtiste";
    return false;
}

function parseProfileUpdateAction(rawText = "") {
    const text = String(rawText || "");

    const jsonBlockMatch = text.match(/(?:__)?MMCP(?:[_-]?)ACTION(?:[_-]?)\s*(?:[:=]\s*)?(\{[\s\S]*?\})\s*(?:\n|$)/i);
    const altMatch = text.match(/(?:__)?MMCP(?:[_-]?)ACTION(?:[_-]?)\s*[:=]\s*([\s\S]*?)(?:\n|$)/i);
    const payload = (jsonBlockMatch || altMatch)?.[1];

    if (payload) {
        try {
            const parsed = payload.trim();
            const safePayload = parsed.startsWith("{") ? parsed : `{${parsed}}`;
            const action = JSON.parse(safePayload);
            const entity = String(action.entity || "user").toLowerCase();
            const normalizedField = normalizeProfileFieldName(action.field || action.key || "");

            if (!normalizedField || !isAllowedFieldForUpdate(entity, normalizedField)) return null;

            return {
                entity,
                entityId: action.entityId || action.id || null,
                field: normalizedField,
                label: String(action.label || action.field || normalizedField),
                value: action.value ?? action.newValue ?? "",
                oldValue: action.oldValue ?? action.previousValue ?? "",
                message: action.message || ""
            };
        } catch {
            // fallback sur format pseudo-objet : entity:user,field:address,value:14 Impasse de Rhone
        }
    }

    const pseudoMatch = text.match(/(?:__)?MMCP(?:[_-]?)ACTION(?:[_-]?)\s*\{?\s*([^\n\r{}]+?)\s*\}?\s*(?:\n|$)/i);
    if (pseudoMatch) {
        const body = pseudoMatch[1];
        const pairs = {};
        body.split(",").forEach((part) => {
            const match = part.match(/([^:]+):\s*(.*)/);
            if (match) {
                const key = String(match[1]).trim();
                const value = String(match[2]).trim();
                if (key) pairs[key] = value;
            }
        });

        if (pairs.entity || pairs.field || pairs.value) {
            const entity = String(pairs.entity || "user").toLowerCase();
            const field = entity === "user" ? normalizeProfileFieldName(pairs.field || "") : String(pairs.field || "").trim();
            if (field) {
                return {
                    entity,
                    entityId: pairs.entityId || pairs.id || null,
                    field,
                    label: String(pairs.label || pairs.field || field),
                    value: pairs.value || "",
                    oldValue: pairs.oldValue || pairs.previousValue || "",
                    message: pairs.message || ""
                };
            }
        }
    }

    const lower = text.toLowerCase();
    let entity = "user";
    if (/(artiste|artist|nom de l'artiste|nom artiste)/i.test(lower)) entity = "artist";
    if (/(sortie|release|titre de la sortie|statut de la sortie)/i.test(lower)) entity = "release";

    let field = "";
    if (/(ville|city)/i.test(lower)) field = "city";
    else if (/(adresse|address)/i.test(lower)) field = "address";
    else if (/(pr[ée]nom|first name)/i.test(lower)) field = "firstName";
    else if (/(nom de famille|nom|last name|lastName)/i.test(lower)) field = "lastName";
    else if (/(nom de l'artiste|nom artiste|artist name|name of artist)/i.test(lower)) field = "artistName";
    else if (/(email|mail)/i.test(lower)) field = "email";
    else if (/(statut|status)/i.test(lower)) field = "status";
    else if (/(titre|title)/i.test(lower)) field = "title";
    else if (/(genre|primary genre|primaryGenre)/i.test(lower)) field = "primaryGenre";

    const phraseMatch = text.match(/(?:oui,?\s*)?(?:je\s+)?(?:remplace|change|renomme|mets|modifie|actualise|ajoute|le\s+fais|la\s+fais)\s+(?:.*?)(?:par|en)\s+(.+?)(?:[.!?]|$)/i);
    if (!field || !phraseMatch || !isAllowedFieldForUpdate(entity, field)) return null;

    const value = String(phraseMatch[1] || "").replace(/\s+/g, " ").trim();
    if (!value) return null;

    const labelMap = {
        city: "ville",
        address: "adresse",
        firstName: "prénom",
        lastName: "nom",
        artistName: "nom d’artiste",
        email: "e-mail",
        status: "statut",
        title: "titre",
        primaryGenre: "genre principal",
        dateSortie: "date de sortie",
        releaseDate: "date de sortie"
    };

    return {
        entity,
        entityId: null,
        field,
        label: labelMap[field] || getHumanFieldLabel(field, entity),
        value,
        oldValue: "",
        message: ""
    };
}

function renderConfirmUpdateAction(action = {}) {
    const label = String(action.label || action.field || "Champ");
    const value = String(action.value ?? "");
    const safeValue = escapeHtml(value);
    const safeLabel = escapeHtml(label);
    const payload = encodeURIComponent(JSON.stringify({
        entity: action.entity || "user",
        entityId: action.entityId || null,
        field: action.field,
        label: action.label || action.field,
        value: action.value,
        oldValue: action.oldValue || ""
    }));

    const prompt = action.message || `Voulez-vous que je remplace ${safeLabel} par <strong>${safeValue}</strong> ?`;

    return `
        <div class="profile-confirm-row">
            <div class="profile-confirm-copy">${prompt}</div>
            <button type="button" class="profile-confirm-button" data-confirm-update="${payload}">
                <span class="profile-confirm-icon">✓</span>
                <span>Confirmer</span>
            </button>
        </div>
    `;
}

function renderAiHtml(rawText) {
    let text = normalizeAiMarkdown(rawText || "");
    const buttonMap = [];
    const action = parseProfileUpdateAction(text);
    if (action) {
        state.pendingSuggestedUpdate = action;
        text = stripActionPayloadBlocks(text) || `Je mets à jour ${action.label || action.field || "ce champ"}.`;
    }

    text = text.replace(/\[\s*BOUTON\s*:\s*([^\]]+?)\s*\]\s*\(\s*([^\)]+?)\s*\)/gi, (_, label, href) => {
        const index = buttonMap.length;
        const safeLabel = String(label).trim() || "Découvrir";
        const safeHref = sanitizeLinkTarget(href);
        buttonMap.push(`<a href="${safeHref}" class="plan-button" target="_blank" rel="noopener noreferrer">${escapeHtml(safeLabel)}</a>`);
        return `__BTN_${index}__`;
    });

    text = text.replace(/\[(.+?)\]\(([^)]+)\)/g, (_, label, href) => {
        const index = buttonMap.length;
        const safeLabel = String(label).trim() || "Découvrir";
        const safeHref = sanitizeLinkTarget(href);
        buttonMap.push(`<a href="${safeHref}" class="plan-button" target="_blank" rel="noopener noreferrer">${escapeHtml(safeLabel)}</a>`);
        return `__BTN_${index}__`;
    });

    text = text.replace(/(https?:\/\/[^\s)]+|\/[A-Za-z0-9_./?&=-]+)/gi, (match) => {
        if (match.includes("__BTN_")) return match;
        const index = buttonMap.length;
        const safeHref = sanitizeLinkTarget(match);
        buttonMap.push(`<a href="${safeHref}" class="plan-button" target="_blank" rel="noopener noreferrer">Découvrir</a>`);
        return `__BTN_${index}__`;
    });

    const blocks = text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
    const renderedBlocks = blocks.map((block) => {
        const trimmed = block.trim();
        const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
        if (headingMatch) {
            const level = headingMatch[1].length;
            return `<h${level}>${formatInlineMarkdown(headingMatch[2])}</h${level}>`;
        }

        const bulletLines = trimmed.split(/\n/).map((line) => line.trim());
        if (bulletLines.every((line) => /^[-*+]\s+/.test(line))) {
            const items = bulletLines.map((line) => `<li>${formatInlineMarkdown(line.replace(/^[-*+]\s+/, ""))}</li>`).join("");
            return `<ul>${items}</ul>`;
        }

        const numberedLines = trimmed.split(/\n/).map((line) => line.trim());
        if (numberedLines.every((line) => /^\d+\.\s+/.test(line))) {
            const items = numberedLines.map((line) => `<li>${formatInlineMarkdown(line.replace(/^\d+\.\s+/, ""))}</li>`).join("");
            return `<ol>${items}</ol>`;
        }

        return `<p>${formatInlineMarkdown(trimmed)}</p>`;
    });

    let html = renderedBlocks.join("");
    html = html.replace(/__BTN_(\d+)__/g, (_, index) => buttonMap[Number(index)] || "");
    return html;
}

function isConfirmationPhrase(text = "") {
    const value = String(text || "").trim().toLowerCase();
    if (!value) return false;
    return /(confirme|je confirme|je valide|valide|c'est bon|parfait|je veux vraiment|oui,? je confirme)/i.test(value);
}

function parseDirectUpdateIntent(text = "") {
    const raw = String(text || "").trim();
    if (!raw) return null;
    if (isConfirmationPhrase(raw)) return null;

    const lower = raw.toLowerCase();
    const hasCommand = /(modifie|modifier|change|changer|mets|mettre|remplace|remplacer|actualise|actualiser|ajuste|ajuster)/i.test(lower);
    if (!hasCommand) return null;

    let entity = "user";
    if (/(sortie|release|album|single|ep)/i.test(lower)) entity = "release";
    else if (/(artiste|artist|nom d'artiste|stage name)/i.test(lower)) entity = "artist";

    let field = "";
    if (/(date de sortie|date sortie|sortie le|sortie au|sortie du|release date|date de publication)/i.test(lower)) field = "dateSortie";
    else if (/(ville|city)/i.test(lower)) field = "city";
    else if (/(adresse|address)/i.test(lower)) field = "address";
    else if (/(prenom|prénom|first name)/i.test(lower)) field = "firstName";
    else if (/(nom|last name|family name)/i.test(lower)) field = "lastName";
    else if (/(email|mail)/i.test(lower)) field = "email";
    else if (/(titre|title)/i.test(lower)) field = "title";
    else if (/(genre|primary genre)/i.test(lower)) field = "primaryGenre";
    else if (/(description|bio)/i.test(lower)) field = "description";

    if (!field) return null;

    const targetDateMatch = raw.match(/(\d{1,2}\s*(?:janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s*\d{4}|\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})/i);
    const value = targetDateMatch ? targetDateMatch[0] : raw.match(/(?:par|en|à)\s+(.+)/i)?.[1]?.trim() || "";
    if (!value) return null;

    return {
        entity,
        field,
        label: getHumanFieldLabel(field, entity),
        value: value.replace(/^au\s+/i, "").replace(/^le\s+/i, "").replace(/^la\s+/i, "").trim(),
        oldValue: "",
        message: "",
        direct: true
    };
}

async function applyUpdateAction(action = {}, { silent = false } = {}) {
    const entity = String(action.entity || "user").toLowerCase();
    const field = entity === "user"
        ? normalizeProfileFieldName(action.field || "")
        : String(action.field || "").trim();
    const value = action.value ?? "";
    if (!field || !state.user?.uid || !isAllowedFieldForUpdate(entity, field)) {
        if (!silent) alert("Ce champ ne peut pas être modifié depuis Litual.");
        return false;
    }

    if (state.pendingSuggestedUpdate && String(state.pendingSuggestedUpdate.field || "") === String(field) && String(state.pendingSuggestedUpdate.entity || "user") === String(entity)) {
        state.pendingSuggestedUpdate = null;
    }

    try {
        const displayLabel = getHumanFieldLabel(field, entity);
        if (state.activeConversationId) {
            const conversation = getConversationById(state.activeConversationId);
            const stageMessage = `Je mets à jour ${displayLabel} en ${value}.`;
            const savedStage = await saveMessage(state.activeConversationId, "assistant", stageMessage);
            if (conversation) {
                if (!Array.isArray(conversation.messages)) conversation.messages = [];
                conversation.messages.push({
                    id: savedStage.id,
                    role: "assistant",
                    content: stageMessage,
                    created_at: savedStage.created_at || new Date().toISOString()
                });
                conversation.updated_at = new Date().toISOString();
            }
        }

        if (entity === "artist") {
            const artistId = action.entityId || state.artists?.[0]?.id;
            if (!artistId) throw new Error("Aucun artiste sélectionné pour cette modification.");
            await api.patch(`/api/users/${state.user.uid}/artists/${artistId}`, { [field]: value });
        } else if (entity === "release") {
            const releaseId = action.entityId || state.releases?.[0]?.id;
            if (!releaseId) throw new Error("Aucune sortie sélectionnée pour cette modification.");
            await api.patch(`/api/users/${state.user.uid}/releases/${releaseId}`, { [field]: value });
        } else {
            await api.patch(`/api/users/${state.user.uid}`, { [field]: value });
            if (state.profile) {
                state.profile[field] = value;
            }
        }

        if (state.activeConversationId) {
            const conversation = getConversationById(state.activeConversationId);
            const messageText = `✅ ${displayLabel} a été mis à jour : ${value}.`;
            const saved = await saveMessage(state.activeConversationId, "assistant", messageText);
            if (conversation) {
                if (!Array.isArray(conversation.messages)) conversation.messages = [];
                conversation.messages.push({
                    id: saved.id,
                    role: "assistant",
                    content: messageText,
                    created_at: saved.created_at || new Date().toISOString()
                });
                conversation.updated_at = new Date().toISOString();
                renderConversationList();
                renderConversationMessages();
            }
        }
        return true;
    } catch (error) {
        if (!silent) alert(error?.message || "Impossible de modifier ce champ.");
        return false;
    }
}

async function confirmProfileUpdate(action = {}) {
    const entity = String(action.entity || "user").toLowerCase();
    const field = entity === "user"
        ? normalizeProfileFieldName(action.field || "")
        : String(action.field || "").trim();
    const value = action.value ?? "";
    if (!field || !state.user?.uid || !isAllowedFieldForUpdate(entity, field)) {
        alert("Ce champ ne peut pas être modifié depuis Litual.");
        return;
    }

    const encoded = encodeURIComponent(JSON.stringify({
        entity,
        entityId: action.entityId || null,
        field: action.field,
        label: action.label || action.field,
        value: action.value,
        oldValue: action.oldValue || ""
    }));

    const button = document.querySelector("[data-confirm-update='" + encoded + "']");

    if (button) {
        button.disabled = true;
        button.setAttribute("aria-disabled", "true");
        button.dataset.confirmed = "true";
        button.innerHTML = '<span class="profile-confirm-icon">✓</span><span>Confirmé</span>';
        button.classList.add("confirmed");
    }

    const ok = await applyUpdateAction({ ...action, field, value }, { silent: true });
    if (!ok && button) {
        button.disabled = false;
        button.innerHTML = '<span class="profile-confirm-icon">✓</span><span>Veuillez confirmer</span>';
        button.classList.remove("confirmed");
    }
}

function appendMessage(role, content, markdown = false) {
    const wrapper = document.createElement("div");
    wrapper.className = `msg ${role}`;

    if (markdown) {
        wrapper.innerHTML = renderAiHtml(content || "");
    } else {
        wrapper.textContent = content || "";
    }

    const confirmButton = wrapper.querySelector(".profile-confirm-button");
    if (confirmButton) {
        if (confirmButton.dataset.confirmed === "true") {
            confirmButton.disabled = true;
            confirmButton.setAttribute("aria-disabled", "true");
            confirmButton.innerHTML = '<span class="profile-confirm-icon">✓</span><span>Confirmé</span>';
            confirmButton.classList.add("confirmed");
        }

        confirmButton.addEventListener("click", async () => {
            if (confirmButton.dataset.confirmed === "true" || confirmButton.disabled) return;
            const raw = confirmButton.getAttribute("data-confirm-update");
            if (!raw) return;
            try {
                const action = JSON.parse(decodeURIComponent(raw));
                await confirmProfileUpdate(action);
            } catch {
                alert("Action de confirmation invalide.");
            }
        });
    }

    chatMessages.appendChild(wrapper);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return wrapper;
}

function getDirectAccountAnswer(messageText = "") {
    const text = String(messageText || "").trim().toLowerCase();
    if (!text) return null;

    const asksForCount = /(combien|nombre|total|quantité|quand|quel nombre)/i.test(text);
    const mentionsPortfolio = /(portefeuille|portfolio|sortie|sorties|profil)/i.test(text);

    if (!asksForCount || !mentionsPortfolio) return null;

    const releaseCount = Array.isArray(state.releases) ? state.releases.length : 0;
    return `Tu as ${releaseCount} sortie${releaseCount > 1 ? "s" : ""} dans ton portefeuille.`;
}

function renderThinkingIndicator(mode = "general") {
    const messages = {
        general: "Litual réfléchit",
        sorties: "Litual regarde dans vos sorties",
        compte: "Litual regarde dans les informations de votre compte",
        revenus: "Litual regarde vos revenus"
    };

    const wrapper = document.createElement("div");
    wrapper.className = "msg ai thinking-indicator";
    wrapper.innerHTML = `
        <div class="thinking-row">
            <img src="/assets/img/litual/litual-logo.png" class="litual-loader" alt="Litual" />
            <span class="thinking-text">${messages[mode] || messages.general}</span>
        </div>
    `;
    chatMessages.appendChild(wrapper);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return wrapper;
}

function getConversationById(conversationId) {
    return state.conversations.find((conv) => String(conv.id) === String(conversationId)) || null;
}

function syncCurrentTitle() {
    const conversation = getConversationById(state.activeConversationId);
    currentConversationTitle.textContent = getConversationTitle(conversation || { title: "Nouvelle conversation" });
}

function maybeShowConversationBadge(conversation = null) {
    const active = conversation || getConversationById(state.activeConversationId);
    if (!active) {
        conversationNameBadge.classList.add("hidden");
        return;
    }

    const key = `litual_title_badge_${active.id}`;
    if (sessionStorage.getItem(key) === "seen") {
        conversationNameBadge.classList.add("hidden");
        return;
    }

    conversationNameBadge.textContent = `Nom de la conversation : ${getConversationTitle(active)}`;
    conversationNameBadge.classList.remove("hidden");
    sessionStorage.setItem(key, "seen");
}

function renderEmptyState(message = "Commencez par votre premier message.") {
    chatMessages.innerHTML = `<div class="empty-state">${message}</div>`;
}

function renderConversationMessages() {
    const conversation = getConversationById(state.activeConversationId);
    syncCurrentTitle();

    if (!conversation || !Array.isArray(conversation.messages) || !conversation.messages.length) {
        renderEmptyState();
        return;
    }

    chatMessages.innerHTML = "";
    conversation.messages.forEach((message) => {
        const role = message.role === "assistant" ? "ai" : "user";
        appendMessage(role, message.content || "", role === "ai");
    });

    if (conversation.messages.length === 1 && !sessionStorage.getItem(`litual_title_badge_${conversation.id}`)) {
        maybeShowConversationBadge(conversation);
    }
}

function serializeAccountContext() {
    const profile = state.profile || {};
    const artists = Array.isArray(state.artists) ? state.artists : [];
    const releases = Array.isArray(state.releases) ? state.releases : [];
    const tracks = Array.isArray(state.tracks) ? state.tracks : [];
    const plays = Array.isArray(state.plays) ? state.plays : [];
    const tracklists = Array.isArray(state.tracklists) ? state.tracklists : [];
    const events = Array.isArray(state.events) ? state.events : [];
    const freeboard = Array.isArray(state.freeboard) ? state.freeboard : [];
    const payouts = Array.isArray(state.payouts) ? state.payouts : [];
    const withdrawals = Array.isArray(state.withdrawals) ? state.withdrawals : [];
    const reviews = Array.isArray(state.reviews) ? state.reviews : [];
    const supportTickets = Array.isArray(state.supportTickets) ? state.supportTickets : [];

    const artistPayload = artists.map((artist, index) => {
        const artistName = artist?.name || artist?.artistName || artist?.nomArtiste || `Artiste ${index + 1}`;
        const artistReleases = Array.isArray(artist?.releases)
            ? artist.releases.map((release) => ({
                title: release?.title || release?.name || release?.releaseName || release?.nom || "Sortie",
                type: release?.type || release?.releaseType || "",
                status: release?.status || release?.releaseStatus || "",
                date: release?.date || release?.releaseDate || release?.publishedAt || ""
            }))
            : [];

        return {
            name: artistName,
            primaryGenre: artist?.primaryGenre || artist?.genre || "",
            feat: artist?.feat || artist?.featured || "",
            releases: artistReleases
        };
    });

    const allReleases = releases.map((release) => ({
        title: release?.title || release?.name || release?.releaseName || release?.nom || "Sortie",
        type: release?.type || release?.releaseType || "",
        status: release?.status || release?.releaseStatus || "",
        artistName: release?.artistName || release?.artist_name || release?.artist || "",
        date: release?.date || release?.releaseDate || release?.publishedAt || ""
    }));

    return {
        user: {
            uid: state.user?.uid || profile.uid || null,
            fullName: profile?.fullName || [profile?.firstName || profile?.prenom, profile?.lastName || profile?.nom].filter(Boolean).join(" ") || "",
            firstName: profile?.firstName || profile?.prenom || "",
            lastName: profile?.lastName || profile?.nom || profile?.familyName || "",
            artistName: profile?.artistName || profile?.nomArtiste || profile?.stageName || profile?.artist_name || "",
            email: profile?.email || state.user?.email || "",
            city: profile?.city || profile?.ville || profile?.location || "",
            address: profile?.address || profile?.adresse || profile?.streetAddress || "",
            phone: profile?.phone || profile?.telephone || "",
            planName: profile?.planName || profile?.plan || ""
        },
        artists: artistPayload,
        releases: allReleases,
        tracks: tracks,
        plays: plays,
        tracklists: tracklists,
        events: events,
        freeboard: freeboard,
        payouts: payouts,
        withdrawals: withdrawals,
        reviews: reviews,
        supportTickets: supportTickets
    };
}

function formatReleaseSummary(release = {}) {
    const title = release.title || release.name || release.releaseName || release.nom || "Sortie";
    const type = release.type || release.releaseType || "";
    const rawDate = release.date || release.releaseDate || release.publishedAt || "";
    const formattedDate = rawDate ? new Date(rawDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "date non renseignée";
    return `${title}${type ? ` (${type})` : ""} — ${formattedDate}`;
}

function getSiteKnowledgeSummary() {
    return `CONNAISSANCES SITE MORGANN MUSIC CP :

Identité du groupe et des services :
- Morgann Music Platforms est le groupe / marque globale.
- Morgann Dev CP est la branche technique / produit / développement.
- Morgann Music CP est la branche de production musicale et de distribution.
- Litual est l'assistant IA de Litual, intégré dans le service Morgann Music CP.
- Litual AI aide les artistes dans leur quotidien, leur stratégie, leur présence et la gestion de leurs sorties.

Principales fonctionnalités et services de Morgann Music CP :
- Distribution mondiale sur 478 plateformes de streaming et de diffusion numérique.
- Diffusion sur Spotify, Apple Music, TikTok, Deezer, Amazon Music, Tidal, YouTube Music, Instagram/Facebook et autres plateformes majeures.
- Prise en charge de la distribution de singles, EP, albums, contenus multimédia et sorties complètes.
- Publication de musiques avec métadonnées, titres, artistes, visuels, fichiers audio et éléments de marketing.
- Intégration de la qualité audio haut de gamme : Dolby Atmos, Spatial Audio, Apple Digital Master, Lossless, qualité studio.
- Apple Motion Artwork / pochettes animées sur Apple Music.
- Content ID YouTube inclus pour protéger les œuvres et leurs droits d'auteur.
- Dashboard et compte artiste dans le portail pour gérer profil, sorties, fichiers, visuels, liens, promotions.
- Gestion des sorties : création, édition, publication, dates de sortie, statut, catégories et informations de diffusion.
- Gestion des artistes : fiches artistes, profils, informations, réseaux sociaux, liens, parcours, identité visuelle.
- Gestion des revenus : suivi de revenus, royalties, retraits, finance, historique et dashboard financier.
- Gestion de la performance : statistiques, écoute, performances, analyses, suivis d'activité et indicateurs de lecture.
- Outils de diffusion : smartlinks, liens de sorties, partage public, liens de lecture et mise en avant.
- Outil Première : sécuriser une sortie avant sa publication avec page privée, mot de passe, date de début / fin, visuel premium et lecture exclusive.
- Fonctionnalités de promotion et de mise en avant : visibilité, lancement, présentation des sorties, contenus artistiques et marketing.
- Offre Future Légende pour les moins de 18 ans : 0,99 €/mois, distribution, Dolby Atmos, outils IA, accompagnement, support, commission réduite.
- Formules accessibles : Future Légende, Starter, Pro, Label, Marque Blanche.
- Transparence tarifaire : abonnement mensuel ou paiement à la sortie selon les offres.
- Valeur clé du service : garder le contrôle artistique, les droits, la liberté, la simplicité et une structure professionnelle.

Pages du site Morgann Music CP à connaître :
- Accueil /index.html : message principal, valeurs, positionnement, présence sur 478 plateformes, Dolby Atmos, Litual AI.
- Distribution /distribution.html : distribution mondiale, workflow 4 étapes, revenus, sécurité, diffusion sur les plateformes, portail artiste.
- Tarifs /tarifs.html : abonnements mensuels, plans Future Légende, Starter, Pro, Label, Marque Blanche.
- Pourquoi-nous /pourquoi-nous.html : Dolby Atmos gratuit, Content ID, Motion Artwork, prix bas, accessibilité, offre jeunesse.
- Première /premiere.html : outil exclusif pour teasers et avant-premières, liens privés, dates d'ouverture / fermeture, mot de passe, écrin premium.
- Catalogue /catalogue/index.html /catalogue/sorties.html /catalogue/artistes.html /catalogue/dernierement.html /catalogue/prochainement.html : catalogue global, sorties, artistes, nouveautés, prochaines sorties.
- Portail artiste /portail/index.html /portail/profil.html /portail/sorties.html /portail/nouvelle.html /portail/edition.html /portail/mes-revenus.html /portail/retraits.html /portail/liens-sorties.html /portail/notification.html /portail/outils.html : espace personnel d'un artiste.
- Label /label/index.html /label/label.html /label/portail.html /label/artistes.html /label/sorties.html /label/mes-revenus.html /label/retraits.html : espace label / dashboard label.
- Contact /contact.html : support, contact, demande d'information, assistance.
- Avis /avis.html : retours d'utilisateurs / satisfaction.
- Développement /developpement.html : services de développement, UX, produits, accompagnement, outils de gestion.
- Version /version.html : historique et évolution du site produit.
- Pays /pays.html : liste des pays et territoires de diffusion.
- Plateformes /plateformes.html : liste des plateformes de streaming et de diffusion.
- Login /login.html et Inscription /signin.html : accès au service.
- Compte /account.html : gestion du compte.
- Mentions légales /mentions-legales.html, CGU /cgu.html, CGV /cgv.html, confidentialité /politique-confidentialite.html, cookies /cookies.html : cadre légal et RGPD.
- Plan du site /sitemap.html : vue d'ensemble des pages du site.

Règle clé : si tu parles du service Morgann Music CP, tu dois le faire dans son cadre global, avec les informations ci-dessus, sans inventer de fonctionnalités non présentes sur le site ni oublier les modules clés du produit.

Tu ne dois jamais parler comme un assistant générique de l'IA. Tu dois parler comme Litual, assistant IA de Morgann Music CP, au service des artistes et de leur activité musicale sur la plateforme de Morgann Music Platforms.
`;
}

function buildSystemInstruction() {
    const context = serializeAccountContext();
    const user = context.user || {};
    const artistNames = context.artists.map((artist) => artist.name).filter(Boolean);
    const releaseList = context.releases.length ? context.releases.map(formatReleaseSummary) : ["Aucune sortie enregistrée"];
    const siteKnowledge = getSiteKnowledgeSummary();

    return `Tu es Litual, l'assistant IA de Morgann Music CP.

Tu es Litual AI, la branche d'intelligence artificielle de Litual, créée par Morgann Dev CP, la branche technique et produit de Morgann Music Platforms.
Tu es intégré au service Morgann Music CP, la branche de production musicale de Morgann Music Platforms.

Ton rôle : conseiller les artistes, accompagner leurs sorties, aider à leur stratégie de promotion, répondre à leurs questions sur leur compte, leurs projets, leurs sorties, leur visibilité et leur suivi de publication.

${siteKnowledge}

Tu dois répondre uniquement à partir des données du compte connecté, de ses artistes et de ses sorties.

CONTEXT COMPTE (utilisable uniquement pour répondre) :
- Nom complet : ${user.fullName || "Non renseigné"}
- Prénom : ${user.firstName || "Non renseigné"}
- Nom : ${user.lastName || "Non renseigné"}
- Email : ${user.email || "Non renseigné"}
- Nom d'artiste : ${user.artistName || "Non renseigné"}
- Ville : ${user.city || "Non renseignée"}
- Adresse : ${user.address || "Non renseignée"}
- Plan : ${user.planName || "Non renseigné"}
- Artistes du compte : ${artistNames.length ? artistNames.join(", ") : "Aucun artiste enregistré"}
- Sorties du compte : ${releaseList.join(" ; ")}
- Titres du compte : ${Array.isArray(context.tracks) && context.tracks.length ? context.tracks.map((track) => track?.title || track?.name || "Titre inconnu").slice(0, 20).join(" ; ") : "Aucun titre enregistré"}
- Lectures / performances du compte : ${Array.isArray(context.plays) && context.plays.length ? context.plays.slice(0, 10).map((play) => `${play?.platform || "Plateforme"}: ${play?.play_count ?? play?.playCount ?? 0}`).join(" ; ") : "Aucune donnée de lecture"}
- Tracklists du compte : ${Array.isArray(context.tracklists) && context.tracklists.length ? JSON.stringify(context.tracklists.slice(0, 2)) : "Aucune tracklist"}
- Événements du compte : ${Array.isArray(context.events) && context.events.length ? JSON.stringify(context.events.slice(0, 2)) : "Aucun événement"}
- Freeboard / infos outils du compte : ${Array.isArray(context.freeboard) && context.freeboard.length ? JSON.stringify(context.freeboard.slice(0, 2)) : "Aucun freeboard"}
- Revenus du compte : ${Array.isArray(context.payouts) && context.payouts.length ? JSON.stringify(context.payouts.slice(0, 5)) : "Aucun revenu enregistré"}
- Retraits du compte : ${Array.isArray(context.withdrawals) && context.withdrawals.length ? JSON.stringify(context.withdrawals.slice(0, 5)) : "Aucun retrait enregistré"}
- Avis du compte / accueil : ${Array.isArray(context.reviews) && context.reviews.length ? JSON.stringify(context.reviews.slice(0, 5)) : "Aucun avis"}
- Tickets support du compte et réponses associées : ${Array.isArray(context.supportTickets) && context.supportTickets.length ? JSON.stringify(context.supportTickets.slice(0, 5)) : "Aucun ticket support"}

RÈGLES DE RÉPONSE OBLIGATOIRES :
1. Tu ne parles que du compte connecté, de ses artistes et de ses sorties.
2. Les seules sorties que tu peux citer sont celles listées dans "Sorties du compte uniquement". N'invente jamais, n'extrapole jamais et ne prends jamais des informations extérieures.
3. N'affiche jamais le JSON brut du compte, ni un objet complet, ni une structure technique de données.
4. Tu ne dois pas réécrire en clair toute la base du profil, l'adresse, la ville, le nom, le prénom ou les sorties dans la réponse si l'utilisateur ne le demande pas explicitement.
5. Ne donne jamais de synthèse spontanée de revenus, montants, retraits, gains, performances ou historique de compte si l'utilisateur ne demande pas explicitement un total, un montant précis, un détail par période ou une comparaison. Si la demande n'est pas claire, demande une précision au lieu d'exposer des chiffres.
6. Si l'utilisateur demande une modification de profil, d'artiste ou de sortie, propose uniquement la modification souhaitée, en français, à la première personne, sans jamais exposer un bloc technique ni un JSON brut.
7. Ne jamais afficher, écrire ou révéler un payload technique de type MMCP_ACTION, JSON interne, field mapping, ou structure de confirmation dans la réponse visible.
8. Si une modification est demandée, applique-la directement en français naturel et confirme simplement le résultat sans demander un "ok" ou une validation générique.
9. Si l'utilisateur demande des infos de compte, réponds de manière utile et concise, sans exposer la structure JSON ni les détails internes du système.
10. Réponds en français, professionnel, clair et orienté stratégie/artistes/sorties.
11. Si la demande sort du périmètre du compte, réponds simplement que tu peux aider uniquement sur les données du compte, des artistes et des sorties de cet utilisateur.
12. Ne propose jamais un abonnement, tarif ou souscription.
13. Si tu donnes un lien, utilise exactement la syntaxe [BOUTON:Texte du bouton](url).
14. N'inclus pas de texte technique, d'exemples de JSON, ni de données auxiliaires dans ta réponse finale.
15. Conserve le ton naturel d'un assistant de compte, sans te présenter à chaque message ni répéter ces règles.
`;
}

function renderConversationList() {
    conversationList.innerHTML = "";

    if (!state.conversations.length) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent = "Aucune conversation";
        conversationList.appendChild(empty);
        return;
    }

    state.conversations.forEach((conversation) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = `conversation-item ${String(conversation.id) === String(state.activeConversationId) ? "active" : ""}`;

        const mainBlock = document.createElement("div");
        mainBlock.className = "conversation-main";

        const title = document.createElement("span");
        title.className = "conversation-name";
        title.textContent = getConversationTitle(conversation);

        const meta = document.createElement("span");
        meta.className = "conversation-meta";
        const date = conversation.updated_at ? new Date(conversation.updated_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) : "Aujourd'hui";
        meta.textContent = `Modifiée le ${date}`;

        mainBlock.appendChild(title);
        mainBlock.appendChild(meta);

        const renameAction = document.createElement("button");
        renameAction.type = "button";
        renameAction.className = "conversation-action";
        renameAction.textContent = "✎";
        renameAction.title = "Renommer cette conversation";
        renameAction.addEventListener("click", async (event) => {
            event.stopPropagation();
            const value = window.prompt("Renommer la conversation", getConversationTitle(conversation));
            if (!value || !value.trim()) return;
            try {
                await api.patch(`/api/users/${state.user.uid}/litual-conversations/${conversation.id}`, { title: value.trim() });
                conversation.title = value.trim();
                conversation.updated_at = new Date().toISOString();
                renderConversationList();
                syncCurrentTitle();
            } catch (error) {
                alert(error.message || "Erreur lors du renommage.");
            }
        });

        item.addEventListener("click", async () => {
            state.activeConversationId = String(conversation.id);
            const active = getConversationById(state.activeConversationId);
            if (active) {
                const updated = await api.get(`/api/users/${state.user.uid}/litual-conversations/${state.activeConversationId}`);
                const index = state.conversations.findIndex((entry) => String(entry.id) === String(state.activeConversationId));
                if (index >= 0) state.conversations[index] = updated;
            }
            renderConversationList();
            renderConversationMessages();
            closeSidebarOnMobile();
        });

        item.appendChild(mainBlock);
        item.appendChild(renameAction);
        conversationList.appendChild(item);
    });
}

async function loadUserData(user) {
    const [profileResult, artistsResult, releasesResult, tracksResult, playsResult, tracklistsResult, eventsResult, freeboardResult, financesResult, withdrawalsResult, reviewsResult, supportTicketsResult] = await Promise.allSettled([
        api.get(`/api/users/${user.uid}`),
        api.get(`/api/users/${user.uid}/artists`),
        api.get(`/api/users/${user.uid}/releases`),
        api.get(`/api/users/${user.uid}/tracks`),
        api.get(`/api/users/${user.uid}/plays`),
        api.get(`/api/users/${user.uid}/tracklists`),
        api.get(`/api/users/${user.uid}/events`),
        api.get(`/api/users/${user.uid}/freeboard`),
        api.get(`/api/users/${user.uid}/finances`),
        api.get(`/api/users/${user.uid}/payouts`),
        api.get("/api/reviews"),
        api.get("/api/support/tickets")
    ]);

    if (profileResult.status === "fulfilled") state.profile = profileResult.value || {};
    if (artistsResult.status === "fulfilled") state.artists = Array.isArray(artistsResult.value) ? artistsResult.value : [];
    if (releasesResult.status === "fulfilled") state.releases = Array.isArray(releasesResult.value) ? releasesResult.value : [];
    if (tracksResult.status === "fulfilled") state.tracks = Array.isArray(tracksResult.value) ? tracksResult.value : [];
    if (playsResult.status === "fulfilled") state.plays = Array.isArray(playsResult.value) ? playsResult.value : [];
    if (tracklistsResult.status === "fulfilled") state.tracklists = Array.isArray(tracklistsResult.value) ? tracklistsResult.value : [];
    if (eventsResult.status === "fulfilled") state.events = Array.isArray(eventsResult.value) ? eventsResult.value : [];
    if (freeboardResult.status === "fulfilled") state.freeboard = Array.isArray(freeboardResult.value) ? freeboardResult.value : [];
    if (financesResult.status === "fulfilled") state.payouts = Array.isArray(financesResult.value) ? financesResult.value : [];
    if (withdrawalsResult.status === "fulfilled") state.withdrawals = Array.isArray(withdrawalsResult.value) ? withdrawalsResult.value : [];
    if (reviewsResult.status === "fulfilled") {
        const allReviews = Array.isArray(reviewsResult.value) ? reviewsResult.value : [];
        state.reviews = allReviews.filter((review) => {
            const uid = String(review?.user_uid || review?.userUid || review?.uid || "");
            const email = String(review?.email || review?.user_email || "");
            return uid === String(user.uid) || email === String(user.email || "");
        });
    }
    if (supportTicketsResult.status === "fulfilled") {
        const allTickets = Array.isArray(supportTicketsResult.value) ? supportTicketsResult.value : [];
        state.supportTickets = allTickets.filter((ticket) => {
            const uid = String(ticket?.uid || ticket?.userUid || "");
            const email = String(ticket?.user_email || ticket?.email || "");
            return uid === String(user.uid) || email === String(user.email || "");
        }).map((ticket) => ({
            ...ticket,
            messages: Array.isArray(ticket?.messages) ? ticket.messages : (() => {
                try { return JSON.parse(ticket?.messages || "[]"); } catch { return []; }
            })(),
            payload: ticket?.payload && typeof ticket.payload === "string" ? (() => { try { return JSON.parse(ticket.payload); } catch { return ticket.payload; } })() : ticket?.payload || {}
        }));
    }

    if (!state.profile || Object.keys(state.profile).length === 0) {
        state.profile = { firstName: user.displayName || "", email: user.email || "" };
    }
}

async function loadConversations() {
    if (!state.user) return;

    console.log("[Litual] loadConversations start", { uid: state.user.uid, activeConversationId: state.activeConversationId });

    try {
        const rows = await api.get(`/api/users/${state.user.uid}/litual-conversations`);
        state.conversations = Array.isArray(rows) ? rows : [];
        console.log("[Litual] conversations loaded from API", state.conversations.length, state.conversations.map((conv) => ({ id: conv.id, title: conv.title })));
    } catch (error) {
        console.error("Erreur chargement conversations:", error);
        state.conversations = [];
    }

    if (state.activeConversationId) {
        const match = state.conversations.find((conv) => String(conv.id) === String(state.activeConversationId));
        if (!match) {
            try {
                const conv = await api.get(`/api/users/${state.user.uid}/litual-conversations/${state.activeConversationId}`);
                state.conversations.unshift(conv);
                console.log("[Litual] active conversation restored from D1", conv.id);
            } catch (error) {
                console.error("Erreur chargement conversation active:", error);
            }
        }
    }

    renderConversationList();
    renderConversationMessages();
}

async function sendToLitual(history) {
    const response = await fetch("https://litual.api.worker.mm-cp.uk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            messages: history,
            instruction: buildSystemInstruction(),
            context: serializeAccountContext()
        })
    });

    if (!response.ok) {
        throw new Error("Le service Litual est indisponible pour le moment.");
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Aucune réponse IA reçue.");

    const decoder = new TextDecoder();
    let finalText = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const parts = chunk.split("data: ").filter(Boolean);

        for (const part of parts) {
            const trimmed = part.trim();
            if (!trimmed || trimmed === "[DONE]") continue;

            try {
                const json = JSON.parse(trimmed);
                if (json.response) finalText += json.response;
                else if (json.text) finalText += json.text;
                else if (json.token) finalText += json.token;
            } catch {
                if (!trimmed.startsWith("{") && !trimmed.includes("\"usage\"")) {
                    finalText += trimmed;
                }
            }
        }
    }

    return finalText.trim();
}

async function saveMessage(conversationId, role, content) {
    return api.post(`/api/users/${state.user.uid}/litual-conversations/${conversationId}/messages`, {
        role,
        content
    });
}

async function sendConversationMessage(messageText, { isFirstMessage = false } = {}) {
    if (!state.user || !state.activeConversationId) return;

    const conversation = getConversationById(state.activeConversationId);
    if (!conversation) return;

    if (!Array.isArray(conversation.messages)) conversation.messages = [];

    const history = [
        ...buildConversationHistoryContext(state.activeConversationId),
        ...conversation.messages.map((entry) => ({
            role: entry.role,
            content: stripActionPayloadBlocks(entry.content)
        }))
    ];

    if (isFirstMessage) {
        if (!history.some((entry) => entry.role === "user" && entry.content === messageText)) {
            history.push({ role: "user", content: messageText });
        }
    }

    const searchMode = /sorti|sorties|release|album|single|ep|titre|catalogue/i.test(messageText)
        ? "sorties"
        : /revenu|revenus|finance|finances|argent|payout|retrait|withdraw|paiement|solde/i.test(messageText)
            ? "revenus"
            : /compte|profil|adresse|ville|email|info|information|artiste|identité|contact/i.test(messageText)
                ? "compte"
                : "general";

    const responseMessage = renderThinkingIndicator(searchMode);
    sendButton.disabled = true;
    sendButton.textContent = "Chargement…";

    try {
        const responseText = await sendToLitual(history);
        const action = parseProfileUpdateAction(responseText);
        if (action) {
            await applyUpdateAction(action, { silent: true });
            conversation.updated_at = new Date().toISOString();
            renderConversationList();
            renderConversationMessages();
            maybeShowConversationBadge(conversation);
            responseMessage.remove();
            return;
        }

        const cleanAssistantText = stripActionPayloadBlocks(responseText) || responseText;
        const savedMessage = await saveMessage(state.activeConversationId, "assistant", cleanAssistantText);

        conversation.messages.push({
            id: savedMessage.id,
            role: "assistant",
            content: cleanAssistantText,
            created_at: savedMessage.created_at || new Date().toISOString()
        });

        conversation.updated_at = new Date().toISOString();
        renderConversationList();
        renderConversationMessages();
        maybeShowConversationBadge(conversation);
        responseMessage.remove();
    } catch (error) {
        responseMessage.textContent = error?.message || "Une erreur est survenue.";
    } finally {
        sendButton.disabled = false;
        sendButton.textContent = "Envoyer";
    }
}

async function handleSubmit(event) {
    event.preventDefault();
    const messageText = userInput.value.trim();
    if (!messageText) return;

    state.pendingSuggestedUpdate = null;

    if (state.activeConversationId) {
        const conversation = getConversationById(state.activeConversationId);
        if (conversation) {
            if (!Array.isArray(conversation.messages)) conversation.messages = [];
            await saveMessage(state.activeConversationId, "user", messageText);
            conversation.messages.push({
                id: Date.now(),
                role: "user",
                content: messageText,
                created_at: new Date().toISOString()
            });
            conversation.updated_at = new Date().toISOString();
            renderConversationMessages();
        }
    }

    const directUpdate = parseDirectUpdateIntent(messageText);
    if (directUpdate) {
        const ok = await applyUpdateAction(directUpdate, { silent: false });
        userInput.value = "";
        userInput.style.height = "52px";
        if (ok) return;
    }

    const directAnswer = getDirectAccountAnswer(messageText);

    if (!state.activeConversationId) {
        const title = generateConversationTitle(messageText);
        const created = await api.post(`/api/users/${state.user.uid}/litual-conversations`, {
            title,
            first_message: messageText
        });

        state.activeConversationId = String(created.id);
        state.conversations = [created, ...state.conversations.filter((conv) => String(conv.id) !== String(created.id))];

        const params = new URLSearchParams(window.location.search);
        params.set("conv", String(created.id));
        window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);

        userInput.value = "";
        userInput.style.height = "52px";
        renderConversationList();
        renderConversationMessages();

        sessionStorage.removeItem("litual_pending_prompt");
        await sendConversationMessage(messageText, { isFirstMessage: true });
        return;
    }

    const conversation = getConversationById(state.activeConversationId);
    if (!conversation) return;

    userInput.value = "";
    userInput.style.height = "52px";
    renderConversationMessages();

    if (directAnswer) {
        const saved = await saveMessage(state.activeConversationId, "assistant", directAnswer);
        if (!Array.isArray(conversation.messages)) conversation.messages = [];
        conversation.messages.push({
            id: saved.id,
            role: "assistant",
            content: directAnswer,
            created_at: saved.created_at || new Date().toISOString()
        });
        conversation.updated_at = new Date().toISOString();
        renderConversationList();
        renderConversationMessages();
        return;
    }

    await sendConversationMessage(messageText, { isFirstMessage: false });
}

async function initConversationFromUrl() {
    const search = new URLSearchParams(window.location.search);
    const convId = search.get("conv");

    console.log("[Litual] initConversationFromUrl", { convId, uid: state.user?.uid });
    await loadConversations();

    if (!convId) {
        if (state.conversations.length > 0) {
            state.activeConversationId = String(state.conversations[0].id);
            const params = new URLSearchParams(window.location.search);
            params.set("conv", state.activeConversationId);
            window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
            console.log("[Litual] auto-select latest conversation", state.activeConversationId);
        } else {
            state.activeConversationId = null;
            renderEmptyState();
            syncCurrentTitle();
            conversationNameBadge.classList.add("hidden");
            return;
        }
    } else {
        state.activeConversationId = String(convId);
    }

    renderConversationList();
    renderConversationMessages();

    const pending = JSON.parse(sessionStorage.getItem("litual_pending_prompt") || "null");
    if (pending && String(pending.conversationId) === String(state.activeConversationId)) {
        state.pendingPrompt = pending;
        sessionStorage.removeItem("litual_pending_prompt");
        const active = getConversationById(state.activeConversationId);
        if (active && Array.isArray(active.messages) && active.messages.length >= 1) {
            await sendConversationMessage(pending.message, { isFirstMessage: true });
        }
    }
}

function closeSidebarOnMobile() {
    if (window.innerWidth <= 980 && conversationSidebar) {
        conversationSidebar.classList.remove("open");
    }
}

function toggleSidebar() {
    if (!conversationSidebar) return;
    conversationSidebar.classList.toggle("open");
}

async function renameActiveConversation() {
    const conversation = getConversationById(state.activeConversationId);
    if (!conversation) return;

    const value = window.prompt("Renommer la conversation", getConversationTitle(conversation));
    if (!value || !value.trim()) return;

    await api.patch(`/api/users/${state.user.uid}/litual-conversations/${conversation.id}`, { title: value.trim() });
    conversation.title = value.trim();
    conversation.updated_at = new Date().toISOString();
    renderConversationList();
    renderConversationMessages();
}

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "/login.html";
        return;
    }

    state.user = user;
    await loadUserData(user);
    await initConversationFromUrl();
});

userInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        if (!sendButton.disabled && userInput.value.trim()) {
            chatForm.requestSubmit();
        }
    }
});

userInput.addEventListener("input", () => {
    userInput.style.height = "auto";
    userInput.style.height = `${Math.min(userInput.scrollHeight, 180)}px`;
});

chatForm.addEventListener("submit", handleSubmit);
newConversationButton.addEventListener("click", () => {
    state.activeConversationId = null;
    const params = new URLSearchParams(window.location.search);
    params.delete("conv");
    const base = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState({}, "", base);
    renderConversationList();
    renderEmptyState();
    syncCurrentTitle();
    conversationNameBadge.classList.add("hidden");
    closeSidebarOnMobile();
});

renameButton.addEventListener("click", renameActiveConversation);
historyToggle.addEventListener("click", toggleSidebar);

window.addEventListener("resize", () => {
    if (window.innerWidth > 980) {
        conversationSidebar?.classList.remove("open");
    }
});
