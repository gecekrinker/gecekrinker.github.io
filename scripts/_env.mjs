// .env.local okuma/yazma (dotenv bağımlılığı olmadan)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ENV_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "..", ".env.local");

export function loadEnv() {
    const fileEnv = {};
    if (existsSync(ENV_PATH)) {
        for (const line of readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
            if (line.trim().startsWith("#")) continue;
            const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
            if (m) fileEnv[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
        }
    }
    return { ...fileEnv, ...process.env };
}

export function setEnvVar(key, value) {
    const lines = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8").split(/\r?\n/) : [];
    const i = lines.findIndex((l) => l.match(new RegExp(`^\\s*${key}\\s*=`)));
    if (i >= 0) lines[i] = `${key}=${value}`;
    else lines.push(`${key}=${value}`);
    writeFileSync(ENV_PATH, lines.filter((l, idx, a) => l !== "" || idx < a.length - 1).join("\n") + "\n", { mode: 0o600 });
}
