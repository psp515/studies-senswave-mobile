// Trusts certs/dev-ca.crt for the hosts in EXPO_PUBLIC_DEV_CA_HOSTS, in every build type.
// Production hosts are never listed, so they keep system CAs only.
const { AndroidConfig, withAndroidManifest, withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const certSource = path.join("certs", "dev-ca.crt");
const rawName = "senswave_dev_ca";
const xmlName = "network_security_config";

const parseHosts = (value) =>
    (value ?? "")
        .split(",")
        .map((host) => host.trim())
        .filter((host) => host !== "");

const buildNetworkSecurityConfig = ({ hosts, cleartextPermitted }) =>
    [
        '<?xml version="1.0" encoding="utf-8"?>',
        "<network-security-config>",
        `    <base-config cleartextTrafficPermitted="${cleartextPermitted}">`,
        "        <trust-anchors>",
        '            <certificates src="system" />',
        "        </trust-anchors>",
        "    </base-config>",
        "    <domain-config>",
        ...hosts.map((host) => `        <domain includeSubdomains="false">${host}</domain>`),
        "        <trust-anchors>",
        `            <certificates src="@raw/${rawName}" />`,
        '            <certificates src="system" />',
        "        </trust-anchors>",
        "    </domain-config>",
        "</network-security-config>",
        "",
    ].join("\n");

const writeFile = (file, content) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
};

const withDevCaTrust = (config) => {
    const hosts = parseHosts(process.env.EXPO_PUBLIC_DEV_CA_HOSTS);
    const certPath = path.resolve(process.cwd(), certSource);

    if (hosts.length === 0 || !fs.existsSync(certPath)) {
        console.warn(
            `[withDevCaTrust] Skipped: needs EXPO_PUBLIC_DEV_CA_HOSTS and ${certSource}. System CAs only.`,
        );
        return config;
    }

    config = withDangerousMod(config, [
        "android",
        async (cfg) => {
            const src = path.join(cfg.modRequest.platformProjectRoot, "app", "src");

            fs.mkdirSync(path.join(src, "main", "res", "raw"), { recursive: true });
            fs.copyFileSync(certPath, path.join(src, "main", "res", "raw", `${rawName}.crt`));

            // Release keeps cleartext off; debug keeps it on for Metro, as Expo's debug manifest does.
            writeFile(
                path.join(src, "main", "res", "xml", `${xmlName}.xml`),
                buildNetworkSecurityConfig({ hosts, cleartextPermitted: false }),
            );
            writeFile(
                path.join(src, "debug", "res", "xml", `${xmlName}.xml`),
                buildNetworkSecurityConfig({ hosts, cleartextPermitted: true }),
            );

            return cfg;
        },
    ]);

    return withAndroidManifest(config, (cfg) => {
        const application = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
        application.$["android:networkSecurityConfig"] = `@xml/${xmlName}`;
        return cfg;
    });
};

module.exports = withDevCaTrust;
module.exports.parseHosts = parseHosts;
module.exports.buildNetworkSecurityConfig = buildNetworkSecurityConfig;
