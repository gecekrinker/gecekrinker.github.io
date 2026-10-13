// Cloudflare Worker: now-playing API'nin canlı (public) hali.
// scripts/now-playing-server.mjs ile aynı davranış, ama anahtarlar Cloudflare'in şifreli "secret" deposunda durur;
// GitHub'a hiçbir anahtar girmez. Worker'ın durumu (hafızası) olmadığı için "çakma stream" saate göre hesaplanır:
// son şarkılar süreleriyle birlikte rastgele (ama herkes için aynı) bir sırayla döner.
//
// Gerekli secret'lar (wrangler secret put ...): SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN, LASTFM_API_KEY
// wrangler.toml [vars]: LASTFM_USERNAME, ALLOWED_ORIGIN

const SPOTIFY_CACHE_MS = 10_000;
const PLACEHOLDER_IMG = "2a96cbd8b46e442fc41c2b86b821562f"; // Last.fm "kapak yok" görseli

class HttpError extends Error {
    constructor(status, error, hint) { super(error); this.status = status; this.error = error; this.hint = hint; }
}

// isolate hafızasında tutulan, kaybolursa sorun olmayan önbellekler
let token = { value: null, exp: 0 };
let sp = { at: 0, data: null, err: null };
const infoCache = new Map();

const cfg = (env) => ({
    tokenUrl: env.SPOTIFY_TOKEN_URL || "https://accounts.spotify.com/api/token",
    apiUrl: env.SPOTIFY_API_URL || "https://api.spotify.com/v1",
    lfUrl: env.LASTFM_API_URL || "https://ws.audioscrobbler.com/2.0/",
    limit: Math.min(50, Math.max(1, Number(env.LASTFM_LIMIT || 10))),
    spotifyReady: Boolean(env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET && env.SPOTIFY_REFRESH_TOKEN),
    lastfmReady: Boolean(env.LASTFM_API_KEY && env.LASTFM_USERNAME),
});

// ---------- Spotify ----------
async function accessToken(env, c) {
    if (token.value && Date.now() < token.exp - 30_000) return token.value;
    const r = await fetch(c.tokenUrl, {
        method: "POST",
        headers: {
            Authorization: "Basic " + btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`),
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: env.SPOTIFY_REFRESH_TOKEN }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new HttpError(502, "auth", `Spotify token yenilenemedi (${d.error_description || d.error || r.status}).`);
    token = { value: d.access_token, exp: Date.now() + d.expires_in * 1000 };
    return token.value;
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

async function fetchSpotify(env, c) {
    const r = await fetch(c.apiUrl + "/me/player/currently-playing?additional_types=episode", {
        headers: { Authorization: `Bearer ${await accessToken(env, c)}` },
    });
    if (r.status === 204) return null;
    if (r.status === 429) throw new HttpError(429, "rate_limited", "Spotify istek sınırı.");
    if (r.status !== 200) throw new HttpError(502, "spotify", `Spotify ${r.status} döndü.`);
    const d = await r.json();
    if (!d.item || !d.is_playing) return null;
    return { source: "spotify", isPlaying: true, track: toSpotifyTrack(d.item, d.progress_ms ?? 0) };
}

async function spotifyState(env, c) {
    if (Date.now() - sp.at >= SPOTIFY_CACHE_MS) {
        try { sp = { at: Date.now(), data: await fetchSpotify(env, c), err: null }; }
        catch (err) { sp = err.status === 429 && sp.at ? { ...sp, at: Date.now() } : { at: Date.now(), data: null, err }; }
    }
    if (sp.err) throw sp.err;
    if (!sp.data) return null;
    const t = sp.data.track; // cache eskidiyse ilerlemeyi geçen süre kadar ileri al
    return { ...sp.data, track: { ...t, progressMs: Math.min(t.durationMs, t.progressMs + (Date.now() - sp.at)) } };
}

// ---------- Last.fm ----------
const realImg = (img) => (img && !img.includes(PLACEHOLDER_IMG) ? img : null);
const bestImg = (imgs = []) => (imgs.find((i) => i.size === "extralarge") ?? imgs.find((i) => i.size === "large") ?? imgs[imgs.length - 1])?.["#text"];

async function lastfm(env, c, params, cacheTtl) {
    const r = await fetch(c.lfUrl + "?" + new URLSearchParams({ ...params, api_key: env.LASTFM_API_KEY, format: "json" }), {
        cf: { cacheTtl, cacheEverything: true }, // Cloudflare kenar önbelleği: Last.fm'e gereksiz istek gitmesin
    });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok && !d.error, d, status: r.status };
}

function lastfmError(d, status) {
    const hints = {
        6: "Last.fm kullanıcı adı bulunamadı.",
        10: "Last.fm API key geçersiz.",
        17: "Last.fm profilinde 'Hide recent listening information' açık.",
        29: "Last.fm istek sınırı aşıldı.",
    };
    return new HttpError(502, "lastfm", hints[d.error] ?? `Last.fm hata verdi (${d.message || status}).`);
}

function guessDurationMs(key) {
    let h = 0;
    for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return 150_000 + (h % 120_000); // 2:30-4:30, şarkıya göre hep aynı
}

async function withInfo(env, c, t) {
    if (infoCache.has(t.key)) return infoCache.get(t.key);
    let durationMs = 0, cover = null;
    try {
        const { ok, d } = await lastfm(env, c, { method: "track.getinfo", artist: t.artists, track: t.title, autocorrect: "1" }, 86_400);
        if (ok) { durationMs = Number(d.track?.duration) || 0; cover = realImg(bestImg(d.track?.album?.image)); }
    } catch { /* tahmini süre kullanılır */ }
    if (durationMs < 30_000) durationMs = guessDurationMs(t.key);
    const full = { ...t, cover: t.cover ?? cover, durationMs };
    infoCache.set(t.key, full);
    return full;
}

function mulberry32(seed) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Durumsuz çakma stream: son şarkılar süreleriyle art arda bir "yayın" oluşturur.
// Her tur bittiğinde sıra yeniden rastgele karıştırılır; zamana göre hesaplandığı için herkes aynı şarkıyı görür.
async function fakeStream(env, c, now = Date.now()) {
    const { ok, d, status } = await lastfm(env, c, { method: "user.getrecenttracks", user: env.LASTFM_USERNAME, limit: String(c.limit) }, 60);
    if (!ok) throw lastfmError(d, status);
    let list = d.recenttracks?.track ?? [];
    if (!Array.isArray(list)) list = [list];
    const profileUrl = `https://www.last.fm/user/${encodeURIComponent(env.LASTFM_USERNAME)}`;

    const seen = new Set();
    const base = list.map((t) => {
        if (!t?.name) return null;
        const artist = t.artist?.["#text"] ?? t.artist?.name ?? "";
        return { key: `${artist}\u0000${t.name}`, title: t.name, artists: artist, album: t.album?.["#text"] ?? "", cover: realImg(bestImg(t.image)), url: t.url ?? null };
    }).filter((t) => t && !seen.has(t.key) && seen.add(t.key));
    if (!base.length) return { source: "lastfm", isPlaying: false, track: null, profileUrl };

    const tracks = (await Promise.all(base.map((t) => withInfo(env, c, t)))).sort((a, b) => (a.key < b.key ? -1 : 1));
    const total = tracks.reduce((s, t) => s + t.durationMs, 0);
    const round = Math.floor(now / total);
    const rnd = mulberry32(round);
    for (let i = tracks.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [tracks[i], tracks[j]] = [tracks[j], tracks[i]]; }

    let pos = now % total;
    for (const t of tracks) {
        if (pos < t.durationMs) {
            const { key, ...track } = t;
            return { source: "lastfm", isPlaying: true, fake: true, track: { ...track, progressMs: pos }, profileUrl };
        }
        pos -= t.durationMs;
    }
}

// ---------- ana akış ----------
async function nowPlaying(env, c) {
    if (!c.spotifyReady && !c.lastfmReady) throw new HttpError(503, "not_configured", "Worker secret'ları eksik.");
    let spotifyError = null;
    if (c.spotifyReady) {
        try { const data = await spotifyState(env, c); if (data) return data; }
        catch (err) { if (!c.lastfmReady) throw err; spotifyError = err; console.warn(`[spotify] ${err.message} -> Last.fm`); }
    }
    if (c.lastfmReady) return fakeStream(env, c);
    if (spotifyError) throw spotifyError;
    return { source: null, isPlaying: false, track: null };
}

export default {
    async fetch(request, env) {
        const headers = {
            "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Cache-Control": "no-store",
            "Content-Type": "application/json; charset=utf-8",
            Vary: "Origin",
        };
        const json = (status, body) => new Response(status === 204 ? null : JSON.stringify(body), { status, headers });
        if (request.method === "OPTIONS") return json(204);
        if (request.method !== "GET" || new URL(request.url).pathname !== "/now-playing") return json(404, { error: "not_found" });
        try {
            return json(200, await nowPlaying(env, cfg(env)));
        } catch (err) {
            if (!(err instanceof HttpError)) console.error(err);
            return json(err instanceof HttpError ? err.status : 502, { error: err.error ?? "internal", hint: err.hint ?? "Beklenmeyen hata." });
        }
    },
};
