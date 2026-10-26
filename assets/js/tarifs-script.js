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

    // --- CRÉATION DYNAMIQUE DE LA MODAL VÉRIFICATION D'ÂGE ---
    const modalHTML = `
    <div class="identity-modal-overlay" id="identity-modal-overlay">
        <div class="identity-modal">
            <button class="close-modal" id="identity-close-btn">&times;</button>
            
            <div class="identity-modal-header">
                <h3>Vérification d'âge</h3>
                <p>Afin de débloquer l'offre <strong>Future légende</strong> réservée aux mineurs, une vérification rapide est requise.</p>
            </div>

            <div class="identity-trust-box">
                <div class="trust-icon">🛡️</div>
                <div>
                    <strong>Sécurité absolue & Données éphémères</strong><br>
                    Votre carte d'identité est traitée de manière totalement sécurisée. L'image est stockée uniquement en <strong>mémoire vive (RAM)</strong> le temps de l'analyse IA. Elle n'est <strong>jamais enregistrée</strong> sur nos serveurs, jamais stockée dans une base de données, et est détruite instantanément après la vérification.
                </div>
            </div>
            
            <div class="identity-options" id="identity-options-step">
                <button class="identity-option-btn" id="btn-import-file">
                    <span style="font-size: 2rem; margin-bottom: 4px;">📁</span>
                    <span class="btn-title">Importer un fichier</span>
                    <span class="btn-desc">Photo nette de votre pièce (JPG/PNG)</span>
                </button>
                <button class="identity-option-btn" id="btn-use-camera">
                    <span style="font-size: 2rem; margin-bottom: 4px;">📷</span>
                    <span class="btn-title">Appareil photo</span>
                    <span class="btn-desc">Capturez votre carte directement</span>
                </button>
            </div>

            <input type="file" id="identity-file-input" accept="image/*" style="display: none;">

            <div class="camera-preview-container" id="camera-container">
                <video id="identity-video" autoplay playsinline></video>
                <button class="plan-button" id="btn-capture-photo" style="background: var(--beige); color: #fff; border: none; font-weight: 700; width: 100%;">
                    Prendre la photo
                </button>
            </div>

            <div class="identity-progress-container" id="identity-progress-container">
                <div class="identity-progress-bar-bg">
                    <div class="identity-progress-bar-fill" id="identity-progress-fill"></div>
                </div>
                <div class="identity-progress-status" id="identity-progress-status">Initialisation...</div>
                <div id="identity-result"></div>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const modalOverlay = document.getElementById('identity-modal-overlay');
    const closeBtn = document.getElementById('identity-close-btn');
    const optionsStep = document.getElementById('identity-options-step');
    const btnImport = document.getElementById('btn-import-file');
    const btnCamera = document.getElementById('btn-use-camera');
    const fileInput = document.getElementById('identity-file-input');
    const cameraContainer = document.getElementById('camera-container');
    const videoElem = document.getElementById('identity-video');
    const btnCapture = document.getElementById('btn-capture-photo');
    const progressContainer = document.getElementById('identity-progress-container');
    const progressFill = document.getElementById('identity-progress-fill');
    const progressStatus = document.getElementById('identity-progress-status');
    const resultDiv = document.getElementById('identity-result');

    let currentStream = null;
    let pendingPlanData = null;

    const stopCamera = () => {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
            currentStream = null;
        }
        cameraContainer.style.display = 'none';
    };

    const closeModal = () => {
        modalOverlay.classList.remove('active');
        stopCamera();
        optionsStep.style.display = 'flex';
        progressContainer.style.display = 'none';
        progressFill.style.width = '0%';
        resultDiv.style.display = 'none';
        resultDiv.textContent = '';
        if (pendingPlanData && pendingPlanData.btn) {
            pendingPlanData.btn.disabled = false;
            pendingPlanData.btn.textContent = pendingPlanData.originalText;
        }
    };

    closeBtn.addEventListener('click', closeModal);

    const updateProgressStep = async (percentage, text, delayMs) => {
        progressFill.style.width = `${percentage}%`;
        progressStatus.textContent = text;
        await new Promise(resolve => setTimeout(resolve, delayMs));
    };

    const processAndCompressImage = (fileOrBlob) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(fileOrBlob);

            img.onload = () => {
                URL.revokeObjectURL(url);
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                const maxDim = 1200;
                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    } else {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error("Erreur de compression."));
                }, 'image/png');
            };

            img.onerror = () => reject(new Error("Impossible de charger l'image."));
            img.src = url;
        });
    };

    const runVerificationPipeline = async (rawFileOrBlob) => {
        optionsStep.style.display = 'none';
        stopCamera();
        progressContainer.style.display = 'flex';
        resultDiv.style.display = 'none';

        let verificationSuccess = false;
        let errorMessage = "";

        try {
            await updateProgressStep(15, "Conversion en PNG...", 1800);
            await updateProgressStep(35, "Compression et sécurisation...", 1500);
            let processedBlob = await processAndCompressImage(rawFileOrBlob);

            await updateProgressStep(60, "Envoi chiffré à Litual Identity...", 2500);
            const formData = new FormData();
            formData.append('file', processedBlob, 'identity.png');

            const aiPromise = fetch('https://api.identity.litual.mm-cp.uk/', {
                method: 'POST',
                body: formData
            });

            await updateProgressStep(80, "Vérification de l'âge par l'IA...", 2000);

            try {
                const aiResponse = await aiPromise;
                const aiData = await aiResponse.json();

                if (!aiResponse.ok || !aiData.success) {
                    errorMessage = "Erreur de lecture de la carte. Veuillez réessayer avec une photo bien nette et éclairée.";
                } else if (!aiData.isMinor) {
                    errorMessage = "Accès refusé : Cette offre est strictement réservée aux mineurs de moins de 18 ans.";
                } else {
                    verificationSuccess = true;
                }
            } catch (networkErr) {
                errorMessage = "Erreur réseau lors de l'analyse sécurisée. Veuillez réessayer.";
            }

            await updateProgressStep(90, "Destruction de votre carte d'identité...", 1500);
            processedBlob = null;
            rawFileOrBlob = null;

            await updateProgressStep(100, "Purge complète de la mémoire RAM...", 1500);

            progressStatus.style.display = 'none';
            resultDiv.style.display = 'block';

            if (verificationSuccess) {
                resultDiv.style.color = "var(--text)";
                resultDiv.style.background = "var(--container1)";
                resultDiv.style.border = "1px solid var(--beige)";
                resultDiv.textContent = "✅ Vérification validée avec succès. Redirection vers le paiement Stripe...";

                const stripeResponse = await fetch('https://pay.mm-cp.uk/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        amount: pendingPlanData.amount,
                        planName: pendingPlanData.planName,
                        planId: pendingPlanData.planId,
                        userId: currentUser.uid,
                        userEmail: currentUser.email,
                        mode: 'subscription'
                    })
                });

                const stripeData = await stripeResponse.json();
                if (stripeData.url) {
                    window.location.href = stripeData.url;
                } else {
                    resultDiv.style.color = "#ef4444";
                    resultDiv.style.background = "rgba(239, 68, 68, 0.1)";
                    resultDiv.style.border = "1px solid rgba(239, 68, 68, 0.3)";
                    resultDiv.textContent = "❌ Erreur de création de la session de paiement.";
                    pendingPlanData.btn.disabled = false;
                    pendingPlanData.btn.textContent = pendingPlanData.originalText;
                }
            } else {
                resultDiv.style.color = "#ef4444";
                resultDiv.style.background = "rgba(239, 68, 68, 0.1)";
                resultDiv.style.border = "1px solid rgba(239, 68, 68, 0.3)";
                resultDiv.textContent = "❌ " + errorMessage;

                pendingPlanData.btn.disabled = false;
                pendingPlanData.btn.textContent = pendingPlanData.originalText;
            }

        } catch (err) {
            progressStatus.style.display = 'none';
            resultDiv.style.display = 'block';
            resultDiv.style.color = "#ef4444";
            resultDiv.style.background = "rgba(239, 68, 68, 0.1)";
            resultDiv.style.border = "1px solid rgba(239, 68, 68, 0.3)";
            resultDiv.textContent = "❌ Une erreur critique est survenue lors du processus.";
            pendingPlanData.btn.disabled = false;
            pendingPlanData.btn.textContent = pendingPlanData.originalText;
        }
    };

    btnImport.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) runVerificationPipeline(file);
    });

    btnCamera.addEventListener('click', async () => {
        try {
            optionsStep.style.display = 'none';
            cameraContainer.style.display = 'flex';
            currentStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' },
                audio: false
            });
            videoElem.srcObject = currentStream;
        } catch (err) {
            optionsStep.style.display = 'flex';
            cameraContainer.style.display = 'none';
            resultDiv.style.display = 'block';
            resultDiv.style.color = "#ef4444";
            resultDiv.textContent = "Accès à l'appareil photo refusé ou impossible.";
        }
    });

    btnCapture.addEventListener('click', () => {
        const canvas = document.createElement('canvas');
        canvas.width = videoElem.videoWidth;
        canvas.height = videoElem.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoElem, 0, 0);

        canvas.toBlob((blob) => {
            if (blob) runVerificationPipeline(blob);
        }, 'image/png');
    });

    const buttons = document.querySelectorAll('.checkout-trigger');
    buttons.forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!currentUser) {
                window.location.href = "/login.html";
                return;
            }

            const planId = btn.getAttribute('data-plan');
            const planName = btn.getAttribute('data-name');
            const amount = parseInt(btn.getAttribute('data-amount'), 10);
            const originalText = btn.textContent;

            btn.disabled = true;

            if (planId === 'under18') {
                pendingPlanData = { planId, planName, amount, btn, originalText };
                progressStatus.style.display = 'block';
                modalOverlay.classList.add('active');
                return;
            }

            try {
                btn.textContent = "Redirection...";
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
                    throw new Error(data.error || "Erreur Stripe.");
                }
            } catch (err) {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        });
    });

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

    const chatToggle = document.getElementById('chat-toggle');
    const chatWindow = document.getElementById('chat-window');
    const chatOverlay = document.getElementById('chat-overlay');
    chatWindow.addEventListener('click', (e) => { e.stopPropagation(); });
    const closeChat = document.getElementById('close-chat');
    const chatForm = document.getElementById('chat-input-form');
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');

    let messageHistory = [];
    const systemInstruction = `Tu es Litual AI...`;

    function sanitizeLinkTarget(value) {
        if (value == null) return '#';
        let href = String(value).trim().replace(/\[object Object\]/gi, '').replace(/&amp;/g, '&').replace(/^['\"]+|['\"]+$/g, '');
        if (!href || href.startsWith('javascript:')) return '#';
        if (!/^(https?:|mailto:|tel:|\/|\.\/|#)/i.test(href)) { href = `/${href.replace(/^\/+/, '')}`; }
        return href;
    }

    function normalizeAiMarkdown(rawText = '') {
        let text = String(rawText || '');
        text = text.replace(/\[\s*BOUTON\s*:\s*([^\]]+?)\s*\]\s*\(\s*([^\)]+?)\s*\)/gi, (_, label, href) => `[BOUTON:${label.trim()}](${sanitizeLinkTarget(href)})`);
        text = text.replace(/\[\s*([^\]]+?)\s*\]\s*\(\s*([^\)]+?)\s*\)/g, (_, label, href) => `[BOUTON:${label.trim().replace(/^BOUTON\s*:/i, '').trim() || 'Découvrir'}](${sanitizeLinkTarget(href)})`);
        text = text.replace(/(https?:\/\/[^\s)]+|\/[^\s)]+\.[a-z0-9\/?#=&%_-]+)/gi, (match) => `[BOUTON:Découvrir](${sanitizeLinkTarget(match)})`);
        return text;
    }

    function renderAiHtml(rawText) {
        const normalizedText = normalizeAiMarkdown(rawText);
        let html = normalizedText.replace(/\[\s*BOUTON\s*:\s*([^\]]+?)\s*\]\s*\(([^)]+)\)/gi, (_, label, href) => `<a href="${sanitizeLinkTarget(href)}" class="plan-button" style="display: inline-block; margin-top: 10px; text-decoration: none; text-align: center; font-size: 0.85rem;" target="_blank" rel="noopener noreferrer">${String(label).trim() || 'Découvrir'}</a>`);
        if (!/<a\s+/.test(html)) { html = marked.parse(html); }
        else { html = marked.parse(html.replace(/<a /g, '<span ')); }
        html = html.replace(/<span\s+([^>]*?)href=(['"])(.*?)\2([^>]*)>(.*?)<\/span>/gi, (_, before, quote, href, after, label) => `<a href="${sanitizeLinkTarget(href)}" class="plan-button" style="display: inline-block; margin-top: 10px; text-decoration: none; text-align: center; font-size: 0.85rem;" target="_blank" rel="noopener noreferrer">${(String(label || '').replace(/<[^>]+>/g, '').trim() || 'Découvrir')}</a>`);
        return DOMPurify.sanitize(html, { ADD_ATTR: ['target', 'class', 'style'], ADD_TAGS: ['a'] });
    }

    function addMessage(text, side, isMarkdown = false) {
        const div = document.createElement('div');
        div.className = `msg ${side}`;
        if (isMarkdown) { div.innerHTML = renderAiHtml(text); } else { div.textContent = text; }
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return div;
    }

    const openChat = () => {
        chatOverlay.style.display = 'block'; chatWindow.style.display = 'flex'; chatWindow.style.visibility = 'visible'; chatWindow.style.pointerEvents = 'auto';
        gsap.to(chatOverlay, { opacity: 1, duration: 0.3 }); gsap.to(chatToggle, { scale: 0, opacity: 0, duration: 0.2 });
        gsap.fromTo(chatWindow, { autoAlpha: 0, scale: 0.2, width: 60, height: 60, borderRadius: "50%", visibility: 'visible', pointerEvents: 'auto' }, { autoAlpha: 1, display: 'flex', scale: 1, width: 500, height: 560, borderRadius: "20px", visibility: 'visible', pointerEvents: 'auto', duration: 0.35, ease: "back.out(1.4)", onComplete: () => userInput.focus() });
    };

    const hideChat = () => {
        chatWindow.style.pointerEvents = 'none'; chatWindow.style.visibility = 'hidden';
        gsap.to(chatOverlay, { opacity: 0, duration: 0.2, onComplete: () => chatOverlay.style.display = 'none' });
        gsap.to(chatWindow, { autoAlpha: 0, scale: 0.3, width: 60, height: 60, borderRadius: "50%", duration: 0.3, onComplete: () => { chatWindow.style.display = 'none'; chatWindow.style.visibility = 'hidden'; chatWindow.style.pointerEvents = 'none'; } });
        gsap.to(chatToggle, { scale: 1, opacity: 1, duration: 0.4 });
    };

    chatToggle.addEventListener('click', openChat);
    closeChat.addEventListener('click', hideChat);

    const setLoadingState = (isLoading) => {
        chatToggle.classList.toggle('is-loading', isLoading); userInput.disabled = isLoading;
        const submitButton = chatForm.querySelector('button[type="submit"]');
        if (submitButton) { submitButton.disabled = isLoading; submitButton.textContent = isLoading ? '...' : 'Envoyer'; }
    };

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = userInput.value.trim();
        if (!text) return;
        addMessage(text, 'user'); userInput.value = ''; messageHistory.push({ role: 'user', content: text }); setLoadingState(true);
        const aiMsgDiv = addMessage('', 'ai', true);
        try {
            const response = await fetch('https://litual.api.worker.mm-cp.uk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: messageHistory, instruction: systemInstruction }) });
            if (!response.ok) throw new Error();
            const reader = response.body.getReader(); const decoder = new TextDecoder(); let aiFullText = "";
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunkString = decoder.decode(value, { stream: true });
                const dataChunks = chunkString.split('data: ').filter(s => s.trim() !== '' && s.trim() !== '[DONE]');
                for (const dataChunk of dataChunks) {
                    try {
                        const json = JSON.parse(dataChunk.trim());
                        if (json.response) { aiFullText += json.response; aiMsgDiv.innerHTML = renderAiHtml(aiFullText); chatMessages.scrollTop = chatMessages.scrollHeight; }
                    } catch (e) { }
                }
            }
            messageHistory.push({ role: 'assistant', content: aiFullText }); setLoadingState(false);
        } catch (err) {
            aiMsgDiv.innerHTML = renderAiHtml("Désolé, une erreur est survenue."); setLoadingState(false);
        }
    });

    chatMessages.innerHTML = '';
    addMessage("Quel plan vous intéresse aujourd'hui ?", 'ai', true);
});