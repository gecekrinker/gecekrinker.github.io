# Siteyi yayına alma: gecekrinker.github.io ve keremradu.me

## A) Siteyi yayınla (şart)

1. Zip'i boş bir klasöre çıkar (içinde `.env.local` yok, şifreler güvende).
2. github.com/gecekrinker/gecekrinker.github.io > **Add file** > **Upload files**.
3. Çıkan klasörün **içindeki her şeyi** (`.github` klasörü dahil) sürükle, **Commit changes**'e bas.
   - `.github` klasörü yüklenmediyse: **Add file > Create new file**, isim kutusuna `.github/workflows/deploy.yml` yaz
     (klasörler `/` yazınca kendiliğinden oluşur), zip'teki aynı isimli dosyanın içeriğini yapıştır, Commit.
4. Repo > **Settings > Pages > Build and deployment > Source: GitHub Actions** seç.
5. Repo > **Actions** sekmesi: "Siteyi yayınla" çalışır (yeşil tik ~2 dk). Bitince site açılır:
   https://gecekrinker.github.io

Sonradan her dosya yüklediğinde site kendiliğinden güncellenir. Yeni blog yazısı = `markdown/blog/` içine `.md` yüklemek.

Kırmızı X olursa Actions'ta o satıra tıkla, hata metnini bana yapıştır.

## A2) keremradu.me adresini siteye bağla

`gecekrinker.github.io` sitenin GitHub'daki adresi, `keremradu.me` ise senin alan adın. Alan adını bu siteye yönlendirirsen site
keremradu.me'de açılır (eski adres de otomatik oraya yönlendirir).

1. **GitHub'da:** repo > Settings > Pages > **Custom domain** kutusuna `keremradu.me` yaz > Save.
2. **Alan adını aldığın sitede** (Öğrenci Paketi'nin .me'si Namecheap'te olur): Domain List > keremradu.me > Manage > **Advanced DNS**.
   Önceden duran hazır kayıtları (parking / URL redirect) sil, şunları ekle:

| Type | Host | Value |
|---|---|---|
| A Record | @ | 185.199.108.153 |
| A Record | @ | 185.199.109.153 |
| A Record | @ | 185.199.110.153 |
| A Record | @ | 185.199.111.153 |
| CNAME Record | www | gecekrinker.github.io |

3. Bekle (birkaç dakika-birkaç saat). GitHub Pages sayfasındaki "DNS check" yeşil olunca **Enforce HTTPS** kutusunu işaretle.

## B) Müzik kartı (sonra, isteğe bağlı)

Canlı sitede müzik kartı Worker kurulana kadar görünmez (hata vermez). Worker, Spotify/Last.fm anahtarlarını Cloudflare'in
şifreli deposunda tutar; GitHub'a anahtar girmez. Kurulum:

1. dash.cloudflare.com'da ücretsiz hesap aç. Proje klasöründe: `npx wrangler login`
2. Her komutta değeri yapıştırıp Enter'a bas (değerler `.env.local` dosyanda):
```
npx wrangler secret put SPOTIFY_CLIENT_ID -c worker/wrangler.toml
npx wrangler secret put SPOTIFY_CLIENT_SECRET -c worker/wrangler.toml
npx wrangler secret put SPOTIFY_REFRESH_TOKEN -c worker/wrangler.toml
npx wrangler secret put LASTFM_API_KEY -c worker/wrangler.toml
npm run worker:deploy
```
3. Komutun sonunda `https://keremradu-now-playing.<hesap>.workers.dev` gibi bir adres yazar. Sonuna `/now-playing` ekleyip tarayıcıda aç, şarkı bilgisi (JSON) görmelisin.
4. GitHub repo > **Settings > Secrets and variables > Actions > Variables > New repository variable**:
   isim `NOW_PLAYING_URL`, değer `https://keremradu-now-playing.<hesap>.workers.dev/now-playing`.
5. Actions > "Siteyi yayınla" > **Run workflow**. Kart sitede görünür.

Spotify refresh token ömrü 180 gün; dolunca kart Last.fm'e düşer. Yenilemek için `npm run spotify:auth` ve 2. adımdaki
`SPOTIFY_REFRESH_TOKEN` komutunu tekrarla.

## Güvenlik

- `.env.local` repoya girmemeli. Yüklemeden önce klasörde olmadığından emin ol.
- Spotify dashboard > Basic Information > **Rotate client secret** yap (eski secret sohbette göründü).
- Mail adresin (keremradu@yahoo.com) sayfada herkese açık olacak.
