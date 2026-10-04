import { auth } from "/assets/js/firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { api } from "/assets/js/api.js";

let existingReviewsMap = new Map();

function getFullMediaUrl(url) {
    if (!url) return null;
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
        return url;
    }
    return api.fileUrl ? api.fileUrl(url) : `/api/files/${url.replace(/^\/+/, '')}`;
}

function getRoundedStarSvg(isFilled, customClass = "star-svg") {
    const fillColor = isFilled ? "#FC8FB0" : "none";
    const strokeColor = "#FC8FB0";
    return `<svg class="${customClass} ${isFilled ? 'filled' : ''}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke-linejoin="round" stroke-linecap="round" stroke-width="1.5" stroke="${strokeColor}" fill="${fillColor}" rx="2" ry="2"/>
            </svg>`;
}

function renderStars(ratingValue, animate = false) {
    let html = '';
    const starsCount = Math.round(ratingValue);
    for (let i = 1; i <= 5; i++) {
        html += getRoundedStarSvg(i <= starsCount);
    }
    return html;
}

function animateStarsIn(containerElement) {
    if (!containerElement) return;
    const stars = containerElement.querySelectorAll('.star-svg');
    if (stars.length === 0) return;

    gsap.fromTo(stars,
        { scale: 0, rotation: -30, opacity: 0 },
        {
            scale: 1,
            rotation: 0,
            opacity: 1,
            duration: 0.5,
            stagger: 0.08,
            ease: "back.out(1.7)"
        }
    );
}

function initStarPicker(currentRating = 5) {
    const picker = document.getElementById("star-picker");
    const ratingInput = document.getElementById("review-rating");
    picker.innerHTML = '';

    for (let i = 1; i <= 5; i++) {
        const wrapper = document.createElement("div");
        wrapper.innerHTML = getRoundedStarSvg(i <= currentRating, "star-svg interactive-star");
        const svgEl = wrapper.firstElementChild;

        svgEl.addEventListener("mouseenter", () => {
            highlightStars(i);
            gsap.to(svgEl, { scale: 1.2, rotation: 10, duration: 0.3, ease: "back.out(1.5)" });
        });

        svgEl.addEventListener("mouseleave", () => {
            gsap.to(svgEl, { scale: 1, rotation: 0, duration: 0.2 });
        });

        svgEl.addEventListener("click", () => {
            ratingInput.value = i;
            highlightStars(i);
            gsap.fromTo(svgEl, { scale: 0.5 }, { scale: 1.2, duration: 0.5, ease: "elastic.out(1, 0.3)" });
        });

        picker.appendChild(wrapper);
    }

    picker.onmouseleave = () => {
        highlightStars(parseInt(ratingInput.value, 10));
    };

    highlightStars(currentRating);
    animateStarsIn(picker);
}

function highlightStars(count) {
    const stars = document.querySelectorAll("#star-picker .star-svg");
    stars.forEach((star, index) => {
        const path = star.querySelector("path");
        if (index < count) {
            star.classList.add("filled");
            if (path) path.setAttribute("fill", "#FC8FB0");
        } else {
            star.classList.remove("filled");
            if (path) path.setAttribute("fill", "none");
        }
    });
}

function normalizeArtistName(name) {
    return String(name || "").trim().toLowerCase();
}

function getReviewId(review) {
    return review?.id || review?._id || review?.reviewId || review?.review_id || null;
}

function isReviewOwnedByUser(review, userUid) {
    if (!review || !userUid) return false;
    return String(review.userUid || review.user_uid || review.uid || "") === String(userUid);
}

async function sendReviewRequest(method, url, data) {
    const response = await fetch(url, {
        method,
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    });

    let result = null;
    try {
        result = await response.json();
    } catch (_) {
        result = null;
    }

    if (!response.ok) {
        const message =
            result?.error ||
            result?.message ||
            `Erreur HTTP ${response.status}`;
        const error = new Error(message);
        error.status = response.status;
        throw error;
    }

    return result;
}

function updateSelectedArtistPreview(artistName, artistAvatarsMap, existingReview = null, currentUserUid = null) {
    const preview = document.getElementById("artist-selected-preview");
    const avatar = document.getElementById("selected-artist-avatar");
    const name = document.getElementById("selected-artist-name");
    const status = document.getElementById("selected-artist-status");

    if (!artistName) {
        preview.style.display = "none";
        return;
    }

    const key = normalizeArtistName(artistName);
    const avatarSrc = artistAvatarsMap.get(key) || "/assets/img/icons/pdp.png";

    avatar.src = avatarSrc;
    avatar.onerror = () => {
        avatar.onerror = null;
        avatar.src = "/assets/img/icons/pdp.png";
    };

    name.textContent = artistName;

    if (existingReview) {
        if (isReviewOwnedByUser(existingReview, currentUserUid)) {
            status.textContent = "Vous avez déjà publié un avis — vous pouvez le modifier.";
        } else {
            status.textContent = "Cet artiste possède déjà un avis.";
        }
    } else {
        status.textContent = "Aucun avis publié pour cet artiste.";
    }

    preview.style.display = "flex";
}

async function initAvisPage() {
    try {
        const artistsRes = await api.get('/api/artists');
        const artistsData = artistsRes.artists || artistsRes || [];
        const artistAvatarsMap = new Map();

        if (Array.isArray(artistsData)) {
            artistsData.forEach(art => {
                if (!art?.name) return;

                const key = normalizeArtistName(art.name);
                const photoUrl = art.photo || art.photoUrl || art.avatarUrl;
                const avatarUrl = photoUrl ? getFullMediaUrl(photoUrl) : "/assets/img/icons/pdp.png";

                artistAvatarsMap.set(key, avatarUrl);
            });
        }

        const reviewsList = await api.get("/api/reviews");
        existingReviewsMap.clear();

        let totalScore = 0;
        let reviewCount = 0;
        const reviewsListHtml = [];
        const displayedReviewKeys = new Set();

        if (Array.isArray(reviewsList)) {
            reviewsList.forEach(rev => {
                const artistName = (rev.artistName || rev.artist_name || "").trim();
                if (!artistName) return;

                const artistKey = normalizeArtistName(artistName);

                if (displayedReviewKeys.has(artistKey)) return;
                displayedReviewKeys.add(artistKey);

                existingReviewsMap.set(artistKey, rev);

                const rating = Math.min(5, Math.max(0, Number(rev.rating) || 0));
                totalScore += rating;
                reviewCount++;

                const dateValue = rev.updatedAt || rev.updated_at || rev.createdAt || rev.created_at;
                const dateFormatted = dateValue
                    ? new Date(dateValue).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric"
                    })
                    : "";

                const artistProfileUrl =
                    `/catalogue/artiste.html?name=${encodeURIComponent(artistName)}`;

                const rawRevPhoto = rev.photo || rev.artistPhoto || rev.artist_photo;
                const avatarSrc = artistAvatarsMap.get(artistKey) || (rawRevPhoto ? getFullMediaUrl(rawRevPhoto) : "/assets/img/icons/pdp.png");

                const reviewAuthorUid = rev.userUid || rev.user_uid || rev.uid || "";
                const reviewId = getReviewId(rev);

                reviewsListHtml.push(`
                            <div class="review-card" data-artist-key="${escapeHtml(artistKey)}">
                                <div class="review-header">
                                    <div class="review-author-info">
                                        <img
                                            src="${escapeHtml(avatarSrc)}"
                                            alt="${escapeHtml(artistName)}"
                                            class="review-avatar"
                                            onerror="this.onerror=null; this.src='/assets/img/icons/pdp.png';"
                                        >
                                        <div class="author-details">
                                            <a href="${artistProfileUrl}" class="review-author-link">
                                                ${escapeHtml(artistName)}
                                            </a>
                                            ${dateFormatted
                        ? `<span class="review-date">${escapeHtml(dateFormatted)}</span>`
                        : ""}
                                        </div>
                                    </div>
                                    <div class="stars-container">${renderStars(rating)}</div>
                                </div>

                                <p class="review-message">
                                    ${escapeHtml(rev.comment || rev.message || "")}
                                </p>

                                <div class="review-actions" data-review-uid="${escapeHtml(reviewAuthorUid)}" data-review-id="${escapeHtml(reviewId || "")}">
                                    <button
                                        type="button"
                                        class="review-edit-btn"
                                        data-edit-artist="${escapeHtml(artistName)}"
                                        style="display:none;"
                                    >
                                        Modifier mon avis
                                    </button>
                                </div>
                            </div>
                        `);
            });
        }

        const avgScoreEl = document.getElementById("avg-score");
        const avgStarsEl = document.getElementById("avg-stars");
        const totalTextEl = document.getElementById("total-reviews-text");

        if (reviewCount > 0) {
            const average = totalScore / reviewCount;
            avgScoreEl.innerText = average.toFixed(1);
            avgStarsEl.innerHTML = renderStars(Math.round(average));
            totalTextEl.innerText = `${reviewCount} avis publié(s)`;
            animateStarsIn(avgStarsEl);
        } else {
            avgScoreEl.innerText = "0.0";
            avgStarsEl.innerHTML = renderStars(0);
            totalTextEl.innerText = "0 avis publié(s)";
            animateStarsIn(avgStarsEl);
        }

        document.getElementById("reviews-list").innerHTML =
            reviewsListHtml.length > 0
                ? reviewsListHtml.join("")
                : `<p style="color:#64748b;font-size:14px;">Aucun avis publié pour le moment.</p>`;

        document.querySelectorAll(".review-card .stars-container").forEach(container => {
            animateStarsIn(container);
        });

        onAuthStateChanged(auth, async (user) => {
            const accessMsg = document.getElementById("form-access-message");
            const reviewForm = document.getElementById("review-form");
            const artistSelector = document.getElementById("artist-selector");

            if (!user) {
                accessMsg.className = "alert-box alert-warning";
                accessMsg.innerText = "Vous devez être connecté à votre compte pour laisser un avis.";
                reviewForm.style.display = "none";
                return;
            }

            try {
                let userArtists = await api.get(`/api/users/${user.uid}/artists`);

                if (!Array.isArray(userArtists)) {
                    userArtists = [];
                }

                const eligibleArtists = userArtists.filter(art => art?.name?.trim());

                if (eligibleArtists.length === 0) {
                    accessMsg.className = "alert-box alert-warning";
                    accessMsg.innerText = "Aucun profil d'artiste n'est rattaché à ce compte.";
                    reviewForm.style.display = "none";
                    return;
                }

                accessMsg.style.display = "none";
                reviewForm.style.display = "block";

                artistSelector.innerHTML = eligibleArtists.map(art => {
                    const artistName = art.name.trim();
                    return `<option value="${escapeHtml(artistName)}">${escapeHtml(artistName)}</option>`;
                }).join("");

                document.querySelectorAll(".review-edit-btn").forEach(button => {
                    const artistName = button.dataset.editArtist || "";
                    const review = existingReviewsMap.get(normalizeArtistName(artistName));

                    if (review && isReviewOwnedByUser(review, user.uid)) {
                        button.style.display = "inline-flex";
                        button.addEventListener("click", () => {
                            artistSelector.value = artistName;
                            triggerArtistSelection(
                                artistName,
                                artistAvatarsMap,
                                user.uid
                            );
                            document.getElementById("form-section-container")
                                .scrollIntoView({ behavior: "smooth", block: "start" });
                        });
                    }
                });

                triggerArtistSelection(
                    eligibleArtists[0].name.trim(),
                    artistAvatarsMap,
                    user.uid
                );

                artistSelector.addEventListener("change", (e) => {
                    triggerArtistSelection(
                        e.target.value,
                        artistAvatarsMap,
                        user.uid
                    );
                });

            } catch (err) {
                console.error("Erreur profil :", err);
                accessMsg.className = "alert-box alert-warning";
                accessMsg.innerText = "Erreur lors de la vérification de votre profil.";
            }
        });

    } catch (error) {
        console.error("Erreur chargement page :", error);
        document.getElementById("form-access-message").className = "alert-box alert-warning";
        document.getElementById("form-access-message").innerText =
            "Erreur lors du chargement des données.";
    }
}

function triggerArtistSelection(artistName, artistAvatarsMap = new Map(), currentUserUid = null) {
    const selectedName = normalizeArtistName(artistName);
    const submitBtn = document.getElementById("submit-btn-text");
    const formTitle = document.getElementById("form-title");
    const ratingInput = document.getElementById("review-rating");
    const messageTextarea = document.getElementById("review-message");

    const existing = existingReviewsMap.get(selectedName) || null;
    const ownedByCurrentUser = existing
        ? isReviewOwnedByUser(existing, currentUserUid)
        : false;

    updateSelectedArtistPreview(
        artistName,
        artistAvatarsMap,
        existing,
        currentUserUid
    );

    if (existing && ownedByCurrentUser) {
        formTitle.innerText = "Modifier votre avis existant";
        submitBtn.innerText = "Mettre à jour mon avis";
        submitBtn.disabled = false;

        const currentRating = Number(existing.rating) || 5;
        ratingInput.value = currentRating;
        messageTextarea.value = existing.comment || existing.message || "";
        messageTextarea.disabled = false;

        initStarPicker(currentRating);
        return;
    }

    if (existing && !ownedByCurrentUser) {
        formTitle.innerText = "Avis déjà publié";
        submitBtn.innerText = "Avis déjà publié";
        submitBtn.disabled = true;
        ratingInput.value = Number(existing.rating) || 5;
        messageTextarea.value = existing.comment || existing.message || "";
        messageTextarea.disabled = true;

        initStarPicker(Number(existing.rating) || 5);
        document.querySelectorAll("#star-picker .interactive-star").forEach(star => {
            star.style.pointerEvents = "none";
            star.style.opacity = "0.7";
        });
        return;
    }

    formTitle.innerText = "Laisser un avis";
    submitBtn.innerText = "Publier mon avis";
    submitBtn.disabled = false;

    ratingInput.value = 5;
    messageTextarea.value = "";
    messageTextarea.disabled = false;

    initStarPicker(5);
}

document.getElementById("review-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const artistName = document.getElementById("artist-selector").value.trim();
    const rating = parseInt(document.getElementById("review-rating").value, 10);
    const comment = document.getElementById("review-message").value.trim();
    const currentUser = auth.currentUser;

    if (!currentUser) {
        alert("Vous devez être connecté.");
        return;
    }

    if (!artistName) {
        alert("Veuillez sélectionner un artiste.");
        return;
    }

    if (!comment) {
        alert("Veuillez écrire un message.");
        return;
    }

    if (rating < 1 || rating > 5) {
        alert("La note doit être comprise entre 1 et 5.");
        return;
    }

    const artistKey = normalizeArtistName(artistName);
    const existing = existingReviewsMap.get(artistKey) || null;
    const ownedByCurrentUser = existing
        ? isReviewOwnedByUser(existing, currentUser.uid)
        : false;

    if (existing && !ownedByCurrentUser) {
        alert("Cet artiste possède déjà un avis. Un seul avis est autorisé par artiste.");
        return;
    }

    const submitBtn = document.getElementById("submit-btn-text");
    const originalText = submitBtn.innerText;
    submitBtn.disabled = true;
    submitBtn.innerText = existing ? "Mise à jour..." : "Publication...";

    const reviewData = {
        userUid: currentUser.uid,
        artistName,
        rating,
        comment
    };

    try {
        if (existing && ownedByCurrentUser) {
            const reviewId = getReviewId(existing);

            if (!reviewId) {
                throw new Error("L'identifiant de l'avis est absent.");
            }

            await sendReviewRequest(
                "PUT",
                `/api/reviews/${encodeURIComponent(reviewId)}`,
                reviewData
            );

            alert("Votre avis a bien été modifié !");
        } else {
            await sendReviewRequest("POST", "/api/reviews", reviewData);
            alert("Votre avis a bien été publié !");
        }

        window.location.reload();

    } catch (error) {
        console.error("Erreur enregistrement avis :", error);

        if (error.status === 409) {
            alert("Un avis existe déjà pour cet artiste.");
        } else {
            alert(error.message || "Une erreur est survenue lors de l'enregistrement.");
        }

        submitBtn.disabled = false;
        submitBtn.innerText = originalText;
    }
});

function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

initAvisPage();
