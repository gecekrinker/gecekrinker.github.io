// Kullanım: SGDB_API_KEY=xxx node scripts/fetch-steamgriddb.mjs
// src/data/fake-games.json'daki her oyun için SteamGridDB'den yatay kapak indirir,
// public/games/ altına kaydeder ve JSON'a "img" alanını yazar.
import fs from "node:fs/promises";

const KEY = process.env.SGDB_API_KEY;
if (!KEY) throw new Error("SGDB_API_KEY yok");
const api = (p) =>
  fetch(`https://www.steamgriddb.com/api/v2${p}`, { headers: { Authorization: `Bearer ${KEY}` } }).then((r) => r.json());

const file = "src/data/fake-games.json";
const games = JSON.parse(await fs.readFile(file, "utf8"));
await fs.mkdir("public/games", { recursive: true });

for (const g of games) {
  if (g.img) continue; // zaten var
  const found = await api(`/search/autocomplete/${encodeURIComponent(g.name)}`);
  const id = found.data?.[0]?.id;
  if (!id) { console.warn("bulunamadı:", g.name); continue; }
  const grids = await api(`/grids/game/${id}?dimensions=460x215,920x430`);
  const url = grids.data?.[0]?.url;
  if (!url) { console.warn("yatay grid yok:", g.name); continue; }
  const slug = g.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const ext = url.split(".").pop().split("?")[0];
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  await fs.writeFile(`public/games/${slug}.${ext}`, buf);
  g.sgdbId = id;
  g.img = `/games/${slug}.${ext}`;
  console.log("ok:", g.name);
}
await fs.writeFile(file, JSON.stringify(games, null, 2) + "\n");
