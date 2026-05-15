# Cloudflare Pages Setup - Email Worker Integration

## Configuration des secrets Brevo sur Cloudflare Pages

Tu utilises **Cloudflare Pages** pour déployer ton site. Les variables d'environnement sensibles (comme `BREVO_API_KEY`) doivent être configurées dans le dashboard Cloudflare.

### Étapes pour configurer les secrets :

#### 1. Va dans Cloudflare Pages Dashboard
- Accède à **[Cloudflare Pages](https://pages.cloudflare.com)**
- Sélectionne ton projet **morgann-music-cp**

#### 2. Configure les Environment Variables
- Clique sur **Settings** → **Environment variables**
- Ajoute les variables suivantes pour l'environnement **Production** :

| Variable | Valeur | Type |
|----------|--------|------|
| `BREVO_API_KEY` | `xkeysib-...` (ta clé API) | Secret |
| `BREVO_FROM_EMAIL` | `no-reply@mm-cp.uk` | Standard |
| `BREVO_FROM_NAME` | `Morgann Music CP` | Standard |

**Important :** Marque `BREVO_API_KEY` comme **Secret** pour qu'elle soit masquée dans les logs.

#### 3. Redéploie ton site
- Cloudflare redéploiera automatiquement avec les nouvelles variables
- Ou force un redéploiement en commitant un changement mineur

### Vérification locale

Pour tester localement avant de déployer :

```bash
wrangler dev
```

Les variables du fichier `.env.local` seront utilisées par `wrangler dev`.

### Structure des fichiers

```
functions/
├── api/
│   └── email/
│       └── brevo.js          # POST /api/email/brevo
```

Le Worker écoute sur `/api/email/brevo` et gère les appels POST du formulaire d'email dans `/dash/admin/emailer.html`.

### Sécurité

- ✅ Le token Firebase JWT est transmis dans les headers
- ✅ Le Worker vérifie la présence du token (au minimum)
- ✅ L'accès à la page `/dash/admin/emailer.html` est restreint aux utilisateurs authentifiés en tant qu'admin

### Troubleshooting

**Problème :** "Brevo API key not configured"
- → Vérifie que tu as configuré `BREVO_API_KEY` dans Cloudflare Pages Settings

**Problème :** "Unauthorized - missing or invalid token"
- → Vérifie que tu es connecté à Firebase et authentifié en tant qu'admin

**Problème :** Email not sent, erreur Brevo
- → Vérifie que ta clé API Brevo est valide dans la console Brevo
- → Vérifie que le domaine `mm-cp.uk` est autorisé dans Brevo SMTP settings
