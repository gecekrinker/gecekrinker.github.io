import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";

// SADECE SUNUCU TARAFI (fs kullanır): sayfalarda yalnızca getStaticProps/getStaticPaths içinde çağır.
// Tarayıcıda da lazım olan şeyler (formatDate) src/lib/date.ts içinde.
// Yazılar: markdown/blog/<slug>.md
// Dosyanın başı şu şekilde olmalı:
// ---
// title: Yazı başlığı
// date: 2026-10-13
// description: Listede görünecek kısa özet (isteğe bağlı)
// ---
export type PostMeta = { slug: string; title: string; date: string; description: string };
export type Post = PostMeta & { content: string };

const DIR = join(process.cwd(), "markdown", "blog");

function parse(raw: string): { data: Record<string, string>; content: string } {
    const m = raw.replace(/^\uFEFF/, "").match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!m) return { data: {}, content: raw };
    const data: Record<string, string> = {};
    for (const line of m[1].split(/\r?\n/)) {
        const kv = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
        if (kv) data[kv[1]] = kv[2].trim().replace(/^(['"])(.*)\1$/, "$2");
    }
    return { data, content: m[2] };
}

function toPost(slug: string): Post | null {
    const path = join(DIR, `${slug}.md`);
    if (!/^[A-Za-z0-9_-]+$/.test(slug) || !existsSync(path)) return null;
    const { data, content } = parse(readFileSync(path, "utf8"));
    return {
        slug,
        title: data.title || slug,
        date: data.date || "",
        description: data.description || "",
        content,
    };
}

export function getAllPosts(): PostMeta[] {
    if (!existsSync(DIR)) return [];
    return readdirSync(DIR)
        .filter((f) => f.endsWith(".md"))
        .map((f) => toPost(f.slice(0, -3)))
        .filter((p): p is Post => p !== null)
        .map(({ content, ...meta }) => meta)
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)); // yeniden eskiye
}

export function getPost(slug: string): Post | null {
    return toPost(slug);
}
