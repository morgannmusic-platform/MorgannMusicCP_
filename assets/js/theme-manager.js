import { auth, db } from "/assets/js/firebase.js";
import { doc, getDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

export const ThemeManager = {
    applyTheme(theme) {
        const body = document.body;
        // Gestion de l'auto (on retire l'attribut pour laisser le CSS média query agir)
        if (theme.includes('auto')) {
            // Si c'est pimp auto, on peut ajouter une logique spécifique ou laisser par défaut
            if (theme === 'pimp-auto') {
                const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                body.dataset.theme = isDark ? 'noir-pimp' : 'blanc-pimp';
            } else {
                body.dataset.theme = 'normal-auto';
            }
        } else {
            body.dataset.theme = theme;
        }
        console.log(`Thème appliqué : ${theme}`);
    },

    async saveTheme(theme) {
        const user = auth.currentUser;
        if (!user) return;

        try {
            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, { theme: theme });
            this.applyTheme(theme);
        } catch (e) {
            console.error("Erreur sauvegarde thème:", e);
        }
    }
};

// Initialisation au chargement
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userRef = doc(db, "users", user.uid);
        // Listener temps réel pour que ça change sur tous les onglets
        onSnapshot(userRef, (docSnap) => {
            const theme = (docSnap.exists() && docSnap.data().theme) ? docSnap.data().theme : 'normal-auto';
            ThemeManager.applyTheme(theme);
        });
    }
});

// Écouter les changements de mode système pour les thèmes "auto"
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const currentTheme = document.body.dataset.theme; // À affiner si besoin
});