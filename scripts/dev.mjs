// Next dev sunucusu + now-playing sunucusunu tek komutta başlatır.
// npm run dev:all  |  npm run dev:mock (hesap bağlamadan görünüme bak)
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");
const mockArg = process.argv.find((a) => a === "--mock" || a.startsWith("--mock="));

const procs = [
    spawn(process.execPath, [nextBin, "dev"], { stdio: "inherit" }),
    spawn(process.execPath, ["scripts/now-playing-server.mjs", ...(mockArg ? [mockArg] : [])], { stdio: "inherit" }),
];

const stop = () => procs.forEach((p) => p.kill());
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
procs.forEach((p) => p.on("exit", (code) => { stop(); process.exitCode ??= code ?? 0; }));
