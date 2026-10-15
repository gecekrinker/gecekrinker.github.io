import React from "react";
import { FaSteam } from "react-icons/fa";
import fakeGames from "@/data/fake-games.json";

const IS_DEV = process.env.NODE_ENV !== "production";
// Cloudflare Worker adresi (herkese açık, gizli değil)
const WORKER_URL = "https://keremradu-now-playin.toosperos.workers.dev/games";
const ENDPOINT = process.env.NEXT_PUBLIC_GAMES_URL || WORKER_URL;
const POLL_MS = 60_000;

type Payload =
    | { mode: "live" | "fake"; name: string; img: string; sessionMin: number; totalMin: number }
    | { mode: "grass"; sinceMin: number }
    | { mode: "idle" };
type State =
    | { kind: "loading" }
    | { kind: "ok"; data: Payload; receivedAt: number }
    | { kind: "error"; hint: string };

// Yerelde (npm run dev) Worker'a CORS izni olmadığı için sahte veri 8 sn'de bir mod değiştirir
const MOCKS: Payload[] = [
    { mode: "live", name: fakeGames[0].name, img: fakeGames[0].img, sessionMin: 45, totalMin: Math.round(fakeGames[0].totalHours * 60) },
    { mode: "fake", name: fakeGames[2].name, img: fakeGames[2].img, sessionMin: 22, totalMin: Math.round(fakeGames[2].totalHours * 60) },
    { mode: "grass", sinceMin: 12 },
    { mode: "idle" },
];

function fmtTotal(min: number) {
    return `${(min / 60).toFixed(1)} saat`;
}
function fmtSession(min: number) {
    if (min < 60) return `${min} dk`;
    return `${Math.floor(min / 60)} sa ${min % 60} dk`;
}

function Equalizer({ active }: { active: boolean }) {
    return (
        <span className="inline-flex items-end gap-[2px] h-3" aria-hidden>
            {[0, 1, 2].map((i) => (
                <span key={i} className={`w-[3px] h-full ${active ? "eq-bar bg-sky-500" : "bg-neutral-500 scale-y-[0.35] origin-bottom"}`} />
            ))}
        </span>
    );
}

export default function NowGaming() {
    const [state, setState] = React.useState<State>({ kind: "loading" });
    const [now, setNow] = React.useState(() => Date.now());

    React.useEffect(() => {
        let alive = true;
        if (IS_DEV) {
            const pick = () => {
                const data = MOCKS[Math.floor(Date.now() / 8000) % MOCKS.length];
                if (alive) setState({ kind: "ok", data, receivedAt: Date.now() });
            };
            pick();
            const t = setInterval(pick, 8000);
            return () => { alive = false; clearInterval(t); };
        }
        const load = async () => {
            if (document.hidden) return;
            try {
                const res = await fetch(ENDPOINT, { cache: "no-store" });
                const body = await res.json();
                if (!alive) return;
                if (!res.ok) setState({ kind: "error", hint: "oyun durumu alınamadı." });
                else setState({ kind: "ok", data: body, receivedAt: Date.now() });
            } catch {
                if (alive) setState({ kind: "error", hint: "worker adresine ulaşılamadı." });
            }
        };
        load();
        const timer = setInterval(load, POLL_MS);
        document.addEventListener("visibilitychange", load);
        return () => { alive = false; clearInterval(timer); document.removeEventListener("visibilitychange", load); };
    }, []);

    // süreler sayfa açıkken dakikada bir kendiliğinden ilerlesin
    React.useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 30_000);
        return () => clearInterval(t);
    }, []);

    const shell = "flex flex-col gap-3 p-3 min-w-0 border border-neutral-500/40 font-mono";
    const header = (label: string, active: boolean) => (
        <div className="flex items-center justify-between text-sm opacity-80">
            <span className="flex items-center gap-2"><Equalizer active={active} />{label}</span>
            <FaSteam className="text-xl opacity-70" aria-label="steam" />
        </div>
    );

    if (state.kind === "loading") return <div className={shell}>{header("oyun bakılıyor...", false)}</div>;
    if (state.kind === "error") return <div className={shell}>{header("oyun", false)}<p className="text-sm opacity-70">{state.hint}</p></div>;

    const { data, receivedAt } = state;
    const extra = Math.floor((now - receivedAt) / 60_000); // veri geldikten sonra geçen dakika

    if (data.mode === "idle") return <div className={shell}>{header("steam'de çevrimiçi", false)}<p className="text-sm opacity-70">şu an bir oyun açık değil</p></div>;

    if (data.mode === "grass") {
        return (
            <div className={shell}>
                {header("touching grass", false)}
                <div className="flex items-center gap-3">
                    <div className="w-16 h-16 shrink-0 bg-neutral-500/20 flex items-center justify-center text-3xl" aria-hidden>🌱</div>
                    <div className="flex flex-col">
                        <span className="font-bold">dışarıda</span>
                        <span className="text-sm opacity-60">{fmtSession(data.sinceMin + extra)}dir ekrandan uzakta</span>
                    </div>
                </div>
            </div>
        );
    }

    const session = data.sessionMin + extra;
    const total = data.totalMin + extra;
    return (
        <div className={shell}>
            {header("şu an oynuyor", true)}
            <div className="flex gap-3 items-center min-w-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={data.img} alt="" width={120} height={56} className="w-[120px] h-14 shrink-0 object-cover" />
                <div className="flex flex-col min-w-0">
                    <span className="font-bold truncate">{data.name}</span>
                    <span className="text-sm opacity-60">bu oturum: {fmtSession(session)}</span>
                    <span className="text-sm opacity-60">toplam: {fmtTotal(total)}</span>
                </div>
            </div>
        </div>
    );
}
