// Yerel now-playing sunucusu. Sırayla bakar:
//   1) Spotify'da şu an bir şey çalıyor mu?  -> evet: onu ver (source: "spotify")
//   2) Hayır (offline / duraklatılmış / hata) -> Last.fm'deki son 5-10 şarkıdan rastgele biri seçilir ve
//      Last.fm'den alınan şarkı süresi kadar "çalıyormuş gibi" gösterilir (çakma stream, source: "lastfm");
//      süre bitince sıradaki rastgele şarkıya geçilir.
// Secret'lar burada kalır, siteye sadece şarkı/sanatçı/kapak/ilerleme JSON'u gider.
// Kullanım: npm run now-playing:server   (sahte veriyle: -- --mock, --mock=spotify, --mock=lastfm)
import http from "node:http";
import { loadEnv, setEnvVar } from "./_env.mjs";

const env = loadEnv();
const PORT = Number(env.NOW_PLAYING_PORT || 8787);
const ALLOWED_ORIGIN = env.ALLOWED_ORIGIN || "*";
const mockArg = process.argv.find((a) => a === "--mock" || a.startsWith("--mock="));
const MOCK = env.MOCK === "1" || Boolean(mockArg);
const MOCK_MODE = mockArg?.split("=")[1] || env.MOCK_MODE || "cycle"; // cycle | spotify | lastfm
const TOKEN_URL = env.SPOTIFY_TOKEN_URL || "https://accounts.spotify.com/api/token";
const API_URL = env.SPOTIFY_API_URL || "https://api.spotify.com/v1";
const LASTFM_API_URL = env.LASTFM_API_URL || "https://ws.audioscrobbler.com/2.0/";
const CACHE_MS = 10_000;                                              // site cevabı cache'i
const LASTFM_CACHE_MS = 60_000;                                       // Last.fm listesi cache'i
const LASTFM_LIMIT = Math.min(50, Math.max(1, Number(env.LASTFM_LIMIT || 10))); // kaç son şarkıdan seçilsin

const id = env.SPOTIFY_CLIENT_ID;
const secret = env.SPOTIFY_CLIENT_SECRET;
let refreshToken = env.SPOTIFY_REFRESH_TOKEN;
const lfKey = env.LASTFM_API_KEY;
const lfUser = env.LASTFM_USERNAME;

const spotifyReady = Boolean(id && secret && refreshToken);
const lastfmReady = Boolean(lfKey && lfUser);

class HttpError extends Error {
    constructor(status, error, hint) { super(error); this.status = status; this.error = error; this.hint = hint; }
}

// ---------- Spotify ----------
let accessToken = null;
let accessExpires = 0;

async function getAccessToken() {
    if (accessToken && Date.now() < accessExpires - 30_000) return accessToken;
    const r = await fetch(TOKEN_URL, {
        method: "POST",
        headers: {
            Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new HttpError(502, "auth", `Spotify token yenilenemedi (${d.error_description || d.error || r.status}). \`npm run spotify:auth\` komutunu tekrar çalıştır.`);
    accessToken = d.access_token;
    accessExpires = Date.now() + d.expires_in * 1000;
    if (d.refresh_token && d.refresh_token !== refreshToken) { refreshToken = d.refresh_token; setEnvVar("SPOTIFY_REFRESH_TOKEN", refreshToken); }
    return accessToken;
}

async function spotifyApi(path) {
    const r = await fetch(API_URL + path, { headers: { Authorization: `Bearer ${await getAccessToken()}` } });
    if (r.status === 429) {
        const wait = Number(r.headers.get("retry-after") || 30);
        throw new HttpError(429, "rate_limited", `Spotify istek sınırı: ${wait} sn sonra tekrar dene.`);
    }
    return r;
}

function toSpotifyTrack(item, progressMs = 0) {
    const episode = item.type === "episode";
    const images = (episode ? item.images : item.album?.images) ?? [];
    return {
        title: item.name,
        artists: episode ? item.show?.name ?? "" : (item.artists ?? []).map((a) => a.name).join(", "),
        album: episode ? "" : item.album?.name ?? "",
        cover: (images[1] ?? images[0])?.url ?? null,
        url: item.external_urls?.spotify ?? null,
        progressMs,
        durationMs: item.duration_ms ?? 0,
    };
}

// Çalıyorsa payload, çalmıyorsa (204 / duraklatılmış) null döner.
async function fetchSpotify() {
    const r = await spotifyApi("/me/player/currently-playing?additional_types=episode");
    if (r.status === 204) return null;
    if (r.status !== 200) throw new HttpError(502, "spotify", `Spotify ${r.status} döndü.`);
    const d = await r.json();
    if (!d.item || !d.is_playing) return null;
    return { source: "spotify", isPlaying: true, track: toSpotifyTrack(d.item, d.progress_ms ?? 0) };
}

// ---------- Last.fm ----------
const LASTFM_PLACEHOLDER_IMG = "2a96cbd8b46e442fc41c2b86b821562f"; // Last.fm'in "kapak yok" yıldız görseli
const lfProfileUrl = lfUser ? `https://www.last.fm/user/${encodeURIComponent(lfUser)}` : null;
let lfCache = null;             // { at, tracks }
const infoCache = new Map();    // key -> { durationMs, cover }
let fake = null;                // { track, startedAt }  (şu an "çalıyormuş gibi" gösterilen şarkı)

const realImg = (img) => (img && !img.includes(LASTFM_PLACEHOLDER_IMG) ? img : null);
const bestImg = (imgs = []) => (imgs.find((i) => i.size === "extralarge") ?? imgs.find((i) => i.size === "large") ?? imgs[imgs.length - 1])?.["#text"];

function lastfmError(d, status) {
    const hints = {
        6: "Last.fm kullanıcı adı bulunamadı (LASTFM_USERNAME'i kontrol et).",
        10: "Last.fm API key geçersiz (LASTFM_API_KEY'i kontrol et).",
        17: "Last.fm profilinde 'Hide recent listening information' açık, kapatman gerekiyor.",
        29: "Last.fm istek sınırı aşıldı, biraz bekle.",
    };
    return new HttpError(502, "lastfm", hints[d.error] ?? `Last.fm hata verdi (${d.message || status}).`);
}

function toLastfmTrack(t) {
    if (!t?.name) return null;
    const artist = t.artist?.["#text"] ?? t.artist?.name ?? "";
    return {
        key: `${artist}\u0000${t.name}`,
        title: t.name,
        artists: artist,
        album: t.album?.["#text"] ?? "",
        cover: realImg(bestImg(t.image)),
        url: t.url ?? null,
    };
}

async function lastfmRecent() {
    if (lfCache && Date.now() - lfCache.at < LASTFM_CACHE_MS) return lfCache.tracks;
    const r = await fetch(LASTFM_API_URL + "?" + new URLSearchParams({
        method: "user.getrecenttracks", user: lfUser, api_key: lfKey, limit: String(LASTFM_LIMIT), format: "json",
    }));
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.error) throw lastfmError(d, r.status);
    let list = d.recenttracks?.track ?? [];
    if (!Array.isArray(list)) list = [list];
    const tracks = list.map(toLastfmTrack).filter(Boolean);
    lfCache = { at: Date.now(), tracks };
    return tracks;
}

// Last.fm'de süresi olmayan şarkılar için: 2:30-4:30 arası, şarkıya göre hep aynı çıkan bir süre
function guessDurationMs(key) {
    let h = 0;
    for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return 150_000 + (h % 120_000);
}

// track.getInfo: şarkı süresi (ms) + gerekirse albüm kapağı. Hata olursa tahmini süreyle devam eder.
async function trackInfo(t) {
    if (infoCache.has(t.key)) return infoCache.get(t.key);
    let info = { durationMs: 0, cover: null };
    try {
        const r = await fetch(LASTFM_API_URL + "?" + new URLSearchParams({
            method: "track.getinfo", artist: t.artists, track: t.title, autocorrect: "1", api_key: lfKey, format: "json",
        }));
        const d = await r.json().catch(() => ({}));
        if (r.ok && !d.error) {
            info = { durationMs: Number(d.track?.duration) || 0, cover: realImg(bestImg(d.track?.album?.image)) };
        }
    } catch { /* ağ hatası: tahmini süre kullanılır */ }
    if (info.durationMs < 30_000) info.durationMs = guessDurationMs(t.key); // 0 / çok kısa = Last.fm'de süre yok
    infoCache.set(t.key, info);
    return info;
}

// Çakma stream: rastgele bir şarkı seç, süresi kadar çalıyormuş gibi göster, bitince sıradakine geç.
async function fetchLastfm() {
    const now = Date.now();
    if (!fake || now - fake.startedAt >= fake.track.durationMs) {
        const tracks = await lastfmRecent();
        if (!tracks.length) return { source: "lastfm", isPlaying: false, track: null, profileUrl: lfProfileUrl };
        const prev = fake?.track.key;
        const pool = prev && tracks.length > 1 ? tracks.filter((t) => t.key !== prev) : tracks; // arka arkaya aynısı gelmesin
        const { ...t } = pool[Math.floor(Math.random() * pool.length)];
        const info = await trackInfo(t);
        fake = { track: { ...t, cover: t.cover ?? info.cover, durationMs: info.durationMs }, startedAt: Date.now() };
    }
    const { key, ...track } = fake.track;
    return {
        source: "lastfm",
        isPlaying: true,
        fake: true,
        track: { ...track, progressMs: Math.min(track.durationMs, Date.now() - fake.startedAt) },
        profileUrl: lfProfileUrl,
    };
}

// ---------- Spotify sonucu (10 sn cache) ----------
let sp = { at: 0, data: null, err: null };
let spInflight = null;
let spBlockedUntil = 0;

async function spotifyState() {
    const fresh = Date.now() - sp.at < CACHE_MS || (Date.now() < spBlockedUntil && sp.at > 0);
    if (!fresh) {
        spInflight ??= fetchSpotify()
            .then((data) => { sp = { at: Date.now(), data, err: null }; })
            .catch((err) => {
                if (err.status === 429) spBlockedUntil = Date.now() + 30_000; // eski veriyle idare et
                else sp = { at: Date.now(), data: null, err };
            })
            .finally(() => { spInflight = null; });
        await spInflight;
    }
    if (sp.err) throw sp.err;
    if (!sp.data) return null;
    // cache'teki veri eskidiyse ilerlemeyi geçen süre kadar ileri al
    const t = sp.data.track;
    return { ...sp.data, track: { ...t, progressMs: Math.min(t.durationMs, t.progressMs + (Date.now() - sp.at)) } };
}

// ---------- ana akış: Spotify, olmazsa Last.fm ----------
async function fetchNowPlaying() {
    let spotifyError = null;
    if (spotifyReady) {
        try {
            const data = await spotifyState();
            if (data) return data;
        } catch (err) {
            if (!lastfmReady) throw err;
            spotifyError = err;
            console.warn(`[spotify] ${err.hint || err.message} -> Last.fm'e düşülüyor`);
        }
    }
    if (lastfmReady) return fetchLastfm();
    if (spotifyError) throw spotifyError;
    return { source: null, isPlaying: false, track: null };
}

// ---------- mock (hesap bağlamadan görünüme bakmak için) ----------
const cover = (a, b) => "data:image/svg+xml," + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="300" height="300" fill="url(#g)"/></svg>`);
const MOCK_SPOTIFY = { title: "Kernel Panic", artists: "Segfault, Null Pointer", album: "Undefined Behavior", cover: cover("#7c2d12", "#f59e0b"), url: null, durationMs: 187_000 };
const MOCK_LASTFM = [
    { title: "Gece Yolculuğu", artists: "Örnek Sanatçı", album: "Boş Otoyol", cover: cover("#334155", "#0ea5e9"), url: null },
    { title: "Stack Overflow", artists: "Heap, Buffer", album: "", cover: null, url: null },
    { title: "Dangling Pointer", artists: "Segfault", album: "Undefined Behavior", cover: cover("#14532d", "#84cc16"), url: null },
];
const started = Date.now();
function mockNowPlaying() {
    const PHASE = 20_000; // cycle modunda 20 sn Spotify, 20 sn Last.fm
    const elapsed = Date.now() - started;
    const phase = Math.floor(elapsed / PHASE);
    const asSpotify = MOCK_MODE === "spotify" || (MOCK_MODE === "cycle" && phase % 2 === 0);
    if (asSpotify) return { source: "spotify", isPlaying: true, track: { ...MOCK_SPOTIFY, progressMs: (elapsed % 60_000) + 25_000 } };
    return { source: "lastfm", isPlaying: true, fake: true, track: { ...MOCK_LASTFM[phase % MOCK_LASTFM.length], durationMs: 195_000, progressMs: (elapsed % PHASE) + 40_000 }, profileUrl: "https://www.last.fm/" };
}

// ---------- http ----------
async function getData() {
    if (MOCK) return mockNowPlaying();
    if (!spotifyReady && !lastfmReady) {
        throw new HttpError(503, "not_configured", "`.env.local` eksik: Spotify (CLIENT_ID/SECRET + `npm run spotify:auth`) ve/veya Last.fm (LASTFM_API_KEY/LASTFM_USERNAME) bilgilerini yaz. (Önce görünüme bakmak için: `npm run dev:mock`)");
    }
    return fetchNowPlaying();
}

const server = http.createServer(async (req, res) => {
    const headers = {
        "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
        Vary: "Origin",
    };
    if (req.method === "OPTIONS") { res.writeHead(204, headers).end(); return; }
    if (req.url?.split("?")[0] !== "/now-playing") { res.writeHead(404, headers).end(JSON.stringify({ error: "not_found" })); return; }

    try {
        const data = await getData(); // önce veriyi al, başlıkları sonra yaz (hata olursa 200 gitmesin)
        res.writeHead(200, headers).end(JSON.stringify(data));
    } catch (err) {
        const status = err instanceof HttpError ? err.status : 502;
        if (!(err instanceof HttpError)) console.error(err);
        res.writeHead(status, headers).end(JSON.stringify({ error: err.error ?? "internal", hint: err.hint ?? "Beklenmeyen hata, terminale bak." }));
    }
});

server.listen(PORT, "127.0.0.1", () => {
    const srcs = MOCK ? `MOCK modu (${MOCK_MODE})` : `spotify: ${spotifyReady ? "hazır" : "yok"}, lastfm: ${lastfmReady ? "hazır" : "yok"}`;
    console.log(`now-playing: http://127.0.0.1:${PORT}/now-playing  [${srcs}]`);
});
