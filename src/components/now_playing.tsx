import React from "react";
import { FaLastfm, FaSpotify } from "react-icons/fa";
import { SPOTIFY_PROFILE } from "@/data/links";

const IS_DEV = process.env.NODE_ENV !== "production";
// Yerelde: now-playing-server.mjs. Canlıda: Cloudflare Worker adresi (NEXT_PUBLIC_NOW_PLAYING_URL, build sırasında verilir).
// Canlıda adres yoksa istek hiç atılmaz ve kart gizlenir.
const ENDPOINT = process.env.NEXT_PUBLIC_NOW_PLAYING_URL || (IS_DEV ? "http://127.0.0.1:8787/now-playing" : "");
const POLL_MS = 15_000;

type Track = {
    title: string;
    artists: string;
    album: string;
    cover: string | null;
    url: string | null;
    progressMs: number;
    durationMs: number;
};
type Payload = { source: "spotify" | "lastfm" | null; isPlaying: boolean; track: Track | null; profileUrl?: string | null };
type State =
    | { kind: "loading" }
    | { kind: "ok"; data: Payload; receivedAt: number }
    | { kind: "error"; hint: string };

function fmt(ms: number) {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Equalizer({ active }: { active: boolean }) {
    return (
        <span className="inline-flex items-end gap-[2px] h-3" aria-hidden>
            {[0, 1, 2].map((i) => (
                <span key={i} className={`w-[3px] h-full ${active ? "eq-bar bg-green-500" : "bg-neutral-500 scale-y-[0.35] origin-bottom"}`} />
            ))}
        </span>
    );
}

export default function NowPlaying() {
    const [state, setState] = React.useState<State>({ kind: "loading" });
    const [now, setNow] = React.useState(() => Date.now());
    const loadRef = React.useRef<() => void>(() => {});
    const endedFor = React.useRef(0); // aynı veri için "şarkı bitti" yenilemesi bir kez yapılsın

    // veriyi çek: açılışta, her 15 sn'de bir ve sekmeye geri dönünce (sekme arka plandayken çekme)
    React.useEffect(() => {
        let alive = true;
        const load = async () => {
            if (document.hidden) return;
            if (!ENDPOINT) { setState({ kind: "error", hint: "now-playing adresi tanımlı değil." }); return; }
            try {
                const res = await fetch(ENDPOINT, { cache: "no-store" });
                const body = await res.json();
                if (!alive) return;
                if (!res.ok) setState({ kind: "error", hint: body.hint || "now-playing hata verdi" });
                else setState({ kind: "ok", data: body, receivedAt: Date.now() });
            } catch {
                if (alive) setState({ kind: "error", hint: "now-playing sunucusuna ulaşılamıyor. `npm run dev:all` ile başlat." });
            }
        };
        loadRef.current = load;
        load();
        const timer = setInterval(load, POLL_MS);
        document.addEventListener("visibilitychange", load);
        return () => { alive = false; clearInterval(timer); document.removeEventListener("visibilitychange", load); };
    }, []);

    // çalarken ilerleme çubuğu saniyede bir kendiliğinden ilerlesin; şarkı bitince yenisini hemen iste
    const playing = state.kind === "ok" && state.data.isPlaying;
    React.useEffect(() => {
        if (!playing) return;
        const t = setInterval(() => {
            setNow(Date.now());
            if (state.kind !== "ok" || !state.data.track) return;
            const { progressMs, durationMs } = state.data.track;
            const elapsed = progressMs + (Date.now() - state.receivedAt);
            if (durationMs > 0 && elapsed >= durationMs && endedFor.current !== state.receivedAt) {
                endedFor.current = state.receivedAt;
                setTimeout(() => loadRef.current(), 1500);
            }
        }, 1000);
        return () => clearInterval(t);
    }, [playing, state]);

    // canlıda (production) hata durumunda kart hiç görünmesin; yerelde nedenini göster
    if (state.kind === "error" && !IS_DEV) return null;

    const shell = "flex flex-col gap-3 p-3 border border-neutral-500/40 font-mono";
    // sağ üst logo: Spotify çalıyorsa Spotify, değilse (Last.fm'den seçilen şarkı) Last.fm
    const header = (label: string, active: boolean, source: "spotify" | "lastfm" = "spotify", lastfmUrl?: string | null) => {
        const isLastfm = source === "lastfm";
        const Icon = isLastfm ? FaLastfm : FaSpotify;
        return (
            <div className="flex items-center justify-between text-sm opacity-80">
                <span className="flex items-center gap-2"><Equalizer active={active} />{label}</span>
                <a href={isLastfm ? lastfmUrl || "https://www.last.fm" : SPOTIFY_PROFILE} target="_blank" rel="noopener noreferrer" aria-label={isLastfm ? "last.fm profilim" : "spotify profilim"} className="hover:opacity-100 opacity-70">
                    <Icon className="text-xl" />
                </a>
            </div>
        );
    };

    if (state.kind === "loading") return <div className={shell}>{header("müzik bakılıyor...", false)}</div>;
    if (state.kind === "error") return <div className={shell}>{header("müzik", false)}<p className="text-sm opacity-70">{state.hint}</p></div>;

    const { data, receivedAt } = state;
    const t = data.track;
    const source = data.source === "lastfm" ? "lastfm" : "spotify";
    if (!t) return <div className={shell}>{header("şu an bir şey çalmıyor", false, source, data.profileUrl)}</div>;

    const progress = data.isPlaying ? Math.min(t.durationMs, t.progressMs + (now - receivedAt)) : 0;
    const pct = t.durationMs ? (progress / t.durationMs) * 100 : 0;

    return (
        <div className={shell}>
            {header(data.isPlaying ? "şu an dinliyor" : "son dinlediklerinden", data.isPlaying, source, data.profileUrl)}
            <div className="flex gap-3 items-center">
                {t.cover
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={t.cover} alt="" width={64} height={64} className="w-16 h-16 shrink-0 object-cover" />
                    : <div className="w-16 h-16 shrink-0 bg-neutral-500/20" />}
                <div className="flex flex-col min-w-0">
                    <a href={t.url ?? (source === "lastfm" ? data.profileUrl ?? SPOTIFY_PROFILE : SPOTIFY_PROFILE)} target="_blank" rel="noopener noreferrer" className="font-bold truncate hover:underline">{t.title}</a>
                    <span className="truncate">{t.artists}</span>
                    {t.album && <span className="text-sm opacity-60 truncate">{t.album}</span>}
                </div>
            </div>
            {data.isPlaying && (
                <div className="flex items-center gap-3 text-xs opacity-70">
                    <span className="w-9 text-right tabular-nums">{fmt(progress)}</span>
                    <div className="flex-1 h-[2px] bg-neutral-500/30"><div className="h-full bg-current" style={{ width: `${pct}%` }} /></div>
                    <span className="w-9 tabular-nums">{fmt(t.durationMs)}</span>
                </div>
            )}
        </div>
    );
}
