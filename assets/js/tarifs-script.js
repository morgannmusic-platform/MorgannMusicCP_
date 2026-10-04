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

    const chatToggle = document.getElementById('chat-toggle');
    const chatWindow = document.getElementById('chat-window');
    const chatOverlay = document.getElementById('chat-overlay');
    const closeChat = document.getElementById('close-chat');
    const chatForm = document.getElementById('chat-input-form');
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');

    let messageHistory = [];
    const systemInstruction = `Tu es Litual AI, l'assistant expert de Morgann Music CP. 
CONSIGNES DE CONVERSATION :
1. Suis le fil de la conversation en utilisant l'historique fourni.
2. NE DIS PAS "Bonjour" ou "Enchanté" à chaque message si la discussion est déjà lancée.
3. Utilise impérativement le Markdown pour tes réponses (gras, listes à puces).
4. Utilise des TABLEAUX Markdown pour comparer les tarifs ou les fonctionnalités quand l'utilisateur hésite.
5. Sois élégant, précis et professionnel.

NOS OFFRES :
- Future légende (0,99€/mois) : -18 ans uniquement. 1 artiste, illimité, Atmos, Lossless, AI Analytics, OAC, Support 24h.
- Starter (2,99€/mois) : 1 artiste, quotas (5 singles, 1 album, 2 EPs), Atmos, Lossless, OAC, Support 48h.
- Pro (3,99€/mois) : 2 artistes, sorties illimitées, Fonctions Starter + Litual AI Predictive, Support 24h.
- Label (5,99€/mois) : Artistes illimités, toutes fonctions Pro.
- White-Label (Sur devis) : Artistes illimités, support 24h, reconnaissance et copyright au nom de leur propre label (pas Morgann Music CP).
HORS ABONNEMENT : Single 3,44€ | EP/Album 7,97€.`;

    function addMessage(text, side, isMarkdown = false) {
        const div = document.createElement('div');
        div.className = `msg ${side}`;
        if (isMarkdown) {
            div.innerHTML = DOMPurify.sanitize(marked.parse(text));
        } else {
            div.textContent = text;
        }
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return div;
    }

    const openChat = () => {
        chatOverlay.style.display = 'block';
        gsap.to(chatOverlay, { opacity: 1, duration: 0.3 });
        gsap.to(chatToggle, { scale: 0, opacity: 0, duration: 0.2 });
        gsap.fromTo(chatWindow, { autoAlpha: 0, scale: 0.2, width: 60, height: 60, borderRadius: "50%" }, {
            autoAlpha: 1, display: 'flex', scale: 1, width: 450, height: 500, borderRadius: "20px", duration: 0.35, ease: "back.out(1.4)", onComplete: () => userInput.focus()
        });
    };

    const hideChat = () => {
        gsap.to(chatOverlay, { opacity: 0, duration: 0.2, onComplete: () => chatOverlay.style.display = 'none' });
        gsap.to(chatWindow, { autoAlpha: 0, scale: 0.3, width: 60, height: 60, borderRadius: "50%", duration: 0.3 });
        gsap.to(chatToggle, { scale: 1, opacity: 1, duration: 0.4 });
        setTimeout(() => chatWindow.style.display = 'none', 300);
    };

    chatToggle.addEventListener('click', openChat);
    closeChat.addEventListener('click', hideChat);
    chatOverlay.addEventListener('click', hideChat);

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = userInput.value.trim();
        if (!text) return;

        addMessage(text, 'user');
        userInput.value = '';
        messageHistory.push({ role: 'user', content: text });

        const aiMsgDiv = addMessage('', 'ai', true);
        try {
            const response = await fetch('https://litual.ai.morgannmusic.uk', {
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
                            aiMsgDiv.innerHTML = DOMPurify.sanitize(marked.parse(aiFullText));
                            chatMessages.scrollTop = chatMessages.scrollHeight;
                        }
                    } catch (e) { }
                }
            }
            messageHistory.push({ role: 'assistant', content: aiFullText });
        } catch (err) {
            aiMsgDiv.innerHTML = DOMPurify.sanitize(marked.parse("Désolé, une erreur est survenue."));
        }
    });

    chatMessages.innerHTML = '';
    addMessage("Bonjour ! Je suis Litual AI. Quel plan souhaitez-vous choisir ?", 'ai', true);
});
