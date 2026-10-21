var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
function makeConversationTitle(input) {
  const raw = String(input || "").replace(/\s+/g, " ").trim();
  if (!raw) return "Nouvelle conversation";
  const cleaned = raw.replace(/[^\p{L}\p{N}\s-]/gu, "").trim();
  const words = cleaned.split(/\s+/).filter(Boolean).slice(0, 5);
  if (!words.length) return "Nouvelle conversation";
  const title = words.join(" ");
  return title.length > 42 ? `${title.slice(0, 39).trim()}\u2026` : title;
}
__name(makeConversationTitle, "makeConversationTitle");
async function listUserLitualConversations(env, uid) {
  const { results } = await env.DB.prepare(`
    SELECT * FROM litual_conversations
    WHERE user_uid = ?
    ORDER BY updated_at DESC, id DESC
  `).bind(uid).all();
  const conversations = await Promise.all((results || []).map(async (conversation) => {
    const msgRows = await env.DB.prepare(`
      SELECT id, role, content, created_at
      FROM litual_conversation_messages
      WHERE conversation_id = ?
      ORDER BY id ASC
    `).bind(conversation.id).all();
    return {
      ...conversation,
      messages: msgRows.results || []
    };
  }));
  return corsJson(conversations);
}
__name(listUserLitualConversations, "listUserLitualConversations");
async function createUserLitualConversation(env, uid, payload = {}) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const title = String(payload.title || makeConversationTitle(payload.first_message || payload.initial_message || "Nouvelle conversation")).trim();
  const firstMessage = payload.first_message || payload.initial_message || "";
  const insert = await env.DB.prepare(`
    INSERT INTO litual_conversations (user_uid, title, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `).bind(uid, title || "Nouvelle conversation", now, now).run();
  const conversationId = insert.meta.last_row_id;
  if (firstMessage) {
    await env.DB.prepare(`
      INSERT INTO litual_conversation_messages (conversation_id, role, content, created_at)
      VALUES (?, 'user', ?, ?)
    `).bind(conversationId, firstMessage, now).run();
  }
  return corsJson({
    id: conversationId,
    user_uid: uid,
    title: title || "Nouvelle conversation",
    created_at: now,
    updated_at: now,
    messages: firstMessage ? [{ role: "user", content: firstMessage, created_at: now }] : []
  }, 201);
}
__name(createUserLitualConversation, "createUserLitualConversation");
async function getUserLitualConversation(env, uid, conversationId) {
  const conversation = await env.DB.prepare(`
    SELECT * FROM litual_conversations
    WHERE id = ? AND user_uid = ?
  `).bind(conversationId, uid).first();
  if (!conversation) {
    return corsJson({ error: "Conversation introuvable" }, 404);
  }
  const { results: messages = [] } = await env.DB.prepare(`
    SELECT id, role, content, created_at
    FROM litual_conversation_messages
    WHERE conversation_id = ?
    ORDER BY id ASC
  `).bind(conversationId).all();
  return corsJson({
    ...conversation,
    messages
  });
}
__name(getUserLitualConversation, "getUserLitualConversation");
async function renameUserLitualConversation(env, uid, conversationId, payload = {}) {
  const title = String(payload.title || "").trim();
  if (!title) return corsJson({ error: "Titre invalide" }, 400);
  const conversation = await env.DB.prepare(`
    SELECT id FROM litual_conversations WHERE id = ? AND user_uid = ?
  `).bind(conversationId, uid).first();
  if (!conversation) {
    return corsJson({ error: "Conversation introuvable" }, 404);
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await env.DB.prepare(`
    UPDATE litual_conversations
    SET title = ?, updated_at = ?
    WHERE id = ? AND user_uid = ?
  `).bind(title, now, conversationId, uid).run();
  return corsJson({ success: true, title, updated_at: now });
}
__name(renameUserLitualConversation, "renameUserLitualConversation");
async function addUserLitualMessage(env, uid, conversationId, payload = {}) {
  const conversation = await env.DB.prepare(`
    SELECT id FROM litual_conversations WHERE id = ? AND user_uid = ?
  `).bind(conversationId, uid).first();
  if (!conversation) {
    return corsJson({ error: "Conversation introuvable" }, 404);
  }
  const role = String(payload.role || "user");
  const content = String(payload.content || "").trim();
  if (!content) {
    return corsJson({ error: "Contenu vide" }, 400);
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const result = await env.DB.prepare(`
    INSERT INTO litual_conversation_messages (conversation_id, role, content, created_at)
    VALUES (?, ?, ?, ?)
  `).bind(conversationId, role, content, now).run();
  await env.DB.prepare(`
    UPDATE litual_conversations
    SET updated_at = ?
    WHERE id = ?
  `).bind(now, conversationId).run();
  return corsJson({
    id: result.meta.last_row_id,
    conversation_id: conversationId,
    role,
    content,
    created_at: now
  }, 201);
}
__name(addUserLitualMessage, "addUserLitualMessage");
var index_default = {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return corsResponse(null, 204);
    }
    if (env.DB) {
      try {
        await ensureTables(env.DB);
      } catch (e) {
        console.error("Initialisation D1:", e);
      }
    }
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "");
    const method = request.method;
    try {
      if (method === "GET" && path === "/api/proxy-download") {
        const targetUrl = url.searchParams.get("url");
        if (!targetUrl) {
          return corsJson({ error: "URL cible manquante" }, 400);
        }
        try {
          const resp = await fetch(targetUrl);
          if (!resp.ok) {
            return corsJson({ error: `Erreur HTTP distante: ${resp.status}` }, resp.status);
          }
          const contentType = resp.headers.get("content-type") || "application/octet-stream";
          const buffer = await resp.arrayBuffer();
          return new Response(buffer, {
            headers: {
              ...corsHeaders(),
              "Content-Type": contentType
            }
          });
        } catch (err) {
          return corsJson({ error: `Erreur proxy: ${err.message}` }, 500);
        }
      }
      if (method === "POST" && path === "/api/newsletter/subscribe") {
        return await handlePublicNewsletterSubscribe(env, request, ctx);
      }
      if (method === "POST" && path === "/api/admin/send-email") {
        return await handleAdminSendEmail(env, request);
      }
      if (method === "GET" && path === "/api/admin/newsletter-recipients") {
        return await handleGetNewsletterRecipients(env);
      }
      if (method === "GET" && path === "/api/platforms") {
        return corsJson(LISTE_PLATFORMES);
      }
      if (method === "GET" && path === "/api/countries") {
        return corsJson(LISTE_PAYS);
      }
      if (method === "GET" && path === "/api/artists") {
        return await getAllArtists(env);
      }
      if (method === "GET" && path === "/api/feats") {
        return await getAllFeats(env);
      }
      if (method === "GET" && (path === "/api/releases" || path === "/api/admin/releases")) {
        return await getAllReleases(env, url);
      }
      if (method === "GET" && path === "/api/reviews") {
        return await getAllReviews(env);
      }
      if (method === "GET" && path === "/api/premiere") {
        return await getPublicPremiere(env, url);
      }
      if (method === "GET" && (path === "/api/greenlist" || path === "/api/admin/greenlist")) {
        return await getAllGreenlist(env);
      }
      if (method === "GET" && (path === "/api/blacklist" || path === "/api/admin/blacklist")) {
        return await getAllBlacklist(env);
      }
      if (method === "GET" && path === "/api/admin/newsletter") {
        return await handleGetNewsletterRecipients(env);
      }
      const labelItemMatch = path.match(/^\/api\/labels\/(\d+)$/);
      if (labelItemMatch) {
        const labelId = labelItemMatch[1];
        if (method === "GET") {
          try {
            const row = await env.DB.prepare("SELECT * FROM labels WHERE id = ?").bind(labelId).first();
            if (!row) return corsJson({ error: "Label non trouv\xE9" }, 404);
            return corsJson(row);
          } catch (err) {
            return corsJson({ error: err.message }, 500);
          }
        }
      }
      if (path === "/api/artists-labels") {
        if (method === "GET") {
          try {
            const labelId = url.searchParams.get("label_id");
            let query = 'SELECT * FROM "artistes-labels"';
            let params = [];
            if (labelId) {
              query += " WHERE id_label = ?";
              params.push(labelId);
            }
            query += " ORDER BY created_at DESC";
            const { results } = await env.DB.prepare(query).bind(...params).all();
            return corsJson(results || []);
          } catch (err) {
            return corsJson({ error: err.message }, 500);
          }
        }
        if (method === "POST") {
          try {
            const data = await request.json();
            const now = (/* @__PURE__ */ new Date()).toISOString();
            const nomArtiste = data.artiste || data.nom_artiste || "";
            const res = await env.DB.prepare(`
              INSERT INTO "artistes-labels" (nom, prenom, email, uid, id_label, artiste, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `).bind(
              data.nom || "",
              data.prenom || "",
              data.email || "",
              data.uid || "",
              String(data.id_label || ""),
              nomArtiste,
              now
            ).run();
            if (data.id_label && data.uid) {
              const labelRow = await env.DB.prepare("SELECT uid FROM labels WHERE id = ?").bind(data.id_label).first();
              if (labelRow) {
                const artistName = nomArtiste || `${data.prenom} ${data.nom}`;
                await env.DB.prepare(`
                  INSERT INTO artists (user_uid, name, contact_email, created_at)
                  VALUES (?, ?, ?, ?)
                `).bind(labelRow.uid, artistName, data.email, now).run();
                await sendNotification(
                  env,
                  ctx,
                  labelRow.uid,
                  "Nouvel artiste rejoint le label",
                  `${artistName} a rejoint votre label.`,
                  "label",
                  "/artistes.html"
                );
              }
            }
            return corsJson({ id: res.meta.last_row_id, success: true }, 201);
          } catch (err) {
            return corsJson({ error: err.message }, 500);
          }
        }
      }
      const artistLabelItemMatch = path.match(/^\/api\/artists-labels\/(\d+)$/);
      if (artistLabelItemMatch) {
        const inviteId = artistLabelItemMatch[1];
        if (method === "PUT" || method === "PATCH") {
          try {
            const data = await request.json();
            await env.DB.prepare(`
              UPDATE "artistes-labels" 
              SET nom = COALESCE(?, nom), 
                  prenom = COALESCE(?, prenom), 
                  email = COALESCE(?, email), 
                  artiste = COALESCE(?, artiste)
              WHERE id = ?
            `).bind(
              data.nom || null,
              data.prenom || null,
              data.email || null,
              data.artiste || data.nom_artiste || null,
              inviteId
            ).run();
            return corsJson({ success: true });
          } catch (err) {
            return corsJson({ error: err.message }, 500);
          }
        }
      }
      if (method === "GET" && path === "/api/versions") {
        return await getAllVersions(env);
      }
      if (method === "POST" && path === "/api/versions") {
        return await createVersionSafe(env, request);
      }
      const versionMatch = path.match(/^\/api\/versions\/(\d+)$/);
      if (versionMatch) {
        const versionId = versionMatch[1];
        if (method === "PUT" || method === "PATCH") {
          return await patchVersionSafe(env, versionId, request);
        }
      }
      if (method === "POST" && (path === "/api/messages" || path === "/api/admin/messages")) {
        return await createMessage(env, request);
      }
      if (path === "/api/support/tickets") {
        if (method === "POST") return await createSupportTicket(env, request, ctx);
        if (method === "GET") return await getSupportTickets(env, request);
      }
      const ticketMessagesMatch = path.match(/^\/api\/support\/tickets\/(\d+)\/messages$/);
      if (ticketMessagesMatch) {
        const ticketId = ticketMessagesMatch[1];
        if (method === "POST") return await addTicketMessage(env, ticketId, request, ctx);
      }
      const ticketUpdateMatch = path.match(/^\/api\/support\/tickets\/(\d+)$/);
      if (ticketUpdateMatch) {
        const ticketId = ticketUpdateMatch[1];
        if (method === "PUT" || method === "PATCH") return await updateTicketStatus(env, ticketId, request, ctx);
      }
      if (method === "GET" && path.startsWith("/api/files/")) {
        const key = decodeURIComponent(path.replace("/api/files/", ""));
        return await serveFile(env, key);
      }
      if (method === "GET" && path.match(/^\/api\/releases\/\d+$/)) {
        const releaseId = path.split("/").pop();
        return await getPublicRelease(env, releaseId);
      }
      if (method === "POST" && path === "/api/reviews") {
        return await upsertReview(env, request);
      }
      const reviewMatch = path.match(/^\/api\/reviews\/(\d+)$/);
      if (reviewMatch) {
        const reviewId = reviewMatch[1];
        if (method === "PUT" || method === "PATCH") {
          return await updateReview(env, reviewId, request);
        }
      }
      if (path === "/api/withdrawals") {
        if (method === "GET") return await getWithdrawalsSafe(env, request);
        if (method === "POST") return await createWithdrawalSafe(env, request);
      }
      const userPayoutsMatch = path.match(/^\/api\/users\/([^/]+)\/payouts$/);
      if (userPayoutsMatch) {
        const uid = userPayoutsMatch[1];
        if (method === "GET") return await getUserPayoutsSafe(env, uid, request);
        if (method === "POST") return await createUserPayoutSafe(env, uid, request);
      }
      const userFinancesMatch = path.match(/^\/api\/users\/([^/]+)\/finances$/);
      if (userFinancesMatch) {
        const uid = userFinancesMatch[1];
        if (method === "GET") return await getUserFinancesSafe(env, uid, request);
        if (method === "POST") {
          const userId2 = await extractUserId(request);
          const isAdminUser2 = userId2 ? await isAdmin(env, userId2) : true;
          return await createUserFinance(env, uid, request, isAdminUser2, ctx);
        }
      }
      const userId = await extractUserId(request);
      if (!userId) {
        return corsJson({ error: "Authentification requise" }, 401);
      }
      const isAdminUser = await isAdmin(env, userId);
      const userGreenlistMatch = path.match(/^\/api\/users\/([^/]+)\/greenlist$/);
      if (userGreenlistMatch) {
        const uid = userGreenlistMatch[1];
        const isSelf = uid === userId;
        if (!isSelf && !isAdminUser) return corsJson({ error: "Acc\xE8s non autoris\xE9" }, 403);
        if (method === "GET") return await getUserGreenlist(env, uid);
        if (method === "POST") return await createUserGreenlist(env, uid, request, ctx);
      }
      const userGreenlistItemMatch = path.match(/^\/api\/users\/([^/]+)\/greenlist\/(\d+)$/);
      if (userGreenlistItemMatch) {
        const uid = userGreenlistItemMatch[1];
        const itemId = userGreenlistItemMatch[2];
        const isSelf = uid === userId;
        if (!isSelf && !isAdminUser) return corsJson({ error: "Acc\xE8s non autoris\xE9" }, 403);
        if (method === "PATCH" || method === "PUT") return await patchUserGreenlist(env, uid, itemId, request, isAdminUser, ctx);
        if (method === "DELETE") return await deleteUserGreenlist(env, uid, itemId, isAdminUser);
      }
      const userBlacklistMatch = path.match(/^\/api\/users\/([^/]+)\/blacklist$/);
      if (userBlacklistMatch) {
        const uid = userBlacklistMatch[1];
        const isSelf = uid === userId;
        if (!isSelf && !isAdminUser) return corsJson({ error: "Acc\xE8s non autoris\xE9" }, 403);
        if (method === "GET") return await getUserBlacklist(env, uid);
        if (method === "POST") return await createUserBlacklist(env, uid, request, ctx);
      }
      const userBlacklistItemMatch = path.match(/^\/api\/users\/([^/]+)\/blacklist\/(\d+)$/);
      if (userBlacklistItemMatch) {
        const uid = userBlacklistItemMatch[1];
        const itemId = userBlacklistItemMatch[2];
        const isSelf = uid === userId;
        if (!isSelf && !isAdminUser) return corsJson({ error: "Acc\xE8s non autoris\xE9" }, 403);
        if (method === "PATCH" || method === "PUT") return await patchUserBlacklist(env, uid, itemId, request, isAdminUser, ctx);
        if (method === "DELETE") return await deleteUserBlacklist(env, uid, itemId, isAdminUser);
      }
      const userNotificationsReadAllMatch = path.match(/^\/api\/users\/([^/]+)\/notifications\/read-all$/);
      if (userNotificationsReadAllMatch) {
        const uid = userNotificationsReadAllMatch[1];
        const isSelf = uid === userId;
        if (!isSelf && !isAdminUser) return corsJson({ error: "Acc\xE8s non autoris\xE9" }, 403);
        if (method === "POST" || method === "PATCH" || method === "PUT") {
          return await markAllNotificationsRead(env, uid);
        }
      }
      const userNotificationsMatch = path.match(/^\/api\/users\/([^/]+)\/notifications$/);
      if (userNotificationsMatch) {
        const uid = userNotificationsMatch[1];
        const isSelf = uid === userId;
        if (!isSelf && !isAdminUser) return corsJson({ error: "Acc\xE8s non autoris\xE9" }, 403);
        if (method === "GET") return await getUserNotifications(env, uid);
        if (method === "POST") return await createUserNotification(env, uid, request, ctx);
      }
      const userNotificationItemMatch = path.match(/^\/api\/users\/([^/]+)\/notifications\/(\d+)$/);
      if (userNotificationItemMatch) {
        const uid = userNotificationItemMatch[1];
        const notifId = userNotificationItemMatch[2];
        const isSelf = uid === userId;
        if (!isSelf && !isAdminUser) return corsJson({ error: "Acc\xE8s non autoris\xE9" }, 403);
        if (method === "PATCH" || method === "PUT") return await patchUserNotification(env, uid, notifId, request);
        if (method === "DELETE") return await deleteUserNotification(env, uid, notifId);
      }
      if (method === "POST" && path === "/api/admin/notifications/broadcast") {
        return await broadcastNotification(env, request, isAdminUser, ctx);
      }
      if (method === "GET" && (path === "/api/admin/messages" || path === "/api/messages")) {
        return await getAllMessages(env, userId, isAdminUser);
      }
      if (method === "GET" && path === "/api/me") {
        return await getMe(env, userId);
      }
      const userDocumentsMatch = path.match(/^\/api\/users\/([^/]+)\/documents(\/([^/]+))?$/);
      if (userDocumentsMatch) {
        const uid = userDocumentsMatch[1];
        const docId = userDocumentsMatch[3];
        const isSelf = uid === userId;
        if (!isSelf && !isAdminUser) return corsJson({ error: "Acc\xE8s non autoris\xE9" }, 403);
        if (method === "GET") return await getUserDocuments(env, uid);
        if (method === "POST") return await createUserDocument(env, uid, request, isAdminUser, ctx);
        if (method === "DELETE" && docId) return await deleteUserDocument(env, uid, docId);
      }
      const userLitualListMatch = path.match(/^\/api\/users\/([^/]+)\/litual-conversations$/);
      if (userLitualListMatch) {
        const uid = userLitualListMatch[1];
        const isSelf = uid === userId;
        if (!isSelf && !isAdminUser) return corsJson({ error: "Acc\xE8s non autoris\xE9" }, 403);
        if (method === "GET") return await listUserLitualConversations(env, uid);
        if (method === "POST") return await createUserLitualConversation(env, uid, await request.json().catch(() => ({})));
      }
      const userLitualItemMatch = path.match(/^\/api\/users\/([^/]+)\/litual-conversations\/([0-9]+)$/);
      if (userLitualItemMatch) {
        const uid = userLitualItemMatch[1];
        const conversationId = userLitualItemMatch[2];
        const isSelf = uid === userId;
        if (!isSelf && !isAdminUser) return corsJson({ error: "Acc\xE8s non autoris\xE9" }, 403);
        if (method === "GET") return await getUserLitualConversation(env, uid, conversationId);
        if (method === "PATCH" || method === "PUT") return await renameUserLitualConversation(env, uid, conversationId, await request.json().catch(() => ({})));
      }
      const userLitualMessagesMatch = path.match(/^\/api\/users\/([^/]+)\/litual-conversations\/([0-9]+)\/messages$/);
      if (userLitualMessagesMatch) {
        const uid = userLitualMessagesMatch[1];
        const conversationId = userLitualMessagesMatch[2];
        const isSelf = uid === userId;
        if (!isSelf && !isAdminUser) return corsJson({ error: "Acc\xE8s non autoris\xE9" }, 403);
        if (method === "POST") return await addUserLitualMessage(env, uid, conversationId, await request.json().catch(() => ({})));
      }
      if (method === "GET" && (path === "/api/admin/users" || path === "/api/users")) {
        return await listUsers(env, userId, isAdminUser);
      }
      if (method === "GET" && (path === "/api/admin/withdrawals" || path === "/api/withdrawals")) {
        return await getAllWithdrawals(env, userId, isAdminUser);
      }
      if (method === "PATCH" && path.match(/^\/api\/admin\/withdrawals\/\d+$/)) {
        return await patchWithdrawal(env, userId, path, request, isAdminUser, ctx);
      }
      if (method === "POST" && path === "/api/admin/versions") {
        return await createVersion(env, request, userId, isAdminUser);
      }
      if (method === "PATCH" && path.match(/^\/api\/admin\/versions\/\d+$/)) {
        return await patchVersion(env, path, request, userId, isAdminUser);
      }
      if (method === "GET" && path.match(/^\/api\/admin\/releases\/\d+$/)) {
        return await getAdminRelease(env, path, isAdminUser);
      }
      if ((method === "PATCH" || method === "PUT") && path.match(/^\/api\/admin\/releases\/\d+$/)) {
        return await adminPatchRelease(env, userId, request, path, ctx);
      }
      if (method === "POST" && path === "/api/feats") {
        return await createFeat(env, userId, request);
      }
      const userMatch = path.match(/^\/api\/users\/([^/]+)$/);
      if (userMatch) {
        const uid = userMatch[1];
        const isSelf = uid === userId;
        if (!isSelf && !isAdminUser) {
          return corsJson({ error: "Acc\xE8s non autoris\xE9" }, 403);
        }
        if (method === "GET") return await getUser(env, uid);
        if (method === "PUT") return await upsertUser(env, uid, request);
        if (method === "PATCH") return await patchUser(env, uid, request);
      }
      const userLabelsMatch = path.match(/^\/api\/users\/([^/]+)\/labels$/);
      if (userLabelsMatch) {
        const uid = userLabelsMatch[1];
        const isSelf = uid === userId;
        if (!isSelf && !isAdminUser) return corsJson({ error: "Acc\xE8s non autoris\xE9" }, 403);
        if (method === "POST") return await createLabel(env, uid, request);
        if (method === "GET") return await getUserLabels(env, uid);
      }
      const userFinanceItemMatch = path.match(/^\/api\/users\/([^/]+)\/finances\/([^/]+)$/);
      if (userFinanceItemMatch) {
        const uid = userFinanceItemMatch[1];
        const financeId = userFinanceItemMatch[2];
        if (!isAdminUser && uid !== userId) return corsJson({ error: "Acc\xE8s non autoris\xE9" }, 403);
        if (method === "PATCH" || method === "PUT") return await patchUserFinance(env, uid, financeId, request, isAdminUser);
        if (method === "DELETE") return await deleteUserFinance(env, uid, financeId, isAdminUser);
      }
      const userTracksMatch = path.match(/^\/api\/users\/([^/]+)\/tracks$/);
      if (userTracksMatch) {
        const uid = userTracksMatch[1];
        const isSelf = uid === userId;
        if (!isSelf && !isAdminUser) return corsJson({ error: "Acc\xE8s non autoris\xE9" }, 403);
        if (method === "GET") return await getUserTracks(env, uid);
        if (method === "POST") return await createOrUpdateUserTrack(env, uid, request);
      }
      const userTrackMatch = path.match(/^\/api\/users\/([^/]+)\/tracks\/(.+)$/);
      if (userTrackMatch) {
        const uid = userTrackMatch[1];
        const trackId = decodeURIComponent(userTrackMatch[2]);
        const isSelf = uid === userId;
        if (!isSelf && !isAdminUser) return corsJson({ error: "Acc\xE8s non autoris\xE9" }, 403);
        if (method === "DELETE") return await deleteUserTrack(env, uid, trackId);
      }
      const userPlaysMatch = path.match(/^\/api\/users\/([^/]+)\/plays$/);
      if (userPlaysMatch) {
        const uid = userPlaysMatch[1];
        const isSelf = uid === userId;
        if (!isSelf && !isAdminUser) return corsJson({ error: "Acc\xE8s non autoris\xE9" }, 403);
        if (method === "GET") return await getUserPlays(env, uid);
        if (method === "POST") return await recordUserPlay(env, uid, request);
      }
      const userArtistsMatch = path.match(/^\/api\/users\/([^/]+)\/artists$/);
      if (userArtistsMatch) {
        const uid = userArtistsMatch[1];
        const isSelf = uid === userId;
        if (!isSelf && !isAdminUser) return corsJson({ error: "Acc\xE8s non autoris\xE9" }, 403);
        if (method === "GET") return await getUserArtists(env, uid);
        if (method === "POST") return await createArtist(env, uid, request);
      }
      const userArtistMatch = path.match(/^\/api\/users\/([^/]+)\/artists\/([^/]+)$/);
      if (userArtistMatch) {
        const uid = userArtistMatch[1];
        const artistId = userArtistMatch[2];
        const isSelf = uid === userId;
        if (!isSelf && !isAdminUser) return corsJson({ error: "Acc\xE8s non autoris\xE9" }, 403);
        if (method === "GET") return await getArtist(env, uid, artistId);
        if (method === "PATCH" || method === "PUT") return await patchArtist(env, uid, artistId, request);
        if (method === "DELETE") return await deleteArtist(env, uid, artistId);
      }
      const userReleasesMatch = path.match(/^\/api\/users\/([^/]+)\/releases$/);
      if (userReleasesMatch) {
        const uid = userReleasesMatch[1];
        const isSelf = uid === userId;
        if (!isSelf && !isAdminUser) return corsJson({ error: "Acc\xE8s non autoris\xE9" }, 403);
        if (method === "GET") return await getUserReleases(env, uid);
        if (method === "POST") return await createRelease(env, uid, request, ctx);
      }
      const userReleaseMatch = path.match(/^\/api\/users\/([^/]+)\/releases\/(\d+)$/);
      if (userReleaseMatch) {
        const uid = userReleaseMatch[1];
        const releaseId = userReleaseMatch[2];
        const isSelf = uid === userId;
        if (!isSelf && !isAdminUser) return corsJson({ error: "Acc\xE8s non autoris\xE9" }, 403);
        if (method === "PATCH" || method === "PUT") return await patchRelease(env, uid, releaseId, request, ctx);
        if (method === "GET") return await getRelease(env, uid, releaseId);
        if (method === "DELETE") return await deleteRelease(env, uid, releaseId);
      }
      const generalReleaseMatch = path.match(/^\/api\/releases\/(\d+)$/);
      if (generalReleaseMatch) {
        const releaseId = generalReleaseMatch[1];
        if (method === "GET") return await getPublicRelease(env, releaseId);
        if (method === "PATCH" || method === "PUT") {
          return await patchRelease(env, userId, releaseId, request, ctx);
        }
      }
      const userTracklistsMatch = path.match(/^\/api\/users\/([^/]+)\/tracklists$/);
      if (userTracklistsMatch) {
        const uid = userTracklistsMatch[1];
        if (method === "GET") return await getUserTracklists(env, uid);
        if (method === "POST") return await saveUserTracklists(env, uid, request);
      }
      const userEventsMatch = path.match(/^\/api\/users\/([^/]+)\/events$/);
      if (userEventsMatch) {
        const uid = userEventsMatch[1];
        if (method === "GET") return await getUserEvents(env, uid);
        if (method === "POST") return await saveUserEvents(env, uid, request);
      }
      const userFreeboardMatch = path.match(/^\/api\/users\/([^/]+)\/freeboard$/);
      if (userFreeboardMatch) {
        const uid = userFreeboardMatch[1];
        if (method === "GET") return await getUserFreeboard(env, uid);
        if (method === "POST") return await saveUserFreeboard(env, uid, request);
      }
      if (method === "POST" && path.startsWith("/api/upload/")) {
        const type = path.replace("/api/upload/", "");
        return await uploadFile(env, userId, type, request);
      }
      if (method === "POST" && path === "/api/upload/chunk") {
        return await uploadChunk(env, userId, request);
      }
      if (method === "POST" && path === "/api/upload/chunk/complete") {
        return await completeChunkUpload(env, userId, request);
      }
      if ((path === "/api/upload" || path.startsWith("/api/upload/")) && method === "POST") {
        const type = path.startsWith("/api/upload/") ? path.replace("/api/upload/", "") : "file";
        return await uploadFile(env, userId, type, request);
      }
      return corsJson({ error: "Route non trouv\xE9e" }, 404);
    } catch (err) {
      console.error("Worker error:", err);
      return corsJson({ error: `Erreur interne: ${err.message}` }, 500);
    }
  }
};
var LISTE_PLATFORMES = [
  "7Digital",
  "ACRCloud",
  "Alibaba",
  "AliGenie",
  "Amazon Music",
  "Anghami",
  "AGEDI",
  "Akazoo",
  "Apple Music",
  "ITunes",
  "AMI Entertainment",
  "Audible Magic - Fulfillment360",
  "Audible Magic - Rights360",
  "Audiomack",
  "Ambients App",
  "AWA",
  "Boomplay",
  "Beatsource",
  "BMAT",
  "Claro M\xFAsica",
  "ClickNClear",
  "Deezer",
  "Dubset",
  "DISCO",
  "Google Play",
  "Curve",
  "Gaana",
  "Gracenote",
  "FLO",
  "Hungama",
  "IHeart",
  "IMI Mobile",
  "Jaxsta",
  "JioSaavn",
  "Discogs",
  "JOOX",
  "Kanjian",
  "KDigital Media",
  "KKBOX",
  "LINE Music",
  "Mixcloud",
  "Medianet",
  "MoodAgent",
  "MusicToday",
  "MELON",
  "NetEase Cloud Music",
  "Pandora",
  "Peloton",
  "PEX",
  "Play Network",
  "Pretzel Rocks",
  "Qobuz",
  "Qub Musique",
  "Rebelation",
  "Rockbot",
  "Roxi",
  "Resso",
  "Rhapsody",
  "Napster",
  "Rakuten",
  "Shazam",
  "Rakuten Music",
  "Slacker Radio",
  "Snapchat",
  "Spinlet",
  "Soundtrack Your Brand",
  "Sirius XM",
  "Soundtrack By Twitch",
  "Twitch",
  "Spotify",
  "Tencent",
  "Tidal",
  "Styngr",
  "Tesla Music",
  "TouchTunes",
  "Jazzed",
  "MyMelo",
  "Fan Label",
  "Soundhound",
  "Soundmouse",
  "Kuaishou",
  "Supernatural",
  "Grandpad",
  "Traxsource",
  "Triller",
  "TikTok",
  "Trackdrip",
  "United Media Agency (UMA)",
  "Yandex",
  "VEVO",
  "YouTube Music",
  "Zvooq",
  "EMusic",
  "Beat.no",
  "Clone Digital",
  "Music Reports",
  "Mythical Games",
  "JPay",
  "Adaptr",
  "Pinterest",
  "Samsung Music",
  "Bandcamp",
  "VKontakte",
  "Qishui Music",
  "Kwai",
  "Canva",
  "Musixmatch",
  "Soda Music"
];
var LISTE_PAYS = [
  "Afghanistan",
  "Aland Islands",
  "Albania",
  "Algeria",
  "American Samoa",
  "Andorra",
  "Angola",
  "Anguilla",
  "Antarctica",
  "Antigua And Barbuda",
  "Argentina",
  "Armenia",
  "Aruba",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bahamas",
  "Bahrain",
  "Bangladesh",
  "Barbados",
  "Belarus",
  "Belgium",
  "Belize",
  "Benin",
  "Bermuda",
  "Bhutan",
  "Bolivia",
  "Bosnia And Herzegovina",
  "Botswana",
  "Brazil",
  "Brunei Darussalam",
  "Bulgaria",
  "Burkina Faso",
  "Burundi",
  "Cambodia",
  "Cameroon",
  "Canada",
  "Cape Verde",
  "Cayman Islands",
  "Central African Republic",
  "Chad",
  "Chile",
  "China",
  "Colombia",
  "Comoros",
  "Congo",
  "Costa Rica",
  "Cote D'Ivoire",
  "Croatia",
  "Cuba",
  "Cyprus",
  "Czech Republic",
  "Denmark",
  "Djibouti",
  "Dominica",
  "Dominican Republic",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Equatorial Guinea",
  "Eritrea",
  "Estonia",
  "Ethiopia",
  "Fiji",
  "Finland",
  "France",
  "French Guiana",
  "French Polynesia",
  "Gabon",
  "Gambia",
  "Georgia",
  "Germany",
  "Ghana",
  "Gibraltar",
  "Greece",
  "Greenland",
  "Grenada",
  "Guadeloupe",
  "Guatemala",
  "Guinea",
  "Haiti",
  "Holy See (Vatican City State)",
  "Honduras",
  "Hong Kong",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Jamaica",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Korea",
  "Kuwait",
  "Kyrgyzstan",
  "Latvia",
  "Lebanon",
  "Lesotho",
  "Liberia",
  "Libya",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Macao",
  "Macedonia",
  "Madagascar",
  "Malawi",
  "Malaysia",
  "Maldives",
  "Mali",
  "Malta",
  "Martinique",
  "Mauritania",
  "Mauritius",
  "Mayotte",
  "Mexico",
  "Moldova",
  "Monaco",
  "Mongolia",
  "Montenegro",
  "Morocco",
  "Mozambique",
  "Myanmar",
  "Namibia",
  "Nepal",
  "Netherlands",
  "New Caledonia",
  "New Zealand",
  "Nicaragua",
  "Niger",
  "Nigeria",
  "Norway",
  "Oman",
  "Pakistan",
  "Panama",
  "Papua New Guinea",
  "Paraguay",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Puerto Rico",
  "Qatar",
  "Reunion",
  "Romania",
  "Russian Federation",
  "Rwanda",
  "Saint Barthelemy",
  "Saint Lucia",
  "Samoa",
  "San Marino",
  "Saudi Arabia",
  "Senegal",
  "Serbia",
  "Seychelles",
  "Sierra Leone",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "South Africa",
  "Spain",
  "Sri Lanka",
  "Sudan",
  "Suriname",
  "Sweden",
  "Switzerland",
  "Syrian Arab Republic",
  "Taiwan",
  "Tajikistan",
  "Tanzania",
  "Thailand",
  "Togo",
  "Trinidad And Tobago",
  "Tunisia",
  "Turkey",
  "Turkmenistan",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Uzbekistan",
  "Vanuatu",
  "Venezuela",
  "Viet Nam",
  "Yemen",
  "Zambia",
  "Zimbabwe"
];
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With"
  };
}
__name(corsHeaders, "corsHeaders");
function corsResponse(body, status = 200) {
  return new Response(body, { status, headers: corsHeaders() });
}
__name(corsResponse, "corsResponse");
function corsJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" }
  });
}
__name(corsJson, "corsJson");
function getBucket(env, type = "file") {
  const isMediaUpload = ["track", "atmos", "inst", "motion", "cover", "pochette", "lrics", "lyrics", "document", "logo"].includes(type);
  if (isMediaUpload) {
    return env.STORAGE || env.BUCKET || env.MEDIA_BUCKET || env.R2 || null;
  }
  return env.BUCKET || env.MEDIA_BUCKET || env.STORAGE || env.R2 || null;
}
__name(getBucket, "getBucket");
function getContentType(ext) {
  const map = {
    wav: "audio/wav",
    mp3: "audio/mpeg",
    flac: "audio/flac",
    m4a: "audio/mp4",
    caf: "audio/x-caf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    svg: "image/svg+xml",
    mp4: "video/mp4",
    mov: "video/quicktime",
    lrc: "text/plain",
    srt: "text/plain",
    txt: "text/plain",
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  };
  return map[ext.toLowerCase()] || "application/octet-stream";
}
__name(getContentType, "getContentType");
function buildHtmlEmail({ firstName, title, message, actionUrl }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Morgann Music CP</title>
</head>
<body style="margin: 0; padding: 0; background-color: #EAFFC6; font-family: 'Segoe UI', Arial, sans-serif;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #EAFFC6; table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 0 0 40px 0;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #FC8FB0; text-align: center;">
          <tr>
            <td style="padding: 16px 20px;">
              <a href="https://mm-cp.uk/portail/" style="color: #EAFFC6; text-decoration: none; font-weight: 700; font-size: 15px; margin-right: 25px;">Portail</a>
              <a href="https://mm-cp.uk/" style="color: #EAFFC6; text-decoration: none; font-weight: 700; font-size: 15px;">Accueil</a>
            </td>
          </tr>
        </table>
        <table border="0" cellpadding="0" cellspacing="0" width="90%" style="max-width: 580px; margin-top: 30px; background-color: #f8ffe7; border-radius: 36px; box-shadow: 0 12px 28px rgba(0, 0, 0, 0.15); border: 1px solid #e1f5be;">
          <tr>
            <td style="padding: 35px 25px; text-align: center;">
              <div style="margin-bottom: 20px;">
                <img src="https://mm-cp.uk/assets/img/icons/sombre.png" alt="Logo MMCP" width="90" height="auto" style="display: block; margin: 0 auto; border: 0; width: 90px; outline: none; text-decoration: none;">
              </div>
              <h1 style="color: #2c3e10; font-size: 22px; font-weight: 800; margin: 0 0 8px 0; font-family: sans-serif;">Bonjour ${firstName} !</h1>
              <h2 style="color: #556b2f; font-size: 15px; margin: 0 0 25px 0; font-weight: 400; line-height: 1.4; font-family: sans-serif;">Vous avez re\xE7u une nouvelle notification sur votre portail.</h2>
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border-radius: 24px; border: 1px solid #e0f0c0; text-align: left; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 22px;">
                    <h3 style="color: #FC8FB0; font-size: 18px; margin: 0 0 10px 0; font-weight: 800; font-family: sans-serif;">${title}</h3>
                    <p style="color: #3e2837; font-size: 14px; margin: 0 0 20px 0; line-height: 1.5; white-space: pre-line; font-family: sans-serif;">${message}</p>
                    <div style="text-align: center; margin-top: 15px;">
                      <a href="${actionUrl}" style="display: inline-block; background-color: #FC8FB0; color: #EAFFC6; text-decoration: none; padding: 12px 28px; border-radius: 50px; font-weight: 700; font-size: 14px; font-family: sans-serif;">Voir en d\xE9tail</a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <table border="0" cellpadding="0" cellspacing="0" width="90%" style="max-width: 580px; margin-top: 20px; text-align: center;">
          <tr>
            <td style="color: #789048; font-size: 12px; line-height: 1.6; padding: 10px; font-family: sans-serif;">
              <p style="margin: 0 0 4px 0;">\xA9 Morgann Music CP \u2014 Tous droits r\xE9serv\xE9s.</p>
              <p style="margin: 0;">Cet e-mail automatique a \xE9t\xE9 envoy\xE9 suite \xE0 une activit\xE9 sur votre compte.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
__name(buildHtmlEmail, "buildHtmlEmail");
function buildNewsletterWelcomeEmail({ name }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenue | Newsletter Morgann Music CP</title>
</head>
<body style="margin: 0; padding: 0; background-color: #EAFFC6; font-family: 'Segoe UI', Arial, sans-serif;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #EAFFC6; table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 0 0 40px 0;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #FC8FB0; text-align: center;">
          <tr>
            <td style="padding: 16px 20px;">
              <a href="https://mm-cp.uk/portail/" style="color: #EAFFC6; text-decoration: none; font-weight: 700; font-size: 15px; margin-right: 25px;">Portail</a>
              <a href="https://mm-cp.uk/" style="color: #EAFFC6; text-decoration: none; font-weight: 700; font-size: 15px;">Accueil</a>
            </td>
          </tr>
        </table>
        <table border="0" cellpadding="0" cellspacing="0" width="90%" style="max-width: 580px; margin-top: 30px; background-color: #f8ffe7; border-radius: 36px; box-shadow: 0 12px 28px rgba(0, 0, 0, 0.15); border: 1px solid #e1f5be;">
          <tr>
            <td style="padding: 35px 30px; text-align: left;">
              <div style="text-align: center; margin-bottom: 20px;">
                <img src="https://mm-cp.uk/assets/img/icons/sombre.png" alt="Logo MMCP" width="90" height="auto" style="display: block; margin: 0 auto; border: 0; width: 90px; outline: none; text-decoration: none;">
              </div>
              <h1 style="color: #2c3e10; font-size: 24px; font-weight: 800; margin: 0 0 10px 0; text-align: center; font-family: sans-serif;">Bienvenue ${name} ! \u{1F3B5}</h1>
              <p style="color: #556b2f; font-size: 15px; margin: 0 0 25px 0; text-align: center; font-weight: 500; font-family: sans-serif;">Merci de rejoindre la communaut\xE9 Morgann Music CP.</p>
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border-radius: 24px; border: 1px solid #e0f0c0; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 25px;">
                    <h2 style="color: #FC8FB0; font-size: 17px; margin: 0 0 12px 0; font-weight: 800; font-family: sans-serif;">Que allez-vous recevoir ?</h2>
                    <p style="color: #3e2837; font-size: 14px; margin: 0 0 15px 0; line-height: 1.6; font-family: sans-serif;">
                      Vous recevrez d\xE9sormais directement dans votre bo\xEEte mail :
                    </p>
                    <ul style="color: #3e2837; font-size: 14px; margin: 0 0 20px 0; padding-left: 20px; line-height: 1.6; font-family: sans-serif;">
                      <li style="margin-bottom: 8px;">Les derni\xE8res actualit\xE9s et annonces de sorties du label.</li>
                      <li style="margin-bottom: 8px;">Des conseils exclusifs pour propulser votre carri\xE8re artistique.</li>
                      <li>Des avant-premi\xE8res et des surprises r\xE9serv\xE9es \xE0 nos abonn\xE9s.</li>
                    </ul>
                    <div style="text-align: center; margin-top: 25px;">
                      <a href="https://mm-cp.uk/" style="display: inline-block; background-color: #FC8FB0; color: #EAFFC6; text-decoration: none; padding: 12px 30px; border-radius: 50px; font-weight: 700; font-size: 14px; font-family: sans-serif;">Visiter notre site</a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <table border="0" cellpadding="0" cellspacing="0" width="90%" style="max-width: 580px; margin-top: 20px; text-align: center;">
          <tr>
            <td style="color: #789048; font-size: 12px; line-height: 1.6; padding: 10px; font-family: sans-serif;">
              <p style="margin: 0 0 4px 0;">\xA9 Morgann Music CP \u2014 Tous droits r\xE9serv\xE9s.</p>
              <p style="margin: 0;">Vous recevez cet e-mail suite \xE0 votre inscription sur notre site.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
__name(buildNewsletterWelcomeEmail, "buildNewsletterWelcomeEmail");
async function sendBrevoEmail(env, { toEmail, toName, subject, htmlContent, senderEmail, senderName, replyToEmail }) {
  if (!env.BREVO_API_KEY) {
    console.error("Cl\xE9 BREVO_API_KEY non disponible dans le Worker.");
    return false;
  }
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": env.BREVO_API_KEY,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sender: {
          name: senderName || env.SENDER_NAME || "Morgann Music CP",
          email: senderEmail || env.SENDER_EMAIL || "notifications@mm-cp.uk"
        },
        replyTo: {
          email: replyToEmail || "support@mm-cp.uk",
          name: "Support Morgann Music CP"
        },
        to: [{ email: toEmail, name: toName || toEmail }],
        subject,
        htmlContent,
        trackingSettings: {
          clickTracking: false
        }
      })
    });
    if (!res.ok) {
      const errBody = await res.text();
      console.error(`Erreur HTTP Brevo (${res.status}):`, errBody);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Erreur d'ex\xE9cution de la requ\xEAte Brevo :", err);
    return false;
  }
}
__name(sendBrevoEmail, "sendBrevoEmail");
async function handlePublicNewsletterSubscribe(env, request, ctx) {
  try {
    const data = await request.json();
    const name = String(data.name || "").trim();
    const email = String(data.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return corsJson({ error: "Adresse e-mail invalide" }, 400);
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    try {
      await env.DB.prepare(`
        INSERT INTO newsletter (email, name, created_at)
        VALUES (?, ?, ?)
        ON CONFLICT(email) DO UPDATE SET name = COALESCE(?, name)
      `).bind(email, name || "Abonn\xE9", now, name || null).run();
    } catch (dbErr) {
      console.error("Erreur insertion table newsletter:", dbErr);
    }
    const htmlContent = buildNewsletterWelcomeEmail({ name: name || "cher abonn\xE9" });
    const subject = "Bienvenue dans la newsletter de Morgann Music CP ! \u{1F3B5}";
    if (ctx && typeof ctx.waitUntil === "function") {
      ctx.waitUntil(
        sendBrevoEmail(env, {
          toEmail: email,
          toName: name || email,
          subject,
          htmlContent
        })
      );
    } else {
      await sendBrevoEmail(env, {
        toEmail: email,
        toName: name || email,
        subject,
        htmlContent
      });
    }
    return corsJson({ success: true, message: "Inscription r\xE9ussie et e-mail de bienvenue envoy\xE9." }, 201);
  } catch (err) {
    console.error("Erreur handlePublicNewsletterSubscribe:", err);
    return corsJson({ error: `Erreur interne: ${err.message}` }, 500);
  }
}
__name(handlePublicNewsletterSubscribe, "handlePublicNewsletterSubscribe");
async function handleAdminSendEmail(env, request) {
  try {
    const data = await request.json();
    const type = data.type;
    const subject = data.subject;
    const senderEmail = data.senderEmail || "notifications@mm-cp.uk";
    const replyToEmail = data.replyToEmail || "support@mm-cp.uk";
    const htmlContent = data.htmlContent;
    const recipients = data.recipients;
    if (!subject || !htmlContent) {
      return corsJson({ error: "Sujet ou contenu manquant" }, 400);
    }
    let targetEmails = [];
    if (type === "transactional") {
      if (Array.isArray(recipients)) {
        targetEmails = recipients;
      } else if (recipients === "all") {
        const { results } = await env.DB.prepare("SELECT email FROM users WHERE email IS NOT NULL AND email != ''").all();
        targetEmails = (results || []).map((u) => u.email);
      } else if (typeof recipients === "string" && recipients.includes("@")) {
        targetEmails = [recipients];
      }
    } else if (type === "newsletter") {
      const { results: userRows } = await env.DB.prepare(
        "SELECT email FROM users WHERE newsletter_enabled = 1 AND email IS NOT NULL AND email != ''"
      ).all();
      const { results: subRows } = await env.DB.prepare(
        "SELECT email FROM newsletter WHERE email IS NOT NULL AND email != ''"
      ).all();
      const combined = /* @__PURE__ */ new Set([
        ...(userRows || []).map((r) => r.email),
        ...(subRows || []).map((r) => r.email)
      ]);
      targetEmails = Array.from(combined);
    }
    if (targetEmails.length === 0) {
      return corsJson({ error: "Aucun destinataire valide trouv\xE9 pour cet envoi." }, 400);
    }
    let successCount = 0;
    for (const email of targetEmails) {
      const sent = await sendBrevoEmail(env, {
        toEmail: email,
        toName: email,
        subject,
        htmlContent,
        senderEmail,
        replyToEmail
      });
      if (sent) successCount++;
    }
    return corsJson({ success: true, sentCount: successCount, total: targetEmails.length });
  } catch (err) {
    console.error("Erreur handleAdminSendEmail:", err);
    return corsJson({ error: err.message }, 500);
  }
}
__name(handleAdminSendEmail, "handleAdminSendEmail");
async function handleGetNewsletterRecipients(env) {
  try {
    const { results: userRows } = await env.DB.prepare(
      "SELECT email, first_name, full_name, artist_name FROM users WHERE newsletter_enabled = 1 AND email IS NOT NULL AND email != ''"
    ).all();
    const { results: subRows } = await env.DB.prepare(
      "SELECT email, name FROM newsletter WHERE email IS NOT NULL AND email != ''"
    ).all();
    return corsJson({
      users: userRows || [],
      subscribers: subRows || []
    });
  } catch (err) {
    return corsJson({ error: err.message }, 500);
  }
}
__name(handleGetNewsletterRecipients, "handleGetNewsletterRecipients");
function formatGreenlistRow(row) {
  if (!row) return null;
  let links = [];
  try {
    links = JSON.parse(row.links || "[]");
  } catch (e) {
    links = row.links ? [row.links] : [];
  }
  return {
    id: row.id,
    userUid: row.user_uid,
    platform: row.platform,
    releaseId: row.release_id,
    releaseTitle: row.release_title,
    links,
    status: row.status || "Demand\xE9",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
__name(formatGreenlistRow, "formatGreenlistRow");
async function getUserGreenlist(env, uid) {
  try {
    const { results } = await env.DB.prepare(
      "SELECT * FROM greenlist WHERE user_uid = ? ORDER BY created_at DESC"
    ).bind(uid).all();
    return corsJson((results || []).map(formatGreenlistRow));
  } catch (err) {
    return corsJson([], 200);
  }
}
__name(getUserGreenlist, "getUserGreenlist");
async function getAllGreenlist(env) {
  try {
    const { results } = await env.DB.prepare("SELECT * FROM greenlist ORDER BY created_at DESC").all();
    return corsJson((results || []).map(formatGreenlistRow));
  } catch (err) {
    return corsJson([], 200);
  }
}
__name(getAllGreenlist, "getAllGreenlist");
async function createUserGreenlist(env, uid, request, ctx) {
  try {
    const data = await request.json();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const platform = data.platform || "";
    const releaseId = data.releaseId || "";
    const releaseTitle = data.releaseTitle || "";
    const links = JSON.stringify(Array.isArray(data.links) ? data.links : data.link ? [data.link] : []);
    const status = data.status || "Demand\xE9";
    const res = await env.DB.prepare(`
      INSERT INTO greenlist (user_uid, platform, release_id, release_title, links, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(uid, platform, releaseId, releaseTitle, links, status, now, now).run();
    await sendNotification(
      env,
      ctx,
      uid,
      "Demande GreenList enregistr\xE9e",
      `Votre demande GreenList pour "${releaseTitle || platform}" a \xE9t\xE9 enregistr\xE9e avec le statut "${status}".`,
      "greenlist",
      "/liste.html"
    );
    return corsJson({ id: res.meta.last_row_id, success: true }, 201);
  } catch (err) {
    return corsJson({ error: err.message }, 500);
  }
}
__name(createUserGreenlist, "createUserGreenlist");
async function patchUserGreenlist(env, uid, itemId, request, isAdminUser, ctx) {
  try {
    const data = await request.json();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await env.DB.prepare(`
      UPDATE greenlist
      SET status = COALESCE(?, status),
          links = COALESCE(?, links),
          platform = COALESCE(?, platform),
          updated_at = ?
      WHERE id = ? AND (user_uid = ? OR ? = 1)
    `).bind(
      data.status || null,
      data.links ? JSON.stringify(data.links) : null,
      data.platform || null,
      now,
      itemId,
      uid,
      isAdminUser ? 1 : 0
    ).run();
    return corsJson({ success: true });
  } catch (err) {
    return corsJson({ error: err.message }, 500);
  }
}
__name(patchUserGreenlist, "patchUserGreenlist");
async function deleteUserGreenlist(env, uid, itemId, isAdminUser) {
  try {
    await env.DB.prepare(`
      DELETE FROM greenlist WHERE id = ? AND (user_uid = ? OR ? = 1)
    `).bind(itemId, uid, isAdminUser ? 1 : 0).run();
    return corsJson({ success: true });
  } catch (err) {
    return corsJson({ error: err.message }, 500);
  }
}
__name(deleteUserGreenlist, "deleteUserGreenlist");
function formatBlacklistRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userUid: row.user_uid,
    platform: row.platform,
    releaseId: row.release_id,
    releaseTitle: row.release_title,
    track: row.track,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status || "Demand\xE9",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
__name(formatBlacklistRow, "formatBlacklistRow");
async function getUserBlacklist(env, uid) {
  try {
    const { results } = await env.DB.prepare(
      "SELECT * FROM blacklist WHERE user_uid = ? ORDER BY created_at DESC"
    ).bind(uid).all();
    return corsJson((results || []).map(formatBlacklistRow));
  } catch (err) {
    return corsJson([], 200);
  }
}
__name(getUserBlacklist, "getUserBlacklist");
async function getAllBlacklist(env) {
  try {
    const { results } = await env.DB.prepare("SELECT * FROM blacklist ORDER BY created_at DESC").all();
    return corsJson((results || []).map(formatBlacklistRow));
  } catch (err) {
    return corsJson([], 200);
  }
}
__name(getAllBlacklist, "getAllBlacklist");
async function createUserBlacklist(env, uid, request, ctx) {
  try {
    const data = await request.json();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const platform = data.platform || "";
    const releaseId = data.releaseId || "";
    const releaseTitle = data.releaseTitle || "";
    const track = data.track || "";
    const startDate = data.startDate || null;
    const endDate = data.endDate || null;
    const status = data.status || "Demand\xE9";
    const res = await env.DB.prepare(`
      INSERT INTO blacklist (user_uid, platform, release_id, release_title, track, start_date, end_date, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(uid, platform, releaseId, releaseTitle, track, startDate, endDate, status, now, now).run();
    await sendNotification(
      env,
      ctx,
      uid,
      "Demande BlackList enregistr\xE9e",
      `Votre demande BlackList pour "${releaseTitle || platform}" (piste: ${track}) a \xE9t\xE9 enregistr\xE9e avec le statut "${status}".`,
      "blacklist",
      "/liste.html"
    );
    return corsJson({ id: res.meta.last_row_id, success: true }, 201);
  } catch (err) {
    return corsJson({ error: err.message }, 500);
  }
}
__name(createUserBlacklist, "createUserBlacklist");
async function patchUserBlacklist(env, uid, itemId, request, isAdminUser, ctx) {
  try {
    const data = await request.json();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await env.DB.prepare(`
      UPDATE blacklist
      SET status = COALESCE(?, status),
          track = COALESCE(?, track),
          start_date = COALESCE(?, start_date),
          end_date = COALESCE(?, end_date),
          updated_at = ?
      WHERE id = ? AND (user_uid = ? OR ? = 1)
    `).bind(
      data.status || null,
      data.track || null,
      data.startDate !== void 0 ? data.startDate : null,
      data.endDate !== void 0 ? data.endDate : null,
      now,
      itemId,
      uid,
      isAdminUser ? 1 : 0
    ).run();
    return corsJson({ success: true });
  } catch (err) {
    return corsJson({ error: err.message }, 500);
  }
}
__name(patchUserBlacklist, "patchUserBlacklist");
async function deleteUserBlacklist(env, uid, itemId, isAdminUser) {
  try {
    await env.DB.prepare(`
      DELETE FROM blacklist WHERE id = ? AND (user_uid = ? OR ? = 1)
    `).bind(itemId, uid, isAdminUser ? 1 : 0).run();
    return corsJson({ success: true });
  } catch (err) {
    return corsJson({ error: err.message }, 500);
  }
}
__name(deleteUserBlacklist, "deleteUserBlacklist");
async function triggerReleaseStatusNotification(env, ctx, userUid, releaseTitle, releaseId, oldStatus, newStatus) {
  if (!userUid || !newStatus || oldStatus === newStatus) return;
  const notifTitle = `Sortie "${releaseTitle}" : statut mis \xE0 jour`;
  const notifMessage = `Votre projet "${releaseTitle}" est pass\xE9 du statut "${oldStatus || "brouillon"}" au statut : ${newStatus.toUpperCase()}.`;
  const notifLink = `/portail/sortie.html?id=${releaseId}`;
  await sendNotification(env, ctx, userUid, notifTitle, notifMessage, "release", notifLink);
}
__name(triggerReleaseStatusNotification, "triggerReleaseStatusNotification");
async function sendNotification(env, ctx, uid, title, message, type = "info", link = null) {
  try {
    if (!uid) return;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await env.DB.prepare(`
      INSERT INTO notifications (user_uid, title, message, type, is_read, link, created_at)
      VALUES (?, ?, ?, ?, 0, ?, ?)
    `).bind(uid, title || "Notification", message || "", type, link || null, now).run();
    const user = await env.DB.prepare(
      "SELECT email, first_name, full_name FROM users WHERE uid = ?"
    ).bind(uid).first();
    if (user && user.email) {
      const firstName = user.first_name || user.full_name || "Artiste";
      const actionUrl = link ? link.startsWith("http") ? link : `https://mm-cp.uk${link}` : "https://mm-cp.uk/portail/notifications";
      const htmlContent = buildHtmlEmail({
        firstName,
        title,
        message,
        actionUrl
      });
      if (ctx && typeof ctx.waitUntil === "function") {
        ctx.waitUntil(
          sendBrevoEmail(env, {
            toEmail: user.email,
            toName: firstName,
            subject: title,
            htmlContent
          })
        );
      } else {
        await sendBrevoEmail(env, {
          toEmail: user.email,
          toName: firstName,
          subject: title,
          htmlContent
        });
      }
    }
  } catch (err) {
    console.error("Erreur d'envoi de notification et d'e-mail:", err);
  }
}
__name(sendNotification, "sendNotification");
function formatNotificationRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userUid: row.user_uid,
    title: row.title,
    message: row.message,
    type: row.type || "info",
    isRead: Boolean(row.is_read),
    read: Boolean(row.is_read),
    link: row.link || null,
    createdAt: row.created_at
  };
}
__name(formatNotificationRow, "formatNotificationRow");
async function getUserNotifications(env, uid) {
  try {
    const { results } = await env.DB.prepare(`
      SELECT * FROM notifications 
      WHERE user_uid = ? 
      ORDER BY created_at DESC
    `).bind(uid).all();
    return corsJson((results || []).map(formatNotificationRow));
  } catch (err) {
    return corsJson([], 200);
  }
}
__name(getUserNotifications, "getUserNotifications");
async function createUserNotification(env, uid, request, ctx) {
  try {
    const data = await request.json();
    const title = data.title || data.titre || "Notification";
    const message = data.message || data.body || data.text || "";
    const type = data.type || "info";
    const link = data.link || null;
    const tenSecondsAgo = new Date(Date.now() - 1e4).toISOString();
    const existingNotif = await env.DB.prepare(`
      SELECT id FROM notifications
      WHERE user_uid = ? AND title = ? AND created_at >= ?
    `).bind(uid, title, tenSecondsAgo).first();
    if (existingNotif) {
      return corsJson({
        success: true,
        duplicate: true,
        id: existingNotif.id
      }, 200);
    }
    await sendNotification(env, ctx, uid, title, message, type, link);
    return corsJson({ success: true }, 201);
  } catch (err) {
    return corsJson({ error: err.message }, 500);
  }
}
__name(createUserNotification, "createUserNotification");
async function patchUserNotification(env, uid, notifId, request) {
  try {
    const data = await request.json();
    const isRead = data.isRead !== void 0 ? data.isRead ? 1 : 0 : data.read !== void 0 ? data.read ? 1 : 0 : null;
    await env.DB.prepare(`
      UPDATE notifications 
      SET is_read = COALESCE(?, is_read),
          title = COALESCE(?, title),
          message = COALESCE(?, message)
      WHERE id = ? AND user_uid = ?
    `).bind(
      isRead,
      data.title !== void 0 ? data.title : null,
      data.message !== void 0 ? data.message : null,
      notifId,
      uid
    ).run();
    return corsJson({ success: true });
  } catch (err) {
    return corsJson({ error: err.message }, 500);
  }
}
__name(patchUserNotification, "patchUserNotification");
async function markAllNotificationsRead(env, uid) {
  try {
    await env.DB.prepare(`
      UPDATE notifications SET is_read = 1 WHERE user_uid = ?
    `).bind(uid).run();
    return corsJson({ success: true });
  } catch (err) {
    return corsJson({ error: err.message }, 500);
  }
}
__name(markAllNotificationsRead, "markAllNotificationsRead");
async function deleteUserNotification(env, uid, notifId) {
  try {
    await env.DB.prepare(`
      DELETE FROM notifications WHERE id = ? AND user_uid = ?
    `).bind(notifId, uid).run();
    return corsJson({ success: true });
  } catch (err) {
    return corsJson({ error: err.message }, 500);
  }
}
__name(deleteUserNotification, "deleteUserNotification");
async function broadcastNotification(env, request, isAdminUser, ctx) {
  if (!isAdminUser) return corsJson({ error: "Acc\xE8s non autoris\xE9" }, 403);
  try {
    const data = await request.json();
    const title = data.title || "Information";
    const message = data.message || "";
    const type = data.type || "system";
    const link = data.link || null;
    const { results } = await env.DB.prepare("SELECT uid FROM users").all();
    if (results && results.length > 0) {
      for (const u of results) {
        await sendNotification(env, ctx, u.uid, title, message, type, link);
      }
    }
    return corsJson({ success: true, count: results ? results.length : 0 });
  } catch (err) {
    return corsJson({ error: err.message }, 500);
  }
}
__name(broadcastNotification, "broadcastNotification");
async function ensureTables(db) {
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS releases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_uid TEXT NOT NULL,
        title TEXT NOT NULL,
        type TEXT DEFAULT 'Single',
        artist_name TEXT,
        cover_url TEXT,
        status TEXT DEFAULT 'brouillon',
        release_date TEXT,
        original_release_date TEXT,
        preorder_date TEXT,
        timezone TEXT,
        exact_time TEXT,
        primary_genre TEXT,
        secondary_genre TEXT,
        language TEXT,
        is_instrumental INTEGER DEFAULT 0,
        label_name TEXT,
        copyright_line_c TEXT,
        copyright_line_p TEXT,
        std_copyright TEXT,
        manual_platforms INTEGER DEFAULT 0,
        selected_platforms TEXT,
        additional_deliveries TEXT,
        version_line TEXT,
        licence_type TEXT DEFAULT 'Copyright',
        upc TEXT,
        territories TEXT,
        tracks TEXT,
        feats TEXT,
        apple_motion_11 TEXT,
        apple_motion_34 TEXT,
        animated_cover_url TEXT,
        release_url TEXT,
        spotify_url TEXT,
        apple_url TEXT,
        show_on_mmcp_catalog INTEGER DEFAULT 1,
        premiere_slug TEXT,
        premiere_password TEXT,
        premiere_start_date TEXT,
        premiere_end_date TEXT,
        premiere_is_active INTEGER DEFAULT 0,
        dolby_atmos INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS greenlist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_uid TEXT NOT NULL,
        platform TEXT NOT NULL,
        release_id TEXT,
        release_title TEXT,
        links TEXT,
        status TEXT DEFAULT 'Demand\xE9',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS blacklist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_uid TEXT NOT NULL,
        platform TEXT NOT NULL,
        release_id TEXT,
        release_title TEXT,
        track TEXT,
        start_date TEXT,
        end_date TEXT,
        status TEXT DEFAULT 'Demand\xE9',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS user_tracks (
        id TEXT PRIMARY KEY,
        user_uid TEXT NOT NULL,
        title TEXT NOT NULL,
        file_url TEXT,
        version TEXT,
        is_ai_generated INTEGER DEFAULT 0,
        language TEXT,
        isrc TEXT,
        iswc TEXT,
        writers TEXT,
        apple_credits TEXT,
        lyrics_text TEXT,
        lyric_type TEXT,
        atmos_url TEXT,
        inst_url TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS user_plays (
        id TEXT PRIMARY KEY,
        user_uid TEXT NOT NULL,
        release_id TEXT,
        track_id TEXT,
        platform TEXT,
        country TEXT,
        play_count INTEGER DEFAULT 0,
        period_date TEXT,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        uid TEXT PRIMARY KEY,
        first_name TEXT,
        last_name TEXT,
        full_name TEXT,
        artist_name TEXT,
        email TEXT,
        address TEXT,
        city TEXT,
        postal_code TEXT,
        iban TEXT,
        photo_url TEXT,
        role TEXT DEFAULT 'admin',
        auth_method TEXT DEFAULT 'password',
        plan_name TEXT DEFAULT 'starter',
        subscription_status TEXT,
        theme TEXT DEFAULT 'normal-auto',
        totp_enabled INTEGER DEFAULT 0,
        totp_secret TEXT,
        newsletter_enabled INTEGER DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS newsletter (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS artists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_uid TEXT NOT NULL,
        name TEXT NOT NULL,
        primary_genre TEXT,
        genre TEXT,
        feat TEXT,
        toolost_artist_id TEXT,
        spotify_id TEXT,
        apple_music_id TEXT,
        audiomack_id TEXT,
        even_artist_id TEXT,
        facebook_url TEXT,
        instagram_url TEXT,
        youtube_url TEXT,
        photo TEXT,
        logo_url TEXT,
        banner_url TEXT,
        birthdate TEXT,
        birthplace TEXT,
        contact_email TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_uid TEXT,
        artist_name TEXT NOT NULL,
        rating INTEGER DEFAULT 5,
        comment TEXT,
        message TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS app_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version TEXT,
        description TEXT,
        version_name TEXT,
        release_notes TEXT,
        date TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT,
        subject TEXT,
        message TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS support_tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uid TEXT NOT NULL,
        user_name TEXT,
        section TEXT NOT NULL,
        payload TEXT,
        messages TEXT,
        status TEXT DEFAULT 'ouvert',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS withdrawals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_uid TEXT,
        user_email TEXT,
        amount REAL NOT NULL,
        iban TEXT,
        status TEXT DEFAULT 'demand\xE9',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS finances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_uid TEXT NOT NULL,
        amount REAL NOT NULL,
        period TEXT,
        release_id TEXT,
        release_title TEXT,
        artist_name TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS labels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uid TEXT NOT NULL,
        nom TEXT NOT NULL,
        url TEXT,
        accent_color TEXT,
        bg_color TEXT,
        icon_url TEXT,
        favicon_url TEXT,
        logo_url TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS "artistes-labels" (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT NOT NULL,
        prenom TEXT NOT NULL,
        email TEXT NOT NULL,
        uid TEXT NOT NULL,
        id_label TEXT NOT NULL,
        artiste TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS user_tools_data (
        user_uid TEXT PRIMARY KEY,
        tracklists TEXT,
        events TEXT,
        freeboard TEXT,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS litual_conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_uid TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT 'Nouvelle conversation',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS litual_conversation_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES litual_conversations(id) ON DELETE CASCADE
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_uid TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT,
        type TEXT DEFAULT 'info',
        is_read INTEGER DEFAULT 0,
        link TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS user_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_uid TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        file_url TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
  ]);
  try {
    await db.prepare("ALTER TABLE support_tickets ADD COLUMN messages TEXT").run();
  } catch (e) {
  }
  try {
    await db.prepare('ALTER TABLE "artistes-labels" ADD COLUMN artiste TEXT').run();
  } catch (e) {
  }
  try {
    await db.prepare("ALTER TABLE releases ADD COLUMN premiere_slug TEXT").run();
    await db.prepare("ALTER TABLE releases ADD COLUMN premiere_password TEXT").run();
    await db.prepare("ALTER TABLE releases ADD COLUMN premiere_start_date TEXT").run();
    await db.prepare("ALTER TABLE releases ADD COLUMN premiere_end_date TEXT").run();
    await db.prepare("ALTER TABLE releases ADD COLUMN premiere_is_active INTEGER DEFAULT 0").run();
  } catch (e) {
  }
  try {
    await db.prepare("ALTER TABLE releases ADD COLUMN dolby_atmos INTEGER DEFAULT 0").run();
  } catch (e) {
  }
  try {
    await db.prepare("ALTER TABLE users ADD COLUMN newsletter_enabled INTEGER DEFAULT 1").run();
  } catch (e) {
  }
  try {
    await db.prepare("ALTER TABLE artists ADD COLUMN logo_url TEXT").run();
  } catch (e) {
  }
}
__name(ensureTables, "ensureTables");
async function deleteUserDocument(env, uid, docId) {
  try {
    const doc = await env.DB.prepare("SELECT * FROM user_documents WHERE id = ? AND user_uid = ?").bind(docId, uid).first();
    if (!doc) {
      return corsJson({ error: "Document non trouv\xE9" }, 404);
    }
    await env.DB.prepare("DELETE FROM user_documents WHERE id = ?").bind(docId).run();
    return corsJson({ success: true, message: "Document supprim\xE9 avec succ\xE8s" });
  } catch (err) {
    return corsJson({ error: err.message }, 500);
  }
}
__name(deleteUserDocument, "deleteUserDocument");
async function extractUserId(request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  try {
    const token = authHeader.split("Bearer ")[1];
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.sub || payload.user_id || payload.uid || null;
  } catch {
    return null;
  }
}
__name(extractUserId, "extractUserId");
async function isAdmin(env, uid) {
  if (!uid) return false;
  const row = await env.DB.prepare("SELECT role FROM users WHERE uid = ?").bind(uid).first();
  if (row) {
    return row.role === "admin";
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await env.DB.prepare(`INSERT INTO users (uid, role, plan_name, created_at, updated_at) VALUES (?, 'admin', 'pro', ?, ?) ON CONFLICT(uid) DO UPDATE SET role = 'admin'`).bind(uid, now, now).run();
  return true;
}
__name(isAdmin, "isAdmin");
async function getUserDocuments(env, uid) {
  try {
    const { results } = await env.DB.prepare(
      "SELECT * FROM user_documents WHERE user_uid = ? ORDER BY created_at DESC"
    ).bind(uid).all();
    return corsJson(results || []);
  } catch (err) {
    return corsJson([], 200);
  }
}
__name(getUserDocuments, "getUserDocuments");
async function createUserDocument(env, uid, request, isAdminUser, ctx) {
  try {
    const formData = await request.formData();
    const title = String(formData.get("title") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const file = formData.get("file");
    if (!title || !file) {
      return corsJson({ error: "Titre et fichier requis" }, 400);
    }
    const filename = file.name || "document";
    const ext = filename.split(".").pop();
    const key = `document/${uid}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
    const bucket = getBucket(env, "document");
    if (bucket) {
      await bucket.put(key, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type || getContentType(ext) }
      });
    } else {
      return corsJson({ error: "Stockage non configur\xE9" }, 500);
    }
    const fileUrl = `/api/files/${encodeURIComponent(key)}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const res = await env.DB.prepare(`
      INSERT INTO user_documents (user_uid, title, description, file_url, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(uid, title, description, fileUrl, now).run();
    await sendNotification(
      env,
      ctx,
      uid,
      "Nouveau document disponible",
      `Un nouveau document "${title}" a \xE9t\xE9 ajout\xE9 \xE0 votre compte.`,
      "document",
      "/portail/"
    );
    return corsJson({ id: res.meta.last_row_id, fileUrl, success: true }, 201);
  } catch (err) {
    console.error("Erreur createUserDocument:", err);
    return corsJson({ error: err.message }, 500);
  }
}
__name(createUserDocument, "createUserDocument");
async function getUserTracklists(env, uid) {
  try {
    const row = await env.DB.prepare("SELECT tracklists FROM user_tools_data WHERE user_uid = ?").bind(uid).first();
    if (!row || !row.tracklists) return corsJson([]);
    return corsJson(JSON.parse(row.tracklists));
  } catch (err) {
    return corsJson([]);
  }
}
__name(getUserTracklists, "getUserTracklists");
async function saveUserTracklists(env, uid, request) {
  try {
    const data = await request.json();
    const tracklistsStr = JSON.stringify(data || []);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await env.DB.prepare(`
      INSERT INTO user_tools_data (user_uid, tracklists, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(user_uid) DO UPDATE SET tracklists = excluded.tracklists, updated_at = excluded.updated_at
    `).bind(uid, tracklistsStr, now).run();
    return corsJson({ success: true });
  } catch (err) {
    return corsJson({ error: err.message }, 500);
  }
}
__name(saveUserTracklists, "saveUserTracklists");
async function getUserEvents(env, uid) {
  try {
    const row = await env.DB.prepare("SELECT events FROM user_tools_data WHERE user_uid = ?").bind(uid).first();
    if (!row || !row.events) return corsJson([]);
    return corsJson(JSON.parse(row.events));
  } catch (err) {
    return corsJson([]);
  }
}
__name(getUserEvents, "getUserEvents");
async function saveUserEvents(env, uid, request) {
  try {
    const data = await request.json();
    const eventsStr = JSON.stringify(data || []);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await env.DB.prepare(`
      INSERT INTO user_tools_data (user_uid, events, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(user_uid) DO UPDATE SET events = excluded.events, updated_at = excluded.updated_at
    `).bind(uid, eventsStr, now).run();
    return corsJson({ success: true });
  } catch (err) {
    return corsJson({ error: err.message }, 500);
  }
}
__name(saveUserEvents, "saveUserEvents");
async function getUserFreeboard(env, uid) {
  try {
    const row = await env.DB.prepare("SELECT freeboard FROM user_tools_data WHERE user_uid = ?").bind(uid).first();
    if (!row || !row.freeboard) return corsJson([]);
    return corsJson(JSON.parse(row.freeboard));
  } catch (err) {
    return corsJson([]);
  }
}
__name(getUserFreeboard, "getUserFreeboard");
async function saveUserFreeboard(env, uid, request) {
  try {
    const data = await request.json();
    const freeboardStr = JSON.stringify(data || []);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await env.DB.prepare(`
      INSERT INTO user_tools_data (user_uid, freeboard, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(user_uid) DO UPDATE SET freeboard = excluded.freeboard, updated_at = excluded.updated_at
    `).bind(uid, freeboardStr, now).run();
    return corsJson({ success: true });
  } catch (err) {
    return corsJson({ error: err.message }, 500);
  }
}
__name(saveUserFreeboard, "saveUserFreeboard");
async function createLabel(env, uid, request) {
  try {
    const data = await request.json();
    const nom = data.nom;
    const url = data.url || "";
    const accentColor = data.accentColor || "";
    const bgColor = data.bgColor || "";
    const iconUrl = data.iconUrl || "";
    const faviconUrl = data.faviconUrl || "";
    const logoUrl = data.logoUrl || "";
    const now = (/* @__PURE__ */ new Date()).toISOString();
    if (!nom) {
      return corsJson({ error: "Le nom du label est obligatoire" }, 400);
    }
    const res = await env.DB.prepare(`
      INSERT INTO labels (uid, nom, url, accent_color, bg_color, icon_url, favicon_url, logo_url, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(uid, nom, url, accentColor, bgColor, iconUrl, faviconUrl, logoUrl, now).run();
    return corsJson({ id: res.meta.last_row_id, success: true }, 201);
  } catch (err) {
    return corsJson({ error: err.message }, 500);
  }
}
__name(createLabel, "createLabel");
async function getUserLabels(env, uid) {
  try {
    const { results } = await env.DB.prepare("SELECT * FROM labels WHERE uid = ? ORDER BY created_at DESC").bind(uid).all();
    return corsJson(results || []);
  } catch (err) {
    return corsJson([], 200);
  }
}
__name(getUserLabels, "getUserLabels");
async function getPublicPremiere(env, url) {
  const slug = url.searchParams.get("slug");
  const artiste = url.searchParams.get("artiste");
  if (!slug) {
    return corsJson({ error: "Slug manquant" }, 400);
  }
  const row = await env.DB.prepare("SELECT * FROM releases WHERE premiere_slug = ?").bind(slug).first();
  if (!row) {
    return corsJson({ error: "Premi\xE8re introuvable" }, 404);
  }
  if (row.premiere_is_active === 0 || row.premiere_is_active === false) {
    return corsJson({ error: "Premi\xE8re d\xE9sactiv\xE9e" }, 403);
  }
  if (artiste) {
    const artistSlug = (row.artist_name || "").toLowerCase().replace(/[^a-z0-9-_]/g, "-");
    if (artistSlug !== artiste.toLowerCase()) {
      return corsJson({ error: "Nom d'artiste non concordant" }, 403);
    }
  }
  return corsJson(formatReleaseRow(row));
}
__name(getPublicPremiere, "getPublicPremiere");
async function createSupportTicket(env, request, ctx) {
  try {
    const data = await request.json();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const uid = data.uid || "anonymous";
    const userName = data.userName || "Artiste";
    const section = data.section || "general";
    const payload = JSON.stringify(data.payload || data || {});
    const initialMessages = JSON.stringify([]);
    const res = await env.DB.prepare(`
      INSERT INTO support_tickets (uid, user_name, section, payload, messages, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'ouvert', ?)
    `).bind(uid, userName, section, payload, initialMessages, now).run();
    await sendNotification(
      env,
      ctx,
      uid,
      "Ticket de support cr\xE9\xE9",
      `Votre ticket #${res.meta.last_row_id} (${section}) a bien \xE9t\xE9 ouvert.`,
      "support",
      "/support.html"
    );
    return corsJson({ id: res.meta.last_row_id, success: true }, 201);
  } catch (err) {
    return corsJson({ error: err.message }, 500);
  }
}
__name(createSupportTicket, "createSupportTicket");
async function getSupportTickets(env, request) {
  try {
    const { results } = await env.DB.prepare("SELECT * FROM support_tickets ORDER BY created_at DESC").all();
    return corsJson(results.map((row) => ({
      ...row,
      payload: (() => {
        try {
          return JSON.parse(row.payload);
        } catch (e) {
          return {};
        }
      })(),
      messages: (() => {
        try {
          return JSON.parse(row.messages || "[]");
        } catch (e) {
          return [];
        }
      })()
    })));
  } catch (err) {
    return corsJson([], 200);
  }
}
__name(getSupportTickets, "getSupportTickets");
async function addTicketMessage(env, ticketId, request, ctx) {
  try {
    const data = await request.json();
    const text = data.text || data.message || "";
    const sender = data.sender || "user";
    const createdAt = data.createdAt || (/* @__PURE__ */ new Date()).toISOString();
    const row = await env.DB.prepare("SELECT uid, messages FROM support_tickets WHERE id = ?").bind(ticketId).first();
    if (!row) return corsJson({ error: "Ticket non trouv\xE9" }, 404);
    let messages = [];
    try {
      messages = JSON.parse(row.messages || "[]");
    } catch (e) {
      messages = [];
    }
    messages.push({ text, sender, created_at: createdAt });
    await env.DB.prepare("UPDATE support_tickets SET messages = ? WHERE id = ?").bind(JSON.stringify(messages), ticketId).run();
    if (row.uid && sender === "admin") {
      await sendNotification(
        env,
        ctx,
        row.uid,
        "Nouveau message support",
        `Vous avez re\xE7u une r\xE9ponse sur votre ticket de support #${ticketId}.`,
        "support",
        "/support.html"
      );
    }
    return corsJson({ success: true, messages });
  } catch (err) {
    return corsJson({ error: err.message }, 500);
  }
}
__name(addTicketMessage, "addTicketMessage");
async function updateTicketStatus(env, ticketId, request, ctx) {
  try {
    const data = await request.json();
    const status = data.status;
    if (!status) return corsJson({ error: "Statut manquant" }, 400);
    const ticketRow = await env.DB.prepare("SELECT uid FROM support_tickets WHERE id = ?").bind(ticketId).first();
    await env.DB.prepare("UPDATE support_tickets SET status = ? WHERE id = ?").bind(status, ticketId).run();
    if (ticketRow && ticketRow.uid) {
      await sendNotification(
        env,
        ctx,
        ticketRow.uid,
        "Mise \xE0 jour du ticket support",
        `Le statut de votre ticket #${ticketId} est d\xE9sormais : ${status}.`,
        "support",
        "/support.html"
      );
    }
    return corsJson({ success: true });
  } catch (err) {
    return corsJson({ error: err.message }, 500);
  }
}
__name(updateTicketStatus, "updateTicketStatus");
async function getUserPayoutsSafe(env, uid, request) {
  try {
    const { results } = await env.DB.prepare("SELECT * FROM withdrawals WHERE user_uid = ? ORDER BY created_at DESC").bind(uid).all();
    return corsJson((results || []).map((r) => ({ id: String(r.id), title: `Versement #${r.id} - ${r.amount} \u20AC (${r.created_at.split("T")[0]})`, ...r })));
  } catch (err) {
    return corsJson([], 200);
  }
}
__name(getUserPayoutsSafe, "getUserPayoutsSafe");
async function createUserPayoutSafe(env, uid, request) {
  try {
    const data = await request.json();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const amount = Number(data.amount || 0);
    const iban = data.iban || "";
    const res = await env.DB.prepare(`
      INSERT INTO withdrawals (user_uid, amount, iban, status, created_at)
      VALUES (?, ?, ?, 'demand\xE9', ?)
    `).bind(uid, amount, iban, now).run();
    return corsJson({ id: res.meta.last_row_id, success: true }, 201);
  } catch (err) {
    return corsJson({ error: err.message }, 500);
  }
}
__name(createUserPayoutSafe, "createUserPayoutSafe");
async function getUser(env, uid) {
  const row = await env.DB.prepare("SELECT * FROM users WHERE uid = ?").bind(uid).first();
  if (!row) return corsJson({ uid, planName: "starter", role: "admin" });
  return corsJson(formatUserRow(row));
}
__name(getUser, "getUser");
async function getMe(env, uid) {
  let row = await env.DB.prepare("SELECT * FROM users WHERE uid = ?").bind(uid).first();
  if (!row) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await env.DB.prepare(`INSERT INTO users (uid, role, plan_name, created_at, updated_at) VALUES (?, 'admin', 'pro', ?, ?)`).bind(uid, now, now).run();
    row = await env.DB.prepare("SELECT * FROM users WHERE uid = ?").bind(uid).first();
  }
  return corsJson({ user: formatUserRow(row) });
}
__name(getMe, "getMe");
async function listUsers(env, userId, isAdminUser) {
  const { results } = await env.DB.prepare("SELECT * FROM users ORDER BY created_at DESC").all();
  return corsJson(results.map(formatUserRow));
}
__name(listUsers, "listUsers");
async function getUserFinancesSafe(env, uid, request) {
  try {
    const { results } = await env.DB.prepare("SELECT * FROM finances WHERE user_uid = ? ORDER BY created_at DESC").bind(uid).all();
    return corsJson(results || []);
  } catch (err) {
    return corsJson([], 200);
  }
}
__name(getUserFinancesSafe, "getUserFinancesSafe");
async function createUserFinance(env, uid, request, isAdminUser, ctx) {
  if (!isAdminUser) return corsJson({ error: "Acc\xE8s non autoris\xE9" }, 403);
  const data = await request.json();
  const now = data.createdAt || (/* @__PURE__ */ new Date()).toISOString();
  const res = await env.DB.prepare(`
    INSERT INTO finances (user_uid, amount, period, release_id, release_title, artist_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    uid,
    Number(data.amount || 0),
    data.period || "",
    data.releaseId || "",
    data.releaseTitle || "",
    data.artistName || "",
    now
  ).run();
  await sendNotification(
    env,
    ctx,
    uid,
    "Nouveaux revenus ajout\xE9s",
    `Un montant de ${Number(data.amount || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })} a \xE9t\xE9 ajout\xE9 \xE0 vos revenus (${data.period || "P\xE9riode en cours"}).`,
    "finance",
    "/mes-revenus.html"
  );
  return corsJson({ id: res.meta.last_row_id, success: true }, 201);
}
__name(createUserFinance, "createUserFinance");
async function getWithdrawalsSafe(env, request) {
  try {
    const { results } = await env.DB.prepare("SELECT * FROM withdrawals ORDER BY created_at DESC").all();
    return corsJson(results || []);
  } catch (err) {
    return corsJson([], 200);
  }
}
__name(getWithdrawalsSafe, "getWithdrawalsSafe");
async function createWithdrawalSafe(env, request) {
  try {
    const data = await request.json();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const userId = data.userId || data.user_uid || "anonymous";
    const userEmail = data.userEmail || data.user_email || "";
    const amount = Number(data.amount || 0);
    const iban = data.iban || "";
    if (amount <= 0) {
      return corsJson({ error: "Montant invalide" }, 400);
    }
    const res = await env.DB.prepare(`
      INSERT INTO withdrawals (user_uid, user_email, amount, iban, status, created_at)
      VALUES (?, ?, ?, ?, 'demand\xE9', ?)
    `).bind(
      userId,
      userEmail,
      amount,
      iban,
      now
    ).run();
    return corsJson({ id: res.meta.last_row_id, success: true }, 201);
  } catch (err) {
    return corsJson({ error: err.message }, 500);
  }
}
__name(createWithdrawalSafe, "createWithdrawalSafe");
async function patchUserFinance(env, uid, financeId, request, isAdminUser) {
  if (!isAdminUser) return corsJson({ error: "Acc\xE8s non autoris\xE9" }, 403);
  const data = await request.json();
  await env.DB.prepare(`
    UPDATE finances 
    SET amount = COALESCE(?, amount),
        period = COALESCE(?, period),
        release_id = COALESCE(?, release_id),
        release_title = COALESCE(?, release_title),
        artist_name = COALESCE(?, artist_name)
    WHERE id = ? AND user_uid = ?
  `).bind(
    data.amount !== void 0 ? Number(data.amount) : null,
    data.period !== void 0 ? data.period : null,
    data.releaseId !== void 0 ? data.releaseId : null,
    data.releaseTitle !== void 0 ? data.releaseTitle : null,
    data.artistName !== void 0 ? data.artistName : null,
    financeId,
    uid
  ).run();
  return corsJson({ success: true });
}
__name(patchUserFinance, "patchUserFinance");
async function deleteUserFinance(env, uid, financeId, isAdminUser) {
  if (!isAdminUser) return corsJson({ error: "Acc\xE8s non autoris\xE9" }, 403);
  await env.DB.prepare("DELETE FROM finances WHERE id = ? AND user_uid = ?").bind(financeId, uid).run();
  return corsJson({ success: true });
}
__name(deleteUserFinance, "deleteUserFinance");
async function upsertUser(env, uid, request) {
  const data = await request.json();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await env.DB.prepare(`INSERT INTO users (uid, first_name, last_name, full_name, artist_name, email, address, city, postal_code, iban, photo_url, role, auth_method, plan_name, subscription_status, theme, totp_enabled, totp_secret, newsletter_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(uid) DO UPDATE SET first_name = excluded.first_name, last_name = excluded.last_name, full_name = excluded.full_name, artist_name = excluded.artist_name, email = excluded.email, address = excluded.address, city = excluded.city, postal_code = excluded.postal_code, iban = excluded.iban, photo_url = excluded.photo_url, role = excluded.role, auth_method = excluded.auth_method, plan_name = excluded.plan_name, subscription_status = excluded.subscription_status, theme = excluded.theme, totp_enabled = excluded.totp_enabled, totp_secret = excluded.totp_secret, newsletter_enabled = excluded.newsletter_enabled, updated_at = excluded.updated_at`).bind(
    uid,
    data.firstName || null,
    data.lastName || null,
    data.fullName || (data.firstName && data.lastName ? `${data.firstName} ${data.lastName}`.trim() : null),
    data.artistName || null,
    data.email || null,
    data.address || null,
    data.city || null,
    data.postalCode || null,
    data.iban || null,
    data.photoURL || null,
    data.role || "admin",
    data.authMethod || "password",
    data.planName || "starter",
    data.subscriptionStatus || null,
    data.theme || "normal-auto",
    data.totpEnabled ? 1 : 0,
    data.totpSecret || null,
    data.newsletterEnabled !== void 0 ? data.newsletterEnabled ? 1 : 0 : 1,
    data.createdAt || now,
    now
  ).run();
  return corsJson({ success: true });
}
__name(upsertUser, "upsertUser");
async function patchUser(env, uid, request) {
  const data = await request.json();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const fieldMap = {
    firstName: "first_name",
    lastName: "last_name",
    fullName: "full_name",
    artistName: "artist_name",
    email: "email",
    address: "address",
    city: "city",
    postalCode: "postal_code",
    iban: "iban",
    photoURL: "photo_url",
    role: "role",
    authMethod: "auth_method",
    planName: "plan_name",
    subscriptionStatus: "subscription_status",
    theme: "theme",
    totpEnabled: "totp_enabled",
    totpSecret: "totp_secret",
    newsletterEnabled: "newsletter_enabled"
  };
  const sets = [];
  const values = [];
  for (const [key, column] of Object.entries(fieldMap)) {
    if (data[key] !== void 0) {
      sets.push(`${column} = ?`);
      values.push(key === "totpEnabled" || key === "newsletterEnabled" ? data[key] ? 1 : 0 : data[key]);
    }
  }
  if (sets.length === 0) return corsJson({ error: "Aucun champ \xE0 mettre \xE0 jour" }, 400);
  sets.push("updated_at = ?");
  values.push(now, uid);
  await env.DB.prepare(`UPDATE users SET ${sets.join(", ")} WHERE uid = ?`).bind(...values).run();
  return corsJson({ success: true });
}
__name(patchUser, "patchUser");
function formatUserRow(row) {
  if (!row) return null;
  return {
    uid: row.uid,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: row.full_name,
    artistName: row.artist_name,
    email: row.email,
    address: row.address,
    city: row.city,
    postalCode: row.postal_code,
    iban: row.iban,
    photoURL: row.photo_url,
    role: row.role || "admin",
    authMethod: row.auth_method,
    planName: row.plan_name || "starter",
    subscriptionStatus: row.subscription_status,
    theme: row.theme,
    totpEnabled: !!row.totp_enabled,
    totpSecret: row.totp_secret,
    newsletterEnabled: row.newsletter_enabled !== 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
__name(formatUserRow, "formatUserRow");
async function getUserTracks(env, uid) {
  const { results } = await env.DB.prepare("SELECT * FROM user_tracks WHERE user_uid = ? ORDER BY created_at DESC").bind(uid).all();
  return corsJson(results || []);
}
__name(getUserTracks, "getUserTracks");
async function createOrUpdateUserTrack(env, uid, request) {
  const data = await request.json();
  const id = data.id || `track_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  await env.DB.prepare(`INSERT INTO user_tracks ( id, user_uid, title, file_url, version, is_ai_generated, language, isrc, iswc, writers, apple_credits, lyrics_text, lyric_type, atmos_url, inst_url ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET title = excluded.title, file_url = excluded.file_url, version = excluded.version, is_ai_generated = excluded.is_ai_generated, language = excluded.language, isrc = excluded.isrc, iswc = excluded.iswc, writers = excluded.writers, apple_credits = excluded.apple_credits, lyrics_text = excluded.lyrics_text, lyric_type = excluded.lyric_type, atmos_url = excluded.atmos_url, inst_url = excluded.inst_url`).bind(
    id,
    uid,
    data.title || "Titre inconnu",
    data.fileUrl || "",
    data.version || "",
    data.isAiGenerated ? 1 : 0,
    data.language || "Fran\xE7ais",
    data.isrc || "",
    data.iswc || "",
    data.writers || "",
    data.appleCredits || "",
    data.lyricsText || "",
    data.lyricType || "Clean",
    data.atmosUrl || null,
    data.instUrl || null
  ).run();
  return corsJson({ success: true, id }, 201);
}
__name(createOrUpdateUserTrack, "createOrUpdateUserTrack");
async function deleteUserTrack(env, uid, trackId) {
  await env.DB.prepare("DELETE FROM user_tracks WHERE id = ? AND user_uid = ?").bind(trackId, uid).run();
  return corsJson({ success: true });
}
__name(deleteUserTrack, "deleteUserTrack");
async function getUserPlays(env, uid) {
  const { results } = await env.DB.prepare("SELECT * FROM user_plays WHERE user_uid = ? ORDER BY updated_at DESC").bind(uid).all();
  return corsJson(results || []);
}
__name(getUserPlays, "getUserPlays");
async function recordUserPlay(env, uid, request) {
  const body = await request.json();
  const id = `play_${Date.now()}`;
  await env.DB.prepare(`INSERT INTO user_plays (id, user_uid, release_id, track_id, platform, country, play_count, period_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    id,
    uid,
    body.releaseId || "",
    body.trackId || "",
    body.platform || "Spotify",
    body.country || "France",
    body.playCount || 0,
    body.periodDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
  ).run();
  return corsJson({ success: true, id }, 201);
}
__name(recordUserPlay, "recordUserPlay");
async function getAllArtists(env) {
  const { results } = await env.DB.prepare("SELECT * FROM artists ORDER BY name ASC").all();
  return corsJson({ artists: results.map(formatArtistRow) });
}
__name(getAllArtists, "getAllArtists");
async function getAllFeats(env) {
  const { results } = await env.DB.prepare("SELECT * FROM artists WHERE feat IS NOT NULL AND feat != '' ORDER BY name ASC").all();
  return corsJson({ feats: results.map(formatArtistRow) });
}
__name(getAllFeats, "getAllFeats");
async function getUserArtists(env, uid) {
  const { results } = await env.DB.prepare("SELECT * FROM artists WHERE user_uid = ? ORDER BY name ASC").bind(uid).all();
  return corsJson(results.map(formatArtistRow));
}
__name(getUserArtists, "getUserArtists");
async function getArtist(env, uid, artistId) {
  const row = await env.DB.prepare("SELECT * FROM artists WHERE id = ? AND user_uid = ?").bind(artistId, uid).first();
  if (!row) return corsJson({ error: "Artiste non trouv\xE9" }, 404);
  return corsJson(formatArtistRow(row));
}
__name(getArtist, "getArtist");
async function createArtist(env, uid, request) {
  const data = await request.json();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const row = await env.DB.prepare(`
    INSERT INTO artists (
      user_uid, name, primary_genre, genre, feat, toolost_artist_id, spotify_id, 
      apple_music_id, audiomack_id, even_artist_id, facebook_url, instagram_url, 
      youtube_url, photo, logo_url, banner_url, birthdate, birthplace, contact_email, 
      uploader_option, writers, credits, secondary_genre, default_language, timezone, 
      release_time, manual_platforms, manual_territories, line_copyright, line_phonogram, 
      label_name, deliveries, description, link_yt_chan, link_yt_music, link_apple, 
      link_spotify, link_amazon, link_soundcloud, link_website, link_fb, link_insta, 
      link_x, link_yt_social, link_wiki, id_ddex, id_musicbrainz, id_allmusic, id_isni, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
    RETURNING id
  `).bind(
    uid,
    data.name || "",
    data.primaryGenre || data.genre || null,
    data.genre || data.primaryGenre || null,
    data.feat || null,
    data.toolostArtistId || null,
    data.spotifyId || null,
    data.appleMusicId || null,
    data.audiomackId || null,
    data.evenArtistId || null,
    data.facebookUrl || null,
    data.instagramUrl || null,
    data.youtubeUrl || null,
    data.photo || null,
    data.logoUrl || data.logo || null,
    data.bannerUrl || null,
    data.birthdate || null,
    data.birthplace || null,
    data.contactEmail || null,
    data.uploaderOption || null,
    typeof data.writers === "object" ? JSON.stringify(data.writers) : data.writers || null,
    typeof data.credits === "object" ? JSON.stringify(data.credits) : data.credits || null,
    data.secondaryGenre || null,
    data.defaultLanguage || null,
    data.timezone || null,
    data.releaseTime || null,
    data.manualPlatforms || null,
    data.manualTerritories || null,
    data.lineCopyright || null,
    data.linePhonogram || null,
    data.labelName || null,
    typeof data.deliveries === "object" ? JSON.stringify(data.deliveries) : data.deliveries || null,
    data.description || null,
    data.linkYtChan || null,
    data.linkYtMusic || null,
    data.linkApple || null,
    data.linkSpotify || null,
    data.linkAmazon || null,
    data.linkSoundcloud || null,
    data.linkWebsite || null,
    data.linkFb || null,
    data.linkInsta || null,
    data.linkX || null,
    data.linkYtSocial || null,
    data.linkWiki || null,
    data.idDdex || null,
    data.idMusicbrainz || null,
    data.idAllmusic || null,
    data.idIsni || null,
    now
  ).first();
  return corsJson({ id: row.id, success: true }, 201);
}
__name(createArtist, "createArtist");
async function createFeat(env, uid, request) {
  const data = await request.json();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const links = data.links || {};
  const res = await env.DB.prepare(`INSERT INTO artists (user_uid, name, feat, apple_music_id, spotify_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`).bind(
    uid,
    data.name,
    "feat",
    links.apple || data.appleMusicId || null,
    links.spotify || data.spotifyId || null,
    now
  ).run();
  return corsJson({ id: res.meta.last_row_id, name: data.name, success: true }, 201);
}
__name(createFeat, "createFeat");
async function patchArtist(env, uid, artistId, request) {
  const data = await request.json();
  await env.DB.prepare(`
    UPDATE artists 
    SET name = COALESCE(?, name), 
        primary_genre = COALESCE(?, primary_genre), 
        genre = COALESCE(?, genre), 
        spotify_id = COALESCE(?, spotify_id), 
        apple_music_id = COALESCE(?, apple_music_id), 
        photo = COALESCE(?, photo), 
        logo_url = COALESCE(?, logo_url),
        banner_url = COALESCE(?, banner_url), 
        birthdate = COALESCE(?, birthdate), 
        birthplace = COALESCE(?, birthplace), 
        uploader_option = COALESCE(?, uploader_option), 
        writers = COALESCE(?, writers), 
        credits = COALESCE(?, credits), 
        secondary_genre = COALESCE(?, secondary_genre), 
        default_language = COALESCE(?, default_language), 
        timezone = COALESCE(?, timezone), 
        release_time = COALESCE(?, release_time), 
        manual_platforms = COALESCE(?, manual_platforms), 
        manual_territories = COALESCE(?, manual_territories), 
        line_copyright = COALESCE(?, line_copyright), 
        line_phonogram = COALESCE(?, line_phonogram), 
        label_name = COALESCE(?, label_name), 
        deliveries = COALESCE(?, deliveries), 
        description = COALESCE(?, description), 
        link_yt_chan = COALESCE(?, link_yt_chan), 
        link_yt_music = COALESCE(?, link_yt_music), 
        link_apple = COALESCE(?, link_apple), 
        link_spotify = COALESCE(?, link_spotify), 
        link_amazon = COALESCE(?, link_amazon), 
        link_soundcloud = COALESCE(?, link_soundcloud), 
        link_website = COALESCE(?, link_website), 
        link_fb = COALESCE(?, link_fb), 
        link_insta = COALESCE(?, link_insta), 
        link_x = COALESCE(?, link_x), 
        link_yt_social = COALESCE(?, link_yt_social), 
        link_wiki = COALESCE(?, link_wiki), 
        id_ddex = COALESCE(?, id_ddex), 
        id_musicbrainz = COALESCE(?, id_musicbrainz), 
        id_allmusic = COALESCE(?, id_allmusic), 
        id_isni = COALESCE(?, id_isni) 
    WHERE id = ? AND (user_uid = ? OR ? = 1)
  `).bind(
    data.name !== void 0 ? data.name : null,
    data.primaryGenre !== void 0 ? data.primaryGenre || data.genre : null,
    data.genre !== void 0 ? data.genre || data.primaryGenre : null,
    data.spotifyId !== void 0 ? data.spotifyId : null,
    data.appleMusicId !== void 0 ? data.appleMusicId : null,
    data.photo !== void 0 ? data.photo : null,
    data.logoUrl !== void 0 ? data.logoUrl : data.logo !== void 0 ? data.logo : null,
    data.bannerUrl !== void 0 ? data.bannerUrl : null,
    data.birthdate !== void 0 ? data.birthdate : null,
    data.birthplace !== void 0 ? data.birthplace : null,
    data.uploaderOption !== void 0 ? data.uploaderOption : null,
    data.writers !== void 0 ? typeof data.writers === "object" ? JSON.stringify(data.writers) : data.writers : null,
    data.credits !== void 0 ? typeof data.credits === "object" ? JSON.stringify(data.credits) : data.credits : null,
    data.secondaryGenre !== void 0 ? data.secondaryGenre : null,
    data.defaultLanguage !== void 0 ? data.defaultLanguage : null,
    data.timezone !== void 0 ? data.timezone : null,
    data.releaseTime !== void 0 ? data.releaseTime : null,
    data.manualPlatforms !== void 0 ? data.manualPlatforms : null,
    data.manualTerritories !== void 0 ? data.manualTerritories : null,
    data.lineCopyright !== void 0 ? data.lineCopyright : null,
    data.linePhonogram !== void 0 ? data.linePhonogram : null,
    data.labelName !== void 0 ? data.labelName : null,
    data.deliveries !== void 0 ? typeof data.deliveries === "object" ? JSON.stringify(data.deliveries) : data.deliveries : null,
    data.description !== void 0 ? data.description : null,
    data.linkYtChan !== void 0 ? data.linkYtChan : null,
    data.linkYtMusic !== void 0 ? data.linkYtMusic : null,
    data.linkApple !== void 0 ? data.linkApple : null,
    data.linkSpotify !== void 0 ? data.linkSpotify : null,
    data.linkAmazon !== void 0 ? data.linkAmazon : null,
    data.linkSoundcloud !== void 0 ? data.linkSoundcloud : null,
    data.linkWebsite !== void 0 ? data.linkWebsite : null,
    data.linkFb !== void 0 ? data.linkFb : null,
    data.linkInsta !== void 0 ? data.linkInsta : null,
    data.linkX !== void 0 ? data.linkX : null,
    data.linkYtSocial !== void 0 ? data.linkYtSocial : null,
    data.linkWiki !== void 0 ? data.linkWiki : null,
    data.idDdex !== void 0 ? data.idDdex : null,
    data.idMusicbrainz !== void 0 ? data.idMusicbrainz : null,
    data.idAllmusic !== void 0 ? data.idAllmusic : null,
    data.idIsni !== void 0 ? data.idIsni : null,
    artistId,
    uid,
    await isAdmin(env, uid) ? 1 : 0
  ).run();
  return corsJson({ success: true });
}
__name(patchArtist, "patchArtist");
async function deleteArtist(env, uid, artistId) {
  await env.DB.prepare("DELETE FROM artists WHERE id = ? AND user_uid = ?").bind(artistId, uid).run();
  return corsJson({ success: true });
}
__name(deleteArtist, "deleteArtist");
function formatArtistRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userUid: row.user_uid,
    name: row.name,
    primaryGenre: row.primary_genre || row.genre,
    genre: row.genre || row.primary_genre,
    feat: row.feat,
    toolostArtistId: row.toolost_artist_id,
    spotifyId: row.spotify_id,
    appleMusicId: row.apple_music_id,
    audiomackId: row.audiomack_id,
    evenArtistId: row.even_artist_id,
    facebookUrl: row.facebook_url,
    instagramUrl: row.instagram_url,
    youtubeUrl: row.youtube_url,
    photo: row.photo,
    logoUrl: row.logo_url,
    bannerUrl: row.banner_url,
    birthdate: row.birthdate,
    birthplace: row.birthplace,
    contactEmail: row.contact_email,
    uploaderOption: row.uploader_option,
    writers: row.writers,
    credits: row.credits,
    secondaryGenre: row.secondary_genre,
    defaultLanguage: row.default_language,
    timezone: row.timezone,
    releaseTime: row.release_time,
    manualPlatforms: row.manual_platforms,
    manualTerritories: row.manual_territories,
    lineCopyright: row.line_copyright,
    linePhonogram: row.line_phonogram,
    labelName: row.label_name,
    deliveries: row.deliveries,
    description: row.description,
    linkYtChan: row.link_yt_chan,
    linkYtMusic: row.link_yt_music,
    linkApple: row.link_apple,
    linkSpotify: row.link_spotify,
    linkAmazon: row.link_amazon,
    linkSoundcloud: row.link_soundcloud,
    linkWebsite: row.link_website,
    linkFb: row.link_fb,
    linkInsta: row.link_insta,
    linkX: row.link_x,
    linkYtSocial: row.link_yt_social,
    linkWiki: row.link_wiki,
    idDdex: row.id_ddex,
    idMusicbrainz: row.id_musicbrainz,
    idAllmusic: row.id_allmusic,
    idIsni: row.id_isni,
    createdAt: row.created_at
  };
}
__name(formatArtistRow, "formatArtistRow");
async function getAllReleases(env, url) {
  const status = url.searchParams.get("status");
  let query = "SELECT * FROM releases";
  const params = [];
  if (status) {
    query += " WHERE status = ?";
    params.push(status);
  }
  query += " ORDER BY created_at DESC";
  const { results } = await env.DB.prepare(query).bind(...params).all();
  return corsJson({ releases: results.map(formatReleaseRow) });
}
__name(getAllReleases, "getAllReleases");
async function getUserReleases(env, uid) {
  const { results } = await env.DB.prepare("SELECT * FROM releases WHERE user_uid = ? ORDER BY created_at DESC").bind(uid).all();
  return corsJson(results.map(formatReleaseRow));
}
__name(getUserReleases, "getUserReleases");
async function getRelease(env, uid, releaseId) {
  const row = await env.DB.prepare("SELECT * FROM releases WHERE id = ? AND user_uid = ?").bind(releaseId, uid).first();
  if (!row) return corsJson({ error: "Sortie non trouv\xE9e" }, 404);
  return corsJson(formatReleaseRow(row));
}
__name(getRelease, "getRelease");
async function getPublicRelease(env, releaseId) {
  const row = await env.DB.prepare("SELECT * FROM releases WHERE id = ?").bind(releaseId).first();
  if (!row) return corsJson({ error: "Sortie non trouv\xE9e" }, 404);
  return corsJson(formatReleaseRow(row));
}
__name(getPublicRelease, "getPublicRelease");
async function getAdminRelease(env, path, isAdminUser) {
  const releaseId = path.split("/").pop();
  const row = await env.DB.prepare("SELECT * FROM releases WHERE id = ?").bind(releaseId).first();
  if (!row) return corsJson({ error: "Sortie non trouv\xE9e" }, 404);
  return corsJson(formatReleaseRow(row));
}
__name(getAdminRelease, "getAdminRelease");
async function createRelease(env, uid, request, ctx) {
  const data = await request.json();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const formattedTerritories = typeof data.territories === "object" ? JSON.stringify(data.territories) : data.territories || "Tous les pays (Monde entier)";
  const artistName = data.artistName || "";
  const labelName = data.labelName?.trim() ? data.labelName : "Morgann Music CP";
  const copyrightLineC = data.copyrightLineC?.trim() ? data.copyrightLineC : artistName;
  const copyrightLineP = data.copyrightLineP?.trim() ? data.copyrightLineP : "Morgann Music CP";
  const res = await env.DB.prepare(`INSERT INTO releases ( user_uid, title, type, artist_name, cover_url, status, release_date, original_release_date, preorder_date, timezone, exact_time, primary_genre, secondary_genre, language, is_instrumental, label_name, copyright_line_c, copyright_line_p, std_copyright, manual_platforms, selected_platforms, additional_deliveries, version_line, licence_type, upc, territories, tracks, feats, apple_motion_11, apple_motion_34, animated_cover_url, release_url, spotify_url, apple_url, show_on_mmcp_catalog, premiere_slug, premiere_password, premiere_start_date, premiere_end_date, premiere_is_active, dolby_atmos, created_at, updated_at ) VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? )`).bind(
    uid,
    data.title || "",
    data.type || "Single",
    artistName,
    data.coverUrl || "",
    data.status || "brouillon",
    data.releaseDate || "",
    data.originalReleaseDate || "",
    data.preorderDate || "",
    data.timezone || "",
    data.exactTime || "",
    data.primaryGenre || "",
    data.secondaryGenre || "",
    data.language || "",
    data.isInstrumental ? 1 : 0,
    labelName,
    copyrightLineC,
    copyrightLineP,
    data.stdCopyright || "",
    data.manualPlatforms ? 1 : 0,
    JSON.stringify(data.selectedPlatforms || []),
    JSON.stringify(data.additionalDeliveries || []),
    data.versionLine || "",
    data.licenceType || "Copyright",
    data.upc || "",
    formattedTerritories,
    JSON.stringify(data.tracks || []),
    JSON.stringify(data.feats || []),
    data.appleMotion11 || null,
    data.appleMotion34 || null,
    data.animatedCoverUrl || null,
    data.releaseUrl || null,
    data.spotifyUrl || null,
    data.appleUrl || null,
    data.showOnMmcpCatalog !== false ? 1 : 0,
    data.premiereSlug || null,
    data.premierePassword || null,
    data.premiereStartDate || null,
    data.premiereEndDate || null,
    data.premiereIsActive ? 1 : 0,
    data.dolbyAtmos ? 1 : 0,
    now,
    now
  ).run();
  await sendNotification(
    env,
    ctx,
    uid,
    "Nouvelle sortie cr\xE9\xE9e",
    `Votre sortie "${data.title || "Sans titre"}" a \xE9t\xE9 cr\xE9\xE9e avec succ\xE8s.`,
    "release",
    `/sortie.html?id=${res.meta.last_row_id}`
  );
  return corsJson({ id: res.meta.last_row_id, success: true }, 201);
}
__name(createRelease, "createRelease");
async function patchRelease(env, uid, releaseId, request, ctx) {
  try {
    const data = await request.json();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const rel = await env.DB.prepare("SELECT user_uid, title, status FROM releases WHERE id = ?").bind(releaseId).first();
    let formattedTerritories = null;
    if (data.territories !== void 0) {
      formattedTerritories = typeof data.territories === "object" ? JSON.stringify(data.territories) : data.territories;
    }
    await env.DB.prepare(`UPDATE releases SET title = COALESCE(?, title), type = COALESCE(?, type), artist_name = COALESCE(?, artist_name), cover_url = COALESCE(?, cover_url), status = COALESCE(?, status), release_date = COALESCE(?, release_date), original_release_date = COALESCE(?, original_release_date), preorder_date = COALESCE(?, preorder_date), timezone = COALESCE(?, timezone), exact_time = COALESCE(?, exact_time), primary_genre = COALESCE(?, primary_genre), secondary_genre = COALESCE(?, secondary_genre), language = COALESCE(?, language), is_instrumental = COALESCE(?, is_instrumental), label_name = COALESCE(?, label_name), copyright_line_c = COALESCE(?, copyright_line_c), copyright_line_p = COALESCE(?, copyright_line_p), std_copyright = COALESCE(?, std_copyright), manual_platforms = COALESCE(?, manual_platforms), selected_platforms = COALESCE(?, selected_platforms), additional_deliveries = COALESCE(?, additional_deliveries), version_line = COALESCE(?, version_line), licence_type = COALESCE(?, licence_type), upc = COALESCE(?, upc), territories = COALESCE(?, territories), tracks = COALESCE(?, tracks), feats = COALESCE(?, feats), apple_motion_11 = COALESCE(?, apple_motion_11), apple_motion_34 = COALESCE(?, apple_motion_34), animated_cover_url = COALESCE(?, animated_cover_url), release_url = COALESCE(?, release_url), spotify_url = COALESCE(?, spotify_url), apple_url = COALESCE(?, apple_url), show_on_mmcp_catalog = COALESCE(?, show_on_mmcp_catalog), premiere_slug = COALESCE(?, premiere_slug), premiere_password = COALESCE(?, premiere_password), premiere_start_date = COALESCE(?, premiere_start_date), premiere_end_date = COALESCE(?, premiere_end_date), premiere_is_active = COALESCE(?, premiere_is_active), dolby_atmos = COALESCE(?, dolby_atmos), updated_at = ? WHERE id = ?`).bind(
      data.title !== void 0 ? data.title : null,
      data.type !== void 0 ? data.type : null,
      data.artistName !== void 0 ? data.artistName : null,
      data.coverUrl !== void 0 ? data.coverUrl : null,
      data.status !== void 0 ? data.status : null,
      data.releaseDate !== void 0 ? data.releaseDate : null,
      data.originalReleaseDate !== void 0 ? data.originalReleaseDate : null,
      data.preorderDate !== void 0 ? data.preorderDate : null,
      data.timezone !== void 0 ? data.timezone : null,
      data.exactTime !== void 0 ? data.exactTime : null,
      data.primaryGenre !== void 0 ? data.primaryGenre : null,
      data.secondaryGenre !== void 0 ? data.secondaryGenre : null,
      data.language !== void 0 ? data.language : null,
      data.isInstrumental !== void 0 ? data.isInstrumental ? 1 : 0 : null,
      data.labelName !== void 0 ? data.labelName : null,
      data.copyrightLineC !== void 0 ? data.copyrightLineC : null,
      data.copyrightLineP !== void 0 ? data.copyrightLineP : null,
      data.stdCopyright !== void 0 ? data.stdCopyright : null,
      data.manualPlatforms !== void 0 ? data.manualPlatforms ? 1 : 0 : null,
      data.selectedPlatforms !== void 0 ? JSON.stringify(data.selectedPlatforms) : null,
      data.additionalDeliveries !== void 0 ? JSON.stringify(data.additionalDeliveries) : null,
      data.versionLine !== void 0 ? data.versionLine : null,
      data.licenceType !== void 0 ? data.licenceType : null,
      data.upc !== void 0 ? data.upc : null,
      formattedTerritories,
      data.tracks !== void 0 ? JSON.stringify(data.tracks) : null,
      data.feats !== void 0 ? JSON.stringify(data.feats) : null,
      data.appleMotion11 !== void 0 ? data.appleMotion11 : null,
      data.appleMotion34 !== void 0 ? data.appleMotion34 : null,
      data.animatedCoverUrl !== void 0 ? data.animatedCoverUrl : null,
      data.releaseUrl !== void 0 ? data.releaseUrl : null,
      data.spotifyUrl !== void 0 ? data.spotifyUrl : null,
      data.appleUrl !== void 0 ? data.appleUrl : null,
      data.showOnMmcpCatalog !== void 0 ? data.showOnMmcpCatalog ? 1 : 0 : null,
      data.premiereSlug !== void 0 ? data.premiereSlug : null,
      data.premierePassword !== void 0 ? data.premierePassword : null,
      data.premiereStartDate !== void 0 ? data.premiereStartDate : null,
      data.premiereEndDate !== void 0 ? data.premiereEndDate : null,
      data.premiereIsActive !== void 0 ? data.premiereIsActive ? 1 : 0 : null,
      data.dolbyAtmos !== void 0 ? data.dolbyAtmos ? 1 : 0 : null,
      now,
      releaseId
    ).run();
    if (rel && data.status && data.status !== rel.status) {
      await triggerReleaseStatusNotification(env, ctx, rel.user_uid, rel.title, releaseId, rel.status, data.status);
    }
    return corsJson({ id: releaseId, success: true });
  } catch (err) {
    console.error("Erreur patchRelease :", err);
    return corsJson({ error: `Erreur mise \xE0 jour: ${err.message}` }, 500);
  }
}
__name(patchRelease, "patchRelease");
async function adminPatchRelease(env, userId, request, path, ctx) {
  try {
    const data = await request.json();
    const releaseId = data.id || (path ? path.split("/").pop() : null);
    if (!releaseId) return corsJson({ error: "ID de sortie manquant" }, 400);
    const rel = await env.DB.prepare("SELECT user_uid, title, status FROM releases WHERE id = ?").bind(releaseId).first();
    await env.DB.prepare(`UPDATE releases SET status = COALESCE(?, status), upc = COALESCE(?, upc), updated_at = ? WHERE id = ?`).bind(
      data.status || null,
      data.upc || null,
      (/* @__PURE__ */ new Date()).toISOString(),
      releaseId
    ).run();
    if (rel && data.status && data.status !== rel.status) {
      await triggerReleaseStatusNotification(env, ctx, rel.user_uid, rel.title, releaseId, rel.status, data.status);
    }
    return corsJson({ success: true });
  } catch (err) {
    console.error("Erreur adminPatchRelease :", err);
    return corsJson({ error: `Erreur mise \xE0 jour admin: ${err.message}` }, 500);
  }
}
__name(adminPatchRelease, "adminPatchRelease");
async function deleteRelease(env, uid, releaseId) {
  await env.DB.prepare("DELETE FROM releases WHERE id = ? AND user_uid = ?").bind(releaseId, uid).run();
  return corsJson({ success: true });
}
__name(deleteRelease, "deleteRelease");
function formatReleaseRow(row) {
  if (!row) return null;
  let selectedPlatforms = [];
  try {
    selectedPlatforms = JSON.parse(row.selected_platforms || "[]");
  } catch (e) {
  }
  let additionalDeliveries = [];
  try {
    additionalDeliveries = JSON.parse(row.additional_deliveries || "[]");
  } catch (e) {
  }
  let tracks = [];
  try {
    tracks = JSON.parse(row.tracks || "[]");
  } catch (e) {
  }
  let feats = [];
  try {
    feats = JSON.parse(row.feats || "[]");
  } catch (e) {
  }
  let territories = row.territories || "Tous les pays (Monde entier)";
  try {
    if (typeof territories === "string" && (territories.startsWith("[") || territories.startsWith("{"))) {
      territories = JSON.parse(territories);
    }
  } catch (e) {
  }
  const artistName = row.artist_name || "";
  let labelName = row.label_name || "";
  let copyrightLineC = row.copyright_line_c || "";
  let copyrightLineP = row.copyright_line_p || "";
  if (!labelName.trim()) labelName = "Morgann Music CP";
  if (!copyrightLineC.trim()) copyrightLineC = artistName;
  if (!copyrightLineP.trim()) copyrightLineP = "Morgann Music CP";
  return {
    id: row.id,
    userUid: row.user_uid,
    userId: row.user_uid,
    title: row.title || "",
    type: row.type || "Single",
    artistName,
    coverUrl: row.cover_url || "",
    status: row.status || "brouillon",
    releaseDate: row.release_date || "",
    originalReleaseDate: row.original_release_date || "",
    preorderDate: row.preorder_date || "",
    timezone: row.timezone || "",
    exactTime: row.exact_time || "",
    primaryGenre: row.primary_genre || "",
    secondaryGenre: row.secondary_genre || "",
    language: row.language || "",
    isInstrumental: Boolean(row.is_instrumental),
    labelName,
    copyrightLineC,
    copyrightLineP,
    std_copyright: row.std_copyright || "",
    manualPlatforms: Boolean(row.manual_platforms),
    selectedPlatforms,
    additionalDeliveries,
    versionLine: row.version_line || "",
    licenceType: row.licence_type || "Copyright",
    upc: row.upc || "",
    territories,
    tracks,
    feats,
    appleMotion11: row.apple_motion_11 || null,
    appleMotion34: row.apple_motion_34 || null,
    animatedCoverUrl: row.animated_cover_url || null,
    releaseUrl: row.release_url || null,
    spotifyUrl: row.spotify_url || null,
    appleUrl: row.apple_url || null,
    showOnMmcpCatalog: row.show_on_mmcp_catalog !== 0,
    premiereSlug: row.premiere_slug || null,
    premierePassword: row.premiere_password || null,
    premiereStartDate: row.premiere_start_date || null,
    premiereEndDate: row.premiere_end_date || null,
    premiereIsActive: Boolean(row.premiere_is_active),
    dolbyAtmos: Boolean(row.dolby_atmos),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
__name(formatReleaseRow, "formatReleaseRow");
async function uploadFile(env, userId, type, request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file) {
      return corsJson({ error: "Aucun fichier fourni" }, 400);
    }
    const filename = file.name || "upload";
    const ext = filename.split(".").pop();
    const key = `${type}/${userId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
    const bucket = getBucket(env, type);
    if (bucket) {
      await bucket.put(key, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type || getContentType(ext) }
      });
    } else if (env.FILES_KV) {
      await env.FILES_KV.put(key, await file.arrayBuffer());
    } else {
      return corsJson({ error: "Stockage R2 non configur\xE9 sur le worker" }, 500);
    }
    const url = `/api/files/${encodeURIComponent(key)}`;
    return corsJson({ key, url, success: true });
  } catch (err) {
    return corsJson({ error: `Erreur de t\xE9l\xE9versement: ${err.message}` }, 500);
  }
}
__name(uploadFile, "uploadFile");
async function uploadChunk(env, userId, request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const chunkIndex = Number(formData.get("chunkIndex"));
    const totalChunks = Number(formData.get("totalChunks"));
    const uploadId = String(formData.get("uploadId") || "");
    const type = String(formData.get("type") || "track");
    if (!file || !uploadId) {
      return corsJson({ error: "Chunk invalide" }, 400);
    }
    const bucket = getBucket(env, type);
    if (!bucket) {
      return corsJson({ error: "Stockage R2 non configur\xE9 sur le worker" }, 500);
    }
    const chunkKey = `uploads/chunks/${userId}/${type}/${uploadId}/${chunkIndex}.part`;
    await bucket.put(chunkKey, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type || "application/octet-stream" }
    });
    return corsJson({ success: true, chunkIndex, totalChunks, uploadId, key: chunkKey });
  } catch (err) {
    return corsJson({ error: `Erreur d'envoi de chunk: ${err.message}` }, 500);
  }
}
__name(uploadChunk, "uploadChunk");
async function completeChunkUpload(env, userId, request) {
  try {
    const formData = await request.formData();
    const uploadId = String(formData.get("uploadId") || "");
    const type = String(formData.get("type") || "track");
    const originalFileName = String(formData.get("originalFileName") || "upload.bin");
    const bucket = getBucket(env, type);
    if (!bucket) {
      return corsJson({ error: "Stockage R2 non configur\xE9 sur le worker" }, 500);
    }
    const prefix = `uploads/chunks/${userId}/${type}/${uploadId}/`;
    const listing = await bucket.list({ prefix });
    const chunks = (listing.objects || []).sort((a, b) => {
      const aIndex = Number((a.key.split("/").pop() || "0").replace(/\.part$/, ""));
      const bIndex = Number((b.key.split("/").pop() || "0").replace(/\.part$/, ""));
      return aIndex - bIndex;
    });
    if (!chunks.length) {
      return corsJson({ error: "Aucun chunk trouv\xE9 pour reconstitution" }, 400);
    }
    const ext = originalFileName.split(".").pop() || "bin";
    const finalKey = `${type}/${userId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
    const contentType = getContentType(ext);
    if (typeof bucket.createMultipartUpload === "function") {
      const multipart = await bucket.createMultipartUpload(finalKey, {
        httpMetadata: { contentType }
      });
      const uploadedParts = [];
      for (let index = 0; index < chunks.length; index++) {
        const chunk = chunks[index];
        const object = await bucket.get(chunk.key);
        if (!object || !object.body) {
          throw new Error(`Chunk ${index} introuvable lors de la reconstitution`);
        }
        const partData = await object.arrayBuffer();
        const partNumber = index + 1;
        const uploadedPart = await multipart.uploadPart(partNumber, partData);
        const etag = uploadedPart?.etag ?? uploadedPart?.ETag ?? uploadedPart;
        uploadedParts.push({ partNumber, etag: String(etag) });
      }
      await multipart.complete(uploadedParts);
    } else {
      let totalLength = 0;
      const buffers = [];
      for (const chunk of chunks) {
        const obj = await bucket.get(chunk.key);
        if (!obj) continue;
        const buf = await obj.arrayBuffer();
        buffers.push(new Uint8Array(buf));
        totalLength += buf.byteLength;
      }
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const buf of buffers) {
        combined.set(buf, offset);
        offset += buf.byteLength;
      }
      await bucket.put(finalKey, combined.buffer, {
        httpMetadata: { contentType }
      });
    }
    for (const chunk of chunks) {
      await bucket.delete(chunk.key);
    }
    const url = `/api/files/${encodeURIComponent(finalKey)}`;
    return corsJson({ key: finalKey, url, success: true, uploadId });
  } catch (err) {
    return corsJson({ error: `Erreur de reconstitution: ${err.message}` }, 500);
  }
}
__name(completeChunkUpload, "completeChunkUpload");
async function serveFile(env, rawKey) {
  try {
    let key = decodeURIComponent(String(rawKey || "")).trim();
    key = key.replace(/^\/+/, "");
    if (key.startsWith("api/files/")) {
      key = key.replace(/^api\/files\//, "");
    }
    if (key.startsWith("/api/files/")) {
      key = key.replace(/^\/api\/files\//, "");
    }
    if (!key) {
      return new Response("Fichier non trouv\xE9", { status: 404 });
    }
    const isMediaKey = /^(track|atmos|inst|motion|cover|pochette|lyrics|lrics|document|logo)\//.test(key);
    const bucket = isMediaKey ? env.STORAGE || env.BUCKET || env.MEDIA_BUCKET || env.R2 : env.BUCKET || env.MEDIA_BUCKET || env.STORAGE || env.R2;
    if (bucket) {
      const object = await bucket.get(key);
      if (!object) return new Response("Fichier non trouv\xE9", { status: 404 });
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      const ext = key.split(".").pop();
      if (ext && ext.toLowerCase() === "mp4") {
        headers.set("content-type", "video/mp4");
      } else if (ext && (ext.toLowerCase() === "lrc" || ext.toLowerCase() === "srt")) {
        headers.set("content-type", "text/plain; charset=utf-8");
      } else if (ext && ext.toLowerCase() === "pdf") {
        headers.set("content-type", "application/pdf");
      }
      headers.set("etag", object.httpEtag);
      headers.set("Access-Control-Allow-Origin", "*");
      headers.set("Accept-Ranges", "bytes");
      return new Response(object.body, { headers });
    }
    if (env.FILES_KV) {
      const value = await env.FILES_KV.get(key, "arrayBuffer");
      if (!value) return new Response("Fichier non trouv\xE9", { status: 404 });
      return new Response(value, { headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "text/plain; charset=utf-8" } });
    }
    return new Response("Stockage non disponible", { status: 500 });
  } catch (err) {
    return new Response(`Erreur: ${err.message}`, { status: 500 });
  }
}
__name(serveFile, "serveFile");
async function getAllReviews(env) {
  const { results } = await env.DB.prepare("SELECT * FROM reviews ORDER BY created_at DESC").all();
  return corsJson(results);
}
__name(getAllReviews, "getAllReviews");
async function upsertReview(env, request) {
  try {
    const data = await request.json();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const userUid = data.userUid || data.user_uid || "anonymous";
    const artistName = data.artistName || data.artist_name || "";
    const rating = Number(data.rating) || 5;
    const comment = data.comment || data.message || "";
    await env.DB.prepare(`
      INSERT INTO reviews (user_uid, artist_name, rating, comment, message, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(userUid, artistName, rating, comment, comment, now, now).run();
    return corsJson({ success: true });
  } catch (err) {
    console.error("Erreur upsertReview:", err);
    return corsJson({ error: err.message }, 500);
  }
}
__name(upsertReview, "upsertReview");
async function updateReview(env, reviewId, request) {
  try {
    const data = await request.json();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const rating = Number(data.rating) || 5;
    const comment = data.comment || data.message || "";
    await env.DB.prepare(`
      UPDATE reviews 
      SET rating = ?, comment = ?, message = ?, updated_at = ?
      WHERE id = ?
    `).bind(rating, comment, comment, now, reviewId).run();
    return corsJson({ success: true });
  } catch (err) {
    console.error("Erreur updateReview:", err);
    return corsJson({ error: err.message }, 500);
  }
}
__name(updateReview, "updateReview");
async function getAllVersions(env) {
  try {
    const { results } = await env.DB.prepare("SELECT * FROM app_versions ORDER BY id DESC").all();
    return corsJson(results.map((row) => ({
      id: row.id,
      version: row.version || row.version_name || "",
      description: row.description || row.release_notes || "",
      date: row.date || row.created_at || ""
    })));
  } catch (err) {
    return corsJson([]);
  }
}
__name(getAllVersions, "getAllVersions");
async function createVersionSafe(env, request) {
  try {
    const data = await request.json();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const version = data.version || data.versionName || "";
    const description = data.description || data.releaseNotes || "";
    const dateStr = data.date || now;
    const res = await env.DB.prepare(`
      INSERT INTO app_versions (version, description, version_name, release_notes, date, created_at) 
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(version, description, version, description, dateStr, now).run();
    return corsJson({ id: res.meta.last_row_id, success: true }, 201);
  } catch (err) {
    return corsJson({ error: err.message }, 500);
  }
}
__name(createVersionSafe, "createVersionSafe");
async function patchVersionSafe(env, versionId, request) {
  try {
    const data = await request.json();
    const version = data.version !== void 0 ? data.version : data.versionName !== void 0 ? data.versionName : null;
    const description = data.description !== void 0 ? data.description : data.releaseNotes !== void 0 ? data.releaseNotes : null;
    await env.DB.prepare(`
      UPDATE app_versions 
      SET version = COALESCE(?, version),
          description = COALESCE(?, description),
          version_name = COALESCE(?, version_name),
          release_notes = COALESCE(?, release_notes)
      WHERE id = ?
    `).bind(version, description, version, description, versionId).run();
    return corsJson({ success: true });
  } catch (err) {
    return corsJson({ error: err.message }, 500);
  }
}
__name(patchVersionSafe, "patchVersionSafe");
async function createMessage(env, request) {
  const data = await request.json();
  try {
    await env.DB.prepare(`INSERT INTO messages (name, email, subject, message, created_at) VALUES (?, ?, ?, ?, ?)`).bind(
      data.name || null,
      data.email,
      data.subject || "Contact direct",
      data.message,
      (/* @__PURE__ */ new Date()).toISOString()
    ).run();
  } catch (e) {
    console.error("Erreur insertion message D1:", e);
    return corsJson({ error: e.message }, 500);
  }
  return corsJson({ success: true });
}
__name(createMessage, "createMessage");
async function getAllMessages(env, userId, isAdminUser) {
  try {
    const { results } = await env.DB.prepare("SELECT * FROM messages ORDER BY created_at DESC").all();
    return corsJson(results);
  } catch {
    return corsJson([]);
  }
}
__name(getAllMessages, "getAllMessages");
async function getAllWithdrawals(env, userId, isAdminUser) {
  try {
    const { results } = await env.DB.prepare("SELECT * FROM withdrawals ORDER BY created_at DESC").all();
    return corsJson(results);
  } catch {
    return corsJson([]);
  }
}
__name(getAllWithdrawals, "getAllWithdrawals");
async function patchWithdrawal(env, userId, path, request, isAdminUser, ctx) {
  if (!isAdminUser) return corsJson({ error: "Acc\xE8s non autoris\xE9" }, 403);
  const id = path.split("/").pop();
  const data = await request.json();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  try {
    const withdrawal = await env.DB.prepare("SELECT * FROM withdrawals WHERE id = ?").bind(id).first();
    if (!withdrawal) {
      return corsJson({ error: "Retrait introuvable" }, 404);
    }
    const oldStatus = withdrawal.status;
    const newStatus = data.status;
    await env.DB.prepare("UPDATE withdrawals SET status = ? WHERE id = ?").bind(newStatus, id).run();
    const amount = Math.abs(Number(withdrawal.amount));
    const period = (/* @__PURE__ */ new Date()).toISOString().substring(0, 7);
    if (newStatus === "envoy\xE9" && oldStatus !== "envoy\xE9") {
      await env.DB.prepare(`
        INSERT INTO finances (user_uid, amount, period, release_id, release_title, artist_name, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        withdrawal.user_uid,
        -amount,
        period,
        "RETRAIT",
        `Retrait valid\xE9 #${id}`,
        "MMCP",
        now
      ).run();
      await sendNotification(
        env,
        ctx,
        withdrawal.user_uid,
        "Retrait valid\xE9 et envoy\xE9",
        `Votre demande de versement #${id} d'un montant de ${amount} \u20AC a \xE9t\xE9 valid\xE9e.`,
        "withdrawal",
        "/mes-revenus.html"
      );
    }
    if (oldStatus === "envoy\xE9" && newStatus !== "envoy\xE9") {
      await env.DB.prepare(`
        INSERT INTO finances (user_uid, amount, period, release_id, release_title, artist_name, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        withdrawal.user_uid,
        amount,
        period,
        "RETRAIT_ANNULE",
        `Annulation retrait #${id}`,
        "MMCP",
        now
      ).run();
      await sendNotification(
        env,
        ctx,
        withdrawal.user_uid,
        "Retrait annul\xE9",
        `Le statut de votre demande de versement #${id} a \xE9t\xE9 modifi\xE9.`,
        "withdrawal",
        "/mes-revenus.html"
      );
    }
    return corsJson({ success: true });
  } catch (e) {
    console.error("Erreur patchWithdrawal:", e);
    return corsJson({ error: e.message }, 500);
  }
}
__name(patchWithdrawal, "patchWithdrawal");
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
