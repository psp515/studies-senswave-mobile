// Copies backend proto files into ./proto so the app builds without a backend checkout.
// Source dir comes from SENSWAVE_BACKEND_PROTO_DIR in .env (or the environment).
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

function parseValue(raw) {
    let value = raw.trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.length > 1 && value.endsWith(quote)) {
        return value.slice(1, -1);
    }
    return value.replace(/\s+#.*$/, "").trim();
}

const envFile = resolve(process.cwd(), ".env");
if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=(.*)$/);
        if (m && process.env[m[1]] === undefined) process.env[m[1]] = parseValue(m[2]);
    }
}

const source = process.env.SENSWAVE_BACKEND_PROTO_DIR;
if (!source || !existsSync(source)) {
    console.error("SENSWAVE_BACKEND_PROTO_DIR is not set or does not exist:", source);
    process.exit(1);
}

function countProtos(dir) {
    return readdirSync(dir, { withFileTypes: true }).reduce(
        (sum, e) =>
            sum + (e.isDirectory() ? countProtos(join(dir, e.name)) : +e.name.endsWith(".proto")),
        0,
    );
}

const staging = mkdtempSync(join(tmpdir(), "senswave-proto-"));
try {
    cpSync(source, staging, {
        recursive: true,
        filter: (src) =>
            !relative(source, src)
                .split(/[\\/]/)
                .some((segment) => segment === "obj" || segment === "bin"),
    });
    if (countProtos(staging) === 0) {
        console.error("No .proto files found in", source, "- leaving ./proto untouched");
        process.exit(1);
    }
    const target = resolve(process.cwd(), "proto");
    rmSync(target, { recursive: true, force: true });
    cpSync(staging, target, { recursive: true });
    console.log(`Synced protos from ${source} to ${target}`);
} finally {
    rmSync(staging, { recursive: true, force: true });
}
