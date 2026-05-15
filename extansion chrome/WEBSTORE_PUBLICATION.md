# MMCP Connect - Publication Chrome Web Store

## Elements deja prets
- Zip d'upload: [mmcp-connect-webstore.zip](../mmcp-connect-webstore.zip)
- Icone 128x128: [icon-128.png](icon-128.png)
- Capture d'ecran 1280x800: [store-assets/screenshot-1.png](store-assets/screenshot-1.png)

## Fiche de l'element
- Langue: Francais
- Categorie recommandee: Productivite
- E-mail de contact: utiliser l'adresse support/publication MMCP a verifier dans l'onglet Compte

## Description courte
Suivez vos sorties MMCP et recevez vos notifications directement dans Chrome.

## Description detaillee
MMCP Connect permet aux artistes et clients de Morgann Music CP de se connecter a leur compte, consulter rapidement le statut de leurs sorties et lire leurs notifications sans ouvrir le tableau de bord complet.

Fonctionnalites principales:
- connexion au compte MMCP
- affichage du statut des sorties associees au compte
- lecture des notifications MMCP
- notifications navigateur automatiques pour les nouveaux messages ou changements de statut
- interface visuelle coherente avec le site Morgann Music CP

Cette extension est concue comme un acces rapide et leger a l'espace MMCP depuis Chrome.

## Objectif unique
Permettre aux utilisateurs MMCP de se connecter a leur compte et de suivre leurs sorties ainsi que leurs notifications directement depuis l'extension Chrome.

## Pratiques en matiere de confidentialite
### Code distant
Texte recommande:
Cette extension n'execute aucun code distant. Tous les fichiers JavaScript, HTML et CSS executes par l'extension sont fournis localement dans le package publie. L'extension effectue uniquement des requetes reseau HTTPS vers les services Firebase Google necessaires a l'authentification et a la lecture des donnees utilisateur.

### Autorisations d'hote
Texte recommande:
Les autorisations d'hote sont necessaires pour contacter les API Google Firebase utilisees par le service MMCP:
- identitytoolkit.googleapis.com: authentification de l'utilisateur
- securetoken.googleapis.com: renouvellement de session
- firestore.googleapis.com: lecture des sorties et notifications appartenant a l'utilisateur connecte
Aucune navigation web generique ni collecte sur d'autres sites n'est effectuee.

### Permission storage
Texte recommande:
L'autorisation storage est utilisee pour stocker localement la session de connexion, l'etat des notifications deja affichees et les preferences techniques necessaires au fonctionnement de l'extension.

### Permission notifications
Texte recommande:
L'autorisation notifications est utilisee pour afficher des alertes Chrome lorsque de nouvelles notifications MMCP non lues sont detectees pour l'utilisateur connecte.

### Permission alarms
Texte recommande:
L'autorisation alarms est utilisee pour planifier une verification periodique des notifications MMCP afin d'informer l'utilisateur sans qu'il ait besoin d'ouvrir manuellement l'extension.

### Donnees utilisateur / respect du reglement
Texte recommande:
L'extension utilise uniquement les donnees necessaires a son objectif principal: authentifier l'utilisateur MMCP, recuperer ses sorties et ses notifications, puis afficher ces informations dans l'interface de l'extension et via des notifications Chrome. Les donnees ne sont pas revendues et ne sont pas utilisees a des fins publicitaires.

## Reponses pratiques au checklist store
- Image de l'icone: uploader [icon-128.png](icon-128.png)
- Description detaillee: utiliser le bloc de description detaillee ci-dessus
- Langue: Francais
- Categorie: Productivite
- Capture d'ecran: uploader [store-assets/screenshot-1.png](store-assets/screenshot-1.png)
- E-mail de contact: a renseigner et valider manuellement dans l'onglet Compte

## Points manuels obligatoires dans la console Web Store
1. Selectionner la langue
2. Selectionner la categorie
3. Uploader l'icone
4. Uploader au moins une capture d'ecran
5. Renseigner l'e-mail de contact
6. Lancer la verification de l'e-mail de contact
7. Remplir l'onglet Pratiques en matiere de confidentialite avec les justifications ci-dessus
8. Enregistrer le brouillon
