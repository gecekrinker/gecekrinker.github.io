/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',            // `npm run build` -> ./out (saf statik dosyalar)
  trailingSlash: true,         // /blog -> blog/index.html (GitHub Pages dahil her statik sunucuda çalışır)
  images: { unoptimized: true } // next/image, export modunda optimizasyon sunucusu olmadan çalışsın
}

module.exports = nextConfig
