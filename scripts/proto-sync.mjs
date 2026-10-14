// Copies backend proto files into ./proto so the app builds without a backend checkout.
// Source dir comes from SENSWAVE_BACKEND_PROTO_DIR in .env (or the environment).
import { cpSync, existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const envFile = resolve(process.cwd(), ".env");
if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
    }
}

const source = process.env.SENSWAVE_BACKEND_PROTO_DIR;
if (!source || !existsSync(source)) {
    console.error("SENSWAVE_BACKEND_PROTO_DIR is not set or does not exist:", source);
    process.exit(1);
}

const target = resolve(process.cwd(), "proto");
rmSync(target, { recursive: true, force: true });
cpSync(source, target, {
    recursive: true,
    filter: (src) => !src.includes("obj") && !src.includes("bin"),
});
console.log(`Synced protos from ${source} to ${target}`);
