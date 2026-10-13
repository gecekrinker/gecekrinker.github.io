# keremradu

Statik kişisel site. Next.js (`output: 'export'`), Tailwind.

## Yerelde çalıştır

```bash
npm install
npm run dev:mock   # hesap bağlamadan, sahte verilerle görünüme bak (20 sn Spotify, 20 sn Last.fm görünümü döner)
```

http://localhost:3000  (sadece Last.fm görünümü için: `npm run dev:mock:lastfm`)

## Müzik kartı nasıl çalışır

1. **Spotify'da şu an bir şey çalıyorsa** kart onu gösterir (ilerleme çubuğuyla, sağ üstte Spotify logosu).
2. **Çalmıyorsa** (offline / duraklatılmış / Spotify hata verirse) Last.fm'deki son 10 şarkıdan rastgele biri gösterilir
   (sağ üstte Last.fm logosu). Last.fm şarkının süresini (track.getInfo) verir; kart o süre boyunca "çalıyormuş gibi"
   ilerleme çubuğuyla akar, süre bitince sıradaki rastgele şarkıya geçer (çakma stream). Süre bilinmiyorsa 2:30-4:30 arası tahmini süre kullanılır.
3. İkisi de yoksa "şu an bir şey çalmıyor" yazar.

Statik sitede secret saklanamaz, bu yüzden `scripts/now-playing-server.mjs` (127.0.0.1:8787) anahtarları tutar,
Spotify/Last.fm'den veriyi alır, 10 sn cache'ler ve siteye sadece şarkı/sanatçı/kapak JSON'u verir.
`src/components/now_playing.tsx` bunu 15 sn'de bir çeker.

## Gerçek verilerle

1. `.env.example` -> `.env.local` olarak kopyala.
2. **Spotify:** developer.spotify.com/dashboard'da uygulama oluştur. Redirect URI: `http://127.0.0.1:4321/callback`
   (`localhost` kabul edilmez, birebir bu yazılmalı). `SPOTIFY_CLIENT_ID` ve `SPOTIFY_CLIENT_SECRET`'ı yaz.
3. **Last.fm:** last.fm/api/account/create'ten API key al, `LASTFM_API_KEY` ve `LASTFM_USERNAME`'i yaz.
   Last.fm profilinde "Hide recent listening information" kapalı olmalı.
4. `npm run spotify:auth` -> tarayıcıda izin ver, refresh token `.env.local`'e otomatik yazılır (tek seferlik).
5. `npm run dev:all` -> site + now-playing sunucusu birlikte açılır.

Spotify bağlamadan sadece Last.fm de kullanılabilir (3. adım yeterli, 2 ve 4'ü atla); tersi de olur.
Client secret'ı asla `NEXT_PUBLIC_` ile başlayan bir değişkene koyma, tarayıcıya gider.

## Düzenleme

- Sosyal kartlar: `src/data/links.ts` (`href: "#"` olanlar yer tutucu)
- Ana sayfa metni: `markdown/me.md`
- **Bloglar:** `markdown/blog/` klasörüne `yazi-adi.md` ekle. Dosyanın başına
  ```
  ---
  title: Başlık
  date: 2026-10-13
  description: listede görünecek kısa özet
  ---
  ```
  yaz, altına markdown ile içeriği yaz. `/blog` sayfasında listelenir, `/blog/yazi-adi` adresinde açılır.
  `merhaba-dunya.md` örnek yazıdır, silebilirsin.

## Build

```bash
npm run build   # ./out klasörü, saf statik dosyalar
```

## Canlıya alma

Adım adım rehber: **YAYINLAMA.md** (GitHub Pages: gecekrinker.github.io + isteğe bağlı Cloudflare Worker). Canlıda anahtarlar `worker/index.js`'in
çalıştığı Cloudflare Worker'da şifreli secret olarak durur, repoya girmez.

## (eski not) Canlıya alınırsa

Spotify uygulamasını oluşturan hesap Premium olmalı (dev mode kuralı). Refresh token süresi dolarsa `npm run spotify:auth` tekrar çalıştırılır.
`now-playing-server.mjs`'in mantığı bir Cloudflare Worker'a taşınıp `NEXT_PUBLIC_NOW_PLAYING_URL` ile siteye bağlanabilir;
`ALLOWED_ORIGIN` o zaman sitenin adresine kısıtlanmalı.
