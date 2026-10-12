const { buildNetworkSecurityConfig, parseHosts } = require("../withDevCaTrust");

describe("parseHosts", () => {
    it("splits, trims and drops empty entries", () => {
        expect(parseHosts(" localhost, api.dev.local ,,")).toEqual(["localhost", "api.dev.local"]);
    });

    it("returns an empty list when unset", () => {
        expect(parseHosts(undefined)).toEqual([]);
    });
});

describe("buildNetworkSecurityConfig", () => {
    it("trusts the dev CA only inside the dev host domain-config", () => {
        const xml = buildNetworkSecurityConfig({ hosts: ["localhost"], cleartextPermitted: false });

        expect(xml).toContain('<base-config cleartextTrafficPermitted="false">');
        expect(xml).toContain('<domain includeSubdomains="false">localhost</domain>');

        const baseConfig = xml.slice(xml.indexOf("<base-config"), xml.indexOf("</base-config>"));
        expect(baseConfig).not.toContain("@raw/senswave_dev_ca");

        const domainConfig = xml.slice(
            xml.indexOf("<domain-config"),
            xml.indexOf("</domain-config>"),
        );
        expect(domainConfig).toContain('<certificates src="@raw/senswave_dev_ca" />');
        expect(domainConfig).toContain('<certificates src="system" />');
    });

    it("permits cleartext in the debug variant", () => {
        const xml = buildNetworkSecurityConfig({ hosts: ["localhost"], cleartextPermitted: true });

        expect(xml).toContain('<base-config cleartextTrafficPermitted="true">');
    });
});
