// Regenerates src/generated/ from protos/ with the protobuf-ts plugin.
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const protoDir = path.join(root, "protos");
const outDir = path.join(root, "src", "generated");

const listProtos = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return listProtos(full);
        return entry.name.endsWith(".proto") ? [full] : [];
    });

const files = listProtos(protoDir)
    .map((file) => path.relative(root, file).split(path.sep).join("/"))
    .sort();

if (files.length === 0) {
    console.error(`No .proto files found in ${protoDir}. Run npm run proto:sync first.`);
    process.exit(1);
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

execFileSync(
    "npx",
    [
        "protoc",
        "--ts_out",
        "src/generated",
        "--ts_opt",
        "long_type_number,generate_dependencies",
        "--proto_path",
        "protos",
        ...files,
    ],
    { cwd: root, stdio: "inherit", shell: process.platform === "win32" },
);

console.log(`Generated ${files.length} proto files into src/generated.`);
