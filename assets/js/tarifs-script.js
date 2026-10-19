import { auth } from '/assets/js/firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {
    if (typeof gsap === "undefined") return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!reducedMotion) {
        gsap.fromTo(".tarifs-hero > *", { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.12, ease: "power2.out" });
        gsap.fromTo(".price-card", { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.55, stagger: 0.08, ease: "power2.out", delay: 0.2 });
    } else {
        gsap.set([".tarifs-hero > *", ".price-card"], { opacity: 1, y: 0 });
    }

    let currentUser = null;
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
    });

    const buttons = document.querySelectorAll('.checkout-trigger');
    buttons.forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!currentUser) {
                alert("Vous devez être connecté pour souscrire à un abonnement.");
                window.location.href = "/login.html";
                return;
            }

            const planId = btn.getAttribute('data-plan');
            const planName = btn.getAttribute('data-name');
            const amount = parseInt(btn.getAttribute('data-amount'), 10);

            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = "Redirection...";

            try {
                const response = await fetch('https://pay.mm-cp.uk/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        amount: amount,
                        planName: planName,
                        planId: planId,
                        userId: currentUser.uid,
                        userEmail: currentUser.email,
                        mode: 'subscription'
                    })
                });

                const data = await response.json();
                if (data.url) {
                    window.location.href = data.url;
                } else {
                    throw new Error(data.error || "Erreur de création de session Stripe.");
                }
            } catch (err) {
                alert("Erreur : " + err.message);
                btn.disabled = false;
                btn.textContent = originalText;
            }
        });
    });

    // --- CONFIGURATION MARKED POUR LES BOUTONS ---
    const renderer = new marked.Renderer();
    renderer.link = function (href, title, text) {
        const safeText = (text || '').replace(/^BOUTON\s*:/i, '').trim() || 'Découvrir';
        const safeHref = href || '#';

        if (safeText || safeHref) {
            return `<a href="${safeHref}" class="plan-button" style="display: inline-block; margin-top: 10px; text-decoration: none; text-align: center; font-size: 0.85rem;" target="_blank" rel="noopener noreferrer">${safeText}</a>`;
        }

        return `<a href="${safeHref}" title="${title || ''}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    };
    marked.setOptions({ renderer: renderer, breaks: true, gfm: true });
    // ---------------------------------------------

    const chatToggle = document.getElementById('chat-toggle');
    const chatWindow = document.getElementById('chat-window');
    const chatOverlay = document.getElementById('chat-overlay');
    chatWindow.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    const closeChat = document.getElementById('close-chat');
    const chatForm = document.getElementById('chat-input-form');
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');

    let messageHistory = [];
    const systemInstruction = `Tu es Litual AI, l'assistant expert de Morgann Music CP.
CONSIGNES DE CONVERSATION :
1. Garde le fil de la conversation en te basant sur l'historique fourni.
2. N'écris jamais "Bonjour", "Enchanté", "Je suis Litual AI" ou toute présentation automatique à chaque message.
3. Réponds directement à la demande de l'utilisateur, sans reformuler à l'infini ni faire de diagnostic de conversation.
4. Si l'utilisateur dit simplement bonjour ou pose une question générale, réponds directement, sans te présenter ni sans parler de toi.
5. Utilise le Markdown (gras, listes à puces, titres, tableaux) quand c'est utile.
6. Quand l'utilisateur compare ou hésite entre plans, donne une réponse claire avec un petit tableau.
7. Sois élégant, précis et professionnel.
8. Pour proposer un lien d'action, utilise EXACTEMENT cette syntaxe : [BOUTON:Texte du bouton](url).
9. Si l'utilisateur demande quelque chose de spécifique, réponds selon la demande et reste focalisé sur les tarifs et le service Morgann Music CP.
10. Ne recommence pas à te présenter ni à expliquer ta fonction à chaque message.
11. Si l'utilisateur dit qu'il est admin, gestionnaire, staff, équipe interne, assistant de musique, gestionnaire de contenus, ou décrit un role professionnel / non client, ne lui propose pas d'offre, de plan ou de souscription.
12. Dans ce cas, redirige immédiatement vers la page Litual en utilisant le bouton de redirection : [BOUTON:Découvrir la page Litual](https://mm-cp.uk/litual.html).
13. Tu dois savoir que ce type de profil n'est pas un client final qui cherche un tarif ; il est là pour une utilisation du produit, un accès au portail ou une page dédiée.
14. Ne mentionne jamais explicitement le terme "admin" dans la réponse si ce n'est pas nécessaire ; adapte simplement le ton à un contexte interne / pro.

NOS OFFRES :
- Future légende (0,99€/mois) : -18 ans uniquement, seul les utilisateur mineur de moins de 18ans peuvent accéder a cette abonnement. 1 artiste, illimité, Atmos, Lossless, AI Analytics, OAC, Support 24h.
- Starter (2,99€/mois) : 1 artiste, quotas (5 singles, 1 album, 2 EPs), Atmos, Lossless, OAC, Support 48h.
- Pro (3,99€/mois) : 2 artistes, sorties illimitées, Fonctions Starter + Litual AI Predictive, Support 24h.
- Label (5,99€/mois) : Artistes illimités, toutes fonctions Pro.
- White-Label (Sur devis) : Artistes illimités, support 24h, reconnaissance et copyright au nom de leur propre label (pas Morgann Music CP).
HORS ABONNEMENT : Single 3,44€ | EP/Album 7,97€.
OAC veut dire Official Artist Channel, c'est les chaine d'artiste de YouTube`;

    function sanitizeLinkTarget(value) {
        if (value == null) return '#';

        let href = String(value)
            .trim()
            .replace(/\[object Object\]/gi, '')
            .replace(/&amp;/g, '&')
            .replace(/^['\"]+|['\"]+$/g, '');

        if (!href) return '#';
        if (href.startsWith('javascript:')) return '#';

        if (!/^(https?:|mailto:|tel:|\/|\.\/|#)/i.test(href)) {
            href = `/${href.replace(/^\/+/, '')}`;
        }

        return href;
    }

    function normalizeAiMarkdown(rawText = '') {
        let text = String(rawText || '');

        text = text.replace(/\[\s*BOUTON\s*:\s*([^\]]+?)\s*\]\s*\(\s*([^\)]+?)\s*\)/gi, (_, label, href) => {
            const cleanLabel = label.trim();
            const cleanUrl = sanitizeLinkTarget(href);
            return `[BOUTON:${cleanLabel}](${cleanUrl})`;
        });

        text = text.replace(/\[\s*([^\]]+?)\s*\]\s*\(\s*([^\)]+?)\s*\)/g, (_, label, href) => {
            const cleanLabel = label.trim().replace(/^BOUTON\s*:/i, '').trim() || 'Découvrir';
            const cleanUrl = sanitizeLinkTarget(href);
            return `[BOUTON:${cleanLabel}](${cleanUrl})`;
        });

        text = text.replace(/(https?:\/\/[^\s)]+|\/[^\s)]+\.[a-z0-9\/?#=&%_-]+)/gi, (match) => {
            return `[BOUTON:Découvrir](${sanitizeLinkTarget(match)})`;
        });

        return text;
    }

    function renderAiHtml(rawText) {
        const normalizedText = normalizeAiMarkdown(rawText);
        let html = normalizedText.replace(/\[\s*BOUTON\s*:\s*([^\]]+?)\s*\]\s*\(([^)]+)\)/gi, (_, label, href) => {
            const cleanLabel = String(label).trim() || 'Découvrir';
            const cleanHref = sanitizeLinkTarget(href);
            return `<a href="${cleanHref}" class="plan-button" style="display: inline-block; margin-top: 10px; text-decoration: none; text-align: center; font-size: 0.85rem;" target="_blank" rel="noopener noreferrer">${cleanLabel}</a>`;
        });

        html = html.replace(/\[(.+?)\]\(([^)]+)\)/g, (_, label, href) => {
            const cleanLabel = String(label).trim() || 'Découvrir';
            const cleanHref = sanitizeLinkTarget(href);
            return `<a href="${cleanHref}" class="plan-button" style="display: inline-block; margin-top: 10px; text-decoration: none; text-align: center; font-size: 0.85rem;" target="_blank" rel="noopener noreferrer">${cleanLabel}</a>`;
        });

        if (!/<a\s+/.test(html)) {
            html = marked.parse(html);
        } else {
            html = marked.parse(html.replace(/<a /g, '<span '));
        }

        html = html.replace(/<span\s+([^>]*?)href=(['"])(.*?)\2([^>]*)>(.*?)<\/span>/gi, (_, before, quote, href, after, label) => {
            const cleanHref = sanitizeLinkTarget(href);
            const cleanLabel = (String(label || '').replace(/<[^>]+>/g, '').trim() || 'Découvrir');
            return `<a href="${cleanHref}" class="plan-button" style="display: inline-block; margin-top: 10px; text-decoration: none; text-align: center; font-size: 0.85rem;" target="_blank" rel="noopener noreferrer">${cleanLabel}</a>`;
        });

        return DOMPurify.sanitize(html, {
            ADD_ATTR: ['target', 'class', 'style'],
            ADD_TAGS: ['a']
        });
    }

    function addMessage(text, side, isMarkdown = false) {
        const div = document.createElement('div');
        div.className = `msg ${side}`;
        if (isMarkdown) {
            div.innerHTML = renderAiHtml(text);
        } else {
            div.textContent = text;
        }
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return div;
    }

    const openChat = () => {
        chatOverlay.style.display = 'block';
        chatWindow.style.display = 'flex';
        chatWindow.style.visibility = 'visible';
        chatWindow.style.pointerEvents = 'auto';
        gsap.to(chatOverlay, { opacity: 1, duration: 0.3 });
        gsap.to(chatToggle, { scale: 0, opacity: 0, duration: 0.2 });
        gsap.fromTo(chatWindow, { autoAlpha: 0, scale: 0.2, width: 60, height: 60, borderRadius: "50%", visibility: 'visible', pointerEvents: 'auto' }, {
            autoAlpha: 1, display: 'flex', scale: 1, width: 500, height: 560, borderRadius: "20px", visibility: 'visible', pointerEvents: 'auto', duration: 0.35, ease: "back.out(1.4)", onComplete: () => userInput.focus()
        });
    };

    const hideChat = () => {
        chatWindow.style.pointerEvents = 'none';
        chatWindow.style.visibility = 'hidden';
        gsap.to(chatOverlay, { opacity: 0, duration: 0.2, onComplete: () => chatOverlay.style.display = 'none' });
        gsap.to(chatWindow, {
            autoAlpha: 0,
            scale: 0.3,
            width: 60,
            height: 60,
            borderRadius: "50%",
            duration: 0.3,
            onComplete: () => {
                chatWindow.style.display = 'none';
                chatWindow.style.visibility = 'hidden';
                chatWindow.style.pointerEvents = 'none';
            }
        });
        gsap.to(chatToggle, { scale: 1, opacity: 1, duration: 0.4 });
    };

    chatToggle.addEventListener('click', openChat);
    closeChat.addEventListener('click', hideChat);

    const setLoadingState = (isLoading) => {
        chatToggle.classList.toggle('is-loading', isLoading);
        userInput.disabled = isLoading;
        const submitButton = chatForm.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = isLoading;
            submitButton.textContent = isLoading ? '...' : 'Envoyer';
        }
    };

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = userInput.value.trim();
        if (!text) return;

        addMessage(text, 'user');
        userInput.value = '';
        messageHistory.push({ role: 'user', content: text });
        setLoadingState(true);

        const aiMsgDiv = addMessage('', 'ai', true);
        try {
            const response = await fetch('https://litual.api.worker.mm-cp.uk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: messageHistory, instruction: systemInstruction })
            });

            if (!response.ok) throw new Error();
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let aiFullText = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunkString = decoder.decode(value, { stream: true });
                const dataChunks = chunkString.split('data: ').filter(s => s.trim() !== '' && s.trim() !== '[DONE]');
                for (const dataChunk of dataChunks) {
                    try {
                        const json = JSON.parse(dataChunk.trim());
                        if (json.response) {
                            aiFullText += json.response;
                            aiMsgDiv.innerHTML = renderAiHtml(aiFullText);
                            chatMessages.scrollTop = chatMessages.scrollHeight;
                        }
                    } catch (e) { }
                }
            }
            messageHistory.push({ role: 'assistant', content: aiFullText });
            setLoadingState(false);
        } catch (err) {
            aiMsgDiv.innerHTML = renderAiHtml("Désolé, une erreur est survenue.");
            setLoadingState(false);
        }
    });

    chatMessages.innerHTML = '';
    addMessage("Quel plan vous intéresse aujourd'hui ?", 'ai', true);
});