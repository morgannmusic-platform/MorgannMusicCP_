// Clé API stockée dans les propriétés du script (à définir dans l'interface Apps Script)
const GEMINI_MODEL = "gemini-2.5-flash";



// Clé de stockage de l'historique dans le PropertiesService du script

const HISTORY_KEY = 'GEMINI_CHAT_HISTORY';



// Nombre maximum d'échanges (utilisateur + modèle) à conserver pour le contexte

// 20 messages = 10 tours complets.

const MAX_HISTORY_TURNS = 20;



// **********************************************

// ** FONCTIONS DE GESTION DE L'HISTORIQUE **

// **********************************************



/**

 * Récupère l'historique de la conversation depuis le stockage.

 * @returns {Array<Object>} Le tableau des messages (rôles et parties).

 */

function getHistory() {

  const properties = PropertiesService.getScriptProperties();

  const historyString = properties.getProperty(HISTORY_KEY);

 

  if (!historyString) {

    return [];

  }

 

  try {

    const history = JSON.parse(historyString);

    // Limiter l'historique pour ne pas dépasser la fenêtre de contexte du modèle

    return Array.isArray(history) ? history.slice(-MAX_HISTORY_TURNS) : [];

  } catch (e) {

    Logger.log("Erreur lors du parsing de l'historique : " + e);

    return [];

  }

}



/**

 * Ajoute le dernier échange (utilisateur et modèle) à l'historique et le sauvegarde.

 * @param {Array<Object>} userParts Les parties (texte, fichier) de la requête utilisateur.

 * @param {string} modelResponse Le texte de la réponse du modèle.

 */

function saveHistory(userParts, modelResponse) {

  const history = getHistory();

 

  // 1. Ajouter le message de l'utilisateur

  history.push({

    role: "user",

    parts: userParts

  });

 

  // 2. Ajouter la réponse du modèle

  history.push({

    role: "model",

    parts: [{ text: modelResponse }]

  });

 

  // Limiter l'historique avant de sauvegarder (redondant mais plus sûr)

  const trimmedHistory = history.slice(-MAX_HISTORY_TURNS);

 

  const properties = PropertiesService.getScriptProperties();

  // Sauvegarder la nouvelle chaîne d'historique

  properties.setProperty(HISTORY_KEY, JSON.stringify(trimmedHistory));

}



/**

 * Supprime l'historique de la conversation.

 */

function clearHistory() {

  PropertiesService.getScriptProperties().deleteProperty(HISTORY_KEY);

  Logger.log("Historique de conversation effacé.");

}



// **********************************************

// ** FONCTION PRINCIPALE DE GESTION DES REQUÊTES **

// **********************************************



/**

 * Gère les requêtes POST (envoi de messages/fichiers)

 * @param {Object} e L'objet événement contenant les paramètres de la requête.

 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON.

 */

function doPost(e) {

  // *** LOGS DE DIAGNOSTIC ***

  const logParams = e && e.parameter ? JSON.stringify(e.parameter) : 'Aucun paramètre (exécution manuelle ou erreur de requête)';

  Logger.log('Début de doPost. Événement reçu: ' + logParams);



  try {

    // **********************************************

    // ** 2. RÉCUPÉRATION DES PARAMÈTRES & HISTORIQUE **

    // **********************************************

    const params = e.parameter || {};

    const prompt = params.prompt || "";

    let filedataBase64 = params.filedata;

    const mimetype = params.mimetype;
    // Défensive: si la base64 a été envoyée sans encodeURIComponent,
    // les '+' peuvent être devenus des espaces lors du décodage form-urlencoded.
    if (filedataBase64 && filedataBase64.indexOf(' ') !== -1) {
      try {
        const restored = filedataBase64.replace(/ /g, '+');
        if (/^[A-Za-z0-9+/=\r\n]+$/.test(restored)) {
          filedataBase64 = restored;
        }
      } catch (err) {
        Logger.log('Erreur lors de la restauration du base64: ' + err);
      }
    }

   

    // NOUVEAU : Récupérer l'historique de la conversation

    const conversationHistory = getHistory();

   

    // NOUVEAU : Gérer une demande pour effacer l'historique (pour commencer un nouveau chat)

    if (prompt && (prompt.toLowerCase() === '/new' || prompt.toLowerCase() === '/reset')) {

        clearHistory();

        return response("Nouvelle conversation démarrée ! Comment puis-je vous aider ?", false);

    }



    if (!prompt && !filedataBase64) {

      return response('Veuillez fournir un message ou joindre un fichier.', true);

    }

   

    // **********************************************

    // ** 3. CONSTRUCTION DU CONTENU UTILISATEUR (userParts) **

    // **********************************************

    let contentParts = [];

    let fileType = '';



    // Ajouter la partie fichier (inlineData) si un fichier est présent

    if (filedataBase64 && mimetype) {

      contentParts.push({

        inlineData: {

          mimeType: mimetype,

          data: filedataBase64

        }

      });

      fileType = mimetype.split('/')[0];

    }

   

    // Ajouter la partie texte

    if (prompt) {

      contentParts.push({ text: prompt });

    }

    // Si un fichier est joint et que l'utilisateur a fourni une question,
    // enrichir/clarifier la partie texte pour que le modèle utilise l'image
    // comme contexte (évite les réponses du type "je ne comprends pas").
    if (filedataBase64 && prompt) {
      try {
        const trimmed = (prompt || '').trim();
        const vagueRe = /^(?:\s*(?:qu(?:'|’)?est[-\s]?ce\s+que\s+c(?:'|’)?est|c(?:'|’)?est\s+quoi|cquoi|what(?:'|’)?s?\s+(?:this|that)|what\s+is\s+(?:this|that))\s*\??\s*)$/i;
        const clarified = `Veuillez analyser le fichier joint et répondre en vous basant sur ce fichier : ${trimmed}`;

        let replaced = false;
        for (let i = 0; i < contentParts.length; i++) {
          if (contentParts[i].text) {
            if (vagueRe.test(trimmed)) {
              contentParts[i].text = clarified;
            } else {
              contentParts[i].text = `Analyse le fichier joint puis répond : ${trimmed}`;
            }
            replaced = true;
            break;
          }
        }

        if (!replaced) {
          contentParts.push({ text: `Veuillez analyser le fichier joint et décrire ce que c'est.` });
        }
      } catch (err) {
        Logger.log('Erreur lors de la clarification du prompt avec fichier : ' + err);
      }
    }


    // Si le prompt est vide mais qu'un fichier est présent, on ajoute un prompt générique

    if (contentParts.length === 1 && filedataBase64 && !prompt) {

        if (fileType === 'audio') {

            contentParts.push({ text: "Décrivez l'audio que j'ai envoyé, s'il vous plaît." });

        } else if (fileType === 'image') {

            contentParts.push({ text: "Décrivez cette image en détail et analysez-la, s'il vous plaît." });

        } else {

            contentParts.push({ text: "Décrivez le fichier que j'ai envoyé, s'il vous plaît." });

        }

    }



    // **********************************************

    // ** 4. PARAMÈTRES DE LA REQUÊTE GEMINI (AVEC HISTORIQUE) **

    // **********************************************

   

    // Création du tableau 'contents': Historique + nouveau message utilisateur

    const contents = [...conversationHistory, { role: "user", parts: contentParts }];

   

    const payload = {

      // MODIFIÉ : On envoie tout l'historique + le message actuel

      contents: contents,

     

      // Instruction système pour orienter l'IA

      systemInstruction: {

        parts: [{

          text: "Tu es Morgann Music AI, un assistant intégré à Morgann Music CP, un distributeur musical. Aide les artistes en fournissant des conseils, des idées de pitch, des paroles et des recommandations de production. Si l'utilisateur a des questions administratives, dirige-le vers https://support.mm-cp.uk/ pour assistance supplémentaire. Réponds en français et sois professionnel et bienveillant."

        }]

      }

    };



    // Récupérer la clé depuis les Script Properties (ne pas la stocker en dur)
    const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!apiKey) {
      return response("Clé API Gemini manquante dans les propriétés du script. Merci de la renseigner dans Apps Script > Propriétés du script.", true);
    }

   

    // **********************************************

    // ** 5. APPEL DE L'API (AVEC GESTION DES ERREURS/RÉESSAIS) **

    // **********************************************

    let apiResponse;

    const maxAttempts = 3;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {

      try {

        // Construire un prompt texte simple en concaténant l'historique et le nouveau message
        // (plus robuste si l'API attend un prompt textuel plutôt que le schéma beta generateContent)
        const systemText = "Tu es Morgann Music AI, un assistant intégré à Morgann Music CP, un distributeur musical. Aide les artistes en fournissant des conseils, des idées de pitch, des paroles et des recommandations de production. Si l'utilisateur a des questions administratives, dirige-le vers https://support.mm-cp.uk/ pour assistance supplémentaire. Réponds en français et sois professionnel et bienveillant.";

        // Transforme l'historique en texte minimal
        const historyText = (conversationHistory || []).map(h => {
          const who = h.role || 'user';
          const part = (h.parts && h.parts[0] && (h.parts[0].text || h.parts[0].inlineData && '[FICHIER JOINT]')) || '';
          return `${who.toUpperCase()}: ${part}`;
        }).join('\n');

        const currentText = contentParts.map(p => p.text || (p.inlineData ? '[FICHIER JOINT]' : '')).join('\n');

        const finalPrompt = [systemText, historyText, 'UTILISATEUR: ' + currentText].filter(Boolean).join('\n\n');

        const requestPayload = {
          prompt: { text: finalPrompt },
          maxOutputTokens: 512,
          temperature: 0.2
        };

        const apiUrl = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generate?key=${apiKey}`;

        const options = {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify(requestPayload),
          muteHttpExceptions: true
        };

        apiResponse = UrlFetchApp.fetch(apiUrl, options);

        if (apiResponse.getResponseCode() === 200) {
          break; // Succès
        } else {
          Logger.log(`API failed on attempt ${attempt + 1}: ${apiResponse.getContentText().substring(0, 200)}`);
          if (attempt < maxAttempts - 1) {
            Utilities.sleep(1000 * Math.pow(2, attempt)); // Backoff exponentiel
          }
        }

      } catch (e) {

        Logger.log(`Fetch error on attempt ${attempt + 1}: ${e}`);

        if (attempt < maxAttempts - 1) {

          Utilities.sleep(1000 * Math.pow(2, attempt));

        }

      }

    }

   

    // **********************************************

    // ** 6. TRAITEMENT DE LA RÉPONSE & SAUVEGARDE **

    // **********************************************

    const responseText = apiResponse ? apiResponse.getContentText() : null;

    const responseCode = apiResponse ? apiResponse.getResponseCode() : 0;



    let generatedText = "Désolé, je n'ai pas pu générer de réponse claire.";



    if (responseCode === 200 && responseText) {
      try {
        let resultJson;
        try {
          resultJson = JSON.parse(responseText);
        } catch (parseErr) {
          Logger.log('JSON Parse Error (premier essai): ' + parseErr + '. Response length: ' + (responseText ? responseText.length : 0));
          // Tentative avancée : chercher l'ancre "candidates" puis extraire l'objet JSON
          let startIdx = -1;
          const anchor = responseText.indexOf('"candidates"');
          if (anchor !== -1) {
            startIdx = responseText.lastIndexOf('{', anchor);
          }
          if (startIdx === -1) {
            startIdx = responseText.indexOf('{');
          }

          if (startIdx !== -1) {
            // Balancer les accolades à partir de startIdx
            let depth = 0;
            let endIdx = -1;
            for (let i = startIdx; i < responseText.length; i++) {
              const ch = responseText.charAt(i);
              if (ch === '{') depth++;
              else if (ch === '}') {
                depth--;
                if (depth === 0) { endIdx = i; break; }
              }
            }
            if (endIdx !== -1) {
              const substr = responseText.substring(startIdx, endIdx + 1);
              try {
                resultJson = JSON.parse(substr);
                Logger.log('JSON Parse succeeded after brace-balanced extraction.');
              } catch (parseErr2) {
                Logger.log('JSON Parse Error (brace extraction) : ' + parseErr2);
                throw parseErr2;
              }
            } else {
              throw parseErr;
            }
          } else {
            throw parseErr;
          }
        }

        // Résolution robuste du texte généré en essayant plusieurs chemins possibles
        if (resultJson) {
          // 1) candidates[0].content as string
          if (resultJson.candidates && resultJson.candidates[0]) {
            const c0 = resultJson.candidates[0];
            if (typeof c0.content === 'string' && c0.content.trim()) {
              generatedText = c0.content;
            } else if (c0.content && c0.content.parts && c0.content.parts[0] && c0.content.parts[0].text) {
              generatedText = c0.content.parts[0].text;
            } else if (c0.output && typeof c0.output === 'string') {
              generatedText = c0.output;
            }
          }
          // 2) top-level output array
          if (!generatedText || generatedText === "Désolé, je n'ai pas pu générer de réponse claire.") {
            if (resultJson.output && Array.isArray(resultJson.output) && resultJson.output[0] && resultJson.output[0].content) {
              generatedText = resultJson.output[0].content;
            }
          }
          // 3) fallback: try to stringify some known fields
          if ((!generatedText || generatedText === "Désolé, je n'ai pas pu générer de réponse claire.") && resultJson.candidates && resultJson.candidates[0]) {
            try {
              generatedText = JSON.stringify(resultJson.candidates[0]).slice(0, 1000);
            } catch (err) { /* ignore */ }
          }
        }

        if (generatedText) {
          saveHistory(contentParts, generatedText);
        }

        return response(generatedText, false);
      } catch (e) {
        Logger.log('Erreur de parsing/traitement de la réponse : ' + e.toString());
        const snippet = responseText ? responseText.substring(0, 400) : 'Aucune réponse reçue.';
        return response(`Erreur lors du traitement de la réponse. La réponse de l'API n'était pas du JSON valide. Code HTTP: ${responseCode}. Texte reçu (début): ${snippet}`, true);
      }
    } else {
      // Erreur de l'API Gemini (ex: Code 403, 429)
      let errorDetail = responseText ? responseText.substring(0, 200) : 'Aucune réponse reçue.';
      if (responseCode !== 0) {
        errorDetail = `Code HTTP: ${responseCode}. Détails: ${errorDetail}`;
      }
      return response(`Erreur de l'API Morgann Music AI. ${errorDetail}`, true);
    }



  } catch (e) {

    // Erreur interne critique du GAS

    Logger.log("Main processing error (Internal GAS Script): " + e.toString());

    return response(`Erreur interne critique du script GAS : ${e.toString()}`, true);

  }

}



// **********************************************

// ** FONCTIONS UTILITAIRES DE RÉPONSE & CORS **

// **********************************************



/**

 * Fonction utilitaire pour renvoyer une réponse JSON formatée avec les entêtes CORS.

 */

function response(content, isError) {

  const output = ContentService.createTextOutput(JSON.stringify({

    response: content,

    error: isError ? content : null

  }))

  // C'est cette ligne qui gère implicitement le CORS pour les scripts GAS.

  .setMimeType(ContentService.MimeType.JSON);

 

  return output;

}



/**

 * Gère la requête OPTIONS (CORS Preflight)

 */

function doGet(e) {

  // Le ContentService gère aussi le CORS pour doGet/options

  return response("Ce script ne supporte que les requêtes POST. (OK pour OPTIONS)", false);

}