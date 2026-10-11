// Copies the backend protos into protos/ and regenerates src/generated/.
// Source override: SENSWAVE_PROTO_SOURCE=<path to Protos directory>.
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const protoDir = path.join(root, "protos");
const source = path.resolve(
    root,
    process.env.SENSWAVE_PROTO_SOURCE ??
        "../studies-senswave-backend/src/Shared/Senswave.Contracts/Protos",
);

if (!fs.existsSync(source)) {
    console.error(`Proto source not found: ${source}`);
    process.exit(1);
}

fs.rmSync(protoDir, { recursive: true, force: true });
fs.cpSync(source, protoDir, {
    recursive: true,
    filter: (src) => fs.statSync(src).isDirectory() || src.endsWith(".proto"),
});

console.log(`Copied protos from ${source}.`);

require("./proto-gen");
