# keremradu

Statik kişisel site. Next.js (`output: 'export'`) + Tailwind, GitHub Pages'te yayınlanır. Canlı adres: **keremradu.me** (`gecekrinker.github.io` buraya yönlenir).

Sitede şunlar var:

- Ana sayfa: avatar, kısa bio (`markdown/me.md`), müzik kartı, Steam oyun kartı, sosyal kartlar
- `/blog`: markdown dosyalarından üretilen yazı listesi ve yazı sayfaları
- 404 sayfası: Linux "kernel panic" animasyonu
- `Shift + A` ile açık/koyu tema geçişi (varsayılan koyu)

## Hızlı başlangıç

```bash
npm install
npm run dev:mock   # hesap bağlamadan, sahte verilerle görünüme bak
```

Site: <http://localhost:3000>

## npm komutları

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Sadece Next.js geliştirme sunucusu |
| `npm run dev:all` | Site + now-playing sunucusu (gerçek verilerle) |
| `npm run dev:mock` | Site + now-playing sunucusu, sahte veriyle (20 sn Spotify, 20 sn Last.fm görünümü döner) |
| `npm run dev:mock:lastfm` | Sahte veriyle, sadece Last.fm görünümü |
| `npm run build` | `./out` klasörüne saf statik dosyalar üretir |
| `npm run lint` | ESLint |
| `npm run spotify:auth` | Spotify refresh token alır, `.env.local`'e yazar (tek seferlik) |
| `npm run now-playing:server` | Yerel now-playing sunucusunu tek başına çalıştırır |
| `npm run worker:dev` | Cloudflare Worker'ı yerelde dener |
| `npm run worker:deploy` | Worker'ı Cloudflare'e yükler |

## Müzik kartı

1. **Spotify'da şu an bir şey çalıyorsa** kart onu gösterir (ilerleme çubuğuyla, sağ üstte Spotify logosu).
2. **Çalmıyorsa** (offline / duraklatılmış / Spotify hata verirse) Last.fm'deki son 10 şarkı "çakma stream" olarak akar (sağ üstte Last.fm logosu). Last.fm şarkının süresini (`track.getInfo`) verir; süre bilinmiyorsa 2:30–4:30 arası şarkıya göre sabit bir tahmin kullanılır.
   - **Yerelde** (`now-playing-server.mjs`) sıradaki şarkı rastgele seçilir.
   - **Canlıda** (Worker) sunucu durum tutmadığı için sıra saate göre hesaplanır: şarkılar süreleriyle art arda dizilir, her tur bitince sıra yeniden karıştırılır. Herkes aynı anda aynı şarkıyı görür.
3. İkisi de yoksa "şu an bir şey çalmıyor" yazar.

Statik sitede secret saklanamaz. Bu yüzden anahtarları bir sunucu tutar, Spotify/Last.fm'den veriyi alır, 10 sn cache'ler ve siteye sadece şarkı/sanatçı/kapak JSON'u verir. `src/components/now_playing.tsx` bunu 15 sn'de bir çeker.

| Ortam | Sunucu | Adres |
|---|---|---|
| Yerel | `scripts/now-playing-server.mjs` | `http://127.0.0.1:8787/now-playing` |
| Canlı | `worker/index.js` (Cloudflare Worker) | `/now-playing` |

Adres `NEXT_PUBLIC_NOW_PLAYING_URL` ile değiştirilebilir. Verilmezse yerelde 127.0.0.1:8787, canlıda koda yazılı Worker adresi kullanılır.

## Steam oyun kartı

`src/components/now_gaming.tsx`, Worker'ın `/games` adresini 60 sn'de bir çeker ve 4 durumdan birini gösterir:

| Mod | Anlamı |
|---|---|
| `live` | Steam'de gerçekten bir oyun açık (oturum ve toplam süre ile) |
| `fake` | `src/data/fake-games.json`'daki listeden seçilmiş oyun |
| `grass` | "touching grass": ekrandan uzakta geçen süre |
| `idle` | Steam'de çevrimiçi ama oyun açık değil |

Yerelde (`npm run dev`) Worker'a CORS izni olmadığı için kart 8 sn'de bir sahte veriyle mod değiştirir. Adres `NEXT_PUBLIC_GAMES_URL` ile değiştirilebilir.

> **Bilinen durum:** Bu repodaki `worker/index.js` sadece `/now-playing` yolunu karşılıyor, `/games` için kod ve Steam secret'ları yok. Canlıdaki Worker'da `/games` yoksa kart "oyun durumu alınamadı" gösterir. `/games` mantığı Worker'a eklenene (veya kaynağı repoya konana) kadar bu kart canlıda çalışmaz.

### Oyun kapakları

`src/data/fake-games.json` listesindeki her oyun için SteamGridDB'den yatay kapak indirilir:

```bash
SGDB_API_KEY=xxx node scripts/fetch-steamgriddb.mjs
```

Script, kapakları `public/games/` altına kaydeder ve JSON'a `img` ile `sgdbId` alanlarını yazar. `img` alanı zaten dolu olan oyunları atlar. Yeni oyun eklemek için JSON'a `name` ve `totalHours` içeren bir satır ekleyip scripti çalıştır.

## Gerçek verilerle çalıştırma

1. `.env.example` dosyasını `.env.local` olarak kopyala.
2. **Spotify:** developer.spotify.com/dashboard'da uygulama oluştur. Redirect URI tam olarak `http://127.0.0.1:4321/callback` olmalı (`localhost` kabul edilmez). `SPOTIFY_CLIENT_ID` ve `SPOTIFY_CLIENT_SECRET`'ı yaz.
3. **Last.fm:** last.fm/api/account/create'ten API key al, `LASTFM_API_KEY` ve `LASTFM_USERNAME`'i yaz. Profilde "Hide recent listening information" kapalı olmalı.
4. `npm run spotify:auth` ile tarayıcıda izin ver. Refresh token `.env.local`'e otomatik yazılır.
5. `npm run dev:all` ile site ve now-playing sunucusu birlikte açılır.

Sadece Last.fm de kullanılabilir (2 ve 4'ü atla); tersi de olur.

### Ortam değişkenleri

| Değişken | Nerede | Açıklama |
|---|---|---|
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` | `.env.local` / Worker secret | Spotify uygulaması |
| `SPOTIFY_REFRESH_TOKEN` | `.env.local` / Worker secret | `npm run spotify:auth` doldurur |
| `LASTFM_API_KEY` | `.env.local` / Worker secret | Last.fm API anahtarı |
| `LASTFM_USERNAME` | `.env.local` / `worker/wrangler.toml` | Last.fm kullanıcı adı |
| `LASTFM_LIMIT` | isteğe bağlı | Kaç son şarkı arasından seçileceği (varsayılan 10, en fazla 50) |
| `NOW_PLAYING_PORT` | isteğe bağlı | Yerel sunucu portu (varsayılan 8787) |
| `MOCK`, `MOCK_MODE` | isteğe bağlı | Sahte veri (`cycle` / `spotify` / `lastfm`) |
| `SGDB_API_KEY` | komut satırı | Sadece kapak indirme scripti için |
| `NEXT_PUBLIC_NOW_PLAYING_URL` | build zamanı | Müzik API adresini ezer (GitHub'da `NOW_PLAYING_URL` değişkeninden gelir) |
| `NEXT_PUBLIC_GAMES_URL` | build zamanı | Oyun API adresini ezer |

`NEXT_PUBLIC_` ile başlayan değişkenler tarayıcıya gider. Client secret'ı veya başka bir gizli değeri asla bu önekle yazma.

## İçerik düzenleme

- **Sosyal kartlar:** `src/data/links.ts`. Yeni kart = bir satır eklemek, silmek = satırı silmek. `href` değeri `/` ile başlıyorsa sitenin kendi sayfasıdır (ör. `/blog`). `SPOTIFY_PROFILE` şu an genel `open.spotify.com` adresi, kendi profil linkinle değiştir.
- **Ana sayfa metni:** `markdown/me.md`
- **404 sayfası:** `src/components/kernel-panic.tsx`

### Blog yazısı ekleme

`markdown/blog/` klasörüne `yazi-adi.md` ekle. Dosya adı (slug) sadece harf, rakam, `-` ve `_` içerebilir. Dosyanın başına şunu yaz:

```
---
title: Başlık
date: 2026-10-13
description: listede görünecek kısa özet (isteğe bağlı)
---
```

Altına markdown ile içeriği yaz. Yazı `/blog` sayfasında yeniden eskiye sıralı listelenir, `/blog/yazi-adi` adresinde açılır. Mevcut yazılar örnek olarak kullanılabilir. `falanca.md` bir test yazısıdır, silinebilir.

## Yayınlama

Push edilen her değişiklik `main` dalına gelince `.github/workflows/deploy.yml` siteyi build edip GitHub Pages'e yükler (Actions sekmesinden elle de çalıştırılabilir). `CNAME` dosyası alan adını (`keremradu.me`) belirler.

Adım adım rehber (GitHub Pages ayarı, DNS kayıtları, Worker kurulumu, güvenlik notları): **[YAYINLAMA.md](YAYINLAMA.md)**

### Cloudflare Worker

Canlıda anahtarlar, `worker/index.js`'in çalıştığı Cloudflare Worker'da şifreli secret olarak durur, repoya girmez.

```bash
npx wrangler login
npx wrangler secret put SPOTIFY_CLIENT_ID -c worker/wrangler.toml
npx wrangler secret put SPOTIFY_CLIENT_SECRET -c worker/wrangler.toml
npx wrangler secret put SPOTIFY_REFRESH_TOKEN -c worker/wrangler.toml
npx wrangler secret put LASTFM_API_KEY -c worker/wrangler.toml
npm run worker:deploy
```

- `worker/wrangler.toml` içindeki `ALLOWED_ORIGIN` sadece bu adresteki sitenin Worker'ı tarayıcıdan çağırmasına izin verir (`https://keremradu.me`).
- Spotify uygulamasını oluşturan hesap Premium olmalı (dev mode kuralı).
- Spotify refresh token ömrü yaklaşık 180 gündür. Dolunca kart Last.fm'e düşer. Yenilemek için `npm run spotify:auth` çalıştır ve `SPOTIFY_REFRESH_TOKEN` secret'ını tekrar yaz.
- Worker adresi `src/components/now_playing.tsx` ve `now_gaming.tsx` içinde sabit yazılıdır; `wrangler.toml`'daki Worker adıyla (`keremradu-now-playing`) aynı olduğundan emin ol.

## Proje yapısı

```
.github/workflows/deploy.yml   GitHub Pages dağıtımı
CNAME                          keremradu.me
markdown/me.md                 Ana sayfa metni
markdown/blog/*.md             Blog yazıları
public/                        Avatar, favicon, oyun kapakları (games/)
scripts/                       Yerel now-playing sunucusu, Spotify yetkilendirme,
                               SteamGridDB kapak indirici, dev başlatıcı
src/components/                Kartlar, layout, 404 animasyonu
src/data/                      links.ts (sosyal kartlar), fake-games.json
src/lib/                       blog.ts (yazı okuyucu), getMarkdown.ts, date.ts
src/pages/                     index, blog/, 404
src/util/ThemeProvider.tsx     Tema ve Shift+A kısayolu
worker/                        Cloudflare Worker (now-playing API)
```

> **Temizlik notu:** `src/pages/` altında `now_gaming.tsx`, `now_playing.tsx` ve `layout.tsx`, `src/components/` içindekilerin birebir kopyasıdır. Next.js bunları `/now_gaming`, `/now_playing` ve `/layout` sayfaları olarak yayınlar. Sitede kullanılmadıkları için silinebilirler.

## Güvenlik

- `.env.local` repoya girmez (`.gitignore`'da). Yüklemeden önce klasörde olmadığından emin ol.
- Client secret ve refresh token yalnızca `.env.local` veya Worker secret'larında durur.
- Secret bir yerde göründüyse Spotify dashboard > Basic Information > **Rotate client secret** ile yenile.
- Mail adresi sayfada herkese açıktır.
