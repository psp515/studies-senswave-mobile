const js = require("@eslint/js");
const tseslint = require("typescript-eslint");
const ts = require("@typescript-eslint/eslint-plugin");
const react = require("eslint-plugin-react");
const reactHooks = require("eslint-plugin-react-hooks");
const prettier = require("eslint-plugin-prettier");

module.exports = [
    {
        ignores: [".expo/**", "node_modules/**", "dist/**", "build/**", "*.config.js", "*.config.cjs", "src/generated/**"],
    },
    {
        files: ["scripts/**/*.js"],
        languageOptions: {
            globals: { require: "readonly", __dirname: "readonly", process: "readonly", console: "readonly" },
        },
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        plugins: { react, "react-hooks": reactHooks, prettier },
        rules: {
            "prettier/prettier": "error",
            "react-hooks/rules-of-hooks": "error",
            "react-hooks/exhaustive-deps": "warn",
            "@typescript-eslint/no-require-imports": "off",
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
            "@typescript-eslint/no-non-null-asserted-optional-chain": "warn",
        },
    },
];
