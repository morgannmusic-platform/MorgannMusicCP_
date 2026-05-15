export const firebaseConfig = {
    apiKey: "AIzaSyDSPUArpApBuK0Cn9VbeMtqk4JC-gqruJc",
    authDomain: "morgann-music-cp.firebaseapp.com",
    projectId: "morgann-music-cp",
    storageBucket: "morgann-music-cp.firebasestorage.app",
    messagingSenderId: "666812685196",
    appId: "1:666812685196:web:fe3df6749ae768d68494a9"
};

export function clean(value) {
    return String(value || "").trim();
}

export function parseAnyDateMs(raw) {
    if (!raw) return null;
    if (typeof raw?.toMillis === "function") return raw.toMillis();
    if (typeof raw?.toDate === "function") return raw.toDate().getTime();
    if (raw instanceof Date) return raw.getTime();
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;

    const text = clean(raw);
    if (!text) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        const date = new Date(`${text}T00:00:00`);
        return Number.isNaN(date.getTime()) ? null : date.getTime();
    }

    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date.getTime();
}

export function parseReleaseDateMs(release) {
    return parseAnyDateMs(
        release?.schedule?.releaseDate ||
        release?.releaseDate ||
        release?.releaseAt ||
        release?.createdAt ||
        null
    );
}

export function inferReleaseStatusCode(release) {
    const numeric = Number(clean(release?.statusCode || release?.status || ""));
    if (Number.isFinite(numeric)) return numeric;

    const text = [
        clean(release?.statusUser),
        clean(release?.statusAdmin),
        clean(release?.statusPlatform),
        clean(release?.status)
    ].join(" ").toLowerCase();

    if (text.includes("refus")) return 5;
    if (text.includes("en ligne") || text.includes("published")) return 4;
    if (text.includes("livr")) return 3;
    if (text.includes("valid")) return 2;
    return 1;
}

export function isReleasePublic(release) {
    const releaseDateMs = parseReleaseDateMs(release);
    const statusCode = inferReleaseStatusCode(release);
    return !!releaseDateMs && releaseDateMs <= Date.now() && statusCode >= 2;
}

export function formatReleaseDate(raw, locale = "fr-FR") {
    const ms = parseAnyDateMs(raw);
    if (!ms) return "—";
    return new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "long",
        year: "numeric"
    }).format(new Date(ms));
}

export function buildArtistUrl(artistId, artistName) {
    const params = new URLSearchParams();
    if (clean(artistId)) params.set("id", clean(artistId));
    if (clean(artistName)) params.set("name", clean(artistName));
    return `/play/artiste.html?${params.toString()}`;
}

export function buildReleaseUrl(releaseId) {
    return `/last-release.html?id=${encodeURIComponent(clean(releaseId))}`;
}

function pickFirstUrl(...candidates) {
    for (const candidate of candidates) {
        const value = clean(candidate);
        if (value) return value;
    }
    return "";
}

function normalizeExternalUrl(raw) {
    const value = clean(raw);
    if (!value) return "";
    if (/^https?:\/\//i.test(value)) return value;
    if (/^[a-z]+:\/\//i.test(value)) return value;
    if (/^(spotify:|apple:|itms:)/i.test(value)) return value;
    return `https://${value}`;
}

export function extractAudioUrl(release) {
    const firstTrack = Array.isArray(release?.tracks) ? release.tracks[0] || {} : {};
    return pickFirstUrl(
        firstTrack?.files?.audioUrl,
        firstTrack?.audioUrl,
        release?.assets?.audioUrl,
        release?.audioUrl
    );
}

export function extractLyricsRaw(release) {
    const firstTrack = Array.isArray(release?.tracks) ? release.tracks[0] || {} : {};
    return pickFirstUrl(
        firstTrack?.lyrics,
        release?.lyrics,
        release?.play?.lyrics,
        release?.assets?.lyrics
    );
}

export function extractCoverUrl(release, artistData = null) {
    return pickFirstUrl(
        release?.assets?.coverUrl,
        release?.play?.coverUrl,
        artistData?.playProfileImageUrl,
        "/assets/img/1.png"
    );
}

export function extractPlatformLinks(release, artistData = null) {
    return {
        apple: normalizeExternalUrl(pickFirstUrl(
            release?.platformLinks?.apple,
            release?.platformLinks?.appleMusic,
            release?.apple,
            release?.appleMusic,
            release?.appleUrl,
            release?.appleMusicUrl,
            release?.platforms?.apple,
            release?.platforms?.appleMusic,
            release?.links?.apple,
            release?.links?.appleMusic,
            artistData?.appleMusic?.url,
            artistData?.appleMusic,
            artistData?.apple,
            artistData?.links?.apple,
            artistData?.links?.appleMusic
        )),
        spotify: normalizeExternalUrl(pickFirstUrl(
            release?.platformLinks?.spotify,
            release?.spotify,
            release?.spotifyUrl,
            release?.platforms?.spotify,
            release?.links?.spotify,
            artistData?.spotify?.uriOrUrl,
            artistData?.spotify,
            artistData?.spotifyUrl,
            artistData?.links?.spotify
        )),
        deezer: normalizeExternalUrl(pickFirstUrl(
            release?.platformLinks?.deezer,
            release?.deezer,
            release?.deezerUrl,
            release?.platforms?.deezer,
            release?.links?.deezer,
            artistData?.deezer,
            artistData?.deezerUrl,
            artistData?.links?.deezer
        )),
        youtube: normalizeExternalUrl(pickFirstUrl(
            release?.platformLinks?.youtube,
            release?.platformLinks?.youtubeMusic,
            release?.platformLinks?.ytmusic,
            release?.youtube,
            release?.youtubeMusic,
            release?.ytmusic,
            release?.youtubeUrl,
            release?.youtubeMusicUrl,
            release?.platforms?.youtube,
            release?.platforms?.youtubeMusic,
            release?.platforms?.ytmusic,
            release?.links?.youtube,
            release?.links?.youtubeMusic,
            release?.links?.ytmusic,
            artistData?.youtube,
            artistData?.youtubeMusic,
            artistData?.ytmusic,
            artistData?.youtubeUrl,
            artistData?.youtubeMusicUrl,
            artistData?.links?.youtube,
            artistData?.links?.youtubeMusic,
            artistData?.links?.ytmusic
        ))
    };
}

export function normalizeReleaseData(releaseId, release, artistData = null) {
    const artistId = clean(release?.artistId || release?.mainArtistId || artistData?.id);
    const artistName = clean(release?.artistName || release?.artist || artistData?.displayName || artistData?.name) || "Artiste";
    const title = clean(release?.title || release?.name) || "Sans titre";
    const type = clean(release?.type) || "Sortie";
    const firstTrack = Array.isArray(release?.tracks) ? release.tracks[0] || {} : {};
    const coverUrl = extractCoverUrl(release, artistData);
    const audioUrl = extractAudioUrl(release);
    const lyricsRaw = extractLyricsRaw(release);
    const platformLinks = extractPlatformLinks(release, artistData);

    return {
        id: clean(releaseId),
        title,
        artistId,
        artistName,
        type,
        version: clean(release?.version),
        coverUrl,
        animatedCoverUrl: release?.assets?.animatedCoverUrl || "",
        audioUrl,
        lyricsRaw,
        platformLinks,
        releaseDateRaw: release?.schedule?.releaseDate || release?.releaseDate || null,
        releaseDateLabel: formatReleaseDate(release?.schedule?.releaseDate || release?.releaseDate || null),
        primaryGenre: clean(release?.primaryGenre),
        trackTitle: clean(firstTrack?.title) || title,
        trackCount: Array.isArray(release?.tracks) ? release.tracks.length : 0,
        artistUrl: buildArtistUrl(artistId, artistName),
        releaseUrl: buildReleaseUrl(releaseId)
    };
}

export function sortReleasesByDate(releases) {
    return [...releases].sort((left, right) => {
        return (parseReleaseDateMs(right) || 0) - (parseReleaseDateMs(left) || 0);
    });
}

export function findLatestRelease(releases) {
    return sortReleasesByDate(releases.filter(isReleasePublic))[0] || null;
}