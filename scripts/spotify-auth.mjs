// Tek seferlik: Spotify'dan refresh token alır ve .env.local'e yazar.
// Kullanım: npm run spotify:auth
import http from "node:http";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { loadEnv, setEnvVar } from "./_env.mjs";

const env = loadEnv();
const id = env.SPOTIFY_CLIENT_ID;
const secret = env.SPOTIFY_CLIENT_SECRET;
const PORT = 4321;
const TOKEN_URL = env.SPOTIFY_TOKEN_URL || "https://accounts.spotify.com/api/token";
const REDIRECT = `http://127.0.0.1:${PORT}/callback`; // dashboard'daki Redirect URI ile birebir aynı olmalı
const SCOPES = "user-read-currently-playing"; // sadece "şu an çalan"; geçmiş için Last.fm kullanılıyor

if (!id || !secret) {
    console.error("Eksik: .env.local içine SPOTIFY_CLIENT_ID ve SPOTIFY_CLIENT_SECRET yaz (.env.example'a bak).");
    process.exit(1);
}

const state = randomBytes(16).toString("hex");
const authUrl = "https://accounts.spotify.com/authorize?" + new URLSearchParams({
    response_type: "code", client_id: id, scope: SCOPES, redirect_uri: REDIRECT, state,
});

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    if (url.pathname !== "/callback") { res.writeHead(404).end(); return; }

    const reply = (status, msg) => {
        res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
        res.end(msg);
        if (status !== 200) { console.error(msg); process.exitCode = 1; }
        server.close();
    };

    if (url.searchParams.get("error")) return reply(400, `Spotify reddetti: ${url.searchParams.get("error")}`);
    if (url.searchParams.get("state") !== state) return reply(400, "state uyuşmuyor, işlem iptal edildi.");

    try {
        const r = await fetch(TOKEN_URL, {
            method: "POST",
            headers: {
                Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ grant_type: "authorization_code", code: url.searchParams.get("code") ?? "", redirect_uri: REDIRECT }),
        });
        const data = await r.json();
        if (!r.ok || !data.refresh_token) return reply(400, `Token alınamadı: ${data.error_description || data.error || r.status}`);

        setEnvVar("SPOTIFY_REFRESH_TOKEN", data.refresh_token);
        console.log("Tamam: refresh token .env.local dosyasına yazıldı. Şimdi `npm run dev:all` çalıştırabilirsin.");
        reply(200, "Tamam, token .env.local dosyasına yazıldı. Bu sekmeyi kapatabilirsin.");
    } catch (err) {
        reply(500, `Hata: ${err.message}`);
    }
});

server.listen(PORT, "127.0.0.1", () => {
    console.log("Tarayıcıda şu adresi aç (otomatik açılmazsa kopyala):\n\n" + authUrl + "\n");
    const [cmd, args] =
        process.platform === "win32" ? ["cmd", ["/c", "start", '""', authUrl.replace(/&/g, "^&")]]
        : process.platform === "darwin" ? ["open", [authUrl]]
        : ["xdg-open", [authUrl]];
    try { spawn(cmd, args, { stdio: "ignore", detached: true }).on("error", () => {}).unref(); } catch {}
});
